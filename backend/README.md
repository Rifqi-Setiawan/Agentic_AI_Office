# Agentic AI Office v2 — Backend

Backend service berbasis FastAPI dan Python 3.12 yang membaca status runtime dan SQLite Kanban Hermes secara *read-only*, lalu memproyeksikannya ke browser melalui REST API dan Server-Sent Events (SSE).

## Standar Kode & CI
- **Linting & Formatting**: `ruff check .` dan `ruff format --check .`
- **Type Checking**: `mypy src tests`
- **Testing**: `pytest -v`
