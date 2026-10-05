"""Room seating invariants, original-source identity, and physical facing tests.

These offline tests intentionally do not claim browser or actor visual QA.
"""
from collections import Counter
import copy
import hashlib
import json
import math
from pathlib import Path
import shutil
import tempfile
import unittest

from PIL import Image

from register_room_seating import (
    ART_KIND, CHAIR_SPRITES, DIRECTIONS, GRID_VECTORS, WIDTHS, register_room_seating,
)


ROOT = Path(__file__).resolve().parents[1]
PUBLIC = ROOT/'frontend/public'
MAP = PUBLIC/'maps/floor1.tmj'
BASE = PUBLIC/'visual-migration/environment-foundation-v1/assets.json'
SOURCE = ROOT/'art/generated-office-2026-10-05/seating'
if not SOURCE.exists():
    SOURCE = ROOT.parent/'generated/seating'


def sha(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def properties(obj):
    return {item['name']: item['value'] for item in obj.get('properties', [])}


class RoomSeatingRegistrationTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.map_bytes, cls.manifest_bytes = MAP.read_bytes(), BASE.read_bytes()
        cls.map = json.loads(cls.map_bytes)
        cls.manifest = json.loads(cls.manifest_bytes)
        cls.original = copy.deepcopy(cls.manifest)
        cls.original_map = copy.deepcopy(cls.map)
        cls.slots = {obj['name']: properties(obj)
                     for layer in cls.map['layers'] if layer['name'] == 'slots'
                     for obj in layer['objects']}
        cls.output = tempfile.TemporaryDirectory(prefix='room-seating-test-')
        cls.props, cls.ledger = register_room_seating(cls.manifest, cls.map, SOURCE,
                                                     cls.output.name, '/test/seating')
        cls.by_id = {prop['id']: prop for prop in cls.props}
        cls.original_by_id = {prop['id']: prop for prop in cls.original['props']}
        cls.seats = [prop for prop in cls.props if prop.get('artKind') == ART_KIND]

    @classmethod
    def tearDownClass(cls):
        cls.output.cleanup()

    def test_expected_functional_chair_counts_and_no_duplicate_ids(self):
        self.assertEqual(self.ledger['summary'], dict(registered=37, replaced=18, added=19,
                          meetingSeats=12, cafeSeats=8, classroomSeats=6, staffedDesks=11,
                          preservedExistingMatches=0))
        self.assertEqual(len(self.props), len(self.original['props'])+19)
        self.assertEqual(len(self.by_id), len(self.props))
        self.assertEqual(len(self.seats), 37)
        self.assertEqual(len({prop['slotId'] for prop in self.seats}), 37)
        counts = Counter('desk' if self.slots[prop['slotId']]['type'].startswith('desk:')
                         else self.slots[prop['slotId']]['type'] for prop in self.seats)
        self.assertEqual(counts, {'desk': 11, 'meeting_seat': 12, 'class_seat': 6, 'cafe_seat': 8})
        for prop in self.seats:
            matching = [other for other in self.props if other['sprite'] in CHAIR_SPRITES and
                        (other['gx'], other['gy']) == (prop['gx'], prop['gy'])]
            self.assertEqual([other['id'] for other in matching], [prop['id']])

    def test_all_canonical_map_layers_and_actor_overrides_remain_unchanged(self):
        self.assertEqual(self.manifest, self.original)
        self.assertEqual(self.map, self.original_map)
        self.assertEqual(MAP.read_bytes(), self.map_bytes)
        self.assertEqual(BASE.read_bytes(), self.manifest_bytes)
        self.assertEqual(sha(MAP), self.manifest['logicalMapSha256'])
        self.assertEqual(self.ledger['canonicalMap'], dict(width=44, height=32, zones=17, slots=133, doors=26))
        for flag in ('logicalMapChanged', 'logicalLayoutChanged', 'slotFacingsChanged',
                     'characterAnimationsChanged', 'z08Changed'):
            self.assertFalse(self.ledger[flag])

    def test_approved_z08_and_all_unrelated_props_are_byte_equivalent_objects(self):
        replaced = set(self.ledger['replacedPropIds'])
        for before in self.original['props']:
            if before['id'] not in replaced:
                self.assertEqual(self.by_id[before['id']], before)
        z08 = [prop for prop in self.original['props'] if prop.get('zone') == 'Z08' or
               (16 <= prop['gx'] <= 23 and 10 <= prop['gy'] <= 19)]
        self.assertTrue(z08)
        for before in z08:
            self.assertEqual(self.by_id[before['id']], before)
        self.assertFalse(any(prop['zone'] == 'Z08' for prop in self.seats))

    def test_replaced_chairs_keep_their_canonical_ids_coordinates_and_depth(self):
        self.assertEqual(len(self.ledger['replacedPropIds']), 18)
        for identity in self.ledger['replacedPropIds']:
            before, after = self.original_by_id[identity], self.by_id[identity]
            for field in ('id', 'sprite', 'gx', 'gy', 'x', 'y', 'z'):
                self.assertEqual(after[field], before[field])
        for identity in self.ledger['addedPropIds']:
            prop = self.by_id[identity]
            self.assertEqual(identity, f'room-seat-{prop["slotId"]}')
            self.assertNotIn(identity, self.original_by_id)

    def test_boardroom_all_four_edges_face_the_table_without_changing_slot_facings(self):
        facings = Counter()
        for prop in self.seats:
            if prop['zone'] != 'Z02':
                continue
            expected = ('SW' if prop['gy'] == 2 else 'NE' if prop['gy'] == 5 else
                        'SE' if prop['gx'] == 12 else 'NW')
            self.assertEqual(prop['presentationFacing'], expected)
            self.assertEqual(prop['logicalFacing'], self.slots[prop['slotId']]['facing'])
            facings[expected] += 1
        self.assertEqual(facings, {'SW': 4, 'NE': 4, 'SE': 2, 'NW': 2})

    def test_cafe_pairs_classroom_and_staff_desks_face_actual_functional_targets(self):
        for instance in self.ledger['instances']:
            slot = self.slots[instance['slotId']]
            target = instance['furnitureTarget']
            vx, vy = GRID_VECTORS[instance['presentationFacing']]
            self.assertGreater(vx*(target['gx']-slot['gx']) + vy*(target['gy']-slot['gy']), 0)
            if slot['type'] == 'cafe_seat':
                self.assertEqual(target['sprite'], 'furniture_table_round.png')
                self.assertEqual((target['gx'], target['gy']), (slot['gx'], 28))
                self.assertEqual(instance['presentationFacing'], 'SW' if slot['gy'] == 27 else 'NE')
            elif slot['type'] == 'class_seat':
                self.assertEqual(target['sprite'], 'furniture_whiteboard.png')
                self.assertEqual(instance['presentationFacing'], 'NE')
            self.assertEqual(instance['logicalFacing'], slot['facing'])

    def test_uniform_positive_css_scale_correctly_maps_all_alpha_corners(self):
        sources = {source['facing']: source for source in self.ledger['sources']}
        for prop in self.seats:
            source = sources[prop['presentationFacing']]
            layer, = prop['artLayers']
            a, b, c, d, tx, ty = layer['matrix']
            self.assertTrue(all(math.isfinite(value) for value in layer['matrix']))
            self.assertGreater(a, 0)
            self.assertEqual((a, b, c), (d, 0, 0))
            self.assertGreater(a*d-b*c, 0)
            x0, y0, x1, y1 = source['alphaBox']
            self.assertAlmostEqual(a*x0+tx, 0)
            self.assertAlmostEqual(d*y0+ty, 0)
            self.assertAlmostEqual(a*x1+tx, prop['bounds']['width'])
            self.assertAlmostEqual(d*y1+ty, prop['bounds']['height'])
            kind = self.slots[prop['slotId']]['type']
            self.assertEqual(prop['bounds']['width'], WIDTHS['desk' if kind.startswith('desk:') else kind])
            self.assertEqual([layer['width'], layer['height']], source['nativeSize'])

    def test_each_original_png_and_provenance_is_copied_without_any_pixel_change(self):
        self.assertEqual({source['facing'] for source in self.ledger['sources']}, set(DIRECTIONS))
        self.assertEqual(len({source['sha256'] for source in self.ledger['sources']}), 4)
        for source in self.ledger['sources']:
            original = SOURCE/source['sourceFile']
            copied = Path(self.output.name)/source['sourceFile']
            self.assertEqual(original.read_bytes(), copied.read_bytes())
            self.assertEqual(sha(original), source['sha256'])
            provenance = source['provenanceFile']
            self.assertEqual((SOURCE/provenance).read_bytes(), (Path(self.output.name)/provenance).read_bytes())
            with Image.open(copied) as image:
                self.assertEqual(image.mode, 'RGBA')
                self.assertEqual(image.getchannel('A').getextrema(), (0, 255))
                self.assertEqual(list(image.size), source['nativeSize'])
            self.assertTrue(source['sourceBytesPreserved'])
            self.assertFalse(source['sourcePixelsEdited'])
            self.assertFalse(source['mirrored'])

    def test_only_desk_artwork_is_tucked_and_every_actor_slot_anchor_stays_intact(self):
        zones = {properties(obj)['zone_id']: properties(obj)
                 for layer in self.map['layers'] if layer['name'] == 'zones' for obj in layer['objects']}
        doors = [(properties(obj)['gx'], properties(obj)['gy'])
                 for layer in self.map['layers'] if layer['name'] == 'doors' for obj in layer['objects']]
        for instance in self.ledger['instances']:
            slot, prop = self.slots[instance['slotId']], self.by_id[instance['id']]
            self.assertEqual([prop['gx'], prop['gy']], [slot['gx'], slot['gy']])
            self.assertEqual([prop['x'], prop['y']], [1088+(slot['gx']-slot['gy'])*32,
                                                   64+(slot['gx']+slot['gy'])*16])
            self.assertLess(prop['z'], instance['actorDepth'])
            gx, gy = instance['visualGridAnchor']
            zone = zones[slot['zone']]
            self.assertTrue(zone['gx_min'] <= gx <= zone['gx_max'])
            self.assertTrue(zone['gy_min'] <= gy <= zone['gy_max'])
            self.assertTrue(all(math.dist((gx, gy), door) >= 0.75 for door in doors))
            offset = instance['presentationOffset']
            self.assertEqual([abs(value) for value in offset], [4, 2] if slot['type'].startswith('desk:') else [0, 0])
            self.assertAlmostEqual(prop['bounds']['y']+prop['bounds']['height'], instance['groundAnchor'][1])
            self.assertEqual(instance['groundAnchor'], [a+b for a, b in zip(instance['originalGroundAnchor'], offset)])

    def test_existing_desk_or_cafe_chair_is_preserved_instead_of_duplicated(self):
        fixture = copy.deepcopy(self.original)
        slot = self.slots['slot_z14_seat_1']
        chair = dict(id='already-present-cafe-chair', sprite='furniture_chair.png',
                     gx=slot['gx'], gy=slot['gy'], x=576, y=672, z=38010,
                     bounds=dict(x=560, y=631, width=32, height=50))
        fixture['props'].append(chair)
        with tempfile.TemporaryDirectory() as out:
            props, ledger = register_room_seating(fixture, self.map, SOURCE, out, '/test/seating')
        self.assertEqual(ledger['summary']['added'], 18)
        self.assertEqual(ledger['summary']['preservedExistingMatches'], 1)
        self.assertEqual(next(prop for prop in props if prop['id'] == chair['id']), chair)
        self.assertFalse(any(prop['id'] == 'room-seat-slot_z14_seat_1' for prop in props))

    def test_duplicate_existing_chairs_and_repeat_registration_fail_closed(self):
        fixture = copy.deepcopy(self.original)
        chair = copy.deepcopy(next(prop for prop in fixture['props'] if prop['id'] == 'furniture-101'))
        chair['id'] = 'duplicate-chair'
        fixture['props'].append(chair)
        with tempfile.TemporaryDirectory() as out:
            with self.assertRaisesRegex(ValueError, 'Duplicate existing chairs'):
                register_room_seating(fixture, self.map, SOURCE, out, '/test/seating')
            registered = dict(self.manifest, props=self.props)
            with self.assertRaisesRegex(ValueError, 'already registered'):
                register_room_seating(registered, self.map, SOURCE, out, '/test/seating')

    def test_rejects_unverified_source_and_changed_map_dimensions_without_writing_outputs(self):
        with tempfile.TemporaryDirectory() as temp:
            temp = Path(temp)
            source_dir = temp/'sources'
            shutil.copytree(SOURCE, source_dir)
            provenance = source_dir/'office-chair-NE.provenance.json'
            data = json.loads(provenance.read_text())
            data['sha256'] = 'not-the-original'
            provenance.write_text(json.dumps(data))
            with self.assertRaisesRegex(ValueError, 'Unverified original'):
                register_room_seating(self.manifest, self.map, source_dir, temp/'output', '/test/seating')
            self.assertFalse((temp/'output').exists())
            changed = copy.deepcopy(self.map)
            changed['width'] = 45
            with self.assertRaisesRegex(ValueError, 'unchanged canonical'):
                register_room_seating(self.manifest, changed, SOURCE, temp/'output', '/test/seating')

    def test_browser_and_actor_interleaving_are_explicitly_pending(self):
        self.assertFalse(self.ledger['browserVisualQA'])
        self.assertFalse(self.ledger['actorInterleavingVisualQA'])
        self.assertFalse(self.ledger['finalArt'])


class FinalCandidateSeatingTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        candidate = PUBLIC/'visual-migration/illustrated-office-v1'
        cls.assets = json.loads((candidate/'assets.json').read_text())
        cls.ledger = json.loads((candidate/'seating-registration-ledger.json').read_text())
        cls.furniture_ledger = json.loads((candidate/'furniture-ledger.json').read_text())
        cls.before = json.loads(BASE.read_text())
        cls.by_id = {prop['id']: prop for prop in cls.assets['props']}

    def test_final_candidate_and_seating_ledger_match_exactly(self):
        seats = [prop for prop in self.assets['props'] if prop.get('artKind') == ART_KIND]
        self.assertEqual(len(seats), 37)
        self.assertEqual({prop['id'] for prop in seats}, {i['id'] for i in self.ledger['instances']})
        for instance in self.ledger['instances']:
            prop = self.by_id[instance['id']]
            self.assertEqual(prop['bounds'], instance['bounds'])
            self.assertEqual(prop['z'], instance['depth'])
            self.assertEqual(prop['logicalFacing'], instance['logicalFacing'])
            self.assertEqual(prop['presentationFacing'], instance['presentationFacing'])
            self.assertEqual(prop['visualOffset'], instance['presentationOffset'])
            self.assertEqual([prop['gx'], prop['gy']], instance['logicalAnchor'])
            # Canonical visible chair feet sit nine world pixels below the
            # anchor before the strictly presentational desk tuck.
            self.assertEqual(instance['originalGroundAnchor'], [prop['x'], prop['y']+9])
        self.assertEqual(len(self.by_id), len(self.assets['props']))

    def test_replaced_chairs_have_exactly_one_registration_owner(self):
        old_instances = {instance['id'] for source in self.furniture_ledger['sources']
                         for instance in source['instances']}
        self.assertFalse(old_instances & set(self.ledger['replacedPropIds']))
        for identity in self.ledger['replacedPropIds']:
            self.assertEqual(self.by_id[identity]['artKind'], ART_KIND)
        for prop in self.assets['props']:
            if prop.get('zone') in ('Z02', 'Z04') and prop['sprite'] in CHAIR_SPRITES:
                self.assertEqual(prop['artKind'], ART_KIND)

    def test_final_source_files_match_original_source_and_provenance_hashes(self):
        for source in self.ledger['sources']:
            destination = PUBLIC/source['file'].lstrip('/')
            self.assertEqual(sha(destination), source['sha256'])
            self.assertEqual(destination.read_bytes(), (SOURCE/source['sourceFile']).read_bytes())
            self.assertEqual(sha(destination.with_suffix('.provenance.json')), source['provenanceSha256'])

    def test_final_map_actor_overrides_and_approved_z08_furnishings_remain_original(self):
        self.assertEqual(self.assets['logicalMapSha256'], sha(MAP))
        self.assertEqual(self.assets.get('characterOverrides'), self.before.get('characterOverrides'))
        for prop in self.before['props']:
            # Whole-office architecture owns the wall/portal migration; the
            # seating helper itself leaves even those props intact (above).
            if prop['id'].startswith(('walls_', 'dot-z08-door-')):
                continue
            if prop.get('zone') == 'Z08' or (16 <= prop['gx'] <= 23 and 10 <= prop['gy'] <= 19):
                self.assertEqual(self.by_id[prop['id']], prop)
        self.assertFalse(self.ledger['browserVisualQA'])
        self.assertFalse(self.ledger['actorInterleavingVisualQA'])


if __name__ == '__main__':
    unittest.main()
