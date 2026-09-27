"""Unit & Integration tests for Hermes Sovereign Cockpit & 3D Virtual Office."""

import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import pytest
from fastapi.testclient import TestClient
from src.server import app, OFFICE_ZONES, get_agent_models_map, get_git_diff_summary

client = TestClient(app)


def test_health_check():
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    assert data["service"] == "agent-cockpit-engine"


def test_roster_13_agents():
    response = client.get("/api/v1/agents/roster")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "success"
    assert data["total_agents"] == 13
    assert len(data["agents"]) == 13

    # Check key agents exist
    agents_map = {a["id"]: a for a in data["agents"]}
    for req_agent in ["vps-boss", "professor", "chief-architect", "swe-backend", "swe-frontend", "swe-verifier", "data-engineer"]:
        assert req_agent in agents_map
        ag = agents_map[req_agent]
        assert "model" in ag and len(ag["model"]) > 0
        assert "position" in ag and len(ag["position"]) == 3
        assert "zone" in ag
        assert "state" in ag


def test_telemetry_endpoint():
    response = client.get("/api/v1/telemetry/live")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "success"
    assert "events" in data
    assert isinstance(data["events"], list)


def test_diff_endpoint():
    response = client.get("/api/v1/diff/latest")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "success"
    assert "projects" in data
    assert "food_inflation_lakehouse" in data["projects"]


def test_vitals_endpoint():
    response = client.get("/api/v1/vitals")
    assert response.status_code == 200
    data = response.json()
    assert data["cpu_cores"] >= 1
    assert "ram_used_gib" in data
    assert "disk_used_gib" in data
    assert "uptime" in data


def test_conversations_endpoint():
    response = client.get("/api/v1/conversations/recent")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "success"
    assert "conversations" in data
    assert isinstance(data["conversations"], list)
    if data["conversations"]:
        first = data["conversations"][0]
        assert "sender" in first
        assert "receiver" in first
        assert "boss_order" in first


def test_dag_trace_endpoint():
    response = client.get("/api/v1/dag/trace?limit=5")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "success"
    assert "traces" in data
    assert isinstance(data["traces"], list)
    if data["traces"]:
        first = data["traces"][0]
        assert "delegation_id" in first
        assert "agent" in first
        assert "steps" in first


def test_triage_errors_endpoint():
    response = client.get("/api/v1/triage/errors?limit=5")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "success"
    assert "errors" in data
    assert isinstance(data["errors"], list)


