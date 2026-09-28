"""Synchronous runtime SDK; call from worker threads, not the ASGI event loop.

No inference from logs or agent status. Each mutation supplies one stable event ID;
network retries reuse it. The SDK never catches errors and fabricates success.
"""
from __future__ import annotations

import json
import random
import socket
import time
import uuid
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.parse import urlsplit
from urllib.request import HTTPRedirectHandler, ProxyHandler, Request, build_opener


class NoRedirect(HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        # Never forward an actor credential to a redirect destination.
        return None


class ControlError(RuntimeError):
    def __init__(self, status: int, detail: str):
        super().__init__(f"Execution control HTTP {status}: {detail}")
        self.status = status


class MissionClient:
    def __init__(self, token: str, base_url: str = "http://127.0.0.1:18091", timeout: float = 5):
        parsed = urlsplit(base_url)
        if parsed.scheme not in {"http", "https"} or not parsed.hostname or parsed.username or parsed.password:
            raise ValueError("Expected a credential-free HTTP(S) control-plane URL")
        if parsed.scheme == "http" and parsed.hostname not in {"127.0.0.1", "localhost", "::1"}:
            raise ValueError("Non-loopback control-plane traffic requires HTTPS")
        if len(token) < 32:
            raise ValueError("Actor token is missing or too short")
        self.token, self.base_url, self.timeout = token, base_url.rstrip("/"), timeout
        self.opener = build_opener(ProxyHandler({}), NoRedirect())

    @classmethod
    def from_token_file(cls, path: str | Path, **kwargs):
        token_path = Path(path)
        if token_path.stat().st_mode & 0o077:
            raise ValueError("Agent credential file must have mode 0600")
        return cls(token_path.read_text(encoding="utf-8").strip(), **kwargs)

    def request(self, method: str, path: str, data: dict | None = None) -> dict:
        if not path.startswith("/internal/v1/execution/") or "?" in path or "#" in path:
            raise ValueError("Use a private execution-control resource path")
        body = json.dumps(data, separators=(",", ":"), allow_nan=False).encode() if data is not None else None
        for attempt in range(3):
            request = Request(self.base_url + path, data=body, method=method, headers={
                "Authorization": f"Bearer {self.token}", "Content-Type": "application/json",
            })
            try:
                with self.opener.open(request, timeout=self.timeout) as response:
                    result = json.loads(response.read(1_000_000))
                    if not isinstance(result, dict):
                        raise ControlError(502, "Invalid response shape")
                    return result
            except HTTPError as exc:
                raw = exc.read(65536).decode("utf-8", errors="replace")
                if exc.code not in {429, 502, 503, 504} or attempt == 2:
                    raise ControlError(exc.code, raw) from exc
            except (URLError, TimeoutError, socket.timeout) as exc:
                if attempt == 2:
                    raise ControlError(503, "Control-plane request failed; execution was not acknowledged") from exc
            time.sleep(min(2, 0.25 * (2 ** attempt)) + random.uniform(0, 0.15))
        raise ControlError(503, "Retry budget exhausted")

    def create_span(self, *, span_id: str, mission_id: str, task_id: str,
                    caller: str, callee: str, parent_span_id: str | None = None,
                    event_id: str | None = None, lease_seconds: int = 30) -> dict:
        return self.request("POST", "/internal/v1/execution/spans", {
            "event_id": event_id or str(uuid.uuid4()), "span_id": span_id,
            "mission_id": mission_id, "task_id": task_id, "caller": caller, "callee": callee,
            "parent_span_id": parent_span_id, "lease_seconds": lease_seconds,
        })["span"]

    def transition(self, span: dict, state: str, *, event_id: str | None = None,
                   lease_seconds: int = 30) -> dict:
        return self.request("POST", f'/internal/v1/execution/spans/{span["span_id"]}/transition', {
            "event_id": event_id or str(uuid.uuid4()), "expected_version": span["version"],
            "state": state, "lease_seconds": lease_seconds,
        })["span"]

    def heartbeat(self, span: dict, *, event_id: str | None = None, lease_seconds: int = 30) -> dict:
        return self.request("POST", f'/internal/v1/execution/spans/{span["span_id"]}/heartbeat', {
            "event_id": event_id or str(uuid.uuid4()), "expected_version": span["version"],
            "lease_seconds": lease_seconds,
        })["span"]
