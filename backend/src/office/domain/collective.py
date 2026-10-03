from __future__ import annotations

import asyncio
import logging
import time
from typing import Any, Literal

from office.config import OfficeConfig
from office.domain.state import StateEngine
from office.models.events import OfficeEvent
from office.models.state import CollectiveEventState

logger = logging.getLogger(__name__)

# TTL default kegiatan kolektif sesuai Dokumen 01 dan Dokumen 06:
# - rapat: 10 menit (600 detik)
# - break: 10 menit (600 detik)
# - sholat: 5 menit (300 detik)
DEFAULT_COLLECTIVE_TTL: dict[str, int] = {
    "rapat": 10 * 60,
    "break": 10 * 60,
    "sholat": 5 * 60,
}

DEFAULT_COLLECTIVE_TITLES: dict[str, str] = {
    "rapat": "Rapat Mendadak",
    "break": "Break Time",
    "sholat": "Sholat Berjamaah",
}


class CollectiveError(Exception):
    """Base class untuk kesalahan pada domain event kolektif."""


class CollectiveActiveConflictError(CollectiveError):
    """Terjadi ketika memicu event kolektif baru saat event lain masih berlangsung."""


class InvalidCollectiveKindError(CollectiveError):
    """Terjadi ketika jenis kegiatan kolektif tidak dikenal."""


class CollectiveManager:
    """Pengelola siklus hidup event kolektif manual kantor (rapat, break, sholat).

    Menyimpan state di memori state engine dengan TTL otomatis, memancarkan event ke linimasa,
    dan menyiarkan status via Server-Sent Events (SSE) ke seluruh penonton (viewer).
    """

    def __init__(
        self,
        engine: StateEngine,
        broadcaster: Any | None = None,
        config: OfficeConfig | None = None,
    ) -> None:
        self.engine = engine
        self.broadcaster = broadcaster
        self.config = config
        self._timer_task: asyncio.Task[None] | None = None

    def get_active(self, current_time: int | None = None) -> CollectiveEventState | None:
        """Mengambil event kolektif yang sedang aktif saat ini."""
        return self.engine.get_active_collective(current_time=current_time)

    async def start_event(
        self,
        kind: Literal["rapat", "break", "sholat"] | str,
        duration_seconds: int | None = None,
        title: str | None = None,
        participants: list[str] | None = None,
        current_time: int | None = None,
    ) -> CollectiveEventState:
        """Memulai event kolektif baru dan menyiarkannya."""
        if kind not in DEFAULT_COLLECTIVE_TTL:
            valid_kinds = list(DEFAULT_COLLECTIVE_TTL.keys())
            raise InvalidCollectiveKindError(
                f"Jenis event kolektif '{kind}' tidak didukung. Pilihan yang valid: {valid_kinds}"
            )

        now_ts = int(time.time()) if current_time is None else current_time

        # Periksa apakah ada event yang sedang aktif
        existing = self.get_active(current_time=now_ts)
        if existing is not None:
            raise CollectiveActiveConflictError("Event kolektif lain masih berlangsung aktif")

        # Tentukan durasi TTL
        ttl = (
            int(duration_seconds)
            if duration_seconds is not None and duration_seconds > 0
            else DEFAULT_COLLECTIVE_TTL[kind]
        )

        # Tentukan judul event
        event_title = (
            title.strip()
            if title is not None and title.strip()
            else DEFAULT_COLLECTIVE_TITLES[kind]
        )

        # Tentukan daftar partisipan
        if participants is not None and len(participants) > 0:
            part_list = [str(p).strip().lower() for p in participants if str(p).strip()]
        else:
            # Sesuai OpenAPI: jika kosong, mengikutsertakan seluruh agen on-duty yang sedang idle
            part_list = [
                aid
                for aid, a in sorted(self.engine.agents.items())
                if a.presence == "on_duty" and a.work == "idle"
            ]

        coll_id = f"coll_{now_ts}_{kind}"
        collective = CollectiveEventState(
            id=coll_id,
            kind=kind,  # type: ignore[arg-type]
            title=event_title,
            started_at=now_ts,
            expires_at=now_ts + ttl,
            participants=part_list,
            active=True,
        )

        # Pasang di StateEngine
        self.engine.set_active_collective(collective)

        # Buat OfficeEvent linimasa
        seq = self.engine.ring_buffer.next_seq()
        start_ev = OfficeEvent(
            seq=seq,
            ts=now_ts,
            board="office-v2",
            kind="collective_started",
            agent=None,
            actor="founder",
            message=f"Acara kolektif {event_title} dimulai",
            task=None,
        )
        self.engine.ring_buffer.append(start_ev)

        # Siarkan ke semua viewer via SSE jika broadcaster tersedia
        if self.broadcaster is not None:
            try:
                self.broadcaster.broadcast_collective(collective, seq)
                self.broadcaster.broadcast_event(start_ev, config=self.config)
            except Exception as exc:
                logger.warning("Gagal menyiarkan collective_started via SSE: %s", exc)

        # Jadwalkan timer otomatis pengakhiran event
        self.schedule_expiry_timer(coll_id, float(ttl))

        return collective

    async def end_event(
        self,
        event_id: str | None = None,
        current_time: int | None = None,
    ) -> CollectiveEventState | None:
        """Mengakhiri event kolektif yang sedang aktif dan menyiarkan pembaruan."""
        current_coll = self.engine._active_collective
        if current_coll is None:
            return None

        if event_id is not None and current_coll.id != event_id:
            return None

        now_ts = int(time.time()) if current_time is None else current_time
        self.cancel_expiry_timer()
        self.engine.set_active_collective(None)

        seq = self.engine.ring_buffer.next_seq()
        end_ev = OfficeEvent(
            seq=seq,
            ts=now_ts,
            board="office-v2",
            kind="collective_ended",
            agent=None,
            actor="founder",
            message=f"Acara kolektif {current_coll.title} selesai",
            task=None,
        )
        self.engine.ring_buffer.append(end_ev)

        if self.broadcaster is not None:
            try:
                self.broadcaster.broadcast_collective(None, seq)
                self.broadcaster.broadcast_event(end_ev, config=self.config)
            except Exception as exc:
                logger.warning("Gagal menyiarkan collective_ended via SSE: %s", exc)

        return current_coll

    def schedule_expiry_timer(self, event_id: str, delay_seconds: float) -> None:
        """Menjadwalkan background task untuk mengakhiri event setelah TTL berakhir."""
        self.cancel_expiry_timer()
        try:
            loop = asyncio.get_running_loop()
            self._timer_task = loop.create_task(self._expiry_worker(event_id, delay_seconds))
        except RuntimeError:
            # Tidak berada di running loop (misal pemanggilan sinkron/test tanpa event loop aktif)
            pass

    def cancel_expiry_timer(self) -> None:
        """Membatalkan background timer aktif."""
        if self._timer_task and not self._timer_task.done():
            self._timer_task.cancel()
        self._timer_task = None

    async def _expiry_worker(self, event_id: str, delay_seconds: float) -> None:
        """Worker asinkron penunggu waktu kedaluwarsa TTL."""
        try:
            await asyncio.sleep(delay_seconds)
            await self.end_event(event_id=event_id)
        except asyncio.CancelledError:
            pass
        except Exception as exc:
            logger.error("Error pada auto-expire worker event kolektif: %s", exc)
