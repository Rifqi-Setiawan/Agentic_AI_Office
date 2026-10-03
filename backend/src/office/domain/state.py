from __future__ import annotations

import logging
import time
from collections import deque
from datetime import datetime
from typing import Any, Literal
from zoneinfo import ZoneInfo

from office.config import OfficeConfig
from office.domain.normalizer import EventNormalizer
from office.models.events import OfficeEvent
from office.models.host import HostVitals
from office.models.kanban import KanbanEventRow, TaskRef, TaskRow
from office.models.profiles import AgentProfile
from office.models.state import AgentState, CollectiveEventState, WorldSnapshot
from office.projection import (
    FounderWorldSnapshot,
    PublicWorldSnapshot,
    project_world_snapshot_founder,
    project_world_snapshot_public,
)
from office.sources.profiles import STATIC_AGENT_METADATA

logger = logging.getLogger(__name__)

# Timezone Asia/Jakarta (WIB)
WIB_TZ = ZoneInfo("Asia/Jakarta")

# Batas waktu sesuai spesifikasi Dokumen 01 & ADR-004
HEARTBEAT_STALE_THRESHOLD_SECONDS = 120  # Task running, heartbeat >= 120 dtk -> stale
FAILED_STATE_DURATION_SECONDS = 60  # Run berakhir failed/crashed -> 60 dtk
DONE_RECENT_DURATION_SECONDS = 45  # Run berakhir completed -> 45 dtk
RING_BUFFER_CAPACITY = 500  # Kapasitas circular ring buffer event


def get_wib_start_of_day(ts: int | float | None = None) -> int:
    """Mengembalikan Unix timestamp detik pada 00:00:00 WIB untuk waktu ts (atau sekarang)."""
    if ts is None:
        dt = datetime.now(WIB_TZ)
    else:
        dt = datetime.fromtimestamp(ts, tz=WIB_TZ)
    start_of_day = dt.replace(hour=0, minute=0, second=0, microsecond=0)
    return int(start_of_day.timestamp())


def get_wib_time_of_day(ts: int | float | None = None) -> Literal["dawn", "day", "dusk", "night"]:
    """Menentukan atmosfer pencahayaan berdasarkan jam WIB.

    - 05:00 - 06:59: dawn (fajar)
    - 07:00 - 14:59: day (siang)
    - 15:00 - 17:59: dusk (senja)
    - 18:00 - 04:59: night (malam)
    """
    if ts is None:
        dt = datetime.now(WIB_TZ)
    else:
        dt = datetime.fromtimestamp(ts, tz=WIB_TZ)
    hour = dt.hour
    if 5 <= hour < 7:
        return "dawn"
    elif 7 <= hour < 15:
        return "day"
    elif 15 <= hour < 18:
        return "dusk"
    else:
        return "night"


class EventRingBuffer:
    """Circular ring buffer berkapasitas 500 OfficeEvent dengan monotonic sequence counter."""

    def __init__(self, capacity: int = RING_BUFFER_CAPACITY, start_seq: int = 1) -> None:
        self.capacity = capacity
        self._buffer: deque[OfficeEvent] = deque(maxlen=capacity)
        self._seq = start_seq

    @property
    def current_seq(self) -> int:
        return self._seq

    def next_seq(self) -> int:
        val = self._seq
        self._seq += 1
        return val

    def append(self, event: OfficeEvent) -> None:
        """Menambahkan event ke dalam buffer, menggusur event terlama jika kapasitas penuh."""
        if event.seq >= self._seq:
            self._seq = event.seq + 1
        self._buffer.append(event)

    def get_recent(self, limit: int = 500) -> list[OfficeEvent]:
        """Mengambil daftar event terbaru hingga batas limit dalam urutan kronologis."""
        items = list(self._buffer)
        if limit and len(items) > limit:
            return items[-limit:]
        return items

    def get_since(self, last_seq: int) -> tuple[bool, list[OfficeEvent]]:
        """Mendapatkan delta event untuk resume SSE via Last-Event-ID.

        Mengembalikan (can_resume, events):
        - can_resume True: last_seq valid, kirim delta.
        - can_resume False: gap terlalu besar (tergusur dari buffer) atau last_seq tidak valid,
          klien wajib menerima snapshot utuh (resync).
        """
        if not self._buffer:
            # Buffer kosong: jika klien meminta seq sekarang atau 0, resume aman
            return (last_seq == 0 or last_seq == (self._seq - 1), [])

        oldest_seq = self._buffer[0].seq
        newest_seq = self._buffer[-1].seq

        # Jika last_seq lebih besar dari event terbaru kita, anggap up-to-date
        if last_seq >= newest_seq:
            return (True, [])

        # Jika last_seq lebih kecil dari event tertua di buffer, gap sudah terputus
        if last_seq < oldest_seq - 1:
            return (False, [])

        delta = [ev for ev in self._buffer if ev.seq > last_seq]
        return (True, delta)


class StateEngine:
    """Mesin state utama virtual office di memori (Stateless Backend).

    Tanggung Jawab:
    - Mempertahankan state 16 agen + agen tamu.
    - Menurunkan work status sesuai tabel spec bagian 1:
      (working, stale >= 120 dtk, blocked, failed 60 dtk, done_recent 45 dtk, idle, off_duty).
    - Menghitung agregasi harian done_today sejak 00:00:00 WIB.
    - Menjaga ring buffer 500 event untuk resume koneksi SSE.
    - Melakukan rekonsiliasi periodik dari tabel tasks Hermes.
    """

    def __init__(
        self,
        normalizer: EventNormalizer | None = None,
        ring_buffer: EventRingBuffer | None = None,
        boot_time: int | None = None,
    ) -> None:
        now_ts = int(time.time()) if boot_time is None else boot_time
        self.normalizer = normalizer or EventNormalizer(start_seq=1)
        self.ring_buffer = ring_buffer or EventRingBuffer(
            capacity=RING_BUFFER_CAPACITY, start_seq=self.normalizer.current_seq
        )

        # In-memory Agent states: agent_id -> AgentState
        self._agents: dict[str, AgentState] = {}
        # Status profil: agent_id -> "configured" | "stopped" | dll
        self._profile_status: dict[str, str] = {}
        # Active tasks: agent_id -> TaskRow
        self._agent_active_tasks: dict[str, TaskRow] = {}
        # Timer penyelesaian sementara (done_recent 45 dtk): agent_id -> (completed_ts, TaskRef)
        self._recent_completions: dict[str, tuple[int, TaskRef]] = {}
        # Timer kegagalan sementara (failed 60 dtk): agent_id -> (failed_ts, TaskRef)
        self._recent_failures: dict[str, tuple[int, TaskRef]] = {}

        # Cache task selesai hari ini: task_id -> (assignee, completed_at)
        self._completed_tasks_today: dict[str, tuple[str, int]] = {}

        # Active collective event
        self._active_collective: CollectiveEventState | None = None
        # Vitals cache
        self._vitals: HostVitals = HostVitals(
            cpu_percent=0.0,
            memory_percent=0.0,
            disk_percent=0.0,
            status="healthy",
            details=None,
        )

        # Inisialisasi 16 agen standar
        self._init_agents(now_ts)

    def _init_agents(self, now_ts: int) -> None:
        """Inisialisasi 16 agen awal dari metadata statis."""
        for aid, meta in STATIC_AGENT_METADATA.items():
            self._profile_status[aid] = "configured"
            self._agents[aid] = AgentState(
                id=aid,
                name=str(meta.get("name", aid.capitalize())),
                role=str(meta.get("role", "Specialist")),
                presence="on_duty",
                work="idle",
                since=now_ts,
                done_today=0,
                zone=str(meta.get("desk_zone", "dev_pod_1")),
                action="Standby di meja kerja",
                grid_x=None,
                grid_y=None,
                direction="SE",
                task=None,
            )

    @property
    def agents(self) -> dict[str, AgentState]:
        return dict(self._agents)

    def get_agent(self, agent_id: str) -> AgentState | None:
        return self._agents.get(agent_id.lower().strip())

    def set_vitals(self, vitals: HostVitals) -> None:
        self._vitals = vitals

    def set_active_collective(self, collective: CollectiveEventState | None) -> None:
        self._active_collective = collective

    def ensure_agent(self, agent_id: str, now_ts: int) -> AgentState:
        """Memastikan agent terdaftar di state engine, membuat agent tamu jika belum ada."""
        aid = agent_id.lower().strip()
        if aid not in self._agents:
            meta = STATIC_AGENT_METADATA.get(aid, {})
            name = str(meta.get("name") or aid.capitalize())
            role = str(meta.get("role") or "Guest Agent")
            zone = str(meta.get("desk_zone") or "dev_pod_1")
            self._profile_status[aid] = "configured"
            self._agents[aid] = AgentState(
                id=aid,
                name=name,
                role=role,
                presence="on_duty",
                work="idle",
                since=now_ts,
                done_today=0,
                zone=zone,
                action="Standby di meja kerja",
                task=None,
            )
        return self._agents[aid]

    def _derive_agent_state(
        self,
        agent_id: str,
        now_ts: int,
        task: TaskRow | None = None,
    ) -> None:
        """Menurunkan work, presence, action, dan zone seorang agen sesuai tabel spec bagian 1."""
        agent = self.ensure_agent(agent_id, now_ts)
        meta = STATIC_AGENT_METADATA.get(agent_id, {})
        desk_zone = str(meta.get("desk_zone") or "dev_pod_1")
        prof_status = self._profile_status.get(agent_id, "configured")

        # 1. Kasus Baris 8: Profil stopped -> off_duty
        if prof_status == "stopped":
            new_work: Literal[
                "idle", "working", "blocked", "stale", "failed", "done_recent", "off_duty"
            ] = "off_duty"
            new_presence: Literal["on_duty", "off_duty"] = "off_duty"
            new_action = "Sedang di luar jam kerja (off-duty)"
            new_zone = "lobi"
            new_task_ref = None

            if agent.work != new_work or agent.presence != new_presence:
                agent.since = now_ts
            agent.work = new_work
            agent.presence = new_presence
            agent.action = new_action
            agent.zone = new_zone
            agent.task = new_task_ref
            return

        # Profil aktif -> presence on_duty
        new_presence = "on_duty"

        # 2. Periksa apakah agen memiliki task aktif (running / blocked)
        if task is not None and task.status in ("running", "blocked"):
            task_ref = self.normalizer.build_task_ref(task, board=task.board, task_id=task.id)

            if task.status == "running":
                # Hitung usia heartbeat
                last_beat = task.last_heartbeat_at or task.started_at or now_ts
                heartbeat_age = max(0, now_ts - last_beat)

                if heartbeat_age >= HEARTBEAT_STALE_THRESHOLD_SECONDS:
                    # Kasus Baris 2: Task running, heartbeat >= 120 dtk -> stale
                    new_work = "stale"
                    new_action = f"Duduk termenung (task stale): {task.title}"
                    new_zone = desk_zone
                else:
                    # Kasus Baris 1: Task running, heartbeat < 120 dtk -> working
                    new_work = "working"
                    new_action = f"Mengerjakan tugas: {task.title}"
                    new_zone = desk_zone

            elif task.status == "blocked":
                new_work = "blocked"
                if task.block_kind == "needs_input":
                    # Kasus Baris 3: Task blocked, block_kind=needs_input
                    new_action = "Menunggu masukan di ruang Jarvis"
                    new_zone = "ruang_ceo"
                else:
                    # Kasus Baris 4: Task blocked, jenis lain
                    kind_str = task.block_kind or "ketergantungan"
                    new_action = f"Tugas terblokir ({kind_str}): {task.title}"
                    new_zone = desk_zone

            if agent.work != new_work:
                agent.since = now_ts
            agent.work = new_work
            agent.presence = new_presence
            agent.action = new_action
            agent.zone = new_zone
            agent.task = task_ref
            return

        # 3. Tidak ada task aktif: Periksa status transien baru (failed atau done_recent)
        # Periksa apakah ada recent failure dalam 60 detik
        if agent_id in self._recent_failures:
            failed_ts, fail_task_ref = self._recent_failures[agent_id]
            if (now_ts - failed_ts) < FAILED_STATE_DURATION_SECONDS:
                # Kasus Baris 5: Run berakhir crashed / timed_out / spawn_failed -> failed (60 dtk)
                new_work = "failed"
                new_action = f"Mengatasi kegagalan run pada tugas: {fail_task_ref.title}"
                new_zone = desk_zone
                if agent.work != new_work:
                    agent.since = failed_ts
                agent.work = new_work
                agent.presence = new_presence
                agent.action = new_action
                agent.zone = new_zone
                agent.task = fail_task_ref
                return
            else:
                del self._recent_failures[agent_id]

        # Periksa apakah ada recent completion dalam 45 detik
        if agent_id in self._recent_completions:
            done_ts, done_task_ref = self._recent_completions[agent_id]
            if (now_ts - done_ts) < DONE_RECENT_DURATION_SECONDS:
                # Kasus Baris 6: Run berakhir completed -> done_recent (45 dtk)
                new_work = "done_recent"
                new_action = f"Merayakan penyelesaian tugas: {done_task_ref.title}"
                new_zone = desk_zone
                if agent.work != new_work:
                    agent.since = done_ts
                agent.work = new_work
                agent.presence = new_presence
                agent.action = new_action
                agent.zone = new_zone
                agent.task = done_task_ref
                return
            else:
                del self._recent_completions[agent_id]

        # 4. Kasus Baris 7: Tidak ada task aktif -> idle
        new_work = "idle"
        new_action = "Standby di meja kerja"
        new_zone = desk_zone
        new_task_ref = None

        if agent.work != new_work:
            agent.since = now_ts
        agent.work = new_work
        agent.presence = new_presence
        agent.action = new_action
        agent.zone = new_zone
        agent.task = new_task_ref

    def _recalculate_done_today(self, now_ts: int) -> None:
        """Menghitung ulang done_today untuk seluruh agen sejak 00:00:00 WIB hari ini."""
        start_of_day_ts = get_wib_start_of_day(now_ts)

        counts: dict[str, int] = {aid: 0 for aid in self._agents}

        # Bersihkan cache selesai yang lebih lama dari 7 hari agar hemat RAM
        for tid, (assignee, comp_at) in list(self._completed_tasks_today.items()):
            if comp_at < start_of_day_ts - 86400 * 7:
                del self._completed_tasks_today[tid]
                continue
            if comp_at >= start_of_day_ts:
                counts[assignee] = counts.get(assignee, 0) + 1

        for aid, agent in self._agents.items():
            agent.done_today = counts.get(aid, 0)

    def process_event(
        self,
        raw_event: KanbanEventRow | dict[str, Any],
        task: TaskRow | TaskRef | dict[str, Any] | None = None,
        current_time: int | None = None,
    ) -> OfficeEvent | None:
        """Memproses satu event mentah dari KanbanReader.

        - Heartbeat memperbarui last_heartbeat_at task dan memulihkan state dari stale -> working,
          namun TIDAK disiarkan ke ring buffer / feed (mengembalikan None).
        - Event lain dinormalisasi, dimasukkan ke ring buffer, dan memutasi state agent.
        """
        now_ts = int(time.time()) if current_time is None else current_time

        # Ekstraksi atribut mentah
        if isinstance(raw_event, KanbanEventRow):
            raw_kind = raw_event.kind
            task_id = raw_event.task_id
            created_at = raw_event.created_at
            raw_payload = raw_event.payload
            board = raw_event.board
        else:
            raw_kind = str(raw_event.get("kind", ""))
            task_id = str(raw_event.get("task_id", ""))
            created_at = int(raw_event.get("created_at", now_ts))
            raw_payload = raw_event.get("payload")
            board = str(raw_event.get("board", "global"))

        payload_dict: dict[str, Any] = {}
        if isinstance(raw_payload, dict):
            payload_dict = raw_payload

        # Cari agent target
        agent_id: str | None = (
            payload_dict.get("profile")
            or payload_dict.get("assignee")
            or (getattr(task, "assignee", None) if task else None)
        )
        if isinstance(task, dict) and not agent_id:
            agent_id = task.get("assignee")

        # 1. ATURAN: Event heartbeat tidak disiarkan
        if raw_kind == "heartbeat":
            if agent_id and agent_id in self._agent_active_tasks:
                active_t = self._agent_active_tasks[agent_id]
                if active_t.id == task_id:
                    active_t.last_heartbeat_at = created_at
                    # Jika sebelumnya stale, kembalikan ke working
                    self._derive_agent_state(agent_id, now_ts, active_t)
            return None

        # 2. Normalisasi event untuk event selain heartbeat
        assigned_seq = self.ring_buffer.next_seq()
        office_event = self.normalizer.normalize(raw_event, task=task, seq=assigned_seq)
        if not office_event:
            return None

        # Simpan ke ring buffer 500 item
        self.ring_buffer.append(office_event)

        # 3. Update mutasi state internal agen
        target_aid = office_event.agent
        if target_aid:
            aid = target_aid.lower().strip()
            self.ensure_agent(aid, now_ts)

            if office_event.kind == "task_started":
                # Task baru mulai: batalkan timer transien
                self._recent_completions.pop(aid, None)
                self._recent_failures.pop(aid, None)
                if isinstance(task, TaskRow):
                    task_row = task
                else:
                    task_title = (
                        office_event.task.title
                        if office_event.task
                        else payload_dict.get("title") or f"Tugas {task_id}"
                    )
                    task_row = TaskRow(
                        id=office_event.task.id if office_event.task else task_id,
                        board=office_event.task.board if office_event.task else board,
                        title=task_title,
                        assignee=aid,
                        status="running",
                        created_at=created_at,
                        started_at=created_at,
                    )
                self._agent_active_tasks[aid] = task_row
                self._derive_agent_state(aid, now_ts, task_row)

            elif office_event.kind == "task_blocked":
                block_kind = payload_dict.get("block_kind") or payload_dict.get("kind")
                if aid in self._agent_active_tasks:
                    self._agent_active_tasks[aid].status = "blocked"
                    self._agent_active_tasks[aid].block_kind = block_kind
                    self._derive_agent_state(aid, now_ts, self._agent_active_tasks[aid])
                else:
                    task_title = (
                        office_event.task.title
                        if office_event.task
                        else payload_dict.get("title") or f"Tugas {task_id}"
                    )
                    task_row = TaskRow(
                        id=office_event.task.id if office_event.task else task_id,
                        board=office_event.task.board if office_event.task else board,
                        title=task_title,
                        assignee=aid,
                        status="blocked",
                        block_kind=block_kind,
                        created_at=created_at,
                    )
                    self._agent_active_tasks[aid] = task_row
                    self._derive_agent_state(aid, now_ts, task_row)

            elif office_event.kind == "task_done":
                # Catat penyelesaian tugas hari ini
                self._completed_tasks_today[task_id] = (aid, created_at)
                self._recalculate_done_today(now_ts)

                # Pasang timer done_recent (45 detik)
                task_ref = office_event.task or self.normalizer.build_task_ref(
                    task, board=board, task_id=task_id
                )
                if task_ref:
                    self._recent_completions[aid] = (created_at, task_ref)
                self._agent_active_tasks.pop(aid, None)
                self._derive_agent_state(aid, now_ts, None)

            elif office_event.kind == "task_failed":
                # Pasang timer failed (60 detik)
                task_ref = office_event.task or self.normalizer.build_task_ref(
                    task, board=board, task_id=task_id
                )
                if task_ref:
                    self._recent_failures[aid] = (created_at, task_ref)
                self._agent_active_tasks.pop(aid, None)
                self._derive_agent_state(aid, now_ts, None)

            elif office_event.kind == "agent_online":
                self._profile_status[aid] = "configured"
                current_active = self._agent_active_tasks.get(aid)
                self._derive_agent_state(aid, now_ts, current_active)

            elif office_event.kind == "agent_offline":
                self._profile_status[aid] = "stopped"
                self._derive_agent_state(aid, now_ts, None)

        return office_event

    def reconcile_tasks(
        self,
        tasks: list[TaskRow],
        current_time: int | None = None,
    ) -> list[OfficeEvent]:
        """Rekonsiliasi periodik (tiap 10 dtk) dari snapshot tabel tasks semua board.

        - Memperbarui agregasi done_today dari 00:00:00 Asia/Jakarta.
        - Memperbarui task aktif per agen.
        - Mendeteksi task stale (heartbeat >= 120 detik) dan memancarkan event task_stale.
        - Mengembalikan daftar OfficeEvent baru yang terdeteksi selama rekonsiliasi.
        """
        now_ts = int(time.time()) if current_time is None else current_time
        start_of_day_ts = get_wib_start_of_day(now_ts)
        emitted_events: list[OfficeEvent] = []

        # 1. Agregasi seluruh task selesai sejak 00:00:00 WIB
        for t in tasks:
            if t.completed_at and t.completed_at >= start_of_day_ts and t.assignee:
                aid = t.assignee.lower().strip()
                self._completed_tasks_today[t.id] = (aid, t.completed_at)

        self._recalculate_done_today(now_ts)

        # 2. Kelompokkan task aktif (running / blocked) berdasarkan assignee
        active_by_assignee: dict[str, list[TaskRow]] = {}
        for t in tasks:
            if t.assignee and t.status in ("running", "blocked"):
                aid = t.assignee.lower().strip()
                active_by_assignee.setdefault(aid, []).append(t)

        # 3. Pilih task primer per agen (running > blocked, atau started_at terbaru)
        current_primary_tasks: dict[str, TaskRow] = {}
        for aid, task_list in active_by_assignee.items():
            # Prioritaskan running, lalu started_at terbaru
            task_list.sort(
                key=lambda x: (
                    1 if x.status == "running" else 0,
                    x.started_at or 0,
                    x.priority,
                ),
                reverse=True,
            )
            current_primary_tasks[aid] = task_list[0]

        # Simpan state task aktif baru
        self._agent_active_tasks = current_primary_tasks

        # 4. Evaluasi ulang state setiap agen terdaftar
        for aid in list(self._agents.keys()):
            primary_t = self._agent_active_tasks.get(aid)
            prev_work = self._agents[aid].work

            self._derive_agent_state(aid, now_ts, primary_t)

            # Jika agen baru saja menjadi stale karena melewati batas 120s, buat event task_stale
            if self._agents[aid].work == "stale" and prev_work != "stale" and primary_t:
                stale_ev = self.normalizer.normalize(
                    event_row={
                        "kind": "task_stale",
                        "board": primary_t.board,
                        "task_id": primary_t.id,
                        "created_at": now_ts,
                        "payload": {"assignee": aid, "title": primary_t.title},
                    },
                    task=primary_t,
                    seq=self.ring_buffer.next_seq(),
                )
                if stale_ev:
                    self.ring_buffer.append(stale_ev)
                    emitted_events.append(stale_ev)

        return emitted_events

    def update_profiles(
        self,
        profiles: dict[str, AgentProfile],
        current_time: int | None = None,
    ) -> None:
        """Memperbarui informasi profil agent dan status on_duty / off_duty."""
        now_ts = int(time.time()) if current_time is None else current_time
        for aid, prof in profiles.items():
            clean_aid = aid.lower().strip()
            self._profile_status[clean_aid] = prof.status
            agent = self.ensure_agent(clean_aid, now_ts)
            agent.name = prof.bio.name
            agent.role = prof.bio.role
            agent.zone = prof.bio.desk_zone

            active_t = self._agent_active_tasks.get(clean_aid)
            self._derive_agent_state(clean_aid, now_ts, active_t)

    def tick(self, current_time: int | None = None) -> list[OfficeEvent]:
        """Siklus evaluasi waktu (ambient tick): memeriksa kedaluwarsa durasi transien.

        - Memeriksa failed state (> 60 dtk) -> kembali ke idle.
        - Memeriksa done_recent state (> 45 dtk) -> kembali ke idle.
        - Memeriksa task stale (> 120 dtk) -> transisi ke stale.
        - Memeriksa pergantian hari WIB (23:59 -> 00:00) -> recalculate done_today.
        """
        now_ts = int(time.time()) if current_time is None else current_time
        emitted_events: list[OfficeEvent] = []

        # Recalculate done_today untuk mengantisipasi pergantian hari (midnight)
        self._recalculate_done_today(now_ts)

        for aid in list(self._agents.keys()):
            primary_t = self._agent_active_tasks.get(aid)
            prev_work = self._agents[aid].work

            self._derive_agent_state(aid, now_ts, primary_t)

            if self._agents[aid].work == "stale" and prev_work != "stale" and primary_t:
                stale_ev = self.normalizer.normalize(
                    event_row={
                        "kind": "task_stale",
                        "board": primary_t.board,
                        "task_id": primary_t.id,
                        "created_at": now_ts,
                        "payload": {"assignee": aid, "title": primary_t.title},
                    },
                    task=primary_t,
                    seq=self.ring_buffer.next_seq(),
                )
                if stale_ev:
                    self.ring_buffer.append(stale_ev)
                    emitted_events.append(stale_ev)

        return emitted_events

    def get_snapshot(
        self,
        projection: Literal["public", "founder"] = "public",
        current_time: int | None = None,
        config: OfficeConfig | None = None,
    ) -> PublicWorldSnapshot | FounderWorldSnapshot:
        """Menghasilkan WorldSnapshot terkini untuk klien REST / SSE sesuai proyeksi."""
        now_ts = int(time.time()) if current_time is None else current_time
        tod = get_wib_time_of_day(now_ts)
        last_seq = self.ring_buffer.current_seq - 1

        # Salinan snapshot agen berurutan stabil berdasarkan id
        agent_list = [self._agents[aid] for aid in sorted(self._agents.keys())]
        recent_events = self.ring_buffer.get_recent(limit=500)

        raw_snapshot = WorldSnapshot(
            generated_at=now_ts,
            seq=max(0, last_seq),
            projection=projection,
            time_of_day=tod,
            agents=agent_list,
            recent_events=recent_events,
            active_collective=self._active_collective,
            vitals=self._vitals,
        )

        if projection == "founder":
            return project_world_snapshot_founder(raw_snapshot)
        return project_world_snapshot_public(raw_snapshot, config=config)
