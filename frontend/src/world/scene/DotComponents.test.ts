import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { resolveActorAnimation, type PreviewAssets, type SpriteAtlas } from './AssetRegistry';

const publicRoot = path.resolve(__dirname, '../../../public');
const read = <T,>(file: string): T => JSON.parse(fs.readFileSync(path.join(publicRoot, file), 'utf8')) as T;
const root = 'visual-migration/dot-z08-components-v2/';

describe('supplied Nova animation and Forge SE typing sequences', () => {
  it('uses all Nova typing/walk sequences in source order without mirroring', () => {
    const atlas = read<SpriteAtlas>(root + 'nova.json');
    const baseline = read<SpriteAtlas>('sprites/characters/nova.json');
    expect(Object.keys(atlas.frames)).toHaveLength(28);
    for (const direction of ['se', 'sw', 'ne', 'nw']) {
      for (const [action, count] of [['sit_type', 2], ['walk', 4]] as const) {
        const animation = resolveActorAnimation(atlas, baseline, 'nova', action, direction);
        expect(animation.source).toBe('illustration');
        expect(animation.mirrored).toBe(false);
        expect(animation.frames).toEqual(Array.from({ length: count }, (_, n) => `nova_${action}_${direction}_${n}.png`));
      }
    }
    expect(atlas.meta.animationFps?.sit_type).toBe(3.5);
    expect(atlas.meta.animationFps?.walk).toBe(7);
    expect(resolveActorAnimation(atlas, baseline, 'nova', 'celebrate', 'se').source).toBe('baseline');
  });

  it('uses Forge typing SE and preserves real baseline for all missing directions/actions', () => {
    const atlas = read<SpriteAtlas>(root + 'forge.json');
    const baseline = read<SpriteAtlas>('sprites/characters/forge.json');
    expect(Object.keys(atlas.frames)).toHaveLength(6);
    expect(resolveActorAnimation(atlas, baseline, 'forge', 'sit_type', 'se').frames).toEqual(['forge_sit_type_se_0.png', 'forge_sit_type_se_1.png']);
    expect(resolveActorAnimation(atlas, baseline, 'forge', 'sit_type', 'se').source).toBe('illustration');
    for (const direction of ['se', 'sw', 'ne', 'nw']) {
      expect(resolveActorAnimation(atlas, baseline, 'forge', 'walk', direction).source).toBe('baseline');
      if (direction !== 'se') expect(resolveActorAnimation(atlas, baseline, 'forge', 'sit_type', direction).source).toBe('baseline');
    }
  });

  it('retains a single transform per sequence and valid packed frame rectangles', () => {
    const ledger = read<{ registrations: { perFrameAutoTrim: boolean; mirrored: boolean; crop?: unknown; sourceFiles: string[] }[]; frames: { sourceSha256: string; crop: unknown }[] }>(root + 'character-ledger.json');
    expect(ledger.registrations).toHaveLength(9);
    expect(ledger.frames).toHaveLength(26);
    for (const sequence of ledger.registrations) {
      expect(sequence.perFrameAutoTrim).toBe(false);
      expect(sequence.mirrored).toBe(false);
      expect(sequence.sourceFiles.length).toBeGreaterThan(1);
    }
    for (const frame of ledger.frames) { expect(frame.crop).toBeNull(); expect(frame.sourceSha256).toMatch(/^[a-f0-9]{64}$/); }
    for (const agent of ['forge', 'nova']) {
      const atlas = read<SpriteAtlas>(root + agent + '.json');
      expect(fs.existsSync(path.join(publicRoot, atlas.meta.image))).toBe(true);
      for (const entry of Object.values(atlas.frames)) {
        expect(entry.rotated).toBe(false);
        expect(entry.frame.x + entry.frame.w).toBeLessThanOrEqual(atlas.meta.size.w);
        expect(entry.frame.y + entry.frame.h).toBeLessThanOrEqual(atlas.meta.size.h);
      }
    }
  });

  it('loads the current map and preserves other rooms while assembling the approved Z08 components', () => {
    const before = read<PreviewAssets>('visual-migration/dot-z08-candidate/assets.json');
    const after = read<PreviewAssets>(root + 'assets.json');
    expect(new Set(after.props.map(p => p.id)).size).toBe(after.props.length);
    const outsideZ08 = (p: PreviewAssets['props'][number]) => !(p.gx >= 16 && p.gx <= 23 && p.gy >= 10 && p.gy <= 19);
    for (const prop of before.props.filter(outsideZ08)) expect(after.props.find(p => p.id === prop.id)).toEqual(prop);
    expect(after.floor).toEqual(before.floor);
    expect(after.logicalMapSha256).toBe(createHash('sha256').update(fs.readFileSync(path.join(publicRoot, 'maps/floor1.tmj'))).digest('hex'));
    expect(after.characterOverrides?.prism).toBe(before.characterOverrides?.prism);
    expect(after.props.some(p => p.id === 'furniture-594-standing' || p.id === 'furniture-770-standing')).toBe(false);
    for (const prop of after.props) if (prop.file) expect(fs.existsSync(path.join(publicRoot, prop.file))).toBe(true);
    const ledger = read<{ usedComponentIds: string[]; partitions: Record<string, { visiblePixelsAndAlphaPartitionVerified: boolean }> }>(root + 'component-ledger.json');
    expect(ledger.usedComponentIds).toHaveLength(22);
    for (const split of Object.values(ledger.partitions)) expect(split.visiblePixelsAndAlphaPartitionVerified).toBe(true);
    const rear = after.props.find(p => p.id === 'dot-z08-sofa-rear')!;
    const front = after.props.find(p => p.id === 'dot-z08-sofa-front')!;
    expect(rear.z).toBeLessThan(35020);
    expect(front.z).toBeGreaterThan(36020);
  });
});
