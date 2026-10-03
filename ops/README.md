# Operations & Deployment Guide (Office v2)

Petunjuk operasional dan konfigurasi staging deployment untuk Agentic AI Office v2.

## Aturan Keamanan & Hak Akses
1. **User Sistem**: Menjalankan service menggunakan user dedicated `office` (`uid 997, gid 985`).
2. **Read-Only Hermes Access**: User `office` dimasukkan ke grup supplementary `hermes` dengan akses baca saja ke `/srv/apps/hermes/` (mode direktori `0750`, tidak memiliki hak write).
3. **Zero Write**: Office v2 murni aplikasi *read-only* terhadap state SQLite dan berkas konfigurasi Hermes.
4. **Isolasi Port**:
   - Port `8091`: Office v1 (legacy, tetap berjalan tanpa gangguan hingga Fase 1 selesai).
   - Port `8092`: Office v2 staging service.

## Komponen
- `systemd/office-v2.service`: Konfigurasi unit systemd user service untuk backend FastAPI dengan auto-restart tangguh (`Restart=always`, `RestartSec=3s`).
- `systemd/office-v2-watchdog.service` & `office-v2-watchdog.timer`: Watchdog periodik (tiap 30 detik) yang memantau ketersediaan `/api/v1/healthz`. Memicu alert CRITICAL jika service down/merah lebih dari 5 menit (> 300 detik).
- `scripts/healthz_watchdog.py`: Logika pemantau kesehatan dengan pelacakan durasi downtime, penulisan log alert, dan notifikasi recovery.
- `caddy/Caddyfile.snippet`: Konfigurasi reverse proxy Caddy di `/srv/gateway/caddy/conf.d/office.caddy`:
  - **Security Headers**: HSTS (`max-age=31536000`), `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, dan `Content-Security-Policy` ketat tanpa `unsafe-inline` untuk tag `<script>`.
  - **Rate Limiting Login**: Menolak brute force pada `POST /api/v1/auth/login` (maksimal 5 request per menit per IP, percobaan ke-6 mendapatkan HTTP 429).
  - **Log Redaction**: Menyaring parameter sensitif dari access log Caddy dengan menghapus query string (`request>uri regexp \?.* ""`).
  - **SSE Proxy**: `flush_interval -1` untuk streaming tanpa buffering pada `/api/*`.
  - **Static Assets**: Melayani build frontend dari `/srv/html/office-v2`.

## Verifikasi Mandiri & Acceptance
- Pemindaian header: `curl -k -I --resolve office.rifqisetiawan.my.id:443:127.0.0.1 https://office.rifqisetiawan.my.id`
- Pemindaian rate limit: 6x POST ke `https://office.rifqisetiawan.my.id/api/v1/auth/login` menghasilkan HTTP 429 pada request ke-6.
- Uji kill service: `kill -9 <PID>` pada uvicorn dihidupkan kembali otomatis oleh systemd user manager dalam 3 detik.
- Log tanpa query string: Terverifikasi di `/srv/gateway/logs/office_staging_access.log`.
