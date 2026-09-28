# Laporan validasi aktual

Tanggal penyusunan: 28 September 2026.
Lingkup: source package upgrade dalam lingkungan kerja terisolasi, BUKAN checkout lengkap/VPS produksi pengguna.

## Hasil yang benar-benar dijalankan

| Pemeriksaan | Hasil | Bukti |
|---|---|---|
| Python pytest: model/store/ASGI/runtime/SQLite policy/HTTP nyata | 55 passed | backend-tests.txt |
| Frontend pure TypeScript strict compile + Node test | 17 passed | frontend-core-tests.txt |
| Parse/transpile tujuh modul TS/TSX | 0 syntax diagnostics | typescript-syntax.txt |
| Python compileall package/scripts/tests | Berhasil | Exit code 0 pada proses penyusunan |
| Bootstrap credential tanpa opsi Caddy | Berhasil | 15 actor token unik; 17 file 0600; dua direktori 0700; token tidak dicetak |
| Environment preflight read-only | Berhasil menghasilkan laporan; WAL produksi belum memenuhi policy | environment.json |

**Total automated tests: 72.** Pemeriksaan sintaks, compileall dan bootstrap di atas bukan tes tambahan yang dihitung ganda.

## Apa yang dicakup oleh tes

55 tes Python terdiri atas 41 tes store/API/gates, 4 runtime-wrapper, 9 kasus kebijakan versi SQLite, dan 1 integrasi HTTP/SSE loopback yang memakai SDK nyata. Kasus mencakup jalur aktif eksak, queued, parent waiting, fork, pasangan sama, multi-mission, replay idempotent, request conflict, version race, expiry/cascade, late event, orphan, identitas QA, invalidasi digest, authorize-versus-publish, auth, dan request body limit.

Tes transport menjalankan Uvicorn pada port loopback ephemeral, mengirim create/start/heartbeat melalui MissionClient, mengambil REST/SSE, memeriksa unauthorized credential, kemudian menyelesaikan invocation. Store disposable dan dua router digabung hanya untuk kenyamanan tes. Deployment produksi tetap memisahkan listener baca dan kontrol; tes ini bukan inspeksi reverse proxy VPS.

17 tes frontend-core mengeksekusi JavaScript yang dikompilasi dari graphModel.ts dan executionProtocol.ts. Geometri 14 kartu dan 13 edge diuji untuk overlap rectangle, lintasan menembus kartu, crossing, serta shared segment. Selector diuji terhadap kedaluwarsa, pasangan bersebelahan, concurrency, mission filter, alias, malformed payload, projection mismatch, dan revision regression. Replay snapshot identik tidak boleh memperbarui freshness.

## Environment aktual

Rincian mesin yang menjalankan tes ada pada environment.json. Pada penyusunan:

- Python 3.13.5; SQLite yang ditautkan Python 3.46.1.
- Node 22.16.0.
- FastAPI 0.128.2, Pydantic 2.13.4, Uvicorn 0.48.0.
- pytest 9.0.2, httpx 0.28.1.

Ini bukan lockfile baru atau rekomendasi upgrade dependency VPS. Gunakan lockfile existing dan validasi ulang. Laporan frontend_lockfile_present=false/frontend_node_modules_present=false mengacu pada overlay package penyusunan, bukan klaim bahwa repository pengguna tidak memiliki lockfile.

## Catatan SQLite yang tidak boleh diabaikan

Library lokal 3.46.1 tidak termasuk versi upstream yang diketahui memuat perbaikan WAL-reset. Tes fungsional menggunakan MissionStore eksplisit terhadap DB sementara; tes tersebut tidak membuktikan library tersebut aman untuk produksi. Jalur produksi store_from_env menolak library yang belum memenuhi policy secara default.

Operator wajib memeriksa versi/fix yang benar pada interpreter VPS. Backport vendor harus dibuktikan sebelum memakai flag verified. Jangan memakai keberhasilan unit test untuk menghapus guard. Rujukan: `https://sqlite.org/wal.html`, bagian 11.

## BELUM dilakukan

Build `npm run build` dengan seluruh import dan dependency React repository belum dilakukan. Environment penyusunan tidak mempunyai checkout lengkap/node_modules frontend yang diperlukan. Pemeriksaan tujuh modul TSX adalah parse/transpile, **bukan semantic typecheck React penuh**. Tidak ada ambient declaration palsu yang digunakan untuk menyamarkan kekurangan dependency.

Browser smoke dan inspeksi screenshot layout aktual belum dijalankan. Script tersedia, tetapi belum ada screenshot yang dinyatakan lulus. Jaminan geometri unit test berlaku pada koordinat model tetap; pengukuran handle, font, CSS global existing dan accessibility tetap harus dicek browser.

Belum ada koneksi SSH ke VPS, perubahan file live, pemasangan unit service, pengujian Caddy yang terpasang di VPS, pemetaan hook dispatcher real, uji crawler existing, verifikasi branch rules, atau publikasi GitHub. Tidak ada benchmark latency, beban, long-running soak, pemulihan backup, atau audit keamanan independen yang diklaim selesai.

## Kriteria penandatanganan QA berikutnya

QA independen harus menjalankan build penuh dari lockfile aktual, seluruh tes repository yang terdampak, browser smoke lima viewport/dua tema, tes runtime sungguhan root/backend/QA, auth expiry, SSE buffering, worker crash, restart dan restore. Verifikasi tidak ada akses implementer ke token QA/release atau DB. Cocokkan digest yang dites dengan artefak yang akan dipublikasikan.

Paket ini adalah implementasi lengkap yang telah diuji pada lapisan yang disebutkan, tetapi belum merupakan sertifikat kesiapan deployment produksi tanpa pemeriksaan tersebut.
