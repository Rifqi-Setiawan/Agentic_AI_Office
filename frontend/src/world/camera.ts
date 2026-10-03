import { Viewport } from 'pixi-viewport';
import { Application } from 'pixi.js';
import gsap from 'gsap';
import { OfficeZone } from './types';
import { WORLD_HEIGHT, WORLD_WIDTH } from './projection';

export interface CameraOptions {
  app: Application;
  worldWidth?: number;
  worldHeight?: number;
  minZoom?: number;
  maxZoom?: number;
}

/**
 * CameraManager mengelola interaksi kamera isometrik menggunakan pixi-viewport dan animasi flight GSAP.
 *
 * Fitur:
 * - Drag/pan dan pinch/wheel zoom dengan skala integer 1x–3x.
 * - Flight GSAP `power2.inOut` 1,25 dtk ke pusat zona target.
 * - Otomatis menghentikan (kill) tween flight saat user mulai melakukan drag interaktif.
 */
export class CameraManager {
  private viewport: Viewport;
  private currentFlightTween: gsap.core.Tween | null = null;
  private minZoom: number;
  private maxZoom: number;

  constructor(options: CameraOptions) {
    const { app, worldWidth = WORLD_WIDTH, worldHeight = WORLD_HEIGHT, minZoom = 1, maxZoom = 3 } = options;
    this.minZoom = minZoom;
    this.maxZoom = maxZoom;

    const screenWidth = app.screen.width || (typeof window !== 'undefined' ? window.innerWidth : 1280);
    const screenHeight = app.screen.height || (typeof window !== 'undefined' ? window.innerHeight : 720);

    this.viewport = new Viewport({
      screenWidth,
      screenHeight,
      worldWidth,
      worldHeight,
      events: app.renderer.events,
    });

    // Konfigurasi viewport plugin
    this.viewport
      .drag({ pressDrag: true })
      .pinch()
      .wheel({ smooth: 3 })
      .clamp({
        direction: 'all',
        underflow: 'center',
      })
      .clampZoom({
        minScale: this.minZoom,
        maxScale: this.maxZoom,
      });

    // Set zoom awal 1x di tengah peta
    this.viewport.setZoom(1);
    this.viewport.moveCenter(worldWidth / 2, worldHeight / 2);

    // Kriteria: Hentikan tween flight saat user melakukan drag
    this.viewport.on('drag-start', () => {
      this.cancelFlight();
    });

    // Menjaga skala integer saat zoom berakhir
    this.viewport.on('zoomed-end', () => {
      this.snapToIntegerZoom();
    });
  }

  public getViewport(): Viewport {
    return this.viewport;
  }

  /**
   * Mengatur zoom level integer secara eksplisit (1x, 2x, atau 3x).
   */
  public setZoomLevel(level: 1 | 2 | 3): void {
    const targetScale = Math.max(this.minZoom, Math.min(this.maxZoom, Math.round(level)));
    this.viewport.setZoom(targetScale);
  }

  public getZoomLevel(): number {
    return Math.round(this.viewport.scale.x);
  }

  /**
   * Membulatkan skala zoom ke integer terdekat dalam rentang [minZoom, maxZoom].
   */
  public snapToIntegerZoom(): void {
    const currentScale = this.viewport.scale.x;
    const rounded = Math.max(this.minZoom, Math.min(this.maxZoom, Math.round(currentScale)));
    if (Math.abs(currentScale - rounded) > 0.05) {
      this.viewport.setZoom(rounded);
    }
  }

  /**
   * Animasi flight GSAP 1,25 detik dengan kurva easing `power2.inOut` ke zona tujuan.
   */
  public flyToZone(zone: OfficeZone, onComplete?: () => void): gsap.core.Tween {
    return this.flyToCoordinate(zone.worldCenter.x, zone.worldCenter.y, onComplete);
  }

  /**
   * Animasi flight GSAP 1,25 detik dengan kurva easing `power2.inOut` ke koordinat dunia.
   */
  public flyToCoordinate(targetWorldX: number, targetWorldY: number, onComplete?: () => void): gsap.core.Tween {
    this.cancelFlight();

    const startCenter = this.viewport.center;
    const state = {
      x: startCenter.x,
      y: startCenter.y,
    };

    const tween = gsap.to(state, {
      x: targetWorldX,
      y: targetWorldY,
      duration: 1.25,
      ease: 'power2.inOut',
      onUpdate: () => {
        this.viewport.moveCenter(state.x, state.y);
      },
      onComplete: () => {
        this.viewport.moveCenter(targetWorldX, targetWorldY);
        this.currentFlightTween = null;
        if (onComplete) onComplete();
      },
    });

    this.currentFlightTween = tween;
    return tween;
  }

  /**
   * Menghentikan animasi flight yang sedang berjalan.
   */
  public cancelFlight(): boolean {
    if (this.currentFlightTween && this.currentFlightTween.parent !== null) {
      this.currentFlightTween.kill();
      this.currentFlightTween = null;
      return true;
    }
    return false;
  }

  public isFlying(): boolean {
    return (
      this.currentFlightTween !== null &&
      this.currentFlightTween.parent !== null &&
      this.currentFlightTween.progress() < 1
    );
  }

  public destroy(): void {
    this.cancelFlight();
    this.viewport.destroy({ children: true });
  }
}
