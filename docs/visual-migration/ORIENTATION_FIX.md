# Koreksi meja/kursi Z08 — 5 Oktober 2026

Kandidat v1 ditolak user: kursi tampak berada di atas meja dan meja tidak mengikuti arah duduk Prism. Kandidat v2 mengganti gambar meja dan penempatan visual empat workstation. Ini koreksi lokal untuk checkpoint Z08, belum persetujuan gaya atau migrasi seluruh kantor.

Dalam navigasi proyek, timur/SE adalah +gx, diproyeksikan ke layar (+32,+16). Meja sekarang mempunyai working edge di sisi upper-left, keyboard di depan Prism, dan monitor lebih jauh ke lower-right. Monitor menghadap Prism sehingga sisi belakang monitor terlihat dari kamera. Kursi menghadap SE dan berada di belakang slot; urutan gambar global adalah kursi, karakter, meja. Potongan horizontal v1 yang membuat kursi terlihat di atas meja tidak dipakai untuk empat workstation v2.

Semua source furniture IDs dan koordinat logical tetap. Penempatan gambar memakai `visualGridAnchor` terpisah: meja pada slot gx +0.95, kursi pada gx -0.35. Ini offset presentasi, bukan perpindahan collision/slot. Desk raster 168 px, logical width 84 px, selalu diskalakan seragam. Empat bidang tabletop memiliki celah sekitar 2.63 logical px berdasarkan empat landmark yang ditandai pada sumber ilustrasi; silhouette monitor/tanaman tetap mengikuti occlusion perspektif.

Preview aktif: http://127.0.0.1:5175/?officeRenderer=claude&seed=42. Refresh penuh dan pilih Z08 Dev Pods. Route default kini membaca `illustrated-z08-v2/assets.json`. `officeArt=baseline` tetap menyediakan pembanding lama. Vite lokal dihidupkan kembali karena port 5175 sempat tidak listening.

## Hasil nyata dan bukti

- Built-in imagegen menghasilkan dua iterasi meja; iterasi compact dipilih dengan kedua gambar referensi asli user. Sumber, hash dan prompt disimpan dalam [source-index](../../art/illustrated-z08-v2/source-index.json), [prompt orientasi](../../art/illustrated-z08-v2/prompts.json), dan [prompt terpilih](../../art/illustrated-z08-v2/compact-prompt.json).
- [Detail empat workstation](evidence/illustrated-z08-v2/workstations-detail.png), [Z08 ukuran logical](evidence/illustrated-z08-v2/offline-z08-normal.png), [overview](evidence/illustrated-z08-v2/offline-overview.png), dan [dua pose duduk pada latar terang/gelap](evidence/illustrated-z08-v2/se-workstation-light-dark.png) benar-benar dikomposisi dan dilihat. Seluruhnya OFFLINE, bukan screenshot browser.
- Packing/resource/bounds/facing/depth checks lulus: empat meja/kursi SE, kursi di belakang slot, meja di depan slot; 530 global prop pieces. [asset-check.json](evidence/illustrated-z08-v2/asset-check.json) dan [orientation-check.json](evidence/illustrated-z08-v2/orientation-check.json).
- Kontrak map differences kosong: 44×32, 17 zona, 133 slot, 26 pintu, collision dan dua koridor tetap. SHA256 `765fdd8c1185fb79ba64050251267c3a8acc4c8997759ce8a2c1a2773fc03a67`. Diff backend/ops/navigation/store/SSE terhadap baseline kosong.
- `npm run build` termasuk TypeScript lulus; Vite build 14.24 detik. Warning chunk legacy Pixi 667.01 kB tetap ada. `npm run lint` lulus; empat tes IllustratedAssets lulus. Log ada dalam evidence v2. Hasil 291 tes tahap v1 merupakan pemeriksaan sebelumnya, bukan run baru pada koreksi ini.

QA browser tetap BELUM: tool terakhir menolak binding tab dengan alasan “URL protocol policy blocks the tab”. Tidak ada perubahan akses atau bypass; tidak ada screenshot/video browser baru. Gerakan melalui meja/pintu dan transisi duduk masih perlu review runtime. Walk dua pose belum merupakan cycle yang diterima, dan ruang/aksi/agent lain tetap baseline/pending.

Backup sebelum edit: `../Agentic-office-before-seat-orientation-2026-10-05.zip`, SHA256 `45faf53eb94abbcad9e4f5548e0f7535fd8084fb68547cf5fd348126c8109359`. v1, perubahan Blender lama, dan arsip tetap dipertahankan. Reproduksi packing: `python scripts/prepare_illustrated_z08.py --orientation-fix` dengan Pillow tersedia. Tanpa flag menghasilkan varian v1.

Tidak ada push, merge, deploy, perubahan VPS atau gateway. Produksi tetap dijeda. Batch 17 zona tetap menunggu persetujuan gaya user.
