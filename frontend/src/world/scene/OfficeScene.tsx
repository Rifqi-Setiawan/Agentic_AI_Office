// Presentation adapted from W17ant Character/FurnitureRenderer/rooms.css (MIT).
// Canonical world positions and model animation replace room percentages and role simulation.
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { TiledMapDoc } from '../types';
import { GridMap } from '../../navigation/GridMap';
import { gridToScreen, calculateZIndex, LAYER_OFFSETS } from '../projection';
import { BOX_SPAWN_POINTS } from '../simulation/sceneEffects';
import type { AgentSpawnDef } from '../simulation/roster';
import { worldController } from '../worldController';
import { SceneCamera } from './SceneCamera';
import { DomWorld } from './DomWorld';
import { applyAtlasFrame, type PreviewAssets, type SpriteAtlas } from './AssetRegistry';
import { SceneActor, SceneProp } from './SceneSprites';
import { illustratedActorDefs } from './ActorRoster';
import './scene.css';

interface SceneData { map: TiledMapDoc; assets: PreviewAssets; environment: SpriteAtlas; atlases: Map<string, SpriteAtlas>; actors: AgentSpawnDef[]; }
const ZONE_ICONS = ['◈','◎','⌘','▤','▥','⚗','◒','⌨','▧','✓','↗','▦','◇','☕','♜','☾','≈'];
async function loadJson<T>(path: string, signal: AbortSignal): Promise<T> {
  const response = await fetch(path, { signal });
  if (!response.ok) throw new Error(`${path}: HTTP ${response.status}`);
  return response.json() as Promise<T>;
}

export const OfficeScene: React.FC = () => {
  const viewport = useRef<HTMLDivElement>(null), worldElement = useRef<HTMLDivElement>(null);
  const active = useRef<DomWorld | null>(null);
  const [data, setData] = useState<SceneData | null>(null), [error, setError] = useState('');
  const [focusedZone, setFocusedZone] = useState(''), [debug, setDebug] = useState(false), [menu, setMenu] = useState(false);
  useEffect(() => {
    const abort = new AbortController(), signal = abort.signal;
    const officeArt = new URLSearchParams(location.search).get('officeArt');
    const assetsUrl = officeArt === 'baseline' ? '/visual-migration/preview-assets.json'
      : officeArt === 'previous' ? '/visual-migration/illustrated-z08-v3/assets.json'
      : officeArt === 'dot-v1' ? '/visual-migration/dot-z08-candidate/assets.json'
      : '/visual-migration/dot-z08-components-v2/assets.json';
    Promise.all([
      loadJson<TiledMapDoc>('/maps/floor1.tmj', signal),
      loadJson<PreviewAssets>(assetsUrl, signal),
      loadJson<SpriteAtlas>('/sprites/environment.json', signal),
    ]).then(async ([map, assets, environment]) => {
      const atlases = new Map(await Promise.all(Object.entries(assets.characterOverrides??{}).map(async ([id,path]) =>
        [id,await loadJson<SpriteAtlas>(path,signal)] as const)));
      if (!signal.aborted) setData({ map, assets, environment, atlases, actors: illustratedActorDefs(atlases) });
    }).catch(err => { if (!signal.aborted) setError(String(err)); });
    return () => abort.abort();
  }, []);
  useEffect(() => {
    if (!data || !viewport.current || !worldElement.current) return;
    const camera = new SceneCamera(viewport.current, worldElement.current);
    const controller = new DomWorld(viewport.current, worldElement.current, camera, data.map, data.assets, data.environment, data.atlases);
    active.current = controller; worldController.attach(controller);
    const diagnostics = window as unknown as { __WORLD_APP__?: DomWorld; __DOM_WORLD__?: DomWorld };
    diagnostics.__WORLD_APP__ = controller; diagnostics.__DOM_WORLD__ = controller;
    return () => { controller.destroy(); active.current = null; worldController.attach(null); delete diagnostics.__DOM_WORLD__; delete diagnostics.__WORLD_APP__; };
  }, [data]);
  const focus = (id: string) => { active.current?.flyToZone(id); setFocusedZone(id); setMenu(false); };
  const selectAgent = useCallback((id: string) => {active.current?.handleAgentClick(id);}, []);
  const grid = useMemo(() => data ? new GridMap(data.map) : null, [data]);
  return <div className="office-scene" data-renderer="react-css">
    <div className="migration-notice" role="status">{import.meta.env.DEV ? 'Preview lokal · fixture demo' : 'Renderer percobaan'} · Karakter 2.5D: {data?.actors.map(def => def.name).join(', ') || 'belum tersedia'} · pose yang belum lengkap memakai pose 2.5D yang tersedia · menunggu review gaya</div>
    <button className="mobile-room-toggle" onClick={() => setMenu(!menu)} aria-expanded={menu}>17 ruang</button>
    <nav className={`scene-nav ${menu ? 'open' : ''}`} aria-label="Navigasi 17 ruang">
      <div className="nav-title">THE OFFICE <span>44 × 32</span></div>
      <button className={!focusedZone ? 'active' : ''} onClick={() => { active.current?.camera.overview(); setFocusedZone(''); setMenu(false); }}>◉ <span>Seluruh kantor</span></button>
      {grid?.zones.map((zone,index) => <button key={zone.id} className={focusedZone === zone.id ? 'active' : ''} onClick={() => focus(zone.id)} aria-label={`Fokus ${zone.id} ${zone.name}`}><span className="room-icon">{ZONE_ICONS[index]}</span><span><small>{zone.id}</small>{zone.name}</span></button>)}
      <div className="nav-foot">17 zona · 133 slot · 26 pintu</div>
    </nav>
    <div className="scene-toolbar"><button onClick={() => { active.current?.camera.overview(); setFocusedZone(''); }}>Overview</button><button aria-pressed={debug} onClick={() => setDebug(!debug)}>Anchor / slot</button><a href="?officeRenderer=legacy">Renderer lama</a></div>
    <div ref={viewport} className="scene-viewport" tabIndex={0} aria-label="Dunia kantor; geser untuk pan, scroll untuk zoom">
      {error && <div className="scene-error" role="alert">Scene gagal dimuat: {error}</div>}
      {!data && !error && <div className="scene-loading">Memuat dunia kantor…</div>}
      <svg width="0" height="0" aria-hidden="true"><defs><filter id="office-atmosphere" colorInterpolationFilters="sRGB"><feColorMatrix id="office-atmosphere-matrix" type="matrix" values="1 0 0 0 0 0 1 0 0 0 0 0 1 0 0 0 0 0 1 0" /></filter></defs></svg>
      <div ref={worldElement} className={`camera-world ${debug ? 'debug' : ''}`}>
        {data && <>
          <img className="static-floor" src={data.assets.floor.file} alt="Lantai kantor canonical 17 zona" draggable={false} style={{left:data.assets.floor.x,top:data.assets.floor.y,width:data.assets.floor.width,height:data.assets.floor.height}} />
          {data.assets.props.map(prop => <SceneProp key={prop.id} prop={prop} atlas={data.environment}/>)}
          {data.actors.map(def => <SceneActor key={def.id} def={def} onSelect={selectAgent}/>)}
          {grid?.zones.map(zone => {const p=gridToScreen(zone.gx_min+1,zone.gy_min+1);return <span key={zone.id} className="zone-label" style={{left:p.x,top:p.y}}>{zone.id} / {zone.name}</span>;})}
          {grid?.slots.map(slot => {const p=gridToScreen(slot.gx,slot.gy);return <span key={slot.id} className="debug-slot" title={`${slot.id} (${slot.gx},${slot.gy})`} style={{left:p.x,top:p.y}}>·</span>;})}
          {grid?.doors.map(door => {const p=gridToScreen(door.gx,door.gy);return <span key={door.id} className="debug-door" title={`${door.name}: ${door.from} → ${door.to}`} style={{left:p.x,top:p.y}}>◇</span>;})}
          <div className="world-effect friday-sticker" data-effect="friday" hidden style={{left:gridToScreen(34,12).x-45,top:gridToScreen(34,12).y-35}}>No Deploy Friday</div>
          <div className="world-effect glitch-tile" data-effect="glitch" hidden style={{left:gridToScreen(25,16).x-32,top:gridToScreen(25,16).y-16}}/>
          <div className="world-effect ac-unit" style={{left:gridToScreen(38,11).x-24,top:gridToScreen(38,11).y-36}}>AC <span data-effect="fan">✣</span><i className="ac-airflow" data-effect="airflow" hidden/></div>
          {BOX_SPAWN_POINTS.map((point,index) => {const p=gridToScreen(point.gx,point.gy);return <div key={`box-${index}`} className="depth-prop" data-effect="boxes" hidden ref={el => {if(el) applyAtlasFrame(el,data.environment,'furniture_cardboard_box.png','/sprites/environment.png');}} style={{left:p.x-32,top:p.y+point.offsetY-32,zIndex:calculateZIndex(point.gx,point.gy,LAYER_OFFSETS.FURNITURE+(point.offsetY<0?2:1))}}/>;})}
          {Array.from({length:24},(_,index) => <i key={index} className="world-effect confetti" data-confetti={index}/>)}
        </>}
      </div>
    </div>
  </div>;
};
