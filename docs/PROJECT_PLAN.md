# Rencana lanjutan — lingkungan general kantor

Rencana ini mengikuti instruksi Rifqi terbaru pada 5 Oktober 2026: fondasi lingkungan seluruh kantor selesai dahulu; dekorasi, penataan per ruang dan karakter dibahas kemudian. [Handoff](HANDOFF_BRE.md) memuat cara menjalankan dan source. Kondisi sekarang belum 100% dan tidak memiliki persentase total yang tervalidasi.

## P0 — Ruangan dan jalur harus terlihat

Trial W01/W02 memasang 193 modul wall tinggi 80 logical. User menilai tinggi itu menutupi ruangan dan jalan lain. Jangan memperbanyak pola tersebut tanpa menyelesaikan keterbacaan overview.

1. Ambil screenshot overview seluruh kantor dan detail sisi Z08/Z01 serta kedua koridor pada kamera/zoom normal.
2. Bedakan boundary luar di belakang layar, partisi internal, dan sisi depan. Uji low/cutaway untuk partisi yang menutupi ruangan tetangga; high wall hanya pada sisi yang tidak menghalangi keterbacaan. Bila perlu uji camera-aware hide/fade, tanpa membuat collision berubah.
3. Daftarkan policy visual di manifest/ledger, dengan tinggi, pivot, depth dan alasan pemilihan tiap kelompok. Height 80/cutaway 16 dalam paket prompt hanya proposal awal; dapat disesuaikan untuk memenuhi feedback user.
4. Pastikan room boundaries tetap terbaca, pintu/koridor terbuka dan artwork wall tidak berubah menjadi lantai atau overlap furniture. Jangan mengubah 17 zona, 26 pintu atau layout Z08 yang disetujui untuk menyelesaikan masalah presentasi.

Gate P0: di overview dan detail, semua jalur koridor serta interior aktif dapat ditemukan; tidak ada high wall di foreground yang menutup deret ruang berikutnya. Simpan screenshot browser nyata sebelum/sesudah, daftar zona diperiksa dan masalah tersisa. Tes affine/slope yang lulus tidak menggantikan gate visual ini.

## P1 — Asset general dan integrasi lengkap

| Kelompok | Jumlah prompt | Status input sekarang | Pekerjaan berikutnya |
| --- | ---: | --- | --- |
| F lantai/platform | 7 | F01 r01 perlu revisi, belum installed | Oak seamless 2:1, variasi, corridor gray, outdoor deck, tepi/sudut platform |
| W wall/cutaway/corner | 10 | W01/W02 trial installed, visibility pending | Selesaikan P0; low/high dua arah, panjang modul, corner yang menyambung |
| P pilar/post | 2 | Belum dikirim | Sambungan/end terminal tanpa menutup jalan |
| D portal/entrance | 6 | Belum dikirim | Kusen terbuka dan cutaway dua arah; pintu entrance sesuai map |
| G window/glass | 4 | Belum dikirim | Dua window wall inti; dua glass partitions opsional dan ditunda jika terkait layout |
| J ambang | 2 | Belum dikirim | Flush threshold dua arah, passable |
| O struktur kolam | 7 | Belum dikirim | Air, coping, empat corner, cocok dengan Z17 existing |

36 asset inti + dua opsional; tiga input generated = W01, W02, F01. Dua registered/installed untuk trial. **Tidak ada final accepted foundation asset pada handoff ini**. Selain revisi F01, 33 artwork inti belum tersedia. Alur produksi saat ini: Rifqi generate di GPT web memakai [paket prompt/ref](../art/environment-foundation-2026-10-05/prompt-pack/START_HERE.md), lalu intake/ukur/register/QA. Jangan menganggap artwork yang belum dikirim sudah dibuat.

Untuk tiap asset: simpan source tanpa menimpa, catat SHA dan provenance, pastikan alpha dan perspektif 2:1, tentukan footprint/pivot/scale, uji join di lingkungan nyata lalu integrasikan. Revisi prompt bila output salah geometri. Pertahankan palet dan cahaya Dot. Material general boleh shared antar-room sementara; theme/dekorasi final tiap ruang ditunda.

## P2 — Gate “foundation 100%”

- Semua lantai/struktur inti pada 17 zona dan dua koridor memakai asset yang sesuai; coverage dicatat, sumber struktur lama yang tersisa dijelaskan.
- Floor tiling 3×3 tanpa celah/bleed, arah dan seam konsisten, edge platform menyambung.
- Sambungan high/low wall, corner, pillar, window alpha, cap/end tidak bocor atau saling timpa; P0 readability tetap terpenuhi.
- Semua 26 door IDs dan jalur yang seharusnya dapat dilewati tetap berfungsi; map bounds, slot capacity/facing, collision dan approved exceptions diverifikasi.
- Z17 air/coping/corner menjadi struktur kolam yang terbaca; bukan solid polygon yang menghapus footprint lantai.
- Review browser overview + tiap 17 zona pada siang/senja/malam serta zoom normal/detail; label semua screenshot/video sesuai bukti nyata. Catat console/load/performance dan risiko 844 plane trial jika masih dipakai.
- Tes scene/map yang relevan, build/typecheck dan lint lulus. Ulang suite lebih luas bila perubahan behavior lintas modul membutuhkannya.
- Laporkan remaining=0 untuk **foundation** setelah semua kriteria selesai. Karakter/action/furniture/dekorasi bukan syarat persentase foundation, tetapi jangan mengklaim seluruh proyek selesai.

## P3 — Setelah foundation diterima

Rifqi akan menentukan dekorasi dan tata letak tiap ruang. Kemudian lanjutkan karakter: identitas stabil, empat arah asli, walk/typing/action yang belum ada, tanpa legacy fallback. Sinkronkan nama/peran Nova dan default slot Rifqi pada tahap yang tepat. Roster profil/telemetri tidak dihapus hanya karena avatar belum ada. Deployment memerlukan instruksi lanjut; push GitHub sekarang tidak memberi izin merge/deploy/worker produksi.

## Blocker dan pekerjaan independen

Artwork belum dikirim dan F01 revision adalah blocker final art. Akses browser, runtime atau persetujuan wajib yang belum ada harus dicatat dengan bukti; lanjutkan source/registrasi/QA yang independen. P0 dapat dikerjakan lokal dari W01/W02 dan low wall existing. Tidak perlu akses SSH untuk tahap foundation lokal. Simpan backup sebelum setiap perubahan berisiko; gateway dan data produksi harus tetap aman.
