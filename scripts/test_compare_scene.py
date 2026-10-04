"""Negative acceptance: an altered world pixel must fail even with volatile HUD masked."""
import hashlib
import tempfile
import unittest
from pathlib import Path
from PIL import Image
from compare_scene import compare


class SceneComparisonTest(unittest.TestCase):
    def test_world_change_rejected_hud_change_masked_reference_immutable(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            reference, candidate = root / 'reference.png', root / 'candidate.png'
            image = Image.new('RGB', (64, 64), (40, 50, 60))
            image.save(reference)
            original = hashlib.sha256(reference.read_bytes()).hexdigest()
            masks = [{'x': 0, 'y': 0, 'width': 8, 'height': 8}]
            image.putpixel((4, 4), (255, 0, 0))
            image.save(candidate)
            self.assertTrue(compare(reference, candidate, masks, root))
            image.putpixel((32, 32), (255, 0, 0))
            image.save(candidate)
            self.assertFalse(compare(reference, candidate, masks, root))
            self.assertEqual(hashlib.sha256(reference.read_bytes()).hexdigest(), original)
            self.assertTrue((root / 'scene-diff.png').exists())


if __name__ == '__main__':
    unittest.main()
