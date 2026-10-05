# Bukti browser CI terbaru — 5 Oktober 2026

Commit `902f57b` lulus [run 37321653600](https://github.com/Rifqi-Setiawan/Agentic_AI_Office/actions/runs/37321653600):
38/38 tes Chromium, termasuk scene ilustrasi dengan ground ready tanpa error,
tiga kandidat aktor yang memang tersedia, 133 slot, 26 pintu, 17 ruang, fokus
Z08 dan inspector Prism. Screenshot overview serta inspector asli tersimpan
sebagai artifact CI fixture. Seluruh 356 tes frontend dan 129 tes backend juga
lulus. [Review baseline](LEGACY_VISUAL_BASELINE_REVIEW.md) menjelaskan perubahan
reference legacy; mask dan toleransi tidak dilonggarkan.

Bukti ini berasal dari runner CI terpisah, bukan akses ulang browser lokal yang
terblokir. Data menggunakan fixture, bukan VPS/Hermes. Review seluruh detail
ruang, mobile dan performa scene masih memerlukan evidence tersendiri; hasil ini
bukan approval gaya final atau bukti performa perangkat pengguna.

Catatan di bawah adalah riwayat sebelum checkpoint tersebut.

# Pembaruan orientasi v2

Default preview sekarang memakai meja/kursi yang mengikuti slot SE. Koreksi diperiksa melalui komposisi offline, build/lint, tes renderer dan kontrak map. Belum ada akses browser pulih atau QA browser baru. Detail aktual: ORIENTATION_FIX.md.

# Pembaruan aktif: ilustrasi 2D Z08, 5 Oktober 2026

Brief terbaru mengganti ketentuan Blender/GLB/native render/kuota frame. Kandidat Z08 + Prism sudah dibuat dan terhubung lokal. 40 file/291 tes, typecheck/lint/build lulus; QA browser dan walk cycle belum lulus; user style approval diperlukan sebelum batch. Lihat CHECKPOINT_2D.md, STATUS.md, ART_BIBLE_2D.md dan ACCEPTANCE_2D.md. Bagian di bawah adalah catatan historis, bukan instruksi produksi aktif.

# Actual browser observations — 4–5 October 2026 WIB

All application data below came from the repository's existing localhost mock API plugin, not the VPS/Hermes production stream.

| Action actually executed | Observed result | Evidence/limit |
|---|---|---|
| Open baseline at localhost in Codex IAB | Legacy canvas, 16 agents in HUD, fixture SSE connected, baseline office visible | Saved `evidence/baseline-browser.jpg`, 1280×720. This is a baseline screenshot, not the migrated result. |
| Open `?officeRenderer=claude&seed=42` | React/CSS scene, continuous overview, all 17 room labels and 17 actor nodes; clear baseline-art notice | DOM observations and screenshot displayed in chat. The 133 slots/26 doors are verified by the unchanged map contract, not by a completed browser count assertion. New-scene screenshot was not saved before interruption. |
| Focus Z08 via room button, viewport 1440×900 | Dev Pods enlarged within the same map; adjoining Z07/Z09 and corridors visible; sidebar focus changed | Actual browser screenshot displayed in chat. Not a Blender art/style completion. |
| Close activity feed | Feed collapsed and scene remained available | Actual AX result. Later code makes feed initially collapsed only on the DOM route. |
| Open Founder login and submit a dummy local QA input | Local mock Founder panel displayed; projection became Founder; collective and atmosphere controls visible | No real password or production login used. Auth behavior is provided by unchanged mock API. |
| Read scene DOM diagnostic state | 17 agents, 527 props, one model clock; elapsed simulation time increased to 18.46s/36.26s | Real DOM observations, not simulated output. Early p95 27.8ms, later 20.9ms, during concurrent tool/test work. Not a passing 60fps result. |
| Console inspection during development | One HMR-era `camera.update is not a function` error was found while class files changed; hard reload then scene clock progressed | No clean final-console claim. Final modules compile; browser recheck remains pending. |
| Resume after environment interruption around 00:08 WIB | Local Vite had stopped; old browser tabs showed connection-error pages; restarted only localhost fixture Vite | No VPS service/task restart. |
| Rebind tab 2 after interruption | Browser tool rejected action: URL protocol policy blocks the tab | This is a mandatory browser access blocker. No alternate browser/CDP workaround attempted. |
| Run Playwright DOM scenario | Launch failed before page execution: Chromium headless-shell executable absent | `evidence/playwright-attempt.log`; test assertions did not run. |
| Latest resume: bind exact `http://127.0.0.1:5175/?officeRenderer=claude&seed=42` from ambient tab context | Browser tool again rejected the binding under URL protocol policy, although the requested URL was HTTP | The tab was not inspected and no new screenshots/QA were obtained. No alternate surface or indirect workaround attempted. Access restoration requested. |

Still required: saved overview/detail/movement sequence for the final new scene, Founder floor-click/approach movement, inspector selection, public redaction after logout, unknown event attribution, stale/disconnected visuals, prayer/wudhu four poses, pool/arcade/class events, vitals effects, audio, day/night, 1280×800 and 390×844 responsive checks, reduced motion, hide/resume, rollback and a clean final console. Some behaviors are covered by source-retained existing tests or pure model tests; that does not replace browser acceptance.

Do not infer motion footage from screenshots. The model clock ran, and differential movement tests passed, but a saved real browser movement recording is pending. Blender has since been installed and marker calibration passed; the final art gate remains incomplete because the native sample failed validation and environment/all-roster art is not produced.

Latest camera/CPU LED/AC airflow/reduced-motion fixes have passed typecheck/lint/build and model/camera tests. They remain visually unverified because the current browser binding is denied. Unit-test headless benchmark FPS is not browser render FPS.
