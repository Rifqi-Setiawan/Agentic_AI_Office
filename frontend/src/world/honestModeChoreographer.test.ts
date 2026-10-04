import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { GridMap } from '../navigation/GridMap';
import { AStarPathfinder } from '../navigation/AStarPathfinder';
import { SlotReservationManager } from '../navigation/SlotReservationManager';
import { CharacterManager, AGENT_SPAWN_DEFS } from './CharacterManager';
import { Character } from './Character';
import { Choreographer } from './Choreographer';
import type { InteractionSlot } from './types';
import { officeStore } from '../store/officeStore';

describe('T2.3 Mode Jujur (Choreographer & AmbientScheduler F22)', () => {
  const mapPath = path.resolve(__dirname, '../../public/maps/floor1.tmj');
  const rawMap = JSON.parse(fs.readFileSync(mapPath, 'utf-8'));

  let gridMap: GridMap;
  let pathfinder: AStarPathfinder;
  let slotManager: SlotReservationManager;
  let characterManager: CharacterManager;
  let choreographer: Choreographer;

  beforeEach(() => {
    localStorage.clear();
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
  });

  it('saat Mode Jujur aktif, agen ambient yang berada di luar meja segera dipulangkan ke mejanya', () => {
    const forgeChar = characterManager.getCharacter('forge')!;
    const forgeState = choreographer.getAgentState('forge')!;

    // Simulasikan Forge sedang berada di arcade (slot_z15_arcade_1) dalam ambient
    const arcadeSlot = gridMap.getSlot('slot_z15_arcade_1');
    expect(arcadeSlot).toBeDefined();

    forgeChar.setGridPosition(arcadeSlot!.gx, arcadeSlot!.gy);
    forgeChar.act(arcadeSlot as unknown as InteractionSlot);
    forgeState.currentLayer = 'ambient';
    forgeState.targetSlotId = 'slot_z15_arcade_1';

    // Aktifkan Mode Jujur
    officeStore.getState().setHonestMode(true);

    // Choreographer harus mendeteksi perubahan dan mengirim Forge kembali ke mejanya
    expect(forgeChar.fsmState).toBe('walk');
    expect(forgeState.targetSlotId).toBe(forgeState.deskSlotId);
  });

  it('saat Mode Jujur aktif, agen idle diam di zonanya dan tidak menjadwalkan ambient keliling', () => {
    officeStore.getState().setHonestMode(true);

    const prismChar = characterManager.getCharacter('prism')!;
    const prismState = choreographer.getAgentState('prism')!;
    const deskSlot = gridMap.getSlot(prismState.deskSlotId)!;

    prismChar.setGridPosition(deskSlot.gx, deskSlot.gy);
    prismChar.act(deskSlot as unknown as InteractionSlot);
    prismState.currentLayer = 'ambient';
    prismState.activityRemaining = 0; // Durasi habis

    // Jalankan update tick choreographer
    choreographer.update(1.0);

    // Karakter tidak boleh berjalan ke zona rekreasi (kolam/kafetaria/arcade); tetap di meja
    expect(prismChar.fsmState).not.toBe('walk');
    expect(prismChar.getCurrentSlot()?.id).toBe(prismState.deskSlotId);
  });

  it('saat Mode Jujur dinonaktifkan kembali, jadwal ambient beroperasi normal', () => {
    officeStore.getState().setHonestMode(true);
    choreographer.update(1.0);

    // Matikan Mode Jujur
    officeStore.getState().setHonestMode(false);
    expect(officeStore.getState().isHonestMode).toBe(false);

    const museState = choreographer.getAgentState('muse')!;
    expect(museState.currentLayer).toBe('ambient');
  });
});
