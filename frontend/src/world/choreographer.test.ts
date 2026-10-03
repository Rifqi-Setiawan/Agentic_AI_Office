import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { GridMap } from '../navigation/GridMap';
import { AStarPathfinder } from '../navigation/AStarPathfinder';
import { SlotReservationManager } from '../navigation/SlotReservationManager';
import { CharacterManager, AGENT_SPAWN_DEFS } from './CharacterManager';
import { Character, DEFAULT_WALK_SPEED } from './Character';
import { Choreographer } from './Choreographer';
import type { InteractionSlot } from './types';
import { officeStore } from '../store/officeStore';
import type { AgentState, CollectiveEventState } from '../types/office';

describe('T1.14 Choreographer (Task Nyata, Ambient, Event Kolektif)', () => {
  const mapPath = path.resolve(__dirname, '../../public/maps/floor1.tmj');
  const rawMap = JSON.parse(fs.readFileSync(mapPath, 'utf-8'));

  let gridMap: GridMap;
  let pathfinder: AStarPathfinder;
  let slotManager: SlotReservationManager;
  let characterManager: CharacterManager;
  let choreographer: Choreographer;

  beforeEach(() => {
    officeStore.getState().reset();

    gridMap = new GridMap(rawMap);
    pathfinder = new AStarPathfinder(gridMap);
    slotManager = new SlotReservationManager(gridMap);
    characterManager = new CharacterManager();

    // Spawn 17 karakter secara mandiri untuk pengetesan headless
    for (const def of AGENT_SPAWN_DEFS) {
      const char = new Character({
        id: def.id,
        name: def.name,
        role: def.role,
        signatureColor: def.signatureColor,
        initialGx: def.fallbackGx,
        initialGy: def.fallbackGy,
        initialFacing: def.fallbackFacing,
      });

      const slot = gridMap.getSlot(def.defaultSlotId);
      if (slot) {
        char.act(slot as unknown as InteractionSlot);
      } else {
        char.idle();
      }
      characterManager.addCharacter(char);
    }

    choreographer = new Choreographer({
      characterManager,
      gridMap,
      pathfinder,
      slotManager,
    });
    choreographer.init();
  });

  afterEach(() => {
    choreographer.destroy();
    characterManager.destroy();
    officeStore.getState().reset();
  });

  // =========================================================================
  // Kriteria Penerimaan 1: Forge tiba di desk:forge dalam <= 10 dtk
  // =========================================================================
  describe('Kriteria Penerimaan 1: Task running untuk Forge -> desk:forge <= 10 dtk', () => {
    it('memverifikasi Forge di kafe tiba di desk:forge dalam <= 10 detik sejak event diterima', () => {
      const forgeChar = characterManager.getCharacter('forge')!;
      expect(forgeChar).toBeDefined();

      // Tempatkan Forge di kafetaria (Z14 slot_z14_seat_1)
      const cafeSlot = gridMap.getSlot('slot_z14_seat_1')!;
      forgeChar.setGridPosition(cafeSlot.gx, cafeSlot.gy);
      forgeChar.act(cafeSlot as unknown as InteractionSlot);
      slotManager.releaseAllForAgent('forge');
      slotManager.reserveSlot(cafeSlot.id, 'forge', { releasePrevious: true });

      expect(forgeChar.getCurrentSlot()?.id).toBe('slot_z14_seat_1');

      // Kirim event task fixture 'running' untuk forge via store
      const runningForgeState: AgentState = {
        id: 'forge',
        name: 'Forge',
        role: 'Backend Specialist',
        presence: 'on_duty',
        work: 'working',
        since: Math.floor(Date.now() / 1000),
        done_today: 3,
        zone: 'Z08',
        action: 'Mengerjakan task backend',
        grid_x: forgeChar.gx,
        grid_y: forgeChar.gy,
        direction: 'SE',
        task: {
          id: 'task_forge_1',
          title: 'Implementasi Poller SQLite',
          board: 'office-v2',
          status: 'running',
          block_kind: null,
          started_at: Math.floor(Date.now() / 1000),
        },
      };

      officeStore.getState().updateAgentDelta(runningForgeState);

      // Simulasikan waktu pergerakan dengan resolusi frame 0.1 detik
      const dt = 0.1;
      let elapsedSeconds = 0;
      let arrived = false;

      while (elapsedSeconds <= 12.0) {
        choreographer.update(dt);
        characterManager.update(dt);
        elapsedSeconds += dt;

        if (
          forgeChar.getCurrentSlot()?.id === 'slot_z08_desk_forge' &&
          forgeChar.fsmState === 'act'
        ) {
          arrived = true;
          break;
        }
      }

      expect(arrived).toBe(true);
      expect(elapsedSeconds).toBeLessThanOrEqual(10.0);
      expect(forgeChar.getCurrentSlot()?.type).toBe('desk:forge');
      expect(forgeChar.slotYOffset).toBe(-6);
      expect(forgeChar.badgeContainer.visible).toBe(true);
    });

    it('memverifikasi Forge dari titik terjauh di peta tetap tiba di desk:forge dalam <= 10 detik', () => {
      const forgeChar = characterManager.getCharacter('forge')!;
      // Titik terjauh di peta: Perpustakaan Z05 (slot_z05_browse_1)
      const distantSlot = gridMap.getSlot('slot_z05_browse_1')!;
      forgeChar.setGridPosition(distantSlot.gx, distantSlot.gy);
      forgeChar.act(distantSlot as unknown as InteractionSlot);
      slotManager.releaseAllForAgent('forge');
      slotManager.reserveSlot(distantSlot.id, 'forge', { releasePrevious: true });

      const runningForgeState: AgentState = {
        id: 'forge',
        name: 'Forge',
        role: 'Backend Specialist',
        presence: 'on_duty',
        work: 'working',
        since: Math.floor(Date.now() / 1000),
        done_today: 4,
        zone: 'Z08',
        action: 'Darurat server',
        grid_x: distantSlot.gx,
        grid_y: distantSlot.gy,
        direction: 'SE',
        task: {
          id: 'task_emergency',
          title: 'Perbaikan API',
          board: 'office-v2',
          status: 'running',
          block_kind: null,
          started_at: Math.floor(Date.now() / 1000),
        },
      };

      officeStore.getState().updateAgentDelta(runningForgeState);

      const dt = 0.1;
      let elapsedSeconds = 0;
      let arrived = false;

      while (elapsedSeconds <= 12.0) {
        choreographer.update(dt);
        characterManager.update(dt);
        elapsedSeconds += dt;

        if (
          forgeChar.getCurrentSlot()?.id === 'slot_z08_desk_forge' &&
          forgeChar.fsmState === 'act'
        ) {
          arrived = true;
          break;
        }
      }

      expect(arrived).toBe(true);
      expect(elapsedSeconds).toBeLessThanOrEqual(10.0);
      expect(forgeChar.speed).toBe(DEFAULT_WALK_SPEED); // Kecepatan kembali normal saat tiba
    });
  });

  // =========================================================================
  // Kriteria Penerimaan 2: Saat sholat, tidak ada agent working meninggalkan meja
  // =========================================================================
  describe('Kriteria Penerimaan 2: Sholat berjamaah & perlindungan agen working', () => {
    it('memverifikasi agen working TIDAK meninggalkan mejanya saat sholat dan mengirim bubble', () => {
      // Setel 3 agen dalam status 'working': Forge, Sentinel, Nova
      const workingAgents = ['forge', 'sentinel', 'nova'] as const;
      for (const id of workingAgents) {
        officeStore.getState().updateAgentDelta({
          id,
          name: id.toUpperCase(),
          role: 'Specialist',
          presence: 'on_duty',
          work: 'working',
          since: Math.floor(Date.now() / 1000),
          done_today: 2,
          zone: 'Z08',
          action: 'Kerja keras',
          grid_x: 0,
          grid_y: 0,
          direction: 'SE',
          task: {
            id: `task_${id}`,
            title: `Task ${id}`,
            board: 'office-v2',
            status: 'running',
            block_kind: null,
            started_at: Math.floor(Date.now() / 1000),
          },
        });
      }

      // Pastikan agen working berada di mejanya
      for (const id of workingAgents) {
        const char = characterManager.getCharacter(id)!;
        const state = choreographer.getAgentState(id)!;
        const desk = gridMap.getSlot(state.deskSlotId)!;
        char.setGridPosition(desk.gx, desk.gy);
        char.act(desk as unknown as InteractionSlot);
      }

      // Mulai event kolektif Sholat
      const sholatEvent: CollectiveEventState = {
        id: 'collective_sholat_1',
        kind: 'sholat',
        title: 'Sholat Berjamaah Ashar',
        started_at: Math.floor(Date.now() / 1000),
        expires_at: Math.floor(Date.now() / 1000) + 300,
        participants: [],
        active: true,
      };

      officeStore.getState().updateCollective(sholatEvent);

      // Jalankan simulasi selama 60 detik (sholat sedang berlangsung)
      const dt = 0.5;
      for (let t = 0; t < 120; t++) {
        choreographer.update(dt);
        characterManager.update(dt);

        // Assert setiap detik: tidak ada agen working yang meninggalkan mejanya
        for (const id of workingAgents) {
          const char = characterManager.getCharacter(id)!;
          const state = choreographer.getAgentState(id)!;
          expect(char.getCurrentSlot()?.id).toBe(state.deskSlotId);
          expect(char.fsmState).toBe('act');
        }
      }

      // Verifikasi bubble "Nyusul setelah task ini" dikirimkan oleh agen working
      const recentBubbles = choreographer.getRecentBubbles();
      for (const id of workingAgents) {
        const bubble = recentBubbles.find(
          (b) => b.agentId === id && b.text === 'Nyusul setelah task ini',
        );
        expect(bubble, `Agen ${id} harus mengirim bubble 'Nyusul setelah task ini'`).toBeDefined();
      }

      // Verifikasi agen non-working yang sholat:
      // Ada imam di slot_z16_imam, dan peserta shaf berurutan
      const collectiveMgr = choreographer.getCollectiveManager();
      const imamAssignment = Array.from(characterManager.getAllCharacters())
        .map((c) => collectiveMgr.getAssignment(c.id))
        .find((a) => a?.role === 'imam');

      expect(imamAssignment).toBeDefined();
      expect(imamAssignment?.slot.id).toBe('slot_z16_imam');
      expect(['jarvis', 'merlin']).toContain(imamAssignment?.agentId);
    });

    it('mengisi shaf musholla secara berurutan untuk seluruh peserta non-working', () => {
      const sholatEvent: CollectiveEventState = {
        id: 'collective_sholat_full',
        kind: 'sholat',
        title: 'Sholat Berjamaah',
        started_at: Math.floor(Date.now() / 1000),
        expires_at: Math.floor(Date.now() / 1000) + 300,
        participants: [],
        active: true,
      };

      officeStore.getState().updateCollective(sholatEvent);

      const collectiveMgr = choreographer.getCollectiveManager();
      const shafAssignments = Array.from(characterManager.getAllCharacters())
        .map((c) => collectiveMgr.getAssignment(c.id))
        .filter((a): a is NonNullable<typeof a> => a?.role === 'shaf');

      expect(shafAssignments.length).toBeGreaterThan(0);

      // Verifikasi urutan slot shaf yang digunakan
      const usedSlots = shafAssignments.map((a) => a.slot.id);
      expect(usedSlots[0]).toBe('slot_z16_shaf1_1');
      if (usedSlots.length > 1) {
        expect(usedSlots[1]).toBe('slot_z16_shaf1_2');
      }
    });
  });

  // =========================================================================
  // Kriteria Penerimaan 3: Simulasi 1 jam headless tanpa macet > 5 menit
  // =========================================================================
  describe('Kriteria Penerimaan 3: Simulasi 1 jam headless (3.600 dtk) tanpa macet > 5 mnt', () => {
    it('memverifikasi tidak ada agen idle/ambient yang berada di 1 tile > 5 menit (300 dtk)', () => {
      // 1 jam simulasi = 3.600 detik. Kita jalankan per frame dt = 1.0 detik.
      const totalSeconds = 3600;
      const dt = 1.0;
      const stuckLimitSeconds = 300; // 5 menit

      const maxTimeAtTileRecorded: Record<string, number> = {};
      const transitionCounts: Record<string, number> = {};

      for (const def of AGENT_SPAWN_DEFS) {
        maxTimeAtTileRecorded[def.id] = 0;
        transitionCounts[def.id] = 0;
      }

      const lastObservedSlot: Record<string, string | null> = {};

      // Jalankan 3.600 frame simulasi
      for (let sec = 0; sec < totalSeconds; sec++) {
        choreographer.update(dt);
        characterManager.update(dt);

        for (const def of AGENT_SPAWN_DEFS) {
          const char = characterManager.getCharacter(def.id)!;
          const state = choreographer.getAgentState(def.id)!;

          // Catat waktu terlama di satu tile untuk agen non-working
          if (state.workStatus !== 'working') {
            if (state.timeAtTile > maxTimeAtTileRecorded[def.id]) {
              maxTimeAtTileRecorded[def.id] = state.timeAtTile;
            }

            // Invariant ketat: tidak boleh pernah melebihi 300 detik
            expect(
              state.timeAtTile,
              `Agen ${def.id} macet di satu tile selama ${state.timeAtTile}s (> ${stuckLimitSeconds}s)`,
            ).toBeLessThan(stuckLimitSeconds);
          }

          // Monitor pergantian slot/aktivitas
          const currSlotId = char.getCurrentSlot()?.id ?? null;
          if (currSlotId !== lastObservedSlot[def.id]) {
            transitionCounts[def.id]++;
            lastObservedSlot[def.id] = currSlotId;
          }
        }
      }

      // Verifikasi seluruh agen aktif bertransisi dan tidak ada yang macet
      for (const def of AGENT_SPAWN_DEFS) {
        expect(
          maxTimeAtTileRecorded[def.id],
          `Waktu maksimum agen ${def.id} di satu tempat harus <= 130 detik`,
        ).toBeLessThanOrEqual(130);
        expect(
          transitionCounts[def.id],
          `Agen ${def.id} harus memiliki minimal 5 transisi aktivitas dalam 1 jam`,
        ).toBeGreaterThanOrEqual(5);
      }
    });
  });

  // =========================================================================
  // Pengujian Bobot Persona dan Durasi Aktivitas Ambient (Spec Bagian 3)
  // =========================================================================
  describe('Aturan Ambient Scheduler (Spec Bagian 3)', () => {
    it('memverifikasi durasi aktivitas ambient selalu berada dalam rentang 30–120 detik', () => {
      const novaState = choreographer.getAgentState('nova')!;
      const novaChar = characterManager.getCharacter('nova')!;

      for (let i = 0; i < 20; i++) {
        choreographer.getAmbientScheduler().scheduleNextAmbientActivity('nova', novaState, novaChar);
        expect(novaState.activityDuration).toBeGreaterThanOrEqual(30);
        expect(novaState.activityDuration).toBeLessThanOrEqual(120);
      }
    });

    it('memverifikasi tidak memilih aktivitas yang sama dua kali berturut-turut', () => {
      const prismState = choreographer.getAgentState('prism')!;
      const prismChar = characterManager.getCharacter('prism')!;

      let prevKey: string | null = null;
      for (let i = 0; i < 30; i++) {
        choreographer.getAmbientScheduler().scheduleNextAmbientActivity('prism', prismState, prismChar);
        expect(prismState.currentActivityKey).not.toBe(prevKey);
        prevKey = prismState.currentActivityKey;
      }
    });

    it('memverifikasi pemilihan aktivitas menghormati bobot persona (distribusi statistik)', () => {
      const scribeState = choreographer.getAgentState('scribe')!;
      const scribeChar = characterManager.getCharacter('scribe')!;

      // Scribe memiliki reading: 5, cafe_tea: 2, tidy_shelf: 2
      const counts: Record<string, number> = { reading: 0, cafe_tea: 0, tidy_shelf: 0 };
      const trials = 300;

      for (let i = 0; i < trials; i++) {
        // Reset lastActivityKey agar setiap uji independen terhadap bobot murni
        scribeState.lastActivityKey = null;
        choreographer.getAmbientScheduler().scheduleNextAmbientActivity('scribe', scribeState, scribeChar);
        const k = scribeState.currentActivityKey!;
        if (counts[k] !== undefined) {
          counts[k]++;
        }
      }

      // 'reading' dengan bobot 5 harus lebih sering terpilih dibanding 'cafe_tea' (2) atau 'tidy_shelf' (2)
      expect(counts.reading).toBeGreaterThan(counts.cafe_tea);
      expect(counts.reading).toBeGreaterThan(counts.tidy_shelf);
    });
  });

  // =========================================================================
  // Pengujian Pemetaan Status -> Perilaku (Tabel Status Spec Bagian 1)
  // =========================================================================
  describe('Peta Status -> Perilaku (Tabel Status Spec Bagian 1)', () => {
    it('memverifikasi task blocked dengan needs_input membuat agen berjalan ke pintu Ruang Jarvis', () => {
      const daedalusChar = characterManager.getCharacter('daedalus')!;
      expect(daedalusChar).toBeDefined();

      const blockedState: AgentState = {
        id: 'daedalus',
        name: 'Daedalus',
        role: 'Architect',
        presence: 'on_duty',
        work: 'blocked',
        since: Math.floor(Date.now() / 1000),
        done_today: 1,
        zone: 'Z03',
        action: 'Menunggu input founder',
        grid_x: 23,
        grid_y: 3,
        direction: 'SE',
        task: {
          id: 'task_arch_1',
          title: 'Review Blueprint Baru',
          board: 'office-v2',
          status: 'blocked',
          block_kind: 'needs_input',
          started_at: Math.floor(Date.now() / 1000),
        },
      };

      officeStore.getState().updateAgentDelta(blockedState);

      // Simulasikan perjalanan menuju pintu Jarvis
      choreographer.simulate(10, 0.5);

      const daedalusState = choreographer.getAgentState('daedalus')!;
      expect(['slot_z01_door_queue_1', 'slot_z01_door_queue_2', 'slot_z01_door_queue_3']).toContain(
        daedalusState.targetSlotId,
      );
      expect(daedalusChar.badgeContainer.visible).toBe(false); // Badge hanya saat working
    });

    it('memverifikasi task done_recent memicu selebrasi 45 detik sebelum kembali ke ambient', () => {
      const doneState: AgentState = {
        id: 'nova',
        name: 'Nova',
        role: 'Ops',
        presence: 'on_duty',
        work: 'done_recent',
        since: Math.floor(Date.now() / 1000),
        done_today: 5,
        zone: 'Z08',
        action: 'Deploy sukses',
        grid_x: 17,
        grid_y: 16,
        direction: 'SE',
        task: {
          id: 'task_deploy_1',
          title: 'Deploy Production',
          board: 'office-v2',
          status: 'done',
          block_kind: null,
          started_at: Math.floor(Date.now() / 1000),
        },
      };

      officeStore.getState().updateAgentDelta(doneState);

      const novaState = choreographer.getAgentState('nova')!;
      expect(novaState.celebrateRemaining).toBe(45);

      // Simulasikan 50 detik
      choreographer.simulate(50, 1.0);

      // Setelah 45 dtk, otomatis kembali ke ambient
      expect(novaState.workStatus).toBe('idle');
      expect(novaState.currentLayer).toBe('ambient');
    });

    it('memverifikasi task failed memicu Bastion datang mengecek jika idle', () => {
      const bastionChar = characterManager.getCharacter('bastion')!;
      const initialGx = bastionChar.gx;
      const initialGy = bastionChar.gy;

      const failedState: AgentState = {
        id: 'oracle',
        name: 'Oracle',
        role: 'Scientist',
        presence: 'on_duty',
        work: 'failed',
        since: Math.floor(Date.now() / 1000),
        done_today: 0,
        zone: 'Z06',
        action: 'Crash experiment',
        grid_x: 6,
        grid_y: 13,
        direction: 'SE',
        task: {
          id: 'task_oracle_crash',
          title: 'Simulasi Hipotesis',
          board: 'office-v2',
          status: 'failed',
          block_kind: null,
          started_at: Math.floor(Date.now() / 1000),
        },
      };

      officeStore.getState().updateAgentDelta(failedState);

      // Bastion harus mulai bergerak mendekati Oracle
      expect(bastionChar.fsmState).toBe('walk');

      choreographer.simulate(10, 0.5);

      const dist = Math.hypot(bastionChar.gx - initialGx, bastionChar.gy - initialGy);
      expect(dist).toBeGreaterThan(1.0); // Bastion terbukti berpindah posisi menuju lokasi kejadian
    });
  });

  // =========================================================================
  // Pengujian Event Kolektif V1 (Rapat dan Break Time)
  // =========================================================================
  describe('Event Kolektif V1: Rapat dan Break Time', () => {
    it('menempatkan presenter di slot_z02_presenter dan anggota di kursi Boardroom Z02', () => {
      const rapatEvent: CollectiveEventState = {
        id: 'collective_rapat_1',
        kind: 'rapat',
        title: 'Rapat Sinkronisasi Fase 1',
        started_at: Math.floor(Date.now() / 1000),
        expires_at: Math.floor(Date.now() / 1000) + 600,
        participants: [],
        active: true,
      };

      officeStore.getState().updateCollective(rapatEvent);

      const collectiveMgr = choreographer.getCollectiveManager();
      const presenterAssign = collectiveMgr.getAssignment('jarvis');

      expect(presenterAssign).toBeDefined();
      expect(presenterAssign?.role).toBe('presenter');
      expect(presenterAssign?.slot.id).toBe('slot_z02_presenter');

      const daedalusAssign = collectiveMgr.getAssignment('daedalus');
      expect(daedalusAssign).toBeDefined();
      expect(daedalusAssign?.role).toBe('attendee');
      expect(daedalusAssign?.slot.zone).toBe('Z02');
    });

    it('mendistribusikan agen ke Kafetaria & Lounge Z14 saat event break aktif', () => {
      const breakEvent: CollectiveEventState = {
        id: 'collective_break_1',
        kind: 'break',
        title: 'Coffee Break & Istirahat',
        started_at: Math.floor(Date.now() / 1000),
        expires_at: Math.floor(Date.now() / 1000) + 600,
        participants: [],
        active: true,
      };

      officeStore.getState().updateCollective(breakEvent);

      const collectiveMgr = choreographer.getCollectiveManager();
      const participants = Array.from(characterManager.getAllCharacters())
        .map((c) => collectiveMgr.getAssignment(c.id))
        .filter((a): a is NonNullable<typeof a> => a !== undefined);

      expect(participants.length).toBeGreaterThan(0);
      for (const p of participants) {
        expect(p.slot.zone).toBe('Z14');
      }
    });
  });
});
