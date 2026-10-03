# 6. Task Decomposition

Total ada 44 task: 7 di Fase 0, 23 di Fase 1, 9 di Fase 2, dan 5 di Fase 3. Detail lengkapnya (body, semua acceptance criteria, fitur terkait, prioritas) ada di `tasks.yaml` di folder ini, dalam format yang siap diubah jadi kartu Hermes Kanban. Kolom "Bergantung pada" dipetakan ke `task_links`, dengan dependensi sebagai parent.

Aturan untuk semua task: tidak ada write ke `/srv/apps/hermes/**`, PIC tidak boleh meng-approve hasil kerjanya sendiri, dan gate tiap fase diverifikasi Sentinel. Jarvis mengorkestrasi dan melaporkan setiap gate ke Rifqi.

**Jalur kritis Fase 1:** T0.1 → T0.4 → T0.5 → T1.7 → T1.9 → T1.11 → T1.13 → T1.14 → T1.15 → T1.20 → T1.21 → T1.23. Sebagian besar jalur ini ada di tangan Steward (art dan engine), jadi task atmosfer (T1.18) dan vitals → lingkungan (T2.4) saya pindahkan ke Warden.

| ID | Task | PIC | Bergantung pada | Effort | Selesai bila (kriteria utama) |
| --- | --- | --- | --- | --- | --- |
| T0.1 | Siapkan repo v2 (tag v1-final, branch office-v2, scaffold monorepo, CI) | Relay | — | S | Tag `v1-final` ada di remote dan menunjuk ke 45af7ee |
| T0.2 | Spike pembacaan SQLite Kanban read-only saat Hermes aktif | Forge | T0.1, T0.3 | S | Laporan berisi journal\_mode, izin `-wal`/`-shm`, latensi p95; nol error lock di Hermes |
| T0.3 | Siapkan user office, izin baca Hermes, service staging port 8092 | Bastion | T0.1 | S | User `office` bisa membaca tapi tidak bisa menulis di `/srv/apps/hermes` |
| T0.4 | Spike pipeline sprite Blender → pixel-art isometrik | Steward | T0.1 | M | Halaman uji menampilkan karakter berjalan di atas 3 furnitur tanpa artefak blur |
| T0.5 | Style guide v0 dan gate visual spike | Muse | T0.4 | M | Keputusan GO/REVISI/FALLBACK tertulis dan disetujui Rifqi |
| T0.6 | ADR-001..004 dan draf kontrak OpenAPI v1 | Daedalus | T0.2 | S | 4 ADR + `openapi.yaml` valid, disetujui Jarvis |
| T0.7 | Fixture kanban.db dan gate Fase 0 | Sentinel | T0.2, T0.5, T0.6 | S | Fixture berisi penanda `LEAK-CANARY` + laporan gate G0 |
| T1.1 | Reader sumber (Kanban multi-board, gateway, profil, vitals host) | Forge | T0.6, T0.7 | M | Event terbaca tepat sekali lintas 2 board |
| T1.2 | Normalizer dan state engine | Forge | T1.1 | M | Setiap baris tabel status punya test |
| T1.3 | Proyeksi publik/Founder dan tes anti-bocor | Forge | T1.2 | M | Tes properti: tidak ada `LEAK-CANARY` di proyeksi publik |
| T1.4 | REST + SSE (snapshot, delta, resume, keep-alive, batas koneksi) | Forge | T1.3 | M | Lag event ≤ 2 dtk; resume tanpa event hilang atau ganda |
| T1.5 | Login Founder dan endpoint event kolektif | Forge | T1.4 | S | POST tanpa sesi/header ditolak; login ke-6 → 429 |
| T1.6 | Produksi sprite 16 karakter (paper-doll) dengan animasi V1 | Steward | T0.5 | L | 16 karakter bisa dibedakan dari siluet grayscale pada 1× |
| T1.7 | Sprite tile dan furnitur untuk 17 zona | Steward | T0.5 | L | Semua furnitur di tabel zona tersedia; atlas ≤ 2,5 MB |
| T1.8 | Review art dan checklist anti-slop | Muse | T1.6, T1.7 | M | Status OK/REVISI per aset; semua revisi ditutup |
| T1.9 | Peta Tiled 44×32 dengan 17 zona dan layer slot | Daedalus | T1.7 | M | Semua slot ada dengan kapasitas yang sesuai spec |
| T1.10 | Scaffold frontend (Vite, Pixi, HUD React terpisah, store, klien SSE) | Prism | T0.6 | M | HUD menerima snapshot dari mock; JS ≤ 400 KB gzip |
| T1.11 | Renderer isometrik, depth sort, kamera, dan flight antar zona | Steward | T1.10, T1.9 | M | Tidak ada urutan gambar yang salah; < 30 draw call |
| T1.12 | Pathfinding A\* dan reservasi slot | Nova | T1.10, T1.9 | M | Semua slot terjangkau dari Lobi; < 1 ms per pencarian |
| T1.13 | Entitas karakter dan FSM gerak | Steward | T1.6, T1.11 | M | 16 karakter berjalan bersamaan di 60 fps |
| T1.14 | Choreographer (task nyata + ambient + event kolektif) | Nova | T1.12, T1.13 | L | Agent tiba di mejanya ≤ 10 dtk setelah task mulai |
| T1.15 | Bubble manager | Prism | T1.14, T1.16 | M | Tidak pernah lebih dari 3 bubble |
| T1.16 | Dialog bank V1 (Bahasa Indonesia) | Merlin | — | S | ≥ 6 baris per state per karakter, lolos review Muse |
| T1.17 | HUD (top bar, feed, inspector, daftar agent, panel Founder) | Prism | T1.10, T1.4 | L | Semua kontrol bisa dipakai lewat keyboard |
| T1.18 | Atmosfer otomatis WIB dan pencahayaan malam | Warden | T1.11 | M | Transisi tetap ≥ 55 fps |
| T1.19 | Rifqi klik-untuk-jalan (mode Founder) | Prism | T1.14, T1.17 | S | Mode publik tidak bisa mengendalikan Rifqi |
| T1.20 | E2E Playwright dengan rekaman SSE | Sentinel | T1.15, T1.17, T1.19, T1.8 | M | 10 skenario lulus di CI |
| T1.21 | Benchmark performa dan ukuran | Sentinel | T1.20 | S | Semua metrik budget PASS |
| T1.22 | Deploy staging dan hardening | Bastion | T1.5, T0.3 | S | CSP tanpa `unsafe-inline`; service pulih sendiri setelah kill |
| T1.23 | Rilis v2.0.0 dan cutover domain | Relay | T1.21, T1.22 | S | Rollback teruji < 2 menit |
| T2.1 | Animasi aktivitas lengkap dan kerja khas per karakter | Steward | T1.23 | L | Semua 12 aktivitas di brief terlihat |
| T2.2 | Reaksi berbasis event | Nova | T1.23 | M | Setiap reaksi tercakup E2E |
| T2.3 | Notifikasi visual dan toggle Mode Jujur | Prism | T1.23 | S | Toggle tersimpan per viewer |
| T2.4 | Vitals → perubahan lingkungan | Warden | T1.23 | M | Setiap ambang teruji |
| T2.5 | Audio ambient dan SFX | Prism | T1.23 | S | Audio ≤ 1,5 MB, dimuat setelah suara dinyalakan |
| T2.6 | Event kolektif tambahan (Pool Party, Fire Drill, Town Hall) | Nova | T2.1 | M | Bisa dipicu Founder, berakhir otomatis |
| T2.7 | Easter egg | Nova | T2.1 | S | Tidak ada yang menutupi status task nyata |
| T2.8 | Dialog bank V2 dan obrolan dua arah | Merlin | T1.23 | M | 20 pasangan percakapan lolos review Muse |
| T2.9 | Regresi visual, performa ulang, dan rilis v2.1.0 | Sentinel | T2.1–T2.8 | S | Semua metrik budget tetap PASS |
| T3.1 | Chat persona Founder via 9Router | Forge | T2.9 | M | Hanya Founder; batas 100 pesan/hari teruji |
| T3.2 | Service health di dinding SOC | Bastion | T2.9 | S | Nama unit tidak tampil di publik |
| T3.3 | Feed aktivitas git di Release Dock | Relay | T2.9 | S | Pesan commit tidak tampil di publik |
| T3.4 | Lantai 2 dan rooftop | Steward | T2.9 | L | Budget performa tetap PASS |
| T3.5 | Panel relasi task (`task_links`) | Prism | T2.9 | M | Hanya tampil di mode Founder |
