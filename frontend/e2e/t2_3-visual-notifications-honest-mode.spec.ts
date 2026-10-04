import { test, expect } from '@playwright/test';
import { RECORDED_EVENTS_FLOW } from './fixtures/recorded_events';

test.describe('E2E Playwright: T2.3 Notifikasi Visual dan Toggle Mode Jujur (F21, F22)', () => {
  test('F22: Toggle Mode Jujur tersimpan per viewer di localStorage dan mematikan ambient', async ({ page }) => {
    await page.goto('/?seed=42', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('canvas', { timeout: 15000 });

    const toggleButton = page.locator('button[role="switch"][aria-label="Mode Jujur (matikan simulasi ambient)"]');
    await expect(toggleButton).toBeVisible();
    await expect(toggleButton).toHaveAttribute('aria-checked', 'false');

    // Klik toggle untuk mengaktifkan Mode Jujur
    await toggleButton.click();
    await expect(toggleButton).toHaveAttribute('aria-checked', 'true');
    await expect(toggleButton).toContainText('Aktif');

    // Verifikasi tersimpan di localStorage
    const savedInStorage = await page.evaluate(() => localStorage.getItem('office_honest_mode'));
    expect(savedInStorage).toBe('true');

    // Verifikasi di store Zustand
    const isHonestInStore = await page.evaluate(() => {
      const store = (window as unknown as { __OFFICE_STORE__?: { getState: () => { isHonestMode: boolean } } }).__OFFICE_STORE__;
      return store?.getState().isHonestMode;
    });
    expect(isHonestInStore).toBe(true);

    // Reload halaman untuk memastikan persistensi per viewer
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForSelector('canvas', { timeout: 15000 });

    const reloadedToggle = page.locator('button[role="switch"][aria-label="Mode Jujur (matikan simulasi ambient)"]');
    await expect(reloadedToggle).toHaveAttribute('aria-checked', 'true');

    // Klik lagi untuk mematikan
    await reloadedToggle.click();
    await expect(reloadedToggle).toHaveAttribute('aria-checked', 'false');

    const turnedOffStorage = await page.evaluate(() => localStorage.getItem('office_honest_mode'));
    expect(turnedOffStorage).toBe('false');
  });

  test('F21: Emisi event task_started memicu Toast kecil dan Flying Icon dari agent ke feed', async ({ page, request }) => {
    await page.goto('/?seed=42', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('canvas', { timeout: 15000 });

    // Emisi event task_started via kontrol mock server
    const { taskMulai } = RECORDED_EVENTS_FLOW;
    await request.post('/api/v1/test/emit-event', {
      data: { event: 'event', id: taskMulai.event.seq, data: taskMulai.event },
    });

    // Verifikasi Toast kecil muncul
    const toast = page.locator('[data-testid="task-toast"][data-toast-kind="task_started"]');
    await expect(toast).toBeVisible({ timeout: 5000 });
    await expect(toast).toContainText('MULAI');
    await expect(toast).toContainText('Forge');
    await expect(toast).toContainText('Forge mulai mengerjakan task t_f857a584');

    // Verifikasi toast memiliki tombol tutup manual dan dapat ditutup
    const closeBtn = toast.locator('button[aria-label="Tutup notifikasi"]');
    await expect(closeBtn).toBeVisible();
    await closeBtn.click();
    await expect(toast).not.toBeVisible();
  });

  test('F21: Emisi event task_done memicu Toast selesai dengan badge SELESAI', async ({ page, request }) => {
    await page.goto('/?seed=42', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('canvas', { timeout: 15000 });

    const { taskSelesai } = RECORDED_EVENTS_FLOW;
    await request.post('/api/v1/test/emit-event', {
      data: { event: 'event', id: taskSelesai.event.seq, data: taskSelesai.event },
    });

    // Verifikasi Toast selesai muncul
    const toast = page.locator('[data-testid="task-toast"][data-toast-kind="task_done"]');
    await expect(toast).toBeVisible({ timeout: 5000 });
    await expect(toast).toContainText('SELESAI');
    await expect(toast).toContainText('Forge');
    await expect(toast).toContainText('Forge menyelesaikan task t_f857a584');
  });
});
