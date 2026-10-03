# Operations & Deployment Guide (Office v2)

Petunjuk operasional dan konfigurasi staging deployment untuk Agentic AI Office v2.

## Aturan Keamanan & Hak Akses
1. **User Sistem**: Menjalankan service menggunakan user dedicated `office`.
2. **Read-Only Hermes Access**: User `office` dimasukkan ke grup dengan akses baca saja ke `/srv/apps/hermes/` (tidak memiliki hak write).
3. **Zero Write**: Office v2 murni aplikasi *read-only* terhadap state SQLite dan berkas konfigurasi Hermes.
4. **Isolasi Port**:
   - Port `8091`: Office v1 (legacy, tetap berjalan tanpa gangguan hingga Fase 1 selesai).
   - Port `8092`: Office v2 staging service.

## Komponen
- `systemd/office-v2.service`: Konfigurasi unit systemd untuk backend FastAPI.
- `caddy/Caddyfile.snippet`: Konfigurasi reverse proxy Caddy dengan `flush_interval -1` untuk SSE endpoint `/api/*` dan `file_server` untuk bundle frontend statis.
