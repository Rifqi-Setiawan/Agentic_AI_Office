import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { resolveActorAnimation, type DepthProp, type PreviewAssets, type SpriteAtlas } from './AssetRegistry';

const publicRoot = path.resolve(__dirname, '../../../public');
const read = <T,>(file: string): T => JSON.parse(fs.readFileSync(path.join(publicRoot, file), 'utf8')) as T;
const candidate = read<PreviewAssets>('visual-migration/dot-z08-candidate/assets.json');

describe('supplied Dot assets in the real renderer manifests', () => {
  it('resolves four explicit Prism SE walk frames in the supplied order without mirroring', () => {
    const atlas = read<SpriteAtlas>('visual-migration/dot-z08-candidate/prism.json');
    const animation = resolveActorAnimation(atlas, undefined, 'prism', 'walk', 'se');
    expect(animation.frames).toEqual([0, 1, 2, 3].map(n => `prism_walk_se_${n}.png`));
    expect(animation.source).toBe('illustration');
    expect(animation.mirrored).toBe(false);
    for (const frame of Object.values(atlas.frames)) {
      expect(frame.rotated).toBe(false);
      expect(frame.frame.x + frame.frame.w).toBeLessThanOrEqual(atlas.meta.size.w);
      expect(frame.frame.y + frame.frame.h).toBeLessThanOrEqual(atlas.meta.size.h);
    }
  });

  it('uses the four real Forge/Nova idle views and preserves baseline for missing actions', () => {
    for (const agent of ['forge', 'nova']) {
      const atlas = read<SpriteAtlas>(`visual-migration/dot-z08-candidate/${agent}.json`);
      const baseline = read<SpriteAtlas>(`sprites/characters/${agent}.json`);
      for (const direction of ['se', 'sw', 'ne', 'nw']) {
        const idle = resolveActorAnimation(atlas, baseline, agent, 'idle', direction);
        expect(idle.frames).toEqual([`${agent}_idle_${direction}_0.png`]);
        expect(idle.mirrored).toBe(false);
        expect(idle.source).toBe('illustration');
        for (const action of ['walk', 'sit_type']) {
          const pending = resolveActorAnimation(atlas, baseline, agent, action, direction);
          expect(pending.atlas).toBe(baseline);
          expect(pending.source).toBe('baseline');
          expect(pending.frames.length).toBeGreaterThan(0);
        }
      }
    }
  });

  it('keeps the current layout, floor, depth and slots while replacing only Z08 desk/chair art', () => {
    const previous = read<PreviewAssets>('visual-migration/illustrated-z08-v3/assets.json');
    // The v1 art is a historical snapshot, before the approved gaming arrangement.
    expect(candidate.logicalMapSha256).toBe(previous.logicalMapSha256);
    expect(candidate.floor).toEqual(previous.floor);
    expect(candidate.props.length).toBe(previous.props.length);
    const artKeys = new Set(['bounds', 'file', 'artKind']);
    const logic = (prop: DepthProp) => Object.fromEntries(Object.entries(prop).filter(([key]) => !artKeys.has(key)));
    for (let i = 0; i < candidate.props.length; i++) {
      const before = previous.props[i], after = candidate.props[i];
      expect(logic(after)).toEqual(logic(before));
      if (after.file) expect(fs.existsSync(path.join(publicRoot, after.file))).toBe(true);
      if (!after.file?.startsWith('/visual-migration/dot-z08-candidate/')) expect(after).toEqual(before);
    }
    expect(candidate.props.filter(p => p.file?.endsWith('/desk.png'))).toHaveLength(3);
    expect(candidate.props.filter(p => p.file?.endsWith('/chair.png'))).toHaveLength(4);
  });
});
