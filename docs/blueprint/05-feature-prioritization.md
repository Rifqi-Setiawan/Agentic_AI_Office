# 5. Feature Decomposition & Prioritization

V1 berisi 18 fitur Must. Semua gimmick ditunda ke Fase 2, supaya office sudah hidup dengan data nyata sebelum dipercantik. Effort: S = ≤ 1 hari kerja agent, M = 2–4 hari, L = ≥ 5 hari.

| ID | Fitur | Prioritas | Fase | Effort |
| --- | --- | --- | --- | --- |
| F01 | Reader Kanban multi-board read-only + cursor | Must | 1 | M |
| F02 | Reader gateway, profil, vitals host | Must | 1 | S |
| F03 | State engine (status agent, staleness, done hari ini) | Must | 1 | M |
| F04 | Proyeksi publik/Founder + tes anti-bocor | Must | 1 | M |
| F05 | SSE snapshot + delta + resume | Must | 1 | M |
| F06 | Login Founder | Must | 1 | S |
| F07 | Pipeline sprite + 16 karakter dengan animasi V1 | Must | 1 | L |
| F08 | Tile & furnitur 17 zona | Must | 1 | L |
| F09 | Peta Tiled + slot interaksi | Must | 1 | M |
| F10 | Renderer isometrik, depth sort, kamera + flight | Must | 1 | M |
| F11 | Pathfinding + reservasi slot | Must | 1 | M |
| F12 | Choreographer: task nyata + ambient + penanda | Must | 1 | L |
| F13 | Bubble dialog Bahasa Indonesia + dialog bank V1 | Must | 1 | M |
| F14 | HUD: top bar, feed, inspector, daftar agent | Must | 1 | L |
| F15 | Event kolektif: Rapat Mendadak, Break Time, Sholat | Must | 1 | S |
| F16 | Atmosfer otomatis WIB + override | Must | 1 | M |
| F17 | Rifqi klik-untuk-jalan (Founder) | Must | 1 | S |
| F18 | Deploy paralel + cutover + rollback | Must | 1 | S |
| F19 | Animasi aktivitas lengkap (renang, gaming, whiteboard, kerja khas) | Should | 2 | L |
| F20 | Reaksi berbasis event (Jarvis datang saat komentar, stempel Sentinel, paket Relay) | Should | 2 | M |
| F21 | Notifikasi visual task mulai/selesai | Should | 2 | S |
| F22 | Toggle "Mode Jujur" (ambient dimatikan) | Should | 2 | S |
| F23 | Vitals → perubahan lingkungan | Should | 2 | M |
| F24 | Audio ambient + SFX (mati secara default) | Should | 2 | S |
| F25 | Event kolektif tambahan | Should | 2 | M |
| F26 | Easter egg | Could | 2 | S |
| F27 | Dialog bank V2 + obrolan dua arah antar agent | Could | 2 | M |
| F28 | Chat persona Founder via 9Router | Could | 3 | M |
| F29 | Service health dari `systemctl --user` di dinding SOC | Could | 3 | S |
| F30 | Feed aktivitas git di Release Dock | Could | 3 | S |
| F31 | Lantai 2 / rooftop + kolam rooftop | Could | 3 | L |
| F32 | Panel relasi task (`task_links`) | Could | 3 | M |
| F33 | Replay riwayat | Won't | — | — |
| F34 | Perintah ke Hermes dari office | Won't | — | — |
| F35 | Dukungan mobile | Won't | — | — |
| F36 | Replay percakapan agent | Won't | — | — |

### Event kolektif

| Event | Fase | Peserta | Yang terjadi |
| --- | --- | --- | --- |
| Rapat Mendadak | 1 | Agent yang dipilih Founder (default: semua yang idle) | Berjalan ke Boardroom, duduk di `meeting_seat`, Jarvis berdiri di `presenter` |
| Break Time | 1 | Semua agent idle | Antre di counter, lalu duduk di kafe dan lounge |
| Sholat Berjamaah | 1 | Semua agent idle + Rifqi | Wudhu, lalu imam (Jarvis atau Merlin, acak) dan shaf terisi berurutan. Agent yang sedang kerja menjawab "Nyusul setelah task ini" |
| Pool Party | 2 | Semua idle | Kolam penuh, Bastion berjaga di tepi |
| Fire Drill | 2 | Semua | Bastion memimpin evakuasi ke kolam, lalu hitung kepala |
| Town Hall | 2 | Semua | Jarvis membacakan ringkasan hari ini (jumlah task, agent terproduktif) di Kafetaria |

Selama event kolektif, task nyata tetap menang: agent yang mendapat task di tengah event langsung kembali ke mejanya.

### Easter egg (Fase 2)

- Kode Konami → semua agent menari 5 dtk.
- Klik Oracle 10× → ledakan kecil konfeti kimia dan rambutnya berdiri sebentar.
- Steward sesekali memperbaiki tile yang "glitch" (lelucon meta: dia yang membangun kantor ini).
- Jumat setelah pukul 16.00 WIB, Relay menempel stiker "No Deploy Friday" di Release Dock.
- Pukul 03.00 WIB, kalau tidak ada task berjalan, satu agent acak tertidur di sofa lounge dengan "Zzz".
- Klik mesin espresso → Jarvis mengucapkan jumlah kopi yang "diminum" kantor hari ini.
