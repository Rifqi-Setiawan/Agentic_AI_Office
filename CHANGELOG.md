# Changelog

Semua perubahan penting pada proyek **Agentic AI Office v2** dicatat dalam berkas ini.
Format mengikuti panduan [Keep a Changelog](https://keepachangelog.com/id/1.0.0/) dan proyek ini mematuhi [Semantic Versioning](https://semver.org/lang/id/).

---

## [2.0.0] - 2026-10-04

### Ditambahkan (Added)
- **Monorepo Architecture (T0.1)**: Inisialisasi struktur monorepo modular (`backend/`, `frontend/`, `art/`, `docs/blueprint/`, `ops/`) dengan pipeline GitHub Actions CI komprehensif (Ruff, Mypy, ESLint, TypeScript `tsc`, Pytest, Vitest, Playwright).
- **Asset Pipeline & CC0 Compliance (T0.1, T0.4, T1.6, T1.7)**: Pipeline Blender headless untuk render sprite 2:1 dimetrik isometrik, 17 sheet karakter paper-doll Quaternius, dan atlas furnitur/lingkungan Kenney Furniture Kit dengan kepatuhan penuh `LICENSES.md`.
- **Concurrency & Read-Only Access (T0.2, T0.3)**: Spike konkurensi pembacaan SQLite `mode=ro` tanpa lock error di Hermes, serta isolasi user sistem `office` dengan hak akses baca tanpa hak tulis ke `/srv/apps/hermes/**`.
- **Multi-Source Reader & Normalizer (T1.1, T1.2)**: Poller pembaca multi-board Kanban (`tasks`, `task_events`, `task_runs`), `gateway_state.json`, konfigurasi profil agent, dan telemetri host Linux (`/proc`, `statvfs`) yang dinormalisasi ke model domain `OfficeEvent` dan `AgentState`.
- **Proyeksi Publik & Founder Anti-Bocor (T1.3)**: Redaksi ketat payload untuk penonton publik (penghapusan path absolut, token/kredensial, PID worker, dan branch internal), dengan pass-through penuh untuk Founder terautentikasi.
- **REST Endpoints & SSE Streaming (T1.4)**: Endpoint FastAPI untuk inisialisasi state, snapshot agent, healthz, serta Server-Sent Events (SSE) `/api/v1/stream/events` berlatensi rendah dengan manajemen batas koneksi.
- **Autentikasi Founder & Event Kolektif (T1.5)**: Verifikasi login Founder via Argon2id hash, cookie sesi `HttpOnly` / `SameSite=Strict`, proteksi CSRF `X-Office-Intent: 1`, pembatasan rate limit 5 req/menit/IP, serta endpoint event kolektif (`rapat` 10 mnt, `break` 10 mnt, `sholat` 5 mnt) dengan auto-expire TTL.
- **Peta Isometrik Tiled 44×32 (T1.9)**: Peta berdimensi 44×32 tile dengan 17 zona kantor tematik dan slot interaksi terdaftar.
- **Frontend PixiJS v8 Engine & HUD React 18 (T1.10, T1.11)**: Kanvas render isometrik 60 FPS dengan depth sorting dinamis ($Y$-sorting), kamera interaktif (pan, zoom 1×–3×, zone flight), dan HUD terpisah (React 18) dengan Zustand state store.
- **Navigasi 8-Arah A* & Slot Reservation (T1.12)**: Algoritma pathfinding A* 8-arah dengan pencegahan tabrakan diagonal dan sistem reservasi slot unik per agen.
- **FSM Gerak Karakter & Badge Status (T1.13)**: State machine lokomosi karakter (`idle`, `walk`, `sit`, `stand_talk`, `swim`, `sholat`), indikator visual badge tugas di atas kepala, dan drawer inspektur profil agent.
- **Choreographer & Scheduler Aktivitas (T1.14)**: Orkestrasi sinkronisasi pergerakan karakter berdasarkan tugas nyata Kanban, ambient scheduler saat agent idle, dan transisi event kolektif.
- **Bubble Dialog Bahasa Indonesia (T1.15)**: Bank dialog kontekstual berbahasa Indonesia dan `BubbleManager` dengan daur ulang DOM overlay pool (maksimal 3 bubble simultan).
- **HUD Kontrol & Top Bar (T1.17)**: Top bar status sistem, linimasa aktivitas real-time, sidebar pintasan keyboard, dan panel kontrol Founder.
- **Atmosfer Otomatis WIB (T1.18)**: Siklus pencahayaan otomatis berbasis waktu lokal Asia/Jakarta (Daylight, Golden Hour, Cyberpunk Night) dengan filter color-grading dinamis.
- **Founder Click-to-Walk (T1.19)**: Interaksi kendali navigasi avatar Rifqi di mode Founder dengan proteksi penolakan di mode publik.
- **Uji E2E Playwright (T1.20)**: Suite pengujian otomatis ujung-ke-ujung mencakup 10 skenario fungsional dengan mock rekaman SSE dan verifikasi screenshot visual.
- **Hardening Staging & Systemd Watchdog (T1.22)**: Service `office-v2.service` di bawah user `office` pada port 8092, konfigurasi Caddy reverse proxy dengan CSP ketat (tanpa `unsafe-inline` untuk script), HSTS, sanitasi log akses (redaksi query string), dan watchdog timer pemantau `/api/v1/healthz`.
- **Runbook & Skrip Rollback 1-Perintah (T1.23)**: Skrip otomatis `ops/scripts/rollback_to_v1.sh` (< 2 detik) dan `ops/scripts/switch_to_v2.sh`, serta dokumentasi lengkap di `ops/ROLLBACK.md`.

### Keamanan (Security)
- **Zero-Write Enforcement**: Seluruh kode backend beroperasi murni dalam mode *read-only* terhadap data Hermes.
- **Credential Masking**: Redaksi menyeluruh terhadap token, authorization header, dan payload rahasia sebelum mencapai browser.
- **Reverse Proxy Hardening**: Header HSTS (`max-age=31536000`), `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, dan rate limiting pada endpoint autentikasi.

### Performa & Kualitas (Performance & Quality)
- **100% Lolos Gate G1 (T1.21)** diverifikasi secara independen oleh Sentinel:
  - Frame time p95: **0.100 ms** (ekuivalen 10.000 FPS p95 pada zoom 2×, budget $\ge 60$ FPS).
  - Draw call: **1 draw call per frame** (konstan di seluruh level zoom, budget $< 30$).
  - Ukuran JS Bundle: **301.04 KB gzip** (budget $\le 400$ KB).
  - Ukuran Distribusi Total: **2.57 MB gzip** (budget $\le 5$ MB).
  - Memori Tab (30 Menit): Peak **19.28 MB**, slope stabil **+0.11 MB/menit** (budget $< 300$ MB).
  - Latensi Status Hermes → Layar: Rata-rata **24.08 ms** (budget $\le 2.0$ detik).
  - RAM Backend: **49.08 MB RSS** (budget $< 150$ MB).

---

## [1.0.0] - 2026-09-29 (Tag: `v1-final` @ 45af7ee)
- Rilis final Office v1 (Hermes Sovereign Cockpit & 3D Virtual Cyber-Office).
- Berjalan di port 8091 (`https://cockpit.rifqisetiawan.my.id`) dengan masa retensi hot-standby selama 14 hari.
