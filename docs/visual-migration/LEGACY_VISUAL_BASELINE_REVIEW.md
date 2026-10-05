# Legacy visual baseline review

Review date: 2026-10-05. The legacy Pixi reference is refreshed from the reviewed
LED-normalized CI capture at `5627835`. Every difference from the original has
been mapped to approved Z08 changes or explicitly normalized capture phases.
The original reference remains available in Git history; no threshold or world
mask was changed. A subsequent strict CI comparison verifies this reference.

## Reference and source history

- Reference: [baseline_scene.png](../../frontend/e2e/screenshots/baseline_scene.png)
- Original reference commit: `ae7473c16cb374544c9118d7d36d90515633fe02`
- Original reference SHA-256: `e790df8ef5f35a195bc81856cc2da7cf98932b1625b67b542570b5eeb4c2c49a`
- Approved layout commits: `de00b6cae04dbdbb02e62554474c1cef2c412edd`
  and `d06f1bf10ada5dac60138b9f717ee7cebfe90b15`
- Layout authorization record:
  [approved-layout-adjustments.json](approved-layout-adjustments.json)

Applying the recorded adjustments sequentially to the reference-era map exactly
reproduces the current furniture and collision layers. The visible changes are
nine Z08 furniture cells and the Guest relocation from `(17,18)`, facing SE, to
`(22,12)`, facing NE, including the approved sofa/TV arrangement. The relevant
legacy character code, vitals renderer, and environment/character atlases are
unchanged from the reference commit.

## Pixel accounting before LED normalization

The audited `26dcc1b` capture has SHA-256
`d02a4e5261e3186d98c544119c3ce99d6585ba3c63931f5f57e14152ee6232f7`.
Its 9,684 changed pixels form 145 eight-connected regions. Every region was
classified against map changes, atlas frames, or documented procedural bounds.

| Source of difference | Pixels | Evidence |
| --- | ---: | --- |
| Approved Z08 furniture and Guest relocation | 7,067 | Changed map cells and actual atlas alpha footprints |
| Character atlas frame phase | 2,309 | Differences between unchanged atlas frames at their projected positions |
| Character badge and crown phase | 228 | Existing procedural badge/crown drawing and animation bounds |
| Two HUD pulse indicators | 64 | CSS pulse dots at `(212–217,18–23)` and `(250–255,93–98)` |
| Server-rack LED phase | 16 | Four clipped LED rectangles from rack `(42,16)` |
| **Total** | **9,684** | **No uncovered changed pixels** |

The old capture best matches frame 1 for Prism, Forge, Nova, Steward, Sentinel,
and Relay, and frame 2 for Rifqi. The current test explicitly calls
`gotoAndStop(0)`. Combined atlas and procedural differences per actor are:
Prism 515, Forge 848, Nova 83, Steward 510, Sentinel 265, Relay 148, and Rifqi 168
pixels, totaling 2,537. This attribution is source-based forensic coverage, not
a new screenshot mask.

## Deterministic capture and acceptance criteria

[office-scenarios.spec.ts](../../frontend/e2e/office-scenarios.spec.ts) stops the
world ticker after assets load, reconstructs actors at phase zero, and disables
CSS animation for both captures. The screenshot-only correction in `5627835`
also sets the vitals animation time to zero and calls `update(0, actualVitals)`.
Live telemetry behavior and application animation code remain unchanged.

The LED correction addresses a specific remaining timing dependency:
[VitalsEnvironmentManager.ts](../../frontend/src/world/VitalsEnvironmentManager.ts)
selects cyan/green LED phases using `sin(animTime * 4)`. Its four visible
rectangles are at x1274–1276 or x1279, y618–619 or y634–635. Stopping the ticker
alone preserved whichever phase startup happened to reach.

Before this correction, the independent `b191375` and `26dcc1b` captures had
**zero differing world pixels**. Their only differences were the 64 HUD pixels
normalized by disabling CSS animation. The `26dcc1b` immediate repeat also had
zero differences after the existing masks. Fresh LED-normalized results were independently inspected before selecting the
replacement reference.

Acceptance remains strict: 1280×720 dimensions, channel tolerance 8, and zero
changed pixels outside the existing wall-clock and host-percentage masks.
No tolerance increase, world mask, comparator relaxation, or assertion removal
is part of this review.

## Reviewed replacement capture

- Fresh capture commit: `5627835bac0fa2e3747599c802f98be15942e4a4`
- CI run: [37319347544](https://github.com/Rifqi-Setiawan/Agentic_AI_Office/actions/runs/37319347544)
- Candidate and repeat SHA-256: `7ee301c5167d5c998bf855c02affbbc2f17660e49059fd1c92270708e4586963`
- Replacement reference uses those exact, unedited PNG bytes
- Repeat comparison: byte-identical; zero changed pixels
- Compared with `26dcc1b`: exactly 16 changed pixels above tolerance 8, all at
  the documented rack LEDs; 887 one-channel-level variations remain below the
  unchanged tolerance
- Compared with the original reference: 9,668 changed pixels, exactly the
  reviewed 9,684 minus the 16 normalized LED pixels
- All other six CI jobs and 37 of 38 browser tests passed on the source capture;
  the sole failing test was its expected comparison with the obsolete reference
- Final subsequent CI verification: pending at this commit; inspect the commit's
  CI status for its terminal result

The refreshed reference was visually inspected and independently reviewed
against the source-mapped regions. This review does not establish final visual
acceptance or performance approval of the illustrated renderer, and it does not
authorize a production deployment.
