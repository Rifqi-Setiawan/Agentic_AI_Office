import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import type { worldApp } from '../src/world/WorldApp';
import type { officeStore } from '../src/store/officeStore';
import type { sseClient } from '../src/services/sseClient';
import { RECORDED_EVENTS_FLOW } from './fixtures/recorded_events';
import { VITALS_FIXTURES } from './fixtures/vitals_fixtures';

type Diagnostics = Window & {
  __WORLD_APP__: typeof worldApp;
  __OFFICE_STORE__: typeof officeStore;
  __SSE_CLIENT__: typeof sseClient;
};
const evidenceDir = process.env.OFFICE_REPAIR_EVIDENCE;
if (!evidenceDir) throw new Error('OFFICE_REPAIR_EVIDENCE wajib diisi');
const csp = "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self'; worker-src 'self' blob:; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none';";

test('Build produksi: CSP ketat, peta, 16 sprite dan CPU tinggi 65 detik nyata', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  await page.route('**/*', async route => {
    if (route.request().resourceType() !== 'document') return route.continue();
    const response = await route.fetch();
    await route.fulfill({ response, headers: { ...response.headers(), 'content-security-policy': csp } });
  });
  const response = await page.goto('/?seed=42');
  expect(response?.headers()['content-security-policy']).toBe(csp);
  await page.waitForFunction(() => {
    const world = (window as Diagnostics).__WORLD_APP__;
    const chars = world?.getCharacterManager()?.getAllCharacters().filter(char => char.id !== 'guest');
    return world?.getLoadedMap() && world.getVitalsEnvironmentManager() && chars?.length === 16 &&
      chars.every(char => char.animatedSprite.texture.source.width > 1);
  }, undefined, { timeout: 20000 });
  const scene = await page.evaluate(async () => {
    const world = (window as Diagnostics).__WORLD_APP__;
    const app = world.getApp()!;
    const image = await app.renderer.extract.pixels({ target: app.stage });
    const colors = new Set<number>();
    for (let i = 0; i < image.pixels.length; i += 4) {
      colors.add((image.pixels[i] << 16) | (image.pixels[i + 1] << 8) | image.pixels[i + 2]);
    }
    return { colors: colors.size, width: image.width, height: image.height,
      agents: world.getCharacterManager()!.getAllCharacters().filter(char => char.id !== 'guest').map(char => char.id) };
  });
  // DevTools dapat melewati CSP; gunakan skrip same-origin untuk kontrol negatif nyata.
  await page.route('**/csp-probe.js', route => route.fulfill({
    contentType: 'application/javascript',
    body: "try { new Function('return 1')(); document.documentElement.dataset.evalPolicy = 'allowed'; } catch { document.documentElement.dataset.evalPolicy = 'blocked'; }",
  }));
  await page.evaluate(() => {
    const script = document.createElement('script');
    script.src = '/csp-probe.js';
    document.head.appendChild(script);
  });
  await expect(page.locator('html')).toHaveAttribute('data-eval-policy', 'blocked');
  expect(scene.colors).toBeGreaterThan(100);
  expect(scene.agents).toHaveLength(16);
  await page.locator('canvas').screenshot({ path: path.join(evidenceDir!, 'strict-csp-world.png') });

  // Manual atmosphere must change rendered pixels, not only the HUD label.
  await page.evaluate(() => (window as Diagnostics).__OFFICE_STORE__.getState().setAtmosphereOverride('day'));
  await page.waitForTimeout(2200);
  const atmosphere = async () => page.evaluate(async () => {
    const world = (window as Diagnostics).__WORLD_APP__;
    const pixels = (await world.getApp()!.renderer.extract.pixels({ target: world.getApp()!.stage })).pixels;
    let brightness = 0;
    for (let i = 0; i < pixels.length; i += 4) brightness += pixels[i] + pixels[i + 1] + pixels[i + 2];
    return { brightness, matrix: world.getWorldContainer()!.filters?.[0] &&
      Array.from((world.getWorldContainer()!.filters![0] as unknown as { matrix: number[] }).matrix),
      lights: world.getLoadedMap()!.containers.furniture.children.filter(c => c.label.startsWith('AtmosphereLight_')).map(c => c.alpha) };
  });
  const day = await atmosphere();
  await page.evaluate(() => (window as Diagnostics).__OFFICE_STORE__.getState().setAtmosphereOverride('night'));
  await expect(page.getByLabel(/Mode atmosfer: .*Malam \(Manual\)/)).toBeVisible();
  await page.waitForTimeout(2200);
  const night = await atmosphere();
  expect(night.matrix?.[0]).toBeCloseTo(.52);
  expect(night.brightness).toBeLessThan(day.brightness * .9);
  expect(night.lights.length).toBeGreaterThan(0);
  expect(night.lights.every(alpha => alpha > 0)).toBe(true);
  await page.locator('canvas').screenshot({ path: path.join(evidenceDir!, 'night-filter.png') });
  await page.evaluate(() => (window as Diagnostics).__OFFICE_STORE__.getState().setAtmosphereOverride('auto'));
  await page.waitForTimeout(2200);
  const restored = await atmosphere();
  expect(restored.matrix?.[0]).toBe(1);
  fs.writeFileSync(path.join(evidenceDir!, 'atmosphere.json'), JSON.stringify({ day, night, restored }, null, 2));

  const collective = { ...RECORDED_EVENTS_FLOW.rapat.collective,
    started_at: Math.floor(Date.now() / 1000), expires_at: Math.floor(Date.now() / 1000) + 300 };
  await page.evaluate(value => (window as Diagnostics).__OFFICE_STORE__.getState().updateCollective(value), collective);
  const badge = page.getByTestId('collective-event-badge');
  await expect(badge).toContainText('(rapat)');
  await expect(badge).toContainText(`${collective.participants.length} undangan`);

  // Isolasi fixture di browser ini; tidak menulis telemetri host atau Hermes.
  await page.evaluate(vitals => {
    const diagnostics = window as Diagnostics;
    diagnostics.__SSE_CLIENT__.stop();
    diagnostics.__OFFICE_STORE__.getState().updateVitals(vitals);
  }, VITALS_FIXTURES.cpuHigh);
  const samples: unknown[] = [];
  const sample = async () => page.evaluate(() => {
    const manager = (window as Diagnostics).__WORLD_APP__.getVitalsEnvironmentManager()!;
    return { monotonicMs: performance.now(), status: manager.getStatus(), led: manager.isLedBlinkingFast(),
      fan: manager.isAcFanSpinning(), sweat: manager.isBastionSweating() };
  });
  await expect.poll(async () => (await sample()).status.cpuPercent).toBe(88.5);
  const start = await sample();
  expect(start.status.isCpuAlert).toBe(false);
  samples.push(start);
  await page.waitForTimeout(30000);
  const midpoint = await sample();
  samples.push(midpoint);
  expect(midpoint.status.cpuHighDuration).toBeGreaterThanOrEqual(29);
  expect(midpoint.status.isCpuAlert).toBe(false);
  await page.waitForTimeout(35000);
  const end = await sample();
  samples.push(end);
  expect(end.monotonicMs - start.monotonicMs).toBeGreaterThanOrEqual(65000);
  expect(end.status.cpuHighDuration).toBeGreaterThanOrEqual(60);
  expect(end.status.isCpuAlert).toBe(true);
  expect([end.led, end.fan, end.sweat]).toEqual([true, true, true]);
  await page.locator('canvas').screenshot({ path: path.join(evidenceDir!, 'cpu-high-real-65s.png') });
  for (const vitals of [VITALS_FIXTURES.normal, { ...VITALS_FIXTURES.cpuHigh, stale: true }, null]) {
    await page.evaluate(value => (window as Diagnostics).__OFFICE_STORE__.setState({ vitals: value }), VITALS_FIXTURES.cpuHigh);
    await expect.poll(async () => (await sample()).status.cpuHighDuration).toBeGreaterThan(0.2);
    await page.evaluate(value => {
      const store = (window as Diagnostics).__OFFICE_STORE__;
      store.setState({ vitals: value });
    }, vitals);
    await expect.poll(async () => (await sample()).status.cpuPercent).toBe(vitals?.cpu_percent ?? 0);
    await expect.poll(async () => (await sample()).status.isStale).toBe(Boolean(vitals && 'stale' in vitals && vitals.stale));
    await expect.poll(async () => (await sample()).status.cpuHighDuration).toBe(0);
    const reset = await sample();
    samples.push(reset);
    expect([reset.status.isCpuAlert, reset.led, reset.fan, reset.sweat]).toEqual([false, false, false, false]);
  }
  fs.writeFileSync(path.join(evidenceDir!, 'production-real-vitals.json'), JSON.stringify({ csp, scene, samples, errors }, null, 2));
  console.log(JSON.stringify({ csp, scene, samples, errors }));
  expect(errors).toEqual([]);
});
