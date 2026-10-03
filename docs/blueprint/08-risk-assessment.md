# 8. Risk Assessment

Dua risiko terbesar adalah kualitas art yang dihasilkan agent dan kebocoran data di office publik. Keduanya sudah dijaga oleh gate dan tes otomatis sejak Fase 0. Tabel diurutkan dari dampak terbesar.

| # | Risiko | Peluang | Dampak | Mitigasi | PIC |
| --- | --- | --- | --- | --- | --- |
| R1 | Art hasil pipeline tidak konsisten atau terlihat murahan | Tinggi | Tinggi | Spike T0.4 + gate Muse sebelum produksi; palet terkunci; fallback: paket pixel-art isometrik berbayar dengan lisensi yang jelas untuk situs publik | Muse |
| R2 | Data internal bocor di office publik | Sedang | Tinggi | Redaksi whitelist; judul task diganti kategori; allowlist board; tes properti `LEAK-CANARY` di unit dan E2E; review Sentinel tiap rilis | Forge, Sentinel |
| R3 | Pembacaan SQLite mengganggu Hermes (lock) atau gagal karena WAL/izin | Sedang | Tinggi | `mode=ro`, `query_only`, query pendek, tidak pernah `immutable=1`; diuji 1 jam di T0.2 | Forge, Bastion |
| R4 | Login Founder di-brute force | Sedang | Tinggi | argon2, rate limit di aplikasi dan Caddy, password ≥ 20 karakter | Bastion |
| R5 | Steward jadi bottleneck (art + engine di jalur kritis) | Tinggi | Sedang | Atmosfer dan vitals → lingkungan dipindah ke Warden; T1.6 dan T1.7 bisa berjalan paralel dengan T1.10–T1.12 | Jarvis |
| R6 | Skema Hermes berubah saat upgrade | Sedang | Sedang | Cek kolom saat boot; mode degradasi (office tetap hidup lewat ambient + banner "telemetri offline"); tes kontrak terhadap fixture | Forge |
| R7 | Pengunjung mengira simulasi ambient sebagai data nyata | Sedang | Sedang | Badge hanya untuk task nyata; legenda di HUD; toggle Mode Jujur | Prism |
| R8 | SSE tertahan buffer proxy | Sedang | Sedang | `flush_interval -1`, keep-alive 15 dtk, `X-Accel-Buffering: no`; fallback polling snapshot 5 dtk | Bastion |
| R9 | Scope creep: gimmick menunda MVP | Tinggi | Sedang | Daftar MoSCoW dikunci; gimmick hanya di Fase 2; kartu fase berikut tetap `todo` sampai gate | Jarvis |
| R10 | Kualitas turun karena agent menyetujui hasil kerjanya sendiri | Sedang | Sedang | Sentinel memverifikasi tiap gate; PIC tidak boleh self-approve; persetujuan visual dari Rifqi di G0 dan G1 | Sentinel |
| R11 | Lisensi aset atau kemiripan dengan karakter berhak cipta | Rendah | Tinggi | Hanya aset CC0 atau berlisensi jelas, dicatat di `LICENSES.md`; desain Oracle orisinal | Relay |
| R12 | Banjir event heartbeat | Tinggi | Rendah | Heartbeat tidak disiarkan; `LIMIT 500` per poll | Forge |
| R13 | Penyalahgunaan koneksi publik | Rendah | Sedang | 3 koneksi SSE per IP, 200 total; rate limit Caddy | Bastion |
| R14 | Kuota 9Router habis karena chat persona (Fase 3) | Sedang | Rendah | Hanya Founder; batas 100 pesan/hari; tanpa tool call | Forge |
| R15 | Salah hitung "hari ini" (epoch UTC vs WIB) | Sedang | Rendah | Semua batas hari memakai Asia/Jakarta; ada test pergantian hari | Forge |
