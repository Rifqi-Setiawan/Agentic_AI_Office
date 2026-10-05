"""Extract and verify logical contracts. Never writes the canonical map."""
from pathlib import Path
import copy
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
    expected = copy.deepcopy(baseline)
    approval_path = DOCS / 'approved-layout-adjustments.json'
    approvals = json.loads(approval_path.read_text())['adjustments'] if approval_path.exists() else []
    furniture_path = DOCS / 'package-furniture-baseline.json'
    expected_furniture = json.loads(furniture_path.read_text())['data'] if furniture_path.exists() else None
    for approval in approvals:
        slot = next(s for s in expected['slots'] if s['id'] == approval['slotId'])
        assert all(slot[k] == v for k, v in approval['slotFrom'].items()), 'Approval source slot differs from original baseline'
        slot.update(approval['slotTo'])
        for change in approval['collisionChanges']:
            index = change['gy'] * doc['width'] + change['gx']
            assert expected['collision'][index] == change['from'], 'Approval source collision differs from original baseline'
            expected['collision'][index] = change['to']
        if approval['furnitureChanges'] and expected_furniture is None:
            raise ValueError('Approved furniture move needs the original furniture baseline')
        for change in approval['furnitureChanges']:
            index = change['gy'] * doc['width'] + change['gx']
            assert expected_furniture[index] == change['from'], 'Approval source furniture differs from original baseline'
            expected_furniture[index] = change['to']
    # Package collision stores a summary and canonical nonzero tiles.
    original = dict(baseline)
    if isinstance(original['collision'], dict):
        original['collision'] = original['collision'].get('data', original['collision'])
    differences = {}
    for key in ('map', 'zones', 'slots', 'doors'):
        if contract[key] != expected[key]:
            differences[key] = {'headHash': digest(contract[key]), 'expectedHash': digest(expected[key])}
    collision = expected['collision']
    if isinstance(collision, dict):
        head_blocked = [[i % doc['width'], i // doc['width']] for i, v in enumerate(contract['collision']) if v]
        blocked = collision.get('blockedTiles', collision.get('blocked', []))
        if blocked and isinstance(blocked[0], dict):
            blocked = [[p['gx'], p['gy']] for p in blocked]
        if head_blocked != blocked:
            differences['collision'] = {'headHash': digest(head_blocked), 'baselineHash': digest(blocked)}
    elif contract['collision'] != collision:
        differences['collision'] = {'headHash': digest(contract['collision']), 'baselineHash': digest(collision)}
    if expected_furniture is not None:
        furniture = next(layer['data'] for layer in doc['layers'] if layer['name'] == 'furniture')
        if furniture != expected_furniture:
            differences['furniture'] = {'headHash': digest(furniture), 'expectedHash': digest(expected_furniture)}
    DOCS.mkdir(parents=True, exist_ok=True)
    (DOCS / 'layout-head.json').write_text(json.dumps(contract, indent=2), encoding='utf-8')
    report = {'logicalHash': digest(contract), 'differences': differences,
              'approvedAdjustments': [a['id'] for a in approvals],
              'approvalRecord': str(approval_path.relative_to(ROOT)).replace('\\', '/') if approvals else None,
              'originalBaselineDifferences': [k for k in ('map', 'zones', 'slots', 'doors', 'collision') if contract[k] != baseline[k]],
              'zones': len(contract['zones']), 'slots': len(contract['slots']), 'doors': len(contract['doors']),
              'mapSha256': hashlib.sha256((ROOT / 'frontend/public/maps/floor1.tmj').read_bytes()).hexdigest()}
    (DOCS / 'layout-verification.json').write_text(json.dumps(report, indent=2), encoding='utf-8')
    print(json.dumps(report, indent=2))
    return bool(differences)


if __name__ == '__main__':
    raise SystemExit(main())
