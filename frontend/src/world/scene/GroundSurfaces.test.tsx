import { describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { renderToStaticMarkup } from 'react-dom/server';
import { GridMap } from '../../navigation/GridMap';
import { gridToScreen, HALF_HEIGHT, HALF_WIDTH, TILE_HEIGHT, TILE_WIDTH, WORLD_ORIGIN_X, WORLD_ORIGIN_Y } from '../projection';
import type { TiledMapDoc } from '../types';
import type { GroundSurfaceDefinition, PreviewAssets, SpriteAtlas } from './AssetRegistry';
import { groundDiamond, planGroundSurfaces, projectGroundPoint, registerGroundQuad,
  type GroundPoint, type GroundQuad } from './GroundRegistration';
import { GroundSurfaces, paintGroundPatch, paintGroundSurfaces } from './GroundSurfaces';

const publicRoot = path.resolve(__dirname, '../../../public');
const read = <T,>(file: string): T => JSON.parse(fs.readFileSync(path.join(publicRoot, file), 'utf8')) as T;
const root = 'visual-migration/illustrated-office-v1/';
const assets = read<PreviewAssets>(root + 'assets.json');
const surfaces = assets.groundSurfaces!;
const atlas = read<SpriteAtlas>('sprites/environment.json');
const map = read<TiledMapDoc>('maps/floor1.tmj');
const plan = planGroundSurfaces(map, surfaces, atlas);

function mockContext() {
  return { save: vi.fn(), restore: vi.fn(), beginPath: vi.fn(), moveTo: vi.fn(), lineTo: vi.fn(),
    closePath: vi.fn(), clip: vi.fn(), transform: vi.fn(), drawImage: vi.fn(), scale: vi.fn(),
    translate: vi.fn(), fillRect: vi.fn(), fillStyle: '', imageSmoothingEnabled: false };
}

describe('generated ground registration and source integrity', () => {
  it('uses five original PNGs byte-identically with measured native source quads', () => {
    const ledger = read<{ sourcePixelsEdited: boolean; logicalLayoutChanged: boolean; sources: {
      assetId: string; file: string; sourceSha256: string; sourcePixelsEdited: boolean;
      sourceCopiedByteIdentical: boolean; mirrored: boolean; sourceQuad: GroundQuad;
    }[] }>(root + 'ground-registration-ledger.json');
    expect(ledger.sourcePixelsEdited).toBe(false);
    expect(ledger.logicalLayoutChanged).toBe(false);
    expect(ledger.sources.map(source => source.assetId)).toEqual(['F01', 'F03', 'F04', 'O01', 'F16']);
    expect(surfaces).toHaveLength(5);
    for (const source of ledger.sources) {
      const file = fs.readFileSync(path.join(publicRoot, source.file));
      expect(createHash('sha256').update(file).digest('hex')).toBe(source.sourceSha256);
      expect(source.sourceCopiedByteIdentical).toBe(true);
      expect(source.sourcePixelsEdited).toBe(false);
      expect(source.mirrored).toBe(false);
      const surface = surfaces.find(candidate => candidate.id === source.assetId)!;
      expect(surface.sourceQuad).toEqual(source.sourceQuad);
      expect(file.subarray(1, 4).toString()).toBe('PNG');
      expect(file.readUInt32BE(16)).toBe(surface.sourceSize.width);
      expect(file.readUInt32BE(20)).toBe(surface.sourceSize.height);
      expect(surface.underlayColor).toMatch(/^#[\da-f]{6}$/i);
    }
  });

  it('registers all four material corners exactly, without changing the base projection or reflecting artwork', () => {
    expect([TILE_WIDTH, TILE_HEIGHT, WORLD_ORIGIN_X, WORLD_ORIGIN_Y]).toEqual([64, 32, 1088, 64]);
    expect(gridToScreen(0, 0)).toEqual({ x: 1088, y: 64 });
    expect(groundDiamond(0, 0)).toEqual([[1088, 48], [1120, 64], [1088, 80], [1056, 64]]);
    for (const surface of surfaces) {
      const target = groundDiamond(18, 11, surface.repeatTiles);
      const triangles = registerGroundQuad(surface.sourceQuad, target);
      expect(triangles).toHaveLength(2);
      for (const triangle of triangles) {
        const [a, b, c, d] = triangle.matrix;
        expect(a * d - b * c).toBeGreaterThan(0);
        triangle.source.forEach((point, index) => {
          const projected = projectGroundPoint(triangle.matrix, point);
          expect(projected[0]).toBeCloseTo(triangle.target[index][0], 8);
          expect(projected[1]).toBeCloseTo(triangle.target[index][1], 8);
        });
      }
      const diagonal = surface.sourceQuad[0].map((value, axis) => (value + surface.sourceQuad[2][axis]) / 2) as GroundPoint;
      const first = projectGroundPoint(triangles[0].matrix, diagonal), second = projectGroundPoint(triangles[1].matrix, diagonal);
      expect(first[0]).toBeCloseTo(second[0], 8); expect(first[1]).toBeCloseTo(second[1], 8);
      expect(target[1][0] - target[3][0]).toBe(TILE_WIDTH * surface.repeatTiles);
      expect(target[2][1] - target[0][1]).toBe(TILE_HEIGHT * surface.repeatTiles);
    }
  });

  it('rejects conflicting selectors, degenerate triangles, reflections and unsafe repeat sizes', () => {
    expect(() => planGroundSurfaces(map, [surfaces[0], { ...surfaces[0], id: 'conflict' }], atlas)).toThrow('Ambiguous');
    expect(() => planGroundSurfaces(map, [surfaces[0], surfaces[0]], atlas)).toThrow('Duplicate');
    for (const repeatTiles of [0, .5, 17, NaN])
      expect(() => planGroundSurfaces(map, [{ ...surfaces[0], repeatTiles }], atlas)).toThrow('repeat');
    expect(() => registerGroundQuad([[0, 0], [1, 1], [2, 2], [3, 3]], groundDiamond(0, 0))).toThrow('Degenerate');
    const reflected = [...surfaces[0].sourceQuad].reverse() as GroundQuad;
    expect(() => registerGroundQuad(reflected, groundDiamond(0, 0))).toThrow('reflect');
  });
});

describe('canonical floor coverage and baked low-object preservation', () => {
  it('covers 1,328 cells while preserving all 80 approved Z08 cells and all 17 zones', () => {
    const before = JSON.stringify(map), grid = new GridMap(map);
    const floors = plan.materials.filter(material => material.layer === 'floor');
    const cells = floors.flatMap(material => material.cells);
    expect(plan.coveredCells).toBe(1328);
    expect(cells).toHaveLength(1328);
    expect(new Set(cells.map(cell => `${cell.gx},${cell.gy}`)).size).toBe(1328);
    expect(floors.map(material => [material.surface.id, material.cells.length])).toEqual([
      ['F01', 1082], ['F03', 176], ['F04', 45], ['O01', 25],
    ]);
    expect(grid.zones).toHaveLength(17); expect(grid.slots).toHaveLength(133); expect(grid.doors).toHaveLength(26);
    for (const zone of grid.zones) {
      const inside = cells.filter(cell => cell.gx >= zone.gx_min && cell.gx <= zone.gx_max &&
        cell.gy >= zone.gy_min && cell.gy <= zone.gy_max);
      expect(inside.length).toBe(zone.id === 'Z08' ? 0 : (zone.gx_max - zone.gx_min + 1) * (zone.gy_max - zone.gy_min + 1));
    }
    expect(JSON.stringify(map)).toBe(before);
    const actualHash = createHash('sha256').update(fs.readFileSync(path.join(publicRoot, 'maps/floor1.tmj'))).digest('hex');
    expect(actualHash).toBe('9a9bc468e345658b349923f4ae8dc696397bb929c69688b350ee74e6b610ef0e');
    expect(assets.logicalMapSha256).toBe(actualHash);
    const previous = read<PreviewAssets>('visual-migration/environment-foundation-v1/assets.json');
    expect(assets.floor).toEqual(previous.floor);
    expect(assets.props.find(prop => prop.id === 'dot-z08-floor-oak-z08')).toEqual(previous.props.find(prop => prop.id === 'dot-z08-floor-oak-z08'));
    expect(assets.props.find(prop => prop.id === 'dot-z08-floor-oak-z08')!.z).toBeGreaterThan(0);
  });

  it('cannot overwrite protected Z08 even when a selector mistakenly includes it', () => {
    const intrusive: GroundSurfaceDefinition = { ...surfaces[0], floorSprites: ['tile_floor_z08_dev_pods.png'] };
    expect(planGroundSurfaces(map, [intrusive], atlas).coveredCells).toBe(0);
  });

  it('replaces exactly the 14 canonical Z16 rugs above their base floor while preserving all prayer slots', () => {
    const original = JSON.stringify(map), grid = new GridMap(map);
    const rug = plan.materials.find(material => material.surface.id === 'F16')!;
    const base = planGroundSurfaces(map, surfaces.filter(surface => surface.id !== 'F16'), atlas);
    expect(rug.layer).toBe('overlay');
    expect(rug.surface.floorSprites).toEqual([]);
    expect(rug.surface.overlaySprites).toEqual(['furniture_prayer_rug_shaf.png']);
    expect(rug.surface.repeatTiles).toBe(1);
    expect(rug.cells).toHaveLength(14);
    expect(rug.patches).toHaveLength(14);
    expect(rug.cells.map(({ gx, gy }) => [gx, gy])).toEqual([27, 29].flatMap(gy =>
      Array.from({ length: 7 }, (_, index) => [30 + index, gy])));
    expect(plan.materials.filter(material => material.layer === 'floor')).toEqual(base.materials);
    expect(plan.retained).toHaveLength(0);
    expect(plan.coveredCells).toBe(base.coveredCells);
    expect(grid.slots.filter(slot => slot.type === 'prayer_row')).toHaveLength(16);
    expect(grid.slots).toHaveLength(133); expect(grid.doors).toHaveLength(26);
    expect(JSON.stringify(map)).toBe(original);
    // Manifest order never puts a base floor over an overlay.
    const reversed = planGroundSurfaces(map, [...surfaces].reverse(), atlas);
    expect(reversed.materials.at(-1)!.surface.id).toBe('F16');
    // An overlay alone cannot replace unrelated baked ground or protected Z08.
    expect(planGroundSurfaces(map, [rug.surface], atlas).materials).toHaveLength(0);
    expect(() => planGroundSurfaces(map, [...surfaces, { ...rug.surface, id: 'duplicate-rug' }], atlas)).toThrow('Ambiguous');
    expect(() => planGroundSurfaces(map, [{ ...rug.surface, floorSprites: surfaces[0].floorSprites }], atlas)).toThrow('mix');
    expect(() => planGroundSurfaces(map, [{ ...rug.surface, overlaySprites: ['unknown.png'] }], atlas)).toThrow('Unsupported');
  });

  it('restores all legacy prayer rugs only when the new material is absent', () => {
    const legacy = planGroundSurfaces(map, surfaces.filter(surface => !surface.overlaySprites?.length), atlas);
    expect(legacy.retained).toHaveLength(14);
    for (const object of legacy.retained) {
      expect(object.sprite).toBe('furniture_prayer_rug_shaf.png');
      expect([27, 29]).toContain(object.gy);
      expect(object.gx).toBeGreaterThanOrEqual(30); expect(object.gx).toBeLessThanOrEqual(36);
      expect(object.source).toEqual(atlas.frames[object.sprite].frame);
      const centre = gridToScreen(object.gx, object.gy);
      expect(object.target).toEqual({ x: centre.x - 32, y: centre.y - 32, width: 64, height: 64 });
    }
    expect(plan.retained.some(object => object.sprite === 'furniture_pool_water.png')).toBe(false);
    const waterMaterial = surfaces.find(surface => surface.id === 'O01')!;
    // The registered water replaces its redundant baked water sprite while
    // the complete pool footprint remains in the logical map.
    const pool = planGroundSurfaces(map, [waterMaterial], atlas);
    expect(pool.coveredCells).toBe(25);
    expect(pool.retained).toHaveLength(0);
    const furniture = map.layers.find(layer => layer.name === 'furniture')!.data!;
    expect(furniture.filter(gid => gid === map.tilesets.flatMap(tileset => (tileset.tiles ?? [])
      .filter(tile => tile.image === 'furniture_pool_water.png').map(tile => tileset.firstgid + tile.id))[0])).toHaveLength(9);
  });

  it('keeps tile adjacency and global repeat alignment without material boundaries drifting', () => {
    expect(plan.bounds).toEqual({ x: 64, y: 48, width: 2432, height: 1216 });
    expect(plan.materials.reduce((sum, material) => sum + material.patches.length, 0)).toBeLessThan(140);
    for (const material of plan.materials) for (const cell of material.cells) {
      const patches = material.patches.filter(patch => cell.gx >= patch.gx && cell.gx < patch.gx + patch.span &&
        cell.gy >= patch.gy && cell.gy < patch.gy + patch.span);
      expect(patches).toHaveLength(1);
      const current = groundDiamond(cell.gx, cell.gy), next = groundDiamond(cell.gx + 1, cell.gy);
      expect(current[1]).toEqual(next[0]); expect(current[2]).toEqual(next[3]);
      expect(current[1][0] - current[0][0]).toBe(HALF_WIDTH);
      expect(current[1][1] - current[0][1]).toBe(HALF_HEIGHT);
    }
  });
});

describe('static canvas application rendering', () => {
  it('clips the original source to the exact outer diamond before drawing either affine triangle', () => {
    const context = mockContext(), original = {} as CanvasImageSource, target = groundDiamond(0, 0);
    paintGroundPatch(context as unknown as CanvasRenderingContext2D, original, surfaces[0].sourceQuad, target);
    expect(context.clip).toHaveBeenCalledTimes(3);
    expect(context.drawImage).toHaveBeenCalledTimes(2);
    expect(context.transform).toHaveBeenCalledTimes(2);
    expect(context.moveTo.mock.calls[0]).toEqual(target[0]);
    expect(context.lineTo.mock.calls.slice(0, 3)).toEqual(target.slice(1));
    expect(context.clip.mock.invocationCallOrder[0]).toBeLessThan(context.transform.mock.invocationCallOrder[0]);
    expect(context.drawImage.mock.calls).toEqual([[original, 0, 0], [original, 0, 0]]);
    expect(context.save).toHaveBeenCalledTimes(3); expect(context.restore).toHaveBeenCalledTimes(3);
  });

  it('uses matching opaque underlays and paints only generated rug cells last', () => {
    const context = mockContext(), caches: ReturnType<typeof mockContext>[] = [];
    const canvas = { width: 0, height: 0, getContext: () => context } as unknown as HTMLCanvasElement;
    const images = new Map(surfaces.map(surface => [surface.file,
      { naturalWidth: surface.sourceSize.width, naturalHeight: surface.sourceSize.height } as HTMLImageElement]));
    const environment = {} as HTMLImageElement;
    vi.stubGlobal('document', { createElement: () => {
      const cache = mockContext(); caches.push(cache);
      return { width: 0, height: 0, getContext: () => cache };
    } });
    try {
      paintGroundSurfaces(canvas, plan, images, environment);
      expect([canvas.width, canvas.height]).toEqual([4864, 2432]);
      expect(caches).toHaveLength(5);
      expect(caches.every(cache => cache.drawImage.mock.calls.length === 2)).toBe(true);
      expect(context.fillRect).toHaveBeenCalledTimes(5);
      expect(context.drawImage.mock.calls.length).toBe(plan.materials.reduce((sum, material) => sum + material.patches.length, 0));
      for (const call of context.drawImage.mock.calls.slice(-14)) {
        expect(call[0]).not.toBe(environment); expect(call).toHaveLength(5);
      }
      expect(context.drawImage.mock.calls.some(call => call[0] === environment)).toBe(false);
      expect(context.fillRect.mock.invocationCallOrder[4]).toBeLessThan(context.drawImage.mock.invocationCallOrder.at(-14)!);
    } finally { vi.unstubAllGlobals(); }
  });

  it('adds one non-interactive ground element only when a manifest opts in', () => {
    expect(renderToStaticMarkup(<GroundSurfaces map={map} atlas={atlas}/>)).toBe('');
    const markup = renderToStaticMarkup(<GroundSurfaces map={map} surfaces={surfaces} atlas={atlas}/>);
    expect(markup.match(/<canvas/g)).toHaveLength(1);
    expect(markup).toContain('data-ground-cells="1328"');
    expect(markup).toContain('data-retained-ground-sprites="0"');
    expect(markup).toContain('data-ground-overlay-cells="14"');
    expect(markup).toContain('pointer-events:none'); expect(markup).toContain('z-index:0');
  });
});
