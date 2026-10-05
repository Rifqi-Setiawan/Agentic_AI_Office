import { test, expect } from '@playwright/test';
import { join } from 'node:path';

test('audio default off, real lazy fetch/decode/play, keyboard volume, mute and reload', async ({ page, request }, testInfo) => {
  const evidence = process.env.OFFICE_AUDIO_EVIDENCE || testInfo.outputPath('audio-evidence');
  const audioRequests: string[] = [];
  page.on('request', (r) => { if (new URL(r.url()).pathname.startsWith('/audio/')) audioRequests.push(r.url()); });
  await page.goto('/?seed=42');
  const enable = page.getByRole('button', { name: 'Nyalakan suara', exact: true });
  await expect(enable).toHaveAttribute('aria-pressed', 'false');
  await expect(page.locator('canvas')).toBeVisible();
  expect(audioRequests).toEqual([]);
  await enable.focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('button', { name: 'Matikan suara' })).toContainText('Suara aktif');
  expect(audioRequests.length).toBeGreaterThan(0);
  const diagnostics = async () => page.evaluate(() => {
    const { Howler } = window as unknown as { Howler: { _howls: { _src: string; state: () => string; playing: () => boolean; volume: () => number }[] } };
    return Howler._howls.map((sound: { _src: string; state: () => string; playing: () => boolean; volume: () => number }) => ({ src: sound._src, state: sound.state(), playing: sound.playing(), volume: sound.volume() }));
  });
  await expect.poll(async () => (await diagnostics()).some((s: { state: string; playing: boolean }) => s.state === 'loaded' && s.playing)).toBe(true);
  const volume = page.getByRole('slider', { name: 'Volume suara' });
  await volume.focus();
  await page.keyboard.press('ArrowRight');
  await expect(volume).toHaveValue('36');
  await expect.poll(async () => (await diagnostics())[0]?.volume).toBe(.36);
  for (const [seq, kind, agent] of [[9001, 'task_done', 'forge'], [9002, 'task_failed', 'forge'], [9003, 'task_done', 'sentinel']] as const) {
    await request.post('/api/v1/test/emit-event', { data: { event: 'event', id: seq, data: { seq, kind, agent, ts: Date.now()/1000, board: 'office', message: 'Uji audio' } } });
  }
  await request.post('/api/v1/test/emit-event', { data: { event: 'collective', id: 9004, data: { id: 'audio-prayer', kind: 'sholat', title: 'Sholat Berjamaah', started_at: Date.now()/1000, expires_at: Date.now()/1000 + 60, active: true, participants: [] } } });
  for (const file of ['done.wav', 'failed.wav', 'stamp.wav', 'adzan.mp3']) await expect.poll(() => audioRequests.some((url) => url.endsWith(file))).toBe(true);
  await expect.poll(async () => (await diagnostics()).find((s: { src: string }) => s.src.endsWith('adzan.mp3'))?.playing).toBe(true);
  console.log('Actual Howler decoding/playback:', await diagnostics());
  await page.screenshot({ path: join(evidence, 'audio-enabled.png'), fullPage: true });
  await page.getByRole('button', { name: 'Matikan suara' }).click();
  expect(await diagnostics()).toEqual([]);
  await expect(volume).toHaveCount(0);
  const count = audioRequests.length;
  await page.reload();
  await expect(enable).toBeVisible();
  await expect(page.locator('canvas')).toBeVisible();
  expect(audioRequests).toHaveLength(count);
  await page.screenshot({ path: join(evidence, 'audio-disabled.png'), fullPage: true });
});

test('asset failure is visible, stops audio and can be retried', async ({ page }, testInfo) => {
  const evidence = process.env.OFFICE_AUDIO_EVIDENCE || testInfo.outputPath('audio-evidence');
  await page.route('http://localhost:5175/audio/**', (route) => route.abort());
  await page.goto('/?seed=42');
  await page.getByRole('button', { name: 'Nyalakan suara', exact: true }).click();
  await expect(page.getByText('Suara gagal dimuat. Coba nyalakan lagi.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Nyalakan suara', exact: true })).toHaveAttribute('aria-pressed', 'false');
  await page.screenshot({ path: join(evidence, 'audio-error.png'), fullPage: true });
  await page.unroute('http://localhost:5175/audio/**');
  await page.getByRole('button', { name: 'Nyalakan suara', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Matikan suara' })).toContainText('Suara aktif');
});
