"""Suite pengujian proyeksi publik & Founder dan tes anti-bocor (T1.3 / F04).

Memverifikasi:
1. Strict Whitelist Dual Projection (ADR-003).
2. Property-based testing (Hypothesis): tidak ada token LEAK-CANARY di JSON publik untuk input acak.
3. Path sistem (/srv/apps/hermes/...), PID, dan nama branch tidak pernah muncul di publik.
4. Allowlist public_boards menyensor nama board non-publik menjadi 'Proyek internal'.
5. Penyamaran judul tugas berbasis peran (role-based category masking) untuk seluruh 16 agen.
6. Proyeksi Founder menampilkan telemetri lengkap dengan teks terpotong maks 500 karakter.
7. Pengujian anti-bocor langsung terhadap fixture riil SQLite kanban_fixture.db.
"""

from __future__ import annotations

import sqlite3
from pathlib import Path

import pytest
from hypothesis import HealthCheck, given, settings
from hypothesis import strategies as st

from office.config import (
    DEFAULT_PUBLIC_BOARDS,
    DEFAULT_TASK_CATEGORIES_BY_AGENT,
    OfficeConfig,
    load_office_config,
)
from office.domain.normalizer import EventNormalizer
from office.domain.state import StateEngine
from office.models.events import OfficeEvent
from office.models.host import HostVitals, HostVitalsDetails
from office.models.kanban import KanbanEventRow, TaskRef, TaskRow
from office.models.profiles import AgentBio, AgentProfileDetail
from office.models.state import AgentState, WorldSnapshot
from office.projection import (
    PublicHostVitals,
    PublicTaskRef,
    get_public_agent_action,
    get_public_board_name,
    get_public_task_title,
    project_agent_profile_detail_founder,
    project_agent_profile_detail_public,
    project_agent_state_public,
    project_host_vitals_founder,
    project_host_vitals_public,
    project_office_event_public,
    project_task_ref_founder,
    project_task_ref_public,
    project_world_snapshot_public,
    truncate_text,
)
from office.sources.profiles import STATIC_AGENT_METADATA

FIXTURE_DB = Path(__file__).parent / "fixtures" / "kanban_fixture.db"

# ==============================================================================
# Hypothesis Strategies untuk Pembuatan Data Acak Bermuatan Canary & Secret
# ==============================================================================

canary_tokens = st.sampled_from(
    [
        "LEAK-CANARY-TOKEN-SECRET-12345",
        "LEAK-CANARY-UUID-9999-AAAA-BBBB",
        "LEAK-CANARY-DATABASE-PASS-8877",
        "LEAK-CANARY-API-KEY-SUPERSECRET",
        "LEAK-CANARY-SYS-DIR-CONFIDENTIAL",
    ]
)

sensitive_paths = st.sampled_from(
    [
        "/srv/apps/hermes/credentials/primary_vault.key",
        "/srv/apps/hermes/kanban/boards/office-v2/workspaces/t_secret",
        "/home/hermes/.ssh/id_rsa",
        "/var/run/secrets/kubernetes.io/serviceaccount/token",
        "/srv/hermes-control/secret_config.yaml",
    ]
)

branch_names = st.sampled_from(
    [
        "feat/leak-canary-branch-01",
        "private/stealth-exploit-fix",
        "secret/quantum-crypto-impl",
        "internal-infra-hardening",
    ]
)

agent_id_strategy = st.sampled_from(list(STATIC_AGENT_METADATA.keys()) + ["guest_agent_xyz"])
work_strategy = st.sampled_from(
    ["idle", "working", "blocked", "stale", "failed", "done_recent", "off_duty"]
)
block_kind_strategy = st.one_of(
    st.none(),
    st.sampled_from(["needs_input", "dependency", "capability", "transient"]),
)
event_kind_strategy = st.sampled_from(
    [
        "task_created",
        "task_started",
        "task_commented",
        "task_blocked",
        "task_done",
        "task_failed",
        "task_stale",
        "agent_online",
        "agent_offline",
        "collective_started",
        "collective_ended",
        "vitals_alert",
    ]
)

board_strategy = st.sampled_from(
    [
        "office-v2",
        "secret-board-x",
        "internal-finances",
        "LEAK-CANARY-BOARD",
    ]
)


@st.composite
def random_task_with_canaries(draw: st.DrawFn) -> TaskRef:
    """Membuat TaskRef acak yang dipenuhi token canary, path rahasia, PID, dan branch."""
    tid = f"task_{draw(st.integers(min_value=1, max_value=99999))}"
    title = f"Task {draw(canary_tokens)} - {draw(st.text(min_size=1, max_size=30))}"
    body = (
        f"Prompt rahasia: {draw(canary_tokens)}. Kredensial di {draw(sensitive_paths)}. "
        f"Detail: {draw(st.text(min_size=5, max_size=100))}"
    )
    summary = f"Summary: {draw(canary_tokens)}"
    result = f"Result: {draw(canary_tokens)}"
    error = f"Fatal Error: {draw(canary_tokens)} at {draw(sensitive_paths)}"
    workspace = draw(sensitive_paths)
    branch = draw(branch_names)
    pid = draw(st.integers(min_value=1000, max_value=999999))

    return TaskRef(
        id=tid,
        title=title,
        board=draw(board_strategy),
        status=draw(st.sampled_from(["todo", "ready", "running", "blocked", "done", "failed"])),
        block_kind=draw(block_kind_strategy),
        started_at=draw(st.integers(min_value=1700000000, max_value=1800000000)),
        body=body,
        summary=summary,
        result=result,
        error=error,
        workspace_path=workspace,
        branch_name=branch,
        worker_pid=pid,
    )


# ==============================================================================
# Acceptance Criteria 1: Property Testing Anti-Bocor (LEAK-CANARY)
# ==============================================================================


class TestPropertyAntiLeakCanary:
    """Tes properti (Hypothesis): tidak ada substring LEAK-CANARY di JSON publik."""

    @given(task=random_task_with_canaries(), agent_id=agent_id_strategy)
    @settings(max_examples=100, suppress_health_check=[HealthCheck.too_slow])
    def test_property_public_task_ref_no_canary(self, task: TaskRef, agent_id: str) -> None:
        pub_task = project_task_ref_public(task, agent_id=agent_id)
        assert pub_task is not None

        json_str = pub_task.model_dump_json()
        assert "LEAK-CANARY" not in json_str

    @given(task=random_task_with_canaries(), agent_id=agent_id_strategy, work=work_strategy)
    @settings(max_examples=100, suppress_health_check=[HealthCheck.too_slow])
    def test_property_public_agent_state_no_canary(
        self, task: TaskRef, agent_id: str, work: str
    ) -> None:
        raw_agent = AgentState(
            id=agent_id,
            name=f"Agent-{agent_id}",
            role="Specialist",
            presence="on_duty",
            work=work,  # type: ignore[arg-type]
            since=1791000000,
            done_today=3,
            zone="dev_pod_1",
            action=f"Mengerjakan: {task.title} dengan rahasia {task.body}",
            task=task,
        )

        pub_agent = project_agent_state_public(raw_agent)
        json_str = pub_agent.model_dump_json()

        assert "LEAK-CANARY" not in json_str

    @given(
        task=random_task_with_canaries(),
        agent_id=agent_id_strategy,
        kind=event_kind_strategy,
    )
    @settings(max_examples=100, suppress_health_check=[HealthCheck.too_slow])
    def test_property_public_office_event_no_canary(
        self, task: TaskRef, agent_id: str, kind: str
    ) -> None:
        raw_event = OfficeEvent(
            seq=42,
            ts=1791000000,
            board=task.board,
            kind=kind,  # type: ignore[arg-type]
            agent=agent_id,
            actor="jarvis",
            message=f"Aktivitas rahasia: {task.title} {task.error}",
            task=task,
        )

        pub_event = project_office_event_public(raw_event)
        json_str = pub_event.model_dump_json()

        assert "LEAK-CANARY" not in json_str

    @given(
        tasks=st.lists(random_task_with_canaries(), min_size=1, max_size=5),
        time_of_day=st.sampled_from(["dawn", "day", "dusk", "night"]),
    )
    @settings(max_examples=50, suppress_health_check=[HealthCheck.too_slow])
    def test_property_public_world_snapshot_no_canary(
        self, tasks: list[TaskRef], time_of_day: str
    ) -> None:
        agents = []
        events = []
        for i, t in enumerate(tasks):
            aid = list(STATIC_AGENT_METADATA.keys())[i % len(STATIC_AGENT_METADATA)]
            agent = AgentState(
                id=aid,
                name=aid.capitalize(),
                role="Specialist",
                presence="on_duty",
                work="working",
                since=1791000000,
                done_today=1,
                zone="dev_pod_1",
                action=f"Memproses {t.title}",
                task=t,
            )
            agents.append(agent)
            event = OfficeEvent(
                seq=i + 1,
                ts=1791000000 + i,
                board=t.board,
                kind="task_started",
                agent=aid,
                actor="jarvis",
                message=f"Event {t.title} canary: {t.body}",
                task=t,
            )
            events.append(event)

        vitals = HostVitals(
            cpu_percent=25.4,
            memory_percent=55.8,
            disk_percent=70.2,
            status="healthy",
            details=HostVitalsDetails(
                cpu_cores=8,
                load_1m=1.2,
                load_5m=1.1,
                load_15m=0.9,
                memory_total_mb=16384.0,
                memory_used_mb=8192.0,
                memory_available_mb=8192.0,
                disk_total_gb=120.0,
                disk_used_gb=80.0,
                uptime_seconds=99999.0,
            ),
        )

        snapshot = WorldSnapshot(
            generated_at=1791000100,
            seq=len(events),
            projection="public",
            time_of_day=time_of_day,  # type: ignore[arg-type]
            agents=agents,
            recent_events=events,
            vitals=vitals,
        )

        pub_snapshot = project_world_snapshot_public(snapshot)
        json_str = pub_snapshot.model_dump_json()

        assert "LEAK-CANARY" not in json_str


# ==============================================================================
# Acceptance Criteria 2: Path, PID, dan Nama Branch Tidak Muncul di Publik
# ==============================================================================


class TestPropertyAntiPathPidBranch:
    """Memastikan path, PID, dan nama branch git tidak pernah muncul di proyeksi publik."""

    @given(task=random_task_with_canaries(), agent_id=agent_id_strategy)
    @settings(max_examples=100, suppress_health_check=[HealthCheck.too_slow])
    def test_path_pid_branch_never_in_public_json(self, task: TaskRef, agent_id: str) -> None:
        pub_task = project_task_ref_public(task, agent_id=agent_id)
        assert pub_task is not None

        json_str = pub_task.model_dump_json()

        # 1. Path tidak boleh muncul
        if task.workspace_path:
            assert task.workspace_path not in json_str
        assert "/srv/apps/hermes" not in json_str
        assert "workspace_path" not in json_str

        # 2. PID tidak boleh muncul
        if task.worker_pid:
            # Pastikan PID sebagai angka/field tidak ada dalam JSON
            assert f'"worker_pid":{task.worker_pid}' not in json_str
            assert f'"worker_pid": {task.worker_pid}' not in json_str
        assert "worker_pid" not in json_str

        # 3. Nama branch tidak boleh muncul
        if task.branch_name:
            assert task.branch_name not in json_str
        assert "branch_name" not in json_str

    def test_public_models_structurally_omit_private_fields(self) -> None:
        """Memverifikasi field internal secara struktural tidak ada di PublicTaskRef."""
        fields = PublicTaskRef.model_fields.keys()
        assert "workspace_path" not in fields
        assert "branch_name" not in fields
        assert "worker_pid" not in fields
        assert "body" not in fields
        assert "summary" not in fields
        assert "result" not in fields
        assert "error" not in fields

        # PublicHostVitals juga tidak boleh memiliki field details
        vitals_fields = PublicHostVitals.model_fields.keys()
        assert "details" not in vitals_fields


# ==============================================================================
# Pengujian Aturan Redaksi (Tabel Blueprint & ADR-003)
# ==============================================================================


class TestRedactionRules:
    """Pengujian terperinci aturan redaksi publik dan allowlist board."""

    def test_public_boards_allowlist_enforcement(self) -> None:
        cfg = OfficeConfig(public_boards=["office-v2", "showcase"])

        assert get_public_board_name("office-v2", config=cfg) == "office-v2"
        assert get_public_board_name("showcase", config=cfg) == "showcase"
        assert get_public_board_name("internal-payroll", config=cfg) == "Proyek internal"
        assert get_public_board_name("secret_board", config=cfg) == "Proyek internal"
        assert get_public_board_name(None, config=cfg) == "Proyek internal"
        assert get_public_board_name("", config=cfg) == "Proyek internal"

    def test_task_title_masking_all_16_agents(self) -> None:
        """Seluruh 16 agen harus memiliki judul kategori publik yang sesuai spesifikasi ADR-003."""
        cfg = load_office_config()

        expected_categories = {
            "forge": "Pengembangan modul backend dan database",
            "prism": "Pembaruan antarmuka pengguna",
            "steward": "Optimasi pipeline grafis dan rendering",
            "sentinel": "Verifikasi kualitas dan validasi sistem",
            "bastion": "Hardening infrastruktur dan keamanan",
            "relay": "Automasi CI/CD dan rilis",
            "daedalus": "Perancangan arsitektur dan spesifikasi data",
            "muse": "Desain visual dan tinjauan gaya",
            "jarvis": "Orkestrasi alur kerja agen",
            "oracle": "Riset literatur dan eksperimen ilmiah",
            "vector": "Rekayasa pipeline data dan analitik",
            "merlin": "Mentoring teknis dan edukasi rekayasa",
            "warden": "Pemeliharaan fasilitas dan operasi kantor",
            "scribe": "Penyusunan dokumentasi teknis dan arsip",
            "nova": "Eksplorasi sistem dan navigasi spasial",
            "rifqi": "Pengawasan strategis dan visi produk",
        }

        for aid, expected_title in expected_categories.items():
            category = get_public_task_title(agent_id=aid, config=cfg)
            assert category == expected_title, f"Gagal pada agent {aid}"

        # Karakter di luar 16 agen harus mendapat kategori default
        unknown_cat = get_public_task_title(agent_id="guest_unknown", config=cfg)
        assert unknown_cat == "Operasi sistem dan komputasi rutin"

    def test_public_agent_action_text_generation(self) -> None:
        cfg = load_office_config()

        # Working
        act_working = get_public_agent_action("working", "forge", config=cfg)
        assert act_working == "Mengerjakan tugas: Pengembangan modul backend dan database"

        # Stale
        act_stale = get_public_agent_action("stale", "prism", config=cfg)
        assert act_stale == "Duduk termenung (task stale): Pembaruan antarmuka pengguna"

        # Blocked needs_input
        act_blocked_input = get_public_agent_action(
            "blocked", "forge", block_kind="needs_input", config=cfg
        )
        assert act_blocked_input == "Menunggu masukan di ruang Jarvis"

        # Blocked dependency
        act_blocked_dep = get_public_agent_action(
            "blocked", "forge", block_kind="dependency", config=cfg
        )
        assert (
            act_blocked_dep
            == "Tugas terblokir (dependency): Pengembangan modul backend dan database"
        )

        # Failed
        act_failed = get_public_agent_action("failed", "sentinel", config=cfg)
        assert (
            act_failed
            == "Mengatasi kegagalan run pada tugas: Verifikasi kualitas dan validasi sistem"
        )

        # Done recent
        act_done = get_public_agent_action("done_recent", "bastion", config=cfg)
        assert act_done == "Merayakan penyelesaian tugas: Hardening infrastruktur dan keamanan"

        # Off duty
        act_off = get_public_agent_action("off_duty", "warden", config=cfg)
        assert act_off == "Sedang di luar jam kerja (off-duty)"

        # Idle
        act_idle = get_public_agent_action("idle", "nova", config=cfg)
        assert act_idle == "Standby di meja kerja"

    def test_public_host_vitals_rounded(self) -> None:
        raw_vitals = HostVitals(
            cpu_percent=14.398,
            memory_percent=42.71,
            disk_percent=68.12,
            status="healthy",
            details=HostVitalsDetails(
                cpu_cores=8,
                load_1m=0.85,
                load_5m=0.92,
                load_15m=0.78,
                memory_total_mb=16384.0,
                memory_used_mb=6225.0,
                memory_available_mb=10159.0,
                disk_total_gb=120.0,
                disk_used_gb=74.4,
                uptime_seconds=864200.0,
            ),
        )

        pub_vitals = project_host_vitals_public(raw_vitals)
        assert pub_vitals.cpu_percent == 14.0
        assert pub_vitals.memory_percent == 43.0
        assert pub_vitals.disk_percent == 68.0
        assert pub_vitals.status == "healthy"

        # Details ditiadakan di JSON
        json_dict = pub_vitals.model_dump()
        assert "details" not in json_dict


# ==============================================================================
# Pengujian Proyeksi Founder (Full Telemetry & Inspection)
# ==============================================================================


class TestFounderProjection:
    """Memverifikasi proyeksi Founder menyajikan seluruh data nyata dengan pemotongan teks aman."""

    def test_founder_task_ref_preserves_metadata_and_truncates_text(self) -> None:
        long_body = "A" * 600
        long_summary = "B" * 550
        long_result = "C" * 700
        long_error = "D" * 800

        task = TaskRef(
            id="t_real_001",
            title="Judul Asli Sangat Rahasia",
            board="internal-accounting",
            status="running",
            block_kind=None,
            started_at=1791027159,
            body=long_body,
            summary=long_summary,
            result=long_result,
            error=long_error,
            workspace_path="/srv/apps/hermes/kanban/boards/internal/workspaces/t_real_001",
            branch_name="feature/secret-ledger",
            worker_pid=98765,
        )

        f_task = project_task_ref_founder(task)
        assert f_task is not None

        # Data operasional dipertahankan asli
        assert f_task.title == "Judul Asli Sangat Rahasia"
        assert f_task.board == "internal-accounting"
        assert (
            f_task.workspace_path == "/srv/apps/hermes/kanban/boards/internal/workspaces/t_real_001"
        )
        assert f_task.branch_name == "feature/secret-ledger"
        assert f_task.worker_pid == 98765

        # Teks panjang dipotong maksimal 500 karakter
        assert f_task.body == "A" * 500
        assert f_task.summary == "B" * 500
        assert f_task.result == "C" * 500
        assert f_task.error == "D" * 500

    def test_founder_host_vitals_details_preserved(self) -> None:
        details = HostVitalsDetails(
            cpu_cores=8,
            load_1m=0.85,
            load_5m=0.92,
            load_15m=0.78,
            memory_total_mb=16384.0,
            memory_used_mb=6225.0,
            memory_available_mb=10159.0,
            disk_total_gb=120.0,
            disk_used_gb=74.4,
            uptime_seconds=864200.0,
        )
        vitals = HostVitals(
            cpu_percent=14.398,
            memory_percent=42.71,
            disk_percent=68.12,
            status="healthy",
            details=details,
        )

        f_vitals = project_host_vitals_founder(vitals)
        assert f_vitals.cpu_percent == 14.398
        assert f_vitals.memory_percent == 42.71
        assert f_vitals.details is not None
        assert f_vitals.details.cpu_cores == 8
        assert f_vitals.details.memory_total_mb == 16384.0

    def test_truncate_text_helper(self) -> None:
        assert truncate_text(None) is None
        assert truncate_text("Halo", max_len=10) == "Halo"
        assert truncate_text("1234567890", max_len=5) == "12345"


# ==============================================================================
# Pengujian Terhadap Fixture Riil SQLite kanban_fixture.db
# ==============================================================================


class TestFixtureAntiLeakVerification:
    """Verifikasi anti-bocor langsung terhadap fixture sintetis kanban_fixture.db."""

    @pytest.fixture
    def fixture_conn(self) -> sqlite3.Connection:
        assert FIXTURE_DB.is_file(), f"Fixture database tidak ditemukan di {FIXTURE_DB}"
        conn = sqlite3.connect(f"file:{FIXTURE_DB}?mode=ro", uri=True)
        conn.row_factory = sqlite3.Row
        return conn

    def test_fixture_database_contains_canaries(self, fixture_conn: sqlite3.Connection) -> None:
        """Memverifikasi database fixture memang memiliki token canary sebagai prasyarat uji."""
        cur = fixture_conn.cursor()
        cur.execute("SELECT count(*) FROM tasks WHERE body LIKE '%LEAK-CANARY%'")
        count_tasks = cur.fetchone()[0]
        assert count_tasks > 0, "Database fixture harus berisi token LEAK-CANARY"

        cur.execute("SELECT count(*) FROM task_runs WHERE summary LIKE '%LEAK-CANARY%'")
        count_runs = cur.fetchone()[0]
        assert count_runs > 0, "Database fixture harus berisi token LEAK-CANARY pada runs"

    def test_public_snapshot_from_fixture_contains_zero_canaries(
        self, fixture_conn: sqlite3.Connection
    ) -> None:
        """Membaca seluruh data dari kanban_fixture.db, memasukkan ke StateEngine,

        dan memastikan TIDAK ADA token LEAK-CANARY, path /srv/apps/hermes, PID,
        atau nama branch yang bocor ke output proyeksi publik.
        """
        cur = fixture_conn.cursor()
        cur.execute("SELECT * FROM tasks")
        task_rows = cur.fetchall()

        normalizer = EventNormalizer(start_seq=1)
        engine = StateEngine(normalizer=normalizer, boot_time=1791028300)

        # Isi active tasks dan selesaikan rekonsiliasi
        reconcile_tasks = []
        for r in task_rows:
            d = dict(r)
            d["board"] = "office-v2"
            t_obj = TaskRow(**d)
            reconcile_tasks.append(t_obj)

        engine.reconcile_tasks(reconcile_tasks, current_time=1791028300)

        # Ambil event mentah dari task_events
        cur.execute("SELECT * FROM task_events ORDER BY id ASC")
        event_rows = cur.fetchall()
        for er in event_rows:
            e_dict = dict(er)
            e_dict["board"] = "office-v2"
            e_row = KanbanEventRow(**e_dict)
            engine.process_event(e_row)

        # 1. Uji WorldSnapshot Publik
        public_snapshot = engine.get_snapshot(projection="public", current_time=1791028300)
        pub_json = public_snapshot.model_dump_json()

        # Invarian Utama: Nol Kebocoran
        assert "LEAK-CANARY" not in pub_json, (
            "Token LEAK-CANARY ditemukan pada JSON snapshot publik!"
        )
        assert "/srv/apps/hermes" not in pub_json, (
            "Path sistem /srv/apps/hermes ditemukan pada JSON publik!"
        )
        assert "workspace_path" not in pub_json
        assert "branch_name" not in pub_json
        assert "worker_pid" not in pub_json

        # Pastikan seluruh agen terproyeksi
        assert len(public_snapshot.agents) >= 16
        for agent in public_snapshot.agents:
            if agent.task:
                # Board harus diizinkan atau Proyek internal
                assert agent.task.board in (list(DEFAULT_PUBLIC_BOARDS) + ["Proyek internal"])
                # Judul tugas harus tersanitasi menjadi kategori peran
                assert agent.task.title == DEFAULT_TASK_CATEGORIES_BY_AGENT.get(
                    agent.id, "Operasi sistem dan komputasi rutin"
                )

        # 2. Uji WorldSnapshot Founder (harus memiliki telemetri lengkap)
        founder_snapshot = engine.get_snapshot(projection="founder", current_time=1791028300)
        founder_json = founder_snapshot.model_dump_json()

        # Founder harus bisa melihat board asli dan judul asli
        assert "workspace_path" in founder_json, "Founder harus memiliki akses ke workspace_path"
        assert "branch_name" in founder_json, "Founder harus memiliki akses ke branch_name"
        assert "worker_pid" in founder_json, "Founder harus memiliki akses ke worker_pid"


# ==============================================================================
# Pengujian AgentProfileDetail (Publik vs Founder)
# ==============================================================================


class TestAgentProfileDetailProjection:
    """Pengujian proyeksi rincian profil agen dan 5 tugas terakhir."""

    def test_agent_profile_detail_public_and_founder(self) -> None:
        bio = AgentBio(
            id="forge",
            name="Forge",
            role="Backend Specialist",
            department="Core Engineering",
            personality="Kokoh dan pragmatis",
            specialties=["FastAPI", "SQLite"],
            primary_color="#D9622B",
            desk_zone="dev_pod_2",
        )
        task_secret = TaskRef(
            id="task-running-001",
            title="Implementasi reader Kanban LEAK-CANARY-01",
            board="office-v2",
            status="running",
            body="Secret body text LEAK-CANARY-BODY",
            workspace_path="/srv/apps/hermes/workspace/001",
            branch_name="feature/secret-kanban",
            worker_pid=12345,
        )
        agent = AgentState(
            id="forge",
            name="Forge",
            role="Backend Specialist",
            presence="on_duty",
            work="working",
            since=1791000000,
            done_today=2,
            zone="dev_pod_2",
            action="Mengerjakan tugas rahasia",
            task=task_secret,
        )

        detail = AgentProfileDetail(
            agent=agent,
            bio=bio,
            recent_tasks=[task_secret],
        )

        # 1. Proyeksi Publik
        pub_detail = project_agent_profile_detail_public(detail)
        pub_json = pub_detail.model_dump_json()

        assert "LEAK-CANARY" not in pub_json
        assert "/srv/apps/hermes" not in pub_json
        assert "workspace_path" not in pub_json
        assert "branch_name" not in pub_json
        assert "worker_pid" not in pub_json
        assert pub_detail.recent_tasks[0].title == "Pengembangan modul backend dan database"

        # 2. Proyeksi Founder
        founder_detail = project_agent_profile_detail_founder(detail)
        founder_json = founder_detail.model_dump_json()

        assert "Implementasi reader Kanban" in founder_json
        assert "/srv/apps/hermes/workspace/001" in founder_json
        assert "feature/secret-kanban" in founder_json
        assert founder_detail.recent_tasks[0].worker_pid == 12345
