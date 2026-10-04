import { test, expect } from '@playwright/test';

test.describe('T2.7 Easter Egg (F26) & Invariant Task Nyata', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/?seed=42', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('canvas', { timeout: 15000 });
    await page.waitForFunction(
      () =>
        Boolean(
          (
            window as unknown as {
              __WORLD_APP__?: {
                getEasterEggManager: () => unknown;
                getCharacterManager: () => unknown;
              };
            }
          ).__WORLD_APP__?.getEasterEggManager(),
        ),
      { timeout: 15000 },
    );
  });

  // --------------------------------------------------------------------------
  // Skenario 1: Kode Konami → Semua agent menari 5 dtk
  // --------------------------------------------------------------------------
  test('Skenario 1: Menekan Kode Konami di browser memicu semua agent menari selama 5 detik', async ({
    page,
  }) => {
    // 1. Simulasikan penekanan keyboard tombol-tombol Konami
    const keys = [
      'ArrowUp',
      'ArrowUp',
      'ArrowDown',
      'ArrowDown',
      'ArrowLeft',
      'ArrowRight',
      'ArrowLeft',
      'ArrowRight',
      'b',
      'a',
    ];

    for (const key of keys) {
      await page.keyboard.press(key);
      await page.waitForTimeout(50);
    }

    // 2. Verifikasi status Konami aktif di WorldApp
    const konamiState = await page.evaluate(() => {
      const w = window as unknown as {
        __WORLD_APP__?: {
          getEasterEggManager: () => {
            getState: () => { isKonamiActive: boolean; konamiRemaining: number };
          };
          getCharacterManager: () => {
            getAllCharacters: () => Array<{ currentAnimation: string; id: string }>;
          };
        };
      };
      const em = w.__WORLD_APP__?.getEasterEggManager();
      return em?.getState();
    });

    expect(konamiState?.isKonamiActive).toBe(true);
    expect(konamiState?.konamiRemaining).toBeGreaterThan(0);

    // 3. Verifikasi toast notifikasi muncul di HUD
    const toast = page.locator('[data-testid="task-toast"]').first();
    await expect(toast).toContainText('Kode Konami', { timeout: 5000 });
  });

  // --------------------------------------------------------------------------
  // Skenario 2: Klik Oracle 10x → Konfeti kimia & rambut berdiri
  // --------------------------------------------------------------------------
  test('Skenario 2: Klik Oracle 10 kali memicu reaksi konfeti kimia dan rambut berdiri', async ({
    page,
  }) => {
    // Jalankan 10 kali klik pada Oracle via evaluate
    const result = await page.evaluate(() => {
      const w = window as unknown as {
        __WORLD_APP__?: {
          handleAgentClick: (id: string) => void;
          getEasterEggManager: () => {
            getState: () => { oracleClicks: number; oracleShockRemaining: number };
          };
          getCharacter: (id: string) => { getCurrentAnimation: () => string } | undefined;
        };
      };
      for (let i = 0; i < 10; i++) {
        w.__WORLD_APP__?.handleAgentClick('oracle');
      }
      const em = w.__WORLD_APP__?.getEasterEggManager();
      const oracle = w.__WORLD_APP__?.getCharacter('oracle');
      return {
        state: em?.getState(),
        oracleAnim: oracle?.getCurrentAnimation(),
      };
    });

    expect(result.state?.oracleShockRemaining).toBeGreaterThan(0);
    expect(result.oracleAnim).toBe('eureka');

    // Verifikasi toast atau dialog bubble muncul
    const toast = page.locator('[data-testid="task-toast"]').first();
    await expect(toast).toContainText('Oracle', { timeout: 5000 });
  });

  // --------------------------------------------------------------------------
  // Skenario 3: Steward memperbaiki tile glitch (lelucon meta)
  // --------------------------------------------------------------------------
  test('Skenario 3: Steward memperbaiki tile glitch di Graphics Lab dan dialog meta keluar', async ({
    page,
  }) => {
    const res = await page.evaluate(() => {
      const w = window as unknown as {
        __WORLD_APP__?: {
          getCharacter: (id: string) => {
            setWorkStatus: (status: string) => void;
            workStatus: string;
          } | undefined;
          getEasterEggManager: () => {
            triggerStewardGlitchRepair: () => boolean;
            getState: () => { isGlitchTileActive: boolean };
          };
        };
      };
      const steward = w.__WORLD_APP__?.getCharacter('steward');
      // Set idle agar Steward bisa memperbaiki tile glitch
      steward?.setWorkStatus('idle');

      const em = w.__WORLD_APP__?.getEasterEggManager();
      const triggered = em?.triggerStewardGlitchRepair();
      return {
        triggered,
        state: em?.getState(),
      };
    });

    expect(res.triggered).toBe(true);
    expect(res.state?.isGlitchTileActive).toBe(true);
  });

  // --------------------------------------------------------------------------
  // Skenario 4: No Deploy Friday (Jumat setelah 16.00 WIB di Release Dock)
  // --------------------------------------------------------------------------
  test('Skenario 4: Stiker No Deploy Friday terpasang pada Jumat setelah 16.00 WIB', async ({
    page,
  }) => {
    const isFridayActive = await page.evaluate(() => {
      const w = window as unknown as {
        __WORLD_APP__?: {
          getEasterEggManager: () => {
            checkNoDeployFriday: (date?: Date) => boolean;
            getState: () => { isNoDeployFridayActive: boolean };
          };
        };
      };
      const em = w.__WORLD_APP__?.getEasterEggManager();
      // Jumat 17.00 WIB (UTC 10.00)
      const friday1700 = new Date('2026-10-09T10:00:00Z');
      em?.checkNoDeployFriday(friday1700);
      return em?.getState().isNoDeployFridayActive;
    });

    expect(isFridayActive).toBe(true);
  });

  // --------------------------------------------------------------------------
  // Skenario 5: Pukul 03.00 WIB Lounge Sleep & Invariant Bangun Saat Task Tiba
  // --------------------------------------------------------------------------
  test('Skenario 5: Pukul 03.00 WIB agent tertidur di sofa lounge dan segera bangun saat task nyata tiba', async ({
    page,
  }) => {
    const sleepRes = await page.evaluate(() => {
      const w = window as unknown as {
        __OFFICE_STORE__?: {
          getState: () => {
            agents: Record<string, { work: string; task: unknown }>;
            updateAgentDelta: (a: unknown) => void;
          };
        };
        __WORLD_APP__?: {
          getCharacterManager: () => {
            getAllCharacters: () => Array<{ setWorkStatus: (w: string) => void }>;
          };
          getEasterEggManager: () => {
            checkLoungeSleep: (date?: Date) => boolean;
            getState: () => { sleepingAgentId: string | null };
            wakeUpSleepingAgent: () => boolean;
          };
        };
      };

      // Set seluruh agent ke idle untuk mensimulasikan kantor hening tanpa task di malam hari
      const store = w.__OFFICE_STORE__?.getState();
      if (store) {
        for (const [, a] of Object.entries(store.agents)) {
          store.updateAgentDelta({ ...a, work: 'idle', task: null });
        }
      }
      for (const char of w.__WORLD_APP__?.getCharacterManager()?.getAllCharacters() || []) {
        char.setWorkStatus('idle');
      }

      const em = w.__WORLD_APP__?.getEasterEggManager();
      // 03.15 WIB
      const wib0315 = new Date('2026-10-09T20:15:00Z');
      em?.checkLoungeSleep(wib0315);
      const sleepingId = em?.getState().sleepingAgentId;

      // Bangunkan saat task tiba
      em?.wakeUpSleepingAgent();
      const afterWake = em?.getState().sleepingAgentId;

      return { sleepingId, afterWake };
    });

    expect(sleepRes.sleepingId).toBeTruthy();
    expect(sleepRes.afterWake).toBeNull();
  });

  // --------------------------------------------------------------------------
  // Skenario 6: Klik Mesin Espresso Kafetaria
  // --------------------------------------------------------------------------
  test('Skenario 6: Klik mesin espresso Kafetaria memicu ucapan Jarvis dan toast jumlah kopi', async ({
    page,
  }) => {
    // Klik mesin espresso di gx: 13, gy: 23
    const result = await page.evaluate(() => {
      const w = window as unknown as {
        __WORLD_APP__?: {
          handleGridClick: (gx: number, gy: number) => boolean;
          getEasterEggManager: () => {
            getState: () => { espressoClicks: number };
          };
        };
      };
      const clicked = w.__WORLD_APP__?.handleGridClick(13, 23);
      return {
        clicked,
        clicks: w.__WORLD_APP__?.getEasterEggManager()?.getState().espressoClicks,
      };
    });

    expect(result.clicked).toBe(true);
    expect(result.clicks).toBeGreaterThanOrEqual(1);

    // Verifikasi toast jumlah kopi muncul di HUD
    const toast = page.locator('[data-testid="task-toast"]').first();
    await expect(toast).toContainText('cangkir kopi', { timeout: 5000 });
  });

  // --------------------------------------------------------------------------
  // INVARIANT MUTLAK: Tidak ada easter egg menutupi status task nyata
  // --------------------------------------------------------------------------
  test('Invariant Mutlak: Tidak ada easter egg yang menutupi badge dan status task nyata', async ({
    page,
  }) => {
    const invariantCheck = await page.evaluate(() => {
      const w = window as unknown as {
        __WORLD_APP__?: {
          getCharacter: (id: string) => {
            setWorkStatus: (w: string, t: { id: string; title: string; status: string; board: string }) => void;
            badgeContainer: { visible: boolean };
            workStatus: string;
          } | undefined;
          getEasterEggManager: () => {
            triggerKonamiCode: () => void;
            triggerNoDeployFriday: () => void;
            handleEspressoClick: () => void;
            enforceRealTaskInvariants: () => void;
          };
        };
      };

      const forge = w.__WORLD_APP__?.getCharacter('forge');
      forge?.setWorkStatus('working', { id: 't_real', title: 'Task Nyata Forge', status: 'running', board: 'office-v2' });

      const em = w.__WORLD_APP__?.getEasterEggManager();
      em?.triggerKonamiCode();
      em?.triggerNoDeployFriday();
      em?.handleEspressoClick();
      em?.enforceRealTaskInvariants();

      return {
        isBadgeVisible: forge?.badgeContainer.visible,
        workStatus: forge?.workStatus,
      };
    });

    expect(invariantCheck.isBadgeVisible).toBe(true);
    expect(invariantCheck.workStatus).toBe('working');
  });
});
