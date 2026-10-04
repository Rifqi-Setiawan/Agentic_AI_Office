import { test, expect } from '@playwright/test';
import { EVENT_REACTIONS_FIXTURES } from './fixtures/event_reactions';

test.describe('T2.2 Reaksi Berbasis Event (F20)', () => {
  // --------------------------------------------------------------------------
  // Skenario 1: task_commented oleh jarvis → Jarvis berjalan ke meja assignee dan stand_talk
  // --------------------------------------------------------------------------
  test('Skenario 1: task_commented oleh Jarvis - Jarvis berjalan ke meja assignee dan stand_talk', async ({
    page,
    request,
  }) => {
    await page.goto('/?seed=42', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('canvas', { timeout: 15000 });
    await page.waitForFunction(
      () =>
        Boolean(
          (
            window as unknown as {
              __WORLD_APP__?: { getChoreographer: () => unknown };
            }
          ).__WORLD_APP__?.getChoreographer(),
        ),
      { timeout: 15000 },
    );

    const { reactionTaskCommented } = EVENT_REACTIONS_FIXTURES;
    const emitRes = await request.post('/api/v1/test/emit-event', {
      data: {
        event: 'event',
        id: reactionTaskCommented.event.seq,
        data: reactionTaskCommented.event,
      },
    });
    expect(emitRes.ok()).toBe(true);

    // 1. Verifikasi feed linimasa aktivitas menerima komentar Jarvis
    const feed = page.locator('[role="feed"]');
    await expect(feed).toContainText('Jarvis menambahkan komentar', { timeout: 8000 });

    // 2. Verifikasi state awal reaksi Jarvis di Choreographer
    await expect
      .poll(
        async () => {
          return await page.evaluate(() => {
            const w = window as unknown as {
              __WORLD_APP__?: {
                getChoreographer: () => {
                  getAgentState: (id: string) => {
                    currentLayer: string;
                    currentActivityKey: string;
                  } | undefined;
                } | null;
              };
            };
            const st = w.__WORLD_APP__?.getChoreographer()?.getAgentState('jarvis');
            return {
              layer: st?.currentLayer,
              activity: st?.currentActivityKey,
            };
          });
        },
        { timeout: 8000 },
      )
      .toEqual({
        layer: 'task',
        activity: 'jarvis_comment_talk',
      });

    // 3. Verifikasi Jarvis berjalan dan tiba di dekat meja Forge, lalu stand_talk
    await expect
      .poll(
        async () => {
          return await page.evaluate(() => {
            const w = window as unknown as {
              __WORLD_APP__?: {
                getCharacter: (id: string) => {
                  getCurrentAnimation: () => string;
                  isCommenting: boolean;
                  gx: number;
                  gy: number;
                } | undefined;
                getChoreographer: () => {
                  getAgentState: (id: string) => {
                    currentActivityKey: string;
                    activityRemaining: number;
                  } | undefined;
                } | null;
              };
            };
            const jarvis = w.__WORLD_APP__?.getCharacter('jarvis');
            if (!jarvis) return null;

            // Meja Forge berada di Z08 (gx: ~17, gy: ~14)
            const distToForgeDesk = Math.hypot(jarvis.gx - 17, jarvis.gy - 14);
            return {
              anim: jarvis.getCurrentAnimation(),
              isCommenting: jarvis.isCommenting,
              isNearForge: distToForgeDesk <= 3.0,
            };
          });
        },
        { timeout: 20000, intervals: [200, 500, 1000] },
      )
      .toEqual({
        anim: 'stand_talk',
        isCommenting: true,
        isNearForge: true,
      });

    // 4. Verifikasi bubble koordinasi Jarvis muncul di DOM overlay
    const bubbleText = page.locator('.agent-bubble-text');
    await expect(bubbleText.filter({ hasText: '@forge' })).toBeVisible({ timeout: 8000 });
  });

  // --------------------------------------------------------------------------
  // Skenario 2: task_blocked setelah run Sentinel → stempel merah FAIL
  // --------------------------------------------------------------------------
  test('Skenario 2: task_blocked setelah run Sentinel - stempel merah FAIL dan bubble stamp', async ({
    page,
    request,
  }) => {
    await page.goto('/?seed=42', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('canvas', { timeout: 15000 });
    await page.waitForFunction(
      () =>
        Boolean(
          (
            window as unknown as {
              __WORLD_APP__?: { getChoreographer: () => unknown };
            }
          ).__WORLD_APP__?.getChoreographer(),
        ),
      { timeout: 15000 },
    );

    const { reactionTaskBlockedSentinel } = EVENT_REACTIONS_FIXTURES;
    const emitRes = await request.post('/api/v1/test/emit-event', {
      data: {
        event: 'event',
        id: reactionTaskBlockedSentinel.event.seq,
        data: reactionTaskBlockedSentinel.event,
      },
    });
    expect(emitRes.ok()).toBe(true);

    // 1. Verifikasi linimasa mencatat REQUEST CHANGES Sentinel
    const feed = page.locator('[role="feed"]');
    await expect(feed).toContainText('REQUEST CHANGES', { timeout: 8000 });

    // 2. Verifikasi Sentinel mengaktifkan stempel merah FAIL pada karakter Pixi
    await expect
      .poll(
        async () => {
          return await page.evaluate(() => {
            const w = window as unknown as {
              __WORLD_APP__?: {
                getCharacter: (id: string) => {
                  getCurrentAnimation: () => string;
                  isShowingFailStamp: boolean;
                } | undefined;
                getChoreographer: () => {
                  getAgentState: (id: string) => {
                    currentActivityKey: string;
                  } | undefined;
                } | null;
              };
            };
            const sentinel = w.__WORLD_APP__?.getCharacter('sentinel');
            const state = w.__WORLD_APP__?.getChoreographer()?.getAgentState('sentinel');
            return {
              activity: state?.currentActivityKey,
              anim: sentinel?.getCurrentAnimation(),
              stamp: sentinel?.isShowingFailStamp,
            };
          });
        },
        { timeout: 8000 },
      )
      .toEqual({
        activity: 'sentinel_fail_stamp',
        anim: 'stand_talk',
        stamp: true,
      });

    // 3. Verifikasi DOM bubble memuat stempel merah FAIL
    const stampBadge = page.locator('[data-testid="sentinel-fail-stamp-badge"]');
    await expect(stampBadge).toBeVisible({ timeout: 8000 });
    await expect(stampBadge).toHaveText('FAIL');

    const stampBox = page.locator('[data-testid="sentinel-fail-stamp"]');
    await expect(stampBox).toBeVisible({ timeout: 8000 });
  });

  // --------------------------------------------------------------------------
  // Skenario 3: task_done dengan branch_name → Relay membawa paket ke konveyor
  // --------------------------------------------------------------------------
  test('Skenario 3: task_done dengan branch_name - Relay membawa paket ke konveyor', async ({
    page,
    request,
  }) => {
    await page.goto('/?seed=42', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('canvas', { timeout: 15000 });
    await page.waitForFunction(
      () =>
        Boolean(
          (
            window as unknown as {
              __WORLD_APP__?: { getChoreographer: () => unknown };
            }
          ).__WORLD_APP__?.getChoreographer(),
        ),
      { timeout: 15000 },
    );

    const { reactionTaskDoneBranch } = EVENT_REACTIONS_FIXTURES;
    const emitRes = await request.post('/api/v1/test/emit-event', {
      data: {
        event: 'event',
        id: reactionTaskDoneBranch.event.seq,
        data: reactionTaskDoneBranch.event,
      },
    });
    expect(emitRes.ok()).toBe(true);

    // 1. Verifikasi linimasa mencatat task done dengan branch
    const feed = page.locator('[role="feed"]');
    await expect(feed).toContainText('release/v2.1.0', { timeout: 8000 });

    // 2. Verifikasi Relay langsung memegang paket
    await expect
      .poll(
        async () => {
          return await page.evaluate(() => {
            const w = window as unknown as {
              __WORLD_APP__?: {
                getCharacter: (id: string) => {
                  isCarryingParcel: boolean;
                } | undefined;
                getChoreographer: () => {
                  getAgentState: (id: string) => {
                    currentActivityKey: string;
                  } | undefined;
                } | null;
              };
            };
            const relay = w.__WORLD_APP__?.getCharacter('relay');
            const state = w.__WORLD_APP__?.getChoreographer()?.getAgentState('relay');
            return {
              activity: state?.currentActivityKey,
              carrying: relay?.isCarryingParcel,
            };
          });
        },
        { timeout: 8000 },
      )
      .toEqual({
        activity: 'relay_delivery',
        carrying: true,
      });

    // 3. Verifikasi Relay tiba di depan konveyor Release Dock (gx: 33, gy: 15) dan menghadap SE
    await expect
      .poll(
        async () => {
          return await page.evaluate(() => {
            const w = window as unknown as {
              __WORLD_APP__?: {
                getCharacter: (id: string) => {
                  getCurrentAnimation: () => string;
                  isCarryingParcel: boolean;
                  facing: string;
                  gx: number;
                  gy: number;
                } | undefined;
              };
            };
            const relay = w.__WORLD_APP__?.getCharacter('relay');
            if (!relay) return null;

            return {
              gx: Math.round(relay.gx),
              gy: Math.round(relay.gy),
              facing: relay.facing,
              anim: relay.getCurrentAnimation(),
              carrying: relay.isCarryingParcel,
            };
          });
        },
        { timeout: 15000, intervals: [200, 500, 1000] },
      )
      .toEqual({
        gx: 33,
        gy: 15,
        facing: 'SE',
        anim: 'stand_talk',
        carrying: true,
      });

    // 4. Verifikasi bubble pengiriman Relay muncul di DOM
    const bubbleText = page.locator('.agent-bubble-text');
    await expect(bubbleText.filter({ hasText: 'Paket berangkat' })).toBeVisible({ timeout: 8000 });
  });

  // --------------------------------------------------------------------------
  // Skenario 4: task_failed → Bastion mengecek
  // --------------------------------------------------------------------------
  test('Skenario 4: task_failed - Bastion mengecek agen yang gagal', async ({
    page,
    request,
  }) => {
    await page.goto('/?seed=42', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('canvas', { timeout: 15000 });
    await page.waitForFunction(
      () =>
        Boolean(
          (
            window as unknown as {
              __WORLD_APP__?: { getChoreographer: () => unknown };
            }
          ).__WORLD_APP__?.getChoreographer(),
        ),
      { timeout: 15000 },
    );

    const { reactionTaskFailedBastion } = EVENT_REACTIONS_FIXTURES;
    const emitRes = await request.post('/api/v1/test/emit-event', {
      data: {
        event: 'event',
        id: reactionTaskFailedBastion.event.seq,
        data: reactionTaskFailedBastion.event,
      },
    });
    expect(emitRes.ok()).toBe(true);

    // 1. Verifikasi linimasa mencatat kegagalan task
    const feed = page.locator('[role="feed"]');
    await expect(feed).toContainText('kegagalan eksekusi', { timeout: 8000 });

    // 2. Verifikasi Bastion mengaktifkan status inspeksi dan bubble peringatan
    await expect
      .poll(
        async () => {
          return await page.evaluate(() => {
            const w = window as unknown as {
              __WORLD_APP__?: {
                getCharacter: (id: string) => {
                  isInspecting: boolean;
                } | undefined;
                getChoreographer: () => {
                  getAgentState: (id: string) => {
                    currentActivityKey: string;
                  } | undefined;
                } | null;
              };
            };
            const bastion = w.__WORLD_APP__?.getCharacter('bastion');
            const state = w.__WORLD_APP__?.getChoreographer()?.getAgentState('bastion');
            return {
              activity: state?.currentActivityKey,
              isInspecting: bastion?.isInspecting,
            };
          });
        },
        { timeout: 8000 },
      )
      .toEqual({
        activity: 'bastion_inspect_failed',
        isInspecting: true,
      });

    // 3. Verifikasi bubble peringatan Bastion muncul di DOM
    const bubbleText = page.locator('.agent-bubble-text');
    await expect(bubbleText.filter({ hasText: 'Ada yang jatuh' })).toBeVisible({ timeout: 8000 });

    // 4. Verifikasi Bastion tiba di dekat meja Vector (Data Center Z12, gx: ~38, gy: ~12)
    await expect
      .poll(
        async () => {
          return await page.evaluate(() => {
            const w = window as unknown as {
              __WORLD_APP__?: {
                getCharacter: (id: string) => {
                  getCurrentAnimation: () => string;
                  isInspecting: boolean;
                  gx: number;
                  gy: number;
                } | undefined;
              };
            };
            const bastion = w.__WORLD_APP__?.getCharacter('bastion');
            if (!bastion) return null;

            // Meja Vector berada di Z12 (gx: 38, gy: 12)
            const distToVectorDesk = Math.hypot(bastion.gx - 38, bastion.gy - 12);
            return {
              anim: bastion.getCurrentAnimation(),
              isInspecting: bastion.isInspecting,
              isNearVector: distToVectorDesk <= 3.0,
            };
          });
        },
        { timeout: 15000, intervals: [200, 500, 1000] },
      )
      .toEqual({
        anim: 'stand_talk',
        isInspecting: true,
        isNearVector: true,
      });
  });
});
