from __future__ import annotations

import asyncio
import logging
import os
import time
from pathlib import Path
from typing import Literal

from office.models.health import ReaderHealth
from office.models.host import HostVitals, HostVitalsDetails

logger = logging.getLogger(__name__)


class HostReader:
    """Reader telemetri vitalitas host VPS.

    Mematuhi spec bagian 1:
    - Interval polling 5 dtk
    - CPU% dari delta /proc/stat
    - RAM dari MemAvailable di /proc/meminfo
    - Disk dari os.statvfs
    """

    def __init__(
        self,
        stat_file: Path | str = "/proc/stat",
        meminfo_file: Path | str = "/proc/meminfo",
        uptime_file: Path | str = "/proc/uptime",
        root_path: Path | str = "/",
    ) -> None:
        self.stat_file = Path(stat_file)
        self.meminfo_file = Path(meminfo_file)
        self.uptime_file = Path(uptime_file)
        self.root_path = Path(root_path)

        self._prev_cpu_times: tuple[int, int] | None = None  # (idle_time, total_time)
        self._last_vitals: HostVitals | None = None
        self._health = ReaderHealth(status="ok", last_poll=0)
        self._is_degraded = False

    @property
    def health(self) -> ReaderHealth:
        return self._health

    @property
    def is_degraded(self) -> bool:
        return self._is_degraded

    def _read_cpu_delta(self) -> tuple[float, int]:
        """Menghitung CPU usage % dari delta /proc/stat dan jumlah core."""
        if not self.stat_file.is_file():
            raise FileNotFoundError(f"File {self.stat_file} tidak ditemukan")

        lines = self.stat_file.read_text(encoding="utf-8").splitlines()
        cpu_line = ""
        core_count = 0

        for line in lines:
            if line.startswith("cpu "):
                cpu_line = line
            elif line.startswith("cpu") and line[3:].split()[0].isdigit():
                core_count += 1

        if not cpu_line:
            raise ValueError(f"Baris 'cpu ' tidak ditemukan di {self.stat_file}")

        parts = cpu_line.split()[1:]
        values = [int(p) for p in parts]
        idle = values[3] + (values[4] if len(values) > 4 else 0)
        total = sum(values)

        cores = core_count if core_count > 0 else (os.cpu_count() or 1)

        if self._prev_cpu_times is None:
            self._prev_cpu_times = (idle, total)
            # Pada pembacaan awal sebelum delta terbentuk, gunakan pendekatan loadavg
            try:
                load1, _, _ = os.getloadavg()
                est = min(100.0, max(0.0, (load1 / cores) * 100.0))
                return round(est, 2), cores
            except Exception:
                return 0.0, cores

        prev_idle, prev_total = self._prev_cpu_times
        self._prev_cpu_times = (idle, total)

        delta_total = total - prev_total
        delta_idle = idle - prev_idle

        if delta_total <= 0:
            return 0.0, cores

        usage_pct = (1.0 - (delta_idle / delta_total)) * 100.0
        clamped = max(0.0, min(100.0, usage_pct))
        return round(clamped, 2), cores

    def _read_memory(self) -> tuple[float, float, float, float]:
        """Menghitung (total_mb, used_mb, avail_mb, percent) dari /proc/meminfo."""
        if not self.meminfo_file.is_file():
            raise FileNotFoundError(f"File {self.meminfo_file} tidak ditemukan")

        lines = self.meminfo_file.read_text(encoding="utf-8").splitlines()
        mem_total_kb = 0
        mem_avail_kb = 0
        mem_free_kb = 0
        buffers_kb = 0
        cached_kb = 0

        for line in lines:
            parts = line.split(":")
            if len(parts) < 2:
                continue
            key = parts[0].strip()
            val_str = parts[1].strip().split()[0]
            val = int(val_str)

            if key == "MemTotal":
                mem_total_kb = val
            elif key == "MemAvailable":
                mem_avail_kb = val
            elif key == "MemFree":
                mem_free_kb = val
            elif key == "Buffers":
                buffers_kb = val
            elif key == "Cached":
                cached_kb = val

        # Fallback jika MemAvailable tidak ada (kernel Linux sangat lama)
        if mem_avail_kb == 0 and mem_total_kb > 0:
            mem_avail_kb = mem_free_kb + buffers_kb + cached_kb

        total_mb = round(mem_total_kb / 1024.0, 2)
        avail_mb = round(mem_avail_kb / 1024.0, 2)
        used_mb = round(max(0.0, total_mb - avail_mb), 2)
        percent = round((used_mb / total_mb * 100.0) if total_mb > 0 else 0.0, 2)

        return total_mb, used_mb, avail_mb, percent

    def _read_disk(self) -> tuple[float, float, float]:
        """Menghitung (total_gb, used_gb, percent) dari os.statvfs."""
        stat = os.statvfs(self.root_path)
        total_bytes = stat.f_blocks * stat.f_frsize
        used_bytes = max(0, total_bytes - (stat.f_bfree * stat.f_frsize))

        total_gb = round(total_bytes / (1024.0**3), 2)
        used_gb = round(used_bytes / (1024.0**3), 2)
        percent = round((used_bytes / total_bytes * 100.0) if total_bytes > 0 else 0.0, 2)

        return total_gb, used_gb, percent

    def _read_uptime(self) -> float:
        """Membaca uptime detik dari /proc/uptime."""
        if not self.uptime_file.is_file():
            return 0.0
        try:
            content = self.uptime_file.read_text(encoding="utf-8").strip()
            return round(float(content.split()[0]), 2)
        except Exception:
            return 0.0

    def _sync_read(self) -> HostVitals:
        """Pembacaan sinkron seluruh telemetri vitals host."""
        now_ts = int(time.time())
        issues: list[str] = []

        # 1. CPU
        try:
            cpu_pct, cores = self._read_cpu_delta()
        except Exception as exc:
            issues.append(f"CPU vitals: {exc}")
            cpu_pct, cores = 0.0, os.cpu_count() or 1

        # 2. RAM
        try:
            mem_total_mb, mem_used_mb, mem_avail_mb, mem_pct = self._read_memory()
        except Exception as exc:
            issues.append(f"RAM vitals: {exc}")
            mem_total_mb, mem_used_mb, mem_avail_mb, mem_pct = 16384.0, 0.0, 16384.0, 0.0

        # 3. Disk
        try:
            disk_total_gb, disk_used_gb, disk_pct = self._read_disk()
        except Exception as exc:
            issues.append(f"Disk vitals: {exc}")
            disk_total_gb, disk_used_gb, disk_pct = 100.0, 0.0, 0.0

        # 4. Load average & Uptime
        try:
            load_1m, load_5m, load_15m = os.getloadavg()
            load_1m = round(load_1m, 2)
            load_5m = round(load_5m, 2)
            load_15m = round(load_15m, 2)
        except Exception:
            load_1m, load_5m, load_15m = 0.0, 0.0, 0.0

        uptime_sec = self._read_uptime()

        # Status kesehatan berdasarkan ambang batas
        status: Literal["healthy", "warning", "critical"]
        if cpu_pct >= 90.0 or mem_pct >= 90.0 or disk_pct >= 90.0:
            status = "critical"
        elif cpu_pct >= 75.0 or mem_pct >= 80.0 or disk_pct >= 80.0:
            status = "warning"
        else:
            status = "healthy"

        details = HostVitalsDetails(
            cpu_cores=cores,
            load_1m=load_1m,
            load_5m=load_5m,
            load_15m=load_15m,
            memory_total_mb=mem_total_mb,
            memory_used_mb=mem_used_mb,
            memory_available_mb=mem_avail_mb,
            disk_total_gb=disk_total_gb,
            disk_used_gb=disk_used_gb,
            uptime_seconds=uptime_sec,
        )

        vitals = HostVitals(
            cpu_percent=cpu_pct,
            memory_percent=mem_pct,
            disk_percent=disk_pct,
            status=status,
            details=details,
        )

        self._last_vitals = vitals
        self._is_degraded = bool(issues)
        self._health = ReaderHealth(
            status="degraded" if self._is_degraded else "ok",
            last_poll=now_ts,
            error="; ".join(issues) if issues else None,
            details={
                "cpu_percent": cpu_pct,
                "memory_percent": mem_pct,
                "disk_percent": disk_pct,
                "status": status,
            },
        )
        return vitals

    async def read(self) -> HostVitals:
        """Asynchronous reader wrapper."""
        return await asyncio.to_thread(self._sync_read)
