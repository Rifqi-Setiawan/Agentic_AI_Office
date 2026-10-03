from __future__ import annotations

import asyncio
import json
import logging
import time
from pathlib import Path
from typing import Any

from office.models.health import ReaderHealth

logger = logging.getLogger(__name__)


class GatewayReader:
    """Reader status gateway Hermes (/srv/apps/hermes/gateway_state.json).

    Mematuhi spec bagian 1:
    - Interval polling 2 dtk
    - Cek mtime dulu, parse hanya kalau berubah
    - Masuk mode degradasi jika berkas hilang atau format rusak
    """

    def __init__(
        self,
        gateway_state_path: Path | str = "/srv/apps/hermes/gateway_state.json",
    ) -> None:
        self.gateway_state_path = Path(gateway_state_path)
        self._last_mtime: float | None = None
        self._cached_data: dict[str, Any] = {}
        self._health = ReaderHealth(status="ok", last_poll=0)
        self._is_degraded = False

    @property
    def health(self) -> ReaderHealth:
        return self._health

    @property
    def is_degraded(self) -> bool:
        return self._is_degraded

    @property
    def last_mtime(self) -> float | None:
        return self._last_mtime

    def _sync_read(self) -> dict[str, Any]:
        """Pemeriksaan mtime dan parsing berkas gateway_state.json jika ada mutasi."""
        now_ts = int(time.time())

        if not self.gateway_state_path.is_file():
            self._is_degraded = True
            err_msg = f"Berkas gateway state tidak ditemukan: {self.gateway_state_path}"
            self._health = ReaderHealth(
                status="degraded",
                last_poll=now_ts,
                error=err_msg,
                details={"path": str(self.gateway_state_path)},
            )
            return self._cached_data

        try:
            current_mtime = self.gateway_state_path.stat().st_mtime
            if self._last_mtime is not None and current_mtime == self._last_mtime:
                # File belum termutasi, kembalikan salinan cache tanpa re-parse
                self._health.last_poll = now_ts
                return self._cached_data

            # mtime berbeda atau initial read, baca dan parse
            content = self.gateway_state_path.read_text(encoding="utf-8")
            data = json.loads(content)
            if not isinstance(data, dict):
                raise ValueError("Format JSON gateway_state bukan dictionary")

            self._last_mtime = current_mtime
            self._cached_data = data
            self._is_degraded = False
            self._health = ReaderHealth(
                status="ok",
                last_poll=now_ts,
                error=None,
                details={
                    "pid": data.get("pid"),
                    "gateway_state": data.get("gateway_state"),
                    "active_agents": data.get("active_agents"),
                    "updated_at": data.get("updated_at"),
                },
            )
            return self._cached_data

        except Exception as exc:
            logger.warning("Gagal membaca atau mem-parse gateway_state.json: %s", exc)
            self._is_degraded = True
            self._health = ReaderHealth(
                status="degraded",
                last_poll=now_ts,
                error=str(exc),
                details={"path": str(self.gateway_state_path)},
            )
            return self._cached_data

    async def read(self) -> dict[str, Any]:
        """Asynchronous reader wrapper."""
        return await asyncio.to_thread(self._sync_read)
