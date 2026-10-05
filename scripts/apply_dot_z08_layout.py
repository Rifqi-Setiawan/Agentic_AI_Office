"""Apply the human-approved Dot Z08 arrangement, including real interactions."""
from pathlib import Path
import copy
import hashlib
import json

ROOT=Path(__file__).resolve().parents[1]
MAP=ROOT/'frontend/public/maps/floor1.tmj'
ART=ROOT/'art/dot-z08-components-2026-10-05'
APPROVAL=ROOT/'docs/visual-migration/approved-layout-adjustments.json'
ID='z08-dot-gaming-layout'

def main():
    approvals=json.loads(APPROVAL.read_text())
    if any(a['id']==ID+'-guest' for a in approvals['adjustments']):
        print('Approved Z08 arrangement already applied; no mutation.')
        return
    before=MAP.read_bytes();doc=json.loads(before)
    (ART/'layout-before.tmj').write_bytes(before)
    original=copy.deepcopy(doc)
    layers={l['name']:l for l in doc['layers']}
    definitions=[
        {'id':ID+'-guest','slotId':'slot_z08_desk_guest',
         'slotFrom':{'gx':21,'gy':15,'facing':'SE'},'slotTo':{'gx':22,'gy':12,'facing':'NE'},
         'collisionChanges':[(22,15,125,0),(22,11,0,125)],
         'furnitureChanges':[(22,15,90,0),(20,15,15,0),(22,11,0,90)]},
        {'id':ID+'-seat-1','slotId':'slot_z08_pair_1',
         'slotFrom':{'id':'slot_z08_pair_1','gx':21,'gy':13,'type':'pair_stand','facing':'NW','anim':'stand_talk','y_offset':0},
         'slotTo':{'id':'slot_z08_gaming_1','gx':19,'gy':16,'type':'dev_gaming_seat','facing':'NE','anim':'game','y_offset':-4},
         'collisionChanges':[(22,13,125,0),(19,17,0,125),(20,17,0,125)],
         'furnitureChanges':[(22,13,49,15),(19,17,0,41),(20,17,0,41)]},
        {'id':ID+'-seat-2','slotId':'slot_z08_pair_2',
         'slotFrom':{'id':'slot_z08_pair_2','gx':21,'gy':17,'type':'pair_stand','facing':'NW','anim':'stand_talk','y_offset':0},
         'slotTo':{'id':'slot_z08_gaming_2','gx':20,'gy':16,'type':'dev_gaming_seat','facing':'NE','anim':'game','y_offset':-4},
         'collisionChanges':[(22,17,125,0),(20,14,0,125),(21,14,0,125)],
         'furnitureChanges':[(22,17,49,0),(20,14,0,38),(21,14,0,78)]},
    ]
    for change in definitions:
        obj=next(o for o in layers['slots']['objects'] if o['name']==change['slotId'])
        props={p['name']:p for p in obj['properties']}
        for k,v in change['slotFrom'].items():
            assert (obj['name'] if k=='id' else props[k]['value'])==v,(k,v)
        for k,v in change['slotTo'].items():
            if k=='id':obj['name']=v
            else:props[k]['value']=v
        for field,layer in [('collisionChanges','collision'),('furnitureChanges','furniture')]:
            details=[]
            for gx,gy,old,new in change[field]:
                assert 16<=gx<=23 and 10<=gy<=19
                index=gy*doc['width']+gx
                assert layers[layer]['data'][index]==old,(layer,gx,gy,old)
                layers[layer]['data'][index]=new
                details.append({'gx':gx,'gy':gy,'from':old,'to':new})
            change[field]=details
        change.update(date='2026-10-05',authorization='Human selected "Terapkan penataan baru dari Dot" in this chat; this authorizes replacing two standing desks with sofa/TV gaming interactions and relocating Guest within Z08.')
        approvals['adjustments'].append(change)
    for old,new in zip(original['layers'],doc['layers']):
        if old['name'] not in ('furniture','collision','slots'):assert old==new
        elif old['name']=='slots':
            changed=[o['id'] for o,n in zip(old['objects'],new['objects']) if o!=n]
            assert changed==[45,46,47]
        else:
            assert all((16<=i%44<=23 and 10<=i//44<=19) for i,(a,b) in enumerate(zip(old['data'],new['data'])) if a!=b)
    MAP.write_text(json.dumps(doc,indent=2)+'\n',encoding='utf-8')
    APPROVAL.write_text(json.dumps(approvals,indent=2)+'\n',encoding='utf-8')
    summary={'authorization':'Terapkan penataan baru dari Dot','beforeMapSha256':hashlib.sha256(before).hexdigest(),
             'afterMapSha256':hashlib.sha256(MAP.read_bytes()).hexdigest(),'changedObjectIds':[45,46,47],
             'adjustments':definitions,'boundsDoorsOtherRoomsUnchanged':True}
    (ART/'layout-delta.json').write_text(json.dumps(summary,indent=2)+'\n',encoding='utf-8')
    print(json.dumps({k:v for k,v in summary.items() if k!='adjustments'}))

if __name__=='__main__':main()
