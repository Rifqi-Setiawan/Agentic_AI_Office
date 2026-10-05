import {describe, expect, it} from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import type {PreviewAssets} from './AssetRegistry';

const root=path.resolve(__dirname,'../../../public');
const read=<T,>(name:string):T=>JSON.parse(fs.readFileSync(path.join(root,name),'utf8')) as T;
const before=read<PreviewAssets>('visual-migration/environment-foundation-v1/assets.json');
const after=read<PreviewAssets>('visual-migration/illustrated-office-v1/assets.json');
interface Instance {id:string;sourcePropIds:string[];zone:string;bounds:{x:number;y:number;width:number;height:number};scale:number;groundAnchor:number[];support?:{propIds:string[];sourceImagePoint:number[];worldPoint:number[];originalDepth:number;presentationDepth:number};depthSlice?:{index:number;count:number;x0:number;x1:number;joinedSourcePropIds:string[]}|null;}
interface Source {id:string;file:string;sha256:string;nativeSize:number[];alphaBox:number[];instances:Instance[];sourceBytesPreserved:boolean;browserVisualQA:boolean;}
const ledger=read<{sources:Source[];sourcePixelsEdited:boolean;logicalMapChanged:boolean}>('visual-migration/illustrated-office-v1/furniture-ledger.json');

describe('Generated illustrated Office furniture registration',()=>{
  it('preserves canonical map bytes, actor art and approved Z08 furniture',()=>{
    const bytes=fs.readFileSync(path.join(root,'maps/floor1.tmj'));
    expect(after.logicalMapSha256).toBe(createHash('sha256').update(bytes).digest('hex'));
    expect(after.characterOverrides).toEqual(before.characterOverrides);
    for(const prop of before.props.filter(p=>p.gx>=16&&p.gx<=23&&p.gy>=10&&p.gy<=19&&p.sprite.startsWith('furniture'))){
      expect(after.props.find(p=>p.id===prop.id)).toEqual(prop);
    }
    expect(ledger.logicalMapChanged).toBe(false);
  });
  it('retains every original PNG byte and real alpha-bearing PNG identity',()=>{
    expect(ledger.sources.length).toBeGreaterThan(0);
    expect(ledger.sourcePixelsEdited).toBe(false);
    for(const source of ledger.sources){
      const bytes=fs.readFileSync(path.join(root,source.file));
      expect(bytes.subarray(0,8).toString('hex')).toBe('89504e470d0a1a0a');
      expect(createHash('sha256').update(bytes).digest('hex')).toBe(source.sha256);
      expect(source.sourceBytesPreserved).toBe(true);
      expect(source.alphaBox[2]).toBeLessThanOrEqual(source.nativeSize[0]);
      expect(source.alphaBox[3]).toBeLessThanOrEqual(source.nativeSize[1]);
    }
  });
  it('registers cropped source corners without anisotropic distortion or reflection',()=>{
    for(const source of ledger.sources)for(const instance of source.instances){
      const prop=after.props.find(p=>p.id===instance.id)!;
      expect(prop.artKind).toBe('registered-generated-furniture');
      expect(prop.bounds).toEqual(instance.bounds);
      const layer=prop.artLayers![0];
      const [a,b,c,d,tx,ty]=layer.matrix;
      expect(layer.matrix.every(Number.isFinite)).toBe(true);
      expect(a).toBeGreaterThan(0);expect(a).toBe(d);expect(b).toBe(0);expect(c).toBe(0);
      expect(a*source.alphaBox[0]+tx).toBeCloseTo(0,7);
      expect(d*source.alphaBox[1]+ty).toBeCloseTo(0,7);
      expect(a*source.alphaBox[2]+tx).toBeCloseTo(prop.bounds.width,7);
      expect(d*source.alphaBox[3]+ty).toBeCloseTo(prop.bounds.height,7);
      expect(prop.bounds.y+prop.bounds.height).toBeCloseTo(instance.groundAnchor[1],7);
    }
  });
  it('explicitly accounts for every joined table/bench cell without changing logical anchors',()=>{
    const used=new Set<string>();
    for(const source of ledger.sources)for(const instance of source.instances){
      const prop=after.props.find(p=>p.id===instance.id)!;
      const original=before.props.find(p=>p.id===instance.id)!;
      expect([prop.gx,prop.gy,prop.x,prop.y]).toEqual([original.gx,original.gy,original.x,original.y]);
      expect(prop.z).toBe(instance.support?.presentationDepth??original.z);
      for(const id of instance.sourcePropIds){expect(used.has(id)).toBe(false);used.add(id);expect(before.props.some(p=>p.id===id)).toBe(true);}
    }
    expect(new Set(after.props.map(p=>p.id)).size).toBe(after.props.length);
  });
  it('reports all 17 rooms and keeps unreviewed artwork explicitly incomplete',()=>{
    const coverage=read<{zone:string;complete:boolean;browserVisualQA:boolean}[]>('visual-migration/illustrated-office-v1/coverage.json');
    expect(coverage.map(z=>z.zone)).toEqual(Array.from({length:17},(_,i)=>`Z${String(i+1).padStart(2,'0')}`));
    for(const room of coverage){expect(room.browserVisualQA).toBe(false);expect(room.complete).toBe(false);}
    for(const source of ledger.sources)expect(source.browserVisualQA).toBe(false);
  });
  it('places the espresso machine on its actual marble support instead of hiding it behind the cabinet',()=>{
    const instance=ledger.sources.find(s=>s.id==='furniture_espresso_machine')!.instances[0];
    const support=instance.support!;
    expect(support.propIds).toHaveLength(3);
    const hosts=support.propIds.map(id=>after.props.find(p=>p.id===id)!);
    const [a,b,c,d,tx,ty]=hosts[0].artLayers![0].matrix;
    const [x,y]=support.sourceImagePoint;
    expect(support.worldPoint[0]).toBeCloseTo(hosts[0].bounds.x+a*x+c*y+tx,7);
    expect(support.worldPoint[1]).toBeCloseTo(hosts[0].bounds.y+b*x+d*y+ty,7);
    expect(support.presentationDepth).toBeGreaterThan(Math.max(...hosts.map(p=>p.z)));
    expect(instance.bounds.y+instance.bounds.height).toBeCloseTo(support.worldPoint[1],7);
  });
  it('tiles each joined depth-sliced object exactly once and preserves source-cell depth',()=>{
    for(const id of ['furniture_marble_counter','furniture_conveyor']){
      const source=ledger.sources.find(item=>item.id===id);
      expect(source,`${id} must be registered before depth acceptance`).toBeDefined();
      expect(source!.instances.filter(instance=>instance.depthSlice)).toHaveLength(3);
    }
    for(const source of ledger.sources){
      const groups=new Map<string,Instance[]>();
      for(const instance of source.instances){
        if(!instance.depthSlice)continue;
        const key=[...instance.depthSlice.joinedSourcePropIds].sort().join(',');
        groups.set(key,[...(groups.get(key)??[]),instance]);
      }
      for(const slices of groups.values()){
        slices.sort((a,b)=>a.depthSlice!.index-b.depthSlice!.index);
        expect(slices.length).toBe(slices[0].depthSlice!.count);
        expect(slices[0].depthSlice!.x0).toBe(0);
        expect(slices[slices.length-1].depthSlice!.x1).toBeCloseTo(slices[0].bounds.width,7);
        for(let i=0;i<slices.length;i++){
          const instance=slices[i],slice=instance.depthSlice!;
          expect(slice.x1).toBeGreaterThan(slice.x0);
          if(i)expect(slice.x0).toBe(slices[i-1].depthSlice!.x1);
          const prop=after.props.find(p=>p.id===instance.id)!;
          expect(prop.z).toBe(before.props.find(p=>p.id===instance.sourcePropIds[0])!.z);
          expect(prop.artLayers).toEqual(after.props.find(p=>p.id===slices[0].id)!.artLayers);
        }
      }
    }
  });
});
