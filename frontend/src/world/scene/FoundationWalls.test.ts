import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import type { PreviewAssets } from './AssetRegistry';

const publicRoot = path.resolve(__dirname, '../../../public');
const read = <T,>(file: string): T => JSON.parse(fs.readFileSync(path.join(publicRoot, file), 'utf8')) as T;
const previous = read<PreviewAssets>('visual-migration/dot-z08-components-v2/assets.json');
const current = read<PreviewAssets>('visual-migration/environment-foundation-v1/assets.json');
interface WallRegistration {
  id: string; assetId: string; center: number[]; worldStart: number[];
  registration: { lengthTiles: number; wallHeight: number; checks: {
    plane: string; sourceTriangle: number[][]; targetTriangle: number[][]; maxCornerError: number;
  }[] };
}
const ledger = read<{ sources: { assetId: string; file: string; sourceSha256: string; mirrored: boolean }[];
  walls: WallRegistration[]; retiredLongWallProps: string[];
}>('visual-migration/environment-foundation-v1/registration-ledger.json');

describe('W01/W02 environment foundation installation', () => {
  it('preserves map, floor, actors, furniture, cutaway walls and portal art', () => {
    expect(current.logicalMapSha256).toBe(createHash('sha256').update(fs.readFileSync(path.join(publicRoot, 'maps/floor1.tmj'))).digest('hex'));
    expect(current.floor).toEqual(previous.floor);
    expect(current.characterOverrides).toEqual(previous.characterOverrides);
    const registered = new Set(ledger.walls.map(w => w.id));
    for (const prop of previous.props) {
      if (ledger.retiredLongWallProps.includes(prop.id)) continue;
      const after = current.props.find(p => p.id === prop.id);
      if (registered.has(prop.id)) {
        expect(after).toMatchObject({ id: prop.id, sprite: prop.sprite, gx: prop.gx, gy: prop.gy, x: prop.x, y: prop.y, z: prop.z });
      } else expect(after).toEqual(prop);
    }
    expect(new Set(current.props.map(p => p.id)).size).toBe(current.props.length);
  });

  it('uses the two supplied PNGs byte-identically, without reflection or missing files', () => {
    expect(ledger.sources.map(s => s.assetId)).toEqual(['W01', 'W02']);
    for (const source of ledger.sources) {
      const bytes = fs.readFileSync(path.join(publicRoot, source.file));
      expect(createHash('sha256').update(bytes).digest('hex')).toBe(source.sourceSha256);
      expect(source.mirrored).toBe(false);
    }
    for (const prop of current.props) if (prop.file) expect(fs.existsSync(path.join(publicRoot, prop.file))).toBe(true);
  });

  it('registers all wall-plane corners to 80px-high modules on the 2:1 ground axes', () => {
    expect(ledger.walls).toHaveLength(193);
    expect(ledger.walls.filter(w => w.assetId === 'W01')).toHaveLength(74);
    expect(ledger.walls.filter(w => w.assetId === 'W02')).toHaveLength(119);
    for (const wall of ledger.walls) {
      const prop = current.props.find(p => p.id === wall.id)!;
      expect(prop.artClipPath).toMatch(/^polygon\(/);
      expect(wall.registration.wallHeight).toBe(80);
      for (const check of wall.registration.checks) {
        const layer = prop.artLayers!.find(l => l.id === check.plane)!;
        expect(layer.matrix.every(Number.isFinite)).toBe(true);
        const [a,b,c,d,tx,ty] = layer.matrix;
        expect(a*d-b*c).toBeGreaterThan(0);
        check.sourceTriangle.forEach(([x,y],i) => {
          expect(a*x+c*y+tx).toBeCloseTo(check.targetTriangle[i][0],6);
          expect(b*x+d*y+ty).toBeCloseTo(check.targetTriangle[i][1],6);
        });
        expect(check.maxCornerError).toBeLessThan(1e-6);
      }
      const front = wall.registration.checks.find(c => c.plane === 'front-0')!.targetTriangle;
      expect(Math.abs(front[1][0]-front[0][0])).toBe(32*wall.registration.lengthTiles);
      expect(front[1][1]-front[0][1]).toBe(16*wall.registration.lengthTiles);
      expect(front[2][1]-front[1][1]).toBe(80);
    }
  });
});
