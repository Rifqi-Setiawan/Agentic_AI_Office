#!/usr/bin/env python3
"""
Office v2 Healthz Watchdog & Alert Monitor
Memeriksa status endpoint healthz (http://127.0.0.1:8092/api/v1/healthz) secara berkala.
Jika healthz berada dalam kondisi merah/gagal lebih dari 5 menit (> 300 detik),
skrip memicu alert CRITICAL ke syslog dan berkas alert log.
"""

import argparse
import json
import logging
import os
import sys
import time
import urllib.error
import urllib.request

DEFAULT_HEALTHZ_URL = "http://127.0.0.1:8092/api/v1/healthz"
DEFAULT_STATE_FILE = os.path.expanduser("~/.config/office-v2/healthz_watchdog_state.json")
DEFAULT_ALERT_LOG = os.path.expanduser("~/logs/healthz_alerts.log")
ALERT_THRESHOLD_SECONDS = 300  # 5 menit

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("office-v2-watchdog")


def load_state(state_file: str) -> dict:
    if os.path.exists(state_file):
        try:
            with open(state_file, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception as e:
            logger.warning("Gagal membaca state file %s: %s", state_file, e)
    return {
        "first_failure_timestamp": None,
        "failure_count": 0,
        "alert_fired": False,
        "last_status": "unknown",
        "last_error": None,
    }


def save_state(state_file: str, state: dict) -> None:
    os.makedirs(os.path.dirname(os.path.abspath(state_file)), exist_ok=True)
    temp_file = state_file + ".tmp"
    with open(temp_file, "w", encoding="utf-8") as f:
        json.dump(state, f, indent=2)
    os.replace(temp_file, state_file)


def write_alert(alert_log: str, level: str, message: str) -> None:
    os.makedirs(os.path.dirname(os.path.abspath(alert_log)), exist_ok=True)
    timestamp = time.strftime("%Y-%m-%d %H:%M:%S WIB", time.localtime())
    log_line = f"[{timestamp}] [{level}] {message}\n"
    with open(alert_log, "a", encoding="utf-8") as f:
        f.write(log_line)

    # Kirim ke syslog / systemd journal
    try:
        import syslog

        priority = syslog.LOG_CRIT if level == "CRITICAL" else syslog.LOG_INFO
        syslog.openlog("office-v2-watchdog", syslog.LOG_PID, syslog.LOG_USER)
        syslog.syslog(priority, f"[{level}] {message}")
        syslog.closelog()
    except Exception as e:
        logger.debug("Syslog call failed: %s", e)


def check_healthz(url: str, timeout: float = 5.0) -> tuple[bool, str]:
    """Menguji endpoint healthz. Mengembalikan (healthy: bool, detail: str)."""
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "OfficeV2-Watchdog/1.0"})
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            status_code = resp.status
            body = resp.read().decode("utf-8", errors="replace")
            if status_code != 200:
                return False, f"HTTP status {status_code}"
            data = json.loads(body)
            if data.get("status") != "ok":
                return False, f"Status payload not ok: {data.get('status')}"
            return True, "OK"
    except urllib.error.HTTPError as e:
        return False, f"HTTPError {e.code}: {e.reason}"
    except urllib.error.URLError as e:
        return False, f"URLError: {e.reason}"
    except Exception as e:
        return False, f"Exception: {type(e).__name__}: {e}"


def run_watchdog(
    healthz_url: str = DEFAULT_HEALTHZ_URL,
    state_file: str = DEFAULT_STATE_FILE,
    alert_log: str = DEFAULT_ALERT_LOG,
    threshold_seconds: int = ALERT_THRESHOLD_SECONDS,
    simulated_failure_duration: float | None = None,
) -> int:
    state = load_state(state_file)
    now = time.time()

    if simulated_failure_duration is not None:
        healthy = False
        detail = "Simulated test failure"
        # override timestamp jika disimulasikan
        first_fail = now - simulated_failure_duration
    else:
        healthy, detail = check_healthz(healthz_url)
        first_fail = state.get("first_failure_timestamp")

    if healthy:
        # Jika sebelumnya alert sudah menyala, kirim notifikasi pemulihan
        if state.get("alert_fired"):
            rec_msg = f"RECOVERY: Endpoint healthz {healthz_url} kembali SEHAT (GREEN)."
            logger.info(rec_msg)
            write_alert(alert_log, "RECOVERY", rec_msg)

        state["first_failure_timestamp"] = None
        state["failure_count"] = 0
        state["alert_fired"] = False
        state["last_status"] = "healthy"
        state["last_error"] = None
        save_state(state_file, state)
        logger.info("Healthz check PASS: %s", detail)
        return 0
    else:
        # Kegagalan terdeteksi
        if first_fail is None:
            first_fail = now
        state["first_failure_timestamp"] = first_fail

        state["failure_count"] = state.get("failure_count", 0) + 1
        state["last_status"] = "red"
        state["last_error"] = detail
        duration_red = now - first_fail

        logger.warning(
            "Healthz check GAGAL: %s (merah selama %.1fs, kegagalan ke-%d)",
            detail,
            duration_red,
            state["failure_count"],
        )

        if duration_red >= threshold_seconds and not state.get("alert_fired"):
            alert_msg = (
                f"ALERT CRITICAL: Endpoint healthz ({healthz_url}) telah MERAH > {threshold_seconds // 60} menit! "
                f"(Durasi down: {duration_red:.1f} detik, Error: {detail})"
            )
            logger.critical(alert_msg)
            write_alert(alert_log, "CRITICAL", alert_msg)
            state["alert_fired"] = True

        save_state(state_file, state)
        return 1 if duration_red >= threshold_seconds else 0


def main() -> None:
    parser = argparse.ArgumentParser(description="Office v2 Healthz Watchdog Monitor")
    parser.add_argument("--url", default=DEFAULT_HEALTHZ_URL, help="Healthz URL")
    parser.add_argument("--state-file", default=DEFAULT_STATE_FILE, help="Path ke state file")
    parser.add_argument("--alert-log", default=DEFAULT_ALERT_LOG, help="Path ke alert log")
    parser.add_argument(
        "--threshold",
        type=int,
        default=ALERT_THRESHOLD_SECONDS,
        help="Batas detik merah sebelum alert (default: 300 = 5 menit)",
    )
    parser.add_argument(
        "--simulate-red",
        type=float,
        default=None,
        help="Simulasikan durasi merah dalam detik untuk verifikasi alert",
    )
    args = parser.parse_args()

    exit_code = run_watchdog(
        healthz_url=args.url,
        state_file=args.state_file,
        alert_log=args.alert_log,
        threshold_seconds=args.threshold,
        simulated_failure_duration=args.simulate_red,
    )
    sys.exit(exit_code)


if __name__ == "__main__":
    main()
