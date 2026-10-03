import { describe, expect, it } from 'vitest';
import { Sprite, Texture } from 'pixi.js';
import { CullingManager } from './culling';

describe('Culling Sprite di Luar Layar', () => {
  it('culls sprites outside of the viewport visible bounds', () => {
    const culler = new CullingManager(64);

    // Sprite 1 di dalam viewport (posisi 500, 300)
    const inViewSprite = new Sprite(Texture.WHITE);
    inViewSprite.x = 500;
    inViewSprite.y = 300;
    inViewSprite.width = 64;
    inViewSprite.height = 64;

    // Sprite 2 jauh di luar viewport (posisi 3000, 2000)
    const outViewSprite = new Sprite(Texture.WHITE);
    outViewSprite.x = 3000;
    outViewSprite.y = 2000;
    outViewSprite.width = 64;
    outViewSprite.height = 64;

    culler.register(inViewSprite);
    culler.register(outViewSprite);

    expect(culler.size()).toBe(2);

    // Viewport bounds: x: 0..1000, y: 0..600
    const stats = culler.update({ x: 0, y: 0, width: 1000, height: 600 });

    expect(stats.total).toBe(2);
    expect(stats.visible).toBe(1);
    expect(stats.culled).toBe(1);

    expect(inViewSprite.renderable).toBe(true);
    expect(outViewSprite.renderable).toBe(false);
  });

  it('respects safety margin to prevent sprite pop-in at viewport borders', () => {
    const culler = new CullingManager(64);

    // Sprite tepat di luar viewport border (x: 1020, batas viewport width: 1000)
    // Berada dalam batas margin 64px (1000 + 64 = 1064)
    const borderSprite = new Sprite(Texture.WHITE);
    borderSprite.x = 1020;
    borderSprite.y = 300;
    borderSprite.width = 64;
    borderSprite.height = 64;

    culler.register(borderSprite);

    const stats = culler.update({ x: 0, y: 0, width: 1000, height: 600 });
    expect(borderSprite.renderable).toBe(true);
    expect(stats.visible).toBe(1);
  });

  it('updates culling dynamically when camera moves', () => {
    const culler = new CullingManager(64);

    const sprite = new Sprite(Texture.WHITE);
    sprite.x = 2500;
    sprite.y = 1500;
    sprite.width = 64;
    sprite.height = 64;

    culler.register(sprite);

    // Posisi awal kamera di (0, 0): sprite culled
    culler.update({ x: 0, y: 0, width: 800, height: 600 });
    expect(sprite.renderable).toBe(false);

    // Kamera bergeser ke area sprite (x: 2200, y: 1200): sprite kini visible
    culler.update({ x: 2200, y: 1200, width: 800, height: 600 });
    expect(sprite.renderable).toBe(true);
  });
});
