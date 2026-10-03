import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { execSync } from 'node:child_process';

describe('Bundle Size Acceptance Criterion', () => {
  const distDir = path.resolve(__dirname, '../dist');
  const assetsDir = path.resolve(distDir, 'assets');

  it('ensures initial JS bundle size <= 400 KB gzip', () => {
    if (!fs.existsSync(assetsDir)) {
      execSync('npm run build', { cwd: path.resolve(__dirname, '..'), stdio: 'pipe' });
    }

    expect(fs.existsSync(distDir), 'Direktori dist harus sudah di-build').toBe(true);
    expect(fs.existsSync(assetsDir), 'Direktori dist/assets harus ada').toBe(true);

    const assetFiles = fs.readdirSync(assetsDir);
    const jsFiles = assetFiles.filter((f) => f.endsWith('.js') && !f.endsWith('.map'));

    expect(jsFiles.length).toBeGreaterThan(0);

    let totalJsRawBytes = 0;
    let totalJsGzipBytes = 0;
    const chunkReport: Array<{ file: string; rawKb: number; gzipKb: number }> = [];

    for (const file of jsFiles) {
      const filePath = path.join(assetsDir, file);
      const content = fs.readFileSync(filePath);
      const gzipped = zlib.gzipSync(content, { level: 9 });

      totalJsRawBytes += content.length;
      totalJsGzipBytes += gzipped.length;

      chunkReport.push({
        file,
        rawKb: Math.round((content.length / 1024) * 100) / 100,
        gzipKb: Math.round((gzipped.length / 1024) * 100) / 100,
      });
    }

    const totalRawKb = totalJsRawBytes / 1024;
    const totalGzipKb = totalJsGzipBytes / 1024;
    const maxAllowedGzipKb = 400; // 400 KB target

    console.info('Bundle JS Breakdown (gzip):', chunkReport);
    console.info(
      `Total initial JS raw: ${totalRawKb.toFixed(2)} KB, gzip: ${totalGzipKb.toFixed(2)} KB (Target: <= ${maxAllowedGzipKb} KB)`,
    );

    expect(
      totalGzipKb,
      `Total ukuran bundle JS gzip (${totalGzipKb.toFixed(2)} KB) melebihi batas 400 KB`,
    ).toBeLessThanOrEqual(maxAllowedGzipKb);
  });
});
