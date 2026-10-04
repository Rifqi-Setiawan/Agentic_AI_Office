import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import type { WorldApp } from '../src/world/WorldApp';
import type { AgentState } from '../src/types/office';

interface Observation {
  id: string; animation: string; slot: string | null; layer: string | undefined;
  task: string | null; badge: boolean; gx: number; gy: number; elapsed_ms: number;
}
interface WorldEvidenceWindow extends Window {
  __WORLD_APP__: WorldApp;
  __normalActivityEvidence: { start: number; frames: number; observations: Observation[] };
}

// Telemetri fixture masuk lewat SSE mock Vite. Scene, ticker, kecepatan,
// reservasi, A*, pemilihan ambient dan atlas aplikasi tetap berjalan normal.
test('T2.1 seluruh aktivitas melalui world kantor normal dan SSE fixture', async ({ page, request }, testInfo) => {
  test.setTimeout(420000);
  const evidence = process.env.OFFICE_ACTIVITY_EVIDENCE ?? testInfo.outputPath('activity-evidence');
  fs.mkdirSync(evidence, { recursive: true });
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/?seed=42');
  await page.waitForFunction(() => (window as unknown as WorldEvidenceWindow).__WORLD_APP__?.getChoreographer());
  await page.evaluate(() => {
    const w = window as unknown as WorldEvidenceWindow;
    const h = { start: performance.now(), frames: 0, observations: [] as Observation[] };
    w.__normalActivityEvidence = h;
    const last = new Map<string, string>();
    w.__WORLD_APP__.getApp()!.ticker.add(() => {
      h.frames++;
      for (const c of w.__WORLD_APP__.getCharacterManager()!.getAllCharacters()) {
        const slot = c.getCurrentSlot()?.id ?? null;
        const key = `${c.getCurrentAnimation()}:${slot}:${c.currentTask?.id}:${c.badgeContainer.visible}`;
        if (last.get(c.id) === key) continue;
        last.set(c.id, key);
        h.observations.push({ id: c.id, animation: c.getCurrentAnimation(), slot,
          layer: w.__WORLD_APP__.getChoreographer()!.getAgentState(c.id)?.currentLayer,
          task: c.currentTask?.id ?? null, badge: c.badgeContainer.visible,
          gx: c.gx, gy: c.gy, elapsed_ms: performance.now() - h.start });
      }
    });
  });
  let seq = 92000;
  const emit = async (event: string, data: unknown) => {
    const response = await request.post('/api/v1/test/emit-event', { data: { event, id: ++seq, data } });
    expect(response.ok()).toBe(true);
  };
  const ids = ['jarvis','daedalus','oracle','merlin','muse','prism','forge','vector','sentinel','bastion','relay','warden','steward','scribe','nova'];
  const agent = (id: string, work: AgentState['work']): AgentState => ({ id, name: id,
    presence: 'on_duty', work, since: Math.floor(Date.now()/1000), done_today: 0,
    task: work === 'working' ? { id: `fixture-normal-${id}`, title: 'Penerimaan animasi kantor', board: 'fixture', status: 'running' } : null });
  for (const id of ids) await emit('agent', agent(id, 'working'));
  // Semua 15 agen harus mencapai stasiun dan memainkan gerak khas dari task,
  // bukan dari pemanggilan playAnimation oleh tes.
  await expect.poll(() => page.evaluate(ids => {
    const h = (window as unknown as WorldEvidenceWindow).__normalActivityEvidence;
    return ids.filter(id => h.observations.some(o => o.id === id && o.animation === 'special' && o.badge && o.task === `fixture-normal-${id}`));
  }, ids), { timeout: 40000 }).toHaveLength(15);

  const captures: Observation[] = [];
  const capture = async (label: string, animation: string, id?: string, layer?: string) => {
    const query = { animation, id, layer };
    let record: Observation | null = null;
    // Match and capture atomically: a two-second work gesture can end between two evaluate calls.
    await expect.poll(async () => {
      record = await page.evaluate(q => {
        const h = window as unknown as WorldEvidenceWindow;
        const w = h.__WORLD_APP__;
        const c = w.getCharacterManager()!.getAllCharacters().find(c => c.getCurrentAnimation() === q.animation &&
          (!q.id || c.id === q.id) && (!q.layer || w.getChoreographer()!.getAgentState(c.id)?.currentLayer === q.layer));
        if (!c) return null;
        w.getCamera()!.setZoomLevel(2);
        w.getViewport()!.moveCenter(c.x, c.y - 25);
        w.updateCulling();
        return { id: c.id, animation: c.getCurrentAnimation(), slot: c.getCurrentSlot()?.id ?? null,
          layer: w.getChoreographer()!.getAgentState(c.id)?.currentLayer, task: c.currentTask?.id ?? null,
          badge: c.badgeContainer.visible, gx: c.gx, gy: c.gy, elapsed_ms: performance.now()-h.__normalActivityEvidence.start };
      }, query);
      return record !== null;
    }, { timeout: 240000, intervals: [250] }).toBe(true);
    if (!record) throw new Error('Observasi aktivitas tidak ditemukan');
    captures.push(record);
    await page.screenshot({ path: path.join(evidence, `normal-${label}.png`) });
    fs.writeFileSync(path.join(evidence, 'normal-captures.json'), JSON.stringify(captures, null, 2));
  };
  await capture('riset', 'special', 'oracle', 'task');
  await capture('menulis', 'special', 'scribe', 'task');
  await capture('monitoring', 'special', 'bastion', 'task');
  await capture('testing', 'special', 'sentinel', 'task');
  await capture('coding', 'sit_type', 'prism', 'task');
  await capture('whiteboard', 'whiteboard', 'merlin', 'task');
  // Mengubah status lewat SSE saja; ambient menggunakan bobot persona normal.
  // Urutan delta bersama seed memilih cabang arcade, kolam, dan teh secara
  // berulang; RNG produksi, navigasi dan durasi 30–120 detik tetap asli.
  const releaseOrder = ['prism','jarvis','nova','forge','scribe','merlin',
    ...ids.filter(id => !['prism','jarvis','nova','forge','scribe','merlin'].includes(id))];
  for (const id of releaseOrder) await emit('agent', agent(id, 'idle'));
  await capture('berjalan', 'walk');
  await capture('diskusi', 'stand_talk', undefined, 'ambient');
  await capture('istirahat', 'drink', undefined, 'ambient');
  await capture('gaming', 'game', undefined, 'ambient');
  await capture('renang', 'swim', undefined, 'ambient');
  const now = Math.floor(Date.now()/1000);
  await emit('collective', { id: 'fixture-normal-rapat', kind: 'rapat', title: 'Rapat penerimaan animasi',
    active: true, participants: ['jarvis','daedalus'], started_at: now, expires_at: now+120 });
  await capture('rapat', 'stand_talk', 'jarvis', 'collective');
  expect(captures.at(-1)!.slot).toBe('slot_z02_presenter');
  await emit('collective', { id: 'fixture-normal-sholat', kind: 'sholat', title: 'Sholat penerimaan animasi',
    active: true, participants: ['merlin','nova'], started_at: now, expires_at: now+180 });
  await capture('sholat', 'pray', 'merlin', 'collective');
  expect(captures.at(-1)!.slot).toBe('slot_z16_imam');
  // Slot musholla memakai rangkaian 'pray' (berdiri, rukuk, sujud, duduk).
  const prayer = await page.evaluate(async () => {
    const c = (window as unknown as WorldEvidenceWindow).__WORLD_APP__.getCharacter('merlin')!;
    const frames = new Set<number>();
    const start = performance.now();
    await new Promise<void>(resolve => {
      const sample = () => {
        frames.add(c.animatedSprite.currentFrame);
        if (performance.now()-start >= 2000) resolve();
        else requestAnimationFrame(sample);
      };
      requestAnimationFrame(sample);
    });
    return { texture_count: c.animatedSprite.textures.length, frames: [...frames], elapsed_ms: performance.now()-start };
  });
  fs.writeFileSync(path.join(evidence, 'normal-prayer-frames.json'), JSON.stringify(prayer, null, 2));
  expect(prayer.texture_count).toBe(4);
  expect(prayer.frames).toHaveLength(4);
  // Task baru harus membatalkan aktivitas kolektif dan kembali ke stasiun.
  await emit('agent', agent('merlin', 'working'));
  await capture('task-menggantikan-sholat', 'special', 'merlin', 'task');
  expect(captures.at(-1)!.badge).toBe(true);
  expect(captures.at(-1)!.slot).toBe('slot_z04_whiteboard');
  const result = await page.evaluate(() => {
    const w = window as unknown as WorldEvidenceWindow;
    return { ...w.__normalActivityEvidence, elapsed_ms: performance.now()-w.__normalActivityEvidence.start };
  });
  fs.writeFileSync(path.join(evidence, 'normal-world-assertions.json'), JSON.stringify({ fixture: true, accelerated: false, captures, ...result, errors }, null, 2));
  expect(errors).toEqual([]);
  expect(result.frames).toBeGreaterThan(100);
  expect(captures).toHaveLength(14);
  for (const c of captures.filter(c => c.layer === 'ambient' || c.layer === 'collective')) expect(c.badge).toBe(false);
});


test.afterEach(async ({ page }, testInfo) => {
  const evidence = process.env.OFFICE_ACTIVITY_EVIDENCE ?? testInfo.outputPath('activity-evidence');
  fs.mkdirSync(evidence, { recursive: true });
  const raw = await page.evaluate(() => {
    const w = window as unknown as WorldEvidenceWindow;
    return w.__normalActivityEvidence ? { ...w.__normalActivityEvidence,
      elapsed_ms: performance.now()-w.__normalActivityEvidence.start } : null;
  }).catch(() => null);
  fs.writeFileSync(path.join(evidence, 'normal-world-raw.json'), JSON.stringify({ status: testInfo.status, raw }, null, 2));
});
