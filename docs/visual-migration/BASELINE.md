# Baseline audit — 4 October 2026 (WIB)

GitHub HEAD, freshly cloned local HEAD and the read-only VPS checkout all resolve to `ae7473c16cb374544c9118d7d36d90515633fe02`. VPS branch `office-v2` is clean. Local branch is `codex/visual-migration-local`; no existing user checkout was overwritten. No repository AGENTS.md was found. Planning source is `../migration-plan/`, extracted from the supplied ZIP. The latest chat authorizes autonomous ordinary style review and local implementation; it forbids push and deployment.

Before source changes, `git archive` saved `../Agentic-office-baseline-ae7473c.zip`. The map matches the supplied snapshot in every zone, slot, door and collision value; see `layout-verification.json`. Projection remains 64×32, origin (1088,64), world 2560×1440. The map has 17 zones, 133 interaction slots and 26 doors, including two complete corridors.

FastAPI `backend/src/office/main.py` already starts and stops TelemetryCoordinator in its lifespan. This is a fixed baseline, not migration work. Backend, authentication, telemetry contracts and production stay unchanged.

The legacy browser was inspected at localhost using repository fixture APIs. Its environment and characters are the existing low-resolution procedural atlases. Both west facings are mirrored from east-facing artwork. That is an existing limitation and cannot satisfy the native four-direction art target.

W17ant source was cloned at `291e7608aa3beb614aca80fe86077ef8c0cbc21d`. Actual `public/rooms/office-day.png` was viewed. Character.tsx, FurnitureRenderer.tsx, PlacementHelper.tsx, assets.ts and rooms.css were audited as presentation references. Their room percentages, generic role mapping, random turn behavior and task simulation must not be imported.

The room illustration is a style reference only; it is not the destination office map. Code is MIT, copyright 2026 W17ANT. No reference artwork has been copied into production assets; per-asset authorship remains to be verified before reuse.

Implementation: extract renderer-independent character/registry contracts, keep the existing choreographer/navigation rules, add a DOM camera and global depth hierarchy, read the same store, select exactly one renderer through a lazy rollback route, then integrate deterministic asset metadata. Until new Blender output exists the DOM preview must visibly identify its art as baseline, and cannot be called final visual migration.
