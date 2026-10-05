"""Runtime encoding changes bytes only; registration and source art are stable."""
import copy
import hashlib
from io import BytesIO
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

from PIL import Image

import pack_office_runtime as packing


class RuntimePackingTests(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory()
        self.addCleanup(self.temporary.cleanup)
        self.public = Path(self.temporary.name)
        self.file = packing.CANDIDATE + '/furniture/example.png'
        self.source = self.make_png(self.file)
        self.prop = dict(id='one', file=self.file, sprite='example.png', gx=5, gy=8, x=992, y=272, z=13010,
                         bounds=dict(x=970, y=244, width=50, height=30), artClipPath='polygon(0px 0px,50px 0px,50px 30px)',
                         artLayers=[dict(id='plane', width=64, height=48, clipPath='polygon(0px 0px,64px 0px,64px 48px)',
                                         matrix=[.5, 0, 0, .5, -1, -2])])
        self.manifest = dict(props=[self.prop], provenance=dict(sourcePixelsEdited=False), logicalMapSha256='unchanged')

    def make_png(self, file, offset=0):
        path = self.public / file.lstrip('/')
        path.parent.mkdir(parents=True, exist_ok=True)
        image = Image.new('RGBA', (64, 48))
        image.putdata([((x + offset) % 256, (y * 4) % 256, (x * 7 + y) % 256,
                        [0, 1, 127, 254, 255][(x + y) % 5]) for y in range(48) for x in range(64)])
        image.save(path, compress_level=0)
        return path

    def pack(self, manifest=None):
        return packing.pack_runtime_art(manifest or self.manifest, self.public)

    def test_full_rgba_including_transparent_rgb_and_geometry_are_unchanged(self):
        original_manifest = copy.deepcopy(self.manifest)
        source_bytes = self.source.read_bytes()
        updated, ledger = self.pack()
        self.assertEqual(self.manifest, original_manifest)
        self.assertEqual(self.source.read_bytes(), source_bytes)
        record = ledger['files'][0]
        self.assertEqual(record['status'], 'packed')
        self.assertTrue(record['fullDecodedRgbaEqual'])
        self.assertGreater(record['savedBytes'], 0)
        runtime = self.public / updated['props'][0].pop('runtimeFile').lstrip('/')
        self.assertEqual(updated, self.manifest)
        with Image.open(self.source) as source, Image.open(runtime) as result:
            rgba = source.convert('RGBA').tobytes()
            self.assertEqual(source.size, result.size)
            self.assertEqual(rgba, result.convert('RGBA').tobytes())
        self.assertEqual(record['sourceDecodedRgbaSha256'], hashlib.sha256(rgba).hexdigest())
        self.assertEqual(record['runtimeDecodedRgbaSha256'], record['sourceDecodedRgbaSha256'])
        self.assertEqual(record['runtimeSha256'], hashlib.sha256(runtime.read_bytes()).hexdigest())
        self.assertFalse(ledger['fullResolutionDecodeMemoryVerified'])

    def test_shared_assets_pack_once_and_old_z08_foundation_and_actors_are_excluded(self):
        old_file = '/visual-migration/dot-z08-components-v2/furniture/desk.png'
        old_source = self.make_png(old_file)
        ground = packing.CANDIDATE + '/surfaces/material.png'
        chair = packing.CANDIDATE + '/seating/chair.png'
        for file in (ground, chair, packing.G01):
            self.make_png(file)
        manifest = copy.deepcopy(self.manifest)
        legacy = [dict(id='old', file=old_file, runtimeFile='/old-existing.webp'),
                  dict(id='wall', file='/visual-migration/environment-foundation-v1/W01.png'),
                  dict(id='actor', file='/sprites/actor.png')]
        manifest['props'] += [dict(self.prop, id='two'), dict(self.prop, id='chair', file=chair),
                              dict(self.prop, id='window', file=packing.G01), *legacy]
        manifest['groundSurfaces'] = [dict(id='surface', file=ground, sourceSize=dict(width=64, height=48),
                                           sourceQuad=[[0, 0], [64, 0], [64, 48], [0, 48]], repeatTiles=2)]
        original_bytes = old_source.read_bytes()
        updated, ledger = self.pack(manifest)
        self.assertEqual(ledger['summary']['sourceFiles'], 4)
        self.assertEqual(updated['props'][-3:], legacy)
        self.assertEqual(old_source.read_bytes(), original_bytes)
        self.assertFalse(old_source.with_suffix('.lossless.webp').exists())
        self.assertEqual(updated['props'][0]['runtimeFile'], updated['props'][1]['runtimeFile'])
        for collection in ('props', 'groundSurfaces'):
            for item in updated[collection]:
                if item.get('file') != old_file:
                    item.pop('runtimeFile', None)
        self.assertEqual(updated, manifest)

    def test_valid_derivative_is_reverified_and_reused_without_encoding(self):
        updated, first = self.pack()
        with patch.object(Image.Image, 'save', side_effect=AssertionError('Unexpected re-encode')):
            reused, second = self.pack(updated)
        self.assertEqual(reused, updated)
        self.assertEqual(second['files'][0]['status'], 'reused')
        self.assertEqual(first['files'][0]['runtimeSha256'], second['files'][0]['runtimeSha256'])

    def test_intentionally_changed_source_regenerates_same_derivative_path(self):
        updated, first = self.pack()
        self.make_png(self.file, offset=55)
        current_source = self.source.read_bytes()
        regenerated, second = self.pack(updated)
        self.assertEqual(updated['props'][0]['runtimeFile'], regenerated['props'][0]['runtimeFile'])
        self.assertEqual(second['files'][0]['status'], 'packed')
        self.assertNotEqual(first['files'][0]['sourceSha256'], second['files'][0]['sourceSha256'])
        self.assertNotEqual(first['files'][0]['runtimeSha256'], second['files'][0]['runtimeSha256'])
        self.assertEqual(self.source.read_bytes(), current_source)

    def test_corrupt_or_wrong_pixel_derivative_is_not_reused_even_with_matching_hash(self):
        updated, _ = self.pack()
        runtime = self.public / updated['props'][0]['runtimeFile'].lstrip('/')
        output = BytesIO()
        Image.new('RGBA', (64, 48), (99, 98, 97, 0)).save(output, **packing.ENCODING)
        runtime.write_bytes(output.getvalue())
        sidecar = runtime.with_suffix('.webp.json')
        metadata = json.loads(sidecar.read_text())
        metadata['runtimeSha256'] = hashlib.sha256(runtime.read_bytes()).hexdigest()
        sidecar.write_text(json.dumps(metadata))
        regenerated, ledger = self.pack(updated)
        self.assertEqual(ledger['files'][0]['status'], 'packed')
        with Image.open(self.source) as source, Image.open(runtime) as result:
            self.assertEqual(source.convert('RGBA').tobytes(), result.convert('RGBA').tobytes())
        self.assertEqual(updated, regenerated)

    def test_encoding_or_pixel_verification_failure_falls_back_to_original(self):
        manifest = copy.deepcopy(self.manifest)
        manifest['props'][0]['runtimeFile'] = '/stale.webp'
        for target, value in [('encoder', 'error'), ('pixels', 'mismatch')]:
            with self.subTest(target=target, value=value):
                mocking = patch.object(Image.Image, 'save', side_effect=OSError('encoder unavailable')) if target == 'encoder' \
                    else patch.object(packing, '_same_pixels', return_value=False)
                with mocking:
                    updated, ledger = self.pack(manifest)
                self.assertEqual(updated, self.manifest)
                self.assertEqual(ledger['summary']['fallbackFiles'], 1)
                self.assertEqual(ledger['summary']['sourceBytes'], ledger['summary']['runtimeBytes'])
                self.assertIsNone(ledger['files'][0]['runtimeFile'])
                self.assertIn('reason', ledger['files'][0])
                self.assertFalse(self.source.with_suffix('.lossless.webp').exists())

    def test_larger_lossless_result_retains_png(self):
        save = Image.Image.save
        def padded_save(image, output, **kwargs):
            save(image, output, **kwargs)
            output.write(b'\0' * self.source.stat().st_size)
        with patch.object(Image.Image, 'save', padded_save):
            updated, ledger = self.pack()
        self.assertEqual(updated, self.manifest)
        self.assertIn('not smaller', ledger['files'][0]['reason'])
        self.assertFalse(self.source.with_suffix('.lossless.webp').exists())

    def test_missing_source_or_path_escape_cannot_add_runtime_url(self):
        for file in (packing.CANDIDATE + '/furniture/missing.png',
                     packing.CANDIDATE + '/furniture/../../outside.png'):
            with self.subTest(file=file):
                manifest = dict(props=[dict(self.prop, file=file, runtimeFile='/stale.webp')])
                updated, ledger = self.pack(manifest)
                self.assertNotIn('runtimeFile', updated['props'][0])
                self.assertEqual(ledger['files'][0]['status'], 'png-fallback')


if __name__ == '__main__':
    unittest.main()
