import { describe, it, expect, vi } from 'vitest';
import { Container, Sprite, Texture, ColorMatrixFilter } from 'pixi.js';
import { AtmosphereManager } from './AtmosphereManager';

// Node has no WebGL context; the real ColorMatrixFilter is exercised in production E2E.
vi.mock('pixi.js', async importOriginal => ({
  ...await importOriginal<typeof import('pixi.js')>(),
  ColorMatrixFilter: class {
    matrix = [1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0];
    destroy() {}
  },
}));

describe('Atmosfer scene', () => {
  it('transitions to night, adds source-aligned light and restores day without leaking filters', () => {
    const world = new Container();
    const furniture = new Container();
    world.addChild(furniture);
    const monitor = new Sprite(Texture.WHITE);
    monitor.label = 'furniture_large_monitor_preview.png';
    monitor.position.set(55, 66);
    furniture.addChild(monitor);
    const manager = new AtmosphereManager(world, furniture, () => Texture.WHITE);
    expect(world.filters?.[0]).toBeInstanceOf(ColorMatrixFilter);
    manager.update(.2, 'night');
    expect(manager.filter.matrix[0]).toBeGreaterThan(.52);
    manager.update(2, 'night');
    expect([manager.filter.matrix[0], manager.filter.matrix[6], manager.filter.matrix[12]]).toEqual([.52, .6, .82]);
    const glow = furniture.children[1];
    expect([glow.x, glow.y]).toEqual([55, 66]);
    expect(glow.alpha).toBeGreaterThan(0);
    expect(manager.filter.enabled).toBe(true);
    monitor.renderable = false;
    manager.update(.1, 'night');
    expect(glow.renderable).toBe(false);
    manager.update(2, 'day');
    expect([manager.filter.matrix[0], manager.filter.matrix[6], manager.filter.matrix[12]]).toEqual([1, 1, 1]);
    expect(glow.alpha).toBe(0);
    expect(manager.filter.enabled).toBe(false);
    expect(glow.visible).toBe(false);
    manager.destroy();
    expect(world.filters).toEqual([]);
    expect(furniture.children).toEqual([monitor]);
    world.destroy({ children: true });
  });
});
