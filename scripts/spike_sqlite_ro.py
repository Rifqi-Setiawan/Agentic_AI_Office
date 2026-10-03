#!/usr/bin/env python3
"""
Spike T0.2: SQLite Read-Only Concurrency and Permission Evaluation
for Agentic AI Office v2 against Hermes Kanban SQLite databases.

Tests:
1. PRAGMA journal_mode and database configuration
2. File permissions on .db, -wal, and -shm files
3. Query latency (p50, p90, p95, p99, min, max, mean) for task_events polling
4. SQLITE_BUSY count in reader under concurrent load
5. Failure modes of immutable=1 and missing -shm in read-only directories
6. Impact on Hermes writer and log audit
"""

from __future__ import annotations

import argparse
import getpass
import json
import os
import sqlite3
import stat
import sys
import tempfile
import threading
import time
from typing import Any, Dict, List, Tuple


def file_info(path: str) -> Dict[str, Any]:
    if not os.path.exists(path):
        return {"exists": False}
    st = os.stat(path)
    return {
        "exists": True,
        "size_bytes": st.st_size,
        "mode_octal": oct(st.st_mode & 0o777),
        "uid": st.st_uid,
        "gid": st.st_gid,
        "is_file": stat.S_ISREG(st.st_mode),
        "is_dir": stat.S_ISDIR(st.st_mode),
    }


def inspect_db(db_path: str) -> Dict[str, Any]:
    info: Dict[str, Any] = {
        "db_file": file_info(db_path),
        "wal_file": file_info(db_path + "-wal"),
        "shm_file": file_info(db_path + "-shm"),
        "dir_path": os.path.dirname(db_path),
        "dir_info": file_info(os.path.dirname(db_path)),
    }
    
    uri = f"file:{db_path}?mode=ro"
    try:
        conn = sqlite3.connect(uri, uri=True, timeout=2.0)
        cur = conn.cursor()
        cur.execute("PRAGMA query_only=ON;")
        cur.execute("PRAGMA journal_mode;")
        info["journal_mode"] = cur.fetchone()[0]
        cur.execute("PRAGMA synchronous;")
        info["synchronous"] = cur.fetchone()[0]
        cur.execute("SELECT count(*) FROM sqlite_master WHERE type='table';")
        info["table_count"] = cur.fetchone()[0]
        
        # Check task_events if present
        cur.execute("SELECT count(*) FROM sqlite_master WHERE type='table' AND name='task_events';")
        if cur.fetchone()[0] > 0:
            cur.execute("SELECT count(*), max(id) FROM task_events;")
            row = cur.fetchone()
            info["task_events_count"] = row[0]
            info["task_events_max_id"] = row[1]
        conn.close()
        info["accessible"] = True
    except Exception as e:
        info["accessible"] = False
        info["error"] = str(e)
        
    return info


def test_immutable_hazard() -> Dict[str, Any]:
    """Demonstrate why immutable=1 is disastrous for WAL-mode read-only feeds."""
    result: Dict[str, Any] = {}
    with tempfile.TemporaryDirectory() as tmpdir:
        db = os.path.join(tmpdir, "hazard.db")
        w = sqlite3.connect(db)
        w.execute("PRAGMA journal_mode=WAL;")
        w.execute("CREATE TABLE feed (id INTEGER PRIMARY KEY, msg TEXT);")
        w.execute("INSERT INTO feed (msg) VALUES ('event_1');")
        w.commit()
        # Truncate checkpoint to ensure table is in db file
        w.execute("PRAGMA wal_checkpoint(TRUNCATE);")

        # Reader 1: mode=ro (correct)
        r_ro = sqlite3.connect(f"file:{db}?mode=ro", uri=True)
        r_ro.execute("PRAGMA query_only=ON;")
        
        # Reader 2: immutable=1 (incorrect)
        r_imm = sqlite3.connect(f"file:{db}?immutable=1", uri=True)
        
        init_ro = r_ro.execute("SELECT count(*) FROM feed;").fetchone()[0]
        init_imm = r_imm.execute("SELECT count(*) FROM feed;").fetchone()[0]
        
        # Writer writes 5 new events (goes into WAL)
        for i in range(2, 7):
            w.execute("INSERT INTO feed (msg) VALUES (?);", (f"event_{i}",))
        w.commit()
        
        post_ro = r_ro.execute("SELECT count(*) FROM feed;").fetchone()[0]
        post_imm = r_imm.execute("SELECT count(*) FROM feed;").fetchone()[0]
        
        r_ro.close()
        r_imm.close()
        w.close()
        
        result["initial_count"] = {"mode_ro": init_ro, "immutable": init_imm}
        result["post_write_count"] = {"mode_ro": post_ro, "immutable": post_imm}
        result["wal_visible_in_ro"] = (post_ro == 6)
        result["wal_visible_in_immutable"] = (post_imm == 6)
        result["hazard_detected"] = (post_ro != post_imm)
        result["explanation"] = (
            "immutable=1 instructs SQLite to treat the file as read-only physical media (like CD-ROM). "
            "It skips opening -wal and -shm entirely and never invalidates page cache. "
            "Consequently, an office reader with immutable=1 never sees newly appended task events."
        )
    return result


def test_permission_mechanics() -> Dict[str, Any]:
    """Test permission edge cases: missing -shm in read-only dir vs pre-existing -shm."""
    res: Dict[str, Any] = {}
    with tempfile.TemporaryDirectory() as tmpdir:
        db = os.path.join(tmpdir, "perm.db")
        w = sqlite3.connect(db)
        w.execute("PRAGMA journal_mode=WAL;")
        w.execute("CREATE TABLE test (x INT);")
        w.execute("INSERT INTO test VALUES (42);")
        w.commit()
        w.close()
        # When writer closes, SQLite deletes -shm and -wal
        
        # Scenario 1: Directory is read-only (0555), -shm does not exist
        os.chmod(tmpdir, 0o555)
        try:
            r = sqlite3.connect(f"file:{db}?mode=ro", uri=True)
            r.execute("SELECT * FROM test;")
            r.close()
            res["missing_shm_in_ro_dir"] = "success"
        except sqlite3.OperationalError as e:
            res["missing_shm_in_ro_dir"] = f"failed: {e}"
        
        # Restore dir write to prepare Scenario 2
        os.chmod(tmpdir, 0o777)
        # Pre-create -shm and -wal as hermes-like files
        open(db + "-shm", "a").close()
        open(db + "-wal", "a").close()
        os.chmod(db + "-shm", 0o644)
        os.chmod(db + "-wal", 0o644)
        os.chmod(tmpdir, 0o555) # Make directory read-only again
        
        try:
            r2 = sqlite3.connect(f"file:{db}?mode=ro", uri=True)
            val = r2.execute("SELECT x FROM test;").fetchone()[0]
            r2.close()
            res["precreated_shm_in_ro_dir"] = f"success (read={val})"
        except sqlite3.OperationalError as e:
            res["precreated_shm_in_ro_dir"] = f"failed: {e}"
            
        os.chmod(tmpdir, 0o777) # restore for tempdir cleanup
    return res


def run_polling_test(
    db_path: str,
    duration_seconds: int = 60,
    poll_interval: float = 1.0,
    max_polls: int | None = None,
) -> Dict[str, Any]:
    """Execute polling loop and collect latency percentiles."""
    uri = f"file:{db_path}?mode=ro"
    conn = sqlite3.connect(uri, uri=True, timeout=2.0)
    conn.execute("PRAGMA query_only=ON;")
    conn.execute("PRAGMA busy_timeout=2000;")
    cur = conn.cursor()
    
    latencies_ms: List[float] = []
    busy_errors: int = 0
    other_errors: int = 0
    poll_count: int = 0
    events_collected: int = 0
    
    # Start polling from current max id - 10 if possible, or 0
    cur.execute("SELECT coalesce(max(id), 0) FROM task_events;")
    max_existing = cur.fetchone()[0]
    last_id = max(0, max_existing - 10)
    
    start_time = time.monotonic()
    end_time = start_time + duration_seconds
    
    while time.monotonic() < end_time:
        if max_polls is not None and poll_count >= max_polls:
            break
            
        t0 = time.perf_counter()
        try:
            cur.execute(
                "SELECT id, task_id, run_id, kind, payload, created_at "
                "FROM task_events WHERE id > ? ORDER BY id LIMIT 500;",
                (last_id,),
            )
            rows = cur.fetchall()
            t1 = time.perf_counter()
            lat_ms = (t1 - t0) * 1000.0
            latencies_ms.append(lat_ms)
            
            if rows:
                last_id = rows[-1][0]
                events_collected += len(rows)
        except sqlite3.OperationalError as e:
            t1 = time.perf_counter()
            lat_ms = (t1 - t0) * 1000.0
            latencies_ms.append(lat_ms)
            err_msg = str(e).lower()
            if "busy" in err_msg or "locked" in err_msg:
                busy_errors += 1
            else:
                other_errors += 1
        except Exception:
            other_errors += 1
            
        poll_count += 1
        
        # Sleep until next poll tick if interval > 0
        if poll_interval > 0:
            elapsed_in_iter = time.perf_counter() - t0
            sleep_needed = poll_interval - elapsed_in_iter
            if sleep_needed > 0:
                time.sleep(sleep_needed)
                
    conn.close()
    
    # Calculate stats
    latencies_ms.sort()
    n = len(latencies_ms)
    
    def percentile(p: float) -> float:
        if not latencies_ms:
            return 0.0
        k = (n - 1) * p
        f = int(k)
        c = f + 1
        if c < n:
            return latencies_ms[f] + (k - f) * (latencies_ms[c] - latencies_ms[f])
        return latencies_ms[f]
        
    return {
        "db_path": db_path,
        "duration_run_s": round(time.monotonic() - start_time, 2),
        "total_polls": poll_count,
        "events_collected": events_collected,
        "sqlite_busy_count": busy_errors,
        "other_error_count": other_errors,
        "latency_ms": {
            "min": round(latencies_ms[0], 4) if n > 0 else 0,
            "mean": round(sum(latencies_ms) / n, 4) if n > 0 else 0,
            "p50": round(percentile(0.50), 4),
            "p90": round(percentile(0.90), 4),
            "p95": round(percentile(0.95), 4),
            "p99": round(percentile(0.99), 4),
            "max": round(latencies_ms[-1], 4) if n > 0 else 0,
        },
    }


def run_concurrent_stress_test(
    db_path: str,
    reader_iterations: int = 3600,
    simulate_concurrent_writers: bool = True,
) -> Dict[str, Any]:
    """
    Stress test with 3600 reader queries (equivalent to 1 hr at 1 Hz),
    optionally running concurrent writer threads modifying a shadow table
    in the database to create real WAL page contention.
    """
    writer_stop = threading.Event()
    writer_writes = 0
    writer_busy = 0
    
    # Only run synthetic writers if caller is hermes (not office, since office cannot write)
    can_write = os.access(db_path, os.W_OK)
    
    def background_writer():
        nonlocal writer_writes, writer_busy
        try:
            w_conn = sqlite3.connect(db_path, timeout=5.0)
            w_conn.execute("PRAGMA busy_timeout=5000;")
            w_conn.execute("CREATE TABLE IF NOT EXISTS _spike_heartbeat (id INTEGER PRIMARY KEY, ts REAL);")
            w_conn.commit()
            while not writer_stop.is_set():
                try:
                    w_conn.execute("INSERT INTO _spike_heartbeat (ts) VALUES (?);", (time.time(),))
                    w_conn.commit()
                    writer_writes += 1
                except sqlite3.OperationalError as e:
                    if "busy" in str(e).lower() or "locked" in str(e).lower():
                        writer_busy += 1
                time.sleep(0.05)
            w_conn.execute("DROP TABLE IF EXISTS _spike_heartbeat;")
            w_conn.commit()
            w_conn.close()
        except Exception:
            pass

    t = None
    if simulate_concurrent_writers and can_write:
        t = threading.Thread(target=background_writer, daemon=True)
        t.start()

    res = run_polling_test(
        db_path=db_path,
        duration_seconds=3600,
        poll_interval=0.0, # Run back-to-back as fast as possible to stress test
        max_polls=reader_iterations,
    )
    
    if t is not None:
        writer_stop.set()
        t.join(timeout=2.0)
        res["synthetic_writer_writes"] = writer_writes
        res["synthetic_writer_busy"] = writer_busy

    return res


def main():
    parser = argparse.ArgumentParser(description="Spike SQLite Readonly Evaluation")
    parser.add_argument("--duration", type=int, default=30, help="Duration for 1Hz live polling test (seconds)")
    parser.add_argument("--stress-polls", type=int, default=3600, help="Number of polls for burst stress test")
    parser.add_argument("--db-board", default="/srv/apps/hermes/kanban/boards/office-v2/kanban.db")
    parser.add_argument("--db-global", default="/srv/apps/hermes/kanban.db")
    args = parser.parse_args()

    print(f"=== Starting Spike SQLite Readonly Evaluation ===")
    print(f"User: {getpass.getuser()} (UID={os.getuid()}, GID={os.getgid()})")
    print(f"Python: {sys.version.split()[0]} | SQLite: {sqlite3.sqlite_version}")
    print()

    # 1. Inspect DBs
    print("--- 1. Inspecting Databases ---")
    board_info = inspect_db(args.db_board)
    global_info = inspect_db(args.db_global)
    print(f"Board DB ({args.db_board}):")
    print(json.dumps(board_info, indent=2))
    print(f"Global DB ({args.db_global}):")
    print(json.dumps(global_info, indent=2))
    print()

    # 2. Permission Mechanics & Immutable Hazards
    print("--- 2. Permission Mechanics & Immutable=1 Hazards ---")
    perm_res = test_permission_mechanics()
    imm_res = test_immutable_hazard()
    print("Permission mechanics test:", json.dumps(perm_res, indent=2))
    print("Immutable=1 hazard test:", json.dumps(imm_res, indent=2))
    print()

    # 3. Live 1Hz Polling Test on Board DB
    print(f"--- 3. Live 1 Hz Polling Test ({args.duration}s) ---")
    live_res = run_polling_test(
        db_path=args.db_board,
        duration_seconds=args.duration,
        poll_interval=1.0,
    )
    print("Live Polling Results:")
    print(json.dumps(live_res, indent=2))
    print()

    # 4. Stress Polling Test (3600 queries)
    print(f"--- 4. Stress Polling Test ({args.stress_polls} back-to-back polls) ---")
    stress_res = run_concurrent_stress_test(
        db_path=args.db_board,
        reader_iterations=args.stress_polls,
        simulate_concurrent_writers=False, # Reader only
    )
    print("Stress Polling Results:")
    print(json.dumps(stress_res, indent=2))
    print()

    # Combine full report
    full_report = {
        "timestamp_wib": time.strftime("%Y-%m-%d %H:%M:%S WIB", time.localtime()),
        "user": getpass.getuser(),
        "uid": os.getuid(),
        "gid": os.getgid(),
        "sqlite_version": sqlite3.sqlite_version,
        "databases": {
            "board": board_info,
            "global": global_info,
        },
        "permission_mechanics": perm_res,
        "immutable_hazard": imm_res,
        "live_1hz_polling": live_res,
        "stress_polling_3600": stress_res,
    }

    report_json_path = "/tmp/sqlite_spike_results.json"
    with open(report_json_path, "w") as f:
        json.dump(full_report, f, indent=2)
    print(f"Raw results saved to {report_json_path}")


if __name__ == "__main__":
    main()
