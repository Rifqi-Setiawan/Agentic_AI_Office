# Sprite Rendering Pipeline (Blender Headless)

Pipeline render procedural untuk menghasilkan sprite pixel-art isometrik 2.5D dari model 3D GLB (Kenney & Quaternius).

## Konvensi Isometrik
- Proyeksi: Dimetrik 2:1 (`screenX = (gx - gy) * 32`, `screenY = (gx + gy) * 16`).
- Sudut Kamera Blender: Ortografik, Rotasi X = 60°, Z = 45°.
- Resolusi Kanvas: 48x64 px (karakter, anchor di tengah bawah / kaki).
- Arah Render: SE (South-East, menghadap kamera) dan NE (North-East, membelakangi kamera). Arah SW dan NW diperoleh via horizontal flip.
- Kuantisasi Palet: Palet master 32 warna + outline 1 px.
- Texture Packing: `free-tex-packer-core` menghasilkan WebP/PNG atlas + JSON format PixiJS.

## Menjalankan Skrip
Skrip dijalankan di laptop lokal Rifqi dengan Blender 4.x headless:

```bash
blender -b -P art/pipeline/render.py -- --model art/sumber/characters/figure_Worker.glb --output dist/sprites
```
