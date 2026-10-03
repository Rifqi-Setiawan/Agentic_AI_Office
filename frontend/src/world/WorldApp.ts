import { Application, Assets, Container, Graphics, Spritesheet, Texture } from 'pixi.js';
import { Viewport } from 'pixi-viewport';
import { officeStore } from '../store/officeStore';
import { CameraManager } from './camera';
import { LoadedOfficeMap, OfficeMapLoader } from './mapLoader';
import { TiledMapDoc } from './types';
import { WORLD_HEIGHT, WORLD_ORIGIN_X, WORLD_ORIGIN_Y, WORLD_WIDTH } from './projection';

/**
 * WorldApp mengelola satu-satunya instans `PIXI.Application` untuk render dunia isometrik.
 * Zustand vanilla store adalah satu-satunya jembatan data; render loop ticker membaca
 * state secara langsung via `officeStore.getState()` dan TIDAK PERNAH memanggil setState React.
 */
export class WorldApp {
  private app: Application | null = null;
  private camera: CameraManager | null = null;
  private worldContainer: Container | null = null;
  private loadedMap: LoadedOfficeMap | null = null;
  private gridGraphics: Graphics | null = null;
  private spritesheet: Spritesheet | null = null;
  private isInitialized = false;

  public async init(
    container: HTMLElement,
    mapDocOverride?: TiledMapDoc,
  ): Promise<Application> {
    if (this.app && this.isInitialized) {
      return this.app;
    }

    const app = new Application();

    await app.init({
      resizeTo: container,
      backgroundColor: 0x14141e, // #14141e (Outline Charcoal / Void)
      antialias: false,
      roundPixels: true,
      preference: 'webgl',
      autoDensity: true,
      resolution: typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1,
    });

    this.app = app;

    // Pastikan styling canvas pixelated untuk rendering pixel-art tajam
    app.canvas.classList.add('pixelated');
    app.canvas.style.width = '100%';
    app.canvas.style.height = '100%';
    app.canvas.style.display = 'block';

    container.replaceChildren(app.canvas);

    // Inisialisasi pixi-viewport untuk drag/zoom (1x–3x)
    this.camera = new CameraManager({
      app,
      worldWidth: WORLD_WIDTH,
      worldHeight: WORLD_HEIGHT,
      minZoom: 1,
      maxZoom: 3,
    });

    const viewport = this.camera.getViewport();
    app.stage.addChild(viewport);

    // Kontainer utama dunia di dalam viewport
    this.worldContainer = new Container();
    this.worldContainer.label = 'WorldContainer';
    viewport.addChild(this.worldContainer);

    // Muat peta Tiled dan atlas jika tersedia
    await this.initMap(mapDocOverride);

    // Pasang culling otomatis saat viewport digeser atau di-zoom
    viewport.on('moved', () => {
      this.updateCulling();
    });

    // Loop ticker Pixi: membaca store vanilla tiap frame
    app.ticker.add((time) => {
      this.update(time.deltaTime);
    });

    this.isInitialized = true;
    return app;
  }

  /**
   * Memuat atlas tekstur lingkungan dan dokumen peta Tiled floor1.tmj
   */
  private async initMap(mapDocOverride?: TiledMapDoc): Promise<void> {
    if (!this.worldContainer) return;

    let mapDoc: TiledMapDoc | null = mapDocOverride || null;

    // Coba muat spritesheet environment jika di browser environment
    if (typeof window !== 'undefined') {
      try {
        const loadedSheet = await Assets.load('/sprites/environment.json');
        if (loadedSheet && loadedSheet.textures) {
          this.spritesheet = loadedSheet;
        }
      } catch (err) {
        console.warn('[WorldApp] Atlas environment tidak dapat dimuat, menggunakan texture fallback:', err);
      }
    }

    // Jika map doc belum ada, coba fetch dari /maps/floor1.tmj
    if (!mapDoc && typeof window !== 'undefined') {
      try {
        const resp = await fetch('/maps/floor1.tmj');
        if (resp.ok) {
          mapDoc = (await resp.json()) as TiledMapDoc;
        }
      } catch (err) {
        console.warn('[WorldApp] Gagal fetch /maps/floor1.tmj, render grid fallback:', err);
      }
    }

    if (mapDoc) {
      const textureProvider = (frameName: string): Texture | null => {
        if (this.spritesheet && this.spritesheet.textures[frameName]) {
          return this.spritesheet.textures[frameName];
        }
        return null;
      };

      this.loadedMap = OfficeMapLoader.loadFromDoc(mapDoc, {
        textureProvider,
        originX: WORLD_ORIGIN_X,
        originY: WORLD_ORIGIN_Y,
      });

      this.worldContainer.addChild(this.loadedMap.worldRoot);

      // Jalankan culling awal
      this.updateCulling();
    } else {
      // Fallback: render isometric grid scaffold
      this.renderBlankCanvasGrid();
    }
  }

  /**
   * Evaluasi culling sprite di luar viewport.
   */
  public updateCulling(): void {
    if (!this.loadedMap || !this.camera) return;
    const viewport = this.camera.getViewport();
    const visibleBounds = viewport.getVisibleBounds();
    this.loadedMap.cullingManager.update({
      x: visibleBounds.x,
      y: visibleBounds.y,
      width: visibleBounds.width,
      height: visibleBounds.height,
    });
  }

  /**
   * Menampilkan representasi kanvas kosong dengan grid isometrik 2:1 berorientasi tengah,
   * sesuai spesifikasi proyeksi dimetrik tile 64x32 px.
   */
  private renderBlankCanvasGrid(): void {
    if (!this.worldContainer || !this.app) return;

    if (this.gridGraphics) {
      this.gridGraphics.destroy();
      this.gridGraphics = null;
    }

    const g = new Graphics();
    g.label = 'IsometricScaffoldGrid';

    const width = WORLD_WIDTH;
    const height = WORLD_HEIGHT;
    const centerX = width / 2;
    const centerY = height / 2;

    const tileWidth = 64;
    const tileHeight = 32;
    const gridCols = 16;
    const gridRows = 16;

    // Warna void #14141e
    g.rect(0, 0, width, height);
    g.fill({ color: 0x14141e });

    // Gambar diamond grid 2:1
    for (let x = -gridCols / 2; x < gridCols / 2; x++) {
      for (let y = -gridRows / 2; y < gridRows / 2; y++) {
        const sx = centerX + (x - y) * (tileWidth / 2);
        const sy = centerY + (x + y) * (tileHeight / 2);

        g.poly([
          sx, sy - tileHeight / 2,
          sx + tileWidth / 2, sy,
          sx, sy + tileHeight / 2,
          sx - tileWidth / 2, sy,
        ]);
        g.stroke({ width: 1, color: 0x282d3f, alpha: 0.35 });
      }
    }

    this.gridGraphics = g;
    this.worldContainer.addChild(g);
  }

  /**
   * Render ticker loop.
   * Pure reads dari vanilla Zustand store.
   * TIDAK PERNAH memanggil setState React atau memicu re-render pada HUD.
   */
  public update(deltaTime?: number): void {
    void deltaTime;
    if (!this.isInitialized) return;

    // Akses vanilla store tanpa melalui React runtime
    const state = officeStore.getState();

    // Hook untuk downstream FSM gerak karakter (Steward T1.13) dan atmosfer (Warden T1.18):
    if (this.loadedMap && state.agents) {
      // Sort entitas dinamis di container entities
      const entitiesContainer = this.loadedMap.containers.entities;
      if (entitiesContainer.sortableChildren) {
        entitiesContainer.sortChildren();
      }
    }
  }

  /**
   * Menggerakkan kamera dengan animasi flight GSAP 1,25 dtk (power2.inOut) ke zona tertentu.
   */
  public flyToZone(zoneId: string, onComplete?: () => void): boolean {
    if (!this.camera || !this.loadedMap) return false;
    const zone = this.loadedMap.getZone(zoneId);
    if (!zone) return false;
    this.camera.flyToZone(zone, onComplete);
    return true;
  }

  /**
   * Mengatur level zoom kamera ke integer 1x, 2x, atau 3x.
   */
  public setZoomLevel(level: 1 | 2 | 3): void {
    if (this.camera) {
      this.camera.setZoomLevel(level);
      this.updateCulling();
    }
  }

  public getZoomLevel(): number {
    return this.camera ? this.camera.getZoomLevel() : 1;
  }

  public getApp(): Application | null {
    return this.app;
  }

  public getWorldContainer(): Container | null {
    return this.worldContainer;
  }

  public getCamera(): CameraManager | null {
    return this.camera;
  }

  public getViewport(): Viewport | null {
    return this.camera ? this.camera.getViewport() : null;
  }

  public getLoadedMap(): LoadedOfficeMap | null {
    return this.loadedMap;
  }

  public isReady(): boolean {
    return this.isInitialized && this.app !== null;
  }

  public destroy(): void {
    if (this.camera) {
      this.camera.destroy();
      this.camera = null;
    }
    if (this.app) {
      this.app.destroy(true, { children: true, texture: true });
      this.app = null;
    }
    this.worldContainer = null;
    this.loadedMap = null;
    this.gridGraphics = null;
    this.spritesheet = null;
    this.isInitialized = false;
  }
}

export const worldApp = new WorldApp();
