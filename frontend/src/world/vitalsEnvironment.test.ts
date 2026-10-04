import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { OfficeMapLoader, LoadedOfficeMap } from './mapLoader';
import { CharacterManager } from './CharacterManager';
import { Choreographer } from './Choreographer';
import { GridMap } from '../navigation/GridMap';
import { AStarPathfinder } from '../navigation/AStarPathfinder';
import { SlotReservationManager } from '../navigation/SlotReservationManager';
import { VitalsEnvironmentManager } from './VitalsEnvironmentManager';
import { officeStore } from '../store/officeStore';
import { VITALS_FIXTURES } from '../fixtures/vitals_fixtures';

describe('T2.4 Vitals → Perubahan Lingkungan (F23)', () => {
  const mapPath = path.resolve(__dirname, '../../public/maps/floor1.tmj');
  const rawMap = JSON.parse(fs.readFileSync(mapPath, 'utf-8'));

  let loadedMap: LoadedOfficeMap;
  let gridMap: GridMap;
  let pathfinder: AStarPathfinder;
  let slotManager: SlotReservationManager;
  let characterManager: CharacterManager;
  let choreographer: Choreographer;
  let vitalsManager: VitalsEnvironmentManager;

  beforeEach(() => {
    officeStore.getState().reset();

    loadedMap = OfficeMapLoader.loadFromDoc(rawMap);
    gridMap = new GridMap(rawMap);
    pathfinder = new AStarPathfinder(gridMap);
    slotManager = new SlotReservationManager(gridMap);
    characterManager = new CharacterManager(loadedMap);

    // Spawn seluruh agen ke meja masing-masing
    characterManager.spawnAllAgents();

    choreographer = new Choreographer({
      characterManager,
      gridMap,
      pathfinder,
      slotManager,
    });
    choreographer.init();

    vitalsManager = new VitalsEnvironmentManager({
      loadedMap,
      characterManager,
      choreographer,
    });
  });

  afterEach(() => {
    vitalsManager.destroy();
    choreographer.destroy();
    characterManager.destroy();
  });

  describe('Kondisi Baseline / Normal (VITALS_FIXTURES.normal)', () => {
    it('memastikan tidak ada ambang batas alert yang aktif saat telemetri normal', () => {
      vitalsManager.update(1.0, VITALS_FIXTURES.normal);

      const status = vitalsManager.getStatus();
      expect(status.isCpuAlert).toBe(false);
      expect(status.isRamAlert).toBe(false);
      expect(status.isDiskAlert).toBe(false);

      expect(vitalsManager.isCpuAlertActive()).toBe(false);
      expect(vitalsManager.isRamAlertActive()).toBe(false);
      expect(vitalsManager.isDiskAlertActive()).toBe(false);

      // 1. Rak server: kedip normal, tidak menyala oranye
      expect(vitalsManager.isLedBlinkingFast()).toBe(false);
      const racks = vitalsManager.getServerRacks();
      expect(racks.length).toBe(6);
      for (const rack of racks) {
        expect(rack.tint).toBe(0xffffff);
      }

      // 2. Kipas AC: rotasi normal / idle
      expect(vitalsManager.isAcFanSpinning()).toBe(false);

      // 3. Bastion: tidak berkeringat
      const bastion = characterManager.getCharacter('bastion');
      expect(bastion?.isSweating).toBe(false);
      expect(vitalsManager.isBastionSweating()).toBe(false);

      // 4. Vector: tidak mondar-mandir
      expect(vitalsManager.isVectorPacing()).toBe(false);

      // 5. Kardus: tidak menumpuk
      expect(vitalsManager.isCardboardPiledUp()).toBe(false);
      expect(vitalsManager.getCardboardBoxCount()).toBe(0);
    });
  });

  describe('Ambang CPU: > 80% selama 60 dtk (VITALS_FIXTURES.cpuHigh)', () => {
    it('tidak memicu CPU alert jika CPU > 80% tetapi durasi kumulatif < 60 detik', () => {
      // Simulasi CPU tinggi selama 30 detik
      vitalsManager.update(30.0, VITALS_FIXTURES.cpuHigh);

      const status = vitalsManager.getStatus();
      expect(status.cpuPercent).toBe(VITALS_FIXTURES.cpuHigh.cpu_percent);
      expect(status.cpuHighDuration).toBe(30.0);
      expect(status.isCpuAlert).toBe(false);

      expect(vitalsManager.isCpuAlertActive()).toBe(false);
      expect(vitalsManager.isLedBlinkingFast()).toBe(false);
      expect(vitalsManager.isAcFanSpinning()).toBe(false);
      expect(vitalsManager.isBastionSweating()).toBe(false);
    });

    it('memicu CPU alert tepat saat durasi kumulatif mencapai >= 60 detik (LED cepat, AC berputar, Bastion berkeringat)', () => {
      // 1. Simulasikan 59 detik: belum aktif
      vitalsManager.update(59.0, VITALS_FIXTURES.cpuHigh);
      expect(vitalsManager.isCpuAlertActive()).toBe(false);

      // 2. Capai 60 detik: aktif penuh
      vitalsManager.update(1.0, VITALS_FIXTURES.cpuHigh);
      expect(vitalsManager.isCpuAlertActive()).toBe(true);

      // Verifikasi Perubahan Lingkungan Dokumen 04:
      // a. LED rak server berkedip cepat
      expect(vitalsManager.isLedBlinkingFast()).toBe(true);

      // b. Kipas AC berputar cepat
      expect(vitalsManager.isAcFanSpinning()).toBe(true);

      // c. Bastion berkeringat
      const bastion = characterManager.getCharacter('bastion');
      expect(bastion).toBeDefined();
      expect(bastion?.isSweating).toBe(true);
      expect(vitalsManager.isBastionSweating()).toBe(true);
      expect(bastion?.sweatContainer?.visible).toBe(true);
    });

    it('mereset durasi kumulatif dan mematikan alert seketika jika CPU turun kembali ke <= 80%', () => {
      // Picu alert dengan 65 detik CPU tinggi
      vitalsManager.update(65.0, VITALS_FIXTURES.cpuHigh);
      expect(vitalsManager.isCpuAlertActive()).toBe(true);
      expect(vitalsManager.isBastionSweating()).toBe(true);

      // Vitals pulih ke normal
      vitalsManager.update(1.0, VITALS_FIXTURES.recovery);
      const status = vitalsManager.getStatus();
      expect(status.cpuHighDuration).toBe(0);
      expect(status.isCpuAlert).toBe(false);
      expect(vitalsManager.isCpuAlertActive()).toBe(false);
      expect(vitalsManager.isLedBlinkingFast()).toBe(false);
      expect(vitalsManager.isAcFanSpinning()).toBe(false);

      const bastion = characterManager.getCharacter('bastion');
      expect(bastion?.isSweating).toBe(false);
      expect(bastion?.sweatContainer?.visible).toBe(false);
    });
  });

  describe('Ambang RAM: > 85% (VITALS_FIXTURES.ramHigh)', () => {
    it('langsung memicu alert RAM saat memori > 85% (rak menyala oranye & Vector mondar-mandir)', () => {
      vitalsManager.update(1.0, VITALS_FIXTURES.ramHigh);

      expect(vitalsManager.isRamAlertActive()).toBe(true);

      // 1. Rak server menyala oranye
      const racks = vitalsManager.getServerRacks();
      expect(racks.length).toBe(6);
      for (const rack of racks) {
        expect(rack.tint).toBe(0xffa500); // Oranye menyala
      }

      // 2. Vector mondar-mandir di Data Center
      expect(vitalsManager.isVectorPacing()).toBe(true);
      const vectorState = choreographer.getAgentState('vector');
      expect(vectorState?.currentActivityKey).toBe('vector_ram_pacing');
      expect(vectorState?.currentLayer).toBe('task');

      const vectorChar = characterManager.getCharacter('vector');
      expect(vectorChar).toBeDefined();
      expect(vectorChar?.fsmState).toBe('walk');
    });

    it('memulihkan rak server ke warna asli dan menghentikan Vector saat RAM turun ke <= 85%', () => {
      // 1. Aktifkan alert RAM
      vitalsManager.update(1.0, VITALS_FIXTURES.ramHigh);
      expect(vitalsManager.isRamAlertActive()).toBe(true);

      // 2. Kirim vitals normal/recovery
      vitalsManager.update(1.0, VITALS_FIXTURES.recovery);
      expect(vitalsManager.isRamAlertActive()).toBe(false);

      // Rak kembali netral putih
      const racks = vitalsManager.getServerRacks();
      for (const rack of racks) {
        expect(rack.tint).toBe(0xffffff);
      }

      // Vector berhenti mondar-mandir dan diarahkan kembali ke meja
      expect(vitalsManager.isVectorPacing()).toBe(false);
      const vectorState = choreographer.getAgentState('vector');
      expect(vectorState?.currentActivityKey).toBe('ambient_idle');
    });
  });

  describe('Ambang Disk: > 85% (VITALS_FIXTURES.diskHigh)', () => {
    it('menumpuk kardus di Data Center saat penggunaan disk > 85%', () => {
      vitalsManager.update(1.0, VITALS_FIXTURES.diskHigh);

      expect(vitalsManager.isDiskAlertActive()).toBe(true);
      expect(vitalsManager.isCardboardPiledUp()).toBe(true);
      expect(vitalsManager.getCardboardBoxCount()).toBe(6);
    });

    it('membersihkan tumpukan kardus di Data Center saat penggunaan disk kembali normal <= 85%', () => {
      vitalsManager.update(1.0, VITALS_FIXTURES.diskHigh);
      expect(vitalsManager.isCardboardPiledUp()).toBe(true);

      vitalsManager.update(1.0, VITALS_FIXTURES.recovery);
      expect(vitalsManager.isDiskAlertActive()).toBe(false);
      expect(vitalsManager.isCardboardPiledUp()).toBe(false);
      expect(vitalsManager.getCardboardBoxCount()).toBe(0);
    });
  });

  describe('Kondisi Beban Puncak Seluruh Ambang (VITALS_FIXTURES.allHigh)', () => {
    it('mengaktifkan seluruh perubahan lingkungan secara simultan saat semua ambang terlampaui', () => {
      // Update selama 60 detik dengan kondisi beban puncak kritis
      vitalsManager.update(60.0, VITALS_FIXTURES.allHigh);

      const status = vitalsManager.getStatus();
      expect(status.isCpuAlert).toBe(true);
      expect(status.isRamAlert).toBe(true);
      expect(status.isDiskAlert).toBe(true);

      // Efek CPU
      expect(vitalsManager.isLedBlinkingFast()).toBe(true);
      expect(vitalsManager.isAcFanSpinning()).toBe(true);
      expect(vitalsManager.isBastionSweating()).toBe(true);

      // Efek RAM
      expect(vitalsManager.isRamAlertActive()).toBe(true);
      expect(vitalsManager.isVectorPacing()).toBe(true);
      const racks = vitalsManager.getServerRacks();
      for (const rack of racks) {
        expect(rack.tint).toBe(0xffa500);
      }

      // Efek Disk
      expect(vitalsManager.isCardboardPiledUp()).toBe(true);
      expect(vitalsManager.getCardboardBoxCount()).toBe(6);

      // Uji pemulihan total dengan recovery fixture
      vitalsManager.update(1.0, VITALS_FIXTURES.recovery);
      const recStatus = vitalsManager.getStatus();
      expect(recStatus.isCpuAlert).toBe(false);
      expect(recStatus.isRamAlert).toBe(false);
      expect(recStatus.isDiskAlert).toBe(false);

      expect(vitalsManager.isBastionSweating()).toBe(false);
      expect(vitalsManager.isVectorPacing()).toBe(false);
      expect(vitalsManager.isCardboardPiledUp()).toBe(false);
      for (const rack of racks) {
        expect(rack.tint).toBe(0xffffff);
      }
    });
  });

  describe('Integrasi Store Vanilla & WorldApp', () => {
    it('membaca vitals secara mulus dari updateVitals officeStore', () => {
      officeStore.getState().updateVitals(VITALS_FIXTURES.ramHigh);
      const storeVitals = officeStore.getState().vitals;
      expect(storeVitals).toEqual(VITALS_FIXTURES.ramHigh);

      vitalsManager.update(1.0, storeVitals);
      expect(vitalsManager.isRamAlertActive()).toBe(true);
      expect(vitalsManager.isVectorPacing()).toBe(true);
    });
  });

  describe('Fokus Kontrol Unit & True Monotonic Elapsed Time (T2.9-R1)', () => {
    it('mengakumulasi durasi CPU kontinu menggunakan true monotonic clock saat mode monotonic aktif', () => {
      let mockTime = 1000.0;
      vitalsManager.setMonotonicClock(() => mockTime);

      // Frame 1: CPU tinggi mulai terdeteksi
      vitalsManager.update(1 / 60, VITALS_FIXTURES.cpuHigh);
      expect(vitalsManager.getStatus().cpuHighDuration).toBe(0);
      expect(vitalsManager.isCpuAlertActive()).toBe(false);

      // 30 detik kemudian: durasi kontinu bertambah 30 dtk, belum memicu alert (< 60 dtk)
      mockTime = 1030.0;
      vitalsManager.update(1 / 60, VITALS_FIXTURES.cpuHigh);
      expect(vitalsManager.getStatus().cpuHighDuration).toBe(30.0);
      expect(vitalsManager.isCpuAlertActive()).toBe(false);

      // 60.5 detik kemudian: durasi kontinu mencapai >= 60 dtk, alert aktif penuh
      mockTime = 1060.5;
      vitalsManager.update(1 / 60, VITALS_FIXTURES.cpuHigh);
      expect(vitalsManager.getStatus().cpuHighDuration).toBe(60.5);
      expect(vitalsManager.isCpuAlertActive()).toBe(true);
      expect(vitalsManager.isLedBlinkingFast()).toBe(true);
      expect(vitalsManager.isAcFanSpinning()).toBe(true);
      expect(vitalsManager.isBastionSweating()).toBe(true);
    });

    it('mereset durasi kontinu dan mematikan alert seketika jika telemetri vitals hilang (null/missing)', () => {
      let mockTime = 1000.0;
      vitalsManager.setMonotonicClock(() => mockTime);

      vitalsManager.update(1 / 60, VITALS_FIXTURES.cpuHigh);
      mockTime = 1065.0;
      vitalsManager.update(1 / 60, VITALS_FIXTURES.cpuHigh);
      expect(vitalsManager.isCpuAlertActive()).toBe(true);

      // Telemetri terputus/hilang (null)
      vitalsManager.update(1 / 60, null);
      expect(vitalsManager.getStatus().cpuHighDuration).toBe(0);
      expect(vitalsManager.isCpuAlertActive()).toBe(false);
      expect(vitalsManager.isBastionSweating()).toBe(false);
      expect(vitalsManager.isLedBlinkingFast()).toBe(false);
      expect(vitalsManager.isAcFanSpinning()).toBe(false);
    });

    it('mereset durasi kontinu dan mematikan alert seketika jika telemetri vitals stale', () => {
      let mockTime = 1000.0;
      vitalsManager.setMonotonicClock(() => mockTime);

      vitalsManager.update(1 / 60, VITALS_FIXTURES.cpuHigh);
      mockTime = 1065.0;
      vitalsManager.update(1 / 60, VITALS_FIXTURES.cpuHigh);
      expect(vitalsManager.isCpuAlertActive()).toBe(true);

      // Kirim vitals dengan penanda status stale
      const staleVitals = { ...VITALS_FIXTURES.cpuHigh, stale: true };
      vitalsManager.update(1 / 60, staleVitals);
      expect(vitalsManager.getStatus().cpuHighDuration).toBe(0);
      expect(vitalsManager.isCpuAlertActive()).toBe(false);

      // Uji focused unit control markStale
      vitalsManager.markStale(true);
      expect(vitalsManager.isStaleVitals()).toBe(true);
      vitalsManager.update(1 / 60, VITALS_FIXTURES.cpuHigh);
      expect(vitalsManager.getStatus().cpuHighDuration).toBe(0);
      expect(vitalsManager.isCpuAlertActive()).toBe(false);
    });

    it('mereset durasi kontinu seketika jika CPU turun ke <= 80% (low vitals)', () => {
      let mockTime = 1000.0;
      vitalsManager.setMonotonicClock(() => mockTime);

      vitalsManager.update(1 / 60, VITALS_FIXTURES.cpuHigh);
      mockTime = 1065.0;
      vitalsManager.update(1 / 60, VITALS_FIXTURES.cpuHigh);
      expect(vitalsManager.isCpuAlertActive()).toBe(true);

      // Kirim vitals normal (CPU 24.5%)
      mockTime = 1066.0;
      vitalsManager.update(1 / 60, VITALS_FIXTURES.normal);
      expect(vitalsManager.getStatus().cpuHighDuration).toBe(0);
      expect(vitalsManager.isCpuAlertActive()).toBe(false);
      expect(vitalsManager.isBastionSweating()).toBe(false);
    });

    it('menjaga pemisahan safe animation delta (dtSec) dari akumulasi waktu CPU kontinu', () => {
      let mockTime = 1000.0;
      vitalsManager.setMonotonicClock(() => mockTime);

      vitalsManager.update(1 / 60, VITALS_FIXTURES.cpuHigh);
      mockTime = 1065.0;

      // Teruskan safe animation delta kecil (mis. 0.016 detik frame delta)
      const safeDtSec = 1 / 60;
      vitalsManager.update(safeDtSec, VITALS_FIXTURES.cpuHigh);

      // Waktu CPU terakumulasi secara monotonic independen dari frame delta
      expect(vitalsManager.getStatus().cpuHighDuration).toBe(65.0);
      expect(vitalsManager.isCpuAlertActive()).toBe(true);
    });
  });
});
