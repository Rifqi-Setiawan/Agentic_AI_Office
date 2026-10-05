"""Pack only new Office candidate PNGs into verified, full-size lossless WebP.

``pack_runtime_art(manifest, public_root)`` returns a copied manifest and ledger.
The caller owns writing both. Source ``file`` URLs, geometry, provenance and PNG
bytes are never changed. Only successfully verified, smaller encodings receive
``runtimeFile``. Historical Z08/foundation/actor artwork is outside the allowlist.

Pillow's ``exact=True`` is essential: RGB under alpha zero must also be retained.
This reduces transfer bytes, not dimensions or decoded RGBA memory. Browser
full-resolution decode memory and visual performance remain unverified.
"""
from __future__ import annotations

import copy
import hashlib
from io import BytesIO
import json
from pathlib import Path, PurePosixPath
import tempfile

from PIL import Image


CANDIDATE = '/visual-migration/illustrated-office-v1'
ALLOWED_DIRECTORIES = tuple(f'{CANDIDATE}/{name}/' for name in ('furniture', 'surfaces', 'seating'))
G01 = '/visual-migration/environment-architecture-v1/G01-window-glass.png'
ENCODING = dict(format='WEBP', lossless=True, exact=True, method=6)


def _sha(data):
    return hashlib.sha256(data).hexdigest()


def _eligible(file):
    return isinstance(file, str) and file.endswith('.png') and (
        file == G01 or file.startswith(ALLOWED_DIRECTORIES))


def _public_path(file, public_root):
    url = PurePosixPath(file)
    if not url.is_absolute() or '..' in url.parts or str(url) != file:
        raise ValueError('Source URL must be a canonical public-root PNG path')
    root = Path(public_root).resolve()
    source = root / file.lstrip('/')
    if not source.resolve().is_relative_to(root):
        raise ValueError('Source PNG resolves outside public_root')
    return source


def _read_rgba(data):
    with Image.open(BytesIO(data)) as image:
        return image.convert('RGBA')


def _same_pixels(data, size, pixels):
    with _read_rgba(data) as decoded:
        return decoded.size == size and decoded.tobytes() == pixels


def _write_atomic(path, data):
    """Replace only a derivative/sidecar after its payload has been verified."""
    temporary = None
    try:
        with tempfile.NamedTemporaryFile(dir=path.parent, prefix=f'.{path.name}.', delete=False) as output:
            temporary = Path(output.name)
            output.write(data)
        temporary.replace(path)
    finally:
        if temporary is not None:
            temporary.unlink(missing_ok=True)


def _pack_one(file, public_root):
    record = dict(sourceFile=file, runtimeFile=None, sourceSha256=None, runtimeSha256=None,
                  sourceDecodedRgbaSha256=None, runtimeDecodedRgbaSha256=None,
                  nativeSize=None, sourceBytes=0, runtimeBytes=None, effectiveRuntimeBytes=0,
                  savedBytes=0, savedPercent=0.0, fullDecodedRgbaEqual=False,
                  sourceBytesPreserved=True, status='png-fallback')
    try:
        source = _public_path(file, public_root)
        source_data = source.read_bytes()
        source_hash = _sha(source_data)
        record.update(sourceSha256=source_hash, sourceBytes=len(source_data),
                      effectiveRuntimeBytes=len(source_data))
        with _read_rgba(source_data) as image:
            pixels, size = image.tobytes(), image.size
            pixel_hash = _sha(pixels)
            record.update(nativeSize=list(size), sourceDecodedRgbaSha256=pixel_hash)
            runtime = source.with_suffix('.lossless.webp')
            metadata_path = runtime.with_suffix(runtime.suffix + '.json')
            if runtime.is_symlink() or metadata_path.is_symlink():
                raise ValueError('Refusing to replace a symlink at a derivative destination')
            runtime_file = str(PurePosixPath(file).with_suffix('.lossless.webp'))
            runtime_data, reused = None, False
            # A cached filename alone proves nothing. Validate its recorded
            # source hash, actual file hash AND every decoded RGBA byte again.
            if runtime.exists() and metadata_path.exists():
                try:
                    meta = json.loads(metadata_path.read_text(encoding='utf-8'))
                    cached = runtime.read_bytes()
                    if (meta.get('sourceSha256') == source_hash and
                            meta.get('runtimeSha256') == _sha(cached) and
                            meta.get('sourceDecodedRgbaSha256') == pixel_hash and
                            meta.get('runtimeDecodedRgbaSha256') == pixel_hash and
                            meta.get('nativeSize') == list(size) and
                            meta.get('encoding') == ENCODING and
                            _same_pixels(cached, size, pixels)):
                        runtime_data, reused = cached, True
                except (OSError, ValueError, TypeError):
                    pass  # A stale/corrupt derivative is safely regenerated.
            if runtime_data is None:
                encoded = BytesIO()
                image.save(encoded, **ENCODING)
                runtime_data = encoded.getvalue()
                if not _same_pixels(runtime_data, size, pixels):
                    raise ValueError('Lossless encoder changed decoded RGBA bytes')
            if _sha(source.read_bytes()) != source_hash:
                raise ValueError('Source PNG changed during runtime packing')
            if len(runtime_data) >= len(source_data):
                record['reason'] = 'Lossless WebP is not smaller; original PNG retained'
                return record
            runtime_hash = _sha(runtime_data)
            metadata = dict(sourceFile=file, runtimeFile=runtime_file, sourceSha256=source_hash,
                            runtimeSha256=runtime_hash, sourceDecodedRgbaSha256=pixel_hash,
                            runtimeDecodedRgbaSha256=pixel_hash, nativeSize=list(size),
                            sourceBytes=len(source_data), runtimeBytes=len(runtime_data),
                            fullDecodedRgbaEqual=True, encoding=ENCODING)
            if not reused:
                _write_atomic(runtime, runtime_data)
                _write_atomic(metadata_path, (json.dumps(metadata, indent=2) + '\n').encode('utf-8'))
            saved = len(source_data) - len(runtime_data)
            record.update(runtimeFile=runtime_file, runtimeSha256=runtime_hash,
                          runtimeDecodedRgbaSha256=pixel_hash, runtimeBytes=len(runtime_data),
                          effectiveRuntimeBytes=len(runtime_data), savedBytes=saved,
                          savedPercent=round(saved / len(source_data) * 100, 4),
                          fullDecodedRgbaEqual=True, status='reused' if reused else 'packed')
    except Exception as error:
        # Optional optimization must never strand source artwork. If a partial
        # write or verification fails, omit runtimeFile so rendering uses PNG.
        record['reason'] = f'{type(error).__name__}: {error}'
    return record


def pack_runtime_art(manifest, public_root):
    """Return (updated_manifest, ledger); add only verified runtimeFile fields.

    Files are packed once per unique source URL even when used by many props or
    planes. Existing derivatives are versioned by their recorded source hash and
    atomically replaced only when a newly supplied PNG requires it. No manifests
    are written, and the input object is not mutated.
    """
    updated = copy.deepcopy(manifest)
    uses = {}
    for collection in ('props', 'groundSurfaces'):
        for item in updated.get(collection, []):
            file = item.get('file')
            if _eligible(file):
                # Never retain a stale runtime link if this run cannot verify it.
                item.pop('runtimeFile', None)
                uses.setdefault(file, []).append((collection, item))
    records = []
    for file, targets in sorted(uses.items()):
        record = _pack_one(file, public_root)
        record['references'] = [f'{collection}:{item["id"]}' for collection, item in targets]
        if record['runtimeFile']:
            for _, item in targets:
                item['runtimeFile'] = record['runtimeFile']
        records.append(record)
    source_bytes = sum(record['sourceBytes'] for record in records)
    runtime_bytes = sum(record['effectiveRuntimeBytes'] for record in records)
    ledger = dict(schemaVersion=1, encoding=ENCODING, files=records,
                  summary=dict(sourceFiles=len(records), packedFiles=sum(r['status'] == 'packed' for r in records),
                               reusedFiles=sum(r['status'] == 'reused' for r in records),
                               fallbackFiles=sum(r['status'] == 'png-fallback' for r in records),
                               sourceBytes=source_bytes, runtimeBytes=runtime_bytes,
                               savedBytes=source_bytes-runtime_bytes,
                               savedPercent=round((source_bytes-runtime_bytes)/source_bytes*100, 4) if source_bytes else 0.0),
                  sourceBytesPreserved=True, sourcePixelsEdited=False, geometryChanged=False,
                  fullResolutionPreserved=True, fullResolutionDecodeMemoryVerified=False,
                  browserVisualQA=False,
                  limitations=['Full-resolution browser decode memory remains unverified; dimensions and RGBA memory are unchanged',
                               'Transfer-byte savings do not establish browser performance or visual acceptance'])
    return updated, ledger
