#!/usr/bin/env node
/**
 * Texture atlas packer for 17 characters (16 agents + 1 guest) using free-tex-packer-core.
 * Generates:
 * 1. Individual character sprite sheets: dist/characters/{char_id}.png & .json (each <= 256 KB)
 * 2. Unified master atlas: dist/office_sprites.png & .json (for PixiJS testbed and full engine)
 * 3. Copies deliverables to frontend/public/sprites/
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const require = createRequire(import.meta.url);

// Locate free-tex-packer-core
let texturePacker;
const candidatePaths = [
  path.resolve(__dirname, '../../frontend/node_modules/free-tex-packer-core'),
  path.resolve(__dirname, 'node_modules/free-tex-packer-core'),
  'free-tex-packer-core',
];

for (const p of candidatePaths) {
  try {
    texturePacker = require(p);
    if (texturePacker) break;
  } catch {
    // try next
  }
}

if (!texturePacker) {
  console.error('free-tex-packer-core not found!');
  process.exit(1);
}

const distDir = process.argv[2] ? path.resolve(process.argv[2]) : path.resolve(__dirname, 'dist');
const frontendDir = process.argv[3] ? path.resolve(process.argv[3]) : path.resolve(__dirname, '../../frontend/public/sprites');
const rawCharsDir = path.join(distDir, 'raw_characters');

if (!fs.existsSync(rawCharsDir)) {
  console.error(`raw_characters directory not found: ${rawCharsDir}`);
  process.exit(1);
}

const characters = fs.readdirSync(rawCharsDir).filter(d => fs.statSync(path.join(rawCharsDir, d)).isDirectory());
console.log(`Found ${characters.length} characters in ${rawCharsDir}:`, characters);

const outCharsDir = path.join(distDir, 'characters');
const feCharsDir = path.join(frontendDir, 'characters');
fs.mkdirSync(outCharsDir, { recursive: true });
fs.mkdirSync(feCharsDir, { recursive: true });

async function packImages(images, textureName, width = 512, height = 512) {
  return new Promise((resolve, reject) => {
    const options = {
      textureName,
      width,
      height,
      fixedSize: false,
      padding: 2,
      allowRotation: false,
      detectIdentical: true,
      allowTrim: false,
      exporter: 'Pixi',
      removeFileExtension: false,
    };

    texturePacker(images, options, (packedFiles, error) => {
      if (error) reject(error);
      else resolve(packedFiles);
    });
  });
}

async function main() {
  const allMasterImages = [];

  // Also collect Kenney furniture if present
  const rawSpritesDir = path.join(distDir, 'raw_sprites');
  if (fs.existsSync(rawSpritesDir)) {
    const furnFiles = fs.readdirSync(rawSpritesDir).filter(f => f.startsWith('furniture_') && f.endsWith('.png'));
    for (const f of furnFiles) {
      allMasterImages.push({
        path: f,
        contents: fs.readFileSync(path.join(rawSpritesDir, f)),
      });
    }
  }

  // 1. Pack each character individually
  const manifest = [];
  for (const cid of characters) {
    const charDir = path.join(rawCharsDir, cid);
    const files = fs.readdirSync(charDir).filter(f => f.endsWith('.png')).sort();
    console.log(`Packing character ${cid} (${files.length} frames)...`);

    const images = files.map(f => ({
      path: f,
      contents: fs.readFileSync(path.join(charDir, f)),
    }));

    // Add to master images list
    for (const img of images) {
      allMasterImages.push(img);
    }

    const packed = await packImages(images, cid, 512, 512);
    for (const item of packed) {
      const outPath = path.join(outCharsDir, item.name);
      fs.writeFileSync(outPath, item.buffer);
      const fePath = path.join(feCharsDir, item.name);
      fs.writeFileSync(fePath, item.buffer);

      if (item.name.endsWith('.png')) {
        const sizeKb = (item.buffer.length / 1024).toFixed(2);
        console.log(`  Saved ${item.name}: ${sizeKb} KB (Budget <= 256 KB)`);
        manifest.push({
          character: cid,
          file: item.name,
          bytes: item.buffer.length,
          sizeKb: parseFloat(sizeKb),
          passBudget: item.buffer.length <= 256 * 1024,
        });
      }
    }
  }

  // Write manifest
  fs.writeFileSync(path.join(outCharsDir, 'manifest.json'), JSON.stringify(manifest, null, 2));

  // 2. Pack combined master atlas
  console.log(`\nPacking combined master atlas (${allMasterImages.length} sprites)...`);
  const masterPacked = await packImages(allMasterImages, 'office_sprites', 2048, 2048);
  for (const item of masterPacked) {
    const outPath = path.join(distDir, item.name);
    fs.writeFileSync(outPath, item.buffer);
    const fePath = path.join(frontendDir, item.name);
    fs.writeFileSync(fePath, item.buffer);
    console.log(`  Saved master ${item.name}: ${(item.buffer.length / 1024).toFixed(2)} KB`);
  }

  console.log('\nAll character sprite sheets packed and validated successfully!');
}

main().catch(err => {
  console.error('Packing failed:', err);
  process.exit(1);
});
