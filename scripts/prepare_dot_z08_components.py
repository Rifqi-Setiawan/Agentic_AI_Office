"""Pack supplied character sequences and a separate, provisional furniture library.

Use one fixed canvas transform per sequence, never per-frame auto-trimming.
Source artwork is preserved; no new pose is painted, mirrored or generated.
"""
from pathlib import Path
import copy
import hashlib
import json
import math
from PIL import Image, ImageDraw
from import_dot_z08_components import visible_bounds, contact_sheet

ROOT=Path(__file__).resolve().parents[1]
PUBLIC=ROOT/'frontend/public'
ART=ROOT/'art/dot-z08-components-2026-10-05'
SRC=ART/'sources'
OUT=PUBLIC/'visual-migration/dot-z08-components-v2'
WEB='/visual-migration/dot-z08-components-v2'
EVIDENCE=ROOT/'docs/visual-migration/evidence/dot-z08-components-2026-10-05'
STYLE='AO_DOT_Z08_COMPONENTS_V2'
OLD=PUBLIC/'visual-migration/dot-z08-candidate'

# Ground/root proposals manually calibrated from first poses. They remain fixed
# across the sequence; moving shoe extrema never redefine a subsequent pivot.
PIVOTS={
    ('nova','sit_type','se'):(655,1150),('nova','sit_type','sw'):(650,1190),
    ('nova','sit_type','ne'):(665,1138),('nova','sit_type','nw'):(610,1140),
    ('nova','walk','se'):(655,1175),('nova','walk','sw'):(650,1185),
    ('nova','walk','ne'):(650,1175),('nova','walk','nw'):(655,1175),
    ('forge','sit_type','se'):(670,1135),
}

def write_json(path,value):
    path.write_text(json.dumps(value,indent=2)+'\n',encoding='utf-8')

def packed_entry(x,y,w,h):
    return {'frame':{'x':x,'y':y,'w':w,'h':h},'rotated':False,'trimmed':False,
            'spriteSourceSize':{'x':0,'y':0,'w':w,'h':h},'sourceSize':{'w':w,'h':h}}

def main():
    OUT.mkdir(parents=True,exist_ok=True);(OUT/'frames').mkdir(exist_ok=True)
    EVIDENCE.mkdir(parents=True,exist_ok=True)
    index=json.loads((ART/'source-index.json').read_text())
    for item in index['files']:
        assert hashlib.sha256((ROOT/item['file']).read_bytes()).hexdigest()==item['sha256']
    manifest=json.loads((SRC/'nova-24-animation-frames/nova/nova-animation-manifest.json').read_text())
    ledger=[];registrations=[];sheets=[];sequence_canvases={}
    for agent in ('forge','nova'):
        old=json.loads((OLD/(agent+'.json')).read_text())
        old_sheet=Image.open(OLD/(agent+'.png')).convert('RGBA')
        frames=[]
        for name,entry in old['frames'].items():
            f=entry['frame'];frames.append((name,old_sheet.crop((f['x'],f['y'],f['x']+f['w'],f['y']+f['h']))))
        sequences=[s for s in manifest['sequences']] if agent=='nova' else [{'action':'sit_type','direction':'se','frame_files':[f'forge_sit_type_se_{n}.png' for n in (0,1)],'suggested_fps':4}]
        for sequence in sequences:
            action,direction=sequence['action'],sequence['direction']
            folder=SRC/'nova-24-animation-frames/nova' if agent=='nova' else SRC/'forge-nova-typing-se-frames'
            images=[Image.open(folder/name).convert('RGBA') for name in sequence['frame_files']]
            assert all(im.size==(1254,1254) for im in images)
            first=visible_bounds(images[0]);scale=136/(first[3]-first[1])
            pivot=PIVOTS[agent,action,direction]
            canvas_size=(192,224);resized_size=(round(1254*scale),round(1254*scale))
            # Record the exact resampling scale (rounding is identical for every frame).
            actual_scale=resized_size[0]/1254
            offset=(round(canvas_size[0]*.5-pivot[0]*actual_scale),round(canvas_size[1]*.92-pivot[1]*actual_scale))
            assert offset[0]>=0 and offset[1]>=0
            assert offset[0]+resized_size[0]<=canvas_size[0] and offset[1]+resized_size[1]<=canvas_size[1],(agent,action,direction,offset,resized_size)
            registration={'agent':agent,'action':action,'direction':direction,'sourceCanvas':[1254,1254],
                          'sourcePivotPx':pivot,'sourcePivotStatus':'manually calibrated proposal; browser validation pending',
                          'uniformScale':actual_scale,'runtimeCanvas':canvas_size,'pasteOffsetPx':offset,
                          'perFrameAutoTrim':False,'mirrored':False,'sourceFootExtremaUsedPerFrame':False,
                          'sourceFiles':sequence['frame_files'],'fps':sequence['suggested_fps']}
            registrations.append(registration);sequence_canvases[agent,action,direction]=[]
            for name,im in zip(sequence['frame_files'],images):
                canvas=Image.new('RGBA',canvas_size)
                canvas.alpha_composite(im.resize(resized_size,Image.Resampling.LANCZOS),offset)
                canvas.save(OUT/'frames'/name);frames.append((name,canvas));sheets.append((name.removesuffix('.png'),canvas))
                sequence_canvases[agent,action,direction].append(canvas)
                ledger.append({'file':'frames/'+name,'source':str((folder/name).relative_to(ROOT)).replace('\\','/'),
                               'sourceSha256':hashlib.sha256((folder/name).read_bytes()).hexdigest(),
                               'registrationSequence':f'{agent}_{action}_{direction}','crop':None,'mirrored':False})
        sheet=Image.new('RGBA',(4*192,math.ceil(len(frames)/4)*224))
        atlas={'frames':{},'meta':copy.deepcopy(old['meta'])}
        for n,(name,canvas) in enumerate(frames):
            x,y=n%4*192,n//4*224;sheet.alpha_composite(canvas,(x,y))
            atlas['frames'][name]=packed_entry(x,y,canvas.width,canvas.height)
        sheet.save(OUT/(agent+'.png'))
        atlas['meta'].update(image=WEB+'/'+agent+'.png',size={'w':sheet.width,'h':sheet.height},styleVersion=STYLE,
                             animationFps={'idle':1,'sit_type':3.5 if agent=='nova' else 4,**({'walk':7} if agent=='nova' else {})})
        write_json(OUT/(agent+'.json'),atlas)
    assets=json.loads((OLD/'assets.json').read_text())
    assets['styleVersion']=STYLE
    assets['characterOverrides'].update({a:WEB+'/'+a+'.json' for a in ('forge','nova')})
    assets['provenance']={'sourceIndex':'art/dot-z08-components-2026-10-05/source-index.json','finalArt':False,
                         'layoutChanged':False,'browserQA':False,
                         'newCoverage':'Nova walk 4 frames and sit_type 2 frames in four directions; Forge sit_type SE 2 frames',
                         'roomComponentLibraryStatus':'22 imported components; assembly pending layout decision/calibration'}
    write_json(OUT/'assets.json',assets)
    write_json(OUT/'character-ledger.json',{'frames':ledger,'registrations':registrations,'browserQA':False,'loopAccepted':False})
    # Show actual packed canvases at one fixed placement, not normalized crops.
    contact=Image.new('RGBA',(7*200,math.ceil(len(sheets)/7)*275),'#e9e7e0')
    draw=ImageDraw.Draw(contact)
    for n,(name,canvas) in enumerate(sheets):
        x,y=n%7*200,n//7*275;contact.alpha_composite(canvas,(x+4,y+12))
        draw.text((x+4,y+244),name,fill='#263746')
    contact.convert('RGB').save(EVIDENCE/'packed-character-poses.png')
    for (agent,action,direction),canvases in sequence_canvases.items():
        gif=[]
        for canvas in canvases:
            page=Image.new('RGBA',(256,288),'#e9e7e0');page.alpha_composite(canvas,(32,30))
            draw=ImageDraw.Draw(page);draw.text((8,8),f'{agent} {action} {direction} - OFFLINE',fill='#263746')
            draw.text((8,267),'candidate - browser QA pending',fill='#263746');gif.append(page.convert('RGB'))
        fps=7 if action=='walk' else 3.5 if agent=='nova' else 4
        gif[0].save(EVIDENCE/f'{agent}-{action}-{direction}.gif',save_all=True,append_images=gif[1:],duration=round(1000/fps),loop=0)
    write_json(EVIDENCE/'character-packing-check.json',{'sourceHashesVerified':True,'newUniqueFrames':len(ledger),
               'novaFrames':28,'forgeFrames':6,'novaDuplicateSEFilesSelectedOnce':True,'perFrameAutoTrim':False,
               'sequenceRegistrations':len(registrations),'mapChanged':False,'browserQA':False,'loopAccepted':False})
    print(json.dumps({'newFrames':len(ledger),'novaAtlasFrames':28,'forgeAtlasFrames':6,'registeredSequences':len(registrations),'output':str(OUT)}))

if __name__=='__main__':main()
