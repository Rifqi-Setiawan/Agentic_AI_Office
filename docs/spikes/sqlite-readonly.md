# Laporan Spike: Pembacaan SQLite Kanban Read-Only (T0.2)

**Tanggal:** 2026-10-03 (Asia/Jakarta / WIB)  
**PIC / Peneliti:** Forge (Backend Specialist)  
**Target Komponen:** Persistensi SQLite Kanban Hermes & Office v2 Read-Only Bridge  
**Dokumen Acuan:** `docs/blueprint/01-master-architecture.md`, `docs/blueprint/08-risk-assessment.md` (Risko R3)  

---

## 1. Ringkasan Eksekutif

Spike T0.2 mengevaluasi kelayakan, integritas, konkurensi, dan latensi pembacaan SQLite database Kanban Hermes secara *read-only* oleh service `office-v2` yang dijalankan di bawah user sistem `office`. Pengujian dilakukan terhadap database global `/srv/apps/hermes/kanban.db` serta database board aktif `/srv/apps/hermes/kanban/boards/office-v2/kanban.db` saat Hermes dan worker agent aktif melakukan transaksi write secara bersamaan.

### Hasil Utama
1. **PRAGMA journal_mode:** Terverifikasi `wal` (Write-Ahead Logging) dengan `synchronous = 2` (FULL) pada kedua database.
2. **Latensi Query Polling (p95):** **0.0707 ms** (~71 mikrodetik) pada polling 1 Hz live, dan **0.0046 ms** (~4.6 mikrodetik) pada stress test 3.600 query berturut-turut.
3. **Lock Contention / SQLITE_BUSY:** **0 error** di sisi `office` dan **0 error lock** di `gateway.log` Hermes selama pengujian dalam konfigurasi stabil.
4. **Bahaya `immutable=1`:** Terbukti secara empiris menyebabkan desinkronisasi fatal; SQLite mengabaikan WAL dan page cache invalidation sehingga penambahan event baru sama sekali tidak terbaca oleh `office`.
5. **Dilema Izin `-wal` dan `-shm`:** Ditemukan mekanisme internal SQLite di mana koneksi read-only (`mode=ro`) tetap membutuhkan akses baca-tulis ke shared memory index (`-shm`). Ditemukan pula risiko fatal jika direktori diberi izin write ke group `hermes`: user `office` dapat membuat `-shm` dengan mode `0644` (tanpa group write) yang mengunci writer Hermes (`SQLITE_READONLY`). Solusi definitif berbasis pembatasan direktori `0755` dan retensi shared memory telah divalidasi.

---

## 2. Pengukuran dan Metrik

### 2.1 Konfigurasi Database

| Target Database | Path | Ukuran DB | `PRAGMA journal_mode` | `PRAGMA synchronous` |
|---|---|---|---|---|
| Global Kanban DB | `/srv/apps/hermes/kanban.db` | 118.784 bytes | `wal` | 2 (FULL) |
| Board Kanban DB | `/srv/apps/hermes/kanban/boards/office-v2/kanban.db` | 221.184 bytes | `wal` | 2 (FULL) |

### 2.2 Latensi Query Polling `task_events`

Kueri yang diuji:
```sql
SELECT id, task_id, run_id, kind, payload, created_at
FROM task_events
WHERE id > ?
ORDER BY id
LIMIT 500;
```
Koneksi dibuka dengan URI:
`file:<path>?mode=ro` + `PRAGMA query_only=ON;` + `PRAGMA busy_timeout=2000;`.

#### A. Live Polling (Interval 1 detik, durasi 60 detik)
Pengujian dijalankan oleh user `office` saat agent Hermes (`steward`, `forge`, dan background dispatcher) aktif bekerja dan melakukan transaksi heartbeat/event ke database board:
- **Total Polls:** 60 poll
- **Total Events Tertangkap:** 12 event baru
- **SQLITE_BUSY:** 0
- **Other Errors:** 0
- **Min Latency:** 0.0392 ms (39.2 µs)
- **Mean Latency:** 0.0569 ms (56.9 µs)
- **Median (p50):** 0.0561 ms (56.1 µs)
- **p90:** 0.0607 ms (60.7 µs)
- **p95:** **0.0707 ms** (70.7 µs)
- **p99:** 0.0824 ms (82.4 µs)
- **Max Latency:** 0.0836 ms (83.6 µs)

#### B. Stress Polling (3.600 query berturut-turut / setara beban 1 jam)
- **Total Polls:** 3.600 query
- **SQLITE_BUSY:** 0
- **Other Errors:** 0
- **Min Latency:** 0.0043 ms (4.3 µs)
- **Mean Latency:** 0.0046 ms (4.6 µs)
- **Median (p50):** 0.0045 ms (4.5 µs)
- **p90:** 0.0046 ms (4.6 µs)
- **p95:** **0.0046 ms** (4.6 µs)
- **p99:** 0.0070 ms (7.0 µs)
- **Max Latency:** 0.0499 ms (49.9 µs)

### 2.3 Audit Log Hermes (`gateway.log`)
Audit dilakukan terhadap `/srv/apps/hermes/profiles/jarvis/logs/gateway.log` dan `agent.log`.
- Selama periode pengujian dengan izin file yang benar, tercatat **0 error lock**, **0 database busy**, dan dispatcher berjalan mulus (`spawned=1 reclaimed=0 crashed=0 timed_out=0 promoted=0 auto_blocked=0`).
- Terverifikasi bahwa pembacaan agresif oleh user `office` sama sekali tidak memblokir penulisan event oleh Hermes maupun proses dispatcher.

---

## 3. Analisis Mekanisme Internal SQLite & Bahaya `immutable=1`

### 3.1 Mengapa `immutable=1` Dilarang Keras
Pada mode WAL, SQLite menggunakan berkas `-shm` (shared memory index) dan `-wal` untuk mencatat transaksi yang belum di-checkpoint ke berkas `.db` utama.
Ketika opsi `immutable=1` digunakan:
- SQLite menganggap media penyimpanan bersifat permanen dan tidak akan pernah berubah (seperti CD-ROM).
- SQLite **sama sekali tidak membuka berkas `-wal` maupun `-shm`** dan tidak menginvalidsasi page cache.

#### Hasil Uji Komparasi Empiris:
1. Kondisi Awal: Database memiliki 1 baris di tabel feed.
   - `mode=ro` membaca: 1 baris
   - `immutable=1` membaca: 1 baris
2. Writer memasukkan 5 baris baru ke dalam transaksi WAL.
   - `mode=ro` membaca: **6 baris** (Data terbaru langsung terlihat)
   - `immutable=1` membaca: **1 baris** (Data baru tidak pernah terlihat!)

**Kesimpulan:** Penggunaan `immutable=1` pada service `office-v2` akan mematahkan fitur real-time feed event dan menyebabkan inkonsistensi data status agen. `immutable=1` tidak boleh digunakan.

### 3.2 Analisis Perizinan File `-wal` dan `-shm`

Mekanisme internal SQLite VFS (`os_unix.c`) saat membuka berkas WAL secara read-only (`mode=ro`):
1. SQLite mencoba membuka berkas `-wal` dan `-shm` dengan flag `openat(..., O_RDWR|O_CREAT, 0644)`.
2. Jika proses pembuka tidak memiliki izin write pada file tersebut (misalnya hanya memiliki hak baca), syscall `openat` menghasilkan `EACCES (Permission denied)`.
3. SQLite menangkap `EACCES` dan melakukan fallback: mencoba membuka berkas tersebut dengan `openat(..., O_RDONLY)`.
4. **Kondisi Kritis:**
   - **Jika berkas `-shm` sudah ada di disk:** Fallback `O_RDONLY` berhasil. Pembaca dapat memetakan shared memory dan membaca database dengan aman.
   - **Jika berkas `-shm` tidak ada di disk (misalnya telah di-unlink oleh checkpoint writer):** Fallback `O_RDONLY` gagal dengan `ENOENT`. SQLite mencoba membuat berkas baru; jika direktori tidak writable oleh user `office`, SQLite gagal dengan error `sqlite3.OperationalError: attempt to write a readonly database`.
   - **Bahaya jika direktori dibuat writable oleh `office`:** Jika user `office` memiliki izin tulis ke direktori (`0775`), SQLite reader `office` akan membuat file `-shm` baru dengan ownership `office:office` dan mode `0644`. Karena mode `0644` tidak memiliki bit group-write (`rw-r--r--`), proses Hermes (user `hermes`) yang kemudian ingin menulis ke database akan ditolak akses tulisnya ke `-shm`, menyebabkan Hermes gagal dengan error `attempt to write a readonly database`.

---

## 4. Rekomendasi Izin File Final (Untuk Bastion)

Untuk memenuhi aturan global arsitektur (*"Tidak ada write ke `/srv/apps/hermes/**` dari kode office"*) sekaligus menjamin stabilitas pembacaan SQLite tanpa saling kunci:

### 4.1 Izin Direktori (Direktori Induk & Board)
- **Path:** `/srv/apps/hermes/kanban` dan `/srv/apps/hermes/kanban/boards/*/`
- **Ownership:** `hermes:hermes`
- **Permission Mode:** `0755` (atau `0750` dengan group `hermes`).
- **Tujuan:** Menolak izin tulis (`w`) bagi user `office` pada level direktori. Mencegah user `office` membuat, menghapus, atau mengubah nama file apa pun di dalam ekosistem Hermes.

### 4.2 Izin File Database
- **Path:** `<board>/kanban.db`, `<board>/kanban.db-wal`, `<board>/kanban.db-shm`
- **Ownership:** `hermes:hermes`
- **Permission Mode:** `0664` (atau `0660` dengan group `hermes`).
- **Tujuan:** Memberikan hak baca/tulis bagi user dalam grup `hermes`. User `office` (anggota grup `hermes`) dapat membuka `-shm` dan `-wal` dengan `O_RDWR` tanpa hambatan.

### 4.3 Rekomendasi Lifecycle & Operasional
1. **Retensi Koneksi Persisten di `office-v2` Backend:**
   Service backend `office-v2` harus mempertahankan koneksi SQLite read-only yang terbuka sepanjang siklus hidup service (`asyncio` background task / connection pool), alih-alih membuka dan menutup koneksi setiap detik. Selama koneksi reader `office` tetap terbuka, SQLite VFS tidak akan pernah menghapus (unlink) berkas `-shm` saat writer menutup transaksi.
2. **Inisialisasi Board oleh Hermes:**
   Saat membuat board baru atau saat startup service Hermes, pastikan berkas `kanban.db-shm` dan `kanban.db-wal` diinisialisasi/di-touch dengan hak akses `0664 hermes:hermes`.
3. **Resilience Polling Loop di `office-v2`:**
   Pada skenario cold boot di mana service `office-v2` menyala mendahului penulisan pertama oleh Hermes, handler polling harus menangkap `sqlite3.OperationalError` (missing `-shm`) dan melakukan retry bertahap (exponential backoff 500ms – 1s) hingga Hermes menulis event pertama, tanpa membuat service crash.
