# Tooling

- Windows PowerShell; Git, Node, npm and Python 3.13 are available.
- `npm ci --ignore-scripts --no-audit --no-fund` completed in frontend. Lockfile retained; no W17ant startup script or hooks run.
- Repository scripts: lint, typecheck, test, build, test:e2e.
- Vite runs locally, bound to 127.0.0.1:5175. Its existing API plugin serves fixtures; no Office worker or production API is started.
- Built-in image generation is available for concept/style references, without an API key or paid chat integration in the application.
- Browser: Codex IAB rendered baseline and DOM preview before interruption. agent-browser 0.38.2 is isolated in `../tooling/`; Edge failed before DevTools activation and all three Chrome download attempts timed out. Playwright CLI launch failed because Chromium headless-shell is absent. After the environment interruption, rebinding the error-page tab was rejected by browser URL protocol policy. No workaround was attempted. See BROWSER_QA.md for verified and pending actions.
- Blender executable was not found in PATH, Program Files or Local Programs. No Blender installation is authorized by the supplied pipeline brief. Native four-direction art generation and layered geometry render validation are blocked pending a local Blender runtime. Existing GLB models and pipeline source are present.
- SSH was used only for read-only git HEAD/branch/status inspection. No VPS source, service, configuration, secret or gateway was changed.
