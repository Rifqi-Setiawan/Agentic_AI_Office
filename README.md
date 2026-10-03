# Agentic AI Office v2 — Sovereign Multi-Agent 2.5D World

World isometrik 2.5D pixel-art bernuansa *cozy-tech* untuk observasi dan telemetri langsung operasi multi-agent Hermes secara *read-only*.

![Python](https://img.shields.io/badge/Python-3.12-3776AB?logo=python&logoColor=white)
![FastAPI](https://img.shields.io/badge/FastAPI-0.115%2B-009688?logo=fastapi&logoColor=white)
![PixiJS](https://img.shields.io/badge/PixiJS-v8-E72264?logo=pixijs&logoColor=white)
![React](https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=black)
![TypeScript](https://img.shields.io/badge/TypeScript-5.6-3178C6?logo=typescript&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-5-646CFF?logo=vite&logoColor=white)
![CI](https://github.com/Rifqi-Setiawan/Agentic_AI_Office/actions/workflows/ci.yml/badge.svg?branch=office-v2)

---

## 🏛️ Struktur Monorepo

Repository ini disusun sebagai monorepo modular untuk mendukung pengembangan paralel lintas agen:

```text
.
├── .github/workflows/       # GitHub Actions CI (lint: ruff/eslint, typecheck: mypy/tsc, test: pytest/vitest)
├── art/
│   ├── pipeline/            # Skrip Blender headless (render.py) untuk pembuatan sprite 2:1 dimetrik
│   └── sumber/              # Model 3D GLB pihak ketiga (Kenney Furniture & Quaternius Characters, CC0)
├── backend/                 # FastAPI service (:8092), reader SQLite Kanban, normalizer, SSE streaming
├── docs/
│   └── blueprint/           # Arsip spesifikasi dan blueprint lengkap Office v2 (00-08, tasks.yaml)
├── frontend/                # Vite + PixiJS v8 isometric canvas + React 18 HUD + Zustand store
├── ops/                     # Unit systemd service dan konfigurasi reverse proxy Caddy staging
├── LICENSES.md              # Daftar lengkap lisensi aset dan kepatuhan anti-slop / IP
└── README.md
```

---

## 🚀 Persyaratan & Lingkungan

- **Python**: `>= 3.12`
- **Node.js**: `>= 20.x`
- **Blender**: `>= 4.x` (hanya untuk menjalankan pipeline render sprite di laptop lokal)

---

## 🛠️ Pengembangan Lokal

### Backend
```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements-dev.txt

# Menjalankan lint, typecheck, dan tes
ruff check .
ruff format --check .
mypy src tests
pytest -v
```

### Frontend
```bash
cd frontend
npm install

# Menjalankan lint, typecheck, dan tes
npm run lint
npm run typecheck
npm run test
```

---

## 📜 Lisensi & Atribusi Aset
Seluruh model 3D sumber pihak ketiga berlisensi Creative Commons Zero 1.0 Universal (CC0). Tidak ada karakter tiruan berhak cipta. Lihat rincian di [`LICENSES.md`](./LICENSES.md).

Proyek ini dirilis di bawah [MIT License](./LICENSE).

---

## 👤 Author
**Muhammad Rifqi Setiawan**  
GitHub: [@Rifqi-Setiawan](https://github.com/Rifqi-Setiawan)
