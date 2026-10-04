import { ColorMatrixFilter, Container, Sprite, type Texture } from 'pixi.js';
import type { TimeOfDay } from '../types/office';

// Multipliers preserve pixel-art edges; no blurred or full-screen decorative overlay.
export const ATMOSPHERE_RGB: Record<TimeOfDay, readonly [number, number, number]> = {
  day: [1, 1, 1], dawn: [.92, .84, .78], dusk: [1, .78, .60], night: [.52, .60, .82],
};

/** One shared scene filter, reused through a two-second transition. */
export class AtmosphereManager {
  readonly filter = new ColorMatrixFilter();
  private rgb = [1, 1, 1];
  private lights: { source: Sprite; glow: Sprite }[] = [];
  constructor(private world: Container, furniture?: Container, textureProvider?: (name: string) => Texture | null) {
    world.filters = [...(world.filters ?? []), this.filter];
    for (const source of [...(furniture?.children ?? [])]) {
      if (!(source instanceof Sprite) || !/monitor|arcade|lamp/.test(source.label)) continue;
      const texture = textureProvider?.(source.label.replace('.png', '_night.png'));
      if (!texture) continue;
      const glow = new Sprite(texture);
      glow.label = `AtmosphereLight_${source.label}`;
      glow.anchor.copyFrom(source.anchor);
      glow.position.copyFrom(source.position);
      glow.scale.copyFrom(source.scale);
      glow.zIndex = source.zIndex + 1;
      glow.blendMode = 'add';
      glow.alpha = 0;
      glow.visible = false;
      furniture!.addChild(glow);
      this.lights.push({ source, glow });
    }
  }
  update(dt: number, mode: TimeOfDay) {
    const target = ATMOSPHERE_RGB[mode];
    const step = Math.max(0, dt) / 2;
    for (let i = 0; i < 3; i++) {
      const difference = target[i] - this.rgb[i];
      this.rgb[i] += Math.sign(difference) * Math.min(Math.abs(difference), step);
    }
    // ColorMatrixFilter.matrix is mutable; avoid allocating a filter per frame.
    const matrix = this.filter.matrix;
    matrix[0] = this.rgb[0]; matrix[6] = this.rgb[1]; matrix[12] = this.rgb[2];
    this.filter.matrix = matrix;
    this.filter.enabled = this.rgb.some(channel => channel !== 1);
    const darkness = 1 - this.rgb[0];
    for (const { source, glow } of this.lights) {
      glow.renderable = source.renderable;
      glow.alpha = darkness * .65;
      glow.visible = glow.alpha > 0;
    }
  }
  destroy() {
    this.world.filters = (this.world.filters ?? []).filter(filter => filter !== this.filter);
    this.filter.destroy();
    for (const { glow } of this.lights) glow.destroy();
    this.lights = [];
  }
}
