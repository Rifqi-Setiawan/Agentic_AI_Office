#!/usr/bin/env bash
# ==============================================================================
# Agentic AI Office - 1-Command Cutover / Switch Script to Office v2 (Port 8092)
# Author: Relay (Git & Release Manager)
# ==============================================================================
set -euo pipefail

START_TIME=$(date +%s%N)
echo "================================================================="
echo "[CUTOVER] Mengalihkan traffic domain ke Office v2 (Port 8092)..."
echo "Timestamp: $(date '+%Y-%m-%d %H:%M:%S WIB')"
echo "================================================================="

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
OPS_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
GATEWAY_CONF="/srv/gateway/caddy/conf.d/office.caddy"
V2_SNIPPET="${OPS_DIR}/caddy/office-v2-active.caddy"

# 1. Pastikan berkas snippet konfigurasi Caddy ada
if [ ! -f "${V2_SNIPPET}" ]; then
    echo "[ERROR] Snippet v2 aktif tidak ditemukan di ${V2_SNIPPET}"
    exit 1
fi

# 2. Periksa apakah service v2 aktif di port 8092
echo "[1/4] Memeriksa ketersediaan backend Office v2 (port 8092)..."
HEALTHZ_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "http://127.0.0.1:8092/api/v1/healthz" || echo "FAIL")
if [ "${HEALTHZ_STATUS}" != "200" ]; then
    echo "[ERROR] Backend Office v2 di port 8092 tidak sehat (status: ${HEALTHZ_STATUS})!"
    exit 1
fi
echo "[OK] Backend Office v2 sehat di 127.0.0.1:8092"

# 3. Terapkan konfigurasi v2 Caddy
echo "[2/4] Menerapkan konfigurasi reverse proxy Caddy untuk Office v2..."
cp -f "${V2_SNIPPET}" "${GATEWAY_CONF}"

# 4. Validasi dan Reload Caddy Gateway
echo "[3/4] Melakukan reload Caddy Gateway..."
sudo docker exec gateway-caddy caddy validate --config /etc/caddy/Caddyfile >/dev/null 2>&1
sudo docker exec gateway-caddy caddy reload --config /etc/caddy/Caddyfile >/dev/null 2>&1
echo "[OK] Caddy Gateway berhasil di-reload"

# 5. Verifikasi Health & Response
echo "[4/4] Memverifikasi respons domain office.rifqisetiawan.my.id..."
APP_VERSION=$(curl -k -s --resolve office.rifqisetiawan.my.id:443:127.0.0.1 "https://office.rifqisetiawan.my.id/api/v1/healthz" | grep -o '"version":"2.0.0"' || echo "FAIL")
HTTP_STATUS=$(curl -k -s -o /dev/null -w "%{http_code}" --resolve office.rifqisetiawan.my.id:443:127.0.0.1 "https://office.rifqisetiawan.my.id" || echo "FAIL")

END_TIME=$(date +%s%N)
DURATION_MS=$(( (END_TIME - START_TIME) / 1000000 ))
DURATION_SEC=$(awk "BEGIN {print ${DURATION_MS}/1000}")

echo "================================================================="
if [ "${HTTP_STATUS}" = "200" ] && [ "${APP_VERSION}" = '"version":"2.0.0"' ]; then
    echo "[SUCCESS] Cutover ke Office v2 berhasil!"
    echo "Domain: https://office.rifqisetiawan.my.id -> Melayani v2 (Port 8092)"
    echo "App Version: v2.0.0"
    echo "Waktu Eksekusi: ${DURATION_SEC} detik"
    echo "================================================================="
    exit 0
else
    echo "[FAIL] Verifikasi domain gagal (Status: ${HTTP_STATUS}, Version: ${APP_VERSION})"
    echo "Waktu Eksekusi: ${DURATION_SEC} detik"
    echo "================================================================="
    exit 1
fi
