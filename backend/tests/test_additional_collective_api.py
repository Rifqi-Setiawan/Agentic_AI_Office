"""Founder HTTP and actual SSE queue integration with supported one-second TTL."""

import asyncio
import json
import time

import httpx
import pytest

from office.main import app
from tests.test_auth_collective import TEST_FOUNDER_PASSWORD, setup_auth_environment  # noqa: F401


@pytest.mark.asyncio
@pytest.mark.parametrize("kind", ["pool_party", "fire_drill", "town_hall"])
async def test_http_founder_trigger_autoends_to_public_sse(kind: str) -> None:
    async with httpx.AsyncClient(
        transport=httpx.ASGITransport(app=app), base_url="http://testserver"
    ) as client:
        headers = {"X-Office-Intent": "1"}
        response = await client.post(
            "/api/v1/auth/login", headers=headers, json={"password": TEST_FOUNDER_PASSWORD}
        )
        assert response.status_code == 200
        queue = app.state.broadcaster.register_subscriber()
        try:
            start = time.monotonic()
            response = await client.post(
                "/api/v1/collective", headers=headers, json={"kind": kind, "duration_seconds": 1}
            )
            assert response.status_code == 200
            assert response.json()["kind"] == kind
            messages = [await asyncio.wait_for(queue.get(), 2) for _ in range(2)]
            collective_message = next(m for m in messages if "event: collective" in m)
            assert json.loads(collective_message.split("data: ", 1)[1].strip())["kind"] == kind
            assert any("collective_started" in message for message in messages)
            assert (await client.get("/api/v1/snapshot")).json()["active_collective"][
                "kind"
            ] == kind
            messages = [await asyncio.wait_for(queue.get(), 2) for _ in range(2)]
            elapsed = time.monotonic() - start
            assert elapsed >= 1
            assert any("event: collective" in message and "null" in message for message in messages)
            assert any("collective_ended" in message for message in messages)
            assert (await client.get("/api/v1/snapshot")).json()["active_collective"] is None
            print(f"{kind}: Founder HTTP -> public SSE -> auto end, actual elapsed {elapsed:.3f}s")
        finally:
            app.state.broadcaster.unregister_subscriber(queue)
