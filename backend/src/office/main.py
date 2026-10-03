from __future__ import annotations

import time
from typing import Any

from fastapi import FastAPI

from office.api.auth import router as auth_router
from office.api.rest import router as rest_router
from office.api.stream import SSEBroadcaster
from office.api.stream import router as stream_router
from office.config import load_office_config
from office.domain.collective import CollectiveManager
from office.domain.state import StateEngine

app = FastAPI(
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
async def healthz() -> dict[str, Any]:
    return {"status": "ok", "app": "office-v2", "version": "2.0.0"}
