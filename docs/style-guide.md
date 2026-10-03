# Office v2 Master Style Guide & Gate Visual Spike (v0.1)

**Fase:** 0 (Gate Visual Spike) | **Fitur:** F07, F08 | **Author:** Muse (Principal UI/UX & Design Engineer)  
**Spec Acuan:** `docs/blueprint/01-master-architecture.md`, `docs/blueprint/03-character-design-spec.md`, `docs/blueprint/04-environment-room-spec.md`  
**Waktu & Standar:** Asia/Jakarta (WIB) | Anti-AI-Slop Standard | 100% Read-Only Zero-Write ke Hermes

---

## 1. Ringkasan Eksekutif & Keputusan Resmi Gate Visual Spike (T0.4)

Berdasarkan hasil visual spike pada Task T0.4 (pipeline Blender headless `art/pipeline/render.py`, kuantisasi 32 warna, packing atlas PixiJS, dan halaman uji PixiJS v8 pada commit `828cf5f`), Muse selaku Principal UI/UX & Design Engineer menetapkan keputusan resmi:

### **KEPUTUSAN: GO DENGAN REVISI TERARAH (APPROVED WITH DIRECTED REVISIONS)**

```
┌────────────────────────────────────────────────────────────────────────┐
│  VERDIKT: GO DENGAN REVISI (APPROVED WITH CONDITIONS)                 │
│  Pipeline Procedural Blender Headless DILANJUTKAN ke Fase 1 Produksi   │
│  Opsi FALLBACK (Paket Komersial) DITOLAK KERAS SECARA ARSITEKTURAL     │
└────────────────────────────────────────────────────────────────────────┘
```

### 1.1. Evaluasi Komprehensif Hasil Spike T0.4

1. **Keunggulan Teknis & Visual (PASS):**
   - **Kecepatan Render Headless:** Total render hanya **1,48 detik** (~1,19s karakter 4 animasi + 0,3s 3 furnitur Kenney) pada resolusi pixel-art. Sangat ringan untuk otomasi build dan asset pipeline.
   - **Presisi Proyeksi Dimetrik 2:1:** Kamera ortografis Blender (Rotasi X=60°, Z=45°) selaras sempurna dengan grid ubin isometrik 64×32 px tanpa distorsi geometri.
   - **Kualitas Integer Scaling (Anti-Blur):** Uji pada skala 1x, 2x (spec default), 3x, dan 4x dengan interpolasi *nearest-neighbor* menghasilkan rendering yang tajam, tanpa artefak *subpixel shimmer* atau *bilinear blurring*.
   - **Performa Engine 60 FPS:** Testbed PixiJS v8.22 berjalan stabil pada 60 FPS tanpa memory leak pada siklus patroli karakter di atas furnitur.

2. **Kekurangan & Cacat Visual Teridentifikasi (REVISI WAJIB):**
   - **Isu Kontras Figur-Lantai (Figure-Ground Separation):** Karakter Bastion (`#6B7785`) dan pakaian gelap berbaur dengan ubin lantai slate (`#475069`) pada pencahayaan dasar, akibat kemiripan nilai luminansi relatif.
   - **Kelengkapan Palet:** Palet sementara pada T0.4 hanya memuat token uji untuk Bastion dan furnitur kayu, belum mencakup ke-16 warna khas agent sesuai Blueprint Bagian 3.
   - **Detail Fitur Wajah/Helm:** Helm karakter pada T0.4 berbentuk kubah polos (egg shape) tanpa aksen visor atau kluster mata 2-pixel, sehingga tampak seperti manekin anonim.

3. **Alasan Penolakan Opsi FALLBACK (Paket Pixel-Art Komersial):**
   - **Ketiadaan 16 Persona Khas Hermes:** Tidak ada paket komersial publik yang menyediakan figur spesifik seperti Merlin bertongkat kilau, Oracle berjas lab & goggles, Scribe berhijab & kacamata rantai, atau Rifqi berhoodie krem dengan mahkota emas melayang.
   - **Ketiadaan Animasi Khusus Sholat & Budaya:** Paket komersial tidak memiliki rangkaian animasi ibadah sholat berjamaah (berdiri, rukuk, sujud, duduk) yang menjadi fitur inti spec Musholla Z16.
   - **Fleksibilitas Prop & Furnitur Lab:** Aset teknologi spesifik (rak server LED dinamis, meja blueprint arsitek, konveyor rilis GitHub) harus seragam secara sudut pandang dan palet warna.
   - **Lisensi Publik & Kebebasan Modifikasi:** Pipeline procedural Blender berbasis model CC0 (Quaternius & Kenney) memberikan kebebasan legal penuh 100% tanpa risiko pelanggaran hak cipta untuk deployment web publik.

---

## 2. Master Palette 32 Warna (Official Specification)

Palet master ditetapkan **tepat 32 warna** (`#00` s.d. `#31`). Tidak ada warna redundan; setiap indeks warna memegang peran struktural ganda (identitas agen sekaligus aksen arsitektur/furnitur).

File sumber palet resmi:
- JSON: `art/pipeline/palette.json`
- GIMP / Aseprite GPL: `art/pipeline/palette.gpl`

### Tabel Palet Master 32 Warna

| Indeks | Nama Token | HEX | RGB | Kategori | Peran Fungsional Utama |
| :---: | :--- | :---: | :---: | :--- | :--- |
| `#00` | Outline Charcoal | `#14141E` | `20, 20, 30` | Struktural | Garis batas luar sprite (1px), bayangan oklusi terdalam |
| `#01` | Night Void Base | `#1A1C29` | `26, 28, 41` | Struktural | Bayangan mode malam, area void latar belakang |
| `#02` | Night Floor Mid | `#282D3F` | `40, 45, 63` | Struktural | Midtone lantai malam, bayangan dinding struktural |
| `#03` | Day Floor Slate | `#475069` | `71, 80, 105` | Struktural | Lantai utama kantor mode siang, bahan denim overall |
| `#04` | Floor Light / Trim | `#687594` | `104, 117, 148` | Struktural | Bevel highlight ubin siang, lis dinding interior |
| `#05` | Cool Metal Grey | `#9CA8B8` | `156, 168, 184` | Industri | Rangka aluminium, sasis rak server, rim-light sekunder |
| `#06` | Highlight Metal | `#D1D8E0` | `209, 216, 224` | Industri | Bingkai papan tulis, kaki meja besi, glint logam |
| `#07` | Pure White | `#FFFFFF` | `255, 255, 255` | Industri | Glint spekular puncak, bahan jas lab, teks highlight |
| `#08` | Skin Shadow | `#8F5338` | `143, 83, 56` | Anatomi | Bayangan lipatan kulit chibi, rambut auburn gelap |
| `#09` | Skin Midtone | `#C9855B` | `201, 133, 91` | Anatomi | Warna dasar kulit hangat karakter, lengan, dan wajah |
| `#10` | Skin Light | `#F2B896` | `242, 184, 150` | Anatomi | Highlight faset pipi dan dahi karakter |
| `#11` | Deep Walnut | `#4A2814` | `74, 40, 20` | Kayu | Bayangan lemari buku perpustakaan, kaki meja eksekutif |
| `#12` | Warm Oak Mid | `#A26D3F` | `162, 109, 63` | Kayu | Permukaan meja kayu Kenney, kursi boardroom, mihrab |
| `#13` | Honey Wood Light | `#E0B678` | `224, 182, 120` | Kayu | Glint meja kayu, counter kafe marmer-kayu, lantai CEO |
| `#14` | Cyber Cyan Glow | `#00F0FF` | `0, 240, 255` | Cahaya | Lampu LED helm Bastion, air kolam glint, monitor aktif |
| `#15` | Warm Filament Glow | `#FEF9C3` | `254, 249, 195` | Cahaya | Pendar lampu meja pijar, lampu baca perpustakaan, neon |
| `#16` | Jarvis Navy | `#1F3A68` | `31, 58, 104` | Agen | Warna khas Jarvis (Jas navy 3-potong eksekutif) |
| `#17` | Daedalus Cerulean | `#2F6FB3` | `47, 111, 179` | Agen | Warna khas Daedalus (Kemeja arsitek biru cerulean) |
| `#18` | Oracle Violet | `#8A4FBF` | `138, 79, 191` | Agen | Warna khas Oracle (Aksen ungu jas lab kimia) |
| `#19` | Merlin Ochre | `#B5652B` | `181, 101, 43` | Agen | Warna khas Merlin (Kardigan ochre hangat & tongkat) |
| `#20` | Muse Coral | `#E0567A` | `224, 86, 122` | Agen | Warna khas Muse (Aksen berry coral pink pada overall) |
| `#21` | Prism Teal | `#2BB3C0` | `43, 179, 192` | Agen | Warna khas Prism (Garis spektrum hoodie teal-cyan) |
| `#22` | Forge Terracotta | `#D9622B` | `217, 98, 43` | Agen | Warna khas Forge (Celemek kulit pandai besi terracotta) |
| `#23` | Vector Emerald | `#3FA66B` | `63, 166, 107` | Agen | Warna khas Vector (Rompi lapangan data emerald) |
| `#24` | Sentinel Crimson | `#D23C3C` | `210, 60, 60` | Agen | Warna khas Sentinel (Visor merah crimson & stempel QA) |
| `#25` | Bastion Slate | `#6B7785` | `107, 119, 133` | Agen | Warna khas Bastion (Pelat zirah pelindung SOC slate) |
| `#26` | Relay Indigo | `#6D5BD0` | `109, 91, 208` | Agen | Warna khas Relay (Jaket & topi kurir royal indigo) |
| `#27` | Warden Olive | `#8E8E3A` | `142, 142, 58` | Agen | Warna khas Warden (Rompi utilitas lobi brass-olive) |
| `#28` | Steward Lime | `#9CC23A` | `156, 194, 58` | Agen | Warna khas Steward (Overall pekerja chartreuse lime) |
| `#29` | Scribe Tweed | `#7A4A2E` | `122, 74, 46` | Agen | Warna khas Scribe (Blazer tweed sepia brown perpustakaan) |
| `#30` | Nova Gold | `#F2C230` | `242, 194, 48` | Agen | Warna khas Nova (Jaket varsity star gold & mahkota) |
| `#31` | Rifqi Cream | `#F5F0E1` | `245, 240, 225` | Agen | Warna khas Rifqi (Hoodie warm off-white Founder) |

---

## 3. Matriks Uji Kontras 16 Karakter Agent (Siang vs Malam)

Setiap warna khas agen dihitung rasio kontras luminansi relatifnya terhadap dua permukaan lantai utama:
- **Lantai Siang (Day Floor):** `#475069` (Luminansi relatif $L = 0.076$)
- **Lantai Malam (Night Floor):** `#1A1C29` (Luminansi relatif $L = 0.013$)

Formula kontras WCAG: $CR = \frac{L_{bright} + 0.05}{L_{dark} + 0.05}$

### Tabel Evaluasi Kontras & Mitigasi Visual

| Karakter | Base Rig | HEX Khas | Kontras Siang (`#475069`) | Kontras Malam (`#1A1C29`) | Status Visual & Aturan Mitigasi |
| :--- | :---: | :---: | :---: | :---: | :--- |
| **Jarvis** | A | `#1F3A68` | `1.41:1` *(Low)* | `1.50:1` *(Low)* | **Kritis:** Wajib 1px Sel-Out Rim Highlight (`#687594`), dasi emas tipis (`#F2C230`), dan karpet Ruang CEO bertonus krem/kayu (`#E0B678`) sehingga kontras zona melonjak ke **6.2:1**. |
| **Daedalus** | B | `#2F6FB3` | `1.54:1` *(Low)* | `3.26:1` *(Pass)* | **Perhatian Siang:** Lengan kemeja digulung memperlihatkan skintone (`#C9855B`), syal arsitek putih (`#FFFFFF`), dan tabung blueprint cokelat (`#A26D3F`). |
| **Oracle** | A | `#8A4FBF` | `1.51:1` *(Low)* | `3.18:1` *(Pass)* | **Perhatian Siang:** Badan dominan jas lab **Pure White (`#FFFFFF`)**, warna violet hanya sebagai aksen kerah dan saku sehingga keterbacaan siluet 100% aman (> 7:1). |
| **Merlin** | A | `#B5652B` | `1.86:1` *(Low)* | `3.91:1` *(Pass)* | **Perhatian Siang:** Syal motif bintang putih/kuning (`#FEF9C3`), kacamata bulat, janggut abu-abu pendek (`#9CA8B8`) memberi pemisah visual tajam. |
| **Muse** | B | `#E0567A` | `2.21:1` *(Good)* | `4.65:1` *(Pass)* | **Aman:** Berry coral pink kontras sangat baik terhadap slate gelap dan malam hari. Aksen noda cat putih/kuning di overall. |
| **Prism** | A | `#2BB3C0` | `3.17:1` *(Pass)* | `6.69:1` *(Pass)* | **Aman Unggul:** Cyan-teal cerah berkilau kuat di kedua mode. Headphone dan keyboard mekanik putih mempertegas siluet. |
| **Forge** | C | `#D9622B` | `2.19:1` *(Good)* | `4.62:1` *(Pass)* | **Aman:** Terracotta cerah terlihat jelas di lantai slate. Sarung tangan tebal dan goggle las mempertegas karakter. |
| **Vector** | B | `#3FA66B` | `2.63:1` *(Good)* | `5.54:1` *(Pass)* | **Aman:** Hijau emerald lapangan kontras alami. Gulungan kabel abu-abu di bahu dan tablet grafik. |
| **Sentinel** | A | `#D23C3C` | `1.70:1` *(Low)* | `3.58:1` *(Pass)* | **Perhatian Siang:** Visor merah menyala (`#D23C3C`) di atas mantel abu gelap, membawa papan klip putih (`#FFFFFF`) yang menjadi titik fokus kontras. |
| **Bastion** | C | `#6B7785` | `1.76:1` *(Low)* | `3.71:1` *(Pass)* | **Perhatian Siang:** Lampu visor helm memancarkan LED Cyan aktif (`#00F0FF`), rompi taktis memiliki outline gelap dan pelat dada terang. |
| **Relay** | A | `#6D5BD0` | `1.55:1` *(Low)* | `3.27:1` *(Pass)* | **Perhatian Siang:** Paket surat kardus berlabel putih (`#F5F0E1`) di tas selempang memberikan kontras objek tinggi. |
| **Warden** | A | `#8E8E3A` | `2.32:1` *(Good)* | `4.90:1` *(Pass)* | **Aman:** Olive brass kontras cukup tinggi. Gantungan kunci logam berkilau dan kotak perkakas merah/oranye. |
| **Steward** | A | `#9CC23A` | `3.89:1` *(Pass)* | `8.21:1` *(Pass)* | **Aman Unggul:** Builder chartreuse lime adalah salah satu warna paling mudah dipindai mata pada kedua mode. |
| **Scribe** | B | `#7A4A2E` | `1.09:1` *(Crit)* | `2.29:1` *(Warn)* | **Kritis Siang:** Wajib blouse/kerudung dalaman krem (`#F5F0E1`), kertas manuskrip putih di tangan, dan zona Perpustakaan beralas kayu oak (`#A26D3F`). |
| **Nova** | B | `#F2C230` | `4.79:1` *(Pass)* | `10.09:1` *(Pass)* | **Aman Unggul:** Varsity star gold sangat kontras di semua permukaan. Sepatu kets putih dan jepit rambut bintang. |
| **Rifqi** | A | `#F5F0E1` | `7.04:1` *(Pass)* | `14.84:1` *(Pass)* | **Aman Maksimal:** Hoodie krem Founder memiliki kontras tertinggi di atas lantai kantor. Mahkota emas melayang (`#F2C230`). |

---

## 4. Aturan Outline & Teknik Rendering Pixel-Art (Anti-Slop)

Untuk memastikan seluruh aset tampak menyatu dalam ruang isometrik tanpa kehilangan ketajaman retro pixel-art:

### 4.1. Garis Batas Luar 1px (Charcoal Contour)
- Seluruh perimeter terluar sprite karakter dan furnitur **wajib memiliki garis batas 1px** menggunakan warna `#14141E` (Outline Charcoal).
- Garis batas **dilarang menggunakan warna hitam pekat `#000000`**, karena hitam absolut merusak gradasi atmosfer cozy-tech.

### 4.2. Selective Outlining (Sel-Out) & Inner Rim Lighting
- Pada tepi permukaan yang menghadap langsung ke arah cahaya kunci (arah barat laut / atas):
  - Garis batas luar digantikan oleh warna lokal yang lebih gelap 1 tingkat (*selective outlining*) atau disisipi garis highlight 1px (`#687594` atau `#9CA8B8`).
  - Ini memberikan ilusi kedalaman 3D beveled dan mencegah karakter gelap melebur ke lantai gelap.

### 4.3. Anti-Banding & Zero Rough Dithering
- **Zero Dithering Kasar:** Pada resolusi tinggi 48 px, pola *checkerboard dithering* dilarang keras pada kostum karakter karena menyebabkan getaran visual (*shimmering flicker*) saat animasi walk/idle dimainkan.
- **Transisi Tonal 3-Langkah:** Setiap material karakter menggunakan maksimal 3 tingkatan tonal: Highlight → Midtone → Shadow.
- **Anti-Banding:** Kurva pada helm, kepala, dan bahu disusun dalam kelompok pixel berundak teratur (mis. 2-1-2 atau 3-2-1), tanpa anak tangga tunggal yang sejajar (*stair-step banding*).

### 4.4. Kontak Bayangan Lantai (Isometric Ground Shadow)
- Setiap karakter berdiri wajib memiliki bayangan kontak elips di lantai:
  - **Dimensi:** Lebar 24 px, tinggi 12 px (rasio 2:1 isometrik).
  - **Warna & Opasitas:** `rgba(10, 12, 20, 0.40)` dirender pada layer di atas ubin lantai dan di bawah kaki karakter.
  - Bayangan ini memastikan karakter selalu berpijak kokoh di atas lantai dan tidak tampak melayang.

---

## 5. Ukuran Karakter, Proporsi & Proyeksi Isometrik

### 5.1. Bounding Box & Titik Jangkar (Anchor)
- **Tinggi Karakter Standar:** 48 px pada skala 1x (toleransi 46–50 px untuk penutup kepala/aksesori).
- **Ukuran Canvas Sprite Sheet:** 48×64 px per frame animasi.
- **Titik Jangkar (Pivot Anchor):** Tepat di tengah bawah `[0.5, 1.0]`, bersinggungan dengan titik tengah ubin 64×32 px.

### 5.2. Proporsi Chibi (Quaternius Rig Modification)
- **Skala Kepala:** Diperbesar **1,6×** dari proporsi anatomis dewasa standar.
- **Panjang Kaki:** Dipendekkan **30%** untuk memberikan siluet chibi yang imut namun proporsional.
- **3 Varian Badan Dasar (Base Rig):**
  - **Base A (Sedang):** Jarvis, Oracle, Merlin, Prism, Sentinel, Relay, Warden, Steward, Rifqi.
  - **Base B (Ramping / Lincah):** Daedalus, Muse, Vector, Scribe, Nova.
  - **Base C (Besar / Kekar):** Forge, Bastion.

### 5.3. Grid Ubin & Konfigurasi Kamera Blender
- **Ukuran Ubin Dasar:** 64×32 px (rasio 2:1 dimetrik isometrik).
- **Proyeksi Kamera Blender:**
  - Tipe Kamera: *Orthographic*.
  - Sudut Rotasi: $X = 60^\circ$, $Y = 0^\circ$, $Z = 45^\circ$.
  - Kedalaman Ubin: Ubin lantai datar memiliki tebal visual muka potong (front cutaway) setinggi 8 px.

### 5.4. Aturan Skala Tampilan (Nearest-Neighbor Scaling)
- Skala tampilan di browser:
  - 1x (Mode ringkas / overview)
  - **2x (Spec Default — Target Desain Acuan)**
  - 3x & 4x (Mode detail / aksesibilitas zoom)
- Seluruh elemen grafis kanvas PixiJS wajib menggunakan properti CSS:
  `image-rendering: pixelated;` dan pengaturan tekstur Pixi `scaleMode: 'nearest'`. Dilarang menggunakan interpolasi bilinear yang mengaburkan tepian pixel.

---

## 6. Siklus Atmosfer & Tata Cahaya Kantor (WIB)

Atmosfer kantor berganti secara dinamis mengikuti waktu nyata Asia/Jakarta:

1. **Mode Siang (05.00–15.00 WIB):**
   - Karakter visual: Cahaya netral hangat, jendela kaca luar transparan terang, bayangan lantai pendek dan tajam.
   - Tint ambient: Netral hangat (`#FFFDF7`).
2. **Mode Senja (15.00–18.00 WIB):**
   - Karakter visual: Tint amber keemasan lembut, bayangan isometrik memanjang, lampu meja individual mulai menyala bertahap.
   - Tint ambient: Amber warm (`#FFECD2`).
3. **Mode Malam (18.00–05.00 WIB):**
   - Karakter visual: Tint biru tua sejuk (`#1A1C29`), jendela luar gelap dengan pendar bintang.
   - Lampu neon arcade, LED rak server SOC, dan monitor menyala sebagai sprite blending additive.
   - Karakter Bastion mengaktifkan LED visor cyan (`#00F0FF`).

---

## 7. Standar Desain HUD & Komponen Web (Anti-AI-Slop Manifesto)

HUD pelengkap di luar kanvas game (Top Bar, Inspector Drawer, Panel Founder) wajib tunduk pada *Anti-AI-Slop Manifesto*:

1. **Tabular Numerics Wajib:**
   Semua metrik sistem, timer, persentase CPU/RAM, koordinat, dan angka task WAJIB memakai:
   `font-variant-numeric: tabular-nums;` dan font monospace/Inter berjarak angka tetap agar angka tidak bergetar saat pembaruan real-time.
2. **Tipografi Terkalibrasi:**
   Heading besar wajib memakai negative letter-spacing (`-0.02em` s.d. `-0.04em`). Dilarang memakai font sans-serif mentah tanpa tuning tracking.
3. **Tanpa Gradient Fog & Unearned Glassmorphism:**
   Latar belakang panel menggunakan solid slate berjenjang (`#090A0F`, `#11141E`, `#161B28`) dengan batas hairline `1px solid rgba(255, 255, 255, 0.08)`. Dilarang memakai blur ungu mengambang tanpa fungsi hierarki.
4. **Indikator Status Subtil:**
   Gunakan badge status dengan latar semitransparan 15% dan batas warna tegas, bukan ikon berbayang tebal yang mendominasi antarmuka.

---

## 8. Daftar Tindakan Konkret untuk Fase 1 (T1.6 & T1.7)

Steward selaku penanggung jawab art dan engine produksi wajib mengeksekusi butir-butir berikut:

- [ ] **[P0] Integrasikan `art/pipeline/palette.json` Final ke Skrip Render:** Pastikan skrip kuantisasi Blender mengacu pada palet master 32 warna resmi ini.
- [ ] **[P0] Terapkan Rim-Light Pass pada Karakter Gelap:** Khusus untuk Jarvis, Scribe, dan Bastion, tambahkan lapisan pencahayaan tepi atas-kiri dengan shade `#9CA8B8` / `#687594`.
- [ ] **[P1] Kluster Pixel Wajah/Kacamata/Visor 2-3 Pixel:** Berikan ekspresi mata atau celah visor minimalis pada Base A/B/C agar kepala tidak terlihat kosong seperti bola manekin.
- [ ] **[P1] Implementasikan Elips Bayangan Kontak (Ground Shadow):** Masukkan sprite bayangan 24×12 px pada titik kaki karakter di layer renderer PixiJS.
- [ ] **[P2] Terapkan Ubin Khusus Zona Karpet Berkontras Tinggi:** Pastikan ruang CEO, Perpustakaan, dan Musholla menggunakan ubin lantai hangat sesuai spesifikasi Blueprint Bagian 4.

---

*Disetujui dan disahkan oleh:*  
**Muse (Principal UI/UX & Design Engineer)**  
*Agentic AI Office v2 Architecture Council*
