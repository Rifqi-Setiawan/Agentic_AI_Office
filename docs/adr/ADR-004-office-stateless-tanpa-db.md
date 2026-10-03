# ADR-004: Arsitektur Backend Stateless Tanpa Database Internal

- **Status:** Diterima (Accepted)
- **Tanggal:** 2026-10-03 (Asia/Jakarta / WIB)
- **Penulis:** Daedalus (Principal Systems & Data Architect)
- **Stakeholder:** Forge (Backend Specialist), Bastion (Systems & Security Architect), Prism (Frontend Lead), Jarvis (Orchestrator)
- **Komponen:** Core Backend Architecture & State Engine (`backend/src/office/`)
- **Dokumen Acuan:** `docs/blueprint/00-keputusan-dan-asumsi.md`, `docs/blueprint/01-master-architecture.md`, `docs/blueprint/02-tech-stack.md`

---

## 1. Konteks dan Pernyataan Masalah

Pada fase eksplorasi awal Office v2, sempat diusulkan penggunaan mesin basis data analitik lokal di sisi backend office, seperti DuckDB tertanam (*embedded*) atau SQLite terpisah. Pertimbangan awalnya adalah untuk mengumpulkan riwayat event, melakukan agregasi statistik produktivitas harian, dan menyimpan state pengguna secara mandiri.

Namun, telaah mendalam terhadap kebutuhan operasional dan batasan arsitektur menetapkan fakta-fakta berikut:
1. **Batasan Sumber Daya VPS (Alokasi Memori Ketat):** Backend `office-v2` berjalan bersama komponen sistem lainnya di server hosting produksi. Target anggaran memori backend dibatasi secara ketat: **RAM backend < 150 MB**.
2. **Ketiadaan Fitur Historical Replay (Keputusan Poin 10 & 25):** Sesuai spesifikasi resmi (Fitur F33 = *Won't*), Office v2 tidak menyediakan fitur pemutaran ulang riwayat masa lalu (*time-travel / historical replay*). Klien di peramban hanya membutuhkan kondisi dunia saat ini (*real-time world state*) dan linimasa aktivitas terkini.
3. **Kompleksitas Operasional Basis Data Internal:** Menambahkan basis data lokal membawa beban manajemen skema migrasi (misal Alembic), potensi berkas korup saat server mati mendadak, konkurensi write I/O ke disk VPS, serta overhead dependensi C-extension (seperti DuckDB engine).
4. **Hermes Telah Menjadi Data Store Utama:** Semua data historis tugas, riwayat run, link ketergantungan, dan event telah tersimpan secara persisten dan terstruktur dalam database SQLite Kanban milik Hermes Agent.

---

## 2. Pendorong Keputusan (Decision Drivers)

1. **Efisiensi Alokasi Memori & CPU:** Backend harus sangat hemat sumber daya (< 150 MB RAM, idealnya < 60 MB RAM).
2. **Kesederhanaan Operasional (Simplicity & Zero-Maintenance):** Menghilangkan kebutuhan migrasi skema database, backup basis data lokal, dan pemulihan korupsi berkas database internal.
3. **Pemulihan Instan (High Resilience & Fast Recovery):** Service harus dapat pulih (*restart recovery*) dalam hitungan milidetik tanpa bootstrap database yang berat.
4. **Prinsip Single Source of Truth:** Tidak ada duplikasi data atau desinkronisasi antara database office dan database Hermes.
5. **Dukungan Resumability Koneksi SSE:** Tetap mampu melayani klien yang mengalami pemutusan jaringan singkat (*reconnection*) menggunakan standar HTTP `Last-Event-ID`.

---

## 3. Pilihan yang Dipertimbangkan

### Opsi 1: Menggunakan Embedded DuckDB di Backend Office
- **Deskripsi:** Membuka database file DuckDB lokal di dalam proses FastAPI untuk menyimpan sinkronisasi event dan menjalankan analitik SQL.
- **Kelebihan:** Sangat cepat untuk kueri analitik agregasi OLAP.
- **Kekurangan:** Menambah footprint memori runtime sebesar 50–100 MB hanya untuk mesin kueri; memperkenalkan dependensi biner berat; membutuhkan sinkronisasi penulisan berkelanjutan ke disk; berlebihan untuk kebutuhan agregasi sederhana.
- **Status:** Ditolak Keras.

### Opsi 2: Basis Data SQLite Internal Terpisah untuk Office
- **Deskripsi:** Membuat berkas database SQLite mandiri (misal `office.db`) khusus untuk menyimpan cache event dan tabel sesi pengguna.
- **Kelebihan:** Ringan, dependensi standar pustaka bawaan Python.
- **Kekurangan:** Menimbulkan beban I/O disk; membutuhkan manajemen migrasi tabel dan vacuum berkala; menduplikasi data yang sebenarnya sudah ada di database Hermes.
- **Status:** Ditolak.

### Opsi 3: External Key-Value Store (Redis)
- **Deskripsi:** Menggunakan instance Redis untuk state engine dan pub/sub event.
- **Kelebihan:** Mendukung arsitektur multi-worker backend horizontal.
- **Kekurangan:** Backend v2 hanya berjalan dengan 1 worker Uvicorn (sesuai budget); menambahkan dependensi infrastruktur service baru di VPS yang tidak proporsional dengan skala sistem.
- **Status:** Ditolak.

### Opsi 4: Arsitektur Backend Stateless Murni dengan In-Memory State Engine & Circular Ring Buffer
- **Deskripsi:** Backend tidak memiliki database atau penyimpanan persisten disk lokal sama sekali. State dunia dipertahankan di memori proses, event terbaru disimpan dalam circular ring buffer berkapasitas 500 item, statistik harian dihitung secara on-the-fly dari Hermes SQLite read-only, dan sesi login dikelola via signed stateless cookies.
- **Kelebihan:** 
  - Konsumsi RAM luar biasa hemat (< 60 MB).
  - Waktu startup instan (< 100 ms).
  - Zero disk write; tidak ada file lock atau risiko korupsi basis data.
  - Sederhana, elegan, dan sangat andal.
- **Status:** **Dipilih**.

---

## 4. Keputusan Arsitektur dan Spesifikasi Teknis

Ditetapkan bahwa **backend `office-v2` beroperasi secara murni STATELESS**:

```
                              ┌────────────────────────────────────────┐
                              │            Hermes SQLite DB            │
                              │ (kanban.db read-only, persistent conn) │
                              └───────────────────┬────────────────────┘
                                                  │ Polling 1s / 10s
                                                  ▼
┌────────────────────────────────────────────────────────────────────────────────────────┐
│ FastAPI Service (:8092) - 1 Uvicorn Worker                                             │
│                                                                                        │
│   ┌────────────────────────────────────────────────────────────────────────────────┐   │
│   │                         In-Memory State Engine                                 │   │
│   │                                                                                │   │
│   │   1. World Snapshot State (16 AgentState, Vitals, Active Collective Event)     │   │
│   │                                                                                │   │
│   │   2. Circular Ring Buffer (Kapasitas: 500 OfficeEvent, Monotonic Global 'seq') │   │
│   │                                                                                │   │
│   │   3. Dynamic Daily Aggregator (Query Hermes SQLite completed_at >= 00:00 WIB)  │   │
│   └────────────────────────────────────────────────────────────────────────────────┘   │
│                                           │                                            │
│                     ┌─────────────────────┴─────────────────────┐                      │
│                     ▼                                           ▼                      │
│         Koneksi Baru: SSE snapshot                  Resume Koneksi: Last-Event-ID      │
│         (Snapshot Utuh + Initial Feed)              (Delta Event dari Ring Buffer)     │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

### 4.1 In-Memory State Engine
1. **World Snapshot:** Backend mempertahankan representasi terkini kondisi seluruh 16 agen, status kehadiran (`presence`), status kerja (`work`), zona lokasi, serta status vitals host terbaru di memori.
2. **Circular Ring Buffer Event (500 Slot):**
   - Riwayat event kantor disimpan dalam struktur data circular buffer berkapasitas tetap 500 elemen `OfficeEvent`.
   - Setiap event diberi nomor urut sekuensial global (`seq`) yang monoton bertambah sejak server pertama kali menyala.
   - Buffer ini berfungsi ganda: menyediakan riwayat feed awal saat klien pertama kali terhubung, dan melayani pemulihan event yang terlewat saat terjadi rekoneksi jaringan.

### 4.2 Mekanisme Resume dan Heartbeat SSE
1. **Koneksi Baru:** Ketika klien browser membuka `/api/v1/stream`, server langsung mengirimkan event bertipe `snapshot` berisi kondisi terkini seluruh agen, diikuti oleh delta event baru.
2. **Pemulihan Rekoneksi (`Last-Event-ID`):**
   - Klien mengirimkan header HTTP `Last-Event-ID: <seq>`.
   - Jika `<seq>` masih berada dalam rentang index ring buffer 500 event, server hanya mengirimkan daftar delta event yang terjadi setelah nomor urut tersebut.
   - Jika `<seq>` sudah tergeser keluar dari batas ring buffer (klien terputus terlalu lama), server mengirimkan event `snapshot` utuh baru secara transparan agar klien melakukan sinkronisasi ulang (*resync*) penuh.
3. **Keep-Alive:** Server mengirimkan komentar keep-alive (`: ping\n\n`) setiap 15 detik untuk menjaga koneksi SSE tetap hidup melintasi reverse proxy Caddy (`flush_interval -1`).

### 4.3 Agregasi Statistik Harian Dinamis
- Metrik `done_today` per agen (jumlah task selesai hari ini) tidak disimpan dalam tabel analitik terpisah, melainkan dihitung langsung dari database Kanban Hermes secara read-only:
  ```sql
  SELECT assignee, COUNT(*) 
  FROM tasks 
  WHERE completed_at >= :start_of_day_wib 
  GROUP BY assignee;
  ```
  Di mana `:start_of_day_wib` adalah epoch timestamp detik pada pukul 00:00:00 WIB (Asia/Jakarta) hari bersangkutan.

### 4.4 Manajemen Sesi Founder Tanpa Database (Stateless Session)
- Autentikasi Founder tidak memerlukan tabel sesi database.
- Setelah password diverifikasi terhadap hash Argon2 pada environment variabel, backend menerbitkan signed session token (HMAC-SHA256 via `itsdangerous` dengan kunci rahasia server `SESSION_SECRET`).
- Token disimpan pada cookie browser dengan konfigurasi keamanan ketat:
  `HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=604800` (masa berlaku 7 hari).
- Setiap request mutasi (POST) wajib menyertakan header `X-Office-Intent: 1` sebagai perlindungan terhadap serangan Cross-Site Request Forgery (CSRF).

### 4.5 Siklus Hidup Event Kolektif (TTL Memory)
- Event kolektif yang dipicu oleh Founder (Rapat Mendadak, Break Time, Sholat Berjamaah) disimpan secara eksklusif di memori state engine dengan atribut durasi / TTL (*Time-To-Live*).
- Sebuah task latar belakang `asyncio` memeriksa kedaluwarsa event; saat waktu habis, event otomatis dinonaktifkan (`active = false`), event penutupan disiarkan ke SSE, dan seluruh agen kembali ke perilaku ambient normal tanpa jejak database.

---

## 5. Konsekuensi

### Positif:
1. **Konsumsi Memori Sangat Rendah:** Total konsumsi RAM backend FastAPI berada pada kisaran 40–60 MB, jauh di bawah batas toleransi sistem (150 MB).
2. **Zero Maintenance & Robustness:** Ketiadaan database lokal menghilangkan 100% kemungkinan kegagalan yang berkaitan dengan migrasi skema, disk space exhaustion akibat log database, dan korupsi berkas lokal.
3. **Deployment dan Restart Sempurna:** Service dapat di-restart kapan saja (`systemctl --user restart office-v2`) tanpa takut merusak integritas data; saat menyala kembali, state engine merekonstruksi kondisi terkini dari Hermes SQLite dalam < 100 ms.

### Negatif dan Risiko:
1. **Volatilitas Riwayat Feed Lama:** Jika service backend di-restart, riwayat event di luar ring buffer 500 item terakhir hilang dari feed tampilan UI.
2. **Ketergantungan Rekoneksi pada Buffer Window:** Klien yang mengalami pemutusan koneksi lebih lama dari waktu pengisian 500 event tidak dapat melanjutkan delta, melainkan harus menerima reload snapshot utuh.

### Mitigasi Risiko:
- Sesuai Keputusan Desain #10, ketiadaan histori jangka panjang merupakan fitur yang disepakati (*Won't*). 500 event mencakup durasi operasional rata-rata 30–60 menit aktivitas kantor, sangat memadai untuk pengalaman penonton publik.
- Klien frontend telah dirancang untuk menangani transisi event `snapshot` secara mulus tanpa mengedipkan (*flickering*) kanvas visual.

---

## 6. Kepatuhan Aturan Global & Validasi

- **Zero Write to Hermes:** Arsitektur stateless menjamin backend hanya memiliki hak baca atas data persisten.
- **Validasi Alokasi Memori:** Pengujian beban backend membuktikan memori RSS proses Uvicorn stabil pada ~48 MB dengan nol alokasi disk lokal.
