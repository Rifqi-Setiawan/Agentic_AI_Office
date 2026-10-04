from __future__ import annotations

import asyncio
import json
import shutil
import sqlite3
import time
from collections.abc import AsyncGenerator
from pathlib import Path
from typing import Any, cast

import httpx
import pytest
from fastapi import FastAPI
from fastapi.responses import StreamingResponse
from starlette.requests import Request

from office.api.rest import router as rest_router
from office.api.stream import SSEBroadcaster, stream_events
from office.config import OfficeConfig
from office.domain.state import StateEngine
from office.domain.telemetry import TelemetryCoordinator
from office.main import lifespan
from office.sources.gateway import GatewayReader
from office.sources.host import HostReader
from office.sources.kanban import KanbanReader
from office.sources.profiles import ProfilesReader

CANARY = "LEAK-CANARY-private-path-secret"


def private_app(tmp_path: Path) -> tuple[FastAPI, Path]:
    db = tmp_path / "kanban.db"
    shutil.copy2(Path(__file__).parent / "fixtures/kanban_fixture.db", db)
    with sqlite3.connect(db) as conn:
        conn.execute("DELETE FROM task_events")
        conn.execute("DELETE FROM task_runs")
        conn.execute("DELETE FROM tasks")
        conn.execute("ALTER TABLE tasks DROP COLUMN branch_name")
        now = int(time.time())
        conn.execute(
            """INSERT INTO tasks (id,title,body,assignee,status,priority,created_at,
                started_at,last_heartbeat_at,current_run_id)
                VALUES ('private-task',?,?,'jarvis','running',1,?,?,?,42)""",
            (CANARY, CANARY, now, now, now),
        )
        # Inspect authentic fixture fields; insert only required run fields.
        cols = {row[1] for row in conn.execute("PRAGMA table_info(task_runs)")}
        fields = {
            "id": 42,
            "task_id": "private-task",
            "profile": "forge",
            "status": "running",
            "started_at": now,
            "claim_lock": "fixture",
        }
        fields = {k: v for k, v in fields.items() if k in cols}
        conn.execute(
            f"INSERT INTO task_runs ({','.join(fields)}) VALUES ({','.join('?' for _ in fields)})",
            tuple(fields.values()),
        )
    gateway = tmp_path / "gateway.json"
    gateway.write_text(
        json.dumps({"gateway_state": "running", "served_profiles": [], "private": CANARY})
    )
    profiles = tmp_path / "profiles"
    profiles.mkdir()
    registry = tmp_path / "agents.yaml"
    registry.write_text("agents:\n  - name: forge\n    status: configured\n")
    app = FastAPI(lifespan=lifespan)
    app.state.engine = StateEngine()
    app.state.broadcaster = SSEBroadcaster()
    app.state.config = OfficeConfig(public_boards=[])
    app.include_router(rest_router)
    app.state.telemetry = TelemetryCoordinator(
        app,
        kanban=KanbanReader(db, None),
        gateway=GatewayReader(gateway),
        profiles=ProfilesReader(profiles, registry),
        host=HostReader(),
    )
    return app, db


async def next_kind(iterator: AsyncGenerator[str, None], kind: str) -> str:
    async def find() -> str:
        async for message in iterator:
            assert CANARY not in message
            if message.startswith(f"event: {kind}\n"):
                return message
        raise AssertionError("Stream ended before required SSE frame")

    return await asyncio.wait_for(find(), timeout=2.0)


async def open_stream(app: FastAPI) -> AsyncGenerator[str, None]:
    async def receive() -> dict[str, Any]:
        return {"type": "http.request", "body": b""}

    req = Request(
        {"type": "http", "app": app, "headers": [], "client": ("127.0.0.1", 1)}, receive=receive
    )
    response = await stream_events(req, last_event_id=None, query_last_event_id=None)
    assert isinstance(response, StreamingResponse)
    iterator = cast(AsyncGenerator[str, None], response.body_iterator)
    await next_kind(iterator, "snapshot")
    return iterator


@pytest.mark.asyncio
async def test_lifespan_real_sqlite_sse_latency_and_heartbeat(tmp_path: Path) -> None:
    app, db = private_app(tmp_path)
    coordinator = app.state.telemetry
    async with app.router.lifespan_context(app):
        assert len(coordinator.tasks) == 4
        assert app.state.engine.get_agent("forge").work == "working"
        assert app.state.engine.get_agent("jarvis").work == "idle"
        assert all(h.last_poll > 0 and h.status == "ok" for h in app.state.readers.values())
        assert all(
            c.execute("PRAGMA query_only").fetchone()[0] == 1
            for c in coordinator.kanban._connections.values()
        )
        with pytest.raises(RuntimeError):
            await coordinator.start()
        stream = await open_stream(app)
        start = time.monotonic()
        with sqlite3.connect(db) as conn:
            conn.execute("UPDATE tasks SET status='blocked', block_kind='needs_input'")
            conn.execute(
                """INSERT INTO task_events (task_id,run_id,kind,payload,created_at)
                    VALUES ('private-task',42,'task_blocked',?,?)""",
                (json.dumps({"assignee": "jarvis", "reason": CANARY}), int(time.time())),
            )
        message = await next_kind(stream, "event")
        event = json.loads(message.split("data: ")[1])
        assert event["agent"] == "forge"
        assert event["kind"] == "task_blocked"
        delta = await next_kind(stream, "agent")
        assert json.loads(delta.split("data: ")[1])["work"] == "blocked"
        elapsed = time.monotonic() - start
        print(f"SQLite commit -> public SSE event + agent elapsed_seconds={elapsed:.6f}")
        assert elapsed <= 2.0
        seq = app.state.engine.ring_buffer.current_seq
        with sqlite3.connect(db) as conn:
            conn.execute(
                """INSERT INTO task_events (task_id,run_id,kind,payload,created_at)
                    VALUES ('private-task',42,'heartbeat','{}',?)""",
                (int(time.time()),),
            )
        await asyncio.sleep(1.2)
        assert app.state.engine.ring_buffer.current_seq == seq
        assert all(e.kind != "heartbeat" for e in app.state.engine.ring_buffer.get_recent())
        await stream.aclose()
        assert app.state.broadcaster.total_connections == 0
    assert not coordinator.tasks
    assert not coordinator.kanban._connections
    async with app.router.lifespan_context(app):
        assert len(coordinator.tasks) == 4
    assert not coordinator.tasks


@pytest.mark.asyncio
async def test_reconciliation_profiles_vitals_and_public_health(tmp_path: Path) -> None:
    app, db = private_app(tmp_path)
    coordinator = app.state.telemetry
    coordinator.reconciliation_interval = 1.0
    coordinator.intervals.update(profiles=1.0, host=1.0)
    async with app.router.lifespan_context(app):
        queue = app.state.broadcaster.register_subscriber()
        with sqlite3.connect(db) as conn:
            conn.execute("UPDATE tasks SET status='done',completed_at=?", (int(time.time()),))
        coordinator.sources["profiles"].agents_file.write_text(
            "agents:\n  - name: forge\n    status: stopped\n"
        )
        await asyncio.sleep(1.3)
        assert app.state.engine.get_agent("forge").presence == "off_duty"
        assert app.state.engine.get_agent("forge").done_today == 1
        messages = []
        while not queue.empty():
            messages.append(queue.get_nowait())
        assert any(m.startswith("event: snapshot") for m in messages)
        assert any(m.startswith("event: vitals") for m in messages)
        assert CANARY not in "".join(messages)
        coordinator.sources["gateway"].gateway_state_path.write_text("invalid json " + CANARY)
        await coordinator._guard("gateway", coordinator._gateway)
        assert app.state.readers["gateway"].status == "degraded"
        assert app.state.readers["gateway"].error
        async with httpx.AsyncClient(
            transport=httpx.ASGITransport(app=app), base_url="http://test"
        ) as client:
            response = await client.get("/api/v1/healthz")
            assert response.json()["status"] == "degraded"
            assert CANARY not in response.text
            assert str(tmp_path) not in response.text
            assert all(v["details"] is None for v in response.json()["readers"].values())
        app.state.broadcaster.unregister_subscriber(queue)


@pytest.mark.asyncio
async def test_required_schema_failure_and_recovery(tmp_path: Path) -> None:
    app, db = private_app(tmp_path)
    reader = app.state.telemetry.kanban
    await reader.boot_async()
    try:
        assert reader.health.status == "ok"  # optional branch_name absent
        assert (await reader.get_tasks_snapshot())[0].assignee == "forge"
        with sqlite3.connect(db) as conn:
            conn.execute("ALTER TABLE tasks DROP COLUMN last_failure_error")
        assert await reader.get_tasks_snapshot() == []
        assert reader.health.status == "degraded"
        assert "last_failure_error" in reader.health.error
        await reader.poll_events()
        assert reader.health.status == "degraded"
        with sqlite3.connect(db) as conn:
            conn.execute("ALTER TABLE tasks ADD COLUMN last_failure_error TEXT")
        assert await reader.get_tasks_snapshot()
        assert reader.health.status == "ok"
        with pytest.raises(sqlite3.OperationalError):
            next(iter(reader._connections.values())).execute("DELETE FROM tasks")
    finally:
        reader.close()


@pytest.mark.asyncio
async def test_shutdown_drains_read_and_errors_do_not_stop_other_sources(tmp_path: Path) -> None:
    app, _ = private_app(tmp_path)
    coordinator = app.state.telemetry
    entered, finish = asyncio.Event(), asyncio.Event()

    async def slow_read() -> None:
        entered.set()
        await finish.wait()

    guard = asyncio.create_task(coordinator._guard("host", slow_read))
    await entered.wait()
    guard.cancel()
    await asyncio.sleep(0)
    assert not guard.done()
    finish.set()
    with pytest.raises(asyncio.CancelledError):
        await guard

    async def broken_read() -> None:
        raise OSError(CANARY)

    await coordinator._guard("gateway", broken_read)
    assert app.state.readers["gateway"].status == "error"
    assert CANARY not in app.state.readers["gateway"].model_dump_json()
    await coordinator._guard("host", coordinator._host)
    assert app.state.readers["host"].status == "ok"


@pytest.mark.asyncio
async def test_registry_profile_identity_and_structured_responsibilities(tmp_path: Path) -> None:
    app, _ = private_app(tmp_path)
    reader = app.state.telemetry.profiles
    reader.agents_file.write_text(
        "agents:\n  - name: historical-alias\n    profile: /profiles/forge\n"
        "    status: stopped\n    responsibilities:\n"
        "      - Backend\n      - Architecture: Transactions\n"
    )
    profiles = await reader.read()
    assert reader.health.status == "ok"
    assert "historical-alias" not in profiles
    assert profiles["forge"].status == "stopped"
    assert profiles["forge"].responsibilities == ["Backend", "Architecture: Transactions"]


@pytest.mark.asyncio
async def test_gateway_permission_error_health_and_no_false_presence(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    app, _ = private_app(tmp_path)
    coordinator = app.state.telemetry
    app.state.engine._profile_status["forge"] = "stopped"
    app.state.engine.tick()
    coordinator.gateway.gateway_state_path.write_text(
        json.dumps(
            {
                "gateway_state": "running",
                "served_profiles": ["forge"],
                "private": CANARY,
            }
        )
    )
    await coordinator._guard("gateway", coordinator._gateway)
    assert app.state.engine.get_agent("forge").presence == "on_duty"
    assert app.state.engine.ring_buffer.get_recent()[-1].kind == "agent_online"
    seq = app.state.engine.ring_buffer.current_seq

    def denied(*args: Any, **kwargs: Any) -> str:
        raise PermissionError(CANARY)

    monkeypatch.setattr(Path, "read_text", denied)
    coordinator.gateway._last_mtime = None
    await coordinator._guard("gateway", coordinator._gateway)
    assert app.state.readers["gateway"].status == "degraded"
    assert app.state.readers["gateway"].last_poll > 0
    assert app.state.engine.ring_buffer.current_seq == seq
    async with httpx.AsyncClient(
        transport=httpx.ASGITransport(app=app), base_url="http://test"
    ) as client:
        response = await client.get("/api/v1/healthz")
        assert CANARY not in response.text
        assert "private" not in response.text
        assert response.json()["readers"]["gateway"]["error"] == "Telemetri tidak tersedia"


@pytest.mark.asyncio
async def test_configured_gateway_projection_lifespan(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    app, _ = private_app(tmp_path)
    original = app.state.telemetry
    projection = tmp_path / "readonly-projection.json"
    projection.write_text(
        json.dumps(
            {
                "gateway_state": "running",
                "served_profiles": ["forge"],
                "private": CANARY,
            }
        )
    )
    monkeypatch.setenv("OFFICE_GATEWAY_STATE_PATH", str(projection))
    coordinator = TelemetryCoordinator(
        app,
        kanban=original.kanban,
        profiles=original.profiles,
        host=original.host,
    )
    app.state.telemetry = coordinator
    assert coordinator.gateway.gateway_state_path == projection
    async with app.router.lifespan_context(app):
        assert app.state.readers["gateway"].status == "ok"
        assert app.state.readers["gateway"].last_poll > 0
        assert coordinator.gateway._cached_data["served_profiles"] == ["forge"]
        stream = await open_stream(app)
        projection.write_text(
            json.dumps(
                {
                    "gateway_state": "running",
                    "served_profiles": ["prism"],
                    "private": CANARY,
                }
            )
        )
        app.state.engine._profile_status["prism"] = "stopped"
        app.state.engine.tick()
        await coordinator._guard("gateway", coordinator._gateway)
        frame = await next_kind(stream, "event")
        assert json.loads(frame.split("data: ")[1])["agent"] == "prism"
        await stream.aclose()
        async with httpx.AsyncClient(
            transport=httpx.ASGITransport(app=app), base_url="http://test"
        ) as client:
            health = await client.get("/api/v1/healthz")
            assert str(projection) not in health.text
            assert CANARY not in health.text
            assert health.json()["readers"]["gateway"]["details"] is None
    # Explicit reader injection continues to override environment configuration.
    injected = GatewayReader(tmp_path / "injected.json")
    assert TelemetryCoordinator(app, gateway=injected).gateway is injected
    monkeypatch.delenv("OFFICE_GATEWAY_STATE_PATH")
    assert TelemetryCoordinator(app).gateway.gateway_state_path == Path(
        "/srv/apps/hermes/profiles/jarvis/gateway_state.json"
    )
