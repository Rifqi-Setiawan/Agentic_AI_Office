import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

describe('T1.6 16-Character Sprite Production & Paper-Doll Atlas Verification', () => {
  const charsDir = path.resolve(__dirname, '../public/sprites/characters');
  const distDir = path.resolve(__dirname, '../../art/pipeline/dist');
  const palettePath = path.resolve(__dirname, '../../art/pipeline/palette.json');

  const EXPECTED_CHARACTERS = [
    { id: 'jarvis', name: 'Jarvis', base: 'A', sig: '#1f3a68' },
    { id: 'daedalus', name: 'Daedalus', base: 'B', sig: '#2f6fb3' },
    { id: 'oracle', name: 'Oracle', base: 'A', sig: '#8a4fbf' },
    { id: 'merlin', name: 'Merlin', base: 'A', sig: '#b5652b' },
    { id: 'muse', name: 'Muse', base: 'B', sig: '#e0567a' },
    { id: 'prism', name: 'Prism', base: 'A', sig: '#2bb3c0' },
    { id: 'forge', name: 'Forge', base: 'C', sig: '#d9622b' },
    { id: 'vector', name: 'Vector', base: 'B', sig: '#3fa66b' },
    { id: 'sentinel', name: 'Sentinel', base: 'A', sig: '#d23c3c' },
    { id: 'bastion', name: 'Bastion', base: 'C', sig: '#6b7785' },
    { id: 'relay', name: 'Relay', base: 'A', sig: '#6d5bd0' },
    { id: 'warden', name: 'Warden', base: 'A', sig: '#8e8e3a' },
    { id: 'steward', name: 'Steward', base: 'A', sig: '#9cc23a' },
    { id: 'scribe', name: 'Scribe', base: 'B', sig: '#7a4a2e' },
    { id: 'nova', name: 'Nova', base: 'B', sig: '#f2c230' },
    { id: 'rifqi', name: 'Rifqi', base: 'A', sig: '#f5f0e1' },
    { id: 'guest', name: 'Tamu', base: 'A', sig: '#9ca8b8' },
  ];

  it('contains exactly 17 sprite sheets (16 agents + 1 guest) in atlas format', () => {
    expect(fs.existsSync(charsDir)).toBe(true);

    for (const char of EXPECTED_CHARACTERS) {
      const pngPath = path.join(charsDir, `${char.id}.png`);
      const jsonPath = path.join(charsDir, `${char.id}.json`);

      expect(fs.existsSync(pngPath), `Missing ${char.id}.png`).toBe(true);
      expect(fs.existsSync(jsonPath), `Missing ${char.id}.json`).toBe(true);

      const jsonRaw = fs.readFileSync(jsonPath, 'utf-8');
      const atlas = JSON.parse(jsonRaw);
      expect(atlas.meta).toBeDefined();
      expect(atlas.meta.image).toBe(`${char.id}.png`);
      expect(atlas.frames).toBeDefined();
    }
  });

  it('verifies that each of the 17 character sprite sheets is <= 256 KB', () => {
    const MAX_BYTES = 256 * 1024; // 256 KB

    for (const char of EXPECTED_CHARACTERS) {
      const pngPath = path.join(charsDir, `${char.id}.png`);
      const stat = fs.statSync(pngPath);
      const sizeKb = (stat.size / 1024).toFixed(2);

      expect(
        stat.size,
        `Character ${char.id}.png (${sizeKb} KB) exceeds 256 KB budget!`
      ).toBeLessThanOrEqual(MAX_BYTES);
    }
  });

  it('verifies all required V1 animation states and directions for every character', () => {
    const DIRECTIONS = ['se', 'ne'];
    const REQUIRED_ANIM_SETS = [
      { name: 'idle', count: 4 },
      { name: 'walk', count: 6 },
      { name: 'sit_type', count: 2 },
      { name: 'stand_talk', count: 2 },
      { name: 'celebrate', count: 2 },
      { name: 'pray_berdiri', count: 2 },
      { name: 'pray_rukuk', count: 2 },
      { name: 'pray_sujud', count: 2 },
      { name: 'pray_duduk', count: 2 },
      { name: 'pray', count: 4 }, // Aliased sequence (0=berdiri, 1=rukuk, 2=sujud, 3=duduk)
      { name: 'drink', count: 2 },
    ];

    for (const char of EXPECTED_CHARACTERS) {
      const jsonPath = path.join(charsDir, `${char.id}.json`);
      const atlas = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));
      const frameKeys = Object.keys(atlas.frames);

      for (const dir of DIRECTIONS) {
        for (const anim of REQUIRED_ANIM_SETS) {
          for (let f = 0; f < anim.count; f++) {
            const expectedFrameName = `${char.id}_${anim.name}_${dir}_${f}.png`;
            expect(
              frameKeys,
              `Missing frame ${expectedFrameName} in ${char.id}.json`
            ).toContain(expectedFrameName);
          }
        }
      }
    }
  });

  it('verifies silhouette review artifacts and HTML report exist for Muse review', () => {
    const sil1x = path.join(distDir, 'silhouette_test_1x.png');
    const sil2x = path.join(distDir, 'silhouette_test_2x.png');
    const reportHtml = path.join(distDir, 'silhouette_review.html');
    const docReport = path.resolve(__dirname, '../../docs/silhouette_review.html');

    expect(fs.existsSync(sil1x), 'Missing silhouette_test_1x.png').toBe(true);
    expect(fs.existsSync(sil2x), 'Missing silhouette_test_2x.png').toBe(true);
    expect(fs.existsSync(reportHtml), 'Missing silhouette_review.html in dist').toBe(true);
    expect(fs.existsSync(docReport), 'Missing silhouette_review.html in docs').toBe(true);

    const htmlContent = fs.readFileSync(reportHtml, 'utf-8');
    expect(htmlContent).toContain('Muse Review Gate');
    for (const char of EXPECTED_CHARACTERS) {
      expect(htmlContent).toContain(char.name);
    }
  });

  it('validates 32-color master palette compliance', () => {
    expect(fs.existsSync(palettePath)).toBe(true);
    const pal = JSON.parse(fs.readFileSync(palettePath, 'utf-8'));
    expect(pal.colors.length).toBe(32);
    const hexList = pal.colors.map((c: { hex: string }) => c.hex.toLowerCase());

    for (const char of EXPECTED_CHARACTERS) {
      expect(hexList).toContain(char.sig.toLowerCase());
    }
  });
});
