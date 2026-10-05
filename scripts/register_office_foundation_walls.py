"""Register supplied W01/W02 PNGs as modular CSS wall planes.

No PNG pixel editing, painting, regeneration or mirroring. Each original PNG is
copied byte-for-byte, and its front/cap/end planes are projected by the renderer.
Map, furniture, actors and historical manifests remain unchanged.
"""
from pathlib import Path
import copy
import hashlib
import json
import math
import shutil
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
PUBLIC = ROOT / 'frontend/public'
INTAKE = ROOT / 'art/environment-foundation-2026-10-05/intake/W01-W02-r01'
OUT = PUBLIC / 'visual-migration/environment-foundation-v1'
WEB = '/visual-migration/environment-foundation-v1'
BEFORE = PUBLIC / 'visual-migration/dot-z08-components-v2/assets.json'
SOURCES = {
    'W01': dict(name='W01-wall-tall-r-1u.png', download='Isometric Blue-Gray Wall Panel.png', axis='R',
                quads={'front': [[198,211],[991,668],[991,1132],[195,631]],
                       'cap': [[198,211],[991,668],[1061,627],[271,168]],
                       'end': [[991,668],[1061,627],[1065,1082],[991,1132]]}),
    'W02': dict(name='W02-wall-tall-l-1u.png', download='Isometric Blue-Gray Wall Panel (1).png', axis='L',
                quads={'front': [[1117,212],[247,704],[247,1157],[1117,665]],
                       'cap': [[1117,212],[247,704],[181,673],[1051,178]],
                       'end': [[247,704],[181,673],[177,1113],[247,1157]]}),
}


def dump(path, value):
    path.write_text(json.dumps(value, indent=2)+'\n', encoding='utf-8')


def solve(matrix, rhs):
    rows = [list(map(float,row))+[float(value)] for row,value in zip(matrix,rhs)]
    for col in range(len(rows)):
        pivot = max(range(col,len(rows)),key=lambda r:abs(rows[r][col]))
        rows[col],rows[pivot] = rows[pivot],rows[col]
        scale = rows[col][col]
        assert abs(scale)>1e-12
        rows[col] = [v/scale for v in rows[col]]
        for r in range(len(rows)):
            if r == col: continue
            factor = rows[r][col]
            rows[r] = [v-factor*p for v,p in zip(rows[r],rows[col])]
    return [row[-1] for row in rows]


def affine(source, target):
    matrix=[];rhs=[]
    for (x,y),(u,v) in zip(source,target):
        matrix.extend([[x,y,1,0,0,0], [0,0,0,x,y,1]])
        rhs.extend([u,v])
    a,b,c,d,e,f = solve(matrix,rhs)
    return [a,d,b,e,c,f]


def project(matrix, point):
    x,y=point
    return [matrix[0]*x+matrix[2]*y+matrix[4],
            matrix[1]*x+matrix[3]*y+matrix[5]]


def world(gx,gy):
    return [1088+(gx-gy)*32,64+(gx+gy)*16]


def registration(code, length=1, end=True):
    direction=1 if code=='W01' else -1
    dx=direction*32*length;dy=16*length;t=direction*4
    targets={
        'front': [[0,-80],[dx,dy-80],[dx,dy],[0,0]],
        'cap': [[0,-80],[dx,dy-80],[dx+t,dy-82],[t,-82]],
        'end': [[dx,dy-80],[dx+t,dy-82],[dx+t,dy-2],[dx,dy]],
    }
    x0=min(0,dx,dx+t,t)-1;y0=-83
    width=max(0,dx,dx+t,t)-x0+1;height=dy-y0+1
    layers=[];checks=[]
    for plane in ['cap','front']+(['end'] if end else []):
        source=SOURCES[code]['quads'][plane]
        target=[[x-x0,y-y0] for x,y in targets[plane]]
        # Affine triangles avoid 3D/filter overflow and register all four corners.
        for part,indices in enumerate([(0,1,2),(0,2,3)]):
            src=[source[i] for i in indices];dst=[target[i] for i in indices]
            matrix=affine(src,dst)
            error=max(math.dist(project(matrix,p),q) for p,q in zip(src,dst))
            assert error<1e-6
            assert matrix[0]*matrix[3]-matrix[1]*matrix[2]>0, 'No source reflection'
            # Overlap only the internal diagonal by 0.35 screen px. The outer
            # prop silhouette clips extrapolated margins, leaving no white seam.
            sx,sy=source[2][0]-source[0][0],source[2][1]-source[0][1]
            sl=math.hypot(sx,sy);nx,ny=-sy/sl,sx/sl
            tx,ty=target[2][0]-target[0][0],target[2][1]-target[0][1]
            tl=math.hypot(tx,ty);tnx,tny=-ty/tl,tx/tl
            factor=abs((matrix[0]*nx+matrix[2]*ny)*tnx+(matrix[1]*nx+matrix[3]*ny)*tny)
            third=source[1] if part==0 else source[3]
            sign=-1 if (third[0]-source[0][0])*nx+(third[1]-source[0][1])*ny>0 else 1
            overlap=sign*.35/factor
            expanded=[[point[0]+nx*overlap,point[1]+ny*overlap] for point in [source[0],source[2]]]
            clip=[source[0],source[1],source[2],expanded[1],expanded[0]] if part==0 else [expanded[0],expanded[1],source[2],source[3],source[0]]
            layers.append(dict(id=f'{plane}-{part}',width=1254,height=1254,
                               clipPath='polygon('+','.join(f'{x}px {y}px' for x,y in clip)+')',
                               matrix=matrix))
            checks.append(dict(plane=f'{plane}-{part}',sourceTriangle=src,targetTriangle=dst,maxCornerError=error))
    silhouette=[[0,0],[dx,dy],[dx+t,dy-2],[dx+t,dy-82],[t,-82],[0,-80]]
    clip_path='polygon('+','.join(f'{x-x0}px {y-y0}px' for x,y in silhouette)+')'
    return dict(offset=[x0,y0],width=width,height=height,layers=layers,clipPath=clip_path,
                checks=checks,lengthTiles=length,wallHeight=80,capOffset=[t,-2])


def main():
    INTAKE.mkdir(parents=True,exist_ok=True);OUT.mkdir(exist_ok=True)
    index=[]
    for code,source in SOURCES.items():
        downloaded=Path('C:/Users/Rifqi/Downloads')/source['download'];stored=INTAKE/source['name']
        if not stored.exists(): shutil.copyfile(downloaded,stored)
        with Image.open(stored) as im:
            assert im.size==(1254,1254) and im.mode=='RGBA'
        sha=hashlib.sha256(stored.read_bytes()).hexdigest()
        shutil.copyfile(stored,OUT/source['name'])
        assert hashlib.sha256((OUT/source['name']).read_bytes()).hexdigest()==sha
        index.append(dict(assetId=code,axis=source['axis'],source=stored.relative_to(ROOT).as_posix(),
                          sourceSha256=sha,file=WEB+'/'+source['name'],nativeCanvas=[1254,1254],
                          sourceCopiedByteIdentical=True,mirrored=False))
    dump(INTAKE/'source-index.json',index)
    before=json.loads(BEFORE.read_text());assets=copy.deepcopy(before)
    assets['styleVersion']='AO_DOT_ENVIRONMENT_FOUNDATION_V1'
    ledger=[]

    def wall(p,code,gx,gy,length=1,end=True):
        reg=registration(code,length,end)
        # Centered along the original wall's ground axis, not its transparent PNG canvas.
        start=world(gx-length/2,gy) if code=='W01' else world(gx,gy-length/2)
        q=copy.deepcopy(p)
        q.update(bounds=dict(x=start[0]+reg['offset'][0],y=start[1]+reg['offset'][1],
                             width=reg['width'],height=reg['height']),
                 file=WEB+'/'+SOURCES[code]['name'],artKind='registered-foundation-wall',
                 componentId=code,artLayers=reg['layers'],artClipPath=reg['clipPath'])
        ledger.append(dict(id=q['id'],assetId=code,sourcePropId=p.get('sourcePropId',p['id']),
                           axis=SOURCES[code]['axis'],center=[gx,gy],worldStart=start,
                           bounds=q['bounds'],registration=reg))
        return q

    straight={'wall_back_ne.png':'W01','wall_back_nw.png':'W02'}
    cells={(p['gx'],p['gy'],p['sprite']) for p in before['props']
           if p['sprite'] in straight and not p.get('componentId') and '-low-wall' not in p['id']}
    props=[];retired=[]
    for p in before['props']:
        if p['sprite'] in straight and (p['gx'],p['gy'],p['sprite']) in cells and not p.get('componentId'):
            code=straight[p['sprite']]
            next_cell=(p['gx']+1,p['gy'],p['sprite']) if code=='W01' else (p['gx'],p['gy']+1,p['sprite'])
            props.append(wall(p,code,p['gx'],p['gy'],end=next_cell not in cells))
        elif p['id'] in ['dot-z08-west-wall-1','dot-z08-west-wall-2','dot-z08-north-feature-wall']:
            retired.append(p['id'])
            if 'west-wall' in p['id']:
                code='W02';start=p['gy']-2.25;span=4.5
            else:
                # Stop at the north doorway's right jamb and the existing zone corner.
                code='W01';start=19.5;span=4.0
            count=math.ceil(span)
            for i in range(count):
                length=min(1,span-i);center=start+i+length/2
                q=copy.deepcopy(p);q.update(id=p['id']+f'-module-{i+1}',sourcePropId=p['id'])
                gx,gy=(p['gx'],center) if code=='W02' else (center,p['gy'])
                q.update(gx=gx,gy=gy,x=world(gx,gy)[0],y=world(gx,gy)[1])
                # Existing group depth keeps its wall-mounted components in front.
                props.append(wall(q,code,gx,gy,length,end=code=='W01' and i==count-1 or code=='W02' and p['id'].endswith('2') and i==count-1))
        else: props.append(copy.deepcopy(p))
    assets['props']=sorted(props,key=lambda p:(p['z'],p['id']))
    assert len({p['id'] for p in props})==len(props)
    assets['provenance']=dict(assets.get('provenance',{}),foundationStage='W01/W02 local installation trial',
                              previousManifest='/visual-migration/dot-z08-components-v2/assets.json',
                              wallSourceIndex='art/environment-foundation-2026-10-05/intake/W01-W02-r01/source-index.json',
                              registrationMethod='front/cap/end CSS affine triangles; unedited source PNGs',
                              finalArt=False,browserQA=False,logicalLayoutChanged=False)
    assert assets['floor']==before['floor'] and assets['characterOverrides']==before['characterOverrides']
    assert assets['logicalMapSha256']==hashlib.sha256((PUBLIC/'maps/floor1.tmj').read_bytes()).hexdigest()
    dump(OUT/'assets.json',assets)
    dump(OUT/'registration-ledger.json',dict(sources=index,walls=ledger,retiredLongWallProps=retired,
                                            heightLogical=80,projection='2:1 dimetric',sourcePixelsEdited=False,
                                            logicalLayoutChanged=False,browserQA=False))
    counts={code:sum(item['assetId']==code for item in ledger) for code in SOURCES}
    print(json.dumps(dict(wallModules=len(ledger),counts=counts,props=len(props),retiredLongWallProps=retired,
                          sourcePNGsByteIdentical=True,mapUnchanged=True,browserQA=False)))


if __name__=='__main__': main()
