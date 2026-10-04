import './index.css';
import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';
import { worldController } from './world/worldController';
import { sseClient } from './services/sseClient';
import { officeStore } from './store/officeStore';

// Only the selected renderer is imported and mounted. Art gate keeps legacy as default.
const worldContainer = document.getElementById('world-root');
let destroyWorld: (() => void) | undefined;
let disposed = false;
if (worldContainer) {
  if (new URLSearchParams(location.search).get('officeRenderer') === 'claude') {
    import('./world/scene/OfficeScene').then(({ OfficeScene }) => {
      if (disposed) return;
      const root = ReactDOM.createRoot(worldContainer);
      root.render(<OfficeScene />);
      destroyWorld = () => root.unmount();
    }).catch(err => console.error('[World] DOM scene failed:', err));
  } else {
    import('./world/WorldApp').then(async ({ worldApp }) => {
      if (disposed) return;
      await worldApp.init(worldContainer);
      if (disposed) { worldApp.destroy(); return; }
      worldController.attach(worldApp);
      (window as unknown as { __WORLD_APP__?: typeof worldApp }).__WORLD_APP__ = worldApp;
      destroyWorld = () => { worldApp.destroy(); worldController.attach(null); delete (window as unknown as { __WORLD_APP__?: unknown }).__WORLD_APP__; };
    }).catch(err => console.error('[World] Legacy scene failed:', err));
  }
}

// 2. Inisialisasi root React terpisah khusus untuk antarmuka HUD
const hudContainer = document.getElementById('hud-root');
let hudRoot: ReactDOM.Root | undefined;
if (hudContainer) {
  hudRoot = ReactDOM.createRoot(hudContainer);
  hudRoot.render(
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
    __OFFICE_STORE__?: typeof officeStore;
    __SSE_CLIENT__?: typeof sseClient;
  };
  w.__OFFICE_STORE__ = officeStore;
  w.__SSE_CLIENT__ = sseClient;
}

if (import.meta.hot) import.meta.hot.dispose(() => { disposed = true; destroyWorld?.(); hudRoot?.unmount(); sseClient.stop(); });
