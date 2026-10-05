"""Register generated, unedited furniture PNGs in the canonical Office scene.

This is presentation-only registration. It copies original image bytes, measures
alpha for a CSS crop/scale, and never redraws or resamples an image. The logical
map, collision, slots, characters, and approved Z08 components are untouched.
"""
from pathlib import Path
import argparse
import copy
import hashlib
import json
import shutil
from PIL import Image
from register_office_surfaces import build_ground_surfaces
from register_office_architecture import register_architecture
from register_pool_coping import register_pool_coping
from register_room_seating import register_room_seating
from register_room_presentation import apply_room_presentation
from pack_office_runtime import pack_runtime_art

ROOT = Path(__file__).resolve().parents[1]
PUBLIC = ROOT / 'frontend/public'
WEB = '/visual-migration/illustrated-office-v1'
OUT = PUBLIC / WEB.lstrip('/')
BASE = PUBLIC / 'visual-migration/environment-foundation-v1/assets.json'
INPUTS = ROOT / 'art/generated-office-2026-10-05'
# These canonical adjacent cells comprise one piece of furniture, not four desks.
JOINED = {'furniture_boardroom_table.png', 'furniture_blueprint_table.png',
          'furniture_lab_bench.png', 'furniture_reception_desk.png',
          'furniture_billiard_table.png', 'furniture_marble_counter.png',
          'furniture_conveyor.png', 'furniture_lounge_sofa.png'}
# World-pixel art sizes calibrated against the approved Z08 desk (80px),
# chair (40px), and sofa (100px). Legacy atlas alpha envelopes were often only
# 10–25px and are not a useful scale reference for the new illustrated office.
WIDTHS = dict(zip('''achievement_board alert_console attendance_board beanbag billiard_table
blueprint_rack blueprint_table boardroom_table bookcase_tall cardboard_box chair_cushion
chair_rounded changelog_board conveyor desk desk_executive drawing_desk_tablet espresso_machine
glass_partition green_reading_lamp journal_shelf kitchen_fridge lab_bench lamp_pass_fail
large_monitor_preview lounge_chair lounge_sofa lounge_sofa_corner marble_counter microscope
mihrab moodboard neon_sign parcel_rack pool_coping pool_lounger pool_umbrella potted_plant
presentation_screen printing_press qa_screens quran_shelf reception_desk screen server_rack
shaf_partition soc_map_wall sofa_leather spare_tiles_pile stamp_desk swatch_wall system_model_mini
table_round test_tube_rack trashcan tropical_plant trophy_shelf wall_monitors_ceo whiteboard
whiteboard_formula wudhu_station'''.split(), [
58,62,52,34,140,48,76,152,44,24,32,28,52,104,72,100,80,30,52,18,48,36,86,14,
70,42,110,64,112,24,54,54,46,48,38,60,76,30,92,34,66,52,112,34,34,60,78,102,
26,72,54,42,52,20,20,44,54,90,82,70,44]))
WIDTHS['arcade_cabinet'] = 42
# The alert console must remain a compact standing terminal, clear of its
# separately registered SOC display and the adjacent staffed workstations.
WIDTHS['alert_console'] = 48
DEPTH_SLICED = {'furniture_marble_counter.png', 'furniture_conveyor.png'}
REAR_OPERATOR_DESK = 'furniture_desk_operator_sw.png'
REAR_OPERATOR_ZONES = frozenset(('Z09', 'Z11'))

def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()

def dump(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, indent=2) + '\n', encoding='utf-8')

def properties(obj):
    return {p['name']: p['value'] for p in obj.get('properties', [])}

def room_for(prop, zones):
    return next((z['zone_id'] for z in zones if z['gx_min'] <= prop['gx'] <= z['gx_max']
                 and z['gy_min'] <= prop['gy'] <= z['gy_max']), None)

def visible_box(image):
    # Read-only alpha analysis: tiny generative alpha haze is excluded from the
    # CSS silhouette box; the delivered PNG remains byte-identical.
    return image.getchannel('A').point(lambda alpha: 255 if alpha >= 128 else 0).getbbox()

def clusters(props, joined):
    if not joined:
        return [[p] for p in props]
    todo = list(props)
    groups = []
    while todo:
        group = [todo.pop(0)]
        changed = True
        while changed:
            changed = False
            for p in list(todo):
                if any(abs(p['gx']-q['gx']) + abs(p['gy']-q['gy']) <= 1 for q in group):
                    group.append(p)
                    todo.remove(p)
                    changed = True
        groups.append(group)
    return groups

def register(generated):
    generated = Path(generated)
    # Keep future clones self-contained. Runtime and source copies share Git
    # blob identity because no generated PNG bytes are modified.
    if generated.resolve() != INPUTS.resolve():
        for group in ('rooms', 'foundation', 'seating'):
            if not (generated/group).exists():
                continue
            target = INPUTS/group
            target.mkdir(parents=True, exist_ok=True)
            for item in (generated/group).iterdir():
                if item.is_file() and item.suffix in {'.png','.json','.txt','.md'}:
                    shutil.copyfile(item, target/item.name)
        generated = INPUTS
    assets = json.loads(BASE.read_text())
    original = copy.deepcopy(assets)
    document = json.loads((PUBLIC/'maps/floor1.tmj').read_text())
    zones = [properties(z) for z in next(l for l in document['layers'] if l['name']=='zones')['objects']]
    atlas = json.loads((PUBLIC/'sprites/environment.json').read_text())
    sheet = Image.open(PUBLIC/'sprites/environment.png').convert('RGBA')
    records, replaced, rendered = [], set(), []
    exclusion_file = INPUTS/'excluded-assets.json'
    excluded = set(json.loads(exclusion_file.read_text())) if exclusion_file.exists() else set()
    excluded.add('furniture_entrance_door.png') # Owned by open-portal architecture.
    excluded.add('furniture_pool_coping.png') # Exact continuous ground ring.
    (OUT/'furniture').mkdir(parents=True, exist_ok=True)
    rear_desk_available = (generated/'rooms'/REAR_OPERATOR_DESK).is_file()
    if rear_desk_available:
        variant = generated/'rooms'/REAR_OPERATOR_DESK
        review = json.loads(variant.with_suffix('.provenance.json').read_text())
        if (review.get('sha256') != digest(variant) or not review.get('inspected')
                or not review.get('accepted_for_registration') or review.get('operator_facing') != 'SW'
                or review.get('long_edge_direction') != 'up-right'
                or not review.get('original_bytes_preserved') or review.get('mirrored') is not False):
            raise ValueError('Rear-operator desk requires verified original artwork and scoped facing acceptance')
    for source in sorted((generated/'rooms').glob('furniture_*.png')):
        if source.name in excluded:
            continue
        canonical_sprite = 'furniture_desk.png' if source.name == REAR_OPERATOR_DESK else source.name
        candidates = [p for p in original['props'] if p['sprite'] == canonical_sprite
                      and not p.get('file') and room_for(p,zones) != 'Z08'
                      and (source.name != REAR_OPERATOR_DESK or room_for(p,zones) in REAR_OPERATOR_ZONES)
                      and (source.name != 'furniture_desk.png' or not rear_desk_available
                           or room_for(p,zones) not in REAR_OPERATOR_ZONES)]
        if not candidates:
            continue
        image = Image.open(source)
        if image.mode != 'RGBA':
            raise ValueError(f'Expected genuine RGBA image: {source}')
        box = visible_box(image)
        if not box or image.getchannel('A').getextrema()[0] != 0:
            raise ValueError(f'Missing object or transparency: {source}')
        destination = OUT/'furniture'/source.name
        shutil.copyfile(source, destination)
        assert digest(destination) == digest(source)
        entry = atlas['frames'][canonical_sprite]
        if entry['rotated']:
            raise ValueError('Repack rotated atlas frame before registration')
        frame = entry['frame']
        old_box = visible_box(sheet.crop((frame['x'],frame['y'],frame['x']+frame['w'],frame['y']+frame['h'])))
        if not old_box:
            raise ValueError(f'Empty canonical frame: {source.name}')
        groups = []
        for zone in zones:
            groups.extend(clusters([p for p in candidates if room_for(p,zones)==zone['zone_id']], source.name in JOINED))
        instances = []
        for group in groups:
            # Aggregate the original occupied presentation envelope, retaining its
            # bottom anchor. This prevents a segmented table becoming four tables.
            x0 = min(p['bounds']['x']+old_box[0] for p in group)
            y0 = min(p['bounds']['y']+old_box[1] for p in group)
            x1 = max(p['bounds']['x']+old_box[2] for p in group)
            y1 = max(p['bounds']['y']+old_box[3] for p in group)
            logical_width = WIDTHS[Path(canonical_sprite).stem.removeprefix('furniture_')]
            scale = logical_width/(box[2]-box[0])
            width, height = (box[2]-box[0])*scale, (box[3]-box[1])*scale
            p = copy.deepcopy(max(group, key=lambda p:(p['z'], p['id'])))
            p.update(file=f'{WEB}/furniture/{source.name}', artKind='registered-generated-furniture',
                     componentId=source.stem, zone=room_for(p,zones),
                     bounds=dict(x=(x0+x1-width)/2, y=y1-height, width=width, height=height),
                     artClipPath=f'polygon(0px 0px,{width}px 0px,{width}px {height}px,0px {height}px)',
                     artLayers=[dict(id='whole-object', width=image.width, height=image.height,
                                     clipPath=f'polygon({box[0]}px {box[1]}px,{box[2]}px {box[1]}px,{box[2]}px {box[3]}px,{box[0]}px {box[3]}px)',
                                     matrix=[scale,0,0,scale,-box[0]*scale,-box[1]*scale])])
            ids = [q['id'] for q in group]
            replaced.update(ids)
            variants = [(p, ids, None)]
            if source.name in DEPTH_SLICED and len(group)>1 and (
                    len({q['gx'] for q in group}) == 1 or len({q['gy'] for q in group}) == 1):
                # One coherent untouched image, divided only in presentation.
                # Each column returns to its original cell depth so actors at a
                # counter queue can interleave with the far/front segments.
                ordered = sorted(group, key=lambda q:q['x'])
                cuts = [p['bounds']['x']] + [(a['x']+b['x'])/2 for a,b in zip(ordered,ordered[1:])] + [p['bounds']['x']+width]
                if any(a>=b for a,b in zip(cuts,cuts[1:])):
                    raise ValueError(f'Invalid depth-strip widths: {source.name}')
                variants=[]
                for index, original_prop in enumerate(ordered):
                    piece=copy.deepcopy(p)
                    piece.update({key:original_prop[key] for key in ('id','gx','gy','x','y','z')})
                    left,right=cuts[index]-p['bounds']['x'],cuts[index+1]-p['bounds']['x']
                    piece['artClipPath']=f'polygon({left}px 0px,{right}px 0px,{right}px {height}px,{left}px {height}px)'
                    variants.append((piece,[original_prop['id']],dict(index=index,count=len(ordered),
                                    x0=left,x1=right,joinedSourcePropIds=ids)))
            for piece, source_ids, depth_slice in variants:
                rendered.append(piece)
                instances.append(dict(id=piece['id'], sourcePropIds=source_ids, zone=piece['zone'],
                                      logicalAnchor=[piece['gx'],piece['gy']], originalEnvelope=[x0,y0,x1,y1],
                                      bounds=piece['bounds'], scale=scale, logicalWidth=logical_width,
                                      scaleReference='Approved Z08: desk80/chair40/sofa100',depthSlice=depth_slice,
                                      groundAnchor=[(x0+x1)/2,y1], sourcePixelsEdited=False))
        records.append(dict(id=source.stem, file=f'{WEB}/furniture/{source.name}', sha256=digest(source),
                            nativeSize=list(image.size), alphaBox=list(box), instances=instances,
                            sourceBytesPreserved=True, browserVisualQA=False))
        if source.name == REAR_OPERATOR_DESK:
            records[-1].update(operatorFacing='SW', independentView=True, mirrored=False,
                               provenanceFile='art/generated-office-2026-10-05/rooms/'+source.with_suffix('.provenance.json').name,
                               projectionQualification=review['projection_qualification'])
    assets['props'] = sorted([p for p in original['props'] if p['id'] not in replaced] + rendered,
                             key=lambda p:(p['z'],p['id']))
    # The canonical espresso location is behind the counter on the map. Its
    # old atlas artwork baked in elevation; the newly isolated machine needs
    # an explicit support-plane anchor or the tall cabinet hides it completely.
    coffee = next((p for p in assets['props'] if p['sprite']=='furniture_espresso_machine.png' and p.get('file')),None)
    counter = [p for p in assets['props'] if p['sprite']=='furniture_marble_counter.png' and p.get('artLayers')]
    if coffee and counter:
        support=counter[0]
        a,b,c,d,tx,ty=support['artLayers'][0]['matrix']
        sx,sy=1085,404 # Measured point inside the original marble top, not a ground tile.
        anchor=[support['bounds']['x']+a*sx+c*sy+tx,support['bounds']['y']+b*sx+d*sy+ty]
        old_z=coffee['z']
        coffee['bounds'].update(x=anchor[0]-coffee['bounds']['width']/2,y=anchor[1]-coffee['bounds']['height'])
        coffee['z']=max(p['z'] for p in counter)+2
        for record in records:
            for instance in record['instances']:
                if instance['id']==coffee['id']:
                    instance.update(bounds=copy.deepcopy(coffee['bounds']),groundAnchor=anchor,
                                    support=dict(propIds=[p['id'] for p in counter],sourceImagePoint=[sx,sy],
                                                 worldPoint=anchor,originalDepth=old_z,presentationDepth=coffee['z']))
        assets['props'].sort(key=lambda p:(p['z'],p['id']))
    room_presentation = apply_room_presentation(assets, records)
    assert len({p['id'] for p in assets['props']}) == len(assets['props'])
    assert assets['logicalMapSha256'] == digest(PUBLIC/'maps/floor1.tmj')
    assets['styleVersion'] = 'AO_ILLUSTRATED_OFFICE_V1_CANDIDATE'
    assets['finalArt'] = False
    assets['provenance'] = dict(assets.get('provenance',{}), sourceCommit='c0a52d15b9b1c5c276292489044b017b74980c77',
                               previousManifest='/visual-migration/environment-foundation-v1/assets.json',
                               generatedFurnitureLedger=WEB+'/furniture-ledger.json', finalArt=False,
                               browserQA=False, logicalLayoutChanged=False, sourcePixelsEdited=False)
    surfaces, surface_ledger = build_ground_surfaces(document, generated/'foundation', OUT/'surfaces', WEB+'/surfaces')
    assets['groundSurfaces'] = surfaces
    dump(OUT/'ground-registration-ledger.json', surface_ledger)
    assets['props'], pool_ledger = register_pool_coping(assets, generated/'rooms/furniture_pool_coping.png',
                                                     OUT/'furniture', WEB+'/furniture')
    replaced.update(p['id'] for p in original['props'] if p['sprite']=='furniture_pool_coping.png')
    dump(OUT/'pool-registration-ledger.json', pool_ledger)
    assets['props'], architecture_ledger = register_architecture(assets)
    dump(OUT/'architecture-registration-ledger.json', architecture_ledger)
    assets['props'], seating_ledger = register_room_seating(assets, document, generated/'seating',
                                                         OUT/'seating', WEB+'/seating')
    seating_replaced = set(seating_ledger['replacedPropIds'])
    for record in records:
        record['instances'] = [i for i in record['instances'] if i['id'] not in seating_replaced]
    records = [r for r in records if r['instances']]
    dump(OUT/'seating-registration-ledger.json', seating_ledger)
    assets, runtime_ledger = pack_runtime_art(assets, PUBLIC)
    dump(OUT/'runtime-packing-ledger.json', runtime_ledger)
    coverage=[]
    architecture_sources = {r['sourcePropId'] for r in architecture_ledger['replacements']}
    for zone in zones:
        before=[p for p in original['props'] if room_for(p,zones)==zone['zone_id'] and p['sprite'].startswith('furniture')]
        remaining=[p for p in assets['props'] if room_for(p,zones)==zone['zone_id']
                   and p['sprite'].startswith('furniture') and not p.get('file')]
        coverage.append(dict(zone=zone['zone_id'], name=zone['name'], generatedSourceProps=sum(p['id'] in replaced for p in before),
                             preservedIllustratedProps=sum(bool(p.get('file')) for p in before),
                             architectureSourceProps=sum(p['id'] in architecture_sources for p in before),
                             remainingAtlasProps=len(remaining), remainingSprites=sorted({p['sprite'] for p in remaining}),
                             browserVisualQA=False, complete=False))
    dump(OUT/'furniture-ledger.json', dict(sources=records, roomPresentation=room_presentation,
                                        sourcePixelsEdited=False, sourceBytesPreserved=True,
                                        logicalMapChanged=False, browserVisualQA=False))
    dump(OUT/'coverage.json', coverage)
    dump(OUT/'assets.json', assets)
    return assets, coverage

if __name__ == '__main__':
    parser=argparse.ArgumentParser()
    parser.add_argument('--generated', type=Path, default=INPUTS)
    args=parser.parse_args()
    assets,coverage=register(args.generated)
    print(json.dumps(dict(props=len(assets['props']),generatedSourceProps=sum(z['generatedSourceProps'] for z in coverage),
                          zonesWithNewFurniture=sum(z['generatedSourceProps']>0 for z in coverage),browserVisualQA=False)))
