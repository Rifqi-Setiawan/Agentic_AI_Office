# Local review and rollback

Nothing was pushed, merged or deployed. The VPS checkout/services and paused Office Codex/worker tasks were not changed.

Review source in this safe clone on `codex/visual-migration-local`. From `frontend/`, run `npm ci --ignore-scripts` if needed, then:

```powershell
npm run dev -- --host 127.0.0.1 --port 5175 --strictPort
```

Open `http://127.0.0.1:5175/?officeRenderer=claude&seed=42` for the technical preview. Existing Vite fixture API serves local demo telemetry. Open `http://127.0.0.1:5175/?officeRenderer=legacy` or omit the renderer query for rollback. Only the selected world is mounted. Legacy is still the default because final art/QA gates are blocked.

The production build in the local bundle is not a running backend, deployment or authenticated production test. Its experimental route labels data according to the backend rather than falsely claiming a mock source.

For a complete immutable original source, use `../Agentic-office-full-baseline-ae7473c.zip` (packaged as `baseline-full-ae7473c.zip`). The earlier `Agentic-office-baseline-ae7473c.zip` is only the initial frontend subtree backup, preserved separately. Base commit: `ae7473c16cb374544c9118d7d36d90515633fe02`. Local directed commits and patches are supplied with the review bundle. Avoid resetting another checkout or overwriting existing work; unpack a baseline/review archive to a new directory.

No production rollback command is proposed or executed. Deploy/rollback target, exact release commit and operational approval are required in a later user instruction.
