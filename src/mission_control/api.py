"""Read-only REST/SSE router and separately deployed private mutation API.

Default read auth expects a secret header injected ONLY by an authenticated
reverse proxy. Never put this token or an agent token in a VITE_* variable.
"""
from __future__ import annotations

import asyncio
import hmac
import json
import logging
import os
import sqlite3
from pathlib import Path
from typing import Callable

from fastapi import APIRouter, Depends, FastAPI, HTTPException, Request
from fastapi.responses import JSONResponse, StreamingResponse
from starlette.types import ASGIApp, Receive, Scope, Send

from .models import (
    AGENTS, ArtifactSubmit, ReleaseAuthorize, ReleaseConfirm, SpanCreate,
    SpanHeartbeat, SpanTransition, TaskCreate, Verification,
)
from .store import MissionStore, StoreError

log = logging.getLogger(__name__)


def sqlite_wal_is_patched(version: tuple[int, ...]) -> bool:
    return (version >= (3, 51, 3) or
            (version[:2] == (3, 44) and version >= (3, 44, 6)) or
            (version[:2] == (3, 50) and version >= (3, 50, 7)))


def store_from_env() -> MissionStore:
    # WAL-reset fix: sqlite.org/wal.html section 11. Check Python's linked library,
    # not merely the sqlite3 CLI. Verified vendor backports need an explicit opt-in.
    if (os.environ.get("HERMES_MC_REQUIRE_PATCHED_SQLITE", "1") == "1"
            and not sqlite_wal_is_patched(sqlite3.sqlite_version_info)
            and os.environ.get("HERMES_MC_SQLITE_BACKPORT_VERIFIED") != "1"):
        raise RuntimeError("Python SQLite needs the WAL-reset fix (3.51.3+, 3.44.6 or 3.50.7 backport). Audit vendor backports before overriding.")
    path = os.environ.get("HERMES_MC_DB", "/srv/hermes-control/state/mission-control.sqlite3")
    if not Path(path).is_absolute():
        raise RuntimeError("HERMES_MC_DB must be an absolute local-disk path")
    return MissionStore(path)


def _secret(value: str, label: str) -> str:
    if len(value) < 32 or any(ch.isspace() for ch in value):
        raise RuntimeError(f"{label} must contain at least 32 non-whitespace characters")
    return value


def _errors(app: FastAPI) -> None:
    async def store_error(_request: Request, exc: StoreError):
        return JSONResponse({"detail": exc.detail}, status_code=exc.status)

    async def database_error(_request: Request, exc: sqlite3.OperationalError):
        log.error("Mission-control database operation failed: %s", type(exc).__name__)
        return JSONResponse({"detail": "Telemetry storage unavailable"}, status_code=503, headers={"Retry-After": "2"})

    app.add_exception_handler(StoreError, store_error)
    app.add_exception_handler(sqlite3.OperationalError, database_error)


def read_router(store: MissionStore, read_token: str,
                authorize: Callable[[Request], None] | None = None) -> APIRouter:
    token = _secret(read_token, "Read token")

    def default_authorize(request: Request) -> None:
        supplied = request.headers.get("x-hermes-read-token", "")
        # Useful for direct loopback diagnostics with curl; browsers use proxy auth.
        if not supplied and request.headers.get("authorization", "").startswith("Bearer "):
            supplied = request.headers["authorization"][7:]
        if not hmac.compare_digest(supplied.encode("utf-8"), token.encode("utf-8")):
            raise HTTPException(401, "Authenticated mission-control access is required")

    guard = authorize or default_authorize
    router = APIRouter(prefix="/api/v1/execution", tags=["execution-observability"], dependencies=[Depends(guard)])

    @router.get("/snapshot")
    def snapshot():
        return JSONResponse(store.snapshot(), headers={"Cache-Control": "no-store"})

    @router.get("/events")
    async def events(request: Request):
        async def generate():
            # Full snapshots, not deltas. Reconnection always replaces projection;
            # Last-Event-ID is intentionally NOT interpreted as event-log replay.
            last_revision = -1
            last_sent = 0.0
            while not await request.is_disconnected():
                try:
                    payload = await asyncio.to_thread(store.snapshot)
                except (sqlite3.Error, StoreError):
                    log.exception("Mission-control SSE snapshot failed")
                    yield 'event: stream_error\ndata: {"code":"storage_unavailable"}\n\n'
                    return
                now = asyncio.get_running_loop().time()
                if payload["revision"] != last_revision or now - last_sent >= 5:
                    encoded = json.dumps(payload, separators=(",", ":"), ensure_ascii=True)
                    event_id = f'{payload["stream_id"]}:{payload["revision"]}'
                    yield f"id: {event_id}\nevent: delegation_snapshot\ndata: {encoded}\n\n"
                    last_revision, last_sent = payload["revision"], now
                await asyncio.sleep(1)

        return StreamingResponse(generate(), media_type="text/event-stream", headers={
            "Cache-Control": "no-cache, no-transform", "X-Accel-Buffering": "no",
        })

    return router


def install_mission_control(app: FastAPI, store: MissionStore | None = None,
                            read_token: str | None = None,
                            authorize: Callable[[Request], None] | None = None) -> MissionStore:
    """Call before app.mount('/'). No replacement of collectors, /ws, or lifespan."""
    if getattr(app.state, "mission_control", None) is not None:
        raise RuntimeError("Mission control was already installed")
    token = _secret(read_token or os.environ.get("HERMES_MC_READ_TOKEN", ""), "HERMES_MC_READ_TOKEN")
    actual_store = store or store_from_env()
    _errors(app)
    app.include_router(read_router(actual_store, token, authorize))
    app.state.mission_control = actual_store
    return actual_store


class BodyLimitMiddleware:
    """Bound write-request bytes including chunked transfer; pure ASGI for SSE safety."""
    def __init__(self, app: ASGIApp, limit: int = 65536):
        self.app, self.limit = app, limit

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http" or scope["method"] not in {"POST", "PUT", "PATCH"}:
            await self.app(scope, receive, send)
            return
        chunks, total = [], 0
        while True:
            message = await receive()
            if message["type"] == "http.disconnect":
                return
            total += len(message.get("body", b""))
            if total > self.limit:
                await JSONResponse({"detail": "Request body exceeds 64 KiB"}, status_code=413)(scope, receive, send)
                return
            chunks.append(message)
            if not message.get("more_body", False):
                break
        async def bounded_receive():
            return chunks.pop(0) if chunks else await receive()
        await self.app(scope, bounded_receive, send)


def load_actor_tokens() -> dict[str, str]:
    path = Path(os.environ["HERMES_MC_ACTOR_TOKENS_FILE"])
    if not path.is_absolute():
        raise RuntimeError("Actor token file must be an absolute path")
    if path.stat().st_mode & 0o077:
        raise RuntimeError("Actor token file must not be readable by group or others")
    value = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(value, dict):
        raise RuntimeError("Actor token file must be a JSON mapping of actor to token")
    return value


def create_control_app(store: MissionStore, actor_tokens: dict[str, str]) -> FastAPI:
    if not actor_tokens:
        raise RuntimeError("At least one authenticated actor is required")
    allowed = set(AGENTS) | {"runtime-dispatcher"}
    checked = {}
    for actor, token in actor_tokens.items():
        if actor not in allowed or not isinstance(token, str):
            raise RuntimeError("Invalid actor token configuration")
        checked[actor] = _secret(token, f"Token for {actor}")
    if len(set(checked.values())) != len(checked):
        raise RuntimeError("Different actors must have different credentials")

    app = FastAPI(title="Hermes Private Execution Control", docs_url=None, redoc_url=None, openapi_url=None)
    app.add_middleware(BodyLimitMiddleware)
    _errors(app)

    def identity(request: Request) -> str:
        header = request.headers.get("authorization", "")
        supplied = header[7:] if header.startswith("Bearer ") else ""
        actor_found = None
        for actor, token in checked.items():
            if hmac.compare_digest(supplied.encode("utf-8"), token.encode("utf-8")):
                actor_found = actor
        if actor_found is None:
            raise HTTPException(401, "Valid private actor credentials are required")
        return actor_found

    router = APIRouter(prefix="/internal/v1/execution")

    @app.get("/health")
    def health():
        return {"status": "ok", "service": "hermes-private-execution"}

    # Avoid local Annotated aliases with postponed annotations: explicit Depends
    # keeps FastAPI's type resolution independent of function-local namespaces.
    @router.post("/spans")
    def create_span(command: SpanCreate, actor: str = Depends(identity)):
        return store.create_span(actor, command)

    @router.get("/spans/{span_id}")
    def get_span(span_id: str, actor: str = Depends(identity)):
        return {"span": store.get_span(span_id)}

    @router.post("/spans/{span_id}/transition")
    def transition(span_id: str, command: SpanTransition, actor: str = Depends(identity)):
        return store.transition_span(actor, span_id, command)

    @router.post("/spans/{span_id}/heartbeat")
    def heartbeat(span_id: str, command: SpanHeartbeat, actor: str = Depends(identity)):
        return store.heartbeat(actor, span_id, command)

    @router.post("/tasks")
    def create_task(command: TaskCreate, actor: str = Depends(identity)):
        return store.create_task(actor, command)

    @router.get("/tasks/{task_id}")
    def get_task(task_id: str, actor: str = Depends(identity)):
        return {"task": store.get_task(task_id)}

    @router.post("/tasks/{task_id}/artifact")
    def artifact(task_id: str, command: ArtifactSubmit, actor: str = Depends(identity)):
        return store.submit_artifact(actor, task_id, command)

    @router.post("/tasks/{task_id}/verify")
    def verify(task_id: str, command: Verification, actor: str = Depends(identity)):
        return store.verify_artifact(actor, task_id, command)

    @router.post("/tasks/{task_id}/authorize-release")
    def authorize(task_id: str, command: ReleaseAuthorize, actor: str = Depends(identity)):
        return store.authorize_release(actor, task_id, command)

    @router.post("/tasks/{task_id}/confirm-release")
    def confirm(task_id: str, command: ReleaseConfirm, actor: str = Depends(identity)):
        return store.confirm_release(actor, task_id, command)

    app.include_router(router)
    return app
