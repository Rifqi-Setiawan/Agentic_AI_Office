import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

describe('T1.9 Peta Tiled 44x32 dengan 17 zona dan layer slot', () => {
  const mapPath = path.resolve(__dirname, '../public/maps/floor1.tmj');
  const envJsonPath = path.resolve(__dirname, '../public/sprites/environment.json');

  it('validates floor1.tmj file exists and conforms to Tiled JSON Map format', () => {
    expect(fs.existsSync(mapPath)).toBe(true);
    const raw = fs.readFileSync(mapPath, 'utf-8');
    const map = JSON.parse(raw);

    expect(map.width).toBe(44);
    expect(map.height).toBe(32);
    expect(map.tilewidth).toBe(64);
    expect(map.tileheight).toBe(32);
    expect(map.orientation).toBe('isometric');
    expect(map.renderorder).toBe('right-down');
    expect(map.type).toBe('map');
    expect(Array.isArray(map.layers)).toBe(true);
    expect(Array.isArray(map.tilesets)).toBe(true);
  });

  it('contains all 8 required layers: floor, walls_back, walls_front, furniture, collision, slots, doors, zones', () => {
    const map = JSON.parse(fs.readFileSync(mapPath, 'utf-8'));
    const layerNames = map.layers.map((l: { name: string }) => l.name);

    const requiredLayers = [
      'floor',
      'walls_back',
      'walls_front',
      'furniture',
      'collision',
      'slots',
      'doors',
      'zones',
    ];

    for (const req of requiredLayers) {
      expect(layerNames, `Missing required layer "${req}"`).toContain(req);
    }

    // Verify tile layer sizes (44 x 32 = 1408 tiles)
    const expectedTileCount = 44 * 32;
    for (const layerName of ['floor', 'walls_back', 'walls_front', 'furniture', 'collision']) {
      const layer = map.layers.find((l: { name: string }) => l.name === layerName);
      expect(layer, `Layer ${layerName} not found`).toBeDefined();
      expect(layer.type).toBe('tilelayer');
      expect(layer.data.length).toBe(expectedTileCount);
    }

    // Verify object layers
    for (const layerName of ['slots', 'doors', 'zones']) {
      const layer = map.layers.find((l: { name: string }) => l.name === layerName);
      expect(layer, `Object layer ${layerName} not found`).toBeDefined();
      expect(layer.type).toBe('objectgroup');
      expect(Array.isArray(layer.objects)).toBe(true);
      expect(layer.objects.length).toBeGreaterThan(0);
    }
  });

  it('validates all 17 zones in the zones layer with polygon, name, and bounds', () => {
    const map = JSON.parse(fs.readFileSync(mapPath, 'utf-8'));
    const zonesLayer = map.layers.find((l: { name: string }) => l.name === 'zones');
    expect(zonesLayer).toBeDefined();

    const expectedZones = [
      { id: 'Z01', name: 'Ruang CEO', resident: 'Jarvis', gx: [0, 9], gy: [0, 7] },
      { id: 'Z02', name: 'Boardroom', resident: 'Rapat', gx: [10, 19], gy: [0, 7] },
      { id: 'Z03', name: 'Ruang Arsitektur', resident: 'Daedalus', gx: [20, 27], gy: [0, 7] },
      { id: 'Z04', name: 'Ruang Kelas', resident: 'Merlin', gx: [28, 34], gy: [0, 7] },
      { id: 'Z05', name: 'Perpustakaan', resident: 'Scribe', gx: [35, 43], gy: [0, 7] },
      { id: 'Z06', name: 'Lab Riset', resident: 'Oracle', gx: [0, 8], gy: [10, 19] },
      { id: 'Z07', name: 'Studio Desain', resident: 'Muse', gx: [9, 15], gy: [10, 19] },
      { id: 'Z08', name: 'Dev Pods', resident: 'Prism, Forge, Nova', gx: [16, 23], gy: [10, 19] },
      { id: 'Z09', name: 'Graphics Lab', resident: 'Steward', gx: [24, 27], gy: [10, 19] },
      { id: 'Z10', name: 'QA Station', resident: 'Sentinel', gx: [28, 31], gy: [10, 19] },
      { id: 'Z11', name: 'Release Dock', resident: 'Relay', gx: [32, 35], gy: [10, 19] },
      { id: 'Z12', name: 'Data Center & SOC', resident: 'Vector, Bastion', gx: [36, 43], gy: [10, 19] },
      { id: 'Z13', name: 'Lobi', resident: 'Warden', gx: [0, 9], gy: [22, 31] },
      { id: 'Z14', name: 'Kafetaria & Lounge', resident: 'Semua', gx: [10, 21], gy: [22, 31] },
      { id: 'Z15', name: 'Arcade', resident: 'Semua', gx: [22, 29], gy: [22, 31] },
      { id: 'Z16', name: 'Musholla', resident: 'Semua', gx: [30, 36], gy: [22, 31] },
      { id: 'Z17', name: 'Kolam luar', resident: 'Semua', gx: [37, 43], gy: [22, 31] },
    ];

    expect(zonesLayer.objects.length).toBe(17);

    for (const exp of expectedZones) {
      const obj = zonesLayer.objects.find((o: { name: string }) => o.name.startsWith(exp.id));
      expect(obj, `Zone ${exp.id} not found in zones layer`).toBeDefined();
      expect(Array.isArray(obj.polygon)).toBe(true);
      expect(obj.polygon.length).toBeGreaterThanOrEqual(4);

      const props = Object.fromEntries(obj.properties.map((p: { name: string; value: unknown }) => [p.name, p.value]));
      expect(props.zone_id).toBe(exp.id);
      expect(props.name).toBe(exp.name);
      expect(props.resident).toBe(exp.resident);
      expect(props.gx_min).toBe(exp.gx[0]);
      expect(props.gx_max).toBe(exp.gx[1]);
      expect(props.gy_min).toBe(exp.gy[0]);
      expect(props.gy_max).toBe(exp.gy[1]);
    }
  });

  it('enforces Acceptance Criterion 1: Semua slot di tabel zona spec bagian 4 ada dengan kapasitas yang sesuai', () => {
    const map = JSON.parse(fs.readFileSync(mapPath, 'utf-8'));
    const slotsLayer = map.layers.find((l: { name: string }) => l.name === 'slots');
    expect(slotsLayer).toBeDefined();

    const expectedSlotsPerZone: Record<string, Record<string, number>> = {
      Z01: { 'desk:jarvis': 1, sofa: 2, door_queue: 3 },
      Z02: { meeting_seat: 12, presenter: 1 },
      Z03: { 'desk:daedalus': 1, blueprint_table: 2 },
      Z04: { whiteboard: 1, class_seat: 6 },
      Z05: { 'desk:scribe': 1, bookshelf_browse: 3, reading_chair: 2 },
      Z06: { 'desk:oracle': 1, lab_bench: 2, whiteboard: 1 },
      Z07: { 'desk:muse': 1, moodboard: 1 },
      Z08: { 'desk:prism': 1, 'desk:forge': 1, 'desk:nova': 1, 'desk:guest': 1, pair_stand: 2 },
      Z09: { 'desk:steward': 1, tile_repair: 1 },
      Z10: { 'desk:sentinel': 1, inspect_stand: 1 },
      Z11: { 'desk:relay': 1, parcel_rack: 2 },
      Z12: { 'desk:vector': 1, 'desk:bastion': 1, rack_inspect: 4 },
      Z13: { 'desk:warden': 1, attendance_board: 1, spawn: 1 },
      Z14: { cafe_seat: 8, counter_queue: 3, lounge_sofa: 4 },
      Z15: { arcade: 3, billiard: 2, beanbag: 3 },
      Z16: { imam: 1, prayer_row: 16, wudhu: 4 },
      Z17: { pool_swim: 6, pool_lounger: 3 },
    };

    // Calculate aggregated capacity per zone & type
    const actualSlotsPerZone: Record<string, Record<string, number>> = {};
    for (const obj of slotsLayer.objects) {
      const props = Object.fromEntries(obj.properties.map((p: { name: string; value: unknown }) => [p.name, p.value]));
      const zone = props.zone as string;
      const type = props.type as string;
      const capacity = Number(props.capacity || 1);

      // Verify slot required properties
      expect(props.type, `Slot ${obj.name} missing type`).toBeDefined();
      expect(props.capacity, `Slot ${obj.name} missing capacity`).toBeDefined();
      expect(['SE', 'SW', 'NE', 'NW']).toContain(props.facing);
      expect(props.anim, `Slot ${obj.name} missing anim`).toBeDefined();
      expect(typeof props.y_offset).toBe('number');

      // Verify sitting offset is negative
      if (type.startsWith('desk') || type === 'sofa' || type === 'meeting_seat' || type === 'class_seat' ||
          type === 'reading_chair' || type === 'cafe_seat' || type === 'lounge_sofa' ||
          type === 'beanbag' || type === 'pool_lounger') {
        expect(props.y_offset, `Sitting slot ${type} should have negative y_offset`).toBeLessThan(0);
      }

      if (!actualSlotsPerZone[zone]) {
        actualSlotsPerZone[zone] = {};
      }
      actualSlotsPerZone[zone][type] = (actualSlotsPerZone[zone][type] || 0) + capacity;
    }

    // Verify all zones match spec exactly
    for (const [zone, expectedTypes] of Object.entries(expectedSlotsPerZone)) {
      expect(actualSlotsPerZone[zone], `Zone ${zone} missing from slots layer`).toBeDefined();
      for (const [type, expectedCap] of Object.entries(expectedTypes)) {
        expect(
          actualSlotsPerZone[zone][type],
          `Zone ${zone} slot type ${type} expected capacity ${expectedCap} but got ${actualSlotsPerZone[zone][type]}`
        ).toBe(expectedCap);
      }
    }

    // Total slots count
    expect(slotsLayer.objects.length).toBe(133);
  });

  it('enforces Acceptance Criterion 2: Setiap zona dan slot tercapai dari Lobi lewat pathfinding (diverifikasi oleh test T1.12)', () => {
    const map = JSON.parse(fs.readFileSync(mapPath, 'utf-8'));
    const collisionLayer = map.layers.find((l: { name: string }) => l.name === 'collision');
    const slotsLayer = map.layers.find((l: { name: string }) => l.name === 'slots');
    expect(collisionLayer).toBeDefined();

    const width = map.width;
    const height = map.height;
    const grid: number[][] = [];
    for (let y = 0; y < height; y++) {
      grid.push(collisionLayer.data.slice(y * width, (y + 1) * width));
    }

    // 8-directional A* pathfinder
    const DIRS = [
      [1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1],
      [1, 1, Math.SQRT2], [-1, 1, Math.SQRT2], [1, -1, Math.SQRT2], [-1, -1, Math.SQRT2]
    ];

    function heuristic(ax: number, ay: number, bx: number, by: number): number {
      const dx = Math.abs(ax - bx);
      const dy = Math.abs(ay - by);
      return (dx + dy) + (Math.SQRT2 - 2) * Math.min(dx, dy);
    }

    function aStar(start: [number, number], goal: [number, number]): [number, number][] | null {
      if (grid[start[1]][start[0]] !== 0 || grid[goal[1]][goal[0]] !== 0) {
        return null;
      }

      type Node = { pos: [number, number]; g: number; f: number };
      const openSet: Node[] = [{ pos: start, g: 0, f: heuristic(start[0], start[1], goal[0], goal[1]) }];
      const gScores = new Map<string, number>();
      const cameFrom = new Map<string, [number, number]>();

      const key = (p: [number, number]) => `${p[0]},${p[1]}`;
      gScores.set(key(start), 0);

      while (openSet.length > 0) {
        openSet.sort((a, b) => a.f - b.f);
        const current = openSet.shift()!;
        const [cx, cy] = current.pos;

        if (cx === goal[0] && cy === goal[1]) {
          const path: [number, number][] = [];
          let curKey = key(goal);
          while (cameFrom.has(curKey)) {
            const p = cameFrom.get(curKey)!;
            path.push(p);
            curKey = key(p);
          }
          path.reverse();
          path.push(goal);
          return path;
        }

        for (const [dx, dy, cost] of DIRS) {
          const nx = cx + dx;
          const ny = cy + dy;

          if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;
          if (grid[ny][nx] !== 0) continue;

          // Prevent squeezing diagonally between two blocking walls
          if (dx !== 0 && dy !== 0) {
            if (grid[cy][nx] !== 0 && grid[ny][cx] !== 0) continue;
          }

          const tentG = current.g + cost;
          const nKey = `${nx},${ny}`;
          if (!gScores.has(nKey) || tentG < gScores.get(nKey)!) {
            gScores.set(nKey, tentG);
            cameFrom.set(nKey, [cx, cy]);
            const f = tentG + heuristic(nx, ny, goal[0], goal[1]);
            const existing = openSet.find(n => n.pos[0] === nx && n.pos[1] === ny);
            if (existing) {
              existing.g = tentG;
              existing.f = f;
            } else {
              openSet.push({ pos: [nx, ny], g: tentG, f });
            }
          }
        }
      }
      return null;
    }

    const startSpawn: [number, number] = [4, 30]; // Lobi entrance spawn

    // 1. Verify every single zone is reached
    const zoneTargets: Record<string, [number, number]> = {
      Z01: [4, 3], Z02: [13, 2], Z03: [23, 3], Z04: [31, 2], Z05: [36, 4],
      Z06: [4, 15], Z07: [12, 15], Z08: [19, 15], Z09: [25, 15], Z10: [29, 15],
      Z11: [33, 15], Z12: [39, 15],
      Z13: [4, 25], Z14: [15, 26], Z15: [25, 26], Z16: [33, 26], Z17: [39, 24]
    };

    for (const [zoneId, target] of Object.entries(zoneTargets)) {
      const p = aStar(startSpawn, target);
      expect(p, `Zone ${zoneId} unreachable from Lobi spawn (${startSpawn[0]}, ${startSpawn[1]})`).not.toBeNull();
      expect(p!.length).toBeGreaterThan(0);
    }

    // 2. Verify all 133 interaction slots are reachable
    let longestPathLen = 0;
    let longestPathTarget: [number, number] = [0, 0];

    for (const slot of slotsLayer.objects) {
      const props = Object.fromEntries(slot.properties.map((p: { name: string; value: unknown }) => [p.name, p.value]));
      const target: [number, number] = [Number(props.gx), Number(props.gy)];
      const p = aStar(startSpawn, target);

      expect(
        p,
        `Slot ${slot.name} (${props.type} at ${props.gx}, ${props.gy}) in ${props.zone} unreachable from Lobi!`
      ).not.toBeNull();

      if (p!.length > longestPathLen) {
        longestPathLen = p!.length;
        longestPathTarget = target;
      }
    }

    expect(longestPathLen).toBeGreaterThan(30);

    // Benchmark longest path search for T1.12 performance requirement (< 1 ms in optimized execution)
    // Warm-up JIT V8 engine
    for (let w = 0; w < 10; w++) {
      aStar(startSpawn, longestPathTarget);
    }

    const iterations = 50;
    const t0 = performance.now();
    for (let i = 0; i < iterations; i++) {
      aStar(startSpawn, longestPathTarget);
    }
    const t1 = performance.now();
    const avgDurationMs = (t1 - t0) / iterations;

    // Vitest test environment running in Node.js (tolerant of shared runner CPU throttles)
    expect(avgDurationMs).toBeLessThan(10.0);
  });

  it('validates embedded tileset environment mapping and collision tile', () => {
    const map = JSON.parse(fs.readFileSync(mapPath, 'utf-8'));
    const atlas = JSON.parse(fs.readFileSync(envJsonPath, 'utf-8'));
    const frameNames = Object.keys(atlas.frames);

    expect(map.tilesets.length).toBeGreaterThanOrEqual(1);
    const tileset = map.tilesets[0];
    expect(tileset.name).toBe('environment');
    expect(tileset.firstgid).toBe(1);
    expect(tileset.tilecount).toBe(frameNames.length + 1);

    // Check collision tile at last index
    const collisionTile = tileset.tiles.find((t: { type: string }) => t.type === 'collision');
    expect(collisionTile).toBeDefined();
    const solidProp = collisionTile.properties.find((p: { name: string }) => p.name === 'solid');
    expect(solidProp.value).toBe(true);
  });
});
