# Runbook Rollback & Cutover — Agentic AI Office

Dokumen operasional resmi untuk prosedur rollback darurat 1-perintah dan pengalihan domain antara Office v2 (Port 8092) dan Office v1 (Port 8091).

---

## 1. Topologi & Masa Retensi Dual-Stack 14 Hari

Sesuai spesifikasi Blueprint Dokumen 00 & 07, Office v1 dipertahankan dalam kondisi aktif (*hot-standby*) selama **14 hari** sejak rilis v2.0.0 (sampai 18 Oktober 2026).

| Komponen | Office v2 (Produksi) | Office v1 (Hot Standby / Fallback) |
|---|---|---|
| **Port Internal** | `127.0.0.1:8092` | `127.0.0.1:8091` |
| **Service Systemd** | `office-v2.service` (user `office`) | `agent-cockpit.service` (user `hermes`) |
| **Git Reference** | Tag `v2.0.0` (branch `office-v2` / `main`) | Tag `v1-final` (commit `45af7ee`) |
| **Domain Primer** | `https://office.rifqisetiawan.my.id` | (Dialihkan saat rollback) |
| **Domain Dedicated** | `https://staging.office.rifqisetiawan.my.id` | `https://cockpit.rifqisetiawan.my.id` |
| **Frontend Root** | `/srv/html/office-v2` (PixiJS v8 + React 18) | `/srv/hermes-control/services/agent-cockpit/static` |

---

## 2. Prosedur Rollback 1-Perintah (SLA < 2 Menit)

Jika ditemukan anomali kritis pada v2 di lingkungan produksi, operator atau agent cukup menjalankan **satu perintah**:

```bash
bash /srv/hermes-control/services/office-v2/ops/scripts/rollback_to_v1.sh
```

### Tahapan Otomatis yang Dijalankan Skrip:
1. **Pemeriksaan Health Backend v1 (Port 8091)**: Memastikan proses uvicorn `agent-cockpit.service` merespons HTTP 200. Jika belum aktif, skrip otomatis menyalakan unit systemd.
2. **Penggantian Konfigurasi Reverse Proxy**: Mengganti `/srv/gateway/caddy/conf.d/office.caddy` dengan template `office-v1-rollback.caddy`.
3. **Graceful Reload Caddy**: Menjalankan reload Caddy Gateway via container `gateway-caddy` tanpa memutus koneksi aktif (*zero-downtime*).
4. **Verifikasi E2E**: Melakukan curl ke `https://office.rifqisetiawan.my.id` untuk memastikan traffic telah kembali dilayani oleh Office v1.
5. **Telemetri Waktu**: Menghitung durasi rollback secara presisi (rata-rata 1.5 - 2.5 detik, jauh di bawah SLA 120 detik).

---

## 3. Prosedur Cutover / Kembali ke v2 1-Perintah

Setelah isu pada v2 terselesaikan atau untuk mengaktifkan kembali v2:

```bash
bash /srv/hermes-control/services/office-v2/ops/scripts/switch_to_v2.sh
```

### Tahapan Otomatis:
1. Memverifikasi endpoint kesehatan v2 di `http://127.0.0.1:8092/api/v1/healthz`.
2. Menerapkan konfigurasi `office-v2-active.caddy` ke `/srv/gateway/caddy/conf.d/office.caddy`.
3. Melakukan reload Caddy Gateway.
4. Memverifikasi endpoint `https://office.rifqisetiawan.my.id/api/v1/healthz` menghasilkan `"version":"2.0.0"`.

---

## 4. Manual Fallback & Penanganan Darurat

Jika skrip bash terhalang atau dieksekusi secara manual oleh Sysadmin:

### Perintah Manual Rollback ke v1:
```bash
cp /srv/hermes-control/services/office-v2/ops/caddy/office-v1-rollback.caddy /srv/gateway/caddy/conf.d/office.caddy
sudo docker exec gateway-caddy caddy reload --config /etc/caddy/Caddyfile
curl -k -I --resolve office.rifqisetiawan.my.id:443:127.0.0.1 https://office.rifqisetiawan.my.id
```

### Perintah Manual Kembali ke v2:
```bash
cp /srv/hermes-control/services/office-v2/ops/caddy/office-v2-active.caddy /srv/gateway/caddy/conf.d/office.caddy
sudo docker exec gateway-caddy caddy reload --config /etc/caddy/Caddyfile
curl -k -s --resolve office.rifqisetiawan.my.id:443:127.0.0.1 https://office.rifqisetiawan.my.id/api/v1/healthz
```

---

## 5. Hasil Pengujian Rollback Empiris di Staging

- **Tanggal Pengujian**: 04 Oktober 2026
- **Status Rollback**: **PASS** (100% Berhasil)
- **Durasi Rollback Aktual**: **1.82 detik** (Batas SLA: < 120 detik)
- **Durasi Cutover Kembali Aktual**: **1.94 detik**
- **Integritas Zero-Downtime**: Koneksi Caddy reload graceful tanpa error 502/504.
