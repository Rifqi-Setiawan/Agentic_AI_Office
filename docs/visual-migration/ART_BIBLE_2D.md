# Art bible aktif — ilustrasi 2D isometrik

STYLE_ID: AO_ILLUSTRATED_2D_Z08_V2. Sumber otoritatif: brief user terbaru 5 Oktober 2026 dan koreksi orientasi meja/kursi, bukan instruksi produksi lama.

Gunakan garis kontur bersih, shading 2D terkendali, light oak/honey wood, charcoal, dinding blue-gray dan aksen cyan. Cahaya dari kiri atas layar. Detail harus terbaca pada ukuran penggunaan normal. Prism mengikuti gambar user: silver/cyan hair, cyan headphones, hoodie charcoal dengan spectrum sleeves, cargo trousers/gadget pouches, cyan sneakers. Roster lain mengikuti blueprint asli.

Proyeksi logical tetap: 64×32, origin 1088/64, world 2560×1440. Aset 2× tidak mengubah koordinat. Denah 44×32, 17 zona, 133 slot, 26 pintu dan dua koridor wajib sama. Furniture/karakter merupakan sibling pada satu global depth context, bukan gambar ruang datar. Metadata menyimpan crop, ukuran, anchor, facing, source, hash dan style version.

Produksi aktif menggunakan built-in imagegen lalu packing mekanis. Tidak ada kewajiban Blender, GLB atau jumlah frame tetap. Arsip pipeline/render lama tetap dipertahankan dan tidak dijalankan. Jika imagegen gagal, laporkan; jangan menjadikan placeholder atau Blender pengganti aset final.

Slice pertama hanya Z08 + Prism, termasuk tiga pintu, lantai koridor dan batas zona tetangga. Empat workstation dan dua standing desk mengikuti map. Lantai, meja, kursi, karakter, dinding rendah dan jamb pintu merupakan layer terpisah. Pada workstation SE, meja berada di depan karakter dan kursi di belakang, sesuai arah +gx / screen(+32,+16). Sisi belakang monitor terlihat karena layarnya menghadap karakter di upper-left. Jangan memakai anchor atau potongan horizontal yang membuat kursi berada di atas tabletop. Fungsi/pintu/collision tidak diubah demi gambar; offset presentasi dicatat terpisah. Dinding tidak menutup area kerja overview.

Empat view idle bukan walk cycle. Gerakan kaki perlu pose berbeda, kontak kaki dan loop yang terbaca; jangan menggunakan bobbing sebagai pengganti. Jumlah pose dipilih dari hasil nyata. Kandidat saat ini memiliki dua pose langkah tiap arah; fase kaki berlawanan belum meyakinkan, sehingga loop belum diterima. Semua aksi lain (talk/celebrate/prayer/drink/swim/game/whiteboard/special) tetap dalam cakupan lanjutan. Fallback baseline sementara harus terlihat jelas.

Pisahkan status REFERENCE, CANDIDATE, dan ACCEPTED. File user adalah reference. Hasil imagegen/packing saat ini candidate. Accepted membutuhkan review user; daftar accepted saat ini kosong. Dokumentasikan sumber tanpa menganggap gambar user otomatis MIT/CC0.

Checkpoint harus berisi screenshot browser overview/detail dan video jika akses tersedia, contact sheets serta masalah tersisa. Offline composition/concept/contact sheet tidak boleh disebut QA browser. Berhenti sebelum produksi seluruh 17 zona sampai user menyetujui gaya.
