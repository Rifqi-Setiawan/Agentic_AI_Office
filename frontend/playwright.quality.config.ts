import { defineConfig } from '@playwright/test';
import base from './playwright.config';

// Explicit evidence collection, separate from the unchanged regression suite.
export default defineConfig({
  ...base,
  testMatch: '**/office-room-quality.spec.ts',
  testIgnore: [],
  outputDir: 'test-results/room-quality',
  timeout: 300_000,
  // Explicit PNG/JSON evidence is retained; avoid multi-minute trace videos.
  use: { ...base.use, trace: 'off', actionTimeout: 15_000 },
});
