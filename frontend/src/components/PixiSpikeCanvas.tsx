import React, { useEffect, useRef, useState } from 'react';
import {
  Application,
  Assets,
  Spritesheet,
  Container,
  Sprite,
  AnimatedSprite,
  Graphics,
  Texture,
} from 'pixi.js';

interface PixiSpikeCanvasProps {
  scaleMultiplier?: number;
  onFpsUpdate?: (fps: number) => void;
}

export const PixiSpikeCanvas: React.FC<PixiSpikeCanvasProps> = ({
  scaleMultiplier = 2,
  onFpsUpdate,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasHostRef = useRef<HTMLDivElement>(null);
  const appRef = useRef<Application | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeMode, setActiveMode] = useState<
    'patrol' | 'walk_se' | 'walk_ne' | 'idle_se' | 'idle_ne'
  >('patrol');
  const [currentScale, setCurrentScale] = useState(scaleMultiplier);
  const modeRef = useRef(activeMode);
  modeRef.current = activeMode;

  useEffect(() => {
    let isMounted = true;
    let app: Application | null = null;

    async function initPixi() {
      if (!canvasHostRef.current) return;

      try {
        app = new Application();
        await app.init({
          width: canvasHostRef.current.clientWidth || 800,
          height: 520,
          backgroundColor: 0x0f172a,
          antialias: false,
          roundPixels: true,
          autoDensity: true,
          resolution: window.devicePixelRatio || 1,
        });

        if (!isMounted || !canvasHostRef.current) {
          app.destroy(true, { children: true });
          return;
        }

        appRef.current = app;
        const canvas = app.canvas as HTMLCanvasElement;
        canvas.style.imageRendering = 'pixelated';
        canvas.style.display = 'block';
        canvas.style.width = '100%';
        canvas.style.height = '100%';
        canvasHostRef.current.innerHTML = '';
        canvasHostRef.current.appendChild(canvas);

        // Load packed spritesheet
        const spritesheetUrl = '/sprites/office_sprites.json';
        const sheet = await Assets.load<Spritesheet>(spritesheetUrl);
        if (!isMounted) return;

        // Force nearest-neighbor filtering on all textures to guarantee zero blur
        if (sheet.textureSource) {
          sheet.textureSource.scaleMode = 'nearest';
        }
        for (const tex of Object.values(sheet.textures)) {
          tex.source.scaleMode = 'nearest';
        }

        // Setup Scene Graph
        const world = new Container();
        world.scale.set(currentScale);
        world.position.set(app.screen.width / 2, 140);
        app.stage.addChild(world);

        // 1. Isometric Floor Grid (2:1 dimetric projection: 64x32 tiles)
        const floorGraphics = new Graphics();
        const gridW = 6;
        const gridH = 6;
        const tileW = 64;
        const tileH = 32;

        for (let gx = 0; gx < gridW; gx++) {
          for (let gy = 0; gy < gridH; gy++) {
            const sx = (gx - gy) * (tileW / 2);
            const sy = (gx + gy) * (tileH / 2);
            const isAlt = (gx + gy) % 2 === 0;

            floorGraphics.poly([
              sx,
              sy,
              sx + tileW / 2,
              sy + tileH / 2,
              sx,
              sy + tileH,
              sx - tileW / 2,
              sy + tileH / 2,
            ]);
            floorGraphics.fill({ color: isAlt ? 0x1e293b : 0x243248 });
            floorGraphics.stroke({ color: 0x334155, width: 1 });
          }
        }
        world.addChild(floorGraphics);

        // 2. Y-sorted Entity Container for Furniture & Character
        const entityContainer = new Container();
        world.addChild(entityContainer);

        // Place 3 Kenney Furniture Items
        // Desk at tile (3, 2)
        const deskTexture = sheet.textures['furniture_desk.png'] || Texture.EMPTY;
        const deskSprite = new Sprite(deskTexture);
        const deskGx = 2.8;
        const deskGy = 2.0;
        deskSprite.anchor.set(0.5, 0.72);
        deskSprite.position.set(
          (deskGx - deskGy) * (tileW / 2),
          (deskGx + deskGy) * (tileH / 2)
        );
        entityContainer.addChild(deskSprite);

        // Chair at tile (2.3, 1.4) - behind the desk
        const chairTexture = sheet.textures['furniture_chair.png'] || Texture.EMPTY;
        const chairSprite = new Sprite(chairTexture);
        const chairGx = 2.3;
        const chairGy = 1.4;
        chairSprite.anchor.set(0.5, 0.72);
        chairSprite.position.set(
          (chairGx - chairGy) * (tileW / 2),
          (chairGx + chairGy) * (tileH / 2)
        );
        entityContainer.addChild(chairSprite);

        // Monitor sitting directly on top of the desk
        const screenTexture = sheet.textures['furniture_screen.png'] || Texture.EMPTY;
        const screenSprite = new Sprite(screenTexture);
        screenSprite.anchor.set(0.5, 0.72);
        screenSprite.position.set(deskSprite.x + 2, deskSprite.y - 12);
        entityContainer.addChild(screenSprite);

        // 3. Bastion Character Animated Sprite
        const walkSeTextures = [0, 1, 2, 3, 4, 5].map(
          i => sheet.textures[`bastion_walk_se_${i}.png`] || Texture.EMPTY
        );
        const walkNeTextures = [0, 1, 2, 3, 4, 5].map(
          i => sheet.textures[`bastion_walk_ne_${i}.png`] || Texture.EMPTY
        );
        const idleSeTextures = [0, 1, 2, 3].map(
          i => sheet.textures[`bastion_idle_se_${i}.png`] || Texture.EMPTY
        );
        const idleNeTextures = [0, 1, 2, 3].map(
          i => sheet.textures[`bastion_idle_ne_${i}.png`] || Texture.EMPTY
        );

        const characterSprite = new AnimatedSprite(walkSeTextures);
        characterSprite.anchor.set(0.5, 0.90);
        characterSprite.animationSpeed = 0.12; // ~7.2 FPS classic retro cadence
        characterSprite.play();
        entityContainer.addChild(characterSprite);

        // 4. Patrol Route Waypoints around the 3 Furniture Items
        // Waypoints in continuous loop: Front-Left -> Front-Right -> Back-Right -> Back-Left
        const waypoints = [
          { gx: 1.2, gy: 3.6 }, // 0: South-West of desk
          { gx: 4.4, gy: 3.6 }, // 1: South-East (walks in front of desk)
          { gx: 4.4, gy: 0.8 }, // 2: North-East (walks along right of desk)
          { gx: 1.2, gy: 0.8 }, // 3: North-West (walks behind desk & chair)
        ];

        let currentWpIdx = 0;
        let charPosGx = waypoints[0].gx;
        let charPosGy = waypoints[0].gy;
        let fpsCounter = 0;
        let fpsTimer = 0;

        app.ticker.add(ticker => {
          const dt = ticker.deltaTime / 60; // elapsed seconds
          fpsCounter++;
          fpsTimer += dt;
          if (fpsTimer >= 1.0) {
            if (onFpsUpdate) onFpsUpdate(Math.round(fpsCounter / fpsTimer));
            fpsCounter = 0;
            fpsTimer = 0;
          }

          const mode = modeRef.current;

          if (mode === 'patrol') {
            const targetWp = waypoints[currentWpIdx];
            const dx = targetWp.gx - charPosGx;
            const dy = targetWp.gy - charPosGy;
            const dist = Math.hypot(dx, dy);
            const walkSpeed = 1.0; // grid tiles per second

            if (dist < 0.05) {
              currentWpIdx = (currentWpIdx + 1) % waypoints.length;
            } else {
              const step = Math.min(dist, walkSpeed * dt);
              charPosGx += (dx / dist) * step;
              charPosGy += (dy / dist) * step;

              // Determine direction and active animation
              // dx > 0 && dy == 0 => SE
              // dx == 0 && dy < 0 => NE
              // dx < 0 && dy == 0 => NW (horizontal flip of NE or walk_ne)
              // dx == 0 && dy > 0 => SW (horizontal flip of SE or walk_se)
              if (Math.abs(dx) >= Math.abs(dy)) {
                if (dx > 0) {
                  // Moving SE
                  if (characterSprite.textures !== walkSeTextures) {
                    characterSprite.textures = walkSeTextures;
                    characterSprite.play();
                  }
                  characterSprite.scale.x = 1;
                } else {
                  // Moving NW (mirror of SE)
                  if (characterSprite.textures !== walkSeTextures) {
                    characterSprite.textures = walkSeTextures;
                    characterSprite.play();
                  }
                  characterSprite.scale.x = -1;
                }
              } else {
                if (dy < 0) {
                  // Moving NE
                  if (characterSprite.textures !== walkNeTextures) {
                    characterSprite.textures = walkNeTextures;
                    characterSprite.play();
                  }
                  characterSprite.scale.x = 1;
                } else {
                  // Moving SW (mirror of NE)
                  if (characterSprite.textures !== walkNeTextures) {
                    characterSprite.textures = walkNeTextures;
                    characterSprite.play();
                  }
                  characterSprite.scale.x = -1;
                }
              }
            }
          } else if (mode === 'walk_se') {
            if (characterSprite.textures !== walkSeTextures) {
              characterSprite.textures = walkSeTextures;
              characterSprite.play();
            }
            characterSprite.scale.x = 1;
            charPosGx = 2.8;
            charPosGy = 3.6;
          } else if (mode === 'walk_ne') {
            if (characterSprite.textures !== walkNeTextures) {
              characterSprite.textures = walkNeTextures;
              characterSprite.play();
            }
            characterSprite.scale.x = 1;
            charPosGx = 4.0;
            charPosGy = 2.0;
          } else if (mode === 'idle_se') {
            if (characterSprite.textures !== idleSeTextures) {
              characterSprite.textures = idleSeTextures;
              characterSprite.play();
            }
            characterSprite.scale.x = 1;
            charPosGx = 2.8;
            charPosGy = 3.6;
          } else if (mode === 'idle_ne') {
            if (characterSprite.textures !== idleNeTextures) {
              characterSprite.textures = idleNeTextures;
              characterSprite.play();
            }
            characterSprite.scale.x = 1;
            charPosGx = 4.0;
            charPosGy = 2.0;
          }

          // Project character isometric coordinate to screen pixels
          characterSprite.position.set(
            (charPosGx - charPosGy) * (tileW / 2),
            (charPosGx + charPosGy) * (tileH / 2)
          );

          // 2.5D Isometric Depth Sorting: zIndex = Y coordinate
          chairSprite.zIndex = (chairGx + chairGy) * 1000;
          deskSprite.zIndex = (deskGx + deskGy) * 1000 + 10;
          screenSprite.zIndex = deskSprite.zIndex + 2;
          characterSprite.zIndex = (charPosGx + charPosGy) * 1000 + 5;

          entityContainer.sortChildren();
        });

        setLoading(false);
      } catch (err: unknown) {
        console.error('Failed to init PixiJS application:', err);
        setError(err instanceof Error ? err.message : String(err));
        setLoading(false);
      }
    }

    initPixi();

    return () => {
      isMounted = false;
      if (app) {
        app.destroy(true, { children: true });
      }
    };
  }, [currentScale, onFpsUpdate]);

  return (
    <div className="relative flex flex-col items-center w-full max-w-4xl mx-auto rounded-xl overflow-hidden border border-slate-800 bg-slate-900 shadow-2xl">
      {/* HUD Header */}
      <div className="flex flex-wrap items-center justify-between w-full px-4 py-3 bg-slate-950/80 backdrop-blur border-b border-slate-800 text-xs text-slate-300">
        <div className="flex items-center space-x-2">
          <span className="inline-block w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
          <span className="font-semibold text-slate-100">
            Fase 0 Spike: Blender → Pixel-Art Isometrik 2.5D
          </span>
          <span className="px-2 py-0.5 rounded bg-sky-950 text-sky-400 border border-sky-800/60 font-mono">
            PixiJS v8.22
          </span>
        </div>

        {/* Controls */}
        <div className="flex items-center space-x-3 mt-2 sm:mt-0">
          <div className="flex items-center space-x-1 bg-slate-900 px-2 py-1 rounded border border-slate-800">
            <span className="text-slate-400 mr-1">Skala:</span>
            {[1, 2, 3, 4].map(s => (
              <button
                key={s}
                onClick={() => setCurrentScale(s)}
                className={`px-2 py-0.5 rounded transition ${
                  currentScale === s
                    ? 'bg-sky-600 text-white font-bold'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {s}x{s === 2 ? ' (Spec)' : ''}
              </button>
            ))}
          </div>

          <div className="flex items-center space-x-1 bg-slate-900 px-2 py-1 rounded border border-slate-800">
            <span className="text-slate-400 mr-1">Mode:</span>
            {(['patrol', 'walk_se', 'walk_ne', 'idle_se', 'idle_ne'] as const).map(
              m => (
                <button
                  key={m}
                  onClick={() => setActiveMode(m)}
                  className={`px-2 py-0.5 rounded uppercase font-mono transition ${
                    activeMode === m
                      ? 'bg-amber-600 text-white font-bold'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {m.replace('_', ' ')}
                </button>
              )
            )}
          </div>
        </div>
      </div>

      {/* Canvas Viewport */}
      <div
        ref={containerRef}
        className="w-full h-[520px] bg-slate-950 flex items-center justify-center relative select-none"
      >
        <div ref={canvasHostRef} className="w-full h-full" />
        {loading && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950/80 text-slate-400 space-y-2 pointer-events-none">
            <div className="w-8 h-8 border-2 border-sky-500 border-t-transparent rounded-full animate-spin" />
            <p>Memuat sprite atlas (free-tex-packer-core)...</p>
          </div>
        )}
        {error && (
          <div className="absolute inset-0 flex items-center justify-center bg-slate-950/90 p-4">
            <div className="p-4 bg-rose-950/80 border border-rose-800 text-rose-200 rounded max-w-md text-sm">
              <p className="font-bold">Gagal memuat PixiJS Spike:</p>
              <p className="font-mono mt-1 text-xs">{error}</p>
            </div>
          </div>
        )}
      </div>

      {/* Info Footer */}
      <div className="flex flex-wrap items-center justify-between w-full px-4 py-2.5 bg-slate-950 border-t border-slate-800/80 text-[11px] text-slate-400 font-mono">
        <div>
          <span>Target: Bastion Chibi (Head 1.6x, Short Legs, Helm Lampu)</span>
          <span className="mx-2 text-slate-600">|</span>
          <span>Furnitur: Meja + Kursi + Monitor Kenney</span>
        </div>
        <div className="flex items-center space-x-4">
          <span>Kuantisasi: Palet Master 32 Warna</span>
          <span>Outline: 1px Charcoal (#14141E)</span>
          <span className="text-emerald-400 font-semibold">Blur: ZERO (Nearest-Neighbor)</span>
        </div>
      </div>
    </div>
  );
};
