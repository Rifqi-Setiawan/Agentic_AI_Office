"""SQLite transactional projection. Per-operation connections; local-disk WAL only.

A span is an outstanding delegation, not a CPU/process status. Parents stay open
while children run. Completion rejects open children; cancellation/expiry cascades.
"""
from __future__ import annotations

import hashlib
import json
import os
import sqlite3
import time
import uuid
from contextlib import contextmanager
from pathlib import Path
from typing import Any, Callable, Iterator

from .models import (
    ACTIVE_STATES, OPEN_STATES, ArtifactSubmit, ReleaseAuthorize, ReleaseConfirm,
    SpanCreate, SpanHeartbeat, SpanTransition, TaskCreate, Verification,
)

SCHEMA = """
CREATE TABLE IF NOT EXISTS mc_meta (
  key TEXT PRIMARY KEY, value TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS mc_spans (
  span_id TEXT PRIMARY KEY, mission_id TEXT NOT NULL, task_id TEXT NOT NULL,
  parent_span_id TEXT REFERENCES mc_spans(span_id), caller TEXT NOT NULL, callee TEXT NOT NULL,
  state TEXT NOT NULL CHECK(state IN ('queued','running','waiting','completed','failed','cancelled','expired')),
  version INTEGER NOT NULL DEFAULT 0, created_at_ms INTEGER NOT NULL,
  updated_at_ms INTEGER NOT NULL, lease_expires_at_ms INTEGER NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS mc_one_root ON mc_spans(mission_id) WHERE parent_span_id IS NULL;
CREATE INDEX IF NOT EXISTS mc_parent ON mc_spans(parent_span_id);
CREATE INDEX IF NOT EXISTS mc_open ON mc_spans(state, lease_expires_at_ms);
CREATE TABLE IF NOT EXISTS mc_tasks (
  task_id TEXT PRIMARY KEY, mission_id TEXT NOT NULL, contract_json TEXT NOT NULL,
  state TEXT NOT NULL, version INTEGER NOT NULL DEFAULT 0, attempt INTEGER NOT NULL DEFAULT 0,
  artifact_digest TEXT, verification_json TEXT, authorization_id TEXT, published_ref TEXT,
  created_at_ms INTEGER NOT NULL, updated_at_ms INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS mc_events (
  seq INTEGER PRIMARY KEY AUTOINCREMENT, kind TEXT NOT NULL, at_ms INTEGER NOT NULL,
  mission_id TEXT, task_id TEXT, span_id TEXT, actor TEXT NOT NULL, details_json TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS mc_events_time ON mc_events(at_ms);
CREATE TABLE IF NOT EXISTS mc_idempotency (
  event_id TEXT PRIMARY KEY, request_hash TEXT NOT NULL, result_json TEXT NOT NULL, at_ms INTEGER NOT NULL
);
"""


class StoreError(Exception):
    def __init__(self, status: int, detail: str):
        super().__init__(detail)
        self.status = status
        self.detail = detail


def canonical_json(value: Any) -> str:
    return json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=True, allow_nan=False)


class MissionStore:
    def __init__(self, path: str | Path, clock: Callable[[], int] | None = None):
        self.path = Path(path).expanduser().resolve()
        self.clock = clock or (lambda: time.time_ns() // 1_000_000)
        self.path.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
        with self._connection() as db:
            db.execute("PRAGMA journal_mode=WAL")
            db.executescript(SCHEMA)
            db.execute("INSERT OR IGNORE INTO mc_meta VALUES ('schema_version','1')")
            version = db.execute("SELECT value FROM mc_meta WHERE key='schema_version'").fetchone()[0]
            if version != "1":
                raise RuntimeError("Unsupported mission-control schema version; do not auto-downgrade")
            db.execute("INSERT OR IGNORE INTO mc_meta VALUES ('stream_id',?)", (str(uuid.uuid4()),))
            db.execute("INSERT OR IGNORE INTO mc_meta VALUES ('revision','0')")
        os.chmod(self.path, 0o600)

    @contextmanager
    def _connection(self) -> Iterator[sqlite3.Connection]:
        db = sqlite3.connect(self.path, timeout=5, isolation_level=None)
        db.row_factory = sqlite3.Row
        db.execute("PRAGMA foreign_keys=ON")
        db.execute("PRAGMA busy_timeout=5000")
        db.execute("PRAGMA synchronous=FULL")
        try:
            yield db
        finally:
            db.close()

    @contextmanager
    def _transaction(self) -> Iterator[sqlite3.Connection]:
        with self._connection() as db:
            db.execute("BEGIN IMMEDIATE")
            try:
                yield db
                db.commit()
            except BaseException:
                db.rollback()
                raise

    def _event(self, db: sqlite3.Connection, kind: str, actor: str, row: dict,
               details: dict, now: int) -> None:
        db.execute(
            "INSERT INTO mc_events(kind,at_ms,mission_id,task_id,span_id,actor,details_json) VALUES(?,?,?,?,?,?,?)",
            (kind, now, row.get("mission_id"), row.get("task_id"), row.get("span_id"), actor, canonical_json(details)),
        )
        db.execute("UPDATE mc_meta SET value=CAST(value AS INTEGER)+1 WHERE key='revision'")

    def _expire(self, db: sqlite3.Connection, now: int) -> None:
        expired = [r[0] for r in db.execute(
            "SELECT span_id FROM mc_spans WHERE state IN ('queued','running','waiting') AND lease_expires_at_ms<=?",
            (now,),
        )]
        for span_id in expired:
            self._cascade(db, span_id, "expired", "lease-monitor", now)

    def _cascade(self, db: sqlite3.Connection, span_id: str, state: str, actor: str, now: int) -> None:
        rows = db.execute("""
            WITH RECURSIVE descendants(span_id) AS (
              SELECT span_id FROM mc_spans WHERE span_id=?
              UNION ALL SELECT s.span_id FROM mc_spans s JOIN descendants d ON s.parent_span_id=d.span_id
            ) SELECT s.* FROM mc_spans s JOIN descendants d USING(span_id)
            WHERE s.state IN ('queued','running','waiting')
        """, (span_id,)).fetchall()
        for row in rows:
            db.execute("UPDATE mc_spans SET state=?,version=version+1,updated_at_ms=? WHERE span_id=?",
                       (state, now, row["span_id"]))
            self._event(db, f"span.{state}", actor, dict(row), {"cause_span_id": span_id}, now)

    def _mutate(self, operation: str, actor: str, command: Any, fn: Callable,
                resource_id: str = "") -> dict:
        data = command.model_dump(mode="json")
        fingerprint = hashlib.sha256(canonical_json([operation, resource_id, actor, data]).encode()).hexdigest()
        # Persist lease expiration even when the subsequent requested mutation is rejected.
        with self._transaction() as db:
            self._expire(db, self.clock())
        with self._transaction() as db:
            now = self.clock()
            # No nested rollback can revive an expired span: validators also check lease times.
            prior = db.execute("SELECT * FROM mc_idempotency WHERE event_id=?", (command.event_id,)).fetchone()
            if prior:
                if prior["request_hash"] != fingerprint:
                    raise StoreError(409, "Idempotency key was reused with a different request or actor")
                result = json.loads(prior["result_json"])
                result["replayed"] = True
                return result
            result = fn(db, now)
            result["replayed"] = False
            db.execute("INSERT INTO mc_idempotency VALUES (?,?,?,?)",
                       (command.event_id, fingerprint, canonical_json(result), now))
            return result

    def _span(self, db: sqlite3.Connection, span_id: str) -> dict:
        row = db.execute("SELECT * FROM mc_spans WHERE span_id=?", (span_id,)).fetchone()
        if not row:
            raise StoreError(404, "Span not found")
        return dict(row)

    def _open_span(self, db: sqlite3.Connection, span_id: str, now: int) -> dict:
        row = self._span(db, span_id)
        if row["state"] not in OPEN_STATES or row["lease_expires_at_ms"] <= now:
            raise StoreError(409, "Span is terminal or its lease has expired")
        current = row
        depth = 0
        while current["parent_span_id"]:
            depth += 1
            if depth > 64:
                raise StoreError(409, "Maximum call depth exceeded")
            current = self._span(db, current["parent_span_id"])
            if current["state"] not in ACTIVE_STATES or current["lease_expires_at_ms"] <= now:
                raise StoreError(409, "Parent delegation is no longer active")
        return row

    @staticmethod
    def _version(row: dict, expected: int) -> None:
        if row["version"] != expected:
            raise StoreError(409, "Stale version; read current state before issuing a new command")

    def create_span(self, actor: str, command: SpanCreate) -> dict:
        def perform(db, now):
            if actor not in {command.caller, "runtime-dispatcher"}:
                raise StoreError(403, "Only the caller or trusted dispatcher may create a delegation")
            if db.execute("SELECT 1 FROM mc_spans WHERE span_id=?", (command.span_id,)).fetchone():
                raise StoreError(409, "Span ID already exists")
            if db.execute("SELECT COUNT(*) FROM mc_spans WHERE state IN ('queued','running','waiting')").fetchone()[0] >= 4096:
                raise StoreError(429, "Active delegation capacity reached")
            if command.parent_span_id:
                parent = self._open_span(db, command.parent_span_id, now)
                if parent["state"] not in ACTIVE_STATES or parent["callee"] != command.caller:
                    raise StoreError(409, "Child caller must equal the active parent's callee")
                if parent["mission_id"] != command.mission_id:
                    raise StoreError(409, "A child must retain its parent's mission ID")
                depth, ancestor = 1, parent
                while ancestor["parent_span_id"]:
                    depth += 1
                    ancestor = self._span(db, ancestor["parent_span_id"])
                if depth >= 64:
                    raise StoreError(409, "Maximum call depth exceeded")
            else:
                if (command.caller, command.callee) != ("rifqi", "vps-boss"):
                    raise StoreError(409, "A sovereign mission starts with rifqi -> vps-boss")
                if db.execute("SELECT 1 FROM mc_spans WHERE mission_id=? AND parent_span_id IS NULL", (command.mission_id,)).fetchone():
                    raise StoreError(409, "Mission already has a root; create a new mission for a new root")
            db.execute("""INSERT INTO mc_spans
                (span_id,mission_id,task_id,parent_span_id,caller,callee,state,version,created_at_ms,updated_at_ms,lease_expires_at_ms)
                VALUES(?,?,?,?,?,?,'queued',0,?,?,?)""",
                (command.span_id, command.mission_id, command.task_id, command.parent_span_id,
                 command.caller, command.callee, now, now, now + command.lease_seconds * 1000))
            row = self._span(db, command.span_id)
            self._event(db, "span.queued", actor, row, {"caller": row["caller"], "callee": row["callee"]}, now)
            return {"span": row}
        return self._mutate("create_span", actor, command, perform)

    def transition_span(self, actor: str, span_id: str, command: SpanTransition) -> dict:
        def perform(db, now):
            row = self._open_span(db, span_id, now)
            caller_cancel = actor == row["caller"] and command.state == "cancelled"
            if actor not in {row["callee"], "runtime-dispatcher"} and not caller_cancel:
                raise StoreError(403, "Only the callee or dispatcher may update execution state")
            self._version(row, command.expected_version)
            allowed = {"queued": {"running", "failed", "cancelled"},
                       "running": {"waiting", "completed", "failed", "cancelled"},
                       "waiting": {"running", "completed", "failed", "cancelled"}}
            if command.state not in allowed[row["state"]]:
                raise StoreError(409, "Illegal span state transition")
            if command.state == "completed" and db.execute(
                "SELECT 1 FROM mc_spans WHERE parent_span_id=? AND state IN ('queued','running','waiting') LIMIT 1", (span_id,)
            ).fetchone():
                raise StoreError(409, "Cannot complete a delegation with open children")
            if command.state in {"failed", "cancelled"}:
                self._cascade(db, span_id, command.state, actor, now)
            else:
                db.execute("UPDATE mc_spans SET state=?,version=version+1,updated_at_ms=?,lease_expires_at_ms=? WHERE span_id=?",
                           (command.state, now, now + command.lease_seconds * 1000, span_id))
                self._event(db, f"span.{command.state}", actor, row, {"caller": row["caller"], "callee": row["callee"]}, now)
            return {"span": self._span(db, span_id)}
        return self._mutate("transition_span", actor, command, perform, span_id)

    def heartbeat(self, actor: str, span_id: str, command: SpanHeartbeat) -> dict:
        def perform(db, now):
            row = self._open_span(db, span_id, now)
            if actor not in {row["callee"], "runtime-dispatcher"}:
                raise StoreError(403, "Only the callee or dispatcher may renew a lease")
            self._version(row, command.expected_version)
            db.execute("UPDATE mc_spans SET version=version+1,updated_at_ms=?,lease_expires_at_ms=? WHERE span_id=?",
                       (now, now + command.lease_seconds * 1000, span_id))
            self._event(db, "span.heartbeat", actor, row, {}, now)
            return {"span": self._span(db, span_id)}
        return self._mutate("heartbeat", actor, command, perform, span_id)

    def get_span(self, span_id: str) -> dict:
        with self._transaction() as db:
            self._expire(db, self.clock())
            return self._span(db, span_id)

    def _task(self, db: sqlite3.Connection, task_id: str) -> dict:
        row = db.execute("SELECT * FROM mc_tasks WHERE task_id=?", (task_id,)).fetchone()
        if not row:
            raise StoreError(404, "Task contract not found")
        result = dict(row)
        result["contract"] = json.loads(result.pop("contract_json"))
        raw = result.pop("verification_json")
        result["verification"] = json.loads(raw) if raw else None
        return result

    def get_task(self, task_id: str) -> dict:
        with self._connection() as db:
            return self._task(db, task_id)

    def create_task(self, actor: str, command: TaskCreate) -> dict:
        def perform(db, now):
            if actor not in {"vps-boss", "runtime-dispatcher"}:
                raise StoreError(403, "Task contracts belong to the orchestrator")
            if command.deadline_at_ms <= now:
                raise StoreError(422, "Task deadline must be in the future")
            if db.execute("SELECT 1 FROM mc_tasks WHERE task_id=?", (command.task_id,)).fetchone():
                raise StoreError(409, "Task contract already exists and is immutable")
            contract = command.model_dump(exclude={"event_id"}, mode="json")
            db.execute("INSERT INTO mc_tasks(task_id,mission_id,contract_json,state,created_at_ms,updated_at_ms) VALUES(?,?,?,'implementing',?,?)",
                       (command.task_id, command.mission_id, canonical_json(contract), now, now))
            row = self._task(db, command.task_id)
            self._event(db, "task.created", actor, row, {}, now)
            return {"task": row}
        return self._mutate("create_task", actor, command, perform)

    def _gate(self, db: sqlite3.Connection, task_id: str, command, now: int) -> dict:
        row = self._task(db, task_id)
        self._version(row, command.expected_version)
        if row["contract"]["deadline_at_ms"] <= now:
            raise StoreError(409, "Task deadline expired; create a revised contract")
        return row

    def submit_artifact(self, actor: str, task_id: str, command: ArtifactSubmit) -> dict:
        def perform(db, now):
            row = self._gate(db, task_id, command, now)
            if actor not in row["contract"]["implementers"]:
                raise StoreError(403, "Only a declared implementer may submit this artifact")
            if row["state"] not in {"implementing", "review", "rejected", "verified"}:
                raise StoreError(409, "An authorized/released artifact is immutable; create a new task")
            if row["attempt"] >= row["contract"]["max_attempts"]:
                raise StoreError(409, "Attempt budget exhausted; escalate to the human authority")
            db.execute("""UPDATE mc_tasks SET state='review',version=version+1,attempt=attempt+1,
                artifact_digest=?,verification_json=NULL,authorization_id=NULL,updated_at_ms=? WHERE task_id=?""",
                (command.artifact_digest, now, task_id))
            self._event(db, "artifact.submitted", actor, row, {"artifact_digest": command.artifact_digest}, now)
            return {"task": self._task(db, task_id)}
        return self._mutate("submit_artifact", actor, command, perform, task_id)

    def verify_artifact(self, actor: str, task_id: str, command: Verification) -> dict:
        def perform(db, now):
            row = self._gate(db, task_id, command, now)
            if actor != "swe-verifier" or actor in row["contract"]["implementers"]:
                raise StoreError(403, "Independent verifier identity is required")
            if row["state"] != "review" or row["artifact_digest"] != command.artifact_digest:
                raise StoreError(409, "Only the current submitted digest may be verified")
            evidence = {**command.model_dump(exclude={"event_id", "expected_version"}), "verifier": actor, "at_ms": now}
            state = "verified" if command.verdict == "approved" else "rejected"
            db.execute("UPDATE mc_tasks SET state=?,version=version+1,verification_json=?,updated_at_ms=? WHERE task_id=?",
                       (state, canonical_json(evidence), now, task_id))
            self._event(db, f"artifact.{command.verdict}", actor, row, {"artifact_digest": command.artifact_digest}, now)
            return {"task": self._task(db, task_id)}
        return self._mutate("verify_artifact", actor, command, perform, task_id)

    def authorize_release(self, actor: str, task_id: str, command: ReleaseAuthorize) -> dict:
        def perform(db, now):
            row = self._gate(db, task_id, command, now)
            if actor != "github-manager" or actor in row["contract"]["implementers"]:
                raise StoreError(403, "A separate release-manager identity is required")
            evidence = row["verification"]
            if (row["state"] != "verified" or row["artifact_digest"] != command.artifact_digest or not evidence
                    or evidence["verdict"] != "approved" or evidence["artifact_digest"] != command.artifact_digest
                    or evidence["verifier"] == actor):
                raise StoreError(409, "Release requires independent approval of this exact artifact digest")
            authorization_id = str(uuid.uuid4())
            db.execute("UPDATE mc_tasks SET state='release_authorized',version=version+1,authorization_id=?,updated_at_ms=? WHERE task_id=?",
                       (authorization_id, now, task_id))
            self._event(db, "release.authorized", actor, row, {"artifact_digest": command.artifact_digest}, now)
            return {"task": self._task(db, task_id)}
        return self._mutate("authorize_release", actor, command, perform, task_id)

    def confirm_release(self, actor: str, task_id: str, command: ReleaseConfirm) -> dict:
        def perform(db, now):
            row = self._gate(db, task_id, command, now)
            if actor != "github-manager":
                raise StoreError(403, "Only the release manager may confirm publication")
            if (row["state"] != "release_authorized" or row["artifact_digest"] != command.artifact_digest
                    or row["authorization_id"] != command.authorization_id):
                raise StoreError(409, "Publication must match the authorized immutable artifact")
            db.execute("UPDATE mc_tasks SET state='released',version=version+1,published_ref=?,updated_at_ms=? WHERE task_id=?",
                       (command.published_ref, now, task_id))
            self._event(db, "release.confirmed", actor, row, {"published_ref": command.published_ref}, now)
            return {"task": self._task(db, task_id)}
        return self._mutate("confirm_release", actor, command, perform, task_id)

    def snapshot(self) -> dict:
        with self._transaction() as db:
            now = self.clock()
            self._expire(db, now)
            meta = dict(db.execute("SELECT key,value FROM mc_meta").fetchall())
            rows = [dict(r) for r in db.execute("SELECT * FROM mc_spans WHERE state IN ('queued','running','waiting') ORDER BY created_at_ms,span_id")]
            active = {r["span_id"]: r for r in rows if r["state"] in ACTIVE_STATES}
            parents = {r["parent_span_id"] for r in active.values() if r["parent_span_id"]}
            chains, pairs = [], {}
            for leaf in active.values():
                if leaf["span_id"] in parents:
                    continue
                spans, cursor, seen = [], leaf, set()
                while cursor:
                    if cursor["span_id"] in seen:
                        raise StoreError(500, "Corrupt delegation ancestry detected")
                    seen.add(cursor["span_id"])
                    spans.append(cursor)
                    parent_id = cursor["parent_span_id"]
                    if parent_id and parent_id not in active:
                        raise StoreError(500, "Active child has no active parent")
                    cursor = active.get(parent_id)
                spans.reverse()
                path = [spans[0]["caller"], *[r["callee"] for r in spans]]
                chains.append({
                    "chain_id": leaf["span_id"], "mission_id": leaf["mission_id"],
                    "task_id": leaf["task_id"], "span_ids": [r["span_id"] for r in spans],
                    "active_delegation_path": path,
                    "expires_at_ms": min(r["lease_expires_at_ms"] for r in spans),
                })
            for row in active.values():
                cursor, expiry = row, row["lease_expires_at_ms"]
                while cursor["parent_span_id"]:
                    cursor = active[cursor["parent_span_id"]]
                    expiry = min(expiry, cursor["lease_expires_at_ms"])
                key = (row["caller"], row["callee"])
                pair = pairs.setdefault(key, {"caller": key[0], "callee": key[1], "invocations": []})
                pair["invocations"].append({
                    "span_id": row["span_id"], "mission_id": row["mission_id"], "task_id": row["task_id"],
                    "state": row["state"], "expires_at_ms": expiry,
                })
            events = []
            for row in db.execute("SELECT * FROM mc_events WHERE kind!='span.heartbeat' ORDER BY seq DESC LIMIT 50"):
                event = dict(row)
                event["details"] = json.loads(event.pop("details_json"))
                events.append(event)
            gates = [dict(r) for r in db.execute(
                "SELECT task_id,mission_id,state,version,attempt,artifact_digest,updated_at_ms FROM mc_tasks ORDER BY updated_at_ms DESC,task_id LIMIT 30"
            )]
            instrumented = bool(db.execute("SELECT 1 FROM mc_spans LIMIT 1").fetchone())
            revision = int(meta["revision"])
        return {
            "schema_version": 1, "type": "delegation_snapshot", "stream_id": meta["stream_id"],
            "revision": revision, "generated_at_ms": now, "freshness_ttl_ms": 15000,
            "instrumentation_seen": instrumented,
            "active_delegation_chains": chains, "caller_callee_pairs": list(pairs.values()),
            "queued_count": sum(r["state"] == "queued" for r in rows),
            "recent_events": events, "release_gates": gates,
        }
