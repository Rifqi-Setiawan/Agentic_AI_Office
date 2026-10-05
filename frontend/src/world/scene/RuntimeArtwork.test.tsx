import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { applyPropArtwork, propArtworkFile, type DepthProp, type GroundSurfaceDefinition } from './AssetRegistry';
import { SceneProp } from './SceneSprites';
import { loadGroundSurfaceImage } from './GroundSurfaces';

const prop: DepthProp = { id: 'sample', sprite: 'sample.png', file: '/sample.png',
  gx: 3, gy: 4, x: 1056, y: 176, z: 7010,
  bounds: { x: 1036, y: 146, width: 40, height: 30 },
  artClipPath: 'polygon(0px 0px,40px 0px,40px 30px)' };
const packed = { ...prop, runtimeFile: '/sample.lossless.webp' };
const atlas = { frames: {}, meta: { image: '', size: { w: 1, h: 1 } } };
const surface: GroundSurfaceDefinition = { id: 'ground', file: '/ground.png', runtimeFile: '/ground.lossless.webp',
  sourceSize: { width: 1536, height: 1024 }, sourceQuad: [[768, 0], [1536, 512], [768, 1024], [0, 512]],
  floorSprites: ['floor.png'], repeatTiles: 2, underlayColor: '#789' };
const image = { naturalWidth: 1536, naturalHeight: 1024 } as HTMLImageElement;

describe('verified optional runtime artwork', () => {
  it('defaults to canonical PNG and preserves explicit night artwork', () => {
    expect(propArtworkFile(prop)).toBe(prop.file);
    expect(propArtworkFile(packed)).toBe(packed.runtimeFile);
    expect(propArtworkFile(packed, true)).toBe(packed.runtimeFile);
    expect(propArtworkFile({ ...packed, nightFile: '/night.png' }, true)).toBe('/night.png');
    expect(propArtworkFile({ ...prop, file: undefined })).toBeUndefined();
  });

  it.each([false, true])('changes only the rendered URL for registered planes=%s', layered => {
    const original = layered ? { ...prop, artLayers: [{ id: 'source-plane', width: 1536, height: 1024,
      clipPath: 'polygon(0px 0px,1536px 0px,1536px 1024px)', matrix: [.1, 0, 0, .1, -1, -2] }] } : prop;
    const before = JSON.stringify(original);
    const baseline = renderToStaticMarkup(<SceneProp prop={original} atlas={atlas} />);
    const runtime = renderToStaticMarkup(<SceneProp prop={{ ...original, runtimeFile: packed.runtimeFile }} atlas={atlas} />);
    expect(runtime.replaceAll(packed.runtimeFile, prop.file!)).toBe(baseline);
    expect(runtime).toContain(packed.runtimeFile);
    expect(JSON.stringify(original)).toBe(before);
  });

  it('uses the same URL for DomWorld repaint and initial SceneProp, including day/night round trips', () => {
    const nightProp = { ...packed, nightFile: '/night.png' };
    const el = { style: { backgroundImage: '' }, dataset: {} } as unknown as HTMLElement;
    for (const night of [false, false, true, true, false]) {
      applyPropArtwork(el, nightProp, night);
      expect(el.dataset.assetFile).toBe(night ? '/night.png' : packed.runtimeFile);
      expect(el.style.backgroundImage).toBe(`url("${propArtworkFile(nightProp, night)}")`);
    }
    applyPropArtwork(el, prop, false);
    expect(el.dataset.assetFile).toBe(prop.file);
  });

  it('updates each registered plane without painting the unclipped wrapper', () => {
    const planes = [{ style: { backgroundImage: '' } }, { style: { backgroundImage: '' } }];
    const el = { style: { backgroundImage: 'stale' }, dataset: {}, querySelectorAll: () => planes } as unknown as HTMLElement;
    applyPropArtwork(el, { ...packed, artLayers: [{ id: 'plane', width: 1536, height: 1024,
      clipPath: '', matrix: [1, 0, 0, 1, 0, 0] }] }, false);
    expect(el.style.backgroundImage).toBe('none');
    planes.forEach(plane => expect(plane.style.backgroundImage).toBe(`url("${packed.runtimeFile}")`));
  });

  it('loads runtime ground pixels at original dimensions without changing the source definition', async () => {
    const original = JSON.stringify(surface), loader = vi.fn(async () => image);
    expect(await loadGroundSurfaceImage(surface, loader)).toBe(image);
    expect(loader.mock.calls).toEqual([[surface.runtimeFile]]);
    expect(JSON.stringify(surface)).toBe(original);
  });

  it.each(['missing', 'size'] as const)('retries original PNG if runtime ground is %s', async failure => {
    const loader = vi.fn(async (file: string) => {
      if (file === surface.runtimeFile) {
        if (failure === 'missing') throw new Error('Missing derivative');
        return { naturalWidth: 1, naturalHeight: 1 } as HTMLImageElement;
      }
      return image;
    });
    expect(await loadGroundSurfaceImage(surface, loader)).toBe(image);
    expect(loader.mock.calls).toEqual([[surface.runtimeFile], [surface.file]]);
  });

  it('loads PNG directly when runtimeFile is absent and preserves source failure diagnostics', async () => {
    const loader = vi.fn(async () => image);
    expect(await loadGroundSurfaceImage({ ...surface, runtimeFile: undefined }, loader)).toBe(image);
    expect(loader.mock.calls).toEqual([[surface.file]]);
    await expect(loadGroundSurfaceImage(surface, async () => { throw new Error('Source unavailable'); }))
      .rejects.toThrow('Source unavailable');
  });
});
