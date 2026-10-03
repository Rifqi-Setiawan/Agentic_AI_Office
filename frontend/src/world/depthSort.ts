import { Container, Sprite } from 'pixi.js';
import { calculateZIndex, LAYER_OFFSETS } from './projection';

/**
 * Daftar sprite furnitur rendah yang di-bake ke layer lantai (lantai/karpet/air).
 * Furnitur ini tidak memblokir karakter dan selalu berada di bawah entitas dinamis.
 */
export const LOW_FURNITURE_SPRITES = new Set<string>([
  'furniture_prayer_rug_shaf.png',
  'furniture_ground_shadow.png',
  'furniture_pool_basin.png',
  'furniture_pool_water.png',
  'furniture_pool_coping.png',
]);

/**
 * Memeriksa apakah sprite tertentu tergolong furnitur rendah yang harus di-bake ke layer lantai.
 */
export function isLowFurniture(spriteName: string): boolean {
  return LOW_FURNITURE_SPRITES.has(spriteName);
}

/**
 * Mengatur zIndex pada sprite berdasarkan koordinat grid titik kaki (gx, gy).
 * zIndex = (gx + gy) * 1000 + layerOffset
 */
export function applyFootprintDepth(
  target: Container | Sprite,
  gx: number,
  gy: number,
  layerOffset: number = LAYER_OFFSETS.CHARACTER,
): void {
  target.zIndex = calculateZIndex(gx, gy, layerOffset);
}

/**
 * Memeriksa relasi urutan depth sort antara dua entitas dalam satu kontainer.
 * Mengembalikan true jika entityA digambar sebelum entityB (artinya entityA berada di belakang entityB).
 */
export function isDrawnBehind(
  container: Container,
  entityA: Container | Sprite,
  entityB: Container | Sprite,
): boolean {
  container.sortChildren();
  const indexA = container.children.indexOf(entityA);
  const indexB = container.children.indexOf(entityB);
  if (indexA === -1 || indexB === -1) {
    throw new Error('Kedua entitas harus menjadi child dari kontainer yang sama untuk perbandingan depth');
  }
  return indexA < indexB;
}
