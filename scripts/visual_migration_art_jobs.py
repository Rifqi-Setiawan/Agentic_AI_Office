"""Map-derived 2D illustration scope and honest candidate coverage. No Blender jobs."""
import argparse
import hashlib
import json
import re
from pathlib import Path
from visual_migration_contract import canonical

ROOT=Path(__file__).resolve().parents[1]
DOCS=ROOT/'docs/visual-migration'
DIRECTIONS=('se','sw','ne','nw')
ACTIONS=('idle','walk','sit_type','stand_talk','celebrate','pray_berdiri','pray_rukuk',
         'pray_sujud','pray_duduk','drink','swim','game','whiteboard','special')

def build_jobs():
    path=ROOT/'frontend/public/maps/floor1.tmj'
    layout=canonical(json.loads(path.read_text()))
    roster=re.findall(r"id: '([^']+)'",(ROOT/'frontend/src/world/simulation/roster.ts').read_text())
    return {'schemaVersion':2,'styleVersion':'AO_ILLUSTRATED_2D_Z08_V2','finalArt':False,
      'productionMethod':'built-in imagegen, mechanical sprite packing, React/CSS composition',
      'supersedes':'Blender/native-render/2312-frame production requirement; historical files retained',
      'batchAllowed':False,'batchGate':'User visual approval of Z08 checkpoint required',
      'projection':{'tileWidth':64,'tileHeight':32,'origin':[1088,64],'world':[2560,1440],'exportScale':2},
      'mapSha256':hashlib.sha256(path.read_bytes()).hexdigest(),'directions':list(DIRECTIONS),
      'requiredActions':list(ACTIONS),'framePolicy':'Visible motion at usage size; no fixed total/minimum frame batch',
      'characters':[{'id':cid,'identitySource':'docs/blueprint/03-character-design-spec.md',
                     'status':'Prism slice candidate; remaining actions pending' if cid=='prism' else 'pending style checkpoint',
                     'requiredActions':list(ACTIONS)} for cid in roster],
      'zones':[{'zone':z,'slots':[s for s in layout['slots'] if s.get('zone')==z['zone_id']],
                'doors':[d for d in layout['doors'] if z['zone_id'] in (d.get('from'),d.get('to'))],
                'status':'illustrated slice candidate' if z['zone_id']=='Z08' else 'baseline art; batch not authorized',
                'layers':['floor','low cutaway wall pieces','furniture rear/front','open jambs','characters']}
               for z in layout['zones']],
      'corridors':{'rows':[8,9,20,21],'allColumns':44,'mustRemainWalkable':True},
      'releaseGates':['user style checkpoint approval','all identities/actions reviewed','all zone layers verified',
                     'browser motion/occlusion/interaction checks','real provenance/freshness/redaction retained']}

def coverage(jobs):
    candidate=ROOT/'frontend/public/visual-migration/illustrated-z08-v2/prism.json'
    frames=json.loads(candidate.read_text())['frames'] if candidate.exists() else {}
    return {'finalArtReady':False,'styleApprovedByUser':False,'browserQAPassed':False,
       'note':'Counts describe packed candidate poses, not accepted animation or release art.',
       'prismCandidate':{action:{direction:len([n for n in frames if n.startswith(f'prism_{action}_{direction}_')])
                               for direction in DIRECTIONS} for action in ACTIONS},
       'pendingCharacters':[c['id'] for c in jobs['characters'] if c['id']!='prism'],
       'pendingZones':[z['zone']['zone_id'] for z in jobs['zones'] if z['zone']['zone_id']!='Z08'],
       'walkLoop':'two illustrated poses per direction; opposite-leg phase and browser acceptance pending'}

def main():
    parser=argparse.ArgumentParser();parser.add_argument('--preview',action='store_true');args=parser.parse_args()
    jobs=build_jobs();report=coverage(jobs)
    (DOCS/'art-jobs.json').write_text(json.dumps(jobs,indent=2),encoding='utf-8')
    (DOCS/'art-coverage.json').write_text(json.dumps(report,indent=2),encoding='utf-8')
    print(json.dumps({'characters':len(jobs['characters']),'zones':len(jobs['zones']),
                      'productionMethod':'2D illustration','batchAllowed':False,'finalArtReady':False}))
    return 0 if args.preview else 1

if __name__=='__main__':raise SystemExit(main())
