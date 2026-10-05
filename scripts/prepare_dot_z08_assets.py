"""Mechanically pack user-supplied Dot assets into the local Z08 preview.

Preserve source RGBA; only crop, uniformly scale, pack and compose layers.
No artwork redraw, direction mirroring, logical-map edit or browser QA.
"""
from pathlib import Path
from collections import deque
import copy
import hashlib
import json
import math
from PIL import Image, ImageDraw
import prepare_illustrated_z08 as packing

ROOT = Path(__file__).resolve().parents[1]
PUBLIC = ROOT / 'frontend/public'
SRC = ROOT / 'art/dot-assets-2026-10-05/sources'
OUT = PUBLIC / 'visual-migration/dot-z08-candidate'
EVIDENCE = ROOT / 'docs/visual-migration/evidence/dot-assets-2026-10-05'
WEB = '/visual-migration/dot-z08-candidate'
STYLE = 'AO_DOT_Z08_CANDIDATE'


def write_json(path, data):
    path.write_text(json.dumps(data, indent=2), encoding='utf-8')


def entry(x, y):
    return {'frame': {'x': x, 'y': y, 'w': 128, 'h': 192}, 'rotated': False,
            'trimmed': False, 'spriteSourceSize': {'x': 0, 'y': 0, 'w': 128, 'h': 192},
            'sourceSize': {'w': 128, 'h': 192}}


def frame(part):
    image = part['image']
    scale = 136 / image.height
    image = image.resize((round(image.width*scale),136),Image.Resampling.LANCZOS)
    if image.width > 120:
        raise ValueError('Character exceeds frame canvas')
    canvas = Image.new('RGBA',(128,192))
    canvas.alpha_composite(image,((128-image.width)//2,round(192*.92)-136))
    return canvas,scale


def refine_sheet_crop(part):
    """Tighten a rectangular crop to its main subject, excluding adjacent-view scraps.

    Connected-component analysis selects bounds only; source alpha is never masked.
    """
    image=part['image'];w,h=image.size
    pixels=bytearray(value>80 for value in image.getchannel('A').tobytes())
    best=None
    for start in range(w*h):
        if not pixels[start]:continue
        pixels[start]=0;queue=deque([start]);count=0;xmin,ymin,xmax,ymax=w,h,0,0
        while queue:
            i=queue.popleft();x,y=i%w,i//w;count+=1
            xmin,ymin,xmax,ymax=min(xmin,x),min(ymin,y),max(xmax,x),max(ymax,y)
            neighbors=([i-1] if x else [])+([i+1] if x<w-1 else [])
            neighbors+=([i-w] if y else [])+([i+w] if y<h-1 else [])
            for n in neighbors:
                if pixels[n]:pixels[n]=0;queue.append(n)
        if best is None or count>best[0]:best=(count,(xmin,ymin,xmax+1,ymax+1))
    if best is None:raise ValueError('Empty character view')
    x0,y0,x1,y1=best[1]
    bounds=(max(0,x0-2),max(0,y0-2),min(w,x1+2),min(h,y1+2))
    source=part['sourceCrop']
    return {**part,'image':image.crop(bounds),
            'sourceCrop':(source[0]+bounds[0],source[1]+bounds[1],source[0]+bounds[2],source[1]+bounds[3])}


def main():
    OUT.mkdir(parents=True,exist_ok=True)
    (OUT/'frames').mkdir(exist_ok=True)
    EVIDENCE.mkdir(parents=True,exist_ok=True)
    packing.SRC = SRC
    manifest = json.loads((SRC/'manifest.json').read_text())
    for asset in manifest['assets']:
        assert hashlib.sha256((SRC/asset['file']).read_bytes()).hexdigest()==asset['sha256']
    source_index=json.loads((ROOT/'art/dot-assets-2026-10-05/source-index.json').read_text())
    for item in source_index['files']+source_index.get('derivedCorrections',[]):
        assert hashlib.sha256((ROOT/item['file']).read_bytes()).hexdigest()==item['sha256']
    map_sha = hashlib.sha256((PUBLIC/'maps/floor1.tmj').read_bytes()).hexdigest()
    base = json.loads((PUBLIC/'visual-migration/illustrated-z08-v3/assets.json').read_text())
    assert base['logicalMapSha256']==map_sha
    ledger = []
    contact_frames = []
    # Existing idle, seated and the three other walk directions remain explicit.
    prism = json.loads((PUBLIC/'visual-migration/illustrated-z08-v3/prism.json').read_text())
    prism['frames'] = {name:e for name,e in prism['frames'].items() if not name.startswith('prism_walk_se_')}
    prism_sheet = Image.open(PUBLIC/'visual-migration/illustrated-z08-v3/prism.png').convert('RGBA')
    for index,name in enumerate(manifest['frame_order']):
        part = packing.parts(Path(name).stem,1,1)[0,0]
        canvas,scale = frame(part)
        output = f'prism_walk_se_{index}.png'
        canvas.save(OUT/'frames'/output)
        x,y = index*128,5*192
        prism['frames'][output] = entry(x,y)
        ledger.append({'output':'frames/'+output,'agent':'prism','action':'walk','facing':'SE',
                       'source':part['source'],'sourceCrop':part['sourceCrop'],'uniformScale':scale,
                       'mirrored':False,'sourceSha256':hashlib.sha256((SRC/name).read_bytes()).hexdigest()})
        contact_frames.append((output,canvas))
    expanded = Image.new('RGBA',(512,1152))
    expanded.alpha_composite(prism_sheet)
    for index,(_,canvas) in enumerate(contact_frames):expanded.alpha_composite(canvas,(index*128,960))
    expanded.save(OUT/'prism.png')
    prism['meta'].update(image=WEB+'/prism.png',size={'w':512,'h':1152},styleVersion=STYLE,
                         source='Dot walk SE plus existing v3 poses',candidate=True,allowMirror=False)
    write_json(OUT/'prism.json',prism)
    write_json(EVIDENCE/'prism-walk-source-order.json',{'order':manifest['frame_order'],
               'outputFrames':[item['output'] for item in ledger],
               'walkLoopAccepted':False,'browserMotionVerified':False,
               'identityDifference':'Dot walk hoodie uses cyan trim; existing Prism idle/sit have spectrum sleeves.'})

    # The four supplied views are standing/idle poses; never substitute them for walking or sitting.
    for agent in ['forge','nova']:
        pieces = packing.parts(agent+'-idle-sheet',2,2)
        sheet = Image.new('RGBA',(512,192))
        atlas = {'frames':{},'meta':{'image':WEB+'/'+agent+'.png','size':{'w':512,'h':192},
                 'exportScale':2,'footAnchor':{'x':.5,'y':.92},'candidate':True,
                 'allowMirror':False,'styleVersion':STYLE,'animationFps':{'idle':1}}}
        for index,(direction,key) in enumerate(zip(['se','sw','ne','nw'],[(0,0),(0,1),(1,0),(1,1)])):
            part=packing.parts('forge-idle-ne-clean',1,1)[0,0] if agent=='forge' and direction=='ne' else refine_sheet_crop(pieces[key])
            canvas,scale=frame(part);output=f'{agent}_idle_{direction}_0.png'
            canvas.save(OUT/'frames'/output);sheet.alpha_composite(canvas,(index*128,0))
            atlas['frames'][output]=entry(index*128,0)
            ledger.append({'output':'frames/'+output,'agent':agent,'action':'idle','facing':direction.upper(),
                           'source':part['source'],'sourceCrop':part['sourceCrop'],'uniformScale':scale,'mirrored':False})
            contact_frames.append((output,canvas))
        sheet.save(OUT/(agent+'.png'));write_json(OUT/(agent+'.json'),atlas)

    assets=copy.deepcopy(base)
    assets.update(styleVersion=STYLE,characterOverrides={a:WEB+'/'+a+'.json' for a in ['prism','forge','nova']})
    desk_part=packing.parts('desk-se-lightwood-charcoal',1,1)[0,0]
    chair_part=packing.parts('chair-se-charcoal-cyan',1,1)[0,0]
    furniture={}
    for kind,part,width in [('desk',desk_part,160),('chair',chair_part,80)]:
        image=part['image'];image=image.resize((width,round(image.height*width/image.width)),Image.Resampling.LANCZOS)
        image.save(OUT/(kind+'.png'));furniture[kind]=image
    for prop in assets['props']:
        if prop.get('workstationRole')=='permanent-developer':kind='desk'
        elif prop['id'].endswith('-chair-se'):kind='chair'
        else:continue
        image=furniture[kind];anchor=prop['groundAnchor'];offset=prop['visualOffset']
        w,h=image.width/2,image.height/2
        prop['bounds']={'x':prop['x']+offset[0]-anchor['x']*w,
                       'y':prop['y']+offset[1]-anchor['y']*h,'width':w,'height':h}
        prop['file']=WEB+'/'+kind+'.png';prop['artKind']='dot-user-supplied-candidate'
    assets['provenance']={'sourceIndex':'art/dot-assets-2026-10-05/source-index.json',
                         'source':'User-supplied Dot assets','finalArt':False,'acceptedAssets':[],
                         'layoutChanged':False,'missingActions':'Forge/Nova walk, sit_type and all other actions use explicit baseline.'}
    write_json(OUT/'assets.json',assets)
    write_json(OUT/'character-ledger.json',{'frames':ledger,'browserMotionVerified':False,'walkLoopAccepted':False})

    # Offline loop with fixed ground anchor. Contact sheet covers actual output size and both backgrounds.
    contact=Image.new('RGB',(768,660),'#151d28');draw=ImageDraw.Draw(contact)
    for index,(name,canvas) in enumerate(contact_frames):
        x,y=index%6*128,index//6*330
        tile=Image.new('RGBA',(128,330),'#eee8df' if index%2==0 else '#202c3a')
        tile.alpha_composite(canvas,(0,60));contact.paste(tile.convert('RGB'),(x,y))
        draw.text((x+3,y+270),name.removesuffix('.png').replace('_','\n'),fill='#739cab')
    contact.save(EVIDENCE/'packed-character-contact-sheet.png')
    gif=[]
    for _,canvas in contact_frames[:4]:
        im=Image.new('RGBA',(240,240),'#eee8df');im.alpha_composite(canvas,(56,28))
        ImageDraw.Draw(im).text((10,10),'OFFLINE ASSET LOOP - candidate',fill='#406a78');gif.append(im.convert('RGB'))
    gif[0].save(EVIDENCE/'prism-se-walk-candidate.gif',save_all=True,append_images=gif[1:],duration=200,loop=0)
    compose_room(assets)
    corners=[(273,544),(1013,118),(1348,294),(563,733)]
    crop=desk_part['sourceCrop'];scale=furniture['desk'].width/desk_part['image'].width/2
    desks=[p for p in assets['props'] if p.get('workstationRole')=='permanent-developer']
    polygons=[[(p['bounds']['x']+(x-crop[0])*scale,p['bounds']['y']+(y-crop[1])*scale) for x,y in corners] for p in desks]
    gaps=[]
    for a,b in zip(polygons,polygons[1:]):
        separations=[]
        for polygon in (a,b):
            for u,v in zip(polygon,polygon[1:]+polygon[:1]):
                nx,ny=-(v[1]-u[1]),v[0]-u[0];length=math.hypot(nx,ny)
                pa=[(x*nx+y*ny)/length for x,y in a];pb=[(x*nx+y*ny)/length for x,y in b]
                separations.append(max(min(pb)-max(pa),min(pa)-max(pb)))
        gap=max(separations)
        if gap<1:raise ValueError('Dot desktop separation is too small; resize before using candidate')
        gaps.append(gap)
    write_json(EVIDENCE/'packing-check.json',{'sourceHashesVerified':True,'newCharacterFrames':len(ledger),
               'prismWalkSEFrames':4,'forgeIdleViews':4,'novaIdleViews':4,'otherPrismFramesInherited':18,
               'mirroredNewFrames':0,'mapSha256':map_sha,'logicalMapChanged':False,
               'sourceDesktopLandmarks':corners,'desktopCrop':crop,'adjacentTabletopGapsLogicalPixels':gaps,
               'browserQA':False,'walkLoopAccepted':False,'layoutProposalReceived':False})
    assert hashlib.sha256((PUBLIC/'maps/floor1.tmj').read_bytes()).hexdigest()==map_sha
    print(json.dumps({'output':str(OUT),'newCharacterFrames':len(ledger),'mapChanged':False,'walkLoopAccepted':False}))


def compose_room(assets):
    """Recompose real exported props with one unchanged seated Prism pose."""
    canvas=Image.new('RGBA',(5120,2880),'#151d28')
    floor=assets['floor'];canvas.alpha_composite(Image.open(PUBLIC/floor['file'].lstrip('/')),(round(floor['x']*2),round(floor['y']*2)))
    env=json.loads((PUBLIC/'sprites/environment.json').read_text());sheet=Image.open(PUBLIC/'sprites/environment.png')
    actor=Image.open(PUBLIC/'visual-migration/illustrated-z08-v3/frames/prism_sit_type_se_0.png')
    layers=[(p['z'],p) for p in assets['props']]+[(29020,{'actor':True})]
    for _,p in sorted(layers,key=lambda p:p[0]):
        if p.get('actor'):
            x,y=1088+(17-12)*32,64+(17+12)*16
            canvas.alpha_composite(actor,(round(x*2-64),round(y*2-192*.92-12)));continue
        b=p['bounds']
        if p.get('file'):image=Image.open(PUBLIC/p['file'].lstrip('/')).convert('RGBA')
        else:
            f=env['frames'][p['sprite']]['frame'];image=sheet.crop((f['x'],f['y'],f['x']+f['w'],f['y']+f['h'])).resize((round(b['width']*2),round(b['height']*2)),Image.Resampling.NEAREST)
        canvas.alpha_composite(image,(round(b['x']*2),round(b['y']*2)))
    room=canvas.crop((1950,910,3010,1480)).convert('RGB')
    draw=ImageDraw.Draw(room);draw.rectangle((0,0,1060,20),fill='#151d28')
    draw.text((10,5),'OFFLINE DOT FURNITURE FIT - existing Z08 layout; NOT browser screenshot',fill='white')
    room.save(EVIDENCE/'dot-furniture-room-fit.png')


if __name__=='__main__':main()
