"""Describe runtime ground registration and copy generated PNGs unchanged.

This is not a bitmap-processing/export pipeline. Pillow only reads the native
canvas and a few source colour samples. Source quads come from read-only QA;
the application renders the original PNG through two affine triangles.
"""
from pathlib import Path
import hashlib
import json
import shutil

from PIL import Image


SURFACES = {
    'F01': 'F01-floor-oak-a-v2.png',
    'F03': 'F03-floor-corridor-gray.png',
    'F04': 'F04-floor-outdoor-stone.png',
    'O01': 'O01-pool-water.png',
    'F16': 'F16-prayer-rug.png',
}
PROTECTED_FLOOR = 'tile_floor_z08_dev_pods.png'
CORRIDOR_FLOOR = 'tile_floor_corridor.png'
OUTDOOR_FLOOR = 'tile_floor_z17_pool_deck.png'
POOL_FLOOR = 'tile_floor_pool_water.png'
PRAYER_RUG = 'furniture_prayer_rug_shaf.png'


def _intersection(first, second):
    m1, b1 = first['slope'], first['intercept']
    m2, b2 = second['slope'], second['intercept']
    x = (b2-b1)/(m1-m2)
    return [x, m1*x+b1]


def _source_quad(qa):
    if 'fitted_vertices_xy' in qa:
        return [qa['fitted_vertices_xy'][side] for side in ['top', 'right', 'bottom', 'left']]
    if 'fitted_edges' in qa:
        e = qa['fitted_edges']
        return [_intersection(e['NW'], e['NE']), _intersection(e['NE'], e['SE']),
                _intersection(e['SW'], e['SE']), _intersection(e['NW'], e['SW'])]
    raise ValueError('Ground source requires measured native source corners')


def _colour(image, qa, quad):
    if 'interior_mean_rgb' in qa:
        rgb = qa['interior_mean_rgb']
    else:
        # Read-only samples near the material centre. Matching fill is a canvas
        # primitive beneath the original alpha, never a saved raster edit.
        cx = sum(p[0] for p in quad)/4
        cy = sum(p[1] for p in quad)/4
        samples = [image.getpixel((round(cx+dx), round(cy+dy)))
                   for dx in [-60, -30, 0, 30, 60] for dy in [-30, -15, 0, 15, 30]]
        rgb = [sum(pixel[channel] for pixel in samples)/len(samples) for channel in range(3)]
    return '#' + ''.join(f'{round(value):02x}' for value in rgb)


def build_ground_surfaces(map_doc, source_dir, output_dir, web_base):
    """Return (groundSurfaces, ledger); only copy immutable source PNG files.

    The caller owns its new assets.json. Historical manifests, map, props and
    approved Z08 floor are never changed by this function.
    """
    source_dir, output_dir = Path(source_dir), Path(output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)
    names = {tileset['firstgid']+tile['id']: tile['image']
             for tileset in map_doc['tilesets'] for tile in tileset.get('tiles', []) if 'image' in tile}
    floor = next(layer['data'] for layer in map_doc['layers'] if layer['name'] == 'floor')
    furniture = next(layer['data'] for layer in map_doc['layers'] if layer['name'] == 'furniture')
    floor_names = sorted({names[gid] for gid in floor if gid})
    special = {PROTECTED_FLOOR, CORRIDOR_FLOOR, OUTDOOR_FLOOR, POOL_FLOOR}
    selectors = {'F01': [name for name in floor_names if name not in special],
                 'F03': [CORRIDOR_FLOOR], 'F04': [OUTDOOR_FLOOR], 'O01': [POOL_FLOOR], 'F16': []}
    definitions, sources = [], []
    for code, filename in SURFACES.items():
        source = source_dir/filename
        # Older source packs remain usable and restore baked rugs as before.
        if code == 'F16' and not source.exists():
            continue
        qa = json.loads(source.with_suffix('.qa.json').read_text())
        quad = _source_quad(qa)
        with Image.open(source) as image:
            if image.mode != 'RGBA':
                raise ValueError(f'Ground source must retain its generated alpha: {source}')
            size = {'width': image.width, 'height': image.height}
            colour = _colour(image, qa, quad)
        sha = hashlib.sha256(source.read_bytes()).hexdigest()
        expected_sha = qa.get('sha256')
        if expected_sha and expected_sha != sha:
            raise ValueError(f'Ground source changed after measurement: {source}')
        destination = output_dir/filename
        if source.resolve() != destination.resolve():
            shutil.copyfile(source, destination)
        if hashlib.sha256(destination.read_bytes()).hexdigest() != sha:
            raise ValueError(f'Ground source copy differs: {destination}')
        count = sum(names.get(gid) in selectors[code] for gid in floor)
        overlay_cells = [dict(gx=index % map_doc['width'], gy=index // map_doc['width'])
                         for index, gid in enumerate(furniture)
                         if code == 'F16' and names.get(gid) == PRAYER_RUG]
        if code == 'F16' and {(cell['gx'], cell['gy']) for cell in overlay_cells} != {
                (gx, gy) for gx in range(30, 37) for gy in (27, 29)}:
            raise ValueError('Prayer overlay must preserve the exact 14 canonical Z16 rug cells')
        repeat = 1 if code == 'F16' else 4
        definition = dict(id=code, file=f'{web_base.rstrip("/")}/{filename}', sourceSize=size,
                          sourceQuad=quad, floorSprites=selectors[code], repeatTiles=repeat,
                          underlayColor=colour)
        if code == 'F16':
            definition['overlaySprites'] = [PRAYER_RUG]
        definitions.append(definition)
        sources.append(dict(assetId=code, file=definition['file'], sourceFile=filename,
                            sourceSha256=sha, sourceSize=size, sourceQuad=quad,
                            sourceCopiedByteIdentical=True, sourcePixelsEdited=False,
                            mirrored=False, floorCells=count, repeatTiles=repeat,
                            underlayColor=colour, sourceMeasurementFile=source.with_suffix('.qa.json').name))
        if code == 'F16':
            sources[-1].update(overlayCells=len(overlay_cells), canonicalOverlayCells=overlay_cells,
                               overlaySprites=[PRAYER_RUG], underlyingBaseFloorPreserved=True,
                               legacyOverlayRepainted=False)
    covered = sum(source['floorCells'] for source in sources)
    preserved = sum(names.get(gid) == PROTECTED_FLOOR for gid in floor)
    if covered+preserved != sum(bool(gid) for gid in floor):
        raise ValueError('Ground registration does not account for every canonical floor cell')
    ledger = dict(sources=sources, projection='2:1 dimetric', tileLogical=[64, 32],
                  worldOrigin=[1088, 64], registrationMethod='runtime canvas affine triangles with exact outer clip',
                  sourcePixelsEdited=False, logicalLayoutChanged=False, renderedGroundCells=covered,
                  preservedZ08FloorCells=preserved, lowFurnitureRestoredFromAtlas=True,
                  renderedOverlayCells=sum(source.get('overlayCells', 0) for source in sources),
                  legacyPrayerRugsRestoredFromAtlas=not any(source['assetId'] == 'F16' for source in sources),
                  redundantBakedWaterReplacedBy='O01', browserQA=False,
                  repeatedSeamVisualQA=False)
    return definitions, ledger
