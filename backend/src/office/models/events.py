from __future__ import annotations

from typing import Literal

from pydantic import BaseModel

from office.models.kanban import TaskRef

OfficeEventKind = Literal[
    "task_created",
    "task_started",
    "task_commented",
    "task_blocked",
    "task_done",
    "task_failed",
    "task_stale",
    "agent_online",
    "agent_offline",
    "collective_started",
    "collective_ended",
    "vitals_alert",
]


class OfficeEvent(BaseModel):
    """Representasi peristiwa atau aktivitas di kantor virtual untuk umpan linimasa (feed)."""

    seq: int
    ts: int
    board: str
    kind: OfficeEventKind
    agent: str | None = None
    actor: str | None = None
    message: str
    task: TaskRef | None = None
