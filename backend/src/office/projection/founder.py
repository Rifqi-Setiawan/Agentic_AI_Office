from __future__ import annotations

import logging
from typing import Any, Literal

from pydantic import BaseModel, Field

from office.models.events import OfficeEvent, OfficeEventKind
from office.models.host import HostVitals, HostVitalsDetails
from office.models.kanban import TaskRef, TaskRow
from office.models.profiles import AgentBio, AgentProfileDetail
from office.models.state import AgentState, CollectiveEventState, WorldSnapshot
from office.sources.profiles import STATIC_AGENT_METADATA

logger = logging.getLogger(__name__)

TEXT_FIELD_MAX_LENGTH = 500


def truncate_text(text: str | None, max_len: int = TEXT_FIELD_MAX_LENGTH) -> str | None:
    """Memotong teks panjang maksimal 500 karakter untuk menghemat bandwidth telemetri Founder."""
    if text is None:
        return None
    s = str(text)
    if len(s) <= max_len:
        return s
    return s[:max_len]


# ==============================================================================
# Model-Model Proyeksi Founder (Full Telemetry & Inspection)
# ==============================================================================


class FounderTaskRef(TaskRef):
    """Proyeksi Founder referensi tugas Kanban.

    Menampilkan seluruh atribut operasional nyata:
    - Judul asli dan nama board asli
    - Teks body, summary, result, error (dipotong maks 500 karakter)
    - Metadata teknis: workspace_path, branch_name, worker_pid
    """


class FounderHostVitals(HostVitals):
    """Proyeksi Founder telemetri host lengkap dengan perincian hardware dan kernel."""


class FounderAgentState(AgentState):
    """Proyeksi Founder status agen dengan task FounderTaskRef."""

    task: FounderTaskRef | None = None


class FounderOfficeEvent(OfficeEvent):
    """Proyeksi Founder linimasa peristiwa kantor dengan task FounderTaskRef."""

    task: FounderTaskRef | None = None


class FounderWorldSnapshot(BaseModel):
    """Proyeksi Founder snapshot dunia kantor."""

    generated_at: int
    seq: int
    projection: Literal["founder"] = "founder"
    time_of_day: Literal["dawn", "day", "dusk", "night"] = "day"
    agents: list[FounderAgentState] = Field(default_factory=list)
    recent_events: list[FounderOfficeEvent] = Field(default_factory=list)
    active_collective: CollectiveEventState | None = None
    vitals: FounderHostVitals


class FounderAgentProfileDetail(BaseModel):
    """Proyeksi Founder rincian profil agen dan riwayat tugas lengkap."""

    agent: FounderAgentState
    bio: AgentBio
    recent_tasks: list[FounderTaskRef] = Field(default_factory=list)


# ==============================================================================
# Fungsi Transformasi Proyeksi Founder
# ==============================================================================


def project_task_ref_founder(
    task: TaskRef | TaskRow | dict[str, Any] | None,
) -> FounderTaskRef | None:
    """Memproyeksikan TaskRef/TaskRow/dict menjadi FounderTaskRef."""
    if task is None:
        return None

    if isinstance(task, dict):
        raw_id = str(task.get("id") or "unknown")
        title = str(task.get("title") or f"Tugas {raw_id}")
        board = str(task.get("board") or "global")
        status = str(task.get("status") or "running")
        block_kind = task.get("block_kind")
        started_at = task.get("started_at")
        body = task.get("body")
        summary = task.get("summary") or (task.get("result") if status == "done" else None)
        result = task.get("result")
        error = task.get("error") or task.get("last_failure_error")
        workspace_path = task.get("workspace_path")
        branch_name = task.get("branch_name")
        worker_pid = task.get("worker_pid")
    elif isinstance(task, TaskRow):
        raw_id = task.id
        title = task.title
        board = task.board
        status = task.status
        block_kind = task.block_kind
        started_at = task.started_at
        body = task.body
        summary = task.result if task.status == "done" else None
        result = task.result
        error = task.last_failure_error
        workspace_path = task.workspace_path
        branch_name = task.branch_name
        worker_pid = task.worker_pid
    else:
        raw_id = task.id
        title = task.title
        board = task.board
        status = task.status
        block_kind = task.block_kind
        started_at = task.started_at
        body = task.body
        summary = task.summary
        result = task.result
        error = task.error
        workspace_path = task.workspace_path
        branch_name = task.branch_name
        worker_pid = task.worker_pid

    pid_val = int(worker_pid) if worker_pid is not None else None

    return FounderTaskRef(
        id=raw_id,
        title=title,
        board=board,
        status=status,
        block_kind=block_kind,
        started_at=started_at,
        body=truncate_text(body, TEXT_FIELD_MAX_LENGTH),
        summary=truncate_text(summary, TEXT_FIELD_MAX_LENGTH),
        result=truncate_text(result, TEXT_FIELD_MAX_LENGTH),
        error=truncate_text(error, TEXT_FIELD_MAX_LENGTH),
        workspace_path=str(workspace_path) if workspace_path is not None else None,
        branch_name=str(branch_name) if branch_name is not None else None,
        worker_pid=pid_val,
    )


def project_agent_state_founder(
    agent: AgentState | dict[str, Any],
) -> FounderAgentState:
    """Memproyeksikan AgentState menjadi FounderAgentState."""
    if isinstance(agent, dict):
        aid = str(agent.get("id") or "agent").lower().strip()
        meta = STATIC_AGENT_METADATA.get(aid, {})
        name = str(agent.get("name") or meta.get("name") or aid.capitalize())
        role = str(agent.get("role") or meta.get("role") or "Specialist")
        presence = agent.get("presence", "on_duty")
        work = agent.get("work", "idle")
        since = int(agent.get("since") or 0)
        done_today = int(agent.get("done_today") or 0)
        zone = str(agent.get("zone") or meta.get("desk_zone") or "dev_pod_1")
        action = str(agent.get("action") or "Standby di meja kerja")
        grid_x = agent.get("grid_x")
        grid_y = agent.get("grid_y")
        direction = agent.get("direction", "SE")
        raw_task = agent.get("task")
    else:
        aid = agent.id.lower().strip()
        name = agent.name
        role = agent.role
        presence = agent.presence
        work = agent.work
        since = agent.since
        done_today = agent.done_today
        zone = agent.zone
        action = agent.action
        grid_x = agent.grid_x
        grid_y = agent.grid_y
        direction = agent.direction
        raw_task = agent.task

    projected_task = project_task_ref_founder(raw_task) if raw_task else None

    return FounderAgentState(
        id=aid,
        name=name,
        role=role,
        presence=presence,
        work=work,
        since=since,
        done_today=done_today,
        zone=zone,
        action=action,
        grid_x=grid_x,
        grid_y=grid_y,
        direction=direction,
        task=projected_task,
    )


def project_office_event_founder(
    event: Any,
) -> FounderOfficeEvent:
    """Memproyeksikan OfficeEvent untuk Founder dengan task FounderTaskRef."""
    if isinstance(event, dict):
        seq = int(event.get("seq") or 0)
        ts = int(event.get("ts") or 0)
        board = str(event.get("board") or "global")
        kind: OfficeEventKind = event.get("kind", "task_started")
        agent = event.get("agent")
        actor = event.get("actor")
        message = str(event.get("message") or "")
        raw_task = event.get("task")
    else:
        seq = event.seq
        ts = event.ts
        board = event.board
        kind = event.kind
        agent = event.agent
        actor = event.actor
        message = event.message
        raw_task = event.task

    projected_task = project_task_ref_founder(raw_task) if raw_task else None

    return FounderOfficeEvent(
        seq=seq,
        ts=ts,
        board=board,
        kind=kind,
        agent=agent,
        actor=actor,
        message=message,
        task=projected_task,
    )


def project_host_vitals_founder(vitals: Any) -> FounderHostVitals:
    """Memproyeksikan HostVitals lengkap untuk Founder."""
    if isinstance(vitals, dict):
        cpu = float(vitals.get("cpu_percent") or 0.0)
        mem = float(vitals.get("memory_percent") or 0.0)
        disk = float(vitals.get("disk_percent") or 0.0)
        status = vitals.get("status") or "healthy"
        raw_details = vitals.get("details")
    else:
        cpu = float(vitals.cpu_percent)
        mem = float(vitals.memory_percent)
        disk = float(vitals.disk_percent)
        status = vitals.status
        raw_details = vitals.details

    if status == "warning":
        status_val: Literal["healthy", "warning", "critical"] = "warning"
    elif status == "critical":
        status_val = "critical"
    else:
        status_val = "healthy"

    details_obj: HostVitalsDetails | None = None
    if isinstance(raw_details, dict):
        details_obj = HostVitalsDetails(**raw_details)
    elif isinstance(raw_details, HostVitalsDetails):
        details_obj = raw_details

    return FounderHostVitals(
        cpu_percent=cpu,
        memory_percent=mem,
        disk_percent=disk,
        status=status_val,
        details=details_obj,
    )


def project_world_snapshot_founder(
    snapshot: WorldSnapshot | dict[str, Any],
) -> FounderWorldSnapshot:
    """Memproyeksikan WorldSnapshot menjadi FounderWorldSnapshot."""
    if isinstance(snapshot, dict):
        gen_at = int(snapshot.get("generated_at") or 0)
        seq = int(snapshot.get("seq") or 0)
        tod = snapshot.get("time_of_day") or "day"
        raw_agents = snapshot.get("agents") or []
        raw_events = snapshot.get("recent_events") or []
        raw_coll = snapshot.get("active_collective")
        raw_vitals = snapshot.get("vitals") or {}
    else:
        gen_at = snapshot.generated_at
        seq = snapshot.seq
        tod = snapshot.time_of_day
        raw_agents = snapshot.agents
        raw_events = snapshot.recent_events
        raw_coll = snapshot.active_collective
        raw_vitals = snapshot.vitals

    founder_agents = [project_agent_state_founder(a) for a in raw_agents]
    founder_events = [project_office_event_founder(e) for e in raw_events]
    founder_vitals = project_host_vitals_founder(raw_vitals)

    coll_obj: CollectiveEventState | None = None
    if isinstance(raw_coll, dict):
        coll_obj = CollectiveEventState(**raw_coll)
    elif isinstance(raw_coll, CollectiveEventState):
        coll_obj = raw_coll

    if tod == "dawn":
        tod_val: Literal["dawn", "day", "dusk", "night"] = "dawn"
    elif tod == "dusk":
        tod_val = "dusk"
    elif tod == "night":
        tod_val = "night"
    else:
        tod_val = "day"

    return FounderWorldSnapshot(
        generated_at=gen_at,
        seq=seq,
        projection="founder",
        time_of_day=tod_val,
        agents=founder_agents,
        recent_events=founder_events,
        active_collective=coll_obj,
        vitals=founder_vitals,
    )


def project_agent_profile_detail_founder(
    detail: AgentProfileDetail | dict[str, Any],
) -> FounderAgentProfileDetail:
    """Memproyeksikan AgentProfileDetail ke FounderAgentProfileDetail."""
    if isinstance(detail, dict):
        raw_agent = detail.get("agent") or {}
        bio = detail.get("bio") or AgentBio(
            id="agent",
            name="Agent",
            role="Specialist",
            department="Engineering",
            personality="Siap bertugas",
            primary_color="#1F3A68",
            desk_zone="dev_pod_1",
        )
        raw_tasks = detail.get("recent_tasks") or []
    else:
        raw_agent = detail.agent
        bio = detail.bio
        raw_tasks = detail.recent_tasks

    founder_agent = project_agent_state_founder(raw_agent)
    founder_tasks = [project_task_ref_founder(t) for t in raw_tasks]
    clean_tasks = [t for t in founder_tasks if t is not None]

    return FounderAgentProfileDetail(
        agent=founder_agent,
        bio=bio,
        recent_tasks=clean_tasks,
    )
