# Sprite Rendering Pipeline (Blender Headless & PixiJS Testbed)

Pipeline render procedural untuk menghasilkan sprite pixel-art isometrik 2.5D dari model 3D GLB (Kenney & Quaternius) yang deterministik, ringan, dan siap pakai untuk PixiJS v8.

---

## 1. Konvensi Isometrik & Grafika

- **Proyeksi:** Dimetrik 2:1 (`screenX = (gx - gy) * 32`, `screenY = (gx + gy) * 16`).
- **Kamera Blender:** Ortografik, Rotasi $X = 60^\circ, Y = 0^\circ, Z = 45^\circ$, `sensor_fit: VERTICAL`, `ortho_scale: 1.95`.
- **Lighting:** 3-point sun lighting (Key light $4.2$, Fill light $2.0$, Rim light $1.2$).
- **Resolusi Kanvas:**
  - Karakter: $48 \times 64$ px (anchor kaki di tengah bawah).
  - Furnitur: $64 \times 64$ px (anchor alas di tengah bawah).
- **Arah Render Karakter:**
  - `SE` (South-East, menghadap depan-bawah): Rotasi Y tulang root $90^\circ$.
  - `NE` (North-East, membelakangi): Rotasi Y tulang root $180^\circ$.
  - `SW` dan `NW` diperoleh via horizontal flip di runtime.
- **Kuantisasi Palet:** Palet master sementara 32 warna (`palette.json` / `palette.gpl`) via weighted Euclidean distance.
- **Outline:** 1 px charcoal (`#14141E`) via 4-connected morphological expansion.
- **Texture Packing:** `free-tex-packer-core` menghasilkan atlas PNG + JSON format PixiJS (`dist/office_sprites.json` dan `dist/office_sprites.png`).

---

## 2. Cara Menjalankan Pipeline (Single Command)

Skrip dapat dijalankan langsung dengan satu perintah dari root direktori proyek di laptop Rifqi:

```bash
# Menjalankan render Blender headless + packing atlas otomatis
python3 art/pipeline/render.py
```

Atau dijalankan langsung di dalam Blender 4.x:

```bash
blender -b -P art/pipeline/render.py -- --output-dir art/pipeline/dist
```

Untuk mengemas ulang atlas secara terpisah:

```bash
node art/pipeline/pack.js art/pipeline/dist/raw_sprites art/pipeline/dist
```

Untuk menjalankan verifikasi E2E Playwright dan mengambil screenshot halaman uji:

```bash
node art/pipeline/verify_spike.js
```

---

## 3. Hasil Pengujian & Waktu Render (Benchmark Laptop Rifqi)

Data pengujian pada mesin `Rifqi-studio` (Ubuntu Linux 6.17, 54 GB RAM, CPU Cycles Engine seed 42):

| Komponen | Aset Sumber | Jumlah Frame | Waktu Render | Waktu per Frame |
| :--- | :--- | :---: | :---: | :---: |
| **Bastion Walk (SE)** | `figure_Casual.glb` | 6 frame | 0.44 dtk | ~0.07 dtk/frame |
| **Bastion Walk (NE)** | `figure_Casual.glb` | 6 frame | 0.34 dtk | ~0.06 dtk/frame |
| **Bastion Idle (SE)** | `figure_Casual.glb` | 4 frame | 0.20 dtk | ~0.05 dtk/frame |
| **Bastion Idle (NE)** | `figure_Casual.glb` | 4 frame | 0.21 dtk | ~0.05 dtk/frame |
| **Total Karakter (Bastion)** | | **20 frame** | **1.19 dtk** | **~0.06 dtk/frame** |
| **Meja Kantor (Desk)** | `desk.glb` | 1 frame | 0.11 dtk | 0.11 dtk/frame |
| **Kursi Putar (Chair)** | `chairDesk.glb` | 1 frame | 0.09 dtk | 0.09 dtk/frame |
| **Monitor Layar (Screen)**| `computerScreen.glb`| 1 frame | 0.10 dtk | 0.10 dtk/frame |
| **Total Furnitur** | | **3 frame** | **0.30 dtk** | **~0.10 dtk/frame** |
| **Total Pipeline Render** | | **23 frame** | **1.48 dtk** | **~0.06 dtk/frame** |

Durasi packing texture atlas via `free-tex-packer-core`: **0.25 dtk**.  
Total eksekusi keseluruhan: **2.22 dtk**.

---

## 4. Acceptance Criteria Verification

- [x] **Halaman uji menampilkan karakter berjalan di atas 3 furnitur tanpa artefak blur:**
  Diverifikasi menggunakan PixiJS v8 (`scaleMode: 'nearest'`, `roundPixels: true`, `antialias: false`, skala $2\times$). Karakter Bastion berpatroli mengelilingi meja, kursi, dan monitor dengan depth sorting isometrik ($zIndex = y$) tanpa blur.
- [x] **Skrip bisa diulang dengan satu perintah dan hasilnya deterministik:**
  Diverifikasi dengan perintah `python3 art/pipeline/render.py`. Seed Cycles dikunci pada 42, samples=16, menghasilkan output identik bit-for-bit di setiap eksekusi.
- [x] **Screenshot + waktu render dilampirkan untuk review Muse:**
  - File screenshot halaman penuh: `art/pipeline/dist/screenshot_spike_2x.png`
  - File screenshot detail canvas: `art/pipeline/dist/screenshot_spike_detail.png`
  - File metrik lengkap: `art/pipeline/dist/render_metrics.json`
  - File palet master 32 warna: `art/pipeline/palette.json` & `art/pipeline/palette.gpl` (siap untuk Task T0.5).
