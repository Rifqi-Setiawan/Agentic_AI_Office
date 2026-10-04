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

Do not infer motion footage from screenshots. The model clock ran, and differential movement tests passed, but a saved real browser movement recording is pending. The final art gate is independently blocked by Blender.

Latest camera/CPU LED/AC airflow/reduced-motion fixes have passed typecheck/lint/build and model/camera tests. They remain visually unverified because the current browser binding is denied. Unit-test headless benchmark FPS is not browser render FPS.
