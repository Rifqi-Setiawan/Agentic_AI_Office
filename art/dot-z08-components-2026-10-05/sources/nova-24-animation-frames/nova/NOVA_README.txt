NOVA ANIMATION KEYFRAMES

24 selected PNG files: 4 directions x (2 sitting/typing + 4 walking).
Directions follow the supplied reference sheet: SE top-left, SW top-right,
NE bottom-left, NW bottom-right. Each PNG contains one full-body character.
No chair, desk, keyboard or environment is embedded.

PLAYBACK
Typing: frames 0, 1, repeat. Suggested 3.5 fps; tune between 3 and 4 fps.
Walking: frames 0, 1, 2, 3, repeat. Suggested 7 fps; tune between 6 and 8 fps.
Walking uses contact, passing, opposite contact and opposite passing keys.
These are sparse keyframe loops; smooth playback is not certified.

PIXELS AND TRANSPARENCY
Generated and edited exclusively with built-in imagegen. PNG pixels were not
cropped, resized, recolored, mirrored, alpha-cleaned or programmatically edited.
All selected outputs are native 1254 x 1254 RGBA. The tool returned this size
despite the first requests for 1024 x 1024. Genuine transparent alpha is present.
There can be extremely faint outer alpha specks. QA bounds use alpha > 128;
other validation reports specify their own threshold.

REGISTRATION AND LIMITATIONS
Frames were generated from a direction-specific base, with subsequent edits
targeting only hands/wrists or walking limbs. Head and body positions remain
close within each sequence, but generative redraws are not pixel-identical.
Typing top/sole silhouettes drift about 0-2 pixels within each direction.
Walking soles move as part of the gait; their extrema are NOT a stable pivot.
Do not recenter each frame by its visible bounding box.

Use one fixed canvas-space registration per sequence. The manifest includes
approximate neck feature points as a visual alignment aid, not physical ground
pivots. Ground pivots and world-space tile scale remain uncalibrated (null).
Cross-direction body scale and foot placement differ slightly. Sitting and
walking were separate bases. Align direction/action transitions in the target
engine and adjust runtime metadata before production use. No engine or animated
preview was run, and no claim of a perfectly smooth or jump-free loop is made.

Gold hair clip visibility matches the reference: visible SE/NW, hidden SW/NE.
The black jacket back remains plain in rear views. Some small linework, clothing
fold and lighting variations remain from generative edits.

CONTENTS
nova-animation-manifest.json: explicit frame order, native file sizes, alpha
checks, checksums and proposed registration metadata.
nova-typing-prompts.json: exact typing prompts and selected scale correction.
nova_walk_front_prompts.txt and rear prompt file: exact walk prompts.
Validation JSON files: read-only image measurements and limitations.

Discarded alternatives are excluded from this ZIP.
