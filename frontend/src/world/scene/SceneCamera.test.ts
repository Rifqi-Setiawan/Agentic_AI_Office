import { describe, expect, it } from 'vitest';
import { SceneCamera } from './SceneCamera';
import { gridToScreen } from '../projection';
import { applyAtlasFrame, type SpriteAtlas } from './AssetRegistry';

describe('DOM projection and sprite contracts', () => {
  it('inverts pan, zoom and client viewport offsets, including resize', () => {
    let rect={left:202,top:145,width:1238,height:755};
    const viewport={getBoundingClientRect:()=>rect} as HTMLElement;
    const world={style:{transform:''}} as unknown as HTMLElement;
    const camera=new SceneCamera(viewport,world);camera.resize();
    for(const zoom of [.25,1,2,3]) {
      camera.zoomAt(zoom,120,230);camera.pan(-47,88);
      const p=gridToScreen(17,12), screen=camera.toScreen(p.x,p.y), back=camera.clientToGrid(screen.x,screen.y);
      expect(back.gx).toBeCloseTo(17,10);expect(back.gy).toBeCloseTo(12,10);
    }
    rect={left:0,top:255,width:390,height:589};camera.resize();
    const p=gridToScreen(41,13),screen=camera.toScreen(p.x,p.y);
    expect(camera.clientToGrid(screen.x,screen.y)).toEqual({gx:41,gy:13});
  });
  it('advances a 1.25s flight on the shared clock and allows user cancellation', () => {
    const camera=new SceneCamera({getBoundingClientRect:()=>({left:0,top:0,width:1000,height:700})} as HTMLElement,{style:{transform:''}} as unknown as HTMLElement);
    camera.resize();
    const before=camera.panX;let done=0;
    camera.focus({id:'Z08',name:'Dev Pods',resident:'prism',gx_min:15,gx_max:23,gy_min:10,gy_max:19},false,()=>done++);
    expect(camera.panX).toBe(before);camera.update(.625);expect(camera.panX).not.toBe(before);
    expect(done).toBe(0);camera.update(.625);expect(done).toBe(1);
    camera.focus({id:'Z01',name:'CEO',resident:'jarvis',gx_min:0,gx_max:7,gy_min:0,gy_max:7},false,()=>done++);
    camera.pan(10,10);camera.update(2);expect(done).toBe(1);
  });
  it('honors atlas crop and export scale; rejects rotated or missing frames', () => {
    const atlas: SpriteAtlas={frames:{sample:{frame:{x:40,y:60,w:80,h:100},sourceSize:{w:96,h:128},spriteSourceSize:{x:8,y:4,w:80,h:100},trimmed:true,rotated:false}},meta:{image:'test.png',size:{w:512,h:512},exportScale:2}};
    const el={style:{}} as HTMLElement;
    applyAtlasFrame(el,atlas,'sample','test.png');
    expect(el.style.width).toBe('40px');expect(el.style.height).toBe('50px');
    expect(el.style.backgroundPosition).toBe('-20px -30px');
    atlas.frames.sample.rotated=true;
    expect(()=>applyAtlasFrame(el,atlas,'sample','test.png')).toThrow('rotated=false');
    expect(()=>applyAtlasFrame(el,atlas,'missing','test.png')).toThrow('Missing');
  });
});
