import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

describe('T0.4 Isometric Sprite Pipeline & Atlas Verification', () => {
  const jsonPath = path.resolve(__dirname, '../public/sprites/office_sprites.json');
  const pngPath = path.resolve(__dirname, '../public/sprites/office_sprites.png');
  const palettePath = path.resolve(__dirname, '../../art/pipeline/palette.json');
  const metricsPath = path.resolve(__dirname, '../../art/pipeline/dist/render_metrics.json');

  it('generates a valid PixiJS spritesheet JSON and atlas PNG', () => {
    expect(fs.existsSync(jsonPath)).toBe(true);
    expect(fs.existsSync(pngPath)).toBe(true);

    const raw = fs.readFileSync(jsonPath, 'utf-8');
    const atlas = JSON.parse(raw);

    expect(atlas.meta).toBeDefined();
    expect(atlas.meta.image).toBe('office_sprites.png');
    expect(atlas.meta.format).toBe('RGBA8888');
    expect(atlas.meta.scale).toBe(1);

    const frameNames = Object.keys(atlas.frames);
    expect(frameNames.length).toBeGreaterThanOrEqual(23);

    // Verify 3 Kenney furniture items
    expect(frameNames).toContain('furniture_desk.png');
    expect(frameNames).toContain('furniture_chair.png');
    expect(frameNames).toContain('furniture_screen.png');

    // Verify Bastion animations
    for (let i = 0; i < 6; i++) {
      expect(frameNames).toContain(`bastion_walk_se_${i}.png`);
      expect(frameNames).toContain(`bastion_walk_ne_${i}.png`);
    }
    for (let i = 0; i < 4; i++) {
      expect(frameNames).toContain(`bastion_idle_se_${i}.png`);
      expect(frameNames).toContain(`bastion_idle_ne_${i}.png`);
    }
  });

  it('validates 32-color master temporary palette', () => {
    expect(fs.existsSync(palettePath)).toBe(true);
    const palette = JSON.parse(fs.readFileSync(palettePath, 'utf-8'));
    expect(palette.colors).toBeDefined();
    expect(palette.colors.length).toBe(32);

    // Verify signature colors
    const hexColors = palette.colors.map((c: { hex: string }) => c.hex.toLowerCase());
    expect(hexColors).toContain('#6b7785'); // Bastion Signature Slate
    expect(hexColors).toContain('#14141e'); // Outline Charcoal
    expect(hexColors).toContain('#00f0ff'); // Helmet LED Glow
  });

  it('records render benchmarks and timing metrics', () => {
    expect(fs.existsSync(metricsPath)).toBe(true);
    const metrics = JSON.parse(fs.readFileSync(metricsPath, 'utf-8'));
    expect(metrics.total_character_time_seconds).toBeGreaterThan(0);
    expect(metrics.total_furniture_time_seconds).toBeGreaterThan(0);
    expect(metrics.samples_per_pixel).toBe(16);
  });
});
