from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field

from office.models.events import OfficeEvent
from office.models.host import HostVitals
from office.models.kanban import TaskRef


class AgentState(BaseModel):
    """Kondisi operasional dan visual seorang agen di kantor virtual."""

    id: str
    name: str
    role: str
    presence: Literal["on_duty", "off_duty"] = "on_duty"
    work: Literal["idle", "working", "blocked", "stale", "failed", "done_recent", "off_duty"] = (
        "idle"
    )
    since: int
    done_today: int = 0
    zone: str
    action: str
    grid_x: int | None = None
    grid_y: int | None = None
    direction: Literal["SE", "NE", "SW", "NW"] | None = "SE"
    task: TaskRef | None = None


class CollectiveEventState(BaseModel):
    """Kondisi event interaksi kolektif yang melibatkan banyak agen."""

    id: str
    kind: Literal["rapat", "break", "sholat"]
    title: str
    started_at: int
    expires_at: int
    participants: list[str] = Field(default_factory=list)
    active: bool = True


class WorldSnapshot(BaseModel):
    """Snapshot menyeluruh kondisi dunia kantor pada suatu waktu."""

    generated_at: int
    seq: int
    projection: Literal["public", "founder"] = "public"
    time_of_day: Literal["dawn", "day", "dusk", "night"] = "day"
    agents: list[AgentState] = Field(default_factory=list)
    recent_events: list[OfficeEvent] = Field(default_factory=list)
    active_collective: CollectiveEventState | None = None
    vitals: HostVitals
