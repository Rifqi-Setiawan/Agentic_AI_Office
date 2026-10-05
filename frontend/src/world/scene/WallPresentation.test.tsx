import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';
import { GridMap } from '../../navigation/GridMap';
import type { TiledMapDoc } from '../types';
import { gridToScreen } from '../projection';
import { applyPropArtwork, type DepthProp, type PreviewAssets } from './AssetRegistry';
import { SceneProp } from './SceneSprites';
import { presentOfficeWalls, presentWall } from './WallPresentation';

const publicRoot = path.resolve(__dirname, '../../../public');
const read = <T,>(file: string): T => JSON.parse(fs.readFileSync(path.join(publicRoot, file), 'utf8')) as T;
const source = read<PreviewAssets>('visual-migration/environment-foundation-v1/assets.json');
const displayed = presentOfficeWalls(source);
const registered = source.props.filter(prop => prop.artKind === 'registered-foundation-wall');
const walls = displayed.props.filter(prop => prop.wallPresentation);
const grid = new GridMap(read<TiledMapDoc>('maps/floor1.tmj'));
type Point = [number, number];
const polygon = (prop: DepthProp): Point[] => prop.artClipPath!.slice(8, -1).split(',')
  .map(pair => pair.split(' ').map(value => Number(value.replace('px', ''))) as Point);
const globalPolygon = (prop: DepthProp) => polygon(prop).map(([x, y]) => [x + prop.bounds.x, y + prop.bounds.y] as Point);
const contains = (points: Point[], x: number, y: number) => {
  let hit = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const [ax, ay] = points[i], [bx, by] = points[j];
    if ((ay > y) !== (by > y) && x < (bx - ax) * (y - ay) / (by - ay) + ax) hit = !hit;
  }
  return hit;
};
const covering = (props: DepthProp[], gx: number, gy: number) => {
  const { x, y } = gridToScreen(gx, gy);
  return props.filter(prop => contains(globalPolygon(prop), x, y)).map(prop => prop.id);
};

describe('architectural wall cutaway', () => {
  it('keeps the far exterior as a backdrop and lowers every internal wall', () => {
    expect(walls).toHaveLength(193);
    expect(walls.filter(prop => prop.wallPresentation?.height === 48)).toHaveLength(66);
    expect(walls.filter(prop => prop.wallPresentation?.height === 16)).toHaveLength(113);
    expect(walls.filter(prop => prop.wallPresentation?.height === 12)).toHaveLength(14);
    for (const prop of walls) {
      const normal = prop.componentId === 'W01' ? prop.gy : prop.gx;
      expect(prop.wallPresentation?.role).toBe(normal === 0 ? 'exterior-backdrop' : 'interior-cutaway');
      expect(prop.wallPresentation?.height).toBeGreaterThan(0);
      expect(prop.wallPresentation?.sourceHeight).toBe(80);
    }
  });

  it('preserves source assets, every prop, ground anchors, depth and actor manifests', () => {
    const original = JSON.stringify(source);
    const presented = presentOfficeWalls(source);
    expect(JSON.stringify(source)).toBe(original);
    expect(presented.floor).toBe(source.floor);
    expect(presented.characterOverrides).toBe(source.characterOverrides);
    expect(presented.logicalMapSha256).toBe(source.logicalMapSha256);
    expect(presented.props).toHaveLength(source.props.length);
    source.props.forEach((prop, index) => {
      const after = presented.props[index];
      expect(after).toMatchObject({ id: prop.id, sprite: prop.sprite, gx: prop.gx, gy: prop.gy, x: prop.x, y: prop.y, z: prop.z });
      expect(after.file).toBe(prop.file);
      expect(after.nightFile).toBe(prop.nightFile);
      if (!after.wallPresentation) expect(after).toBe(prop);
      expect(presentWall(after)).toBe(after);
    });
  });

  it('keeps the complete ground footprint and cap thickness instead of flattening the tile axes', () => {
    for (const before of registered) {
      const after = presentWall(before);
      const oldShape = globalPolygon(before), newShape = globalPolygon(after);
      const delta = 80 - after.wallPresentation!.height;
      oldShape.forEach(([x, y], index) => {
        expect(newShape[index][0]).toBeCloseTo(x, 8);
        expect(newShape[index][1]).toBeCloseTo(y + (index >= 3 ? delta : 0), 8);
      });
      expect(after.bounds.y + after.bounds.height).toBeCloseTo(before.bounds.y + before.bounds.height, 8);
      expect(after.bounds.width).toBe(before.bounds.width);
      for (const layer of after.artLayers!) {
        const [a, b, c, d] = layer.matrix;
        expect(layer.matrix.every(Number.isFinite)).toBe(true);
        expect(a * d - b * c).toBeGreaterThan(0);
        expect(layer.clipPath).toBe(before.artLayers!.find(old => old.id === layer.id)!.clipPath);
      }
    }
  });

  it('reprojects all source triangle corners to joined cutaway faces', () => {
    const ledger = read<{ walls: { id: string; registration: { checks: {
      plane: string; sourceTriangle: Point[]; targetTriangle: Point[];
    }[] } }[] }>('visual-migration/environment-foundation-v1/registration-ledger.json');
    for (const wall of ledger.walls) {
      const before = source.props.find(prop => prop.id === wall.id)!;
      const after = displayed.props.find(prop => prop.id === wall.id)!;
      const shape = polygon(before), delta = 80 - after.wallPresentation!.height;
      for (const check of wall.registration.checks) {
        const layer = after.artLayers!.find(layer => layer.id === check.plane)!;
        const [a, b, c, d, tx, ty] = layer.matrix;
        check.sourceTriangle.forEach(([x, y], index) => {
          const [oldX, oldY] = check.targetTriangle[index];
          const [start, end] = check.plane.startsWith('end-') ? [shape[1], shape[2]] : [shape[0], shape[1]];
          const baseY = start[1] + (oldX - start[0]) * (end[1] - start[1]) / (end[0] - start[0]);
          const elevation = baseY - oldY;
          const expectedY = check.plane.startsWith('cap-') ? oldY
            : baseY - elevation * after.wallPresentation!.height / 80 - delta;
          expect(a * x + c * y + tx).toBeCloseTo(oldX, 6);
          expect(b * x + d * y + ty).toBeCloseTo(expectedY, 6);
        });
      }
    }
  });

  it('clears every walkable corridor center previously obscured by the tall trial', () => {
    const previouslyCovered: string[] = [];
    for (const gy of [8, 9, 20, 21]) for (let gx = 0; gx < grid.width; gx++) {
      if (!grid.isWalkable(gx, gy)) continue;
      if (covering(registered, gx, gy).length) previouslyCovered.push(`${gx},${gy}`);
      expect(covering(walls, gx, gy), `corridor (${gx}, ${gy})`).toEqual([]);
    }
    expect(previouslyCovered).toHaveLength(78);
  });

  it('keeps all 133 slot centers and 26 door centers visible without modifying the 17 zones', () => {
    expect(grid.zones).toHaveLength(17);
    expect(grid.slots).toHaveLength(133);
    expect(grid.doors).toHaveLength(26);
    for (const target of [...grid.slots, ...grid.doors]) {
      expect(covering(walls, target.gx, target.gy), target.name).toEqual([]);
    }
  });

  it('leaves historical manifests and existing low walls unchanged', () => {
    const old = read<PreviewAssets>('visual-migration/dot-z08-components-v2/assets.json');
    expect(presentOfficeWalls(old)).toEqual(old);
    expect(() => presentWall({ ...registered[0], artClipPath: 'polygon(0px 0px)' })).toThrow('Invalid registered wall silhouette');
  });
});

describe('registered artwork painting', () => {
  it('shows wall diagnostics and paints only the registered planes in the scene element', () => {
    const prop = walls[0];
    const markup = renderToStaticMarkup(<SceneProp prop={prop} atlas={{ frames: {}, meta: { image: '', size: { w: 1, h: 1 } } }} />);
    expect(markup).toContain('data-wall-role="exterior-backdrop"');
    expect(markup).toContain('data-wall-height="48"');
    expect(markup.split('<span')[0]).not.toContain('background-image');
    expect((markup.match(/background-image/g) ?? []).length).toBe(prop.artLayers!.length);
  });

  it('keeps the wrapper clear through repeated day/night paints and updates each plane', () => {
    const prop = { ...walls[0], nightFile: '/night-wall.png' };
    const planes = prop.artLayers!.map(() => ({ style: { backgroundImage: '' } }));
    const el = { style: { backgroundImage: 'old-leaking-image' }, dataset: {}, querySelectorAll: () => planes } as unknown as HTMLElement;
    for (const night of [false, false, true, true, false]) {
      applyPropArtwork(el, prop, night);
      expect(el.style.backgroundImage).toBe('none');
      expect(el.dataset.assetFile).toBe(night ? prop.nightFile : prop.file);
      for (const plane of planes) expect(plane.style.backgroundImage).toBe(`url("${night ? prop.nightFile : prop.file}")`);
    }
  });

  it('preserves normal image backgrounds and atlas props', () => {
    const prop = source.props.find(prop => prop.file && !prop.artLayers)!;
    const el = { style: { backgroundImage: '' }, dataset: {} } as unknown as HTMLElement;
    applyPropArtwork(el, prop, false);
    expect(el.style.backgroundImage).toBe(`url("${prop.file}")`);
    const atlasProp = source.props.find(prop => !prop.file)!;
    applyPropArtwork(el, atlasProp, false);
    expect(el.style.backgroundImage).toBe(`url("${prop.file}")`);
  });
});
