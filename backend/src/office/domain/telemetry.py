from __future__ import annotations

import asyncio
import os
import time
from collections.abc import Callable, Coroutine
from typing import Any

from office.models.health import ReaderHealth
from office.sources.gateway import GatewayReader
from office.sources.host import HostReader
from office.sources.kanban import KanbanReader
from office.sources.profiles import ProfilesReader


class TelemetryCoordinator:
    """One non-overlapping loop per source, owned exclusively by the ASGI lifespan.

    Reader I/O runs through its existing to_thread API. Shield an in-flight read so
    shutdown can drain it before closing SQLite (cancelling to_thread cannot stop I/O).
    Deadlines skip missed periods rather than creating unbounded catch-up jobs.
    """

    def __init__(
        self,
        app: Any,
        kanban: KanbanReader | None = None,
        gateway: GatewayReader | None = None,
        profiles: ProfilesReader | None = None,
        host: HostReader | None = None,
    ) -> None:
        self.app = app
        self.engine = app.state.engine
        self.broadcaster = app.state.broadcaster
        self.config = app.state.config
        self.kanban = kanban or KanbanReader()
        self.gateway = gateway or GatewayReader(
            os.environ.get("OFFICE_GATEWAY_STATE_PATH")
            or "/srv/apps/hermes/profiles/jarvis/gateway_state.json"
        )
        self.profiles = profiles or ProfilesReader()
        self.host = host or HostReader()
        self.sources: dict[str, KanbanReader | GatewayReader | ProfilesReader | HostReader] = {
            "kanban": self.kanban,
            "gateway": self.gateway,
            "profiles": self.profiles,
            "host": self.host,
        }
        self.tasks: list[asyncio.Task[None]] = []
        self.started = False
        self.stop_event = asyncio.Event()
        self.last_reconciliation = 0.0
        self.reconciliation_interval = 10.0
        self.intervals = {"kanban": 1.0, "gateway": 2.0, "profiles": 60.0, "host": 5.0}
        self.app.state.readers = {
            name: ReaderHealth(status="degraded", error="Belum dipoll") for name in self.sources
        }

    async def _guard(self, name: str, operation: Callable[[], Coroutine[Any, Any, None]]) -> None:
        # Preserve cancellation semantics without closing a connection under a thread.
        pending = asyncio.create_task(operation())
        try:
            await asyncio.shield(pending)
        except asyncio.CancelledError:
            await pending
            raise
        except Exception:
            self.app.state.readers[name] = ReaderHealth(
                status="error", last_poll=int(time.time()), error="Pembacaan telemetri gagal"
            )
        else:
            self.app.state.readers[name] = self.sources[name].health.model_copy(deep=True)

    def _emit_agents(self, before: dict[str, str]) -> None:
        for aid, agent in self.engine.agents.items():
            if agent.model_dump_json() != before.get(aid):
                self.broadcaster.broadcast_agent(
                    agent, seq=self.engine.ring_buffer.current_seq - 1, config=self.config
                )

    def _before(self) -> dict[str, str]:
        return {aid: agent.model_dump_json() for aid, agent in self.engine.agents.items()}

    async def _kanban(self) -> None:
        before = self._before()
        events = await self.kanban.poll_events()
        now = time.monotonic()
        reconcile = now - self.last_reconciliation >= self.reconciliation_interval
        # Fetch tasks for new events as well, so state and feed have real task references.
        if events or reconcile:
            tasks = await self.kanban.get_tasks_snapshot()
            by_key = {(task.board, task.id): task for task in tasks}
            for event in events:
                emitted = self.engine.process_event(
                    event, task=by_key.get((event.board, event.task_id))
                )
                if emitted:
                    self.broadcaster.broadcast_event(emitted, config=self.config)
            if reconcile and self.kanban.health.status == "ok":
                for emitted in self.engine.reconcile_tasks(tasks):
                    self.broadcaster.broadcast_event(emitted, config=self.config)
                self.last_reconciliation = now
        for emitted in self.engine.tick():
            self.broadcaster.broadcast_event(emitted, config=self.config)
        self._emit_agents(before)
        if reconcile:
            self.broadcaster.broadcast_snapshot(
                self.engine.get_snapshot(projection="public", config=self.config)
            )

    async def _profiles(self) -> None:
        before = self._before()
        profiles = await self.profiles.read()
        self.app.state.profiles = profiles
        self.engine.update_profiles(profiles)
        self._emit_agents(before)

    async def _gateway(self) -> None:
        data = await self.gateway.read()
        # Counts and empty served_profiles cannot identify worker presence. Only
        # explicit named profiles on a healthy running gateway establish on-duty.
        if self.gateway.health.status != "ok":
            return
        if data.get("gateway_state") != "running":
            return
        names = data.get("served_profiles")
        if not isinstance(names, list):
            return
        before = self._before()
        for aid in names:
            if not isinstance(aid, str) or aid not in self.engine.agents:
                continue
            agent = self.engine.get_agent(aid)
            if agent.presence == "off_duty":
                event = self.engine.process_event(
                    {
                        "kind": "agent_online",
                        "board": "office-v2",
                        "task_id": "",
                        "created_at": int(time.time()),
                        "payload": {"profile": aid},
                    }
                )
                if event:
                    self.broadcaster.broadcast_event(event, config=self.config)
        self._emit_agents(before)

    async def _host(self) -> None:
        vitals = await self.host.read()
        self.engine.set_vitals(vitals)
        self.broadcaster.broadcast_vitals(vitals)

    async def _loop(self, name: str, operation: Callable[[], Coroutine[Any, Any, None]]) -> None:
        while not self.stop_event.is_set():
            deadline = time.monotonic() + self.intervals[name]
            try:
                await asyncio.wait_for(
                    self.stop_event.wait(), timeout=max(0.0, deadline - time.monotonic())
                )
            except TimeoutError:
                await self._guard(name, operation)

    async def start(self) -> None:
        if self.started:
            raise RuntimeError("Koordinator telemetri sudah berjalan")
        self.started = True
        self.stop_event.clear()
        self.last_reconciliation = 0.0
        await self._guard("kanban", self.kanban.boot_async)
        # Profiles before tasks, tasks before accepting requests. Initialize cursor
        # before the snapshot to avoid a startup gap in the event stream.
        operations = {
            "profiles": self._profiles,
            "gateway": self._gateway,
            "host": self._host,
            "kanban": self._kanban,
        }
        for name, operation in operations.items():
            await self._guard(name, operation)
        self.broadcaster.broadcast_snapshot(
            self.engine.get_snapshot(projection="public", config=self.config)
        )
        self.tasks = [
            asyncio.create_task(self._loop(name, operation), name=f"office-telemetry-{name}")
            for name, operation in operations.items()
        ]

    async def stop(self) -> None:
        self.stop_event.set()
        draining = asyncio.gather(*self.tasks, return_exceptions=True)
        try:
            await asyncio.shield(draining)
        except asyncio.CancelledError:
            await draining
            raise
        finally:
            self.tasks.clear()
            self.started = False
            await asyncio.to_thread(self.kanban.close)
