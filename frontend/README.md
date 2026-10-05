# Agentic AI Office — Frontend

Renderer aktif: React/CSS dengan ilustrasi 2.5D; React HUD/Zustand, TypeScript/Vite dan navigasi/simulasi. PixiJS lama tersedia sebagai pembanding. [Handoff lengkap](../docs/HANDOFF_BRE.md), [denah](../docs/OFFICE_LAYOUT.md), [rencana](../docs/PROJECT_PLAN.md).

Default `AO_DOT_ENVIRONMENT_FOUNDATION_V1`: W01/W02 trial, bukan final approved. Perbaiki P0 wall readability sebelum memperluas fondasi. Karakter/dekorasi/layout per-room ditunda; hanya Prism/Forge/Nova mempunyai avatar aktif.

## Lokal

```powershell
npm.cmd ci
npm.cmd run dev -- --host 127.0.0.1 --port 5175 --strictPort
```

Buka `http://127.0.0.1:5175/?officeRenderer=claude&seed=42`. Shell selain Windows gunakan `npm`. Dev/preview Vite menyediakan API dan SSE fixture lewat `mockOfficeApiPlugin()`, tanpa flag environment; hasil ini bukan telemetri VPS live. `officeArt=dot-v2` membandingkan sebelum wall, `officeRenderer=legacy` memilih Pixi lama.

## Pemeriksaan

```powershell
npm.cmd run lint
npm.cmd run typecheck
npm.cmd run test -- --maxWorkers=1 --minWorkers=1
npm.cmd run build
```

Jalankan checks yang relevan untuk perubahan. Bukti terbaru pada trial wall: 28 tes / tujuh file, build/lint lulus; browser Z08/Z01 saja. Build warning vendor Pixi chunk tetap tercatat. Merge/deploy/worker produksi belum diotorisasi dalam handoff.
