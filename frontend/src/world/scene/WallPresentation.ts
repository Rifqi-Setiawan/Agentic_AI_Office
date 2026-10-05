import type { DepthProp, PreviewAssets, RegisteredSpriteLayer } from './AssetRegistry';

/** Fixed architectural cutaway, independent of focus, zoom and actor position.
 * Only the two far exterior edges can be tall: their upward extrusion falls
 * outside the office. Every internal partition stays at or below a tile half-height
 * so rooms and both two-tile corridors remain readable at overview scale. */
export const WALL_PRESENTATION = Object.freeze({ exteriorHeight: 48, interiorHeight: 16, boundaryHeight: 12 });
type Point = readonly [number, number];

function silhouette(prop: DepthProp): Point[] {
  const match = /^polygon\((.*)\)$/.exec(prop.artClipPath ?? '');
  const points = match?.[1].split(',').map(pair => pair.trim().split(/\s+/).map(value => Number(value.replace(/px$/, ''))));
  if (!points || points.length !== 6 || points.some(point => point.length !== 2 || !point.every(Number.isFinite))) {
    throw new Error(`Invalid registered wall silhouette: ${prop.id}`);
  }
  return points as unknown as Point[];
}

/** Lower a vertical plane without scaling its isometric ground axis. Front and
 * end faces have different ground slopes; the cap is translated intact. A plain
 * scaleY would flatten the 2:1 footprint and open seams between wall modules. */
function lowerPlane(layer: RegisteredSpriteLayer, from: Point, to: Point, ratio: number, delta: number): RegisteredSpriteLayer {
  if (layer.id.startsWith('cap-')) return layer;
  const slope = (to[1] - from[1]) / (to[0] - from[0]);
  const shear = (1 - ratio) * slope;
  const translate = (1 - ratio) * (from[1] - slope * from[0]) - delta;
  const [a, b, c, d, tx, ty] = layer.matrix;
  return { ...layer, matrix: [a, shear * a + ratio * b, c, shear * c + ratio * d, tx, shear * tx + ratio * ty + translate] };
}

export function presentWall(prop: DepthProp): DepthProp {
  if (prop.wallPresentation || prop.artKind !== 'registered-foundation-wall') return prop;
  if ((prop.componentId !== 'W01' && prop.componentId !== 'W02') || !prop.artLayers?.length) return prop;
  // Registration order: ground start, ground end, ground end-back,
  // cap end-back, cap start-back, cap start-front. It is source-image agnostic.
  const points = silhouette(prop);
  const [start, end, endBack, , , topStart] = points;
  const sourceHeight = start[1] - topStart[1];
  if (!(sourceHeight > 0) || start[0] === end[0] || end[0] === endBack[0]) {
    throw new Error(`Invalid registered wall geometry: ${prop.id}`);
  }
  const normal = prop.componentId === 'W01' ? prop.gy : prop.gx;
  const exterior = normal === 0;
  const role = exterior ? 'exterior-backdrop' : 'interior-cutaway';
  // Do not raise a future asset that was already registered below the limit.
  // Z08 uses the approved half-grid room boundary. Its cap is closer to the
  // corridor centerline, so leave an additional 4px of sightline clearance.
  const interiorLimit = Number.isInteger(normal) ? WALL_PRESENTATION.interiorHeight : WALL_PRESENTATION.boundaryHeight;
  const height = Math.min(sourceHeight, exterior ? WALL_PRESENTATION.exteriorHeight : interiorLimit);
  const delta = sourceHeight - height, ratio = height / sourceHeight;
  const artLayers = prop.artLayers.map(layer => {
    if (!/^(front|cap|end)-[01]$/.test(layer.id)) throw new Error(`Unknown registered wall plane: ${prop.id}/${layer.id}`);
    return layer.id.startsWith('end-') ? lowerPlane(layer, end, endBack, ratio, delta) : lowerPlane(layer, start, end, ratio, delta);
  });
  const lowered = points.map(([x, y], index) => [x, index < 3 ? y - delta : y]);
  return {
    ...prop,
    bounds: { ...prop.bounds, y: prop.bounds.y + delta, height: prop.bounds.height - delta },
    artLayers,
    artClipPath: `polygon(${lowered.map(([x, y]) => `${x}px ${y}px`).join(',')})`,
    wallPresentation: { role, sourceHeight, height },
  };
}

/** Work on a presentation copy; source manifests and all logical geometry stay
 * untouched. The same bounds are passed to rendering and viewport culling. */
export function presentOfficeWalls(assets: PreviewAssets): PreviewAssets {
  return { ...assets, props: assets.props.map(presentWall) };
}
