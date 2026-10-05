"""Register functional room seating without changing canonical map or PNGs.

The four chair sources are independently generated physical orientations. Only
uniform CSS scale, alpha-envelope clipping and small presentation offsets are
used. This helper returns props and an audit ledger; the caller owns manifests.
"""
from collections import Counter
import copy
import hashlib
import json
import math
from pathlib import Path
import shutil

from PIL import Image


ART_KIND = 'registered-room-seating'
DIRECTIONS = ('NE', 'NW', 'SE', 'SW')
GRID_VECTORS = {'NE': (0, -1), 'NW': (-1, 0), 'SE': (1, 0), 'SW': (0, 1)}
CHAIR_SPRITES = frozenset(('furniture_chair.png', 'furniture_chair_cushion.png',
                           'furniture_chair_rounded.png'))
DESK_SPRITES = frozenset(('furniture_desk.png', 'furniture_desk_executive.png',
                         'furniture_stamp_desk.png', 'furniture_reception_desk.png'))
WIDTHS = {'meeting_seat': 30, 'cafe_seat': 30, 'class_seat': 28, 'desk': 34}
DESK_TUCK_TILES = 0.125


def _sha(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def _properties(obj):
    return {item['name']: item['value'] for item in obj.get('properties', [])}


def _objects(document, name):
    return next(layer for layer in document['layers'] if layer['name'] == name)['objects']


def _world(gx, gy):
    return [1088 + (gx-gy)*32, 64 + (gx+gy)*16]


def _polygon(x0, y0, x1, y1):
    return f'polygon({x0}px {y0}px,{x1}px {y0}px,{x1}px {y1}px,{x0}px {y1}px)'


def _inside(point, zone):
    return (zone['gx_min'] <= point[0] <= zone['gx_max'] and
            zone['gy_min'] <= point[1] <= zone['gy_max'])


def _furniture_cells(document):
    sprites = {tileset['firstgid'] + tile['id']: _properties(tile).get('sprite', tile.get('image'))
               for tileset in document['tilesets'] for tile in tileset.get('tiles', [])}
    cells = next(layer for layer in document['layers'] if layer['name'] == 'furniture')['data']
    return [dict(id=f'furniture-{index}', gx=index % document['width'],
                 gy=index // document['width'], sprite=sprites[gid])
            for index, gid in enumerate(cells) if gid]


def _target(slot, cells, zones):
    """Find the actual table/desk, then face its nearest sensible grid edge."""
    kind = slot['type']
    allowed = (DESK_SPRITES if kind.startswith('desk:') else
               {'furniture_boardroom_table.png'} if kind == 'meeting_seat' else
               {'furniture_table_round.png'} if kind == 'cafe_seat' else
               {'furniture_whiteboard.png'})
    candidates = [cell for cell in cells if cell['sprite'] in allowed and
                  _inside((cell['gx'], cell['gy']), zones[slot['zone']])]
    if not candidates:
        raise ValueError(f'No functional furniture target for {slot["name"]}')
    gx, gy = slot['gx'], slot['gy']
    nearest = min(candidates, key=lambda c: ((gx-c['gx'])**2 + (gy-c['gy'])**2, c['id']))
    if kind == 'meeting_seat':
        # End seats face the ends; long-edge seats face across the table. This
        # deliberately differs from legacy slot-facing metadata, never actors.
        if gy < min(c['gy'] for c in candidates):
            facing = 'SW'
        elif gy > max(c['gy'] for c in candidates):
            facing = 'NE'
        elif gx < min(c['gx'] for c in candidates):
            facing = 'SE'
        elif gx > max(c['gx'] for c in candidates):
            facing = 'NW'
        else:
            raise ValueError('Meeting seat must be outside the canonical table')
    else:
        dx, dy = nearest['gx']-gx, nearest['gy']-gy
        if dx == dy == 0:
            raise ValueError(f'Chair and functional target overlap: {slot["name"]}')
        facing = ('SW' if dy > 0 else 'NE') if abs(dy) >= abs(dx) else ('SE' if dx > 0 else 'NW')
    vector = GRID_VECTORS[facing]
    if vector[0]*(nearest['gx']-gx) + vector[1]*(nearest['gy']-gy) <= 0:
        raise ValueError(f'Chair faces away from its furniture target: {slot["name"]}')
    return nearest, facing


def _sources(source_dir, web_base):
    result = {}
    for facing in DIRECTIONS:
        source = source_dir / f'office-chair-{facing}.png'
        provenance_path = source.with_suffix('.provenance.json')
        provenance = json.loads(provenance_path.read_text(encoding='utf-8'))
        digest = _sha(source)
        if (provenance.get('orientation') != facing or provenance.get('sha256') != digest or
                provenance.get('source_sha256') != digest or
                provenance.get('selection') != 'accepted' or not provenance.get('inspected') or
                not provenance.get('original_bytes_preserved')):
            raise ValueError(f'Unverified original directional chair: {source.name}')
        with Image.open(source) as image:
            if image.mode != 'RGBA':
                raise ValueError(f'Chair must have genuine RGBA transparency: {source.name}')
            alpha = image.getchannel('A')
            box = alpha.point(lambda value: 255 if value >= 128 else 0).getbbox()
            if not box or alpha.getextrema() != (0, 255):
                raise ValueError(f'Chair needs a visible silhouette and transparent pixels: {source.name}')
            size = list(image.size)
        if provenance.get('canvas') != size or provenance.get('alpha_128_bbox') != list(box):
            raise ValueError(f'Chair read-only measurements differ from provenance: {source.name}')
        result[facing] = dict(id=f'office-chair-{facing}', facing=facing,
                              sourceFile=source.name, file=f'{web_base}/{source.name}',
                              provenanceFile=provenance_path.name, sha256=digest,
                              provenanceSha256=_sha(provenance_path), nativeSize=size,
                              alphaBox=list(box), alphaExtrema=[0, 255],
                              observedOrientation=provenance.get('observed_orientation'),
                              sourceBytesPreserved=True, sourcePixelsEdited=False,
                              mirrored=False, browserVisualQA=False, instanceIds=[])
    if len({source['sha256'] for source in result.values()}) != 4:
        raise ValueError('Directional chairs must be four distinct original PNGs')
    return result


def register_room_seating(manifest, map_doc, source_dir, output_dir, web_base):
    """Return (all props, ledger) and copy original assets, mutating no input.

    source_dir contains office-chair-{NE,NW,SE,SW}.png with matching verified
    .provenance.json files. output_dir/web_base are the destination seating
    directory and URL. No manifests, map files or actor state are written.
    """
    source_dir, output_dir = Path(source_dir), Path(output_dir)
    web_base = web_base.rstrip('/')
    zones = {_properties(zone)['zone_id']: _properties(zone) for zone in _objects(map_doc, 'zones')}
    slots = [dict(_properties(slot), name=slot['name'], objectId=slot['id'])
             for slot in _objects(map_doc, 'slots')]
    doors = {(door['gx'], door['gy']) for door in map(_properties, _objects(map_doc, 'doors'))}
    if (map_doc['width'], map_doc['height'], len(zones), len(slots), len(doors)) != (44, 32, 17, 133, 26):
        raise ValueError('Room seating requires the unchanged canonical 44x32 / 17-zone / 133-slot / 26-door map')
    if any(prop.get('artKind') == ART_KIND for prop in manifest['props']):
        raise ValueError('Room seating is already registered; begin from the unregistered manifest')
    sources = _sources(source_dir, web_base)
    cells = _furniture_cells(map_doc)
    selected = [slot for slot in slots if slot['zone'] != 'Z08' and
                (slot['type'].startswith('desk:') or slot['type'] in ('meeting_seat', 'cafe_seat', 'class_seat'))]
    counts = Counter('desk' if slot['type'].startswith('desk:') else slot['type'] for slot in selected)
    if counts != {'meeting_seat': 12, 'cafe_seat': 8, 'class_seat': 6, 'desk': 11}:
        raise ValueError(f'Unexpected canonical functional seating slots: {dict(counts)}')
    props = copy.deepcopy(manifest['props'])
    by_id = {prop['id']: prop for prop in props}
    if len(by_id) != len(props):
        raise ValueError('Duplicate source prop IDs')
    instances, preserved, replaced, added = [], [], [], []
    for slot in selected:
        gx, gy = slot['gx'], slot['gy']
        zone = zones[slot['zone']]
        if not _inside((gx, gy), zone) or (gx, gy) in doors:
            raise ValueError(f'Chair must be inside its room and away from doors: {slot["name"]}')
        matching = [prop for prop in props if prop.get('zone') != 'Z08' and
                    (prop.get('slotId') == slot['name'] or
                     (prop['sprite'] in CHAIR_SPRITES and (prop['gx'], prop['gy']) == (gx, gy)))]
        if len(matching) > 1:
            raise ValueError(f'Duplicate existing chairs at {slot["name"]}')
        if matching and (slot['type'].startswith('desk:') or slot['type'] == 'cafe_seat'):
            preserved.append(dict(slotId=slot['name'], propId=matching[0]['id'], reason='Existing matching chair retained'))
            continue
        if slot['type'] in ('meeting_seat', 'class_seat') and not matching:
            raise ValueError(f'Missing canonical chair to replace: {slot["name"]}')
        target, facing = _target(slot, cells, zones)
        kind = 'desk' if slot['type'].startswith('desk:') else slot['type']
        old = copy.deepcopy(matching[0]) if matching else None
        x, y = _world(gx, gy)
        prop = matching[0] if matching else dict(id=f'room-seat-{slot["name"]}',
                  sprite='furniture_chair.png', gx=gx, gy=gy, x=x, y=y, z=(gx+gy)*1000+10)
        if (prop['gx'], prop['gy'], prop['x'], prop['y']) != (gx, gy, x, y):
            raise ValueError(f'Existing chair anchor differs from its canonical slot: {slot["name"]}')
        if not matching:
            if prop['id'] in by_id:
                raise ValueError(f'New chair ID already exists: {prop["id"]}')
            props.append(prop)
            by_id[prop['id']] = prop
            added.append(prop['id'])
        else:
            replaced.append(prop['id'])
        # Tuck staffed chairs 1/8 tile toward the desk. The logical slot and
        # actor pose remain untouched; café/table/classroom anchors do not move.
        vx, vy = GRID_VECTORS[facing]
        tuck = DESK_TUCK_TILES if kind == 'desk' else 0
        visual_grid = [gx+vx*tuck, gy+vy*tuck]
        if not _inside(visual_grid, zone) or any(math.dist(visual_grid, door) < 0.75 for door in doors):
            raise ValueError(f'Chair presentation offset approaches a doorway: {slot["name"]}')
        offset = [(vx-vy)*32*tuck, (vx+vy)*16*tuck]
        original_ground = [x, old['bounds']['y']+old['bounds']['height'] if old else y+9]
        ground = [original_ground[0]+offset[0], original_ground[1]+offset[1]]
        source = sources[facing]
        x0, y0, x1, y1 = source['alphaBox']
        width = WIDTHS[kind]
        scale = width/(x1-x0)
        height = (y1-y0)*scale
        bounds = dict(x=ground[0]-width/2, y=ground[1]-height, width=width, height=height)
        prop.update(file=source['file'], artKind=ART_KIND, componentId=source['id'],
                    zone=slot['zone'], slotId=slot['name'], sourceSlotId=slot['objectId'],
                    logicalFacing=slot['facing'], presentationFacing=facing, facing=facing,
                    visualOffset=offset, visualGridAnchor=dict(gx=visual_grid[0], gy=visual_grid[1]),
                    bounds=bounds, artClipPath=_polygon(0, 0, width, height),
                    artLayers=[dict(id='whole-chair', width=source['nativeSize'][0], height=source['nativeSize'][1],
                                    clipPath=_polygon(x0, y0, x1, y1),
                                    matrix=[scale, 0, 0, scale, -x0*scale, -y0*scale])])
        source['instanceIds'].append(prop['id'])
        instances.append(dict(id=prop['id'], slotId=slot['name'], sourceSlotId=slot['objectId'],
                              slotType=slot['type'], zone=slot['zone'], sourcePropIds=[old['id']] if old else [],
                              action='replace' if old else 'add', logicalAnchor=[gx, gy],
                              worldAnchor=[x, y], logicalFacing=slot['facing'], presentationFacing=facing,
                              furnitureTarget=copy.deepcopy(target), groundAnchor=ground,
                              originalGroundAnchor=original_ground, presentationOffset=offset,
                              visualGridAnchor=visual_grid, width=width, bounds=copy.deepcopy(bounds),
                              scale=scale, depth=prop['z'], actorDepth=(gx+gy)*1000+20,
                              offsetReason=('Tuck 1/8 tile toward paired desk while retaining slot/actor coordinates'
                                            if tuck else 'Retain canonical chair ground anchor; no positional offset'),
                              depthReason='Canonical footpoint furniture depth, behind the seated actor; no actor changes',
                              sourcePixelsEdited=False, mirrored=False))
    props.sort(key=lambda prop: (prop['z'], prop['id']))
    if len({prop['id'] for prop in props}) != len(props):
        raise ValueError('Registration introduced duplicate prop IDs')
    output_dir.mkdir(parents=True, exist_ok=True)
    for source in sources.values():
        for name in (source['sourceFile'], source['provenanceFile']):
            origin, destination = source_dir/name, output_dir/name
            if origin.resolve() != destination.resolve():
                shutil.copyfile(origin, destination)
            if _sha(origin) != _sha(destination):
                raise ValueError(f'Asset bytes changed in copy: {name}')
    ledger = dict(schemaVersion=1, sources=list(sources.values()), instances=instances,
                  replacedPropIds=replaced, addedPropIds=added, preservedMatchingChairs=preserved,
                  summary=dict(registered=len(instances), replaced=len(replaced), added=len(added),
                               meetingSeats=12, cafeSeats=8, classroomSeats=6, staffedDesks=11,
                               preservedExistingMatches=len(preserved)),
                  canonicalMap=dict(width=44, height=32, zones=17, slots=133, doors=26),
                  logicalMapSha256=manifest.get('logicalMapSha256'), logicalMapChanged=False,
                  logicalLayoutChanged=False, slotFacingsChanged=False, characterAnimationsChanged=False,
                  z08Changed=False, sourceBytesPreserved=True, sourcePixelsEdited=False, mirrored=False,
                  scaleReference='Approved Z08 chair width 40; meeting/cafe 30, staffed desk 34, classroom 28',
                  browserVisualQA=False, actorInterleavingVisualQA=False, finalArt=False)
    return props, ledger
