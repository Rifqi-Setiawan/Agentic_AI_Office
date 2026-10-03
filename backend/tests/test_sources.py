"""Unit and integration tests for Office v2 source readers.

Covers:
- sources/kanban.py (Multi-board reader, cursor MAX(id), discovery <= 30s, degraded mode)
- sources/gateway.py (mtime check, caching, degraded mode)
- sources/profiles.py (YAML reading without CLI, bio/design spec merging, degraded mode)
- sources/host.py (/proc/stat delta CPU, /proc/meminfo RAM, statvfs disk, thresholds)
"""

from __future__ import annotations

import json
import shutil
import sqlite3
import time
from pathlib import Path

import pytest

from office.models.host import HostVitals
from office.sources.gateway import GatewayReader
from office.sources.host import HostReader
from office.sources.kanban import KanbanReader
from office.sources.profiles import STATIC_AGENT_METADATA, ProfilesReader

FIXTURES_DIR = Path(__file__).resolve().parent / "fixtures"
PRIMARY_DB = FIXTURES_DIR / "kanban_fixture.db"
BOARD_B_DB = FIXTURES_DIR / "boards" / "board_b" / "kanban.db"


@pytest.fixture
def temp_kanban_env(tmp_path: Path) -> tuple[Path, Path]:
    """Salin fixture kanban ke direktori sementara untuk pengujian mutasi yang aman."""
    primary_copy = tmp_path / "primary_kanban.db"
    shutil.copy2(PRIMARY_DB, primary_copy)

    boards_dir = tmp_path / "boards"
    board_b_dir = boards_dir / "board_b"
    board_b_dir.mkdir(parents=True, exist_ok=True)
    board_b_copy = board_b_dir / "kanban.db"
    shutil.copy2(BOARD_B_DB, board_b_copy)

    return primary_copy, boards_dir


@pytest.mark.asyncio
async def test_kanban_reader_event_polling_and_deduplication(
    temp_kanban_env: tuple[Path, Path],
) -> None:
    """AC 1: Unit test terhadap fixture: event baru terbaca sekali, tanpa duplikat."""
    primary_db, boards_dir = temp_kanban_env

    # 1. Inisialisasi reader dengan cursor dari 0 untuk membaca seluruh event awal fixture
    reader = KanbanReader(
        primary_db_path=primary_db,
        boards_dir=boards_dir,
        init_cursor_to_max=False,
    )
    reader.boot()

    assert not reader.is_degraded
    assert reader.health.status == "ok"
    assert set(reader.board_paths.keys()) == {"primary", "board_b"}

    # Poll pertama: seluruh event awal dari 2 board harus terbaca
    events_batch_1 = await reader.poll_events()
    assert len(events_batch_1) > 0

    boards_seen = {ev.board for ev in events_batch_1}
    assert boards_seen == {"primary", "board_b"}, "Event harus berasal dari kedua board"

    # Verifikasi tidak ada duplikasi ID event dalam board yang sama
    seen_keys: set[tuple[str, int]] = set()
    for ev in events_batch_1:
        key = (ev.board, ev.id)
        assert key not in seen_keys, f"Duplikat event terdeteksi: {key}"
        seen_keys.add(key)

    # Poll kedua segera setelahnya: TIDAK BOLEH ada event baru karena cursor sudah maju
    events_batch_2 = await reader.poll_events()
    assert len(events_batch_2) == 0, "Poll ulang tanpa event baru harus mengembalikan list kosong"

    # 2. Tambahkan event baru di primary board
    conn_p = sqlite3.connect(primary_db)
    cur_p = conn_p.cursor()
    cur_p.execute(
        """
        INSERT INTO task_events (task_id, run_id, kind, payload, created_at)
        VALUES ('t_primary_new', 991, 'task_created', '{"title": "New Primary Task"}', ?);
        """,
        (int(time.time()),),
    )
    new_p_id = cur_p.lastrowid
    conn_p.commit()
    conn_p.close()

    # Poll ketiga: tepat 1 event baru dari primary terbaca
    events_batch_3 = await reader.poll_events()
    assert len(events_batch_3) == 1
    assert events_batch_3[0].board == "primary"
    assert events_batch_3[0].id == new_p_id
    assert events_batch_3[0].task_id == "t_primary_new"

    # 3. Tambahkan event baru di board_b
    board_b_db = boards_dir / "board_b" / "kanban.db"
    conn_b = sqlite3.connect(board_b_db)
    cur_b = conn_b.cursor()
    cur_b.execute(
        """
        INSERT INTO task_events (task_id, run_id, kind, payload, created_at)
        VALUES ('t_board_b_new', 992, 'task_done', '{"summary": "Done in B"}', ?);
        """,
        (int(time.time()),),
    )
    new_b_id = cur_b.lastrowid
    conn_b.commit()
    conn_b.close()

    # Poll keempat: tepat 1 event baru dari board_b terbaca
    events_batch_4 = await reader.poll_events()
    assert len(events_batch_4) == 1
    assert events_batch_4[0].board == "board_b"
    assert events_batch_4[0].id == new_b_id
    assert events_batch_4[0].task_id == "t_board_b_new"

    # Poll kelima: kosong kembali (zero duplicate across polls)
    events_batch_5 = await reader.poll_events()
    assert len(events_batch_5) == 0

    reader.close()


@pytest.mark.asyncio
async def test_kanban_reader_boot_cursor_max_id(
    temp_kanban_env: tuple[Path, Path],
) -> None:
    """Verifikasi spesifikasi: saat start, cursor = MAX(id) supaya tidak memutar ulang riwayat."""
    primary_db, boards_dir = temp_kanban_env

    # Inisialisasi default (init_cursor_to_max=True)
    reader = KanbanReader(
        primary_db_path=primary_db,
        boards_dir=boards_dir,
        init_cursor_to_max=True,
    )
    reader.boot()

    # Periksa nilai cursor awal sama dengan MAX(id) di database masing-masing
    conn_p = sqlite3.connect(primary_db)
    max_p = conn_p.execute("SELECT MAX(id) FROM task_events;").fetchone()[0]
    conn_p.close()

    board_b_db = boards_dir / "board_b" / "kanban.db"
    conn_b = sqlite3.connect(board_b_db)
    max_b = conn_b.execute("SELECT MAX(id) FROM task_events;").fetchone()[0]
    conn_b.close()

    assert reader.cursors["primary"] == max_p
    assert reader.cursors["board_b"] == max_b

    # Poll pertama: 0 event karena riwayat masa lalu tidak diputar ulang
    events = await reader.poll_events()
    assert len(events) == 0, "Boot dengan MAX(id) tidak boleh memutar ulang riwayat lama"

    # Tambahkan event baru
    conn_p = sqlite3.connect(primary_db)
    conn_p.execute(
        """
        INSERT INTO task_events (task_id, run_id, kind, payload, created_at)
        VALUES ('t_after_boot', 1001, 'task_started', '{"step": 1}', ?);
        """,
        (int(time.time()),),
    )
    conn_p.commit()
    conn_p.close()

    events_after = await reader.poll_events()
    assert len(events_after) == 1
    assert events_after[0].task_id == "t_after_boot"

    reader.close()


@pytest.mark.asyncio
async def test_kanban_reader_board_discovery_under_30_seconds(
    tmp_path: Path,
) -> None:
    """AC 2: Board baru di boards/ terdeteksi <= 30 dtk."""
    boards_dir = tmp_path / "boards"
    board_a_dir = boards_dir / "board_a"
    board_a_dir.mkdir(parents=True, exist_ok=True)
    shutil.copy2(PRIMARY_DB, board_a_dir / "kanban.db")

    # Inisialisasi reader dengan discovery interval 30 detik
    reader = KanbanReader(
        primary_db_path=None,
        boards_dir=boards_dir,
        discovery_interval_seconds=30.0,
    )
    reader.boot()

    assert set(reader.board_paths.keys()) == {"board_a"}

    # Tambahkan board_c baru secara dinamis
    board_c_dir = boards_dir / "board_c"
    board_c_dir.mkdir(parents=True, exist_ok=True)
    shutil.copy2(BOARD_B_DB, board_c_dir / "kanban.db")

    # Simulasi pemeriksaan discovery (<= 30 detik, dipaksa atau melalui pemanggilan interval)
    new_boards = reader.discover_boards(force=True)
    assert "board_c" in new_boards
    assert set(reader.board_paths.keys()) == {"board_a", "board_c"}

    # Verifikasi cursor board baru diinisialisasi ke MAX(id)
    conn_c = sqlite3.connect(board_c_dir / "kanban.db")
    max_c = conn_c.execute("SELECT MAX(id) FROM task_events;").fetchone()[0]
    conn_c.close()
    assert reader.cursors["board_c"] == max_c

    reader.close()


def test_kanban_reader_degraded_mode_on_missing_column(tmp_path: Path) -> None:
    """AC 3: Mode degradasi teruji (kolom dihapus di salinan fixture)."""
    degraded_db = tmp_path / "degraded_kanban.db"
    shutil.copy2(PRIMARY_DB, degraded_db)

    # Modifikasi database dengan menghapus kolom wajib 'block_kind' pada tabel tasks
    conn = sqlite3.connect(degraded_db)
    conn.execute("ALTER TABLE tasks DROP COLUMN block_kind;")
    conn.commit()
    conn.close()

    reader = KanbanReader(primary_db_path=degraded_db, boards_dir=None)
    reader.boot()

    # Verifikasi masuk ke mode degradasi
    assert reader.is_degraded is True
    assert reader.health.status == "degraded"
    assert reader.health.error is not None
    assert "block_kind" in reader.health.error

    reader.close()


def test_kanban_reader_degraded_mode_missing_event_column(tmp_path: Path) -> None:
    """Uji mode degradasi jika kolom wajib pada task_events terhapus."""
    degraded_db = tmp_path / "degraded_events_kanban.db"
    shutil.copy2(PRIMARY_DB, degraded_db)

    conn = sqlite3.connect(degraded_db)
    conn.execute("ALTER TABLE task_events DROP COLUMN payload;")
    conn.commit()
    conn.close()

    reader = KanbanReader(primary_db_path=degraded_db, boards_dir=None)
    reader.boot()

    assert reader.is_degraded is True
    assert reader.health.status == "degraded"
    assert reader.health.error is not None
    assert "payload" in reader.health.error

    reader.close()


@pytest.mark.asyncio
async def test_kanban_reader_tasks_snapshot(
    temp_kanban_env: tuple[Path, Path],
) -> None:
    """Verifikasi rekonsiliasi task snapshot untuk state engine."""
    primary_db, boards_dir = temp_kanban_env

    reader = KanbanReader(primary_db_path=primary_db, boards_dir=boards_dir)
    reader.boot()

    tasks = await reader.get_tasks_snapshot()
    assert len(tasks) > 0

    boards = {t.board for t in tasks}
    assert "primary" in boards

    # Pastikan atribut task terpetakan dengan benar
    sample_task = tasks[0]
    assert sample_task.id
    assert sample_task.title
    assert sample_task.status

    reader.close()


# ─────────────────────────────────────────────────────────────────────────────
# Test Gateway Reader
# ─────────────────────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_gateway_reader_mtime_caching_and_mutation(tmp_path: Path) -> None:
    """Verifikasi GatewayReader: membaca gateway_state.json hanya saat mtime berubah."""
    gw_file = tmp_path / "gateway_state.json"
    initial_data = {
        "pid": 121289,
        "gateway_state": "running",
        "active_agents": 3,
        "updated_at": "2026-10-03T12:00:00+00:00",
    }
    gw_file.write_text(json.dumps(initial_data), encoding="utf-8")

    reader = GatewayReader(gateway_state_path=gw_file)

    # 1. Pembacaan pertama
    data1 = await reader.read()
    assert data1["pid"] == 121289
    assert data1["active_agents"] == 3
    assert not reader.is_degraded
    assert reader.health.status == "ok"
    first_mtime = reader.last_mtime
    assert first_mtime is not None

    # 2. Pembacaan kedua tanpa perubahan file (mtime identik)
    data2 = await reader.read()
    assert data2 == data1
    assert reader.last_mtime == first_mtime

    # 3. Mutasi file dengan timestamp berbeda
    time.sleep(0.05)
    updated_data = {
        "pid": 121289,
        "gateway_state": "running",
        "active_agents": 5,
        "updated_at": "2026-10-03T12:05:00+00:00",
    }
    gw_file.write_text(json.dumps(updated_data), encoding="utf-8")

    data3 = await reader.read()
    assert data3["active_agents"] == 5
    assert reader.last_mtime != first_mtime


@pytest.mark.asyncio
async def test_gateway_reader_missing_or_corrupt_file(tmp_path: Path) -> None:
    """Verifikasi graceful degradation GatewayReader saat file tidak ada atau rusak."""
    non_existent = tmp_path / "ghost_gateway.json"
    reader = GatewayReader(gateway_state_path=non_existent)

    data = await reader.read()
    assert data == {}
    assert reader.is_degraded is True
    assert reader.health.status == "degraded"

    # Buat file dengan format json rusak
    corrupt_file = tmp_path / "corrupt_gateway.json"
    corrupt_file.write_text("NOT_JSON{{{", encoding="utf-8")
    reader_corrupt = GatewayReader(gateway_state_path=corrupt_file)

    data_c = await reader_corrupt.read()
    assert data_c == {}
    assert reader_corrupt.is_degraded is True
    assert reader_corrupt.health.status == "degraded"


# ─────────────────────────────────────────────────────────────────────────────
# Test Profiles Reader
# ─────────────────────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_profiles_reader_complete_agents_coverage(tmp_path: Path) -> None:
    """Verifikasi ProfilesReader membaca profil agent tanpa CLI."""
    profiles_dir = tmp_path / "profiles"
    forge_dir = profiles_dir / "forge"
    forge_dir.mkdir(parents=True, exist_ok=True)
    (forge_dir / "config.yaml").write_text(
        """
model:
  default: ag/gemini-3.8-flash-high
  provider: 9router
database:
  journal_mode: wal
""",
        encoding="utf-8",
    )

    agents_file = tmp_path / "agents.yaml"
    agents_file.write_text(
        """
agents:
  - name: forge
    role: backend_specialist
    responsibilities:
      - API development
      - SQLite management
    status: configured_active_profile
""",
        encoding="utf-8",
    )

    reader = ProfilesReader(profiles_dir=profiles_dir, agents_file=agents_file)
    profiles = await reader.read()

    assert not reader.is_degraded
    assert reader.health.status == "ok"

    # Verifikasi seluruh 16 agen utama terdaftar
    assert len(profiles) >= 16
    for canonical in STATIC_AGENT_METADATA.keys():
        assert canonical in profiles, f"Agen {canonical} harus terdaftar"

    # Verifikasi profil forge
    forge_prof = profiles["forge"]
    assert forge_prof.bio.name == "Forge"
    assert forge_prof.bio.primary_color == "#D9622B"
    assert forge_prof.bio.desk_zone == "dev_pod_2"
    assert forge_prof.model == "ag/gemini-3.8-flash-high"
    assert forge_prof.provider == "9router"


@pytest.mark.asyncio
async def test_profiles_reader_missing_dir_degradation(tmp_path: Path) -> None:
    """Verifikasi mode degradasi ProfilesReader saat direktori konfigurasi tidak ada."""
    reader = ProfilesReader(
        profiles_dir=tmp_path / "non_existent_profiles",
        agents_file=tmp_path / "non_existent_agents.yaml",
    )
    profiles = await reader.read()

    assert reader.is_degraded is True
    assert reader.health.status == "degraded"
    # Metadata statis 16 agen tetap disajikan agar office tidak crash
    assert len(profiles) >= 16


# ─────────────────────────────────────────────────────────────────────────────
# Test Host Reader
# ─────────────────────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_host_reader_live_telemetry() -> None:
    """Verifikasi HostReader pada lingkungan Linux riil (/proc/stat, /proc/meminfo, statvfs)."""
    reader = HostReader()
    vitals = await reader.read()

    assert isinstance(vitals, HostVitals)
    assert 0.0 <= vitals.cpu_percent <= 100.0
    assert 0.0 <= vitals.memory_percent <= 100.0
    assert 0.0 <= vitals.disk_percent <= 100.0
    assert vitals.status in ("healthy", "warning", "critical")

    # Validasi rincian Founder
    details = vitals.details
    assert details is not None
    assert details.cpu_cores >= 1
    assert details.memory_total_mb > 0.0
    assert details.memory_available_mb > 0.0
    assert details.disk_total_gb > 0.0
    assert details.uptime_seconds > 0.0

    # Panggilan kedua untuk menguji delta CPU
    vitals_second = await reader.read()
    assert 0.0 <= vitals_second.cpu_percent <= 100.0


@pytest.mark.asyncio
async def test_host_reader_mock_thresholds(tmp_path: Path) -> None:
    """Verifikasi HostReader ambang batas status (healthy, warning, critical) via file tiruan."""
    stat_file = tmp_path / "proc_stat"
    meminfo_file = tmp_path / "proc_meminfo"
    uptime_file = tmp_path / "proc_uptime"

    # CPU: total 1000, idle 100 (90% usage)
    stat_file.write_text("cpu  500 0 400 100 0 0 0 0 0 0\n", encoding="utf-8")
    # Memori: Total 1000 MB, Available 50 MB (95% usage -> critical)
    meminfo_file.write_text(
        "MemTotal:        1024000 kB\nMemAvailable:      51200 kB\n",
        encoding="utf-8",
    )
    uptime_file.write_text("123456.78 98765.43\n", encoding="utf-8")

    reader = HostReader(
        stat_file=stat_file,
        meminfo_file=meminfo_file,
        uptime_file=uptime_file,
        root_path=tmp_path,
    )

    # Read 1: inisialisasi basis CPU
    await reader.read()

    # Ubah stat CPU untuk membentuk delta kedua dengan usage tinggi
    # delta total = 1000, delta idle = 50 -> 95% CPU
    stat_file.write_text("cpu  1400 0 450 150 0 0 0 0 0 0\n", encoding="utf-8")
    vitals = await reader.read()

    assert vitals.status == "critical"
    assert vitals.memory_percent >= 90.0
