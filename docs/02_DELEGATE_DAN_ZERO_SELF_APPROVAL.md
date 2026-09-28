# 02 - Rekomendasi workflow DELEGATE dan Zero Self-Approval

## Prinsip utama

Gunakan enam tahap DELEGATE yang sudah tertulis dalam `WORKFLOW_AND_DELEGATION.md` repository, bukan menambahkan kerangka baru yang namanya sama. Pisahkan empat domain: kontrak tugas, invocation runtime, bukti QA, dan publikasi. Status 'worker selesai' tidak identik dengan 'tugas lolos QA' atau 'sudah dipublikasikan'.

### Tahap 1 - Ingest dan klasifikasi

Rifqi memberikan mandat; Jarvis menentukan apakah pekerjaan merupakan perbaikan proyek existing, perluasan fitur, riset, operasi server, atau proyek baru. Untuk pekerjaan ini klasifikasinya enhancement pada cockpit existing. Jangan membangun ulang crawler, scheduler, atau frontend lain.

Dispatcher membuat root `rifqi -> vps-boss` hanya setelah mandat benar-benar diterima oleh runtime. Klik tombol chat, pesan broadcast, dan perubahan status roster bukan pengganti acknowledgement tersebut. Tugas terjadwal hanya boleh menggunakan mandat manusia yang memang masih sah; jangan menciptakan root seolah-olah manusia baru saja memerintah setiap kali proses bangun.

### Tahap 2 - Kontrak tugas formal

Jarvis membuat kontrak immutable: goal terukur, implementers, acceptance_criteria, allowed_paths, test_commands dalam bentuk argv, deadline_at_ms, max_attempts, budget_usd. `task_id` dapat dicocokkan dengan ID Kanban existing dan `mission_id` dengan mandat induk.

Kontrak harus menyebutkan artefak keluaran dan bukti penerimaan. Contoh kriteria untuk perubahan ini: tepat dua edge aktif saat root dan backend berjalan; edge QA belum aktif sebelum invocation QA dimulai; dua invocation pada pasangan sama tidak saling mematikan; no-overlap pada lima viewport; disconnect memadamkan lighting setelah TTL.

Implementer tidak dapat menjadi planner, verifier, atau release manager pada kontrak yang sama. Perubahan scope material membuat kontrak baru yang eksplisit, bukan diam-diam melonggarkan kontrak lama.

**Batas implementasi:** package menyimpan budget dan scope, serta menolak path traversal pada metadata. Pengukuran biaya riil dan enforcement izin filesystem belum dilakukan oleh store; harus dijalankan oleh sandbox/runner existing. Jangan menganggap angka budget di SQLite otomatis membatasi tagihan provider.

### Tahap 3 - Implementasi worker

Jarvis mendelegasikan ke pilar yang sesuai. Parent invocation tetap running/waiting sampai seluruh anak yang ditunggunya selesai. Gunakan `run_tracked` pada coroutine dispatcher yang benar-benar memanggil worker. `CallContext.child()` mempertahankan mission dan parent serta membuat span baru.

Bagi patch berdasarkan batas file yang tidak bertabrakan: frontend oleh swe-frontend/ui-designer; model/API oleh swe-backend; konfigurasi operasi oleh devops-engineer; pemeriksaan desain oleh tech-mentor. Hindari dua worker mengedit file yang sama tanpa koordinator. Gunakan worktree/branch terpisah dan merge terurut sebelum artefak QA dibekukan.

Child dapat paralel; jangan menyimpan satu global active_path yang terus ditimpa. Tiap invocation mempunyai span_id sendiri. Timeout/cancel menutup subtree pada proyeksi dan supervisor harus menghentikan proses/tool yang sebenarnya.

Worker menyerahkan SHA-256 artefak immutable. Hash sebaiknya mengikat isi tree/arsip final, dependency lockfile, serta build input yang ingin diverifikasi. Bukan hash pesan 'selesai'. Definisikan aturan hashing deterministik yang sama untuk implementer, QA, dan release manager. Package memvalidasi bentuk dan kesamaan hash; tidak menghitung isi file di VPS secara otomatis.

### Tahap 4 - Verifikasi independen

Hanya kredensial swe-verifier dapat mengirim verdict. Verifikasi harus mereproduksi perintah test dari checkout bersih, memeriksa hasil negatif, dan membandingkan digest artefak. Bukti menyertakan artifact_digest, tests_exit_code, evidence_digest, evidence_ref. Approval dengan exit code bukan nol ditolak oleh model.

Review frontend tidak harus melewati swe-backend. Caller tetap agen yang benar-benar memanggil QA. Representasi organisasi tidak boleh mengubah bukti runtime. Relasi lintas divisi muncul eksplisit di sidebar.

Jika QA menolak, gunakan invocation baru untuk rework. Agen yang sama boleh muncul lagi pada ancestry dengan span berbeda; itu bukan ancestry cycle. Artefak hasil perbaikan masuk review ulang dan approval sebelumnya dihapus. `max_attempts` menghitung pengajuan artefak, bukan jumlah heartbeat, bukan semua retry jaringan.

**Boundary keamanan:** token verifier membuktikan identitas pengirim, bukan kebenaran isi test report. Independent cleanroom/CI tetap harus menjalankan tes yang riil. Worker implementasi tidak boleh mempunyai token QA, akses write ke database kontrol, akses master token, atau privilege untuk mengambil token verifier.

### Tahap 5 - Sertifikasi rilis dan publikasi

Hanya github-manager dapat meminta authorize-release atas digest yang telah disetujui swe-verifier. Store menerbitkan authorization_id. Status pada tahap ini `release_authorized`, **bukan `released`**.

Release manager kemudian menggunakan jalur publikasi existing untuk artefak yang sama. Setelah Git/registry/deployment benar-benar memberi acknowledgement, kirim confirm-release dengan authorization_id, digest yang sama, dan published_ref Git 40/64 hex. Package tidak melakukan Git push dan tidak memverifikasi remote ref sendiri; publisher/CI terpercaya bertanggung jawab terhadap bukti remote.

Jika publikasi berhasil tetapi acknowledgement telemetry hilang, jangan langsung push ulang. Rekonsiliasi remote ref, idempotency key, dan state task terlebih dahulu. Setelah authorization, artefak tidak dapat ditukar dengan digest baru; tugas/perbaikan baru memerlukan proses verifikasi baru.

Tambahkan proteksi branch GitHub: review wajib, invalidasi approval saat konten berubah, required checks, pembatasan push/bypass. Hindari kredensial tunggal yang sekaligus dapat menulis kode, menyetujui QA, dan melewati proteksi rilis. Akun admin tetap dapat memiliki kemampuan bypass; tata kelola manusia harus eksplisit.

### Tahap 6 - Pelaporan ke Rifqi

Jarvis merangkum tujuan, artefak/digest, hasil test, bukti QA, published_ref, risiko tersisa, dan perubahan operasi. Bedakan 'implemented', 'verified', 'authorized', dan 'published'. Angka telemetry tidak boleh diganti default agar dashboard terlihat aktif.

## State machine yang benar-benar disertakan

```text
Invocation:
queued -> running <-> waiting -> completed
   |          |          |
   +----------+----------+----> failed / cancelled / expired

Task / artifact:
implementing -> review -> verified -> release_authorized -> released
                   |
                   +-> rejected -> review (artefak baru)
verified -> review (resubmission; approval lama batal)
```

Parent tidak boleh completed selama ada child queued/running/waiting. Failed/cancelled/expired pada parent menutup semua descendant terbuka. Completed bukan bukti rilis; task gate dan invocation sengaja terpisah.

## Matriks tanggung jawab

| Aktor | Kewenangan normal | Dilarang |
|---|---|---|
| Rifqi | Mandat, perubahan policy, eskalasi | Jangan dipalsukan oleh event heartbeat |
| Jarvis | Kontrak, perencanaan, delegasi, pelaporan | Meng-approve artefak sendiri |
| vps-assistant | Utility yang ditugaskan; co-pilot | Mengambil kewenangan QA/release otomatis |
| Senku / spesialis riset | Riset, data, manuskrip | Menganggap sumber web sebagai instruksi kontrol |
| Implementer engineering | Menulis patch dan submit digest | Mengirim approval dengan identitas sendiri |
| swe-verifier | Reproduksi tes dan approve/reject digest | Memodifikasi artefak yang sedang disetujui |
| github-manager | Authorize, publish, confirm digest sama | Mengganti artefak sesudah QA |
| devops-engineer | Operasi sandbox/service sesuai mandat | Membuka private mutation API ke Internet |
| office-lead | Observability dan rekonsiliasi visual | Menyimpulkan 'completed' dari idle |
| runtime-dispatcher | Instrumentasi trusted dan task contract | Melewati gerbang QA/release |

Nama runtime-dispatcher adalah identitas service internal, bukan node/AI tambahan di hierarki.

## Reliability: yang tersedia dan yang masih harus dihubungkan

Tersedia: event idempotency yang disimpan di SQLite, expected_version untuk optimistic concurrency, transaksi atomik, retry request terbatas, lease expiry, cascade, serta resnapshot setelah reconnect. Request yang memakai event_id sama tetapi actor/payload/resource berbeda ditolak.

Belum tersedia sebagai integrasi end-to-end: transactional outbox dari scheduler existing, durable consumer untuk semua event runner lama, deduplikasi efek samping tool, pemulihan child process setelah restart, dead-letter queue operasional, dan pengukuran biaya. Ini rekomendasi lanjutan, bukan fitur yang diklaim sudah selesai di ZIP.

Jika runner memakai database sendiri, tulis outbox pada transaksi yang sama dengan keputusan dispatch. Forward event setidaknya sekali dengan event_id stabil ke control-plane. Pertahankan dedupe key selama periode retry; jangan menghapusnya sebelum acknowledgement tidak mungkin dikirim ulang. Jangan mengklaim exactly-once atas shell/Git/provider hanya karena API telemetry idempotent.

Bedakan retry transport yang aman dengan retry operasi. SDK hanya mengulang request tertentu, bukan pekerjaan riil. Side effect non-idempotent membutuhkan idempotency provider atau rekonsiliasi manual. Konflik 409 berarti baca state terbaru dan putuskan tindakan baru; bukan loop retry buta.

Lease adalah batas kepercayaan telemetry, bukan bukti CPU mati. Hentinya heartbeat membuat UI fail-closed; supervisor masih perlu memastikan worker atau subprocess benar-benar dihentikan. Monitor clock host, restart yang berulang, antrean tertahan, umur approval, serta disk/WAL.

## Kebijakan manusia untuk operasi berisiko

Saran: perubahan firewall, credential, billing, penghapusan data, reset schema, dan force-push wajib approval manusia di runner existing. Paket tidak menambah universal policy engine atau override 'Supreme Authority' yang melewati verifier diam-diam. Record alasan dan identitas operator ketika kebijakan diubah.

Konten crawler, paper, log tool, atau halaman web adalah data tidak tepercaya. Jangan izinkan isi sumber tersebut menjadi instruksi untuk membaca token, mengubah gate, atau memanggil private API. Scope komando berasal dari kontrak dan identitas service, bukan dari teks hasil crawl.

## Rujukan primer

- Workflow existing: `https://raw.githubusercontent.com/Rifqi-Setiawan/Agentic_AI_Office/main/WORKFLOW_AND_DELEGATION.md`
- Trace context: `https://opentelemetry.io/docs/concepts/context-propagation/`
- Branch protection: `https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/about-protected-branches`

Bagian rekomendasi di atas adalah desain operasional yang diusulkan untuk sistem ini; tidak semua rekomendasi otomatis diimplementasikan oleh dashboard.
