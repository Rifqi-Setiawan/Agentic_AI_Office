> **Status handoff 5 Oktober 2026:** paket asli 59 file + ZIP sekarang disimpan byte-identik di repo agar portable. Angka 0/36 di bawah adalah snapshot persiapan awal; terkini tiga input generated, dua registered/installed trial, nol final accepted. F01 menunggu revisi; wall height 80 menghalangi pandangan menurut user dan menjadi P0. Tinggi wall dalam prompt hanya proposal; policy visibility/cutaway harus diperbaiki. [Handoff](../HANDOFF_BRE.md) dan [rencana](../PROJECT_PLAN.md) berlaku untuk lanjutan. Publikasi GitHub diizinkan sekarang; no-push laporan lama bersifat historis.

---

# Lingkungan general kantor dahulu — paket GPT web

User meminta seluruh lingkungan dasar kantor selesai sebelum pekerjaan karakter atau penataan/dekorasi spesifik ruangan. Suasana mengikuti sumber Dot: oak hangat, panel blue-gray, trim charcoal, aksen cyan kecil, kontur ilustrasi bersih dan cahaya kiri atas. Paket memakai sumber tersebut, bukan foto kantor dari internet atau style baru.

[Download ZIP prompt + gambar referensi](../../art/environment-foundation-2026-10-05/office-environment-prompts-20261005.zip) · [Panduan dan daftar prompt](../../art/environment-foundation-2026-10-05/prompt-pack/START_HERE.md) · [Katalog bergambar lokal](../../art/environment-foundation-2026-10-05/prompt-pack/index.html) · [Semua prompt](../../art/environment-foundation-2026-10-05/prompt-pack/ALL_PROMPTS.md).

| Kelompok | Jumlah | Isi |
|---|---:|---|
| F — lantai | 7 | Oak utama/variasi, koridor gray, deck outdoor, tepi platform R/L, sudut platform |
| W — dinding | 10 | Tinggi/rendah, R/L, satu/dua modul, sudut belakang tinggi dan depan rendah |
| P — pilar | 2 | Pilar tinggi dan post rendah untuk sambungan/end terminal |
| D — pintu | 6 | Kusen terbuka tinggi, cutaway rendah, entrance, masing-masing dua arah |
| G — jendela/kaca | 4 | Dua window wall; dua partisi kaca opsional untuk penataan berikutnya |
| J — transisi | 2 | Ambang flush dua arah tanpa menghalangi jalur |
| O — kolam existing | 7 | Air tileable, coping R/L, empat sudut rim; tanpa dekorasi kolam |

Total **38 prompt: 36 inti + dua opsional**. Setiap prompt mandiri, menghasilkan satu PNG, mencantumkan urutan gambar yang perlu diattach dan nama file output. `START_HERE.md` berbahasa Indonesia; spesifikasi prompt memakai bahasa Inggris. `index.html` menampilkan foto pada setiap prompt dan tombol salin lokal; tidak mengirim data atau memanggil layanan online.

Delapan PNG dari tujuh sumber komponen arsitektur + komposisi konteks Z08 disalin byte-for-byte. Dua diagram baru digambar deterministik sebagai **panduan teknis**, bukan artwork game: proyeksi dimetric 2:1 dan denah canonical. Imagegen skill dipakai untuk struktur/constraints prompt; tidak ada panggilan built-in imagegen, CLI/API, Blender atau pembuatan ilustrasi baru pada tahap paket ini. Pengguna akan membuat artwork di GPT web.

Native source floor bukan tile seamless dengan proyeksi terkalibrasi. Prompt menggunakan gambar tersebut hanya untuk material; panduan 2:1 mengendalikan footprint. Begitu pula panjang wall sumber tidak disalin sebagai ukuran modul. Target modul: tile logical 64×32 (128×64 saat packed 2×); wall tinggi 80 dan cutaway 16 logical; frame terbuka height 80/clear height 72. Ini proposal ukuran untuk packing, bukan perubahan collision/denah atau jaminan output GPT memenuhi angka tersebut. Penerimaan artwork tetap memerlukan pengukuran alpha, slope, pivot dan sambungan aktual.

`MAP_COVERAGE.json` berasal dari map aktual: 44×32, 17 zona, 133 slot, 26 pintu, 19 floor GIDs dan sembilan wall GIDs yang dipakai. Material general indoor sementara dapat berbagi oak; theme tiap ruang diputuskan nanti. Daftar wall mengacu pada kandidat family, bukan mapping arah/pivot yang sudah diterapkan. Tidak ada penambahan ruangan, tangga/elevator, atap menutupi interior atau pergeseran pintu. Struktur dasar kolam Z17 termasuk karena sudah berada pada denah; loungers/umbrella/dekorasi ditunda.

**Kondisi sekarang: paket prompt siap, 0/36 artwork inti baru generated dan belum dipasang.** Foundation 100% baru boleh dinyatakan setelah seluruh asset inti diproduksi, dipacking dan mengganti seluruh lantai/wall/portal/struktur lama di 17 zona dan dua koridor; QA harus mencakup seam lantai 3×3, sambungan tinggi/rendah, sudut, pillar, window alpha, seluruh portal, basin perimeter, overlay terang/gelap dan semua jalur. Tidak diperlukan produksi karakter atau per-room furniture untuk menyelesaikan tahap foundation.

Pemeriksaan aktual: 38 prompt unik, 38 nama PNG unik, 36 required/two optional; seluruh referensi ada dan dapat didecode; delapan hash PNG source cocok; seluruh 26 door IDs tercakup; 59 file terpaket dan CRC ZIP lulus. ZIP sekitar 6.5 MB, SHA256 `4e9f58529ac5b1bca358fbe404c032f0f42403d09ce5f3874d36ffceba1e71e8`. Ledger/spec dan hasil pemeriksaan tersimpan di `art/environment-foundation-2026-10-05/`. Builder: `scripts/build_office_environment_prompt_pack.py`.

Tidak ada perubahan source frontend/backend, furniture layout, map, PNG runtime, worker, gateway, VPS atau push/deploy. Pengujian runtime terakhir dari task sebelumnya tetap 307 tes; tidak dijalankan ulang untuk paket prompt ini. Backup tracked source sebelum perubahan dokumentasi: `../Agentic-office-before-environment-foundation-2026-10-05.zip`, SHA256 `88f5cb0d5ced9fefc27a55eedb82d5aaf84fdc24aeea585d205e27ded8717992`.
