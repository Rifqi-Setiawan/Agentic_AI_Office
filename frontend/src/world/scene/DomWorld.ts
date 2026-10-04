import { GridMap } from '../../navigation/GridMap';
import { AStarPathfinder } from '../../navigation/AStarPathfinder';
import { SlotReservationManager } from '../../navigation/SlotReservationManager';
import { ModelRegistry } from '../simulation/ModelRegistry';
import { Choreographer } from '../Choreographer';
import { BubbleManager } from '../bubble';
import { VitalsModel } from '../simulation/VitalsModel';
import { EasterEggModel } from '../simulation/EasterEggModel';
import { SceneCamera } from './SceneCamera';
import { applyAtlasFrame, animationFrames, type PreviewAssets, type SpriteAtlas } from './AssetRegistry';
import { screenToGrid } from '../projection';
import type { TiledMapDoc } from '../types';
import { officeStore } from '../../store/officeStore';
import type { WorldController } from '../worldController';

interface ActorNodes { body: HTMLElement; sprite: HTMLElement; missing: HTMLElement; status: HTMLElement; badges: HTMLElement[]; }
export class DomWorld implements WorldController {
  readonly renderer = 'react-css';
  readonly gridMap: GridMap;
  readonly registry: ModelRegistry;
  readonly pathfinder: AStarPathfinder;
  readonly reservations: SlotReservationManager;
  readonly choreographer: Choreographer;
  readonly bubbles: BubbleManager;
  readonly vitals: VitalsModel;
  readonly easterEggs: EasterEggModel;
  private raf = 0; private last = 0; private time = 0; private disposed = false;
  private observer: ResizeObserver;
  private frames = new Map<string, string[]>();
  private actorElements = new Map<string, ActorNodes>();
  private propElements = new Map<string, HTMLElement>();
  private reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  private frameDurations: number[] = [];
  private rgb = [1, 1, 1];
  private paintedFrames = 0;
  private down: { x: number; y: number; lastX: number; lastY: number; moved: boolean; id: number } | null = null;

  constructor(readonly viewport: HTMLElement, readonly world: HTMLElement, readonly camera: SceneCamera,
    map: TiledMapDoc, readonly assets: PreviewAssets, readonly environment: SpriteAtlas,
    readonly atlases: Map<string, SpriteAtlas>) {
    this.gridMap = new GridMap(map);
    this.pathfinder = new AStarPathfinder(this.gridMap);
    this.reservations = new SlotReservationManager(this.gridMap);
    this.registry = new ModelRegistry(this.gridMap);
    const seedParam = new URLSearchParams(location.search).get('seed');
    const seed = Number(seedParam ?? 42);
    let randomState = seed | 0;
    const seededRandom = () => {
      randomState = (randomState + 0x6d2b79f5) | 0;
      let t = Math.imul(randomState ^ randomState >>> 15, 1 | randomState);
      t = (t + Math.imul(t ^ t >>> 7, 61 | t)) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
    const randomFn = seedParam === null ? Math.random : seededRandom;
    this.choreographer = new Choreographer({ characterManager: this.registry, gridMap: this.gridMap,
      pathfinder: this.pathfinder, slotManager: this.reservations, randomFn });
    this.choreographer.init();
    this.bubbles = new BubbleManager({ characterManager: this.registry, camera, randomFn });
    this.choreographer.onBubble(event => this.bubbles.handleChoreographerBubble(event));
    this.vitals = new VitalsModel(this.registry, this.choreographer);
    this.easterEggs = new EasterEggModel(this.registry, this.choreographer, this.bubbles, {randomFn});
    for (const el of world.querySelectorAll<HTMLElement>('[data-agent-id]')) this.actorElements.set(el.dataset.agentId!, {
      body: el, sprite: el.querySelector<HTMLElement>('.actor-sprite')!, missing: el.querySelector<HTMLElement>('.missing-action')!,
      status: el.querySelector<HTMLElement>('.agent-work-state')!, badges: ['.real-work-badge','.fail-stamp','.parcel','.sweat'].map(s=>el.querySelector<HTMLElement>(s)!),
    });
    for (const el of world.querySelectorAll<HTMLElement>('[data-prop-id]')) this.propElements.set(el.dataset.propId!, el);
    this.observer = new ResizeObserver(() => { this.camera.resize(); this.paint(); });
    this.observer.observe(viewport);
    viewport.addEventListener('pointerdown', this.pointerDown);
    viewport.addEventListener('pointermove', this.pointerMove);
    viewport.addEventListener('pointerup', this.pointerUp);
    viewport.addEventListener('pointercancel', this.pointerCancel);
    viewport.addEventListener('wheel', this.wheel, { passive: false });
    document.addEventListener('visibilitychange', this.visibility);
    window.addEventListener('keydown', this.keydown);
    this.camera.resize();
    this.paint();
    if (!document.hidden) this.raf = requestAnimationFrame(this.tick);
  }

  private tick = (now: number) => {
    if (this.disposed || document.hidden) return;
    const elapsed = this.last ? now - this.last : 0;
    const dt = Math.min(.1, elapsed / 1000);
    this.last = now; this.time += dt;
    this.camera.update(dt);
    if (elapsed > 0) { this.frameDurations.push(elapsed); if (this.frameDurations.length > 600) this.frameDurations.shift(); }
    this.choreographer.update(dt);
    this.bubbles.update(dt);
    this.vitals.update(dt, officeStore.getState().vitals);
    this.easterEggs.update(dt);
    this.registry.update(dt);
    this.paint();
    this.raf = requestAnimationFrame(this.tick);
  };

  private paint() {
    const visible = this.camera.getVisibleBounds();
    const state = officeStore.getState();
    const intersects = (x: number, y: number, w: number, h: number) => x + w >= visible.x && x <= visible.x + visible.width && y + h >= visible.y && y <= visible.y + visible.height;
    for (const prop of this.assets.props) {
      const el = this.propElements.get(prop.id);
      if (!el) continue;
      const b = prop.bounds;
      const display = intersects(b.x, b.y, b.width, b.height) ? '' : 'none';
      if (el.style.display !== display) el.style.display = display;
      const night = state.timeOfDay === 'night' || state.timeOfDay === 'dusk';
      const alternate = prop.sprite.replace('.png', '_night.png');
      const sprite = night && this.environment.frames[alternate] ? alternate : prop.sprite;
      if (el.dataset.frame !== sprite) {
        applyAtlasFrame(el, this.environment, sprite, '/sprites/environment.png');
        el.dataset.frame = sprite;
      }
      if (prop.sprite.includes('server_rack')) el.classList.toggle('ram-alert', this.vitals.isRamAlertActive());
    }
    for (const char of this.registry.getAllCharacters()) {
      const nodes = this.actorElements.get(char.id);
      const atlas = this.atlases.get(char.id);
      if (!nodes || !atlas) continue;
      const el = nodes.body;
      const show = char.visible && intersects(char.x - 55, char.y - 90, 110, 110);
      const display = show ? '' : 'none';
      if (el.style.display !== display) el.style.display = display;
      if (!show) continue;
      const transform = `translate(${char.x - 24}px, ${char.y - 59}px)`;
      if (el.style.transform !== transform) el.style.transform = transform;
      if (el.style.zIndex !== String(char.zIndex)) el.style.zIndex = String(char.zIndex);
      const fields = {gx:char.gx.toFixed(4),gy:char.gy.toFixed(4),fsm:char.fsmState,animation:char.getCurrentAnimation(),facing:char.facing};
      for (const [key,value] of Object.entries(fields)) if (el.dataset[key] !== value) el.dataset[key] = value;
      if (el.getAttribute('aria-pressed') !== String(char.isSelected)) el.setAttribute('aria-pressed', String(char.isSelected));
      const action = char.getCurrentAnimation();
      let direction = char.facing.toLowerCase();
      let key = `${char.id}:${action}:${direction}`;
      let frames = this.frames.get(key);
      if (!frames) {
        frames = animationFrames(atlas, char.id, action, direction);
        this.frames.set(key, frames);
      }
      // Baseline-only exception is visible and logged. New production atlases require all four views.
      const mirrored = !frames.length && (direction === 'sw' || direction === 'nw');
      if (mirrored) {
        direction = direction === 'sw' ? 'se' : 'ne';
        key = `${char.id}:${action}:${direction}`;
        frames = this.frames.get(key) ?? animationFrames(atlas, char.id, action, direction);
        this.frames.set(key, frames);
      }
      const sprite = nodes.sprite;
      const missing = !frames.length;
      if (el.dataset.missingAnimation !== (missing ? action : '')) el.dataset.missingAnimation = missing ? action : '';
      if (missing) { sprite.style.visibility = 'hidden'; if(nodes.missing.textContent !== `Aset belum ada: ${action}`) nodes.missing.textContent = `Aset belum ada: ${action}`; }
      else {
        if (sprite.style.visibility) sprite.style.visibility = '';
        if (nodes.missing.textContent) nodes.missing.textContent = '';
        const fps = ({ idle: 4.8, walk: 8.4, swim: 4.8, whiteboard: 5.4, game: 7.2 } as Record<string, number>)[action] ?? 6;
        const phase = action === 'walk' ? char.travelDistance * (8.4 / 2.5) : char.animationTime * fps;
        const frameIndex = this.reduced.matches ? 0 : char.loop ? Math.floor(phase) % frames.length : Math.min(Math.floor(phase), frames.length - 1);
        const name = frames[frameIndex];
        if (sprite.dataset.frame !== name) { applyAtlasFrame(sprite, atlas, name, `/sprites/characters/${char.id}.png`); sprite.dataset.frame = name; }
        const entry = atlas.frames[name];
        const scale = atlas.meta.exportScale ?? 1;
        const left = `${24 + (-entry.sourceSize.w * .5 + entry.spriteSourceSize.x) / scale}px`, top = `${59 + (-entry.sourceSize.h * .92 + entry.spriteSourceSize.y) / scale + char.slotYOffset}px`;
        if(sprite.style.left !== left) sprite.style.left = left;
        if(sprite.style.top !== top) sprite.style.top = top;
        if(sprite.style.transform !== (mirrored ? 'scaleX(-1)' : '')) sprite.style.transform = mirrored ? 'scaleX(-1)' : '';
        if(sprite.dataset.mirroredBaseline !== String(mirrored)) sprite.dataset.mirroredBaseline = String(mirrored);
      }
      const badges = [char.workStatus === 'working' && char.currentTask !== null,char.isShowingFailStamp,char.isCarryingParcel,char.isSweating];
      nodes.badges.forEach((badge,i) => {if(badge.hidden === badges[i]) badge.hidden = !badges[i];});
      const status = nodes.status;
      const text = ['stale', 'blocked', 'failed', 'off_duty'].includes(char.workStatus) ? char.workStatus : '';
      if (status.textContent !== text) status.textContent = text;
    }
    const eggs = this.easterEggs.getState();
    this.toggle(this.world, '[data-effect="friday"]', eggs.isNoDeployFridayActive);
    this.toggle(this.world, '[data-effect="glitch"]', eggs.isGlitchTileActive);
    this.world.querySelectorAll<HTMLElement>('[data-effect="boxes"]').forEach(el => {el.hidden = !this.vitals.isDiskAlertActive();});
    const fan = this.world.querySelector<HTMLElement>('[data-effect="fan"]');
    if (fan) { fan.style.transform = `rotate(${this.time * (this.vitals.isCpuAlertActive() ? 1400 : 28)}deg)`; }
    const particles = this.world.querySelectorAll<HTMLElement>('[data-confetti]');
    particles.forEach((el, index) => {
      const p = this.easterEggs.confetti[index];
      el.style.display = p ? '' : 'none';
      if (p) { el.style.transform = `translate(${p.x}px,${p.y}px)`; el.style.background = p.color; el.style.opacity = String(p.remaining / 2.2); }
    });
    const target = ({ day: [1, 1, 1], dawn: [.92, .84, .78], dusk: [1, .78, .60], night: [.52, .60, .82] })[state.timeOfDay];
    for (let i = 0; i < 3; i++) this.rgb[i] += Math.sign(target[i] - this.rgb[i]) * Math.min(Math.abs(target[i] - this.rgb[i]), .008);
    const matrix = document.getElementById('office-atmosphere-matrix');
    matrix?.setAttribute('values', `${this.rgb[0]} 0 0 0 0 0 ${this.rgb[1]} 0 0 0 0 0 ${this.rgb[2]} 0 0 0 0 0 1 0`);
    const filter = this.rgb.every(v => v === 1) ? 'none' : 'url(#office-atmosphere)';
    if (this.world.style.filter !== filter) this.world.style.filter = filter;
    if (import.meta.env.DEV && this.paintedFrames++ % 60 === 0) {
      const metrics = this.metrics();
      this.viewport.dataset.diagnostics = JSON.stringify({...metrics, time: this.time, zoom: this.camera.zoom, renderer: this.renderer});
    }
    this.viewport.dataset.ready = 'true';
  }

  private toggle(root: HTMLElement, selector: string, show: boolean) {
    const el = root.querySelector<HTMLElement>(selector); if (el) el.hidden = !show;
  }
  private pointerDown = (event: PointerEvent) => {
    if (event.button !== 0 || (event.target as HTMLElement).closest('[data-agent-id]')) return;
    this.down = { x: event.clientX, y: event.clientY, lastX: event.clientX, lastY: event.clientY, moved: false, id: event.pointerId };
    this.viewport.setPointerCapture(event.pointerId);
  };
  private pointerMove = (event: PointerEvent) => {
    if (!this.down || event.pointerId !== this.down.id) return;
    if (Math.hypot(event.clientX - this.down.x, event.clientY - this.down.y) > 5) this.down.moved = true;
    if (this.down.moved) this.camera.pan(event.clientX - this.down.lastX, event.clientY - this.down.lastY);
    this.down.lastX = event.clientX; this.down.lastY = event.clientY;
  };
  private pointerUp = (event: PointerEvent) => {
    if (!this.down || event.pointerId !== this.down.id) return;
    if (!this.down.moved) {
      const p = this.camera.clientToGrid(event.clientX, event.clientY);
      this.handleGridClick(Math.round(p.gx), Math.round(p.gy));
    }
    this.pointerCancel();
  };
  private pointerCancel = () => { if (this.down && this.viewport.hasPointerCapture(this.down.id)) this.viewport.releasePointerCapture(this.down.id); this.down = null; };
  private wheel = (event: WheelEvent) => {
    event.preventDefault(); const r = this.viewport.getBoundingClientRect();
    this.camera.zoomAt(this.camera.zoom * Math.exp(-event.deltaY * .001), event.clientX - r.left, event.clientY - r.top);
  };
  private visibility = () => {
    cancelAnimationFrame(this.raf); this.last = 0;
    if (!document.hidden && !this.disposed) { this.registry.update(0); this.raf = requestAnimationFrame(this.tick); }
  };
  private keydown = (event: KeyboardEvent) => {
    const target = event.target as HTMLElement | null;
    if (target?.closest('input,textarea,select,[contenteditable=true]')) return;
    this.easterEggs.handleKeyDown(event);
  };
  flyToZone(id: string, done?: () => void) { const zone = this.gridMap.zones.find(z => z.id === id); if (!zone) return false; this.camera.focus(zone, this.reduced.matches, done); return true; }
  setZoomLevel(level: 1 | 2 | 3) { this.camera.zoomAt(level); }
  getZoomLevel() { return this.camera.zoom; }
  handleGridClick(gx: number, gy: number) { return this.easterEggs.handleGridClick(gx, gy) || this.choreographer.handleFloorClick(gx, gy); }
  handleFloorClick(x: number, y: number) { const p = screenToGrid(x, y); return this.handleGridClick(Math.round(p.gx), Math.round(p.gy)); }
  handleAgentClick(id: string) { officeStore.getState().selectAgent(id); this.easterEggs.handleAgentClick(id); return this.choreographer.handleAgentClick(id); }
  getCharacterScreenPosition(id: string) { const char = this.registry.getCharacter(id); return char ? this.camera.toScreen(char.x, char.y - 56) : null; }
  getCharacter(id: string) { return this.registry.getCharacter(id); }
  getCharacterManager() { return this.registry; }
  getChoreographer() { return this.choreographer; }
  getGridMap() { return this.gridMap; }
  getPathfinder() { return this.pathfinder; }
  getSlotReservationManager() { return this.reservations; }
  getBubbleManager() { return this.bubbles; }
  getVitalsEnvironmentManager() { return this.vitals; }
  getEasterEggManager() { return this.easterEggs; }
  getCamera() { return this.camera; }
  getViewport() { return this.camera; }
  isReady() { return !this.disposed; }
  metrics() { const sorted = [...this.frameDurations].sort((a,b) => a-b); return { frames: sorted.length, p95FrameMs: sorted[Math.floor(sorted.length * .95)] ?? null, agents: this.registry.getAllCharacters().length, staticProps: this.assets.props.length, clocks: this.disposed ? 0 : 1 }; }
  destroy() {
    if (this.disposed) return; this.disposed = true;
    this.viewport.dataset.ready = 'false'; this.camera.cancelFlight();
    cancelAnimationFrame(this.raf); this.observer.disconnect(); this.pointerCancel();
    document.removeEventListener('visibilitychange', this.visibility);
    window.removeEventListener('keydown', this.keydown);
    this.viewport.removeEventListener('pointerdown', this.pointerDown); this.viewport.removeEventListener('pointermove', this.pointerMove);
    this.viewport.removeEventListener('pointerup', this.pointerUp); this.viewport.removeEventListener('pointercancel', this.pointerCancel);
    this.viewport.removeEventListener('wheel', this.wheel);
    this.easterEggs.destroy(); this.vitals.destroy(); this.bubbles.destroy(); this.choreographer.destroy(); this.registry.destroy();
    this.actorElements.clear(); this.propElements.clear(); this.frames.clear();
  }
}
