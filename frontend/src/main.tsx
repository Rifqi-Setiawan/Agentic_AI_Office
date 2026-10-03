import './index.css';
import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';
import { worldApp } from './world/WorldApp';
import { sseClient } from './services/sseClient';

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
