Z08 APPROVED ROOM — 22 INDIVIDUAL COMPONENTS

These are separate native RGBA PNG generative redraws of approved room v3, not crops or pixel-registered extractions. No repo, map, source collision or deployed app was changed. Every PNG was visually inspected and its alpha channel checked. Native pixels and padding remain untouched.

PACKS
workstations: worker desk + SE worker chair, Guest desk + Guest chair (4)
gaming: sofa, rug, TV, media cabinet, PlayStation console, controller (6)
decor: Kanban, architecture board, code art, book/plant shelf, potted plant (5)
architecture: tall walls in 2 orientations, low walls in 2 orientations, corner/pillar, open doorway frame, oak floor (7)
Reuse worker desk/chair three times and controller twice. Shelf/books/plants and desk accessories are grouped where practical. These are 22 reusable components, not every tiny prop separated.

APPROVED COMPOSITION
Three workers in the long wall row. Guest laptop desk sits separately on opposite side near north doorway. Central gaming rug with compact sofa facing TV/media cabinet, console and two controllers. No standing lecterns. Software wall boards, books and plants; modular blue-gray panels, charcoal trim and restrained cyan accents.

SOURCE CONTRACT
Source baseline commit ae7473c16cb374544c9118d7d36d90515633fe02: Z08 bounds gx16..23, gy10..19; global map44x32,17zones,133slots,26doors. This pack does not edit these.
Keep worker anchors: Prism(17,12), Forge(17,14), Nova(17,16), all SE, sit_type. Source projection u=1088+32(gx-gy), v=64+16(gx+gy).
Keep door connectivity: north(19,10), south(19,19), east-to-Z09(23,14).
Guest relocation supersedes old(17,18) design. New Guest anchor/facing is not yet verified. Old standing slots at(21,13)/(21,17) are retired from visual design; replace/retire interactions in a separately checked source delta. New gaming seat anchors/actions/capacity and furniture collisions require implementation review. Never leave invisible old interactions or fake relocation with huge sprite offsets.

ASSEMBLY / LAYERS
1. Registered floor and rug as ground layers, never collision from alpha.
2. Back walls, wall artwork/shelves; register to actual wall plane.
3. Furniture sorted by ground contact depth, not PNG lower edge.
4. Seated avatars at validated interaction anchors; interleave with chair/sofa arms, desktop and foreground furniture pieces.
5. Near walls/pillars/door foreground pieces, split where a character crosses behind.
Use actual frame dimensions and explicit sprite pivots; transparent padding is significant. The manifest includes measured image data and uncalibrated visual anchor proposals where available. Null means intentionally unmeasured. Do not infer foot anchor from transparent bounding box.
Scale objects relative to the worker chair first; screen size varies independently of physical size. Keep camera fixed, no ad-hoc mirroring of asymmetric props. The Guest orientation label is provisional until tested against canonical direction helper.

IMPORTANT PRODUCTION LIMITS
- Native image dimensions are intentionally not uniform; renderer sizing/crop metadata must normalize physical scale. No pre-registered tiles or sprite atlas is claimed.
- Desk accessories are baked into desktop sprite, TV is separate from cabinet, chair separate from desk. Desk/chair/sofa occlusion slices are NOT supplied. Create masks/slices in implementation so avatar limbs can appear correctly. Whole-sprite z-order alone cannot solve every seated pose.
- Floor is an isolated visual floor panel, NOT proof of exact8x10 projected geometry. Match its four visual corners to the authoritative room polygon or rebuild floor deterministically from approved material; don't rescale the map to fit this image.
- Wall module lengths/heights and seams need calibration; repetition is a visual starting point, not mathematically seamless tiling. There is one open-doorframe orientation; opposite-axis door openings can use independent pillar pieces with a separately rendered/validated header. No automatic mirrored lighting claim.
- Many native object pixels have alpha250–254 instead of255. Exterior sample points/corners are alpha0. Some files contain sparse near-transparent edge pixels. Preserve alpha in your loader; apparent black/gray RGB outside the silhouette is invisible where alpha0. These native files have not been forcibly thresholded or edge-cleaned.
- Ground pivots, target scale, masks, exact collision clearance and all avatar animation alignment must pass browser/renderer QA before calling production-ready.

ACCEPTANCE
Check all PNG load paths; compose at actual game zoom; verify no opaque background/halo over light and dark floors; validate feet, seat contact, keyboard reach and screen direction; test walking around gaming area to all three doors; verify correct occlusion. Keep all other rooms untouched. This pack does not include character animations.
