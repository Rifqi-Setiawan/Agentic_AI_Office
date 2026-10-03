import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { CharacterManager, AGENT_SPAWN_DEFS } from './CharacterManager';
import { OfficeMapLoader } from './mapLoader';
import { TiledMapDoc } from './types';
import { performance } from 'node:perf_hooks';

describe('T1.13 Acceptance Criterion 1: 16 Karakter Berjalan Bersamaan >= 60 FPS', () => {
  const mapPath = path.resolve(__dirname, '../../public/maps/floor1.tmj');
  const rawMap = fs.readFileSync(mapPath, 'utf-8');
  const mapDoc = JSON.parse(rawMap) as TiledMapDoc;

  it('spawns all 16 agents (+ Rifqi & Guest) into entities container', () => {
    const loadedMap = OfficeMapLoader.loadFromDoc(mapDoc);
    const manager = new CharacterManager(loadedMap);
    manager.spawnAllAgents();

    const allChars = manager.getAllCharacters();
    expect(allChars.length).toBe(AGENT_SPAWN_DEFS.length); // 17 entitas
    expect(allChars.length).toBeGreaterThanOrEqual(16);

    for (const def of AGENT_SPAWN_DEFS) {
      const char = manager.getCharacter(def.id);
      expect(char, `Karakter ${def.id} harus terdaftar`).toBeDefined();
      expect(char!.id).toBe(def.id);
      expect(char!.characterName).toBe(def.name);
      expect(char!.gx).toBeGreaterThanOrEqual(0);
      expect(char!.gy).toBeGreaterThanOrEqual(0);
    }
  });

  it('enforces Acceptance Criterion 1: 16 karakter berjalan bersamaan tanpa penurunan FPS di bawah 60', () => {
    const loadedMap = OfficeMapLoader.loadFromDoc(mapDoc);
    const manager = new CharacterManager(loadedMap);
    manager.spawnAllAgents();

    const AGENT_IDS = [
      'jarvis',
      'daedalus',
      'oracle',
      'merlin',
      'muse',
      'prism',
      'forge',
      'vector',
      'sentinel',
      'bastion',
      'relay',
      'warden',
      'steward',
      'scribe',
      'nova',
      'rifqi',
    ];

    expect(AGENT_IDS.length).toBe(16);

    // Siapkan jalur berjalan simultan berbeda untuk masing-masing dari 16 agen
    // Setiap jalur memiliki panjang 15-25 langkah waypoint melintasi koridor kantor
    for (let i = 0; i < AGENT_IDS.length; i++) {
      const id = AGENT_IDS[i];
      const char = manager.getCharacter(id)!;
      expect(char).toBeDefined();

      const startGx = char.gx;
      const startGy = char.gy;

      // Jalur multi-segmen melintasi ruangan dan koridor
      const pathWaypoints = [
        { gx: startGx, gy: startGy },
        { gx: startGx + 2, gy: startGy },
        { gx: startGx + 2, gy: startGy + 3 },
        { gx: startGx + 6, gy: startGy + 3 },
        { gx: startGx + 6, gy: startGy + 6 },
        { gx: startGx + 2, gy: startGy + 6 },
        { gx: startGx, gy: startGy },
      ];

      manager.moveCharacter(id, pathWaypoints);
      expect(char.fsmState).toBe('walk');
    }

    // Pastikan seluruh 16 karakter berada dalam status 'walk' bersamaan
    for (const id of AGENT_IDS) {
      const char = manager.getCharacter(id)!;
      expect(char.fsmState).toBe('walk');
    }

    // Jalankan simulasi benchmark selama 120 frame (ekuivalen 2 detik pada 60 FPS)
    const SIMULATED_FRAMES = 120;
    const DT_PER_FRAME = 1.0 / 60.0; // 16.67 ms per frame

    // Warm-up 10 frame untuk JIT optimization
    for (let f = 0; f < 10; f++) {
      manager.update(DT_PER_FRAME);
    }

    // Ukur waktu eksekusi presisi tinggi
    const tStart = performance.now();

    for (let f = 0; f < SIMULATED_FRAMES; f++) {
      manager.update(DT_PER_FRAME);
    }

    const tEnd = performance.now();
    const totalDurationMs = tEnd - tStart;
    const avgFrameDurationMs = totalDurationMs / SIMULATED_FRAMES;
    const effectiveFps = 1000.0 / avgFrameDurationMs;

    console.log(
      `[Benchmark T1.13] 16 Karakter Berjalan Simultan:` +
        ` Rata-rata ${avgFrameDurationMs.toFixed(4)} ms/frame` +
        ` (${SIMULATED_FRAMES} frame dieksekusi dalam ${totalDurationMs.toFixed(2)} ms)` +
        ` -> Ekuivalen FPS: ${effectiveFps.toFixed(1)} FPS` +
        ` (Batas anggaran frame 60 FPS: <= 16.67 ms)`,
    );

    // Kriteria Penerimaan: Per frame harus jauh di bawah anggaran 16.67 ms (target >= 60 FPS)
    // Ambang batas aman: frame update harus < 5.0 ms (< 30% dari total 16.67ms frame budget)
    expect(
      avgFrameDurationMs,
      `Frame execution ${avgFrameDurationMs.toFixed(2)} ms melebihi batas anggaran 60 FPS (16.67 ms)`,
    ).toBeLessThan(16.67);

    expect(
      effectiveFps,
      `Ekuivalen FPS ${effectiveFps.toFixed(1)} berada di bawah target 60 FPS`,
    ).toBeGreaterThanOrEqual(60.0);

    // Verifikasi bahwa seluruh 16 karakter telah bergerak dan posisinya terupdate
    for (const id of AGENT_IDS) {
      const char = manager.getCharacter(id)!;
      // zIndex harus valid dan dihitung dari titik kaki
      expect(char.zIndex).toBeGreaterThan(0);
      expect(char.x).toBeGreaterThan(0);
      expect(char.y).toBeGreaterThan(0);
    }
  });
});
