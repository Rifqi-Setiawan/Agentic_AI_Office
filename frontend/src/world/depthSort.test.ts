import { describe, expect, it } from 'vitest';
import { Container, Sprite, Texture } from 'pixi.js';
import {
  applyFootprintDepth,
  isDrawnBehind,
  isLowFurniture,
  LOW_FURNITURE_SPRITES,
} from './depthSort';
import { LAYER_OFFSETS } from './projection';

describe('Depth Sorting & Acceptance Criterion 1 (Karakter Berjalan Memutari Meja)', () => {
  it('enforces Acceptance Criterion 1: Karakter uji yang berjalan memutari meja tidak pernah tergambar di urutan yang salah', () => {
    const stage = new Container({ sortableChildren: true });

    // Meja uji ditempatkan di grid (15, 15)
    const tableGx = 15;
    const tableGy = 15;
    const tableSprite = new Sprite(Texture.WHITE);
    tableSprite.label = 'Table_Test';
    applyFootprintDepth(tableSprite, tableGx, tableGy, LAYER_OFFSETS.FURNITURE);

    // Karakter uji
    const charSprite = new Sprite(Texture.WHITE);
    charSprite.label = 'Character_Test';

    stage.addChild(tableSprite);
    stage.addChild(charSprite);

    // 1. Uji posisi-posisi kunci di sekeliling meja:
    // (a) Di belakang meja (North-East): (15, 14) -> gx + gy = 29 < 30
    applyFootprintDepth(charSprite, 15, 14, LAYER_OFFSETS.CHARACTER);
    expect(isDrawnBehind(stage, charSprite, tableSprite)).toBe(true);

    // (b) Di belakang meja (North-West): (14, 15) -> gx + gy = 29 < 30
    applyFootprintDepth(charSprite, 14, 15, LAYER_OFFSETS.CHARACTER);
    expect(isDrawnBehind(stage, charSprite, tableSprite)).toBe(true);

    // (c) Di sudut belakang meja: (14, 14) -> gx + gy = 28 < 30
    applyFootprintDepth(charSprite, 14, 14, LAYER_OFFSETS.CHARACTER);
    expect(isDrawnBehind(stage, charSprite, tableSprite)).toBe(true);

    // (d) Di depan meja (South-East): (16, 15) -> gx + gy = 31 > 30
    applyFootprintDepth(charSprite, 16, 15, LAYER_OFFSETS.CHARACTER);
    expect(isDrawnBehind(stage, charSprite, tableSprite)).toBe(false);

    // (e) Di depan meja (South-West): (15, 16) -> gx + gy = 31 > 30
    applyFootprintDepth(charSprite, 15, 16, LAYER_OFFSETS.CHARACTER);
    expect(isDrawnBehind(stage, charSprite, tableSprite)).toBe(false);

    // (f) Di sudut depan meja: (16, 16) -> gx + gy = 32 > 30
    applyFootprintDepth(charSprite, 16, 16, LAYER_OFFSETS.CHARACTER);
    expect(isDrawnBehind(stage, charSprite, tableSprite)).toBe(false);

    // 2. Uji simulasi lintasan lingkaran penuh (360 derajat mengelilingi meja)
    // 36 langkah pengujian di radius R = 1.6 tile
    const radius = 1.6;
    const stepsCount = 36;
    const tableFootDepth = tableGx + tableGy;

    for (let step = 0; step < stepsCount; step++) {
      const angle = (step / stepsCount) * 2 * Math.PI;
      const charGx = tableGx + radius * Math.cos(angle);
      const charGy = tableGy + radius * Math.sin(angle);
      const charFootDepth = charGx + charGy;

      applyFootprintDepth(charSprite, charGx, charGy, LAYER_OFFSETS.CHARACTER);
      const drawnBehind = isDrawnBehind(stage, charSprite, tableSprite);

      // Jika karakter berada di sisi belakang (charFootDepth < tableFootDepth),
      // karakter HARUS digambar di belakang meja (drawnBehind = true).
      // Jika berada di sisi depan (charFootDepth > tableFootDepth),
      // karakter HARUS digambar di depan meja (drawnBehind = false).
      if (charFootDepth < tableFootDepth - 0.05) {
        expect(
          drawnBehind,
          `Karakter di (${charGx.toFixed(2)}, ${charGy.toFixed(2)}) sudut ${(angle * 180 / Math.PI).toFixed(0)}° salah urutan! Harusnya di belakang meja.`,
        ).toBe(true);
      } else if (charFootDepth > tableFootDepth + 0.05) {
        expect(
          drawnBehind,
          `Karakter di (${charGx.toFixed(2)}, ${charGy.toFixed(2)}) sudut ${(angle * 180 / Math.PI).toFixed(0)}° salah urutan! Harusnya di depan meja.`,
        ).toBe(false);
      }
    }
  });

  it('bakes low furniture into floor layer so characters always render above them', () => {
    expect(LOW_FURNITURE_SPRITES.has('furniture_prayer_rug_shaf.png')).toBe(true);
    expect(LOW_FURNITURE_SPRITES.has('furniture_ground_shadow.png')).toBe(true);
    expect(LOW_FURNITURE_SPRITES.has('furniture_pool_water.png')).toBe(true);

    expect(isLowFurniture('furniture_prayer_rug_shaf.png')).toBe(true);
    expect(isLowFurniture('furniture_boardroom_table.png')).toBe(false);
    expect(isLowFurniture('furniture_server_rack.png')).toBe(false);

    // Karakter yang berjalan di atas karpet sholat selalu ter-render di atas karpet
    const container = new Container({ sortableChildren: true });
    const rug = new Sprite(Texture.WHITE);
    rug.label = 'Rug';
    applyFootprintDepth(rug, 10, 10, LAYER_OFFSETS.BAKED_FURNITURE);

    const char = new Sprite(Texture.WHITE);
    char.label = 'Agent_Praying';
    applyFootprintDepth(char, 10, 10, LAYER_OFFSETS.CHARACTER);

    container.addChild(rug);
    container.addChild(char);

    // Karpet digambar duluan (di belakang), karakter digambar di atasnya
    expect(isDrawnBehind(container, rug, char)).toBe(true);
  });
});
