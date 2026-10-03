from __future__ import annotations

from typing import Any

from pydantic import BaseModel, Field


class KanbanEventRow(BaseModel):
    """Baris peristiwa dari tabel task_events SQLite."""

    id: int
    board: str
    task_id: str
    run_id: int | None = None
    kind: str
    payload: dict[str, Any] | str | None = None
    created_at: int


class TaskRow(BaseModel):
    """Baris tugas dari tabel tasks SQLite untuk rekonsiliasi state."""

    id: str
    board: str
    title: str
    body: str | None = None
    assignee: str | None = None
    status: str
    priority: int = 0
    created_at: int
    started_at: int | None = None
    completed_at: int | None = None
    block_kind: str | None = None
    last_heartbeat_at: int | None = None
    current_run_id: int | None = None
    workspace_path: str | None = None
    branch_name: str | None = None
    worker_pid: int | None = None
    result: str | None = None
    last_failure_error: str | None = None
    extra: dict[str, Any] = Field(default_factory=dict)
