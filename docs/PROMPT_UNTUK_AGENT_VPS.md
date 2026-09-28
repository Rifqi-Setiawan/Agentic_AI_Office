# Instruksi implementasi untuk AI agent di VPS

Anda bekerja pada sistem JARVIS/Hermes yang SUDAH berjalan. Paket ini adalah upgrade aditif untuk Mission Control, bukan izin membangun ulang crawler, scheduler, Kanban, atau struktur agent.

## Tujuan

Integrasikan exact delegation telemetry dan tiga komponen CommandCenter pengganti dari paket ini ke repository Agentic_AI_Office existing. Pertahankan 14 node resmi (13 AI + Rifqi), ID canonical, seluruh collector, WS/SSE lama, dependency lockfile, session DB, secret, dan kebijakan operasi.

## Langkah wajib

1. Audit read-only checkout aktual: commit SHA, git status, src/server.py, App.tsx, type/props frontend, package lock, service unit, interpreter, SQLite Python, reverse proxy, dan dispatcher worker nyata. Catat path/port yang terbukti. Jangan menampilkan secret ke chat/log.
2. Baca README, FILE_GUIDE, docs/01-04, serta qa/VALIDATION_REPORT. Pisahkan fitur yang telah diimplementasikan dalam paket dari rekomendasi yang belum dihubungkan ke VPS.
3. Buat branch/worktree staging dan diff terarah. Salin delapan file frontend serta package src/mission_control. Jangan menimpa server.py seluruhnya; pasang router sebelum static mount. Jangan menimpa README/konfigurasi service global tanpa review.
4. Jalankan preflight produksi. Library SQLite yang ditautkan ke Python harus memuat perbaikan WAL-reset atau backport distro yang terbukti. Jangan bypass checker agar test startup terlihat hijau.
5. Buat credential baru di luar repo; identitas implementer, QA, release dan dispatcher harus berbeda serta memiliki isolasi akun/container. Private API bind loopback pada port bebas yang diverifikasi. Read API hanya lewat autentikasi proxy yang sudah sah. Tidak ada token VITE_*.
6. Cari hook dispatch RIIL. Propagasi mission_id, task_id, span_id, parent_span_id. Panggil wrapper/control API dari hook tersebut. Jangan membuat span dari isNodeActive, perubahan roster, polling log bebas, klik UI, atau broadcast /chat saja. Jangan menambah runtime-dispatcher sebagai node ke-15.
7. Patuhi lifecycle: queued tidak aktif; running/waiting aktif selama lease sah; parent menunggu anak; failure/cancel/expiry menutup subtree. Dua misi atau invocation paralel tidak boleh saling menimpa.
8. Hubungkan QA menggunakan credential swe-verifier dan hasil test cleanroom riil. Submit digest artefak immutable; rework membatalkan approval lama. github-manager authorize -> publikasi nyata -> confirm. Jangan fabricate evidence atau published_ref.
9. Jalankan tes paket dan seluruh tes repository yang terdampak. Jalankan npm ci berdasarkan lockfile dan npm run build. Jalankan browser smoke lima viewport/dua tema, inspeksi screenshot berlabel, lalu uji event runtime sungguhan. Jangan mengganti semantic typecheck dengan transpile-only.
10. Deploy shadow dahulu, buktikan caller/callee dari log runner. Mintakan QA independen atas artefak final; release manager mempublikasikan digest yang sama. Simpan rencana rollback teruji dan dokumentasi delta.

## Larangan keras

Jangan mengganti semua isi src/server.py dengan contoh server kecil. Jangan membuka mutation API ke publik. Jangan menghapus DB lama, mengubah service port existing sepihak, menonaktifkan auth, membuat default telemetry sintetis, menjalankan seluruh worker sebagai root, membagikan master token, atau menganggap completed sama dengan released.

Jangan memperbaiki layout dengan mengurangi ukuran font tanpa batas atau menambahkan ellipsis pada judul. Jangan menggambar caller A -> B melalui C jika C tidak dipanggil. Pohon resmi memakai routing tetap; relasi lintas divisi ditampilkan eksplisit di sidebar.

## Laporan keluaran agent

Laporkan commit baseline dan final; file yang berubah; lokasi hook dispatch yang benar-benar ditemukan; mapping actor/mission/task/span; port dan service tanpa secret; hasil command test/build beserta exit code; lokasi screenshot; digest artefak; identitas QA dan bukti; ref publikasi; batas yang belum diverifikasi; serta langkah rollback.

Jika sesuatu belum terbukti, tulis 'belum diverifikasi' dan penyebab spesifik. Jangan menggantinya dengan angka contoh atau menyatakan production-ready hanya karena server berhasil start.
