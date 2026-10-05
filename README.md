# Agentic AI Office — kantor virtual 2.5D

Kantor virtual untuk melihat operasi multi-agent Hermes secara read-only, dengan HUD, telemetri dan simulasi lingkungan. Pengembangan visual aktif memakai **React/CSS dan ilustrasi 2.5D** bernuansa cozy-tech. Renderer PixiJS dan pipeline Blender lama disimpan sebagai riwayat/pembanding.

## Lanjutkan dari main

**Branch aktif: `main`.** Checkpoint ilustrasi 17 ruang dan perbaikan QA sudah
terpublikasi. Commit `902f57b` lulus [seluruh CI](https://github.com/Rifqi-Setiawan/Agentic_AI_Office/actions/runs/37321653600):
356 tes frontend, 129 tes backend, dan 38 tes Chromium. Branch
`codex/visual-migration-local` kini merupakan sumber handoff historis, bukan
snapshot terbaru.

Untuk membuka scene ilustrasi, gunakan `/?officeRenderer=claude`. Renderer
legacy masih menjadi default sampai review visual/performa lengkap; tidak ada
deploy VPS pada checkpoint ini. Lihat [kandidat 17 ruang](docs/visual-migration/ILLUSTRATED_OFFICE_CANDIDATE.md)
dan [review baseline visual](docs/visual-migration/LEGACY_VISUAL_BASELINE_REVIEW.md).

- [Status, source, cara menjalankan dan batas bukti](docs/HANDOFF_BRE.md)
- [Identitas/peran semua agent, persona, home zone dan availability artwork](docs/AGENT_ROSTER.md)
- [Denah aktual: 17 zona, 133 slot, 26 pintu dan layout Z08](docs/OFFICE_LAYOUT.md)
- [Rencana kerja dan kriteria foundation selesai](docs/PROJECT_PLAN.md)
- [Art bible aktif](docs/visual-migration/ART_BIBLE_2D.md) dan [riwayat migrasi](docs/visual-migration/STATUS.md)

## Catatan handoff sebelum checkpoint — 5 Oktober 2026

Catatan berikut menggambarkan handoff sebelum checkpoint terbaru. Prioritas berikutnya diperluas menjadi lingkungan dan dekorasi fungsional seluruh 17 ruang; karakter tetap tidak menjadi prioritas batch ini. Map canonical 44×32 dengan tile 64×32, dua koridor dan 17 zona tetap. Layout Z08 Dot yang disetujui berisi tiga workstation staf, Guest hotdesk terpisah dan sofa/TV/gaming.

**P0 pada handoff lama: perbaiki dinding yang terlalu tinggi hingga menutup ruangan/jalan lain.** W01/W02 sekarang terpasang untuk trial pada 193 modul; height 80 logical belum final approved. F01 perlu revisi footprint 2:1 dan belum dipasang. Paket foundation memiliki 36 asset inti + 2 opsional; tiga input sudah dikirim, dua installed untuk trial, nol final accepted setelah feedback terbaru. Foundation belum 100%.

Roster Office: 15 AI specialist, Rifqi sebagai Founder manusia dan satu Guest generik. Avatar scene yang tersedia hanya Prism/Forge/Nova, seluruhnya memakai ilustrasi 2.5D tanpa sprite fallback lama. Identitas lainnya tetap disimpan. Roster repository tidak diklaim sebagai registri Hermes live terbaru.

## Preview lokal dari clone

Node.js ≥20 dan npm; tidak memerlukan Blender untuk preview aktif. Di Windows PowerShell:

```powershell
git clone --branch codex/visual-migration-local https://github.com/Rifqi-Setiawan/Agentic_AI_Office.git
Set-Location Agentic_AI_Office/frontend
npm.cmd ci
npm.cmd run dev -- --host 127.0.0.1 --port 5175 --strictPort
```

Buka [preview](http://127.0.0.1:5175/?officeRenderer=claude&seed=42). Pada shell lain gunakan `npm`. Plugin Vite dev/preview menyediakan API/SSE fixture demo; preview tidak membuktikan koneksi Hermes live dan tidak membutuhkan SSH/secret. Pilih room Z08/Z01 lalu refresh penuh. Pembanding sebelum wall: tambahkan `officeArt=dot-v2`; renderer lama: `officeRenderer=legacy`.

Website publik [office.rifqisetiawan.my.id](https://office.rifqisetiawan.my.id/) terpisah dari branch/preview. Handoff ini hanya publikasi GitHub; tidak melakukan deploy atau merge ke main.

## Paket asset/ref yang portable

[Paket ZIP](art/environment-foundation-2026-10-05/office-environment-prompts-20261005.zip), [panduan GPT web](art/environment-foundation-2026-10-05/prompt-pack/START_HERE.md), [semua prompt](art/environment-foundation-2026-10-05/prompt-pack/ALL_PROMPTS.md), dan [katalog bergambar HTML](art/environment-foundation-2026-10-05/prompt-pack/index.html) berada di repo. Download ZIP/folder untuk membuka katalog secara lokal. Paket berisi 59 file, 38 prompt, delapan referensi asli + dua diagram teknis. Dokumen dalam paket adalah snapshot persiapan awal; gunakan status handoff untuk jumlah asset terkini dan feedback wall.

## Struktur

```text
frontend/               React/CSS world aktif, Pixi lama, React HUD, TypeScript/Vite
backend/                FastAPI, reader Hermes/SQLite, normalisasi, proyeksi public/founder, SSE
frontend/public/maps/   Map logical canonical
frontend/public/visual-migration/  Manifest/artwork runtime dan iterasi historis
art/                    Source artwork/provenance, prompt/ref dan pipeline Blender arsip
scripts/                Generator/registrasi/packing/kontrak dan export fakta handoff
docs/                   Handoff, roster, denah, plan, blueprint lama, QA/screenshots
ops/                    Konfigurasi service/proxy, bukan instruksi deploy saat ini
.github/workflows/      CI untuk main/office-v2 dan PR ke keduanya
```

Backend Python ≥3.12/FastAPI; frontend React 18/TypeScript/Vite dengan Zustand. Backend reader dan public/founder projection dijelaskan pada [master architecture](docs/blueprint/01-master-architecture.md). Blueprint awal dilengkapi koreksi/exception yang lebih baru; jangan mengikuti aturan Blender/mirror lama untuk scene aktif.

## Pemeriksaan dan batas tindakan

Checkpoint terbaru memasang lantai terdaftar, dinding cutaway dan furniture
bertema untuk 17 ruang. Browser CI telah memeriksa overview, ground artwork,
identitas tiga kandidat aktor, 17 zona/133 slot/26 pintu, fokus Z08 dan inspector.
Perbandingan legacy memakai baseline yang direview dan tetap menuntut nol pixel
berubah di luar mask HUD yang sudah ada. Review detail tiap ruang, viewport
mobile dan pengukuran performa khusus scene ilustrasi masih terpisah dari hasil
regresi tersebut. Tidak ada klaim seluruh proyek selesai 100%.

Riwayat verifikasi trial sebelumnya:

Pada trial W01/W02: 28 tes terkait scene/map, build (TypeScript + Vite) dan lint lulus. Browser memeriksa Z08/Z01; seluruh 17 zona belum direview. Detail dan screenshot di [laporan wall](docs/visual-migration/FOUNDATION_WALL_INSTALL.md). GitHub CI tidak otomatis memicu push branch handoff; tidak ada klaim CI lulus. Handoff dokumentasi tidak menjalankan ulang seluruh runtime/backend atau Blender.

```powershell
# Dari frontend/
npm.cmd run test -- src/world/scene src/floor1_map.test.ts --maxWorkers=1 --minWorkers=1
npm.cmd run build
npm.cmd run lint
```

User mengizinkan push pekerjaan ini. Belum ada izin merge/deploy, restart task/worker Office produksi atau perubahan gateway Telegram/WhatsApp. Backup sebelum perubahan; jangan publikasikan key/token/password/isi `.env` atau hapus data produksi. Tidak ada akses VPS dalam handoff ini.

## Lisensi

Kode: [MIT](LICENSE). Model pihak ketiga lama dan provenance/lisensi asset ada di [LICENSES.md](LICENSES.md). Artwork user/Dot disimpan dengan source/provenance; jangan menganggapnya otomatis CC0/MIT tanpa dasar lisensi. Author: Muhammad Rifqi Setiawan ([GitHub](https://github.com/Rifqi-Setiawan)).
