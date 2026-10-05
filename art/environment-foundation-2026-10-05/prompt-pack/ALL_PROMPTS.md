# Semua prompt lingkungan general

Setiap bagian berdiri sendiri. Attach gambar sesuai daftar pada prompt. Satu bagian = satu PNG.

## F01 — Lantai oak utama

```text
Use case: stylized-concept.
Asset type: reusable isolated 2.5D office architecture game sprite, not a complete room.
Style: match the attached Dot office reference: clean illustrated contours, controlled soft painted shading, matte light honey oak, cool blue-gray wall panels, charcoal trims and tiny restrained cyan accents. Warm, tidy modern office; neither photorealism, pixel art nor shiny low-poly Blender render.
Camera: orthographic 2:1 DIMETRIC. R/+gx goes screen down-right (+32,+16), L/+gy goes down-left (-32,+16). Vertical world edges stay vertical on screen. A floor diamond has width:height 2:1; do not default to 30-degree true isometric or perspective vanishing points.
Lighting: upper-left of the SCREEN, soft and consistent. Generate the requested orientation explicitly, not a horizontal flip of an existing image. Match modular proportions and shared materials; no newly invented theme.
Reference roles: Image 1 is the technical geometry guide only, not an art style. Subsequent attached images are material/shading references only. They are not edit targets. The old native floor panel's diamond ratio/padding and old long-wall proportions are not authoritative geometry; the guide and this prompt control those. Ignore any characters, furniture and decorations visible in a context reference.
Output: exactly ONE complete isolated PNG image with true RGBA transparency, preferably a 1024x1024 native canvas with at least 8% transparent padding on every side. Keep the complete contour inside the canvas. No spritesheet, contact sheet, alternatives, labels, ID numbers, dimensions drawn on the image, watermark or logo. No black/white/background rectangle, fake checkerboard transparency, baked surrounding room/floor, background glow or cast shadow stretching outside the object. Keep subtle contact shading within the object.
Avoid: people, AI agents, characters, desk, chair, sofa, TV, rugs, plants, posters, bookshelves, room-specific decorations, full office/room compositions, doors added to plain-wall jobs, random objects and extra architecture beyond the requested single module.
Numbers below are engine registration targets, not annotations to draw. A larger native canvas is fine; correct geometry/proportions matter more than guessing the final packing dimensions. Do not claim exact alpha, seamless tiling, grid registration or engine acceptance without checking actual exported pixels.

Input images to attach, in this order:
Image 1: 01-geometri-2-to-1.png
Image 2: 02-oak-reference.png

Primary request (F01):
One seamless single-tile honey/light-oak floor diamond. Fine quiet wood grain and staggered plank joints running along R. No perimeter outline, slab sides or edge bevel; a flat surface that can repeat across a whole office. Match opposite edges for a continuous plank pattern.

Target geometry for later packing:
{"footprintTiles": [1, 1], "logicalDiamond": [64, 32], "packedDiamondPx": [128, 64], "thickness": 0}

Suggested downloaded filename: F01-floor-oak-a.png
Return the single image. Do not create a room, combine modules or generate the other jobs from this pack.
```

## F02 — Variasi lantai oak

```text
Use case: stylized-concept.
Asset type: reusable isolated 2.5D office architecture game sprite, not a complete room.
Style: match the attached Dot office reference: clean illustrated contours, controlled soft painted shading, matte light honey oak, cool blue-gray wall panels, charcoal trims and tiny restrained cyan accents. Warm, tidy modern office; neither photorealism, pixel art nor shiny low-poly Blender render.
Camera: orthographic 2:1 DIMETRIC. R/+gx goes screen down-right (+32,+16), L/+gy goes down-left (-32,+16). Vertical world edges stay vertical on screen. A floor diamond has width:height 2:1; do not default to 30-degree true isometric or perspective vanishing points.
Lighting: upper-left of the SCREEN, soft and consistent. Generate the requested orientation explicitly, not a horizontal flip of an existing image. Match modular proportions and shared materials; no newly invented theme.
Reference roles: Image 1 is the technical geometry guide only, not an art style. Subsequent attached images are material/shading references only. They are not edit targets. The old native floor panel's diamond ratio/padding and old long-wall proportions are not authoritative geometry; the guide and this prompt control those. Ignore any characters, furniture and decorations visible in a context reference.
Output: exactly ONE complete isolated PNG image with true RGBA transparency, preferably a 1024x1024 native canvas with at least 8% transparent padding on every side. Keep the complete contour inside the canvas. No spritesheet, contact sheet, alternatives, labels, ID numbers, dimensions drawn on the image, watermark or logo. No black/white/background rectangle, fake checkerboard transparency, baked surrounding room/floor, background glow or cast shadow stretching outside the object. Keep subtle contact shading within the object.
Avoid: people, AI agents, characters, desk, chair, sofa, TV, rugs, plants, posters, bookshelves, room-specific decorations, full office/room compositions, doors added to plain-wall jobs, random objects and extra architecture beyond the requested single module.
Numbers below are engine registration targets, not annotations to draw. A larger native canvas is fine; correct geometry/proportions matter more than guessing the final packing dimensions. Do not claim exact alpha, seamless tiling, grid registration or engine acceptance without checking actual exported pixels.

Input images to attach, in this order:
Image 1: 01-geometri-2-to-1.png
Image 2: 02-oak-reference.png

Primary request (F02):
One alternate honey/light-oak single-tile floor diamond. Keep exactly the same shade, plank width, direction and edge pattern as F01. Change only quiet interior grain; no stain, unique knot landmark or decorative motif. This is a same-material variation, not another room theme.

Target geometry for later packing:
{"footprintTiles": [1, 1], "logicalDiamond": [64, 32], "packedDiamondPx": [128, 64], "thickness": 0}

Suggested downloaded filename: F02-floor-oak-b.png
Return the single image. Do not create a room, combine modules or generate the other jobs from this pack.
```

## F03 — Lantai koridor abu-abu

```text
Use case: stylized-concept.
Asset type: reusable isolated 2.5D office architecture game sprite, not a complete room.
Style: match the attached Dot office reference: clean illustrated contours, controlled soft painted shading, matte light honey oak, cool blue-gray wall panels, charcoal trims and tiny restrained cyan accents. Warm, tidy modern office; neither photorealism, pixel art nor shiny low-poly Blender render.
Camera: orthographic 2:1 DIMETRIC. R/+gx goes screen down-right (+32,+16), L/+gy goes down-left (-32,+16). Vertical world edges stay vertical on screen. A floor diamond has width:height 2:1; do not default to 30-degree true isometric or perspective vanishing points.
Lighting: upper-left of the SCREEN, soft and consistent. Generate the requested orientation explicitly, not a horizontal flip of an existing image. Match modular proportions and shared materials; no newly invented theme.
Reference roles: Image 1 is the technical geometry guide only, not an art style. Subsequent attached images are material/shading references only. They are not edit targets. The old native floor panel's diamond ratio/padding and old long-wall proportions are not authoritative geometry; the guide and this prompt control those. Ignore any characters, furniture and decorations visible in a context reference.
Output: exactly ONE complete isolated PNG image with true RGBA transparency, preferably a 1024x1024 native canvas with at least 8% transparent padding on every side. Keep the complete contour inside the canvas. No spritesheet, contact sheet, alternatives, labels, ID numbers, dimensions drawn on the image, watermark or logo. No black/white/background rectangle, fake checkerboard transparency, baked surrounding room/floor, background glow or cast shadow stretching outside the object. Keep subtle contact shading within the object.
Avoid: people, AI agents, characters, desk, chair, sofa, TV, rugs, plants, posters, bookshelves, room-specific decorations, full office/room compositions, doors added to plain-wall jobs, random objects and extra architecture beyond the requested single module.
Numbers below are engine registration targets, not annotations to draw. A larger native canvas is fine; correct geometry/proportions matter more than guessing the final packing dimensions. Do not claim exact alpha, seamless tiling, grid registration or engine acceptance without checking actual exported pixels.

Input images to attach, in this order:
Image 1: 01-geometri-2-to-1.png
Image 2: 03-wall-tall-R-reference.png
Image 3: 02-oak-reference.png

Primary request (F03):
One seamless single-tile warm charcoal-gray matte stone/ceramic floor diamond. Subtle thin grout, low contrast, clean modern office material. No wood grain, logos, arrows, tile-border outline or slab sides. Repeatable edges; avoid a checkerboard contrast when tiled.

Target geometry for later packing:
{"footprintTiles": [1, 1], "logicalDiamond": [64, 32], "packedDiamondPx": [128, 64], "thickness": 0}

Suggested downloaded filename: F03-floor-corridor-gray.png
Return the single image. Do not create a room, combine modules or generate the other jobs from this pack.
```

## F04 — Lantai outdoor antiselip

```text
Use case: stylized-concept.
Asset type: reusable isolated 2.5D office architecture game sprite, not a complete room.
Style: match the attached Dot office reference: clean illustrated contours, controlled soft painted shading, matte light honey oak, cool blue-gray wall panels, charcoal trims and tiny restrained cyan accents. Warm, tidy modern office; neither photorealism, pixel art nor shiny low-poly Blender render.
Camera: orthographic 2:1 DIMETRIC. R/+gx goes screen down-right (+32,+16), L/+gy goes down-left (-32,+16). Vertical world edges stay vertical on screen. A floor diamond has width:height 2:1; do not default to 30-degree true isometric or perspective vanishing points.
Lighting: upper-left of the SCREEN, soft and consistent. Generate the requested orientation explicitly, not a horizontal flip of an existing image. Match modular proportions and shared materials; no newly invented theme.
Reference roles: Image 1 is the technical geometry guide only, not an art style. Subsequent attached images are material/shading references only. They are not edit targets. The old native floor panel's diamond ratio/padding and old long-wall proportions are not authoritative geometry; the guide and this prompt control those. Ignore any characters, furniture and decorations visible in a context reference.
Output: exactly ONE complete isolated PNG image with true RGBA transparency, preferably a 1024x1024 native canvas with at least 8% transparent padding on every side. Keep the complete contour inside the canvas. No spritesheet, contact sheet, alternatives, labels, ID numbers, dimensions drawn on the image, watermark or logo. No black/white/background rectangle, fake checkerboard transparency, baked surrounding room/floor, background glow or cast shadow stretching outside the object. Keep subtle contact shading within the object.
Avoid: people, AI agents, characters, desk, chair, sofa, TV, rugs, plants, posters, bookshelves, room-specific decorations, full office/room compositions, doors added to plain-wall jobs, random objects and extra architecture beyond the requested single module.
Numbers below are engine registration targets, not annotations to draw. A larger native canvas is fine; correct geometry/proportions matter more than guessing the final packing dimensions. Do not claim exact alpha, seamless tiling, grid registration or engine acceptance without checking actual exported pixels.

Input images to attach, in this order:
Image 1: 01-geometri-2-to-1.png
Image 2: 03-wall-tall-R-reference.png
Image 3: 02-oak-reference.png

Primary request (F04):
One seamless single-tile light blue-gray matte stone pool-deck floor diamond. Restrained fine non-slip texture, dry surface, no cracks or vegetation. Same outline/shading language as the office references. No coping, water, furniture, rim outline or slab sides.

Target geometry for later packing:
{"footprintTiles": [1, 1], "logicalDiamond": [64, 32], "packedDiamondPx": [128, 64], "thickness": 0}

Suggested downloaded filename: F04-floor-outdoor-stone.png
Return the single image. Do not create a room, combine modules or generate the other jobs from this pack.
```

## F05 — Tepi platform R

```text
Use case: stylized-concept.
Asset type: reusable isolated 2.5D office architecture game sprite, not a complete room.
Style: match the attached Dot office reference: clean illustrated contours, controlled soft painted shading, matte light honey oak, cool blue-gray wall panels, charcoal trims and tiny restrained cyan accents. Warm, tidy modern office; neither photorealism, pixel art nor shiny low-poly Blender render.
Camera: orthographic 2:1 DIMETRIC. R/+gx goes screen down-right (+32,+16), L/+gy goes down-left (-32,+16). Vertical world edges stay vertical on screen. A floor diamond has width:height 2:1; do not default to 30-degree true isometric or perspective vanishing points.
Lighting: upper-left of the SCREEN, soft and consistent. Generate the requested orientation explicitly, not a horizontal flip of an existing image. Match modular proportions and shared materials; no newly invented theme.
Reference roles: Image 1 is the technical geometry guide only, not an art style. Subsequent attached images are material/shading references only. They are not edit targets. The old native floor panel's diamond ratio/padding and old long-wall proportions are not authoritative geometry; the guide and this prompt control those. Ignore any characters, furniture and decorations visible in a context reference.
Output: exactly ONE complete isolated PNG image with true RGBA transparency, preferably a 1024x1024 native canvas with at least 8% transparent padding on every side. Keep the complete contour inside the canvas. No spritesheet, contact sheet, alternatives, labels, ID numbers, dimensions drawn on the image, watermark or logo. No black/white/background rectangle, fake checkerboard transparency, baked surrounding room/floor, background glow or cast shadow stretching outside the object. Keep subtle contact shading within the object.
Avoid: people, AI agents, characters, desk, chair, sofa, TV, rugs, plants, posters, bookshelves, room-specific decorations, full office/room compositions, doors added to plain-wall jobs, random objects and extra architecture beyond the requested single module.
Numbers below are engine registration targets, not annotations to draw. A larger native canvas is fine; correct geometry/proportions matter more than guessing the final packing dimensions. Do not claim exact alpha, seamless tiling, grid registration or engine acceptance without checking actual exported pixels.

Input images to attach, in this order:
Image 1: 01-geometri-2-to-1.png
Image 2: 03-wall-tall-R-reference.png

Primary request (F05):
One exposed front slab edge along R, length one grid edge. Thin blue-gray structural fascia below ground level, depth four logical pixels. No top floor surface or wall. Modular end faces, subtle underside shading entirely within the object. This attaches below the floor perimeter, not on every floor tile.

Target geometry for later packing:
{"axis": "R", "lengthTiles": 1, "belowFloorDepth": 4}

Suggested downloaded filename: F05-platform-edge-r.png
Return the single image. Do not create a room, combine modules or generate the other jobs from this pack.
```

## F06 — Tepi platform L

```text
Use case: stylized-concept.
Asset type: reusable isolated 2.5D office architecture game sprite, not a complete room.
Style: match the attached Dot office reference: clean illustrated contours, controlled soft painted shading, matte light honey oak, cool blue-gray wall panels, charcoal trims and tiny restrained cyan accents. Warm, tidy modern office; neither photorealism, pixel art nor shiny low-poly Blender render.
Camera: orthographic 2:1 DIMETRIC. R/+gx goes screen down-right (+32,+16), L/+gy goes down-left (-32,+16). Vertical world edges stay vertical on screen. A floor diamond has width:height 2:1; do not default to 30-degree true isometric or perspective vanishing points.
Lighting: upper-left of the SCREEN, soft and consistent. Generate the requested orientation explicitly, not a horizontal flip of an existing image. Match modular proportions and shared materials; no newly invented theme.
Reference roles: Image 1 is the technical geometry guide only, not an art style. Subsequent attached images are material/shading references only. They are not edit targets. The old native floor panel's diamond ratio/padding and old long-wall proportions are not authoritative geometry; the guide and this prompt control those. Ignore any characters, furniture and decorations visible in a context reference.
Output: exactly ONE complete isolated PNG image with true RGBA transparency, preferably a 1024x1024 native canvas with at least 8% transparent padding on every side. Keep the complete contour inside the canvas. No spritesheet, contact sheet, alternatives, labels, ID numbers, dimensions drawn on the image, watermark or logo. No black/white/background rectangle, fake checkerboard transparency, baked surrounding room/floor, background glow or cast shadow stretching outside the object. Keep subtle contact shading within the object.
Avoid: people, AI agents, characters, desk, chair, sofa, TV, rugs, plants, posters, bookshelves, room-specific decorations, full office/room compositions, doors added to plain-wall jobs, random objects and extra architecture beyond the requested single module.
Numbers below are engine registration targets, not annotations to draw. A larger native canvas is fine; correct geometry/proportions matter more than guessing the final packing dimensions. Do not claim exact alpha, seamless tiling, grid registration or engine acceptance without checking actual exported pixels.

Input images to attach, in this order:
Image 1: 01-geometri-2-to-1.png
Image 2: 04-wall-tall-L-reference.png

Primary request (F06):
One exposed front slab edge along L, length one grid edge. Thin blue-gray structural fascia below ground level, depth four logical pixels. No top floor surface or wall. Modular end faces, subtle underside shading entirely within the object. This attaches below the floor perimeter, not on every floor tile.

Target geometry for later packing:
{"axis": "L", "lengthTiles": 1, "belowFloorDepth": 4}

Suggested downloaded filename: F06-platform-edge-l.png
Return the single image. Do not create a room, combine modules or generate the other jobs from this pack.
```

## F07 — Sudut depan platform

```text
Use case: stylized-concept.
Asset type: reusable isolated 2.5D office architecture game sprite, not a complete room.
Style: match the attached Dot office reference: clean illustrated contours, controlled soft painted shading, matte light honey oak, cool blue-gray wall panels, charcoal trims and tiny restrained cyan accents. Warm, tidy modern office; neither photorealism, pixel art nor shiny low-poly Blender render.
Camera: orthographic 2:1 DIMETRIC. R/+gx goes screen down-right (+32,+16), L/+gy goes down-left (-32,+16). Vertical world edges stay vertical on screen. A floor diamond has width:height 2:1; do not default to 30-degree true isometric or perspective vanishing points.
Lighting: upper-left of the SCREEN, soft and consistent. Generate the requested orientation explicitly, not a horizontal flip of an existing image. Match modular proportions and shared materials; no newly invented theme.
Reference roles: Image 1 is the technical geometry guide only, not an art style. Subsequent attached images are material/shading references only. They are not edit targets. The old native floor panel's diamond ratio/padding and old long-wall proportions are not authoritative geometry; the guide and this prompt control those. Ignore any characters, furniture and decorations visible in a context reference.
Output: exactly ONE complete isolated PNG image with true RGBA transparency, preferably a 1024x1024 native canvas with at least 8% transparent padding on every side. Keep the complete contour inside the canvas. No spritesheet, contact sheet, alternatives, labels, ID numbers, dimensions drawn on the image, watermark or logo. No black/white/background rectangle, fake checkerboard transparency, baked surrounding room/floor, background glow or cast shadow stretching outside the object. Keep subtle contact shading within the object.
Avoid: people, AI agents, characters, desk, chair, sofa, TV, rugs, plants, posters, bookshelves, room-specific decorations, full office/room compositions, doors added to plain-wall jobs, random objects and extra architecture beyond the requested single module.
Numbers below are engine registration targets, not annotations to draw. A larger native canvas is fine; correct geometry/proportions matter more than guessing the final packing dimensions. Do not claim exact alpha, seamless tiling, grid registration or engine acceptance without checking actual exported pixels.

Input images to attach, in this order:
Image 1: 01-geometri-2-to-1.png
Image 2: 03-wall-tall-R-reference.png
Image 3: 04-wall-tall-L-reference.png

Primary request (F07):
One south/front outside corner joining two exposed platform fascia strips. Ground endpoint S is the closest diamond vertex; legs run from S toward screen upper-left and upper-right, each one grid edge. Depth four logical pixels below ground. No top floor panel, wall, pedestal or furniture.

Target geometry for later packing:
{"corner": "S", "legsTiles": [1, 1], "belowFloorDepth": 4}

Suggested downloaded filename: F07-platform-corner-s.png
Return the single image. Do not create a room, combine modules or generate the other jobs from this pack.
```

## W01 — Dinding tinggi R, 1 modul

```text
Use case: stylized-concept.
Asset type: reusable isolated 2.5D office architecture game sprite, not a complete room.
Style: match the attached Dot office reference: clean illustrated contours, controlled soft painted shading, matte light honey oak, cool blue-gray wall panels, charcoal trims and tiny restrained cyan accents. Warm, tidy modern office; neither photorealism, pixel art nor shiny low-poly Blender render.
Camera: orthographic 2:1 DIMETRIC. R/+gx goes screen down-right (+32,+16), L/+gy goes down-left (-32,+16). Vertical world edges stay vertical on screen. A floor diamond has width:height 2:1; do not default to 30-degree true isometric or perspective vanishing points.
Lighting: upper-left of the SCREEN, soft and consistent. Generate the requested orientation explicitly, not a horizontal flip of an existing image. Match modular proportions and shared materials; no newly invented theme.
Reference roles: Image 1 is the technical geometry guide only, not an art style. Subsequent attached images are material/shading references only. They are not edit targets. The old native floor panel's diamond ratio/padding and old long-wall proportions are not authoritative geometry; the guide and this prompt control those. Ignore any characters, furniture and decorations visible in a context reference.
Output: exactly ONE complete isolated PNG image with true RGBA transparency, preferably a 1024x1024 native canvas with at least 8% transparent padding on every side. Keep the complete contour inside the canvas. No spritesheet, contact sheet, alternatives, labels, ID numbers, dimensions drawn on the image, watermark or logo. No black/white/background rectangle, fake checkerboard transparency, baked surrounding room/floor, background glow or cast shadow stretching outside the object. Keep subtle contact shading within the object.
Avoid: people, AI agents, characters, desk, chair, sofa, TV, rugs, plants, posters, bookshelves, room-specific decorations, full office/room compositions, doors added to plain-wall jobs, random objects and extra architecture beyond the requested single module.
Numbers below are engine registration targets, not annotations to draw. A larger native canvas is fine; correct geometry/proportions matter more than guessing the final packing dimensions. Do not claim exact alpha, seamless tiling, grid registration or engine acceptance without checking actual exported pixels.

Input images to attach, in this order:
Image 1: 01-geometri-2-to-1.png
Image 2: 03-wall-tall-R-reference.png

Primary request (W01):
One straight tall blue-gray office wall along R, exactly 1 grid-edge module(s) long. Height 80 logical pixels, thickness six logical floor-plane units. Matte panels, charcoal skirting and restrained top cap. Both ends are flush and complete so segments join without an overhang; no pillar, floor or neon strip. Panel rhythm is one subtle seam per grid module, never a large dark border at each seam.

Target geometry for later packing:
{"axis": "R", "lengthTiles": 1, "height": 80, "thickness": 6}

Suggested downloaded filename: W01-wall-tall-r-1u.png
Return the single image. Do not create a room, combine modules or generate the other jobs from this pack.
```

## W02 — Dinding tinggi L, 1 modul

```text
Use case: stylized-concept.
Asset type: reusable isolated 2.5D office architecture game sprite, not a complete room.
Style: match the attached Dot office reference: clean illustrated contours, controlled soft painted shading, matte light honey oak, cool blue-gray wall panels, charcoal trims and tiny restrained cyan accents. Warm, tidy modern office; neither photorealism, pixel art nor shiny low-poly Blender render.
Camera: orthographic 2:1 DIMETRIC. R/+gx goes screen down-right (+32,+16), L/+gy goes down-left (-32,+16). Vertical world edges stay vertical on screen. A floor diamond has width:height 2:1; do not default to 30-degree true isometric or perspective vanishing points.
Lighting: upper-left of the SCREEN, soft and consistent. Generate the requested orientation explicitly, not a horizontal flip of an existing image. Match modular proportions and shared materials; no newly invented theme.
Reference roles: Image 1 is the technical geometry guide only, not an art style. Subsequent attached images are material/shading references only. They are not edit targets. The old native floor panel's diamond ratio/padding and old long-wall proportions are not authoritative geometry; the guide and this prompt control those. Ignore any characters, furniture and decorations visible in a context reference.
Output: exactly ONE complete isolated PNG image with true RGBA transparency, preferably a 1024x1024 native canvas with at least 8% transparent padding on every side. Keep the complete contour inside the canvas. No spritesheet, contact sheet, alternatives, labels, ID numbers, dimensions drawn on the image, watermark or logo. No black/white/background rectangle, fake checkerboard transparency, baked surrounding room/floor, background glow or cast shadow stretching outside the object. Keep subtle contact shading within the object.
Avoid: people, AI agents, characters, desk, chair, sofa, TV, rugs, plants, posters, bookshelves, room-specific decorations, full office/room compositions, doors added to plain-wall jobs, random objects and extra architecture beyond the requested single module.
Numbers below are engine registration targets, not annotations to draw. A larger native canvas is fine; correct geometry/proportions matter more than guessing the final packing dimensions. Do not claim exact alpha, seamless tiling, grid registration or engine acceptance without checking actual exported pixels.

Input images to attach, in this order:
Image 1: 01-geometri-2-to-1.png
Image 2: 04-wall-tall-L-reference.png

Primary request (W02):
One straight tall blue-gray office wall along L, exactly 1 grid-edge module(s) long. Height 80 logical pixels, thickness six logical floor-plane units. Matte panels, charcoal skirting and restrained top cap. Both ends are flush and complete so segments join without an overhang; no pillar, floor or neon strip. Panel rhythm is one subtle seam per grid module, never a large dark border at each seam.

Target geometry for later packing:
{"axis": "L", "lengthTiles": 1, "height": 80, "thickness": 6}

Suggested downloaded filename: W02-wall-tall-l-1u.png
Return the single image. Do not create a room, combine modules or generate the other jobs from this pack.
```

## W03 — Dinding tinggi R, 2 modul

```text
Use case: stylized-concept.
Asset type: reusable isolated 2.5D office architecture game sprite, not a complete room.
Style: match the attached Dot office reference: clean illustrated contours, controlled soft painted shading, matte light honey oak, cool blue-gray wall panels, charcoal trims and tiny restrained cyan accents. Warm, tidy modern office; neither photorealism, pixel art nor shiny low-poly Blender render.
Camera: orthographic 2:1 DIMETRIC. R/+gx goes screen down-right (+32,+16), L/+gy goes down-left (-32,+16). Vertical world edges stay vertical on screen. A floor diamond has width:height 2:1; do not default to 30-degree true isometric or perspective vanishing points.
Lighting: upper-left of the SCREEN, soft and consistent. Generate the requested orientation explicitly, not a horizontal flip of an existing image. Match modular proportions and shared materials; no newly invented theme.
Reference roles: Image 1 is the technical geometry guide only, not an art style. Subsequent attached images are material/shading references only. They are not edit targets. The old native floor panel's diamond ratio/padding and old long-wall proportions are not authoritative geometry; the guide and this prompt control those. Ignore any characters, furniture and decorations visible in a context reference.
Output: exactly ONE complete isolated PNG image with true RGBA transparency, preferably a 1024x1024 native canvas with at least 8% transparent padding on every side. Keep the complete contour inside the canvas. No spritesheet, contact sheet, alternatives, labels, ID numbers, dimensions drawn on the image, watermark or logo. No black/white/background rectangle, fake checkerboard transparency, baked surrounding room/floor, background glow or cast shadow stretching outside the object. Keep subtle contact shading within the object.
Avoid: people, AI agents, characters, desk, chair, sofa, TV, rugs, plants, posters, bookshelves, room-specific decorations, full office/room compositions, doors added to plain-wall jobs, random objects and extra architecture beyond the requested single module.
Numbers below are engine registration targets, not annotations to draw. A larger native canvas is fine; correct geometry/proportions matter more than guessing the final packing dimensions. Do not claim exact alpha, seamless tiling, grid registration or engine acceptance without checking actual exported pixels.

Input images to attach, in this order:
Image 1: 01-geometri-2-to-1.png
Image 2: 03-wall-tall-R-reference.png

Primary request (W03):
One straight tall blue-gray office wall along R, exactly 2 grid-edge module(s) long. Height 80 logical pixels, thickness six logical floor-plane units. Matte panels, charcoal skirting and restrained top cap. Both ends are flush and complete so segments join without an overhang; no pillar, floor or neon strip. Panel rhythm is one subtle seam per grid module, never a large dark border at each seam.

Target geometry for later packing:
{"axis": "R", "lengthTiles": 2, "height": 80, "thickness": 6}

Suggested downloaded filename: W03-wall-tall-r-2u.png
Return the single image. Do not create a room, combine modules or generate the other jobs from this pack.
```

## W04 — Dinding tinggi L, 2 modul

```text
Use case: stylized-concept.
Asset type: reusable isolated 2.5D office architecture game sprite, not a complete room.
Style: match the attached Dot office reference: clean illustrated contours, controlled soft painted shading, matte light honey oak, cool blue-gray wall panels, charcoal trims and tiny restrained cyan accents. Warm, tidy modern office; neither photorealism, pixel art nor shiny low-poly Blender render.
Camera: orthographic 2:1 DIMETRIC. R/+gx goes screen down-right (+32,+16), L/+gy goes down-left (-32,+16). Vertical world edges stay vertical on screen. A floor diamond has width:height 2:1; do not default to 30-degree true isometric or perspective vanishing points.
Lighting: upper-left of the SCREEN, soft and consistent. Generate the requested orientation explicitly, not a horizontal flip of an existing image. Match modular proportions and shared materials; no newly invented theme.
Reference roles: Image 1 is the technical geometry guide only, not an art style. Subsequent attached images are material/shading references only. They are not edit targets. The old native floor panel's diamond ratio/padding and old long-wall proportions are not authoritative geometry; the guide and this prompt control those. Ignore any characters, furniture and decorations visible in a context reference.
Output: exactly ONE complete isolated PNG image with true RGBA transparency, preferably a 1024x1024 native canvas with at least 8% transparent padding on every side. Keep the complete contour inside the canvas. No spritesheet, contact sheet, alternatives, labels, ID numbers, dimensions drawn on the image, watermark or logo. No black/white/background rectangle, fake checkerboard transparency, baked surrounding room/floor, background glow or cast shadow stretching outside the object. Keep subtle contact shading within the object.
Avoid: people, AI agents, characters, desk, chair, sofa, TV, rugs, plants, posters, bookshelves, room-specific decorations, full office/room compositions, doors added to plain-wall jobs, random objects and extra architecture beyond the requested single module.
Numbers below are engine registration targets, not annotations to draw. A larger native canvas is fine; correct geometry/proportions matter more than guessing the final packing dimensions. Do not claim exact alpha, seamless tiling, grid registration or engine acceptance without checking actual exported pixels.

Input images to attach, in this order:
Image 1: 01-geometri-2-to-1.png
Image 2: 04-wall-tall-L-reference.png

Primary request (W04):
One straight tall blue-gray office wall along L, exactly 2 grid-edge module(s) long. Height 80 logical pixels, thickness six logical floor-plane units. Matte panels, charcoal skirting and restrained top cap. Both ends are flush and complete so segments join without an overhang; no pillar, floor or neon strip. Panel rhythm is one subtle seam per grid module, never a large dark border at each seam.

Target geometry for later packing:
{"axis": "L", "lengthTiles": 2, "height": 80, "thickness": 6}

Suggested downloaded filename: W04-wall-tall-l-2u.png
Return the single image. Do not create a room, combine modules or generate the other jobs from this pack.
```

## W05 — Dinding rendah R, 1 modul

```text
Use case: stylized-concept.
Asset type: reusable isolated 2.5D office architecture game sprite, not a complete room.
Style: match the attached Dot office reference: clean illustrated contours, controlled soft painted shading, matte light honey oak, cool blue-gray wall panels, charcoal trims and tiny restrained cyan accents. Warm, tidy modern office; neither photorealism, pixel art nor shiny low-poly Blender render.
Camera: orthographic 2:1 DIMETRIC. R/+gx goes screen down-right (+32,+16), L/+gy goes down-left (-32,+16). Vertical world edges stay vertical on screen. A floor diamond has width:height 2:1; do not default to 30-degree true isometric or perspective vanishing points.
Lighting: upper-left of the SCREEN, soft and consistent. Generate the requested orientation explicitly, not a horizontal flip of an existing image. Match modular proportions and shared materials; no newly invented theme.
Reference roles: Image 1 is the technical geometry guide only, not an art style. Subsequent attached images are material/shading references only. They are not edit targets. The old native floor panel's diamond ratio/padding and old long-wall proportions are not authoritative geometry; the guide and this prompt control those. Ignore any characters, furniture and decorations visible in a context reference.
Output: exactly ONE complete isolated PNG image with true RGBA transparency, preferably a 1024x1024 native canvas with at least 8% transparent padding on every side. Keep the complete contour inside the canvas. No spritesheet, contact sheet, alternatives, labels, ID numbers, dimensions drawn on the image, watermark or logo. No black/white/background rectangle, fake checkerboard transparency, baked surrounding room/floor, background glow or cast shadow stretching outside the object. Keep subtle contact shading within the object.
Avoid: people, AI agents, characters, desk, chair, sofa, TV, rugs, plants, posters, bookshelves, room-specific decorations, full office/room compositions, doors added to plain-wall jobs, random objects and extra architecture beyond the requested single module.
Numbers below are engine registration targets, not annotations to draw. A larger native canvas is fine; correct geometry/proportions matter more than guessing the final packing dimensions. Do not claim exact alpha, seamless tiling, grid registration or engine acceptance without checking actual exported pixels.

Input images to attach, in this order:
Image 1: 01-geometri-2-to-1.png
Image 2: 05-wall-low-R-reference.png

Primary request (W05):
One straight low blue-gray office wall along R, exactly 1 grid-edge module(s) long. Height 16 logical pixels, thickness six logical floor-plane units. Matte panels, charcoal skirting and restrained top cap. Both ends are flush and complete so segments join without an overhang; no pillar, floor or neon strip. Panel rhythm is one subtle seam per grid module, never a large dark border at each seam.

Target geometry for later packing:
{"axis": "R", "lengthTiles": 1, "height": 16, "thickness": 6}

Suggested downloaded filename: W05-wall-low-r-1u.png
Return the single image. Do not create a room, combine modules or generate the other jobs from this pack.
```

## W06 — Dinding rendah L, 1 modul

```text
Use case: stylized-concept.
Asset type: reusable isolated 2.5D office architecture game sprite, not a complete room.
Style: match the attached Dot office reference: clean illustrated contours, controlled soft painted shading, matte light honey oak, cool blue-gray wall panels, charcoal trims and tiny restrained cyan accents. Warm, tidy modern office; neither photorealism, pixel art nor shiny low-poly Blender render.
Camera: orthographic 2:1 DIMETRIC. R/+gx goes screen down-right (+32,+16), L/+gy goes down-left (-32,+16). Vertical world edges stay vertical on screen. A floor diamond has width:height 2:1; do not default to 30-degree true isometric or perspective vanishing points.
Lighting: upper-left of the SCREEN, soft and consistent. Generate the requested orientation explicitly, not a horizontal flip of an existing image. Match modular proportions and shared materials; no newly invented theme.
Reference roles: Image 1 is the technical geometry guide only, not an art style. Subsequent attached images are material/shading references only. They are not edit targets. The old native floor panel's diamond ratio/padding and old long-wall proportions are not authoritative geometry; the guide and this prompt control those. Ignore any characters, furniture and decorations visible in a context reference.
Output: exactly ONE complete isolated PNG image with true RGBA transparency, preferably a 1024x1024 native canvas with at least 8% transparent padding on every side. Keep the complete contour inside the canvas. No spritesheet, contact sheet, alternatives, labels, ID numbers, dimensions drawn on the image, watermark or logo. No black/white/background rectangle, fake checkerboard transparency, baked surrounding room/floor, background glow or cast shadow stretching outside the object. Keep subtle contact shading within the object.
Avoid: people, AI agents, characters, desk, chair, sofa, TV, rugs, plants, posters, bookshelves, room-specific decorations, full office/room compositions, doors added to plain-wall jobs, random objects and extra architecture beyond the requested single module.
Numbers below are engine registration targets, not annotations to draw. A larger native canvas is fine; correct geometry/proportions matter more than guessing the final packing dimensions. Do not claim exact alpha, seamless tiling, grid registration or engine acceptance without checking actual exported pixels.

Input images to attach, in this order:
Image 1: 01-geometri-2-to-1.png
Image 2: 06-wall-low-L-reference.png

Primary request (W06):
One straight low blue-gray office wall along L, exactly 1 grid-edge module(s) long. Height 16 logical pixels, thickness six logical floor-plane units. Matte panels, charcoal skirting and restrained top cap. Both ends are flush and complete so segments join without an overhang; no pillar, floor or neon strip. Panel rhythm is one subtle seam per grid module, never a large dark border at each seam.

Target geometry for later packing:
{"axis": "L", "lengthTiles": 1, "height": 16, "thickness": 6}

Suggested downloaded filename: W06-wall-low-l-1u.png
Return the single image. Do not create a room, combine modules or generate the other jobs from this pack.
```

## W07 — Dinding rendah R, 2 modul

```text
Use case: stylized-concept.
Asset type: reusable isolated 2.5D office architecture game sprite, not a complete room.
Style: match the attached Dot office reference: clean illustrated contours, controlled soft painted shading, matte light honey oak, cool blue-gray wall panels, charcoal trims and tiny restrained cyan accents. Warm, tidy modern office; neither photorealism, pixel art nor shiny low-poly Blender render.
Camera: orthographic 2:1 DIMETRIC. R/+gx goes screen down-right (+32,+16), L/+gy goes down-left (-32,+16). Vertical world edges stay vertical on screen. A floor diamond has width:height 2:1; do not default to 30-degree true isometric or perspective vanishing points.
Lighting: upper-left of the SCREEN, soft and consistent. Generate the requested orientation explicitly, not a horizontal flip of an existing image. Match modular proportions and shared materials; no newly invented theme.
Reference roles: Image 1 is the technical geometry guide only, not an art style. Subsequent attached images are material/shading references only. They are not edit targets. The old native floor panel's diamond ratio/padding and old long-wall proportions are not authoritative geometry; the guide and this prompt control those. Ignore any characters, furniture and decorations visible in a context reference.
Output: exactly ONE complete isolated PNG image with true RGBA transparency, preferably a 1024x1024 native canvas with at least 8% transparent padding on every side. Keep the complete contour inside the canvas. No spritesheet, contact sheet, alternatives, labels, ID numbers, dimensions drawn on the image, watermark or logo. No black/white/background rectangle, fake checkerboard transparency, baked surrounding room/floor, background glow or cast shadow stretching outside the object. Keep subtle contact shading within the object.
Avoid: people, AI agents, characters, desk, chair, sofa, TV, rugs, plants, posters, bookshelves, room-specific decorations, full office/room compositions, doors added to plain-wall jobs, random objects and extra architecture beyond the requested single module.
Numbers below are engine registration targets, not annotations to draw. A larger native canvas is fine; correct geometry/proportions matter more than guessing the final packing dimensions. Do not claim exact alpha, seamless tiling, grid registration or engine acceptance without checking actual exported pixels.

Input images to attach, in this order:
Image 1: 01-geometri-2-to-1.png
Image 2: 05-wall-low-R-reference.png

Primary request (W07):
One straight low blue-gray office wall along R, exactly 2 grid-edge module(s) long. Height 16 logical pixels, thickness six logical floor-plane units. Matte panels, charcoal skirting and restrained top cap. Both ends are flush and complete so segments join without an overhang; no pillar, floor or neon strip. Panel rhythm is one subtle seam per grid module, never a large dark border at each seam.

Target geometry for later packing:
{"axis": "R", "lengthTiles": 2, "height": 16, "thickness": 6}

Suggested downloaded filename: W07-wall-low-r-2u.png
Return the single image. Do not create a room, combine modules or generate the other jobs from this pack.
```

## W08 — Dinding rendah L, 2 modul

```text
Use case: stylized-concept.
Asset type: reusable isolated 2.5D office architecture game sprite, not a complete room.
Style: match the attached Dot office reference: clean illustrated contours, controlled soft painted shading, matte light honey oak, cool blue-gray wall panels, charcoal trims and tiny restrained cyan accents. Warm, tidy modern office; neither photorealism, pixel art nor shiny low-poly Blender render.
Camera: orthographic 2:1 DIMETRIC. R/+gx goes screen down-right (+32,+16), L/+gy goes down-left (-32,+16). Vertical world edges stay vertical on screen. A floor diamond has width:height 2:1; do not default to 30-degree true isometric or perspective vanishing points.
Lighting: upper-left of the SCREEN, soft and consistent. Generate the requested orientation explicitly, not a horizontal flip of an existing image. Match modular proportions and shared materials; no newly invented theme.
Reference roles: Image 1 is the technical geometry guide only, not an art style. Subsequent attached images are material/shading references only. They are not edit targets. The old native floor panel's diamond ratio/padding and old long-wall proportions are not authoritative geometry; the guide and this prompt control those. Ignore any characters, furniture and decorations visible in a context reference.
Output: exactly ONE complete isolated PNG image with true RGBA transparency, preferably a 1024x1024 native canvas with at least 8% transparent padding on every side. Keep the complete contour inside the canvas. No spritesheet, contact sheet, alternatives, labels, ID numbers, dimensions drawn on the image, watermark or logo. No black/white/background rectangle, fake checkerboard transparency, baked surrounding room/floor, background glow or cast shadow stretching outside the object. Keep subtle contact shading within the object.
Avoid: people, AI agents, characters, desk, chair, sofa, TV, rugs, plants, posters, bookshelves, room-specific decorations, full office/room compositions, doors added to plain-wall jobs, random objects and extra architecture beyond the requested single module.
Numbers below are engine registration targets, not annotations to draw. A larger native canvas is fine; correct geometry/proportions matter more than guessing the final packing dimensions. Do not claim exact alpha, seamless tiling, grid registration or engine acceptance without checking actual exported pixels.

Input images to attach, in this order:
Image 1: 01-geometri-2-to-1.png
Image 2: 06-wall-low-L-reference.png

Primary request (W08):
One straight low blue-gray office wall along L, exactly 2 grid-edge module(s) long. Height 16 logical pixels, thickness six logical floor-plane units. Matte panels, charcoal skirting and restrained top cap. Both ends are flush and complete so segments join without an overhang; no pillar, floor or neon strip. Panel rhythm is one subtle seam per grid module, never a large dark border at each seam.

Target geometry for later packing:
{"axis": "L", "lengthTiles": 2, "height": 16, "thickness": 6}

Suggested downloaded filename: W08-wall-low-l-2u.png
Return the single image. Do not create a room, combine modules or generate the other jobs from this pack.
```

## W09 — Sudut belakang dinding tinggi

```text
Use case: stylized-concept.
Asset type: reusable isolated 2.5D office architecture game sprite, not a complete room.
Style: match the attached Dot office reference: clean illustrated contours, controlled soft painted shading, matte light honey oak, cool blue-gray wall panels, charcoal trims and tiny restrained cyan accents. Warm, tidy modern office; neither photorealism, pixel art nor shiny low-poly Blender render.
Camera: orthographic 2:1 DIMETRIC. R/+gx goes screen down-right (+32,+16), L/+gy goes down-left (-32,+16). Vertical world edges stay vertical on screen. A floor diamond has width:height 2:1; do not default to 30-degree true isometric or perspective vanishing points.
Lighting: upper-left of the SCREEN, soft and consistent. Generate the requested orientation explicitly, not a horizontal flip of an existing image. Match modular proportions and shared materials; no newly invented theme.
Reference roles: Image 1 is the technical geometry guide only, not an art style. Subsequent attached images are material/shading references only. They are not edit targets. The old native floor panel's diamond ratio/padding and old long-wall proportions are not authoritative geometry; the guide and this prompt control those. Ignore any characters, furniture and decorations visible in a context reference.
Output: exactly ONE complete isolated PNG image with true RGBA transparency, preferably a 1024x1024 native canvas with at least 8% transparent padding on every side. Keep the complete contour inside the canvas. No spritesheet, contact sheet, alternatives, labels, ID numbers, dimensions drawn on the image, watermark or logo. No black/white/background rectangle, fake checkerboard transparency, baked surrounding room/floor, background glow or cast shadow stretching outside the object. Keep subtle contact shading within the object.
Avoid: people, AI agents, characters, desk, chair, sofa, TV, rugs, plants, posters, bookshelves, room-specific decorations, full office/room compositions, doors added to plain-wall jobs, random objects and extra architecture beyond the requested single module.
Numbers below are engine registration targets, not annotations to draw. A larger native canvas is fine; correct geometry/proportions matter more than guessing the final packing dimensions. Do not claim exact alpha, seamless tiling, grid registration or engine acceptance without checking actual exported pixels.

Input images to attach, in this order:
Image 1: 01-geometri-2-to-1.png
Image 2: 03-wall-tall-R-reference.png
Image 3: 04-wall-tall-L-reference.png

Primary request (W09):
One north/back interior wall corner: a central rear diamond vertex N with two tall wall legs extending toward screen lower-right (+R) and lower-left (+L). Each leg is one grid edge, height 80, thickness six logical units. Joined top caps and skirting are seamless. The inner faces are visible. No floor, pillar, doorway or decorations.

Target geometry for later packing:
{"corner": "N", "legsTiles": [1, 1], "height": 80, "thickness": 6}

Suggested downloaded filename: W09-wall-corner-n-tall.png
Return the single image. Do not create a room, combine modules or generate the other jobs from this pack.
```

## W10 — Sudut depan dinding rendah

```text
Use case: stylized-concept.
Asset type: reusable isolated 2.5D office architecture game sprite, not a complete room.
Style: match the attached Dot office reference: clean illustrated contours, controlled soft painted shading, matte light honey oak, cool blue-gray wall panels, charcoal trims and tiny restrained cyan accents. Warm, tidy modern office; neither photorealism, pixel art nor shiny low-poly Blender render.
Camera: orthographic 2:1 DIMETRIC. R/+gx goes screen down-right (+32,+16), L/+gy goes down-left (-32,+16). Vertical world edges stay vertical on screen. A floor diamond has width:height 2:1; do not default to 30-degree true isometric or perspective vanishing points.
Lighting: upper-left of the SCREEN, soft and consistent. Generate the requested orientation explicitly, not a horizontal flip of an existing image. Match modular proportions and shared materials; no newly invented theme.
Reference roles: Image 1 is the technical geometry guide only, not an art style. Subsequent attached images are material/shading references only. They are not edit targets. The old native floor panel's diamond ratio/padding and old long-wall proportions are not authoritative geometry; the guide and this prompt control those. Ignore any characters, furniture and decorations visible in a context reference.
Output: exactly ONE complete isolated PNG image with true RGBA transparency, preferably a 1024x1024 native canvas with at least 8% transparent padding on every side. Keep the complete contour inside the canvas. No spritesheet, contact sheet, alternatives, labels, ID numbers, dimensions drawn on the image, watermark or logo. No black/white/background rectangle, fake checkerboard transparency, baked surrounding room/floor, background glow or cast shadow stretching outside the object. Keep subtle contact shading within the object.
Avoid: people, AI agents, characters, desk, chair, sofa, TV, rugs, plants, posters, bookshelves, room-specific decorations, full office/room compositions, doors added to plain-wall jobs, random objects and extra architecture beyond the requested single module.
Numbers below are engine registration targets, not annotations to draw. A larger native canvas is fine; correct geometry/proportions matter more than guessing the final packing dimensions. Do not claim exact alpha, seamless tiling, grid registration or engine acceptance without checking actual exported pixels.

Input images to attach, in this order:
Image 1: 01-geometri-2-to-1.png
Image 2: 05-wall-low-R-reference.png
Image 3: 06-wall-low-L-reference.png

Primary request (W10):
One south/front outside cutaway-wall corner: a central nearest diamond vertex S with low wall legs extending toward screen upper-left (-R) and upper-right (-L). Each leg is one grid edge, height 16, thickness six logical units. The outside faces are visible; top caps and skirting join cleanly. No floor, tall post, fence, doorway or decoration.

Target geometry for later packing:
{"corner": "S", "legsTiles": [1, 1], "height": 16, "thickness": 6}

Suggested downloaded filename: W10-wall-corner-s-low.png
Return the single image. Do not create a room, combine modules or generate the other jobs from this pack.
```

## P01 — Pilar sambungan tinggi

```text
Use case: stylized-concept.
Asset type: reusable isolated 2.5D office architecture game sprite, not a complete room.
Style: match the attached Dot office reference: clean illustrated contours, controlled soft painted shading, matte light honey oak, cool blue-gray wall panels, charcoal trims and tiny restrained cyan accents. Warm, tidy modern office; neither photorealism, pixel art nor shiny low-poly Blender render.
Camera: orthographic 2:1 DIMETRIC. R/+gx goes screen down-right (+32,+16), L/+gy goes down-left (-32,+16). Vertical world edges stay vertical on screen. A floor diamond has width:height 2:1; do not default to 30-degree true isometric or perspective vanishing points.
Lighting: upper-left of the SCREEN, soft and consistent. Generate the requested orientation explicitly, not a horizontal flip of an existing image. Match modular proportions and shared materials; no newly invented theme.
Reference roles: Image 1 is the technical geometry guide only, not an art style. Subsequent attached images are material/shading references only. They are not edit targets. The old native floor panel's diamond ratio/padding and old long-wall proportions are not authoritative geometry; the guide and this prompt control those. Ignore any characters, furniture and decorations visible in a context reference.
Output: exactly ONE complete isolated PNG image with true RGBA transparency, preferably a 1024x1024 native canvas with at least 8% transparent padding on every side. Keep the complete contour inside the canvas. No spritesheet, contact sheet, alternatives, labels, ID numbers, dimensions drawn on the image, watermark or logo. No black/white/background rectangle, fake checkerboard transparency, baked surrounding room/floor, background glow or cast shadow stretching outside the object. Keep subtle contact shading within the object.
Avoid: people, AI agents, characters, desk, chair, sofa, TV, rugs, plants, posters, bookshelves, room-specific decorations, full office/room compositions, doors added to plain-wall jobs, random objects and extra architecture beyond the requested single module.
Numbers below are engine registration targets, not annotations to draw. A larger native canvas is fine; correct geometry/proportions matter more than guessing the final packing dimensions. Do not claim exact alpha, seamless tiling, grid registration or engine acceptance without checking actual exported pixels.

Input images to attach, in this order:
Image 1: 01-geometri-2-to-1.png
Image 2: 08-pillar-reference.png

Primary request (P01):
One slim full-height charcoal/blue-gray structural junction pillar. Square footprint six by six logical floor units, height 80. Two visible faces and a dimetric top cap. One narrow restrained cyan inset on the visible darker face, matching the reference, without glow spilling outside alpha. It covers wall joins/end terminals; no pedestal wider than its footprint.

Target geometry for later packing:
{"footprintLogical": [6, 6], "height": 80}

Suggested downloaded filename: P01-pillar-tall.png
Return the single image. Do not create a room, combine modules or generate the other jobs from this pack.
```

## P02 — Post sambungan rendah

```text
Use case: stylized-concept.
Asset type: reusable isolated 2.5D office architecture game sprite, not a complete room.
Style: match the attached Dot office reference: clean illustrated contours, controlled soft painted shading, matte light honey oak, cool blue-gray wall panels, charcoal trims and tiny restrained cyan accents. Warm, tidy modern office; neither photorealism, pixel art nor shiny low-poly Blender render.
Camera: orthographic 2:1 DIMETRIC. R/+gx goes screen down-right (+32,+16), L/+gy goes down-left (-32,+16). Vertical world edges stay vertical on screen. A floor diamond has width:height 2:1; do not default to 30-degree true isometric or perspective vanishing points.
Lighting: upper-left of the SCREEN, soft and consistent. Generate the requested orientation explicitly, not a horizontal flip of an existing image. Match modular proportions and shared materials; no newly invented theme.
Reference roles: Image 1 is the technical geometry guide only, not an art style. Subsequent attached images are material/shading references only. They are not edit targets. The old native floor panel's diamond ratio/padding and old long-wall proportions are not authoritative geometry; the guide and this prompt control those. Ignore any characters, furniture and decorations visible in a context reference.
Output: exactly ONE complete isolated PNG image with true RGBA transparency, preferably a 1024x1024 native canvas with at least 8% transparent padding on every side. Keep the complete contour inside the canvas. No spritesheet, contact sheet, alternatives, labels, ID numbers, dimensions drawn on the image, watermark or logo. No black/white/background rectangle, fake checkerboard transparency, baked surrounding room/floor, background glow or cast shadow stretching outside the object. Keep subtle contact shading within the object.
Avoid: people, AI agents, characters, desk, chair, sofa, TV, rugs, plants, posters, bookshelves, room-specific decorations, full office/room compositions, doors added to plain-wall jobs, random objects and extra architecture beyond the requested single module.
Numbers below are engine registration targets, not annotations to draw. A larger native canvas is fine; correct geometry/proportions matter more than guessing the final packing dimensions. Do not claim exact alpha, seamless tiling, grid registration or engine acceptance without checking actual exported pixels.

Input images to attach, in this order:
Image 1: 01-geometri-2-to-1.png
Image 2: 08-pillar-reference.png
Image 3: 05-wall-low-R-reference.png

Primary request (P02):
One low blue-gray corner/end post for cutaway wall joins. Square footprint six by six logical units, height 16, same cap and skirting as low wall. No tall pillar, glowing lamp, separate base or floor. It must join W05/W06 at equal cap height.

Target geometry for later packing:
{"footprintLogical": [6, 6], "height": 16}

Suggested downloaded filename: P02-post-low.png
Return the single image. Do not create a room, combine modules or generate the other jobs from this pack.
```

## D01 — Kusen terbuka R

```text
Use case: stylized-concept.
Asset type: reusable isolated 2.5D office architecture game sprite, not a complete room.
Style: match the attached Dot office reference: clean illustrated contours, controlled soft painted shading, matte light honey oak, cool blue-gray wall panels, charcoal trims and tiny restrained cyan accents. Warm, tidy modern office; neither photorealism, pixel art nor shiny low-poly Blender render.
Camera: orthographic 2:1 DIMETRIC. R/+gx goes screen down-right (+32,+16), L/+gy goes down-left (-32,+16). Vertical world edges stay vertical on screen. A floor diamond has width:height 2:1; do not default to 30-degree true isometric or perspective vanishing points.
Lighting: upper-left of the SCREEN, soft and consistent. Generate the requested orientation explicitly, not a horizontal flip of an existing image. Match modular proportions and shared materials; no newly invented theme.
Reference roles: Image 1 is the technical geometry guide only, not an art style. Subsequent attached images are material/shading references only. They are not edit targets. The old native floor panel's diamond ratio/padding and old long-wall proportions are not authoritative geometry; the guide and this prompt control those. Ignore any characters, furniture and decorations visible in a context reference.
Output: exactly ONE complete isolated PNG image with true RGBA transparency, preferably a 1024x1024 native canvas with at least 8% transparent padding on every side. Keep the complete contour inside the canvas. No spritesheet, contact sheet, alternatives, labels, ID numbers, dimensions drawn on the image, watermark or logo. No black/white/background rectangle, fake checkerboard transparency, baked surrounding room/floor, background glow or cast shadow stretching outside the object. Keep subtle contact shading within the object.
Avoid: people, AI agents, characters, desk, chair, sofa, TV, rugs, plants, posters, bookshelves, room-specific decorations, full office/room compositions, doors added to plain-wall jobs, random objects and extra architecture beyond the requested single module.
Numbers below are engine registration targets, not annotations to draw. A larger native canvas is fine; correct geometry/proportions matter more than guessing the final packing dimensions. Do not claim exact alpha, seamless tiling, grid registration or engine acceptance without checking actual exported pixels.

Input images to attach, in this order:
Image 1: 01-geometri-2-to-1.png
Image 2: 07-doorframe-reference.png
Image 3: 03-wall-tall-R-reference.png

Primary request (D01):
One isolated open office passage frame along R. Total ground span one grid edge, thickness six logical units, total height 80. Each jamb takes four logical units along the span; unobstructed clear width is 24 logical units. Two slim jambs and one lintel; clear opening height 72 logical pixels. No door leaf, glass across the opening, sill step or floor patch. A restrained narrow cyan inset on one jamb, same charcoal hardware as the reference. Ends join adjoining wall modules. A true transparent passage, never filled with a black rectangle or another room scene.

Target geometry for later packing:
{"axis": "R", "lengthTiles": 1, "height": 80, "thickness": 6, "clearWidth": 24, "clearHeight": 72}

Suggested downloaded filename: D01-door-open-r.png
Return the single image. Do not create a room, combine modules or generate the other jobs from this pack.
```

## D02 — Kusen terbuka L

```text
Use case: stylized-concept.
Asset type: reusable isolated 2.5D office architecture game sprite, not a complete room.
Style: match the attached Dot office reference: clean illustrated contours, controlled soft painted shading, matte light honey oak, cool blue-gray wall panels, charcoal trims and tiny restrained cyan accents. Warm, tidy modern office; neither photorealism, pixel art nor shiny low-poly Blender render.
Camera: orthographic 2:1 DIMETRIC. R/+gx goes screen down-right (+32,+16), L/+gy goes down-left (-32,+16). Vertical world edges stay vertical on screen. A floor diamond has width:height 2:1; do not default to 30-degree true isometric or perspective vanishing points.
Lighting: upper-left of the SCREEN, soft and consistent. Generate the requested orientation explicitly, not a horizontal flip of an existing image. Match modular proportions and shared materials; no newly invented theme.
Reference roles: Image 1 is the technical geometry guide only, not an art style. Subsequent attached images are material/shading references only. They are not edit targets. The old native floor panel's diamond ratio/padding and old long-wall proportions are not authoritative geometry; the guide and this prompt control those. Ignore any characters, furniture and decorations visible in a context reference.
Output: exactly ONE complete isolated PNG image with true RGBA transparency, preferably a 1024x1024 native canvas with at least 8% transparent padding on every side. Keep the complete contour inside the canvas. No spritesheet, contact sheet, alternatives, labels, ID numbers, dimensions drawn on the image, watermark or logo. No black/white/background rectangle, fake checkerboard transparency, baked surrounding room/floor, background glow or cast shadow stretching outside the object. Keep subtle contact shading within the object.
Avoid: people, AI agents, characters, desk, chair, sofa, TV, rugs, plants, posters, bookshelves, room-specific decorations, full office/room compositions, doors added to plain-wall jobs, random objects and extra architecture beyond the requested single module.
Numbers below are engine registration targets, not annotations to draw. A larger native canvas is fine; correct geometry/proportions matter more than guessing the final packing dimensions. Do not claim exact alpha, seamless tiling, grid registration or engine acceptance without checking actual exported pixels.

Input images to attach, in this order:
Image 1: 01-geometri-2-to-1.png
Image 2: 07-doorframe-reference.png
Image 3: 04-wall-tall-L-reference.png

Primary request (D02):
One isolated open office passage frame along L. Total ground span one grid edge, thickness six logical units, total height 80. Each jamb takes four logical units along the span; unobstructed clear width is 24 logical units. Two slim jambs and one lintel; clear opening height 72 logical pixels. No door leaf, glass across the opening, sill step or floor patch. A restrained narrow cyan inset on one jamb, same charcoal hardware as the reference. Ends join adjoining wall modules. A true transparent passage, never filled with a black rectangle or another room scene.

Target geometry for later packing:
{"axis": "L", "lengthTiles": 1, "height": 80, "thickness": 6, "clearWidth": 24, "clearHeight": 72}

Suggested downloaded filename: D02-door-open-l.png
Return the single image. Do not create a room, combine modules or generate the other jobs from this pack.
```

## D03 — Kusen depan rendah R

```text
Use case: stylized-concept.
Asset type: reusable isolated 2.5D office architecture game sprite, not a complete room.
Style: match the attached Dot office reference: clean illustrated contours, controlled soft painted shading, matte light honey oak, cool blue-gray wall panels, charcoal trims and tiny restrained cyan accents. Warm, tidy modern office; neither photorealism, pixel art nor shiny low-poly Blender render.
Camera: orthographic 2:1 DIMETRIC. R/+gx goes screen down-right (+32,+16), L/+gy goes down-left (-32,+16). Vertical world edges stay vertical on screen. A floor diamond has width:height 2:1; do not default to 30-degree true isometric or perspective vanishing points.
Lighting: upper-left of the SCREEN, soft and consistent. Generate the requested orientation explicitly, not a horizontal flip of an existing image. Match modular proportions and shared materials; no newly invented theme.
Reference roles: Image 1 is the technical geometry guide only, not an art style. Subsequent attached images are material/shading references only. They are not edit targets. The old native floor panel's diamond ratio/padding and old long-wall proportions are not authoritative geometry; the guide and this prompt control those. Ignore any characters, furniture and decorations visible in a context reference.
Output: exactly ONE complete isolated PNG image with true RGBA transparency, preferably a 1024x1024 native canvas with at least 8% transparent padding on every side. Keep the complete contour inside the canvas. No spritesheet, contact sheet, alternatives, labels, ID numbers, dimensions drawn on the image, watermark or logo. No black/white/background rectangle, fake checkerboard transparency, baked surrounding room/floor, background glow or cast shadow stretching outside the object. Keep subtle contact shading within the object.
Avoid: people, AI agents, characters, desk, chair, sofa, TV, rugs, plants, posters, bookshelves, room-specific decorations, full office/room compositions, doors added to plain-wall jobs, random objects and extra architecture beyond the requested single module.
Numbers below are engine registration targets, not annotations to draw. A larger native canvas is fine; correct geometry/proportions matter more than guessing the final packing dimensions. Do not claim exact alpha, seamless tiling, grid registration or engine acceptance without checking actual exported pixels.

Input images to attach, in this order:
Image 1: 01-geometri-2-to-1.png
Image 2: 07-doorframe-reference.png
Image 3: 05-wall-low-R-reference.png

Primary request (D03):
One isolated cutaway office passage frame along R. Total ground span one grid edge, thickness six logical units, total height 16. Each jamb takes four logical units along the span; unobstructed clear width is 24 logical units. Two low jamb terminals only; no overhead beam, arch or door leaf. Keep the passage open at floor level. Same blue-gray material and skirting as low cutaway walls; no cyan tower. Ends join adjoining wall modules. A true transparent passage, never filled with a black rectangle or another room scene.

Target geometry for later packing:
{"axis": "R", "lengthTiles": 1, "height": 16, "thickness": 6, "clearWidth": 24, "clearHeight": null}

Suggested downloaded filename: D03-door-cutaway-r.png
Return the single image. Do not create a room, combine modules or generate the other jobs from this pack.
```

## D04 — Kusen depan rendah L

```text
Use case: stylized-concept.
Asset type: reusable isolated 2.5D office architecture game sprite, not a complete room.
Style: match the attached Dot office reference: clean illustrated contours, controlled soft painted shading, matte light honey oak, cool blue-gray wall panels, charcoal trims and tiny restrained cyan accents. Warm, tidy modern office; neither photorealism, pixel art nor shiny low-poly Blender render.
Camera: orthographic 2:1 DIMETRIC. R/+gx goes screen down-right (+32,+16), L/+gy goes down-left (-32,+16). Vertical world edges stay vertical on screen. A floor diamond has width:height 2:1; do not default to 30-degree true isometric or perspective vanishing points.
Lighting: upper-left of the SCREEN, soft and consistent. Generate the requested orientation explicitly, not a horizontal flip of an existing image. Match modular proportions and shared materials; no newly invented theme.
Reference roles: Image 1 is the technical geometry guide only, not an art style. Subsequent attached images are material/shading references only. They are not edit targets. The old native floor panel's diamond ratio/padding and old long-wall proportions are not authoritative geometry; the guide and this prompt control those. Ignore any characters, furniture and decorations visible in a context reference.
Output: exactly ONE complete isolated PNG image with true RGBA transparency, preferably a 1024x1024 native canvas with at least 8% transparent padding on every side. Keep the complete contour inside the canvas. No spritesheet, contact sheet, alternatives, labels, ID numbers, dimensions drawn on the image, watermark or logo. No black/white/background rectangle, fake checkerboard transparency, baked surrounding room/floor, background glow or cast shadow stretching outside the object. Keep subtle contact shading within the object.
Avoid: people, AI agents, characters, desk, chair, sofa, TV, rugs, plants, posters, bookshelves, room-specific decorations, full office/room compositions, doors added to plain-wall jobs, random objects and extra architecture beyond the requested single module.
Numbers below are engine registration targets, not annotations to draw. A larger native canvas is fine; correct geometry/proportions matter more than guessing the final packing dimensions. Do not claim exact alpha, seamless tiling, grid registration or engine acceptance without checking actual exported pixels.

Input images to attach, in this order:
Image 1: 01-geometri-2-to-1.png
Image 2: 07-doorframe-reference.png
Image 3: 06-wall-low-L-reference.png

Primary request (D04):
One isolated cutaway office passage frame along L. Total ground span one grid edge, thickness six logical units, total height 16. Each jamb takes four logical units along the span; unobstructed clear width is 24 logical units. Two low jamb terminals only; no overhead beam, arch or door leaf. Keep the passage open at floor level. Same blue-gray material and skirting as low cutaway walls; no cyan tower. Ends join adjoining wall modules. A true transparent passage, never filled with a black rectangle or another room scene.

Target geometry for later packing:
{"axis": "L", "lengthTiles": 1, "height": 16, "thickness": 6, "clearWidth": 24, "clearHeight": null}

Suggested downloaded filename: D04-door-cutaway-l.png
Return the single image. Do not create a room, combine modules or generate the other jobs from this pack.
```

## D05 — Kusen entrance R

```text
Use case: stylized-concept.
Asset type: reusable isolated 2.5D office architecture game sprite, not a complete room.
Style: match the attached Dot office reference: clean illustrated contours, controlled soft painted shading, matte light honey oak, cool blue-gray wall panels, charcoal trims and tiny restrained cyan accents. Warm, tidy modern office; neither photorealism, pixel art nor shiny low-poly Blender render.
Camera: orthographic 2:1 DIMETRIC. R/+gx goes screen down-right (+32,+16), L/+gy goes down-left (-32,+16). Vertical world edges stay vertical on screen. A floor diamond has width:height 2:1; do not default to 30-degree true isometric or perspective vanishing points.
Lighting: upper-left of the SCREEN, soft and consistent. Generate the requested orientation explicitly, not a horizontal flip of an existing image. Match modular proportions and shared materials; no newly invented theme.
Reference roles: Image 1 is the technical geometry guide only, not an art style. Subsequent attached images are material/shading references only. They are not edit targets. The old native floor panel's diamond ratio/padding and old long-wall proportions are not authoritative geometry; the guide and this prompt control those. Ignore any characters, furniture and decorations visible in a context reference.
Output: exactly ONE complete isolated PNG image with true RGBA transparency, preferably a 1024x1024 native canvas with at least 8% transparent padding on every side. Keep the complete contour inside the canvas. No spritesheet, contact sheet, alternatives, labels, ID numbers, dimensions drawn on the image, watermark or logo. No black/white/background rectangle, fake checkerboard transparency, baked surrounding room/floor, background glow or cast shadow stretching outside the object. Keep subtle contact shading within the object.
Avoid: people, AI agents, characters, desk, chair, sofa, TV, rugs, plants, posters, bookshelves, room-specific decorations, full office/room compositions, doors added to plain-wall jobs, random objects and extra architecture beyond the requested single module.
Numbers below are engine registration targets, not annotations to draw. A larger native canvas is fine; correct geometry/proportions matter more than guessing the final packing dimensions. Do not claim exact alpha, seamless tiling, grid registration or engine acceptance without checking actual exported pixels.

Input images to attach, in this order:
Image 1: 01-geometri-2-to-1.png
Image 2: 07-doorframe-reference.png
Image 3: 03-wall-tall-R-reference.png

Primary request (D05):
One isolated entrance office passage frame along R. Total ground span one grid edge, thickness six logical units, total height 80. Each jamb takes four logical units along the span; unobstructed clear width is 24 logical units. Two slim jambs and one lintel; clear opening height 72 logical pixels. No door leaf, glass across the opening, sill step or floor patch. A restrained narrow cyan inset on one jamb, same charcoal hardware as the reference. Ends join adjoining wall modules. A true transparent passage, never filled with a black rectangle or another room scene.

Target geometry for later packing:
{"axis": "R", "lengthTiles": 1, "height": 80, "thickness": 6, "clearWidth": 24, "clearHeight": 72}

Suggested downloaded filename: D05-door-entrance-r.png
Return the single image. Do not create a room, combine modules or generate the other jobs from this pack.
```

## D06 — Kusen entrance L

```text
Use case: stylized-concept.
Asset type: reusable isolated 2.5D office architecture game sprite, not a complete room.
Style: match the attached Dot office reference: clean illustrated contours, controlled soft painted shading, matte light honey oak, cool blue-gray wall panels, charcoal trims and tiny restrained cyan accents. Warm, tidy modern office; neither photorealism, pixel art nor shiny low-poly Blender render.
Camera: orthographic 2:1 DIMETRIC. R/+gx goes screen down-right (+32,+16), L/+gy goes down-left (-32,+16). Vertical world edges stay vertical on screen. A floor diamond has width:height 2:1; do not default to 30-degree true isometric or perspective vanishing points.
Lighting: upper-left of the SCREEN, soft and consistent. Generate the requested orientation explicitly, not a horizontal flip of an existing image. Match modular proportions and shared materials; no newly invented theme.
Reference roles: Image 1 is the technical geometry guide only, not an art style. Subsequent attached images are material/shading references only. They are not edit targets. The old native floor panel's diamond ratio/padding and old long-wall proportions are not authoritative geometry; the guide and this prompt control those. Ignore any characters, furniture and decorations visible in a context reference.
Output: exactly ONE complete isolated PNG image with true RGBA transparency, preferably a 1024x1024 native canvas with at least 8% transparent padding on every side. Keep the complete contour inside the canvas. No spritesheet, contact sheet, alternatives, labels, ID numbers, dimensions drawn on the image, watermark or logo. No black/white/background rectangle, fake checkerboard transparency, baked surrounding room/floor, background glow or cast shadow stretching outside the object. Keep subtle contact shading within the object.
Avoid: people, AI agents, characters, desk, chair, sofa, TV, rugs, plants, posters, bookshelves, room-specific decorations, full office/room compositions, doors added to plain-wall jobs, random objects and extra architecture beyond the requested single module.
Numbers below are engine registration targets, not annotations to draw. A larger native canvas is fine; correct geometry/proportions matter more than guessing the final packing dimensions. Do not claim exact alpha, seamless tiling, grid registration or engine acceptance without checking actual exported pixels.

Input images to attach, in this order:
Image 1: 01-geometri-2-to-1.png
Image 2: 07-doorframe-reference.png
Image 3: 04-wall-tall-L-reference.png

Primary request (D06):
One isolated entrance office passage frame along L. Total ground span one grid edge, thickness six logical units, total height 80. Each jamb takes four logical units along the span; unobstructed clear width is 24 logical units. Two slim jambs and one lintel; clear opening height 72 logical pixels. No door leaf, glass across the opening, sill step or floor patch. A restrained narrow cyan inset on one jamb, same charcoal hardware as the reference. Ends join adjoining wall modules. A true transparent passage, never filled with a black rectangle or another room scene.

Target geometry for later packing:
{"axis": "L", "lengthTiles": 1, "height": 80, "thickness": 6, "clearWidth": 24, "clearHeight": 72}

Suggested downloaded filename: D06-door-entrance-l.png
Return the single image. Do not create a room, combine modules or generate the other jobs from this pack.
```

## G01 — Jendela R

```text
Use case: stylized-concept.
Asset type: reusable isolated 2.5D office architecture game sprite, not a complete room.
Style: match the attached Dot office reference: clean illustrated contours, controlled soft painted shading, matte light honey oak, cool blue-gray wall panels, charcoal trims and tiny restrained cyan accents. Warm, tidy modern office; neither photorealism, pixel art nor shiny low-poly Blender render.
Camera: orthographic 2:1 DIMETRIC. R/+gx goes screen down-right (+32,+16), L/+gy goes down-left (-32,+16). Vertical world edges stay vertical on screen. A floor diamond has width:height 2:1; do not default to 30-degree true isometric or perspective vanishing points.
Lighting: upper-left of the SCREEN, soft and consistent. Generate the requested orientation explicitly, not a horizontal flip of an existing image. Match modular proportions and shared materials; no newly invented theme.
Reference roles: Image 1 is the technical geometry guide only, not an art style. Subsequent attached images are material/shading references only. They are not edit targets. The old native floor panel's diamond ratio/padding and old long-wall proportions are not authoritative geometry; the guide and this prompt control those. Ignore any characters, furniture and decorations visible in a context reference.
Output: exactly ONE complete isolated PNG image with true RGBA transparency, preferably a 1024x1024 native canvas with at least 8% transparent padding on every side. Keep the complete contour inside the canvas. No spritesheet, contact sheet, alternatives, labels, ID numbers, dimensions drawn on the image, watermark or logo. No black/white/background rectangle, fake checkerboard transparency, baked surrounding room/floor, background glow or cast shadow stretching outside the object. Keep subtle contact shading within the object.
Avoid: people, AI agents, characters, desk, chair, sofa, TV, rugs, plants, posters, bookshelves, room-specific decorations, full office/room compositions, doors added to plain-wall jobs, random objects and extra architecture beyond the requested single module.
Numbers below are engine registration targets, not annotations to draw. A larger native canvas is fine; correct geometry/proportions matter more than guessing the final packing dimensions. Do not claim exact alpha, seamless tiling, grid registration or engine acceptance without checking actual exported pixels.

Input images to attach, in this order:
Image 1: 01-geometri-2-to-1.png
Image 2: 03-wall-tall-R-reference.png
Image 3: 07-doorframe-reference.png

Primary request (G01):
One isolated window module along R, ground length one grid edge, total height 80 and wall/frame thickness six logical units. A blue-gray tall-wall window bay with a centered clean rectangular opening, charcoal frame and pale cyan lightly tinted glass. Solid wall below/above the aperture matches the tall walls. No view painted behind the glass. Reflections are quiet and consistent with upper-left light. Glass uses genuine partial alpha; transparent margins and openings must not contain a checkerboard, landscape or fake transparency. No frosted labels, screens or UI.

Target geometry for later packing:
{"axis": "R", "lengthTiles": 1, "height": 80, "thickness": 6}

Suggested downloaded filename: G01-window-r.png
Return the single image. Do not create a room, combine modules or generate the other jobs from this pack.
```

## G02 — Jendela L

```text
Use case: stylized-concept.
Asset type: reusable isolated 2.5D office architecture game sprite, not a complete room.
Style: match the attached Dot office reference: clean illustrated contours, controlled soft painted shading, matte light honey oak, cool blue-gray wall panels, charcoal trims and tiny restrained cyan accents. Warm, tidy modern office; neither photorealism, pixel art nor shiny low-poly Blender render.
Camera: orthographic 2:1 DIMETRIC. R/+gx goes screen down-right (+32,+16), L/+gy goes down-left (-32,+16). Vertical world edges stay vertical on screen. A floor diamond has width:height 2:1; do not default to 30-degree true isometric or perspective vanishing points.
Lighting: upper-left of the SCREEN, soft and consistent. Generate the requested orientation explicitly, not a horizontal flip of an existing image. Match modular proportions and shared materials; no newly invented theme.
Reference roles: Image 1 is the technical geometry guide only, not an art style. Subsequent attached images are material/shading references only. They are not edit targets. The old native floor panel's diamond ratio/padding and old long-wall proportions are not authoritative geometry; the guide and this prompt control those. Ignore any characters, furniture and decorations visible in a context reference.
Output: exactly ONE complete isolated PNG image with true RGBA transparency, preferably a 1024x1024 native canvas with at least 8% transparent padding on every side. Keep the complete contour inside the canvas. No spritesheet, contact sheet, alternatives, labels, ID numbers, dimensions drawn on the image, watermark or logo. No black/white/background rectangle, fake checkerboard transparency, baked surrounding room/floor, background glow or cast shadow stretching outside the object. Keep subtle contact shading within the object.
Avoid: people, AI agents, characters, desk, chair, sofa, TV, rugs, plants, posters, bookshelves, room-specific decorations, full office/room compositions, doors added to plain-wall jobs, random objects and extra architecture beyond the requested single module.
Numbers below are engine registration targets, not annotations to draw. A larger native canvas is fine; correct geometry/proportions matter more than guessing the final packing dimensions. Do not claim exact alpha, seamless tiling, grid registration or engine acceptance without checking actual exported pixels.

Input images to attach, in this order:
Image 1: 01-geometri-2-to-1.png
Image 2: 04-wall-tall-L-reference.png
Image 3: 07-doorframe-reference.png

Primary request (G02):
One isolated window module along L, ground length one grid edge, total height 80 and wall/frame thickness six logical units. A blue-gray tall-wall window bay with a centered clean rectangular opening, charcoal frame and pale cyan lightly tinted glass. Solid wall below/above the aperture matches the tall walls. No view painted behind the glass. Reflections are quiet and consistent with upper-left light. Glass uses genuine partial alpha; transparent margins and openings must not contain a checkerboard, landscape or fake transparency. No frosted labels, screens or UI.

Target geometry for later packing:
{"axis": "L", "lengthTiles": 1, "height": 80, "thickness": 6}

Suggested downloaded filename: G02-window-l.png
Return the single image. Do not create a room, combine modules or generate the other jobs from this pack.
```

## G03 — Partisi kaca opsional R

```text
Use case: stylized-concept.
Asset type: reusable isolated 2.5D office architecture game sprite, not a complete room.
Style: match the attached Dot office reference: clean illustrated contours, controlled soft painted shading, matte light honey oak, cool blue-gray wall panels, charcoal trims and tiny restrained cyan accents. Warm, tidy modern office; neither photorealism, pixel art nor shiny low-poly Blender render.
Camera: orthographic 2:1 DIMETRIC. R/+gx goes screen down-right (+32,+16), L/+gy goes down-left (-32,+16). Vertical world edges stay vertical on screen. A floor diamond has width:height 2:1; do not default to 30-degree true isometric or perspective vanishing points.
Lighting: upper-left of the SCREEN, soft and consistent. Generate the requested orientation explicitly, not a horizontal flip of an existing image. Match modular proportions and shared materials; no newly invented theme.
Reference roles: Image 1 is the technical geometry guide only, not an art style. Subsequent attached images are material/shading references only. They are not edit targets. The old native floor panel's diamond ratio/padding and old long-wall proportions are not authoritative geometry; the guide and this prompt control those. Ignore any characters, furniture and decorations visible in a context reference.
Output: exactly ONE complete isolated PNG image with true RGBA transparency, preferably a 1024x1024 native canvas with at least 8% transparent padding on every side. Keep the complete contour inside the canvas. No spritesheet, contact sheet, alternatives, labels, ID numbers, dimensions drawn on the image, watermark or logo. No black/white/background rectangle, fake checkerboard transparency, baked surrounding room/floor, background glow or cast shadow stretching outside the object. Keep subtle contact shading within the object.
Avoid: people, AI agents, characters, desk, chair, sofa, TV, rugs, plants, posters, bookshelves, room-specific decorations, full office/room compositions, doors added to plain-wall jobs, random objects and extra architecture beyond the requested single module.
Numbers below are engine registration targets, not annotations to draw. A larger native canvas is fine; correct geometry/proportions matter more than guessing the final packing dimensions. Do not claim exact alpha, seamless tiling, grid registration or engine acceptance without checking actual exported pixels.

Input images to attach, in this order:
Image 1: 01-geometri-2-to-1.png
Image 2: 03-wall-tall-R-reference.png
Image 3: 07-doorframe-reference.png

Primary request (G03):
One isolated partition module along R, ground length one grid edge, total height 80 and wall/frame thickness six logical units. A floor-to-top minimalist interior glass partition panel, thin charcoal frame and pale cyan lightly tinted glass. No door, opaque drywall infill or furniture; this is an optional future structural variant, not a new room layout. Reflections are quiet and consistent with upper-left light. Glass uses genuine partial alpha; transparent margins and openings must not contain a checkerboard, landscape or fake transparency. No frosted labels, screens or UI.

Target geometry for later packing:
{"axis": "R", "lengthTiles": 1, "height": 80, "thickness": 6}

Suggested downloaded filename: G03-partition-r.png
Return the single image. Do not create a room, combine modules or generate the other jobs from this pack.
```

## G04 — Partisi kaca opsional L

```text
Use case: stylized-concept.
Asset type: reusable isolated 2.5D office architecture game sprite, not a complete room.
Style: match the attached Dot office reference: clean illustrated contours, controlled soft painted shading, matte light honey oak, cool blue-gray wall panels, charcoal trims and tiny restrained cyan accents. Warm, tidy modern office; neither photorealism, pixel art nor shiny low-poly Blender render.
Camera: orthographic 2:1 DIMETRIC. R/+gx goes screen down-right (+32,+16), L/+gy goes down-left (-32,+16). Vertical world edges stay vertical on screen. A floor diamond has width:height 2:1; do not default to 30-degree true isometric or perspective vanishing points.
Lighting: upper-left of the SCREEN, soft and consistent. Generate the requested orientation explicitly, not a horizontal flip of an existing image. Match modular proportions and shared materials; no newly invented theme.
Reference roles: Image 1 is the technical geometry guide only, not an art style. Subsequent attached images are material/shading references only. They are not edit targets. The old native floor panel's diamond ratio/padding and old long-wall proportions are not authoritative geometry; the guide and this prompt control those. Ignore any characters, furniture and decorations visible in a context reference.
Output: exactly ONE complete isolated PNG image with true RGBA transparency, preferably a 1024x1024 native canvas with at least 8% transparent padding on every side. Keep the complete contour inside the canvas. No spritesheet, contact sheet, alternatives, labels, ID numbers, dimensions drawn on the image, watermark or logo. No black/white/background rectangle, fake checkerboard transparency, baked surrounding room/floor, background glow or cast shadow stretching outside the object. Keep subtle contact shading within the object.
Avoid: people, AI agents, characters, desk, chair, sofa, TV, rugs, plants, posters, bookshelves, room-specific decorations, full office/room compositions, doors added to plain-wall jobs, random objects and extra architecture beyond the requested single module.
Numbers below are engine registration targets, not annotations to draw. A larger native canvas is fine; correct geometry/proportions matter more than guessing the final packing dimensions. Do not claim exact alpha, seamless tiling, grid registration or engine acceptance without checking actual exported pixels.

Input images to attach, in this order:
Image 1: 01-geometri-2-to-1.png
Image 2: 04-wall-tall-L-reference.png
Image 3: 07-doorframe-reference.png

Primary request (G04):
One isolated partition module along L, ground length one grid edge, total height 80 and wall/frame thickness six logical units. A floor-to-top minimalist interior glass partition panel, thin charcoal frame and pale cyan lightly tinted glass. No door, opaque drywall infill or furniture; this is an optional future structural variant, not a new room layout. Reflections are quiet and consistent with upper-left light. Glass uses genuine partial alpha; transparent margins and openings must not contain a checkerboard, landscape or fake transparency. No frosted labels, screens or UI.

Target geometry for later packing:
{"axis": "L", "lengthTiles": 1, "height": 80, "thickness": 6}

Suggested downloaded filename: G04-partition-l.png
Return the single image. Do not create a room, combine modules or generate the other jobs from this pack.
```

## J01 — Ambang lantai R

```text
Use case: stylized-concept.
Asset type: reusable isolated 2.5D office architecture game sprite, not a complete room.
Style: match the attached Dot office reference: clean illustrated contours, controlled soft painted shading, matte light honey oak, cool blue-gray wall panels, charcoal trims and tiny restrained cyan accents. Warm, tidy modern office; neither photorealism, pixel art nor shiny low-poly Blender render.
Camera: orthographic 2:1 DIMETRIC. R/+gx goes screen down-right (+32,+16), L/+gy goes down-left (-32,+16). Vertical world edges stay vertical on screen. A floor diamond has width:height 2:1; do not default to 30-degree true isometric or perspective vanishing points.
Lighting: upper-left of the SCREEN, soft and consistent. Generate the requested orientation explicitly, not a horizontal flip of an existing image. Match modular proportions and shared materials; no newly invented theme.
Reference roles: Image 1 is the technical geometry guide only, not an art style. Subsequent attached images are material/shading references only. They are not edit targets. The old native floor panel's diamond ratio/padding and old long-wall proportions are not authoritative geometry; the guide and this prompt control those. Ignore any characters, furniture and decorations visible in a context reference.
Output: exactly ONE complete isolated PNG image with true RGBA transparency, preferably a 1024x1024 native canvas with at least 8% transparent padding on every side. Keep the complete contour inside the canvas. No spritesheet, contact sheet, alternatives, labels, ID numbers, dimensions drawn on the image, watermark or logo. No black/white/background rectangle, fake checkerboard transparency, baked surrounding room/floor, background glow or cast shadow stretching outside the object. Keep subtle contact shading within the object.
Avoid: people, AI agents, characters, desk, chair, sofa, TV, rugs, plants, posters, bookshelves, room-specific decorations, full office/room compositions, doors added to plain-wall jobs, random objects and extra architecture beyond the requested single module.
Numbers below are engine registration targets, not annotations to draw. A larger native canvas is fine; correct geometry/proportions matter more than guessing the final packing dimensions. Do not claim exact alpha, seamless tiling, grid registration or engine acceptance without checking actual exported pixels.

Input images to attach, in this order:
Image 1: 01-geometri-2-to-1.png
Image 2: 07-doorframe-reference.png
Image 3: 02-oak-reference.png

Primary request (J01):
One flush ground-level charcoal metal threshold strip running along R. Length one grid edge; narrow three-logical-unit footprint across the strip, height zero (no step). Clean seam between oak and gray floor, no adjoining floor tiles, doorway, screw text, carpet or decoration. It must not make a walkable opening look blocked.

Target geometry for later packing:
{"axis": "R", "lengthTiles": 1, "width": 3, "height": 0}

Suggested downloaded filename: J01-threshold-r.png
Return the single image. Do not create a room, combine modules or generate the other jobs from this pack.
```

## J02 — Ambang lantai L

```text
Use case: stylized-concept.
Asset type: reusable isolated 2.5D office architecture game sprite, not a complete room.
Style: match the attached Dot office reference: clean illustrated contours, controlled soft painted shading, matte light honey oak, cool blue-gray wall panels, charcoal trims and tiny restrained cyan accents. Warm, tidy modern office; neither photorealism, pixel art nor shiny low-poly Blender render.
Camera: orthographic 2:1 DIMETRIC. R/+gx goes screen down-right (+32,+16), L/+gy goes down-left (-32,+16). Vertical world edges stay vertical on screen. A floor diamond has width:height 2:1; do not default to 30-degree true isometric or perspective vanishing points.
Lighting: upper-left of the SCREEN, soft and consistent. Generate the requested orientation explicitly, not a horizontal flip of an existing image. Match modular proportions and shared materials; no newly invented theme.
Reference roles: Image 1 is the technical geometry guide only, not an art style. Subsequent attached images are material/shading references only. They are not edit targets. The old native floor panel's diamond ratio/padding and old long-wall proportions are not authoritative geometry; the guide and this prompt control those. Ignore any characters, furniture and decorations visible in a context reference.
Output: exactly ONE complete isolated PNG image with true RGBA transparency, preferably a 1024x1024 native canvas with at least 8% transparent padding on every side. Keep the complete contour inside the canvas. No spritesheet, contact sheet, alternatives, labels, ID numbers, dimensions drawn on the image, watermark or logo. No black/white/background rectangle, fake checkerboard transparency, baked surrounding room/floor, background glow or cast shadow stretching outside the object. Keep subtle contact shading within the object.
Avoid: people, AI agents, characters, desk, chair, sofa, TV, rugs, plants, posters, bookshelves, room-specific decorations, full office/room compositions, doors added to plain-wall jobs, random objects and extra architecture beyond the requested single module.
Numbers below are engine registration targets, not annotations to draw. A larger native canvas is fine; correct geometry/proportions matter more than guessing the final packing dimensions. Do not claim exact alpha, seamless tiling, grid registration or engine acceptance without checking actual exported pixels.

Input images to attach, in this order:
Image 1: 01-geometri-2-to-1.png
Image 2: 07-doorframe-reference.png
Image 3: 02-oak-reference.png

Primary request (J02):
One flush ground-level charcoal metal threshold strip running along L. Length one grid edge; narrow three-logical-unit footprint across the strip, height zero (no step). Clean seam between oak and gray floor, no adjoining floor tiles, doorway, screw text, carpet or decoration. It must not make a walkable opening look blocked.

Target geometry for later packing:
{"axis": "L", "lengthTiles": 1, "width": 3, "height": 0}

Suggested downloaded filename: J02-threshold-l.png
Return the single image. Do not create a room, combine modules or generate the other jobs from this pack.
```

## O01 — Permukaan air kolam

```text
Use case: stylized-concept.
Asset type: reusable isolated 2.5D office architecture game sprite, not a complete room.
Style: match the attached Dot office reference: clean illustrated contours, controlled soft painted shading, matte light honey oak, cool blue-gray wall panels, charcoal trims and tiny restrained cyan accents. Warm, tidy modern office; neither photorealism, pixel art nor shiny low-poly Blender render.
Camera: orthographic 2:1 DIMETRIC. R/+gx goes screen down-right (+32,+16), L/+gy goes down-left (-32,+16). Vertical world edges stay vertical on screen. A floor diamond has width:height 2:1; do not default to 30-degree true isometric or perspective vanishing points.
Lighting: upper-left of the SCREEN, soft and consistent. Generate the requested orientation explicitly, not a horizontal flip of an existing image. Match modular proportions and shared materials; no newly invented theme.
Reference roles: Image 1 is the technical geometry guide only, not an art style. Subsequent attached images are material/shading references only. They are not edit targets. The old native floor panel's diamond ratio/padding and old long-wall proportions are not authoritative geometry; the guide and this prompt control those. Ignore any characters, furniture and decorations visible in a context reference.
Output: exactly ONE complete isolated PNG image with true RGBA transparency, preferably a 1024x1024 native canvas with at least 8% transparent padding on every side. Keep the complete contour inside the canvas. No spritesheet, contact sheet, alternatives, labels, ID numbers, dimensions drawn on the image, watermark or logo. No black/white/background rectangle, fake checkerboard transparency, baked surrounding room/floor, background glow or cast shadow stretching outside the object. Keep subtle contact shading within the object.
Avoid: people, AI agents, characters, desk, chair, sofa, TV, rugs, plants, posters, bookshelves, room-specific decorations, full office/room compositions, doors added to plain-wall jobs, random objects and extra architecture beyond the requested single module.
Numbers below are engine registration targets, not annotations to draw. A larger native canvas is fine; correct geometry/proportions matter more than guessing the final packing dimensions. Do not claim exact alpha, seamless tiling, grid registration or engine acceptance without checking actual exported pixels.

Input images to attach, in this order:
Image 1: 01-geometri-2-to-1.png
Image 2: 00-suasana-z08.png
Image 3: 03-wall-tall-R-reference.png

Primary request (O01):
One seamless single-tile still pool-water diamond, muted clear cyan/teal with very gentle small ripples and soft restrained light. Water inside the diamond is opaque so unrelated underlying floor does not show through. No pool rim, rectangular pool scene, swimmers, ladder, floating objects, sunlight sparkle stars or slab sides. Repeatable edges; no perimeter outline.

Target geometry for later packing:
{"footprintTiles": [1, 1], "logicalDiamond": [64, 32], "packedDiamondPx": [128, 64], "thickness": 0}

Suggested downloaded filename: O01-pool-water.png
Return the single image. Do not create a room, combine modules or generate the other jobs from this pack.
```

## O02 — Bibir kolam R

```text
Use case: stylized-concept.
Asset type: reusable isolated 2.5D office architecture game sprite, not a complete room.
Style: match the attached Dot office reference: clean illustrated contours, controlled soft painted shading, matte light honey oak, cool blue-gray wall panels, charcoal trims and tiny restrained cyan accents. Warm, tidy modern office; neither photorealism, pixel art nor shiny low-poly Blender render.
Camera: orthographic 2:1 DIMETRIC. R/+gx goes screen down-right (+32,+16), L/+gy goes down-left (-32,+16). Vertical world edges stay vertical on screen. A floor diamond has width:height 2:1; do not default to 30-degree true isometric or perspective vanishing points.
Lighting: upper-left of the SCREEN, soft and consistent. Generate the requested orientation explicitly, not a horizontal flip of an existing image. Match modular proportions and shared materials; no newly invented theme.
Reference roles: Image 1 is the technical geometry guide only, not an art style. Subsequent attached images are material/shading references only. They are not edit targets. The old native floor panel's diamond ratio/padding and old long-wall proportions are not authoritative geometry; the guide and this prompt control those. Ignore any characters, furniture and decorations visible in a context reference.
Output: exactly ONE complete isolated PNG image with true RGBA transparency, preferably a 1024x1024 native canvas with at least 8% transparent padding on every side. Keep the complete contour inside the canvas. No spritesheet, contact sheet, alternatives, labels, ID numbers, dimensions drawn on the image, watermark or logo. No black/white/background rectangle, fake checkerboard transparency, baked surrounding room/floor, background glow or cast shadow stretching outside the object. Keep subtle contact shading within the object.
Avoid: people, AI agents, characters, desk, chair, sofa, TV, rugs, plants, posters, bookshelves, room-specific decorations, full office/room compositions, doors added to plain-wall jobs, random objects and extra architecture beyond the requested single module.
Numbers below are engine registration targets, not annotations to draw. A larger native canvas is fine; correct geometry/proportions matter more than guessing the final packing dimensions. Do not claim exact alpha, seamless tiling, grid registration or engine acceptance without checking actual exported pixels.

Input images to attach, in this order:
Image 1: 01-geometri-2-to-1.png
Image 2: 03-wall-tall-R-reference.png
Image 3: 02-oak-reference.png

Primary request (O02):
One straight matte blue-gray stone pool coping/rim segment along R, length one grid edge. Band width eight logical units, top flush with outdoor deck level; a short four-logical-pixel inner lip is visible below the water-facing edge. No surrounding deck or water plane. Flush modular ends, quiet contour and texture; no lounger, ladder or plant.

Target geometry for later packing:
{"axis": "R", "lengthTiles": 1, "width": 8, "innerLipDepth": 4, "waterSide": "toward pool interior at assembly"}

Suggested downloaded filename: O02-pool-coping-r.png
Return the single image. Do not create a room, combine modules or generate the other jobs from this pack.
```

## O03 — Bibir kolam L

```text
Use case: stylized-concept.
Asset type: reusable isolated 2.5D office architecture game sprite, not a complete room.
Style: match the attached Dot office reference: clean illustrated contours, controlled soft painted shading, matte light honey oak, cool blue-gray wall panels, charcoal trims and tiny restrained cyan accents. Warm, tidy modern office; neither photorealism, pixel art nor shiny low-poly Blender render.
Camera: orthographic 2:1 DIMETRIC. R/+gx goes screen down-right (+32,+16), L/+gy goes down-left (-32,+16). Vertical world edges stay vertical on screen. A floor diamond has width:height 2:1; do not default to 30-degree true isometric or perspective vanishing points.
Lighting: upper-left of the SCREEN, soft and consistent. Generate the requested orientation explicitly, not a horizontal flip of an existing image. Match modular proportions and shared materials; no newly invented theme.
Reference roles: Image 1 is the technical geometry guide only, not an art style. Subsequent attached images are material/shading references only. They are not edit targets. The old native floor panel's diamond ratio/padding and old long-wall proportions are not authoritative geometry; the guide and this prompt control those. Ignore any characters, furniture and decorations visible in a context reference.
Output: exactly ONE complete isolated PNG image with true RGBA transparency, preferably a 1024x1024 native canvas with at least 8% transparent padding on every side. Keep the complete contour inside the canvas. No spritesheet, contact sheet, alternatives, labels, ID numbers, dimensions drawn on the image, watermark or logo. No black/white/background rectangle, fake checkerboard transparency, baked surrounding room/floor, background glow or cast shadow stretching outside the object. Keep subtle contact shading within the object.
Avoid: people, AI agents, characters, desk, chair, sofa, TV, rugs, plants, posters, bookshelves, room-specific decorations, full office/room compositions, doors added to plain-wall jobs, random objects and extra architecture beyond the requested single module.
Numbers below are engine registration targets, not annotations to draw. A larger native canvas is fine; correct geometry/proportions matter more than guessing the final packing dimensions. Do not claim exact alpha, seamless tiling, grid registration or engine acceptance without checking actual exported pixels.

Input images to attach, in this order:
Image 1: 01-geometri-2-to-1.png
Image 2: 04-wall-tall-L-reference.png
Image 3: 02-oak-reference.png

Primary request (O03):
One straight matte blue-gray stone pool coping/rim segment along L, length one grid edge. Band width eight logical units, top flush with outdoor deck level; a short four-logical-pixel inner lip is visible below the water-facing edge. No surrounding deck or water plane. Flush modular ends, quiet contour and texture; no lounger, ladder or plant.

Target geometry for later packing:
{"axis": "L", "lengthTiles": 1, "width": 8, "innerLipDepth": 4, "waterSide": "toward pool interior at assembly"}

Suggested downloaded filename: O03-pool-coping-l.png
Return the single image. Do not create a room, combine modules or generate the other jobs from this pack.
```

## O04 — Sudut bibir kolam N

```text
Use case: stylized-concept.
Asset type: reusable isolated 2.5D office architecture game sprite, not a complete room.
Style: match the attached Dot office reference: clean illustrated contours, controlled soft painted shading, matte light honey oak, cool blue-gray wall panels, charcoal trims and tiny restrained cyan accents. Warm, tidy modern office; neither photorealism, pixel art nor shiny low-poly Blender render.
Camera: orthographic 2:1 DIMETRIC. R/+gx goes screen down-right (+32,+16), L/+gy goes down-left (-32,+16). Vertical world edges stay vertical on screen. A floor diamond has width:height 2:1; do not default to 30-degree true isometric or perspective vanishing points.
Lighting: upper-left of the SCREEN, soft and consistent. Generate the requested orientation explicitly, not a horizontal flip of an existing image. Match modular proportions and shared materials; no newly invented theme.
Reference roles: Image 1 is the technical geometry guide only, not an art style. Subsequent attached images are material/shading references only. They are not edit targets. The old native floor panel's diamond ratio/padding and old long-wall proportions are not authoritative geometry; the guide and this prompt control those. Ignore any characters, furniture and decorations visible in a context reference.
Output: exactly ONE complete isolated PNG image with true RGBA transparency, preferably a 1024x1024 native canvas with at least 8% transparent padding on every side. Keep the complete contour inside the canvas. No spritesheet, contact sheet, alternatives, labels, ID numbers, dimensions drawn on the image, watermark or logo. No black/white/background rectangle, fake checkerboard transparency, baked surrounding room/floor, background glow or cast shadow stretching outside the object. Keep subtle contact shading within the object.
Avoid: people, AI agents, characters, desk, chair, sofa, TV, rugs, plants, posters, bookshelves, room-specific decorations, full office/room compositions, doors added to plain-wall jobs, random objects and extra architecture beyond the requested single module.
Numbers below are engine registration targets, not annotations to draw. A larger native canvas is fine; correct geometry/proportions matter more than guessing the final packing dimensions. Do not claim exact alpha, seamless tiling, grid registration or engine acceptance without checking actual exported pixels.

Input images to attach, in this order:
Image 1: 01-geometri-2-to-1.png
Image 2: 03-wall-tall-R-reference.png
Image 3: 04-wall-tall-L-reference.png

Primary request (O04):
One N corner pool coping module connecting two perpendicular rim runs. Vertex N has one-grid-edge legs going screen lower-right (+R) and lower-left (+L). Match straight coping: blue-gray matte stone, band width eight logical units, top flush with deck, inner lip depth four. The lip faces the interior of the diamond pool, never the outdoor deck. No water plane, complete pool, floor surface, ladder or furniture.

Target geometry for later packing:
{"corner": "N", "legsTiles": [1, 1], "width": 8, "innerLipDepth": 4}

Suggested downloaded filename: O04-pool-coping-corner-n.png
Return the single image. Do not create a room, combine modules or generate the other jobs from this pack.
```

## O05 — Sudut bibir kolam S

```text
Use case: stylized-concept.
Asset type: reusable isolated 2.5D office architecture game sprite, not a complete room.
Style: match the attached Dot office reference: clean illustrated contours, controlled soft painted shading, matte light honey oak, cool blue-gray wall panels, charcoal trims and tiny restrained cyan accents. Warm, tidy modern office; neither photorealism, pixel art nor shiny low-poly Blender render.
Camera: orthographic 2:1 DIMETRIC. R/+gx goes screen down-right (+32,+16), L/+gy goes down-left (-32,+16). Vertical world edges stay vertical on screen. A floor diamond has width:height 2:1; do not default to 30-degree true isometric or perspective vanishing points.
Lighting: upper-left of the SCREEN, soft and consistent. Generate the requested orientation explicitly, not a horizontal flip of an existing image. Match modular proportions and shared materials; no newly invented theme.
Reference roles: Image 1 is the technical geometry guide only, not an art style. Subsequent attached images are material/shading references only. They are not edit targets. The old native floor panel's diamond ratio/padding and old long-wall proportions are not authoritative geometry; the guide and this prompt control those. Ignore any characters, furniture and decorations visible in a context reference.
Output: exactly ONE complete isolated PNG image with true RGBA transparency, preferably a 1024x1024 native canvas with at least 8% transparent padding on every side. Keep the complete contour inside the canvas. No spritesheet, contact sheet, alternatives, labels, ID numbers, dimensions drawn on the image, watermark or logo. No black/white/background rectangle, fake checkerboard transparency, baked surrounding room/floor, background glow or cast shadow stretching outside the object. Keep subtle contact shading within the object.
Avoid: people, AI agents, characters, desk, chair, sofa, TV, rugs, plants, posters, bookshelves, room-specific decorations, full office/room compositions, doors added to plain-wall jobs, random objects and extra architecture beyond the requested single module.
Numbers below are engine registration targets, not annotations to draw. A larger native canvas is fine; correct geometry/proportions matter more than guessing the final packing dimensions. Do not claim exact alpha, seamless tiling, grid registration or engine acceptance without checking actual exported pixels.

Input images to attach, in this order:
Image 1: 01-geometri-2-to-1.png
Image 2: 03-wall-tall-R-reference.png
Image 3: 04-wall-tall-L-reference.png

Primary request (O05):
One S corner pool coping module connecting two perpendicular rim runs. Vertex S has one-grid-edge legs going screen upper-left (-R) and upper-right (-L). Match straight coping: blue-gray matte stone, band width eight logical units, top flush with deck, inner lip depth four. The lip faces the interior of the diamond pool, never the outdoor deck. No water plane, complete pool, floor surface, ladder or furniture.

Target geometry for later packing:
{"corner": "S", "legsTiles": [1, 1], "width": 8, "innerLipDepth": 4}

Suggested downloaded filename: O05-pool-coping-corner-s.png
Return the single image. Do not create a room, combine modules or generate the other jobs from this pack.
```

## O06 — Sudut bibir kolam E

```text
Use case: stylized-concept.
Asset type: reusable isolated 2.5D office architecture game sprite, not a complete room.
Style: match the attached Dot office reference: clean illustrated contours, controlled soft painted shading, matte light honey oak, cool blue-gray wall panels, charcoal trims and tiny restrained cyan accents. Warm, tidy modern office; neither photorealism, pixel art nor shiny low-poly Blender render.
Camera: orthographic 2:1 DIMETRIC. R/+gx goes screen down-right (+32,+16), L/+gy goes down-left (-32,+16). Vertical world edges stay vertical on screen. A floor diamond has width:height 2:1; do not default to 30-degree true isometric or perspective vanishing points.
Lighting: upper-left of the SCREEN, soft and consistent. Generate the requested orientation explicitly, not a horizontal flip of an existing image. Match modular proportions and shared materials; no newly invented theme.
Reference roles: Image 1 is the technical geometry guide only, not an art style. Subsequent attached images are material/shading references only. They are not edit targets. The old native floor panel's diamond ratio/padding and old long-wall proportions are not authoritative geometry; the guide and this prompt control those. Ignore any characters, furniture and decorations visible in a context reference.
Output: exactly ONE complete isolated PNG image with true RGBA transparency, preferably a 1024x1024 native canvas with at least 8% transparent padding on every side. Keep the complete contour inside the canvas. No spritesheet, contact sheet, alternatives, labels, ID numbers, dimensions drawn on the image, watermark or logo. No black/white/background rectangle, fake checkerboard transparency, baked surrounding room/floor, background glow or cast shadow stretching outside the object. Keep subtle contact shading within the object.
Avoid: people, AI agents, characters, desk, chair, sofa, TV, rugs, plants, posters, bookshelves, room-specific decorations, full office/room compositions, doors added to plain-wall jobs, random objects and extra architecture beyond the requested single module.
Numbers below are engine registration targets, not annotations to draw. A larger native canvas is fine; correct geometry/proportions matter more than guessing the final packing dimensions. Do not claim exact alpha, seamless tiling, grid registration or engine acceptance without checking actual exported pixels.

Input images to attach, in this order:
Image 1: 01-geometri-2-to-1.png
Image 2: 03-wall-tall-R-reference.png
Image 3: 04-wall-tall-L-reference.png

Primary request (O06):
One E corner pool coping module connecting two perpendicular rim runs. Vertex E has one-grid-edge legs going screen upper-left (-R) and lower-left (+L). Match straight coping: blue-gray matte stone, band width eight logical units, top flush with deck, inner lip depth four. The lip faces the interior of the diamond pool, never the outdoor deck. No water plane, complete pool, floor surface, ladder or furniture.

Target geometry for later packing:
{"corner": "E", "legsTiles": [1, 1], "width": 8, "innerLipDepth": 4}

Suggested downloaded filename: O06-pool-coping-corner-e.png
Return the single image. Do not create a room, combine modules or generate the other jobs from this pack.
```

## O07 — Sudut bibir kolam W

```text
Use case: stylized-concept.
Asset type: reusable isolated 2.5D office architecture game sprite, not a complete room.
Style: match the attached Dot office reference: clean illustrated contours, controlled soft painted shading, matte light honey oak, cool blue-gray wall panels, charcoal trims and tiny restrained cyan accents. Warm, tidy modern office; neither photorealism, pixel art nor shiny low-poly Blender render.
Camera: orthographic 2:1 DIMETRIC. R/+gx goes screen down-right (+32,+16), L/+gy goes down-left (-32,+16). Vertical world edges stay vertical on screen. A floor diamond has width:height 2:1; do not default to 30-degree true isometric or perspective vanishing points.
Lighting: upper-left of the SCREEN, soft and consistent. Generate the requested orientation explicitly, not a horizontal flip of an existing image. Match modular proportions and shared materials; no newly invented theme.
Reference roles: Image 1 is the technical geometry guide only, not an art style. Subsequent attached images are material/shading references only. They are not edit targets. The old native floor panel's diamond ratio/padding and old long-wall proportions are not authoritative geometry; the guide and this prompt control those. Ignore any characters, furniture and decorations visible in a context reference.
Output: exactly ONE complete isolated PNG image with true RGBA transparency, preferably a 1024x1024 native canvas with at least 8% transparent padding on every side. Keep the complete contour inside the canvas. No spritesheet, contact sheet, alternatives, labels, ID numbers, dimensions drawn on the image, watermark or logo. No black/white/background rectangle, fake checkerboard transparency, baked surrounding room/floor, background glow or cast shadow stretching outside the object. Keep subtle contact shading within the object.
Avoid: people, AI agents, characters, desk, chair, sofa, TV, rugs, plants, posters, bookshelves, room-specific decorations, full office/room compositions, doors added to plain-wall jobs, random objects and extra architecture beyond the requested single module.
Numbers below are engine registration targets, not annotations to draw. A larger native canvas is fine; correct geometry/proportions matter more than guessing the final packing dimensions. Do not claim exact alpha, seamless tiling, grid registration or engine acceptance without checking actual exported pixels.

Input images to attach, in this order:
Image 1: 01-geometri-2-to-1.png
Image 2: 03-wall-tall-R-reference.png
Image 3: 04-wall-tall-L-reference.png

Primary request (O07):
One W corner pool coping module connecting two perpendicular rim runs. Vertex W has one-grid-edge legs going screen lower-right (+R) and upper-right (-L). Match straight coping: blue-gray matte stone, band width eight logical units, top flush with deck, inner lip depth four. The lip faces the interior of the diamond pool, never the outdoor deck. No water plane, complete pool, floor surface, ladder or furniture.

Target geometry for later packing:
{"corner": "W", "legsTiles": [1, 1], "width": 8, "innerLipDepth": 4}

Suggested downloaded filename: O07-pool-coping-corner-w.png
Return the single image. Do not create a room, combine modules or generate the other jobs from this pack.
```
