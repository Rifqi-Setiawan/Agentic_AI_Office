import { afterEach, describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';
import type { TiledMapDoc } from '../types';
import type { PreviewAssets, SpriteAtlas } from './AssetRegistry';
import { planGroundSurfaces } from './GroundRegistration';
import { GroundSurfaces, startGroundSurfaceRender } from './GroundSurfaces';

const publicRoot = path.resolve(__dirname, '../../../public');
const read = <T,>(file: string): T => JSON.parse(fs.readFileSync(path.join(publicRoot, file), 'utf8')) as T;
const assets = read<PreviewAssets>('visual-migration/illustrated-office-v1/assets.json');
const surfaces = assets.groundSurfaces!;
const atlas = read<SpriteAtlas>('sprites/environment.json');
const map = read<TiledMapDoc>('maps/floor1.tmj');
const plan = planGroundSurfaces(map, surfaces, atlas);

function mockCanvas() {
  const context = { save: vi.fn(), restore: vi.fn(), beginPath: vi.fn(), moveTo: vi.fn(), lineTo: vi.fn(),
    closePath: vi.fn(), clip: vi.fn(), transform: vi.fn(), drawImage: vi.fn(), scale: vi.fn(),
    translate: vi.fn(), fillRect: vi.fn(), fillStyle: '', imageSmoothingEnabled: false };
  const canvas = { width: 0, height: 0, dataset: {} as Record<string, string>, getContext: () => context };
  return { canvas: canvas as unknown as HTMLCanvasElement, context };
}

function loadedImage(file: string) {
  const surface = surfaces.find(surface => surface.file === file || surface.runtimeFile === file);
  return { naturalWidth: surface?.sourceSize.width ?? atlas.meta.size.w,
    naturalHeight: surface?.sourceSize.height ?? atlas.meta.size.h } as HTMLImageElement;
}

function deferredLoader() {
  const pending: { file: string; resolve: (image: HTMLImageElement) => void; reject: (error: Error) => void }[] = [];
  const loader = (file: string) => new Promise<HTMLImageElement>((resolve, reject) => pending.push({ file, resolve, reject }));
  return { loader, resolveAll: () => pending.forEach(job => job.resolve(loadedImage(job.file))),
    rejectAll: () => pending.forEach(job => job.reject(new Error('Late image failure'))) };
}

afterEach(() => vi.unstubAllGlobals());

describe('optional ground failure isolation and render ownership', () => {
  it('keeps invalid material plans in fallback instead of throwing out of render', () => {
    const markup = renderToStaticMarkup(<GroundSurfaces map={map} atlas={atlas}
      surfaces={[{ ...surfaces[0], repeatTiles: 0 }]} />);
    expect(markup).toContain('data-surface-status="fallback"');
    expect(markup).toContain('Invalid ground repeat size');
    expect(markup).toContain('width="0"'); expect(markup).toContain('height="0"');
    expect(markup).toContain('display:none');
  });

  it('isolates unsupported retained atlas frames without changing the atlas', () => {
    const incomplete = { ...atlas, frames: { ...atlas.frames } };
    delete incomplete.frames['furniture_prayer_rug_shaf.png'];
    const markup = renderToStaticMarkup(<GroundSurfaces map={map} atlas={incomplete}
      surfaces={surfaces.filter(surface => !surface.overlaySprites?.length)} />);
    expect(markup).toContain('data-surface-status="fallback"');
    expect(markup).toContain('Unsupported retained ground frame');
    expect(atlas.frames['furniture_prayer_rug_shaf.png']).toBeDefined();
  });

  it('does not need the legacy rug atlas frame when the new overlay is present', () => {
    const incomplete = { ...atlas, frames: { ...atlas.frames } };
    delete incomplete.frames['furniture_prayer_rug_shaf.png'];
    const markup = renderToStaticMarkup(<GroundSurfaces map={map} atlas={incomplete} surfaces={surfaces} />);
    expect(markup).not.toContain('data-surface-status="fallback"');
    expect(markup).toContain('data-ground-overlay-cells="14"');
    expect(markup).toContain('data-retained-ground-sprites="0"');
  });

  it('reveals the complete original floor and its 14 baked rugs when the new rug image fails', async () => {
    const { canvas, context } = mockCanvas();
    const rug = surfaces.find(surface => surface.id === 'F16')!;
    const cleanup = startGroundSurfaceRender(canvas, plan, async file => {
      if (file === rug.file || file === rug.runtimeFile) throw new Error('Rug unavailable');
      return loadedImage(file);
    });
    await vi.waitFor(() => expect(canvas.dataset.surfaceStatus).toBe('fallback'));
    expect(canvas.dataset.surfaceError).toContain('Rug unavailable');
    expect([canvas.width, canvas.height]).toEqual([0, 0]);
    expect(context.drawImage).not.toHaveBeenCalled();
    cleanup();
  });

  it('releases the pixel buffer and exposes a diagnostic when an image fails', async () => {
    const { canvas, context } = mockCanvas();
    const cleanup = startGroundSurfaceRender(canvas, plan, async () => { throw new Error('Image unavailable'); });
    expect(canvas.dataset.surfaceStatus).toBe('loading');
    await vi.waitFor(() => expect(canvas.dataset.surfaceStatus).toBe('fallback'));
    expect(canvas.dataset.surfaceError).toContain('Image unavailable');
    expect([canvas.width, canvas.height]).toEqual([0, 0]);
    expect(context.drawImage).not.toHaveBeenCalled();
    cleanup();
  });

  it('also falls back when painting fails after a successful image load', async () => {
    const { canvas } = mockCanvas();
    const cleanup = startGroundSurfaceRender(canvas, plan, async () => ({ naturalWidth: 1, naturalHeight: 1 }) as HTMLImageElement);
    await vi.waitFor(() => expect(canvas.dataset.surfaceStatus).toBe('fallback'));
    expect(canvas.dataset.surfaceError).toContain('Ground image size differs');
    expect([canvas.width, canvas.height]).toEqual([0, 0]);
    cleanup();
  });

  it('does not paint images that finish after unmount', async () => {
    const { canvas, context } = mockCanvas(), images = deferredLoader();
    const cleanup = startGroundSurfaceRender(canvas, plan, images.loader);
    cleanup(); images.resolveAll();
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(context.drawImage).not.toHaveBeenCalled();
    expect([canvas.width, canvas.height]).toEqual([0, 0]);
  });

  it.each(['resolve', 'reject'] as const)('ignores an older render that completes with %s after the next render', async result => {
    const { canvas, context } = mockCanvas(), older = deferredLoader(), newer = deferredLoader();
    vi.stubGlobal('document', { createElement: () => mockCanvas().canvas });
    canvas.dataset.surfaceError = 'Previous failure';
    const cleanupOlder = startGroundSurfaceRender(canvas, plan, older.loader);
    expect(canvas.dataset.surfaceError).toBeUndefined();
    cleanupOlder();
    const cleanupNewer = startGroundSurfaceRender(canvas, plan, newer.loader);
    newer.resolveAll();
    await vi.waitFor(() => expect(canvas.dataset.surfaceStatus).toBe('ready'));
    const drawCount = context.drawImage.mock.calls.length;
    expect(drawCount).toBeGreaterThan(0);
    if (result === 'resolve') older.resolveAll(); else older.rejectAll();
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(context.drawImage).toHaveBeenCalledTimes(drawCount);
    expect(canvas.dataset.surfaceStatus).toBe('ready');
    expect(canvas.dataset.surfaceError).toBeUndefined();
    expect([canvas.width, canvas.height]).toEqual([4864, 2432]);
    cleanupNewer();
    expect([canvas.width, canvas.height]).toEqual([0, 0]);
  });
});
