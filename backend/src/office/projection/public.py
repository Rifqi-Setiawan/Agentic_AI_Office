from __future__ import annotations

import logging
from typing import Any, Literal

from pydantic import BaseModel, Field

from office.config import OfficeConfig, load_office_config
from office.domain.normalizer import get_agent_display_name
from office.models.events import OfficeEventKind
from office.models.kanban import TaskRef, TaskRow
from office.models.profiles import AgentBio, AgentProfileDetail
from office.models.state import AgentState, CollectiveEventState, WorldSnapshot
from office.sources.profiles import STATIC_AGENT_METADATA

logger = logging.getLogger(__name__)

CANARY_SUBSTRING = "LEAK-CANARY"


def sanitize_identifier(val: str | None, default: str = "t_sanitized") -> str:
    """Membersihkan ID dari token canary atau nilai tidak aman."""
    if not val:
        return default
    s = str(val).strip()
    if CANARY_SUBSTRING in s:
        return default
    return s


def get_public_board_name(raw_board: str | None, config: OfficeConfig | None = None) -> str:
    """Mengembalikan nama board yang divalidasi terhadap allowlist public_boards.

    Sesuai tabel redaksi: Hanya board yang ada di allowlist `public_boards`
    yang ditampilkan apa adanya; selain itu diganti 'Proyek internal'.
    """
    if not raw_board:
        return "Proyek internal"
    board_clean = raw_board.strip()
    cfg = config or load_office_config()
    if cfg.is_board_public(board_clean) and CANARY_SUBSTRING not in board_clean:
        return board_clean
    return "Proyek internal"


def get_public_task_title(
    agent_id: str | None = None,
    role: str | None = None,
    config: OfficeConfig | None = None,
) -> str:
    """Mengembalikan judul tugas publik hasil penyangakalan berbasis peran (role masking)."""
    cfg = config or load_office_config()
    return cfg.get_task_category(agent_id=agent_id, role=role)


def get_public_agent_action(
    work: str,
    agent_id: str,
    role: str | None = None,
    block_kind: str | None = None,
    config: OfficeConfig | None = None,
) -> str:
    """Menurunkan teks deskripsi aksi visual agen yang aman untuk publik."""
    cfg = config or load_office_config()
    category = cfg.get_task_category(agent_id=agent_id, role=role)

    match work:
        case "working":
            return f"Mengerjakan tugas: {category}"
        case "stale":
            return f"Duduk termenung (task stale): {category}"
        case "blocked":
            if block_kind == "needs_input":
                return "Menunggu masukan di ruang Jarvis"
            kind_label = block_kind or "ketergantungan"
            return f"Tugas terblokir ({kind_label}): {category}"
        case "failed":
            return f"Mengatasi kegagalan run pada tugas: {category}"
        case "done_recent":
            return f"Merayakan penyelesaian tugas: {category}"
        case "off_duty":
            return "Sedang di luar jam kerja (off-duty)"
        case _:
            return "Standby di meja kerja"


def get_public_event_message(
    kind: OfficeEventKind | str,
    agent_id: str | None,
    actor_id: str | None = None,
    block_kind: str | None = None,
    collective_title: str | None = None,
    config: OfficeConfig | None = None,
) -> str:
    """Menyusun pesan linimasa ramah publik tanpa membocorkan komentar, error, atau teks tugas."""
    cfg = config or load_office_config()
    agent_name = get_agent_display_name(agent_id)
    actor_name = get_agent_display_name(actor_id) if actor_id else "Seseorang"
    category = cfg.get_task_category(agent_id=agent_id)

    match kind:
        case "task_created":
            return f"Tugas baru dibuat: {category}"
        case "task_started":
            return f"{agent_name} mulai mengerjakan tugas: {category}"
        case "task_commented":
            return f"{actor_name} memberikan catatan koordinasi pada tugas: {category}"
        case "task_blocked":
            if block_kind == "needs_input":
                return f"{agent_name} membutuhkan masukan untuk tugas: {category}"
            kind_label = block_kind or "ketergantungan"
            return f"{agent_name} terblokir ({kind_label}) pada tugas: {category}"
        case "task_done":
            return f"{agent_name} telah menyelesaikan tugas: {category}"
        case "task_failed":
            return f"Eksekusi tugas {category} oleh {agent_name} gagal"
        case "task_stale":
            return f"Tugas {category} ({agent_name}) tidak merespons (stale)"
        case "agent_online":
            return f"{agent_name} aktif bertugas di kantor (on-duty)"
        case "agent_offline":
            return f"{agent_name} selesai bertugas (off-duty)"
        case "collective_started":
            title = collective_title or "kegiatan bersama"
            return f"Acara kolektif {title} dimulai"
        case "collective_ended":
            title = collective_title or "kegiatan bersama"
            return f"Acara kolektif {title} selesai"
        case "vitals_alert":
            return "Peringatan sistem: Beban sumber daya server meningkat"
        case _:
            return f"Aktivitas pada tugas {category}"


# ==============================================================================
# Model-Model Proyeksi Publik (Strict Whitelist Separation)
# ==============================================================================


class PublicTaskRef(BaseModel):
    """Proyeksi publik referensi tugas Kanban (strict whitelist).

    Hanya menyertakan field yang diizinkan untuk publik:
    - id
    - title (disamarkan menjadi kategori peran)
    - board (allowlisted atau 'Proyek internal')
    - status
    - block_kind
    - started_at

    Field internal: body, summary, result, error, workspace_path, branch_name,
    dan worker_pid secara struktural DITIADAKAN dari skema JSON.
    """

    id: str
    title: str
    board: str
    status: str
    block_kind: str | None = None
    started_at: int | None = None

    def to_task_ref(self) -> TaskRef:
        """Mengonversi ke TaskRef umum dengan field internal bernilai None."""
        return TaskRef(
            id=self.id,
            title=self.title,
            board=self.board,
            status=self.status,
            block_kind=self.block_kind,
            started_at=self.started_at,
            body=None,
            summary=None,
            result=None,
            error=None,
            workspace_path=None,
            branch_name=None,
            worker_pid=None,
        )


class PublicHostVitals(BaseModel):
    """Proyeksi publik metrik host: persentase dibulatkan, rincian hardware ditiadakan."""

    cpu_percent: float
    memory_percent: float
    disk_percent: float
    status: Literal["healthy", "warning", "critical"] = "healthy"


class PublicAgentState(BaseModel):
    """Proyeksi publik status operasional dan visual seorang agen."""

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
    task: PublicTaskRef | None = None


class PublicOfficeEvent(BaseModel):
    """Proyeksi publik peristiwa linimasa virtual office."""

    seq: int
    ts: int
    board: str
    kind: OfficeEventKind
    agent: str | None = None
    actor: str | None = None
    message: str
    task: PublicTaskRef | None = None


class PublicWorldSnapshot(BaseModel):
    """Proyeksi publik snapshot kondisi menyeluruh dunia kantor."""

    generated_at: int
    seq: int
    projection: Literal["public"] = "public"
    time_of_day: Literal["dawn", "day", "dusk", "night"] = "day"
    agents: list[PublicAgentState] = Field(default_factory=list)
    recent_events: list[PublicOfficeEvent] = Field(default_factory=list)
    active_collective: CollectiveEventState | None = None
    vitals: PublicHostVitals


class PublicAgentProfileDetail(BaseModel):
    """Proyeksi publik rincian profil agen dan 5 tugas terakhir."""

    agent: PublicAgentState
    bio: AgentBio
    recent_tasks: list[PublicTaskRef] = Field(default_factory=list)


# ==============================================================================
# Fungsi Transformasi Proyeksi Publik
# ==============================================================================


def project_task_ref_public(
    task: TaskRef | TaskRow | dict[str, Any] | None,
    agent_id: str | None = None,
    role: str | None = None,
    config: OfficeConfig | None = None,
) -> PublicTaskRef | None:
    """Memproyeksikan TaskRef/TaskRow/dict menjadi PublicTaskRef strictly whitelisted."""
    if task is None:
        return None

    cfg = config or load_office_config()

    if isinstance(task, dict):
        raw_id = task.get("id")
        raw_board = task.get("board")
        raw_status = str(task.get("status") or "running")
        block_kind = task.get("block_kind")
        started_at = task.get("started_at")
        assignee = task.get("assignee")
    else:
        raw_id = task.id
        raw_board = task.board
        raw_status = getattr(task, "status", "running")
        block_kind = getattr(task, "block_kind", None)
        started_at = getattr(task, "started_at", None)
        assignee = getattr(task, "assignee", None)

    clean_id = sanitize_identifier(str(raw_id) if raw_id is not None else None, "t_masked")
    target_agent = agent_id or assignee
    masked_title = get_public_task_title(agent_id=target_agent, role=role, config=cfg)
    public_board = get_public_board_name(raw_board, config=cfg)

    return PublicTaskRef(
        id=clean_id,
        title=masked_title,
        board=public_board,
        status=raw_status,
        block_kind=block_kind,
        started_at=started_at,
    )


def project_agent_state_public(
    agent: AgentState | dict[str, Any],
    config: OfficeConfig | None = None,
) -> PublicAgentState:
    """Memproyeksikan AgentState menjadi PublicAgentState."""
    cfg = config or load_office_config()

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
        grid_x = agent.get("grid_x")
        grid_y = agent.get("grid_y")
        direction = agent.get("direction", "SE")
        raw_task = agent.get("task")
    else:
        aid = agent.id.lower().strip()
        meta = STATIC_AGENT_METADATA.get(aid, {})
        name = agent.name or str(meta.get("name") or aid.capitalize())
        role = agent.role or str(meta.get("role") or "Specialist")
        presence = agent.presence
        work = agent.work
        since = agent.since
        done_today = agent.done_today
        zone = agent.zone or str(meta.get("desk_zone") or "dev_pod_1")
        grid_x = agent.grid_x
        grid_y = agent.grid_y
        direction = agent.direction
        raw_task = agent.task

    clean_aid = sanitize_identifier(aid, "guest")
    projected_task = (
        project_task_ref_public(raw_task, agent_id=clean_aid, role=role, config=cfg)
        if raw_task
        else None
    )

    block_kind = projected_task.block_kind if projected_task else None
    public_action = get_public_agent_action(
        work=work,
        agent_id=clean_aid,
        role=role,
        block_kind=block_kind,
        config=cfg,
    )

    return PublicAgentState(
        id=clean_aid,
        name=name,
        role=role,
        presence=presence,
        work=work,
        since=since,
        done_today=done_today,
        zone=zone,
        action=public_action,
        grid_x=grid_x,
        grid_y=grid_y,
        direction=direction,
        task=projected_task,
    )


def project_office_event_public(
    event: Any,
    config: OfficeConfig | None = None,
) -> PublicOfficeEvent:
    """Memproyeksikan OfficeEvent menjadi PublicOfficeEvent yang tersanitasi."""
    cfg = config or load_office_config()

    if isinstance(event, dict):
        seq = int(event.get("seq") or 0)
        ts = int(event.get("ts") or 0)
        raw_board = event.get("board")
        kind = event.get("kind", "task_started")
        raw_agent = event.get("agent")
        raw_actor = event.get("actor")
        raw_task = event.get("task")
    else:
        seq = event.seq
        ts = event.ts
        raw_board = event.board
        kind = event.kind
        raw_agent = event.agent
        raw_actor = event.actor
        raw_task = event.task

    agent_id = sanitize_identifier(raw_agent, "guest") if raw_agent else None
    actor_id = sanitize_identifier(raw_actor, "guest") if raw_actor else None
    public_board = get_public_board_name(raw_board, config=cfg)

    projected_task = (
        project_task_ref_public(raw_task, agent_id=agent_id, config=cfg) if raw_task else None
    )
    block_kind = projected_task.block_kind if projected_task else None

    safe_message = get_public_event_message(
        kind=kind,
        agent_id=agent_id,
        actor_id=actor_id,
        block_kind=block_kind,
        config=cfg,
    )

    return PublicOfficeEvent(
        seq=seq,
        ts=ts,
        board=public_board,
        kind=kind,
        agent=agent_id,
        actor=actor_id,
        message=safe_message,
        task=projected_task,
    )


def project_host_vitals_public(vitals: Any) -> PublicHostVitals:
    """Memproyeksikan HostVitals untuk publik (persentase dibulatkan, details ditiadakan)."""
    if isinstance(vitals, dict):
        cpu = float(round(float(vitals.get("cpu_percent") or 0.0)))
        mem = float(round(float(vitals.get("memory_percent") or 0.0)))
        disk = float(round(float(vitals.get("disk_percent") or 0.0)))
        status = vitals.get("status") or "healthy"
    else:
        cpu = float(round(getattr(vitals, "cpu_percent", 0.0)))
        mem = float(round(getattr(vitals, "memory_percent", 0.0)))
        disk = float(round(getattr(vitals, "disk_percent", 0.0)))
        status = getattr(vitals, "status", "healthy")

    if status == "warning":
        status_val: Literal["healthy", "warning", "critical"] = "warning"
    elif status == "critical":
        status_val = "critical"
    else:
        status_val = "healthy"

    return PublicHostVitals(
        cpu_percent=cpu,
        memory_percent=mem,
        disk_percent=disk,
        status=status_val,
    )


def project_collective_event_public(
    collective: CollectiveEventState | dict[str, Any] | None,
) -> CollectiveEventState | None:
    """Memproyeksikan CollectiveEventState publik dengan judul dan partisipan yang tersanitasi."""
    if collective is None:
        return None

    if isinstance(collective, dict):
        cid = sanitize_identifier(str(collective.get("id") or "coll_001"))
        kind = collective.get("kind") or "rapat"
        started_at = int(collective.get("started_at") or 0)
        expires_at = int(collective.get("expires_at") or 0)
        raw_parts = collective.get("participants") or []
        active = bool(collective.get("active", True))
    else:
        cid = sanitize_identifier(collective.id)
        kind = collective.kind
        started_at = collective.started_at
        expires_at = collective.expires_at
        raw_parts = collective.participants
        active = collective.active

    if kind == "break":
        kind_val: Literal["rapat", "break", "sholat", "pool_party", "fire_drill", "town_hall"] = (
            "break"
        )
    elif kind == "sholat":
        kind_val = "sholat"
    elif kind == "pool_party":
        kind_val = "pool_party"
    elif kind == "fire_drill":
        kind_val = "fire_drill"
    elif kind == "town_hall":
        kind_val = "town_hall"
    else:
        kind_val = "rapat"

    kind_titles = {
        "rapat": "Rapat Koordinasi Bersama",
        "break": "Waktu Istirahat Bersama",
        "sholat": "Waktu Sholat Bersama",
        "pool_party": "Pesta Kolam",
        "fire_drill": "Simulasi Evakuasi",
        "town_hall": "Pertemuan Kantor",
    }
    clean_title = kind_titles.get(kind_val, "Kegiatan Bersama")

    clean_participants = [sanitize_identifier(str(p), "guest") for p in raw_parts]

    return CollectiveEventState(
        id=cid,
        kind=kind_val,
        title=clean_title,
        started_at=started_at,
        expires_at=expires_at,
        participants=clean_participants,
        active=active,
    )


def project_world_snapshot_public(
    snapshot: WorldSnapshot | dict[str, Any],
    config: OfficeConfig | None = None,
) -> PublicWorldSnapshot:
    """Memproyeksikan seluruh WorldSnapshot menjadi PublicWorldSnapshot yang aman."""
    cfg = config or load_office_config()

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

    pub_agents = [project_agent_state_public(a, config=cfg) for a in raw_agents]
    pub_events = [project_office_event_public(e, config=cfg) for e in raw_events]
    pub_vitals = project_host_vitals_public(raw_vitals)
    pub_coll = project_collective_event_public(raw_coll)

    if tod == "dawn":
        tod_val: Literal["dawn", "day", "dusk", "night"] = "dawn"
    elif tod == "dusk":
        tod_val = "dusk"
    elif tod == "night":
        tod_val = "night"
    else:
        tod_val = "day"

    return PublicWorldSnapshot(
        generated_at=gen_at,
        seq=seq,
        projection="public",
        time_of_day=tod_val,
        agents=pub_agents,
        recent_events=pub_events,
        active_collective=pub_coll,
        vitals=pub_vitals,
    )


def project_agent_profile_detail_public(
    detail: AgentProfileDetail | dict[str, Any],
    config: OfficeConfig | None = None,
) -> PublicAgentProfileDetail:
    """Memproyeksikan AgentProfileDetail ke PublicAgentProfileDetail."""
    cfg = config or load_office_config()

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

    pub_agent = project_agent_state_public(raw_agent, config=cfg)
    pub_tasks = [
        project_task_ref_public(t, agent_id=pub_agent.id, role=pub_agent.role, config=cfg)
        for t in raw_tasks
    ]
    clean_tasks = [t for t in pub_tasks if t is not None]

    return PublicAgentProfileDetail(
        agent=pub_agent,
        bio=bio,
        recent_tasks=clean_tasks,
    )
