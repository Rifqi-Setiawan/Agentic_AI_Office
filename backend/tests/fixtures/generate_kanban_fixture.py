"""Generator script for synthetic Kanban fixtures.

Produces:
1. Primary fixture: backend/tests/fixtures/kanban_fixture.db
2. Secondary fixture: backend/tests/fixtures/kanban_secondary_fixture.db
3. Secondary board dir: backend/tests/fixtures/boards/board_b/kanban.db

Schema matches the production Hermes Kanban SQLite schema (tasks, task_runs,
task_events, task_comments, task_links, task_attachments, kanban_notify_subs).
Synthetic data covers: running, blocked (needs_input & dependency), done,
crashed, timed_out, stale heartbeat (heartbeat basi), Jarvis comments,
multi-board structures, and LEAK-CANARY markers for property anti-leak testing.
"""

from __future__ import annotations

import json
import sqlite3
import time
from pathlib import Path

DDL_STATEMENTS = [
    """
    CREATE TABLE tasks (
        id                   TEXT PRIMARY KEY,
        title                TEXT NOT NULL,
        body                 TEXT,
        assignee             TEXT,
        status               TEXT NOT NULL,
        priority             INTEGER DEFAULT 0,
        created_by           TEXT,
        created_at           INTEGER NOT NULL,
        started_at           INTEGER,
        completed_at         INTEGER,
        workspace_kind       TEXT NOT NULL DEFAULT 'scratch',
        workspace_path       TEXT,
        branch_name          TEXT,
        project_id           TEXT,
        claim_lock           TEXT,
        claim_expires        INTEGER,
        tenant               TEXT,
        result               TEXT,
        idempotency_key      TEXT,
        consecutive_failures INTEGER NOT NULL DEFAULT 0,
        worker_pid           INTEGER,
        worker_started_at    INTEGER,
        last_failure_error   TEXT,
        max_runtime_seconds  INTEGER,
        last_heartbeat_at    INTEGER,
        current_run_id       INTEGER,
        workflow_template_id TEXT,
        current_step_key     TEXT,
        skills               TEXT,
        model_override       TEXT,
        provider_override    TEXT,
        reasoning_effort     TEXT,
        max_retries          INTEGER,
        goal_mode            INTEGER NOT NULL DEFAULT 0,
        goal_max_turns       INTEGER,
        session_id           TEXT,
        block_kind           TEXT,
        block_recurrences    INTEGER NOT NULL DEFAULT 0,
        completion_contract  TEXT
    );
    """,
    """
    CREATE TABLE task_runs (
        id                  INTEGER PRIMARY KEY AUTOINCREMENT,
        task_id             TEXT NOT NULL,
        profile             TEXT,
        step_key            TEXT,
        status              TEXT NOT NULL,
        claim_lock          TEXT,
        claim_expires       INTEGER,
        worker_pid          INTEGER,
        worker_started_at   INTEGER,
        max_runtime_seconds INTEGER,
        last_heartbeat_at   INTEGER,
        started_at          INTEGER NOT NULL,
        ended_at            INTEGER,
        outcome             TEXT,
        summary             TEXT,
        metadata            TEXT,
        error               TEXT
    );
    """,
    """
    CREATE TABLE task_events (
        id         INTEGER PRIMARY KEY AUTOINCREMENT,
        task_id    TEXT NOT NULL,
        run_id     INTEGER,
        kind       TEXT NOT NULL,
        payload    TEXT,
        created_at INTEGER NOT NULL
    );
    """,
    """
    CREATE TABLE task_comments (
        id         INTEGER PRIMARY KEY AUTOINCREMENT,
        task_id    TEXT NOT NULL,
        author     TEXT NOT NULL,
        body       TEXT NOT NULL,
        created_at INTEGER NOT NULL
    );
    """,
    """
    CREATE TABLE task_links (
        parent_id  TEXT NOT NULL,
        child_id   TEXT NOT NULL,
        PRIMARY KEY (parent_id, child_id)
    );
    """,
    """
    CREATE TABLE task_attachments (
        id           INTEGER PRIMARY KEY AUTOINCREMENT,
        task_id      TEXT NOT NULL,
        filename     TEXT NOT NULL,
        stored_path  TEXT NOT NULL,
        content_type TEXT,
        size         INTEGER NOT NULL DEFAULT 0,
        uploaded_by  TEXT,
        created_at   INTEGER NOT NULL
    );
    """,
    """
    CREATE TABLE kanban_notify_subs (
        task_id            TEXT NOT NULL,
        platform           TEXT NOT NULL,
        chat_id            TEXT NOT NULL,
        thread_id          TEXT NOT NULL DEFAULT '',
        user_id            TEXT,
        user_id_alt        TEXT,
        chat_type          TEXT,
        notifier_profile   TEXT,
        delivery_mode      TEXT NOT NULL DEFAULT 'notify',
        delivery_metadata  TEXT,
        created_at         INTEGER NOT NULL,
        last_event_id      INTEGER NOT NULL DEFAULT 0,
        last_ping_event_id INTEGER NOT NULL DEFAULT 0,
        PRIMARY KEY (task_id, platform, chat_id, thread_id)
    );
    """,
    "CREATE INDEX idx_tasks_assignee_status ON tasks(assignee, status);",
    "CREATE INDEX idx_tasks_status ON tasks(status);",
    "CREATE INDEX idx_tasks_tenant ON tasks(tenant);",
    "CREATE INDEX idx_tasks_idempotency ON tasks(idempotency_key);",
    "CREATE INDEX idx_tasks_session_id ON tasks(session_id);",
    "CREATE INDEX idx_runs_status ON task_runs(status);",
    "CREATE INDEX idx_runs_task ON task_runs(task_id, started_at);",
    "CREATE INDEX idx_events_task ON task_events(task_id, created_at);",
    "CREATE INDEX idx_events_run ON task_events(run_id, id);",
    "CREATE INDEX idx_comments_task ON task_comments(task_id, created_at);",
    "CREATE INDEX idx_links_parent ON task_links(parent_id);",
    "CREATE INDEX idx_links_child ON task_links(child_id);",
    "CREATE INDEX idx_attachments_task ON task_attachments(task_id, created_at);",
    "CREATE INDEX idx_notify_task ON kanban_notify_subs(task_id);",
]


def init_database(db_path: Path) -> sqlite3.Connection:
    """Initialize empty SQLite database with the full Kanban schema."""
    if db_path.exists():
        db_path.unlink()
    db_path.parent.mkdir(parents=True, exist_ok=True)

    conn = sqlite3.connect(db_path)
    cur = conn.cursor()
    cur.execute("PRAGMA journal_mode = WAL;")
    for stmt in DDL_STATEMENTS:
        cur.execute(stmt)
    cur.execute("PRAGMA wal_checkpoint(TRUNCATE);")
    conn.commit()
    return conn


def populate_primary_board(conn: sqlite3.Connection, now: int) -> None:
    """Populate primary board with tasks covering all required states and canary markers."""
    cur = conn.cursor()

    # 1. RUNNING task (assignee: forge, active fresh heartbeat)
    t1_id = "task-running-001"
    cur.execute(
        """
        INSERT INTO tasks (
            id, title, body, assignee, status, priority, created_by, created_at,
            started_at, completed_at, workspace_kind, workspace_path, branch_name,
            project_id, claim_lock, claim_expires, tenant, result, idempotency_key,
            consecutive_failures, worker_pid, worker_started_at, last_failure_error,
            max_runtime_seconds, last_heartbeat_at, current_run_id, workflow_template_id,
            current_step_key, skills, model_override, provider_override, reasoning_effort,
            max_retries, goal_mode, goal_max_turns, session_id, block_kind,
            block_recurrences, completion_contract
        ) VALUES (
            ?, ?, ?, ?, ?, ?, ?, ?,
            ?, ?, ?, ?, ?,
            ?, ?, ?, ?, ?, ?,
            ?, ?, ?, ?,
            ?, ?, ?, ?,
            ?, ?, ?, ?, ?,
            ?, ?, ?, ?, ?,
            ?, ?
        )
        """,
        (
            t1_id,
            "Implementasi reader Kanban real-time",
            "Membangun parser multi-board SQLite reader. "
            "LEAK-CANARY-TASK-001-BODY. Konfigurasi kredensial: "
            "/srv/apps/hermes/credentials/primary_vault.key.",
            "forge",
            "running",
            8,
            "jarvis",
            now - 600,
            now - 300,
            None,
            "scratch",
            "/srv/apps/hermes/kanban/boards/office-v2/workspaces/task-running-001",
            "feature/kanban-reader",
            "office-v2",
            "Rifqi-studio:1001",
            now + 600,
            "office-v2",
            None,
            "idem-key-run-001",
            0,
            20101,
            now - 300,
            None,
            1800,
            now - 15,
            101,
            None,
            None,
            json.dumps(["sdlc-review", "kanban"]),
            None,
            None,
            "high",
            3,
            0,
            20,
            "sess-run-101",
            None,
            0,
            "local-only",
        ),
    )
    cur.execute(
        """
        INSERT INTO task_runs (
            id, task_id, profile, step_key, status, claim_lock, claim_expires,
            worker_pid, worker_started_at, max_runtime_seconds, last_heartbeat_at,
            started_at, ended_at, outcome, summary, metadata, error
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            101,
            t1_id,
            "forge",
            "exec",
            "running",
            "Rifqi-studio:1001",
            now + 600,
            20101,
            now - 300,
            1800,
            now - 15,
            now - 300,
            None,
            None,
            "Proses inisialisasi koneksi SQLite read-only. LEAK-CANARY-RUN-101-SUMMARY",
            json.dumps({"poll_hz": 1, "boards_detected": 2}),
            None,
        ),
    )
    cur.execute(
        """
        INSERT INTO task_events (task_id, run_id, kind, payload, created_at)
        VALUES
        (?, ?, 'created', ?, ?),
        (?, ?, 'claimed', ?, ?),
        (?, ?, 'spawned', ?, ?),
        (?, ?, 'heartbeat', NULL, ?)
        """,
        (
            t1_id,
            None,
            json.dumps({"assignee": "forge", "status": "ready", "tenant": "office-v2"}),
            now - 600,
            t1_id,
            101,
            json.dumps({"lock": "Rifqi-studio:1001", "expires": now + 600, "run_id": 101}),
            now - 300,
            t1_id,
            101,
            json.dumps({"pid": 20101, "started_at": now - 300}),
            now - 300,
            t1_id,
            101,
            now - 15,
        ),
    )

    # 2. BLOCKED (needs_input) task (assignee: daedalus)
    t2_id = "task-blocked-input-002"
    cur.execute(
        """
        INSERT INTO tasks (
            id, title, body, assignee, status, priority, created_by, created_at,
            started_at, completed_at, workspace_kind, workspace_path, branch_name,
            project_id, claim_lock, claim_expires, tenant, result, idempotency_key,
            consecutive_failures, worker_pid, worker_started_at, last_failure_error,
            max_runtime_seconds, last_heartbeat_at, current_run_id, workflow_template_id,
            current_step_key, skills, model_override, provider_override, reasoning_effort,
            max_retries, goal_mode, goal_max_turns, session_id, block_kind,
            block_recurrences, completion_contract
        ) VALUES (
            ?, ?, ?, ?, ?, ?, ?, ?,
            ?, ?, ?, ?, ?,
            ?, ?, ?, ?, ?, ?,
            ?, ?, ?, ?,
            ?, ?, ?, ?,
            ?, ?, ?, ?, ?,
            ?, ?, ?, ?, ?,
            ?, ?
        )
        """,
        (
            t2_id,
            "Migrasi skema database multi-tenant",
            "Menunggu konfirmasi arsitektur partisi skema dari Founder. "
            "LEAK-CANARY-TASK-002-BODY. Secret token: "
            "LEAK-CANARY-SECRET-INPUT-9988.",
            "daedalus",
            "blocked",
            9,
            "jarvis",
            now - 1800,
            now - 1200,
            None,
            "scratch",
            "/srv/apps/hermes/kanban/boards/office-v2/workspaces/task-blocked-input-002",
            "feature/schema-migration",
            "office-v2",
            None,
            None,
            "office-v2",
            None,
            "idem-key-block-002",
            0,
            None,
            None,
            None,
            1800,
            now - 900,
            102,
            None,
            None,
            json.dumps(["database-design"]),
            None,
            None,
            "high",
            3,
            0,
            20,
            "sess-block-102",
            "needs_input",
            1,
            "local-only",
        ),
    )
    cur.execute(
        """
        INSERT INTO task_runs (
            id, task_id, profile, step_key, status, claim_lock, claim_expires,
            worker_pid, worker_started_at, max_runtime_seconds, last_heartbeat_at,
            started_at, ended_at, outcome, summary, metadata, error
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            102,
            t2_id,
            "daedalus",
            "exec",
            "blocked",
            None,
            None,
            20102,
            now - 1200,
            1800,
            now - 900,
            now - 1200,
            now - 900,
            "blocked",
            "Eksplorasi skema selesai, menunggu arahan skema DB. LEAK-CANARY-RUN-102-SUMMARY",
            json.dumps({"block_reason": "needs_input"}),
            "Tercatat blocker eksternal: butuh input manusia. LEAK-CANARY-RUN-102-ERROR",
        ),
    )
    cur.execute(
        """
        INSERT INTO task_events (task_id, run_id, kind, payload, created_at)
        VALUES
        (?, ?, 'created', ?, ?),
        (?, ?, 'claimed', ?, ?),
        (?, ?, 'spawned', ?, ?),
        (?, ?, 'blocked', ?, ?)
        """,
        (
            t2_id,
            None,
            json.dumps({"assignee": "daedalus", "status": "ready"}),
            now - 1800,
            t2_id,
            102,
            json.dumps({"lock": "Rifqi-studio:1002", "run_id": 102}),
            now - 1200,
            t2_id,
            102,
            json.dumps({"pid": 20102}),
            now - 1200,
            t2_id,
            102,
            json.dumps(
                {
                    "kind": "needs_input",
                    "reason": "Menunggu konfirmasi arsitektur partisi skema. LEAK-CANARY-EVENT-002",
                }
            ),
            now - 900,
        ),
    )
    cur.execute(
        """
        INSERT INTO task_comments (task_id, author, body, created_at)
        VALUES
        (?, 'daedalus', ?, ?),
        (?, 'jarvis', ?, ?)
        """,
        (
            t2_id,
            "Apakah kita memakai skema tunggal dengan tabel berprefix atau multi-db? "
            "LEAK-CANARY-COMMENT-DAEDALUS-01",
            now - 950,
            t2_id,
            "Mohon prioritaskan skema multi-db sesuai blueprint 01-master-architecture. "
            "LEAK-CANARY-COMMENT-JARVIS-01",
            now - 920,
        ),
    )

    # 3. BLOCKED (dependency) task (assignee: relay, waiting on t4)
    t3_id = "task-blocked-dep-003"
    t4_id = "task-done-004"
    cur.execute(
        """
        INSERT INTO tasks (
            id, title, body, assignee, status, priority, created_by, created_at,
            started_at, completed_at, workspace_kind, workspace_path, branch_name,
            project_id, claim_lock, claim_expires, tenant, result, idempotency_key,
            consecutive_failures, worker_pid, worker_started_at, last_failure_error,
            max_runtime_seconds, last_heartbeat_at, current_run_id, workflow_template_id,
            current_step_key, skills, model_override, provider_override, reasoning_effort,
            max_retries, goal_mode, goal_max_turns, session_id, block_kind,
            block_recurrences, completion_contract
        ) VALUES (
            ?, ?, ?, ?, ?, ?, ?, ?,
            ?, ?, ?, ?, ?,
            ?, ?, ?, ?, ?, ?,
            ?, ?, ?, ?,
            ?, ?, ?, ?,
            ?, ?, ?, ?, ?,
            ?, ?, ?, ?, ?,
            ?, ?
        )
        """,
        (
            t3_id,
            "Pipeline CI/CD staging deployment",
            "Menunggu penyelesaian audit keamanan dan sertifikat TLS. "
            "LEAK-CANARY-TASK-003-BODY. Path target: "
            "/srv/apps/hermes/deployments/staging.env.",
            "relay",
            "todo",
            7,
            "jarvis",
            now - 2000,
            None,
            None,
            "scratch",
            None,
            "ops/deploy-staging",
            "office-v2",
            None,
            None,
            "office-v2",
            None,
            "idem-key-dep-003",
            0,
            None,
            None,
            None,
            1200,
            None,
            None,
            None,
            None,
            json.dumps(["devops"]),
            None,
            None,
            "medium",
            3,
            0,
            20,
            None,
            "dependency",
            0,
            "local-only",
        ),
    )
    cur.execute(
        """
        INSERT INTO task_events (task_id, run_id, kind, payload, created_at)
        VALUES
        (?, NULL, 'created', ?, ?),
        (?, NULL, 'dependency_wait', ?, ?),
        (?, NULL, 'linked', ?, ?)
        """,
        (
            t3_id,
            json.dumps({"assignee": "relay", "status": "todo"}),
            now - 2000,
            t3_id,
            json.dumps(
                {
                    "reason": "parent_not_done",
                    "demoted": True,
                    "parent": t4_id,
                    "canary": "LEAK-CANARY-EVENT-DEP-WAIT",
                }
            ),
            now - 1950,
            t3_id,
            json.dumps({"parent": t4_id, "child": t3_id}),
            now - 1950,
        ),
    )
    cur.execute(
        """
        INSERT INTO task_links (parent_id, child_id)
        VALUES (?, ?)
        """,
        (t4_id, t3_id),
    )

    # 4. DONE task (assignee: bastion)
    cur.execute(
        """
        INSERT INTO tasks (
            id, title, body, assignee, status, priority, created_by, created_at,
            started_at, completed_at, workspace_kind, workspace_path, branch_name,
            project_id, claim_lock, claim_expires, tenant, result, idempotency_key,
            consecutive_failures, worker_pid, worker_started_at, last_failure_error,
            max_runtime_seconds, last_heartbeat_at, current_run_id, workflow_template_id,
            current_step_key, skills, model_override, provider_override, reasoning_effort,
            max_retries, goal_mode, goal_max_turns, session_id, block_kind,
            block_recurrences, completion_contract
        ) VALUES (
            ?, ?, ?, ?, ?, ?, ?, ?,
            ?, ?, ?, ?, ?,
            ?, ?, ?, ?, ?, ?,
            ?, ?, ?, ?,
            ?, ?, ?, ?,
            ?, ?, ?, ?, ?,
            ?, ?, ?, ?, ?,
            ?, ?
        )
        """,
        (
            t4_id,
            "Audit sertifikat TLS dan rotasi cipher suite",
            "Pemeriksaan kepatuhan SSL/TLS untuk staging domain office.rifqisetiawan.my.id. "
            "LEAK-CANARY-TASK-004-BODY.",
            "bastion",
            "done",
            6,
            "jarvis",
            now - 3600,
            now - 3000,
            now - 1800,
            "scratch",
            "/srv/apps/hermes/kanban/boards/office-v2/workspaces/task-done-004",
            "security/tls-audit",
            "office-v2",
            None,
            None,
            "office-v2",
            "Verifikasi TLS 1.3 selesai dengan grade A+. LEAK-CANARY-TASK-004-RESULT",
            "idem-key-done-004",
            0,
            None,
            None,
            None,
            1200,
            now - 1800,
            104,
            None,
            None,
            json.dumps(["security-audit"]),
            None,
            None,
            "high",
            3,
            0,
            20,
            "sess-done-104",
            None,
            0,
            "local-only",
        ),
    )
    cur.execute(
        """
        INSERT INTO task_runs (
            id, task_id, profile, step_key, status, claim_lock, claim_expires,
            worker_pid, worker_started_at, max_runtime_seconds, last_heartbeat_at,
            started_at, ended_at, outcome, summary, metadata, error
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            104,
            t4_id,
            "bastion",
            "exec",
            "done",
            None,
            None,
            20104,
            now - 3000,
            1200,
            now - 1800,
            now - 3000,
            now - 1800,
            "completed",
            "Seluruh cipher suite aman telah diverifikasi. LEAK-CANARY-RUN-104-SUMMARY",
            json.dumps({"protocols": ["TLSv1.3"], "grade": "A+"}),
            None,
        ),
    )
    cur.execute(
        """
        INSERT INTO task_events (task_id, run_id, kind, payload, created_at)
        VALUES
        (?, ?, 'created', ?, ?),
        (?, ?, 'claimed', ?, ?),
        (?, ?, 'spawned', ?, ?),
        (?, ?, 'completed', ?, ?)
        """,
        (
            t4_id,
            None,
            json.dumps({"assignee": "bastion", "status": "ready"}),
            now - 3600,
            t4_id,
            104,
            json.dumps({"lock": "Rifqi-studio:1004", "run_id": 104}),
            now - 3000,
            t4_id,
            104,
            json.dumps({"pid": 20104}),
            now - 3000,
            t4_id,
            104,
            json.dumps(
                {
                    "result_len": 45,
                    "summary": "Verifikasi TLS selesai. LEAK-CANARY-EVENT-DONE",
                }
            ),
            now - 1800,
        ),
    )

    # 5. CRASHED task (assignee: vector)
    t5_id = "task-crashed-005"
    cur.execute(
        """
        INSERT INTO tasks (
            id, title, body, assignee, status, priority, created_by, created_at,
            started_at, completed_at, workspace_kind, workspace_path, branch_name,
            project_id, claim_lock, claim_expires, tenant, result, idempotency_key,
            consecutive_failures, worker_pid, worker_started_at, last_failure_error,
            max_runtime_seconds, last_heartbeat_at, current_run_id, workflow_template_id,
            current_step_key, skills, model_override, provider_override, reasoning_effort,
            max_retries, goal_mode, goal_max_turns, session_id, block_kind,
            block_recurrences, completion_contract
        ) VALUES (
            ?, ?, ?, ?, ?, ?, ?, ?,
            ?, ?, ?, ?, ?,
            ?, ?, ?, ?, ?, ?,
            ?, ?, ?, ?,
            ?, ?, ?, ?,
            ?, ?, ?, ?, ?,
            ?, ?, ?, ?, ?,
            ?, ?
        )
        """,
        (
            t5_id,
            "Kompilasi modul C++ ekstensi kalkulasi sensor",
            "Optimasi perhitungan matriks koordinat isometrik. "
            "LEAK-CANARY-TASK-005-BODY. Direktori rahasia: "
            "/srv/apps/hermes/build/secrets/.",
            "vector",
            "crashed",
            5,
            "jarvis",
            now - 2400,
            now - 2200,
            None,
            "scratch",
            "/srv/apps/hermes/kanban/boards/office-v2/workspaces/task-crashed-005",
            "perf/tensor-calc",
            "office-v2",
            None,
            None,
            "office-v2",
            None,
            "idem-key-crash-005",
            2,
            None,
            None,
            "SIGSEGV encountered in native memory allocator. LEAK-CANARY-TASK-005-ERROR",
            900,
            now - 2100,
            105,
            None,
            None,
            json.dumps(["cpp-build"]),
            None,
            None,
            "high",
            3,
            0,
            20,
            "sess-crash-105",
            None,
            0,
            "local-only",
        ),
    )
    cur.execute(
        """
        INSERT INTO task_runs (
            id, task_id, profile, step_key, status, claim_lock, claim_expires,
            worker_pid, worker_started_at, max_runtime_seconds, last_heartbeat_at,
            started_at, ended_at, outcome, summary, metadata, error
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            105,
            t5_id,
            "vector",
            "exec",
            "crashed",
            None,
            None,
            20105,
            now - 2200,
            900,
            now - 2100,
            now - 2200,
            now - 2100,
            "crashed",
            "Worker crash saat memproses alokasi buffer. LEAK-CANARY-RUN-105-SUMMARY",
            json.dumps({"signal": "SIGSEGV", "exit_code": 139}),
            "Fatal signal 11 (SIGSEGV) at address 0x7fff001. LEAK-CANARY-RUN-105-ERROR",
        ),
    )
    cur.execute(
        """
        INSERT INTO task_events (task_id, run_id, kind, payload, created_at)
        VALUES
        (?, ?, 'created', ?, ?),
        (?, ?, 'claimed', ?, ?),
        (?, ?, 'spawned', ?, ?),
        (?, ?, 'crashed', ?, ?)
        """,
        (
            t5_id,
            None,
            json.dumps({"assignee": "vector", "status": "ready"}),
            now - 2400,
            t5_id,
            105,
            json.dumps({"lock": "Rifqi-studio:1005", "run_id": 105}),
            now - 2200,
            t5_id,
            105,
            json.dumps({"pid": 20105}),
            now - 2200,
            t5_id,
            105,
            json.dumps(
                {
                    "error": "SIGSEGV in native allocator. LEAK-CANARY-EVENT-CRASH",
                    "failures": 2,
                }
            ),
            now - 2100,
        ),
    )

    # 6. TIMED_OUT task (assignee: merlin)
    t6_id = "task-timeout-006"
    cur.execute(
        """
        INSERT INTO tasks (
            id, title, body, assignee, status, priority, created_by, created_at,
            started_at, completed_at, workspace_kind, workspace_path, branch_name,
            project_id, claim_lock, claim_expires, tenant, result, idempotency_key,
            consecutive_failures, worker_pid, worker_started_at, last_failure_error,
            max_runtime_seconds, last_heartbeat_at, current_run_id, workflow_template_id,
            current_step_key, skills, model_override, provider_override, reasoning_effort,
            max_retries, goal_mode, goal_max_turns, session_id, block_kind,
            block_recurrences, completion_contract
        ) VALUES (
            ?, ?, ?, ?, ?, ?, ?, ?,
            ?, ?, ?, ?, ?,
            ?, ?, ?, ?, ?, ?,
            ?, ?, ?, ?,
            ?, ?, ?, ?,
            ?, ?, ?, ?, ?,
            ?, ?, ?, ?, ?,
            ?, ?
        )
        """,
        (
            t6_id,
            "Fine-tuning korpus dialog agen Bahasa Indonesia",
            "Iterasi evaluasi bobot dialog 16 agen. "
            "LEAK-CANARY-TASK-006-BODY. Token API rahasia: "
            "LEAK-CANARY-SECRET-TOKEN-MERLIN-8877.",
            "merlin",
            "timed_out",
            4,
            "jarvis",
            now - 4500,
            now - 4000,
            None,
            "scratch",
            "/srv/apps/hermes/kanban/boards/office-v2/workspaces/task-timeout-006",
            "ml/dialog-tuning",
            "office-v2",
            None,
            None,
            "office-v2",
            None,
            "idem-key-timeout-006",
            1,
            None,
            None,
            "Execution exceeded max_runtime_seconds (3600s). LEAK-CANARY-TASK-006-ERROR",
            3600,
            now - 400,
            106,
            None,
            None,
            json.dumps(["ml-eval"]),
            None,
            None,
            "medium",
            2,
            0,
            20,
            "sess-timeout-106",
            None,
            0,
            "local-only",
        ),
    )
    cur.execute(
        """
        INSERT INTO task_runs (
            id, task_id, profile, step_key, status, claim_lock, claim_expires,
            worker_pid, worker_started_at, max_runtime_seconds, last_heartbeat_at,
            started_at, ended_at, outcome, summary, metadata, error
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            106,
            t6_id,
            "merlin",
            "exec",
            "timed_out",
            None,
            None,
            20106,
            now - 4000,
            3600,
            now - 400,
            now - 4000,
            now - 400,
            "timed_out",
            "Waktu eksekusi habis sebelum iterasi tuntas. LEAK-CANARY-RUN-106-SUMMARY",
            json.dumps({"elapsed_seconds": 3600, "max_allowed": 3600}),
            "Worker process terminated by timeout watchdog. LEAK-CANARY-RUN-106-ERROR",
        ),
    )
    cur.execute(
        """
        INSERT INTO task_events (task_id, run_id, kind, payload, created_at)
        VALUES
        (?, ?, 'created', ?, ?),
        (?, ?, 'claimed', ?, ?),
        (?, ?, 'spawned', ?, ?),
        (?, ?, 'timed_out', ?, ?)
        """,
        (
            t6_id,
            None,
            json.dumps({"assignee": "merlin", "status": "ready"}),
            now - 4500,
            t6_id,
            106,
            json.dumps({"lock": "Rifqi-studio:1006", "run_id": 106}),
            now - 4000,
            t6_id,
            106,
            json.dumps({"pid": 20106}),
            now - 4000,
            t6_id,
            106,
            json.dumps(
                {
                    "error": "Iteration budget exhausted (200/200). LEAK-CANARY-EVENT-TIMEOUT",
                    "failures": 1,
                }
            ),
            now - 400,
        ),
    )

    # 7. HEARTBEAT BASI (stale heartbeat) task (assignee: oracle, status running but ancient ping)
    t7_id = "task-stale-oracle-007"
    cur.execute(
        """
        INSERT INTO tasks (
            id, title, body, assignee, status, priority, created_by, created_at,
            started_at, completed_at, workspace_kind, workspace_path, branch_name,
            project_id, claim_lock, claim_expires, tenant, result, idempotency_key,
            consecutive_failures, worker_pid, worker_started_at, last_failure_error,
            max_runtime_seconds, last_heartbeat_at, current_run_id, workflow_template_id,
            current_step_key, skills, model_override, provider_override, reasoning_effort,
            max_retries, goal_mode, goal_max_turns, session_id, block_kind,
            block_recurrences, completion_contract
        ) VALUES (
            ?, ?, ?, ?, ?, ?, ?, ?,
            ?, ?, ?, ?, ?,
            ?, ?, ?, ?, ?, ?,
            ?, ?, ?, ?,
            ?, ?, ?, ?,
            ?, ?, ?, ?, ?,
            ?, ?, ?, ?, ?,
            ?, ?
        )
        """,
        (
            t7_id,
            "Sintesis kimia palet warna isometrik di Lab Riset",
            "Eksperimen difusi warna dinamis 10 miliar persen. "
            "LEAK-CANARY-TASK-007-BODY. Path eksperimen: "
            "/srv/apps/hermes/lab/reagents/canary_secret.txt.",
            "oracle",
            "running",
            6,
            "jarvis",
            now - 7200,
            now - 7200,
            None,
            "scratch",
            "/srv/apps/hermes/kanban/boards/office-v2/workspaces/task-stale-oracle-007",
            "research/palette-synthesis",
            "office-v2",
            "Rifqi-studio:1007",
            now - 3600,
            "office-v2",
            None,
            "idem-key-stale-007",
            0,
            20107,
            now - 7200,
            None,
            14400,
            now - 5400,  # 90 minutes ago (> 1 hour = stale heartbeat!)
            107,
            None,
            None,
            json.dumps(["scientific-research"]),
            None,
            None,
            "high",
            3,
            0,
            20,
            "sess-stale-107",
            None,
            0,
            "local-only",
        ),
    )
    cur.execute(
        """
        INSERT INTO task_runs (
            id, task_id, profile, step_key, status, claim_lock, claim_expires,
            worker_pid, worker_started_at, max_runtime_seconds, last_heartbeat_at,
            started_at, ended_at, outcome, summary, metadata, error
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            107,
            t7_id,
            "oracle",
            "exec",
            "running",
            "Rifqi-studio:1007",
            now - 3600,
            20107,
            now - 7200,
            14400,
            now - 5400,  # Ancient heartbeat
            now - 7200,
            None,
            None,
            "Menunggu reaksi presipitasi warna. LEAK-CANARY-RUN-107-SUMMARY",
            json.dumps({"state": "waiting_reaction"}),
            None,
        ),
    )
    cur.execute(
        """
        INSERT INTO task_events (task_id, run_id, kind, payload, created_at)
        VALUES
        (?, ?, 'created', ?, ?),
        (?, ?, 'claimed', ?, ?),
        (?, ?, 'spawned', ?, ?),
        (?, ?, 'heartbeat', NULL, ?)
        """,
        (
            t7_id,
            None,
            json.dumps({"assignee": "oracle", "status": "ready"}),
            now - 7200,
            t7_id,
            107,
            json.dumps({"lock": "Rifqi-studio:1007", "run_id": 107}),
            now - 7200,
            t7_id,
            107,
            json.dumps({"pid": 20107}),
            now - 7200,
            t7_id,
            107,
            now - 5400,
        ),
    )

    # 8. JARVIS COMMENTS task (assignee: sentinel, comments thread by jarvis & sentinel)
    t8_id = "task-jarvis-comments-008"
    cur.execute(
        """
        INSERT INTO tasks (
            id, title, body, assignee, status, priority, created_by, created_at,
            started_at, completed_at, workspace_kind, workspace_path, branch_name,
            project_id, claim_lock, claim_expires, tenant, result, idempotency_key,
            consecutive_failures, worker_pid, worker_started_at, last_failure_error,
            max_runtime_seconds, last_heartbeat_at, current_run_id, workflow_template_id,
            current_step_key, skills, model_override, provider_override, reasoning_effort,
            max_retries, goal_mode, goal_max_turns, session_id, block_kind,
            block_recurrences, completion_contract
        ) VALUES (
            ?, ?, ?, ?, ?, ?, ?, ?,
            ?, ?, ?, ?, ?,
            ?, ?, ?, ?, ?, ?,
            ?, ?, ?, ?,
            ?, ?, ?, ?,
            ?, ?, ?, ?, ?,
            ?, ?, ?, ?, ?,
            ?, ?
        )
        """,
        (
            t8_id,
            "Audit independen kesiapan release gate G0",
            "Sentinel memeriksa pemenuhan acceptance criteria Gate G0 secara objektif. "
            "LEAK-CANARY-TASK-008-BODY. Internal report: "
            "/srv/apps/hermes/reports/confidential_g0.json.",
            "sentinel",
            "running",
            10,
            "jarvis",
            now - 300,
            now - 120,
            None,
            "scratch",
            "/srv/apps/hermes/kanban/boards/office-v2/workspaces/task-jarvis-comments-008",
            "qa/gate-g0-audit",
            "office-v2",
            "Rifqi-studio:1008",
            now + 900,
            "office-v2",
            None,
            "idem-key-qa-008",
            0,
            20108,
            now - 120,
            None,
            1800,
            now - 10,
            108,
            None,
            None,
            json.dumps(["sdlc-review", "qa-feedback"]),
            None,
            None,
            "high",
            3,
            0,
            20,
            "sess-qa-108",
            None,
            0,
            "local-only",
        ),
    )
    cur.execute(
        """
        INSERT INTO task_runs (
            id, task_id, profile, step_key, status, claim_lock, claim_expires,
            worker_pid, worker_started_at, max_runtime_seconds, last_heartbeat_at,
            started_at, ended_at, outcome, summary, metadata, error
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            108,
            t8_id,
            "sentinel",
            "exec",
            "running",
            "Rifqi-studio:1008",
            now + 900,
            20108,
            now - 120,
            1800,
            now - 10,
            now - 120,
            None,
            None,
            "Sedang mengevaluasi kesesuaian art spike, SQLite concurrency, dan ADR. "
            "LEAK-CANARY-RUN-108-SUMMARY",
            json.dumps({"phase": 0, "gate": "G0"}),
            None,
        ),
    )
    cur.execute(
        """
        INSERT INTO task_events (task_id, run_id, kind, payload, created_at)
        VALUES
        (?, ?, 'created', ?, ?),
        (?, ?, 'claimed', ?, ?),
        (?, ?, 'spawned', ?, ?),
        (?, ?, 'heartbeat', NULL, ?)
        """,
        (
            t8_id,
            None,
            json.dumps({"assignee": "sentinel", "status": "ready"}),
            now - 300,
            t8_id,
            108,
            json.dumps({"lock": "Rifqi-studio:1008", "run_id": 108}),
            now - 120,
            t8_id,
            108,
            json.dumps({"pid": 20108}),
            now - 120,
            t8_id,
            108,
            now - 10,
        ),
    )
    cur.execute(
        """
        INSERT INTO task_comments (task_id, author, body, created_at)
        VALUES
        (?, 'jarvis', ?, ?),
        (?, 'sentinel', ?, ?)
        """,
        (
            t8_id,
            "Instruksi orkestrasi: Sentinel wajib melakukan pengujian independen dari nol tanpa "
            "mempercayai self-report implementer. Periksa seluruh kriteria G0 secara ketat. "
            "LEAK-CANARY-COMMENT-JARVIS-GATE-G0",
            now - 100,
            t8_id,
            "Verifikasi langsung sedang dijalankan. Tidak ada pelemahan assertion atau asumsi "
            "tanpa bukti eksekusi nyata. LEAK-CANARY-COMMENT-SENTINEL-INSPECT",
            now - 50,
        ),
    )

    # Attachments & Notify subs
    cur.execute(
        """
        INSERT INTO task_attachments (
            task_id, filename, stored_path, content_type, size, uploaded_by, created_at
        ) VALUES (
            ?, 'audit_spec.json',
            '/srv/apps/hermes/kanban/boards/office-v2/attachments/task-jarvis-comments-008/audit_spec.json',
            'application/json', 1024, 'sentinel', ?
        )
        """,
        (t8_id, now - 60),
    )
    cur.execute(
        """
        INSERT INTO kanban_notify_subs (
            task_id, platform, chat_id, thread_id, user_id, user_id_alt, chat_type,
            notifier_profile, delivery_mode, delivery_metadata, created_at,
            last_event_id, last_ping_event_id
        ) VALUES (
            ?, 'telegram', '149862767', '', 'Rifqi', NULL, 'private', 'sentinel',
            'notify', NULL, ?, 1, 0
        )
        """,
        (t8_id, now - 250),
    )

    conn.commit()


def populate_secondary_board(conn: sqlite3.Connection, now: int) -> None:
    """Populate secondary board (board_b) representing multi-board environment."""
    cur = conn.cursor()

    # Task B1: running
    tb1_id = "task-b-running-warden-001"
    cur.execute(
        """
        INSERT INTO tasks (
            id, title, body, assignee, status, priority, created_by, created_at,
            started_at, completed_at, workspace_kind, workspace_path, branch_name,
            project_id, claim_lock, claim_expires, tenant, result, idempotency_key,
            consecutive_failures, worker_pid, worker_started_at, last_failure_error,
            max_runtime_seconds, last_heartbeat_at, current_run_id, workflow_template_id,
            current_step_key, skills, model_override, provider_override, reasoning_effort,
            max_retries, goal_mode, goal_max_turns, session_id, block_kind,
            block_recurrences, completion_contract
        ) VALUES (
            ?, ?, ?, ?, ?, ?, ?, ?,
            ?, ?, ?, ?, ?,
            ?, ?, ?, ?, ?, ?,
            ?, ?, ?, ?,
            ?, ?, ?, ?,
            ?, ?, ?, ?, ?,
            ?, ?, ?, ?, ?,
            ?, ?
        )
        """,
        (
            tb1_id,
            "Monitoring vitals host dan pembersihan disk",
            "Warden memindai kuota penyimpanan dan siklus rotasi log sistem. "
            "LEAK-CANARY-BOARD-B-001-BODY. Jalur rahasia infra: "
            "/srv/apps/hermes/infra/tokens/warden.key.",
            "warden",
            "running",
            7,
            "jarvis",
            now - 500,
            now - 200,
            None,
            "scratch",
            "/srv/apps/hermes/kanban/boards/infra-board/workspaces/task-b-running-warden-001",
            "infra/disk-audit",
            "infra-board",
            "Rifqi-studio:2001",
            now + 600,
            "infra-board",
            None,
            "idem-b-001",
            0,
            30101,
            now - 200,
            None,
            1800,
            now - 20,
            201,
            None,
            None,
            json.dumps(["system-admin"]),
            None,
            None,
            "medium",
            3,
            0,
            20,
            "sess-b-201",
            None,
            0,
            "local-only",
        ),
    )
    cur.execute(
        """
        INSERT INTO task_runs (
            id, task_id, profile, step_key, status, claim_lock, claim_expires,
            worker_pid, worker_started_at, max_runtime_seconds, last_heartbeat_at,
            started_at, ended_at, outcome, summary, metadata, error
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            201,
            tb1_id,
            "warden",
            "exec",
            "running",
            "Rifqi-studio:2001",
            now + 600,
            30101,
            now - 200,
            1800,
            now - 20,
            now - 200,
            None,
            None,
            "Pembersihan cache dan analisis partisi disk berlangsung. "
            "LEAK-CANARY-BOARD-B-RUN-SUMMARY",
            json.dumps({"board": "infra-board"}),
            None,
        ),
    )
    cur.execute(
        """
        INSERT INTO task_events (task_id, run_id, kind, payload, created_at)
        VALUES
        (?, ?, 'created', ?, ?),
        (?, ?, 'claimed', ?, ?),
        (?, ?, 'spawned', ?, ?),
        (?, ?, 'heartbeat', NULL, ?)
        """,
        (
            tb1_id,
            None,
            json.dumps({"assignee": "warden", "status": "ready", "board": "infra-board"}),
            now - 500,
            tb1_id,
            201,
            json.dumps({"lock": "Rifqi-studio:2001", "run_id": 201}),
            now - 200,
            tb1_id,
            201,
            json.dumps({"pid": 30101}),
            now - 200,
            tb1_id,
            201,
            now - 20,
        ),
    )
    cur.execute(
        """
        INSERT INTO task_comments (task_id, author, body, created_at)
        VALUES
        (?, 'jarvis', ?, ?)
        """,
        (
            tb1_id,
            "Pastikan pembersihan log tidak menghapus direktori wal hermes. "
            "LEAK-CANARY-BOARD-B-JARVIS-COMMENT",
            now - 150,
        ),
    )

    # Task B2: done
    tb2_id = "task-b-done-steward-002"
    cur.execute(
        """
        INSERT INTO tasks (
            id, title, body, assignee, status, priority, created_by, created_at,
            started_at, completed_at, workspace_kind, workspace_path, branch_name,
            project_id, claim_lock, claim_expires, tenant, result, idempotency_key,
            consecutive_failures, worker_pid, worker_started_at, last_failure_error,
            max_runtime_seconds, last_heartbeat_at, current_run_id, workflow_template_id,
            current_step_key, skills, model_override, provider_override, reasoning_effort,
            max_retries, goal_mode, goal_max_turns, session_id, block_kind,
            block_recurrences, completion_contract
        ) VALUES (
            ?, ?, ?, ?, ?, ?, ?, ?,
            ?, ?, ?, ?, ?,
            ?, ?, ?, ?, ?, ?,
            ?, ?, ?, ?,
            ?, ?, ?, ?,
            ?, ?, ?, ?, ?,
            ?, ?, ?, ?, ?,
            ?, ?
        )
        """,
        (
            tb2_id,
            "Inspeksi tile rendering Graphics Lab",
            "Steward memverifikasi tekstur lantai pada secondary board. "
            "LEAK-CANARY-BOARD-B-002-BODY.",
            "steward",
            "done",
            5,
            "jarvis",
            now - 2000,
            now - 1500,
            now - 500,
            "scratch",
            "/srv/apps/hermes/kanban/boards/infra-board/workspaces/task-b-done-steward-002",
            "art/tile-inspection",
            "infra-board",
            None,
            None,
            "infra-board",
            "Seluruh tile rendered tanpa artefak. LEAK-CANARY-BOARD-B-002-RESULT",
            "idem-b-002",
            0,
            None,
            None,
            None,
            1200,
            now - 500,
            202,
            None,
            None,
            json.dumps(["tilemap"]),
            None,
            None,
            "medium",
            3,
            0,
            20,
            "sess-b-202",
            None,
            0,
            "local-only",
        ),
    )
    cur.execute(
        """
        INSERT INTO task_runs (
            id, task_id, profile, step_key, status, claim_lock, claim_expires,
            worker_pid, worker_started_at, max_runtime_seconds, last_heartbeat_at,
            started_at, ended_at, outcome, summary, metadata, error
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            202,
            tb2_id,
            "steward",
            "exec",
            "done",
            None,
            None,
            30102,
            now - 1500,
            1200,
            now - 500,
            now - 1500,
            now - 500,
            "completed",
            "Pemeriksaan tile selesai sempurna. LEAK-CANARY-BOARD-B-RUN-002-SUMMARY",
            json.dumps({"board": "infra-board", "tiles_checked": 64}),
            None,
        ),
    )
    cur.execute(
        """
        INSERT INTO task_events (task_id, run_id, kind, payload, created_at)
        VALUES
        (?, ?, 'created', ?, ?),
        (?, ?, 'claimed', ?, ?),
        (?, ?, 'spawned', ?, ?),
        (?, ?, 'completed', ?, ?)
        """,
        (
            tb2_id,
            None,
            json.dumps({"assignee": "steward", "status": "ready"}),
            now - 2000,
            tb2_id,
            202,
            json.dumps({"lock": "Rifqi-studio:2002", "run_id": 202}),
            now - 1500,
            tb2_id,
            202,
            json.dumps({"pid": 30102}),
            now - 1500,
            tb2_id,
            202,
            json.dumps({"summary": "Tile rendering valid."}),
            now - 500,
        ),
    )

    conn.commit()


def generate_all_fixtures(base_fixtures_dir: Path, now: int | None = None) -> list[Path]:
    """Generate both primary and secondary Kanban fixture databases."""
    if now is None:
        # Use an anchored or live timestamp (1791029000 corresponds to Oct 2026)
        now = int(time.time())

    primary_db = base_fixtures_dir / "kanban_fixture.db"
    secondary_db = base_fixtures_dir / "kanban_secondary_fixture.db"
    board_b_db = base_fixtures_dir / "boards" / "board_b" / "kanban.db"

    # 1. Primary Board Fixture
    conn_primary = init_database(primary_db)
    try:
        populate_primary_board(conn_primary, now)
        conn_primary.cursor().execute("PRAGMA wal_checkpoint(TRUNCATE);")
        conn_primary.commit()
    finally:
        conn_primary.close()

    # 2. Secondary Board Fixture
    conn_sec = init_database(secondary_db)
    try:
        populate_secondary_board(conn_sec, now)
        conn_sec.cursor().execute("PRAGMA wal_checkpoint(TRUNCATE);")
        conn_sec.commit()
    finally:
        conn_sec.close()

    # 3. Mirror secondary into boards/board_b/kanban.db for multi-board directory traversal tests
    board_b_db.parent.mkdir(parents=True, exist_ok=True)
    if board_b_db.exists():
        board_b_db.unlink()
    conn_b = init_database(board_b_db)
    try:
        populate_secondary_board(conn_b, now)
        conn_b.cursor().execute("PRAGMA wal_checkpoint(TRUNCATE);")
        conn_b.commit()
    finally:
        conn_b.close()

    return [primary_db, secondary_db, board_b_db]


def main() -> None:
    """CLI entrypoint for fixture generator."""
    fixtures_dir = Path(__file__).resolve().parent
    generated = generate_all_fixtures(fixtures_dir)
    print(f"Successfully generated {len(generated)} fixture databases:")
    for path in generated:
        print(f"  - {path}")


if __name__ == "__main__":
    main()
