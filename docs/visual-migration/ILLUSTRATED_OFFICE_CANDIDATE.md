# Illustrated Office environment candidate

Continuation of `codex/visual-migration-local` at
`c0a52d15b9b1c5c276292489044b017b74980c77`.

This is an implemented environment candidate, not a final visual acceptance or
production release. The canonical 44×32 map, 17 zones, 133 interaction slots,
26 doors, actor identities and approved Z08 layout remain unchanged.

## Implemented

- A topology-based wall cutaway keeps far exterior backdrops and lowers internal
  boundaries. The raw source-wall image is no longer painted behind its registered
  planes. The change does not alter collision or navigation.
- Shared W01/W02 material registration replaces legacy low walls, corners and
  portal frames. Eight windows use newly generated G01 glass. Lobby door leaves
  that duplicated the canonical opening are retired into the open-jamb assembly.
- Four generated ground materials cover 1,328 cells; all 80 approved Z08 cells
  retain their previous floor. Four temporary material caches feed one static
  canvas. Fourteen generated teal rug overlays replace the inherited rug cells; all 16
  prayer-row interaction slots remain unchanged. Pool geometry is preserved.
- Generated furniture and role-specific decor are registered from their original
  PNGs. Runtime sizes use the approved Z08 desk/chair/sofa as a scale reference.
  Adjacent multi-cell furniture is assembled coherently rather than repeated as
  several complete tables. Long counters and conveyors retain per-cell depth
  through clipped slices of the same artwork.
- Sixteen exact 64×32 stone-top diamonds form a continuous pool coping ring. The
  nine inner water cells and six swimming positions remain clear.
- Thirty-seven seats use four individually generated chair directions: 12
  boardroom replacements, six classroom reorientations, eight cafe additions,
  and 11 staffed-desk additions. Existing logical slots/facings stay unchanged;
  presentation facing is recorded separately so later actor QA can inspect it.
- Seventy new runtime images have lossless WebP encodings. Full decoded RGBA
  equality is checked, including RGB values under transparent pixels. The PNG
  originals remain untouched and remain available as source/fallback files.

## Source and generation provenance

Original generated PNGs and their prompt/provenance/alpha reports are under
`art/generated-office-2026-10-05/`. Source bytes are preserved. Runtime geometry
uses CSS/canvas registration rather than painting over or modifying these PNGs.
Some original images contain faint alpha fringe and approximate perspective;
source clipping and exact floor/wall registration do not certify every furniture
edge or replace visual inspection.

The candidate manifest and machine-readable coverage/registration ledgers are in
`frontend/public/visual-migration/illustrated-office-v1/`. A room with all required
assets registered is still not marked visually complete. Any quarantined input
is explicitly listed in `art/generated-office-2026-10-05/excluded-assets.json`.

Rebuild the candidate from the self-contained source inputs:

```sh
python scripts/register_illustrated_office.py
```

The script requires Pillow for read-only PNG measurements and byte-preserving
copies. It does not run Blender or regenerate the logical map. The map checkout
must honor `.gitattributes` (`floor1.tmj` uses CRLF for its established SHA contract).

## Run and compare

```sh
cd frontend
npm ci
npm run dev -- --host 127.0.0.1 --port 5175 --strictPort
```

Open the app in an environment where local preview access is supported:
`http://127.0.0.1:5175/?officeRenderer=claude&seed=42`.

The new environment is the default. Add `officeArt=foundation-v1` for the previous
foundation candidate, or `officeArt=dot-v2` for the preserved Z08 integration.
The preview uses the repository's demo API fixtures; this does not verify the
production backend or live Hermes connection.

## Verification and remaining gates

Run the final source checks after any generation or registration change:

```sh
python -m unittest discover -s scripts -p 'test_register_*.py'
cd frontend
npm test -- --maxWorkers=1 --minWorkers=1
npm run build
npm run lint
```

Registration tests check map invariants, affine corners, source hashes, ground
coverage, portal/slot centers, lifecycle fallback, and depth-strip continuity.
Center clearance is not proof that every actor body or sprite edge is visible.

An offline composition can reveal scale, material and placement issues, but it
is not a browser screenshot. It omits live actors, the HUD, camera interaction,
DOM/canvas lifecycle and browser-specific clipping. Browser acceptance is still
required for all 17 rooms, day/night changes, camera motion, actor interleaving,
touch/mobile views, repeated joins and source-facing consistency.

The 70 encoded images decrease from 85,055,962 PNG bytes to 53,186,062 WebP bytes
(37.47% smaller); existing Z08 artwork adds to the total request budget. Native
dimensions remain high-resolution. Decode memory, loading time and frame rate
still need browser measurement before production use; passing tests does not
establish those budgets. No merge, deployment, production
restart or external publication is part of this candidate.
