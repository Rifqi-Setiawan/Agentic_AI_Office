"""Pack imagegen illustrations and recompose the unchanged map for a Z08 candidate.

Only mechanical source crops, uniform character scaling, atlas packing and layer
composition are performed here. Background removal/redrawing uses imagegen.
Offline compositions are asset checks, NEVER browser screenshots or motion QA.
"""
from collections import deque
from pathlib import Path
import argparse
import copy
import hashlib
import json
import math
from PIL import Image, ImageDraw
from visual_migration_contract import canonical

ROOT = Path(__file__).resolve().parents[1]
PUBLIC = ROOT / 'frontend/public'
ART = ROOT / 'art/illustrated-z08-v1'
SRC = ART / 'sources'
OUT = PUBLIC / 'visual-migration/illustrated-z08-v1'
EVIDENCE = ROOT / 'docs/visual-migration/evidence/illustrated-z08-v1'
STYLE = 'AO_ILLUSTRATED_2D_Z08_V1'
WEB_ROOT = '/visual-migration/illustrated-z08-v1'
ORIENTATION_FIX = False


def write_json(path, data):
    path.write_text(json.dumps(data, indent=2), encoding='utf-8')


def parts(name, columns, rows):
    """Locate isolated opaque subjects; preserve original RGBA in source crops."""
    source = ART/'sources/desk-se-compact.png' if ORIENTATION_FIX and name == 'desk' else SRC/(name+'.png')
    image = Image.open(source).convert('RGBA')
    small = image.getchannel('A')
    small.thumbnail((400, 600))
    w, h = small.size
    pixels = bytearray(v > 80 for v in small.tobytes())
    groups = [[] for _ in range(columns)]
    for start in range(w * h):
        if not pixels[start]:
            continue
        pixels[start] = 0
        todo = deque([start])
        xs, ys = [], []
        while todo:
            i = todo.popleft()
            x, y = i % w, i // w
            xs.append(x)
            ys.append(y)
            adjacent = ([i-1] if x else []) + ([i+1] if x < w-1 else [])
            adjacent += ([i-w] if y else []) + ([i+w] if y < h-1 else [])
            for j in adjacent:
                if pixels[j]:
                    pixels[j] = 0
                    todo.append(j)
        if len(xs) < 150:
            continue
        box = (min(xs), min(ys), max(xs)+1, max(ys)+1)
        column = min(columns-1, int((box[0]+box[2]) / 2 / w * columns))
        groups[column].append(box)
    if any(len(group) != rows for group in groups):
        raise ValueError(f'{name}: expected {columns}x{rows} isolated subjects, got {[len(g) for g in groups]}')
    result = {}
    for col, group in enumerate(groups):
        for row, b in enumerate(sorted(group, key=lambda b: b[1])):
            box = (max(0, math.floor(b[0]*image.width/w)-5),
                   max(0, math.floor(b[1]*image.height/h)-5),
                   min(image.width, math.ceil(b[2]*image.width/w)+5),
                   min(image.height, math.ceil(b[3]*image.height/h)+5))
            crop = image.crop(box)
            result[row, col] = {'image': crop, 'source': source.name, 'sourceCrop': box}
    return result


def save_piece(name, image, width):
    height = round(image.height * width / image.width)
    image = image.resize((width, height), Image.Resampling.LANCZOS)
    image.save(OUT / (name+'.png'))
    return image


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    EVIDENCE.mkdir(parents=True, exist_ok=True)
    (OUT / 'frames').mkdir(exist_ok=True)
    document = json.loads((PUBLIC/'maps/floor1.tmj').read_text())
    contract = canonical(document)
    zone = next(z for z in contract['zones'] if z['zone_id'] == 'Z08')
    xmin,xmax,ymin,ymax=(zone[k] for k in ('gx_min','gx_max','gy_min','gy_max'))
    slots = [s for s in contract['slots'] if s['zone'] == 'Z08']
    baseline = json.loads((PUBLIC/'visual-migration/preview-assets.json').read_text())
    env = json.loads((PUBLIC/'sprites/environment.json').read_text())
    old_sheet = Image.open(PUBLIC/'sprites/environment.png').convert('RGBA')
    idle = parts('idle-v2', 4, 1)
    walk = parts('walk-v4', 2, 4)
    sit = parts('sit-v2', 2, 4)
    # v4 changed NW passing to NE. Use the separately generated correct NW pose;
    # no reflection, rotation or direction relabeling of a wrong view is allowed.
    walk[3, 1] = {'image': Image.open(SRC/'walk-v3.png').convert('RGBA').crop((618,1137,832,1525)),
                  'source':'walk-v3.png', 'sourceCrop':(618,1137,832,1525)}
    directions = ['se','sw','ne','nw']
    entries = []
    for i, direction in enumerate(directions):
        entries.append(('idle', direction, 0, idle[0, i], 136))
        for frame in range(2):
            entries.append(('walk', direction, frame, walk[i, frame], 136))
            entries.append(('sit_type', direction, frame, sit[i, frame], 112))
    atlas_image = Image.new('RGBA', (512, 960))
    atlas = {'frames':{}, 'meta':{'image':WEB_ROOT+'/prism.png',
             'size':{'w':512,'h':960}, 'exportScale':2, 'styleVersion':STYLE,
             'footAnchor':{'x':.5,'y':.92}, 'animationFps':{'idle':1,'walk':4.8,'sit_type':3},
             'candidate':True, 'userStyleApproved':False, 'allowMirror':False}}
    ledger = []
    frame_images = []
    for index, (action, direction, number, part, target_height) in enumerate(entries):
        im = part['image']
        opaque = im.getchannel('A').point(lambda v: 255 if v > 2 else 0).getbbox()
        if not opaque:
            raise ValueError('Empty sprite')
        im = im.crop(opaque)
        scale = target_height / im.height
        im = im.resize((round(im.width*scale), target_height), Image.Resampling.LANCZOS)
        if im.width > 120:
            raise ValueError('Sprite exceeds logical canvas')
        canvas = Image.new('RGBA', (128,192))
        canvas.alpha_composite(im, ((128-im.width)//2, round(192*.92)-im.height))
        name = f'prism_{action}_{direction}_{number}.png'
        canvas.save(OUT/'frames'/name)
        x, y = index%4*128, index//4*192
        atlas_image.alpha_composite(canvas,(x,y))
        atlas['frames'][name] = {'frame':{'x':x,'y':y,'w':128,'h':192}, 'rotated':False,
             'trimmed':False,'spriteSourceSize':{'x':0,'y':0,'w':128,'h':192},
             'sourceSize':{'w':128,'h':192}}
        ledger.append({'file':'frames/'+name, 'action':action, 'direction':direction,
                       'source':part['source'], 'sourceCrop':part['sourceCrop'],
                       'uniformScale':scale, 'mirrored':False, 'status':'candidate',
                       'footAnchor':[.5,.92], 'sha256':hashlib.sha256((OUT/'frames'/name).read_bytes()).hexdigest()})
        frame_images.append((name,canvas))
    atlas_image.save(OUT/'prism.png')
    write_json(OUT/'prism.json',atlas)
    write_json(OUT/'character-ledger.json',{'frames':ledger,'loopQuality':'two-pose step study; opposite-leg phase still needed',
                'browserMotionVerified':False, 'styleApproved':False})

    desk = parts('desk',1,1)[0,0]['image']
    desk = save_piece('desk',desk,168 if ORIENTATION_FIX else 192)
    furniture = parts('furniture',3,2)
    chair = save_piece('chair',furniture[0,0]['image'],80)
    standing = save_piece('standing-desk',furniture[1,0]['image'],144)
    wall_rising = save_piece('wall-rising',furniture[1,1]['image'],72)
    wall_falling = save_piece('wall-falling',furniture[1,2]['image'],72)
    posts = parts('door-posts',2,2)
    post = save_piece('door-post',posts[0,0]['image'],22)
    floors = parts('floor',2,1)
    floor_tiles = [p['image'].resize((128,64),Image.Resampling.LANCZOS) for p in [floors[0,0],floors[0,1]]]
    for name, image in zip(['oak','corridor'],floor_tiles): image.save(OUT/(name+'.png'))
    # Rebuild from the map, omitting old Z08 tiles rather than covering them.
    floor = Image.new('RGBA',(5120,2880))
    gid_names = {ts['firstgid']+tile['id']:tile['image'] for ts in document['tilesets'] for tile in ts['tiles'] if 'image' in tile}
    low = {'furniture_prayer_rug_shaf.png','furniture_ground_shadow.png','furniture_pool_basin.png','furniture_pool_water.png'}
    for layer in document['layers']:
        if layer['name'] not in ('floor','furniture'): continue
        for cell,gid in sorted(enumerate(layer['data']),key=lambda p:p[0]%44+p[0]//44):
            if not gid: continue
            name = gid_names[gid]
            if layer['name'] != 'floor' and name not in low: continue
            gx,gy = cell%44,cell//44
            x,y = 1088+(gx-gy)*32,64+(gx+gy)*16
            new_floor = layer['name']=='floor' and xmin<=gx<=xmax and ymin-2<=gy<=ymax+2
            if new_floor:
                image = floor_tiles[0 if ymin<=gy<=ymax else 1]
                floor.alpha_composite(image,(x*2-64,y*2-32))
            else:
                e=env['frames'][name]; f=e['frame'];s=e['sourceSize'];t=e['spriteSourceSize']
                image=old_sheet.crop((f['x'],f['y'],f['x']+f['w'],f['y']+f['h'])).resize((f['w']*2,f['h']*2),Image.Resampling.NEAREST)
                floor.alpha_composite(image,(round((x-s['w']/2+t['x'])*2),round((y-s['h']/2+t['y'])*2)))
    floor_bounds=floor.getbbox()
    floor.crop(floor_bounds).save(OUT/'floor.webp',lossless=True)
    assets = copy.deepcopy(baseline)
    assets.update({'styleVersion':STYLE,'schemaVersion':2,'exportScale':2,
                   'floor':{'file':WEB_ROOT+'/floor.webp',
                            'x':floor_bounds[0]/2,'y':floor_bounds[1]/2,
                            'width':(floor_bounds[2]-floor_bounds[0])/2,'height':(floor_bounds[3]-floor_bounds[1])/2},
                   'characterOverrides':{'prism':WEB_ROOT+'/prism.json'},
                   'userStyleApproved':False,'finalArt':False})
    assets['props'] = []

    def piece(prop, suffix, image, anchor, z, offset=(0,0)):
        file=prop['id']+'-'+suffix+'.png'
        image.save(OUT/file)
        w,h=image.width/2,image.height/2
        bounds={'x':prop['x']+offset[0]-anchor[0]*w,'y':prop['y']+offset[1]-anchor[1]*h,'width':w,'height':h}
        assets['props'].append({**prop,'id':prop['id']+'-'+suffix,'file':WEB_ROOT+'/'+file,
                               'z':z,'bounds':bounds,'artKind':'illustration-candidate',
                               'sourcePropId':prop['id'],'visualOffset':list(offset)})

    for prop in baseline['props']:
        if not (xmin<=prop['gx']<=xmax and ymin<=prop['gy']<=ymax):
            assets['props'].append(prop);continue
        base=(prop['gx']+prop['gy'])*1000
        name=prop['sprite']
        if 'doorway' in name:
            falling=prop['gx']!=xmax
            for side in [-1,1]:
                piece(prop,'jamb'+str(side),post,(.5,.93),base+side*375+30,
                      (side*15, side*7.5 if falling else -side*7.5))
        elif 'wall' in name:
            image=wall_rising if '_nw' in name else wall_falling
            piece(prop,'low-wall',image,(.5,.70),prop['z'])
        elif 'workstation' in name:
            if ORIENTATION_FIX:
                slot=next(s for s in slots if s['gx']==prop['gx']+1 and s['gy']==prop['gy'])
                if slot['facing'] != 'SE':
                    raise ValueError('SE artwork cannot be silently assigned another facing')
                # SE in the simulation is +gx -> screen(+32,+16). Place the
                # keyboard ahead of the unchanged slot, and the chair behind it.
                # Source tile IDs/collision remain unchanged; only art placement
                # and painter depth use the recorded visual ground anchor.
                distance=.95
                offset=((1+distance)*32,(1+distance)*16)
                visual_gx=slot['gx']+distance
                piece(prop,'desk-se',desk,(.54,.78),round((visual_gx+slot['gy'])*1000)+10,offset)
                assets['props'][-1].update({'facing':'SE','slotId':slot['id'],
                    'visualGridAnchor':{'gx':visual_gx,'gy':slot['gy']},
                    'groundAnchor':{'x':.54,'y':.78}})
                continue
            split=round(desk.height*.50)
            # The unchanged furniture tile anchors the drawer-side rear leg;
            # the illustrated work surface reaches the adjacent interaction slot.
            piece(prop,'rear',desk.crop((0,0,desk.width,split)),(.125,desk.height*.60/split),base+10)
            piece(prop,'front',desk.crop((0,split,desk.width,desk.height)),(.125,0),base+1100,
                  (0,split/2-desk.height*.60/2))
        elif name=='furniture_chair.png':
            slot=next(s for s in slots if s['gx']==prop['gx']-1 and s['gy']==prop['gy'])
            if ORIENTATION_FIX:
                if slot['facing'] != 'SE':
                    raise ValueError('SE chair cannot be silently assigned another facing')
                distance=-.35
                visual_gx=slot['gx']+distance
                offset=((distance-1)*32,(distance-1)*16)
                piece(prop,'chair-se',chair,(.5,.93),round((visual_gx+slot['gy'])*1000)+10,offset)
                assets['props'][-1].update({'facing':'SE','slotId':slot['id'],
                    'visualGridAnchor':{'gx':visual_gx,'gy':slot['gy']},
                    'groundAnchor':{'x':.5,'y':.93}})
                continue
            offset=(-32,-16+slot['y_offset'])
            split=round(chair.height*.70)
            piece(prop,'back',chair.crop((0,0,chair.width,split)),(.5,chair.height*.93/split),base-1010,offset)
            piece(prop,'casters',chair.crop((0,split,chair.width,chair.height)),(.5,0),base-970,
                  (offset[0],offset[1]+split/2-chair.height*.93/2))
        elif 'standing_desk' in name:
            piece(prop,'standing',standing,(.5,.76),prop['z'])
        else: assets['props'].append(prop)
    assets['props'].sort(key=lambda p:(p['z'],p['id']))
    assets['provenance']={'tool':'built-in imagegen','sources':str(ART.relative_to(ROOT)/'source-index.json').replace('\\','/'),
             'referenceRights':'User supplied; independent rights not verified; no blanket MIT claim',
             'finalArt':False,'acceptedAssets':[], 'scope':['Z08','Prism idle/walk/sit_type','adjacent corridor floor segments']}
    write_json(OUT/'assets.json',assets)
    write_json(ART/'slice-contract.json',{'zone':zone,'slots':slots,
                'doors':[d for d in contract['doors'] if 'Z08' in (d.get('from'),d.get('to'))],
                'logicalMapSha256':assets['logicalMapSha256'],'mapChanged':False})
    # Contact sheet on light/dark backgrounds; no background pixels are edited.
    sheet=Image.new('RGB',(960,1050),'#151d28');draw=ImageDraw.Draw(sheet)
    draw.text((15,10),'ASSET CONTACT SHEET - candidate, NOT browser QA',fill='#f4ede0')
    for index,(name,image) in enumerate(frame_images):
        x,y=(index%5)*192,40+(index//5)*245
        color='#eee8df' if index%2==0 else '#202c3a'
        tile=Image.new('RGBA',(192,245),color);tile.alpha_composite(image,(32,10))
        sheet.paste(tile.convert('RGB'),(x,y));draw.text((x+6,y+211),name.removeprefix('prism_').removesuffix('.png'),fill='#518c9c' if index%2==0 else '#b0ccd2')
    sheet.save(EVIDENCE/'prism-contact-sheet.png')
    comp=Image.new('RGBA',(5120,2880),'#151d28');comp.alpha_composite(floor)
    actor=Image.open(OUT/'frames/prism_sit_type_se_0.png')
    slot=next(s for s in slots if s['id']=='slot_z08_desk_prism')
    x,y=1088+(slot['gx']-slot['gy'])*32,64+(slot['gx']+slot['gy'])*16
    layers=[(p['z'],p) for p in assets['props']]+[((slot['gx']+slot['gy'])*1000+20,{'actor':True})]
    for _,p in sorted(layers,key=lambda p:p[0]):
        if p.get('actor'):
            comp.alpha_composite(actor,(round(x*2-64),round(y*2-192*.92+slot['y_offset']*2)));continue
        b=p['bounds']
        if p.get('file'):image=Image.open(PUBLIC/p['file'].lstrip('/')).convert('RGBA')
        else:
            f=env['frames'][p['sprite']]['frame'];image=old_sheet.crop((f['x'],f['y'],f['x']+f['w'],f['y']+f['h'])).resize((round(b['width']*2),round(b['height']*2)),Image.Resampling.NEAREST)
        comp.alpha_composite(image,(round(b['x']*2),round(b['y']*2)))
    overview=comp.convert('RGB').resize((1280,720),Image.Resampling.LANCZOS)
    ImageDraw.Draw(overview).text((16,16),'OFFLINE MAP COMPOSITION - NOT browser screenshot',fill='white')
    overview.save(EVIDENCE/'offline-overview.png')
    detail=comp.crop((900*2,390*2,1650*2,850*2)).convert('RGB')
    ImageDraw.Draw(detail).text((20,20),'OFFLINE Z08 LAYER COMPOSITION - NOT browser screenshot',fill='white')
    detail.save(EVIDENCE/'offline-z08-detail.png')
    if ORIENTATION_FIX:
        detail.resize((750,460),Image.Resampling.LANCZOS).save(EVIDENCE/'offline-z08-normal.png')
        workstations=detail.crop((225,115,885,555))
        draw=ImageDraw.Draw(workstations)
        draw.rectangle((0,0,660,15),fill='#151d28')
        draw.text((5,2),'OFFLINE ASSET COMPOSITION - not a browser screenshot',fill='white')
        workstations.save(EVIDENCE/'workstations-detail.png')
        # These source-image tabletop corners were visually identified on the
        # generated desk. SAT verifies that adjacent illustrated tabletops have
        # a gap; tall monitor/plant silhouettes can still overlap in projection.
        source=parts('desk',1,1)[0,0]
        crop=source['sourceCrop']
        corners=[(272,525),(925,147),(1267,304),(585,706)]
        scale=desk.width/source['image'].width/2
        props=[p for p in assets['props'] if p['id'].endswith('-desk-se')]
        polygons=[[(p['bounds']['x']+(cx-crop[0])*scale,
                    p['bounds']['y']+(cy-crop[1])*scale) for cx,cy in corners] for p in props]
        gaps=[]
        for a,b in zip(polygons,polygons[1:]):
            separated=[]
            for polygon in (a,b):
                for u,v in zip(polygon,polygon[1:]+polygon[:1]):
                    nx,ny=-(v[1]-u[1]),v[0]-u[0]
                    length=math.hypot(nx,ny)
                    pa=[(x*nx+y*ny)/length for x,y in a]
                    pb=[(x*nx+y*ny)/length for x,y in b]
                    separated.append(max(min(pb)-max(pa),min(pa)-max(pb)))
            gap=max(separated)
            if gap<=0: raise ValueError('Adjacent desk tabletops intersect')
            gaps.append(gap)
        write_json(EVIDENCE/'orientation-check.json',{
            'facing':'SE','canonicalGridVector':[1,0],'screenVector':[32,16],
            'deskAheadOfSlot':True,'chairBehindSlot':True,
            'sourceDesk':'art/illustrated-z08-v2/sources/'+source['source'],
            'sourceCrop':crop,'sourceTabletopLandmarks':corners,'adjacentTabletopGapsLogicalPixels':gaps,
            'scope':'offline geometry and static layer check; browser motion still pending',
            'mapSha256':assets['logicalMapSha256'],'sourceFurnitureTilesChanged':False,
            'slotsChanged':False,'collisionChanged':False,
            'workstations':[{'slotId':p['slotId'],'deskSourceId':p['sourcePropId'],
                'deskVisualGroundAnchor':p['visualGridAnchor'],
                'chairVisualGroundAnchor':next(c['visualGridAnchor'] for c in assets['props']
                    if c.get('slotId')==p['slotId'] and c['id'].endswith('-chair-se')),
                'painterOrder':['chair','actor','desk']} for p in props]})
    write_json(EVIDENCE/'packing-check.json',{'characterFrames':len(ledger),'rotatedFrames':0,'mirroredCandidateFrames':0,
         'mapSha256':assets['logicalMapSha256'],'globalProps':len(assets['props']),
         'assetsPacked':True,'browserQA':False,'userStyleApproved':False,'walkLoopAccepted':False})
    print(json.dumps({'frames':len(ledger),'props':len(assets['props']),'output':str(OUT),'finalArt':False}))


if __name__ == '__main__':
    parser=argparse.ArgumentParser()
    parser.add_argument('--orientation-fix',action='store_true',help='Write v2 with slot-facing-aligned SE desk/chair art; preserve v1')
    args=parser.parse_args()
    if args.orientation_fix:
        ORIENTATION_FIX=True
        ART=ROOT/'art/illustrated-z08-v2'
        OUT=PUBLIC/'visual-migration/illustrated-z08-v2'
        EVIDENCE=ROOT/'docs/visual-migration/evidence/illustrated-z08-v2'
        STYLE='AO_ILLUSTRATED_2D_Z08_V2'
        WEB_ROOT='/visual-migration/illustrated-z08-v2'
    main()
