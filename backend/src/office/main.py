from __future__ import annotations

from typing import Any

from fastapi import FastAPI

app = FastAPI(
    title="Agentic AI Office v2 API",
    version="2.0.0",
    description="Real-time read-only multi-agent telemetry and 2.5D isometric world bridge",
)


@app.get("/healthz")
async def healthz() -> dict[str, Any]:
    return {"status": "ok", "app": "office-v2", "version": "2.0.0"}


@app.get("/api/v1/healthz")
async def api_healthz() -> dict[str, Any]:
    return {"status": "ok", "app": "office-v2", "version": "2.0.0"}
