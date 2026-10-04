# DOM export preparation

The existing Blender character/environment scripts and licensed models remain the production basis. No Blender render has run on this Windows machine. Do not treat this preparation or the baseline preview as approved art.

Run `python scripts/visual_migration_art_jobs.py --preview` from the repository root to derive all 17 character jobs, the animation minima, all 17 zone boundaries, slots and doors from the checked-out sources. Calling it without `--preview` exits 1 deliberately while the release art gate is blocked.

Final Blender work must lock the 60°, 0°, 45° orthographic camera, render gx+/gy+/up markers and verify SE/SW/NE/NW orientation. Render at 2× raster resolution; retain logical 64×32 tiles and foot anchor (0.5, 0.92). Use the selected concept as a material and silhouette reference, then remodel/refine forms against the character identity table. Render original accessories in every view; do not synthesize west views by flipping.

The baseline `render_single_character` hardcodes only SE/NE and palette quantization. The separate `render_dom_characters.py` now prepares native SE/SW/NE/NW jobs using its licensed rig/identity/accessory and animation builders. It resets each bone pose before every frame to avoid leaked forearm rotations between actions, uses continuous materials and soft studio lighting, and records model/source/frame hashes. It has not executed inside Blender. Direction labels, accessory silhouettes and the selected style still require review on actual output. The original renderer is preserved.

Preparation, from the repository root (use a fresh output directory each time):

```powershell
python art/pipeline/render_dom_characters.py --plan --character prism --sample --output-dir ../prism-native-plan
```

When a local Blender runtime is authorized and available, the concrete slice command is:

```powershell
& 'C:\path\to\blender.exe' --background --python art/pipeline/render_dom_characters.py -- --character prism --sample --output-dir ../prism-native-candidate
```

The script first renders emission markers and measures actual PNG centroids for gx+, gy+ and up. It refuses to start the character batch if measured vectors differ by more than 1.25 raster pixels. Ground units share the logical 32/16 projection basis; the 64×96 logical canvas uses 2× raster pixels and retains the (.5,.92) pivot. PNG alpha touching any canvas edge or empty output stops the batch. It preserves partial frames for diagnosis, refuses nonempty output directories and disallows writes to public assets, source models and baseline dist. No calibration/render/style pass is claimed by `--plan`.

Full roster preparation produced 2,312 mandatory native frames; the Prism slice produces 48. Full renders retain `pray` and signature action aliases with explicit native-frame provenance. Packing/review/install remain separate; all candidate ledgers keep `finalArt=false`.

Technical references: [Blender render resolution API](https://docs.blender.org/api/5.3/bpy.types.RenderSettings.html), [Blender image buffers](https://docs.blender.org/api/5.2/bpy.types.Image.html), [AgX release documentation](https://developer.blender.org/docs/release_notes/4.0/color_management/). These support the API choices; they do not verify this unexecuted renderer.

After native transparent PNG frames exist, `node art/pipeline/pack_dom_atlas.mjs INPUT OUTPUT CHARACTER_ID 2` adapts the repository packer to CSS-compatible, nonrotated trimmed frames. It writes only the explicitly named output directory, retains original source size/crop offsets, adds exportScale and anchor metadata and refuses a partial multi-page export. It never copies to public/sprites automatically.

For environment layers, use the jobs' exact map coordinates and foot depth. Split wall spans, door jambs, desk front/back, shelves and pool coping into independently sortable pieces. Keep floor/ground shadows low; preserve all door openings. Recompose exported pieces against a full Blender render, using the repository `scripts/compare_scene.py`. This render comparison has not run because Blender is unavailable.

Future manifest: each piece needs file/frame, logical bounds, anchor/crop, gx/gy and z-index, source/license/style version, exportScale and reviewed status. The current preview manifest contains canonical instances from the old environment atlas and is explicitly labeled baseline. Four-direction coverage report rejects it for final release.
