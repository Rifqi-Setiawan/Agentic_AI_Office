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
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, Any, List, Optional

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import HTMLResponse, JSONResponse
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
STATIC_DIR = Path(__file__).resolve().parents[1] / "static"
STATIC_DIR.mkdir(parents=True, exist_ok=True)

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
    }
}


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
        diff = subprocess.check_output("git diff HEAD~1..HEAD", shell=True, cwd=str(p), text=True, stderr=subprocess.DEVNULL)
        return {
            "status": "success",
            "repo_name": p.name,
            "commit": commit_hash,
            "message": commit_msg,
            "author": author,
            "date": date_str,
            "diff_snippet": diff[:5000] if diff else "(Clean working tree / no diff in commit)"
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

        for line in lines:
            line_str = line.strip()
            if not line_str:
                continue
            if " tool " in line_str or "-> " in line_str:
                parts = line_str.split("|", 2)
                t_str = parts[0].strip() if len(parts) > 0 else ""
                detail = parts[-1].strip() if len(parts) > 1 else line_str
                station = categorize_tool_station(detail, agent_target)
                events.append({
                    "time": t_str,
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
                    "time": t_str,
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

        convos.append({
            "id": Path(d).name,
            "sender": "vps-boss",
            "receiver": agent,
            "started_at": started,
            "completed_at": completed_at,
            "status": status,
            "is_running": is_running,
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
    """Returns all 13 agents with real models, status, active task, and 3D coordinates."""
    models_map = get_agent_models_map()
    events = parse_delegation_stream(150)
    
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

        # Dynamic state inference
        if last_ev:
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
        else:
            state = "IDLE"
            status_desc = "Standing by for Next Autonomous Delegation"

        # Active Project & Phase mapping
        project_map = {
            "professor": {"project": "National Food Lakehouse", "phase": "Phase 4 Backend Complete / Visual Research"},
            "swe-backend": {"project": "National Food Lakehouse", "phase": "Phase 4 High-Concurrency API (:8097)"},
            "swe-verifier": {"project": "Global Verification", "phase": "Independent QA & Zero-AI Security Audit"},
            "data-engineer": {"project": "National Food Lakehouse", "phase": "SCD Type 2 & Gold Snowflake Sync"},
            "devops-engineer": {"project": "VPS Infrastructure", "phase": "Caddy Gateway & Ingress Isolation (8080/8085)"},
            "vps-boss": {"project": "Rifqi Studio Orchestration", "phase": "Executive Mission Control & Task Routing"},
            "ui-designer": {"project": "3D Virtual Cyber-Office", "phase": "WebGL Three.js Photorealistic Spatial Scene"},
            "tech-mentor": {"project": "Technical Mentorship", "phase": "Interactive Architectural Explanations"},
            "github-manager": {"project": "Global Git Releases", "phase": "Clean Commit Hygiene & Zero-AI Audit"},
            "paperwright": {"project": "OpenWikiForge Research", "phase": "IEEEtran LaTeX Manuscript Compilation"},
            "swe-frontend": {"project": "TechHiring.id / 3D Office", "phase": "Client UI / WebGL Spatial Component"},
            "vps-assistant": {"project": "General Operations", "phase": "Server Automation & Utility Scripts"}
        }
        proj_info = project_map.get(agent_id, {"project": "Global Control", "phase": "Standard Active"})

        roster.append({
            "id": agent_id,
            "name": agent_id,
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
            "latest_activity": last_ev
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
    return {
        "status": "success",
        "total_errors": len(errors),
        "errors": errors,
        "timestamp": datetime.now(timezone.utc).isoformat()
    }


# Serve static web assets
app.mount("/", StaticFiles(directory=str(STATIC_DIR), html=True), name="static")
