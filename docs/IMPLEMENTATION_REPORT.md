# Agentic AI Office enhancement report

## Baseline T00

- Baseline/HEAD before implementation: `b45f099ad13e4dc96d4c7c0327ecccca208135be`, clean `main` tracking `origin/main`.
- Hermes: `v0.21.3 (2026.9.14)`, upstream `2cfb655d`; Python 3.12.14.
- Service: Uvicorn on `127.0.0.1:8091`, one worker. Baseline process: ~3.7% CPU, 63,976 KiB RSS; `/health` 1.8 ms / 118 bytes; roster 90 ms / 21,461 bytes.
- Source adapters: Hermes profile homes, read-only per-board SQLite under Kanban root, delegation `manifest.json` and bounded `task-<n>.log` tails.
- Production service and databases were not modified during baseline inventory.

## Changes T01–T10

- T01: canonical queued/running/stale/unknown status; execution requires eligible task state, fresh heartbeat (max 120 s), live PID and run correlation. Multiple runs are preserved.
- T02: recursive redaction and bounded transcripts; external text is rendered through text nodes/escaping; dynamic colors use an allowlist.
- T03: native `triage`, `todo`, `ready`, `running`, `blocked`, `review`, `done`, `archived` columns; task drawer exposes dependencies, run history, events and liveness.
- T04: temporary SQLite/profile/delegation fixtures replace production-board assumptions.
- T05: one bounded multi-profile adapter handles every child log, partial/corrupt manifests, missing logs, fan-out, and independent child outcomes.
- T06: SSE hashes stable domain state only, sends transport timestamps outside the digest and heartbeat comments separately; frontend consumes the snapshot without heartbeat REST fan-out.
- T07: selected board is query/localStorage-backed; subscriptions renew and stale responses are ignored.
- T08: always-visible Running, Queued, Blocked/Stale and active-delegation summary; EXECUTING is only shown for live evidence.
- T09: correlated audit endpoint and War Room timeline cover task/run/delegation/child/tool/outcome with filters and source attribution.
- T10: Python/JavaScript syntax, diff hygiene, fixture suite and local staging smoke/visual checks executed.

## Verification V01–V12

| ID | Result | Evidence |
|---|---|---|
| V01 | PASS | `ready` remains in `ready`; roster is not EXECUTING. |
| V02 | PASS | fresh heartbeat + live PID returns ACTIVE with board/task/run and observation evidence. |
| V03 | PASS | dead PID and old heartbeat return STALE/UNKNOWN with reason. |
| V04 | PASS | two boards/runs remain separate worker rows. |
| V05 | PASS | triage and blocked are distinct; blocked reason retained. |
| V06 | PASS | each fan-out child has a distinct tree/timeline/transcript identity. |
| V07 | PASS | failed and completed children retain independent outcomes. |
| V08 | PASS | completed records remain history; frontend baseline prevents historical animation replay. |
| V09 | PASS | board query/localStorage and renewed SSE remain board-scoped. |
| V10 | PASS | synthetic HTML is text; synthetic secret values are recursively redacted. |
| V11 | PASS | repeated idle snapshots are identical; unchanged state produces heartbeat comments only and supports multiple clients. |
| V12 | PASS | missing board is 404; corrupt SQLite is 503 `unavailable`; partial manifests are `unknown`. |

Automated result: `14 passed` (`pytest -q`). One dependency deprecation warning concerns Starlette's TestClient/httpx compatibility.

## Security and redaction

Sensitive payloads (goals, tool arguments/results, logs, diffs, comments/events) pass recursive redaction and size bounds. Transcript IDs are validated. Dynamic external values are not inserted into inline handlers. The service remains loopback-only; public authentication/TLS remains the responsibility of the existing reverse proxy and was not changed. FastAPI docs remain available on loopback; do not expose port 8091 directly.

## Run, rollback, and limitations

Run: `.venv/bin/uvicorn src.server:app --host 127.0.0.1 --port 8091 --workers 1`. Roll back by checking out the preceding commit and restarting the existing service manager. Missing Hermes lease/process identity fields are represented as Unknown rather than inferred healthy. SSE event sequence is connection-local and monotonic; persistent cross-restart replay is intentionally not claimed.
