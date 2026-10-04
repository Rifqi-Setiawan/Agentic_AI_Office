# Review lokal — 5 Oktober 2026 WIB

Preview teknis React/CSS sudah diimplementasikan dan disiapkan untuk review lokal. Migrasi visual penuh belum selesai: art Blender empat arah dan sebagian penerimaan browser masih terblokir. Tidak ada push, merge atau deployment; VPS, gateway Telegram/WhatsApp dan layanan Office yang dijeda tidak diubah.

Source dasar `ae7473c16cb374544c9118d7d36d90515633fe02`; referensi W17ant `291e7608aa3beb614aca80fe86077ef8c0cbc21d`; branch lokal `codex/visual-migration-local`. Commit model/kontrak: `6564272`. Commit renderer/export: `4bbe0b2`. Commit bukti/laporan dan HEAD paket tercantum pada manifest paket lokal.

## Hasil yang tersedia

- Renderer opt-in React + CSS + WebP/PNG, lantai statis, 527 props/dinding pada satu urutan depth global, 17 karakter, sidebar 17 ruang dan camera focus pada kantor yang sama.
- Grid 44×32, 17 zona, 133 slot, 26 pintu, collision dan dua koridor tetap identik dengan paket baseline. File map, navigasi, backend, store dan service SSE tidak diubah.
- FSM karakter dan registry terpisah dari Pixi; choreography/persona/reservation/A*/avoidance dipakai kembali. Hanya renderer terpilih yang memiliki simulasi; clock model satu rAF, suspend/resume saat tab tersembunyi, cleanup listener/observer, HUD melalui facade.
- Animasi berdasarkan action/facing model, phase berjalan berdasarkan jarak, slot offset/foot depth, badge berdasarkan task nyata, FAIL/parcel/sweat/crown, threshold vitals, enam Easter egg dan bubble lama. Seluruh collective dibandingkan terhadap legacy menggunakan model nyata yang baru.
- Native West yang belum tersedia memakai mirror baseline hanya untuk preview dengan notice dan metadata. Missing action ditampilkan jelas. Ini belum merupakan pengecualian mirror yang disetujui untuk rilis.
- Skala ekspor/crop atlas, inverse camera hit test dan flight 1,25 detik; packer CSS menolak rotation, mempertahankan source size dan tidak menyalin otomatis ke produksi.
- Manifest pekerjaan art seluruh 17 zona/17 karakter, laporan coverage, art direction Z08/Prism, prompt/provenance dan atribusi MIT W17ant. Denah pada konsep tidak digunakan sebagai geometri.
- Legacy tetap default dan dapat dipilih dengan `?officeRenderer=legacy`; DOM preview memakai `?officeRenderer=claude&seed=42`.

## Tahap 00–08

| Tahap | Status nyata |
|---|---|
| 00 audit | Selesai: HEAD/cabang bersih sebelum clone, strict SSH read-only, tools, referensi dan lisensi diperiksa. Backup awal frontend dibuat sebelum perubahan; backup lengkap kemudian direkonstruksi dari commit dasar yang tidak berubah. |
| 01 kontrak | Selesai: snapshot semantik, projection, registry/model dan jejak pembanding. |
| 02 slice Z08 | Konsep/material/siluet dipilih mandiri sesuai delegasi user; Z08 DOM diamati. Slice final berlapis dan Prism native empat arah belum diproduksi. |
| 03 renderer | Implementasi preview React/CSS selesai; penerimaan browser akhir belum lengkap. |
| 04 seluruh art | Terblokir: Blender tidak tersedia; seluruh zona masih art baseline. Marker kamera, bentuk/material final, native directions, contact sheets dan recomposition belum dijalankan. |
| 05 data/interaksi | Model/store/SSE/port HUD tersambung; 6 collective dan work priority lulus pembanding legacy. Produksi/live telemetry dan sejumlah interaksi visual belum diuji end-to-end. |
| 06 QA | Typecheck/lint/build/286 unit tests lulus. Browser sebagian diamati; CLI Chromium tidak ada dan resume tab ditolak kebijakan URL. QA visual/responsif penuh belum lulus. |
| 07 paket lokal | Source, build, patches, laporan, evidence dan rollback disiapkan sebagai kandidat review berstatus blocked-art; bukan release produksi. |
| 08 deployment | Tidak diizinkan dan tidak dijalankan. |

## Pemeriksaan yang benar-benar dijalankan

| Pemeriksaan | Hasil | Bukti |
|---|---|---|
| `python scripts/visual_migration_contract.py` | Lulus; differences kosong | `layout-verification.json` |
| `npm run typecheck` | Lulus exit 0 | `evidence/typecheck-final.log` |
| `npm run lint` | Lulus exit 0 | `evidence/lint-final.log` |
| `npm run build` | Lulus; warning chunk Pixi legacy raw >600kB masih ada | `evidence/build-final.log` |
| `npm run test -- --maxWorkers=2 --minWorkers=1` | 39 file, 286 tes lulus | `evidence/tests-final.log` |
| Model vs legacy | Route/FSM/work gesture/leave, 17-agent trace, enam collective + real work priority, vitals/Easter | `simulation/modelParity.test.ts`, `evidence/collective-parity-tests.log` |
| Camera/atlas | Inverse pan/zoom/resize, shared flight, rotated rejection, crop/exportScale | `scene/SceneCamera.test.ts` |
| Packer native library + pixel comparison | Piksel hasil crop identik; source size benar; rotation false; exportScale 2 | `evidence/atlas-packer-check.json` |
| Art job preview | 17 zona/17 karakter; 476 kelompok animasi/arah native West belum ada | `art-jobs.json`, `art-coverage.json` |
| Art gate tanpa preview | Exit 1 sesuai desain; finalArtReady false | Tidak dinyatakan lulus rilis |
| Playwright DOM E2E | Gagal launch sebelum assertion; executable Chromium headless-shell tidak tersedia | `evidence/playwright-attempt.log` |
| Browser Codex | Kantor DOM, overview/focus Z08, feed collapse dan login Founder fixture diamati | Rincian dan batas pada `BROWSER_QA.md` |
| Diff area terlindungi | Kosong untuk backend/ops/map/services/store terhadap commit dasar | Perintah git diff dieksekusi setelah perubahan |

Baseline awal: 269/272 tes lulus dengan tiga kegagalan (budget bundle 402,51 KiB dan dua benchmark waktu pada parallel run). Run migration awal dengan worker terbatas: 271/272, bundle masih memakai build lama. Setelah build baru, seluruh tes lulus; budget gabungan JS gzip sekarang 357,71 KiB, termasuk chunk legacy. Tes budget repository menjumlahkan semua chunk, bukan pengukuran network cold load route DOM.

Kegagalan sementara selama pengembangan juga dicatat: pemanggilan npm pertama dari root salah direktori; import.meta.hot/unused parameters diperbaiki; assertion trace awal memakai Honest Mode tersimpan dari run sebelumnya dan diperbaiki pada harness; tipe fixture test diperbaiki; import React yang tidak dipakai pada refactor terakhir dihapus. Verifikasi ZIP menemukan bahwa backup awal hanya subtree frontend; arsip awal dipertahankan dan backup lengkap dibuat dari immutable base commit di root repo. Log kegagalan yang tersimpan tidak ditafsirkan sebagai hasil akhir lulus.

## Visual, performa dan blocker

Konsep terpilih: `evidence/z08-prism-style-concept.png`. Screenshot tersimpan: `evidence/baseline-browser.jpg` adalah baseline 1280×720. Screenshot DOM Z08/overview sempat ditampilkan dalam chat, tetapi ekspor final baru, detail/motion sequence, 1280×800 dan 390×844 belum tersimpan setelah interupsi. Tidak ada video/motion screenshot palsu.

Pengukuran DOM browser awal p95 27,8ms, lalu 20,9ms saat tooling berjalan. Ref caching, penghindaran write yang sama dan filter identity diperbaiki. Tidak ada pengukuran akhir yang membuktikan target 60fps; jangan menganggap performa lulus.

Blender tidak ditemukan. Paket perencanaan `../migration-plan/04_ART_BIBLE_AND_INVENTORY.md` menyatakan: “Jika Blender tidak tersedia, jangan install atau memakai layanan berbayar tanpa izin”. Tidak dipasang. Untuk menyelesaikan art dibutuhkan runtime Blender lokal yang disediakan/diizinkan, lalu marker calibration, produksi layers/native directions dan review identitas pada hasil nyata.

Browser otomatis menolak rebind tab setelah tab menjadi error page, dengan alasan protokol URL tidak diizinkan. Tidak dicoba bypass, CDP, browser lain atau workaround. Untuk QA berikutnya diperlukan akses ke tab HTTP lokal yang diizinkan kembali. agent-browser Edge launch dan download Chrome sebelumnya juga gagal; Playwright CLI butuh executable browser yang tersedia.

Risiko tersisa: final style belum tercapai, metadata/provenance final art belum disetujui, empat arah asli belum ada, seluruh occlusion/detail ruang dan interaksi penting belum diterima di browser, mobile/night/reduced-motion/resume/rollback belum diperiksa akhir, live production telemetry belum disentuh. `PARITY.md` memuat status tiap zona.

## Cara review dan melanjutkan

Baca `STYLE.md`, `SOURCES.md`, `PARITY.md` dan `BROWSER_QA.md`. Instruksi run/rollback ada pada `ROLLBACK.md`. Paket lokal memuat source, build dan patches; manifest menandai `finalArtReady=false` dan `deployed=false`.

Langkah berikutnya setelah akses wajib tersedia: render slice Z08/Prism native, kalibrasi marker dan foot anchors, produksi seluruh art dari immutable map, recompose layers, lalu browser QA termasuk motion dan responsif. Ordinary visual decisions tetap boleh dikerjakan mandiri sesuai instruksi user. Push/deployment tetap membutuhkan instruksi baru.
