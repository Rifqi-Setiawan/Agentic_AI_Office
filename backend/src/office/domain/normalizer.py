from __future__ import annotations

import json
import logging
from typing import Any

from office.models.events import OfficeEvent, OfficeEventKind
from office.models.kanban import KanbanEventRow, TaskRef, TaskRow
from office.sources.profiles import STATIC_AGENT_METADATA

logger = logging.getLogger(__name__)

# Pemetaan jenis event mentah ke OfficeEventKind resmi
RAW_KIND_MAP: dict[str, OfficeEventKind] = {
    "created": "task_created",
    "task_created": "task_created",
    "claimed": "task_started",
    "spawned": "task_started",
    "started": "task_started",
    "task_started": "task_started",
    "commented": "task_commented",
    "task_commented": "task_commented",
    "blocked": "task_blocked",
    "task_blocked": "task_blocked",
    "completed": "task_done",
    "done": "task_done",
    "task_done": "task_done",
    "failed": "task_failed",
    "crashed": "task_failed",
    "timed_out": "task_failed",
    "spawn_failed": "task_failed",
    "task_failed": "task_failed",
    "stale": "task_stale",
    "task_stale": "task_stale",
    "agent_online": "agent_online",
    "agent_offline": "agent_offline",
    "collective_started": "collective_started",
    "collective_ended": "collective_ended",
    "vitals_alert": "vitals_alert",
}


def get_agent_display_name(agent_id: str | None) -> str:
    """Mengembalikan nama tampilan agen atau label default."""
    if not agent_id:
        return "Agen"
    aid = agent_id.lower().strip()
    if aid in STATIC_AGENT_METADATA:
        return str(STATIC_AGENT_METADATA[aid].get("name", aid.capitalize()))
    return aid.capitalize()


class EventNormalizer:
    """Normalizer untuk mengubah baris peristiwa mentah menjadi OfficeEvent.

    Aturan:
    - Event 'heartbeat' tidak disiarkan (mengembalikan None).
    - Menghasilkan nomor urut sequence (seq) monotonik.
    - Format pesan dalam Bahasa Indonesia ramah pengguna.
    - Menurunkan agent & actor sesuai metadata dan konteks task.
    """

    def __init__(self, start_seq: int = 1) -> None:
        self._seq = start_seq

    @property
    def current_seq(self) -> int:
        return self._seq

    def next_seq(self) -> int:
        """Mengambil nomor sequence berikutnya dan menaikkan counter secara monoton."""
        val = self._seq
        self._seq += 1
        return val

    def set_seq(self, seq: int) -> None:
        """Menyetel nilai sequence dasar (misal saat restart/resync)."""
        self._seq = seq

    def build_task_ref(
        self,
        task: TaskRow | TaskRef | dict[str, Any] | None,
        board: str | None = None,
        task_id: str | None = None,
    ) -> TaskRef | None:
        """Membangun objek TaskRef dari TaskRow, dict, atau instance yang ada."""
        if task is None:
            if task_id and board:
                return TaskRef(
                    id=task_id,
                    title=f"Tugas {task_id}",
                    board=board,
                    status="running",
                )
            return None

        if isinstance(task, TaskRef):
            return task

        if isinstance(task, TaskRow):
            return TaskRef(
                id=task.id,
                title=task.title,
                board=task.board,
                status=task.status,
                block_kind=task.block_kind,
                started_at=task.started_at,
                body=task.body,
                summary=task.result if task.status == "done" else None,
                result=task.result,
                error=task.last_failure_error,
                workspace_path=task.workspace_path,
                branch_name=task.branch_name,
                worker_pid=task.worker_pid,
            )

        if isinstance(task, dict):
            return TaskRef(
                id=str(task.get("id") or task_id or "unknown"),
                title=str(task.get("title") or f"Tugas {task_id}"),
                board=str(task.get("board") or board or "global"),
                status=str(task.get("status") or "running"),
                block_kind=task.get("block_kind"),
                started_at=task.get("started_at"),
                body=task.get("body"),
                summary=task.get("summary") or task.get("result"),
                result=task.get("result"),
                error=task.get("error") or task.get("last_failure_error"),
                workspace_path=task.get("workspace_path"),
                branch_name=task.get("branch_name"),
                worker_pid=task.get("worker_pid"),
            )

        return None

    def _compose_message(
        self,
        kind: OfficeEventKind,
        agent_name: str,
        actor_name: str | None,
        task_title: str,
        payload_dict: dict[str, Any],
    ) -> str:
        """Menyusun pesan linimasa ramah pengguna dalam Bahasa Indonesia."""
        match kind:
            case "task_created":
                return f"Tugas baru dibuat: {task_title}"
            case "task_started":
                return f"{agent_name} mulai mengerjakan tugas: {task_title}"
            case "task_commented":
                actor_label = actor_name or "Seseorang"
                return f"{actor_label} memberikan komentar pada tugas: {task_title}"
            case "task_blocked":
                block_kind = payload_dict.get("block_kind") or payload_dict.get("kind")
                if block_kind == "needs_input":
                    return f"{agent_name} membutuhkan masukan untuk tugas: {task_title}"
                reason = payload_dict.get("reason")
                if reason:
                    return f"{agent_name} terblokir pada tugas: {task_title} ({reason})"
                kind_str = block_kind or "ketergantungan"
                return f"{agent_name} terblokir ({kind_str}) pada tugas: {task_title}"
            case "task_done":
                return f"{agent_name} telah menyelesaikan tugas: {task_title}"
            case "task_failed":
                err = payload_dict.get("error") or payload_dict.get("last_failure_error")
                if err:
                    return f"Eksekusi tugas {task_title} oleh {agent_name} gagal: {err}"
                return f"Eksekusi tugas {task_title} oleh {agent_name} gagal"
            case "task_stale":
                return f"Tugas {task_title} ({agent_name}) tidak merespons (stale)"
            case "agent_online":
                return f"{agent_name} aktif bertugas di kantor (on-duty)"
            case "agent_offline":
                return f"{agent_name} selesai bertugas (off-duty)"
            case "collective_started":
                title = payload_dict.get("title") or payload_dict.get("kind", "kegiatan bersama")
                return f"Acara kolektif {title} dimulai"
            case "collective_ended":
                title = payload_dict.get("title") or payload_dict.get("kind", "kegiatan bersama")
                return f"Acara kolektif {title} selesai"
            case "vitals_alert":
                detail = payload_dict.get("detail") or "Beban sumber daya server meningkat"
                return f"Peringatan sistem: {detail}"
            case _:
                return f"Aktivitas pada tugas {task_title}"

    def normalize(
        self,
        event_row: KanbanEventRow | dict[str, Any],
        task: TaskRow | TaskRef | dict[str, Any] | None = None,
        seq: int | None = None,
    ) -> OfficeEvent | None:
        """Mengubah row mentah event menjadi OfficeEvent.

        Mengembalikan None jika event adalah heartbeat atau jenis event tidak didukung.
        """
        # Ekstraksi atribut dasar
        if isinstance(event_row, KanbanEventRow):
            raw_kind = event_row.kind
            board = event_row.board
            task_id = event_row.task_id
            created_at = event_row.created_at
            raw_payload = event_row.payload
        else:
            raw_kind = str(event_row.get("kind", ""))
            board = str(event_row.get("board", "global"))
            task_id = str(event_row.get("task_id", ""))
            created_at = int(event_row.get("created_at", 0))
            raw_payload = event_row.get("payload")

        # ATURAN: Event heartbeat tidak disiarkan
        if raw_kind == "heartbeat":
            return None

        office_kind = RAW_KIND_MAP.get(raw_kind)
        if not office_kind:
            logger.debug("Event mentah diabaikan (kind '%s' tidak terpetakan)", raw_kind)
            return None

        # Parse payload
        payload_dict: dict[str, Any] = {}
        if isinstance(raw_payload, dict):
            payload_dict = raw_payload
        elif isinstance(raw_payload, str):
            try:
                parsed = json.loads(raw_payload)
                if isinstance(parsed, dict):
                    payload_dict = parsed
            except (json.JSONDecodeError, TypeError):
                payload_dict = {"raw": raw_payload}

        # Ekstraksi agent dan actor
        # Sesuai spec: Agent diambil dari task_runs.profile; kalau kosong, dari tasks.assignee
        agent: str | None = (
            payload_dict.get("profile")
            or payload_dict.get("assignee")
            or (getattr(task, "assignee", None) if task else None)
        )
        if isinstance(task, dict) and not agent:
            agent = task.get("assignee")

        actor: str | None = (
            payload_dict.get("actor")
            or payload_dict.get("author")
            or payload_dict.get("created_by")
            or payload_dict.get("user")
        )

        task_ref = self.build_task_ref(task, board=board, task_id=task_id)
        task_title = (
            task_ref.title if task_ref else (payload_dict.get("title") or f"Tugas {task_id}")
        )

        agent_display = get_agent_display_name(agent)
        actor_display = get_agent_display_name(actor) if actor else None

        message = self._compose_message(
            kind=office_kind,
            agent_name=agent_display,
            actor_name=actor_display,
            task_title=task_title,
            payload_dict=payload_dict,
        )

        assigned_seq = self.next_seq() if seq is None else seq

        return OfficeEvent(
            seq=assigned_seq,
            ts=created_at,
            board=board,
            kind=office_kind,
            agent=agent,
            actor=actor,
            message=message,
            task=task_ref,
        )
