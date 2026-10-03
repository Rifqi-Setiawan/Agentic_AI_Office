#!/usr/bin/env node
/**
 * Texture atlas packer for isometric pixel-art sprites using free-tex-packer-core.
 * Packs raw character and furniture frames into a PixiJS-compatible spritesheet.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const require = createRequire(import.meta.url);

// Find free-tex-packer-core
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
  console.error('free-tex-packer-core not found! Please run `npm install --save-dev free-tex-packer-core` in frontend/');
  process.exit(1);
}

const inputDir = process.argv[2] ? path.resolve(process.argv[2]) : path.resolve(__dirname, 'dist/raw_sprites');
const outputDir = process.argv[3] ? path.resolve(process.argv[3]) : path.resolve(__dirname, 'dist');
const frontendSpritesDir = path.resolve(__dirname, '../../frontend/public/sprites');

if (!fs.existsSync(inputDir)) {
  console.error(`Input directory does not exist: ${inputDir}`);
  process.exit(1);
}

const files = fs.readdirSync(inputDir).filter(f => f.endsWith('.png')).sort();
if (files.length === 0) {
  console.error(`No PNG files found in ${inputDir}`);
  process.exit(1);
}

console.log(`Packing ${files.length} sprites from ${inputDir}...`);

const images = files.map(file => ({
  path: file,
  contents: fs.readFileSync(path.join(inputDir, file)),
}));

const options = {
  textureName: 'office_sprites',
  width: 512,
  height: 512,
  fixedSize: false,
  padding: 2,
  allowRotation: false,
  detectIdentical: true,
  allowTrim: false, // Maintain exact canvas dimensions and anchors
  exporter: 'Pixi',
  removeFileExtension: false,
};

texturePacker(images, options, (packedFiles, error) => {
  if (error) {
    console.error('Packing failed:', error);
    process.exit(1);
  }

  fs.mkdirSync(outputDir, { recursive: true });
  fs.mkdirSync(frontendSpritesDir, { recursive: true });

  for (const item of packedFiles) {
    const outPath = path.join(outputDir, item.name);
    fs.writeFileSync(outPath, item.buffer);
    console.log(`Saved: ${outPath} (${item.buffer.length} bytes)`);

    // Copy to frontend/public/sprites for Vite/PixiJS
    const fePath = path.join(frontendSpritesDir, item.name);
    fs.writeFileSync(fePath, item.buffer);
    console.log(`Copied to frontend: ${fePath}`);
  }

  console.log('Atlas packing completed successfully!');
});
