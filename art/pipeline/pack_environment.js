#!/usr/bin/env node
/**
 * Texture atlas packer for environment sprites (tiles, walls, furniture) using free-tex-packer-core.
 * Generates PixiJS-compatible spritesheet in WebP format and JSON manifest.
 * Enforces acceptance criterion: Total atlas lingkungan <= 2.5 MB (WebP).
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const require = createRequire(import.meta.url);

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
  console.error('free-tex-packer-core not found! Please run npm install in frontend/');
  process.exit(1);
}

const inputDir = process.argv[2] ? path.resolve(process.argv[2]) : path.resolve(__dirname, 'dist/raw_environment');
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

console.log(`Found ${files.length} environment sprites to pack from ${inputDir}`);

const images = files.map(file => ({
  path: file,
  contents: fs.readFileSync(path.join(inputDir, file)),
}));

// Base packing configuration
const baseOptions = {
  textureName: 'environment',
  width: 2048,
  height: 2048,
  fixedSize: false,
  padding: 2,
  allowRotation: false,
  detectIdentical: true,
  allowTrim: false, // Maintain exact anchors and tile bounds
  exporter: 'Pixi',
  removeFileExtension: false,
};

fs.mkdirSync(outputDir, { recursive: true });
fs.mkdirSync(frontendSpritesDir, { recursive: true });

function packFormat(format, callback) {
  const options = {
    ...baseOptions,
    textureFormat: format,
  };

  texturePacker(images, options, (packedFiles, error) => {
    if (error) {
      console.error(`Packing failed for format ${format}:`, error);
      return callback(error);
    }

    for (const item of packedFiles) {
      const outPath = path.join(outputDir, item.name);
      fs.writeFileSync(outPath, item.buffer);
      console.log(`Saved (${format}): ${outPath} (${(item.buffer.length / 1024).toFixed(1)} KB)`);

      const fePath = path.join(frontendSpritesDir, item.name);
      fs.writeFileSync(fePath, item.buffer);
      console.log(`Copied to frontend: ${fePath}`);
    }
    callback(null, packedFiles);
  });
}

// 1. Pack PNG companion first
packFormat('png', (pngErr) => {
  if (pngErr) {
    console.warn('Warning: PNG companion packing failed:', pngErr);
  }

  // 2. Pack WebP (Primary spec deliverable: <= 2.5 MB)
  packFormat('webp', (err, webpFiles) => {
    if (err) process.exit(1);

    const webpBuffer = webpFiles.find(f => f.name.endsWith('.webp'))?.buffer;
    const webpSize = webpBuffer ? webpBuffer.length : 0;
    const webpSizeMB = webpSize / (1024 * 1024);

    console.log(`\n========================================`);
    console.log(`WebP Environment Atlas Size: ${(webpSize / 1024).toFixed(2)} KB (${webpSizeMB.toFixed(3)} MB)`);
    console.log(`Acceptance Cap: 2.50 MB (2,621,440 bytes)`);

    if (webpSizeMB <= 2.5) {
      console.log(`[PASS] WebP Atlas size is strictly <= 2.5 MB!`);
    } else {
      console.error(`[FAIL] WebP Atlas size exceeded 2.5 MB cap! (${webpSizeMB.toFixed(3)} MB)`);
      process.exit(1);
    }
    console.log(`========================================\n`);
    console.log('Environment atlas packing complete!');
  });
});
