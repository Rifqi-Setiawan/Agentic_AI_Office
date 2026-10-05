import { memo, useEffect, useMemo, useRef } from 'react';
import type { TiledMapDoc } from '../types';
import type { GroundSurfaceDefinition, SpriteAtlas } from './AssetRegistry';
import { groundDiamond, planGroundSurfaces, registerGroundQuad, type GroundPoint,
  type GroundQuad, type GroundSurfacePlan } from './GroundRegistration';

const RENDER_SCALE = 2;

function polygon(context: CanvasRenderingContext2D, points: GroundPoint[]) {
  context.moveTo(...points[0]);
  points.slice(1).forEach(point => context.lineTo(...point));
  context.closePath();
}

/** Canvas is presentation only. No source bitmap is cropped, rewritten or
 * exported. One small transient cache per material avoids 1,328 DOM sprites
 * and repeated high-resolution image resampling on every camera frame. */
export function paintGroundPatch(context: CanvasRenderingContext2D, image: CanvasImageSource,
  source: GroundQuad, target: GroundQuad) {
  context.save();
  context.beginPath(); polygon(context, target); context.clip();
  for (const [index, triangle] of registerGroundQuad(source, target).entries()) {
    context.save();
    // Overlap only the shared diagonal by 0.35 logical px. The separate outer
    // diamond clip still rejects the PNG's alpha speckles and any overflow.
    const [top, , bottom] = target;
    const dx = bottom[0] - top[0], dy = bottom[1] - top[1], length = Math.hypot(dx, dy);
    const sign = index === 0 ? 1 : -1;
    const offset: GroundPoint = [-dy / length * .35 * sign, dx / length * .35 * sign];
    const shiftedTop: GroundPoint = [top[0] + offset[0], top[1] + offset[1]];
    const shiftedBottom: GroundPoint = [bottom[0] + offset[0], bottom[1] + offset[1]];
    const clip = index === 0 ? [top, target[1], bottom, shiftedBottom, shiftedTop]
      : [shiftedTop, shiftedBottom, bottom, target[3], top];
    context.beginPath(); polygon(context, clip); context.clip();
    context.transform(...triangle.matrix);
    context.drawImage(image, 0, 0);
    context.restore();
  }
  context.restore();
}

function loadImage(file: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`Ground image failed to load: ${file}`));
    image.src = file;
  });
}

/** Keep image lookup keyed by the original PNG. A missing or invalid optional
 * runtime encoding retries that unchanged source without changing geometry. */
export async function loadGroundSurfaceImage(surface: GroundSurfaceDefinition,
  imageLoader: (file: string) => Promise<HTMLImageElement> = loadImage) {
  if (surface.runtimeFile && surface.runtimeFile !== surface.file) {
    try {
      const image = await imageLoader(surface.runtimeFile);
      if (image.naturalWidth !== surface.sourceSize.width || image.naturalHeight !== surface.sourceSize.height)
        throw new Error(`Runtime ground image size differs from registered source: ${surface.id}`);
      return image;
    } catch {
      // The PNG is preserved specifically so failed derivatives can fall back.
    }
  }
  return imageLoader(surface.file);
}

export function paintGroundSurfaces(canvas: HTMLCanvasElement, plan: GroundSurfacePlan,
  images: ReadonlyMap<string, HTMLImageElement>, atlasImage: HTMLImageElement) {
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Ground canvas is unavailable');
  const { bounds } = plan;
  canvas.width = Math.ceil(bounds.width * RENDER_SCALE);
  canvas.height = Math.ceil(bounds.height * RENDER_SCALE);
  context.scale(RENDER_SCALE, RENDER_SCALE);
  context.translate(-bounds.x, -bounds.y);
  context.imageSmoothingEnabled = true;
  for (const material of plan.materials) {
    const surface = material.surface, image = images.get(surface.file);
    if (!image) throw new Error(`Missing ground image: ${surface.file}`);
    if (image.naturalWidth !== surface.sourceSize.width || image.naturalHeight !== surface.sourceSize.height)
      throw new Error(`Ground image size differs from registered source: ${surface.id}`);
    const width = 64 * surface.repeatTiles, height = 32 * surface.repeatTiles;
    const cache = document.createElement('canvas');
    cache.width = width * RENDER_SCALE; cache.height = height * RENDER_SCALE;
    const patch = cache.getContext('2d');
    if (!patch) throw new Error('Ground material cache is unavailable');
    patch.scale(RENDER_SCALE, RENDER_SCALE);
    paintGroundPatch(patch, image, surface.sourceQuad,
      [[width / 2, 0], [width, height / 2], [width / 2, height], [0, height / 2]]);
    context.save();
    context.beginPath();
    material.cells.forEach(cell => polygon(context, groundDiamond(cell.gx, cell.gy)));
    context.clip();
    // A matching opaque base prevents old floor patterns and baked furniture
    // leaking through generated alpha. Overlay masks cover only their cells.
    context.fillStyle = surface.underlayColor;
    context.fillRect(bounds.x, bounds.y, bounds.width, bounds.height);
    for (const tile of material.patches) {
      const diamond = groundDiamond(tile.gx + (tile.span - 1) / 2, tile.gy + (tile.span - 1) / 2, tile.span);
      context.drawImage(cache, diamond[3][0], diamond[0][1], width, height);
    }
    context.restore();
    // Release the transient pixel buffer; the visible canvas is retained.
    cache.width = 0; cache.height = 0;
  }
  for (const object of plan.retained) {
    const { source, target } = object;
    context.drawImage(atlasImage, source.x, source.y, source.w, source.h,
      target.x, target.y, target.width, target.height);
  }
}

/** A render owns its canvas only until cleanup. Late image loads from an older
 * render must not paint over a newer plan or revive an unmounted canvas. */
export function startGroundSurfaceRender(canvas: HTMLCanvasElement, plan: GroundSurfacePlan,
  imageLoader: (file: string) => Promise<HTMLImageElement> = loadImage) {
  let disposed = false;
  canvas.dataset.surfaceStatus = 'loading';
  delete canvas.dataset.surfaceError;
  const surfaces = [...new Map(plan.materials.map(({ surface }) => [surface.file, surface])).values()];
  // Use the exact atlas image used by the baseline exporter and SceneProp.
  Promise.all([Promise.all(surfaces.map(async surface =>
    [surface.file, await loadGroundSurfaceImage(surface, imageLoader)] as const)),
    imageLoader('/sprites/environment.png')]).then(([loaded, atlasImage]) => {
    if (disposed) return;
    paintGroundSurfaces(canvas, plan, new Map(loaded), atlasImage);
    canvas.dataset.surfaceStatus = 'ready';
  }).catch(error => {
    if (disposed) return;
    canvas.width = 0; canvas.height = 0; // The complete canonical floor remains beneath.
    canvas.dataset.surfaceStatus = 'fallback';
    canvas.dataset.surfaceError = String(error);
  });
  return () => { disposed = true; canvas.width = 0; canvas.height = 0; };
}

export const GroundSurfaces = memo(({ map, surfaces, atlas }: {
  map: TiledMapDoc; surfaces?: GroundSurfaceDefinition[]; atlas: SpriteAtlas;
}) => {
  const element = useRef<HTMLCanvasElement>(null);
  const { plan, error } = useMemo(() => {
    try {
      return { plan: surfaces?.length ? planGroundSurfaces(map, surfaces, atlas) : null, error: '' };
    } catch (error) {
      // A bad optional presentation manifest must not unmount the logical world
      // or erase its canonical floor before the image-loading fallback can run.
      return { plan: null, error: String(error) };
    }
  }, [map, surfaces, atlas]);
  useEffect(() => {
    const canvas = element.current;
    if (!plan || !canvas) return;
    return startGroundSurfaceRender(canvas, plan);
  }, [plan]);
  if (error) return <canvas ref={element} className="registered-ground-surfaces" aria-hidden="true"
    width={0} height={0} data-surface-status="fallback" data-surface-error={error} style={{ display: 'none' }} />;
  if (!plan) return null;
  return <canvas ref={element} className="registered-ground-surfaces" aria-hidden="true"
    data-ground-materials={plan.materials.length} data-ground-cells={plan.coveredCells}
    data-ground-overlay-cells={plan.materials.filter(material => material.layer === 'overlay')
      .reduce((total, material) => total + material.cells.length, 0)}
    data-retained-ground-sprites={plan.retained.length}
    style={{ position: 'absolute', left: plan.bounds.x, top: plan.bounds.y, width: plan.bounds.width,
      height: plan.bounds.height, zIndex: 0, pointerEvents: 'none', imageRendering: 'auto' }} />;
});
GroundSurfaces.displayName = 'GroundSurfaces';
