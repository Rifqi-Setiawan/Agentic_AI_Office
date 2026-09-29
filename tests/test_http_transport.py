"""Real loopback HTTP/SSE smoke. Disposable test store, not the existing VPS app."""
import json
import secrets
import socket
import threading
import time
from urllib.error import HTTPError
from urllib.request import Request, urlopen

import pytest
import uvicorn

from src.mission_control.api import create_control_app, install_mission_control
from src.mission_control.client import MissionClient, ControlError
from src.mission_control.store import MissionStore


def test_real_sdk_http_and_sse_roundtrip(tmp_path):
    read_token, dispatcher_token = secrets.token_urlsafe(48), secrets.token_urlsafe(48)
    store = MissionStore(tmp_path / 'transport.sqlite3')
    app = create_control_app(store, {'runtime-dispatcher': dispatcher_token})
    # Combining routers is ONLY a local test convenience; production listeners stay separate.
    install_mission_control(app, store, read_token)
    sock = socket.socket()
    sock.bind(('127.0.0.1', 0))
    port = sock.getsockname()[1]
    server = uvicorn.Server(uvicorn.Config(app, log_level='error', access_log=False, lifespan='off', ws='none'))
    thread = threading.Thread(target=server.run, kwargs={'sockets': [sock]}, daemon=True)
    thread.start()
    base = f'http://127.0.0.1:{port}'
    try:
        deadline = time.monotonic() + 5
        while not server.started and thread.is_alive() and time.monotonic() < deadline:
            time.sleep(0.01)
        assert server.started, 'Loopback test server failed to start'
        client = MissionClient(dispatcher_token, base_url=base)
        row = client.create_span(span_id='http-root', mission_id='http-mission', task_id='http-task',
                                 caller='rifqi', callee='jarvis')
        row = client.transition(row, 'running')
        row = client.heartbeat(row)
        request = Request(base + '/api/v1/execution/snapshot', headers={'Authorization': 'Bearer ' + read_token})
        with urlopen(request, timeout=3) as response:
            payload = json.load(response)
        assert payload['active_delegation_chains'][0]['active_delegation_path'] == ['rifqi', 'jarvis']
        with pytest.raises(HTTPError) as unauthorized:
            urlopen(base + '/api/v1/execution/snapshot', timeout=3)
        assert unauthorized.value.code == 401
        wrong_client = MissionClient(secrets.token_urlsafe(48), base_url=base)
        with pytest.raises(ControlError) as wrong_actor:
            wrong_client.request('GET', '/internal/v1/execution/spans/http-root')
        assert wrong_actor.value.status == 401
        sse = Request(base + '/api/v1/execution/events', headers={'Authorization': 'Bearer ' + read_token})
        with urlopen(sse, timeout=3) as response:
            frame = [response.readline().decode().strip() for _ in range(4)]
        assert frame[1] == 'event: delegation_snapshot'
        streamed = json.loads(frame[2].removeprefix('data: '))
        assert streamed['caller_callee_pairs'][0]['invocations'][0]['span_id'] == 'http-root'
        client.transition(row, 'completed')
        assert not store.snapshot()['caller_callee_pairs']
    finally:
        server.should_exit = True
        thread.join(timeout=5)
        sock.close()
        assert not thread.is_alive(), 'Loopback test server did not stop'
