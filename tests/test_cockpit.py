"""Fixture-backed V01-V12 contracts; all state is temporary."""
import json, sqlite3, sys, time
from pathlib import Path
import pytest
from fastapi.testclient import TestClient
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
import src.server as server

SCHEMA="""CREATE TABLE tasks(id TEXT PRIMARY KEY,title TEXT,description TEXT,status TEXT,assignee TEXT,priority INTEGER,created_at INTEGER,started_at INTEGER,completed_at INTEGER,last_heartbeat_at INTEGER,worker_pid INTEGER,worker_started_at INTEGER,claim_expires INTEGER,blocked_reason TEXT,current_run_id TEXT); CREATE TABLE task_links(parent_id TEXT,child_id TEXT); CREATE TABLE task_comments(id INTEGER PRIMARY KEY,task_id TEXT,body TEXT,created_at INTEGER); CREATE TABLE task_runs(id TEXT PRIMARY KEY,task_id TEXT,status TEXT,started_at INTEGER,ended_at INTEGER,last_heartbeat_at INTEGER,claim_expires INTEGER,worker_pid INTEGER); CREATE TABLE task_events(id INTEGER PRIMARY KEY,task_id TEXT,run_id TEXT,kind TEXT,payload TEXT,created_at INTEGER);"""
@pytest.fixture
def env(tmp_path,monkeypatch):
 p={"kanban":tmp_path/"kanban","profiles":tmp_path/"profiles"}; p["profiles"].mkdir()
 for n,v in [("KANBAN_ROOT",p["kanban"]),("KANBAN_GLOBAL_DB",tmp_path/"global.db"),("PROFILES_DIR",p["profiles"]),("BASE_DIR",tmp_path/"control")]: monkeypatch.setattr(server,n,v)
 monkeypatch.setattr(server,"STALE_HEARTBEAT_SECONDS",120); p["client"]=TestClient(server.app); return p
def board(e,slug,tasks,event=None):
 path=e["kanban"]/"boards"/slug/"kanban.db"; path.parent.mkdir(parents=True,exist_ok=True); now=int(time.time()); cols="id title description status assignee priority created_at started_at completed_at last_heartbeat_at worker_pid worker_started_at claim_expires blocked_reason current_run_id".split()
 with sqlite3.connect(path) as db:
  db.executescript(SCHEMA)
  for t in tasks:
   vals=[t.get(c) for c in cols]; vals[6]=t.get("created_at",now); vals[14]=t.get("run_id"); db.execute(f"INSERT INTO tasks({','.join(cols)}) VALUES({','.join('?'*len(cols))})",vals)
   if t.get("run_id"): db.execute("INSERT INTO task_runs VALUES(?,?,?,?,?,?,?,?)",(t["run_id"],t["id"],t["status"],now,None,t.get("last_heartbeat_at"),None,t.get("worker_pid")))
  if event is not None: db.execute("INSERT INTO task_events VALUES(1,?,?,?,?,?)",(tasks[0]["id"],tasks[0].get("run_id"),"fixture",event,now))
def delegation(e,did,tasks,completed=None,malformed=False):
 d=e["profiles"]/"fixture"/"cache"/"delegation"/"live"/did; d.mkdir(parents=True); (d/"manifest.json").write_text("{" if malformed else json.dumps({"delegation_id":did,"started":"2026","completed":completed,"tasks":tasks}))
 for i,t in enumerate(tasks):
  if not t.get("missing_log"): (d/f"task-{t.get('index',i)}.log").write_text(t.get("log","fixture"))
def flat(x): return [t for c in x["columns"].values() for t in c]

def test_v01_ready_is_queued_not_executing(env):
 board(env,"alpha",[{"id":"q","title":"Q","status":"ready","assignee":"swe-backend"}]); d=env["client"].get("/api/v1/kanban/tasks",params={"board":"alpha"}).json(); assert d["columns"]["ready"][0]["id"]=="q"; r={a["id"]:a for a in env["client"].get("/api/v1/agents/roster").json()["agents"]}; assert r["swe-backend"]["state"]!="EXECUTING"
def test_v02_active_run_contract(env,monkeypatch):
 now=int(time.time()); monkeypatch.setattr(server,"_pid_alive",lambda p:True); board(env,"alpha",[{"id":"t","run_id":"r","title":"T","status":"running","assignee":"worker","worker_pid":42,"last_heartbeat_at":now}]); w=env["client"].get("/api/v1/workers/liveness").json()["workers"][0]; assert (w["liveness"],w["run_id"],w["board"])==("ACTIVE","r","alpha") and w["observed_at"]
@pytest.mark.parametrize("alive,age",[(False,0),(True,999)])
def test_v03_dead_or_stale_not_active(env,monkeypatch,alive,age):
 monkeypatch.setattr(server,"_pid_alive",lambda p:alive); board(env,"a",[{"id":"t","title":"T","status":"running","assignee":"w","worker_pid":42,"last_heartbeat_at":int(time.time())-age}]); assert env["client"].get("/api/v1/workers/liveness").json()["workers"][0]["liveness"] in {"STALE","UNKNOWN"}
def test_v04_multiple_runs_preserved(env,monkeypatch):
 now=int(time.time()); monkeypatch.setattr(server,"_pid_alive",lambda p:True)
 for s,i in [("alpha","a"),("beta","b")]: board(env,s,[{"id":i,"run_id":"r"+i,"title":i,"status":"running","assignee":"w","worker_pid":1,"last_heartbeat_at":now}])
 ws=env["client"].get("/api/v1/workers/liveness").json()["workers"]; assert {(w["board"],w["run_id"]) for w in ws}=={("alpha","ra"),("beta","rb")}
def test_v05_triage_blocked_distinct(env):
 board(env,"a",[{"id":"t","title":"T","status":"triage"},{"id":"b","title":"B","status":"blocked","blocked_reason":"approval"}]); c=env["client"].get("/api/v1/kanban/tasks",params={"board":"a"}).json()["columns"]; assert c["triage"][0]["id"]=="t" and c["blocked"][0]["blocked_reason"]=="approval"
def test_v06_parallel_children_transcripts(env):
 delegation(env,"deleg_batch",[{"index":0,"status":"running","log":"zero"},{"index":1,"status":"running","log":"one"}]); r=env["client"].get("/api/v1/delegations/tree").json()["delegations"][0]; assert r["parallel"] and len(r["children"])==2
 for i,text in enumerate(["zero","one"]): assert env["client"].get(f"/api/v1/delegations/deleg_batch/transcript/{i}").json()["transcript"]==text
def test_v07_mixed_children_not_flattened(env):
 delegation(env,"deleg_mix",[{"index":0,"status":"completed"},{"index":1,"status":"failed","exit_reason":"exit 1"}],"done"); r=env["client"].get("/api/v1/delegations/tree").json()["delegations"][0]; assert [c["status"] for c in r["children"]]==["completed","failed"] and r["children"][1]["exit_reason"]=="exit 1"
def test_v08_completed_history_not_live(env):
 delegation(env,"deleg_done",[{"index":0,"status":"completed"}],"done"); r=env["client"].get("/api/v1/delegations/tree").json()["delegations"][0]; assert r["status"]=="completed" and r["children"][0]["status"]!="running"
def test_v09_reconnect_board_scope(env):
 board(env,"alpha",[{"id":"a","title":"A","status":"todo"}]); board(env,"beta",[{"id":"b","title":"B","status":"todo"}])
 for s in [server._event_snapshot("beta"),server._event_snapshot("beta")]: assert s["board"]=="beta" and {t["id"] for t in flat(s["kanban"])}=={"b"}
def test_v10_html_and_secret_contract(env):
 v='<img src=x onerror=alert(1)> token=synthetic-secret-value sk-abcdefghijklmnop'; board(env,"a",[{"id":"x","title":v,"description":v,"status":"todo"}],v); d=env["client"].get("/api/v1/kanban/tasks",params={"board":"a"}).json(); assert "<img" in flat(d)[0]["title"] and "synthetic-secret-value" not in json.dumps(d); assert "synthetic-secret-value" not in env["client"].get("/api/v1/kanban/events",params={"board":"a"}).text
def test_v11_idle_snapshot_stable_two_clients(env,monkeypatch):
 board(env,"a",[{"id":"i","title":"I","status":"todo"}]); monkeypatch.setattr(server,"parse_delegation_stream",lambda n:[]); a=server._event_snapshot("a"); time.sleep(.002); b=server._event_snapshot("a"); a.pop("emitted_at",None); b.pop("emitted_at",None); assert a==b
def test_v12_missing_corrupt_unavailable(env):
 assert env["client"].get("/api/v1/kanban/tasks",params={"board":"missing"}).status_code==404; bad=env["kanban"]/"boards"/"bad"/"kanban.db"; bad.parent.mkdir(parents=True); bad.write_bytes(b"bad"); r=env["client"].get("/api/v1/kanban/tasks",params={"board":"bad"}); assert r.status_code==503 and r.json()["status"] in {"unknown","unavailable"}
def test_partial_manifest_missing_log_multiboard_detail(env):
 delegation(env,"deleg_partial",[],malformed=True); delegation(env,"deleg_gap",[{"index":0,"status":"running","missing_log":True}]); delegations=env["client"].get("/api/v1/delegations/tree").json()["delegations"]; assert len(delegations)==2 and next(d for d in delegations if d["id"]=="deleg_partial")["status"]=="unknown"; assert env["client"].get("/api/v1/delegations/deleg_gap/transcript/0").status_code==404
 board(env,"alpha",[{"id":"same","title":"A","status":"todo"}]); board(env,"beta",[{"id":"same","title":"B","status":"todo"}]); assert env["client"].get("/api/v1/kanban/task/same",params={"board":"beta"}).json()["task"]["title"]=="B"

def test_v13_office_lead_and_live_profile_harvesting(env):
 r = env["client"].get("/api/v1/agents/roster").json()
 assert r["total_agents"] == 14
 agents = {a["id"]: a for a in r["agents"]}
 assert "office-lead" in agents
 assert agents["jarvis"]["name"] == "Jarvis"
 assert agents["senku"]["name"] == "Senku"
 assert agents["swe-verifier"]["name"] == "swe-QA"
 # Test live session harvesting with mock state.db
 profile_dir = env["profiles"] / "office-lead"
 profile_dir.mkdir(parents=True, exist_ok=True)
 db_path = profile_dir / "state.db"
 now = time.time()
 with sqlite3.connect(db_path) as conn:
  conn.execute("CREATE TABLE sessions (id TEXT PRIMARY KEY, model TEXT, last_activity_at REAL, last_activity_description TEXT, message_count INTEGER, tool_call_count INTEGER)")
  conn.execute("CREATE TABLE messages (session_id TEXT, role TEXT, content TEXT, timestamp REAL)")
  conn.execute("INSERT INTO sessions VALUES ('sess_1', 'cx/gpt-5.6-sol', ?, 'executing tool: patch', 5, 2)", (now,))
  conn.execute("INSERT INTO messages VALUES ('sess_1', 'tool', 'patch applied', ?)", (now,))
 live = server.harvest_live_sessions(max_age_seconds=60)
 assert "office-lead" in live
 assert live["office-lead"]["state"] == "CODING"
 assert "Writing/Editing" in live["office-lead"]["status_desc"]