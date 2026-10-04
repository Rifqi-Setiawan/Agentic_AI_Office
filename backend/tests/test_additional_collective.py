"""T2.6: real timers, Founder API and public/SSE contract."""

import asyncio
import time
from unittest.mock import Mock

import pytest
from fastapi.testclient import TestClient

from office.domain.collective import DEFAULT_COLLECTIVE_TTL, CollectiveManager
from office.domain.state import StateEngine
from office.main import app
from office.projection.public import project_collective_event_public
from tests.test_auth_collective import login_as_founder, setup_auth_environment  # noqa: F401

KINDS = ["pool_party", "fire_drill", "town_hall"]


@pytest.mark.parametrize("kind", KINDS)
def test_founder_api_security_and_defaults(kind: str) -> None:
    client = TestClient(app)
    assert client.post("/api/v1/collective", json={"kind": kind}).status_code == 403
    assert (
        client.post(
            "/api/v1/collective", headers={"X-Office-Intent": "1"}, json={"kind": kind}
        ).status_code
        == 401
    )
    cookies = login_as_founder(client)
    response = client.post(
        "/api/v1/collective", cookies=cookies, headers={"X-Office-Intent": "1"}, json={"kind": kind}
    )
    assert response.status_code == 200
    data = response.json()
    assert data["expires_at"] - data["started_at"] == DEFAULT_COLLECTIVE_TTL[kind]
    assert client.get("/api/v1/snapshot").json()["active_collective"]["kind"] == kind
    assert (
        client.post(
            "/api/v1/collective",
            cookies=cookies,
            headers={"X-Office-Intent": "1"},
            json={"kind": kind},
        ).status_code
        == 409
    )


@pytest.mark.asyncio
@pytest.mark.parametrize("kind", KINDS)
async def test_realtime_expiry_and_snapshot_race(kind: str) -> None:
    engine = StateEngine()
    broadcast = Mock()
    manager = CollectiveManager(engine, broadcast)
    event = await manager.start_event(kind, duration_seconds=1)
    public = project_collective_event_public(event)
    assert public is not None and public.kind == kind
    await asyncio.sleep(1.1)
    assert engine._active_collective is None
    broadcast.broadcast_collective.assert_called_with(None, 2)
    assert [e.kind for e in engine.ring_buffer.get_recent()] == [
        "collective_started",
        "collective_ended",
    ]
    event = await manager.start_event(kind, duration_seconds=1)
    engine.get_active_collective(event.expires_at)
    await asyncio.sleep(1.1)
    assert broadcast.broadcast_collective.call_args.args[0] is None
    assert len([e for e in engine.ring_buffer.get_recent() if e.kind == "collective_ended"]) == 2


@pytest.mark.asyncio
async def test_default_ttls_with_actual_elapsed_time(monkeypatch: pytest.MonkeyPatch) -> None:
    test_ttls = {k: 1 for k in KINDS}
    monkeypatch.setattr("office.domain.collective.DEFAULT_COLLECTIVE_TTL", test_ttls)
    async def observe(kind: str) -> None:
        engine = StateEngine()
        broadcast = Mock()
        manager = CollectiveManager(engine, broadcast)
        start = time.monotonic()
        event = await manager.start_event(kind)
        assert event.expires_at - event.started_at == test_ttls[kind]
        await asyncio.sleep(test_ttls[kind] - 0.5)
        assert engine._active_collective is not None
        await asyncio.sleep(0.8)
        elapsed = time.monotonic() - start
        assert elapsed >= test_ttls[kind]
        assert engine._active_collective is None
        assert broadcast.broadcast_collective.call_args.args[0] is None
        print(
            f"{kind}: real elapsed={elapsed:.3f}s, "
            f"default TTL={test_ttls[kind]}s, SSE ended"
        )

    await asyncio.gather(*(observe(kind) for kind in KINDS))
