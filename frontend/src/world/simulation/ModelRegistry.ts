import { CharacterModel } from './CharacterModel';
import type { CharacterRegistry } from './CharacterRegistry';
import { AGENT_SPAWN_DEFS } from './roster';
import type { GridMap } from '../../navigation/GridMap';
import type { InteractionSlot } from '../types';
import { gridToScreen } from '../projection';
import { officeStore } from '../../store/officeStore';
export class ModelRegistry implements CharacterRegistry {
  private characters = new Map<string, CharacterModel>();
  constructor(grid: GridMap) {
    for (const def of AGENT_SPAWN_DEFS) {
      const slot = grid.getSlot(def.defaultSlotId);
      const char = new CharacterModel({ ...def, initialGx: slot?.gx ?? def.fallbackGx,
        initialGy: slot?.gy ?? def.fallbackGy, initialFacing: slot?.facing ?? def.fallbackFacing });
      if (slot) char.act({ ...slot, worldPos: gridToScreen(slot.gx, slot.gy) } as InteractionSlot);
      this.characters.set(def.id, char);
    }
  }
  getCharacter(id: string) { return this.characters.get(id); }
  getAllCharacters() { return [...this.characters.values()]; }
  update(dt: number) {
    const state = officeStore.getState();
    for (const char of this.characters.values()) {
      char.update(dt);
      const agent = state.agents[char.id];
      if (agent) char.setWorkStatus(agent.work, agent.task);
      char.setSelected(char.id === state.selectedAgentId);
    }
  }
  destroy() { this.characters.clear(); }
}
