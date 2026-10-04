# DOM export preparation

The existing Blender character/environment scripts and licensed models remain the production basis. No Blender render has run on this Windows machine. Do not treat this preparation or the baseline preview as approved art.

Run `python scripts/visual_migration_art_jobs.py --preview` from the repository root to derive all 17 character jobs, the animation minima, all 17 zone boundaries, slots and doors from the checked-out sources. Calling it without `--preview` exits 1 deliberately while the release art gate is blocked.

Final Blender work must lock the 60°, 0°, 45° orthographic camera, render gx+/gy+/up markers and verify SE/SW/NE/NW orientation. Render at 2× raster resolution; retain logical 64×32 tiles and foot anchor (0.5, 0.92). Use the selected concept as a material and silhouette reference, then remodel/refine forms against the character identity table. Render original accessories in every view; do not synthesize west views by flipping.

The baseline `render_single_character` currently hardcodes only SE/NE and palette quantization. It must be extended and visually calibrated before batch production; neither changing the direction list nor increasing resolution alone is a final style migration. The original renderer is preserved to avoid silently overwriting valid baseline atlases.

After native transparent PNG frames exist, `node art/pipeline/pack_dom_atlas.mjs INPUT OUTPUT CHARACTER_ID 2` adapts the repository packer to CSS-compatible, nonrotated trimmed frames. It writes only the explicitly named output directory, retains original source size/crop offsets, adds exportScale and anchor metadata and refuses a partial multi-page export. It never copies to public/sprites automatically.

For environment layers, use the jobs' exact map coordinates and foot depth. Split wall spans, door jambs, desk front/back, shelves and pool coping into independently sortable pieces. Keep floor/ground shadows low; preserve all door openings. Recompose exported pieces against a full Blender render, using the repository `scripts/compare_scene.py`. This render comparison has not run because Blender is unavailable.

Future manifest: each piece needs file/frame, logical bounds, anchor/crop, gx/gy and z-index, source/license/style version, exportScale and reviewed status. The current preview manifest contains canonical instances from the old environment atlas and is explicitly labeled baseline. Four-direction coverage report rejects it for final release.
