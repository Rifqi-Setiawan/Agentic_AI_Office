#!/usr/bin/env bash
# ==============================================================================
# Agentic AI Office - 1-Command Rollback Script to Office v1 (Port 8091)
# Execution Target: < 2 minutes (SLA)
# Author: Relay (Git & Release Manager)
# ==============================================================================
set -euo pipefail

START_TIME=$(date +%s%N)
echo "================================================================="
echo "[ROLLBACK] Memulai rollback Office v2 -> Office v1 (Port 8091)..."
echo "Timestamp: $(date '+%Y-%m-%d %H:%M:%S WIB')"
echo "================================================================="

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
OPS_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
GATEWAY_CONF="/srv/gateway/caddy/conf.d/office.caddy"
ROLLBACK_SNIPPET="${OPS_DIR}/caddy/office-v1-rollback.caddy"

# 1. Pastikan berkas rollback konfigurasi Caddy ada
if [ ! -f "${ROLLBACK_SNIPPET}" ]; then
    echo "[ERROR] Snippet rollback tidak ditemukan di ${ROLLBACK_SNIPPET}"
    exit 1
fi

# 2. Periksa apakah service v1 (agent-cockpit) aktif di port 8091
echo "[1/4] Memeriksa ketersediaan backend Office v1 (port 8091)..."
if ! curl -s -f -o /dev/null "http://127.0.0.1:8091/health"; then
    echo "[WARN] Service di 8091 belum merespons, mencoba memastikan agent-cockpit.service..."
    systemctl --user start agent-cockpit.service || true
    sleep 2
    if ! curl -s -f -o /dev/null "http://127.0.0.1:8091/health"; then
        echo "[ERROR] Service Office v1 di port 8091 tidak aktif!"
        exit 1
    fi
fi
echo "[OK] Backend Office v1 aktif di 127.0.0.1:8091 (Health: OK)"

# 3. Terapkan konfigurasi rollback Caddy
echo "[2/4] Menerapkan konfigurasi reverse proxy Caddy untuk rollback v1..."
cp -f "${ROLLBACK_SNIPPET}" "${GATEWAY_CONF}"

# 4. Validasi dan Reload Caddy Gateway
echo "[3/4] Melakukan reload Caddy Gateway..."
sudo docker exec gateway-caddy caddy validate --config /etc/caddy/Caddyfile >/dev/null 2>&1
sudo docker exec gateway-caddy caddy reload --config /etc/caddy/Caddyfile >/dev/null 2>&1
echo "[OK] Caddy Gateway berhasil di-reload"

# 5. Verifikasi Health & Response
echo "[4/4] Memverifikasi respons domain office.rifqisetiawan.my.id..."
HTTP_STATUS=$(curl -k -s -o /dev/null -w "%{http_code}" --resolve office.rifqisetiawan.my.id:443:127.0.0.1 "https://office.rifqisetiawan.my.id/health" || echo "FAIL")
ENGINE_NAME=$(curl -k -s --resolve office.rifqisetiawan.my.id:443:127.0.0.1 "https://office.rifqisetiawan.my.id/health" | grep -o '"service":"agent-cockpit-engine"' || echo "")

END_TIME=$(date +%s%N)
DURATION_MS=$(( (END_TIME - START_TIME) / 1000000 ))
DURATION_SEC=$(awk "BEGIN {print ${DURATION_MS}/1000}")

echo "================================================================="
if [ "${HTTP_STATUS}" = "200" ] && [ -n "${ENGINE_NAME}" ]; then
    echo "[SUCCESS] Rollback ke Office v1 berhasil!"
    echo "Domain: https://office.rifqisetiawan.my.id -> Melayani v1 (Port 8091)"
    echo "Engine: agent-cockpit-engine"
    echo "HTTP Status: ${HTTP_STATUS}"
    echo "Waktu Eksekusi: ${DURATION_SEC} detik (Target SLA: < 120 detik)"
    echo "================================================================="
    exit 0
else
    echo "[FAIL] Verifikasi domain menghasilkan status: ${HTTP_STATUS}"
    echo "Waktu Eksekusi: ${DURATION_SEC} detik"
    echo "================================================================="
    exit 1
fi
