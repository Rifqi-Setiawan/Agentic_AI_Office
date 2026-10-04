# Sources and adaptations

Office baseline: Rifqi-Setiawan/Agentic_AI_Office, commit `ae7473c16cb374544c9118d7d36d90515633fe02`. W17ant reference: W17ant/Claude-Office, commit `291e7608aa3beb614aca80fe86077ef8c0cbc21d`. Both were cloned and read locally; reference startup scripts, Claude hooks and permission configuration were not run.

| Verified reference file | Local adaptation | Changes and limits |
|---|---|---|
| W17ant `src/components/Character.tsx` | `frontend/src/world/scene/SceneSprites.tsx`, `DomWorld.ts` | Ports absolute character wrapper, ground shadow, sprite and effect/name presentation to model-driven atlas frames. Uses original Office IDs and four canonical facing labels, logical foot depth and existing animation actions. Removes role fallback, percentage positions, random turn timers and reference state mapping. This is a presentation port, not a copy of its agent manager. |
| W17ant `src/components/FurnitureRenderer.tsx` | `SceneSprites.tsx`, `AssetRegistry.ts` | Ports independent furniture overlays to canonical map instances with atlas/crop metadata and global depth. Hotspots remain Office grid interactions. Missing/rotated frames fail explicitly. |
| W17ant `src/styles/rooms.css` | `scene.css`, `OfficeScene.tsx` | Adapts dark sidebar, active marker and viewport/sidebar structure. All 17 destinations focus one continuous world; does not copy the reference's disconnected room layout or fade replacement. |
| W17ant `src/components/PlacementHelper.tsx` | `OfficeScene.tsx` debug slot/door markers | Inspected for calibration presentation. Map-derived grid/anchor overlay is a new implementation; no percentage placement editor or logical map editing is imported. |
| W17ant `public/rooms/office-day.png` | Style reference to built-in imagegen | Viewed as reference only. No room illustration, reference character PNG or third-party room floorplan is copied to production. Its image is not an occlusion/collision source. |
| Office `Character.ts`, `CharacterManager.ts` | `simulation/CharacterModel.ts`, `ModelRegistry.ts`, `roster.ts` | Extracted FSM/movement/work gesture and roster; Pixi drawing removed. Legacy character remains for rollback. Model trace is compared directly with legacy. |
| Office `choreographer/`, `navigation/`, `bubble/` | Registry/type adapters | Choreography/navigation algorithms retained, not replaced with W17ant simulation. Bubble pool retains priority/redaction/cooldown. |
| Office `VitalsEnvironmentManager.ts`, `easterEgg/EasterEggManager.ts` | `simulation/VitalsModel.ts`, `EasterEggModel.ts`, `sceneEffects.ts` | Thresholds, triggers, task priority and timers retained; graphics represented by scene state. Confetti/sweat/AC decorations are baseline preview presentation and need final art review. |
| Office `art/pipeline/pack_characters.js`, `pack_environment.js` | `art/pipeline/pack_dom_atlas.mjs` | Explicit output directory; trim enabled, rotation refused, CSS exportScale/anchor metadata; no automatic production copy. |

W17ant code is MIT, copyright 2026 W17ANT. Full notice is retained in `licenses/W17ant-MIT.txt`. The source repository's license was read; no separate per-image license review is claimed for reference art, which is not redistributed here.

Existing Office models and procedural atlases retain repository attribution in `LICENSES.md`: Kenney Furniture Kit and Quaternius Animated Men, CC0. Three character GLBs and the furniture source folder are present locally. This attribution is based on the checked-out licenses and model inventory; no new external model was downloaded.

The generated `evidence/z08-prism-style-concept.png` is a concept reference produced by the built-in imagegen tool. Its exact prompt is saved in `STYLE_PROMPT.txt`. It does not establish deterministic geometry, native view labels, hand/accessory consistency or release-ready licensing for any newly introduced third-party asset.
