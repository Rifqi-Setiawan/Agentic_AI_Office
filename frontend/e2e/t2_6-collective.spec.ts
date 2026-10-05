import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import type { WorldApp } from '../src/world/WorldApp';
import { mockSnapshotFixture } from '../src/mocks/fixtures';

type EvidenceWindow = Window & { __WORLD_APP__: WorldApp };
for (const [kind, title, zone] of [
  ['pool_party', 'Pesta Kolam', 'Z17'],
  ['fire_drill', 'Simulasi Evakuasi', 'Z17'],
  ['town_hall', 'Pertemuan Kantor', 'Z14'],
] as const) {
  test(`${kind}: Founder keyboard, world, task priority and real expiry`, async ({ page, request }, testInfo) => {
    test.setTimeout(190000);
    const evidence = process.env.OFFICE_COLLECTIVE_EVIDENCE || testInfo.outputPath('collective-evidence');
    fs.mkdirSync(evidence, { recursive: true });
    const errors: string[] = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.goto('/?seed=42');
    await page.waitForFunction(() => (window as EvidenceWindow).__WORLD_APP__?.getChoreographer());
    await expect(page.getByRole('button', { name: `Picu event ${title}`, exact: true })).toHaveCount(0);
    await page.getByRole('button', { name: 'Buka form login Founder' }).click();
    const modal = page.getByTestId('login-founder-modal');
    await modal.locator('input[type="password"]').fill('fixture-founder');
    await modal.getByRole('button', { name: 'Masuk sebagai Founder', exact: true }).click();
    await expect(page.getByTestId('founder-panel')).toBeVisible();
    const emit = async (event: string, data: unknown) => {
      const r = await request.post('/api/v1/test/emit-event', { data: { event, data } });
      expect(r.ok()).toBe(true);
    };
    const agents = mockSnapshotFixture.agents.map(a => ({ ...a, work: 'idle' as const, task: null }));
    for (const a of agents) await emit('agent', a);
    // Browser transport fixture uses the API's supported custom TTL. No clock/ticker changes.
    let payload: Record<string, unknown> = {};
    let started = 0;
    await page.route('**/api/v1/collective', async route => {
      payload = route.request().postDataJSON();
      expect(payload.kind).toBe(kind);
      expect(route.request().headers()['x-office-intent']).toBe('1');
      started = Date.now();
      const now = Math.floor(started / 1000);
      const data = { id: `fixture-${kind}`, kind, title, active: true, started_at: now,
        expires_at: now + 120, participants: agents.map(a => a.id) };
      await emit('collective', data);
      await route.fulfill({ json: data });
    });
    const trigger = page.getByRole('button', { name: `Picu event ${title}`, exact: true });
    await trigger.focus();
    await page.keyboard.press('Enter');
    await expect(page.getByRole('status').filter({ hasText: 'berhasil dipicu' })).toBeVisible();
    const read = () => page.evaluate(() => {
      const w = (window as EvidenceWindow).__WORLD_APP__;
      const choreo = w.getChoreographer()!;
      return w.getCharacterManager()!.getAllCharacters().map(c => ({
        id: c.id, state: c.fsmState, layer: choreo.getAgentState(c.id)?.currentLayer,
        slot: choreo.getCollectiveManager().getAssignment(c.id)?.slot,
        animation: c.getCurrentAnimation(), gx: c.gx, gy: c.gy,
      }));
    });
    await expect.poll(async () => (await read()).filter(c => c.layer === 'collective').length).toBe(agents.length);
    await expect.poll(async () => (await read()).filter(c => c.layer === 'collective' && c.state === 'act').length,
      { timeout: 110000 }).toBe(agents.length);
    const before = await read();
    for (const c of before.filter(c => c.layer === 'collective')) expect(c.slot?.zone).toBe(zone);
    const leader = before.find(c => c.id === (kind === 'town_hall' ? 'jarvis' : 'bastion'))!;
    expect(leader.slot?.type).toBe(kind === 'town_hall' ? 'town_presenter' : 'pool_assembly');
    if (kind === 'pool_party') expect(before.some(c => c.animation === 'swim')).toBe(true);
    const announcement = kind === 'town_hall' ? 'Ringkasan hari ini (WIB)' : kind === 'fire_drill' ? 'Hitung kepala:' : 'berjaga di tepi kolam';
    await expect.poll(() => page.evaluate(text => (window as EvidenceWindow).__WORLD_APP__.getChoreographer()!.getRecentBubbles().some(b => b.text.includes(text)), announcement)).toBe(true);
    const bubbles = await page.evaluate(() => (window as EvidenceWindow).__WORLD_APP__.getChoreographer()!.getRecentBubbles());
    if (kind === 'town_hall') expect(bubbles.find(b => b.text.includes(announcement))?.text).toContain('50 tugas selesai');
    await page.evaluate(z => new Promise<void>(resolve => {
      if (!(window as EvidenceWindow).__WORLD_APP__.flyToZone(z, resolve)) resolve();
    }), zone);
    await page.getByRole('button', { name: 'Tutup panel Founder' }).click();
    await page.screenshot({ path: path.join(evidence, `${kind}-active.png`) });
    await emit('agent', { ...agents.find(a => a.id === 'nova'), work: 'working', task: {
      id: 't-fixture-priority', board: 'office-v2', title: 'Uji prioritas task', status: 'running' } });
    await expect.poll(async () => (await read()).find(c => c.id === 'nova')?.layer).toBe('task');
    expect((await read()).find(c => c.id === 'nova')?.slot).toBeUndefined();
    // Deliberately omit SSE end to verify wall-clock cleanup when transport misses the delta.
    await expect.poll(async () => (await read()).filter(c => c.layer === 'collective').length,
      { timeout: 110000 }).toBe(0);
    expect(Date.now() - started).toBeGreaterThanOrEqual(119000);
    await expect(page.getByTestId('collective-event-badge')).toHaveCount(0);
    const after = await read();
    await page.screenshot({ path: path.join(evidence, `${kind}-ended.png`) });
    fs.writeFileSync(path.join(evidence, `${kind}.json`), JSON.stringify({ fixture: true, accelerated: false,
      custom_ttl_seconds: 120, elapsed_ms: Date.now()-started, payload, before, after, bubbles, errors }, null, 2));
    expect(errors).toEqual([]);
  });
}

test.afterEach(async ({ page }, info) => {
  const evidence = process.env.OFFICE_COLLECTIVE_EVIDENCE || info.outputPath('collective-evidence');
  fs.mkdirSync(evidence, { recursive: true });
  const raw = await page.evaluate(() => {
    const w = (window as EvidenceWindow).__WORLD_APP__;
    return w?.getCharacterManager()?.getAllCharacters().map(c => ({ id: c.id, state: c.fsmState,
      gx: c.gx, gy: c.gy, animation: c.getCurrentAnimation(),
      choreography: w.getChoreographer()?.getAgentState(c.id),
    }));
  }).catch(() => null);
  fs.writeFileSync(path.join(evidence, `${info.title.split(':')[0]}-raw.json`), JSON.stringify({ status: info.status, raw }, null, 2));
});
