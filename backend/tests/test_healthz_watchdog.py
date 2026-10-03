"""
Unit testing untuk skrip Office v2 Healthz Watchdog & Alert Monitor.
Memverifikasi:
1. Endpoint sehat -> status healthy, alert tidak dipicu.
2. Down < 5 menit -> status red, alert belum dipicu.
3. Down > 5 menit (> 300 detik) -> alert CRITICAL dipicu dan dicatat ke log.
4. Pemulihan (recovery) -> notifikasi RECOVERY dicatat dan state di-reset.
"""

import json
import os
import sys
from pathlib import Path

# Tambahkan ops/scripts ke sys.path
ops_scripts_dir = Path(__file__).resolve().parent.parent.parent / "ops" / "scripts"
sys.path.insert(0, str(ops_scripts_dir))

from healthz_watchdog import check_healthz, run_watchdog  # noqa: E402


def test_healthz_check_live_endpoint() -> None:
    """Menguji fungsi check_healthz terhadap endpoint staging live."""
    healthy, detail = check_healthz("http://127.0.0.1:8092/api/v1/healthz")
    assert healthy is True
    assert detail == "OK"


def test_watchdog_healthy_flow(tmp_path: Path) -> None:
    """Watchdog melaporkan sehat dan tidak memicu alert saat endpoint aktif."""
    state_file = str(tmp_path / "state.json")
    alert_log = str(tmp_path / "alerts.log")

    ec = run_watchdog(
        healthz_url="http://127.0.0.1:8092/api/v1/healthz",
        state_file=state_file,
        alert_log=alert_log,
        threshold_seconds=300,
    )
    assert ec == 0
    assert not os.path.exists(alert_log)

    with open(state_file, "r") as f:
        state = json.load(f)
    assert state["last_status"] == "healthy"
    assert state["alert_fired"] is False


def test_watchdog_transient_failure_under_5_minutes(tmp_path: Path) -> None:
    """Jika merah < 5 menit (misal 120s), alert belum dipicu."""
    state_file = str(tmp_path / "state.json")
    alert_log = str(tmp_path / "alerts.log")

    ec = run_watchdog(
        state_file=state_file,
        alert_log=alert_log,
        threshold_seconds=300,
        simulated_failure_duration=120,
    )
    assert ec == 0
    assert not os.path.exists(alert_log)

    with open(state_file, "r") as f:
        state = json.load(f)
    assert state["last_status"] == "red"
    assert state["alert_fired"] is False
    assert state["first_failure_timestamp"] is not None


def test_watchdog_failure_over_5_minutes_triggers_alert(tmp_path: Path) -> None:
    """Jika merah >= 5 menit (misal 310s), alert CRITICAL wajib dipicu."""
    state_file = str(tmp_path / "state.json")
    alert_log = str(tmp_path / "alerts.log")

    ec = run_watchdog(
        state_file=state_file,
        alert_log=alert_log,
        threshold_seconds=300,
        simulated_failure_duration=310,
    )
    assert ec == 1
    assert os.path.exists(alert_log)

    with open(alert_log, "r") as f:
        content = f.read()
    assert "[CRITICAL]" in content
    assert "telah MERAH > 5 menit" in content

    with open(state_file, "r") as f:
        state = json.load(f)
    assert state["alert_fired"] is True

    # Jika run berikutnya masih sehat, trigger RECOVERY
    ec_recovery = run_watchdog(
        healthz_url="http://127.0.0.1:8092/api/v1/healthz",
        state_file=state_file,
        alert_log=alert_log,
        threshold_seconds=300,
    )
    assert ec_recovery == 0
    with open(alert_log, "r") as f:
        content = f.read()
    assert "[RECOVERY]" in content
