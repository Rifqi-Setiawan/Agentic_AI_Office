"""Read-only map/source invariants for registered floor and prayer-rug art."""
import copy
import hashlib
import json
from pathlib import Path
import shutil
import tempfile
import unittest

from PIL import Image
from register_office_surfaces import build_ground_surfaces, PRAYER_RUG, SURFACES

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT/'art/generated-office-2026-10-05/foundation'
MAP = ROOT/'frontend/public/maps/floor1.tmj'
EXPECTED_MAP_SHA256 = '9a9bc468e345658b349923f4ae8dc696397bb929c69688b350ee74e6b610ef0e'
EXPECTED_RUG_SHA256 = '2e4d2dc3a0609168007fca3928dfdfe092165d5bba63849996c2c583163abd75'


class GroundSurfaceRegistrationTest(unittest.TestCase):
    def setUp(self):
        self.map_bytes = MAP.read_bytes()
        self.map = json.loads(self.map_bytes)
        self.before = copy.deepcopy(self.map)
        self.output = tempfile.TemporaryDirectory(prefix='office-ground-test-')
        self.addCleanup(self.output.cleanup)

    def build(self, sources=SOURCE, document=None):
        return build_ground_surfaces(document or self.map, sources, self.output.name, '/test/surfaces')

    def test_five_sources_and_fourteen_overlay_cells_keep_floor_coverage_distinct(self):
        surfaces, ledger = self.build()
        self.assertEqual([s['id'] for s in surfaces], ['F01', 'F03', 'F04', 'O01', 'F16'])
        self.assertEqual(ledger['renderedGroundCells'], 1328)
        self.assertEqual(ledger['preservedZ08FloorCells'], 80)
        self.assertEqual(ledger['renderedOverlayCells'], 14)
        self.assertFalse(ledger['legacyPrayerRugsRestoredFromAtlas'])
        rug = surfaces[-1]
        self.assertEqual(rug['floorSprites'], [])
        self.assertEqual(rug['overlaySprites'], [PRAYER_RUG])
        self.assertEqual(rug['repeatTiles'], 1)
        self.assertEqual(rug['underlayColor'], '#5e7a6f')
        entry = ledger['sources'][-1]
        self.assertEqual(entry['floorCells'], 0)
        self.assertEqual(entry['overlayCells'], 14)
        self.assertEqual({(c['gx'], c['gy']) for c in entry['canonicalOverlayCells']},
                         {(gx, gy) for gx in range(30, 37) for gy in (27, 29)})
        self.assertTrue(entry['underlyingBaseFloorPreserved'])
        self.assertFalse(entry['legacyOverlayRepainted'])
        self.assertFalse(ledger['browserQA'])

    def test_all_original_png_pixels_are_byte_identical_with_measured_alpha_and_quad(self):
        surfaces, ledger = self.build()
        for definition, entry in zip(surfaces, ledger['sources']):
            original = SOURCE/entry['sourceFile']
            copied = Path(self.output.name)/entry['sourceFile']
            self.assertEqual(original.read_bytes(), copied.read_bytes())
            self.assertEqual(hashlib.sha256(copied.read_bytes()).hexdigest(), entry['sourceSha256'])
            self.assertFalse(entry['sourcePixelsEdited'])
            self.assertTrue(entry['sourceCopiedByteIdentical'])
            self.assertFalse(entry['mirrored'])
            qa = json.loads(original.with_suffix('.qa.json').read_text())
            if 'fitted_vertices_xy' in qa:
                self.assertEqual(definition['sourceQuad'], [qa['fitted_vertices_xy'][side] for side in ('top','right','bottom','left')])
        rug = SOURCE/SURFACES['F16']
        self.assertEqual(hashlib.sha256(rug.read_bytes()).hexdigest(), EXPECTED_RUG_SHA256)
        with Image.open(rug) as image:
            self.assertEqual(image.mode, 'RGBA')
            self.assertEqual(image.size, (1774, 887))
            self.assertEqual([image.getpixel(p)[3] for p in [(0,0),(1773,0),(0,886),(1773,886)]], [0]*4)
        qa = json.loads(rug.with_suffix('.qa.json').read_text())
        self.assertGreater(qa['transparent_pixel_fraction'], .5)
        self.assertEqual(qa['interior_alpha_inset_12px']['min'], 252)
        self.assertFalse(qa['browserQA'])

    def test_map_collision_zones_doors_and_all_prayer_slots_are_unchanged(self):
        self.build()
        self.assertEqual(self.map, self.before)
        self.assertEqual(MAP.read_bytes(), self.map_bytes)
        self.assertEqual(hashlib.sha256(self.map_bytes).hexdigest(), EXPECTED_MAP_SHA256)
        objects = {layer['name']: layer.get('objects', []) for layer in self.map['layers']}
        self.assertEqual(len(objects['zones']), 17)
        self.assertEqual(len(objects['doors']), 26)
        self.assertEqual(len(objects['slots']), 133)
        self.assertEqual(len([obj for obj in objects['slots'] if obj['type'] == 'prayer_row']), 16)

    def test_older_source_pack_retains_original_four_materials_and_rug_fallback(self):
        full, ledger = self.build()
        with tempfile.TemporaryDirectory(prefix='older-ground-source-') as temp:
            folder = Path(temp)
            for code, filename in SURFACES.items():
                if code == 'F16': continue
                for source in [SOURCE/filename, (SOURCE/filename).with_suffix('.qa.json')]:
                    shutil.copyfile(source, folder/source.name)
            legacy, legacy_ledger = self.build(folder)
        self.assertEqual(legacy, full[:4])
        self.assertEqual(legacy_ledger['renderedGroundCells'], ledger['renderedGroundCells'])
        self.assertEqual(legacy_ledger['preservedZ08FloorCells'], 80)
        self.assertEqual(legacy_ledger['renderedOverlayCells'], 0)
        self.assertTrue(legacy_ledger['legacyPrayerRugsRestoredFromAtlas'])

    def test_changed_rug_cells_fail_before_claiming_valid_registration(self):
        broken = copy.deepcopy(self.map)
        furniture = next(layer['data'] for layer in broken['layers'] if layer['name'] == 'furniture')
        furniture[27*broken['width']+30] = 0
        with self.assertRaisesRegex(ValueError, 'exact 14'):
            self.build(document=broken)


if __name__ == '__main__':
    unittest.main()
