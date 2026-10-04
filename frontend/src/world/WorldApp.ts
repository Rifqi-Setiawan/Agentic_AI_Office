import { Application, Assets, Container, Graphics, Spritesheet, Texture } from 'pixi.js';
import { Viewport } from 'pixi-viewport';
import { CameraManager } from './camera';
import { LoadedOfficeMap, OfficeMapLoader } from './mapLoader';
import { TiledMapDoc } from './types';
import { screenToGrid, WORLD_HEIGHT, WORLD_ORIGIN_X, WORLD_ORIGIN_Y, WORLD_WIDTH } from './projection';
import { CharacterManager } from './CharacterManager';
import { Character } from './Character';
import { Choreographer } from './Choreographer';
import { BubbleManager } from './bubble';
import { GridMap, type RawTiledMap } from '../navigation/GridMap';
import { AStarPathfinder } from '../navigation/AStarPathfinder';
import { SlotReservationManager } from '../navigation/SlotReservationManager';

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
  private characterManager: CharacterManager | null = null;
  private choreographer: Choreographer | null = null;
  private bubbleManager: BubbleManager | null = null;
  private gridMap: GridMap | null = null;
  private pathfinder: AStarPathfinder | null = null;
  private slotReservationManager: SlotReservationManager | null = null;
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

    // Menangani klik pada lantai kanvas viewport untuk avatar Rifqi (mode Founder F17 / T1.19)
    viewport.on('clicked', (data) => {
      const target = (data.event as unknown as { target?: { label?: string; parent?: unknown } })?.target;
      if (this.isCharacterTarget(target)) {
        return;
      }
      this.handleFloorClick(data.world.x, data.world.y);
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

      // Inisialisasi CharacterManager dan spawn seluruh agen di meja/posisi asal
      this.characterManager = new CharacterManager(this.loadedMap);
      this.characterManager.spawnAllAgents();

      // Inisialisasi navigasi dan Choreographer (T1.14: task nyata + ambient + event kolektif)
      this.gridMap = new GridMap(mapDoc as unknown as RawTiledMap);
      this.pathfinder = new AStarPathfinder(this.gridMap);
      this.slotReservationManager = new SlotReservationManager(this.gridMap);

      // Inisialisasi PRNG deterministik jika seed ambient ditentukan (mis. untuk screenshot regresi & tes E2E)
      let randomFn: (() => number) | undefined = undefined;
      if (typeof window !== 'undefined') {
        const urlParams = new URLSearchParams(window.location.search);
        const seedStr = urlParams.get('seed') ?? (window as unknown as { __OFFICE_SEED__?: string | number }).__OFFICE_SEED__;
        if (seedStr !== null && seedStr !== undefined) {
          const seedNum = parseInt(String(seedStr), 10);
          if (!isNaN(seedNum)) {
            let s = seedNum | 0;
            randomFn = () => {
              s = (s + 0x6d2b79f5) | 0;
              let t = Math.imul(s ^ (s >>> 15), 1 | s);
              t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
              return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
            };
          }
        }
      }

      this.choreographer = new Choreographer({
        characterManager: this.characterManager,
        gridMap: this.gridMap,
        pathfinder: this.pathfinder,
        slotManager: this.slotReservationManager,
        randomFn,
      });
      this.choreographer.init();

      // Sambungkan klik agen ke Choreographer (mode Founder F17 / T1.19)
      this.characterManager.setOnCharacterClick((char) => {
        this.handleAgentClick(char.id);
      });

      // Inisialisasi BubbleManager (T1.15: DOM overlay pool tanpa React)
      this.bubbleManager = new BubbleManager({
        characterManager: this.characterManager,
        camera: this.camera,
        app: this.app,
      });

      this.choreographer.onBubble((event) => {
        this.bubbleManager?.handleChoreographerBubble(event);
      });

      if (typeof window !== 'undefined') {
        this.characterManager.loadAllCharacterSpritesheets().catch((err) => {
          console.warn('[WorldApp] Gagal memuat spritesheet karakter:', err);
        });
      }

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
    if (!this.isInitialized) return;

    // Konversi deltaTime ticker ke detik (standar 60fps = 1/60 detik per delta frame)
    const dtSec = (deltaTime ?? 1.0) / 60;

    // Pembaruan Choreographer (T1.14: task nyata, ambient, event kolektif)
    if (this.choreographer) {
      this.choreographer.update(dtSec);
    }

    // Pembaruan BubbleManager (T1.15: DOM overlay pool tanpa React)
    if (this.bubbleManager) {
      this.bubbleManager.update(dtSec);
    }

    // Pembaruan FSM gerak dan rendering entitas karakter (T1.13)
    if (this.characterManager) {
      this.characterManager.update(dtSec);
    } else if (this.loadedMap) {
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

  public getCharacterManager(): CharacterManager | null {
    return this.characterManager;
  }

  public getChoreographer(): Choreographer | null {
    return this.choreographer;
  }

  public getBubbleManager(): BubbleManager | null {
    return this.bubbleManager;
  }

  public getGridMap(): GridMap | null {
    return this.gridMap;
  }

  public getPathfinder(): AStarPathfinder | null {
    return this.pathfinder;
  }

  public getSlotReservationManager(): SlotReservationManager | null {
    return this.slotReservationManager;
  }

  public getCharacter(id: string): Character | undefined {
    return this.characterManager?.getCharacter(id);
  }

  /**
   * Mengecek apakah display object target merupakan bagian dari entitas karakter.
   */
  public isCharacterTarget(target?: { label?: string; parent?: unknown } | null): boolean {
    let curr: unknown = target;
    while (curr) {
      if (curr instanceof Character) return true;
      const label = (curr as { label?: string }).label;
      if (
        typeof label === 'string' &&
        (label.startsWith('Character_') ||
          label.startsWith('SpriteWrapper_') ||
          label.startsWith('AnimSprite_') ||
          label.startsWith('TaskBadge_') ||
          label.startsWith('NameTag_') ||
          label.startsWith('RifqiGoldenCrown'))
      ) {
        return true;
      }
      curr = (curr as { parent?: unknown }).parent;
    }
    return false;
  }

  /**
   * Menangani klik lantai berdasarkan koordinat dunia pixel isometrik (F17 / T1.19).
   */
  public handleFloorClick(worldX: number, worldY: number): boolean {
    const { gx, gy } = screenToGrid(worldX, worldY, WORLD_ORIGIN_X, WORLD_ORIGIN_Y);
    return this.handleGridClick(Math.round(gx), Math.round(gy));
  }

  /**
   * Menangani klik lantai berdasarkan koordinat grid integer (gx, gy).
   */
  public handleGridClick(gx: number, gy: number): boolean {
    if (!this.choreographer) return false;
    return this.choreographer.handleFloorClick(gx, gy);
  }

  /**
   * Menangani klik agent (membuka inspector + di mode Founder menghampiri & agent menoleh).
   */
  public handleAgentClick(agentId: string): boolean {
    if (!this.choreographer) return false;
    return this.choreographer.handleAgentClick(agentId);
  }

  public isReady(): boolean {
    return this.isInitialized && this.app !== null;
  }

  public destroy(): void {
    if (this.camera) {
      this.camera.destroy();
      this.camera = null;
    }
    if (this.choreographer) {
      this.choreographer.destroy();
      this.choreographer = null;
    }
    if (this.bubbleManager) {
      this.bubbleManager.destroy();
      this.bubbleManager = null;
    }
    if (this.characterManager) {
      this.characterManager.destroy();
      this.characterManager = null;
    }
    this.gridMap = null;
    this.pathfinder = null;
    this.slotReservationManager = null;
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
