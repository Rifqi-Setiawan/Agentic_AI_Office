from __future__ import annotations

from fastapi.testclient import TestClient

from office.main import app

client = TestClient(app)


def test_healthz() -> None:
    response = client.get("/healthz")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"
    assert data["app"] == "office-v2"
    assert data["version"] == "2.0.0"


def test_api_healthz() -> None:
    response = client.get("/api/v1/healthz")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"
    assert data["app"] == "office-v2"
