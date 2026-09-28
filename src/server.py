"""Hermes Sovereign Cockpit & 3D Virtual Office Backend Server.

Provides real-time telemetry, 13-agent roster, live tool call stream,
code diff inspector, and system vitals for the 3D WebGL Virtual Office.
"""

import os
import re
import json
import glob
import time
import shutil
import yaml
import subprocess
import sqlite3
import asyncio
import hashlib
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, Any, List, Optional, Set

from fastapi import FastAPI, HTTPException, Query, Request, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import HTMLResponse, JSONResponse, StreamingResponse
from pydantic import BaseModel

app = FastAPI(
    title="Hermes Sovereign Cockpit & 3D Virtual Office",
    description="Full operational execution transparency and 3D WebGL office engine for 13 AI agents",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

BASE_DIR = Path("/srv/hermes-control")
PROFILES_DIR = Path("/srv/apps/hermes/profiles")
FRONTEND_DIST = Path(__file__).resolve().parents[1] / "frontend" / "dist"
STATIC_DIR = FRONTEND_DIST if FRONTEND_DIST.exists() else (Path(__file__).resolve().parents[1] / "static")
STATIC_DIR.mkdir(parents=True, exist_ok=True)
KANBAN_ROOT = Path("/srv/apps/hermes/kanban")
KANBAN_GLOBAL_DB = Path("/srv/apps/hermes/kanban.db")
STALE_HEARTBEAT_SECONDS = int(os.getenv("COCKPIT_STALE_HEARTBEAT_SECONDS", "120"))
MAX_TRANSCRIPT_BYTES = 256_000

_SECRET_KEY_RE = re.compile(r"(?i)(authorization|api[-_]?key|access[-_]?token|refresh[-_]?token|password|passwd|secret|client[-_]?secret|private[-_]?key|cookie|credential|session)")
_SECRET_PATTERNS = [
    re.compile(r"\bsk-[A-Za-z0-9_-]{12,}\b"),
    re.compile(r"\beyJ[A-Za-z0-9_-]{10,}(?:\.[A-Za-z0-9_-]+){1,2}\b"),
    re.compile(r"(?i)\b(?:bearer|basic)\s+[A-Za-z0-9._~+/=-]{8,}"),
    re.compile(r"(?i)(?:api[-_]?key|token|password|passwd|secret|authorization)\s*[:=]\s*['\"]?[^\s,'\"}]{4,}"),
]


def redact_text(value: Any) -> str:
    """Redact credential-like material before it crosses the API boundary."""
    text = str(value if value is not None else "")
    for pattern in _SECRET_PATTERNS:
        text = pattern.sub("[REDACTED]", text)
    return text


def redact_payload(value: Any, key: str = "") -> Any:
    if _SECRET_KEY_RE.search(key):
        return "[REDACTED]"
    if isinstance(value, dict):
        return {str(k): redact_payload(v, str(k)) for k, v in value.items()}
    if isinstance(value, (list, tuple)):
        return [redact_payload(v) for v in value]
    if isinstance(value, str):
        return redact_text(value)
    return value


def _pid_alive(pid: Optional[int]) -> bool:
    if not pid or pid <= 0:
        return False
    try:
        os.kill(pid, 0)
        return True
    except (ProcessLookupError, PermissionError, OSError):
        return False


def _epoch(value: Any) -> Optional[float]:
    if value is None:
        return None
    if isinstance(value, (int, float)):
        return float(value)
    try:
        return datetime.fromisoformat(str(value).replace("Z", "+00:00")).timestamp()
    except (TypeError, ValueError):
        return None


def _liveness(last_heartbeat: Any, worker_pid: Optional[int], status: str, fallback_activity: Any = None,
              claim_expires: Any = None, worker_started_at: Any = None) -> Dict[str, Any]:
    now = time.time()
    heartbeat = _epoch(last_heartbeat) or _epoch(fallback_activity)
    age = max(0, int(now - heartbeat)) if heartbeat else None
    running = status.lower() in {"running", "in_progress", "in-progress", "claimed", "active"}
    pid_alive = _pid_alive(worker_pid) if worker_pid else None
    lease = _epoch(claim_expires)
    lease_expired = bool(lease is not None and lease <= now)
    stale = bool(running and (heartbeat is None or age > min(STALE_HEARTBEAT_SECONDS, 120) or
                              pid_alive is not True or lease_expired))
    if stale:
        reason = ("PID not alive" if pid_alive is False else "PID unavailable" if pid_alive is None else
                  "lease expired" if lease_expired else
                  (f"heartbeat is {age}s old" if age is not None else "no heartbeat"))
        label = f"⚠️ STALE ({reason})"
        state = "STALE"
    elif running and heartbeat and pid_alive is True:
        label, state = "Active", "ACTIVE"
    elif running:
        label, state = "Unknown", "UNKNOWN"
    else:
        label, state = "Idle", "IDLE"
    return {"is_stale": stale, "liveness": state, "liveness_label": label,
            "heartbeat_age_seconds": age, "pid_alive": pid_alive, "lease_expired": lease_expired,
            "observed_at": datetime.now(timezone.utc).isoformat(),
            "evidence": {"status": status, "heartbeat": last_heartbeat,
                         "worker_pid": worker_pid, "worker_started_at": worker_started_at,
                         "claim_expires": claim_expires}}


def _kanban_boards() -> List[Dict[str, Any]]:
    """Discover readable Hermes Kanban SQLite boards without mutating them."""
    candidates = [("default", "Hermes Global", KANBAN_GLOBAL_DB)]
    boards_dir = KANBAN_ROOT / "boards"
    if boards_dir.exists():
        for db_path in sorted(boards_dir.glob("*/kanban.db")):
            slug = db_path.parent.name
            candidates.append((slug, slug.replace("-", " ").title(), db_path))
    return [{"slug": slug, "name": name, "path": path} for slug, name, path in candidates if path.is_file()]


def _kanban_db(board: str) -> sqlite3.Connection:
    match = next((item for item in _kanban_boards() if item["slug"] == board), None)
    if not match:
        raise HTTPException(status_code=404, detail=f"Kanban board '{board}' not found")
    conn = sqlite3.connect(f"file:{match['path']}?mode=ro", uri=True)
    conn.row_factory = sqlite3.Row
    return conn


def _iso_timestamp(value: Optional[int]) -> Optional[str]:
    if value is None:
        return None
    return datetime.fromtimestamp(value, tz=timezone.utc).isoformat()


def _task_payload(row: sqlite3.Row, board: str, links: Optional[List[Dict[str, str]]] = None) -> Dict[str, Any]:
    item = dict(row)
    raw_heartbeat = item.get("last_heartbeat_at")
    raw_activity = raw_heartbeat or item.get("started_at") or item.get("created_at")
    item.update(_liveness(raw_heartbeat, item.get("worker_pid"), item.get("status", ""), raw_activity,
                          item.get("claim_expires"), item.get("worker_started_at")))
    item["execution_state"] = ({"ready": "QUEUED", "todo": "TODO", "blocked": "BLOCKED"}
                               .get(str(item.get("status", "")).lower(), item["liveness"]))
    for key in ("created_at", "started_at", "completed_at", "last_heartbeat_at", "worker_started_at", "claim_expires"):
        if key in item:
            item[key] = _iso_timestamp(item[key])
    item["board"] = board
    item["parents"] = [link["parent_id"] for link in (links or []) if link["child_id"] == item.get("id")]
    item["children"] = [link["child_id"] for link in (links or []) if link["parent_id"] == item.get("id")]
    return redact_payload(item)


def get_active_kanban_tasks() -> Dict[str, List[Dict[str, Any]]]:
    """Return every evidenced live run, grouped by profile (never queued assignments)."""
    active: Dict[str, List[Dict[str, Any]]] = {}
    for board in _kanban_boards():
        try:
            with _kanban_db(board["slug"]) as conn:
                rows = conn.execute("SELECT * FROM tasks WHERE assignee IS NOT NULL AND lower(status) IN ('running','in_progress','in-progress','claimed') ORDER BY last_heartbeat_at DESC").fetchall()
            for row in rows:
                task = _task_payload(row, board["slug"])
                if task["liveness"] == "ACTIVE":
                    active.setdefault(task["assignee"], []).append(task)
        except sqlite3.Error:
            continue
    return active

# 13 Dedicated Agent Spatial Assignments in 3D Office World Space
OFFICE_ZONES = {
    "vps-boss": {
        "zone_name": "Executive Command Suite",
        "desk_pos": [0, 0, -10],
        "chair_color": "#1e293b",
        "accent_color": "#3b82f6",
        "avatar_archetype": "orchestrator",
        "rotation": 0
    },
    "professor": {
        "zone_name": "Research Library & Alcove",
        "desk_pos": [-12, 0, -8],
        "chair_color": "#312e81",
        "accent_color": "#818cf8",
        "avatar_archetype": "scientist",
        "rotation": 0.5
    },
    "chief-architect": {
        "zone_name": "Systems Architecture Pod",
        "desk_pos": [-6, 0, -4],
        "chair_color": "#1e1b4b",
        "accent_color": "#6366f1",
        "avatar_archetype": "architect",
        "rotation": 0
    },
    "swe-backend": {
        "zone_name": "Software Factory — Backend",
        "desk_pos": [-6, 0, 4],
        "chair_color": "#064e3b",
        "accent_color": "#10b981",
        "avatar_archetype": "engineer",
        "rotation": 3.14
    },
    "swe-frontend": {
        "zone_name": "Software Factory — Client UI",
        "desk_pos": [6, 0, 4],
        "chair_color": "#134e4a",
        "accent_color": "#14b8a6",
        "avatar_archetype": "frontend",
        "rotation": 3.14
    },
    "swe-verifier": {
        "zone_name": "Independent Cleanroom Lab",
        "desk_pos": [12, 0, -8],
        "chair_color": "#022c22",
        "accent_color": "#059669",
        "avatar_archetype": "verifier",
        "rotation": -0.5
    },
    "data-engineer": {
        "zone_name": "Lakehouse & Marts Deck",
        "desk_pos": [-12, 0, 2],
        "chair_color": "#78350f",
        "accent_color": "#f59e0b",
        "avatar_archetype": "data",
        "rotation": 1.57
    },
    "devops-engineer": {
        "zone_name": "Server Infrastructure Room",
        "desk_pos": [12, 0, 2],
        "chair_color": "#0f172a",
        "accent_color": "#64748b",
        "avatar_archetype": "sre",
        "rotation": -1.57
    },
    "ui-designer": {
        "zone_name": "Creative Design Studio",
        "desk_pos": [6, 0, -4],
        "chair_color": "#831843",
        "accent_color": "#ec4899",
        "avatar_archetype": "designer",
        "rotation": 0
    },
    "tech-mentor": {
        "zone_name": "Coffee Bar & Discussion Lounge",
        "desk_pos": [0, 0, 10],
        "chair_color": "#0c4a6e",
        "accent_color": "#0284c7",
        "avatar_archetype": "mentor",
        "rotation": 3.14
    },
    "github-manager": {
        "zone_name": "Release Gate & Vault Airlock",
        "desk_pos": [10, 0, 9],
        "chair_color": "#171717",
        "accent_color": "#737373",
        "avatar_archetype": "release",
        "rotation": -2.35
    },
    "vps-assistant": {
        "zone_name": "Concierge & Operations Station",
        "desk_pos": [-10, 0, 9],
        "chair_color": "#713f12",
        "accent_color": "#d97706",
        "avatar_archetype": "ops",
        "rotation": 2.35
    },
    "paperwright": {
        "zone_name": "IEEE Scientific Scriptorium",
        "desk_pos": [-14, 0, -3],
        "chair_color": "#450a0a",
        "accent_color": "#ef4444",
        "avatar_archetype": "scholar",
        "rotation": 0.8
    },
    "office-lead": {
        "zone_name": "Observatory & Virtual Systems Deck",
        "desk_pos": [-14, 0, 8],
        "chair_color": "#1e1b4b",
        "accent_color": "#6366f1",
        "avatar_archetype": "lead",
        "rotation": -0.8
    }
}


AGENT_DISPLAY_NAME = {
    "vps-boss": "Jarvis",
    "professor": "Senku",
    "senku": "Senku",
    "swe-verifier": "swe-QA",
    "swe-QA": "swe-QA",
    "office-lead": "office-lead",
    "chief-architect": "chief-architect",
    "swe-backend": "swe-backend",
    "swe-frontend": "swe-frontend",
    "data-engineer": "data-engineer",
    "devops-engineer": "devops-engineer",
    "ui-designer": "ui-designer",
    "tech-mentor": "tech-mentor",
    "github-manager": "github-manager",
    "vps-assistant": "vps-assistant",
    "paperwright": "paperwright"
}


def harvest_live_sessions(max_age_seconds: int = 60) -> Dict[str, Dict[str, Any]]:
    """Inspects SQLite state.db of all Hermes profiles for real-time running sessions and tool execution."""
    live_map: Dict[str, Dict[str, Any]] = {}
    now = time.time()
    
    if not PROFILES_DIR.exists():
        return live_map

    for p_dir in PROFILES_DIR.iterdir():
        if not p_dir.is_dir():
            continue
        p_name = p_dir.name
        db_file = p_dir / "state.db"
        if not db_file.exists():
            continue
            
        try:
            uri = f"file:{db_file}?mode=ro"
            with sqlite3.connect(uri, uri=True, timeout=0.5) as conn:
                conn.row_factory = sqlite3.Row
                sess = conn.execute("""
                    SELECT id, model, last_activity_at, last_activity_description, message_count, tool_call_count
                    FROM sessions
                    WHERE last_activity_at IS NOT NULL
                    ORDER BY last_activity_at DESC
                    LIMIT 1
                """).fetchone()
                
                if not sess or not sess["last_activity_at"]:
                    continue
                    
                age = now - float(sess["last_activity_at"])
                if age > max_age_seconds:
                    continue
                    
                msg = conn.execute("""
                    SELECT role, content, timestamp
                    FROM messages
                    WHERE session_id = ?
                    ORDER BY rowid DESC
                    LIMIT 1
                """, (sess["id"],)).fetchone()
                
                desc = sess["last_activity_description"] or ""
                desc_lower = desc.lower()
                role = msg["role"] if msg else "assistant"
                content = (msg["content"] or "")[:120] if msg else ""
                
                if any(k in desc_lower for k in ["patch", "write", "search_files", "read_file", "git"]):
                    state = "CODING"
                    status_desc = f"Writing/Editing: {desc[:60]}"
                elif any(k in desc_lower for k in ["pytest", "test", "audit", "verify"]):
                    state = "AUDITING"
                    status_desc = f"Running QA Audit: {desc[:60]}"
                elif any(k in desc_lower for k in ["crawl", "web", "fetch", "scrape", "search"]):
                    state = "CRAWLING"
                    status_desc = f"Searching/Crawling: {desc[:60]}"
                elif "tool" in desc_lower or role == "tool":
                    state = "EXECUTING"
                    status_desc = f"Executing Tool: {desc[:60]}"
                else:
                    state = "THINKING"
                    status_desc = f"Reasoning: {desc[:60] or 'Processing task prompt'}"
                    
                iso_time = datetime.fromtimestamp(sess["last_activity_at"], timezone.utc).isoformat()
                
                event_detail = status_desc
                if content and role == "user":
                    event_detail = f"User prompt: {content[:60]}..."
                elif desc:
                    event_detail = desc[:80]
                    
                display_name = AGENT_DISPLAY_NAME.get(p_name, p_name)
                
                live_map[p_name] = {
                    "agent": p_name,
                    "display_name": display_name,
                    "session_id": sess["id"],
                    "model": sess["model"],
                    "state": state,
                    "status_desc": status_desc,
                    "age_seconds": round(age, 1),
                    "iso_time": iso_time,
                    "event": {
                        "id": f"{sess['id']}:{sess['tool_call_count']}:live",
                        "time": iso_time,
                        "observed_at": sess["last_activity_at"],
                        "agent": p_name,
                        "delegation_id": sess["id"],
                        "type": "tool_call" if state in ("CODING", "AUDITING", "CRAWLING", "EXECUTING") else "thought",
                        "detail": event_detail,
                        "goal": event_detail,
                        "station": categorize_tool_station(desc, p_name)
                    }
                }
        except Exception:
            continue
            
    return live_map


def get_agent_models_map() -> Dict[str, str]:
    """Reads configured models per profile from config.yaml or agents.yaml."""
    models_map = {}
    for p in OFFICE_ZONES.keys():
        cfg_file = PROFILES_DIR / p / "config.yaml"
        if cfg_file.exists():
            try:
                with open(cfg_file, "r") as fp:
                    cfg = yaml.safe_load(fp) or {}
                    m = cfg.get("model", {}).get("default") or cfg.get("providers", {}).get("9router", {}).get("default_model")
                    if m:
                        models_map[p] = m
            except Exception:
                pass
        if p not in models_map:
            models_map[p] = "ag/gemini-3.8-flash-high"
    return models_map


def get_git_diff_summary(repo_path: str) -> Dict[str, Any]:
    """Extracts recent git commit and unified diff from repo."""
    try:
        p = Path(repo_path)
        if not (p / ".git").exists():
            return {"status": "no_git"}
        commit_hash = subprocess.check_output("git log -1 --pretty=%h", shell=True, cwd=str(p), text=True, stderr=subprocess.DEVNULL).strip()
        commit_msg = subprocess.check_output("git log -1 --pretty=%s", shell=True, cwd=str(p), text=True, stderr=subprocess.DEVNULL).strip()
        author = subprocess.check_output("git log -1 --pretty=%an", shell=True, cwd=str(p), text=True, stderr=subprocess.DEVNULL).strip()
        date_str = subprocess.check_output("git log -1 --pretty=%cd", shell=True, cwd=str(p), text=True, stderr=subprocess.DEVNULL).strip()
        diff = subprocess.check_output(
            ["git", "diff", "--no-ext-diff", "HEAD~1..HEAD"],
            cwd=str(p), text=True, stderr=subprocess.DEVNULL
        )
        return {
            "status": "success",
            "repo_name": p.name,
            "commit": commit_hash,
            "message": commit_msg,
            "author": author,
            "date": date_str,
            # Intentionally untruncated: the cockpit is an execution-transparency UI.
            "diff": diff if diff else "(Clean working tree / no diff in commit)",
            "diff_snippet": diff if diff else "(Clean working tree / no diff in commit)"
        }
    except Exception as e:
        return {"status": "error", "message": str(e)}


def parse_delegation_stream(limit: int = 25) -> List[Dict[str, Any]]:
    """Parses live delegation transcripts into structured telemetry events."""
    live_dirs = sorted(glob.glob("/srv/apps/hermes/profiles/vps-boss/cache/delegation/live/*"), key=os.path.getmtime)
    events = []
    
    for d in live_dirs[-12:]:
        log_f = Path(d) / "task-0.log"
        if not log_f.exists():
            continue
        deleg_id = Path(d).name
        try:
            with open(log_f, "r", encoding="utf-8", errors="replace") as fp:
                lines = fp.readlines()
        except Exception:
            continue

        agent_target = "unknown"
        goal_text = ""
        for line in lines[:10]:
            if "Role:" in line:
                m = re.search(r"Role:\s*([a-zA-Z0-9_\-]+)", line)
                if m:
                    agent_target = m.group(1)
            if line.startswith("goal:"):
                goal_text = line.replace("goal:", "").strip()

        log_mtime = log_f.stat().st_mtime
        for line_number, line in enumerate(lines, start=1):
            line_str = line.strip()
            if not line_str:
                continue
            if " tool " in line_str or "-> " in line_str:
                parts = line_str.split("|", 2)
                t_str = parts[0].strip() if len(parts) > 0 else ""
                detail = parts[-1].strip() if len(parts) > 1 else line_str
                station = categorize_tool_station(detail, agent_target)
                events.append({
                    "id": f"{deleg_id}:{line_number}:tool_call",
                    "time": t_str,
                    "observed_at": log_mtime,
                    "agent": agent_target,
                    "delegation_id": deleg_id,
                    "type": "tool_call",
                    "detail": detail,
                    "goal": goal_text,
                    "station": station
                })
            elif " result " in line_str:
                parts = line_str.split("|", 2)
                t_str = parts[0].strip() if len(parts) > 0 else ""
                detail = parts[-1].strip() if len(parts) > 1 else line_str
                station = categorize_tool_station(detail, agent_target)
                events.append({
                    "id": f"{deleg_id}:{line_number}:tool_result",
                    "time": t_str,
                    "observed_at": log_mtime,
                    "agent": agent_target,
                    "delegation_id": deleg_id,
                    "type": "tool_result",
                    "detail": detail,
                    "goal": goal_text,
                    "station": station
                })

    return events[-limit:]


def categorize_tool_station(detail: str, agent_id: str) -> str:
    low = detail.lower()
    if any(k in low for k in ["web_search", "crawl", "browser", "scrape", "http"]):
        return "crawler"
    elif any(k in low for k in ["pytest", "test", "audit", "verify", "verifier"]):
        return "quarantine"
    elif any(k in low for k in ["duckdb", "parquet", "lakehouse", "snowflake", "sql", "pihps"]):
        return "lakehouse"
    elif any(k in low for k in ["read_file", "search_files", "doc", "paper", "arxiv", "library"]):
        return "library"
    elif any(k in low for k in ["ui", "preview", "html", "css", "color", "design"]):
        return "design"
    return "compiler"


def extract_recent_conversations(limit: int = 15) -> List[Dict[str, Any]]:
    """Extracts high-level dialogue orders and exchanges between vps-boss and subagents."""
    live_dirs = sorted(glob.glob("/srv/apps/hermes/profiles/vps-boss/cache/delegation/live/*"), key=os.path.getmtime)
    convos = []

    for d in live_dirs[-limit:]:
        log_f = Path(d) / "task-0.log"
        manifest_f = Path(d) / "manifest.json"
        if not log_f.exists():
            continue
        try:
            with open(log_f, "r", encoding="utf-8", errors="replace") as fp:
                content = fp.read()
        except Exception:
            continue

        manifest = {}
        if manifest_f.exists():
            try:
                with open(manifest_f, "r", encoding="utf-8", errors="replace") as mfp:
                    manifest = json.load(mfp)
            except Exception:
                pass

        m_goal = re.search(r"goal:\s*(.*?)\n\s*started:", content, re.DOTALL)
        goal = m_goal.group(1).strip() if m_goal else ""
        m_role = re.search(r"Role:\s*([a-zA-Z0-9_\-]+)", content)
        agent = m_role.group(1) if m_role else "subagent"
        m_time = re.search(r"started:\s*([0-9\- :]+)", content)
        started = m_time.group(1) if m_time else manifest.get("started", "")
        tools = list(set(re.findall(r"->\s*([a-zA-Z0-9_]+)\(", content)))

        summary_matches = re.findall(r"assistant\s*\|\s*(.*?)(?=\n\d{2}:\d{2}:\d{2}|\Z)", content, re.DOTALL)
        reply = summary_matches[-1].strip() if summary_matches else ""

        # Determine if actively running
        completed_at = manifest.get("completed")
        tasks_list = manifest.get("tasks", [])
        status = tasks_list[0].get("status", "completed") if tasks_list else ("completed" if completed_at else "running")
        is_running = (status == "running" and not completed_at)

        # The manifest uses host-local timestamps without an offset; log mtime is the
        # unambiguous source for the 60-second live-completion window.
        completed_recently = bool(completed_at) and (time.time() - log_f.stat().st_mtime) < 60

        convos.append({
            "id": Path(d).name,
            "sender": "vps-boss",
            "receiver": agent,
            "started_at": started,
            "completed_at": completed_at,
            "status": status,
            "is_running": is_running,
            "completed_recently": completed_recently,
            "is_live": is_running or completed_recently,
            "boss_order": goal,
            "subagent_reply": reply,
            "tools_used": tools
        })

    return list(reversed(convos))


def build_hierarchical_dag(limit: int = 10) -> List[Dict[str, Any]]:
    """Builds hierarchical execution trees of delegations and tool calls."""
    live_dirs = sorted(glob.glob("/srv/apps/hermes/profiles/vps-boss/cache/delegation/live/*"), key=os.path.getmtime)
    trees = []

    for d in live_dirs[-limit:]:
        log_f = Path(d) / "task-0.log"
        manifest_f = Path(d) / "manifest.json"
        if not log_f.exists():
            continue
        
        deleg_id = Path(d).name
        manifest = {}
        if manifest_f.exists():
            try:
                with open(manifest_f, "r", encoding="utf-8") as mfp:
                    manifest = json.load(mfp)
            except Exception:
                pass

        try:
            with open(log_f, "r", encoding="utf-8", errors="replace") as fp:
                lines = fp.readlines()
        except Exception:
            continue

        goal = manifest.get("tasks", [{}])[0].get("goal", "") if manifest.get("tasks") else ""
        started = manifest.get("started", "")
        completed = manifest.get("completed", "")
        model = manifest.get("model", "ag/gemini-3.8-flash-high")
        provider = manifest.get("provider", "9router")

        agent_target = "unknown"
        for line in lines[:15]:
            if "Role:" in line:
                m = re.search(r"Role:\s*([a-zA-Z0-9_\-]+)", line)
                if m:
                    agent_target = m.group(1)
            if not goal and line.startswith("goal:"):
                goal = line.replace("goal:", "").strip()
            if not started and line.startswith("started:"):
                started = line.replace("started:", "").strip()

        if agent_target == "unknown":
            low_goal = goal.lower()
            if "professor" in low_goal or "riset" in low_goal or "blueprint" in low_goal:
                agent_target = "professor"
            elif "swe-verifier" in low_goal or "verifikasi" in low_goal or "qa" in low_goal:
                agent_target = "swe-verifier"
            elif "ui-designer" in low_goal or "desain" in low_goal:
                agent_target = "ui-designer"
            elif "data-engineer" in low_goal or "lakehouse" in low_goal:
                agent_target = "data-engineer"
            elif "devops" in low_goal or "docker" in low_goal or "systemd" in low_goal:
                agent_target = "devops-engineer"
            elif "tech-mentor" in low_goal or "mentor" in low_goal:
                agent_target = "tech-mentor"
            elif "chief-architect" in low_goal or "arsitektur" in low_goal:
                agent_target = "chief-architect"
            else:
                agent_target = "vps-assistant"

        steps = []
        current_step = None
        for line in lines:
            line_str = line.strip()
            if not line_str:
                continue
            if " tool " in line_str or "-> " in line_str:
                parts = line_str.split("|", 2)
                t_str = parts[0].strip() if len(parts) > 0 else ""
                detail = parts[-1].strip() if len(parts) > 1 else line_str
                m_tool = re.search(r"->\s*([a-zA-Z0-9_]+)\((.*)\)", detail, re.DOTALL)
                t_name = m_tool.group(1) if m_tool else "tool"
                t_args = m_tool.group(2) if m_tool else detail
                current_step = {
                    "id": f"step-{len(steps)+1}",
                    "time": t_str,
                    "tool": t_name,
                    "args": t_args,
                    "status": "running",
                    "duration": None,
                    "output": None
                }
                steps.append(current_step)
            elif " result " in line_str:
                parts = line_str.split("|", 2)
                res_detail = parts[-1].strip() if len(parts) > 1 else line_str
                is_error = "ERROR" in res_detail or "failed" in res_detail.lower() or '"exit_code": [^0]' in res_detail
                status = "error" if is_error else "ok"
                m_dur = re.search(r"(\d+\.?\d*s)", res_detail)
                dur = m_dur.group(1) if m_dur else ""
                if current_step:
                    current_step["status"] = status
                    current_step["duration"] = dur
                    current_step["output"] = res_detail
                    current_step = None
                else:
                    steps.append({
                        "id": f"step-{len(steps)+1}",
                        "time": "",
                        "tool": "result",
                        "status": status,
                        "duration": dur,
                        "output": res_detail
                    })

        errors = [s for s in steps if s.get("status") == "error"]
        trees.append({
            "delegation_id": deleg_id,
            "root_agent": "vps-boss",
            "agent": agent_target,
            "model": model,
            "provider": provider,
            "goal": goal,
            "started_at": started,
            "completed_at": completed,
            "status": "error" if errors else "completed",
            "total_steps": len(steps),
            "error_count": len(errors),
            "steps": steps
        })

    return list(reversed(trees))


def _bounded_log_lines(path: Path, maximum: int = MAX_TRANSCRIPT_BYTES) -> tuple[List[str], bool]:
    size = path.stat().st_size
    with path.open("rb") as stream:
        if size > maximum:
            stream.seek(size - maximum)
            stream.readline()
        raw = stream.read(maximum)
    return raw.decode("utf-8", errors="replace").splitlines(), size > maximum


def _delegation_records(limit: int = 50) -> List[Dict[str, Any]]:
    """Unified bounded adapter for every profile, manifest, and child log."""
    roots = list(PROFILES_DIR.glob("*/cache/delegation/live/*"))
    roots.sort(key=lambda p: p.stat().st_mtime, reverse=True)
    records = []
    for root in roots[:limit]:
        manifest_path, manifest, gap = root / "manifest.json", {}, None
        try:
            manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError) as exc:
            gap = type(exc).__name__
        delegation_id = str(manifest.get("delegation_id") or root.name)
        declared = {int(t.get("index", i)): t for i, t in enumerate(manifest.get("tasks") or [])}
        indexes = set(declared)
        for log in root.glob("task-*.log"):
            match = re.fullmatch(r"task-(\d+)\.log", log.name)
            if match:
                indexes.add(int(match.group(1)))
        children = []
        for idx in sorted(indexes):
            task, log_path = declared.get(idx, {}), root / f"task-{idx}.log"
            lines, truncated = _bounded_log_lines(log_path) if log_path.is_file() else ([], False)
            role = task.get("profile") or task.get("agent") or task.get("role")
            if not role:
                match = next((re.search(r"Role:\s*([\w-]+)", line) for line in lines[:20] if "Role:" in line), None)
                role = match.group(1) if match else "unknown"
            status = {"done": "completed", "error": "failed"}.get(str(task.get("status") or "unknown").lower(), str(task.get("status") or "unknown").lower())
            status = status if status in {"running", "completed", "failed", "stalled", "unknown"} else "unknown"
            mtime = log_path.stat().st_mtime if log_path.is_file() else manifest_path.stat().st_mtime if manifest_path.exists() else root.stat().st_mtime
            if status == "running" and time.time() - mtime > min(STALE_HEARTBEAT_SECONDS, 120):
                status = "stalled"
            steps, pending = [], None
            for number, line in enumerate(lines, 1):
                parts = line.strip().split("|", 2)
                detail, timestamp = parts[-1].strip(), parts[0].strip() if len(parts) > 1 else None
                call = re.search(r"->\s*([A-Za-z0-9_]+)\(", detail)
                if " tool " in line or call:
                    pending = {"id": f"{delegation_id}:{idx}:{number}", "type": "tool_start", "tool": call.group(1) if call else "tool", "timestamp": timestamp, "status": "running", "source": f"task-{idx}.log", "detail": redact_text(detail)}
                    steps.append(pending)
                elif " result " in line:
                    steps.append({"id": f"{delegation_id}:{idx}:{number}", "type": "tool_result", "tool": pending.get("tool") if pending else "result", "timestamp": timestamp, "status": "observed", "source": f"task-{idx}.log", "detail": redact_text(detail)})
                    if pending:
                        pending["status"], pending = "completed", None
            children.append(redact_payload({"id": f"{delegation_id}:{idx}", "task_idx": idx, "session_id": task.get("session_id"), "tool_call_id": task.get("tool_call_id"), "parent_id": delegation_id, "agent": role, "goal": task.get("goal", ""), "status": status, "exit_reason": task.get("exit_reason"), "last_activity_at": _iso_timestamp(int(mtime)), "log_available": log_path.is_file(), "log_truncated": truncated, "steps": steps}))
        statuses = {child["status"] for child in children}
        overall = "failed" if "failed" in statuses else "running" if "running" in statuses else "stalled" if "stalled" in statuses else "completed" if children and statuses == {"completed"} else "unknown"
        records.append(redact_payload({"id": delegation_id, "delegation_id": delegation_id, "profile": root.parents[3].name, "parent_id": manifest.get("parent_id"), "started_at": manifest.get("started"), "completed_at": manifest.get("completed"), "model": manifest.get("model"), "provider": manifest.get("provider"), "status": overall, "source": str(manifest_path), "data_gap": gap, "parallel": len(children) > 1, "children": children}))
    return records


def parse_delegation_stream(limit: int = 25) -> List[Dict[str, Any]]:
    history_events = []
    for record in _delegation_records(limit):
        for child in record["children"]:
            for step in child["steps"]:
                step_time = step.get("timestamp") or step.get("time") or ""
                history_events.append({
                    **step,
                    "time": step_time,
                    "observed_at": step.get("observed_at") or step_time,
                    "agent": child["agent"],
                    "delegation_id": record["delegation_id"],
                    "task_idx": child["task_idx"],
                    "goal": child["goal"],
                    "station": categorize_tool_station(step.get("detail", ""), child["agent"])
                })

    # Live session events from active Hermes profiles
    live_sessions = harvest_live_sessions(max_age_seconds=60)
    live_events = [ls["event"] for ls in live_sessions.values()]

    if live_events:
        keep_history = max(0, limit - len(live_events))
        return history_events[-keep_history:] + live_events
    return history_events[-limit:]


def extract_recent_conversations(limit: int = 15) -> List[Dict[str, Any]]:
    convos = []
    live_sessions = harvest_live_sessions(max_age_seconds=60)
    for p_name, ls in live_sessions.items():
        convos.append({
            "id": f"live_{ls['session_id'][:12]}",
            "sender": "user" if p_name == "vps-boss" else "vps-boss",
            "receiver": p_name,
            "started_at": ls["iso_time"][:19].replace("T", " "),
            "completed_at": None,
            "status": "running",
            "is_running": True,
            "is_live": True,
            "completed_recently": False,
            "boss_order": ls["status_desc"],
            "subagent_reply": "",
            "tools_used": [ls["state"].lower()]
        })
    convos.extend([
        {"id": r["id"], "sender": r["profile"], "receiver": c["agent"], "started_at": r["started_at"], "completed_at": r["completed_at"], "status": c["status"], "is_running": c["status"] == "running", "is_live": c["status"] == "running", "completed_recently": False, "boss_order": c["goal"], "subagent_reply": "", "tools_used": list(dict.fromkeys(s["tool"] for s in c["steps"]))}
        for r in _delegation_records(limit)
        for c in r["children"]
    ])
    return convos[:limit]


def build_hierarchical_dag(limit: int = 10) -> List[Dict[str, Any]]:
    return [{"delegation_id": r["delegation_id"], "root_agent": r["profile"], "agent": c["agent"], "model": r["model"], "provider": r["provider"], "goal": c["goal"], "started_at": r["started_at"], "completed_at": r["completed_at"], "status": c["status"], "total_steps": len(c["steps"]), "error_count": int(c["status"] == "failed"), "steps": c["steps"]} for r in _delegation_records(limit) for c in r["children"]][:limit]


def extract_execution_errors(limit: int = 25) -> List[Dict[str, Any]]:
    """Scans recent delegation logs for failed commands, errors, and warnings."""
    dags = build_hierarchical_dag(limit=15)
    errors = []
    for dag in dags:
        for s in dag.get("steps", []):
            if s.get("status") == "error":
                errors.append({
                    "delegation_id": dag["delegation_id"],
                    "agent": dag["agent"],
                    "model": dag["model"],
                    "time": s["time"],
                    "tool": s["tool"],
                    "command": s["args"] if s.get("args") else "",
                    "error_output": s["output"] if s.get("output") else "Execution failure",
                    "severity": "critical" if "command not found" in str(s.get("output", "")) else "warning"
                })
    return errors[:limit]


@app.get("/health")
def health_check() -> Dict[str, Any]:
    return {
        "status": "healthy",
        "service": "agent-cockpit-engine",
        "version": "1.0.0",
        "timestamp": datetime.now(timezone.utc).isoformat()
    }


@app.get("/api/v1/agents/roster")
def get_agents_roster() -> Dict[str, Any]:
    """Returns all 14 agents with real models, status, active task, and 3D coordinates."""
    models_map = get_agent_models_map()
    events = parse_delegation_stream(150)
    active_kanban = get_active_kanban_tasks()
    live_sessions = harvest_live_sessions(max_age_seconds=60)
    
    # Check latest activity per agent
    latest_agent_event = {}
    for ev in events:
        ag = ev.get("agent")
        if ag and ag in OFFICE_ZONES:
            latest_agent_event[ag] = ev

    # Load agent registry
    agents_yaml_path = BASE_DIR / "agents.yaml"
    roles_meta = {}
    if agents_yaml_path.exists():
        with open(agents_yaml_path, "r") as fp:
            data = yaml.safe_load(fp) or {}
            for a in data.get("agents", []):
                roles_meta[a["name"]] = a

    roster = []
    for agent_id, zone_data in OFFICE_ZONES.items():
        meta = roles_meta.get(agent_id, {})
        model_name = models_map.get(agent_id, "ag/gemini-3.8-flash-high")
        last_ev = latest_agent_event.get(agent_id)
        live_sess = live_sessions.get(agent_id)
        display_name = AGENT_DISPLAY_NAME.get(agent_id, agent_id)

        # Active Project & Phase mapping
        project_map = {
            "professor": {"project": "Enterprise Agentic Research", "phase": "SOTA 2026 Deep Research & Literature Grounding"},
            "swe-backend": {"project": "National Food Lakehouse", "phase": "Phase 4 Read-Only API Hardening (:8097)"},
            "swe-verifier": {"project": "Global Quality Assurance", "phase": "Independent QA Forensic Certification"},
            "data-engineer": {"project": "National Food Lakehouse", "phase": "Phase 4 Lineage & Fail-Closed Ingestion"},
            "devops-engineer": {"project": "VPS Infrastructure", "phase": "Caddy Gateway & Ingress Isolation (:8097/:8085)"},
            "vps-boss": {"project": "Rifqi Studio Orchestration", "phase": "Executive Mission Control & Autonomous Routing"},
            "ui-designer": {"project": "Design Engineering", "phase": "Anti-AI-Slop Visual Systems & Prototypes"},
            "tech-mentor": {"project": "Technical Mentorship", "phase": "Interactive Architectural Explanations"},
            "github-manager": {"project": "Global Git Releases", "phase": "Clean Commit Hygiene & Zero-AI Audit"},
            "paperwright": {"project": "OpenWikiForge Research", "phase": "IEEEtran LaTeX Manuscript Compilation"},
            "swe-frontend": {"project": "National Food Lakehouse / Office", "phase": "Phase 4 Visual Dashboard & Living Stronghold"},
            "vps-assistant": {"project": "General Operations", "phase": "Server Automation & Utility Scripts"},
            "office-lead": {"project": "Agentic AI Office", "phase": "Real-time Telemetry & Stronghold 2D/3D Engine"}
        }
        proj_info = project_map.get(agent_id, {"project": "Global Control", "phase": "Standard Active"})

        # Dynamic state inference priority:
        active_runs = active_kanban.get(agent_id, [])
        kanban_task = active_runs[0] if active_runs else None

        if kanban_task:
            state = "EXECUTING"
            status_desc = f"Kanban {kanban_task['id']}: {kanban_task['title']}"
            proj_info = {
                "project": kanban_task["board"].replace("-", " ").title(),
                "phase": f"Kanban · {kanban_task['status'].replace('_', ' ').title()} · {kanban_task['title']}",
            }
        elif live_sess:
            state = live_sess["state"]
            status_desc = f"{display_name} • {live_sess['status_desc']}"
            last_ev = live_sess["event"]
            proj_info = {"project": "Live Session Interaction", "phase": f"Active: {live_sess['state']}"}
        elif last_ev:
            if "tool_call" in last_ev.get("type", ""):
                dt = last_ev.get("detail", "").lower()
                if "web_search" in dt or "crawl" in dt or "fetch" in dt:
                    state = "CRAWLING"
                    status_desc = f"Crawling: {last_ev.get('detail')[:60]}"
                elif "patch" in dt or "write_file" in dt or "git" in dt:
                    state = "CODING"
                    status_desc = f"Writing Code: {last_ev.get('detail')[:60]}"
                elif "pytest" in dt or "verify" in dt or "test" in dt:
                    state = "AUDITING"
                    status_desc = f"Running QA Audit: {last_ev.get('detail')[:60]}"
                else:
                    state = "EXECUTING"
                    status_desc = f"Executing Tool: {last_ev.get('detail')[:60]}"
            else:
                state = "THINKING"
                status_desc = "Reasoning & Analyzing Task Output"
            proj_info = {"project": "Delegation Execution", "phase": f"Task: {last_ev.get('goal', '')[:40]}"}
        else:
            state = "IDLE"
            status_desc = f"Standing by at {zone_data['zone_name']}"

        roster.append({
            "id": agent_id,
            "name": display_name,
            "alias": agent_id,
            "role": meta.get("role", "Specialist Agent").replace("_", " ").title(),
            "model": model_name,
            "provider": "9Router Local Loopback",
            "state": state,
            "status_desc": status_desc,
            "project": proj_info["project"],
            "phase": proj_info["phase"],
            "zone": zone_data["zone_name"],
            "position": zone_data["desk_pos"],
            "rotation": zone_data["rotation"],
            "accent_color": zone_data["accent_color"],
            "chair_color": zone_data["chair_color"],
            "avatar_archetype": zone_data["avatar_archetype"],
            "responsibilities": meta.get("responsibilities", ["Autonomous system operations"]),
            "latest_activity": last_ev or ({
                "type": "kanban_task",
                "detail": status_desc,
                "time": kanban_task.get("created_at"),
            } if kanban_task else None),
            "kanban_task": kanban_task,
            "active_runs": active_runs,
            "observed_at": datetime.now(timezone.utc).isoformat()
        })

    return {
        "status": "success",
        "total_agents": len(roster),
        "agents": roster,
        "timestamp": datetime.now(timezone.utc).isoformat()
    }


@app.get("/api/v1/telemetry/live")
def get_live_telemetry() -> Dict[str, Any]:
    """Returns streaming events of agent actions, tool calls, and results."""
    events = parse_delegation_stream(30)
    return {
        "status": "success",
        "total_events": len(events),
        "events": list(reversed(events)),
        "timestamp": datetime.now(timezone.utc).isoformat()
    }


@app.get("/api/v1/diff/latest")
def get_latest_code_diff() -> Dict[str, Any]:
    """Returns the most recent unified git code diff from active projects."""
    food_diff = get_git_diff_summary("/srv/hermes-control/services/food-inflation-lakehouse")
    cockpit_diff = get_git_diff_summary("/srv/hermes-control")
    
    return {
        "status": "success",
        "projects": {
            "food_inflation_lakehouse": food_diff,
            "hermes_control": cockpit_diff
        },
        "timestamp": datetime.now(timezone.utc).isoformat()
    }


@app.get("/api/v1/vitals")
def get_system_vitals() -> Dict[str, Any]:
    """Returns real-time host resource metrics for the 3D HUD."""
    total_d, used_d, free_d = shutil.disk_usage("/")
    mem = {}
    with open("/proc/meminfo") as f:
        for line in f:
            parts = line.split(":")
            if len(parts) == 2:
                mem[parts[0].strip()] = int(parts[1].split()[0])
    total_m = mem.get("MemTotal", 1) / (1024 * 1024)
    avail_m = mem.get("MemAvailable", 1) / (1024 * 1024)
    used_m = total_m - avail_m
    load1, load5, _ = os.getloadavg()

    with open("/proc/uptime") as f:
        uptime_sec = float(f.readline().split()[0])
    days = int(uptime_sec // 86400)
    hours = int((uptime_sec % 86400) // 3600)
    mins = int((uptime_sec % 3600) // 60)

    return {
        "cpu_cores": os.cpu_count() or 4,
        "load_1m": round(load1, 2),
        "load_5m": round(load5, 2),
        "ram_used_gib": round(used_m, 1),
        "ram_total_gib": round(total_m, 1),
        "ram_pct": round(used_m / total_m * 100, 1),
        "disk_used_gib": round(used_d / (1024**3), 1),
        "disk_total_gib": round(total_d / (1024**3), 1),
        "disk_pct": round(used_d / total_d * 100, 1),
        "uptime": f"{days}d {hours}h {mins}m"
    }


@app.get("/api/v1/conversations/recent")
def get_recent_conversations() -> Dict[str, Any]:
    """Returns recent multi-agent meeting dialogues and boss delegation exchanges."""
    convos = extract_recent_conversations(12)
    return {
        "status": "success",
        "total_conversations": len(convos),
        "conversations": convos,
        "timestamp": datetime.now(timezone.utc).isoformat()
    }


@app.get("/api/v1/costs/summary")
def get_costs_summary() -> Dict[str, Any]:
    """Returns real-time token counts, model usage, and spend metrics from 9Router DB."""
    db_path = "/srv/apps/9router/data/db/data.sqlite"
    if not os.path.exists(db_path):
        return {"status": "error", "message": "9Router DB not found"}
    try:
        conn = sqlite3.connect(db_path)
        cur = conn.cursor()
        cur.execute("SELECT dateKey, data FROM usageDaily ORDER BY dateKey DESC LIMIT 7")
        rows = cur.fetchall()
        daily = []
        for d, raw in rows:
            try:
                parsed = json.loads(raw)
                daily.append({"date": d, "metrics": parsed})
            except Exception:
                pass
        
        # Recent requests
        cur.execute("""
            SELECT timestamp, model, promptTokens, completionTokens, cost, status 
            FROM usageHistory 
            ORDER BY timestamp DESC 
            LIMIT 20
        """)
        recent_reqs = []
        for r in cur.fetchall():
            recent_reqs.append({
                "time": r[0],
                "model": r[1],
                "prompt_tokens": r[2],
                "completion_tokens": r[3],
                "cost_usd": r[4],
                "status": r[5]
            })

        return {
            "status": "success",
            "daily_trends": daily,
            "recent_requests": recent_reqs,
            "timestamp": datetime.now(timezone.utc).isoformat()
        }
    except Exception as e:
        return {"status": "error", "message": str(e)}


@app.get("/api/v1/dag/trace")
def get_dag_trace(limit: int = Query(default=8, ge=1, le=20)) -> Dict[str, Any]:
    """Returns hierarchical execution DAG trees of recent delegations and tool traces."""
    trees = build_hierarchical_dag(limit=limit)
    return {
        "status": "success",
        "total_traces": len(trees),
        "traces": trees,
        "timestamp": datetime.now(timezone.utc).isoformat()
    }


@app.get("/api/v1/triage/errors")
def get_triage_errors(limit: int = Query(default=20, ge=1, le=50)) -> Dict[str, Any]:
    """Returns failure triage stream of detected errors, failed commands, and loop warnings."""
    errors = extract_execution_errors(limit=limit)
    return {"status": "success", "total_errors": len(errors), "errors": errors,
            "timestamp": datetime.now(timezone.utc).isoformat()}


@app.get("/api/v1/audit/timeline")
def get_audit_timeline(board: Optional[str] = None, profile: Optional[str] = None,
                       status: Optional[str] = None, since: Optional[str] = None,
                       limit: int = Query(default=200, ge=1, le=500)) -> Dict[str, Any]:
    """Correlated task/run/delegation/child/tool audit trail with source attribution."""
    items: List[Dict[str, Any]] = []
    boards = [b for b in _kanban_boards() if not board or b["slug"] == board]
    for entry in boards:
        try:
            with _kanban_db(entry["slug"]) as conn:
                rows = conn.execute("SELECT e.id,e.task_id,e.run_id,e.kind,e.payload,e.created_at,t.assignee FROM task_events e LEFT JOIN tasks t ON t.id=e.task_id ORDER BY e.created_at DESC LIMIT ?", (limit,)).fetchall()
            for row in rows:
                items.append({"id": f"{entry['slug']}:event:{row['id']}", "type": row["kind"], "board": entry["slug"], "profile": row["assignee"], "task_id": row["task_id"], "run_id": row["run_id"], "timestamp": _iso_timestamp(row["created_at"]), "status": row["kind"], "source": "task_events", "detail": redact_text(row["payload"] or "")})
        except sqlite3.Error:
            continue
    for delegation in _delegation_records(limit):
        for child in delegation["children"]:
            items.append({"id": child["id"], "type": "child", "profile": child["agent"], "delegation_id": delegation["id"], "child_id": child["id"], "timestamp": child["last_activity_at"], "status": child["status"], "source": delegation["source"], "reason": child["exit_reason"]})
            for step in child["steps"]:
                items.append({**step, "profile": child["agent"], "delegation_id": delegation["id"], "child_id": child["id"]})
    since_epoch = _epoch(since)
    items = [i for i in items if (not profile or i.get("profile") == profile) and (not status or i.get("status") == status) and (not since_epoch or (_epoch(i.get("timestamp")) or 0) >= since_epoch)]
    items.sort(key=lambda item: (_epoch(item.get("timestamp")) or 0, item["id"]), reverse=True)
    items = items[:limit]
    return redact_payload({"status": "success", "timeline": items, "total_events": len(items), "observed_at": datetime.now(timezone.utc).isoformat()})


def _legacy_delegation_records(limit: int = 50) -> List[Dict[str, Any]]:
    """Deprecated manifest-only reader retained for compatibility reference."""
    records: List[Dict[str, Any]] = []
    pattern = str(PROFILES_DIR / "*" / "cache" / "delegation" / "live" / "*" / "manifest.json")
    for manifest_path in sorted(glob.glob(pattern), key=os.path.getmtime, reverse=True)[:limit]:
        path = Path(manifest_path)
        try:
            manifest = json.loads(path.read_text(encoding="utf-8", errors="replace"))
        except (OSError, json.JSONDecodeError):
            continue
        delegation_id = str(manifest.get("delegation_id") or path.parent.name)
        profile = path.parts[path.parts.index("profiles") + 1] if "profiles" in path.parts else "unknown"
        tasks = []
        for task in manifest.get("tasks", []):
            idx = int(task.get("index", len(tasks)))
            log_path = path.parent / f"task-{idx}.log"
            status = str(task.get("status") or ("completed" if manifest.get("completed") else "running"))
            mtime = log_path.stat().st_mtime if log_path.exists() else path.stat().st_mtime
            tasks.append(redact_payload({
                "id": f"{delegation_id}:{idx}", "task_idx": idx, "parent_id": delegation_id,
                "goal": task.get("goal", ""), "status": status, "exit_reason": task.get("exit_reason"),
                "last_activity_at": datetime.fromtimestamp(mtime, timezone.utc).isoformat(),
                "is_stale": status == "running" and time.time() - mtime > STALE_HEARTBEAT_SECONDS,
            }))
        records.append(redact_payload({
            "id": delegation_id, "delegation_id": delegation_id, "profile": profile,
            "started_at": manifest.get("started"), "completed_at": manifest.get("completed"),
            "model": manifest.get("model"), "provider": manifest.get("provider"),
            "status": "completed" if manifest.get("completed") else ("running" if any(t["status"] == "running" for t in tasks) else "unknown"),
            "parallel": len(tasks) > 1, "children": tasks,
        }))
    return records


def _event_snapshot(board: str = "default") -> Dict[str, Any]:
    """Build stable domain state; transport timestamps belong outside the digest."""
    try:
        tasks = get_kanban_tasks(board)
        latest_events = get_kanban_events(board, 30)
    except HTTPException:
        tasks, latest_events = {"columns": {}}, {"events": []}

    live_sessions = harvest_live_sessions(max_age_seconds=60)
    live_agents_list = [
        {
            "id": ls["agent"],
            "name": ls["display_name"],
            "state": ls["state"],
            "status_desc": ls["status_desc"],
            "model": ls["model"],
            "time": ls["iso_time"]
        }
        for ls in live_sessions.values()
    ]
    telemetry = parse_delegation_stream(30)

    state = {
        "board": board,
        "kanban": tasks,
        "events": latest_events.get("events", []),
        "workers": get_worker_liveness(),
        "delegations": _delegation_records(20),
        "telemetry": list(reversed(telemetry)),
        "live_sessions": live_agents_list,
        "active_agents_count": len(live_agents_list),
    }
    def stable(value: Any) -> Any:
        if isinstance(value, dict):
            return {key: stable(item) for key, item in value.items() if key not in {"observed_at", "emitted_at", "iso_time", "age_seconds", "time"}}
        if isinstance(value, list):
            return [stable(item) for item in value]
        return value
    return redact_payload(stable(state))



@app.get("/api/v1/stream/events")
async def stream_events(request: Request, board: str = Query(default="default")) -> StreamingResponse:
    """Push redacted Kanban, worker, delegation, and transcript updates over SSE."""
    async def generate():
        last_digest = None
        sequence = 0
        yield "retry: 3000\n\n"
        while not await request.is_disconnected():
            snapshot = await asyncio.to_thread(_event_snapshot, board)
            payload = json.dumps({**snapshot, "emitted_at": datetime.now(timezone.utc).isoformat()}, separators=(",", ":"), ensure_ascii=False)
            canonical = json.dumps(snapshot, sort_keys=True, separators=(",", ":"), ensure_ascii=False)
            digest = hashlib.sha256(canonical.encode()).hexdigest()
            if digest != last_digest:
                sequence += 1
                yield f"id: {sequence}\nevent: snapshot\ndata: {payload}\n\n"
                last_digest = digest
            else:
                yield f": heartbeat {int(time.time())}\n\n"
            await asyncio.sleep(1.5)
    return StreamingResponse(generate(), media_type="text/event-stream", headers={
        "Cache-Control": "no-cache, no-transform", "Connection": "keep-alive", "X-Accel-Buffering": "no"
    })


@app.get("/api/v1/delegations/tree")
def get_delegations_tree(limit: int = Query(default=30, ge=1, le=100)) -> Dict[str, Any]:
    records = _delegation_records(limit)
    return {"status": "success", "delegations": records, "total_delegations": len(records)}


@app.get("/api/v1/delegations/{delegation_id}/transcript/{task_idx}")
def get_delegation_transcript(delegation_id: str, task_idx: int, profile: Optional[str] = Query(default=None)) -> Dict[str, Any]:
    if not re.fullmatch(r"deleg_[A-Za-z0-9_-]+", delegation_id) or task_idx < 0:
        raise HTTPException(status_code=400, detail="Invalid delegation transcript identifier")
    candidates = ([PROFILES_DIR / profile] if profile and re.fullmatch(r"[A-Za-z0-9_-]+", profile) else list(PROFILES_DIR.glob("*")))
    for root in candidates:
        path = root / "cache" / "delegation" / "live" / delegation_id / f"task-{task_idx}.log"
        if path.is_file():
            raw = path.read_bytes()[-MAX_TRANSCRIPT_BYTES:].decode("utf-8", errors="replace")
            return {"status": "success", "delegation_id": delegation_id, "task_idx": task_idx,
                    "profile": root.name, "transcript": redact_text(raw), "truncated": path.stat().st_size > MAX_TRANSCRIPT_BYTES,
                    "updated_at": datetime.fromtimestamp(path.stat().st_mtime, timezone.utc).isoformat()}
    raise HTTPException(status_code=404, detail="Delegation transcript not found")


@app.get("/api/v1/workers/liveness")
def get_worker_liveness() -> Dict[str, Any]:
    workers: List[Dict[str, Any]] = []
    executing = {"running", "in_progress", "in-progress", "claimed"}
    for board in _kanban_boards():
        try:
            with _kanban_db(board["slug"]) as conn:
                rows = conn.execute("SELECT id,title,assignee,status,worker_pid,worker_started_at,claim_expires,last_heartbeat_at,started_at,created_at,current_run_id FROM tasks WHERE assignee IS NOT NULL ORDER BY last_heartbeat_at DESC").fetchall()
        except sqlite3.Error:
            continue
        for row in rows:
            if str(row["status"]).lower() not in executing:
                continue
            liveness = _liveness(row["last_heartbeat_at"], row["worker_pid"], row["status"], row["started_at"] or row["created_at"], row["claim_expires"], row["worker_started_at"])
            workers.append(redact_payload({"profile": row["assignee"], "board": board["slug"], "task_id": row["id"], "run_id": row["current_run_id"], "task_title": row["title"], "task_status": row["status"], "worker_pid": row["worker_pid"], "last_heartbeat_at": _iso_timestamp(row["last_heartbeat_at"]), **liveness}))
    return {"status": "success", "stale_after_seconds": min(STALE_HEARTBEAT_SECONDS, 120), "workers": workers, "observed_at": datetime.now(timezone.utc).isoformat()}


@app.get("/api/v1/kanban/boards")
def get_kanban_boards() -> Dict[str, Any]:
    boards = []
    for board in _kanban_boards():
        with _kanban_db(board["slug"]) as conn:
            counts = {row["status"]: row["count"] for row in conn.execute(
                "SELECT status, COUNT(*) AS count FROM tasks GROUP BY status"
            )}
        boards.append({"slug": board["slug"], "name": board["name"], "task_counts": counts, "total_tasks": sum(counts.values())})
    return {"status": "success", "boards": boards, "total_boards": len(boards)}


@app.get("/api/v1/kanban/tasks")
def get_kanban_tasks(board: str = Query(default="default")) -> Dict[str, Any]:
    columns = {key: [] for key in ("triage", "todo", "ready", "running", "blocked", "review", "done", "archived")}
    aliases = {"in-progress": "running", "in_progress": "running", "completed": "done", "failed": "blocked"}
    try:
        with _kanban_db(board) as conn:
            rows = conn.execute("SELECT * FROM tasks ORDER BY priority DESC, created_at DESC").fetchall()
            links = [dict(row) for row in conn.execute("SELECT parent_id, child_id FROM task_links ORDER BY parent_id, child_id")]
    except sqlite3.Error:
        return JSONResponse(status_code=503, content={
            "status": "unavailable", "board": board, "columns": columns,
            "total_tasks": 0, "reason": "Kanban data unavailable",
        })
    for row in rows:
        task = _task_payload(row, board, links)
        column = aliases.get(task["status"].lower(), task["status"].lower())
        columns.setdefault(column, []).append(task)
    return {"status": "success", "board": board, "columns": columns, "total_tasks": sum(len(v) for v in columns.values())}


@app.get("/api/v1/kanban/task/{task_id}")
def get_kanban_task(task_id: str, board: Optional[str] = Query(default=None)) -> Dict[str, Any]:
    board_slugs = [board] if board else [item["slug"] for item in _kanban_boards()]
    for slug in board_slugs:
        with _kanban_db(slug) as conn:
            row = conn.execute("SELECT * FROM tasks WHERE id = ?", (task_id,)).fetchone()
            if not row:
                continue
            comments = [dict(r) for r in conn.execute("SELECT * FROM task_comments WHERE task_id = ? ORDER BY created_at", (task_id,))]
            runs = [dict(r) for r in conn.execute("SELECT * FROM task_runs WHERE task_id = ? ORDER BY started_at DESC", (task_id,))]
            events = [dict(r) for r in conn.execute("SELECT * FROM task_events WHERE task_id = ? ORDER BY created_at DESC", (task_id,))]
            links = [dict(r) for r in conn.execute("SELECT * FROM task_links WHERE parent_id = ? OR child_id = ?", (task_id, task_id))]
        for collection in (comments, events):
            for item in collection:
                item["created_at"] = _iso_timestamp(item.get("created_at"))
        for run in runs:
            for key in ("started_at", "ended_at", "last_heartbeat_at", "claim_expires"):
                if key in run:
                    run[key] = _iso_timestamp(run[key])
        return redact_payload({"status": "success", "task": _task_payload(row, slug, links), "comments": comments,
                "runs": runs, "events": events, "links": links})
    raise HTTPException(status_code=404, detail=f"Kanban task '{task_id}' not found")


@app.get("/api/v1/kanban/events")
def get_kanban_events(board: str = Query(default="default"), limit: int = Query(default=100, ge=1, le=500)) -> Dict[str, Any]:
    with _kanban_db(board) as conn:
        rows = conn.execute(
            "SELECT e.id,e.task_id,e.run_id,e.kind,e.payload,e.created_at,t.title,t.assignee "
            "FROM task_events e LEFT JOIN tasks t ON t.id=e.task_id ORDER BY e.id DESC LIMIT ?", (limit,)
        ).fetchall()
    events = []
    for row in rows:
        event = dict(row)
        event["created_at"] = _iso_timestamp(event["created_at"])
        try:
            event["payload"] = json.loads(event["payload"]) if event.get("payload") else None
        except (json.JSONDecodeError, TypeError):
            pass
        events.append(redact_payload(event))
    return {"status": "success", "board": board, "events": events, "total_events": len(events)}


# Active WebSocket connections for Claude-Office
connected_clients: Set[WebSocket] = set()

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    connected_clients.add(websocket)
    try:
        # 1. Send initial snapshot of all 14 agents
        roster_data = get_agents_roster()
        active_agents = []
        for a in roster_data.get("agents", []):
            active_agents.append({
                "id": a["id"],
                "name": a["name"],
                "role": a["id"],
                "task": a.get("status_desc"),
                "state": "working" if a["state"] != "IDLE" else "idle"
            })

        snapshot = {
            "type": "snapshot",
            "activeAgents": active_agents,
            "mcpServers": ["github", "duckdb", "hermes", "9router", "caddy"],
            "timestamp": int(time.time() * 1000)
        }
        await websocket.send_text(json.dumps(snapshot))

        # 2. Continuous telemetry & chat synchronization loop
        prev_states = {a["id"]: a["state"] for a in active_agents}
        while True:
            try:
                await asyncio.wait_for(websocket.receive_text(), timeout=1.5)
            except asyncio.TimeoutError:
                pass

            current_roster = get_agents_roster()
            for ag in current_roster.get("agents", []):
                aid = ag["id"]
                cur_state = ag["state"]
                old_state = prev_states.get(aid, "IDLE")

                if cur_state != "IDLE" and old_state == "IDLE":
                    ev = {
                        "type": "agent_working",
                        "agentId": aid,
                        "status": ag["status_desc"]
                    }
                    await websocket.send_text(json.dumps(ev))
                elif cur_state == "IDLE" and old_state != "IDLE":
                    ev = {
                        "type": "agent_completed",
                        "agentId": aid,
                        "result": f"{ag['name']} completed task."
                    }
                    await websocket.send_text(json.dumps(ev))

                prev_states[aid] = cur_state

    except WebSocketDisconnect:
        connected_clients.discard(websocket)
    except Exception:
        connected_clients.discard(websocket)


@app.post("/chat")
async def post_chat_message(request: Request):
    """Receive chat from the Slack-style chat panel and broadcast to connected clients."""
    try:
        data = await request.json()
    except Exception:
        data = {}
    sender = data.get("sender", "Founder")
    text = data.get("text", "")
    if not text:
        return {"error": "Empty text"}

    msg_id = int(time.time() * 1000)
    chat_ev = {
        "type": "chat_message",
        "id": msg_id,
        "sender": sender,
        "role": "boss",
        "text": text,
        "timestamp": datetime.now().strftime("%H:%M")
    }

    payload = json.dumps(chat_ev)
    disconnected = set()
    for ws in list(connected_clients):
        try:
            await ws.send_text(payload)
        except Exception:
            disconnected.add(ws)
    connected_clients.difference_update(disconnected)

    return {"ok": True, "id": msg_id}


@app.get("/chat/cron-state")
def get_chat_cron_state():
    return {"paused": False}


@app.post("/chat/cron-state")
def set_chat_cron_state():
    return {"ok": True}


if FRONTEND_DIST.exists():
    sprites_path = FRONTEND_DIST / "sprites"
    rooms_path = FRONTEND_DIST / "rooms"
    if sprites_path.exists():
        app.mount("/sprites", StaticFiles(directory=str(sprites_path)), name="sprites")
    if rooms_path.exists():
        app.mount("/rooms", StaticFiles(directory=str(rooms_path)), name="rooms")

# Serve static web assets
app.mount("/", StaticFiles(directory=str(STATIC_DIR), html=True), name="static")
