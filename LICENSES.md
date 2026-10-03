# Third-Party Licenses & Asset Attributions

Dokumen ini memuat daftar seluruh aset pihak ketiga, pustaka perangkat lunak, dan ketentuan lisensi yang digunakan dalam proyek **Agentic AI Office v2**.

---

## 1. 3D Model & Source Assets

### Kenney Furniture Kit
- **Penyedia / Kreator**: Kenney (Asset Jesus) — [kenney.nl](https://kenney.nl)
- **Tautan Aset**: [Kenney Furniture Kit](https://kenney.nl/assets/furniture-kit)
- **Lisensi**: Creative Commons Zero 1.0 Universal (CC0 1.0) — Public Domain Dedication
- **Penggunaan**: Model 3D GLB furnitur kantor yang digunakan dalam pipeline render sprite isometrik 2.5D (`art/sumber/furniture/`).
- **Kutipan Lisensi**:
  > "To the extent possible under law, Kenney has waived all copyright and related or neighboring rights to Kenney Furniture Kit. This work is published from: Netherlands."

### Quaternius Animated Men Pack
- **Penyedia / Kreator**: Quaternius — [quaternius.com](https://quaternius.com)
- **Tautan Aset**: [Quaternius Animated Men](https://quaternius.com/packs/animatedmen.html)
- **Lisensi**: Creative Commons Zero 1.0 Universal (CC0 1.0) — Public Domain Dedication
- **Penggunaan**: Model humanoid 3D GLB dasar yang digunakan sebagai basis karakter chibi paper-doll (`art/sumber/characters/`).
- **Kutipan Lisensi**:
  > "All Quaternius assets are completely free and CC0 licensed. You can use them in any project, personal or commercial, without attribution."

---

## 2. Audio & SFX Assets

- **Efek Suara & Atmosfer**: Seluruh aset audio yang akan digunakan pada Fase 1 dan Fase 2 bersumber dari domain publik / CC0 (Freesound CC0 / Kenney Audio) dan dicatat pada saat penambahan.
- Audio diatur melalui pustaka Howler.js dengan status mute default sampai interaksi pertama user.

---

## 3. Kebijakan Anti-Slop & Kepatuhan Hak Cipta (IP Compliance)

1. **Bukan Tiruan Karakter Berhak Cipta**:
   - Desain visual seluruh 15 agent Hermes (termasuk Oracle/Senku, Bastion, dsb.) dirancang secara orisinal dengan siluet unik, aksesori paper-doll khas, dan palet warna terkurasi.
   - Tidak ada aset atau kemiripan hak cipta dari waralaba televisi atau anime pihak ketiga (seperti The Office karya NBC atau Dr. Stone karya Riichiro Inagaki / Boichi).
2. **Tanpa Aset Komersial Berbayar Ilegal**:
   - Hanya aset CC0 atau aset yang memiliki izin penggunaan komersial eksplisit yang diizinkan masuk ke dalam repository.
3. **Verifikasi Jalur Rilis**:
   - Seluruh penambahan aset visual ditinjau oleh Muse (Lead Creative) dan diverifikasi oleh Sentinel sebelum dapat dipublikasikan oleh Relay.

---

## 4. Open-Source Libraries & Dependencies

| Komponen | Pustaka / Modul | Lisensi |
| --- | --- | --- |
| Backend Core | [FastAPI](https://github.com/fastapi/fastapi) | MIT License |
| ASGI Server | [Uvicorn](https://github.com/encode/uvicorn) | BSD 3-Clause License |
| Data Validation | [Pydantic](https://github.com/pydantic/pydantic) | MIT License |
| SSE Streaming | [sse-starlette](https://github.com/sysid/sse-starlette) | BSD 3-Clause License |
| Password Hashing | [argon2-cffi](https://github.com/hynek/argon2-cffi) | MIT License |
| Session Security | [itsdangerous](https://github.com/pallets/itsdangerous) | BSD 3-Clause License |
| WebGL2 Rendering | [PixiJS](https://github.com/pixijs/pixijs) | MIT License |
| Camera & Viewport | [pixi-viewport](https://github.com/davidfig/pixi-viewport) | MIT License |
| Animation Engine | [GSAP 3](https://greensock.com/gsap/) | GreenSock Standard License / Free Web |
| UI Framework | [React 18](https://github.com/facebook/react) | MIT License |
| State Management | [Zustand](https://github.com/pmndrs/zustand) | MIT License |
| CSS Utility | [Tailwind CSS](https://github.com/tailwindlabs/tailwindcss) | MIT License |
| Audio Engine | [Howler.js](https://github.com/goldfire/howler.js) | MIT License |
| Testing | [pytest](https://github.com/pytest-dev/pytest) | MIT License |
| Testing | [Vitest](https://github.com/vitest-dev/vitest) | MIT License |
| Linter & Formatter | [Ruff](https://github.com/astral-sh/ruff) | MIT / Apache-2.0 |
| Type Checkers | [Mypy](https://github.com/python/mypy) & [TypeScript](https://github.com/microsoft/TypeScript) | MIT / Apache-2.0 |
