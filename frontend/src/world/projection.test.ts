import { describe, expect, it } from 'vitest';
import {
  calculateZIndex,
  getMapWorldBounds,
  gridToScreen,
  HALF_HEIGHT,
  HALF_WIDTH,
  LAYER_OFFSETS,
  MAP_COLS,
  MAP_ROWS,
  screenToGrid,
  TILE_HEIGHT,
  TILE_WIDTH,
  WORLD_ORIGIN_X,
  WORLD_ORIGIN_Y,
} from './projection';

describe('Proyeksi Isometrik 2:1 (Dimetric) & Depth Sorting', () => {
  it('validates standard 2:1 dimetric tile dimensions (64x32 px)', () => {
    expect(TILE_WIDTH).toBe(64);
    expect(TILE_HEIGHT).toBe(32);
    expect(HALF_WIDTH).toBe(32);
    expect(HALF_HEIGHT).toBe(16);
    expect(TILE_WIDTH / TILE_HEIGHT).toBe(2); // 2:1 dimetric ratio
  });

  it('transforms grid coordinates to screen pixel coordinates accurately', () => {
    // Grid (0, 0) harus berada tepat di origin
    const origin = gridToScreen(0, 0, 1000, 500);
    expect(origin.x).toBe(1000);
    expect(origin.y).toBe(500);

    // Langkah 1 unit ke sumbu +X (South-East): x bertambah 32, y bertambah 16
    const stepX = gridToScreen(1, 0, 1000, 500);
    expect(stepX.x).toBe(1032);
    expect(stepX.y).toBe(516);

    // Langkah 1 unit ke sumbu +Y (South-West): x berkurang 32, y bertambah 16
    const stepY = gridToScreen(0, 1, 1000, 500);
    expect(stepY.x).toBe(968);
    expect(stepY.y).toBe(516);

    // Titik diagonal (1, 1): x tetap, y bertambah 32 (1 tile height)
    const diag = gridToScreen(1, 1, 1000, 500);
    expect(diag.x).toBe(1000);
    expect(diag.y).toBe(532);
  });

  it('performs lossless roundtrip between gridToScreen and screenToGrid', () => {
    const testPoints = [
      { gx: 0, gy: 0 },
      { gx: 10, gy: 5 },
      { gx: 22.5, gy: 14.75 },
      { gx: 43, gy: 31 },
      { gx: 0.125, gy: 0.875 },
    ];

    for (const pt of testPoints) {
      const scr = gridToScreen(pt.gx, pt.gy, WORLD_ORIGIN_X, WORLD_ORIGIN_Y);
      const roundtrip = screenToGrid(scr.x, scr.y, WORLD_ORIGIN_X, WORLD_ORIGIN_Y);

      expect(roundtrip.gx).toBeCloseTo(pt.gx, 6);
      expect(roundtrip.gy).toBeCloseTo(pt.gy, 6);
    }
  });

  it('calculates depth sorting zIndex with footprint formula (gx + gy) * 1000 + layerOffset', () => {
    // Entitas di (5, 5)
    const zFurn = calculateZIndex(5, 5, LAYER_OFFSETS.FURNITURE);
    expect(zFurn).toBe(10 * 1000 + 10); // 10010

    // Karakter di (5, 4) - di belakang furnitur
    const zCharBehind = calculateZIndex(5, 4, LAYER_OFFSETS.CHARACTER);
    expect(zCharBehind).toBe(9 * 1000 + 20); // 9020
    expect(zCharBehind).toBeLessThan(zFurn);

    // Karakter di (5, 6) - di depan furnitur
    const zCharInFront = calculateZIndex(5, 6, LAYER_OFFSETS.CHARACTER);
    expect(zCharInFront).toBe(11 * 1000 + 20); // 11020
    expect(zCharInFront).toBeGreaterThan(zFurn);
  });

  it('computes map world bounding box encompassing entire 44x32 grid', () => {
    const bounds = getMapWorldBounds(MAP_COLS, MAP_ROWS, WORLD_ORIGIN_X, WORLD_ORIGIN_Y);

    expect(bounds.width).toBeGreaterThanOrEqual(2400);
    expect(bounds.height).toBeGreaterThanOrEqual(1200);

    // Pastikan seluruh 4 sudut peta berada di dalam bounds
    const corners = [
      gridToScreen(0, 0, WORLD_ORIGIN_X, WORLD_ORIGIN_Y),
      gridToScreen(44, 0, WORLD_ORIGIN_X, WORLD_ORIGIN_Y),
      gridToScreen(0, 32, WORLD_ORIGIN_X, WORLD_ORIGIN_Y),
      gridToScreen(44, 32, WORLD_ORIGIN_X, WORLD_ORIGIN_Y),
    ];

    for (const c of corners) {
      expect(c.x).toBeGreaterThanOrEqual(bounds.minX);
      expect(c.x).toBeLessThanOrEqual(bounds.maxX);
      expect(c.y).toBeGreaterThanOrEqual(bounds.minY);
      expect(c.y).toBeLessThanOrEqual(bounds.maxY);
    }
  });
});
