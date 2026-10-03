# 2. Tech Stack Recommendation

Frontend pindah dari Three.js ke PixiJS v8 dengan sprite hasil pre-render. Backend tetap FastAPI, tapi ditulis ulang supaya lebih tipis dan tanpa penyimpanan sendiri.

| Lapisan | Pilihan | Alasan | Alternatif yang ditolak |
| --- | --- | --- | --- |
| Render world | PixiJS v8 (WebGL2) | Sprite batching: 16 karakter + ±600 tile cukup dengan < 30 draw call; ada filter warna untuk siang/senja/malam | Canvas 2D murni (tanpa batching); Phaser (bawa physics/scene yang tidak dipakai) |
| Kamera | pixi-viewport | Drag, zoom roda mouse, batas tepi, dan animasi sudah tersedia | Menulis sendiri |
| Animasi kamera & UI | GSAP 3 | Sudah dipakai di v1, gratis termasuk plugin, easing kubik (lesson #3) | Lerp mentah |
| Editor peta | Tiled Map Editor → JSON | Ruangan diedit visual; slot interaksi dan pintu jadi object layer | Koordinat hardcode |
| Pathfinding | A\* sendiri di grid 44×32 | Grid kecil, < 1 ms per pencarian, tanpa dependensi | easystar.js (async tidak perlu) |
| HUD | React 18 + Tailwind 3 | Sudah dikuasai Prism; HUD terpisah dari loop render (lesson #2) | Svelte |
| Jembatan state | Zustand (vanilla store) | World membaca store langsung tiap frame tanpa re-render React | Redux |
| Audio | Howler.js | Audio sprite, fade, mute global; mati sampai user klik | Web Audio manual |
| Tipe bersama | openapi-typescript | Tipe frontend di-generate dari skema FastAPI, jadi kontraknya tidak menyimpang | Tipe ditulis manual |
| Build | Vite 5 + TypeScript 5 (strict) | Sama seperti v1 |  |
| Backend | FastAPI + Python 3.12 + uvicorn (1 worker) | Sama seperti v1; SSE via `sse-starlette` |  |
| Akses data | `sqlite3` stdlib, `mode=ro` | Hermes menyimpan semua state di SQLite | inotify + parsing log (rapuh) |
| Auth | argon2-cffi + itsdangerous | Hanya satu user Founder, tidak perlu DB user | OAuth (berlebihan) |
| Aset sumber | Kenney Furniture Kit + Quaternius (CC0, sudah ada) | Lisensi aman untuk situs publik |  |
| Pipeline sprite | Blender 4.x headless + Python | Render GLB dari sudut 2:1, pixelate, kuantisasi palet, lalu jadi atlas | Menggambar semua sprite manual |
| Atlas | free-tex-packer-core (Node) | Atlas WebP/PNG + JSON format Pixi | TexturePacker (berbayar) |
| Touch-up pixel | LibreSprite atau Aseprite | Perbaikan manual ikon dan aksesori kecil |  |
| Tes backend | pytest + hypothesis | Fixture SQLite dari skema asli; tes properti untuk redaksi |  |
| Tes frontend | Vitest + Playwright | Unit (pathfinding, depth, choreographer) + E2E dengan rekaman SSE dan screenshot |  |
| Deploy | systemd user service + Caddy | Caddy `file_server` untuk aset statis, `/api/*` di-proxy ke uvicorn |  |

### Yang dibuang dari v1

- Three.js, GLTFLoader, dan model GLB di runtime. File GLB-nya tetap dipakai, tapi hanya di pipeline build.
- React Flow / Mission Control DAG (keluar dari V1).
- inotify log harvester dan `live_bridge.py`, diganti poller SQLite.
- DuckDB di office.

### Konvensi isometrik

- Proyeksi dimetrik 2:1 dengan tile 64×32 px: `screenX = (gx − gy) × 32`, `screenY = (gx + gy) × 16`.
- Kamera Blender ortografik dengan rotasi X = 60° dan Z = 45°, yang menghasilkan rasio 2:1.
- Sprite dirender pada 1× lalu ditampilkan dengan skala integer (1×, 2×, 3×) dan `scaleMode: 'nearest'`.
- Kanvas karakter 48×64 px dengan anchor di tengah bawah (kaki).
- Arah karakter: render SE (menghadap depan) dan NE (membelakangi). SW dan NW didapat dari mirror horizontal.
- Depth sort memakai `zIndex = (gx + gy) × 1000 + layer`, dihitung dari titik kaki. Furnitur statis yang tidak tinggi di-bake ke layer lantai.

### Budget performa

| Metrik | Target |
| --- | --- |
| FPS | 60 p95 di laptop dengan GPU terintegrasi, zoom 2× |
| Draw call per frame | < 30 |
| Initial load (gzip) | ≤ 5 MB total; JS ≤ 400 KB |
| Memori tab setelah 30 menit | < 300 MB, tanpa tren naik |
| Lag status Hermes → layar | ≤ 2 dtk |
| RAM backend | < 150 MB |
