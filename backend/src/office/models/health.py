from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, Field


class ReaderHealth(BaseModel):
    """Kondisi kesehatan modul pembaca data sumber."""

    status: Literal["ok", "degraded", "error"] = "ok"
    last_poll: int = 0
    error: str | None = None
    details: dict[str, Any] | None = None


class ReaderHealthMap(BaseModel):
    """Status kesehatan masing-masing komponen modul pembaca data sumber."""

    kanban: ReaderHealth = Field(default_factory=ReaderHealth)
    gateway: ReaderHealth = Field(default_factory=ReaderHealth)
    profiles: ReaderHealth = Field(default_factory=ReaderHealth)
    host: ReaderHealth = Field(default_factory=ReaderHealth)


class HealthResponse(BaseModel):
    """Laporan komprehensif kesehatan layanan backend."""

    status: Literal["ok", "degraded", "error"] = "ok"
    timestamp: int
    uptime_seconds: float
    memory_rss_mb: float
    version: str = "2.0.0"
    readers: ReaderHealthMap
