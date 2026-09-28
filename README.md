# Agentic AI Office — Hermes Sovereign Mission Control

A real-time cyber operations command center for multi-agent systems. It transforms autonomous agent activity, task state, delegation relationships, worker health, source changes, and runtime telemetry into an inspectable, high-density HUD.

![Python](https://img.shields.io/badge/Python-3.12-3776AB?logo=python&logoColor=white)
![FastAPI](https://img.shields.io/badge/FastAPI-0.115%2B-009688?logo=fastapi&logoColor=white)
![React](https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=black)
![React Flow](https://img.shields.io/badge/DAG-React--Flow-FF0072)
![Tailwind](https://img.shields.io/badge/Tailwind-CSS-38B2AC?logo=tailwind-css&logoColor=white)
![WebSocket](https://img.shields.io/badge/Live-WebSocket-06B6D4)
![Tests](https://img.shields.io/badge/Tests-15%2F15%20Passing-emerald)

> 📖 **Comprehensive System Manual**: For detailed agent hierarchy, formal DELEGATE contracts, and manual audit guidelines, see **[WORKFLOW_AND_DELEGATION.md](./WORKFLOW_AND_DELEGATION.md)**.

## What it does

Agentic AI Office provides an executive control plane for observing a squad of 14 autonomous agents without hiding underlying execution evidence.

- **Interactive Execution DAG** — Full-height React Flow hierarchical graph mapping Muhammad Rifqi Setiawan (Level 0 Founder) commanding Jarvis (Chief Orchestrator) and specialist divisions with live glowing circuit bus traces.
- **14-Agent Live Squad Directory** — Real foundation models (`ag/gemini-3.8-flash`, `cx/gpt-5.6-sol`), live state beacons (`ACTIVE`, `IDLE`), and deep inspection drawers.
- **Live WebSocket & SSE Telemetry** — Redacted tool execution events, active sessions, and multi-agent coordination stream with sub-second latency.
- **Zero Self-Approval Verification** — Strict separation between code/pipeline implementers and independent verification sentries (`swe-QA`).
- **Real-time Host Vitals** — Live CPU load, 54GB RAM allocation, uptime, and thread liveness.
- **Credential Redaction** — Recursive pattern masking and secret stripping before any payload reaches the browser.

## Architecture

```text
Browser UI (HTML + JavaScript)
        │
        ├── REST polling for snapshots and detail views
        └── EventSource connection for live updates
                         │
                   FastAPI service
                         │
        ┌────────────────┼──────────────────┐
        │                │                  │
  Kanban SQLite     Runtime files      Host and Git data
  (read-only)       and transcripts    (read-only inspection)
```

The repository intentionally uses a small deployment footprint:

- `src/server.py` contains the FastAPI application, collectors, redaction layer, and API routes.
- `static/index.html` provides the cockpit, Kanban, telemetry, and inspection panels.
- `static/simulation2d.js` runs the stronghold simulation and agent movement model.
- `static/assets/stronghold_map.jpg` is the visual environment.
- `tests/test_cockpit.py` covers health, roster, telemetry, Kanban, liveness, DAG, and redaction behavior.

## API overview

| Endpoint | Purpose |
| --- | --- |
| `GET /health` | Service health and engine identity |
| `GET /api/v1/agents/roster` | Agent states, assignments, models, and map coordinates |
| `GET /api/v1/telemetry/live` | Current tool-call and execution events |
| `GET /api/v1/stream/events` | Server-Sent Events stream for live operational updates |
| `GET /api/v1/kanban/boards` | Discover available Kanban boards |
| `GET /api/v1/kanban/tasks` | Tasks grouped by workflow column |
| `GET /api/v1/kanban/task/{task_id}` | Task details, comments, runs, events, and dependency links |
| `GET /api/v1/kanban/events` | Recent board event history |
| `GET /api/v1/workers/liveness` | Heartbeat and stale-worker state |
| `GET /api/v1/delegations/tree` | Delegation hierarchy and execution relationships |
| `GET /api/v1/delegations/{id}/transcript/{index}` | Bounded, redacted transcript view |
| `GET /api/v1/dag/trace` | Recent delegation and tool-call traces |
| `GET /api/v1/triage/errors` | Detected failures and operational warnings |
| `GET /api/v1/diff/latest` | Recent source-control changes |
| `GET /api/v1/vitals` | CPU, memory, disk, and uptime metrics |
| `GET /api/v1/costs/summary` | Token and model-cost summary |

Interactive OpenAPI documentation is available at `/docs` while the service is running.

## Requirements

- Python 3.12 or newer
- Linux host for process and runtime telemetry
- Access to the runtime directories and read-only SQLite databases configured in `src/server.py`

The UI can start without every external data source, but unavailable integrations will return empty or error states. The current collectors target a specific local multi-agent installation. Adjust `BASE_DIR`, `PROFILES_DIR`, `KANBAN_ROOT`, and related collector paths in `src/server.py` for another environment.

## Quick start

```bash
git clone https://github.com/Rifqi-Setiawan/Agentic_AI_Office.git
cd Agentic_AI_Office

python3 -m venv .venv
source .venv/bin/activate
python -m pip install --upgrade pip
python -m pip install -r requirements.txt

uvicorn src.server:app --host 127.0.0.1 --port 8000
```

Open <http://127.0.0.1:8000> for the cockpit or <http://127.0.0.1:8000/docs> for the API explorer.

To expose the service beyond localhost, place it behind an authenticated reverse proxy and TLS. The application enables permissive CORS for controlled internal deployment and should not be published directly to the internet without an access-control layer.

## Configuration

| Environment variable | Default | Description |
| --- | --- | --- |
| `COCKPIT_STALE_HEARTBEAT_SECONDS` | `120` | Maximum worker heartbeat age before a running task is marked stale |

Filesystem and database locations are currently declared near the top of `src/server.py`. They should be changed to match the target installation before production deployment.

## Testing

Install dependencies, then run:

```bash
pytest -q
```

Some integration tests inspect live local Kanban and runtime data. Run the suite on a configured host when validating all integration endpoints.

## Security and privacy

This cockpit is designed for operational transparency, which means its data sources may contain sensitive context. The backend applies recursive key-based redaction and pattern-based masking to API payloads. Transcript reads are path-validated and size-bounded.

Before deployment:

1. Bind the application to a private interface or localhost.
2. Add authentication and TLS at the reverse proxy.
3. Grant the service account read-only access to required data sources.
4. Review CORS policy for the deployment domain.
5. Confirm that exposed diffs and transcripts meet the organization's data-retention policy.

Do not commit runtime databases, environment files, tokens, generated transcripts, or virtual environments. The included `.gitignore` excludes local Python environments and caches.

## Project status

The project implements the cockpit interface, 13-agent spatial roster, live telemetry, Kanban integration, heartbeat monitoring, delegation trees, transcript inspection, source-diff viewing, and automated API tests. Its current deployment adapters are tailored to a local runtime layout; portability through environment-driven path configuration is the next logical improvement.

## Contributing

Issues and focused pull requests are welcome. Keep changes scoped, include tests for backend behavior, and document any new data source or API route. Use Conventional Commits for commit messages.

## Author

**Muhammad Rifqi Setiawan**  
GitHub: [@Rifqi-Setiawan](https://github.com/Rifqi-Setiawan)
