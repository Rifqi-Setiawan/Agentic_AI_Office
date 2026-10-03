import { describe, expect, it } from 'vitest';
import { Application } from 'pixi.js';
import gsap from 'gsap';
import { CameraManager } from './camera';
import { OfficeZone } from './types';

describe('CameraManager, Viewport, dan Animasi Flight GSAP (Spec F10)', () => {
  const createMockApp = (): Application => {
    const mockDom = {
      addEventListener: () => {},
      removeEventListener: () => {},
    };
    return {
      screen: { width: 1280, height: 720 },
      renderer: {
        events: {
          domElement: mockDom,
        },
      },
    } as unknown as Application;
  };

  it('configures pixi-viewport with drag, wheel, clamp, and integer zoom (1x-3x)', () => {
    const app = createMockApp();
    const camera = new CameraManager({
      app,
      worldWidth: 2560,
      worldHeight: 1440,
      minZoom: 1,
      maxZoom: 3,
    });

    const viewport = camera.getViewport();
    expect(viewport).toBeDefined();

    // Default zoom 1x
    expect(camera.getZoomLevel()).toBe(1);

    // Set zoom integer 2x
    camera.setZoomLevel(2);
    expect(camera.getZoomLevel()).toBe(2);

    // Set zoom integer 3x
    camera.setZoomLevel(3);
    expect(camera.getZoomLevel()).toBe(3);

    // Clamp jika melebihi rentang [1, 3]
    camera.setZoomLevel(5 as unknown as 3);
    expect(camera.getZoomLevel()).toBe(3);

    camera.setZoomLevel(0 as unknown as 1);
    expect(camera.getZoomLevel()).toBe(1);
  });

  it('executes GSAP camera flight with 1.25s duration and power2.inOut easing', async () => {
    const app = createMockApp();
    const camera = new CameraManager({ app });

    const mockZone: OfficeZone = {
      id: 'Z01',
      name: 'Ruang CEO',
      resident: 'Jarvis',
      gx_min: 0,
      gx_max: 9,
      gy_min: 0,
      gy_max: 7,
      worldCenter: { x: 1200, y: 700 },
      gridCenter: { gx: 4.5, gy: 3.5 },
    };

    let completeCalled = false;
    const tween = camera.flyToZone(mockZone, () => {
      completeCalled = true;
    });

    expect(tween).toBeDefined();
    expect(camera.isFlying()).toBe(true);

    // Durasi harus tepat 1.25 detik
    expect(tween.duration()).toBe(1.25);

    // Kurva easing power2.inOut
    // GSAP internal ease function
    expect(tween.vars.ease).toBe('power2.inOut');

    // Majukan waktu GSAP ke akhir animasi
    gsap.ticker.tick();
    tween.progress(1.0);

    expect(completeCalled).toBe(true);
    expect(camera.isFlying()).toBe(false);

    // Pusat kamera harus berada di pusat zona target
    const center = camera.getViewport().center;
    expect(center.x).toBeCloseTo(1200, 1);
    expect(center.y).toBeCloseTo(700, 1);
  });

  it('enforces spec requirement: Flight tween dihentikan saat user drag', () => {
    const app = createMockApp();
    const camera = new CameraManager({ app });

    const tween = camera.flyToCoordinate(2000, 1000);
    expect(camera.isFlying()).toBe(true);
    expect(tween.parent).not.toBeNull();

    // Simulasikan user mulai melakukan drag pada viewport
    camera.getViewport().emit('drag-start' as never);

    // Tween flight harus langsung mati (killed)
    expect(camera.isFlying()).toBe(false);
    expect(tween.parent).toBeNull();
  });
});
