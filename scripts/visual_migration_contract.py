"""Extract and verify logical contracts. Never writes the canonical map."""
from pathlib import Path
import hashlib
import json
import sys

ROOT = Path(__file__).resolve().parents[1]
DOCS = ROOT / 'docs/visual-migration'


def canonical(doc):
    layers = {layer['name']: layer for layer in doc['layers']}
    objects = lambda name: [
        {'objectId': obj['id'], ('objectName' if name == 'zones' else 'id'): obj['name'],
         **{p['name']: p['value'] for p in obj.get('properties', [])}}
        for obj in layers[name]['objects']
    ]
    return {
        'map': {key: doc[key] for key in ('width', 'height', 'tilewidth', 'tileheight', 'orientation')},
        'zones': objects('zones'), 'slots': objects('slots'), 'doors': objects('doors'),
        'collision': layers['collision']['data'],
    }


def digest(value):
    return hashlib.sha256(json.dumps(value, sort_keys=True, separators=(',', ':')).encode()).hexdigest()


def main():
    doc = json.loads((ROOT / 'frontend/public/maps/floor1.tmj').read_text())
    contract = canonical(doc)
    baseline_path = Path(sys.argv[1]) if len(sys.argv) > 1 else DOCS / 'package-layout-baseline.json'
    baseline = json.loads(baseline_path.read_text())
    # Package collision stores a summary and canonical nonzero tiles.
    original = dict(baseline)
    if isinstance(original['collision'], dict):
        original['collision'] = original['collision'].get('data', original['collision'])
    differences = {}
    for key in ('map', 'zones', 'slots', 'doors'):
        if contract[key] != baseline[key]:
            differences[key] = {'headHash': digest(contract[key]), 'baselineHash': digest(baseline[key])}
    collision = baseline['collision']
    if isinstance(collision, dict):
        head_blocked = [[i % doc['width'], i // doc['width']] for i, v in enumerate(contract['collision']) if v]
        blocked = collision.get('blockedTiles', collision.get('blocked', []))
        if blocked and isinstance(blocked[0], dict):
            blocked = [[p['gx'], p['gy']] for p in blocked]
        if head_blocked != blocked:
            differences['collision'] = {'headHash': digest(head_blocked), 'baselineHash': digest(blocked)}
    elif contract['collision'] != collision:
        differences['collision'] = {'headHash': digest(contract['collision']), 'baselineHash': digest(collision)}
    DOCS.mkdir(parents=True, exist_ok=True)
    (DOCS / 'layout-head.json').write_text(json.dumps(contract, indent=2), encoding='utf-8')
    report = {'logicalHash': digest(contract), 'differences': differences,
              'zones': len(contract['zones']), 'slots': len(contract['slots']), 'doors': len(contract['doors']),
              'mapSha256': hashlib.sha256((ROOT / 'frontend/public/maps/floor1.tmj').read_bytes()).hexdigest()}
    (DOCS / 'layout-verification.json').write_text(json.dumps(report, indent=2), encoding='utf-8')
    print(json.dumps(report, indent=2))
    return bool(differences)


if __name__ == '__main__':
    raise SystemExit(main())
