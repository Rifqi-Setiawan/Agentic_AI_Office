"""Assemble the approved Z08 room from supplied component artwork.

Only geometric registration, uniform scaling and source-pixel layer partitions.
No painting, pixel recoloring, character generation or browser screenshot claims.
"""
from pathlib import Path
import copy
import hashlib
import json
from PIL import Image, ImageDraw, ImageChops
from import_dot_z08_components import visible_bounds
from prepare_dot_z08_components import ROOT, PUBLIC, ART, SRC, OUT, WEB, EVIDENCE, OLD, STYLE

WIDTHS={
 'Z08-worker-desk':80,'Z08-worker-chair-SE':40,'Z08-guest-desk':60,'Z08-guest-chair-NE':36,
 'sofa-charcoal-facing-tv':100,'media-cabinet-low-oak':90,'tv-multiplayer-screen':85,
 'console-playstation5-white-black':16,'controller-dualsense-white-black':12,'rug-muted-teal':180,
 'Z08-architecture-board':50,'Z08-kanban-board':48,'Z08-framed-code-art':25,
 'Z08-oak-wall-shelf':50,'Z08-desktop-plant':14,
 'wall-low-fall-right':36,'wall-low-rise-right':36,
 'wall-tall-fall-right':144,'wall-tall-rise-right':144,
 'doorframe-open-fall-right':52,'pillar-corner-cyan':10,'floor-oak-z08':576,
}

def write_json(path,data):
    path.write_text(json.dumps(data,indent=2)+'\n',encoding='utf-8')

def world(gx,gy):
    return 1088+(gx-gy)*32,64+(gx+gy)*16

def solve(matrix,rhs):
    a=[list(map(float,row))+[float(y)] for row,y in zip(matrix,rhs)]
    for col in range(len(a)):
        pivot=max(range(col,len(a)),key=lambda row:abs(a[row][col]));a[col],a[pivot]=a[pivot],a[col]
        v=a[col][col];assert abs(v)>1e-12
        a[col]=[x/v for x in a[col]]
        for row in range(len(a)):
            if row==col:continue
            factor=a[row][col];a[row]=[x-factor*y for x,y in zip(a[row],a[col])]
    return [row[-1] for row in a]

def diamond_corners(im):
    mask=im.getchannel('A').point(lambda value:255 if value>128 else 0)
    box=mask.getbbox();assert box
    # Extreme opaque rows/columns locate the four native panel corners.
    def midpoint(b):return ((b[0]+b[2]-1)/2,(b[1]+b[3]-1)/2)
    top=mask.crop((0,box[1],im.width,box[1]+1)).getbbox()
    bottom=mask.crop((0,box[3]-1,im.width,box[3])).getbbox()
    left=mask.crop((box[0],0,box[0]+1,im.height)).getbbox()
    right=mask.crop((box[2]-1,0,box[2],im.height)).getbbox()
    return [(midpoint(top)[0],box[1]),(box[2]-1,midpoint(right)[1]),(midpoint(bottom)[0],box[3]-1),(box[0],midpoint(left)[1])]

def project_ground(component,gx0,gy0,gx1,gy1,name):
    im=Image.open(ROOT/component['source']).convert('RGBA');native=diamond_corners(im)
    target=[world(gx0,gy0),world(gx1,gy0),world(gx1,gy1),world(gx0,gy1)]
    x0=min(x for x,y in target);y0=min(y for x,y in target)
    points=[((x-x0)*2,(y-y0)*2) for x,y in target]
    width=round((max(x for x,y in target)-x0)*2);height=round((max(y for x,y in target)-y0)*2)
    matrix=[];rhs=[]
    for (x,y),(u,v) in zip(points,native):
        matrix.extend([[x,y,1,0,0,0,-u*x,-u*y],[0,0,0,x,y,1,-v*x,-v*y]]);rhs.extend([u,v])
    coefficients=solve(matrix,rhs)
    output=im.transform((width,height),Image.Transform.PERSPECTIVE,coefficients,Image.Resampling.BICUBIC)
    mask=Image.new('L',output.size);ImageDraw.Draw(mask).polygon(points,fill=255)
    output=Image.composite(output,Image.new('RGBA',output.size),mask)
    output.save(OUT/'components'/name)
    return {'file':WEB+'/components/'+name,'bounds':{'x':x0,'y':y0,'width':width/2,'height':height/2},
            'sourceCorners':native,'worldCorners':target,'method':'four-corner perspective registration to unchanged logical grid'}

def partition(component,polygons,prefix):
    im=Image.open(OUT/'components'/component['packedFile']).convert('RGBA')
    mask=Image.new('L',im.size);draw=ImageDraw.Draw(mask)
    crop=component['crop'];scale=component['rasterScale']
    for polygon in polygons:
        draw.polygon([((x-crop[0])*scale,(y-crop[1])*scale) for x,y in polygon],fill=255)
    front=Image.composite(im,Image.new('RGBA',im.size),mask)
    rear=Image.composite(im,Image.new('RGBA',im.size),ImageChops.invert(mask))
    composite=Image.alpha_composite(rear,front)
    assert ImageChops.difference(composite.getchannel('A'),im.getchannel('A')).getbbox() is None
    for channel in range(3):
        delta=ImageChops.difference(composite.getchannel(channel),im.getchannel(channel))
        assert ImageChops.multiply(delta,im.getchannel('A')).getbbox() is None
    rear.save(OUT/'components'/f'{prefix}-rear.png');front.save(OUT/'components'/f'{prefix}-front.png')
    return {'rear':WEB+f'/components/{prefix}-rear.png','front':WEB+f'/components/{prefix}-front.png',
            'sourcePolygons':polygons,'visiblePixelsAndAlphaPartitionVerified':True}

def main():
    (OUT/'components').mkdir(exist_ok=True)
    index=json.loads((ART/'source-index.json').read_text())
    proposals=json.loads((SRC/'Z08-01-workstations-components/component-manifest.json').read_text())
    components={}
    for asset in proposals['assets']:
        item=next(f for f in index['files'] if f['entry']==asset['file'] and f['entry'].endswith('.png'))
        source=ROOT/item['file'];im=Image.open(source).convert('RGBA');box=visible_bounds(im)
        crop=(max(0,box[0]-6),max(0,box[1]-6),min(im.width,box[2]+6),min(im.height,box[3]+6))
        image=im.crop(crop);width=round(WIDTHS[asset['id']]*2);scale=width/image.width
        image=image.resize((width,round(image.height*scale)),Image.Resampling.LANCZOS)
        filename=asset['id']+'.png';image.save(OUT/'components'/filename)
        pivot=asset['anchorProposalPx'] or [(box[0]+box[2])/2,box[3]-1]
        components[asset['id']]={'source':item['file'],'sourceSha256':item['sha256'],'crop':crop,
            'packedFile':filename,'rasterSize':list(image.size),'rasterScale':scale,
            'pivotRaster':[(pivot[0]-crop[0])*scale,(pivot[1]-crop[1])*scale],
            'pivotSourceProposal':pivot,'pivotStatus':'candidate registration; browser QA pending',
            'sourceAnchorWasNull':asset['anchorProposalPx'] is None}
    # Always assemble from the immutable preceding version, never our own output.
    assets=json.loads((OLD/'assets.json').read_text())
    assets['styleVersion']=STYLE
    assets['characterOverrides'].update({a:WEB+'/'+a+'.json' for a in ('forge','nova')})
    assets['provenance']={'sourceIndex':'art/dot-z08-components-2026-10-05/source-index.json','finalArt':False,
        'newCoverage':'Nova walk 4 and sit_type 2 frames per direction; Forge sit_type SE 2 frames',
        'missingActions':'Forge walk, Forge other typing directions, other actions remain baseline.'}
    def prop(kind,id,gx,gy,z=None,offset=(0,0)):
        c=components[kind];x,y=world(gx,gy);w,h=c['rasterSize'];px,py=c['pivotRaster']
        return {'id':id,'sprite':kind+'.png','gx':gx,'gy':gy,'x':x,'y':y,'z':round((gx+gy)*1000)+10 if z is None else z,
                'bounds':{'x':x+offset[0]-px/2,'y':y+offset[1]-py/2,'width':w/2,'height':h/2},
                'file':WEB+'/components/'+c['packedFile'],'artKind':'dot-supplied-component-candidate','componentId':kind,'zone':'Z08'}
    # Historical Guest/standing furniture is replaced in art and map together.
    removed={'furniture-594-standing','furniture-770-standing','furniture-682-hotdesk-se','furniture-680-chair-se'}
    assets['props']=[p for p in assets['props'] if p['id'] not in removed]
    worker_partition=partition(components['Z08-worker-desk'],[
        [(305,493),(541,635),(1269,285),(1536,285),(1536,1024),(0,1024),(0,493)],
        [(305,493),(1040,152),(1269,285),(541,635)],
        [(674,260),(1037,87),(1037,288),(674,447)],[(777,419),(964,350),(964,428),(866,456)]
    ],'worker-desk')
    additions=[]
    for p in assets['props']:
        if p.get('workstationRole')=='permanent-developer':
            q=prop('Z08-worker-desk',p['id'],p['gx'],p['gy'],p['z'],p['visualOffset'])
            p.update(bounds=q['bounds'],file=worker_partition['front'],artKind=q['artKind'],componentId=q['componentId'],zone='Z08')
            rear=copy.deepcopy(p);rear['id']+='-rear';rear.pop('workstationRole',None)
            rear['file']=worker_partition['rear'];rear['z']=p['z']-1100;additions.append(rear)
        elif p['id'] in ('furniture-546-chair-se','furniture-634-chair-se','furniture-722-chair-se'):
            q=prop('Z08-worker-chair-SE',p['id'],p['gx'],p['gy'],p['z'],p['visualOffset'])
            p.update(bounds=q['bounds'],file=q['file'],artKind=q['artKind'],componentId=q['componentId'],zone='Z08')
        elif '-low-wall' in p['id'] and 16<=p.get('gx',-1)<=23 and 10<=p.get('gy',-1)<=19:
            kind='wall-low-rise-right' if p['sprite']=='wall_back_nw.png' else 'wall-low-fall-right'
            q=prop(kind,p['id'],p['gx'],p['gy'],p['z'])
            p.update(bounds=q['bounds'],file=q['file'],artKind=q['artKind'],componentId=kind,zone='Z08')
    assets['props']+=additions
    # Guest keeps a genuine NE desk/chair and a reachable north-side seat.
    assets['props'] += [prop('Z08-guest-desk','dot-z08-guest-desk',22,11.2,34200),
                         prop('Z08-guest-chair-NE','dot-z08-guest-chair',22,12.25,33660)]
    sofa=prop('sofa-charcoal-facing-tv','dot-z08-sofa-rear',19.5,16.5,35010)
    sofa_partition=partition(components['sofa-charcoal-facing-tv'],[
        [(333,220),(897,565),(897,868),(333,532)],[(918,648),(1267,449),(1267,776),(918,940)]
    ],'sofa')
    sofa['file']=sofa_partition['rear'];front=copy.deepcopy(sofa);front.update(id='dot-z08-sofa-front',z=36030,file=sofa_partition['front'])
    assets['props'] += [sofa,front,prop('media-cabinet-low-oak','dot-z08-media-cabinet',20.5,14,34510),
                         prop('tv-multiplayer-screen','dot-z08-tv',20.5,14,34515,(0,-15)),
                         prop('console-playstation5-white-black','dot-z08-console',20.5,14,34520,(30,-15)),
                         prop('controller-dualsense-white-black','dot-z08-controller-1',20.5,14,34525,(-21,-13)),
                         prop('controller-dualsense-white-black','dot-z08-controller-2',20.5,14,34525,(8,-11))]
    ground=[]
    for kind,name,bounds,z in [('floor-oak-z08','registered-z08-floor.png',(15.5,9.5,23.5,19.5),1),
                               ('rug-muted-teal','registered-gaming-rug.png',(18.3,13.3,22,17.9),2)]:
        result=project_ground(components[kind],*bounds,name);ground.append({'component':kind,**result})
        assets['props'].append({'id':'dot-z08-'+kind,'sprite':kind+'.png','gx':20,'gy':15,'x':1248,'y':624,'z':z,
                                'file':result['file'],'bounds':result['bounds'],'artKind':'registered-ground','componentId':kind,'zone':'Z08'})
    # Back wall plane along the unchanged west boundary; source lengths stay uniform.
    assets['props'] += [prop('wall-tall-rise-right','dot-z08-west-wall-1',15.5,12.05,27558),
                         prop('wall-tall-rise-right','dot-z08-west-wall-2',15.5,16.55,32058),
                         prop('wall-tall-fall-right','dot-z08-north-feature-wall',21.55,9.5,31008)]
    for kind,gx,gy,offset in [('Z08-kanban-board',15.55,11.1,(0,-25)),
                             ('Z08-architecture-board',15.55,13.15,(0,-25)),
                             ('Z08-framed-code-art',15.55,15.15,(0,-21)),
                             ('Z08-oak-wall-shelf',15.55,17.15,(0,-22)),
                             ('Z08-desktop-plant',22,11.2,(20,-24))]:
        wall_depth=27558 if gy<14.3 else 32058
        depth=max(round((gx+gy)*1000)+9,wall_depth+1) if kind!='Z08-desktop-plant' else 34201
        assets['props'].append(prop(kind,'dot-z08-'+kind,gx,gy,depth,offset))
    # Door modules stay on real openings. Independent posts handle the other axis.
    jamb_ids=[p['id'] for p in assets['props'] if 'jamb' in p['id'] and (p.get('gx'),p.get('gy')) in [(19,10),(19,19),(23,14)]]
    assets['props']=[p for p in assets['props'] if p['id'] not in jamb_ids]
    assets['props'] += [prop('doorframe-open-fall-right','dot-z08-door-north',19,10,29030),
                         prop('doorframe-open-fall-right','dot-z08-door-south',19,19,38030),
                         prop('pillar-corner-cyan','dot-z08-door-east-back',23,14,36655,(-15,7.5)),
                         prop('pillar-corner-cyan','dot-z08-door-east-front',23,14,37405,(15,-7.5))]
    assets['props'].sort(key=lambda p:(p['z'],p['id']))
    assert len({p['id'] for p in assets['props']})==len(assets['props']),'Duplicate scene component IDs'
    assets['logicalMapSha256']=hashlib.sha256((PUBLIC/'maps/floor1.tmj').read_bytes()).hexdigest()
    assets['provenance'].update(layoutChanged=True,layoutAuthorization='Human: Terapkan penataan baru dari Dot',
        roomComponentLibraryStatus='22 components packed; approved layout assembled as local candidate',
        browserQA=False,sourceDocumentClaimsAreNotUserApproval=True)
    write_json(OUT/'assets.json',assets)
    used={p.get('componentId') for p in assets['props'] if p.get('zone')=='Z08'}
    write_json(OUT/'component-ledger.json',{'components':components,'usedComponentIds':sorted(used),
        'partitions':{'workerDesk':worker_partition,'sofa':sofa_partition},'groundRegistrations':ground,'browserQA':False})
    write_json(EVIDENCE/'room-packing-check.json',{'packedComponents':len(components),'usedComponents':len(used),
        'retiredStandingProps':sorted(removed),'retiredDoorJambProps':jamb_ids,'sourcePixelPartitionsVerified':True,
        'floorWorldCorners':ground[0]['worldCorners'],'logicalMapSha256':assets['logicalMapSha256'],'browserQA':False})
    compose(assets)
    print(json.dumps({'packedComponents':len(components),'usedComponents':len(used),'props':len(assets['props']),'mapSha256':assets['logicalMapSha256']}))

def compose(assets):
    canvas=Image.new('RGBA',(5120,2880),'#151d28')
    floor=assets['floor'];canvas.alpha_composite(Image.open(PUBLIC/floor['file'].lstrip('/')),(round(floor['x']*2),round(floor['y']*2)))
    env=json.loads((PUBLIC/'sprites/environment.json').read_text());env_image=Image.open(PUBLIC/'sprites/environment.png')
    actors=[]
    for agent,gy in [('prism',12),('forge',14),('nova',16)]:
        atlas=json.loads((PUBLIC/assets['characterOverrides'][agent].lstrip('/')).read_text())
        f=atlas['frames'][f'{agent}_sit_type_se_0.png']['frame'];sheet=Image.open(PUBLIC/atlas['meta']['image'].lstrip('/'))
        image=sheet.crop((f['x'],f['y'],f['x']+f['w'],f['y']+f['h']))
        x,y=world(17,gy);actors.append(((17+gy)*1000+20,{'actor':image,'x':x,'y':y-6}))
    for _,p in sorted([(p['z'],p) for p in assets['props']]+actors,key=lambda item:item[0]):
        if 'actor' in p:
            image=p['actor'];canvas.alpha_composite(image,(round(p['x']*2-image.width*.5),round(p['y']*2-image.height*.92)))
            continue
        b=p['bounds']
        if p.get('file'):im=Image.open(PUBLIC/p['file'].lstrip('/')).convert('RGBA')
        else:
            f=env['frames'][p['sprite']]['frame'];im=env_image.crop((f['x'],f['y'],f['x']+f['w'],f['y']+f['h'])).resize((round(b['width']*2),round(b['height']*2)),Image.Resampling.NEAREST)
        canvas.alpha_composite(im,(round(b['x']*2),round(b['y']*2)))
    room=canvas.crop((1840,640,3120,1540)).convert('RGB')
    draw=ImageDraw.Draw(room);draw.rectangle((0,0,1280,22),fill='#151d28')
    draw.text((10,6),'OFFLINE ASSET COMPOSITION - three seated poses; NOT browser screenshot',fill='white')
    room.save(EVIDENCE/'z08-room-candidate.png')

if __name__=='__main__':main()
