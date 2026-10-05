// Presentation ports of W17ant src/components/{Character,FurnitureRenderer}.tsx
// at 291e7608 (MIT, copyright 2026 W17ANT). See docs/visual-migration/SOURCES.md.
import {memo,useCallback} from 'react';
import type {AgentSpawnDef} from '../simulation/roster';
import {officeStore} from '../../store/officeStore';
import {applyAtlasFrame,type DepthProp,type SpriteAtlas} from './AssetRegistry';

/** Furniture stays a sibling of every actor, in the same global depth context. */
export const SceneProp=memo(({prop,atlas}:{prop:DepthProp;atlas:SpriteAtlas})=>{
  const bind=useCallback((el:HTMLDivElement|null)=>{
    if(el && !prop.file) applyAtlasFrame(el,atlas,prop.sprite,'/sprites/environment.png');
  },[atlas,prop]);
  return <div ref={bind} data-prop-id={prop.id} data-frame={prop.sprite}
    className={`depth-prop ${prop.file?'illustrated-prop':''}`} style={{left:prop.bounds.x,top:prop.bounds.y,zIndex:prop.z,
      ...(prop.file?{width:prop.bounds.width,height:prop.bounds.height,backgroundImage:`url("${prop.file}")`,backgroundSize:'100% 100%'}:{})}} aria-hidden="true">
    {prop.sprite.includes('server_rack')&&<span className="rack-led" style={{left:prop.x-prop.bounds.x-6,top:prop.y-prop.bounds.y-14}}/>}
  </div>;
});
SceneProp.displayName='SceneProp';

/** Sprite, ground shadow and indicators follow the reference's character wrapper.
 * Roster IDs, direction, position and work state come only from the Office model.
 * No role-to-character fallback, random turn timer or percentage coordinates. */
export const SceneActor=memo(({def,onSelect}:{def:AgentSpawnDef;onSelect:(id:string)=>void})=>
  <button data-agent-id={def.id} className="world-actor" aria-label={`Pilih ${def.name}`} aria-pressed={false}
    onClick={event=>{event.stopPropagation();onSelect(def.id);}}
    onMouseEnter={()=>officeStore.getState().hoverAgent(def.id)}
    onMouseLeave={()=>officeStore.getState().hoverAgent(null)}>
    <span className="actor-shadow"/><span className="actor-sprite"/>
    <span className="actor-name" style={{borderColor:def.signatureColor}}>{def.name}</span>
    <span className="real-work-badge" hidden aria-label="Task nyata aktif">●</span>
    <span className="fail-stamp" hidden>FAIL</span><span className="parcel" hidden>▣</span><span className="sweat" hidden>♦</span>
    {def.id==='rifqi'&&<span className="founder-crown" aria-label="Founder">♛</span>}
    <span className="agent-work-state"/><span className="missing-action"/>
  </button>);
SceneActor.displayName='SceneActor';
