"""Architecture regressions. These are geometric/source QA, not browser QA."""
import copy
import hashlib
import json
import math
import unittest
from pathlib import Path

from register_office_architecture import (
    MAP, PUBLIC, ROOT, WINDOW_SOURCE, contains, polygon, register_architecture,
    segment_registration, world,
)


class SharedArchitectureTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.manifest_path = PUBLIC/'visual-migration/environment-foundation-v1/assets.json'
        cls.manifest_bytes = cls.manifest_path.read_bytes()
        cls.manifest = json.loads(cls.manifest_bytes)
        cls.props, cls.ledger = register_architecture(cls.manifest)
        cls.by_id = {p['id']: p for p in cls.props}
        cls.shapes = [(p['id'], polygon(p)) for p in cls.props
                      if p.get('artKind') in ('registered-foundation-wall','registered-window-inset')]
        cls.document = json.loads(MAP.read_text())

    def test_every_legacy_wall_is_migrated_or_explicitly_pending(self):
        old = {p['id'] for p in self.manifest['props'] if p['sprite'].startswith('wall_') and not p.get('file')}
        replaced = {r['sourcePropId'] for r in self.ledger['replacements']}
        self.assertEqual(len(old),169)
        self.assertTrue(old.issubset(replaced))
        self.assertEqual(self.ledger['pendingLegacyProps'],[])
        self.assertEqual(self.ledger['unaccountedLegacyProps'],[])
        self.assertTrue(self.ledger['architectureSourceCoverageComplete'])
        self.assertFalse(self.ledger['browserQA'])
        self.assertFalse(self.ledger['finalArt'])
        self.assertFalse(any(p['sprite'].startswith('wall_') and not p.get('file') for p in self.props))
        self.assertEqual(len(self.by_id),len(self.props))

    def test_geometry_is_deterministic_and_input_map_floor_actors_stay_immutable(self):
        before = copy.deepcopy(self.manifest)
        props, ledger = register_architecture(self.manifest)
        self.assertEqual(self.manifest,before)
        self.assertEqual(props,self.props)
        self.assertEqual(ledger,self.ledger)
        self.assertEqual(self.manifest_path.read_bytes(),self.manifest_bytes)
        self.assertEqual(hashlib.sha256(MAP.read_bytes()).hexdigest(),self.manifest['logicalMapSha256'])
        self.assertEqual(ledger['zones'],17)
        self.assertEqual(ledger['slots'],133)
        self.assertEqual(ledger['doors'],26)
        changed = {r['sourcePropId'] for r in ledger['replacements']}
        for old in before['props']:
            if old['id'] not in changed:
                self.assertEqual(self.by_id[old['id']],old)
        self.assertEqual(len(ledger['preservedFoundationPropIds']),193)
        with self.assertRaisesRegex(ValueError,'already registered'):
            register_architecture(dict(self.manifest,props=props))

    def test_sources_are_byte_identical_pngs_with_original_canvas_sizes(self):
        from PIL import Image
        self.assertEqual([s['assetId'] for s in self.ledger['sources']],['W01','W02','G01'])
        for source in self.ledger['sources']:
            original = ROOT/source['source']
            public = PUBLIC/source['file'].lstrip('/')
            self.assertEqual(original.read_bytes(),public.read_bytes())
            self.assertEqual(hashlib.sha256(public.read_bytes()).hexdigest(),source['sourceSha256'])
            with Image.open(public) as im:
                self.assertEqual(list(im.size),source['nativeCanvas'])
                self.assertEqual(im.mode,'RGBA')
            self.assertFalse(source['mirrored'])
        for prop in self.props:
            if prop.get('file'):
                self.assertTrue((PUBLIC/prop['file'].lstrip('/')).is_file(),prop['id'])

    def test_every_registered_triangle_has_exact_corners_and_positive_determinant(self):
        self.assertEqual(len(self.ledger['modules']),231)
        for module in self.ledger['modules']:
            prop = self.by_id[module['id']]
            reg = module['registration']
            self.assertTrue(prop['artClipPath'].startswith('polygon('))
            for check in reg['checks']:
                layer = next(layer for layer in prop['artLayers'] if layer['id'] == check['plane'])
                a,b,c,d,tx,ty = layer['matrix']
                self.assertTrue(all(math.isfinite(v) for v in layer['matrix']))
                self.assertGreater(a*d-b*c,0)
                for (x,y),(u,v) in zip(check['sourceTriangle'],check['targetTriangle']):
                    self.assertAlmostEqual(a*x+c*y+tx,u,places=6)
                    self.assertAlmostEqual(b*x+d*y+ty,v,places=6)
                self.assertLess(check['maxCornerError'],1e-6)

    def test_internal_cutaway_never_exceeds_16_and_preserves_both_ground_axes(self):
        for module in self.ledger['modules']:
            if module['assetId'] == 'G01':
                continue
            prop = self.by_id[module['id']]
            height = prop['wallPresentation']['height']
            self.assertGreater(height,0)
            if prop['wallPresentation']['role'] == 'interior-cutaway':
                self.assertLessEqual(height,16)
            else:
                self.assertEqual(height,48)
            shape = polygon(prop)
            length = module['registration']['lengthTiles']
            self.assertAlmostEqual(abs(shape[1][0]-shape[0][0]),32*length)
            self.assertAlmostEqual(shape[1][1]-shape[0][1],16*length)
            self.assertAlmostEqual(shape[0][1]-shape[-1][1],height)
            self.assertAlmostEqual(abs(shape[2][0]-shape[1][0]),4)
            self.assertAlmostEqual(shape[2][1]-shape[1][1],-2)
            self.assertEqual(shape[0],module['worldStart'])

    def test_all_doors_have_two_short_jambs_and_a_genuine_open_center(self):
        self.assertEqual(len(self.ledger['portals']),26)
        for portal in self.ledger['portals']:
            self.assertEqual(len(portal['propIds']),2)
            self.assertEqual(portal['openingLengthTiles'],.75)
            self.assertEqual(portal['jambLengthTiles'],.125)
            self.assertTrue(portal['headerOmittedForCutaway'])
            gx,gy = portal['center']
            for offset in (-.2,0,.2):
                point = world(gx+offset,gy) if portal['axis']=='R' else world(gx,gy+offset)
                covered = [id for id,shape in self.shapes if contains(shape,point)]
                self.assertEqual(covered,[],(portal['name'],offset,covered))
            for id in portal['propIds']:
                self.assertLessEqual(self.by_id[id]['wallPresentation']['height'],16)

    def test_all_133_slot_centers_and_26_door_centers_stay_visible(self):
        self.assertEqual(len(self.ledger['visibilityChecks']),159)
        for check in self.ledger['visibilityChecks']:
            self.assertEqual(check['coveredBy'],[],check['name'])
            point = world(*check['center'])
            self.assertEqual([id for id,shape in self.shapes if contains(shape,point)],[],check['name'])

    def test_both_two_tile_corridors_remain_clear(self):
        collision = next(layer['data'] for layer in self.document['layers'] if layer['name']=='collision')
        for gy in (8,9,20,21):
            for gx in range(self.document['width']):
                if collision[gy*self.document['width']+gx]:
                    continue
                self.assertEqual([id for id,shape in self.shapes if contains(shape,world(gx,gy))],[],(gx,gy))

    def test_duplicate_lobby_door_leaves_share_the_real_opening(self):
        records = {r['sourcePropId']:r for r in self.ledger['replacements']}
        portal = next(p for p in self.ledger['portals'] if p['name']=='door_lobby_entrance')
        for id in ('furniture-1368','furniture-1369'):
            self.assertNotIn(id,self.by_id)
            self.assertEqual(records[id]['purpose'],'deduplicated-lobby-entrance-art')
            self.assertTrue(set(portal['propIds']).issubset(records[id]['replacementPropIds']))
            self.assertTrue(all(p in self.by_id for p in records[id]['replacementPropIds']))
        self.assertIn('walls_front-1369',records['furniture-1369']['replacementPropIds'])
        self.assertEqual(self.by_id['walls_front-1369']['gx'],5)
        self.assertFalse(any(p['sprite']=='furniture_entrance_door.png' for p in self.props))

    def test_actual_glass_source_is_used_for_all_eight_window_insets(self):
        windows = [m for m in self.ledger['modules'] if m['assetId']=='G01']
        self.assertEqual(len(windows),8)
        for window in windows:
            prop = self.by_id[window['id']]
            self.assertEqual(prop['file'],WINDOW_SOURCE['file'])
            self.assertEqual(prop['artKind'],'registered-window-inset')
            surround = self.by_id[window['id']+'-wall']
            self.assertEqual(surround['wallPresentation']['height'],48)
            self.assertEqual(surround['gx'],prop['gx'])
            self.assertEqual(surround['gy'],0)
            self.assertEqual(prop['z'],surround['z']+1)
            for point in polygon(prop):
                self.assertTrue(contains(polygon(surround),point),window['id'])

    def test_missing_glass_is_explicit_not_fake_finished_art(self):
        props,ledger = register_architecture(self.manifest,window_source=None)
        self.assertEqual(len(ledger['pendingLegacyProps']),8)
        self.assertFalse(ledger['architectureSourceCoverageComplete'])
        for pending in ledger['pendingLegacyProps']:
            old = next(p for p in self.manifest['props'] if p['id']==pending['id'])
            self.assertEqual(next(p for p in props if p['id']==pending['id']),old)
        bad = copy.deepcopy(self.manifest)
        bad['logicalMapSha256']='wrong'
        with self.assertRaisesRegex(ValueError,'logical map'):
            register_architecture(bad)

    def test_fractional_jamb_and_corner_registration_is_stable(self):
        for axis in ('W01','W02'):
            for length in (.125,.5,1):
                for height in (8,12,16,48):
                    reg = segment_registration(axis,length,height)
                    self.assertEqual(reg['wallHeight'],height)
                    self.assertEqual(reg['sourceHeight'],80)
                    self.assertEqual(len(reg['checks']),6)
                    self.assertTrue(all(c['maxCornerError']<1e-6 for c in reg['checks']))


if __name__ == '__main__':
    unittest.main()
