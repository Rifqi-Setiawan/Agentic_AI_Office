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
    const result=resolveActorAnimation(primary,'prism','idle','sw');
    expect(result.frames).toEqual(['prism_idle_sw_0.png']);expect(result.mirrored).toBe(false);
    expect(result.source).toBe('illustration');expect(atlasImageUrl(result.atlas,'old.png')).toBe(primary.meta.image);
  });
  it('does not mirror a missing candidate West direction',()=>{
    const result=resolveActorAnimation(atlas(['prism_idle_se_0.png'],true),'prism','idle','sw');
    expect(result.frames).toEqual([]);expect(result.mirrored).toBe(false);
  });
  it('holds the same illustrated neutral view when an action is unavailable',()=>{
    const primary=atlas(['prism_idle_se_0.png'],true);
    const result=resolveActorAnimation(primary,'prism','drink','se');
    expect(result.atlas).toBe(primary);expect(result.source).toBe('illustration');
    expect(result.frames).toEqual(['prism_idle_se_0.png']);
    expect(result.renderedAction).toBe('idle');expect(result.substituted).toBe(true);
  });
  it('rejects old sprites even when their requested action is complete',()=>{
    const result=resolveActorAnimation(atlas(['prism_drink_ne_0.png']),'prism','drink','ne');
    expect(result.source).toBe('missing');expect(result.frames).toEqual([]);expect(result.mirrored).toBe(false);
  });
});
