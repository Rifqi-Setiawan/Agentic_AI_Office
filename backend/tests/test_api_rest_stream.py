from __future__ import annotations

import asyncio
import socket
import threading
import time
from typing import Generator

import httpx
import pytest
import uvicorn
from fastapi.testclient import TestClient

from office.main import app
from office.models.events import OfficeEvent


@pytest.fixture
def client() -> TestClient:
    return TestClient(app)


@pytest.fixture(scope="module")
def live_server() -> Generator[str, None, None]:
    """Menjalankan loopback server Uvicorn pada socket lokal sementara."""
    sock = socket.socket()
    sock.bind(("127.0.0.1", 0))
    port = sock.getsockname()[1]
    config = uvicorn.Config(
        app,
        log_level="error",
        access_log=False,
        lifespan="off",
        ws="none",
    )
    server = uvicorn.Server(config)
    thread = threading.Thread(target=server.run, kwargs={"sockets": [sock]}, daemon=True)
    thread.start()
    base_url = f"http://127.0.0.1:{port}"

    deadline = time.monotonic() + 5
    while not server.started and thread.is_alive() and time.monotonic() < deadline:
        time.sleep(0.01)

    assert server.started, "Loopback test server gagal dijalankan"
    yield base_url

    server.should_exit = True
    thread.join(timeout=3)
    sock.close()


class TestApiSnapshot:
    """Pengujian endpoint REST GET /api/v1/snapshot."""

    def test_get_snapshot_public_default(self, client: TestClient) -> None:
        """GET /api/v1/snapshot mengembalikan 200 dengan WorldSnapshot publik."""
        response = client.get("/api/v1/snapshot")
        assert response.status_code == 200
        data = response.json()
        assert data["projection"] == "public"
        assert "generated_at" in data
        assert "time_of_day" in data
        assert "agents" in data
        assert len(data["agents"]) >= 16
        assert "vitals" in data

    def test_get_snapshot_founder_unauthorized(self, client: TestClient) -> None:
        """GET /api/v1/snapshot?projection=founder tanpa cookie sesi mengembalikan 401."""
        response = client.get("/api/v1/snapshot?projection=founder")
        assert response.status_code == 401
        data = response.json()
        assert data["code"] == "UNAUTHORIZED"
        assert "error" in data


class TestApiAgentsDetail:
    """Pengujian endpoint REST GET /api/v1/agents/{id}."""

    def test_get_agent_detail_found(self, client: TestClient) -> None:
        """GET /api/v1/agents/forge mengembalikan 200 dengan detail profil agen."""
        response = client.get("/api/v1/agents/forge")
        assert response.status_code == 200
        data = response.json()
        assert "agent" in data
        assert data["agent"]["id"] == "forge"
        assert "bio" in data
        assert data["bio"]["id"] == "forge"
        assert "recent_tasks" in data
        assert isinstance(data["recent_tasks"], list)

    def test_get_agent_detail_case_insensitive(self, client: TestClient) -> None:
        """Identifier agen tidak peka huruf besar/kecil."""
        response = client.get("/api/v1/agents/JARVIS")
        assert response.status_code == 200
        data = response.json()
        assert data["agent"]["id"] == "jarvis"

    def test_get_agent_detail_not_found(self, client: TestClient) -> None:
        """GET /api/v1/agents/unknown_agent mengembalikan 404 AGENT_NOT_FOUND."""
        response = client.get("/api/v1/agents/unknown_agent_xyz")
        assert response.status_code == 404
        data = response.json()
        assert data["code"] == "AGENT_NOT_FOUND"
        assert "error" in data


class TestApiHealthz:
    """Pengujian endpoint REST GET /api/v1/healthz."""

    def test_get_api_healthz_comprehensive(self, client: TestClient) -> None:
        """GET /api/v1/healthz mengembalikan HealthResponse lengkap sesuai OpenAPI v1."""
        response = client.get("/api/v1/healthz")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] in ("ok", "degraded", "error")
        assert "timestamp" in data
        assert "uptime_seconds" in data
        assert "memory_rss_mb" in data
        assert data["version"] == "2.0.0"
        assert "readers" in data
        assert "kanban" in data["readers"]
        assert "gateway" in data["readers"]
        assert "profiles" in data["readers"]
        assert "host" in data["readers"]


class TestApiStreamSSE:
    """Pengujian endpoint SSE GET /api/v1/stream dan kriteria penerimaan T1.4."""

    @pytest.mark.asyncio
    async def test_stream_headers_and_initial_snapshot(self, live_server: str) -> None:
        """Koneksi baru menerima header no-cache, no-buffering, dan event snapshot pertama kali."""
        async with httpx.AsyncClient(base_url=live_server) as client:
            async with client.stream("GET", "/api/v1/stream") as response:
                assert response.status_code == 200
                assert "text/event-stream" in response.headers.get("content-type", "")
                assert response.headers.get("cache-control") == "no-cache"
                assert response.headers.get("x-accel-buffering") == "no"

                # Baca chunk pertama yang berisi event snapshot
                lines: list[str] = []
                async for line in response.aiter_lines():
                    lines.append(line)
                    if line == "":  # Batas akhir satu event SSE (\n\n)
                        break

                event_text = "\n".join(lines)
                assert "event: snapshot" in event_text
                assert "data: {" in event_text

    @pytest.mark.asyncio
    async def test_connection_limit_4th_rejected_with_429(self, live_server: str) -> None:
        """Kriteria Penerimaan 3: Koneksi ke-4 dari IP yang sama ditolak 429."""
        client_ip = "192.168.1.100"
        headers = {"x-forwarded-for": client_ip}

        client1 = httpx.AsyncClient(base_url=live_server)
        client2 = httpx.AsyncClient(base_url=live_server)
        client3 = httpx.AsyncClient(base_url=live_server)
        client4 = httpx.AsyncClient(base_url=live_server)

        try:
            # Buka 3 koneksi bersamaan dari IP yang sama
            resp1 = await client1.send(
                client1.build_request("GET", "/api/v1/stream", headers=headers), stream=True
            )
            assert resp1.status_code == 200

            resp2 = await client2.send(
                client2.build_request("GET", "/api/v1/stream", headers=headers), stream=True
            )
            assert resp2.status_code == 200

            resp3 = await client3.send(
                client3.build_request("GET", "/api/v1/stream", headers=headers), stream=True
            )
            assert resp3.status_code == 200

            # Koneksi ke-4 dari IP yang sama harus ditolak 429
            resp4 = await client4.get("/api/v1/stream", headers=headers)
            assert resp4.status_code == 429
            err_data = resp4.json()
            assert err_data["code"] in ("RATE_LIMITED", "CONNECTION_LIMIT_EXCEEDED")

            # Tutup koneksi pertama, verifikasi slot dibebaskan
            await resp1.aclose()
            # Polling sampai slot IP dibebaskan
            broadcaster = app.state.broadcaster
            for _ in range(20):
                if broadcaster.get_ip_connections(client_ip) < 3:
                    break
                await asyncio.sleep(0.05)

            # Sekarang koneksi baru dari IP tersebut berhasil
            resp5 = await client4.send(
                client4.build_request("GET", "/api/v1/stream", headers=headers), stream=True
            )
            assert resp5.status_code == 200
            await resp5.aclose()

            await resp2.aclose()
            await resp3.aclose()
        finally:
            await client1.aclose()
            await client2.aclose()
            await client3.aclose()
            await client4.aclose()

    @pytest.mark.asyncio
    async def test_invalid_last_event_id_returns_400(self, live_server: str) -> None:
        """Header Last-Event-ID non-numerik mengembalikan 400 sesuai spesifikasi."""
        async with httpx.AsyncClient(base_url=live_server) as client:
            resp = await client.get("/api/v1/stream", headers={"last-event-id": "invalid-seq-xyz"})
            assert resp.status_code == 400
            data = resp.json()
            assert data["code"] == "INVALID_LAST_EVENT_ID"

    @pytest.mark.asyncio
    async def test_reconnect_last_event_id_no_loss_no_duplicate(self, live_server: str) -> None:
        """Kriteria Penerimaan 2: Reconnect Last-Event-ID tidak kehilangan/duplikasi event."""
        engine = app.state.engine
        start_seq = engine.ring_buffer.current_seq
        ev1 = OfficeEvent(
            seq=start_seq,
            ts=1791000010,
            board="office-v2",
            kind="task_started",
            agent="forge",
            actor="forge",
            message="Forge mulai bekerja",
        )
        ev2 = OfficeEvent(
            seq=start_seq + 1,
            ts=1791000011,
            board="office-v2",
            kind="task_created",
            agent="prism",
            actor="jarvis",
            message="Task baru untuk Prism",
        )
        ev3 = OfficeEvent(
            seq=start_seq + 2,
            ts=1791000012,
            board="office-v2",
            kind="task_done",
            agent="forge",
            actor="forge",
            message="Task selesai oleh Forge",
        )
        engine.ring_buffer.append(ev1)
        engine.ring_buffer.append(ev2)
        engine.ring_buffer.append(ev3)

        # Klien reconnect dengan Last-Event-ID menunjuk ev1.seq
        async with httpx.AsyncClient(base_url=live_server) as client:
            headers = {"last-event-id": str(ev1.seq), "x-forwarded-for": "10.10.10.1"}
            async with client.stream("GET", "/api/v1/stream", headers=headers) as resp:
                assert resp.status_code == 200

                received_ids: list[str] = []
                received_events: list[str] = []

                current_id: str | None = None
                current_event: str | None = None

                async for line in resp.aiter_lines():
                    if line.startswith("id:"):
                        current_id = line.split(":", 1)[1].strip()
                    elif line.startswith("event:"):
                        current_event = line.split(":", 1)[1].strip()
                    elif line == "":
                        if current_id is not None:
                            received_ids.append(current_id)
                        if current_event is not None:
                            received_events.append(current_event)
                        current_id = None
                        current_event = None
                        # Sudah menerima ev2 dan ev3
                        if len(received_ids) >= 2:
                            break

                # Verifikasi: tidak ada ev1 (tidak menggandakan), ada ev2 dan ev3 (tidak kehilangan)
                assert str(ev1.seq) not in received_ids
                assert str(ev2.seq) in received_ids
                assert str(ev3.seq) in received_ids
                assert "snapshot" not in received_events

    @pytest.mark.asyncio
    async def test_reconnect_last_event_id_gap_falls_back_to_snapshot(
        self, live_server: str
    ) -> None:
        """Jika Last-Event-ID di luar buffer (gap terputus), kirim full snapshot."""
        engine = app.state.engine
        engine.ring_buffer._buffer.clear()
        # Masukkan event dengan sequence tinggi sehingga seq rendah berada di luar buffer
        for i in range(100, 105):
            engine.ring_buffer.append(
                OfficeEvent(
                    seq=i,
                    ts=1791000000 + i,
                    board="office-v2",
                    kind="task_started",
                    agent="forge",
                    actor="forge",
                    message="Event pengisi buffer",
                )
            )

        gap_seq = 10  # Jauh di bawah sequence tertua (100)
        async with httpx.AsyncClient(base_url=live_server) as client:
            headers = {"last-event-id": str(gap_seq), "x-forwarded-for": "10.10.10.2"}
            async with client.stream("GET", "/api/v1/stream", headers=headers) as resp:
                assert resp.status_code == 200

                first_event = ""
                async for line in resp.aiter_lines():
                    if line.startswith("event:"):
                        first_event = line.split(":", 1)[1].strip()
                    elif line == "" and first_event:
                        break

                assert first_event == "snapshot"

    @pytest.mark.asyncio
    async def test_lag_event_fixture_to_client_under_2_seconds(self, live_server: str) -> None:
        """Kriteria Penerimaan 1: Lag event fixture -> klien test <= 2 dtk."""
        async with httpx.AsyncClient(base_url=live_server) as client:
            headers = {"x-forwarded-for": "10.10.10.3"}
            async with client.stream("GET", "/api/v1/stream", headers=headers) as resp:
                assert resp.status_code == 200

                lines_iter = resp.aiter_lines()
                # Buang event snapshot pertama
                async for line in lines_iter:
                    if line == "":
                        break

                broadcaster = app.state.broadcaster
                engine = app.state.engine
                seq_val = engine.ring_buffer.next_seq()

                live_event = OfficeEvent(
                    seq=seq_val,
                    ts=int(time.time()),
                    board="office-v2",
                    kind="task_started",
                    agent="sentinel",
                    actor="jarvis",
                    message="Sentinel mulai memeriksa QA",
                )

                t_start = time.perf_counter()
                engine.ring_buffer.append(live_event)
                broadcaster.broadcast_event(live_event)

                received_event_data = None
                async for line in lines_iter:
                    if line.startswith("data:"):
                        received_event_data = line
                        break

                t_elapsed = time.perf_counter() - t_start

                assert received_event_data is not None
                assert "sentinel" in received_event_data
                # Kriteria Penerimaan: lag <= 2 detik
                assert t_elapsed <= 2.0

    @pytest.mark.asyncio
    async def test_total_connection_limit_exceeded(self, live_server: str) -> None:
        """Batas total koneksi 200 diuji dengan menurunkan sementara max_total."""
        broadcaster = app.state.broadcaster
        original_max_total = broadcaster.max_total
        broadcaster.max_total = 2

        client1 = httpx.AsyncClient(base_url=live_server)
        client2 = httpx.AsyncClient(base_url=live_server)
        client3 = httpx.AsyncClient(base_url=live_server)

        try:
            resp1 = await client1.send(
                client1.build_request(
                    "GET", "/api/v1/stream", headers={"x-forwarded-for": "10.0.0.1"}
                ),
                stream=True,
            )
            assert resp1.status_code == 200

            resp2 = await client2.send(
                client2.build_request(
                    "GET", "/api/v1/stream", headers={"x-forwarded-for": "10.0.0.2"}
                ),
                stream=True,
            )
            assert resp2.status_code == 200

            # Koneksi ke-3 dari IP berbeda melebihi total connection limit 2
            resp3 = await client3.get(
                "/api/v1/stream",
                headers={"x-forwarded-for": "10.0.0.3"},
            )
            assert resp3.status_code == 429
            data = resp3.json()
            assert data["code"] == "CONNECTION_LIMIT_EXCEEDED"

            await resp1.aclose()
            await resp2.aclose()
        finally:
            broadcaster.max_total = original_max_total
            await client1.aclose()
            await client2.aclose()
            await client3.aclose()
