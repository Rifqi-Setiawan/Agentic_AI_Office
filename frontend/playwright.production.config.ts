import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  testMatch: 't2_9-production-repair.spec.ts',
  timeout: 120000,
  expect: { timeout: 15000 },
  workers: 1,
  retries: 0,
  reporter: 'list',
  outputDir: process.env.OFFICE_REPAIR_EVIDENCE,
  use: {
    ...devices['Desktop Chrome'],
    baseURL: 'http://127.0.0.1:5186',
    viewport: { width: 1280, height: 800 },
    launchOptions: { args: ['--no-sandbox', '--disable-dev-shm-usage'] },
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'npx vite preview --host 127.0.0.1 --port 5186 --strictPort',
    url: 'http://127.0.0.1:5186',
    reuseExistingServer: false,
  },
});
