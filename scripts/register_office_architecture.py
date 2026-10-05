"""Register shared office architecture without changing source PNGs or the map.

The public entry point returns ``(props, ledger)`` for the caller to merge into a
new manifest. It never writes a manifest, edits pixels, renders Blender, or claims
browser QA. Existing 80px foundation modules remain unchanged: WallPresentation
already lowers them at runtime. New internal segments are registered at their
fixed 12/16px cutaway height, including door jambs with real open centers.
"""
from __future__ import annotations

import copy
import hashlib
import json
import math
from pathlib import Path

from register_office_foundation_walls import (
    PUBLIC, ROOT, SOURCES, WEB, affine, project, registration, world,
)

MAP = PUBLIC / 'maps/floor1.tmj'
STRAIGHT = {
    'wall_front_cutaway_sw.png': 'W01',
    'wall_front_cutaway_se.png': 'W02',
}
LOW_COMPONENTS = {'wall-low-fall-right': 'W01', 'wall-low-rise-right': 'W02'}
DOOR_SPRITES = {'wall_back_doorway.png', 'wall_front_cutaway_doorway.png'}
CORNER_SPRITES = {'wall_back_corner_n.png', 'wall_front_cutaway_corner_s.png'}
WINDOW_SPRITE = 'wall_back_window_day.png'
JAMB_LENGTH = 0.125
OPENING_LENGTH = 1 - 2 * JAMB_LENGTH
WINDOW_SOURCE = dict(
    file='/visual-migration/environment-architecture-v1/G01-window-glass.png',
    source='art/environment-foundation-2026-10-05/intake/G01-r01/G01-window-glass.png',
    nativeCanvas=[1774,887],
    sourceQuad=[[72,188],[1702,188],[1702,699],[72,699]],
)


def _polygon(points):
    return 'polygon(' + ','.join(f'{x}px {y}px' for x, y in points) + ')'


def polygon(prop, presented=True):
    """World-space solid silhouette, including the runtime foundation cutaway."""
    points = [[float(v.removesuffix('px')) for v in point.split()]
              for point in prop['artClipPath'][8:-1].split(',')]
    b = prop['bounds']
    result = [[x+b['x'], y+b['y']] for x, y in points]
    if presented and prop.get('artKind') == 'registered-foundation-wall' and not prop.get('wallPresentation'):
        normal = prop['gy'] if prop['componentId'] == 'W01' else prop['gx']
        limit = 48 if normal == 0 else (16 if float(normal).is_integer() else 12)
        height = points[0][1] - points[5][1]
        delta = height-min(height, limit)
        result = [[x, y+(delta if i >= 3 else 0)] for i, (x, y) in enumerate(result)]
    return result


def contains(points, point):
    """Even-odd containment matching the front-end architectural QA."""
    x, y = point
    hit = False
    for (ax, ay), (bx, by) in zip(points, points[1:]+points[:1]):
        if (ay > y) != (by > y) and x < (bx-ax)*(y-ay)/(by-ay)+ax:
            hit = not hit
    return hit


def segment_registration(code, length=1, height=12, end=True):
    """Lower native front/end planes while retaining the exact 2:1 footprint."""
    reg = copy.deepcopy(registration(code, length, end))
    delta = reg['wallHeight']-height
    ratio = height/reg['wallHeight']
    shape = [[float(v.removesuffix('px')) for v in point.split()]
             for point in reg['clipPath'][8:-1].split(',')]
    for layer in reg['layers']:
        start, finish = (shape[1], shape[2]) if layer['id'].startswith('end-') else (shape[0], shape[1])
        slope = (finish[1]-start[1])/(finish[0]-start[0])
        shear = (1-ratio)*slope
        translate = (1-ratio)*(start[1]-slope*start[0])-delta
        if not layer['id'].startswith('cap-'):
            a, b, c, d, tx, ty = layer['matrix']
            layer['matrix'] = [a, shear*a+ratio*b, c, shear*c+ratio*d, tx, shear*tx+ratio*ty+translate]
        check = next(c for c in reg['checks'] if c['plane'] == layer['id'])
        # Recompute independently from expected source elevation, not the matrix.
        expected = []
        for old_x, old_y in check['targetTriangle']:
            ground_y = start[1]+(old_x-start[0])*slope
            y = old_y if layer['id'].startswith('cap-') else ground_y-(ground_y-old_y)*ratio-delta
            expected.append([old_x, y])
        check['targetTriangle'] = expected
        check['maxCornerError'] = max(math.dist(project(layer['matrix'], p), q)
                                      for p, q in zip(check['sourceTriangle'], expected))
        assert check['maxCornerError'] < 1e-6
        a, b, c, d, _, _ = layer['matrix']
        assert a*d-b*c > 0, 'Source reflection is prohibited'
    shape = [[x, y-delta if i < 3 else y] for i, (x, y) in enumerate(shape)]
    reg['clipPath'] = _polygon(shape)
    reg['offset'][1] += delta
    reg['height'] -= delta
    reg['sourceHeight'] = reg['wallHeight']
    reg['wallHeight'] = height
    return reg


def _objects(document, name):
    layer = next(layer for layer in document['layers'] if layer['name'] == name)
    return [dict({'name': obj['name']}, **{p['name']: p['value'] for p in obj['properties']})
            for obj in layer['objects']]


def _source_index():
    index = []
    for code, source in SOURCES.items():
        web = WEB+'/'+source['name']
        published = PUBLIC/web.lstrip('/')
        original = ROOT/'art/environment-foundation-2026-10-05/intake/W01-W02-r01'/source['name']
        sha = hashlib.sha256(original.read_bytes()).hexdigest()
        if hashlib.sha256(published.read_bytes()).hexdigest() != sha:
            raise ValueError(f'Published source differs from original: {code}')
        index.append(dict(assetId=code, file=web, source=original.relative_to(ROOT).as_posix(),
                          sourceSha256=sha, sourceCopiedByteIdentical=True, mirrored=False,
                          nativeCanvas=[1254,1254]))
    return index


def register_architecture(manifest, window_source=WINDOW_SOURCE):
    """Return all replacement props and a complete, auditable migration ledger.

    ``window_source`` supplies a reviewed planar glass source: file, source,
    nativeCanvas, and sourceQuad (clockwise top-left first). Missing glass art
    stays explicitly pending instead of being silently replaced by a solid wall.
    """
    if any(p.get('architectureRegistrationVersion') == 'shared-v1' for p in manifest['props']):
        raise ValueError('Architecture is already registered; start from the immutable foundation manifest')
    document = json.loads(MAP.read_text())
    map_sha = hashlib.sha256(MAP.read_bytes()).hexdigest()
    if manifest['logicalMapSha256'] != map_sha:
        raise ValueError('Manifest does not match the current logical map')
    doors = _objects(document, 'doors')
    slots = _objects(document, 'slots')
    zones = _objects(document, 'zones')
    output, modules, replacements, preserved, pending = [], [], [], [], []
    entrance_leaves = []
    sources = _source_index()
    if window_source is not None:
        glass = copy.deepcopy(window_source)
        original = ROOT/glass['source']
        published = PUBLIC/glass['file'].lstrip('/')
        sha = hashlib.sha256(original.read_bytes()).hexdigest()
        if hashlib.sha256(published.read_bytes()).hexdigest() != sha:
            raise ValueError('Window source is not byte-identical')
        if len(glass['sourceQuad']) != 4 or len(glass['nativeCanvas']) != 2:
            raise ValueError('Invalid glass source registration')
        glass.update(assetId='G01', sourceSha256=sha, sourceCopiedByteIdentical=True, mirrored=False)
        sources.append(glass)
    portal_cells = {(d['gx'], d['gy']): d for d in doors}
    portal_records = {}
    input_props = manifest['props']
    candidates = {p['id'] for p in input_props if p['sprite'].startswith('wall_') and not p.get('file')}

    def segment(prop, code, start, length=1, height=12, end=True, suffix='', purpose='low-wall'):
        reg = segment_registration(code, length, height, end)
        origin = world(*start)
        q = copy.deepcopy(prop)
        q.update(id=prop['id']+suffix, sourcePropId=prop.get('sourcePropId', prop['id']),
                 file=WEB+'/'+SOURCES[code]['name'], componentId=code,
                 artKind='registered-foundation-wall', artLayers=reg['layers'], artClipPath=reg['clipPath'],
                 bounds=dict(x=origin[0]+reg['offset'][0], y=origin[1]+reg['offset'][1],
                             width=reg['width'], height=reg['height']),
                 architectureRegistrationVersion='shared-v1',
                 wallPresentation=dict(role='exterior-backdrop' if height>16 else 'interior-cutaway',
                                       sourceHeight=80, height=height))
        q.pop('nightFile', None)
        output.append(q)
        modules.append(dict(id=q['id'], replacedPropId=prop['id'], sourcePropId=q['sourcePropId'],
                            assetId=code, purpose=purpose, axis=SOURCES[code]['axis'],
                            worldStart=origin, gridStart=list(start), bounds=q['bounds'], registration=reg))
        return q

    def replace_record(prop, before, purpose):
        replacements.append(dict(sourcePropId=prop['id'], sprite=prop['sprite'], purpose=purpose,
                                 replacementPropIds=[m['id'] for m in modules[before:]]))

    def portal(prop, code):
        cell = (prop['gx'], prop['gy'])
        if cell not in portal_cells:
            raise ValueError(f'Portal prop is not at a logical door: {prop["id"]}')
        before = len(modules)
        height = (8 if prop['gy'] == document['height']-1 else
                  12 if 'front_cutaway' in prop['sprite'] or prop.get('zone') == 'Z08' else 16)
        normal_gx = prop['gx']+.5 if prop['gx'] == document['width']-1 else prop['gx']
        normal_gy = prop['gy']+.5 if prop['gy'] == document['height']-1 else prop['gy']
        for name, along in [('near', -0.5), ('far', 0.5-JAMB_LENGTH)]:
            start = (prop['gx']+along, normal_gy) if code == 'W01' else (normal_gx, prop['gy']+along)
            segment(prop, code, start, JAMB_LENGTH, height, suffix='-jamb-'+name, purpose='open-door-jamb')
        ids = [m['id'] for m in modules[before:]]
        portal_records[cell] = dict(name=portal_cells[cell]['name'], center=list(cell), axis=SOURCES[code]['axis'],
                                   openingLengthTiles=OPENING_LENGTH, jambLengthTiles=JAMB_LENGTH,
                                   height=height, propIds=ids, headerOmittedForCutaway=True)
        replace_record(prop, before, 'open-door-cutaway')

    def window(prop):
        before = len(modules)
        start = (prop['gx']-.5, prop['gy'])
        segment(prop, 'W01', start, height=48, suffix='-wall', purpose='window-wall-surround')
        origin = world(*start)
        # A slim clerestory window is an inset on the outside-facing backdrop.
        # 10% side margins and 14px vertical glass retain the one-tile rhythm.
        target_world = [[origin[0]+x, origin[1]+y] for x, y in
                        [[3.2,-36.4],[28.8,-23.6],[28.8,-9.6],[3.2,-22.4]]]
        x0 = min(x for x,y in target_world); y0 = min(y for x,y in target_world)
        target = [[x-x0,y-y0] for x,y in target_world]
        matrix = affine(glass['sourceQuad'][:3], target[:3])
        error = max(math.dist(project(matrix,p),q) for p,q in zip(glass['sourceQuad'],target))
        assert error < 1e-6 and matrix[0]*matrix[3]-matrix[1]*matrix[2] > 0
        q = copy.deepcopy(prop)
        q.update(file=glass['file'], componentId='G01', artKind='registered-window-inset',
                 architectureRegistrationVersion='shared-v1',
                 bounds=dict(x=x0,y=y0,width=25.6,height=26.8), z=prop['z']+1,
                 artClipPath=_polygon(target),
                 artLayers=[dict(id='glass-front',width=glass['nativeCanvas'][0],height=glass['nativeCanvas'][1],
                                 clipPath=_polygon(glass['sourceQuad']),matrix=matrix)])
        q.pop('nightFile',None)
        output.append(q)
        modules.append(dict(id=q['id'],replacedPropId=prop['id'],sourcePropId=prop['id'],
                            assetId='G01',purpose='window-glass',axis='R',worldStart=origin,
                            gridStart=list(start),bounds=q['bounds'],registration=dict(
                                lengthTiles=.8,wallHeight=14,sourceHeight=14,layers=q['artLayers'],
                                checks=[dict(plane='glass-front',sourceTriangle=glass['sourceQuad'],
                                             targetTriangle=target,maxCornerError=error)],
                                clipPath=q['artClipPath'])))
        replace_record(prop,before,'shared-material-window')

    for prop in input_props:
        sprite, component = prop['sprite'], prop.get('componentId')
        if prop.get('artKind') == 'registered-foundation-wall':
            output.append(copy.deepcopy(prop)); preserved.append(prop['id']); continue
        if sprite in STRAIGHT or component in LOW_COMPONENTS:
            code = LOW_COMPONENTS.get(component, STRAIGHT.get(sprite))
            gx, gy = prop['gx'], prop['gy']
            # Perimeter modules sit on the outer floor edge. Logical anchors
            # stay at their original cell centers, including the occupied Z17
            # assembly slot at (37,31); no arbitrary gap is cut in the wall.
            normal_gx = gx+.5 if gx == document['width']-1 else gx
            normal_gy = gy+.5 if gy == document['height']-1 else gy
            start = (gx-.5, normal_gy) if code == 'W01' else (normal_gx, gy-.5)
            before = len(modules)
            height = 8 if normal_gx != gx or normal_gy != gy else 12
            segment(prop, code, start, height=height)
            replace_record(prop, before, 'shared-material-cutaway')
        elif sprite in CORNER_SPRITES:
            gx, gy = prop['gx'], prop['gy']
            before = len(modules)
            height = 48 if sprite == 'wall_back_corner_n.png' else 8
            # Two half modules terminate the adjacent axes at the exact grid
            # corner. Separate silhouettes do not fill the V-shaped open area.
            east = gx == document['width']-1
            south = gy == document['height']-1
            starts = [(gx-.5 if east else gx, gy+.5 if south else gy),
                      (gx+.5 if east else gx, gy-.5 if south else gy)]
            lengths = [1 if east else .5, 1 if south else .5]
            for code, start, length in zip(('W01', 'W02'), starts, lengths):
                segment(prop, code, start, length, height, suffix='-corner-'+code, purpose='joined-corner')
            replace_record(prop, before, 'shared-material-corner')
        elif sprite in DOOR_SPRITES:
            portal(prop, 'W02' if prop['gy'] == 14 else 'W01')
        elif prop['id'] in ('dot-z08-door-north', 'dot-z08-door-south'):
            portal(prop, 'W01')
        elif prop['id'] == 'dot-z08-door-east-back':
            # Replace this two-post assembly once, retaining both source IDs in
            # the audit record. The existing source geometry is above cutaway.
            portal(prop, 'W02')
        elif prop['id'] == 'dot-z08-door-east-front':
            replacements.append(dict(sourcePropId=prop['id'], sprite=sprite, purpose='paired-open-door-cutaway',
                                     replacementPropIds=['dot-z08-door-east-back-jamb-near', 'dot-z08-door-east-back-jamb-far']))
        elif sprite == 'furniture_entrance_door.png' and prop['id'] in ('furniture-1368','furniture-1369'):
            expected = (4,31) if prop['id'] == 'furniture-1368' else (5,31)
            if (prop['gx'],prop['gy']) != expected:
                raise ValueError('Lobby entrance prop moved; review its architectural ownership')
            entrance_leaves.append(prop)
        elif sprite == WINDOW_SPRITE:
            if window_source is not None:
                window(prop)
            else:
                output.append(copy.deepcopy(prop))
                pending.append(dict(id=prop['id'], sprite=sprite, reason='No reviewed illustrated window/glass PNG registration yet'))
        else:
            output.append(copy.deepcopy(prop))

    # Z17's north entrance is a logical opening with no original wall sprite.
    # Its two short jambs make the same language visible without a new wall run.
    for cell, door in portal_cells.items():
        if cell in portal_records:
            continue
        gx, gy = cell
        x, y = world(gx, gy)
        synthetic = dict(id='architecture-'+door['name'], sprite='wall_back_doorway.png',
                         gx=gx, gy=gy, x=x, y=y, z=(gx+gy)*1000+5)
        portal(synthetic, 'W02' if gy == 14 else 'W01')

    # The old two-leaf furniture artwork duplicated the one logical lobby door
    # and painted a second leaf over its adjacent closed cell. Share the genuine
    # open jamb assembly and retain that adjacent wall, without a new map hole.
    for prop in entrance_leaves:
        portal_ids = portal_records[(4,31)]['propIds']
        replacement_ids = list(portal_ids)
        if prop['id'] == 'furniture-1369':
            replacement_ids.append('walls_front-1369')
        replacements.append(dict(sourcePropId=prop['id'],sprite=prop['sprite'],
                                 purpose='deduplicated-lobby-entrance-art',
                                 replacementPropIds=replacement_ids,
                                 reason='One logical door at (4,31); adjacent (5,31) remains a solid wall'))

    output.sort(key=lambda p: (p['z'], p['id']))
    if len({p['id'] for p in output}) != len(output):
        raise ValueError('Duplicate architecture prop IDs')
    replaced_ids = {r['sourcePropId'] for r in replacements}
    unaccounted = candidates-replaced_ids-{p['id'] for p in pending}
    if unaccounted:
        raise ValueError(f'Unaccounted legacy architecture: {sorted(unaccounted)}')
    shapes = [(p['id'], polygon(p)) for p in output if p.get('artKind') == 'registered-foundation-wall']
    checks = []
    for obj in [*doors, *slots]:
        covered = [id for id, shape in shapes if contains(shape, world(obj['gx'], obj['gy']))]
        checks.append(dict(name=obj['name'], center=[obj['gx'], obj['gy']], coveredBy=covered))
    if any(check['coveredBy'] for check in checks):
        raise ValueError(f'Architecture occludes logical target: {[c for c in checks if c["coveredBy"]]}')
    ledger = dict(schemaVersion=1, sources=sources, modules=modules, replacements=replacements,
                  preservedFoundationPropIds=preserved, pendingLegacyProps=pending,
                  originalLegacyCount=len(candidates), unaccountedLegacyProps=sorted(unaccounted),
                  portals=list(portal_records.values()), visibilityChecks=checks,
                  logicalMapSha256=map_sha, logicalLayoutChanged=False, sourcePixelsEdited=False,
                  sourcePNGsByteIdentical=True, browserQA=False,
                  architectureSourceCoverageComplete=not pending, finalArt=False,
                  zones=len(zones), slots=len(slots), doors=len(doors),
                  registrationMethod='Source front/cap/end CSS affine triangles; separate open-jamb silhouettes')
    return output, ledger


if __name__ == '__main__':
    # Read-only summary makes ad-hoc validation safe; the parent owns output paths.
    source = json.loads((PUBLIC/'visual-migration/environment-foundation-v1/assets.json').read_text())
    props, ledger = register_architecture(source)
    print(json.dumps(dict(props=len(props), modules=len(ledger['modules']),
                          replaced=len(ledger['replacements']), portals=len(ledger['portals']),
                          pending=ledger['pendingLegacyProps'], browserQA=False), indent=2))
