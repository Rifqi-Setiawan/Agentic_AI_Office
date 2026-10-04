import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { GridMap } from '../navigation/GridMap';
import { AStarPathfinder } from '../navigation/AStarPathfinder';
import { SlotReservationManager } from '../navigation/SlotReservationManager';
import { CharacterManager, AGENT_SPAWN_DEFS } from './CharacterManager';
import { Character } from './Character';
import { Choreographer } from './Choreographer';
import { officeStore } from '../store/officeStore';
import type { CollectiveKind } from '../types/office';

describe('T2.6 collective roles, capacity, cleanup and task priority', () => {
  let grid: GridMap;
  let slots: SlotReservationManager;
  let chars: CharacterManager;
  let choreo: Choreographer;
  beforeEach(() => {
    officeStore.getState().reset();
    grid = new GridMap(JSON.parse(fs.readFileSync(path.resolve(__dirname, '../../public/maps/floor1.tmj'), 'utf8')));
    slots = new SlotReservationManager(grid);
    chars = new CharacterManager();
    for (const def of AGENT_SPAWN_DEFS) chars.addCharacter(new Character({ id: def.id, name: def.name,
      role: def.role, signatureColor: def.signatureColor, initialGx: def.fallbackGx, initialGy: def.fallbackGy }));
    choreo = new Choreographer({ characterManager: chars, gridMap: grid, pathfinder: new AStarPathfinder(grid), slotManager: slots });
    choreo.init();
  });
  afterEach(() => { choreo.destroy(); chars.destroy(); officeStore.getState().reset(); });
  it.each(['pool_party', 'fire_drill', 'town_hall'] as CollectiveKind[])('%s assigns all selected idle agents once and cleans up', kind => {
    const participants = AGENT_SPAWN_DEFS.map(d => d.id).filter(id => id !== 'guest');
    const now = Math.floor(Date.now()/1000);
    const event = { id: `test-${kind}`, kind, title: 'Uji kolektif', active: true,
      participants, started_at: now, expires_at: now+600 };
    choreo.onCollectiveEventChanged(event);
    const manager = choreo.getCollectiveManager();
    for (const id of participants) {
      const a = manager.getAssignment(id)!;
      expect(a).toBeDefined();
      expect(slots.getAgentReservation(id)?.status).toBe('reserved');
      expect(a.slot.zone).toBe(kind === 'town_hall' ? 'Z14' : 'Z17');
      expect(new AStarPathfinder(grid).findPath({ gx: 4, gy: 28 }, a.slot)).not.toBeNull();
    }
    expect(manager.getAssignment(kind === 'town_hall' ? 'jarvis' : 'bastion')?.role).toBe('presenter');
    const bubbleCount = choreo.getRecentBubbles().length;
    choreo.onCollectiveEventChanged(event);
    expect(choreo.getRecentBubbles()).toHaveLength(bubbleCount);
    choreo.onCollectiveEventChanged(null);
    for (const id of participants) {
      expect(manager.getAssignment(id)).toBeUndefined();
      expect(slots.getAgentReservation(id)).toBeNull();
      expect(choreo.getAgentState(id)?.currentLayer).toBe('ambient');
    }
  });
  it.each(['pool_party', 'fire_drill', 'town_hall'] as CollectiveKind[])('%s respects busy agents and expires on actual boundary', kind => {
    choreo.getAgentState('forge')!.workStatus = 'working';
    const now = Math.floor(Date.now()/1000);
    choreo.onCollectiveEventChanged({ id: 'expiry', kind, title: 'Uji', active: true,
      participants: ['forge', 'nova'], started_at: now-1, expires_at: now });
    expect(choreo.getCollectiveManager().getAssignment('forge')).toBeUndefined();
    choreo.update(0);
    expect(choreo.getCollectiveManager().getAssignment('nova')).toBeUndefined();
    expect(slots.getAgentReservation('nova')).toBeNull();
  });
});
