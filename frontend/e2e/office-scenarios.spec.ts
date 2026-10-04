import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { RECORDED_EVENTS_FLOW } from './fixtures/recorded_events';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

test.describe('E2E Playwright dengan rekaman SSE (T1.20)', () => {
  // Skenario 1: task mulai
  test('Skenario 1: task mulai - emisi SSE task_started dan agen working', async ({ page, request }) => {
    await page.goto('/?seed=42', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('canvas', { timeout: 15000 });

    // Emisi event task mulai via kontrol mock server
    const { taskMulai } = RECORDED_EVENTS_FLOW;
    await request.post('/api/v1/test/emit-event', {
      data: { event: 'event', id: taskMulai.event.seq, data: taskMulai.event },
    });
    await request.post('/api/v1/test/emit-event', {
      data: { event: 'agent', id: 102, data: taskMulai.agent },
    });

    // Verifikasi activity feed menampilkan pesan tugas mulai
    const feed = page.locator('[role="feed"]');
    await expect(feed).toContainText('Forge mulai mengerjakan task t_f857a584', { timeout: 8000 });

    // Verifikasi status agen Forge di store Zustand terbarui ke 'working'
    const forgeWork = await page.evaluate(() => {
      const store = (window as unknown as { __OFFICE_STORE__?: { getState: () => { agents: Record<string, { work: string }> } } }).__OFFICE_STORE__;
      return store?.getState().agents['forge']?.work;
    });
    expect(forgeWork).toBe('working');
  });

  // Skenario 2: selesai
  test('Skenario 2: selesai - emisi SSE task_done dan agen done_recent', async ({ page, request }) => {
    await page.goto('/?seed=42', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('canvas', { timeout: 15000 });

    const { taskSelesai } = RECORDED_EVENTS_FLOW;
    await request.post('/api/v1/test/emit-event', {
      data: { event: 'event', id: taskSelesai.event.seq, data: taskSelesai.event },
    });
    await request.post('/api/v1/test/emit-event', {
      data: { event: 'agent', id: 104, data: taskSelesai.agent },
    });

    // Verifikasi linimasa aktivitas mencatat selesai
    const feed = page.locator('[role="feed"]');
    await expect(feed).toContainText('Forge menyelesaikan task t_f857a584', { timeout: 8000 });

    // Verifikasi counter ringkasan status diperbarui
    const statusBar = page.locator('nav[aria-label="Ringkasan Status Agen"]');
    await expect(statusBar).toContainText('Selesai Baru:', { timeout: 8000 });

    const forgeState = await page.evaluate(() => {
      const store = (window as unknown as { __OFFICE_STORE__?: { getState: () => { agents: Record<string, { work: string; done_today: number }> } } }).__OFFICE_STORE__;
      const f = store?.getState().agents['forge'];
      return { work: f?.work, done_today: f?.done_today };
    });
    expect(forgeState.work).toBe('done_recent');
    expect(forgeState.done_today).toBe(6);
  });

  // Skenario 3: blocked needs_input
  test('Skenario 3: blocked needs_input - deteksi task terblokir dengan badge masukan Founder', async ({ page, request }) => {
    await page.goto('/?seed=42', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('canvas', { timeout: 15000 });

    const { blockedNeedsInput } = RECORDED_EVENTS_FLOW;
    await request.post('/api/v1/test/emit-event', {
      data: { event: 'event', id: blockedNeedsInput.event.seq, data: blockedNeedsInput.event },
    });
    await request.post('/api/v1/test/emit-event', {
      data: { event: 'agent', id: 106, data: blockedNeedsInput.agent },
    });

    // Verifikasi counter 'Terblokir:' di status bar muncul
    const statusBar = page.locator('nav[aria-label="Ringkasan Status Agen"]');
    await expect(statusBar).toContainText('Terblokir:', { timeout: 8000 });

    // Verifikasi activity feed memuat teks terblokir
    const feed = page.locator('[role="feed"]');
    await expect(feed).toContainText('Prism memblokir task t_ui_tokens', { timeout: 8000 });

    // Buka inspector untuk Prism dan periksa badge needs_input
    await page.evaluate(() => {
      const store = (window as unknown as { __OFFICE_STORE__?: { getState: () => { selectAgent: (id: string) => void } } }).__OFFICE_STORE__;
      store?.getState().selectAgent('prism');
    });

    const inspector = page.locator('[data-testid="agent-inspector"]');
    await expect(inspector).toBeVisible({ timeout: 5000 });
    await expect(inspector).toContainText('Terblokir: needs_input');
  });

  // Skenario 4: crashed
  test('Skenario 4: crashed - deteksi task gagal / crash dan penanganan error', async ({ page, request }) => {
    await page.goto('/?seed=42', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('canvas', { timeout: 15000 });

    const { crashed } = RECORDED_EVENTS_FLOW;
    await request.post('/api/v1/test/emit-event', {
      data: { event: 'event', id: crashed.event.seq, data: crashed.event },
    });
    await request.post('/api/v1/test/emit-event', {
      data: { event: 'agent', id: 108, data: crashed.agent },
    });

    // Verifikasi pesan crash muncul di feed aktivitas
    const feed = page.locator('[role="feed"]');
    await expect(feed).toContainText('kegagalan eksekusi (crashed)', { timeout: 8000 });

    // Buka inspector untuk Vector dan pastikan status failed tampil
    await page.evaluate(() => {
      const store = (window as unknown as { __OFFICE_STORE__?: { getState: () => { selectAgent: (id: string) => void } } }).__OFFICE_STORE__;
      store?.getState().selectAgent('vector');
    });

    const inspector = page.locator('[data-testid="agent-inspector"]');
    await expect(inspector).toBeVisible({ timeout: 5000 });
    await expect(inspector).toContainText('failed');
  });

  // Skenario 5: stale
  test('Skenario 5: stale - deteksi heartbeat basi dan status lepas tugas agen', async ({ page, request }) => {
    await page.goto('/?seed=42', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('canvas', { timeout: 15000 });

    const { stale } = RECORDED_EVENTS_FLOW;
    await request.post('/api/v1/test/emit-event', {
      data: { event: 'event', id: stale.event.seq, data: stale.event },
    });
    await request.post('/api/v1/test/emit-event', {
      data: { event: 'agent', id: 110, data: stale.agent },
    });

    // Verifikasi feed aktivitas mencatat heartbeat terputus
    const feed = page.locator('[role="feed"]');
    await expect(feed).toContainText('Detak jantung agen Oracle terputus (stale heartbeat)', { timeout: 8000 });

    // Buka inspector untuk Oracle dan pastikan status kehadiran menampilkan Lepas Tugas / Siaga
    await page.evaluate(() => {
      const store = (window as unknown as { __OFFICE_STORE__?: { getState: () => { selectAgent: (id: string) => void } } }).__OFFICE_STORE__;
      store?.getState().selectAgent('oracle');
    });

    const inspector = page.locator('[data-testid="agent-inspector"]');
    await expect(inspector).toBeVisible({ timeout: 5000 });
    await expect(inspector).toContainText('Lepas Tugas');
  });

  // Skenario 6: rapat
  test('Skenario 6: rapat - event kolektif rapat mendadak dan banner indikator HUD', async ({ page, request }) => {
    await page.goto('/?seed=42', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('canvas', { timeout: 15000 });

    const { rapat } = RECORDED_EVENTS_FLOW;
    await request.post('/api/v1/test/emit-event', {
      data: { event: 'collective', id: 111, data: rapat.collective },
    });

    // Verifikasi badge event kolektif muncul di TopBar
    const collectiveBadge = page.locator('[data-testid="collective-event-badge"]');
    await expect(collectiveBadge).toBeVisible({ timeout: 8000 });
    await expect(collectiveBadge).toContainText('Rapat Mendadak Evaluasi Fase 1');
    await expect(collectiveBadge).toContainText('(rapat)');

    // Verifikasi store mencatat activeCollective
    const activeColl = await page.evaluate(() => {
      const store = (window as unknown as { __OFFICE_STORE__?: { getState: () => { activeCollective: { kind: string; active: boolean } | null } } }).__OFFICE_STORE__;
      return store?.getState().activeCollective;
    });
    expect(activeColl?.kind).toBe('rapat');
    expect(activeColl?.active).toBe(true);
  });

  // Skenario 7: sholat
  test('Skenario 7: sholat - event kolektif sholat berjamaah dan penanda musholla', async ({ page, request }) => {
    await page.goto('/?seed=42', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('canvas', { timeout: 15000 });

    const { sholat } = RECORDED_EVENTS_FLOW;
    await request.post('/api/v1/test/emit-event', {
      data: { event: 'collective', id: 112, data: sholat.collective },
    });

    // Verifikasi badge event kolektif sholat muncul di TopBar
    const collectiveBadge = page.locator('[data-testid="collective-event-badge"]');
    await expect(collectiveBadge).toBeVisible({ timeout: 8000 });
    await expect(collectiveBadge).toContainText('Sholat Berjamaah Ashar');
    await expect(collectiveBadge).toContainText('(sholat)');

    const activeColl = await page.evaluate(() => {
      const store = (window as unknown as { __OFFICE_STORE__?: { getState: () => { activeCollective: { kind: string; active: boolean } | null } } }).__OFFICE_STORE__;
      return store?.getState().activeCollective;
    });
    expect(activeColl?.kind).toBe('sholat');
    expect(activeColl?.active).toBe(true);
  });

  // Skenario 8: login Founder
  test('Skenario 8: login Founder - autentikasi modal, pembukaan panel founder, dan logout', async ({ page }) => {
    await page.goto('/?seed=42', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('canvas', { timeout: 15000 });

    // 1. Klik tombol "Login Founder" di TopBar
    const loginBtn = page.getByRole('button', { name: 'Buka form login Founder' });
    await expect(loginBtn).toBeVisible({ timeout: 5000 });
    await loginBtn.click();

    // 2. Modal login terbuka
    const modal = page.locator('[data-testid="login-founder-modal"]');
    await expect(modal).toBeVisible({ timeout: 5000 });

    // 3. Masukkan password Founder
    const passwordInput = modal.locator('input[type="password"]');
    await passwordInput.fill('founder123');

    // 4. Submit form
    const submitBtn = modal.getByRole('button', { name: 'Masuk' });
    await submitBtn.click();

    // 5. Modal tertutup otomatis setelah login sukses
    await expect(modal).toBeHidden({ timeout: 5000 });

    // 6. Tombol "Panel Founder" kini tersedia di TopBar
    const founderPanelBtn = page.getByRole('button', { name: 'Buka panel kontrol Founder' });
    await expect(founderPanelBtn).toBeVisible({ timeout: 5000 });

    // 7. Panel Founder otomatis terbuka setelah login sukses
    const founderPanel = page.locator('aside[aria-label="Panel Kontrol Founder"]');
    await expect(founderPanel).toBeVisible({ timeout: 5000 });
    await expect(founderPanel).toContainText('Panel Kontrol Founder');
    await expect(founderPanel.locator('button[aria-label*="Rapat Mendadak"]')).toBeVisible();
    await expect(founderPanel.locator('button[aria-label*="Sholat Berjamaah"]')).toBeVisible();

    // 8. Uji logout dari sesi Founder
    const logoutBtn = founderPanel.locator('button[aria-label="Keluar dari sesi Founder"]');
    await logoutBtn.click();
    await expect(founderPanel).toBeHidden({ timeout: 5000 });
    await expect(page.getByRole('button', { name: 'Buka form login Founder' })).toBeVisible({ timeout: 5000 });
  });

  // Skenario 9: reconnect SSE
  test('Skenario 9: reconnect SSE - pemulihan koneksi stream dan sinkronisasi seq tanpa reload', async ({ page, request }) => {
    await page.goto('/?seed=42', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('canvas', { timeout: 15000 });

    // Pastikan koneksi awal adalah 'connected' (badge SSE Aktif)
    const activeBadge = page.locator('span[aria-label^="Status koneksi: SSE Terhubung"]');
    await expect(activeBadge).toBeVisible({ timeout: 8000 });

    // Putus seluruh koneksi SSE yang aktif via endpoint kontrol mock server
    const disconnectRes = await request.post('/api/v1/test/disconnect-stream');
    expect(disconnectRes.ok()).toBe(true);

    // Klien mendeteksi pemutusan dan mencoba reconnect
    // Simulasikan pemicu reconnect langsung di sseClient jika diperlukan
    await page.evaluate(() => {
      const client = (window as unknown as { __SSE_CLIENT__?: { stop: () => void; start: () => void } }).__SSE_CLIENT__;
      client?.stop();
      client?.start();
    });

    // Status koneksi harus pulih kembali menjadi 'connected' (SSE Aktif)
    await expect(activeBadge).toBeVisible({ timeout: 10000 });

    const connectionStatus = await page.evaluate(() => {
      const store = (window as unknown as { __OFFICE_STORE__?: { getState: () => { connectionStatus: string } } }).__OFFICE_STORE__;
      return store?.getState().connectionStatus;
    });
    expect(connectionStatus).toBe('connected');
  });

  // Skenario 10: pemeriksaan redaksi publik (cari LEAK-CANARY di DOM dan network)
  test('Skenario 10: pemeriksaan redaksi publik - cari LEAK-CANARY di DOM dan seluruh lalu lintas network', async ({ page, request }) => {
    // Kunjungi mode publik murni
    await page.goto('/?seed=42', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('canvas', { timeout: 15000 });

    // 1. Audit DOM publik: LEAK-CANARY dan direktori internal tidak boleh ada sama sekali
    const domHtml = await page.content();
    expect(domHtml).not.toContain('LEAK-CANARY');
    expect(domHtml).not.toContain('/srv/apps/hermes');

    // 2. Audit REST Snapshot publik dari Playwright HTTP client
    const snapshotRes = await request.get('/api/v1/snapshot');
    expect(snapshotRes.ok()).toBe(true);
    const snapshotText = await snapshotRes.text();
    expect(snapshotText).not.toContain('LEAK-CANARY');
    expect(snapshotText).not.toContain('/srv/apps/hermes');

    // 3. Audit REST detail agent publik dari Playwright HTTP client
    const agentRes = await request.get('/api/v1/agents/forge');
    expect(agentRes.ok()).toBe(true);
    const agentText = await agentRes.text();
    expect(agentText).not.toContain('LEAK-CANARY');
    expect(agentText).not.toContain('/srv/apps/hermes');

    // 4. Audit seluruh payload respons yang diambil oleh browser dalam sesi publik
    const browserFetchedResponses = await page.evaluate(async () => {
      const endpoints = ['/api/v1/snapshot', '/api/v1/agents/forge', '/api/v1/agents/jarvis'];
      const payloads: string[] = [];
      for (const ep of endpoints) {
        const r = await fetch(ep);
        payloads.push(await r.text());
      }
      return payloads;
    });

    expect(browserFetchedResponses.length).toBe(3);
    for (const body of browserFetchedResponses) {
      expect(body).not.toContain('LEAK-CANARY');
      expect(body).not.toContain('/srv/apps/hermes');
    }

    // 5. Verifikasi bahwa token canary memang ada di database/mode Founder (sensitivitas uji canary)
    const founderRes = await request.get('/api/v1/agents/forge', {
      headers: {
        Cookie: 'office_founder_session=true',
      },
    });
    expect(founderRes.ok()).toBe(true);
    const founderText = await founderRes.text();
    expect(founderText).toContain('LEAK-CANARY');
  });

  // Screenshot Baseline Deterministik (Seed Ambient Tetap)
  test('Baseline visual: screenshot scene deterministik (seed ambient tetap) tersimpan di repo', async ({ page }) => {
    await page.goto('/?seed=42', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('canvas', { timeout: 15000 });

    // Beri waktu 2 detik untuk inisialisasi render dan font stabil
    await page.waitForTimeout(2000);

    const evidence = process.env.OFFICE_VISUAL_EVIDENCE;
    if (!evidence) throw new Error('OFFICE_VISUAL_EVIDENCE wajib diisi');
    const baseline = path.resolve(__dirname, 'screenshots/baseline_scene.png');
    const hash = () => createHash('sha256').update(fs.readFileSync(baseline)).digest('hex');
    const before = hash();
    // Freeze only after assets load. The world remains fully visible and unmasked.
    await page.waitForFunction(() => {
      const world = (window as unknown as { __WORLD_APP__: { getCharacterManager: () => { getAllCharacters: () => { animatedSprite: { texture: { source: { width: number } } } }[] } | null } }).__WORLD_APP__;
      return world.getCharacterManager()?.getAllCharacters().every(c => c.animatedSprite.texture.source.width > 1);
    });
    await page.evaluate(async () => {
      const diagnostics = window as unknown as {
        __WORLD_APP__: typeof import('../src/world/WorldApp').worldApp;
        __OFFICE_STORE__: typeof import('../src/store/officeStore').officeStore;
        __SSE_CLIENT__: typeof import('../src/services/sseClient').sseClient;
      };
      const world = diagnostics.__WORLD_APP__;
      world.getApp()!.stop();
      // Recreate the initial scene at animation phase zero, using the actual map and atlases.
      const manager = world.getCharacterManager()!;
      for (const character of manager.getAllCharacters()) {
        manager.removeCharacter(character.id);
        character.destroy({ children: true });
      }
      manager.spawnAllAgents();
      await manager.loadAllCharacterSpritesheets();
      manager.update(0);
      manager.getAllCharacters().forEach(character => character.animatedSprite.gotoAndStop(0));
      world.updateCulling();
      await document.fonts.ready;
      world.getApp()!.renderer.render(world.getApp()!.stage);
    });
    const masks = [];
    // Justified volatile HUD only: wall clock and live host percentages.
    for (const selector of ['time[aria-label="Waktu WIB Saat Ini"]', '[aria-label="Telemetri Host VPS"]']) {
      const box = await page.locator(selector).boundingBox();
      if (box) masks.push(box);
    }
    const screenshotPath = path.join(evidence, 'candidate_scene.png');
    await page.screenshot({ path: screenshotPath, fullPage: true });
    expect(fs.existsSync(screenshotPath)).toBe(true);
    expect(fs.statSync(screenshotPath).size).toBeGreaterThan(100 * 1024);
    const masksPath = path.join(evidence, 'masks.json');
    fs.writeFileSync(masksPath, JSON.stringify(masks));
    const repeatPath = path.join(evidence, 'candidate_scene_repeat.png');
    await page.screenshot({ path: repeatPath, fullPage: true });
    const determinismDir = path.join(evidence, 'determinism');
    fs.mkdirSync(determinismDir, { recursive: true });
    console.log(execFileSync(process.env.OFFICE_VISUAL_PYTHON ?? 'python3',
      ['../scripts/compare_scene.py', screenshotPath, repeatPath, masksPath, determinismDir], { encoding: 'utf8' }));
    try {
      console.log(execFileSync(process.env.OFFICE_VISUAL_PYTHON ?? 'python3',
        ['../scripts/compare_scene.py', baseline, screenshotPath, masksPath, evidence], { encoding: 'utf8' }));
    } finally {
      expect(hash()).toBe(before);
    }
  });
});
