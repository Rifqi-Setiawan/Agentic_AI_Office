"""Compare an immutable reference to a fresh capture; mask only declared HUD boxes."""
import argparse
import hashlib
import json
from pathlib import Path
from PIL import Image, ImageChops, ImageDraw


def compare(reference, candidate, masks, output):
    original_hash = hashlib.sha256(reference.read_bytes()).hexdigest()
    expected = Image.open(reference).convert('RGB')
    actual = Image.open(candidate).convert('RGB')
    report = {'reference_sha256': original_hash, 'candidate_sha256': hashlib.sha256(candidate.read_bytes()).hexdigest(), 'masks': masks, 'reference_size': expected.size, 'candidate_size': actual.size}
    if expected.size != actual.size:
        report.update(passed=False, reason='dimensions differ')
    else:
        for image in [expected, actual]:
            draw = ImageDraw.Draw(image)
            for box in masks:
                draw.rectangle([box['x'], box['y'], box['x'] + box['width'], box['y'] + box['height']], fill=(0, 0, 0))
        diff = ImageChops.difference(expected, actual)
        # Small channel differences from rasterization are tolerated, never world movement or feature changes.
        changed = sum(max(pixel) > 8 for pixel in diff.getdata())
        report.update(passed=changed == 0, changed_pixels=changed, total_pixels=expected.width * expected.height, channel_tolerance=8)
        diff.save(output / 'scene-diff.png')
        expected.save(output / 'reference-masked.png')
        actual.save(output / 'candidate-masked.png')
    assert hashlib.sha256(reference.read_bytes()).hexdigest() == original_hash
    (output / 'comparison.json').write_text(json.dumps(report, indent=2))
    print(json.dumps(report))
    return report['passed']


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('reference', type=Path)
    parser.add_argument('candidate', type=Path)
    parser.add_argument('masks', type=Path)
    parser.add_argument('output', type=Path)
    args = parser.parse_args()
    raise SystemExit(0 if compare(args.reference, args.candidate, json.loads(args.masks.read_text()), args.output) else 1)
