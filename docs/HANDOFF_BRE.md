# Handoff Bre — Agentic AI Office, 5 Oktober 2026

## Pembaruan setelah publikasi

Gunakan **`main`** untuk pekerjaan berikutnya. Checkpoint 17 ruang dan perbaikan
QA pada `902f57b` telah lulus [CI lengkap](https://github.com/Rifqi-Setiawan/Agentic_AI_Office/actions/runs/37321653600).
Scene ilustrasi tersedia melalui `/?officeRenderer=claude`; legacy tetap default.
Lingkungan dan dekorasi fungsional 17 ruang sudah terintegrasi sebagai kandidat,
dengan review detail/performa masih berlangsung. Tidak ada deploy VPS.
Lihat [README terkini](../README.md) dan [kandidat kantor](visual-migration/ILLUSTRATED_OFFICE_CANDIDATE.md).

## Handoff historis sebelum publikasi

Bagian di bawah merekam keadaan sebelum checkpoint terbaru; arahan branch dan
urutan prioritas lamanya tidak menggantikan pembaruan di atas.

## Mulai di sini (historis)

Lanjutkan branch **`codex/visual-migration-local`**. Kondisi sebelum handoff: commit `4643b6c` (trial W01/W02). Handoff ini menyertakan seluruh source, runtime artwork, source intake, prompt dan referensi, screenshot, dokumentasi, serta perubahan pipeline Blender lokal yang sebelumnya belum di-commit. Jangan mulai ulang dari `main`: migrasi visual ada di branch ini.

**Prioritas user adalah lingkungan general seluruh kantor sampai selesai; karakter, dekorasi dan penataan tiap ruang ditunda.** Feedback terbaru: dinding tinggi menghalangi ruangan lain, jalan dan interior. Tangani keterbacaan dinding sebagai **P0** sebelum memperluas pemasangan. Tinggi 80 logical pada trial sekarang bukan desain final yang disetujui. User meminta publikasi pekerjaan ke GitHub agar Bre melanjutkan; pada tahap handoff ini tinggi dinding belum diubah lagi.

Urutan bacaan: [rencana dan kriteria selesai](PROJECT_PLAN.md), [denah aktual](OFFICE_LAYOUT.md), [identitas dan peran agen](AGENT_ROSTER.md), [art bible](visual-migration/ART_BIBLE_2D.md), [status dan riwayat](visual-migration/STATUS.md). Jika riwayat menyebut “no push”, fallback lama, Blender wajib, mirror karakter, browser terblokir atau slice gate Z08, itu kondisi pada tahap lama. Instruksi terbaru dan dokumen handoff ini berlaku untuk pekerjaan berikutnya.

## Keadaan nyata

| Bagian | Sudah tersedia | Belum selesai |
| --- | --- | --- |
| Aplikasi | React/CSS world aktif, HUD, kamera, simulasi/navigasi; renderer Pixi lama tetap tersedia sebagai pembanding | QA lengkap setelah seluruh fondasi baru dipasang |
| Denah | Map 44×32, tile 64×32, 17 zona, 133 slot, 26 pintu, dua koridor | Tidak ada izin merombak batas ruang/pintu/konsep |
| Z08 | Tiga workstation Prism/Forge/Nova, hotdesk Guest terpisah, sofa/TV dan dua slot gaming; 22 komponen Dot dipasang | Dekorasi dan layout lanjutan menunggu tahap berikutnya |
| Foundation | Paket 38 prompt (36 inti + dua kaca opsional); tiga artwork dikirim; W01/W02 terdaftar dan terpasang untuk trial | P0 occlusion dinding, revisi F01, 33 artwork inti lain belum dikirim, semua seam/join dan QA 17 zona |
| Karakter | Prism, Forge, Nova tampil hanya dengan atlas ilustrasi 2.5D, tanpa fallback sprite lama | Forge belum walk; motion/action lanjutan dan karakter lain ditunda |
| Bukti | Screenshot browser Z08/Z01 dan hasil pemeriksaan teknis tersimpan | Tidak ada bukti seluruh 17 zona lolos review visual |
| Produksi | Tidak diubah dalam handoff ini | Tidak ada merge, deploy, restart worker atau perubahan gateway |

**Foundation belum 100%.** Tiga input artwork bukan tiga asset final approved. Dua wall terpasang bukan persetujuan atas tinggi dinding atau keseluruhan kantor. Kriteria selesai memerlukan seluruh kelompok struktur terpasang dan lolos pemeriksaan; paket prompt tidak memenuhi kriteria itu sendiri.

## Menjalankan preview setelah clone

Node.js ≥20; gunakan lockfile. Dari terminal lokal:

```powershell
git clone --branch codex/visual-migration-local https://github.com/Rifqi-Setiawan/Agentic_AI_Office.git
Set-Location Agentic_AI_Office/frontend
npm.cmd ci
npm.cmd run dev -- --host 127.0.0.1 --port 5175 --strictPort
```

Buka `http://127.0.0.1:5175/?officeRenderer=claude&seed=42`, refresh penuh, lalu pilih Z08 atau Z01. Di shell selain Windows gunakan `npm`, bukan `npm.cmd`. Bila port sudah dipakai preview lama, gunakan proses yang ada atau port lokal lain; jangan menghentikan service produksi.

`frontend/vite.config.ts` memasang `mockOfficeApiPlugin()` untuk dev/preview. REST dan SSE pada preview berasal dari fixture demo lokal, tanpa kebutuhan kredensial VPS atau flag `VITE_MOCK_API`. Ini tidak membuktikan koneksi Hermes live. `npm run build` menghasilkan `frontend/dist`; runtime produksi memerlukan backend/proxy yang benar dan tidak mendapat fixture plugin Vite.

Default manifest: `AO_DOT_ENVIRONMENT_FOUNDATION_V1`. Pembanding pada URL yang sama: `officeArt=dot-v2` (sebelum trial wall), `officeArt=dot-v1`, `officeArt=previous`, `officeArt=baseline`. `officeRenderer=legacy` memilih renderer lama. Jangan menjadikan atlas karakter legacy sebagai fallback pada scene aktif.

## Source yang perlu disentuh

- [Map canonical](../frontend/public/maps/floor1.tmj) dan [generator map](../scripts/generate_floor1_map.py): slot, door, collision, bounds. SHA map saat handoff `9a9bc468e345658b349923f4ae8dc696397bb929c69688b350ee74e6b610ef0e`.
- [Manifest aktif](../frontend/public/visual-migration/environment-foundation-v1/assets.json), [registrasi wall](../scripts/register_office_foundation_walls.py), [ledger wall](../frontend/public/visual-migration/environment-foundation-v1/registration-ledger.json): 193 wall modules / 844 clipped affine planes. W01=74/R, W02=119/L. PNG source byte-identik; height 80 hanya trial.
- [OfficeScene](../frontend/src/world/scene/OfficeScene.tsx), [SceneSprites](../frontend/src/world/scene/SceneSprites.tsx), [scene CSS](../frontend/src/world/scene/scene.css), [kamera](../frontend/src/world/scene/SceneCamera.ts), [asset registry](../frontend/src/world/scene/AssetRegistry.ts): rendering, depth, art selection dan occlusion presentation.
- [ActorRoster](../frontend/src/world/scene/ActorRoster.ts), [roster logis](../frontend/src/world/simulation/roster.ts), [profil statis](../backend/src/office/sources/profiles.py): identitas berbeda dari ketersediaan artwork; jangan menghapus profile karena avatar disembunyikan.
- [Blueprint awal](blueprint/README.md) dan [kontrak migrasi](../scripts/visual_migration_contract.py): landasan arsitektur lama; perubahan yang disetujui user lebih baru dicatat pada [approved-layout-adjustments.json](visual-migration/approved-layout-adjustments.json).

## Artwork dan prompt siap dipindahkan

Paket berada **di repo**: [START_HERE](../art/environment-foundation-2026-10-05/prompt-pack/START_HERE.md), [semua prompt](../art/environment-foundation-2026-10-05/prompt-pack/ALL_PROMPTS.md), [katalog HTML](../art/environment-foundation-2026-10-05/prompt-pack/index.html), [ZIP](../art/environment-foundation-2026-10-05/office-environment-prompts-20261005.zip). Download folder/ZIP lalu buka HTML secara lokal untuk tombol salin dan referensi. SHA ZIP: `4e9f58529ac5b1bca358fbe404c032f0f42403d09ce5f3874d36ffceba1e71e8`; 59 file disalin byte-identik, CRC diperiksa. Bre tidak perlu mengakses Downloads laptop Rifqi.

Paket awal tetap snapshot persiapan, sehingga angka 0/36 di dalamnya bersifat historis. Angka terkini: **3 input generated, 2 registered/installed untuk trial, 0 final accepted** setelah feedback dinding terbaru. Prompt high wall 80/cutaway 16 adalah proposal ukuran, bukan mandat memakai high wall di semua partisi internal. Foundation umum mempertahankan oak hangat, panel blue-gray, trim charcoal, aksen cyan kecil, garis ilustrasi bersih dan cahaya kiri atas layar.

F01 ada di [intake](../art/environment-foundation-2026-10-05/intake/F01-r01/) beserta hasil alpha/geometri dan prompt revisi. Dominant footprint 1133×740, rasio 1.5311:1; target 2:1. Belum dipasang; lantai existing tetap dipakai. [Laporan F01](visual-migration/F01_FLOOR_INTAKE.md).

W01/W02 ada di [intake source](../art/environment-foundation-2026-10-05/intake/W01-W02-r01/) dan folder manifest runtime; jangan mengganti sumber tanpa provenance. [Laporan trial dan screenshot](visual-migration/FOUNDATION_WALL_INSTALL.md). Sudut, pilar, window, portal dan low wall masih versi sebelumnya; sambungan material/tinggi belum seragam.

Sumber lama, iterasi gagal, raw intake dan pipeline Blender disimpan sebagai provenance/arsip. **Blender bukan jalur produksi aktif**; jangan memulai batch karakter, render ulang otomatis atau mengganti ilustrasi dengan Quaternius. Empat script Blender yang ikut handoff hanya diparse untuk validasi sintaks, tanpa impor `bpy` atau render; log kalibrasi dan [HANDOFF_DOT](visual-migration/HANDOFF_DOT.md) adalah riwayat, bukan hasil baru.

## Verifikasi dan batas bukti

Pemeriksaan pada commit trial W01/W02: **28 tes / tujuh file** terkait scene dan map lulus, TypeScript+Vite build dan ESLint lulus. Build memiliki warning ukuran vendor Pixi chunk. Browser aktual memeriksa Z08 dan Z01, tiga actor tetap memakai atlas ilustrasi, tanpa error/overlay yang tercatat; seluruh 17 zona belum direview. [Installation check](visual-migration/evidence/foundation-walls-2026-10-05/installation-check.json), [browser check](visual-migration/evidence/foundation-walls-2026-10-05/browser-check.json), [Z08](visual-migration/evidence/foundation-walls-2026-10-05/z08-browser.jpg), [Z01](visual-migration/evidence/foundation-walls-2026-10-05/z01-browser.jpg). Feedback user setelah trial tetap menjadi masalah visual terbuka meskipun tes teknis lulus.

Suite penuh pada tahap konsistensi karakter sebelumnya: 307 tes /44 file; ini bukti tahap sebelumnya, bukan klaim suite penuh diulang untuk handoff dokumentasi. Untuk perubahan runtime berikutnya:

```powershell
# Dari frontend/
npm.cmd run test -- src/world/scene src/floor1_map.test.ts --maxWorkers=1 --minWorkers=1
npm.cmd run build
npm.cmd run lint
# Suite penuh jika perubahan menyentuh perilaku lintas modul
npm.cmd run test -- --maxWorkers=1 --minWorkers=1
```

Backend tidak diuji ulang dan live Hermes tidak diaudit dalam handoff ini. CI GitHub hanya memicu push `main`/`office-v2` atau PR ke keduanya; push ke branch handoff tidak otomatis menjalankan CI. Tidak ada klaim GitHub CI lulus atau website publik sudah diperbarui. [Audit sebelum publikasi](visual-migration/evidence/github-handoff-2026-10-05/prepublication-check.json) mencatat 79 link relatif yang valid, hash source fakta, sintaks lima script Python tanpa render, scan 534 file teks working tree dan 288 blob teks pada riwayat yang belum dipush tanpa temuan kredensial berkeyakinan tinggi, dan pemeriksaan paket byte-identik/CRC. `.gitattributes` mempertahankan byte prompt package agar hash manifest tidak berubah saat checkout Windows/Linux.

## Batas tindakan dan blocker

Instruksi user terbaru mengizinkan push pekerjaan ini ke GitHub. Belum ada izin merge/deploy atau mengaktifkan worker/task produksi. Backup file sebelum perubahan, jangan menghapus data produksi, jangan menampilkan private key/token/password/isi `.env`, jangan menghentikan gateway Telegram/WhatsApp. Pekerjaan visual lokal ini tidak menghidupkan otomatis task Office di VPS yang sebelumnya dijeda. Handoff tidak melakukan SSH dan tidak membutuhkan akses VPS.

Backup working tree sebelum handoff, termasuk file dirty/untracked nonignored: `Agentic-office-before-github-handoff-4643b6c-2026-10-05.zip`, 1107 file, 118379980 byte, SHA256 `4fff0e75646e06bec0a39d786e8247637fcdc1e379ff4d0e51b16956f120bdda`; CRC lulus. Backup berada di workspace lokal di luar repo, bukan dependency untuk clone berikutnya. `.env`, key, dependencies, build/cache dan backup tidak dipublikasikan.

Blocker produksi artwork: F01 perlu hasil revisi user; 33 artwork inti lain belum dikirim. Lanjutkan pekerjaan yang independen: P0 wall readability dengan sumber existing, inventaris coverage, registrasi material, pemeriksaan portal/path dan persiapan QA. Jangan menyatakan final 100% dengan placeholder.

Ada dua ketidaksesuaian data yang perlu diketahui: Nova disebut Ops & Automation pada roster scene tetapi Junior Systems Engineer/The Pathfinder pada metadata backend; default slot Rifqi `slot_z14_lounge_1` tidak ada di map saat ini (fallback roster `(14,28)` tersedia). Catat untuk tahap identitas/simulasi berikutnya; jangan merombak karakter/slot saat foundation tanpa kebutuhan dan izin yang sesuai.

## Instruksi pembuka untuk Bre

> Baca docs/HANDOFF_BRE.md, docs/PROJECT_PLAN.md, docs/OFFICE_LAYOUT.md dan docs/AGENT_ROSTER.md pada branch codex/visual-migration-local. Lanjutkan perubahan yang ada. Fokus lingkungan general kantor dahulu. Mulai P0: wall cutaway/visibility agar ruangan dan jalan terlihat, pertahankan map dan layout Z08 yang disetujui. Gunakan prompt/ref yang sudah di repo untuk artwork berikutnya; catat input yang belum tersedia. Jangan lanjutkan karakter/dekorasi, jangan merge/deploy atau mengaktifkan Office/gateway produksi. Periksa hasil nyata di browser dan laporkan batas QA.
