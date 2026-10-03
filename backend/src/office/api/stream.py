from __future__ import annotations

import asyncio
import logging
from typing import AsyncGenerator

from fastapi import APIRouter, Header, Query, Request
from fastapi.responses import JSONResponse, StreamingResponse

from office.config import OfficeConfig
from office.domain.state import StateEngine
from office.models.errors import ErrorResponse
from office.models.events import OfficeEvent
from office.models.host import HostVitals
from office.models.state import AgentState, CollectiveEventState
from office.projection import (
    PublicWorldSnapshot,
    project_agent_state_public,
    project_host_vitals_public,
    project_office_event_public,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1", tags=["SSE Streaming"])

# Konstanta batas koneksi sesuai Blueprint Dokumen 01 dan ADR-003
MAX_CONNECTIONS_PER_IP = 3
MAX_TOTAL_CONNECTIONS = 200
KEEP_ALIVE_INTERVAL_SECONDS = 15.0


def extract_client_ip(request: Request) -> str:
    """Mengekstrak alamat IP klien dengan mempertimbangkan header X-Forwarded-For."""
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        # Ambil IP pertama jika terdapat rantai proxy
        client_ip = forwarded.split(",")[0].strip()
        if client_ip:
            return client_ip

    if request.client and request.client.host:
        return request.client.host

    return "127.0.0.1"


class SSEBroadcaster:
    """Pengelola koneksi, batasan konkurensi (3 per IP, 200 total), dan siaran event SSE."""

    def __init__(
        self,
        max_per_ip: int = MAX_CONNECTIONS_PER_IP,
        max_total: int = MAX_TOTAL_CONNECTIONS,
    ) -> None:
        self.max_per_ip = max_per_ip
        self.max_total = max_total
        self._lock = asyncio.Lock()
        self._ip_counts: dict[str, int] = {}
        self._total_count = 0
        self._subscribers: set[asyncio.Queue[str]] = set()

    @property
    def total_connections(self) -> int:
        return self._total_count

    def get_ip_connections(self, ip: str) -> int:
        return self._ip_counts.get(ip, 0)

    async def acquire_connection(self, ip: str) -> tuple[bool, str, str]:
        """Mencoba memesan slot koneksi baru.

        Mengembalikan (allowed, error_code, error_message).
        """
        async with self._lock:
            if self._total_count >= self.max_total:
                return (
                    False,
                    "CONNECTION_LIMIT_EXCEEDED",
                    f"Batas total koneksi terlampaui (maksimal {self.max_total})",
                )

            current_ip_count = self._ip_counts.get(ip, 0)
            if current_ip_count >= self.max_per_ip:
                return (
                    False,
                    "RATE_LIMITED",
                    f"Batas koneksi per IP ({self.max_per_ip}) terlampaui untuk {ip}",
                )

            self._ip_counts[ip] = current_ip_count + 1
            self._total_count += 1
            return (True, "", "")

    async def release_connection(self, ip: str) -> None:
        """Membebaskan slot koneksi yang telah selesai."""
        async with self._lock:
            if ip in self._ip_counts:
                self._ip_counts[ip] -= 1
                if self._ip_counts[ip] <= 0:
                    del self._ip_counts[ip]
            self._total_count = max(0, self._total_count - 1)

    def register_subscriber(self) -> asyncio.Queue[str]:
        """Mendaftarkan subscriber baru dengan antrean asinkron."""
        queue: asyncio.Queue[str] = asyncio.Queue(maxsize=1000)
        self._subscribers.add(queue)
        return queue

    def unregister_subscriber(self, queue: asyncio.Queue[str]) -> None:
        """Menghapus subscriber dari daftar penyebaran."""
        self._subscribers.discard(queue)

    def broadcast_raw(self, message: str) -> None:
        """Mengirimkan raw message string SSE ke seluruh subscriber aktif."""
        for q in list(self._subscribers):
            try:
                q.put_nowait(message)
            except asyncio.QueueFull:
                # Jika queue penuh, lewati agar tidak memblokir loop
                pass

    def broadcast_event(self, event: OfficeEvent, config: OfficeConfig | None = None) -> None:
        """Menyiarkan OfficeEvent yang telah diproyeksikan untuk publik."""
        projected = project_office_event_public(event, config=config)
        msg = f"event: event\nid: {event.seq}\ndata: {projected.model_dump_json()}\n\n"
        self.broadcast_raw(msg)

    def broadcast_agent(
        self, agent: AgentState, seq: int, config: OfficeConfig | None = None
    ) -> None:
        """Menyiarkan AgentState delta yang telah diproyeksikan untuk publik."""
        projected = project_agent_state_public(agent, config=config)
        msg = f"event: agent\nid: {seq}\ndata: {projected.model_dump_json()}\n\n"
        self.broadcast_raw(msg)

    def broadcast_vitals(self, vitals: HostVitals) -> None:
        """Menyiarkan HostVitals yang telah diproyeksikan untuk publik."""
        projected = project_host_vitals_public(vitals)
        msg = f"event: vitals\ndata: {projected.model_dump_json()}\n\n"
        self.broadcast_raw(msg)

    def broadcast_collective(self, collective: CollectiveEventState | None, seq: int) -> None:
        """Menyiarkan perubahan status event kolektif."""
        data_str = collective.model_dump_json() if collective is not None else "null"
        msg = f"event: collective\nid: {seq}\ndata: {data_str}\n\n"
        self.broadcast_raw(msg)

    def broadcast_snapshot(self, snapshot: PublicWorldSnapshot) -> None:
        """Menyiarkan WorldSnapshot lengkap."""
        msg = f"event: snapshot\nid: {snapshot.seq}\ndata: {snapshot.model_dump_json()}\n\n"
        self.broadcast_raw(msg)


def get_broadcaster(request: Request) -> SSEBroadcaster:
    """Mengambil instance SSEBroadcaster dari app.state."""
    broadcaster = getattr(request.app.state, "broadcaster", None)
    if broadcaster is None:
        broadcaster = SSEBroadcaster()
        request.app.state.broadcaster = broadcaster
    return broadcaster


def get_state_engine(request: Request) -> StateEngine:
    """Mengambil instance StateEngine dari app.state."""
    engine = getattr(request.app.state, "engine", None)
    if engine is None:
        engine = StateEngine()
        request.app.state.engine = engine
    return engine


@router.get(
    "/stream",
    summary="Stream Server-Sent Events (SSE) real-time",
    response_model=None,
    responses={
        200: {
            "description": "Stream event SSE aktif.",
            "headers": {
                "Content-Type": {"schema": {"type": "string", "example": "text/event-stream"}},
                "Cache-Control": {"schema": {"type": "string", "example": "no-cache"}},
                "Connection": {"schema": {"type": "string", "example": "keep-alive"}},
                "X-Accel-Buffering": {"schema": {"type": "string", "example": "no"}},
            },
        },
        400: {
            "model": ErrorResponse,
            "description": "Format header Last-Event-ID tidak valid.",
        },
        429: {
            "model": ErrorResponse,
            "description": "Batas koneksi per IP (3) atau total (200) terlampaui.",
        },
    },
)
async def stream_events(
    request: Request,
    last_event_id: str | None = Header(default=None, alias="Last-Event-ID"),
    query_last_event_id: str | None = Query(default=None, alias="last_event_id"),
) -> StreamingResponse | JSONResponse:
    broadcaster = get_broadcaster(request)
    engine = get_state_engine(request)
    cfg = getattr(request.app.state, "config", None)
    client_ip = extract_client_ip(request)

    # 1. Penegakan batas koneksi (3 per IP, 200 total)
    allowed, err_code, err_msg = await broadcaster.acquire_connection(client_ip)
    if not allowed:
        return JSONResponse(
            status_code=429,
            content={"error": err_msg, "code": err_code},
        )

    # 2. Validasi Last-Event-ID (dari header atau query param browser)
    effective_last_id = last_event_id if last_event_id is not None else query_last_event_id
    parsed_seq: int | None = None

    if effective_last_id is not None and effective_last_id.strip() != "":
        try:
            parsed_seq = int(effective_last_id.strip())
            if parsed_seq < 0:
                raise ValueError("seq must be non-negative")
        except ValueError:
            await broadcaster.release_connection(client_ip)
            return JSONResponse(
                status_code=400,
                content={
                    "error": "Format header Last-Event-ID tidak valid",
                    "code": "INVALID_LAST_EVENT_ID",
                },
            )

    # 3. Generator asinkron SSE
    async def sse_event_generator() -> AsyncGenerator[str, None]:
        queue = broadcaster.register_subscriber()
        try:
            # Skenario A: Ada Last-Event-ID yang valid -> periksa ring buffer
            if parsed_seq is not None:
                can_resume, delta_events = engine.ring_buffer.get_since(parsed_seq)
                if can_resume:
                    # Kirim seluruh delta event yang tertinggal
                    for ev in delta_events:
                        proj_ev = project_office_event_public(ev, config=cfg)
                        yield f"event: event\nid: {ev.seq}\ndata: {proj_ev.model_dump_json()}\n\n"
                else:
                    # Gap terputus: kirim snapshot utuh untuk sinkronisasi ulang
                    snapshot = engine.get_snapshot(projection="public", config=cfg)
                    snap_data = snapshot.model_dump_json()
                    yield f"event: snapshot\nid: {snapshot.seq}\ndata: {snap_data}\n\n"
            else:
                # Skenario B: Koneksi baru -> kirim snapshot utuh
                snapshot = engine.get_snapshot(projection="public", config=cfg)
                snap_data = snapshot.model_dump_json()
                yield f"event: snapshot\nid: {snapshot.seq}\ndata: {snap_data}\n\n"

            # Skenario Live Stream: dengarkan antrean dan kirim keep-alive ping setiap 15 detik
            while True:
                if await request.is_disconnected():
                    break

                try:
                    msg = await asyncio.wait_for(queue.get(), timeout=KEEP_ALIVE_INTERVAL_SECONDS)
                    yield msg
                except asyncio.TimeoutError:
                    # Komentar keep-alive sesuai spesifikasi (: ping\n\n)
                    yield ": ping\n\n"

        except (asyncio.CancelledError, GeneratorExit):
            # Klien terputus
            pass
        finally:
            broadcaster.unregister_subscriber(queue)
            await broadcaster.release_connection(client_ip)

    response_headers = {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
        "X-Accel-Buffering": "no",
    }

    return StreamingResponse(
        sse_event_generator(),
        media_type="text/event-stream",
        headers=response_headers,
    )
