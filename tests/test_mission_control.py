"""Hermetic tests. No VPS paths, live credentials, external calls, or existing DBs."""
import asyncio
import json
import sqlite3
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from pydantic import ValidationError
from starlette.staticfiles import StaticFiles

from src.mission_control.api import create_control_app, install_mission_control, read_router
from src.mission_control.models import (
    ArtifactSubmit, ReleaseAuthorize, ReleaseConfirm, SpanCreate, SpanHeartbeat,
    SpanTransition, TaskCreate, Verification,
)
from src.mission_control.store import MissionStore, StoreError


@pytest.fixture
def system(tmp_path):
    now = [1_790_000_000_000]
    store = MissionStore(tmp_path / 'mission.sqlite3', clock=lambda: now[0])
    return store, now


def create(store, sid='root', caller='rifqi', callee='vps-boss', parent=None, mission='mission-1', lease=30):
    return store.create_span('runtime-dispatcher', SpanCreate(event_id=f'create:{sid}', span_id=sid,
        mission_id=mission, task_id=f'task:{sid}', caller=caller, callee=callee, parent_span_id=parent, lease_seconds=lease))['span']


def change(store, row, state, actor='runtime-dispatcher'):
    return store.transition_span(actor, row['span_id'], SpanTransition(
        event_id=f'{state}:{row["span_id"]}:{row["version"]}', expected_version=row['version'], state=state))['span']


def running(store, sid='root', caller='rifqi', callee='vps-boss', parent=None, mission='mission-1'):
    return change(store, create(store, sid, caller, callee, parent, mission), 'running')


def backend_chain(store):
    root = running(store)
    backend = running(store, 'backend', 'vps-boss', 'swe-backend', 'root')
    return root, backend


def keys(snapshot):
    return {(pair['caller'], pair['callee']) for pair in snapshot['caller_callee_pairs']}


def expect_status(status, fn):
    with pytest.raises(StoreError) as error:
        fn()
    assert error.value.status == status


def contract(store, now, task='release-task', max_attempts=3):
    return store.create_task('vps-boss', TaskCreate(event_id=f'contract:{task}', task_id=task,
        mission_id='mission-1', goal='Implement a verified backend change', implementers=['swe-backend'],
        acceptance_criteria=['All regression tests pass'], allowed_paths=['src/', 'tests/'],
        test_commands=[['python', '-m', 'pytest', '-q']], deadline_at_ms=now[0] + 1000000,
        max_attempts=max_attempts, budget_usd=10))['task']


def submit(store, task, digest='a' * 64, actor='swe-backend'):
    return store.submit_artifact(actor, task['task_id'], ArtifactSubmit(event_id=f'submit:{task["version"]}',
        expected_version=task['version'], artifact_digest=digest))['task']


def verify(store, task, actor='swe-verifier', verdict='approved', digest=None):
    return store.verify_artifact(actor, task['task_id'], Verification(event_id=f'verify:{actor}:{task["version"]}',
        expected_version=task['version'], artifact_digest=digest or task['artifact_digest'], verdict=verdict,
        tests_exit_code=0 if verdict == 'approved' else 1, evidence_digest='b' * 64, evidence_ref='test-report-1'))['task']


def authorize(store, task, actor='github-manager', digest=None):
    return store.authorize_release(actor, task['task_id'], ReleaseAuthorize(event_id=f'authorize:{actor}:{task["version"]}',
        expected_version=task['version'], artifact_digest=digest or task['artifact_digest']))['task']


def test_empty_snapshot_is_not_a_fabricated_mission(system):
    store, _ = system
    snapshot = store.snapshot()
    assert snapshot['revision'] == 0
    assert snapshot['active_delegation_chains'] == []
    assert not snapshot['instrumentation_seen']


def test_queued_delegation_does_not_light(system):
    store, _ = system
    create(store)
    assert keys(store.snapshot()) == set()
    assert store.snapshot()['queued_count'] == 1


def test_only_real_adjacent_pairs_light(system):
    store, _ = system
    backend_chain(store)
    snap = store.snapshot()
    assert keys(snap) == {('rifqi', 'vps-boss'), ('vps-boss', 'swe-backend')}
    assert snap['active_delegation_chains'][0]['active_delegation_path'] == ['rifqi', 'vps-boss', 'swe-backend']


def test_qa_edge_only_after_qa_starts(system):
    store, _ = system
    backend_chain(store)
    qa = create(store, 'qa', 'swe-backend', 'swe-verifier', 'backend')
    assert ('swe-backend', 'swe-verifier') not in keys(store.snapshot())
    change(store, qa, 'running')
    assert keys(store.snapshot()) == {('rifqi', 'vps-boss'), ('vps-boss', 'swe-backend'), ('swe-backend', 'swe-verifier')}


def test_waiting_parents_keep_real_context(system):
    store, _ = system
    root, backend = backend_chain(store)
    change(store, root, 'waiting')
    change(store, backend, 'waiting')
    running(store, 'qa', 'swe-backend', 'swe-verifier', 'backend')
    assert len(store.snapshot()['active_delegation_chains'][0]['span_ids']) == 3


def test_parallel_forks_and_branch_completion(system):
    store, _ = system
    root, backend = backend_chain(store)
    running(store, 'frontend', 'vps-boss', 'swe-frontend', 'root')
    assert len(store.snapshot()['active_delegation_chains']) == 2
    change(store, backend, 'completed')
    assert keys(store.snapshot()) == {('rifqi', 'vps-boss'), ('vps-boss', 'swe-frontend')}


def test_multiple_missions_share_pair_without_duplicate_span(system):
    store, _ = system
    running(store, 'root1', mission='m1')
    running(store, 'root2', mission='m2')
    snap = store.snapshot()
    assert len(snap['caller_callee_pairs']) == 1
    assert len(snap['caller_callee_pairs'][0]['invocations']) == 2


def test_parent_completion_with_open_child_rejected(system):
    store, _ = system
    root, _ = backend_chain(store)
    expect_status(409, lambda: change(store, root, 'completed'))
    assert len(keys(store.snapshot())) == 2


@pytest.mark.parametrize('terminal', ['failed', 'cancelled'])
def test_terminal_parent_cascades(system, terminal):
    store, _ = system
    root, _ = backend_chain(store)
    create(store, 'qa', 'swe-backend', 'swe-verifier', 'backend')
    change(store, root, terminal)
    assert keys(store.snapshot()) == set()
    assert store.get_span('qa')['state'] == terminal


def test_lease_expiry_cascades_despite_child_heartbeat(system):
    store, now = system
    _, backend = backend_chain(store)
    now[0] += 20000
    store.heartbeat('swe-backend', backend['span_id'], SpanHeartbeat(event_id='hb1', expected_version=backend['version']))
    now[0] += 10001
    assert keys(store.snapshot()) == set()
    assert store.get_span('backend')['state'] == 'expired'


def test_expired_work_cannot_resurrect(system):
    store, now = system
    row = running(store)
    now[0] += 31000
    expect_status(409, lambda: store.heartbeat('vps-boss', 'root', SpanHeartbeat(event_id='late', expected_version=row['version'])))
    assert store.get_span('root')['state'] == 'expired'


def test_stale_version_rejected(system):
    store, _ = system
    row = running(store)
    expect_status(409, lambda: store.heartbeat('vps-boss', 'root', SpanHeartbeat(event_id='stale', expected_version=0)))
    assert store.get_span('root')['version'] == row['version']


def test_duplicate_delivery_is_idempotent(system):
    store, _ = system
    first = create(store)
    revision = store.snapshot()['revision']
    second = create(store)
    assert first == second
    assert store.snapshot()['revision'] == revision


def test_idempotency_key_cannot_change_payload_or_actor(system):
    store, _ = system
    create(store)
    changed = SpanCreate(event_id='create:root', span_id='different', mission_id='m2', task_id='t2', caller='rifqi', callee='vps-boss')
    expect_status(409, lambda: store.create_span('runtime-dispatcher', changed))
    original = changed.model_copy(update={'span_id': 'root', 'mission_id': 'mission-1', 'task_id': 'task:root'})
    expect_status(409, lambda: store.create_span('rifqi', original))


def test_orphan_wrong_parent_and_cross_mission_rejected(system):
    store, _ = system
    expect_status(404, lambda: create(store, 'orphan', 'vps-boss', 'swe-backend', 'missing'))
    running(store)
    expect_status(409, lambda: create(store, 'wrong', 'professor', 'data-engineer', 'root'))
    expect_status(409, lambda: create(store, 'cross', 'vps-boss', 'swe-backend', 'root', mission='other'))


def test_root_must_match_authority_and_only_one_per_mission(system):
    store, _ = system
    expect_status(409, lambda: create(store, 'bad-root', 'vps-boss', 'swe-backend'))
    create(store)
    expect_status(409, lambda: create(store, 'second-root'))


def test_unknown_identity_and_self_call_rejected():
    with pytest.raises(ValidationError):
        SpanCreate(event_id='e', span_id='s', mission_id='m', task_id='t', caller='imaginary', callee='vps-boss')
    with pytest.raises(ValidationError):
        SpanCreate(event_id='e', span_id='s', mission_id='m', task_id='t', caller='jarvis', callee='vps-boss')


def test_aliases_normalize_to_canonical_identity():
    command = SpanCreate(event_id='e', span_id='s', mission_id='m', task_id='t', caller='swe-backend', callee='swe-QA')
    assert command.callee == 'swe-verifier'


def test_wrong_actor_cannot_start_or_delegate(system):
    store, _ = system
    row = create(store)
    expect_status(403, lambda: change(store, row, 'running', 'swe-backend'))
    bad = SpanCreate(event_id='wrong-actor', span_id='x', mission_id='m2', task_id='t', caller='rifqi', callee='vps-boss')
    expect_status(403, lambda: store.create_span('swe-backend', bad))


def test_caller_can_cancel_but_not_complete_child(system):
    store, _ = system
    _, child = backend_chain(store)
    expect_status(403, lambda: change(store, child, 'completed', 'vps-boss'))
    change(store, child, 'cancelled', 'vps-boss')
    assert store.get_span('backend')['state'] == 'cancelled'


def test_repeat_agent_is_new_acyclic_invocation(system):
    store, _ = system
    backend_chain(store)
    running(store, 'qa', 'swe-backend', 'swe-verifier', 'backend')
    running(store, 'repair', 'swe-verifier', 'swe-backend', 'qa')
    assert store.snapshot()['active_delegation_chains'][0]['active_delegation_path'][-3:] == ['swe-backend', 'swe-verifier', 'swe-backend']


def test_shared_store_survives_restart(system):
    store, now = system
    backend_chain(store)
    original = store.snapshot()
    restarted = MissionStore(store.path, clock=lambda: now[0]).snapshot()
    assert restarted['stream_id'] == original['stream_id']
    assert restarted['revision'] == original['revision']
    assert restarted['caller_callee_pairs'] == original['caller_callee_pairs']


def test_concurrent_same_version_only_one_wins(system):
    store, _ = system
    row = running(store)
    def write(index):
        try:
            store.heartbeat('vps-boss', 'root', SpanHeartbeat(event_id=f'concurrent-{index}', expected_version=row['version']))
            return 200
        except StoreError as error:
            return error.status
    with ThreadPoolExecutor(max_workers=4) as executor:
        statuses = list(executor.map(write, range(4)))
    assert statuses.count(200) == 1
    assert statuses.count(409) == 3


def test_zero_self_approval(system):
    store, now = system
    task = submit(store, contract(store, now))
    expect_status(403, lambda: verify(store, task, actor='swe-backend'))
    expect_status(403, lambda: verify(store, task, actor='runtime-dispatcher'))


def test_verifier_cannot_be_contract_implementer(system):
    store, now = system
    task = contract(store, now)
    bad = {**task['contract'], 'event_id': 'bad-contract', 'task_id': 'bad', 'implementers': ['swe-verifier']}
    with pytest.raises(ValidationError):
        TaskCreate(**bad)


def test_release_without_approval_and_wrong_digest_rejected(system):
    store, now = system
    task = submit(store, contract(store, now))
    expect_status(409, lambda: authorize(store, task))
    expect_status(409, lambda: verify(store, task, digest='c' * 64))
    task = verify(store, task)
    expect_status(409, lambda: authorize(store, task, digest='d' * 64))
    expect_status(403, lambda: authorize(store, task, actor='swe-verifier'))


def test_artifact_change_invalidates_existing_approval(system):
    store, now = system
    task = verify(store, submit(store, contract(store, now)))
    task = submit(store, task, digest='c' * 64)
    assert task['state'] == 'review' and task['verification'] is None
    expect_status(409, lambda: authorize(store, task))


def test_nonzero_test_exit_cannot_be_approved():
    with pytest.raises(ValidationError):
        Verification(event_id='e', expected_version=0, artifact_digest='a' * 64, verdict='approved',
            tests_exit_code=1, evidence_digest='b' * 64, evidence_ref='evidence')


def test_attempt_budget_enforced(system):
    store, now = system
    task = verify(store, submit(store, contract(store, now, max_attempts=1)), verdict='rejected')
    expect_status(409, lambda: submit(store, task, digest='c' * 64))


def test_expired_contract_stops_release(system):
    store, now = system
    task = verify(store, submit(store, contract(store, now)))
    now[0] += 1000001
    expect_status(409, lambda: authorize(store, task))


def test_authorization_is_not_publication_and_pins_digest(system):
    store, now = system
    task = authorize(store, verify(store, submit(store, contract(store, now))))
    assert task['state'] == 'release_authorized' and task['published_ref'] is None
    expect_status(409, lambda: submit(store, task, digest='c' * 64))
    command = ReleaseConfirm(event_id='confirm', expected_version=task['version'], artifact_digest=task['artifact_digest'],
        authorization_id=task['authorization_id'], published_ref='d' * 40)
    expect_status(403, lambda: store.confirm_release('swe-backend', task['task_id'], command))
    bad = command.model_copy(update={'authorization_id': 'wrong'})
    expect_status(409, lambda: store.confirm_release('github-manager', task['task_id'], bad))
    published = store.confirm_release('github-manager', task['task_id'], command)['task']
    assert published['state'] == 'released' and published['published_ref'] == 'd' * 40


def test_public_projection_omits_private_contracts(system):
    store, now = system
    contract(store, now)
    public = json.dumps(store.snapshot())
    assert 'acceptance_criteria' not in public and 'test_commands' not in public and 'goal' not in public


def test_public_router_auth_and_read_only(system):
    store, _ = system
    app = FastAPI()
    install_mission_control(app, store, 'r' * 40)
    with TestClient(app) as client:
        assert client.get('/api/v1/execution/snapshot').status_code == 401
        assert client.get('/api/v1/execution/events').status_code == 401
        headers = {'X-Hermes-Read-Token': 'r' * 40}
        response = client.get('/api/v1/execution/snapshot', headers=headers)
        assert response.status_code == 200 and response.headers['cache-control'] == 'no-store'
        assert client.post('/api/v1/execution/snapshot', headers=headers).status_code == 405
        assert client.get('/api/v1/execution/snapshot', headers={'Authorization': 'Bearer ' + 'r' * 40}).status_code == 200


def test_router_registered_before_static_mount(system, tmp_path):
    store, _ = system
    static = tmp_path / 'web'; static.mkdir(); (static / 'index.html').write_text('<h1>Existing cockpit</h1>')
    app = FastAPI()
    install_mission_control(app, store, 'r' * 40)
    app.mount('/', StaticFiles(directory=static, html=True), name='static')
    with TestClient(app) as client:
        assert client.get('/').status_code == 200
        assert client.get('/api/v1/execution/snapshot', headers={'X-Hermes-Read-Token': 'r' * 40}).json()['schema_version'] == 1


def test_private_token_identity_body_limit_and_validation(system):
    store, _ = system
    app = create_control_app(store, {'runtime-dispatcher': 'd' * 40, 'swe-backend': 'b' * 40})
    command = dict(event_id='queued', span_id='root', mission_id='mission', task_id='task', caller='rifqi', callee='vps-boss')
    with TestClient(app) as client:
        url = '/internal/v1/execution/spans'
        assert client.post(url, json=command).status_code == 401
        assert client.post(url, json=command, headers={'Authorization': 'Bearer ' + 'b' * 40}).status_code == 403
        assert client.post(url, json=command, headers={'Authorization': 'Bearer ' + 'd' * 40}).status_code == 200
        assert client.post(url, json={**command, 'actor': 'rifqi'}, headers={'Authorization': 'Bearer ' + 'd' * 40}).status_code == 422
        assert client.post(url, content=b'x' * 65537).status_code == 413


def test_duplicate_actor_credentials_rejected(system):
    store, _ = system
    with pytest.raises(RuntimeError):
        create_control_app(store, {'swe-backend': 'x' * 40, 'swe-verifier': 'x' * 40})


def test_sse_frame_is_versioned_full_snapshot(system):
    store, _ = system
    backend_chain(store)
    router = read_router(store, 'r' * 40)
    endpoint = next(route.endpoint for route in router.routes if route.path.endswith('/events'))
    class Request:
        async def is_disconnected(self):
            return False
    async def first_frame():
        response = await endpoint(Request())
        frame = await anext(response.body_iterator)
        await response.body_iterator.aclose()
        return response, frame
    response, frame = asyncio.run(first_frame())
    assert response.headers['x-accel-buffering'] == 'no'
    assert 'event: delegation_snapshot\n' in frame
    data = json.loads(next(line[6:] for line in frame.splitlines() if line.startswith('data: ')))
    assert len(data['caller_callee_pairs']) == 2
    assert data['stream_id'] in frame


@pytest.mark.parametrize('bad_path', ['/etc/passwd', '../secret', 'src/../../secret'])
def test_contract_path_scope_rejects_traversal(system, bad_path):
    store, now = system
    task = contract(store, now)
    with pytest.raises(ValidationError):
        TaskCreate(**{**task['contract'], 'event_id': 'bad', 'allowed_paths': [bad_path]})
