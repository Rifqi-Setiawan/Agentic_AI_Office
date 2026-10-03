from __future__ import annotations

from typing import Literal

from pydantic import BaseModel


class HostVitalsDetails(BaseModel):
    """Rincian telemetri perangkat keras dan proses server (hanya proyeksi Founder)."""

    cpu_cores: int
    load_1m: float
    load_5m: float
    load_15m: float
    memory_total_mb: float
    memory_used_mb: float
    memory_available_mb: float
    disk_total_gb: float
    disk_used_gb: float
    uptime_seconds: float


class HostVitals(BaseModel):
    """Metrik sumber daya server VPS tempat sistem beroperasi."""

    cpu_percent: float
    memory_percent: float
    disk_percent: float
    status: Literal["healthy", "warning", "critical"] = "healthy"
    details: HostVitalsDetails | None = None
