from __future__ import annotations

import time
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse

from office.api.auth import router as auth_router
from office.api.rest import get_health_status
from office.api.rest import router as rest_router
from office.api.stream import SSEBroadcaster
from office.api.stream import router as stream_router
from office.config import load_office_config
from office.domain.collective import CollectiveManager
from office.domain.state import StateEngine
from office.domain.telemetry import TelemetryCoordinator


@asynccontextmanager
async def lifespan(application: FastAPI) -> AsyncIterator[None]:
    coordinator = getattr(application.state, "telemetry", None)
    if coordinator is None:
        coordinator = TelemetryCoordinator(application)
        application.state.telemetry = coordinator
    if coordinator.started:
        raise RuntimeError("Koordinator telemetri sudah berjalan")
    try:
        await coordinator.start()
        yield
    finally:
        await coordinator.stop()


app = FastAPI(
    lifespan=lifespan,
    title="Agentic AI Office v2 API",
    version="2.0.0",
    description="Real-time read-only multi-agent telemetry and 2.5D isometric world bridge",
)

# Inisialisasi default engine, broadcaster, config, dan collective_manager pada app.state
app.state.start_time = time.time()
app.state.config = load_office_config()
app.state.engine = StateEngine()
app.state.broadcaster = SSEBroadcaster()
app.state.collective_manager = CollectiveManager(
    engine=app.state.engine,
    broadcaster=app.state.broadcaster,
    config=app.state.config,
)

app.include_router(auth_router)
app.include_router(rest_router)
app.include_router(stream_router)


@app.get("/healthz")
async def healthz(request: Request) -> JSONResponse:
    return await get_health_status(request)
