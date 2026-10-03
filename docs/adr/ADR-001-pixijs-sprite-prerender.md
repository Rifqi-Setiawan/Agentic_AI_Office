# ADR-001: Penggantian Three.js dengan PixiJS v8 dan Pre-render Sprite Isometrik 2.5D

- **Status:** Diterima (Accepted)
- **Tanggal:** 2026-10-03 (Asia/Jakarta / WIB)
- **Penulis:** Daedalus (Principal Systems & Data Architect)
- **Stakeholder:** Steward (Art/Graphics Engineer), Prism (Frontend Lead), Muse (Art Director), Bastion (Infra/Sec)
- **Komponen:** Frontend World Renderer (`frontend/src/world/`) & Asset Pipeline (`art/pipeline/`)
- **Dokumen Acuan:** `docs/blueprint/01-master-architecture.md`, `docs/blueprint/02-tech-stack.md`, `docs/blueprint/08-risk-assessment.md` (Risiko R1, R10)

---

## 1. Konteks dan Pernyataan Masalah

Pada arsitektur Office v1, antarmuka visual kantor 3D dibangun menggunakan Three.js dengan memanfaatkan `GLTFLoader` untuk memuat model poligon 3D (.glb) secara langsung di browser dan merendernya dalam runtime 3D WebGL penuh.

Evaluasi operasional pada v1 mengidentifikasi sejumlah kelemahan mendasar:
1. **Beban Komputasi GPU/CPU Runtime Tinggi:** Merender lusinan mesh 3D poligon dinamis, bayangan, dan animasi skeleton di runtime per frame membebani perangkat desktop/laptop dengan GPU terintegrasi (iGPU Intel/AMD). Frame rate kerap turun di bawah 30 FPS.
2. **Lonjakan Draw Call:** Setiap model karakter dan objek furnitur menghasilkan multiple draw calls terpisah karena variasi material dan tekstur individual, memicu bottleneck pada antarmuka WebGL.
3. **Ukuran Bundle dan Konsumsi Memori Browser:** Dependensi Three.js, loader GLTF, dan kontrol kamera orbit menghasilkan ukuran bundle JavaScript awal > 1,2 MB (gzip). Konsumsi memori browser melampaui 500 MB setelah sesi aktif selama beberapa menit.
4. **Disonansi Estetika:** Gaya visual 3D realistis/semi-realistis bentrok dengan visi artistik baru Office v2, yaitu *cozy-tech 2.5D pixel-art isometrik* bernuansa hangat dengan proyeksi dimetrik 2:1.

Kebutuhan v2 menuntut performa render yang sangat ringan (target: 60 FPS p95 pada laptop dengan GPU terintegrasi, < 30 draw call per frame, bundle JS awal ≤ 400 KB gzip, dan konsumsi memori tab < 300 MB tanpa tren meningkat).

---

## 2. Pendorong Keputusan (Decision Drivers)

1. **Performa Hardware Terbatas:** Harus berjalan mulus (60 FPS stabil) pada perangkat pengunjung publik tanpa kartu grafis diskret.
2. **Kesesuaian Gaya Visual:** Estetika 2.5D pixel-art isometrik dimetrik 2:1 (tile 64×32 px) dengan pencahayaan atmosfer dinamis (siang, senja, malam).
3. **Efisiensi Jaringan:** Meminimalkan waktu muat awal (*initial page load*) dan ukuran total payload aset visual (atlas sprite WebP/PNG ≤ 2,5 MB).
4. **Konsistensi Aset:** Pemanfaatan aset 3D CC0 yang sudah ada (Kenney Furniture Kit dan Quaternius Animated Men) tanpa harus menggambar ribuan frame pixel-art secara manual.
5. **Separasi Render Loop dan UI State:** Menghindari re-render komponen DOM UI React saat siklus render grafis berlangsung 60 kali per detik.

---

## 3. Pilihan yang Dipertimbangkan

### Opsi 1: Mempertahankan Three.js v1 dengan Optimasi Mesh dan Shader Pixelation
- **Deskripsi:** Tetap menggunakan Three.js, menyederhanakan poligon model GLB, dan menambahkan post-processing custom shader untuk menghasilkan efek pixel art.
- **Kelebihan:** Fleksibilitas rotasi kamera bebas 3D tetap terjaga; animasi mesh dapat diinterpolasi di runtime.
- **Kekurangan:** Overhead Three.js runtime tetap besar (> 1 MB JS); post-processing shader menambah beban komputasi fragment GPU; hasil visual pixelation post-processing sering tampak buram (*muddy*) dan tidak memiliki ketajaman pixel-art sejati; konsumsi memori tetap tinggi.
- **Status:** Ditolak.

### Opsi 2: HTML5 Canvas 2D Konvensional
- **Deskripsi:** Merender sprite 2D menggunakan Context2D native browser tanpa WebGL.
- **Kelebihan:** Tanpa dependensi eksternal besar; kompatibilitas sangat tinggi.
- **Kekurangan:** Ketiadaan GPU hardware sprite batching; performa anjlok drastis ketika menggambar ratusan tile lantai, dinding, furnitur, dan filter color overlay untuk atmosfer waktu; manipulasi z-index kompleks lambat di CPU.
- **Status:** Ditolak.

### Opsi 3: Phaser.js Engine
- **Deskripsi:** Menggunakan game engine 2D HTML5 Phaser.
- **Kelebihan:** Fitur lengkap untuk tilemap dan manajemen sprite.
- **Kekurangan:** Membawa abstraksi berat yang tidak diperlukan (physics engine Arcade/Matter, scene management kompleks, sound engine bawaan); arsitektur framework monolitik sulit diintegrasikan secara bersih dengan React 18 HUD dan Zustand store.
- **Status:** Ditolak.

### Opsi 4: PixiJS v8 (WebGL2/WebGPU) + Offline Pre-rendered Sprite Pipeline (Blender Headless)
- **Deskripsi:** Merender model GLB 3D secara offline menggunakan skrip headless Blender 4.x ke dalam sprite sheet isometrik beresolusi terkuantisasi, lalu merender sprite atlas tersebut di browser menggunakan PixiJS v8.
- **Kelebihan:** 
  - PixiJS v8 memiliki performa sprite batching tercepat di ekosistem web modern; seluruh scene (16 agen + ±600 tile) diproses dalam < 30 draw call per frame.
  - Memanfaatkan aset GLB CC0 yang sudah ada dengan transformasi offline deterministik.
  - Kualitas pixel art konsisten dan tajam (1px outline, 32-color master palette).
  - Integrasi modular: PixiJS menangani kanvas canvas WebGL murni, terisolasi penuh dari root React 18 HUD.
- **Status:** **Dipilih**.

---

## 4. Keputusan Arsitektur dan Spesifikasi Teknis

Ditetapkan migrasi penuh dari Three.js ke **PixiJS v8** yang dipadukan dengan **Headless Blender Sprite Pipeline**:

### 4.1 Pipeline Offline Pre-rendering (Build/Dev Time)
1. **Eksekusi:** Dijalankan di lingkungan build/developer (laptop pengembang via `art/pipeline/render.py`), bukan pada VPS produksi.
2. **Kamera Ortografik:** Sudut kamera diatur pada Rotasi X = 60° dan Rotasi Z = 45°. Konfigurasi ini menghasilkan proyeksi dimetrik isometrik 2:1 dengan transformasi layar:
   $$\text{screenX} = (gx - gy) \times 32$$
   $$\text{screenY} = (gx + gy) \times 16$$
3. **Karakter & Aset:**
   - Model Quaternius ditransformasikan dengan proporsi chibi (skala tulang kepala 1,6× dan kaki dipendekkan).
   - Penambahan aksesori spesifik (helm Bastion, jubah Merlin, dsb.) dan material color-swap sesuai 16 warna khas agen.
   - Perenderan karakter dilakukan hanya pada 2 sudut pandang utama: SE (South-East / menghadap depan) dan NE (North-East / membelakangi). Sudut SW dan NW dihasilkan di runtime melalui horizontal mirroring (`scale.x = -1`).
   - Resolusi frame karakter: kanvas 48×64 px dengan anchor point di titik tengah bawah kaki `(0.5, 1.0)`.
4. **Post-Processing & Kuantisasi:**
   - Dikuantisasi secara deterministik ke palet master 32 warna.
   - Pemberian 1px outline gelap untuk mempertegas siluet karakter terhadap latar belakang.
   - Pengemasan atlas sprite menggunakan `free-tex-packer-core` menghasilkan berkas atlas WebP/PNG dan manifes JSON format PixiJS.

### 4.2 Runtime Rendering Engine (Browser Client)
1. **Aplikasi PixiJS:** Menggunakan `PIXI.Application` tunggal dengan WebGL2 context, `antialias: false`, dan `scaleMode: 'nearest'` untuk menjaga ketajaman pixel-art pada resolusi integer scale (1×, 2×, 3×).
2. **Kamera dan Viewport:** Menggunakan `pixi-viewport` untuk mendukung pan drag, mouse wheel zoom dengan snapping integer, dan bound limits kantor. Animasi translasi kamera halus menggunakan GSAP 3 (cubic easing).
3. **Depth Sorting Deterministik:** Pengurutan kedalaman visual objek (karakter dan furnitur dinamis) menggunakan formula z-index berbasis koordinat grid:
   $$\text{zIndex} = (gx + gy) \times 1000 + \text{layer}$$
   Furnitur statis rendah di-bake langsung ke layer lantai tilemap untuk memangkas kalkulasi sorting.
4. **Filter Atmosfer:** Penerapan ColorMatrixFilter / Tint shader PixiJS pada container world untuk transisi waktu dinamis WIB (siang, senja, malam) tanpa menurunkan FPS.
5. **Arsitektur Jembatan State (Decoupled React HUD):**
   - Canvas PixiJS dan root React 18 HUD berjalan berdampingan namun independen.
   - Komunikasi satu arah dijembatani secara eksklusif oleh vanilla store Zustand (`frontend/src/data/store.ts`). Loop ticker PixiJS membaca state store secara direct setiap tick tanpa pernah memicu siklus `setState` React.

---

## 5. Konsekuensi

### Positif:
1. **Performa Grafis Tinggi:** Target 60 FPS p95 tercapai pada perangkat kelas entry-level. Jumlah draw call terpangkas menjadi < 30 per frame.
2. **Ukuran Distribusi Sangat Ringan:** Bundle JavaScript frontend awal turun drastis ke ≤ 400 KB gzip (penghematan > 65% dibandingkan bundle Three.js v1). Total ukuran aset visual terkontrol ≤ 2,5 MB.
3. **Efisiensi Alokasi Memori:** Alokasi memori tab browser stabil di bawah 300 MB tanpa memory leak setelah 30 menit sesi aktif.
4. **Ketajaman Visual Konsisten:** Eliminasi blur/aliasing 3D; estetika pixel-art tampak tajam dan kohesif di semua tingkat zoom integer.

### Negatif dan Risiko:
1. **Inflexible Runtime Meshes:** Animasi baru atau variasi karakter tidak dapat diinterpolasi mesh-nya secara dinamis di runtime klien; setiap pose/animasi baru harus melalui pipeline render Blender.
2. **Dependensi Pipeline Build Art:** Perubahan aset 3D memerlukan langkah kompilasi rendering ulang (`npm run art:build`).

### Mitigasi Risiko:
- Pipeline headless Blender dibuat sepenuhnya otomatis dan deterministik via CLI satu perintah (`python art/pipeline/render.py`), dengan waktu render rata-rata ~1,48 detik per karakter (terbukti pada Spike T0.4).
- Penambahan animasi baru difokuskan pada MVP Fase 1 (idle dan walk), sementara animasi spesifik lainnya didelegasikan secara terstruktur ke Fase 2 (F19).

---

## 6. Kepatuhan Aturan Global & Validasi

- **Zero Write to Hermes:** Seluruh proses rendering dan asset pipeline berjalan di repositori `office-v2` tanpa mengakses atau menulis ke direktori `/srv/apps/hermes/**`.
- **Hasil Verifikasi Empiris (Spike T0.4):**
  - Atlas 23 frame karakter Quaternius + 3 furnitur Kenney berhasil dikemas ke dalam atlas PixiJS.
  - Halaman uji PixiJS v8 menampilkan animasi patroli isometrik di atas furnitur pada skala 2x tanpa blur dan lulus verifikasi CI di commit `828cf5f`.
