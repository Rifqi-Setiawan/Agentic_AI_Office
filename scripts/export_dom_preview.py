"""Deterministic CSS export of existing atlases, explicitly NOT final migration art."""
from pathlib import Path
import hashlib
import json
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
PUBLIC = ROOT / 'frontend/public'
OUTPUT = PUBLIC / 'visual-migration'
OUTPUT.mkdir(exist_ok=True)
doc = json.loads((PUBLIC / 'maps/floor1.tmj').read_text())
atlas = json.loads((PUBLIC / 'sprites/environment.json').read_text())
sheet = Image.open(PUBLIC / 'sprites/environment.png').convert('RGBA')
gid_names = {ts['firstgid'] + tile['id']: tile['image'] for ts in doc['tilesets'] for tile in ts['tiles'] if 'image' in tile}
low = {'furniture_prayer_rug_shaf.png', 'furniture_ground_shadow.png',
       'furniture_pool_basin.png', 'furniture_pool_water.png'}
floor = Image.new('RGBA', (2560, 1440))
props = []
for layer in doc['layers']:
    if layer['name'] not in ('floor', 'furniture', 'walls_back', 'walls_front'):
        continue
    cells = sorted(enumerate(layer['data']), key=lambda c: c[0] % doc['width'] + c[0] // doc['width'])
    for index, gid in cells:
        if not gid:
            continue
        name = gid_names[gid]
        entry = atlas['frames'][name]
        if entry['rotated']:
            raise ValueError('Rotated atlas must be repacked: '+name)
        gx, gy = index % doc['width'], index // doc['width']
        x, y = 1088 + (gx-gy)*32, 64 + (gx+gy)*16
        frame = entry['frame']
        source = entry['sourceSize']
        trim = entry['spriteSourceSize']
        left, top = int(x-source['w']/2+trim['x']), int(y-source['h']/2+trim['y'])
        crop = sheet.crop((frame['x'], frame['y'], frame['x']+frame['w'], frame['y']+frame['h']))
        if layer['name'] == 'floor' or name in low:
            floor.alpha_composite(crop, (left, top))
        else:
            offset = {'walls_back': 5, 'furniture': 10, 'walls_front': 30}[layer['name']]
            props.append({'id': layer['name']+'-'+str(index), 'sprite': name,
                          'gx': gx, 'gy': gy, 'x': x, 'y': y, 'z': (gx+gy)*1000+offset,
                          'bounds': {'x': left, 'y': top, 'width': frame['w'], 'height': frame['h']}})
bbox = floor.getbbox()
floor.crop(bbox).save(OUTPUT / 'baseline-floor.webp', lossless=True)
manifest = {'schemaVersion': 1, 'styleVersion': 'BASELINE_PREVIEW_NOT_FINAL', 'exportScale': 1,
            'logicalMapSha256': hashlib.sha256((PUBLIC/'maps/floor1.tmj').read_bytes()).hexdigest(),
            'floor': {'file': '/visual-migration/baseline-floor.webp', 'x': bbox[0], 'y': bbox[1],
                      'width': bbox[2]-bbox[0], 'height': bbox[3]-bbox[1]},
            'props': sorted(props, key=lambda p: (p['z'], p['id'])),
            'provenance': {'sourceCommit': 'ae7473c16cb374544c9118d7d36d90515633fe02',
                           'source': 'Existing Office generated environment atlas',
                           'license': 'See LICENSES.md; source models Kenney CC0',
                           'finalArt': False}}
(OUTPUT/'preview-assets.json').write_text(json.dumps(manifest, indent=2), encoding='utf-8')
print(json.dumps({'floorCrop': bbox, 'globalDepthProps': len(props), 'finalArt': False}))
