"""Real-time Live Bridge between Hermes Runtime and Mission Control Store.

Harvests active sessions and live delegations from Hermes profiles,
synthesizes active hierarchical spans, and feeds them into MissionStore
so that live execution trees, active caller-callee pairs, and glowing
circuit lines animate in real-time on https://office.rifqisetiawan.my.id.
"""
from __future__ import annotations

import asyncio
import logging
import time
import uuid
from typing import Any, Dict, List, Set, Tuple

from .models import SpanCreate, SpanHeartbeat, SpanTransition
from .store import MissionStore

log = logging.getLogger("mission_control.live_bridge")

# Exact hierarchy routing matching frontend ROUTES in graphModel.ts
HIERARCHY_PATHS: Dict[str, List[Tuple[str, str]]] = {
    "jarvis": [("rifqi", "jarvis")],
    "vps-assistant": [("rifqi", "jarvis"), ("jarvis", "vps-assistant")],
    "senku": [("rifqi", "jarvis"), ("jarvis", "senku")],
    "swe-backend": [("rifqi", "jarvis"), ("jarvis", "swe-backend")],
    "swe-frontend": [("rifqi", "jarvis"), ("jarvis", "swe-frontend")],
    "tech-mentor": [("rifqi", "jarvis"), ("jarvis", "tech-mentor")],
    "data-engineer": [("rifqi", "jarvis"), ("jarvis", "senku"), ("senku", "data-engineer")],
    "paperwright": [("rifqi", "jarvis"), ("jarvis", "senku"), ("senku", "paperwright")],
    "swe-verifier": [("rifqi", "jarvis"), ("jarvis", "swe-backend"), ("swe-backend", "swe-verifier")],
    "ui-designer": [("rifqi", "jarvis"), ("jarvis", "swe-frontend"), ("swe-frontend", "ui-designer")],
    "devops-engineer": [("rifqi", "jarvis"), ("jarvis", "tech-mentor"), ("tech-mentor", "devops-engineer")],
    "github-manager": [("rifqi", "jarvis"), ("jarvis", "swe-backend"), ("swe-backend", "swe-verifier"), ("swe-verifier", "github-manager")],
    "office-lead": [("rifqi", "jarvis"), ("jarvis", "tech-mentor"), ("tech-mentor", "devops-engineer"), ("devops-engineer", "office-lead")],
}

CANONICAL_ALIASES: Dict[str, str] = {
    "vps-boss": "jarvis",
    "professor": "senku",
    "chief-architect": "tech-mentor",
    "swe-qa": "swe-verifier",
    "swe-coder": "swe-backend",
}


def resolve_canonical_agent(raw: str) -> str:
    cleaned = raw.strip().lower()
    return CANONICAL_ALIASES.get(cleaned, cleaned)


def infer_agent_from_goal(goal: str) -> str:
    low = goal.lower()
    if any(k in low for k in ["verifier", "qa", "audit", "forensik", "verify", "acceptance"]):
        return "swe-verifier"
    elif any(k in low for k in ["lakehouse", "duckdb", "parquet", "pipeline", "etl", "data-engineer"]):
        return "data-engineer"
    elif any(k in low for k in ["frontend", "ui", "ux", "react", "tailwind", "component", "css"]):
        return "swe-frontend"
    elif any(k in low for k in ["backend", "fastapi", "api", "postgres", "database", "acid", "sql"]):
        return "swe-backend"
    elif any(k in low for k in ["devops", "caddy", "systemd", "docker", "server", "gateway"]):
        return "devops-engineer"
    elif any(k in low for k in ["paper", "latex", "ieee", "tectonic", "scriptorium"]):
        return "paperwright"
    elif any(k in low for k in ["research", "riset", "sains", "academic"]):
        return "senku"
    elif any(k in low for k in ["github", "pr", "commit", "release"]):
        return "github-manager"
    return "vps-assistant"


class HermesLiveBridge:
    def __init__(self, store: MissionStore):
        self.store = store
        self.active_chains: Dict[str, Dict[str, Any]] = {}  # agent_id -> chain_data
        self._running = False
        self._task: asyncio.Task | None = None

    def start(self) -> None:
        if self._running:
            return
        self._running = True
        self._task = asyncio.create_task(self._loop())
        log.info("Hermes live telemetry bridge started")

    def stop(self) -> None:
        self._running = False
        if self._task and not self._task.done():
            self._task.cancel()

    async def _loop(self) -> None:
        # Give server time to bind and initialize
        await asyncio.sleep(1)
        while self._running:
            try:
                await self.sync_once()
            except asyncio.CancelledError:
                break
            except Exception as e:
                log.debug("Live bridge error: %s", e)
            await asyncio.sleep(2.0)

    async def sync_once(self) -> None:
        from src.server import harvest_live_sessions, _delegation_records

        # 1. Harvest live Hermes state
        live_sessions = await asyncio.to_thread(harvest_live_sessions, max_age_seconds=60)
        delegation_records = await asyncio.to_thread(_delegation_records, limit=10)

        active_agents: Set[str] = set()

        # Check live sessions (Hermes profile SQLite state.db)
        for p_name, sess in live_sessions.items():
            aid = resolve_canonical_agent(p_name)
            state = sess.get("state", "IDLE")
            age = sess.get("age_seconds", 999)
            if state in ("CODING", "AUDITING", "CRAWLING", "EXECUTING", "THINKING") and age <= 60:
                if aid in HIERARCHY_PATHS:
                    active_agents.add(aid)

        # Check live delegations (running tasks from manifest/logs)
        for rec in delegation_records:
            if rec.get("status") == "running":
                for child in rec.get("children", []):
                    if child.get("status") == "running":
                        agent = resolve_canonical_agent(child.get("agent", ""))
                        if agent in ("leaf", "unknown", ""):
                            agent = infer_agent_from_goal(child.get("goal", ""))
                        if agent in HIERARCHY_PATHS:
                            active_agents.add(agent)

        # 2. Update active chains or create new ones
        for aid in active_agents:
            if aid in self.active_chains:
                # Renew heartbeat for all spans in the active chain
                chain_info = self.active_chains[aid]
                for span_meta in chain_info["spans"]:
                    try:
                        span = await asyncio.to_thread(self.store.get_span, span_meta["span_id"])
                        await asyncio.to_thread(
                            self.store.heartbeat,
                            "runtime-dispatcher",
                            span_meta["span_id"],
                            SpanHeartbeat(
                                event_id=str(uuid.uuid4()),
                                expected_version=span["version"],
                                lease_seconds=60,
                            ),
                        )
                    except Exception:
                        pass
            else:
                # Create a new active chain for aid
                path = HIERARCHY_PATHS.get(aid)
                if not path:
                    continue

                mission_id = f"MISSION-{aid.upper()}-{uuid.uuid4().hex[:6]}"
                created_spans: List[Dict[str, Any]] = []
                parent_span_id: str | None = None

                try:
                    for idx, (caller, callee) in enumerate(path):
                        s_id = f"span-{idx}-{caller}-{callee}-{uuid.uuid4().hex[:8]}"
                        t_id = f"TASK-{callee.upper()}"
                        span_create = SpanCreate(
                            event_id=str(uuid.uuid4()),
                            span_id=s_id,
                            mission_id=mission_id,
                            task_id=t_id,
                            parent_span_id=parent_span_id,
                            caller=caller,
                            callee=callee,
                            lease_seconds=60,
                        )
                        res = await asyncio.to_thread(
                            self.store.create_span, "runtime-dispatcher", span_create
                        )
                        # Transition to running
                        await asyncio.to_thread(
                            self.store.transition_span,
                            "runtime-dispatcher",
                            s_id,
                            SpanTransition(
                                event_id=str(uuid.uuid4()),
                                expected_version=0,
                                state="running",
                                lease_seconds=60,
                            ),
                        )
                        created_spans.append({"span_id": s_id, "caller": caller, "callee": callee})
                        parent_span_id = s_id

                    self.active_chains[aid] = {
                        "mission_id": mission_id,
                        "spans": created_spans,
                    }
                except Exception as e:
                    log.debug("Failed creating chain for %s: %s", aid, e)

        # 3. Complete chains for agents that are no longer active
        retired_agents = [aid for aid in self.active_chains if aid not in active_agents]
        for aid in retired_agents:
            chain_info = self.active_chains.pop(aid, None)
            if not chain_info:
                continue
            # Complete in reverse (leaf -> parent -> root)
            for span_meta in reversed(chain_info["spans"]):
                try:
                    span = await asyncio.to_thread(self.store.get_span, span_meta["span_id"])
                    if span.get("state") in ("queued", "running", "waiting"):
                        await asyncio.to_thread(
                            self.store.transition_span,
                            "runtime-dispatcher",
                            span_meta["span_id"],
                            SpanTransition(
                                event_id=str(uuid.uuid4()),
                                expected_version=span["version"],
                                state="completed",
                                lease_seconds=60,
                            ),
                        )
                except Exception:
                    pass
