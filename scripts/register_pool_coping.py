"""Register the immutable pool coping PNG as a continuous canonical stone ring.

Only the slab's pale top face is shown. Two CSS affine triangles fit that face
to each existing 64 x 32 ground diamond; no vertical slab, new water, map cell,
collision, slot, or raster edit is introduced. The caller owns the manifest.
"""
from pathlib import Path
import copy
import hashlib
import json
import math
import shutil

from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
MAP = ROOT / 'frontend/public/maps/floor1.tmj'
SPRITE = 'furniture_pool_coping.png'
ART_KIND = 'registered-pool-coping'
SOURCE_SIZE = (1774, 887)
SOURCE_SHA256 = '73f27a40e60513966128de0a2c800b9f391f3464fb434680ede4b3e6dbfc4e12'
# Read-only visual inspection of the original image, N/E/S/W. The outer
# contour includes antialiased dark edge pixels, so use a shallow interior
# top-face inset. Neither quad includes the vertical side of the source slab.
SOURCE_OUTLINE = ((445, 100), (1683, 601), (1275, 757), (95, 273))
SOURCE_QUAD = ((450, 105), (1670, 601), (1274, 751), (110, 274))
TARGET_QUAD = ((32, 0), (64, 16), (32, 32), (0, 16))
INTERNAL_OVERLAP = 0.2  # Logical pixels, at the shared N/S diagonal only.
RING_CELLS = frozenset((gx, gy) for gx in range(38, 43) for gy in range(25, 30)
                       if gx in (38, 42) or gy in (25, 29))
INNER_WATER_CELLS = frozenset((gx, gy) for gx in range(39, 42) for gy in range(26, 29))


def _sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def _polygon(points):
    return 'polygon(' + ','.join(f'{x}px {y}px' for x, y in points) + ')'


def project(matrix, point):
    """Apply a CSS [a,b,c,d,tx,ty] matrix in native source-pixel coordinates."""
    a, b, c, d, tx, ty = matrix
    x, y = point
    return [a*x + c*y + tx, b*x + d*y + ty]


def _affine(source, target):
    (x0, y0), (x1, y1), (x2, y2) = source
    (u0, v0), (u1, v1), (u2, v2) = target
    sx1, sy1, sx2, sy2 = x1-x0, y1-y0, x2-x0, y2-y0
    determinant = sx1*sy2 - sx2*sy1
    if abs(determinant) < 1e-12:
        raise ValueError('Degenerate pool coping source triangle')
    a = ((u1-u0)*sy2 - (u2-u0)*sy1) / determinant
    b = ((v1-v0)*sy2 - (v2-v0)*sy1) / determinant
    c = ((u2-u0)*sx1 - (u1-u0)*sx2) / determinant
    d = ((v2-v0)*sx1 - (v1-v0)*sx2) / determinant
    matrix = [a, b, c, d, u0-a*x0-c*y0, v0-b*x0-d*y0]
    if not all(math.isfinite(value) for value in matrix) or a*d-b*c <= 0:
        raise ValueError('Pool coping registration must not reflect the source')
    return matrix


def _registration():
    layers, checks = [], []
    for side, indices in [('right', (0, 1, 2)), ('left', (0, 2, 3))]:
        source = [list(SOURCE_QUAD[i]) for i in indices]
        target = [list(TARGET_QUAD[i]) for i in indices]
        matrix = _affine(source, target)
        clip = copy.deepcopy(source)
        if side == 'left':
            # Extend only the internal diagonal into the right triangle. These
            # extra vertices remain inside the measured source top face. The
            # wrapper still clips to the exact diamond, with no outer overlap.
            n, e, s, w = SOURCE_QUAD
            fraction = INTERNAL_OVERLAP / (project(matrix, e)[0] - TARGET_QUAD[0][0])
            if not 0 < fraction < 0.01:
                raise ValueError('Unexpected coping internal seam registration')
            near_n = [n[k] + fraction*(e[k]-n[k]) for k in range(2)]
            near_s = [s[k] + fraction*(e[k]-s[k]) for k in range(2)]
            clip = [list(n), near_n, near_s, list(s), list(w)]
        name = f'top-face-{side}'
        error = max(math.dist(project(matrix, point), goal)
                    for point, goal in zip(source, target))
        if error > 1e-8:
            raise ValueError('Pool coping corner registration is inexact')
        layers.append(dict(id=name, width=SOURCE_SIZE[0], height=SOURCE_SIZE[1],
                           clipPath=_polygon(clip), matrix=matrix))
        checks.append(dict(plane=name, sourceTriangle=source, sourceClipPolygon=clip,
                           targetTriangle=target, matrix=matrix,
                           determinant=matrix[0]*matrix[3]-matrix[1]*matrix[2],
                           maxCornerError=error))
    return dict(sourceQuad=[list(p) for p in SOURCE_QUAD],
                targetQuad=[list(p) for p in TARGET_QUAD], layers=layers, checks=checks,
                clipPath=_polygon(TARGET_QUAD), internalDiagonalOverlap=INTERNAL_OVERLAP,
                outerEdgeOverlap=0, topFaceOnly=True, verticalSlabRendered=False)


def _world(gx, gy):
    return [1088 + (gx-gy)*32, 64 + (gx+gy)*16]


def _contains(quad, point):
    # Convex clockwise-in-screen-coordinate quad, including its boundary.
    x, y = point
    return all((b[0]-a[0])*(y-a[1]) - (b[1]-a[1])*(x-a[0]) >= -1e-8
               for a, b in zip(quad, quad[1:] + quad[:1]))


def _edge_distance(point, a, b):
    dx, dy = b[0]-a[0], b[1]-a[1]
    t = max(0, min(1, ((point[0]-a[0])*dx + (point[1]-a[1])*dy)/(dx*dx+dy*dy)))
    return math.dist(point, [a[0]+t*dx, a[1]+t*dy])


def register_pool_coping(manifest, source_png, output_dir, web_base):
    """Return (all props with coping replaced, ledger), without mutating input.

    Pass the furniture directory and its matching URL as output_dir/web_base.
    The only output file is a byte-identical copy of source_png. Canonical map
    and original manifest are read-only; every coping ID/anchor/depth survives.
    """
    source_png, output_dir = Path(source_png), Path(output_dir)
    if source_png.name != SPRITE or _sha(source_png) != SOURCE_SHA256:
        raise ValueError('Pool coping source differs from the measured original PNG')
    with Image.open(source_png) as image:
        if image.size != SOURCE_SIZE or image.mode != 'RGBA':
            raise ValueError('Pool coping requires the original 1774 x 887 RGBA canvas')
    map_hash = _sha(MAP)
    if manifest['logicalMapSha256'] != map_hash:
        raise ValueError('Pool coping manifest does not match the canonical map')
    map_doc = json.loads(MAP.read_text(encoding='utf-8'))
    candidates = [prop for prop in manifest['props'] if prop['sprite'] == SPRITE]
    if len(candidates) != 16 or {(p['gx'], p['gy']) for p in candidates} != RING_CELLS:
        raise ValueError('Pool coping requires exactly the 16 canonical perimeter cells')
    if len({p['id'] for p in candidates}) != 16:
        raise ValueError('Duplicate canonical pool coping ID')
    if any(p.get('artKind') == ART_KIND for p in candidates):
        raise ValueError('Pool coping is already registered')
    if any([p['x'], p['y']] != _world(p['gx'], p['gy']) for p in candidates):
        raise ValueError('Pool coping logical anchors differ from the canonical grid')

    registration = _registration()
    file = f'{web_base.rstrip("/")}/{SPRITE}'
    props, instances = [], []
    for original in manifest['props']:
        prop = copy.deepcopy(original)
        if prop['sprite'] == SPRITE:
            bounds = dict(x=prop['x']-32, y=prop['y']-16, width=64, height=32)
            prop.update(file=file, artKind=ART_KIND, componentId='furniture_pool_coping',
                        zone='Z17', bounds=bounds,
                        artClipPath=registration['clipPath'],
                        artLayers=copy.deepcopy(registration['layers']))
            world_quad = [[bounds['x']+x, bounds['y']+y] for x, y in TARGET_QUAD]
            instances.append(dict(id=prop['id'], sourcePropId=original['id'],
                                  sourcePropIds=[original['id']],
                                  logicalAnchor=[prop['gx'], prop['gy']],
                                  worldAnchor=[prop['x'], prop['y']], depth=prop['z'],
                                  bounds=copy.deepcopy(bounds),
                                  targetWorldQuad=world_quad,
                                  registration=copy.deepcopy(registration)))
        props.append(prop)

    shapes = [(instance['id'], instance['targetWorldQuad']) for instance in instances]
    swim_checks = []
    for layer in map_doc['layers']:
        if layer['name'] != 'slots':
            continue
        for slot in layer['objects']:
            data = {p['name']: p['value'] for p in slot.get('properties', [])}
            if data.get('type', slot.get('type')) != 'pool_swim':
                continue
            center = [data['gx'], data['gy']]
            point = _world(*center)
            covered = [id for id, shape in shapes if _contains(shape, point)]
            clearance = min(_edge_distance(point, a, b) for _, shape in shapes
                            for a, b in zip(shape, shape[1:] + shape[:1]))
            swim_checks.append(dict(id=slot['id'], name=slot['name'], center=center,
                                    worldCenter=point, coveredBy=covered,
                                    minimumClearanceLogicalPixels=clearance))
    if len(swim_checks) != 6 or any(check['coveredBy'] for check in swim_checks):
        raise ValueError('Pool coping must keep all six canonical swim centers clear')
    water_checks = [dict(center=list(cell), worldCenter=_world(*cell),
                         coveredBy=[id for id, shape in shapes if _contains(shape, _world(*cell))])
                    for cell in sorted(INNER_WATER_CELLS)]
    if any(check['coveredBy'] for check in water_checks):
        raise ValueError('Pool coping overlaps an inner water cell center')

    output_dir.mkdir(parents=True, exist_ok=True)
    destination = output_dir / SPRITE
    if source_png.resolve() != destination.resolve():
        shutil.copyfile(source_png, destination)
    if _sha(destination) != SOURCE_SHA256:
        raise ValueError('Pool coping source copy is not byte-identical')
    ledger = dict(schemaVersion=1, assetId='furniture_pool_coping', file=file,
                  sourceFile=source_png.name, sourceSha256=SOURCE_SHA256,
                  nativeCanvas=list(SOURCE_SIZE),
                  measuredTopFaceOutline=[list(p) for p in SOURCE_OUTLINE],
                  sourceQuad=[list(p) for p in SOURCE_QUAD],
                  sourceMeasurement='Read-only original PNG inspection; shallow inset avoids dark alpha contour',
                  sourceCopiedByteIdentical=True, sourcePixelsEdited=False, mirrored=False,
                  projection='2:1 dimetric', tileLogical=[64, 32],
                  registrationMethod='Two source-pixel CSS affine triangles per exact canonical diamond',
                  sourcePropIds=[p['id'] for p in candidates], instances=instances,
                  ringCells=[list(cell) for cell in sorted(RING_CELLS)],
                  innerWaterCells=[list(cell) for cell in sorted(INNER_WATER_CELLS)],
                  swimSlotClearance=swim_checks, innerWaterCenterChecks=water_checks,
                  preservedSwimSlots=6, canonicalFloorPreserved=True, existingBasinPreserved=True,
                  logicalMapSha256=map_hash, logicalMapChanged=False, logicalLayoutChanged=False,
                  topFaceOnly=True, verticalSlabRendered=False, outerEdgeOverlap=0,
                  browserQA=False, repeatedSeamVisualQA=False, finalArt=False)
    return props, ledger
