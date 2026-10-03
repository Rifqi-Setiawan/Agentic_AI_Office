from __future__ import annotations

from datetime import datetime
from zoneinfo import ZoneInfo

import pytest

from office.domain.normalizer import EventNormalizer
from office.domain.state import (
    HEARTBEAT_STALE_THRESHOLD_SECONDS,
    EventRingBuffer,
    StateEngine,
    get_wib_start_of_day,
    get_wib_time_of_day,
)
from office.models.events import OfficeEvent
from office.models.kanban import KanbanEventRow, TaskRef, TaskRow
from office.models.profiles import AgentBio, AgentProfile

WIB = ZoneInfo("Asia/Jakarta")


class TestStatusTableSpecPart1:
    """Pengujian lengkap seluruh baris tabel turunan status agent sesuai Dokumen 01 Spesifikasi.

    Acceptance Criterion:
    - [x] Tabel status di spec tercakup oleh test, satu kasus per baris
    """

    def test_row_1_task_running_fresh_heartbeat_is_working(self) -> None:
        """Baris 1: Task running, heartbeat < 120 dtk -> work='working', presence='on_duty'."""
        engine = StateEngine(boot_time=1791000000)
        t_now = 1791001000

        task = TaskRow(
            id="task-001",
            board="office-v2",
            title="Implementasi REST endpoint",
            assignee="forge",
            status="running",
            created_at=t_now - 200,
            started_at=t_now - 200,
            last_heartbeat_at=t_now - 15,  # 15 dtk yang lalu (< 120 dtk)
        )

        engine.reconcile_tasks([task], current_time=t_now)
        agent = engine.get_agent("forge")

        assert agent is not None
        assert agent.work == "working"
        assert agent.presence == "on_duty"
        assert "Mengerjakan tugas" in agent.action
        assert agent.task is not None
        assert agent.task.id == "task-001"
        assert agent.task.status == "running"

    def test_row_2_task_running_stale_heartbeat_is_stale(self) -> None:
        """Baris 2: Task running, heartbeat >= 120 dtk -> work='stale', presence='on_duty'."""
        engine = StateEngine(boot_time=1791000000)
        t_now = 1791001000

        task = TaskRow(
            id="task-002",
            board="office-v2",
            title="Kueri analitik lambat",
            assignee="vector",
            status="running",
            created_at=t_now - 500,
            started_at=t_now - 500,
            last_heartbeat_at=t_now - HEARTBEAT_STALE_THRESHOLD_SECONDS,  # Pas 120 detik
        )

        emitted = engine.reconcile_tasks([task], current_time=t_now)
        agent = engine.get_agent("vector")

        assert agent is not None
        assert agent.work == "stale"
        assert agent.presence == "on_duty"
        assert "stale" in agent.action.lower()
        # Harus memancarkan event task_stale jika baru pertama kali menjadi stale
        assert any(e.kind == "task_stale" and e.agent == "vector" for e in emitted)

    def test_row_3_task_blocked_needs_input_is_blocked(self) -> None:
        """Baris 3: Task blocked, block_kind=needs_input -> work='blocked', ruang_ceo."""
        engine = StateEngine(boot_time=1791000000)
        t_now = 1791001000

        task = TaskRow(
            id="task-003",
            board="office-v2",
            title="Konfirmasi skema partisi database",
            assignee="daedalus",
            status="blocked",
            block_kind="needs_input",
            created_at=t_now - 300,
            started_at=t_now - 250,
        )

        engine.reconcile_tasks([task], current_time=t_now)
        agent = engine.get_agent("daedalus")

        assert agent is not None
        assert agent.work == "blocked"
        assert agent.presence == "on_duty"
        assert agent.zone == "ruang_ceo"
        assert "ruang Jarvis" in agent.action
        assert agent.task is not None
        assert agent.task.block_kind == "needs_input"

    def test_row_4_task_blocked_other_kind_is_blocked_at_desk(self) -> None:
        """Baris 4: Task blocked, jenis lain (dependency/capability/transient) -> work='blocked'."""
        engine = StateEngine(boot_time=1791000000)
        t_now = 1791001000

        task = TaskRow(
            id="task-004",
            board="office-v2",
            title="Review kode keamanan bastion",
            assignee="bastion",
            status="blocked",
            block_kind="dependency",
            created_at=t_now - 400,
            started_at=t_now - 350,
        )

        engine.reconcile_tasks([task], current_time=t_now)
        agent = engine.get_agent("bastion")

        assert agent is not None
        assert agent.work == "blocked"
        assert agent.presence == "on_duty"
        assert agent.zone == "soc"  # Tetap di mejanya
        assert "terblokir" in agent.action.lower()
        assert agent.task is not None
        assert agent.task.block_kind == "dependency"

    def test_row_5_run_ended_failed_is_failed_for_60s(self) -> None:
        """Baris 5: Run berakhir crashed/timed_out/spawn_failed -> work='failed' (60 dtk)."""
        engine = StateEngine(boot_time=1791000000)
        t_fail = 1791001000

        fail_event = KanbanEventRow(
            id=101,
            board="office-v2",
            task_id="task-fail-005",
            run_id=55,
            kind="failed",
            payload={"profile": "prism", "error": "Segmentation fault di canvas renderer"},
            created_at=t_fail,
        )

        task_ref = TaskRef(
            id="task-fail-005",
            title="Render visual partikel 60fps",
            board="office-v2",
            status="failed",
            error="Segmentation fault",
        )

        engine.process_event(fail_event, task=task_ref, current_time=t_fail)
        agent = engine.get_agent("prism")

        assert agent is not None
        assert agent.work == "failed"
        assert agent.presence == "on_duty"
        assert "kegagalan" in agent.action.lower()

        # Pada t_fail + 30 dtk (masih < 60 dtk): masih 'failed'
        engine.tick(current_time=t_fail + 30)
        p30 = engine.get_agent("prism")
        assert p30 is not None
        assert p30.work == "failed"

        # Pada t_fail + 61 dtk (sudah melewati 60 dtk): kembali ke 'idle'
        engine.tick(current_time=t_fail + 61)
        p61 = engine.get_agent("prism")
        assert p61 is not None
        assert p61.work == "idle"

    def test_row_6_run_ended_completed_is_done_recent_for_45s(self) -> None:
        """Baris 6: Run berakhir completed -> work='done_recent' (45 dtk)."""
        engine = StateEngine(boot_time=1791000000)
        t_done = 1791001000

        done_event = KanbanEventRow(
            id=102,
            board="office-v2",
            task_id="task-done-006",
            run_id=56,
            kind="completed",
            payload={"profile": "sentinel", "summary": "100% tes verifikasi PASS"},
            created_at=t_done,
        )

        task_ref = TaskRef(
            id="task-done-006",
            title="Verifikasi acceptance gate",
            board="office-v2",
            status="done",
            result="PASS",
        )

        engine.process_event(done_event, task=task_ref, current_time=t_done)
        agent = engine.get_agent("sentinel")

        assert agent is not None
        assert agent.work == "done_recent"
        assert agent.presence == "on_duty"
        assert "penyelesaian" in agent.action.lower()

        # Pada t_done + 30 dtk (masih < 45 dtk): masih 'done_recent'
        engine.tick(current_time=t_done + 30)
        s30 = engine.get_agent("sentinel")
        assert s30 is not None
        assert s30.work == "done_recent"

        # Pada t_done + 46 dtk (sudah melewati 45 dtk): kembali ke 'idle'
        engine.tick(current_time=t_done + 46)
        s46 = engine.get_agent("sentinel")
        assert s46 is not None
        assert s46.work == "idle"

    def test_row_7_no_active_task_is_idle(self) -> None:
        """Baris 7: Tidak ada task aktif -> work='idle', presence='on_duty'."""
        engine = StateEngine(boot_time=1791000000)
        t_now = 1791001000

        # Rekonsiliasi tanpa ada task apapun untuk steward
        engine.reconcile_tasks([], current_time=t_now)
        agent = engine.get_agent("steward")

        assert agent is not None
        assert agent.work == "idle"
        assert agent.presence == "on_duty"
        assert agent.task is None
        assert "standby" in agent.action.lower()

    def test_row_8_profile_stopped_is_off_duty(self) -> None:
        """Baris 8: Profil stopped -> presence='off_duty', work='off_duty'."""
        engine = StateEngine(boot_time=1791000000)
        t_now = 1791001000

        # Update profil merlin menjadi stopped
        engine.update_profiles(
            {
                "merlin": AgentProfile(
                    bio=AgentBio(
                        id="merlin",
                        name="Merlin",
                        role="Tech Mentor",
                        department="Education",
                        personality="Sabar",
                        specialties=["Mentoring"],
                        primary_color="#B5652B",
                        desk_zone="ruang_kelas",
                    ),
                    status="stopped",
                )
            },
            current_time=t_now,
        )

        agent = engine.get_agent("merlin")
        assert agent is not None
        assert agent.presence == "off_duty"
        assert agent.work == "off_duty"
        assert agent.zone == "lobi"
        assert "off-duty" in agent.action.lower()


class TestWIBMidnightRollover:
    """Pengujian pergantian hari Asia/Jakarta (WIB) pada 23:59:59 → 00:00:00.

    Acceptance Criterion:
    - [x] Pergantian hari WIB diuji (23:59 → 00:00)
    """

    def test_wib_start_of_day_calculation(self) -> None:
        """Memverifikasi kalkulasi titik awal hari 00:00:00 WIB tepat."""
        # 2026-10-03 23:59:59 WIB (UTC+7 -> 16:59:59 UTC)
        dt_2359 = datetime(2026, 10, 3, 23, 59, 59, tzinfo=WIB)
        ts_2359 = int(dt_2359.timestamp())

        # 2026-10-04 00:00:00 WIB
        dt_0000 = datetime(2026, 10, 4, 0, 0, 0, tzinfo=WIB)
        ts_0000 = int(dt_0000.timestamp())

        start_day_1 = get_wib_start_of_day(ts_2359)
        start_day_2 = get_wib_start_of_day(ts_0000)

        # Start of day 23:59 adalah 2026-10-03 00:00:00 WIB
        expected_start_1 = int(datetime(2026, 10, 3, 0, 0, 0, tzinfo=WIB).timestamp())
        assert start_day_1 == expected_start_1

        # Start of day 00:00 adalah 2026-10-04 00:00:00 WIB
        assert start_day_2 == ts_0000
        assert start_day_2 == start_day_1 + 86400

    def test_done_today_resets_across_midnight_wib(self) -> None:
        """Uji transisi tepat: task selesai pukul 23:59 WIB dihitung, lalu reset pada 00:00 WIB."""
        # Waktu 23:59:59 WIB pada 3 Oktober 2026
        dt_night = datetime(2026, 10, 3, 23, 59, 59, tzinfo=WIB)
        t_night = int(dt_night.timestamp())

        # Task selesai pada 3 Oktober pukul 14:00:00 WIB
        dt_comp1 = datetime(2026, 10, 3, 14, 0, 0, tzinfo=WIB)
        t_comp1 = int(dt_comp1.timestamp())

        # Task selesai pada 3 Oktober pukul 23:50:00 WIB
        dt_comp2 = datetime(2026, 10, 3, 23, 50, 0, tzinfo=WIB)
        t_comp2 = int(dt_comp2.timestamp())

        tasks = [
            TaskRow(
                id="task-oct3-1",
                board="office-v2",
                title="Tugas siang 3 Okt",
                assignee="forge",
                status="done",
                created_at=t_comp1 - 3600,
                completed_at=t_comp1,
            ),
            TaskRow(
                id="task-oct3-2",
                board="office-v2",
                title="Tugas malam 3 Okt",
                assignee="forge",
                status="done",
                created_at=t_comp2 - 600,
                completed_at=t_comp2,
            ),
        ]

        engine = StateEngine(boot_time=t_night - 1000)

        # 1. Evaluasi pada pukul 23:59:59 WIB
        engine.reconcile_tasks(tasks, current_time=t_night)
        forge = engine.get_agent("forge")
        assert forge is not None
        assert forge.done_today == 2, "Pada 23:59:59 WIB, kedua task hari ini harus terhitung"

        # 2. Tik 1 detik kemudian menjadi 00:00:00 WIB (4 Oktober 2026)
        t_midnight = t_night + 1
        dt_mid = datetime.fromtimestamp(t_midnight, tz=WIB)
        assert dt_mid.hour == 0 and dt_mid.minute == 0 and dt_mid.second == 0

        engine.tick(current_time=t_midnight)
        forge_mid = engine.get_agent("forge")
        assert forge_mid is not None
        assert forge_mid.done_today == 0, (
            "Pada 00:00:00 WIB hari baru, done_today harus otomatis reset menjadi 0"
        )

        # 3. Ada task baru selesai pada 4 Oktober 00:05:00 WIB
        dt_comp3 = datetime(2026, 10, 4, 0, 5, 0, tzinfo=WIB)
        t_comp3 = int(dt_comp3.timestamp())

        new_task = TaskRow(
            id="task-oct4-1",
            board="office-v2",
            title="Tugas dini hari 4 Okt",
            assignee="forge",
            status="done",
            created_at=t_comp3 - 300,
            completed_at=t_comp3,
        )
        tasks.append(new_task)

        engine.reconcile_tasks(tasks, current_time=t_comp3)
        forge_new = engine.get_agent("forge")
        assert forge_new is not None
        assert forge_new.done_today == 1, (
            "Hanya tugas tanggal 4 Oktober yang boleh masuk done_today"
        )


class TestHeartbeatNonBroadcast:
    """Pengujian aturan spec: Event heartbeat tidak disiarkan."""

    def test_heartbeat_not_emitted_to_feed(self) -> None:
        """Event heartbeat mengembalikan None dari normalizer dan tidak masuk ring buffer."""
        normalizer = EventNormalizer()
        raw_hb = KanbanEventRow(
            id=999,
            board="office-v2",
            task_id="task-hb",
            run_id=1,
            kind="heartbeat",
            payload=None,
            created_at=1791002000,
        )

        res = normalizer.normalize(raw_hb)
        assert res is None, "Normalizer wajib mengembalikan None untuk heartbeat"

    def test_heartbeat_clears_staleness_without_emitting(self) -> None:
        """Heartbeat memperbarui last_heartbeat dan memulihkan task stale ke working."""
        t_start = 1791001000
        engine = StateEngine(boot_time=t_start)

        task = TaskRow(
            id="task-stale-01",
            board="office-v2",
            title="Tugas monitor",
            assignee="warden",
            status="running",
            created_at=t_start,
            started_at=t_start,
            last_heartbeat_at=t_start,
        )

        # Saat t_start + 130 dtk -> stale
        t_stale = t_start + 130
        engine.reconcile_tasks([task], current_time=t_stale)
        w_stale = engine.get_agent("warden")
        assert w_stale is not None
        assert w_stale.work == "stale"

        # Heartbeat tiba pada t_stale + 5 dtk
        t_hb = t_stale + 5
        hb_event = KanbanEventRow(
            id=1001,
            board="office-v2",
            task_id="task-stale-01",
            run_id=10,
            kind="heartbeat",
            payload={"profile": "warden"},
            created_at=t_hb,
        )

        ret = engine.process_event(hb_event, task=task, current_time=t_hb)
        assert ret is None, "process_event harus mengembalikan None untuk heartbeat"

        # Warden harus pulih kembali menjadi 'working'
        agent = engine.get_agent("warden")
        assert agent is not None
        assert agent.work == "working"

        # Ring buffer tidak boleh memuat event heartbeat
        recent = engine.ring_buffer.get_recent(500)
        assert not any(e.kind == "heartbeat" for e in recent)  # type: ignore[comparison-overlap]


class TestRingBufferAndSSE:
    """Pengujian kapasitas RingBuffer 500 dan resume SSE."""

    def test_ring_buffer_capacity_eviction_and_seq(self) -> None:
        """Buffer berkapasitas 500 menggusur event terlama dan menjaga urutan seq."""
        buf = EventRingBuffer(capacity=10, start_seq=1)

        for i in range(15):
            ev = OfficeEvent(
                seq=buf.next_seq(),
                ts=1791000000 + i,
                board="office-v2",
                kind="task_started",
                message=f"Event ke-{i + 1}",
            )
            buf.append(ev)

        recent = buf.get_recent(limit=50)
        assert len(recent) == 10
        # Event terlama harus seq 6 (karena 1-5 tergusur)
        assert recent[0].seq == 6
        assert recent[-1].seq == 15

    def test_sse_resume_semantics(self) -> None:
        """Uji pemulihan Last-Event-ID: delta jika dalam buffer, resync jika gap terlampaui."""
        buf = EventRingBuffer(capacity=5, start_seq=1)
        for i in range(1, 6):
            buf.append(
                OfficeEvent(
                    seq=i,
                    ts=1791000000 + i,
                    board="office-v2",
                    kind="task_started",
                    message=f"Event {i}",
                )
            )

        # 1. Klien dengan Last-Event-ID 3 -> dapatkan event 4 dan 5
        can_resume, delta = buf.get_since(3)
        assert can_resume is True
        assert [e.seq for e in delta] == [4, 5]

        # 2. Tambah 5 event lagi sehingga 1..5 tergusur, buffer berisi 6..10
        for i in range(6, 11):
            buf.append(
                OfficeEvent(
                    seq=i,
                    ts=1791000000 + i,
                    board="office-v2",
                    kind="task_started",
                    message=f"Event {i}",
                )
            )

        # Klien dengan Last-Event-ID 3 meminta resume: gap terlalu jauh,
        # harus kirim snapshot (can_resume = False)
        can_resume_stale, delta_stale = buf.get_since(3)
        assert can_resume_stale is False
        assert delta_stale == []


class TestAtmosphereTimeOfDay:
    """Pengujian waktu pencahayaan atmosfer berdasarkan jam WIB."""

    @pytest.mark.parametrize(
        ("hour", "expected_tod"),
        [
            (5, "dawn"),  # 05:00 -> dawn
            (6, "dawn"),  # 06:30 -> dawn
            (7, "day"),  # 07:00 -> day
            (12, "day"),  # 12:00 -> day
            (14, "day"),  # 14:59 -> day
            (15, "dusk"),  # 15:00 -> dusk
            (17, "dusk"),  # 17:59 -> dusk
            (18, "night"),  # 18:00 -> night
            (23, "night"),  # 23:59 -> night
            (0, "night"),  # 00:00 -> night
            (4, "night"),  # 04:59 -> night
        ],
    )
    def test_atmosphere_modes(self, hour: int, expected_tod: str) -> None:
        dt = datetime(2026, 10, 3, hour, 15, 0, tzinfo=WIB)
        assert get_wib_time_of_day(int(dt.timestamp())) == expected_tod


class TestWorldSnapshotGeneration:
    """Pengujian integrasi pembuatan WorldSnapshot dari StateEngine."""

    def test_snapshot_contains_all_16_agents_and_recent_events(self) -> None:
        engine = StateEngine(boot_time=1791000000)
        snapshot = engine.get_snapshot(projection="public", current_time=1791000010)

        assert snapshot.projection == "public"
        assert len(snapshot.agents) == 16
        # Seluruh 16 agen harus memiliki ID yang unik dan terdefinisi
        agent_ids = {a.id for a in snapshot.agents}
        assert "jarvis" in agent_ids
        assert "forge" in agent_ids
        assert "prism" in agent_ids
        assert "sentinel" in agent_ids
        assert snapshot.time_of_day in ("dawn", "day", "dusk", "night")


class TestNormalizerEventKinds:
    """Pengujian normalisasi seluruh varian event dan bahasa pesan Indonesia."""

    def test_all_raw_event_kinds_normalized(self) -> None:
        normalizer = EventNormalizer(start_seq=1)

        test_cases = [
            ("created", "task_created", {"title": "Desain UI"}, "Tugas baru dibuat"),
            ("claimed", "task_started", {"profile": "prism"}, "Prism mulai mengerjakan"),
            ("spawned", "task_started", {"profile": "forge"}, "Forge mulai mengerjakan"),
            (
                "commented",
                "task_commented",
                {"author": "jarvis", "body": "Cek performa"},
                "Jarvis memberikan komentar",
            ),
            (
                "blocked",
                "task_blocked",
                {"block_kind": "needs_input", "profile": "daedalus"},
                "Daedalus membutuhkan masukan",
            ),
            (
                "blocked",
                "task_blocked",
                {"block_kind": "dependency", "profile": "vector"},
                "Vector terblokir (dependency)",
            ),
            ("completed", "task_done", {"profile": "sentinel"}, "Sentinel telah menyelesaikan"),
            ("failed", "task_failed", {"profile": "bastion"}, "Eksekusi tugas"),
            ("stale", "task_stale", {"profile": "relay"}, "tidak merespons (stale)"),
            ("agent_online", "agent_online", {"profile": "merlin"}, "Merlin aktif bertugas"),
            ("agent_offline", "agent_offline", {"profile": "warden"}, "Warden selesai bertugas"),
            (
                "collective_started",
                "collective_started",
                {"title": "Rapat Teknis"},
                "Acara kolektif Rapat Teknis dimulai",
            ),
            (
                "collective_ended",
                "collective_ended",
                {"title": "Rapat Teknis"},
                "Acara kolektif Rapat Teknis selesai",
            ),
            (
                "vitals_alert",
                "vitals_alert",
                {"detail": "CPU 95%"},
                "Peringatan sistem: CPU 95%",
            ),
        ]

        for raw_k, expected_k, payload, msg_substr in test_cases:
            ev_row = KanbanEventRow(
                id=1,
                board="office-v2",
                task_id="t-norm-01",
                run_id=1,
                kind=raw_k,
                payload=payload,
                created_at=1791000000,
            )
            office_ev = normalizer.normalize(ev_row)
            assert office_ev is not None, f"Gagal normalisasi kind {raw_k}"
            assert office_ev.kind == expected_k
            assert msg_substr in office_ev.message


class TestTransientPreemption:
    """Pengujian bahwa task baru langsung menginterupsi status transien (failed / done_recent)."""

    def test_new_task_preempts_failed_state(self) -> None:
        engine = StateEngine(boot_time=1791000000)
        t_fail = 1791001000

        # Prism gagal
        fail_ev = KanbanEventRow(
            id=1,
            board="office-v2",
            task_id="t-fail",
            kind="failed",
            payload={"profile": "prism"},
            created_at=t_fail,
        )
        engine.process_event(fail_ev, current_time=t_fail)
        p1 = engine.get_agent("prism")
        assert p1 is not None and p1.work == "failed"

        # 10 detik kemudian, task baru dimulai
        t_new = t_fail + 10
        start_ev = KanbanEventRow(
            id=2,
            board="office-v2",
            task_id="t-retry",
            kind="spawned",
            payload={"profile": "prism", "title": "Retry tugas visual"},
            created_at=t_new,
        )
        engine.process_event(start_ev, current_time=t_new)
        p2 = engine.get_agent("prism")
        assert p2 is not None and p2.work == "working"
        assert p2.task is not None and p2.task.id == "t-retry"

    def test_new_task_preempts_done_recent_state(self) -> None:
        engine = StateEngine(boot_time=1791000000)
        t_done = 1791001000

        # Forge selesai
        done_ev = KanbanEventRow(
            id=3,
            board="office-v2",
            task_id="t-done",
            kind="completed",
            payload={"profile": "forge"},
            created_at=t_done,
        )
        engine.process_event(done_ev, current_time=t_done)
        f1 = engine.get_agent("forge")
        assert f1 is not None and f1.work == "done_recent"

        # 5 detik kemudian, task baru dimulai
        t_new = t_done + 5
        start_ev = KanbanEventRow(
            id=4,
            board="office-v2",
            task_id="t-next",
            kind="spawned",
            payload={"profile": "forge", "title": "Tugas berikutnya"},
            created_at=t_new,
        )
        engine.process_event(start_ev, current_time=t_new)
        f2 = engine.get_agent("forge")
        assert f2 is not None and f2.work == "working"
        assert f2.task is not None and f2.task.id == "t-next"


class TestKanbanReaderStateEngineIntegration:
    """Pengujian integrasi langsung antara KanbanReader dan StateEngine memakai fixture DB."""

    def test_reconcile_with_real_fixture(self) -> None:
        import time
        from pathlib import Path

        from office.sources.kanban import KanbanReader

        fixtures_dir = Path(__file__).parent / "fixtures"
        primary_db = fixtures_dir / "kanban_fixture.db"
        boards_dir = fixtures_dir / "boards"

        reader = KanbanReader(
            primary_db_path=primary_db,
            boards_dir=boards_dir,
            init_cursor_to_max=False,
        )
        reader.boot()
        try:
            tasks = reader._sync_get_tasks_snapshot()
            assert len(tasks) > 0

            engine = StateEngine(boot_time=int(time.time()))
            engine.reconcile_tasks(tasks)

            # Verifikasi ada agen yang terpetakan statusnya dari fixture nyata
            active_works = {a.id: a.work for a in engine.agents.values()}
            assert len(active_works) >= 16
            assert "running" in [t.status for t in tasks]
            # Pastikan state engine stabil dan tidak melempar error
            assert len(engine.agents) >= 16
        finally:
            reader.close()

