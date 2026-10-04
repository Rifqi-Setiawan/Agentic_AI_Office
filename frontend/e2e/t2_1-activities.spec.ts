import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import type { Application } from 'pixi.js';
import type { WorldApp } from '../src/world/WorldApp';
import type { Character as CharacterEntity, CharacterTextures } from '../src/world/Character';
import type { CharacterManager as Manager } from '../src/world/CharacterManager';
import type { Choreographer as Director } from '../src/world/choreographer/Choreographer';
import type { GridMap as Grid } from '../src/navigation/GridMap';

interface AtlasCheck { id: string; anim: string; dir: string; frames: number; distinct: number; visible: boolean }
interface ActivityWindow extends Window {
  __WORLD_APP__: WorldApp;
  __SSE_CLIENT__: { stop(): void };
  __activityAcceptance: {
    chars: CharacterEntity[]; samples: CharacterEntity[]; manager: Manager; choreographer: Director;
    grid: Grid; app: Application; start: number;
    initial: { id: string; animation: string; badge: boolean }[];
    atlasChecks: AtlasCheck[]; labels: string[];
    timing: { frames: number; dt_seconds: number; animations: string[] };
  };
  __writingAcceptance: { animations: string[]; start: number; frames: number };
}


test('T2.1 atlas asli, telemetry fixture, dua arah dan 12 aktivitas', async ({ page }, testInfo) => {
  const evidence = process.env.OFFICE_ACTIVITY_EVIDENCE ?? testInfo.outputPath('activity-evidence');
  fs.mkdirSync(evidence, { recursive: true });
  test.setTimeout(60000);
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/');
  await page.waitForFunction(() => (window as unknown as ActivityWindow).__WORLD_APP__?.getApp());
  await page.setViewportSize({ width: 1280, height: 900 });
  const result = await page.evaluate(async () => {
    // Isolasi fixture dari koneksi SSE dan ticker world utama.
    (window as unknown as ActivityWindow).__SSE_CLIENT__.stop();
    (window as unknown as ActivityWindow).__WORLD_APP__.getApp().stop();
    const load = (url: string) => import(/* @vite-ignore */ url);
    const { Application, Text } = await load('/node_modules/.vite/deps/pixi__js.js');
    const { Character } = await load('/src/world/Character.ts');
    const { CharacterManager, AGENT_SPAWN_DEFS } = await load('/src/world/CharacterManager.ts');
    const { GridMap } = await load('/src/navigation/GridMap.ts');
    const { AStarPathfinder } = await load('/src/navigation/AStarPathfinder.ts');
    const { SlotReservationManager } = await load('/src/navigation/SlotReservationManager.ts');
    const { Choreographer } = await load('/src/world/choreographer/Choreographer.ts');
    const { officeStore } = await load('/src/store/officeStore.ts');
    const map = await (await fetch('/maps/floor1.tmj')).json();
    const grid = new GridMap(map);
    const manager = new CharacterManager();
    const defs = AGENT_SPAWN_DEFS.filter((d: {id: string}) => d.id !== 'guest');
    officeStore.getState().reset();
    for (const def of defs) {
      const slot = grid.getSlot(def.defaultSlotId);
      const char = new Character({ id: def.id, name: def.name, initialGx: slot?.gx ?? def.fallbackGx, initialGy: slot?.gy ?? def.fallbackGy });
      if (slot) char.act(slot);
      manager.addCharacter(char);
      if (def.id !== 'rifqi') officeStore.getState().updateAgentDelta({
        id: def.id, name: def.name, presence: 'on_duty', work: 'working', since: Math.floor(Date.now()/1000), done_today: 0,
        task: { id: `fixture-${def.id}`, title: 'Fixture penerimaan animasi', board: 'fixture', status: 'running' },
      });
    }
    await manager.loadAllCharacterSpritesheets();
    const choreographer = new Choreographer({ characterManager: manager, gridMap: grid,
      pathfinder: new AStarPathfinder(grid), slotManager: new SlotReservationManager(grid) });
    choreographer.init();
    const app = new Application();
    await app.init({ width: 1280, height: 900, backgroundColor: 0x14141e, antialias: false, preference: 'webgl' });
    document.body.replaceChildren(app.canvas);
    app.canvas.style.imageRendering = 'pixelated';
    const labels: string[] = [];
    const addLabel = (text: string, x: number, y: number) => {
      const t = new Text({ text, style: { fontFamily: 'sans-serif', fontSize: 15, fill: 0xffffff } });
      t.position.set(x, y); app.stage.addChild(t); labels.push(text);
    };
    addLabel('Fixture penerimaan T2.1 • gerak khas dari status task • bukan telemetri produksi', 20, 15);
    const chars = defs.map((d: {id: string}) => manager.getCharacter(d.id));
    chars.forEach((char: CharacterEntity, i: number) => {
      app.stage.addChild(char); char.scale.set(2);
      addLabel(char.characterName, 20 + (i % 8) * 155, 190 + Math.floor(i / 8) * 190);
    });
    const activities = [
      ['Berjalan', 'walk'], ['Diskusi', 'stand_talk'], ['Rapat', 'stand_talk'], ['Coding', 'sit_type'],
      ['Riset', 'special'], ['Istirahat', 'drink'], ['Renang', 'swim'], ['Sholat', 'pray_berdiri'],
      ['Gaming', 'game'], ['Menulis', 'special'], ['Monitoring', 'special'], ['Testing', 'special'], ['Papan tulis', 'whiteboard'],
    ];
    const roleIds = ['prism','daedalus','jarvis','prism','oracle','merlin','rifqi','merlin','nova','scribe','bastion','sentinel','merlin'];
    const samples: CharacterEntity[] = [];
    for (let i=0; i<activities.length; i++) {
      const id = roleIds[i];
      const original = manager.getCharacter(id);
      const sample = new Character({ id, name: activities[i][0] });
      sample.setTextures((original as unknown as { textures: CharacterTextures }).textures);
      sample.playAnimation(activities[i][1]); sample.scale.set(2);
      sample.position.set(75+(i%7)*175, 545+Math.floor(i/7)*175);
      app.stage.addChild(sample); samples.push(sample);
      addLabel(activities[i][0], 25+(i%7)*175, 565+Math.floor(i/7)*175);
    }
    // Rifqi tidak mempunyai task Hermes; gerak khas hanya diperlihatkan sebagai sampel atlas.
    chars.find((c: CharacterEntity) => c.id === 'rifqi').playAnimation('special');
    const initial = chars.map((c: CharacterEntity) => ({ id: c.id, animation: c.getCurrentAnimation(), badge: c.badgeContainer.visible }));
    const atlasChecks: AtlasCheck[] = [];
    for (const def of defs) {
      const json = await (await fetch(`/sprites/characters/${def.id}.json`)).json();
      const image = new Image(); image.src = `/sprites/characters/${json.meta.image}`; await image.decode();
      const canvas = document.createElement('canvas'); canvas.width=48; canvas.height=64;
      const ctx = canvas.getContext('2d')!;
      for (const anim of ['swim','game','whiteboard','special','walk','sit_type','stand_talk','drink','pray_berdiri','pray_rukuk','pray_sujud','pray_duduk']) {
        for (const dir of ['se','ne']) {
          const hashes: number[] = [];
          let visible = true;
          for (let f=0;;f++) {
            const info=json.frames[`${def.id}_${anim}_${dir}_${f}.png`]; if (!info) break;
            const r=info.frame; ctx.clearRect(0,0,48,64); ctx.drawImage(image,r.x,r.y,r.w,r.h,0,0,r.w,r.h);
            const data=ctx.getImageData(0,0,48,64).data;
            let hash=2166136261, alpha=0;
            for(let n=0;n<data.length;n++) { hash=Math.imul(hash^data[n],16777619); if(n%4===3) alpha+=data[n]; }
            hashes.push(hash>>>0); visible &&= alpha>0;
          }
          atlasChecks.push({ id:def.id, anim, dir, frames:hashes.length, distinct:new Set(hashes).size, visible });
        }
      }
    }
    const start = performance.now();
    const timing = { frames: 0, dt_seconds: 0, animations: [] as string[] };
    app.ticker.add(() => {
      const dt=app.ticker.deltaMS/1000;
      timing.frames++; timing.dt_seconds += dt;
      choreographer.update(dt); manager.update(dt);
      const animation = manager.getCharacter('scribe').getCurrentAnimation();
      if (!timing.animations.includes(animation)) timing.animations.push(animation);
      chars.forEach((c: CharacterEntity,i: number)=>c.position.set(75+(i%8)*155,175+Math.floor(i/8)*190));
    });
    (window as unknown as ActivityWindow).__activityAcceptance = { chars, samples, manager, choreographer, grid, app, start, initial, atlasChecks, labels, timing };
    return { initial, atlasChecks, labels };
  });
  fs.writeFileSync(path.join(evidence,'browser-initial.json'),JSON.stringify(result,null,2));
  expect(result.initial.filter(c => c.id !== 'rifqi').every(c => c.animation === 'special' && c.badge), JSON.stringify(result.initial)).toBe(true);
  for (const check of result.atlasChecks) {
    expect(check.visible, JSON.stringify(check)).toBe(true);
    expect(check.frames, JSON.stringify(check)).toBeGreaterThan(0);
    if (['swim','game','whiteboard','special'].includes(check.anim)) expect(check.distinct, JSON.stringify(check)).toBeGreaterThan(1);
  }
  await page.screenshot({ path: path.join(evidence,'activities-se.png') });
  await expect.poll(() => page.evaluate(() => (window as unknown as ActivityWindow).__activityAcceptance.timing.animations)).toContain('sit_type');
  const elapsed = await page.evaluate(() => {
    const h=(window as unknown as ActivityWindow).__activityAcceptance;
    h.chars.forEach((c: CharacterEntity)=>c.setFacing('NW')); h.samples.forEach((c: CharacterEntity)=>c.setFacing('NW'));
    return { wall_ms: performance.now()-h.start, ...h.timing };
  });
  await page.screenshot({ path: path.join(evidence,'activities-nw.png') });
  const negative = await page.evaluate(() => {
    const h=(window as unknown as ActivityWindow).__activityAcceptance;
    const s=h.chars.find((c: CharacterEntity)=>c.id==='scribe');
    s.setWorkStatus('stale', s.currentTask);
    const stopped=s.getCurrentAnimation()!=='special' && !s.badgeContainer.visible;
    const n=h.chars.find((c: CharacterEntity)=>c.id==='nova');
    n.setWorkStatus('idle'); n.act(h.grid.getSlotsByType('pool_swim')[0]);
    const swim=n.getCurrentAnimation()==='swim' && !n.badgeContainer.visible;
    n.act(h.grid.getSlotsByType('arcade')[0]);
    const game=n.getCurrentAnimation()==='game';
    n.act(h.grid.getSlotsByType('whiteboard')[0]);
    return { stopped, swim, game, whiteboard:n.getCurrentAnimation()==='whiteboard' };
  });
  expect(Object.values(negative).every(Boolean)).toBe(true);
  expect(errors).toEqual([]);
  fs.writeFileSync(path.join(evidence,'browser-assertions.json'),JSON.stringify({ ...result, timing:elapsed, negative, errors },null,2));
});

test('T2.1 SSE ke world utama: menulis, gerak khas, stale, tanpa task', async ({ page, request }, testInfo) => {
  const evidence = process.env.OFFICE_ACTIVITY_EVIDENCE ?? testInfo.outputPath('activity-evidence');
  fs.mkdirSync(evidence, { recursive: true });
  await page.goto('/');
  await page.waitForFunction(() => (window as unknown as ActivityWindow).__WORLD_APP__?.getCharacterManager()?.getCharacter('scribe'));
  await page.evaluate(() => {
    const w = (window as unknown as ActivityWindow).__WORLD_APP__;
    const history = { animations: [] as string[], start: performance.now(), frames: 0 };
    (window as unknown as ActivityWindow).__writingAcceptance = history;
    w.getApp().ticker.add(() => {
      const char = w.getCharacterManager().getCharacter('scribe');
      history.frames++;
      if (char.workStatus === 'working' && !history.animations.includes(char.getCurrentAnimation())) {
        history.animations.push(char.getCurrentAnimation());
      }
    });
  });
  const agent = { id: 'scribe', name: 'Scribe', presence: 'on_duty', work: 'working',
    since: Math.floor(Date.now()/1000), done_today: 0,
    task: { id: 'fixture-sse-writing', title: 'Menulis fixture penerimaan', board: 'fixture', status: 'running' } };
  const emit = async (data: unknown, seq: number) => {
    const response = await request.post('/api/v1/test/emit-event', { data: { event: 'agent', id: seq, data } });
    expect(response.ok()).toBe(true);
  };
  await emit(agent, 91001);
  await expect.poll(() => page.evaluate(() => (window as unknown as ActivityWindow).__writingAcceptance.animations)).toContain('special');
  await expect.poll(() => page.evaluate(() => (window as unknown as ActivityWindow).__writingAcceptance.animations)).toContain('sit_type');
  await emit({ ...agent, work: 'stale' }, 91002);
  const visual = () => page.evaluate(() => {
    const c = (window as unknown as ActivityWindow).__WORLD_APP__.getCharacterManager().getCharacter('scribe');
    return { animation: c.getCurrentAnimation(), badge: c.badgeContainer.visible };
  });
  await expect.poll(visual).toEqual({ animation: 'idle', badge: false });
  await emit({ ...agent, task: null }, 91003);
  await expect.poll(visual).toEqual({ animation: 'idle', badge: false });
  const result = await page.evaluate(() => {
    const h = (window as unknown as ActivityWindow).__writingAcceptance;
    return { ...h, elapsed_ms: performance.now()-h.start };
  });
  fs.writeFileSync(path.join(evidence, 'sse-world-writing.json'), JSON.stringify(result, null, 2));
  await page.screenshot({ path: path.join(evidence, 'sse-world.png') });
});
