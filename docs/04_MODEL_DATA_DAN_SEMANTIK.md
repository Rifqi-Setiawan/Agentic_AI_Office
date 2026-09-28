# 04 - Model data, API dan semantik pencahayaan

## Identitas dan invariant

Agent ID adalah identitas aktor yang dapat digunakan kembali. Span ID adalah identitas satu invocation yang tidak boleh digunakan ulang. Mission ID mengikat satu mandat root. Task ID menghubungkan pekerjaan domain/Kanban, dan dapat sama pada beberapa invocation/retry.

Alias jarvis, senku, swe-qa dinormalisasi menjadi vps-boss, professor, swe-verifier. Alias tidak membuat node duplikat. Child wajib memiliki mission_id sama dengan parent dan caller yang sama dengan callee parent. Parent sudah running/waiting serta lease-nya belum lewat. Tidak boleh parent=self, caller=callee, atau orphan.

Root yang didukung package adalah rifqi -> vps-boss, satu per mission. Maksimum ancestry 64 dan maksimum invocation terbuka 4096 adalah batas defensif, bukan sasaran kapasitas produksi. Delegasi mandiri tanpa mandat root memerlukan perluasan policy eksplisit, bukan auto-root palsu.

## API baca publik

| Method | Path | Hasil |
|---|---|---|
| GET | `/api/v1/execution/snapshot` | Snapshot penuh, JSON no-store |
| GET | `/api/v1/execution/events` | SSE event delegation_snapshot; full snapshot |

Keduanya memakai autentikasi read. Browser mengirim sesi same-origin; reverse proxy yang telah memverifikasi pengguna menyuntikkan X-Hermes-Read-Token dan menimpa nilai dari client. Bearer read token tersedia untuk diagnosis loopback. Jangan menyertakan token read/actor di bundle.

Snapshot contoh lengkap berada di `qa/snapshot.example.json`. Itu fixture uji dengan waktu beku, bukan fallback produksi. Kontrak payload lengkap juga dijelaskan oleh interface `ExecutionSnapshot` dan divalidasi oleh `executionProtocol.ts`.

| Field | Makna |
|---|---|
| schema_version | Harus 1 |
| type | Harus delegation_snapshot |
| stream_id | Epoch DB yang persisten; berubah hanya bila DB baru |
| revision | Sequence perubahan durable dalam epoch tersebut |
| generated_at_ms | Waktu snapshot menurut server |
| freshness_ttl_ms | 15000 pada implementasi ini |
| instrumentation_seen | Pernah ada invocation yang benar-benar dicatat |
| active_delegation_chains | Satu jalur ancestry untuk setiap leaf aktif |
| caller_callee_pairs | Pasangan aktor dengan invocation aktif masing-masing |
| queued_count | Jumlah global yang queued; bukan jumlah aktif |
| recent_events | Maksimum 50 event non-heartbeat terbaru |
| release_gates | Maksimum 30 task gate terbaru; bukan seluruh backlog |

Setiap chain memuat chain_id, mission_id, task_id, span_ids, active_delegation_path, expires_at_ms. Panjang path adalah jumlah span_ids + 1. Path selalu dibaca sebagai pasangan bersebelahan: path[i] -> path[i+1], tidak sekadar membership.

Setiap caller_callee_pair memuat caller, callee, dan invocations. Setiap invocation memuat span_id, mission_id, task_id, state (running/waiting), dan expires_at_ms. Expiry invocation adalah minimum lease dirinya dan seluruh ancestor. Expiry chain adalah minimum lease seluruh span di jalur tersebut.

Chain dan pair adalah dua representasi dari snapshot transaksi yang sama. Frontend memvalidasi konsistensinya, bukan menerima dua authority yang saling bertentangan. Pair menjadi selector lighting, chain menjadi konteks jalur. Ancestor yang muncul di dua chain tidak dihitung sebagai dua invocation.

## Lighting yang tepat

Sebuah edge menyala hanya bila ada setidaknya satu invocation pada pasangan source/target yang persis sama, cocok dengan filter mission, belum melewati expiry, dan snapshot belum stale. `queued` tidak menyala karena baru rencana/antrean, bukan eksekusi.

Contoh urutan:

```text
root running                    -> hanya rifqi -> vps-boss
backend queued                  -> tetap hanya root
backend running                 -> root dan vps-boss -> swe-backend
QA running di bawah backend     -> ketiganya menyala
QA completed                    -> edge QA padam; parent yang masih terbuka tetap aktif
backend completed               -> edge backend padam
root completed                  -> tidak ada edge aktif
```

`waiting` tetap aktif karena tanggung jawab delegasi masih terbuka. Status ini menjelaskan mengapa jalur root tetap menyala ketika Jarvis menunggu backend/QA, walaupun Jarvis tidak mengonsumsi CPU pada saat itu. Bila yang diinginkan hanya transfer pesan sesaat, itu visualisasi event yang berbeda dan tidak menggantikan outstanding call chain.

Dua invocation pada pasangan sama: satu selesai tidak mematikan yang lain. Dua mission paralel: selector default menggabungkan pasangan aktif; filter mission mengisolasi salah satunya. Completion menggunakan span_id, tidak mencari seluruh tugas berdasarkan agent ID.

## Freshness, event ordering dan reconnect

SSE mengirim snapshot saat revision berubah, dengan heartbeat berupa full snapshot maksimal setiap 5 detik. Pemeriksaan perubahan dilakukan sekitar setiap 1 detik per koneksi; ini interval rancangan, bukan SLA latency. REST dipakai saat koneksi awal dan retry. Proxy/DB sibuk dapat memperlambatnya.

Frontend memakai revision dalam stream_id yang sama untuk menolak rollback. Epoch DB baru dapat mereset revision secara sah. Snapshot ber-revision sama dapat memperbarui freshness bila generated_at_ms lebih baru.

Expiry dihitung dari waktu server dalam snapshot ditambah elapsed monotonic browser sejak penerimaan, bukan membandingkan jam laptop langsung dengan jam VPS. Lama transit tidak dapat diukur sempurna oleh protokol ini; TTL membatasi, tetapi bukan jaminan distributed real-time clock. Sinkronkan jam VPS dan jangan memperlakukan indikator sebagai safety interlock proses fisik.

Jika snapshot tidak diperbarui selama 15 detik, semua lighting dipadamkan. Socket yang terbuka tetapi tidak meneruskan frame diputus oleh watchdog dan dicoba ulang. 401/403 menghapus snapshot aktif dan menampilkan penolakan akses. Payload invalid tidak dipakai; snapshot terakhir hanya bertahan sampai TTL.

Last-Event-ID tidak berarti replay setiap event sejak cursor. Feed ini sengaja full-state resynchronization, bukan event-delta consumer. Audit lengkap tersimpan di DB; UI hanya menampilkan 50 event terbaru. Jangan menjanjikan bahwa sidebar adalah histori audit lengkap.

## API kontrol privat

Semua path berikut berada pada listener loopback terpisah, dengan prefix `/internal/v1/execution`. Bearer credential dipetakan ke actor oleh server. Actor tidak diambil dari body yang dikirim client.

| Method | Resource | Tujuan |
|---|---|---|
| POST | `/spans` | Buat delegation queued |
| GET | `/spans/{span_id}` | Baca version/state terbaru |
| POST | `/spans/{span_id}/transition` | running/waiting/completed/failed/cancelled |
| POST | `/spans/{span_id}/heartbeat` | Perpanjang lease invocation |
| POST | `/tasks` | Buat kontrak immutable |
| GET | `/tasks/{task_id}` | Baca kontrak/gate/version |
| POST | `/tasks/{task_id}/artifact` | Submit digest hasil implementer |
| POST | `/tasks/{task_id}/verify` | Verdict verifier independen |
| POST | `/tasks/{task_id}/authorize-release` | Otorisasi release atas digest sama |
| POST | `/tasks/{task_id}/confirm-release` | Konfirmasi publication yang sudah terjadi |

Body dibatasi 64 KiB. Skema request lengkap berada di models.py; extra field ditolak. Semua mutasi mempunyai event_id. Semua update span/task mempunyai expected_version. Jangan menambah field actor agar suatu request seolah berasal dari QA.

Lease default 30 detik; rentang diterima 5-300. SDK heartbeat sekitar lease/3. Perpanjangan child tidak otomatis menghidupkan ancestor. Dispatcher harus mempertahankan scope parent atau heartbeat ancestor ketika menunggu.

Expiry dipersistenkan ketika snapshot atau mutasi mengakses store. Tidak ada janji background sweeper aktif ketika server tidak diakses. Frontend tetap memadamkan invocation berdasar expiry dari snapshot terakhir, dan update terhadap lease yang lewat ditolak.

## Penyimpanan

Database baru memiliki mc_meta, mc_spans, mc_tasks, mc_events dan mc_idempotency. Foreign key aktif, synchronous FULL, busy_timeout 5 detik. Proyeksi dan event domain ditulis transaksional; request event_id yang sama diputar ulang dari hasil tersimpan. event_id dengan request berbeda menghasilkan 409.

Response idempotent memuat hasil command saat pertama diterima, bukan selalu state terbaru saat retry datang. Jika response lama diikuti konflik version, baca GET span/task. Jangan menganggap field state pada replay sebagai status live saat ini.

Berkas SQLite harus pada disk lokal satu host. WAL memungkinkan concurrency reader/writer tetapi bukan multi-writer tanpa serialisasi dan bukan untuk NFS. Banyak viewer membuat query snapshot per-viewer; bila beban meningkat, ukur dahulu lalu tambah shared snapshot fan-out/caching. Package tidak membawa benchmark kapasitas atau bus lintas host.

Public endpoint tidak mengizinkan command/mutasi pengguna. Secara internal snapshot dapat memperbarui proyeksi lease expired; karena itu public read process adalah bagian trusted control plane dan tidak membuka SQLite dengan mode read-only. Akun worker tidak boleh menyentuh DB langsung.

## Operasi dan retensi

mc_events dan mc_idempotency bersifat durable dan tidak dipurge otomatis. Tetapkan retensi, backup terverifikasi, monitoring disk/WAL, dan prosedur arsip sebelum volume event tinggi. Jangan menghapus dedupe record yang masih mungkin di-retry. Jangan menghapus ancestor span yang masih dibutuhkan history atau FK.

Untuk backup gunakan SQLite backup API atau prosedur yang telah diuji; menyalin hanya file utama database aktif dapat mengabaikan WAL. Simpan telemetry baru terpisah dari DB Kanban dan profil agent existing.

Rujukan: `https://sqlite.org/wal.html` dan `https://opentelemetry.io/docs/concepts/context-propagation/`.
