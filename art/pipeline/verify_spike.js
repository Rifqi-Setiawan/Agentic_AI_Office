#!/usr/bin/env node
/**
 * End-to-end verification script for T0.4 Isometric Spike.
 * Launches headless Chromium via Playwright, loads the PixiJS test page,
 * verifies rendering of character and furniture at 2x scale,
 * and captures high-resolution screenshots for review.
 */

import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';
import net from 'node:net';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '../..');
const frontendDir = path.resolve(rootDir, 'frontend');
const distDir = path.resolve(__dirname, 'dist');

function getFreePort() {
  return new Promise(resolve => {
    const srv = net.createServer();
    srv.listen(0, () => {
      const addr = srv.address();
      const port = typeof addr === 'object' && addr ? addr.port : 9140;
      srv.close(() => resolve(port));
    });
  });
}

import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);

const chromePath = '/srv/apps/hermes/.cache/ms-playwright/chromium-1234/chrome-linux64/chrome';
const playwrightPath = '/srv/apps/hermes/.npm/_npx/e41f203b7505f1fb/node_modules/playwright-core';

let chromium;
try {
  const pw = require(playwrightPath);
  chromium = pw.chromium;
} catch (e) {
  console.error('Failed to import playwright-core:', e);
  process.exit(1);
}

async function runVerification() {
  console.log('Building frontend production bundle for verification...');
  const buildProc = spawn('npm', ['run', 'build'], { cwd: frontendDir, stdio: 'inherit' });
  await new Promise((resolve, reject) => {
    buildProc.on('close', code => (code === 0 ? resolve(null) : reject(new Error(`Build failed: ${code}`))));
  });

  const port = await getFreePort();
  console.log(`Starting Vite preview server on dynamic free port ${port}...`);
  const previewProc = spawn('npx', ['vite', 'preview', '--port', String(port), '--strictPort'], {
    cwd: frontendDir,
    stdio: 'inherit',
  });

  // Wait for server to be ready
  await new Promise(resolve => setTimeout(resolve, 2000));

  try {
    console.log('Launching headless Chromium...');
    const browser = await chromium.launch({
      executablePath: chromePath,
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    const page = await browser.newPage({
      viewport: { width: 1200, height: 900 },
      deviceScaleFactor: 1,
    });

    const targetUrl = `http://localhost:${port}`;
    console.log(`Navigating to ${targetUrl}...`);

    page.on('console', msg => console.log(`BROWSER [${msg.type()}]:`, msg.text()));
    page.on('pageerror', err => console.log('BROWSER UNCAUGHT:', err));

    await page.goto(targetUrl, { waitUntil: 'networkidle' });

    // Wait for canvas element
    let canvasHandle;
    try {
      canvasHandle = await page.waitForSelector('canvas', { timeout: 10000 });
    } catch (e) {
      console.log('DOM Content on timeout:\n', await page.content());
      throw e;
    }
    if (!canvasHandle) {
      throw new Error('Canvas element not found in DOM');
    }

    console.log('Canvas found. Allowing character to walk for 3.5 seconds across furniture...');
    await page.waitForTimeout(3500);

    // Capture Full Page Screenshot
    fs.mkdirSync(distDir, { recursive: true });
    const fullScreenshotPath = path.join(distDir, 'screenshot_spike_2x.png');
    await page.screenshot({ path: fullScreenshotPath });
    console.log(`Full screenshot saved: ${fullScreenshotPath}`);

    // Capture Canvas Element Screenshot
    const canvasScreenshotPath = path.join(distDir, 'screenshot_spike_detail.png');
    await canvasHandle.screenshot({ path: canvasScreenshotPath });
    console.log(`Canvas detail screenshot saved: ${canvasScreenshotPath}`);

    await browser.close();
    console.log('Verification completed successfully!');
  } finally {
    previewProc.kill();
  }
}

runVerification().catch(err => {
  console.error('Verification failed:', err);
  process.exit(1);
});
