import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { GridMap } from '../../navigation/GridMap';
import { AStarPathfinder } from '../../navigation/AStarPathfinder';
import { SlotReservationManager } from '../../navigation/SlotReservationManager';
import { CharacterManager, AGENT_SPAWN_DEFS } from '../CharacterManager';
import { Character } from '../Character';
import { Choreographer } from '../choreographer/Choreographer';
import { EasterEggManager, KONAMI_SEQUENCE } from './EasterEggManager';
import { officeStore } from '../../store/officeStore';
import type { AgentState, TaskRef } from '../../types/office';
import type { InteractionSlot } from '../types';

const sampleTask = (id: string, title: string): TaskRef => ({
  id,
  title,
  board: 'office-v2',
  status: 'running',
});

const makeAgentState = (
  id: string,
  work: 'idle' | 'working' = 'working',
  task?: TaskRef,
): AgentState => ({
  id: id as AgentState['id'],
  name: id,
  role: 'Worker',
  presence: 'on_duty',
  work,
  since: Math.floor(Date.now() / 1000),
  task: task ?? null,
  zone: 'Z08',
  action: 'Working',
  done_today: 0,
});

describe('T2.7 Easter Egg (F26) & Invariant Penegakan Task Nyata', () => {
  const mapPath = path.resolve(__dirname, '../../../public/maps/floor1.tmj');
  const rawMap = JSON.parse(fs.readFileSync(mapPath, 'utf-8'));

  let gridMap: GridMap;
  let pathfinder: AStarPathfinder;
  let slotManager: SlotReservationManager;
  let characterManager: CharacterManager;
  let choreographer: Choreographer;
  let easterEggManager: EasterEggManager;

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

    easterEggManager = new EasterEggManager({
      characterManager,
      choreographer,
    });
  });

  afterEach(() => {
    easterEggManager.destroy();
    choreographer.destroy();
    characterManager.destroy();
    officeStore.getState().reset();
  });

  // =========================================================================
  // Easter Egg 1: Kode Konami → Semua agent menari 5 dtk
  // =========================================================================
  describe('Easter Egg 1: Kode Konami', () => {
    it('memicu tarian semua agent selama 5 detik saat sequence Konami lengkap dimasukkan', () => {
      // Simulasikan penekanan tombol sequence Konami satu per satu
      for (let i = 0; i < KONAMI_SEQUENCE.length - 1; i++) {
        const consumed = easterEggManager.handleKeyDown({ key: KONAMI_SEQUENCE[i] });
        expect(consumed).toBe(false);
        expect(easterEggManager.getState().isKonamiActive).toBe(false);
      }

      // Tombol terakhir ('a') menyelesaikan sequence
      const finished = easterEggManager.handleKeyDown({ key: 'a' });
      expect(finished).toBe(true);

      const state = easterEggManager.getState();
      expect(state.isKonamiActive).toBe(true);
      expect(state.konamiRemaining).toBeCloseTo(5.0);

      // Verifikasi seluruh karakter memainkan animasi celebrate
      for (const char of characterManager.getAllCharacters()) {
        expect(char.getCurrentAnimation()).toBe('celebrate');
      }

      // Simulasi waktu 3 detik berlalu -> masih menari
      easterEggManager.update(3.0);
      expect(easterEggManager.getState().isKonamiActive).toBe(true);
      expect(easterEggManager.getState().konamiRemaining).toBeCloseTo(2.0);

      // Simulasi sisa waktu 2.1 detik berlalu -> selesai menari dan kembali normal
      easterEggManager.update(2.1);
      expect(easterEggManager.getState().isKonamiActive).toBe(false);

      // Verifikasi karakter kembali ke animasi idle/act/sit_type
      for (const char of characterManager.getAllCharacters()) {
        expect(char.getCurrentAnimation()).not.toBe('celebrate');
      }
    });

    it('reset index sequence jika ada tombol yang salah ditekan di tengah', () => {
      easterEggManager.handleKeyDown({ key: 'arrowup' });
      easterEggManager.handleKeyDown({ key: 'arrowup' });
      // Tekan tombol salah
      easterEggManager.handleKeyDown({ key: 'x' });
      expect(easterEggManager.getState().isKonamiActive).toBe(false);

      // Mulai ulang dari awal
      for (const k of KONAMI_SEQUENCE) {
        easterEggManager.handleKeyDown({ key: k });
      }
      expect(easterEggManager.getState().isKonamiActive).toBe(true);
    });

    it('INVARIANT: Kode Konami TIDAK PERNAH menutupi atau menyembunyikan status task nyata', () => {
      // Pasang agent Forge sedang mengerjakan task nyata
      const forge = characterManager.getCharacter('forge')!;
      forge.setWorkStatus('working', sampleTask('t_backend', 'Task Nyata Backend'));
      expect(forge.badgeContainer.visible).toBe(true);
      expect(forge.workStatus).toBe('working');

      // Picu kode Konami
      easterEggManager.triggerKonamiCode();

      // INVARIANT: Badge task nyata Forge tetap WAJIB menyala dan terlihat
      expect(forge.badgeContainer.visible).toBe(true);
      expect(forge.workStatus).toBe('working');

      // Update ticker per frame: badge tetap wajib menyala
      easterEggManager.update(2.5);
      expect(forge.badgeContainer.visible).toBe(true);
      expect(forge.workStatus).toBe('working');

      // Setelah 5 detik tarian selesai
      easterEggManager.update(3.0);
      expect(forge.badgeContainer.visible).toBe(true);
      expect(forge.workStatus).toBe('working');
      expect(forge.getCurrentAnimation()).toBe('sit_type');
    });
  });

  // =========================================================================
  // Easter Egg 2: Klik Oracle 10× → Ledakan kecil konfeti kimia & rambut berdiri
  // =========================================================================
  describe('Easter Egg 2: Klik Oracle 10x', () => {
    it('memicu konfeti kimia dan rambut berdiri hanya saat diklik genap 10 kali', () => {
      const burstSpy = vi.fn();
      const egg = new EasterEggManager({
        characterManager,
        choreographer,
        onConfettiBurst: burstSpy,
      });

      const oracle = characterManager.getCharacter('oracle')!;

      // Klik 1 sampai 9 kali -> belum terpicu
      for (let i = 1; i <= 9; i++) {
        const res = egg.handleOracleClick();
        expect(res.count).toBe(i);
        expect(res.triggered).toBe(false);
        expect(burstSpy).not.toHaveBeenCalled();
      }

      // Klik ke-10 -> terpicu!
      const res10 = egg.handleOracleClick();
      expect(res10.count).toBe(10);
      expect(res10.triggered).toBe(true);
      expect(burstSpy).toHaveBeenCalledTimes(1);

      // Rambut berdiri: memainkan animasi eureka
      expect(oracle.getCurrentAnimation()).toBe('eureka');
      expect(egg.getState().oracleShockRemaining).toBeCloseTo(4.0);

      // Dialog gelembung terkirim
      const recentBubbles = choreographer.getRecentBubbles();
      const oracleBubble = recentBubbles.find((b) => b.agentId === 'oracle');
      expect(oracleBubble).toBeDefined();
      expect(oracleBubble?.text).toContain('Rambutku berdiri');

      // Setelah 4 detik, animasi rambut berdiri kembali normal
      egg.update(4.2);
      expect(egg.getState().oracleShockRemaining).toBe(0);
      expect(oracle.getCurrentAnimation()).not.toBe('eureka');

      egg.destroy();
    });

    it('INVARIANT: Klik Oracle 10x mempertahankan badge task nyata jika Oracle sedang bekerja', () => {
      const oracle = characterManager.getCharacter('oracle')!;
      oracle.setWorkStatus('working', sampleTask('t_model', 'Riset Model AI'));
      expect(oracle.badgeContainer.visible).toBe(true);

      for (let i = 1; i <= 10; i++) {
        easterEggManager.handleOracleClick();
      }

      // INVARIANT: Badge task nyata Oracle tetap terlihat
      expect(oracle.badgeContainer.visible).toBe(true);
      expect(oracle.workStatus).toBe('working');

      easterEggManager.update(4.5);
      expect(oracle.badgeContainer.visible).toBe(true);
      expect(oracle.workStatus).toBe('working');
      expect(oracle.getCurrentAnimation()).toBe('sit_type');
    });
  });

  // =========================================================================
  // Easter Egg 3: Steward memperbaiki tile glitch (lelucon meta)
  // =========================================================================
  describe('Easter Egg 3: Steward Tile Glitch', () => {
    it('menjalankan perbaikan tile glitch di Graphics Lab dan memancarkan dialog meta', () => {
      const steward = characterManager.getCharacter('steward')!;
      expect(steward.workStatus).toBe('idle');

      const triggered = easterEggManager.triggerStewardGlitchRepair();
      expect(triggered).toBe(true);
      expect(easterEggManager.getState().isGlitchTileActive).toBe(true);

      // Dialog meta: "dia yang membangun kantor ini"
      const recentBubbles = choreographer.getRecentBubbles();
      const stewardBubble = recentBubbles.find((b) => b.agentId === 'steward');
      expect(stewardBubble).toBeDefined();
      expect(stewardBubble?.text).toContain('Memperbaiki tile glitch');
      expect(stewardBubble?.text).toContain('bangun kantor ini');

      // Update waktu hingga glitch selesai diperbaiki
      easterEggManager.update(6.5);
      expect(easterEggManager.getState().isGlitchTileActive).toBe(false);
    });

    it('INVARIANT: Steward menolak memperbaiki tile glitch jika sedang ada task nyata', () => {
      const steward = characterManager.getCharacter('steward')!;
      steward.setWorkStatus('working', sampleTask('t_tiles', 'Sprite Produksi'));

      const triggered = easterEggManager.triggerStewardGlitchRepair();
      expect(triggered).toBe(false);
      expect(easterEggManager.getState().isGlitchTileActive).toBe(false);
      expect(steward.badgeContainer.visible).toBe(true);
    });

    it('INVARIANT: Jika task nyata tiba saat Steward sedang memperbaiki glitch, glitch dibatalkan', () => {
      const steward = characterManager.getCharacter('steward')!;
      easterEggManager.triggerStewardGlitchRepair();
      expect(easterEggManager.getState().isGlitchTileActive).toBe(true);

      // Task nyata tiba untuk Steward
      steward.setWorkStatus('working', sampleTask('t_urgent', 'Perbaikan Mendesak'));
      easterEggManager.update(0.1);

      // INVARIANT: Glitch dinonaktifkan, task nyata menang
      expect(easterEggManager.getState().isGlitchTileActive).toBe(false);
      expect(steward.badgeContainer.visible).toBe(true);
      expect(steward.workStatus).toBe('working');
    });
  });

  // =========================================================================
  // Easter Egg 4: No Deploy Friday (Jumat setelah 16.00 WIB di Release Dock)
  // =========================================================================
  describe('Easter Egg 4: No Deploy Friday', () => {
    it('mengaktifkan status dan stiker No Deploy Friday pada Jumat setelah 16.00 WIB', () => {
      // Jumat 16.30 WIB (UTC+7 -> UTC 09.30)
      // 2026-10-09 adalah hari Jumat
      const friday1630Wib = new Date('2026-10-09T09:30:00Z');
      expect(easterEggManager.isNoDeployFriday(friday1630Wib)).toBe(true);

      const triggered = easterEggManager.checkNoDeployFriday(friday1630Wib);
      expect(triggered).toBe(true);
      expect(easterEggManager.getState().isNoDeployFridayActive).toBe(true);

      const recentBubbles = choreographer.getRecentBubbles();
      const relayBubble = recentBubbles.find((b) => b.agentId === 'relay');
      expect(relayBubble).toBeDefined();
      expect(relayBubble?.text).toContain('No Deploy Friday');
    });

    it('tidak aktif pada hari selain Jumat atau sebelum pukul 16.00 WIB', () => {
      // Jumat 14.00 WIB
      const friday1400Wib = new Date('2026-10-09T07:00:00Z');
      expect(easterEggManager.isNoDeployFriday(friday1400Wib)).toBe(false);

      // Kamis 17.00 WIB
      const thursday1700Wib = new Date('2026-10-08T10:00:00Z');
      expect(easterEggManager.isNoDeployFriday(thursday1700Wib)).toBe(false);

      // Sabtu 17.00 WIB
      const saturday1700Wib = new Date('2026-10-10T10:00:00Z');
      expect(easterEggManager.isNoDeployFriday(saturday1700Wib)).toBe(false);
    });

    it('INVARIANT: Relay tetap memproses release nyata meski No Deploy Friday aktif', () => {
      const friday1700Wib = new Date('2026-10-09T10:00:00Z');
      easterEggManager.checkNoDeployFriday(friday1700Wib);
      expect(easterEggManager.getState().isNoDeployFridayActive).toBe(true);

      const relay = characterManager.getCharacter('relay')!;
      // Task release nyata masuk
      relay.setWorkStatus('working', sampleTask('t_rel', 'Rilis Patch Darurat'));

      // INVARIANT: Task nyata tetap tampil sah dan tidak tersembunyi
      expect(relay.badgeContainer.visible).toBe(true);
      expect(relay.workStatus).toBe('working');

      easterEggManager.update(1.0);
      expect(relay.badgeContainer.visible).toBe(true);
    });
  });

  // =========================================================================
  // Easter Egg 5: Pukul 03.00 WIB Lounge Sleep saat tidak ada task berjalan
  // =========================================================================
  describe('Easter Egg 5: Pukul 03.00 WIB Lounge Sleep', () => {
    it('mengirim satu agent tertidur di sofa lounge pada pukul 03.00 WIB jika kantor hening tanpa task', () => {
      // 03.30 WIB (UTC 20.30 hari sebelumnya)
      const wib0330 = new Date('2026-10-09T20:30:00Z');
      expect(easterEggManager.is3AmWib(wib0330)).toBe(true);
      expect(easterEggManager.hasNoRunningTasks()).toBe(true);

      const triggered = easterEggManager.checkLoungeSleep(wib0330);
      expect(triggered).toBe(true);

      const sleepingId = easterEggManager.getState().sleepingAgentId;
      expect(sleepingId).not.toBeNull();
      expect(sleepingId).not.toBe('rifqi');

      const sleepingChar = characterManager.getCharacter(sleepingId!)!;
      expect(sleepingChar.gx).toBe(17);
      expect(sleepingChar.gy).toBe(24);
      expect(sleepingChar.getCurrentAnimation()).toBe('sit_type');

      const recentBubbles = choreographer.getRecentBubbles();
      const zzzBubble = recentBubbles.find((b) => b.agentId === sleepingId);
      expect(zzzBubble).toBeDefined();
      expect(zzzBubble?.text).toBe('Zzz...');
    });

    it('INVARIANT: Jika ada task berjalan pada pukul 03.00 WIB, agent TIDAK tidur di sofa', () => {
      const wib0330 = new Date('2026-10-09T20:30:00Z');

      // Pasang satu task aktif di store
      officeStore.getState().updateAgentDelta(
        makeAgentState('bastion', 'working', sampleTask('t_soc', 'Audit SOC Malam')),
      );

      expect(easterEggManager.hasNoRunningTasks()).toBe(false);

      const triggered = easterEggManager.checkLoungeSleep(wib0330);
      expect(triggered).toBe(false);
      expect(easterEggManager.getState().sleepingAgentId).toBeNull();
    });

    it('INVARIANT: Jika task nyata mulai saat agent sedang tidur, agent SEGERA dibangunkan', () => {
      const wib0330 = new Date('2026-10-09T20:30:00Z');
      easterEggManager.checkLoungeSleep(wib0330);

      const sleepingId = easterEggManager.getState().sleepingAgentId!;
      expect(sleepingId).toBeTruthy();

      // Task nyata tiba!
      officeStore.getState().updateAgentDelta(
        makeAgentState(sleepingId, 'working', sampleTask('t_night_shift', 'Pekerjaan Malam Mendadak')),
      );

      // Update ticker per frame
      easterEggManager.update(0.1);

      // INVARIANT: Agent langsung bangun, sleepingAgentId ter-reset ke null
      expect(easterEggManager.getState().sleepingAgentId).toBeNull();
    });
  });

  // =========================================================================
  // Easter Egg 6: Klik Mesin Espresso Kafetaria
  // =========================================================================
  describe('Easter Egg 6: Klik Mesin Espresso', () => {
    it('menghitung cangkir kopi dan Jarvis mengucapkan jumlah kopi yang diminum hari ini', () => {
      // Tambahkan event task_done ke store
      officeStore.getState().appendOfficeEvent({
        seq: 101,
        ts: Math.floor(Date.now() / 1000),
        board: 'office-v2',
        kind: 'task_done',
        message: 'Task 1 selesai',
      });
      officeStore.getState().appendOfficeEvent({
        seq: 102,
        ts: Math.floor(Date.now() / 1000),
        board: 'office-v2',
        kind: 'task_done',
        message: 'Task 2 selesai',
      });

      // Klik mesin espresso via koordinat grid Kafetaria (gx: 13, gy: 23)
      const handled = easterEggManager.handleGridClick(13, 23);
      expect(handled).toBe(true);

      const recentBubbles = choreographer.getRecentBubbles();
      const jarvisBubble = recentBubbles.find((b) => b.agentId === 'jarvis');
      expect(jarvisBubble).toBeDefined();
      expect(jarvisBubble?.text).toContain('Tercatat');
      expect(jarvisBubble?.text).toContain('cangkir kopi telah diminum kantor hari ini');

      // Minimal 3 cangkir (2 task_done + 1 klik)
      expect(jarvisBubble?.text).toContain('3 cangkir');
    });

    it('INVARIANT: Klik mesin espresso TIDAK menyembunyikan atau mengganggu task nyata Jarvis', () => {
      const jarvis = characterManager.getCharacter('jarvis')!;
      jarvis.setWorkStatus('working', sampleTask('t_orchestrator', 'Sprint Review'));
      expect(jarvis.badgeContainer.visible).toBe(true);

      easterEggManager.handleEspressoClick();

      // INVARIANT: Status task Jarvis tetap working dan badge tetap aktif
      expect(jarvis.badgeContainer.visible).toBe(true);
      expect(jarvis.workStatus).toBe('working');
    });
  });

  // =========================================================================
  // PENEGAKAN INVARIANT LINTAS-FITUR
  // =========================================================================
  describe('Penegakan Invariant Mutlak: Tidak Ada Easter Egg Yang Menutupi Status Task Nyata', () => {
    it('memastikan badge seluruh agent yang sedang working selalu terjaga visible = true', () => {
      const nova = characterManager.getCharacter('nova')!;
      const sentinel = characterManager.getCharacter('sentinel')!;

      nova.setWorkStatus('working', sampleTask('t_dev', 'Fitur Nova'));
      sentinel.setWorkStatus('working', sampleTask('t_qa', 'Audit Sentinel'));

      expect(nova.badgeContainer.visible).toBe(true);
      expect(sentinel.badgeContainer.visible).toBe(true);

      // Jalankan seluruh trigger easter egg secara bersamaan
      easterEggManager.triggerKonamiCode();
      easterEggManager.triggerNoDeployFriday();
      easterEggManager.handleEspressoClick();

      // Invariant enforcement berjalan di update
      easterEggManager.update(1.0);

      expect(nova.badgeContainer.visible).toBe(true);
      expect(sentinel.badgeContainer.visible).toBe(true);
      expect(nova.workStatus).toBe('working');
      expect(sentinel.workStatus).toBe('working');
    });
  });
});
