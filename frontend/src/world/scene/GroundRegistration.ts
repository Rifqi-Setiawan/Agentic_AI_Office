import { gridToScreen, HALF_HEIGHT, HALF_WIDTH } from '../projection';
import type { TiledMapDoc } from '../types';
import type { GroundSurfaceDefinition, SpriteAtlas } from './AssetRegistry';

export type GroundPoint = [number, number];
export type GroundQuad = [GroundPoint, GroundPoint, GroundPoint, GroundPoint];
export type GroundTriangle = [GroundPoint, GroundPoint, GroundPoint];
export type AffineMatrix = [number, number, number, number, number, number];
export interface GroundCell { gx: number; gy: number; sprite: string; }
export interface GroundPatch { gx: number; gy: number; span: number; }
export interface GroundMaterialPlan {
  surface: GroundSurfaceDefinition; layer: 'floor' | 'overlay'; cells: GroundCell[]; patches: GroundPatch[];
}
export interface RetainedGroundSprite {
  id: string; sprite: string; gx: number; gy: number;
  source: { x: number; y: number; w: number; h: number };
  target: { x: number; y: number; width: number; height: number };
}
export interface GroundSurfacePlan {
  materials: GroundMaterialPlan[];
  retained: RetainedGroundSprite[];
  bounds: { x: number; y: number; width: number; height: number };
  coveredCells: number;
}

/** The same low objects baked by export_dom_preview.py. They must be restored
 * after new floor materials, rather than being erased by an opaque floor. */
export const BAKED_GROUND_SPRITES = new Set([
  'furniture_prayer_rug_shaf.png', 'furniture_ground_shadow.png',
  'furniture_pool_basin.png', 'furniture_pool_water.png',
]);
const PROTECTED_Z08_FLOOR = 'tile_floor_z08_dev_pods.png';
const POOL_FLOOR = 'tile_floor_pool_water.png';

/** Tile centres stay at gridToScreen(gx, gy). A span of one is exactly 64×32. */
export function groundDiamond(gx: number, gy: number, span = 1): GroundQuad {
  const { x, y } = gridToScreen(gx, gy);
  return [[x, y - HALF_HEIGHT * span], [x + HALF_WIDTH * span, y],
    [x, y + HALF_HEIGHT * span], [x - HALF_WIDTH * span, y]];
}

export function projectGroundPoint(matrix: AffineMatrix, [x, y]: GroundPoint): GroundPoint {
  const [a, b, c, d, tx, ty] = matrix;
  return [a * x + c * y + tx, b * x + d * y + ty];
}

/** An affine per triangle registers all four corners of an imperfect source
 * diamond. One whole-image transform would miss the fourth corner. */
export function triangleAffine(source: GroundTriangle, target: GroundTriangle): AffineMatrix {
  const [[x0, y0], [x1, y1], [x2, y2]] = source;
  const [[u0, v0], [u1, v1], [u2, v2]] = target;
  const dx1 = x1 - x0, dy1 = y1 - y0, dx2 = x2 - x0, dy2 = y2 - y0;
  const determinant = dx1 * dy2 - dx2 * dy1;
  if (!Number.isFinite(determinant) || Math.abs(determinant) < 1e-9) throw new Error('Degenerate ground source triangle');
  const a = ((u1 - u0) * dy2 - (u2 - u0) * dy1) / determinant;
  const c = (dx1 * (u2 - u0) - dx2 * (u1 - u0)) / determinant;
  const b = ((v1 - v0) * dy2 - (v2 - v0) * dy1) / determinant;
  const d = (dx1 * (v2 - v0) - dx2 * (v1 - v0)) / determinant;
  const matrix: AffineMatrix = [a, b, c, d, u0 - a * x0 - c * y0, v0 - b * x0 - d * y0];
  if (!matrix.every(Number.isFinite) || a * d - b * c <= 0) throw new Error('Ground registration must not reflect the source');
  return matrix;
}

export function registerGroundQuad(source: GroundQuad, target: GroundQuad) {
  return ([[0, 1, 2], [0, 2, 3]] as const).map(indices => {
    const from = indices.map(index => source[index]) as GroundTriangle;
    const to = indices.map(index => target[index]) as GroundTriangle;
    return { source: from, target: to, matrix: triangleAffine(from, to) };
  });
}

function validateSurface(surface: GroundSurfaceDefinition) {
  if (surface.floorSprites.length && surface.overlaySprites?.length)
    throw new Error(`Ground material cannot mix floor and overlay selectors: ${surface.id}`);
  if (surface.overlaySprites?.some(sprite => !BAKED_GROUND_SPRITES.has(sprite)))
    throw new Error(`Unsupported baked ground overlay selector: ${surface.id}`);
  if (!Number.isInteger(surface.repeatTiles) || surface.repeatTiles < 1 || surface.repeatTiles > 16)
    throw new Error(`Invalid ground repeat size: ${surface.id}`);
  if (!/^#[\da-f]{6}$/i.test(surface.underlayColor)) throw new Error(`Invalid ground underlay: ${surface.id}`);
  if (surface.sourceSize.width <= 0 || surface.sourceSize.height <= 0 ||
      !surface.sourceQuad.every(([x, y]) => Number.isFinite(x) && Number.isFinite(y) &&
        x >= 0 && y >= 0 && x <= surface.sourceSize.width && y <= surface.sourceSize.height))
    throw new Error(`Invalid ground source coordinates: ${surface.id}`);
  registerGroundQuad(surface.sourceQuad, groundDiamond(0, 0));
}

/** Read-only plan from the live map, never a second hand-authored room layout.
 * Sprite selectors cannot replace the approved Z08 floor, even accidentally. */
export function planGroundSurfaces(map: TiledMapDoc, surfaces: GroundSurfaceDefinition[], atlas: SpriteAtlas): GroundSurfacePlan {
  const names = new Map(map.tilesets.flatMap(tileset => (tileset.tiles ?? [])
    .filter(tile => tile.image).map(tile => [tileset.firstgid + tile.id, tile.image!] as const)));
  const assignments = new Map<string, GroundMaterialPlan>();
  const overlays = new Map<string, GroundMaterialPlan>();
  const ids = new Set<string>();
  const materials = surfaces.map(surface => {
    validateSurface(surface);
    if (ids.has(surface.id)) throw new Error(`Duplicate ground material: ${surface.id}`);
    ids.add(surface.id);
    const material: GroundMaterialPlan = { surface, layer: surface.overlaySprites?.length ? 'overlay' : 'floor', cells: [], patches: [] };
    for (const sprite of surface.floorSprites) {
      if (sprite === PROTECTED_Z08_FLOOR) continue;
      if (assignments.has(sprite)) throw new Error(`Ambiguous floor material: ${sprite}`);
      assignments.set(sprite, material);
    }
    for (const sprite of surface.overlaySprites ?? []) {
      if (overlays.has(sprite)) throw new Error(`Ambiguous ground overlay material: ${sprite}`);
      overlays.set(sprite, material);
    }
    return material;
  });
  const floor = map.layers.find(layer => layer.name === 'floor')?.data ?? [];
  const covered = new Set<number>();
  floor.forEach((gid, index) => {
    const sprite = names.get(gid), material = sprite ? assignments.get(sprite) : undefined;
    if (!material || !sprite) return;
    material.cells.push({ gx: index % map.width, gy: Math.floor(index / map.width), sprite });
    covered.add(index);
  });
  const furniture = map.layers.find(layer => layer.name === 'furniture')?.data ?? [];
  furniture.forEach((gid, index) => {
    const sprite = names.get(gid), material = sprite ? overlays.get(sprite) : undefined;
    // Only overlay cells whose base was regenerated. This excludes Z08 and
    // prevents a lone optional rug from leaking unrelated baked floor art.
    if (!material || !sprite || !covered.has(index)) return;
    material.cells.push({ gx: index % map.width, gy: Math.floor(index / map.width), sprite });
  });
  for (const material of materials) {
    const span = material.surface.repeatTiles, seen = new Set<string>();
    for (const cell of material.cells) {
      // Patch boundaries are half a tile outside the integer centres, so no
      // patch or material edge can move a doorway, collision cell or slot.
      const gx = Math.floor(cell.gx / span) * span, gy = Math.floor(cell.gy / span) * span;
      const key = `${gx},${gy}`;
      if (!seen.has(key)) { material.patches.push({ gx, gy, span }); seen.add(key); }
    }
  }
  const retained: RetainedGroundSprite[] = [];
  const scale = atlas.meta.exportScale ?? 1;
  if (!Number.isFinite(scale) || scale <= 0) throw new Error('Invalid ground atlas scale');
  furniture.forEach((gid, index) => {
    const sprite = names.get(gid);
    if (!sprite || !BAKED_GROUND_SPRITES.has(sprite) || !covered.has(index)) return;
    // New rug material replaces only matching canonical furniture cells.
    // If absent from an older manifest, the atlas restoration remains intact.
    if (overlays.has(sprite)) return;
    // Generated O01 already occupies these exact water cells. Basin, coping
    // and swim slots remain canonical; do not paint old water over the new art.
    if (sprite === 'furniture_pool_water.png' && assignments.has(POOL_FLOOR)) return;
    const entry = atlas.frames[sprite];
    if (!entry || entry.rotated) throw new Error(`Unsupported retained ground frame: ${sprite}`);
    const gx = index % map.width, gy = Math.floor(index / map.width), { x, y } = gridToScreen(gx, gy);
    retained.push({ id: `retained-${index}`, sprite, gx, gy, source: entry.frame,
      target: { x: x + (entry.spriteSourceSize.x - entry.sourceSize.w / 2) / scale,
        y: y + (entry.spriteSourceSize.y - entry.sourceSize.h / 2) / scale,
        width: entry.frame.w / scale, height: entry.frame.h / scale } });
  });
  retained.sort((a, b) => a.gx + a.gy - b.gx - b.gy || a.gy - b.gy);
  const edge = [groundDiamond(0, 0)[0], groundDiamond(map.width - 1, 0)[1],
    groundDiamond(map.width - 1, map.height - 1)[2], groundDiamond(0, map.height - 1)[3]];
  const x = Math.min(...edge.map(point => point[0])), y = Math.min(...edge.map(point => point[1]));
  const visible = materials.filter(material => material.cells.length);
  return { materials: [...visible.filter(material => material.layer === 'floor'),
    ...visible.filter(material => material.layer === 'overlay')], retained, coveredCells: covered.size,
    bounds: { x, y, width: Math.max(...edge.map(point => point[0])) - x, height: Math.max(...edge.map(point => point[1])) - y } };
}
