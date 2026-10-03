"""Tests for synthetic Kanban fixtures and generator script."""

from __future__ import annotations

import sqlite3
from pathlib import Path

import pytest

from tests.fixtures.generate_kanban_fixture import generate_all_fixtures

FIXTURES_DIR = Path(__file__).resolve().parent / "fixtures"
PRIMARY_DB = FIXTURES_DIR / "kanban_fixture.db"
SECONDARY_DB = FIXTURES_DIR / "kanban_secondary_fixture.db"
BOARD_B_DB = FIXTURES_DIR / "boards" / "board_b" / "kanban.db"

EXPECTED_TABLES = {
    "tasks",
    "task_runs",
    "task_events",
    "task_comments",
    "task_links",
    "task_attachments",
    "kanban_notify_subs",
}


def test_fixture_databases_exist() -> None:
    """Verify that all required fixture databases exist on disk."""
    assert PRIMARY_DB.is_file(), f"Missing primary fixture: {PRIMARY_DB}"
    assert SECONDARY_DB.is_file(), f"Missing secondary fixture: {SECONDARY_DB}"
    assert BOARD_B_DB.is_file(), f"Missing multi-board directory fixture: {BOARD_B_DB}"


@pytest.mark.parametrize("db_path", [PRIMARY_DB, SECONDARY_DB, BOARD_B_DB])
def test_fixture_schema_integrity(db_path: Path) -> None:
    """Verify that fixture database has the authentic Hermes Kanban SQLite schema."""
    conn = sqlite3.connect(f"file:{db_path}?mode=ro", uri=True)
    try:
        cur = conn.cursor()
        cur.execute("PRAGMA query_only = ON;")

        # Check tables
        tables = {
            row[0]
            for row in cur.execute(
                "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%';"
            )
        }
        assert EXPECTED_TABLES.issubset(tables)

        # Check required columns on tasks table
        task_cols = {row[1] for row in cur.execute("PRAGMA table_info(tasks);")}
        required_task_cols = {
            "id",
            "title",
            "body",
            "assignee",
            "status",
            "priority",
            "created_at",
            "started_at",
            "completed_at",
            "tenant",
            "result",
            "consecutive_failures",
            "last_failure_error",
            "last_heartbeat_at",
            "current_run_id",
            "block_kind",
        }
        assert required_task_cols.issubset(task_cols)

        # Check required columns on task_runs table
        run_cols = {row[1] for row in cur.execute("PRAGMA table_info(task_runs);")}
        required_run_cols = {
            "id",
            "task_id",
            "profile",
            "status",
            "started_at",
            "ended_at",
            "outcome",
            "summary",
            "metadata",
            "error",
        }
        assert required_run_cols.issubset(run_cols)
    finally:
        conn.close()


def test_fixture_task_states_coverage() -> None:
    """Verify that primary fixture covers all required task states."""
    conn = sqlite3.connect(f"file:{PRIMARY_DB}?mode=ro", uri=True)
    try:
        cur = conn.cursor()
        cur.execute("PRAGMA query_only = ON;")

        # 1. Running state
        running = cur.execute(
            "SELECT id, assignee, last_heartbeat_at FROM tasks WHERE status = 'running';"
        ).fetchall()
        assert len(running) >= 1, "Must have at least one running task"

        # 2. Blocked (needs_input)
        blocked_input = cur.execute(
            "SELECT id, assignee FROM tasks "
            "WHERE status = 'blocked' AND block_kind = 'needs_input';"
        ).fetchall()
        assert len(blocked_input) >= 1, "Must have at least one blocked (needs_input) task"

        # 3. Blocked (dependency)
        dep_links = cur.execute("SELECT parent_id, child_id FROM task_links;").fetchall()
        assert len(dep_links) >= 1, "Must have dependency relationship in task_links"
        blocked_dep = cur.execute(
            "SELECT id, assignee FROM tasks WHERE block_kind = 'dependency';"
        ).fetchall()
        assert len(blocked_dep) >= 1, "Must have at least one task with block_kind = 'dependency'"

        # 4. Done state
        done_tasks = cur.execute(
            "SELECT id, completed_at, result FROM tasks WHERE status = 'done';"
        ).fetchall()
        assert len(done_tasks) >= 1, "Must have at least one done task"
        assert done_tasks[0][1] is not None, "Done task must have completed_at timestamp"

        # 5. Crashed state
        crashed = cur.execute(
            "SELECT id, consecutive_failures, last_failure_error "
            "FROM tasks WHERE status = 'crashed';"
        ).fetchall()
        assert len(crashed) >= 1, "Must have at least one crashed task"
        assert crashed[0][1] > 0, "Crashed task must record failure count"
        assert crashed[0][2] is not None, "Crashed task must record last_failure_error"

        # 6. Timed_out state
        timed_out = cur.execute(
            "SELECT id, consecutive_failures, last_failure_error "
            "FROM tasks WHERE status = 'timed_out';"
        ).fetchall()
        assert len(timed_out) >= 1, "Must have at least one timed_out task"
        assert timed_out[0][1] > 0, "Timed_out task must record failure count"
        assert timed_out[0][2] is not None, "Timed_out task must record error message"

        # 7. Heartbeat basi (stale heartbeat)
        # Running task where last_heartbeat_at is ancient (> 3600s in past)
        stale_heartbeat = cur.execute(
            """
            SELECT id, started_at, last_heartbeat_at
            FROM tasks
            WHERE status = 'running'
              AND (started_at - last_heartbeat_at > 1800 OR last_heartbeat_at < started_at + 3600)
            """
        ).fetchall()
        assert len(stale_heartbeat) >= 1, "Must have a task with stale heartbeat"
    finally:
        conn.close()


def test_fixture_jarvis_comments() -> None:
    """Verify that comments table includes comments authored by Jarvis."""
    conn = sqlite3.connect(f"file:{PRIMARY_DB}?mode=ro", uri=True)
    try:
        cur = conn.cursor()
        cur.execute("PRAGMA query_only = ON;")
        jarvis_comments = cur.execute(
            "SELECT task_id, body FROM task_comments WHERE author = 'jarvis';"
        ).fetchall()
        assert len(jarvis_comments) >= 1, "Must include at least one comment authored by Jarvis"
    finally:
        conn.close()


def test_fixture_multi_board_support() -> None:
    """Verify that multiple board databases exist and contain separate tasks."""
    conn_primary = sqlite3.connect(f"file:{PRIMARY_DB}?mode=ro", uri=True)
    conn_sec = sqlite3.connect(f"file:{SECONDARY_DB}?mode=ro", uri=True)
    try:
        cur_p = conn_primary.cursor()
        cur_s = conn_sec.cursor()

        tasks_p = {row[0] for row in cur_p.execute("SELECT id FROM tasks;")}
        tasks_s = {row[0] for row in cur_s.execute("SELECT id FROM tasks;")}

        assert len(tasks_p) > 0, "Primary board must have tasks"
        assert len(tasks_s) > 0, "Secondary board must have tasks"
        assert tasks_p.isdisjoint(tasks_s), "Task IDs should not collide across independent boards"
    finally:
        conn_primary.close()
        conn_sec.close()


def test_leak_canary_tokens_presence() -> None:
    """Verify that LEAK-CANARY markers are present across multiple tables for leak testing."""
    conn = sqlite3.connect(f"file:{PRIMARY_DB}?mode=ro", uri=True)
    try:
        cur = conn.cursor()
        cur.execute("PRAGMA query_only = ON;")

        # Body canaries
        body_matches = cur.execute(
            "SELECT count(*) FROM tasks WHERE body LIKE '%LEAK-CANARY%';"
        ).fetchone()[0]
        assert body_matches >= 3, "Expected multiple body canary tokens"

        # Result canaries
        result_matches = cur.execute(
            "SELECT count(*) FROM tasks WHERE result LIKE '%LEAK-CANARY%';"
        ).fetchone()[0]
        assert result_matches >= 1, "Expected canary token in task result"

        # Error canaries
        error_matches = cur.execute(
            "SELECT count(*) FROM tasks WHERE last_failure_error LIKE '%LEAK-CANARY%';"
        ).fetchone()[0]
        assert error_matches >= 1, "Expected canary token in last_failure_error"

        # Run summary canaries
        summary_matches = cur.execute(
            "SELECT count(*) FROM task_runs WHERE summary LIKE '%LEAK-CANARY%';"
        ).fetchone()[0]
        assert summary_matches >= 1, "Expected canary token in task_runs summary"

        # Run error canaries
        run_error_matches = cur.execute(
            "SELECT count(*) FROM task_runs WHERE error LIKE '%LEAK-CANARY%';"
        ).fetchone()[0]
        assert run_error_matches >= 1, "Expected canary token in task_runs error"

        # Comment canaries
        comment_matches = cur.execute(
            "SELECT count(*) FROM task_comments WHERE body LIKE '%LEAK-CANARY%';"
        ).fetchone()[0]
        assert comment_matches >= 1, "Expected canary token in comments"

        # Event payload canaries
        event_matches = cur.execute(
            "SELECT count(*) FROM task_events WHERE payload LIKE '%LEAK-CANARY%';"
        ).fetchone()[0]
        assert event_matches >= 1, "Expected canary token in event payload"

        # Internal path canaries
        path_matches = cur.execute(
            "SELECT count(*) FROM tasks WHERE body LIKE '%/srv/apps/hermes/%';"
        ).fetchone()[0]
        assert path_matches >= 1, "Expected internal paths in body to test path redaction"
    finally:
        conn.close()


def test_generator_deterministic_reproducibility(tmp_path: Path) -> None:
    """Verify that generate_all_fixtures produces identical schemas and data deterministically."""
    anchor_time = 1791029000
    generated = generate_all_fixtures(tmp_path, now=anchor_time)
    assert len(generated) == 3

    for path in generated:
        assert path.is_file()
        conn = sqlite3.connect(f"file:{path}?mode=ro", uri=True)
        try:
            count = conn.cursor().execute("SELECT count(*) FROM tasks;").fetchone()[0]
            assert count > 0
        finally:
            conn.close()
