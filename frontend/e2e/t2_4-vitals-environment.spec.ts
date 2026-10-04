import { test, expect } from '@playwright/test';
import { VITALS_FIXTURES } from './fixtures/vitals_fixtures';

test.describe('T2.4 Vitals → Perubahan Lingkungan (F23)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/?seed=42', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('canvas', { timeout: 15000 });
    await page.waitForFunction(
      () =>
        Boolean(
          (
            window as unknown as {
              __WORLD_APP__?: {
                getVitalsEnvironmentManager: () => unknown;
                getChoreographer: () => unknown;
              };
            }
          ).__WORLD_APP__?.getVitalsEnvironmentManager(),
        ),
      { timeout: 15000 },
    );
  });

  // --------------------------------------------------------------------------
  // Skenario 1: Ambang CPU > 80% selama 60 dtk → LED cepat, kipas AC berputar, Bastion berkeringat
  // --------------------------------------------------------------------------
  test('Skenario 1: Ambang CPU > 80% selama 60 dtk memicu LED rak cepat, kipas AC, dan Bastion berkeringat', async ({
    page,
    request,
  }) => {
    // 1. Kirim telemetri CPU tinggi (> 80%) via SSE test endpoint
    const emitRes = await request.post('/api/v1/test/emit-event', {
      data: {
        event: 'vitals',
        id: 101,
        data: VITALS_FIXTURES.cpuHigh,
      },
    });
    expect(emitRes.ok()).toBe(true);

    // Verifikasi HUD TopBar menerima persentase CPU baru
    const topBar = page.locator('#top-bar');
    await expect(topBar).toContainText('88.5%', { timeout: 8000 });

    // 2. Sebelum 60 detik kumulatif: verifikasi efek belum aktif
    const beforeSixty = await page.evaluate(() => {
      const vm = (
        window as unknown as {
          __WORLD_APP__?: {
            getVitalsEnvironmentManager: () => {
              isCpuAlertActive: () => boolean;
              isBastionSweating: () => boolean;
            };
          };
        }
      ).__WORLD_APP__?.getVitalsEnvironmentManager();
      return {
        isCpuAlert: vm?.isCpuAlertActive(),
        isBastionSweating: vm?.isBastionSweating(),
      };
    });
    expect(beforeSixty.isCpuAlert).toBe(false);
    expect(beforeSixty.isBastionSweating).toBe(false);

    // 3. Tunggu 65 detik nyata; jangan majukan clock manajer.
    test.setTimeout(110000);
    const started = await page.evaluate(() => performance.now());
    await page.waitForTimeout(65000);
    const elapsed = await page.evaluate(() => performance.now()) - started;
    console.log(JSON.stringify({ check: 'CPU 60 detik nyata', elapsed_ms: elapsed }));
    expect(elapsed).toBeGreaterThanOrEqual(65000);
    await expect.poll(() => page.evaluate(() =>
      (window as unknown as { __WORLD_APP__: { getVitalsEnvironmentManager: () => { isCpuAlertActive: () => boolean } } })
        .__WORLD_APP__.getVitalsEnvironmentManager().isCpuAlertActive())).toBe(true);

    // 4. Verifikasi seluruh 3 efek CPU aktif
    await expect
      .poll(
        async () => {
          return await page.evaluate(() => {
            const vm = (
              window as unknown as {
                __WORLD_APP__?: {
                  getVitalsEnvironmentManager: () => {
                    isCpuAlertActive: () => boolean;
                    isLedBlinkingFast: () => boolean;
                    isAcFanSpinning: () => boolean;
                    isBastionSweating: () => boolean;
                  };
                  getCharacter: (id: string) => { isSweating: boolean } | undefined;
                };
              }
            ).__WORLD_APP__;
            const mgr = vm?.getVitalsEnvironmentManager();
            const bastion = vm?.getCharacter('bastion');
            return {
              isCpuAlert: mgr?.isCpuAlertActive(),
              isLedFast: mgr?.isLedBlinkingFast(),
              isAcFanSpinning: mgr?.isAcFanSpinning(),
              isBastionSweating: mgr?.isBastionSweating(),
              bastionCharSweating: bastion?.isSweating,
            };
          });
        },
        { timeout: 8000 },
      )
      .toEqual({
        isCpuAlert: true,
        isLedFast: true,
        isAcFanSpinning: true,
        isBastionSweating: true,
        bastionCharSweating: true,
      });
  });

  // --------------------------------------------------------------------------
  // Skenario 2: Ambang RAM > 85% → Rak server menyala oranye dan Vector mondar-mandir
  // --------------------------------------------------------------------------
  test('Skenario 2: Ambang RAM > 85% memicu rak server menyala oranye dan Vector mondar-mandir', async ({
    page,
    request,
  }) => {
    // Kirim telemetri RAM tinggi (> 85%)
    const emitRes = await request.post('/api/v1/test/emit-event', {
      data: {
        event: 'vitals',
        id: 102,
        data: VITALS_FIXTURES.ramHigh,
      },
    });
    expect(emitRes.ok()).toBe(true);

    // Verifikasi TopBar menampilkan angka RAM
    const topBar = page.locator('#top-bar');
    await expect(topBar).toContainText('91.5%', { timeout: 8000 });

    // Verifikasi rak server menyala oranye dan Vector mondar-mandir di Data Center
    await expect
      .poll(
        async () => {
          return await page.evaluate(() => {
            const w = window as unknown as {
              __WORLD_APP__?: {
                getVitalsEnvironmentManager: () => {
                  isRamAlertActive: () => boolean;
                  isVectorPacing: () => boolean;
                  getServerRacks: () => { tint: number }[];
                };
                getCharacter: (id: string) => {
                  fsmState: string;
                  gx: number;
                  gy: number;
                } | undefined;
                getChoreographer: () => {
                  getAgentState: (id: string) => {
                    currentActivityKey: string;
                    currentLayer: string;
                  } | undefined;
                };
              };
            };
            const vm = w.__WORLD_APP__?.getVitalsEnvironmentManager();
            const ch = w.__WORLD_APP__?.getChoreographer();
            const vectorState = ch?.getAgentState('vector');
            const racks = vm?.getServerRacks() || [];
            const allOrange = racks.length > 0 && racks.every((r) => r.tint === 0xffa500);

            return {
              isRamAlert: vm?.isRamAlertActive(),
              allRacksOrange: allOrange,
              isVectorPacing: vm?.isVectorPacing(),
              vectorActivity: vectorState?.currentActivityKey,
              vectorLayer: vectorState?.currentLayer,
            };
          });
        },
        { timeout: 8000 },
      )
      .toEqual({
        isRamAlert: true,
        allRacksOrange: true,
        isVectorPacing: true,
        vectorActivity: 'vector_ram_pacing',
        vectorLayer: 'task',
      });
  });

  // --------------------------------------------------------------------------
  // Skenario 3: Ambang Disk > 85% → Kardus mulai menumpuk di Data Center
  // --------------------------------------------------------------------------
  test('Skenario 3: Ambang Disk > 85% memicu kardus menumpuk di Data Center', async ({
    page,
    request,
  }) => {
    // Kirim telemetri Disk tinggi (> 85%)
    const emitRes = await request.post('/api/v1/test/emit-event', {
      data: {
        event: 'vitals',
        id: 103,
        data: VITALS_FIXTURES.diskHigh,
      },
    });
    expect(emitRes.ok()).toBe(true);

    // Verifikasi TopBar menampilkan angka Disk
    const topBar = page.locator('#top-bar');
    await expect(topBar).toContainText('89.4%', { timeout: 8000 });

    // Verifikasi tumpukan kardus muncul di Data Center
    await expect
      .poll(
        async () => {
          return await page.evaluate(() => {
            const vm = (
              window as unknown as {
                __WORLD_APP__?: {
                  getVitalsEnvironmentManager: () => {
                    isDiskAlertActive: () => boolean;
                    isCardboardPiledUp: () => boolean;
                    getCardboardBoxCount: () => number;
                  };
                };
              }
            ).__WORLD_APP__?.getVitalsEnvironmentManager();
            return {
              isDiskAlert: vm?.isDiskAlertActive(),
              isPiledUp: vm?.isCardboardPiledUp(),
              boxCount: vm?.getCardboardBoxCount(),
            };
          });
        },
        { timeout: 8000 },
      )
      .toEqual({
        isDiskAlert: true,
        isPiledUp: true,
        boxCount: 6,
      });
  });

  // --------------------------------------------------------------------------
  // Skenario 4: Pemulihan Vitals (Recovery) → Seluruh efek kembali ke kondisi normal
  // --------------------------------------------------------------------------
  test('Skenario 4: Pemulihan telemetri mengembalikan seluruh kondisi ruangan ke default', async ({
    page,
    request,
  }) => {
    // 1. Picu seluruh alert terlebih dahulu
    await request.post('/api/v1/test/emit-event', {
      data: {
        event: 'vitals',
        id: 104,
        data: VITALS_FIXTURES.allHigh,
      },
    });
    test.setTimeout(110000);
    const started = await page.evaluate(() => performance.now());
    await page.waitForTimeout(65000);
    const elapsed = await page.evaluate(() => performance.now()) - started;
    console.log(JSON.stringify({ check: 'CPU 60 detik nyata', elapsed_ms: elapsed }));
    expect(elapsed).toBeGreaterThanOrEqual(65000);
    await expect.poll(() => page.evaluate(() =>
      (window as unknown as { __WORLD_APP__: { getVitalsEnvironmentManager: () => { isCpuAlertActive: () => boolean } } })
        .__WORLD_APP__.getVitalsEnvironmentManager().isCpuAlertActive())).toBe(true);

    // 2. Sekarang kirim sinyal pemulihan (recovery)
    const emitRecovery = await request.post('/api/v1/test/emit-event', {
      data: {
        event: 'vitals',
        id: 105,
        data: VITALS_FIXTURES.recovery,
      },
    });
    expect(emitRecovery.ok()).toBe(true);

    // 3. Verifikasi seluruh efek dinonaktifkan
    await expect
      .poll(
        async () => {
          return await page.evaluate(() => {
            const w = window as unknown as {
              __WORLD_APP__?: {
                getVitalsEnvironmentManager: () => {
                  isCpuAlertActive: () => boolean;
                  isRamAlertActive: () => boolean;
                  isDiskAlertActive: () => boolean;
                  isBastionSweating: () => boolean;
                  isVectorPacing: () => boolean;
                  isCardboardPiledUp: () => boolean;
                  getServerRacks: () => { tint: number }[];
                };
              };
            };
            const vm = w.__WORLD_APP__?.getVitalsEnvironmentManager();
            const racks = vm?.getServerRacks() || [];
            const allNormal = racks.length > 0 && racks.every((r) => r.tint === 0xffffff);

            return {
              isCpuAlert: vm?.isCpuAlertActive(),
              isRamAlert: vm?.isRamAlertActive(),
              isDiskAlert: vm?.isDiskAlertActive(),
              isBastionSweating: vm?.isBastionSweating(),
              isVectorPacing: vm?.isVectorPacing(),
              isCardboardPiledUp: vm?.isCardboardPiledUp(),
              allRacksWhite: allNormal,
            };
          });
        },
        { timeout: 8000 },
      )
      .toEqual({
        isCpuAlert: false,
        isRamAlert: false,
        isDiskAlert: false,
        isBastionSweating: false,
        isVectorPacing: false,
        isCardboardPiledUp: false,
        allRacksWhite: true,
      });
  });
});
