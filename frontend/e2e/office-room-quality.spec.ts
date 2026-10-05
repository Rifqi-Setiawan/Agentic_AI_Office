import { expect, test, type Page, type TestInfo } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { arch, cpus, platform, release, totalmem } from 'node:os';
import { dirname } from 'node:path';
import { mockSnapshotFixture } from '../src/mocks/fixtures';
import type { ZoneDef } from '../src/navigation/types';
import type { DomWorld } from '../src/world/scene/DomWorld';
import type { OfficeState } from '../src/store/officeStore';

// Evidence collection only: no runtime changes, frozen clocks, hidden HUD,
// screenshot masks, pixel-baseline approval, or performance pass thresholds.
const OFFICE_URL = '/?officeRenderer=claude&seed=42';
const ZONE_IDS = Array.from({ length: 17 }, (_, i) => `Z${String(i + 1).padStart(2, '0')}`);
const ACTOR_IDS = ['forge', 'nova', 'prism'];
type LongTask = { startTime: number; duration: number };
type QualityWindow = Window & {
  __DOM_WORLD__?: DomWorld;
  __OFFICE_STORE__?: { getState: () => OfficeState };
  __OFFICE_QUALITY__?: {
    domReadyMs: number | null;
    groundReadyMs: number | null;
    longTasks: LongTask[];
    longTasksSupported: boolean;
    longTaskObserver?: PerformanceObserver;
    decodedUrls: Set<string>;
  };
};
type Evidence = Record<string, unknown> & { captures: Array<Record<string, unknown>> };

function distribution(values: number[]) {
  const sorted = [...values].sort((a, b) => a - b);
  const percentile = (p: number) => sorted.length ? sorted[Math.max(0, Math.ceil(sorted.length * p) - 1)] : null;
  return {
    count: values.length,
    minMs: sorted[0] ?? null,
    meanMs: values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null,
    p50Ms: percentile(.5), p90Ms: percentile(.9), p95Ms: percentile(.95), p99Ms: percentile(.99),
    maxMs: sorted.at(-1) ?? null,
  };
}

async function installPassiveObservers(page: Page) {
  await page.addInitScript(() => {
    performance.setResourceTimingBufferSize(5_000);
    const state: NonNullable<QualityWindow['__OFFICE_QUALITY__']> = {
      domReadyMs: null, groundReadyMs: null, longTasks: [],
      longTasksSupported: PerformanceObserver.supportedEntryTypes?.includes('longtask') ?? false,
      decodedUrls: new Set<string>(),
    };
    (window as QualityWindow).__OFFICE_QUALITY__ = state;
    const observer = new MutationObserver(() => {
      if (state.domReadyMs === null && document.querySelector('.scene-viewport[data-ready="true"]')) {
        state.domReadyMs = performance.now();
      }
      if (state.groundReadyMs === null && document.querySelector('.registered-ground-surfaces[data-surface-status="ready"]')) {
        state.groundReadyMs = performance.now();
      }
      if (state.domReadyMs !== null && state.groundReadyMs !== null) observer.disconnect();
    });
    observer.observe(document, {
      subtree: true, childList: true, attributes: true,
      attributeFilter: ['data-ready', 'data-surface-status'],
    });
    if (state.longTasksSupported) {
      state.longTaskObserver = new PerformanceObserver(list => {
        state.longTasks.push(...list.getEntries().map(({ startTime, duration }) => ({ startTime, duration })));
      });
      state.longTaskObserver.observe({ type: 'longtask', buffered: true });
    }
  });
}

async function verifyTopology(page: Page) {
  const topology = await page.evaluate(() => {
    const world = (window as QualityWindow).__DOM_WORLD__;
    if (!world) throw new Error('DOM world is missing');
    return {
      zones: world.gridMap.zones,
      slots: world.gridMap.slots.map(({ id, gx, gy }) => ({ id, gx, gy })),
      doors: world.gridMap.doors,
      styleVersion: world.assets.styleVersion,
      logicalMapSha256: world.assets.logicalMapSha256,
      props: world.assets.props.length,
      actors: [...document.querySelectorAll<HTMLElement>('.world-actor')].map(el => ({
        id: el.dataset.agentId, name: el.getAttribute('aria-label'), artSource: el.dataset.artSource,
      })),
      atlases: [...world.atlases].map(([id, atlas]) => ({ id, candidate: atlas.meta.candidate })),
    };
  });
  expect(topology.zones.map(zone => zone.id).sort()).toEqual(ZONE_IDS);
  expect(topology.zones.every(zone => zone.name.trim() && zone.gx_max >= zone.gx_min && zone.gy_max >= zone.gy_min)).toBe(true);
  expect(topology.slots).toHaveLength(133);
  expect(new Set(topology.slots.map(slot => slot.id)).size).toBe(133);
  expect(topology.slots.every(slot => slot.id && Number.isFinite(slot.gx) && Number.isFinite(slot.gy))).toBe(true);
  expect(topology.doors).toHaveLength(26);
  expect(new Set(topology.doors.map(door => door.id)).size).toBe(26);
  expect(topology.doors.every(door => door.name && door.from && door.to && Number.isFinite(door.gx) && Number.isFinite(door.gy))).toBe(true);
  expect(topology.props).toBeGreaterThan(0);
  expect(topology.actors.map(actor => actor.id).sort()).toEqual(ACTOR_IDS);
  expect(topology.actors.every(actor => actor.artSource === 'illustration')).toBe(true);
  expect(topology.actors.map(actor => actor.name).sort()).toEqual(['Pilih Forge', 'Pilih Nova', 'Pilih Prism']);
  expect(topology.atlases.filter(atlas => atlas.candidate).map(atlas => atlas.id).sort()).toEqual(ACTOR_IDS);
  await expect(page.locator('.zone-label')).toHaveCount(17);
  await expect(page.locator('.debug-slot')).toHaveCount(133);
  await expect(page.locator('.debug-door')).toHaveCount(26);
  await expect(page.locator('.scene-nav button')).toHaveCount(18);
  await expect(page.locator('canvas:not(.registered-ground-surfaces)')).toHaveCount(0);
  return topology;
}

async function verifyArtwork(page: Page) {
  // Only inspect naturally requested artwork. Do not warm the cache by loading
  // the manifest's culled props, original PNG masters, or unused night variants.
  const required = await page.evaluate(() => {
    const viewport = document.querySelector('.scene-viewport')!.getBoundingClientRect();
    const urls = new Set<string>();
    const add = (url: string) => urls.add(new URL(url, location.href).href);
    for (const image of document.querySelectorAll<HTMLImageElement>('.office-scene img')) {
      add(image.currentSrc || image.src);
    }
    for (const element of document.querySelectorAll<HTMLElement>('.camera-world, .camera-world *')) {
      const rect = element.getBoundingClientRect();
      if (!element.getClientRects().length || rect.right < viewport.left || rect.left > viewport.right ||
          rect.bottom < viewport.top || rect.top > viewport.bottom) continue;
      for (const match of getComputedStyle(element).backgroundImage.matchAll(/url\(["']?([^"')]+)["']?\)/g)) add(match[1]);
    }
    // Ground readiness means the runtime has loaded and painted these materials.
    // Use the URL that actually completed; fallback source PNGs remain valid.
    const loaded = new Set(performance.getEntriesByType('resource').map(entry => entry.name));
    const world = (window as QualityWindow).__DOM_WORLD__!;
    for (const surface of world.assets.groundSurfaces ?? []) {
      const runtime = surface.runtimeFile && new URL(surface.runtimeFile, location.href).href;
      add(runtime && loaded.has(runtime) ? runtime : surface.file);
    }
    add('/sprites/environment.png');
    return [...urls].sort();
  });
  expect(required.length, 'The visible scene must request artwork').toBeGreaterThan(0);
  await page.waitForFunction(urls => {
    const loaded = new Set(performance.getEntriesByType('resource').map(entry => entry.name));
    return urls.every(url => url.startsWith('data:') || loaded.has(url));
  }, required, { timeout: 30_000 });
  return page.evaluate(async urls => {
    const state = (window as QualityWindow).__OFFICE_QUALITY__!;
    const startedAtMs = performance.now();
    const timing = performance.getEntriesByType('resource') as PerformanceResourceTiming[];
    const resources = timing.filter(entry => urls.includes(entry.name)).map(entry => ({
      url: entry.name, initiatorType: entry.initiatorType, startTime: entry.startTime,
      responseEnd: entry.responseEnd, duration: entry.duration,
      transferSize: entry.transferSize, encodedBodySize: entry.encodedBodySize, decodedBodySize: entry.decodedBodySize,
    }));
    const newUrls = urls.filter(url => !state.decodedUrls.has(url));
    await Promise.all(newUrls.map(async url => {
      const existing = [...document.querySelectorAll<HTMLImageElement>('.office-scene img')]
        .find(image => (image.currentSrc || image.src) === url);
      const image = existing ?? new Image();
      if (!existing) image.src = url; // Already naturally loaded above; decode the cached background.
      await image.decode();
      if (!image.complete || image.naturalWidth === 0 || image.naturalHeight === 0) throw new Error(`Empty artwork: ${url}`);
      state.decodedUrls.add(url);
    }));
    await document.fonts.ready;
    const ground = document.querySelector<HTMLCanvasElement>('.registered-ground-surfaces')!;
    if (ground.dataset.surfaceStatus !== 'ready' || !ground.width || !ground.height) throw new Error('Ground is not painted');
    return {
      requiredUrls: urls, newlyDecodedUrls: newUrls, resources,
      naturalAssetLoadEndMs: Math.max(0, ...resources.map(entry => entry.responseEnd)),
      auditStartedAtMs: startedAtMs, decodedReadyVerifiedAtMs: performance.now(),
      ground: { width: ground.width, height: ground.height, materials: ground.dataset.groundMaterials, cells: ground.dataset.groundCells },
    };
  }, required);
}

async function waitForStableCamera(page: Page) {
  return page.evaluate(() => new Promise<{ transform: string; viewport: { x: number; y: number; width: number; height: number } }>((resolve, reject) => {
    let lastTransform = '', stableSince = performance.now(), raf = 0;
    const timeout = setTimeout(() => { cancelAnimationFrame(raf); reject(new Error('Camera did not settle within 10 seconds')); }, 10_000);
    const sample = (now: number) => {
      const world = document.querySelector<HTMLElement>('.camera-world')!;
      const transform = getComputedStyle(world).transform;
      if (transform !== lastTransform || transform === 'none') { lastTransform = transform; stableSince = now; }
      if (now - stableSince >= 300) {
        clearTimeout(timeout);
        const { x, y, width, height } = document.querySelector('.scene-viewport')!.getBoundingClientRect();
        resolve({ transform, viewport: { x, y, width, height } });
      } else raf = requestAnimationFrame(sample);
    };
    raf = requestAnimationFrame(sample);
  }));
}

async function focusRoom(page: Page, zone: ZoneDef) {
  // includeHidden preserves the same semantic locator after mobile auto-close;
  // click still uses normal visibility/actionability checks, never force:true.
  const navigation = page.getByRole('navigation', { name: 'Navigasi 17 ruang', includeHidden: true });
  const button = navigation.getByRole('button', { name: `Fokus ${zone.id} ${zone.name}`, exact: true, includeHidden: true });
  await button.click();
  await expect(button).toHaveClass(/\bactive\b/);
  // Observe the actual matrix after the accessible click. This is the canonical
  // isometric room center, with the camera's authored 20px vertical art allowance.
  await page.waitForFunction(room => {
    const viewport = document.querySelector('.scene-viewport')!.getBoundingClientRect();
    const matrix = new DOMMatrixReadOnly(getComputedStyle(document.querySelector('.camera-world')!).transform);
    const gx = (room.gx_min + room.gx_max) / 2, gy = (room.gy_min + room.gy_max) / 2;
    const x = 1088 + (gx - gy) * 32, y = 64 + (gx + gy) * 16 - 20;
    return Math.abs(matrix.a * x + matrix.e - viewport.width / 2) < .5 &&
      Math.abs(matrix.d * y + matrix.f - viewport.height / 2) < .5 && matrix.a >= .3 && matrix.a <= 2;
  }, zone, { timeout: 15_000 });
  return waitForStableCamera(page);
}

async function capture(page: Page, testInfo: TestInfo, evidence: Evidence, name: string) {
  const art = await verifyArtwork(page);
  const camera = await waitForStableCamera(page);
  const screenshotPath = testInfo.outputPath(`${name}.png`);
  // Keep the real full viewport, room controls and HUD readable and unmasked.
  await page.screenshot({ path: screenshotPath, fullPage: false, timeout: 15_000 });
  await testInfo.attach(name, { path: screenshotPath, contentType: 'image/png' });
  evidence.captures.push({ name, filename: `${name}.png`, camera, art });
}

async function sampleFrames(page: Page, durationMs: number) {
  const sample = await page.evaluate(duration => new Promise<{
    requestedDurationMs: number; startedAtMs: number; endedAtMs: number;
    intervalsMs: number[]; visibilityChanges: Array<{ atMs: number; state: string }>;
  }>((resolve, reject) => {
    const intervalsMs: number[] = [], visibilityChanges = [{ atMs: performance.now(), state: document.visibilityState }];
    let startedAtMs = 0, previous = 0, raf = 0;
    const onVisibility = () => visibilityChanges.push({ atMs: performance.now(), state: document.visibilityState });
    document.addEventListener('visibilitychange', onVisibility);
    const cleanup = () => { clearTimeout(timeout); cancelAnimationFrame(raf); document.removeEventListener('visibilitychange', onVisibility); };
    const timeout = setTimeout(() => { cleanup(); reject(new Error('Live rAF sampling did not complete; see page visibility/errors')); }, duration + 30_000);
    const tick = (now: number) => {
      if (!startedAtMs) startedAtMs = now;
      if (previous) intervalsMs.push(now - previous);
      previous = now;
      if (now - startedAtMs >= duration) {
        cleanup(); resolve({ requestedDurationMs: duration, startedAtMs, endedAtMs: now, intervalsMs, visibilityChanges });
      } else raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
  }), durationMs);
  // These assert a valid measurement window, never a frame-rate target.
  expect(sample.intervalsMs.length).toBeGreaterThan(0);
  expect(sample.endedAtMs - sample.startedAtMs).toBeGreaterThanOrEqual(durationMs);
  expect(sample.visibilityChanges.every(change => change.state === 'visible')).toBe(true);
  return {
    ...sample, measuredDurationMs: sample.endedAtMs - sample.startedAtMs,
    intervalSummary: distribution(sample.intervalsMs),
    intervalCounts: Object.fromEntries([16.667, 33.334, 50, 100].map(ms => [`over${ms}Ms`, sample.intervalsMs.filter(value => value > ms).length])),
    workload: 'Live ambient overview; no screenshots or navigation during sample; no clock/RAF overrides',
  };
}

async function runQuality(page: Page, testInfo: TestInfo, mobile: boolean) {
  testInfo.setTimeout(300_000);
  const viewport = mobile ? { width: 390, height: 844 } : { width: 1280, height: 720 };
  await page.setViewportSize(viewport);
  const failedRequests: Array<Record<string, unknown>> = [], httpFailures: Array<Record<string, unknown>> = [];
  const pageErrors: string[] = [], consoleErrors: string[] = [];
  const asset = (url: string, type: string) => ['image', 'font', 'stylesheet', 'script'].includes(type) || /\/(maps|sprites|visual-migration)\//.test(new URL(url).pathname);
  page.on('pageerror', error => pageErrors.push(error.stack ?? error.message));
  page.on('console', message => { if (message.type() === 'error') consoleErrors.push(message.text()); });
  page.on('requestfailed', request => failedRequests.push({ url: request.url(), type: request.resourceType(), error: request.failure()?.errorText, requiredAsset: asset(request.url(), request.resourceType()) }));
  page.on('response', response => {
    if (response.status() >= 400) httpFailures.push({ url: response.url(), status: response.status(), type: response.request().resourceType(), requiredAsset: asset(response.url(), response.request().resourceType()) });
  });
  const evidence: Evidence = {
    schemaVersion: 1, test: testInfo.title, route: OFFICE_URL, viewport, captures: [],
    fixture: { source: 'src/mocks/fixtures.ts via Vite mockOfficeApiPlugin REST/SSE', seed: 42, expectedSequence: mockSnapshotFixture.seq, productionTelemetry: false },
    environment: {
      ci: Boolean(process.env.CI), platform: platform(), release: release(), arch: arch(),
      cpuModel: cpus()[0]?.model, logicalCpus: cpus().length, totalMemoryBytes: totalmem(),
      browser: testInfo.project.name, browserVersion: page.context().browser()?.version(),
      configuredHeadless: testInfo.project.use.headless ?? true,
      launchArgs: testInfo.project.use.launchOptions?.args ?? [],
    },
    limitations: [
      'Vite development-server fixture data; not a production build, live Hermes or VPS verification.',
      'Headless Chromium on CI/shared hardware; inherited launch arguments include --disable-gpu. No production GPU/FPS claim.',
      'Mobile is a 390x844 responsive viewport in desktop Chromium, not physical-phone hardware or a mobile GPU.',
      'Exactly three candidate actors (Prism, Forge, Nova), not a full 16-agent rendered workload.',
      'rAF intervals measure callback cadence, not presented GPU frames; long tasks are browser-supported main-thread observations.',
      'runtimeMetrics is only the app\'s rolling last-600-interval diagnostic; the full-duration rAF sample is reported separately.',
      'Seeded ambient simulation stays live; screenshots are review evidence, not deterministic pixel baselines or style approval.',
      'Natural scene-load timestamps exclude test collection/decode overhead; verified decoded readiness is reported separately.',
      'No performance pass/fail threshold is asserted.',
    ],
  };
  try {
    const baseURL = testInfo.project.use.baseURL;
    expect(baseURL && ['localhost', '127.0.0.1', '[::1]'].includes(new URL(baseURL).hostname), 'Use only the local fixture server').toBe(true);
    await installPassiveObservers(page);
    const navigation = await page.goto(OFFICE_URL, { waitUntil: 'domcontentloaded', timeout: 60_000 });
    expect(navigation?.ok(), 'Fixture document loads successfully').toBe(true);
    await expect(page.locator('.scene-viewport')).toHaveAttribute('data-ready', 'true', { timeout: 60_000 });
    await expect(page.locator('.registered-ground-surfaces')).toHaveAttribute('data-surface-status', 'ready', { timeout: 60_000 });
    await expect(page.locator('.registered-ground-surfaces')).not.toHaveAttribute('data-surface-error', /.+/);
    await expect(page.locator('.scene-error')).toHaveCount(0);
    await expect.poll(() => page.evaluate(() => (window as QualityWindow).__OFFICE_STORE__?.getState().snapshot?.seq)).toBe(mockSnapshotFixture.seq);
    const fixtureState = await page.evaluate(() => {
      const state = (window as QualityWindow).__OFFICE_STORE__!.getState();
      return { projection: state.projection, timeOfDay: state.timeOfDay, agentIds: state.snapshot!.agents.map(agent => agent.id).sort(), connectionStatus: state.connectionStatus };
    });
    expect(fixtureState.agentIds).toEqual(mockSnapshotFixture.agents.map(agent => agent.id).sort());
    expect(fixtureState.projection).toBe('public');
    expect(fixtureState.timeOfDay).toBe(mockSnapshotFixture.time_of_day);
    evidence.fixtureState = fixtureState;
    const topology = await verifyTopology(page);
    evidence.topology = topology;
    const initialArtwork = await verifyArtwork(page);
    const initialCamera = await waitForStableCamera(page);
    evidence.initialArtwork = initialArtwork;
    evidence.initialCamera = initialCamera;
    const milestones = await page.evaluate(() => {
      const state = (window as QualityWindow).__OFFICE_QUALITY__!;
      return { domReadyMs: state.domReadyMs, groundReadyMs: state.groundReadyMs };
    });
    expect(Number.isFinite(milestones.domReadyMs), 'Passive observer must record DOM readiness').toBe(true);
    expect(Number.isFinite(milestones.groundReadyMs), 'Passive observer must record painted ground readiness').toBe(true);
    evidence.sceneLoad = {
      ...milestones,
      navigationToNaturalSceneReadyMs: Math.max(milestones.domReadyMs!, milestones.groundReadyMs!, initialArtwork.naturalAssetLoadEndMs),
      navigationToDecodedReadyVerificationMs: initialArtwork.decodedReadyVerifiedAtMs,
      definition: 'Natural ready is the latest observed DOM-ready, painted-ground-ready and initially visible required resource responseEnd, relative to navigation performance.timeOrigin; decode verification runs afterward without preloading culled artwork.',
    };
    evidence.frames = await sampleFrames(page, mobile ? 20_000 : 60_000);
    await capture(page, testInfo, evidence, mobile ? 'mobile-overview' : 'desktop-overview');
    if (mobile) {
      const menu = page.getByRole('navigation', { name: 'Navigasi 17 ruang', includeHidden: true });
      const toggle = page.getByRole('button', { name: '17 ruang', exact: true });
      await expect(toggle).toHaveAttribute('aria-expanded', 'false');
      await expect(menu).toBeHidden();
      await toggle.click();
      await expect(toggle).toHaveAttribute('aria-expanded', 'true');
      await expect(menu).toBeVisible();
      await expect(menu.getByRole('button')).toHaveCount(18);
      await capture(page, testInfo, evidence, 'mobile-room-menu');
      await toggle.click();
      await expect(menu).toBeHidden();
      await expect(toggle).toHaveAttribute('aria-expanded', 'false');
      expect((await waitForStableCamera(page)).transform).toBe(initialCamera.transform);
      const z08 = topology.zones.find(zone => zone.id === 'Z08')!;
      for (let attempt = 0; attempt < 2; attempt++) {
        await toggle.click();
        await expect(menu).toBeVisible();
        await focusRoom(page, z08);
        await expect(menu).toBeHidden();
        await expect(toggle).toHaveAttribute('aria-expanded', 'false');
      }
      // Return and refocus through supported controls; no forced clicks or direct camera calls.
      await page.getByRole('button', { name: 'Overview', exact: true }).click();
      expect((await waitForStableCamera(page)).transform).toBe(initialCamera.transform);
      await toggle.click();
      await focusRoom(page, z08);
      await expect(menu).toBeHidden();
      await expect(toggle).toHaveAttribute('aria-expanded', 'false');
      await capture(page, testInfo, evidence, 'mobile-Z08-dev-pods');
      expect(evidence.captures).toHaveLength(3);
    } else {
      for (const zone of [...topology.zones].sort((a, b) => a.id.localeCompare(b.id))) {
        await focusRoom(page, zone);
        await capture(page, testInfo, evidence, `desktop-${zone.id}-${zone.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}`);
      }
      expect(evidence.captures).toHaveLength(18);
    }
    expect(pageErrors, 'Uncaught page errors').toEqual([]);
    expect(failedRequests.filter(request => request.requiredAsset), 'Failed scene/script/style/font asset requests').toEqual([]);
    expect(httpFailures.filter(response => response.requiredAsset), 'HTTP errors for scene/script/style/font assets').toEqual([]);
    evidence.outcome = 'functional checks passed; screenshots and performance require review';
  } catch (error) {
    evidence.outcome = 'incomplete or failed';
    evidence.failure = error instanceof Error ? { message: error.message, stack: error.stack } : String(error);
    throw error;
  } finally {
    evidence.pageErrors = pageErrors;
    evidence.consoleErrors = consoleErrors;
    evidence.failedRequests = failedRequests;
    evidence.httpFailures = httpFailures;
    try {
      const diagnostics = await page.evaluate(() => {
        const state = (window as QualityWindow).__OFFICE_QUALITY__;
        state?.longTasks.push(...(state.longTaskObserver?.takeRecords() ?? []).map(({ startTime, duration }) => ({ startTime, duration })));
        state?.longTaskObserver?.disconnect();
        return {
          userAgent: navigator.userAgent, devicePixelRatio, hardwareConcurrency: navigator.hardwareConcurrency,
          deviceMemoryGiB: (navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? null,
          visibility: document.visibilityState, performanceTimeOrigin: performance.timeOrigin,
          navigation: performance.getEntriesByType('navigation').map(entry => entry.toJSON()),
          longTasksSupported: state?.longTasksSupported ?? false, longTasks: state?.longTasks ?? [],
          runtimeMetrics: (window as QualityWindow).__DOM_WORLD__?.metrics() ?? null,
        };
      });
      const frames = evidence.frames as Awaited<ReturnType<typeof sampleFrames>> | undefined;
      const inSample = diagnostics.longTasks.filter(task => frames && task.startTime < frames.endedAtMs && task.startTime + task.duration > frames.startedAtMs);
      evidence.browserDiagnostics = diagnostics;
      evidence.longTasks = {
        supported: diagnostics.longTasksSupported,
        fullTest: { ...distribution(diagnostics.longTasks.map(task => task.duration)), totalDurationMs: diagnostics.longTasks.reduce((sum, task) => sum + task.duration, 0) },
        frameSample: frames ? { ...distribution(inSample.map(task => task.duration)), entries: inSample } : null,
      };
    } catch (error) {
      evidence.finalDiagnosticsError = String(error);
    }
    const metricsPath = testInfo.outputPath(mobile ? 'mobile-quality-metrics.json' : 'desktop-quality-metrics.json');
    await mkdir(dirname(metricsPath), { recursive: true });
    await writeFile(metricsPath, JSON.stringify(evidence, null, 2));
    await testInfo.attach('fixture-quality-metrics', { path: metricsPath, contentType: 'application/json' });
  }
}

test('desktop fixture: overview, all 17 focused rooms, 60-second live frame sample', async ({ page }, testInfo) => {
  await runQuality(page, testInfo, false);
});

test('mobile fixture: 390x844 overview, room menu, repeated Z08 focus, 20-second live frame sample', async ({ page }, testInfo) => {
  await runQuality(page, testInfo, true);
});
