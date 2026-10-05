"""Pool coping geometry/source regressions. These do not assert browser QA."""
import copy
from collections import Counter
import hashlib
import json
import math
from pathlib import Path
import tempfile
import unittest

from register_pool_coping import (
    ART_KIND, INNER_WATER_CELLS, INTERNAL_OVERLAP, MAP, RING_CELLS, ROOT,
    SOURCE_QUAD, SOURCE_SHA256, SOURCE_SIZE, SPRITE, TARGET_QUAD,
    project, register_pool_coping,
)


def polygon(value):
    return [[float(coordinate.removesuffix('px')) for coordinate in point.split()]
            for point in value[8:-1].split(',')]


def contains(quad, point):
    return all((b[0]-a[0])*(point[1]-a[1])-(b[1]-a[1])*(point[0]-a[0]) >= -1e-8
               for a, b in zip(quad, quad[1:]+quad[:1]))


class PoolCopingRegistrationTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.manifest_path = ROOT/'frontend/public/visual-migration/environment-foundation-v1/assets.json'
        cls.manifest_bytes = cls.manifest_path.read_bytes()
        cls.manifest = json.loads(cls.manifest_bytes)
        cls.original = copy.deepcopy(cls.manifest)
        cls.source = ROOT/'art/generated-office-2026-10-05/rooms'/SPRITE
        cls.map_bytes = MAP.read_bytes()
        cls.output = tempfile.TemporaryDirectory(prefix='pool-coping-test-')
        cls.props, cls.ledger = register_pool_coping(
            cls.manifest, cls.source, cls.output.name, '/test/furniture')
        cls.by_id = {p['id']: p for p in cls.props}
        cls.coping = [p for p in cls.props if p.get('artKind') == ART_KIND]

    @classmethod
    def tearDownClass(cls):
        cls.output.cleanup()

    def test_all_sixteen_canonical_ring_cells_are_replaced_one_for_one(self):
        self.assertEqual(len(self.coping), 16)
        self.assertEqual({(p['gx'], p['gy']) for p in self.coping}, RING_CELLS)
        before = [p for p in self.original['props'] if p['sprite'] == SPRITE]
        self.assertEqual({p['id'] for p in before}, {p['id'] for p in self.coping})
        self.assertEqual(self.ledger['sourcePropIds'], [p['id'] for p in before])
        self.assertEqual(len(self.props), len(self.original['props']))
        self.assertEqual(len(self.by_id), len(self.props))
        for original in before:
            prop = self.by_id[original['id']]
            for field in ('id', 'sprite', 'gx', 'gy', 'x', 'y', 'z'):
                self.assertEqual(prop[field], original[field])

    def test_exact_64_by_32_bounds_and_target_quads(self):
        self.assertEqual(self.ledger['tileLogical'], [64, 32])
        for instance in self.ledger['instances']:
            prop = self.by_id[instance['id']]
            self.assertEqual(prop['bounds'], dict(x=prop['x']-32, y=prop['y']-16, width=64, height=32))
            self.assertEqual(polygon(prop['artClipPath']), [list(p) for p in TARGET_QUAD])
            expected = [[prop['x'], prop['y']-16], [prop['x']+32, prop['y']],
                        [prop['x'], prop['y']+16], [prop['x']-32, prop['y']]]
            self.assertEqual(instance['targetWorldQuad'], expected)
            self.assertEqual(instance['registration']['targetQuad'], [list(p) for p in TARGET_QUAD])

    def test_all_four_source_corners_and_each_triangle_are_exact_and_unmirrored(self):
        for instance in self.ledger['instances']:
            prop = self.by_id[instance['id']]
            self.assertEqual(len(prop['artLayers']), 2)
            corner_indices = set()
            for check in instance['registration']['checks']:
                layer = next(layer for layer in prop['artLayers'] if layer['id'] == check['plane'])
                self.assertEqual(layer['matrix'], check['matrix'])
                a, b, c, d, _, _ = layer['matrix']
                self.assertTrue(all(math.isfinite(v) for v in layer['matrix']))
                self.assertGreater(a*d-b*c, 0)
                self.assertEqual((layer['width'], layer['height']), SOURCE_SIZE)
                for source, target in zip(check['sourceTriangle'], check['targetTriangle']):
                    corner_indices.add(SOURCE_QUAD.index(tuple(source)))
                    actual = project(layer['matrix'], source)
                    self.assertAlmostEqual(actual[0], target[0], places=10)
                    self.assertAlmostEqual(actual[1], target[1], places=10)
                self.assertLess(check['maxCornerError'], 1e-10)
            self.assertEqual(corner_indices, {0, 1, 2, 3})
        self.assertFalse(self.ledger['mirrored'])

    def test_only_internal_diagonal_overlaps_and_source_clips_stay_in_top_face(self):
        source_quad = [list(p) for p in SOURCE_QUAD]
        for instance in self.ledger['instances']:
            registration = instance['registration']
            self.assertEqual(registration['outerEdgeOverlap'], 0)
            self.assertEqual(registration['internalDiagonalOverlap'], INTERNAL_OVERLAP)
            for check in registration['checks']:
                for point in check['sourceClipPolygon']:
                    self.assertTrue(contains(source_quad, point))
            right, left = registration['checks']
            self.assertEqual(right['sourceClipPolygon'], right['sourceTriangle'])
            for index in (1, 2):
                projected = project(left['matrix'], left['sourceClipPolygon'][index])
                self.assertAlmostEqual(projected[0], 32+INTERNAL_OVERLAP, places=10)
            self.assertEqual(registration['clipPath'], 'polygon(32px 0px,64px 16px,32px 32px,0px 16px)')

    def test_ring_has_exact_shared_edges_no_spacing_gaps_and_correct_hole(self):
        edges = Counter()
        for instance in self.ledger['instances']:
            q = instance['targetWorldQuad']
            for a, b in zip(q, q[1:]+q[:1]):
                edges[tuple(sorted((tuple(a), tuple(b))))] += 1
        # A 5x5 perimeter has 16 shared edges, 20 outside edges, 12 hole edges.
        self.assertEqual(Counter(edges.values()), {1: 32, 2: 16})
        cells = {(p['gx'], p['gy']) for p in self.coping}
        self.assertEqual(cells | INNER_WATER_CELLS,
                         {(gx, gy) for gx in range(38, 43) for gy in range(25, 30)})
        self.assertFalse(cells & INNER_WATER_CELLS)
        self.assertEqual(len(cells)*64*32/2, 16384)

    def test_inner_water_and_all_six_swim_slot_centers_remain_clear(self):
        shapes = [instance['targetWorldQuad'] for instance in self.ledger['instances']]
        # Sampling arbitrarily near every water cell edge checks more than its
        # center. Exact edge sharing with the stone border is expected.
        for gx, gy in INNER_WATER_CELLS:
            for dx in (-0.499, 0, 0.499):
                for dy in (-0.499, 0, 0.499):
                    point = [1088+(gx+dx-gy-dy)*32, 64+(gx+dx+gy+dy)*16]
                    self.assertFalse(any(contains(shape, point) for shape in shapes))
        self.assertEqual(len(self.ledger['innerWaterCenterChecks']), 9)
        self.assertEqual(len(self.ledger['swimSlotClearance']), 6)
        self.assertEqual(self.ledger['preservedSwimSlots'], 6)
        document = json.loads(self.map_bytes)
        slots = [o for l in document['layers'] if l['name'] == 'slots'
                 for o in l['objects'] if o.get('type') == 'pool_swim']
        self.assertEqual({s['id'] for s in slots}, {c['id'] for c in self.ledger['swimSlotClearance']})
        for check in self.ledger['swimSlotClearance']:
            self.assertEqual(check['coveredBy'], [])
            self.assertGreater(check['minimumClearanceLogicalPixels'], 14)
            self.assertFalse(any(contains(shape, check['worldCenter']) for shape in shapes))

    def test_original_source_png_is_byte_identical_and_hash_anchored(self):
        output = Path(self.output.name)/SPRITE
        self.assertEqual(output.read_bytes(), self.source.read_bytes())
        self.assertEqual(hashlib.sha256(output.read_bytes()).hexdigest(), SOURCE_SHA256)
        self.assertEqual(self.ledger['sourceSha256'], SOURCE_SHA256)
        self.assertEqual(self.ledger['sourceQuad'], [list(p) for p in SOURCE_QUAD])
        self.assertTrue(self.ledger['sourceCopiedByteIdentical'])
        self.assertFalse(self.ledger['sourcePixelsEdited'])
        self.assertEqual(list(Path(self.output.name).iterdir()), [output])
        for prop in self.coping:
            self.assertEqual(prop['file'], '/test/furniture/'+SPRITE)

    def test_no_map_floor_basin_actors_other_props_or_input_manifest_changes(self):
        self.assertEqual(MAP.read_bytes(), self.map_bytes)
        self.assertEqual(self.manifest_path.read_bytes(), self.manifest_bytes)
        self.assertEqual(self.manifest, self.original)
        self.assertEqual(hashlib.sha256(self.map_bytes).hexdigest(), self.ledger['logicalMapSha256'])
        for prop in self.original['props']:
            if prop['sprite'] != SPRITE:
                self.assertEqual(self.by_id[prop['id']], prop)
        self.assertFalse(self.ledger['logicalMapChanged'])
        self.assertFalse(self.ledger['logicalLayoutChanged'])
        self.assertTrue(self.ledger['canonicalFloorPreserved'])
        self.assertTrue(self.ledger['existingBasinPreserved'])
        self.assertTrue(self.ledger['topFaceOnly'])
        self.assertFalse(self.ledger['verticalSlabRendered'])

    def test_registration_is_deterministic_and_never_claims_browser_pass(self):
        props, ledger = register_pool_coping(self.manifest, self.source, self.output.name, '/test/furniture')
        self.assertEqual(props, self.props)
        self.assertEqual(ledger, self.ledger)
        self.assertFalse(ledger['browserQA'])
        self.assertFalse(ledger['repeatedSeamVisualQA'])
        self.assertFalse(ledger['finalArt'])

    def test_incomplete_ring_changed_anchors_map_mismatch_and_double_registration_fail(self):
        missing = copy.deepcopy(self.manifest)
        missing['props'] = [p for p in missing['props'] if p['id'] != self.coping[0]['id']]
        with self.assertRaisesRegex(ValueError, '16 canonical'):
            register_pool_coping(missing, self.source, self.output.name, '/test')
        shifted = copy.deepcopy(self.manifest)
        next(p for p in shifted['props'] if p['sprite'] == SPRITE)['x'] += 1
        with self.assertRaisesRegex(ValueError, 'logical anchors'):
            register_pool_coping(shifted, self.source, self.output.name, '/test')
        with self.assertRaisesRegex(ValueError, 'canonical map'):
            register_pool_coping(dict(self.manifest, logicalMapSha256='wrong'), self.source, self.output.name, '/test')
        with self.assertRaisesRegex(ValueError, 'already registered'):
            register_pool_coping(dict(self.manifest, props=self.props), self.source, self.output.name, '/test')


if __name__ == '__main__':
    unittest.main()
