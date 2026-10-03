/**
 * Utilitas Matematika Proyeksi Isometrik 2:1 (Dimetric) dan Depth Sorting.
 *
 * Sesuai konvensi blueprint (Bagian 2 & Bagian 4):
 * - Tile isometrik berdimensi 64x32 px.
 * - screenX = originX + (gx - gy) * 32
 * - screenY = originY + (gx + gy) * 16
 * - Depth sorting zIndex = (gx + gy) * 1000 + layerOffset dihitung dari titik kaki.
 */

export const TILE_WIDTH = 64;
export const TILE_HEIGHT = 32;
export const HALF_WIDTH = TILE_WIDTH / 2; // 32
export const HALF_HEIGHT = TILE_HEIGHT / 2; // 16

export const MAP_COLS = 44;
export const MAP_ROWS = 32;

// Offset origin peta dunia agar koordinat layar dunia selalu positif
export const WORLD_ORIGIN_X = 1088; // 34 * 32
export const WORLD_ORIGIN_Y = 64;   // 2 * 32
export const WORLD_WIDTH = 2560;
export const WORLD_HEIGHT = 1440;

export const LAYER_OFFSETS = {
  FLOOR: 0,
  BAKED_FURNITURE: 1,
  WALL_BACK: 5,
  FURNITURE: 10,
  CHARACTER: 20,
  WALL_FRONT: 30,
  DEBUG: 100,
} as const;

/**
 * Konversi koordinat grid (gx, gy) ke koordinat pixel dunia isometrik (x, y).
 */
export function gridToScreen(
  gx: number,
  gy: number,
  originX: number = WORLD_ORIGIN_X,
  originY: number = WORLD_ORIGIN_Y,
): { x: number; y: number } {
  const x = originX + (gx - gy) * HALF_WIDTH;
  const y = originY + (gx + gy) * HALF_HEIGHT;
  return { x, y };
}

/**
 * Konversi koordinat pixel dunia isometrik (x, y) kembali ke koordinat grid (gx, gy).
 */
export function screenToGrid(
  screenX: number,
  screenY: number,
  originX: number = WORLD_ORIGIN_X,
  originY: number = WORLD_ORIGIN_Y,
): { gx: number; gy: number } {
  const dx = (screenX - originX) / HALF_WIDTH;
  const dy = (screenY - originY) / HALF_HEIGHT;
  const gx = (dy + dx) / 2;
  const gy = (dy - dx) / 2;
  return { gx, gy };
}

/**
 * Menghitung nilai zIndex untuk depth sorting berbasis titik kaki entitas.
 * Formula: (gx + gy) * 1000 + layerOffset
 */
export function calculateZIndex(
  gx: number,
  gy: number,
  layerOffset: number = LAYER_OFFSETS.CHARACTER,
): number {
  return Math.round((gx + gy) * 1000) + layerOffset;
}

/**
 * Menghitung batas bounding box isometrik peta dalam pixel dunia.
 */
export function getMapWorldBounds(
  cols: number = MAP_COLS,
  rows: number = MAP_ROWS,
  originX: number = WORLD_ORIGIN_X,
  originY: number = WORLD_ORIGIN_Y,
): { minX: number; maxX: number; minY: number; maxY: number; width: number; height: number } {
  // 4 sudut grid: (0,0), (cols, 0), (0, rows), (cols, rows)
  const c0 = gridToScreen(0, 0, originX, originY);
  const c1 = gridToScreen(cols, 0, originX, originY);
  const c2 = gridToScreen(0, rows, originX, originY);
  const c3 = gridToScreen(cols, rows, originX, originY);

  const minX = Math.min(c0.x, c1.x, c2.x, c3.x) - HALF_WIDTH;
  const maxX = Math.max(c0.x, c1.x, c2.x, c3.x) + HALF_WIDTH;
  const minY = Math.min(c0.y, c1.y, c2.y, c3.y) - HALF_HEIGHT;
  const maxY = Math.max(c0.y, c1.y, c2.y, c3.y) + HALF_HEIGHT;

  return {
    minX,
    maxX,
    minY,
    maxY,
    width: maxX - minX,
    height: maxY - minY,
  };
}
