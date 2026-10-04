/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { mockOfficeApiPlugin } from './src/mocks/mockServerPlugin';

export default defineConfig({
  plugins: [react(), mockOfficeApiPlugin()],
  server: {
    port: 5173,
    host: true,
  },
  build: {
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-pixi': ['pixi.js', 'pixi-viewport'],
          'vendor-gsap': ['gsap'],
          'vendor-react': ['react', 'react-dom', 'zustand'],
        },
      },
    },
  },
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./src/testSetup.ts'],
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    exclude: ['**/node_modules/**', '**/dist/**', '**/e2e/**'],
  },
});
