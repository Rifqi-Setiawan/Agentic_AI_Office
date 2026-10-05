# W01/W02 dipasang sebagai trial lokal

User meminta W01/W02 dari dua PNG yang dikirim dipasang dahulu, sambil merevisi F01 di GPT web. Default preview sekarang memakai `AO_DOT_ENVIRONMENT_FOUNDATION_V1`: [preview lokal](http://127.0.0.1:5175/?officeRenderer=claude&seed=42). Refresh browser, lalu pilih Z08 untuk melihat hasil. Snapshot sebelumnya tetap dapat dibuka dengan `officeArt=dot-v2`.

W01 berasal dari `C:/Users/Rifqi/Downloads/Isometric Blue-Gray Wall Panel.png`, SHA256 `06632980c1b25b6aaa4b1f852cf9308f64f022e0d80e54d9fc5602eb81212011`. W02 berasal dari `C:/Users/Rifqi/Downloads/Isometric Blue-Gray Wall Panel (1).png`, SHA256 `40d030e2706d148f4898f537b81b7a277fe2fd4f46a93b5fb8e8e40cd3f2c4c9`. File asli disimpan di `art/environment-foundation-2026-10-05/intake/W01-W02-r01/`; PNG runtime adalah salinan byte-identik.

193 modul dinding tinggi memakai aset ini: **74 W01/R + 119 W02/L**. 179 segmen lurus berasal dari props dinding tinggi canonical; tiga panel panjang Z08 sebelumnya direpresentasikan ulang menjadi 14 modul, termasuk dua modul setengah panjang. Grup depth dinding Z08 dipertahankan agar board/shelf tetap di depan. Panel utara Z08 dibatasi pada rentang gx 19.5–23.5 di gy 9.5 agar tidak melampaui jamb pintu utara dan sudut zona. Ini registrasi grafis; map/collision/slot/door dan konsep ruang tidak berubah.

Native proportions tidak langsung dijadikan ukuran dunia. Front face, top cap dan end face memakai sumber pixel dari PNG yang sama, dengan CSS clip dan transform affine dua dimensi. Triangulasi mendaftarkan empat corner tiap plane ke ground slope ±0.5, tinggi 80 logical dan cap offset empat pixel horizontal/dua vertikal. Overlap internal 0.35 pixel dan clip silhouette menghindari garis putih pada diagonal. Ada 844 layer kecil di 193 prop; browser mengunduh hanya dua file sumber baru yang dipakai ulang. PNG tidak dicrop, dicat, di-resize, dicerminkan atau digenerate ulang. Trial belum dianggap final art.

Manifest baru disimpan di `frontend/public/visual-migration/environment-foundation-v1/`; snapshot Dot v2, floor, semua actor atlas, furniture, dekorasi, cutaway wall, corner, window dan portal art tetap sama. Map SHA256 tetap `9a9bc468e345658b349923f4ae8dc696397bb929c69688b350ee74e6b610ef0e`, 44×32, 17 zona, 133 slot, 26 pintu. Builder JSON/registrasi: `scripts/register_office_foundation_walls.py`. Hasil registrasi dan sumber tercatat di `registration-ledger.json` dan `source-index.json`.

Pemeriksaan aktual:

- 28 tes / tujuh file lulus: suite scene terkait dan kontrak floor map. Tiga tes baru memverifikasi pelestarian props/logical map, hash PNG sumber, matriks tanpa reflection dan seluruh corner registrasi.
- `npm run build` (TypeScript + Vite) dan `npm run lint` lulus. Build tetap memberi warning ukuran chunk vendor Pixi; tidak ada error build.
- Browser aktual pada tab preview menunjukkan 74 W01, 119 W02, 844 plane, floor berhasil dimuat, tiga actor tetap Prism/Forge/Nova, tanpa scene/Vite overlay error atau warning/error log yang tercatat.
- Z08 dan Z01 diperiksa visual setelah perbaikan transform. Screenshot aktual: [Z08](evidence/foundation-walls-2026-10-05/z08-browser.jpg), [Z01](evidence/foundation-walls-2026-10-05/z01-browser.jpg). [Browser check](evidence/foundation-walls-2026-10-05/browser-check.json). Seluruh 17 zona belum diperiksa satu per satu secara visual; metadata tidak menyatakan sebaliknya.

Kusen, jendela, sudut, pilar dan dinding cutaway masih sumber sebelumnya, sehingga tinggi/material sambungan belum seragam. F01 r01 tetap menunggu revisi 2:1; lantai lama masih dipakai. Status inti: **3/36 asset hasil generated telah diterima sebagai input; 2/36 terdaftar dan dipasang untuk trial lokal; F01 belum accepted**. 33 inti belum dikirim, ditambah revisi F01. Ini bukan foundation 100% atau persetujuan final seluruh lingkungan.

Backup tracked source sebelum perubahan: `../Agentic-office-before-wall-install-8232ef6-2026-10-05.zip`; hash dan pemeriksaan tercatat dalam [installation-check.json](evidence/foundation-walls-2026-10-05/installation-check.json). Tidak ada push/deploy, akses VPS, worker, gateway atau perubahan backend. Pekerjaan karakter dan dekorasi/layout tidak dilanjutkan. Perubahan Blender lokal yang sudah ada tetap dipertahankan dan tidak disertakan dalam commit ini.
