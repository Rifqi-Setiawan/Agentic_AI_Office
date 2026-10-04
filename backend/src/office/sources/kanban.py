from __future__ import annotations

import asyncio
import json
import logging
import sqlite3
import time
from pathlib import Path
from typing import Any

from office.models.health import ReaderHealth
from office.models.kanban import KanbanEventRow, TaskRow

logger = logging.getLogger(__name__)

# Required columns based on authentic Hermes Kanban schema (ADR-002)
REQUIRED_TASK_COLUMNS = {
    "id",
    "title",
    "body",
    "assignee",
    "status",
    "priority",
    "created_at",
    "started_at",
    "completed_at",
    "tenant",
    "result",
    "consecutive_failures",
    "last_failure_error",
    "last_heartbeat_at",
    "current_run_id",
    "block_kind",
}

REQUIRED_EVENT_COLUMNS = {
    "id",
    "task_id",
    "run_id",
    "kind",
    "payload",
    "created_at",
}


class KanbanReader:
    """Reader sumber multi-board Kanban SQLite secara read-only.

    Mematuhi ADR-002:
    - file:<path>?mode=ro + PRAGMA query_only = ON + PRAGMA busy_timeout = 2000
    - async via asyncio.to_thread
    - cursor per board di memori; saat start cursor = MAX(id)
    - cek skema saat boot dan masuk mode degradasi jika kolom wajib hilang
    - penemuan board baru dinamis <= 30 detik
    """

    def __init__(
        self,
        primary_db_path: Path | str | None = "/srv/apps/hermes/kanban.db",
        boards_dir: Path | str | None = "/srv/apps/hermes/kanban/boards",
        discovery_interval_seconds: float = 30.0,
        reconciliation_interval_seconds: float = 10.0,
        event_limit_per_poll: int = 500,
        init_cursor_to_max: bool = True,
    ) -> None:
        self.primary_db_path = Path(primary_db_path) if primary_db_path else None
        self.boards_dir = Path(boards_dir) if boards_dir else None
        self.discovery_interval_seconds = discovery_interval_seconds
        self.reconciliation_interval_seconds = reconciliation_interval_seconds
        self.event_limit_per_poll = event_limit_per_poll
        self.init_cursor_to_max = init_cursor_to_max

        # In-memory cursors per board: board_name -> max_event_id
        self._cursors: dict[str, int] = {}
        # Registered board database paths: board_name -> Path
        self._board_paths: dict[str, Path] = {}
        # Persistent open read-only connections: board_name -> sqlite3.Connection
        self._connections: dict[str, sqlite3.Connection] = {}

        self._last_discovery_time: float = 0.0
        self._last_poll_time: float = 0.0
        self._last_reconciliation_time: float = 0.0

        # Degradation state
        self._is_degraded: bool = False
        self._degraded_reasons: list[str] = []
        self._health = ReaderHealth(status="ok", last_poll=0)

    @property
    def cursors(self) -> dict[str, int]:
        return dict(self._cursors)

    @property
    def board_paths(self) -> dict[str, Path]:
        return dict(self._board_paths)

    @property
    def is_degraded(self) -> bool:
        return self._is_degraded

    @property
    def health(self) -> ReaderHealth:
        return self._health

    def _open_connection(self, path: Path) -> sqlite3.Connection:
        """Membuka koneksi SQLite read-only aman sesuai ADR-002."""
        resolved = path.resolve()
        conn = sqlite3.connect(
            f"{resolved.as_uri()}?mode=ro",
            uri=True,
            check_same_thread=False,
            timeout=2.0,
        )
        conn.row_factory = sqlite3.Row
        cur = conn.cursor()
        cur.execute("PRAGMA query_only = ON;")
        cur.execute("PRAGMA busy_timeout = 2000;")
        return conn

    def _get_connection(self, board_name: str) -> sqlite3.Connection:
        """Mengambil atau menginisialisasi koneksi persistent per board."""
        if board_name in self._connections:
            return self._connections[board_name]

        db_path = self._board_paths.get(board_name)
        if not db_path or not db_path.is_file():
            raise FileNotFoundError(f"Database for board '{board_name}' not found: {db_path}")

        conn = self._open_connection(db_path)
        self._connections[board_name] = conn
        return conn

    def _check_schema_for_db(self, conn: sqlite3.Connection, board_name: str) -> list[str]:
        """Validasi kolom wajib pada tabel tasks dan task_events."""
        issues: list[str] = []
        cur = conn.cursor()

        # Check existing tables
        tables = {
            row[0]
            for row in cur.execute(
                "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%';"
            )
        }

        if "tasks" not in tables:
            issues.append(f"Board '{board_name}': tabel 'tasks' tidak ditemukan")
        else:
            task_cols = {row[1] for row in cur.execute("PRAGMA table_info(tasks);")}
            missing_task = REQUIRED_TASK_COLUMNS - task_cols
            if missing_task:
                issues.append(
                    f"Board '{board_name}': kolom wajib hilang pada 'tasks': {sorted(missing_task)}"
                )

        if "task_events" not in tables:
            issues.append(f"Board '{board_name}': tabel 'task_events' tidak ditemukan")
        else:
            event_cols = {row[1] for row in cur.execute("PRAGMA table_info(task_events);")}
            missing_event = REQUIRED_EVENT_COLUMNS - event_cols
            if missing_event:
                issues.append(
                    f"Board '{board_name}': kolom wajib hilang pada 'task_events': "
                    f"{sorted(missing_event)}"
                )

        return issues

    def discover_boards(self, force: bool = False) -> list[str]:
        """Pindai primary_db dan subdirektori boards/ untuk menemukan board baru."""
        now = time.monotonic()
        if not force and (now - self._last_discovery_time < self.discovery_interval_seconds):
            return list(self._board_paths.keys())

        newly_found: list[str] = []

        # 1. Primary db
        if self.primary_db_path and self.primary_db_path.is_file():
            board_name = "primary"
            if board_name not in self._board_paths:
                self._board_paths[board_name] = self.primary_db_path
                newly_found.append(board_name)

        # 2. Multi-board directory: boards/*/kanban.db
        if self.boards_dir and self.boards_dir.is_dir():
            for sub in sorted(self.boards_dir.iterdir()):
                if sub.is_dir():
                    db_candidate = sub / "kanban.db"
                    if db_candidate.is_file():
                        board_name = sub.name
                        if board_name not in self._board_paths:
                            self._board_paths[board_name] = db_candidate
                            newly_found.append(board_name)

        # Initialize cursor for any newly discovered boards
        for board_name in newly_found:
            self._init_board_cursor(board_name)

        self._last_discovery_time = now
        return list(self._board_paths.keys())

    def _init_board_cursor(self, board_name: str) -> None:
        """Inisialisasi cursor untuk board baru ke MAX(id) agar tidak memutar ulang riwayat."""
        if board_name in self._cursors:
            return

        if not self.init_cursor_to_max:
            self._cursors[board_name] = 0
            return

        try:
            conn = self._get_connection(board_name)
            cur = conn.cursor()
            cur.execute("SELECT COALESCE(MAX(id), 0) FROM task_events;")
            row = cur.fetchone()
            max_id = int(row[0]) if row and row[0] is not None else 0
            self._cursors[board_name] = max_id
            logger.info("Initialized cursor for board '%s' at MAX(id)=%d", board_name, max_id)
        except Exception as exc:
            logger.warning("Failed to initialize cursor for board '%s': %s", board_name, exc)
            self._cursors[board_name] = 0

    def boot(self) -> None:
        """Booting reader: temukan board, cek integritas skema, dan set cursor awal."""
        self.discover_boards(force=True)
        self._degraded_reasons.clear()

        if not self._board_paths:
            self._is_degraded = True
            self._degraded_reasons.append("Tidak ada database Kanban yang ditemukan")
            self._health = ReaderHealth(
                status="degraded",
                last_poll=int(time.time()),
                error="; ".join(self._degraded_reasons),
                details={"boards": []},
            )
            return

        for board_name, db_path in list(self._board_paths.items()):
            try:
                conn = self._get_connection(board_name)
                issues = self._check_schema_for_db(conn, board_name)
                if issues:
                    self._degraded_reasons.extend(issues)
            except Exception as exc:
                self._degraded_reasons.append(
                    f"Board '{board_name}' ({db_path}) gagal diakses: {exc}"
                )

        if self._degraded_reasons:
            self._is_degraded = True
            logger.warning("KanbanReader entering degraded mode: %s", self._degraded_reasons)
            self._health = ReaderHealth(
                status="degraded",
                last_poll=int(time.time()),
                error="; ".join(self._degraded_reasons),
                details={"boards": list(self._board_paths.keys()), "cursors": self._cursors},
            )
        else:
            self._is_degraded = False
            self._health = ReaderHealth(
                status="ok",
                last_poll=int(time.time()),
                error=None,
                details={"boards": list(self._board_paths.keys()), "cursors": self._cursors},
            )

    async def boot_async(self) -> None:
        """Asynchronous boot wrapper."""
        await asyncio.to_thread(self.boot)

    def _sync_poll_events(self) -> list[KanbanEventRow]:
        """Pembacaan event inkremental synchronous dari semua board."""
        # Check board discovery periodically
        self.discover_boards(force=False)

        self._degraded_reasons = []
        if not self._board_paths:
            self._degraded_reasons.append("Tidak ada database Kanban yang ditemukan")
        all_events: list[KanbanEventRow] = []

        for board_name in list(self._board_paths.keys()):
            current_cursor = self._cursors.get(board_name, 0)
            try:
                conn = self._get_connection(board_name)
                issues = self._check_schema_for_db(conn, board_name)
                if issues:
                    self._degraded_reasons.extend(issues)
                    continue
                run_cols = {r[1] for r in conn.execute("PRAGMA table_info(task_runs)")}
                has_runs = {"id", "profile"} <= run_cols
                cur = conn.cursor()
                cur.execute(
                    """
                    SELECT id, task_id, run_id, kind, payload, created_at
                    FROM task_events
                    WHERE id > ?
                    ORDER BY id ASC
                    LIMIT ?;
                    """,
                    (current_cursor, self.event_limit_per_poll),
                )
                rows = cur.fetchall()
                highest_id = current_cursor

                for row in rows:
                    event_id = int(row["id"])
                    if event_id > highest_id:
                        highest_id = event_id

                    payload_raw = row["payload"]
                    payload: dict[str, Any] | str | None = None
                    if payload_raw:
                        try:
                            payload = json.loads(payload_raw)
                        except (json.JSONDecodeError, TypeError):
                            payload = payload_raw

                    # Run profile is authoritative, even when payload names another assignee.
                    if has_runs and row["run_id"] is not None:
                        run = conn.execute(
                            "SELECT profile FROM task_runs WHERE id = ?", (row["run_id"],)
                        ).fetchone()
                        if run and run[0]:
                            payload = dict(payload) if isinstance(payload, dict) else {}
                            payload["profile"] = run[0]
                    all_events.append(
                        KanbanEventRow(
                            id=event_id,
                            board=board_name,
                            task_id=str(row["task_id"]),
                            run_id=int(row["run_id"]) if row["run_id"] is not None else None,
                            kind=str(row["kind"]),
                            payload=payload,
                            created_at=int(row["created_at"]),
                        )
                    )

                self._cursors[board_name] = highest_id
            except Exception as exc:
                logger.error("Error polling events from board '%s': %s", board_name, exc)
                self._degraded_reasons.append(f"Poll error board '{board_name}': {exc}")

        # Sort all events chronologically (created_at, then id)
        all_events.sort(key=lambda ev: (ev.created_at, ev.id))

        self._is_degraded = bool(self._degraded_reasons)
        status: Any = "degraded" if self._is_degraded else "ok"
        err_msg = "; ".join(self._degraded_reasons) if self._degraded_reasons else None
        self._health = ReaderHealth(
            status=status,
            last_poll=int(time.time()),
            error=err_msg,
            details={"boards": list(self._board_paths.keys()), "cursors": dict(self._cursors)},
        )
        return all_events

    async def poll_events(self) -> list[KanbanEventRow]:
        """Ambil event baru dari seluruh board secara asynchronous."""
        return await asyncio.to_thread(self._sync_poll_events)

    def _sync_get_tasks_snapshot(self) -> list[TaskRow]:
        """Ambil snapshot seluruh task dari semua board untuk rekonsiliasi state."""
        self.discover_boards(force=False)
        tasks: list[TaskRow] = []
        issues_all: list[str] = []
        if not self._board_paths:
            issues_all.append("Tidak ada database Kanban yang ditemukan")

        for board_name in list(self._board_paths.keys()):
            try:
                conn = self._get_connection(board_name)
                issues = self._check_schema_for_db(conn, board_name)
                if issues:
                    issues_all.extend(issues)
                    continue
                columns = {r[1] for r in conn.execute("PRAGMA table_info(tasks)")}
                optional = ", ".join(
                    f't."{name}"' if name in columns else f'NULL AS "{name}"'
                    for name in ("workspace_path", "branch_name", "worker_pid")
                )
                run_cols = {r[1] for r in conn.execute("PRAGMA table_info(task_runs)")}
                has_runs = {"id", "profile"} <= run_cols
                assignee = (
                    "COALESCE(NULLIF(r.profile, ''), t.assignee)" if has_runs else "t.assignee"
                )
                join = "LEFT JOIN task_runs r ON r.id = t.current_run_id" if has_runs else ""
                cur = conn.execute(
                    f"""SELECT t.id, t.title, t.body, {assignee} AS assignee,
                        t.status, t.priority, t.created_at, t.started_at, t.completed_at,
                        t.block_kind, t.last_heartbeat_at, t.current_run_id,
                        {optional}, t.result, t.last_failure_error FROM tasks t {join};"""
                )
                for row in cur.fetchall():
                    tasks.append(
                        TaskRow(
                            id=str(row["id"]),
                            board=board_name,
                            title=str(row["title"]),
                            body=row["body"],
                            assignee=row["assignee"],
                            status=str(row["status"]),
                            priority=int(row["priority"] or 0),
                            created_at=int(row["created_at"]),
                            started_at=int(row["started_at"]) if row["started_at"] else None,
                            completed_at=int(row["completed_at"]) if row["completed_at"] else None,
                            block_kind=row["block_kind"],
                            last_heartbeat_at=(
                                int(row["last_heartbeat_at"]) if row["last_heartbeat_at"] else None
                            ),
                            current_run_id=(
                                int(row["current_run_id"]) if row["current_run_id"] else None
                            ),
                            workspace_path=row["workspace_path"],
                            branch_name=row["branch_name"],
                            worker_pid=int(row["worker_pid"]) if row["worker_pid"] else None,
                            result=row["result"],
                            last_failure_error=row["last_failure_error"],
                        )
                    )
            except Exception as exc:
                logger.error("Error fetching tasks snapshot for board '%s': %s", board_name, exc)
                issues_all.append(f"Snapshot error board '{board_name}': {exc}")

        self._degraded_reasons = issues_all
        self._is_degraded = bool(issues_all)
        self._health = ReaderHealth(
            status="degraded" if issues_all else "ok",
            last_poll=int(time.time()),
            error="; ".join(issues_all) if issues_all else None,
        )
        return tasks

    async def get_tasks_snapshot(self) -> list[TaskRow]:
        """Asynchronous snapshot wrapper."""
        return await asyncio.to_thread(self._sync_get_tasks_snapshot)

    def close(self) -> None:
        """Tutup seluruh koneksi SQLite read-only."""
        for board_name, conn in list(self._connections.items()):
            try:
                conn.close()
            except Exception as exc:
                logger.debug("Closing connection for '%s': %s", board_name, exc)
        self._connections.clear()
