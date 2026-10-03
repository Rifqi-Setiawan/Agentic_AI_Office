# ADR-002: Polling SQLite Read-Only untuk Sinkronisasi State Hermes

- **Status:** Diterima (Accepted)
- **Tanggal:** 2026-10-03 (Asia/Jakarta / WIB)
- **Penulis:** Daedalus (Principal Systems & Data Architect)
- **Stakeholder:** Forge (Backend Specialist), Bastion (Systems & Security Architect), Sentinel (QA Lead), Jarvis (Orchestrator)
- **Komponen:** Ingestion Engine (`backend/src/office/sources/kanban.py`)
- **Dokumen Acuan:** `docs/blueprint/01-master-architecture.md`, `docs/spikes/sqlite-readonly.md`, `docs/blueprint/08-risk-assessment.md` (Risiko R3, R12)

---

## 1. Konteks dan Pernyataan Masalah

Service `office-v2` bertugas menyajikan visualisasi real-time status kerja, perpindahan agen, dan aktivitas tugas yang dieksekusi oleh runtime Hermes Agent. Sumber kebenaran tunggal (*single source of truth*) status tugas dan riwayat peristiwa di Hermes tersimpan dalam database SQLite: database global (`/srv/apps/hermes/kanban.db`) serta database board individual (`/srv/apps/hermes/kanban/boards/*/kanban.db`).

Integrasi pembacaan data ini menghadapi kendala teknis dan arsitektural yang ketat:
1. **Aturan Global Arsitektur:** Kode office dilarang keras melakukan penulisan ke path `/srv/apps/hermes/**` (*zero-write policy*).
2. **Risiko Konkurensi & Locking (Risiko R3):** Akses baca oleh proses `office` tidak boleh menimbulkan *database lock contention* (`SQLITE_BUSY`) yang dapat menghambat transaksi penulisan tugas oleh proses inti Hermes (gateway dispatcher dan worker agent).
3. **Mekanisme SQLite Write-Ahead Logging (WAL):** Database Hermes beroperasi dalam `PRAGMA journal_mode=wal`. Pada mode ini, transaksi aktif dicatat dalam berkas `-wal` dan shared memory index `-shm`. Kecerobohan dalam opsi koneksi atau pengaturan hak akses berkas dapat menyebabkan kegagalan baca (*stale read*) atau kegagalan fatal pada proses writer Hermes.
4. **Kelemahan Solusi Masa Lalu (v1):** Office v1 menggunakan pengawasan berkas log (`inotify` / `live_bridge.py`), yang terbukti rapuh terhadap rotasi berkas log, kehilangan event saat konkurensi tinggi, dan tidak memiliki struktur relasional.

---

## 2. Pendorong Keputusan (Decision Drivers)

1. **Jaminan Zero-Write:** Proses `office` secara fisik (di tingkat sistem operasi) tidak memiliki hak memodifikasi data atau struktur berkas di `/srv/apps/hermes/`.
2. **Latensi Minimal:** Sinkronisasi status agen dan event dari Hermes ke browser harus terjadi dalam lag ≤ 2 detik.
3. **Integritas Transaksi:** Data mutasi terbaru di tabel `task_events` harus terbaca secara konsisten dan terurut (*monotonic sequence*).
4. **Isolasi Mutlak dari Writer Hermes:** Pembacaan agresif tidak boleh memicu `SQLITE_BUSY` di sisi Hermes maupun di sisi office.
5. **Kesesuaian dengan Izin Sistem Linux:** Kompatibilitas dengan user sistem `office` dan grup `hermes` yang dikonfigurasi oleh tim infrastruktur.

---

## 3. Pilihan yang Dipertimbangkan

### Opsi 1: Event Push via Webhook / IPC dari Hermes
- **Deskripsi:** Menambahkan handler pada runtime Hermes untuk mengirimkan payload HTTP POST atau IPC socket ke Office setiap kali ada event Kanban.
- **Kelebihan:** Polling dihapus; transmisi event berbasis push murni.
- **Kekurangan:** Melanggar batasan arsitektur inti yang melarang modifikasi pada codebase Hermes Agent; menambah titik kegagalan (*coupling*) pada runtime Hermes.
- **Status:** Ditolak.

### Opsi 2: Log Harvester / File Watcher (`inotify` pada file log)
- **Deskripsi:** Membaca mutasi dari stream file `gateway.log` atau `agent.log`.
- **Kelebihan:** Tidak menyentuh berkas database secara langsung.
- **Kekurangan:** Rapuh; format teks log tidak bergaransi; event multi-baris sulit diparsing secara deterministik; potensi desinkronisasi saat log rotation.
- **Status:** Ditolak.

### Opsi 3: Membuka Database dengan Parameter URI `immutable=1`
- **Deskripsi:** Menggunakan koneksi SQLite URI dengan flag `immutable=1` (`file:<path>?immutable=1&mode=ro`).
- **Kelebihan:** Menghindari akses shared memory `-shm` dan mengabaikan locking mechanism sepenuhnya.
- **Kekurangan:** **FATAL**. Pada mode WAL, SQLite menganggap database tidak pernah berubah, sehingga tidak pernah membaca berkas `-wal` dan tidak pernah menginvalidsasi cache halaman memori. Hasil uji empiris Spike T0.2 membuktikan bahwa data baru sama sekali tidak terbaca oleh klien (`stale read` permanen).
- **Status:** **Ditolak Keras**.

### Opsi 4: Polling SQLite Read-Only Inkremental Berbasis URI `mode=ro` + `PRAGMA query_only=ON`
- **Deskripsi:** Service `office-v2` membuka koneksi langsung ke berkas database secara read-only dengan URI `file:<path>?mode=ro`, mengaktifkan `query_only`, dan melakukan kueri inkremental menggunakan cursor `id` per board.
- **Kelebihan:** 
  - Kueri sangat efisien pada primary key indeks B-Tree (`WHERE id > :cursor ORDER BY id LIMIT 500`).
  - Teruji secara empiris pada Spike T0.2: latensi query p95 sebesar 0.0707 ms (~71 µs), 0 lock contention (`SQLITE_BUSY = 0`), dan 0 error pada log Hermes.
  - Membaca data yang terstruktur secara langsung dari sumber utama.
- **Status:** **Dipilih**.

---

## 4. Keputusan Arsitektur dan Spesifikasi Teknis

Ditetapkan implementasi modul ingestion `sources/kanban.py` berbasis **Polling SQLite Read-Only Inkremental**:

### 4.1 Parameter Koneksi dan Eksekusi
1. **URI Koneksi Wajib:** Koneksi dibuka menggunakan format URI standar:
   ```
   file:<path>?mode=ro
   ```
2. **Pragma Konfigurasi Sesi:** Segera setelah koneksi terbuka, koneksi wajib menjalankan:
   ```sql
   PRAGMA query_only = ON;
   PRAGMA busy_timeout = 2000;
   ```
   *Larangan:* Parameter `immutable=1` dilarang digunakan dalam kondisi apa pun.
3. **Asinkronitas:** Seluruh panggilan eksekusi SQLite blocking wajib dibungkus dalam `asyncio.to_thread` agar tidak memblokir event loop utama FastAPI.

### 4.2 Siklus dan Interval Polling
1. **Polling Event Inkremental (Interval: 1 detik):**
   - Menjalankan kueri:
     ```sql
     SELECT id, task_id, run_id, kind, payload, created_at
     FROM task_events
     WHERE id > :cursor
     ORDER BY id ASC
     LIMIT 500;
     ```
   - Cursor `cursor` disimpan di memori per board.
   - **Boot Inisialisasi:** Saat service pertama kali menyala, cursor diinisialisasi pada `MAX(id)` agar service tidak memutar ulang seluruh riwayat masa lalu yang dapat membanjiri feed.
2. **Rekonsiliasi Status Task (Interval: 10 detik):**
   - Mengambil snapshot tugas berstatus `running` dan `blocked` per `assignee` untuk mengoreksi kemungkinan event yang terlewat atau tidak sinkron.
3. **Board Discovery (Interval: 30 detik):**
   - Menjalankan pemindaian direktori (`glob`) pada `/srv/apps/hermes/kanban/boards/*/kanban.db` untuk mendeteksi penambahan board baru secara dinamis.
4. **Penyaringan Heartbeat:** Event bertipe `heartbeat` tidak disiarkan ke SSE/feed publik untuk mencegah banjir trafik (Risiko R12); event heartbeat hanya digunakan oleh state engine untuk memperbarui timestamp `last_seen` guna mendeteksi status `stale` (heartbeat ≥ 120 detik).

### 4.3 Arsitektur Hak Akses Berkas dan Keamanan OS (Kolaborasi Bastion)
Berdasarkan hasil analisis VFS SQLite pada Spike T0.2:
1. **Izin Direktori:**
   - Direktori `/srv/apps/hermes/kanban` dan `/srv/apps/hermes/kanban/boards/*/` diatur dengan mode **`0755 hermes:hermes`** (atau `0750`).
   - *Rasional:* Mencegah user `office` membuat berkas baru secara tidak terkontrol (mencegah `office` membuat berkas `-shm` dengan mode `0644` yang dapat mengunci writer Hermes).
2. **Izin Berkas Database:**
   - Berkas `kanban.db`, `kanban.db-wal`, dan `kanban.db-shm` diatur dengan mode **`0664 hermes:hermes`**.
   - User `office` dimasukkan sebagai anggota grup sekunder `hermes`.
   - *Rasional:* User `office` dapat membuka `-shm` dengan hak baca-tulis bersama writer Hermes tanpa hambatan `EACCES`.
3. **Koneksi Persisten (Connection Retention):**
   - Service `office-v2` mempertahankan koneksi persistent read-only sepanjang masa aktif service.
   - *Rasional:* Keberadaan koneksi pembaca aktif mencegah SQLite VFS menghapus (*unlink*) berkas `-shm` saat proses writer Hermes menutup transaksi.
4. **Resilience Cold Boot:**
   - Jika service `office-v2` dinyalakan saat berkas `-shm` belum diinisialisasi oleh writer, poller menangkap `sqlite3.OperationalError` dan melakukan retry terukur (*exponential backoff* 500 ms – 1 s) tanpa membuat service crash.

---

## 5. Konsekuensi

### Positif:
1. **Latensi Sangat Rendah & Tanpa Lock Contention:** Terbukti pada Spike T0.2 dengan p95 0.0707 ms pada pengujian real-time dan 0.0046 ms pada stress test 3.600 kueri berturut-turut, tanpa ada satupun kejadian `SQLITE_BUSY`.
2. **Integritas Data Hermes Terjamin:** Proses `office` tidak memiliki izin tulis pada tingkat filesystem dan database, menjamin pemenuhan aturan *zero-write to Hermes*.
3. **Resilience Sistem:** Mekanisme rekonsiliasi berkala menjamin konsistensi data status agen meskipun terjadi gangguan sementara pada aliran event.

### Negatif dan Risiko:
1. **Overhead CPU Polling:** Polling berulang tiap detik memicu eksekusi kueri berkala.
2. **Ketergantungan Skema:** Perubahan skema internal SQLite Hermes dapat memengaruhi query poller.

### Mitigasi Risiko:
- Kueri `id > :cursor` langsung mengenai index primary key B-Tree berukuran kecil, menghasilkan konsumsi CPU < 0,1%.
- Service `office-v2` melakukan validasi kolom wajib saat startup via `PRAGMA table_info(tasks)` dan `PRAGMA table_info(task_events)`; jika kolom wajib hilang, backend secara otomatis masuk ke **Mode Degradasi** (menampilkan status telemetri offline sambil tetap menyajikan simulasi ambient kantor).

---

## 6. Kepatuhan Aturan Global & Validasi

- **Zero Write to Hermes:** Terverifikasi via pengujian hak akses permission Linux (`touch /srv/apps/hermes/kanban.db` ditolak dengan `Permission denied`).
- **Verifikasi Empiris T0.2:** Didokumentasikan secara lengkap dalam `docs/spikes/sqlite-readonly.md` dengan status PASS pada commit `88a8a0d`.
