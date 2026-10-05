import {describe,expect,it} from 'vitest';
import {atlasImageUrl,resolveActorAnimation,type SpriteAtlas} from './AssetRegistry';

function atlas(names:string[],candidate=false):SpriteAtlas {
  return {meta:{image:candidate?'/visual-migration/illustrated-z08-v1/prism.png':'prism.png',size:{w:128,h:192},candidate},
    frames:Object.fromEntries(names.map(name=>[name,{frame:{x:0,y:0,w:128,h:192},rotated:false,trimmed:false,
      sourceSize:{w:128,h:192},spriteSourceSize:{x:0,y:0,w:128,h:192}}]))};
}
describe('illustrated slice preserves direction and pending actions',()=>{
  it('uses the explicit SW illustration with its own atlas URL',()=>{
    const primary=atlas(['prism_idle_sw_0.png'],true);
    const result=resolveActorAnimation(primary,atlas(['prism_idle_se_0.png']),'prism','idle','sw');
    expect(result.frames).toEqual(['prism_idle_sw_0.png']);expect(result.mirrored).toBe(false);
    expect(result.source).toBe('illustration');expect(atlasImageUrl(result.atlas,'old.png')).toBe(primary.meta.image);
  });
  it('does not mirror a missing candidate West direction',()=>{
    const result=resolveActorAnimation(atlas(['prism_idle_se_0.png'],true),undefined,'prism','idle','sw');
    expect(result.frames).toEqual([]);expect(result.mirrored).toBe(false);
  });
  it('preserves an unconverted action using the explicit baseline, with honest source',()=>{
    const primary=atlas(['prism_idle_se_0.png'],true),baseline=atlas(['prism_drink_se_0.png']);
    const result=resolveActorAnimation(primary,baseline,'prism','drink','se');
    expect(result.atlas).toBe(baseline);expect(result.source).toBe('baseline');
    expect(result.frames).toEqual(['prism_drink_se_0.png']);
  });
  it('limits the existing West mirror fallback to the baseline',()=>{
    const result=resolveActorAnimation(atlas([],true),atlas(['prism_drink_ne_0.png']),'prism','drink','nw');
    expect(result.source).toBe('baseline');expect(result.mirrored).toBe(true);
    expect(atlasImageUrl(result.atlas,'/sprites/characters/prism.png')).toBe('/sprites/characters/prism.png');
  });
});
