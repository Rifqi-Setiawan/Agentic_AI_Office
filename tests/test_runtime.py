import asyncio
import uuid
from pathlib import Path

import pytest
from src.mission_control.models import SpanCreate, SpanTransition, SpanHeartbeat
from src.mission_control.runtime import CallSpec, run_tracked, LeaseLost
from src.mission_control.store import MissionStore


class LocalClient:
    """Exercise the real store through the SDK contract without external networking."""
    def __init__(self, store, fail_heartbeat=False):
        self.store, self.fail_heartbeat = store, fail_heartbeat

    def create_span(self, **kwargs):
        return self.store.create_span('runtime-dispatcher', SpanCreate(event_id=str(uuid.uuid4()), **kwargs))['span']

    def transition(self, span, state, lease_seconds=30):
        return self.store.transition_span('runtime-dispatcher', span['span_id'], SpanTransition(
            event_id=str(uuid.uuid4()), expected_version=span['version'], state=state, lease_seconds=lease_seconds))['span']

    def heartbeat(self, span, lease_seconds=30):
        if self.fail_heartbeat:
            raise RuntimeError('Test transport failure')
        return self.store.heartbeat('runtime-dispatcher', span['span_id'], SpanHeartbeat(
            event_id=str(uuid.uuid4()), expected_version=span['version'], lease_seconds=lease_seconds))['span']


def test_nested_real_operation_tracks_context_then_closes(tmp_path):
    store = MissionStore(tmp_path/'runtime.db')
    client = LocalClient(store)
    async def root(ctx):
        async def backend(child):
            snap = store.snapshot()
            assert snap['active_delegation_chains'][0]['active_delegation_path'] == ['rifqi','jarvis','swe-backend']
            return 7 * 6
        await ctx.transition('waiting')
        return await run_tracked(client, ctx.child('swe-backend','backend-task'), backend)
    result = asyncio.run(run_tracked(client, CallSpec('root','mission','task','rifqi','jarvis'), root))
    assert result == 42
    assert not store.snapshot()['caller_callee_pairs']
    assert store.get_span('root')['state'] == 'completed'


def test_operation_exception_is_not_reported_as_completed(tmp_path):
    store = MissionStore(tmp_path/'runtime.db')
    async def operation(ctx):
        raise ValueError('Real operation failed')
    with pytest.raises(ValueError, match='Real operation failed'):
        asyncio.run(run_tracked(LocalClient(store), CallSpec('root','mission','task','rifqi','jarvis'), operation))
    assert store.get_span('root')['state'] == 'failed'


def test_heartbeat_failure_cancels_coroutine_and_fails_closed(tmp_path):
    store = MissionStore(tmp_path/'runtime.db')
    cancelled = []
    async def operation(ctx):
        try:
            await asyncio.sleep(30)
        finally:
            cancelled.append(True)
    with pytest.raises(LeaseLost):
        asyncio.run(run_tracked(LocalClient(store, fail_heartbeat=True),
            CallSpec('root','mission','task','rifqi','jarvis',lease_seconds=5), operation))
    assert cancelled == [True]
    assert store.get_span('root')['state'] == 'failed'


def test_external_cancellation_cleans_up_scope(tmp_path):
    store = MissionStore(tmp_path/'runtime.db')
    async def scenario():
        started = asyncio.Event()
        async def operation(ctx):
            started.set()
            await asyncio.sleep(30)
        task = asyncio.create_task(run_tracked(LocalClient(store), CallSpec('root','mission','task','rifqi','jarvis'), operation))
        await started.wait()
        task.cancel()
        with pytest.raises(asyncio.CancelledError):
            await task
    asyncio.run(scenario())
    assert store.get_span('root')['state'] == 'cancelled'
