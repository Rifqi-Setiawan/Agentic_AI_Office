from __future__ import annotations

import logging
import resource
import time
from typing import Literal

from fastapi import APIRouter, Path, Query, Request
from fastapi.responses import JSONResponse

from office.api.auth import is_founder_authenticated, verify_office_intent
from office.domain.collective import (
    CollectiveActiveConflictError,
    CollectiveManager,
    InvalidCollectiveKindError,
)
from office.domain.state import StateEngine
from office.models.auth import TriggerCollectiveRequest
from office.models.errors import ErrorResponse
from office.models.health import HealthResponse, ReaderHealth, ReaderHealthMap
from office.models.kanban import TaskRef
from office.models.profiles import AgentBio, AgentProfileDetail
from office.models.state import CollectiveEventState
from office.projection import (
    FounderAgentProfileDetail,
    PublicAgentProfileDetail,
    project_agent_profile_detail_founder,
    project_agent_profile_detail_public,
)
from office.sources.profiles import STATIC_AGENT_METADATA

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1", tags=["REST Telemetry"])

APP_START_TIME = time.time()


def get_state_engine(request: Request) -> StateEngine:
    """Mengambil instance StateEngine dari app.state."""
    engine = getattr(request.app.state, "engine", None)
    if engine is None:
        engine = StateEngine()
        request.app.state.engine = engine
    return engine


def get_collective_manager(request: Request) -> CollectiveManager:
    """Mengambil instance CollectiveManager dari app.state atau membuatnya jika belum ada."""
    cm = getattr(request.app.state, "collective_manager", None)
    if cm is None:
        engine = get_state_engine(request)
        broadcaster = getattr(request.app.state, "broadcaster", None)
        cfg = getattr(request.app.state, "config", None)
        cm = CollectiveManager(engine=engine, broadcaster=broadcaster, config=cfg)
        request.app.state.collective_manager = cm
    return cm


def get_agent_bio(aid: str) -> AgentBio:
    """Membentuk AgentBio dari STATIC_AGENT_METADATA atau fallback generik."""
    meta = STATIC_AGENT_METADATA.get(aid, {})
    return AgentBio(
        id=aid,
        name=meta.get("name", aid.capitalize()),
        alias=meta.get("alias"),
        role=meta.get("role", "Specialist"),
        department=meta.get("department", "Engineering"),
        personality=meta.get("personality", "Siap bertugas"),
        specialties=meta.get("specialties", []),
        primary_color=meta.get("primary_color", "#1F3A68"),
        desk_zone=meta.get("desk_zone", "dev_pod_1"),
    )


def get_process_memory_rss_mb() -> float:
    """Membaca ukuran memori RSS proses saat ini dalam Megabyte."""
    try:
        # ru_maxrss dalam KB di Linux
        usage = resource.getrusage(resource.RUSAGE_SELF)
        return round(usage.ru_maxrss / 1024.0, 2)
    except Exception:
        return 0.0


@router.get(
    "/snapshot",
    summary="Ambil snapshot kondisi dunia kantor saat ini",
    response_model=None,
    responses={
        200: {"description": "Snapshot dunia kantor berhasil diambil."},
        401: {
            "model": ErrorResponse,
            "description": "Tidak terautentikasi untuk proyeksi founder.",
        },
    },
)
async def get_world_snapshot(
    request: Request,
    projection: Literal["public", "founder"] = Query(
        default="public",
        description="Proyeksi data yang diminta (public atau founder).",
    ),
) -> JSONResponse:
    engine = get_state_engine(request)
    cfg = getattr(request.app.state, "config", None)

    if projection == "founder":
        if not is_founder_authenticated(request):
            return JSONResponse(
                status_code=401,
                content={
                    "error": "Autentikasi Founder diperlukan untuk mengakses proyeksi founder",
                    "code": "UNAUTHORIZED",
                },
            )
        snapshot = engine.get_snapshot(projection="founder", config=cfg)
    else:
        snapshot = engine.get_snapshot(projection="public", config=cfg)

    return JSONResponse(status_code=200, content=snapshot.model_dump(mode="json"))


@router.get(
    "/agents/{id}",
    summary="Ambil profil dan status detail satu agen",
    response_model=None,
    responses={
        200: {"description": "Detail profil agen berhasil ditemukan."},
        401: {
            "model": ErrorResponse,
            "description": "Tidak terautentikasi untuk proyeksi founder.",
        },
        404: {"model": ErrorResponse, "description": "Agen dengan ID tersebut tidak ditemukan."},
    },
)
async def get_agent_detail(
    request: Request,
    id: str = Path(..., description="Identifier unik profil agen."),
    projection: Literal["public", "founder"] = Query(
        default="public",
        description="Proyeksi data yang diminta (public atau founder).",
    ),
) -> JSONResponse:
    engine = get_state_engine(request)
    cfg = getattr(request.app.state, "config", None)
    aid = id.lower().strip()

    # Periksa apakah agent dikenal di state engine atau metadata statis
    agent_state = engine.get_agent(aid)
    if agent_state is None and aid not in STATIC_AGENT_METADATA:
        return JSONResponse(
            status_code=404,
            content={
                "error": f"Agen dengan ID '{id}' tidak ditemukan",
                "code": "AGENT_NOT_FOUND",
            },
        )

    # Pastikan agent state siap
    if agent_state is None:
        agent_state = engine.ensure_agent(aid, int(time.time()))

    bio = get_agent_bio(aid)

    # Kumpulkan hingga 5 task terakhir yang dikerjakan agen
    recent_tasks: list[TaskRef] = []
    if agent_state.task is not None:
        recent_tasks.append(agent_state.task)

    # Cari dari riwayat event ring buffer untuk task selesai/terblokir agen ini
    for ev in reversed(engine.ring_buffer.get_recent(limit=500)):
        if ev.agent == aid and ev.task is not None:
            # Hindari duplikat task_id
            if not any(t.id == ev.task.id for t in recent_tasks):
                recent_tasks.append(ev.task)
        if len(recent_tasks) >= 5:
            break

    detail = AgentProfileDetail(
        agent=agent_state,
        bio=bio,
        recent_tasks=recent_tasks,
    )

    projected: PublicAgentProfileDetail | FounderAgentProfileDetail
    if projection == "founder":
        if not is_founder_authenticated(request):
            return JSONResponse(
                status_code=401,
                content={
                    "error": "Autentikasi Founder diperlukan untuk mengakses proyeksi founder",
                    "code": "UNAUTHORIZED",
                },
            )
        projected = project_agent_profile_detail_founder(detail)
    else:
        projected = project_agent_profile_detail_public(detail, config=cfg)

    return JSONResponse(status_code=200, content=projected.model_dump(mode="json"))


@router.get(
    "/healthz",
    summary="Health check dan status konektivitas reader",
    response_model=None,
    responses={
        200: {"description": "Status operasional backend dan reader data."},
        503: {"description": "Layanan mengalami degradasi atau error reader."},
    },
)
async def get_health_status(request: Request) -> JSONResponse:
    now_ts = int(time.time())
    start_ts = getattr(request.app.state, "start_time", APP_START_TIME)
    uptime = max(0.0, round(time.time() - start_ts, 2))
    rss_mb = get_process_memory_rss_mb()

    # Baca reader health dari app.state.readers jika tersedia
    readers_dict = getattr(request.app.state, "readers", None)
    if isinstance(readers_dict, ReaderHealthMap):
        readers_map = readers_dict
    elif isinstance(readers_dict, dict):
        readers_map = ReaderHealthMap(**readers_dict)
    else:
        readers_map = ReaderHealthMap()

    # Public health uses a whitelist; errors and details may contain private runtime data.
    readers_map = ReaderHealthMap(
        **{
            name: ReaderHealth(
                status=reader.status,
                last_poll=reader.last_poll,
                error="Telemetri tidak tersedia" if reader.status != "ok" else None,
            )
            for name, reader in readers_map
        }
    )

    # Evaluasi status agregat
    reader_statuses = [
        readers_map.kanban.status,
        readers_map.gateway.status,
        readers_map.profiles.status,
        readers_map.host.status,
    ]
    if "error" in reader_statuses:
        aggregate_status: Literal["ok", "degraded", "error"] = "error"
    elif "degraded" in reader_statuses:
        aggregate_status = "degraded"
    else:
        aggregate_status = "ok"

    health = HealthResponse(
        status=aggregate_status,
        timestamp=now_ts,
        uptime_seconds=uptime,
        memory_rss_mb=rss_mb,
        version="2.0.0",
        readers=readers_map,
    )

    status_code = 503 if aggregate_status == "error" else 200
    return JSONResponse(status_code=status_code, content=health.model_dump(mode="json"))


@router.post(
    "/collective",
    summary="Picu event kolektif kantor (Founder)",
    description=(
        "Memicu event interaksi kolektif manual di kantor (rapat, break, sholat) dengan durasi TTL."
    ),
    response_model=None,
    responses={
        200: {
            "model": CollectiveEventState,
            "description": "Event kolektif berhasil dipicu dan disiarkan.",
        },
        400: {"model": ErrorResponse, "description": "Parameter payload tidak valid."},
        401: {"model": ErrorResponse, "description": "Tidak terautentikasi sebagai Founder."},
        403: {
            "model": ErrorResponse,
            "description": "Header X-Office-Intent: 1 tidak ada atau tidak valid.",
        },
        409: {
            "model": ErrorResponse,
            "description": "Event kolektif lain masih berlangsung aktif.",
        },
    },
)
async def trigger_collective(
    request: Request,
    payload: TriggerCollectiveRequest,
) -> JSONResponse:
    # 1. Validasi header proteksi CSRF X-Office-Intent
    if not verify_office_intent(request):
        return JSONResponse(
            status_code=403,
            content={
                "error": "Header X-Office-Intent: 1 wajib disertakan untuk proteksi CSRF",
                "code": "FORBIDDEN",
            },
        )

    # 2. Validasi autentikasi Founder
    if not is_founder_authenticated(request):
        return JSONResponse(
            status_code=401,
            content={
                "error": "Autentikasi Founder diperlukan untuk memicu event kolektif",
                "code": "UNAUTHORIZED",
            },
        )

    # 3. Jalankan pembuat event kolektif
    manager = get_collective_manager(request)
    try:
        coll = await manager.start_event(
            kind=payload.kind,
            duration_seconds=payload.duration_seconds,
            title=payload.title,
            participants=payload.participants,
        )
        return JSONResponse(
            status_code=200,
            content=coll.model_dump(mode="json"),
        )
    except InvalidCollectiveKindError as exc:
        return JSONResponse(
            status_code=400,
            content={
                "error": str(exc),
                "code": "INVALID_COLLECTIVE_KIND",
            },
        )
    except CollectiveActiveConflictError as exc:
        return JSONResponse(
            status_code=409,
            content={
                "error": str(exc),
                "code": "COLLECTIVE_ACTIVE",
            },
        )
