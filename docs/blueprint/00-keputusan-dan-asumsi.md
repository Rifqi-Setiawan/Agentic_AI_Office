# 0. Keputusan dan asumsi

Office v2 berupa world isometrik 2.5D pixel-art bernuansa cozy-tech. Office ini terbuka untuk publik, 100% read-only terhadap Hermes, dan dibangun bertahap oleh agent Hermes mulai Fase 0.

| # | Topik | Keputusan |
| --- | --- | --- |
| 1 | Gaya visual | 2.5D isometrik pixel-art, proyeksi 2:1 |
| 2 | Aset | CC0 + pipeline procedural: GLB Kenney/Quaternius yang sudah ada dirender jadi sprite |
| 3 | Tone | Cozy-tech: hangat di siang hari, neon lembut di malam hari |
| 4 | Agent tanpa task | Simulasi hidup (ambient); task nyata selalu didahulukan dan diberi penanda visual |
| 5 | Sholat | Event kolektif yang dipicu manual |
| 6 | Rifqi | Mode Founder: avatar klik-untuk-jalan. Mode publik: NPC otomatis |
| 7 | Akses | Publik |
| 8 | Interaksi | Publik: lihat + klik (data disamarkan). Founder (login): trigger event + chat persona |
| 9 | Data | Polling SQLite read-only (Kanban), `gateway_state.json`, `config.yaml` profil, `/proc` |
| 10 | Replay | Tidak ada |
| 11 | Scope | MVP satu lantai dulu |
| 12 | Perangkat | Desktop saja |
| 13 | Eksekutor | Agent Hermes; task ditulis siap jadi kartu Kanban |
| 14 | Output | Dokumen ini + zip Markdown untuk agent |

Asumsi yang saya ambil sendiri (koreksi lewat komentar):

- **Chat Founder** = ngobrol dengan persona agent lewat 9Router, bukan mengirim perintah ke Hermes. Office tetap zero-write ke Hermes. Fitur ini masuk Fase 3.
- **Tanpa penyimpanan sendiri.** Karena tidak ada replay, feed aktivitas cukup ring buffer 500 event di memori, dan statistik harian dihitung langsung dari `kanban.db`. DuckDB dihapus dari office.
- **Mission Control DAG** (React Flow) tidak masuk V1. Panel relasi task dari `task_links` kembali sebagai opsi di Fase 3.
- **Spesifikasi VPS belum diketahui** (54 GB itu RAM laptop). Backend dirancang tetap di bawah 150 MB RAM. Render sprite dengan Blender dijalankan di laptop, bukan di VPS.
- **Deploy paralel.** v2 jalan di port 8092 selama pembangunan, lalu cutover domain di akhir Fase 1. v1 di-tag `v1-final` untuk rollback.
- **Oracle:** desain visualnya orisinal (ilmuwan eksentrik), bukan tiruan karakter Dr. Stone. Nama tampilan "Senku" tetap mengikuti `agents.yaml`.
