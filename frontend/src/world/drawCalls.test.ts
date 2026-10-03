import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { Container, Sprite, Texture } from 'pixi.js';
import { OfficeMapLoader } from './mapLoader';
import { TiledMapDoc } from './types';

describe('Draw Calls & Acceptance Criterion 2 (< 30 draw call pada zoom 1x)', () => {
  const mapPath = path.resolve(__dirname, '../../public/maps/floor1.tmj');
  const envJsonPath = path.resolve(__dirname, '../../public/sprites/environment.json');

  const rawMap = fs.readFileSync(mapPath, 'utf-8');
  const mapDoc = JSON.parse(rawMap) as TiledMapDoc;
  const envAtlas = JSON.parse(fs.readFileSync(envJsonPath, 'utf-8'));

  it('verifies that all environment sprites (floor, walls, furniture) originate from a single shared texture atlas', () => {
    // Atlas environment memaketkan seluruh aset lingkungan dalam satu file texture (environment.webp)
    expect(envAtlas.meta.image).toBe('environment.webp');

    const totalFrames = Object.keys(envAtlas.frames).length;
    expect(totalFrames).toBeGreaterThanOrEqual(120);

    // Kumpulkan seluruh frame unik yang digunakan oleh layer peta
    const usedFrames = new Set<string>();
    for (const ts of mapDoc.tilesets) {
      if (ts.tiles) {
        for (const t of ts.tiles) {
          const spriteProp = t.properties?.find((p) => p.name === 'sprite');
          if (spriteProp && typeof spriteProp.value === 'string') {
            usedFrames.add(spriteProp.value);
          }
        }
      }
    }

    // Pastikan setiap frame yang digunakan peta ada di dalam atlas tunggal environment
    for (const frame of usedFrames) {
      expect(
        envAtlas.frames[frame],
        `Sprite ${frame} harus ada di dalam atlas environment.webp`,
      ).toBeDefined();
    }
  });

  it('enforces Acceptance Criterion 2: < 30 draw call di seluruh peta pada zoom 1x', () => {
    // Buat texture atlas tiruan (mock BaseTexture tunggal untuk seluruh tile environment)
    const mockEnvBaseTexture = { uid: 'env_atlas_base_texture' };
    const mockCharBaseTextures = new Map<string, { uid: string }>();

    const AGENTS = [
      'jarvis', 'daedalus', 'oracle', 'merlin', 'muse', 'prism', 'forge', 'vector',
      'sentinel', 'bastion', 'relay', 'warden', 'steward', 'scribe', 'nova', 'rifqi',
    ];

    for (const agent of AGENTS) {
      mockCharBaseTextures.set(agent, { uid: `char_texture_${agent}` });
    }

    const textureProvider = (frameName: string): Texture => {
      return {
        label: frameName,
        source: mockEnvBaseTexture,
      } as unknown as Texture;
    };

    const loadedMap = OfficeMapLoader.loadFromDoc(mapDoc, { textureProvider });

    // Tambahkan 16 karakter agen ke mejanya masing-masing
    const agentDesks = [
      { agent: 'jarvis', gx: 5, gy: 3 },
      { agent: 'daedalus', gx: 23, gy: 4 },
      { agent: 'oracle', gx: 4, gy: 14 },
      { agent: 'merlin', gx: 31, gy: 4 },
      { agent: 'muse', gx: 12, gy: 14 },
      { agent: 'prism', gx: 18, gy: 13 },
      { agent: 'forge', gx: 20, gy: 14 },
      { agent: 'vector', gx: 39, gy: 13 },
      { agent: 'sentinel', gx: 30, gy: 14 },
      { agent: 'bastion', gx: 41, gy: 15 },
      { agent: 'relay', gx: 34, gy: 14 },
      { agent: 'warden', gx: 5, gy: 26 },
      { agent: 'steward', gx: 26, gy: 14 },
      { agent: 'scribe', gx: 39, gy: 4 },
      { agent: 'nova', gx: 19, gy: 16 },
      { agent: 'rifqi', gx: 15, gy: 26 },
    ];

    for (const d of agentDesks) {
      const charSprite = new Sprite();
      charSprite.label = `char_${d.agent}`;
      (charSprite as unknown as { texture: Texture }).texture = {
        label: `tex_${d.agent}`,
        source: mockCharBaseTextures.get(d.agent),
      } as unknown as Texture;
      loadedMap.addDynamicEntity(charSprite, d.gx, d.gy);
    }

    // Hitung jumlah draw call menggunakan model WebGL2 Multi-Texture Batch Renderer PixiJS v8
    // PixiJS v8 mengikat hingga 16 unit sampler tekstur simultan per draw call (MAX_TEXTURES_PER_BATCH = 16)
    // dan hingga 2048 quad per batch buffer.
    const MAX_TEXTURES_PER_BATCH = 16;
    const MAX_QUADS_PER_BATCH = 2048;

    let drawCalls = 0;
    const currentBatchTextures = new Set<unknown>();
    let quadsInCurrentBatch = 0;

    const flushBatch = () => {
      if (quadsInCurrentBatch > 0) {
        drawCalls++;
        currentBatchTextures.clear();
        quadsInCurrentBatch = 0;
      }
    };

    const renderVisitor = (container: Container) => {
      // Sort children jika sortable
      if (container.sortableChildren) {
        container.sortChildren();
      }

      for (const child of container.children) {
        if (!child.visible || child.renderable === false) continue;

        const maybeSprite = child as unknown as { texture?: { source?: unknown } };
        if (maybeSprite.texture && maybeSprite.texture.source) {
          const baseTex = maybeSprite.texture.source;

          // Jika tekstur baru belum ada di batch saat ini dan kapasitas sampler penuh (16 unit)
          const needsNewTextureSlot = !currentBatchTextures.has(baseTex);
          if (
            (needsNewTextureSlot && currentBatchTextures.size >= MAX_TEXTURES_PER_BATCH) ||
            quadsInCurrentBatch >= MAX_QUADS_PER_BATCH
          ) {
            flushBatch();
          }

          currentBatchTextures.add(baseTex);
          quadsInCurrentBatch++;
        } else if (child.children && child.children.length > 0) {
          renderVisitor(child);
        }
      }
    };

    renderVisitor(loadedMap.worldRoot);
    flushBatch();

    console.info(
      `[DrawCallTest] Total draw call terhitung di seluruh peta pada zoom 1x: ${drawCalls} (Batas kriteria: < 30)`,
    );

    // Kriteria Penerimaan: < 30 draw call di seluruh peta pada zoom 1x
    expect(drawCalls).toBeLessThan(30);
    expect(drawCalls).toBeGreaterThan(0);
  });
});
