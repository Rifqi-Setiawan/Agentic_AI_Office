"""Async execution wrapper for the EXISTING trusted dispatcher, with real leases.

This module observes a supplied real coroutine; it does not invent a worker,
run a shell, replace your scheduler, or grant verification/release permissions.
"""
from __future__ import annotations

import asyncio
import logging
import uuid
from dataclasses import dataclass
from typing import Awaitable, Callable, TypeVar

from .client import MissionClient

T = TypeVar('T')
log = logging.getLogger(__name__)


class LeaseLost(RuntimeError):
    """Execution evidence is no longer authoritative; do not silently retry side effects."""


@dataclass(frozen=True)
class CallSpec:
    span_id: str
    mission_id: str
    task_id: str
    caller: str
    callee: str
    parent_span_id: str | None = None
    lease_seconds: int = 30


class CallContext:
    def __init__(self, client: MissionClient, spec: CallSpec, row: dict):
        self.client, self.spec, self.row = client, spec, row
        self.lock = asyncio.Lock()

    async def transition(self, state: str) -> None:
        async with self.lock:
            self.row = await asyncio.to_thread(self.client.transition, self.row, state,
                                               lease_seconds=self.spec.lease_seconds)

    async def heartbeat(self) -> None:
        async with self.lock:
            self.row = await asyncio.to_thread(self.client.heartbeat, self.row,
                                               lease_seconds=self.spec.lease_seconds)

    def child(self, callee: str, task_id: str) -> CallSpec:
        return CallSpec(span_id=str(uuid.uuid4()), mission_id=self.spec.mission_id,
                        task_id=task_id, caller=self.spec.callee, callee=callee,
                        parent_span_id=self.spec.span_id, lease_seconds=self.spec.lease_seconds)


async def run_tracked(client: MissionClient, spec: CallSpec,
                      operation: Callable[[CallContext], Awaitable[T]]) -> T:
    """Run one real awaited operation. Parent scopes must await their children.

    Use the dispatcher credential only in the trusted dispatcher process.
    Approvals still require a separate swe-verifier client; this wrapper cannot
    authorize an artifact. Cancellation is cooperative; kill external tools using
    the existing process/container supervisor as well.
    """
    row = await asyncio.to_thread(client.create_span, span_id=spec.span_id, mission_id=spec.mission_id,
                                 task_id=spec.task_id, caller=spec.caller, callee=spec.callee,
                                 parent_span_id=spec.parent_span_id, lease_seconds=spec.lease_seconds)
    context = CallContext(client, spec, row)
    await context.transition('running')
    stop = asyncio.Event()

    async def keep_lease() -> None:
        while not stop.is_set():
            try:
                await asyncio.wait_for(stop.wait(), timeout=spec.lease_seconds / 3)
            except asyncio.TimeoutError:
                await context.heartbeat()

    async def invoke() -> T:
        return await operation(context)

    worker = asyncio.create_task(invoke(), name=f'mc-work:{spec.span_id}')
    keeper = asyncio.create_task(keep_lease(), name=f'mc-lease:{spec.span_id}')
    terminal = 'failed'
    try:
        done, _ = await asyncio.wait({worker, keeper}, return_when=asyncio.FIRST_COMPLETED)
        if keeper in done and not keeper.cancelled() and keeper.exception() is not None:
            worker.cancel()
            await asyncio.gather(worker, return_exceptions=True)
            raise LeaseLost('Heartbeat failed; stop supervised tools and reconcile the span before resuming') from keeper.exception()
        result = await worker
        # Stop gracefully, not by cancelling an in-flight to_thread heartbeat:
        # cancelling it could commit a version update after we lost its response.
        stop.set()
        await keeper
        await context.transition('completed')
        terminal = 'completed'
        return result
    except asyncio.CancelledError:
        terminal = 'cancelled'
        raise
    finally:
        stop.set()
        if not worker.done():
            worker.cancel()
        await asyncio.gather(worker, keeper, return_exceptions=True)
        if terminal != 'completed':
            try:
                await context.transition(terminal)
            except Exception:
                # Never claim a terminal event was stored if acknowledgement failed.
                # A persisted lease will expire. The original execution error survives.
                log.exception('Terminal telemetry could not be acknowledged for span %s', spec.span_id)
