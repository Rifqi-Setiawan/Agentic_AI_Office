import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { GridMap } from '../navigation/GridMap';
import { AStarPathfinder } from '../navigation/AStarPathfinder';
import { SlotReservationManager } from '../navigation/SlotReservationManager';
import { CharacterManager, AGENT_SPAWN_DEFS } from './CharacterManager';
import { Character } from './Character';
import { Choreographer } from './choreographer/Choreographer';
import type { InteractionSlot } from './types';
import { officeStore } from '../store/officeStore';
import type { OfficeEvent } from '../types/office';

describe('T2.2 Reaksi Berbasis Event (F20)', () => {
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

  describe('Reaksi 1: task_commented oleh Jarvis → Jarvis berjalan ke meja assignee dan stand_talk', () => {
    it('menggerakkan Jarvis ke meja assignee dan menjalankan animasi stand_talk saat tiba', () => {
      const jarvis = characterManager.getCharacter('jarvis')!;
      const forgeDeskSlot = gridMap.getSlot('slot_z08_desk_forge')!;

      const event: OfficeEvent = {
        seq: 501,
        ts: Math.floor(Date.now() / 1000),
        board: 'office-v2',
        kind: 'task_commented',
        actor: 'jarvis',
        agent: 'forge',
        message: 'Jarvis menambahkan komentar: Tolong pastikan validasi payload API tuntas.',
        task: {
          id: 't_api_val',
          title: 'Validasi API backend',
          board: 'office-v2',
          status: 'running',
          assignee: 'forge',
        } as unknown as OfficeEvent['task'],
      };

      choreographer.handleOfficeEvent(event);

      const jarvisState = choreographer.getAgentState('jarvis')!;
      expect(jarvisState.currentLayer).toBe('task');
      expect(jarvisState.currentActivityKey).toBe('jarvis_comment_talk');

      // Simulasi perjalanan Jarvis hingga tiba di samping meja Forge
      // Jarak dari ruang CEO ke meja Forge ~25 tile = butuh ~10 detik dengan default speed 2.5
      choreographer.simulate(12, 0.2);

      // Jarvis harus sudah tiba dekat meja Forge
      const distToForgeDesk = Math.hypot(jarvis.gx - forgeDeskSlot.gx, jarvis.gy - forgeDeskSlot.gy);
      expect(distToForgeDesk).toBeLessThanOrEqual(2.0);

      // Verifikasi Jarvis memainkan animasi stand_talk dan status komentar aktif
      expect(jarvis.getCurrentAnimation()).toBe('stand_talk');
      expect(jarvis.isCommenting).toBe(true);

      // Verifikasi bubble dialog koordinasi terbit
      const bubbles = choreographer.getRecentBubbles();
      const jarvisBubble = bubbles.find((b) => b.agentId === 'jarvis');
      expect(jarvisBubble).toBeDefined();
      expect(jarvisBubble?.text).toContain('@forge');

      // Setelah 6 detik stand_talk selesai, Jarvis kembali ke mejanya / ambient
      choreographer.simulate(8, 0.2);
      expect(jarvis.isCommenting).toBe(false);
      expect(jarvisState.currentLayer).toBe('ambient');
      expect(jarvisState.currentActivityKey).not.toBe('jarvis_comment_talk');
    });

    it('mengabaikan komentar dari aktor selain Jarvis', () => {
      const event: OfficeEvent = {
        seq: 502,
        ts: Math.floor(Date.now() / 1000),
        board: 'office-v2',
        kind: 'task_commented',
        actor: 'prism',
        agent: 'forge',
        message: 'Prism menanyakan format CSS',
      };

      choreographer.handleOfficeEvent(event);
      const jarvisState = choreographer.getAgentState('jarvis')!;
      expect(jarvisState.currentActivityKey).not.toBe('jarvis_comment_talk');
    });
  });

  describe('Reaksi 2: task_blocked setelah run Sentinel → stempel merah FAIL', () => {
    it('menampilkan stempel merah FAIL dan memainkan stand_talk pada Sentinel', () => {
      const sentinel = characterManager.getCharacter('sentinel')!;

      const event: OfficeEvent = {
        seq: 503,
        ts: Math.floor(Date.now() / 1000),
        board: 'office-v2',
        kind: 'task_blocked',
        actor: 'sentinel',
        agent: 'sentinel',
        message: 'Sentinel: REQUEST CHANGES — NOT RELEASE READY. Ditemukan 2 regresi P1.',
        task: {
          id: 't_regresi_p1',
          title: 'Uji regresi pipeline',
          board: 'office-v2',
          status: 'blocked',
          block_kind: 'needs_input',
          reviewer: 'sentinel',
        } as unknown as OfficeEvent['task'],
      };

      choreographer.handleOfficeEvent(event);

      const sentinelState = choreographer.getAgentState('sentinel')!;
      expect(sentinelState.currentLayer).toBe('task');
      expect(sentinelState.currentActivityKey).toBe('sentinel_fail_stamp');

      // Verifikasi stempel merah FAIL aktif pada karakter
      expect(sentinel.isShowingFailStamp).toBe(true);
      expect(sentinel.getCurrentAnimation()).toBe('stand_talk');

      // Verifikasi bubble FAIL berstempel diterbitkan
      const bubbles = choreographer.getRecentBubbles();
      const failBubble = bubbles.find((b) => b.agentId === 'sentinel' && b.isStamp);
      expect(failBubble).toBeDefined();
      expect(failBubble?.text).toContain('FAIL');

      // Setelah 6 detik, stempel selesai dan Sentinel kembali normal
      choreographer.simulate(7, 0.2);
      expect(sentinel.isShowingFailStamp).toBe(false);
      expect(sentinelState.currentLayer).toBe('ambient');
      expect(sentinelState.currentActivityKey).not.toBe('sentinel_fail_stamp');
    });

    it('mengabaikan task_blocked jika bukan dari run Sentinel', () => {
      const sentinel = characterManager.getCharacter('sentinel')!;

      const event: OfficeEvent = {
        seq: 504,
        ts: Math.floor(Date.now() / 1000),
        board: 'office-v2',
        kind: 'task_blocked',
        actor: 'prism',
        agent: 'prism',
        message: 'Prism memblokir task karena butuh input desain',
        task: {
          id: 't_ui_task',
          title: 'Desain UI',
          board: 'office-v2',
          status: 'blocked',
          block_kind: 'needs_input',
        } as unknown as OfficeEvent['task'],
      };

      choreographer.handleOfficeEvent(event);
      expect(sentinel.isShowingFailStamp).toBe(false);
    });
  });

  describe('Reaksi 3: task_done dengan branch_name → Relay membawa paket ke konveyor', () => {
    it('membuat Relay membawa paket dan berjalan ke konveyor Release Dock', () => {
      const relay = characterManager.getCharacter('relay')!;
      const conveyorGx = 33;
      const conveyorGy = 15;

      const event: OfficeEvent = {
        seq: 505,
        ts: Math.floor(Date.now() / 1000),
        board: 'office-v2',
        kind: 'task_done',
        actor: 'relay',
        agent: 'relay',
        message: 'Task t_release_pkg selesai dengan branch release/v2.1.0',
        task: {
          id: 't_release_pkg',
          title: 'Paket rilis rilis v2.1.0',
          board: 'office-v2',
          status: 'done',
          branch_name: 'release/v2.1.0',
        } as unknown as OfficeEvent['task'],
      };

      choreographer.handleOfficeEvent(event);

      const relayState = choreographer.getAgentState('relay')!;
      expect(relayState.currentLayer).toBe('task');
      expect(relayState.currentActivityKey).toBe('relay_delivery');

      // Verifikasi Relay sedang memegang paket
      expect(relay.isCarryingParcel).toBe(true);

      // Simulasi Relay berjalan hingga tiba di depan konveyor (gx: 33, gy: 15)
      choreographer.simulate(6, 0.2);

      expect(Math.round(relay.gx)).toBe(conveyorGx);
      expect(Math.round(relay.gy)).toBe(conveyorGy);
      expect(relay.facing).toBe('SE');
      expect(relay.getCurrentAnimation()).toBe('stand_talk');

      // Verifikasi bubble rilis paket diterbitkan
      const bubbles = choreographer.getRecentBubbles();
      const relayBubble = bubbles.find((b) => b.agentId === 'relay');
      expect(relayBubble).toBeDefined();
      expect(relayBubble?.text).toContain('Paket berangkat');

      // Setelah 5 detik di konveyor, paket diletakkan dan Relay kembali ke meja
      choreographer.simulate(6, 0.2);
      expect(relay.isCarryingParcel).toBe(false);
      expect(relayState.currentLayer).toBe('ambient');
      expect(relayState.currentActivityKey).not.toBe('relay_delivery');
    });

    it('tidak memicu pengiriman paket jika task_done tanpa branch_name', () => {
      const relay = characterManager.getCharacter('relay')!;

      const event: OfficeEvent = {
        seq: 506,
        ts: Math.floor(Date.now() / 1000),
        board: 'office-v2',
        kind: 'task_done',
        actor: 'forge',
        agent: 'forge',
        message: 'Forge menyelesaikan task t_nobranch tanpa branch',
        task: {
          id: 't_nobranch',
          title: 'Task lokal',
          board: 'office-v2',
          status: 'done',
          branch_name: null,
        } as unknown as OfficeEvent['task'],
      };

      choreographer.handleOfficeEvent(event);
      expect(relay.isCarryingParcel).toBe(false);
    });
  });

  describe('Reaksi 4: task_failed → Bastion mengecek', () => {
    it('membuat Bastion berjalan memeriksa agen yang mengalami task_failed', () => {
      const bastion = characterManager.getCharacter('bastion')!;
      const vectorDeskSlot = gridMap.getSlot('slot_z12_desk_vector')!;

      const event: OfficeEvent = {
        seq: 507,
        ts: Math.floor(Date.now() / 1000),
        board: 'office-v2',
        kind: 'task_failed',
        actor: 'vector',
        agent: 'vector',
        message: 'Vector mengalami kegagalan eksekusi worker crash SIGSEGV',
        task: {
          id: 't_crash_worker',
          title: 'Worker pipeline',
          board: 'office-v2',
          status: 'failed',
          assignee: 'vector',
        } as unknown as OfficeEvent['task'],
      };

      choreographer.handleOfficeEvent(event);

      const bastionState = choreographer.getAgentState('bastion')!;
      expect(bastionState.currentLayer).toBe('task');
      expect(bastionState.currentActivityKey).toBe('bastion_inspect_failed');
      expect(bastion.isInspecting).toBe(true);

      // Verifikasi bubble Bastion menuju lokasi
      const bubbles = choreographer.getRecentBubbles();
      const bastionBubble = bubbles.find((b) => b.agentId === 'bastion');
      expect(bastionBubble).toBeDefined();
      expect(bastionBubble?.text).toContain('Ada yang jatuh');

      // Simulasi perjalanan Bastion ke meja Vector (keduanya di area Data Center Z12)
      choreographer.simulate(6, 0.2);

      const distToVectorDesk = Math.hypot(bastion.gx - vectorDeskSlot.gx, bastion.gy - vectorDeskSlot.gy);
      expect(distToVectorDesk).toBeLessThanOrEqual(2.0);
      expect(bastion.getCurrentAnimation()).toBe('stand_talk');

      // Setelah selesai cek (6 detik), Bastion kembali ke mejanya
      choreographer.simulate(7, 0.2);
      expect(bastion.isInspecting).toBe(false);
      expect(bastionState.currentLayer).toBe('ambient');
      expect(bastionState.currentActivityKey).not.toBe('bastion_inspect_failed');
    });

    it('Bastion tidak menginspeksi dirinya sendiri jika task Bastion gagal', () => {
      const bastion = characterManager.getCharacter('bastion')!;

      const event: OfficeEvent = {
        seq: 508,
        ts: Math.floor(Date.now() / 1000),
        board: 'office-v2',
        kind: 'task_failed',
        actor: 'bastion',
        agent: 'bastion',
        message: 'Bastion gagal menjalankan audit firewall',
      };

      choreographer.handleOfficeEvent(event);
      expect(bastion.isInspecting).toBe(false);
    });
  });

  describe('Integrasi Otomatis via officeStore.appendOfficeEvent', () => {
    it('memicu reaksi secara otomatis ketika event linimasa baru tiba di store', () => {
      const relay = characterManager.getCharacter('relay')!;

      // Emisi via store Zustand
      officeStore.getState().appendOfficeEvent({
        seq: 9901,
        ts: Math.floor(Date.now() / 1000),
        board: 'office-v2',
        kind: 'task_done',
        agent: 'relay',
        actor: 'relay',
        message: 'Task selesai dengan branch feature/f20',
        task: {
          id: 't_f20_test',
          title: 'Implementasi F20',
          board: 'office-v2',
          status: 'done',
          branch_name: 'feature/f20',
        } as unknown as OfficeEvent['task'],
      });

      const relayState = choreographer.getAgentState('relay')!;
      expect(relayState.currentActivityKey).toBe('relay_delivery');
      expect(relay.isCarryingParcel).toBe(true);
    });
  });
});
