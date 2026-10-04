import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import {
  GridMap,
  AStarPathfinder,
  SlotReservationManager,
  LocalAvoidance,
  vectorToFacing,
  type GridPoint,
  type AgentTrajectory,
} from './index';

describe('T1.12 Pathfinding A* dan Reservasi Slot', () => {
  const mapPath = path.resolve(__dirname, '../../public/maps/floor1.tmj');
  const rawMap = JSON.parse(fs.readFileSync(mapPath, 'utf-8'));
  const gridMap = new GridMap(rawMap);
  const pathfinder = new AStarPathfinder(gridMap);

  // Titik spawn lobi utama (sesuai desk:warden dan pintu masuk Lobi)
  const lobiSpawn: GridPoint = { gx: 4, gy: 30 };

  describe('Kriteria Penerimaan 1: Semua slot terjangkau dari Lobi', () => {
    it('memverifikasi seluruh 133 slot interaksi dapat dicapai dari Lobi via pathfinding A*', () => {
      const allSlots = gridMap.getAllSlots();
      expect(allSlots.length).toBe(133);

      const unreachableSlots: string[] = [];

      for (const slot of allSlots) {
        const goal: GridPoint = { gx: slot.gx, gy: slot.gy };
        const pathResult = pathfinder.findPath(lobiSpawn, goal);

        if (!pathResult || pathResult.length === 0) {
          unreachableSlots.push(`${slot.id} (${slot.type} di ${slot.zone} [${slot.gx}, ${slot.gy}])`);
        } else {
          expect(pathResult[0].gx).toBe(lobiSpawn.gx);
          expect(pathResult[0].gy).toBe(lobiSpawn.gy);
          expect(pathResult[pathResult.length - 1].gx).toBe(slot.gx);
          expect(pathResult[pathResult.length - 1].gy).toBe(slot.gy);
        }
      }

      expect(
        unreachableSlots,
        `Ditemukan slot yang tidak terjangkau dari Lobi: ${unreachableSlots.join(', ')}`
      ).toEqual([]);
    });

    it('memverifikasi seluruh 17 zona kantor terjangkau dari Lobi', () => {
      const zones = gridMap.getZones();
      expect(zones.length).toBe(17);

      for (const zone of zones) {
        const slotsInZone = gridMap.getSlotsByZone(zone.id);
        expect(slotsInZone.length, `Zona ${zone.id} harus memiliki minimal 1 slot`).toBeGreaterThan(0);

        // Pilih slot pertama sebagai target representatif zona
        const sampleSlot = slotsInZone[0];
        const pathResult = pathfinder.findPath(lobiSpawn, { gx: sampleSlot.gx, gy: sampleSlot.gy });

        expect(
          pathResult,
          `Zona ${zone.id} (${zone.name}) tidak terjangkau dari Lobi!`
        ).not.toBeNull();
        expect(pathResult!.length).toBeGreaterThan(0);
      }
    });
  });

  describe('Kriteria Penerimaan 2: Benchmark pencarian jalur terpanjang < 1 ms', () => {
    it('mencapai pencarian jalur terpanjang < 1 ms per query (benchmark Vitest)', () => {
      const allSlots = gridMap.getAllSlots();
      let longestPathLength = 0;
      let longestTarget: GridPoint = { gx: 0, gy: 0 };
      let longestSlotId = '';

      for (const slot of allSlots) {
        const target: GridPoint = { gx: slot.gx, gy: slot.gy };
        const p = pathfinder.findPath(lobiSpawn, target);
        if (p && p.length > longestPathLength) {
          longestPathLength = p.length;
          longestTarget = target;
          longestSlotId = slot.id;
        }
      }

      // Pastikan jalur yang diuji adalah jalur terpanjang di peta (>= 45 langkah)
      expect(longestPathLength).toBeGreaterThanOrEqual(45);

      // Warm-up JIT V8 engine
      for (let w = 0; w < 20; w++) {
        pathfinder.findPath(lobiSpawn, longestTarget);
      }

      // Eksekusi benchmark 100 iterasi
      const iterations = 100;
      const tStart = performance.now();
      for (let i = 0; i < iterations; i++) {
        const pathResult = pathfinder.findPath(lobiSpawn, longestTarget);
        expect(pathResult).not.toBeNull();
      }
      const tEnd = performance.now();

      const totalDurationMs = tEnd - tStart;
      const avgDurationMs = totalDurationMs / iterations;

      console.log(
        `[Benchmark Vitest] Jalur terpanjang (${longestSlotId}, ${longestPathLength} langkah): rata-rata ${avgDurationMs.toFixed(4)} ms per pencarian (${iterations} iterasi, total ${totalDurationMs.toFixed(2)} ms)`
      );

      // Kriteria penerimaan: harus lebih kecil dari 1.0 ms
      expect(avgDurationMs).toBeLessThan(1.0);
    });
  });

  describe('A* Pathfinder: Pergerakan 8 Arah, Heuristik, dan Rintangan Dinamis', () => {
    it('menghitung arah hadap karakter isometrik pada setiap simpul jalur', () => {
      const pathResult = pathfinder.findPath({ gx: 4, gy: 30 }, { gx: 10, gy: 30 });
      expect(pathResult).not.toBeNull();

      for (const node of pathResult!) {
        expect(['SE', 'SW', 'NE', 'NW']).toContain(node.direction);
      }
    });

    it('memetakan vektor pergerakan ke orientasi hadap 4 arah dengan akurat', () => {
      expect(vectorToFacing(1, 0)).toBe('SE');
      expect(vectorToFacing(0, 1)).toBe('SW');
      expect(vectorToFacing(0, -1)).toBe('NE');
      expect(vectorToFacing(-1, 0)).toBe('NW');
      expect(vectorToFacing(1, 1)).toBe('SE');
      expect(vectorToFacing(-1, -1)).toBe('NW');
    });

    it('menghindari pemotongan sudut dinding diagonal (strict corner cutting)', () => {
      // Buat grid mini 3x3 dengan sudut memblokir
      const miniMap = new GridMap({
        width: 3,
        height: 3,
        collision: [
          0, 1, 0,
          0, 0, 0,
          0, 0, 0,
        ],
      });
      const pf = new AStarPathfinder(miniMap);

      // Gerak dari (0, 0) ke (2, 0) harus melewati (1, 1), bukan potong sudut (1, 0)
      const p = pf.findPath({ gx: 0, gy: 0 }, { gx: 2, gy: 0 }, { allowCornerCutting: false });
      expect(p).not.toBeNull();
      // Jalur harus melintasi baris gy=1 karena (1, 0) adalah dinding
      const usesRow1 = p!.some((node) => node.gy === 1);
      expect(usesRow1).toBe(true);
    });

    it('merutekan ulang jalur ketika ada rintangan dinamis (extraBlocked)', () => {
      const start: GridPoint = { gx: 14, gy: 20 }; // Koridor selatan
      const goal: GridPoint = { gx: 18, gy: 20 };

      // Jalur normal lurus di gy 20
      const normalPath = pathfinder.findPath(start, goal);
      expect(normalPath).not.toBeNull();
      expect(normalPath!.every((p) => p.gy === 20 || p.gy === 21)).toBe(true);

      // Blokir tile (16, 20) secara dinamis
      const obstacle: GridPoint = { gx: 16, gy: 20 };
      const detourPath = pathfinder.findPath(start, goal, {
        extraBlocked: [obstacle],
      });

      expect(detourPath).not.toBeNull();
      // Jalur pengalihan tidak boleh melewati tile (16, 20)
      const touchesObstacle = detourPath!.some((p) => p.gx === 16 && p.gy === 20);
      expect(touchesObstacle).toBe(false);
    });

    it('menangani kasus start sama dengan goal dan koordinat di luar batas', () => {
      const samePoint: GridPoint = { gx: 4, gy: 30 };
      const resultSame = pathfinder.findPath(samePoint, samePoint);
      expect(resultSame).toEqual([{ gx: 4, gy: 30 }]);

      const outOfBounds: GridPoint = { gx: -5, gy: 10 };
      expect(pathfinder.findPath(outOfBounds, samePoint)).toBeNull();
      expect(pathfinder.findPath(samePoint, outOfBounds)).toBeNull();
    });
  });

  describe('Sistem Reservasi Slot: 1 Agent per Slot dan Antrean FIFO', () => {
    it('memberikan reservasi langsung kepada agen pertama (kapasitas 1)', () => {
      const mgr = new SlotReservationManager(gridMap);
      const slotId = 'slot_z01_desk_jarvis';

      expect(mgr.isAvailable(slotId)).toBe(true);

      const res1 = mgr.reserveSlot(slotId, 'jarvis');
      expect(res1.success).toBe(true);
      expect(res1.status).toBe('reserved');
      expect(res1.position).toBe(0);

      expect(mgr.isAvailable(slotId)).toBe(false);
      expect(mgr.getOccupants(slotId)).toEqual(['jarvis']);
      expect(mgr.getPrimaryOccupant(slotId)).toBe('jarvis');
    });

    it('memasukkan agen kedua dan ketiga ke antrean FIFO saat slot penuh', () => {
      const mgr = new SlotReservationManager(gridMap);
      const slotId = 'slot_z08_desk_forge';

      // Agen 1 mengambil slot
      mgr.reserveSlot(slotId, 'forge');

      // Agen 2 mencoba reservasi -> antrean posisi 1
      const res2 = mgr.reserveSlot(slotId, 'nova');
      expect(res2.success).toBe(true);
      expect(res2.status).toBe('queued');
      expect(res2.position).toBe(1);

      // Agen 3 mencoba reservasi -> antrean posisi 2
      const res3 = mgr.reserveSlot(slotId, 'prism');
      expect(res3.success).toBe(true);
      expect(res3.status).toBe('queued');
      expect(res3.position).toBe(2);

      expect(mgr.getOccupants(slotId)).toEqual(['forge']);
      expect(mgr.getQueue(slotId)).toEqual(['nova', 'prism']);
      expect(mgr.getQueueLength(slotId)).toBe(2);
    });

    it('mempromosikan agen pertama di antrean secara otomatis saat occupant melepaskan slot', () => {
      const mgr = new SlotReservationManager(gridMap);
      const slotId = 'slot_z10_desk_sentinel';

      mgr.reserveSlot(slotId, 'sentinel');
      mgr.reserveSlot(slotId, 'bastion');
      mgr.reserveSlot(slotId, 'oracle');

      // Sentinel melepaskan meja -> Bastion harus dipromosikan otomatis
      const rel1 = mgr.releaseSlot(slotId, 'sentinel');
      expect(rel1.success).toBe(true);
      expect(rel1.status).toBe('released');
      expect(rel1.promotedAgentId).toBe('bastion');

      expect(mgr.getOccupants(slotId)).toEqual(['bastion']);
      expect(mgr.getQueue(slotId)).toEqual(['oracle']);
      expect(mgr.getAgentReservation('bastion')).toEqual({
        slotId,
        status: 'reserved',
        position: 0,
      });
      expect(mgr.getAgentReservation('oracle')).toEqual({
        slotId,
        status: 'queued',
        position: 1,
      });

      // Bastion melepaskan meja -> Oracle dipromosikan
      const rel2 = mgr.releaseSlot(slotId, 'bastion');
      expect(rel2.promotedAgentId).toBe('oracle');
      expect(mgr.getOccupants(slotId)).toEqual(['oracle']);
      expect(mgr.getQueue(slotId)).toEqual([]);

      // Oracle melepaskan meja -> Slot kembali kosong
      const rel3 = mgr.releaseSlot(slotId, 'oracle');
      expect(rel3.promotedAgentId).toBeNull();
      expect(mgr.isAvailable(slotId)).toBe(true);
      expect(mgr.getOccupants(slotId)).toEqual([]);
    });

    it('menangani idempotensi reservasi ganda oleh agen yang sama', () => {
      const mgr = new SlotReservationManager(gridMap);
      const slotId = 'slot_z03_desk_daedalus';

      mgr.reserveSlot(slotId, 'daedalus');
      const dupe1 = mgr.reserveSlot(slotId, 'daedalus');
      expect(dupe1.status).toBe('already_reserved');
      expect(dupe1.position).toBe(0);

      mgr.reserveSlot(slotId, 'scribe');
      const dupe2 = mgr.reserveSlot(slotId, 'scribe');
      expect(dupe2.status).toBe('already_queued');
      expect(dupe2.position).toBe(1);
    });

    it('memungkinkan pembatalan antrean (cancelQueue) tanpa mengganggu occupant', () => {
      const mgr = new SlotReservationManager(gridMap);
      const slotId = 'slot_z07_desk_muse';

      mgr.reserveSlot(slotId, 'muse');
      mgr.reserveSlot(slotId, 'steward');
      mgr.reserveSlot(slotId, 'merlin');

      const cancelled = mgr.cancelQueue(slotId, 'steward');
      expect(cancelled).toBe(true);
      expect(mgr.getOccupants(slotId)).toEqual(['muse']);
      expect(mgr.getQueue(slotId)).toEqual(['merlin']);
      expect(mgr.getAgentReservation('steward')).toBeNull();
    });

    it('membersihkan seluruh reservasi dan antrean saat releaseAllForAgent dipanggil', () => {
      const mgr = new SlotReservationManager(gridMap);
      mgr.reserveSlot('slot_z01_sofa_1', 'rifqi');
      mgr.reserveSlot('slot_z14_seat_1', 'rifqi');

      const touched = mgr.releaseAllForAgent('rifqi');
      expect(touched).toContain('slot_z01_sofa_1');
      expect(touched).toContain('slot_z14_seat_1');
      expect(mgr.getAgentReservation('rifqi')).toBeNull();
    });

    it('menemukan meja spesifik agen (findDeskForAgent)', () => {
      const mgr = new SlotReservationManager(gridMap);
      const forgeDesk = mgr.findDeskForAgent('forge');
      expect(forgeDesk).toBeDefined();
      expect(forgeDesk!.type).toBe('desk:forge');
      expect(forgeDesk!.zone).toBe('Z08');

      const novaDesk = mgr.findDeskForAgent('Nova');
      expect(novaDesk).toBeDefined();
      expect(novaDesk!.type).toBe('desk:nova');
    });

    it('memberikan statistik kapasitas slot kantor (getStats)', () => {
      const mgr = new SlotReservationManager(gridMap);
      mgr.reserveSlot('slot_z01_desk_jarvis', 'jarvis');
      mgr.reserveSlot('slot_z01_desk_jarvis', 'merlin'); // antre

      const stats = mgr.getStats();
      expect(stats.totalSlots).toBe(133);
      expect(stats.occupiedSlots).toBe(1);
      expect(stats.availableSlots).toBe(132);
      expect(stats.queuedAgentsCount).toBe(1);
    });
  });

  describe('Penghindaran Sederhana: Berpapasan Bergeser Satu Tile (Local Avoidance)', () => {
    it('mendeteksi situasi berpapasan langsung (head-on) di jalur', () => {
      const agentA: AgentTrajectory = {
        agentId: 'forge',
        currentPos: { gx: 10, gy: 20 },
        targetPos: { gx: 11, gy: 20 },
      };
      const agentB: AgentTrajectory = {
        agentId: 'prism',
        currentPos: { gx: 11, gy: 20 },
        targetPos: { gx: 10, gy: 20 },
      };

      const encounter = LocalAvoidance.detectEncounter(agentA, agentB);
      expect(encounter).not.toBeNull();
      expect(encounter!.kind).toBe('head_on');
      expect(encounter!.agentA).toBe('forge');
      expect(encounter!.agentB).toBe('prism');
    });

    it('mendeteksi perebutan tile tujuan yang sama (converging)', () => {
      const agentA: AgentTrajectory = {
        agentId: 'nova',
        currentPos: { gx: 5, gy: 19 },
        targetPos: { gx: 5, gy: 20 },
      };
      const agentB: AgentTrajectory = {
        agentId: 'steward',
        currentPos: { gx: 6, gy: 20 },
        targetPos: { gx: 5, gy: 20 },
      };

      const encounter = LocalAvoidance.detectEncounter(agentA, agentB);
      expect(encounter).not.toBeNull();
      expect(encounter!.kind).toBe('converging');
      expect(encounter!.conflictPoint).toEqual({ gx: 5, gy: 20 });
    });

    it('membuat agen berprioritas lebih rendah bergeser satu tile (sidestep)', () => {
      // Forge sedang mengerjakan task prioritas 10, Prism sedang idle/ambient prioritas 2
      const agentA: AgentTrajectory = {
        agentId: 'forge',
        priority: 10,
        currentPos: { gx: 15, gy: 20 },
        targetPos: { gx: 16, gy: 20 },
        path: [
          { gx: 15, gy: 20 },
          { gx: 16, gy: 20 },
          { gx: 17, gy: 20 },
        ],
      };
      const agentB: AgentTrajectory = {
        agentId: 'prism',
        priority: 2,
        currentPos: { gx: 16, gy: 20 },
        targetPos: { gx: 15, gy: 20 },
        path: [
          { gx: 16, gy: 20 },
          { gx: 15, gy: 20 },
          { gx: 14, gy: 20 },
        ],
      };

      const resolution = LocalAvoidance.resolveAvoidance(agentA, agentB, gridMap);
      expect(resolution).not.toBeNull();
      expect(resolution!.passingAgentId).toBe('forge');
      expect(resolution!.yieldingAgentId).toBe('prism');

      // Prism harus bergeser 1 tile tegak lurus (koridor selatan berada di gy 20 dan 21)
      expect(resolution!.sidestepTile).not.toBeNull();
      const step = resolution!.sidestepTile!;

      // Jarak pergeseran harus tepat 1 tile dari posisi Prism saat ini
      const dist = Math.abs(step.gx - agentB.currentPos.gx) + Math.abs(step.gy - agentB.currentPos.gy);
      expect(dist).toBeGreaterThanOrEqual(1);
      expect(dist).toBeLessThanOrEqual(2);

      // Tile geser harus valid dan dapat dilalui (walkable)
      expect(gridMap.isWalkable(step.gx, step.gy)).toBe(true);

      // Jalur pengalihan memuat posisi saat ini, tile geser, dan sisa target
      expect(resolution!.detourPath).not.toBeNull();
      expect(resolution!.detourPath![0]).toEqual(agentB.currentPos);
      expect(resolution!.detourPath![1]).toEqual(step);
    });

    it('menemukan tile geser alternatif jika satu sisi terhalang dinding', () => {
      // Agen berjalan di gy=20 tepat di batas dinding gy=19
      const pos: GridPoint = { gx: 5, gy: 20 };
      const moveDir: GridPoint = { gx: 1, gy: 0 }; // Bergerak ke timur

      const sidestep = LocalAvoidance.findSidestepTile(pos, moveDir, gridMap);
      expect(sidestep).not.toBeNull();
      // Karena gy=19 adalah dinding, harus memilih gy=21 (koridor terbuka)
      expect(gridMap.isWalkable(sidestep!.gx, sidestep!.gy)).toBe(true);
    });
  });
});
