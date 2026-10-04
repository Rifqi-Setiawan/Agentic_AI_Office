import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { GridMap } from '../navigation/GridMap';
import { AStarPathfinder, vectorToFacing } from '../navigation/AStarPathfinder';
import { SlotReservationManager } from '../navigation/SlotReservationManager';
import { CharacterManager, AGENT_SPAWN_DEFS } from './CharacterManager';
import { Character } from './Character';
import { Choreographer } from './Choreographer';
import { worldApp } from './WorldApp';
import { officeStore } from '../store/officeStore';
import type { InteractionSlot } from './types';

describe('T1.19 Rifqi Klik-Untuk-Jalan (Mode Founder & Proteksi Publik)', () => {
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

  // =========================================================================
  // 1. Klik Lantai di Mode Founder
  // =========================================================================
  describe('Mode Founder: Klik lantai -> Rifqi berjalan ke sana', () => {
    it('membuat Rifqi berjalan ke koordinat lantai yang diklik dan tiba dalam status idle', () => {
      officeStore.getState().setFounderAuthenticated(true);
      expect(officeStore.getState().projection).toBe('founder');
      expect(officeStore.getState().isFounderAuthenticated).toBe(true);

      const rifqi = characterManager.getCharacter('rifqi')!;
      // Tempatkan Rifqi di area lounge awal (14, 28)
      rifqi.setGridPosition(14, 28);
      rifqi.idle();

      // Target lantai yang bisa dilalui (misal di koridor 14, 22)
      expect(gridMap.isWalkable(14, 22)).toBe(true);

      const handled = choreographer.handleFloorClick(14, 22);
      expect(handled).toBe(true);
      expect(rifqi.fsmState).toBe('walk');

      // Simulasikan pergerakan
      const dt = 0.1;
      let elapsed = 0;
      while (elapsed < 5.0 && rifqi.fsmState === 'walk') {
        choreographer.update(dt);
        characterManager.update(dt);
        elapsed += dt;
      }

      // Rifqi tiba di tujuan
      expect(rifqi.fsmState).toBe('idle');
      expect(Math.round(rifqi.gx)).toBe(14);
      expect(Math.round(rifqi.gy)).toBe(22);
    });
  });

  // =========================================================================
  // 2. Kriteria Penerimaan 1: Klik di area tak terjangkau tidak membuat Rifqi macet
  // =========================================================================
  describe('Kriteria Penerimaan 1: Klik di area tak terjangkau tidak membuat Rifqi macet', () => {
    it('mengabaikan klik pada tile obstacle/dinding dan Rifqi tetap normal tidak macet', () => {
      officeStore.getState().setFounderAuthenticated(true);

      const rifqi = characterManager.getCharacter('rifqi')!;
      rifqi.setGridPosition(14, 28);
      rifqi.idle();

      // Cari tile collision (dinding)
      let wallGx = 0;
      let wallGy = 0;
      let foundWall = false;
      for (let y = 0; y < gridMap.height; y++) {
        for (let x = 0; x < gridMap.width; x++) {
          if (!gridMap.isWalkable(x, y)) {
            wallGx = x;
            wallGy = y;
            foundWall = true;
            break;
          }
        }
        if (foundWall) break;
      }
      expect(foundWall).toBe(true);

      const handled = choreographer.handleFloorClick(wallGx, wallGy);
      expect(handled).toBe(false);
      expect(rifqi.fsmState).toBe('idle');
      expect(rifqi.gx).toBe(14);
      expect(rifqi.gy).toBe(28);

      // Pastikan setelah klik invalid, Rifqi tetap bisa menerima perintah valid berikutnya
      const validHandled = choreographer.handleFloorClick(14, 27);
      expect(validHandled).toBe(true);
      expect(rifqi.fsmState).toBe('walk');
    });

    it('mengabaikan klik di luar batas grid (out of bounds)', () => {
      officeStore.getState().setFounderAuthenticated(true);

      const rifqi = characterManager.getCharacter('rifqi')!;
      rifqi.setGridPosition(14, 28);
      rifqi.idle();

      const handledNegative = choreographer.handleFloorClick(-5, 10);
      expect(handledNegative).toBe(false);
      expect(rifqi.fsmState).toBe('idle');

      const handledOverflow = choreographer.handleFloorClick(100, 200);
      expect(handledOverflow).toBe(false);
      expect(rifqi.fsmState).toBe('idle');
    });

    it('tidak merusak pergerakan berjalan saat klik area tak terjangkau dilakukan di tengah jalan', () => {
      officeStore.getState().setFounderAuthenticated(true);

      const rifqi = characterManager.getCharacter('rifqi')!;
      rifqi.setGridPosition(14, 28);
      rifqi.idle();

      // Mulai berjalan ke target valid (14, 22)
      const handled = choreographer.handleFloorClick(14, 22);
      expect(handled).toBe(true);
      expect(rifqi.fsmState).toBe('walk');

      // Update 2 frame pergerakan
      choreographer.update(0.1);
      characterManager.update(0.1);
      expect(rifqi.fsmState).toBe('walk');

      // Klik tile invalid di tengah jalan
      const invalidClick = choreographer.handleFloorClick(-1, -1);
      expect(invalidClick).toBe(false);

      // Rifqi harus tetap melanjutkan perjalanannya tanpa macet
      expect(rifqi.fsmState).toBe('walk');

      let elapsed = 0;
      while (elapsed < 5.0 && rifqi.fsmState === 'walk') {
        choreographer.update(0.1);
        characterManager.update(0.1);
        elapsed += 0.1;
      }

      // Tiba di tujuan pertama dengan sukses
      expect(rifqi.fsmState).toBe('idle');
      expect(Math.round(rifqi.gx)).toBe(14);
      expect(Math.round(rifqi.gy)).toBe(22);
    });
  });

  // =========================================================================
  // 3. Kriteria Penerimaan 2: Mode publik tidak bisa mengendalikan Rifqi
  // =========================================================================
  describe('Kriteria Penerimaan 2: Mode publik tidak bisa mengendalikan Rifqi', () => {
    it('menolak klik lantai saat proyeksi publik aktif', () => {
      officeStore.getState().setFounderAuthenticated(false);
      expect(officeStore.getState().isFounderAuthenticated).toBe(false);
      expect(officeStore.getState().projection).toBe('public');

      const rifqi = characterManager.getCharacter('rifqi')!;
      rifqi.setGridPosition(14, 28);
      rifqi.idle();

      const handled = choreographer.handleFloorClick(14, 22);
      expect(handled).toBe(false);
      expect(rifqi.fsmState).toBe('idle');
      expect(rifqi.gx).toBe(14);
      expect(rifqi.gy).toBe(28);
    });

    it('menolak perintah menghampiri agen saat mode publik aktif', () => {
      officeStore.getState().setFounderAuthenticated(false);

      const rifqi = characterManager.getCharacter('rifqi')!;
      rifqi.setGridPosition(14, 28);
      rifqi.idle();

      const forge = characterManager.getCharacter('forge')!;
      const initialForgeFacing = forge.facing;

      const handled = choreographer.handleAgentClick('forge');
      // Di mode publik, handleAgentClick mengembalikan false (tidak menggerakkan Rifqi atau memutar agen)
      expect(handled).toBe(false);
      expect(rifqi.fsmState).toBe('idle');
      expect(forge.facing).toBe(initialForgeFacing);
      // Tetapi seleksi agen tetap terbuka di HUD untuk mode publik
      expect(officeStore.getState().selectedAgentId).toBe('forge');
    });

    it('menjalankan ambient scheduler untuk Rifqi saat berada di mode publik', () => {
      officeStore.getState().setFounderAuthenticated(false);

      const rifqi = characterManager.getCharacter('rifqi')!;
      rifqi.setGridPosition(14, 28);
      rifqi.idle();

      // Di mode publik, setelah idle > 2 detik, ambient scheduler harus menjadwalkan aktivitas untuk Rifqi
      choreographer.update(3.0);
      characterManager.update(3.0);

      // Rifqi beralih ke aktivitas ambient (berjalan atau act di slot ambient)
      expect(['walk', 'act']).toContain(rifqi.fsmState);
    });
  });

  // =========================================================================
  // 4. Klik Agent di Mode Founder
  // =========================================================================
  describe('Mode Founder: Klik agent -> Rifqi menghampiri, agent menoleh, inspector terbuka', () => {
    it('membuat Rifqi menghampiri agen, agen menoleh ke Rifqi, dan inspector terbuka di HUD', () => {
      officeStore.getState().setFounderAuthenticated(true);

      const rifqi = characterManager.getCharacter('rifqi')!;
      rifqi.setGridPosition(17, 10); // Koridor dekat meja Forge (17, 14)
      rifqi.idle();

      const forge = characterManager.getCharacter('forge')!;
      expect(forge).toBeDefined();

      const handled = choreographer.handleAgentClick('forge');
      expect(handled).toBe(true);

      // 1. Inspector terbuka di HUD
      expect(officeStore.getState().selectedAgentId).toBe('forge');

      // 2. Agen menoleh ke arah Rifqi
      const expectedForgeFacing = vectorToFacing(rifqi.gx - forge.gx, rifqi.gy - forge.gy);
      expect(forge.facing).toBe(expectedForgeFacing);

      // 3. Rifqi berjalan menghampiri ke tile adjacent yang walkable
      expect(rifqi.fsmState).toBe('walk');

      // Simulasikan perjalanan Rifqi hingga tiba
      const dt = 0.1;
      let elapsed = 0;
      while (elapsed < 5.0 && rifqi.fsmState === 'walk') {
        choreographer.update(dt);
        characterManager.update(dt);
        elapsed += dt;
      }

      expect(rifqi.fsmState).toBe('idle');

      // Posisi akhir Rifqi harus berdekatan (adjacent) dengan Forge (jarak Chebyshev <= 1.5 tile)
      const dist = Math.hypot(rifqi.gx - forge.gx, rifqi.gy - forge.gy);
      expect(dist).toBeLessThanOrEqual(2.0);

      // Rifqi menoleh ke arah Forge
      const expectedRifqiFacing = vectorToFacing(forge.gx - rifqi.gx, forge.gy - rifqi.gy);
      expect(rifqi.facing).toBe(expectedRifqiFacing);
    });

    it('membuka inspector saat mengklik Rifqi sendiri tanpa membuat Rifqi berjalan', () => {
      officeStore.getState().setFounderAuthenticated(true);

      const rifqi = characterManager.getCharacter('rifqi')!;
      rifqi.setGridPosition(14, 28);
      rifqi.idle();

      const handled = choreographer.handleAgentClick('rifqi');
      expect(handled).toBe(true);
      expect(officeStore.getState().selectedAgentId).toBe('rifqi');
      expect(rifqi.fsmState).toBe('idle');
    });

    it('tidak macet jika agen target berada di area tak terjangkau', () => {
      officeStore.getState().setFounderAuthenticated(true);

      const rifqi = characterManager.getCharacter('rifqi')!;
      rifqi.setGridPosition(14, 28);
      rifqi.idle();

      // Tempatkan agen guest di posisi yang semua tetangganya collision
      const guest = characterManager.getCharacter('guest')!;
      guest.setGridPosition(0, 0);
      gridMap.setWalkable(1, 1, false);

      const handled = choreographer.handleAgentClick('guest');
      // Bila slot sekitar agen tidak bisa dicapai, Rifqi tidak macet
      expect(handled).toBe(false);
      expect(rifqi.fsmState).not.toBe('walk');
      expect(rifqi.fsmState).toBe('idle');
      expect(officeStore.getState().selectedAgentId).toBe('guest');
    });
  });

  // =========================================================================
  // 5. Isolasi Ambient Scheduler di Mode Founder
  // =========================================================================
  describe('Isolasi Ambient Scheduler di Mode Founder vs Publik', () => {
    it('tidak mengizinkan ambient scheduler menimpa posisi Rifqi saat di Mode Founder', () => {
      officeStore.getState().setFounderAuthenticated(true);

      const rifqi = characterManager.getCharacter('rifqi')!;
      rifqi.setGridPosition(14, 28);
      rifqi.idle();

      // Perbarui waktu beberapa menit dalam mode Founder
      choreographer.update(5.0);
      characterManager.update(5.0);

      // Rifqi harus tetap di posisi yang ditentukan, tidak dialihkan oleh ambient scheduler
      expect(rifqi.fsmState).toBe('idle');
      expect(rifqi.gx).toBe(14);
      expect(rifqi.gy).toBe(28);
    });

    it('melanjutkan ambient scheduler saat beralih dari Mode Founder kembali ke Mode Publik', () => {
      // 1. Mulai di Mode Founder
      officeStore.getState().setFounderAuthenticated(true);
      const rifqi = characterManager.getCharacter('rifqi')!;
      rifqi.setGridPosition(14, 28);
      rifqi.idle();

      choreographer.update(5.0);
      characterManager.update(5.0);
      expect(rifqi.fsmState).toBe('idle');

      // 2. Founder logout -> kembali ke Mode Publik
      officeStore.getState().setFounderAuthenticated(false);
      expect(officeStore.getState().projection).toBe('public');

      // 3. Jalankan ticker di Mode Publik: Rifqi kembali dijadwalkan oleh ambient scheduler
      choreographer.update(3.0);
      characterManager.update(3.0);
      expect(['walk', 'act']).toContain(rifqi.fsmState);
    });
  });

  // =========================================================================
  // 6. Integrasi Character Click Callback pada CharacterManager
  // =========================================================================
  describe('Integrasi Character Click Callback pada CharacterManager', () => {
    it('meneruskan klik karakter ke onCharacterClick dan memicu interaksi Founder', () => {
      officeStore.getState().setFounderAuthenticated(true);

      const rifqi = characterManager.getCharacter('rifqi')!;
      rifqi.setGridPosition(17, 10);
      rifqi.idle();

      const muse = characterManager.getCharacter('muse')!;
      expect(muse).toBeDefined();

      let clickedCharId = '';
      characterManager.setOnCharacterClick((char) => {
        clickedCharId = char.id;
        choreographer.handleAgentClick(char.id);
      });

      // Simulasikan pointer tap/click pada karakter Muse
      muse.handleClick();

      expect(clickedCharId).toBe('muse');
      expect(officeStore.getState().selectedAgentId).toBe('muse');
      expect(rifqi.fsmState).toBe('walk');
    });
  });

  // =========================================================================
  // 7. Integrasi WorldApp (Floor Click, Grid Click, Agent Click, Target Detection)
  // =========================================================================
  describe('Integrasi WorldApp (Floor Click, Grid Click, Agent Click)', () => {
    it('memvalidasi WorldApp helper methods dan isCharacterTarget detection', () => {
      // Saat belum di-init (headless), memanggil method ini mengembalikan false dengan aman tanpa error
      expect(worldApp.handleGridClick(14, 22)).toBe(false);
      expect(worldApp.handleFloorClick(1000, 500)).toBe(false);
      expect(worldApp.handleAgentClick('forge')).toBe(false);

      // Verifikasi deteksi display object karakter vs non-karakter
      const forge = characterManager.getCharacter('forge')!;
      expect(worldApp.isCharacterTarget(forge)).toBe(true);
      expect(worldApp.isCharacterTarget(forge.animatedSprite)).toBe(true);
      expect(worldApp.isCharacterTarget(forge.badgeContainer)).toBe(true);
      expect(worldApp.isCharacterTarget(forge.nameTagContainer)).toBe(true);

      // Objek non-karakter (misal container lantai)
      const mockFloor = { label: 'FloorLayer_0', parent: null };
      expect(worldApp.isCharacterTarget(mockFloor)).toBe(false);
      expect(worldApp.isCharacterTarget(null)).toBe(false);
      expect(worldApp.isCharacterTarget(undefined)).toBe(false);
    });
  });
});
