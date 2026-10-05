# Pembaruan aktif: ilustrasi 2D Z08, 5 Oktober 2026

Brief terbaru mengganti ketentuan Blender/GLB/native render/kuota frame. Kandidat Z08 + Prism sudah dibuat dan terhubung lokal. 40 file/291 tes, typecheck/lint/build lulus; QA browser dan walk cycle belum lulus; user style approval diperlukan sebelum batch. Lihat CHECKPOINT_2D.md, STATUS.md, ART_BIBLE_2D.md dan ACCEPTANCE_2D.md. Bagian di bawah adalah catatan historis, bukan instruksi produksi aktif.

# Pembaruan tooling — 5 Oktober 2026

Blender 4.5.14 LTS portable kini tersedia di `../tooling/blender-runtime/blender-4.5.14-windows-x64/blender.exe`, dipasang setelah instruksi eksplisit user. Checksum resmi ZIP cocok. Kalibrasi Cycles/OPTIX RTX 3050 lulus pada render marker nyata. Import glTF bawaan gagal karena DLL NumPy diblokir Application Control; parser data GLB standard-library berhasil membaca Prism. Sampel terakhir berhenti setelah 11 PNG karena sit_type gagal validator. Environment renderer belum dieksekusi. Tool browser tetap belum bisa melakukan QA akhir.

**Catatan berikut adalah histori sebelum pemasangan ini; izin pemasangan tidak lagi pending.**

# Tooling

- Windows PowerShell; Git, Node, npm and Python 3.13 are available.
- `npm ci --ignore-scripts --no-audit --no-fund` completed in frontend. Lockfile retained; no W17ant startup script or hooks run.
- Repository scripts: lint, typecheck, test, build, test:e2e.
- Vite runs locally, bound to 127.0.0.1:5175. Its existing API plugin serves fixtures; no Office worker or production API is started.
- Built-in image generation is available for concept/style references, without an API key or paid chat integration in the application.
- Browser: Codex IAB rendered baseline and DOM preview before interruption. agent-browser 0.38.2 is isolated in `../tooling/`; Edge failed before DevTools activation and all three Chrome download attempts timed out. Playwright CLI launch failed because Chromium headless-shell is absent. After the environment interruption, rebinding the error-page tab was rejected by browser URL protocol policy. No workaround was attempted. See BROWSER_QA.md for verified and pending actions.
- Blender executable was not found in PATH, Program Files or Local Programs. No Blender installation is authorized by the supplied pipeline brief. Native four-direction art generation and layered geometry render validation are blocked pending a local Blender runtime. Existing GLB models and pipeline source are present.
- SSH was used only for read-only git HEAD/branch/status inspection. No VPS source, service, configuration, secret or gateway was changed.
- Latest continuation: localhost port 5175 was already listening, so no server/worker restart was needed. Exact ambient HTTP tab binding was denied again by browser URL policy. This did not provide evidence of page state or a new screenshot.
- Official local Blender installation authorization was requested and is still pending. Nothing was installed. The new candidate character script can validate jobs under normal Python; its Blender camera-marker/material/pose/render branches are unexecuted.
- `render_dom_characters.py --plan` prepared Prism/all-roster jobs; `py_compile` passed; coverage/output-protection/no-runtime failure checks passed. Rendering without Blender returned exit 2 and created no output directory. Evidence: `native-plan-check.json`, `native-render-no-runtime.log`.
