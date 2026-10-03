import { Application, Container, Graphics } from 'pixi.js';
import { officeStore } from '../store/officeStore';

/**
 * WorldApp mengelola satu-satunya instans `PIXI.Application` untuk render dunia isometrik.
 * Zustand vanilla store adalah satu-satunya jembatan data; render loop ticker membaca
 * state secara langsung via `officeStore.getState()` dan TIDAK PERNAH memanggil setState React.
 */
export class WorldApp {
  private app: Application | null = null;
  private worldContainer: Container | null = null;
  private gridGraphics: Graphics | null = null;
  private isInitialized = false;

  public async init(container: HTMLElement): Promise<Application> {
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

    // Kontainer utama dunia untuk layer peta Tiled & entitas karakter (T1.11)
    this.worldContainer = new Container();
    this.worldContainer.label = 'WorldContainer';
    app.stage.addChild(this.worldContainer);

    // Gambar panduan grid isometrik 2:1 pada kanvas kosong awal
    this.renderBlankCanvasGrid();

    // Loop ticker Pixi: membaca store vanilla tiap frame
    app.ticker.add((time) => {
      this.update(time.deltaTime);
    });

    this.isInitialized = true;
    return app;
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

    const width = this.app.screen.width || 1280;
    const height = this.app.screen.height || 720;
    const centerX = width / 2;
    const centerY = height / 2;

    const tileWidth = 64;
    const tileHeight = 32;
    const gridCols = 16;
    const gridRows = 16;

    // Warna lantai malam (#1a1c29) dan garis grid redup (#282d3f)
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

    // Hook untuk downstream renderer (Steward T1.11):
    // Mengonsumsi state.agents dan state.timeOfDay secara langsung
    if (this.gridGraphics && state.timeOfDay) {
      // Penyesuaian alpha atmosfer jika diperlukan tanpa touching React
    }
  }

  public getApp(): Application | null {
    return this.app;
  }

  public getWorldContainer(): Container | null {
    return this.worldContainer;
  }

  public isReady(): boolean {
    return this.isInitialized && this.app !== null;
  }

  public destroy(): void {
    if (this.app) {
      this.app.destroy(true, { children: true, texture: true });
      this.app = null;
    }
    this.worldContainer = null;
    this.gridGraphics = null;
    this.isInitialized = false;
  }
}

export const worldApp = new WorldApp();
