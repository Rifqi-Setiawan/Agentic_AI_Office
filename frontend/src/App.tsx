import React, { useState } from 'react';
import { PixiSpikeCanvas } from './components/PixiSpikeCanvas';

export const App: React.FC = () => {
  const [fps, setFps] = useState<number>(60);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-4 sm:p-6 bg-slate-950 text-slate-100">
      <header className="text-center mb-5">
        <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-slate-900 border border-slate-800 text-xs font-mono text-slate-400 mb-2">
          <span>Agentic AI Office v2</span>
          <span>•</span>
          <span className="text-emerald-400">Fase 0 Visual Spike (T0.4)</span>
          <span>•</span>
          <span className="text-sky-400">{fps} FPS</span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
          Pipeline Sprite Blender → Pixel-Art Isometrik 2.5D
        </h1>
        <p className="mt-1 text-sm text-slate-400 max-w-2xl mx-auto">
          Karakter chibi Quaternius (aksesori helm taktis Bastion + material swap warna khas)
          berjalan di atas 3 furnitur Kenney (meja, kursi, monitor) dengan skala 2x tanpa artefak blur.
        </p>
      </header>

      <section className="w-full flex justify-center">
        <PixiSpikeCanvas scaleMultiplier={2} onFpsUpdate={setFps} />
      </section>

      <footer className="mt-6 text-center text-xs text-slate-500 font-mono">
        <p>
          Proyeksi dimetrik 2:1 | Tile 64×32 | Kamera Blender rot X=60°, Z=45° | Palet 32 warna
        </p>
      </footer>
    </main>
  );
};
