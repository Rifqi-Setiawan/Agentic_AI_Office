import './index.css';
import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';
import { worldApp } from './world/WorldApp';
import { sseClient } from './services/sseClient';
import { officeStore } from './store/officeStore';

// 1. Inisialisasi satu-satunya instance PIXI.Application untuk world
const worldContainer = document.getElementById('world-root');
if (worldContainer) {
  worldApp.init(worldContainer).catch((err) => {
    console.error('[World] Gagal menginisialisasi PIXI World:', err);
  });
}

// 2. Inisialisasi root React terpisah khusus untuk antarmuka HUD
const hudContainer = document.getElementById('hud-root');
if (hudContainer) {
  ReactDOM.createRoot(hudContainer).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  );
}

// 3. Mulai koneksi stream SSE ke backend (dengan backoff 1s->30s dan fallback polling 5s)
sseClient.start();

// 4. Ekspos singleton ke window untuk diagnostik dan pengujian E2E Playwright
if (typeof window !== 'undefined') {
  const w = window as unknown as {
    __WORLD_APP__?: typeof worldApp;
    __OFFICE_STORE__?: typeof officeStore;
    __SSE_CLIENT__?: typeof sseClient;
  };
  w.__WORLD_APP__ = worldApp;
  w.__OFFICE_STORE__ = officeStore;
  w.__SSE_CLIENT__ = sseClient;
}
