import { afterEach, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { illustratedActorDefs } from './ActorRoster';
import { resolveActorAnimation, type PreviewAssets, type SpriteAtlas } from './AssetRegistry';
import { AGENT_SPAWN_DEFS } from '../simulation/roster';
import { ModelRegistry } from '../simulation/ModelRegistry';
import { GridMap } from '../../navigation/GridMap';
import { AStarPathfinder } from '../../navigation/AStarPathfinder';
import { SlotReservationManager } from '../../navigation/SlotReservationManager';
import { Choreographer } from '../Choreographer';
import { officeStore } from '../../store/officeStore';

const publicRoot = path.resolve(__dirname, '../../../public');
const read = <T,>(file: string): T => JSON.parse(fs.readFileSync(path.join(publicRoot, file), 'utf8')) as T;
const assets = read<PreviewAssets>('visual-migration/dot-z08-components-v2/assets.json');
const atlases = new Map(Object.entries(assets.characterOverrides!).map(([id, file]) => [id, read<SpriteAtlas>(file)]));
const actors = illustratedActorDefs(atlases);

afterEach(() => officeStore.getState().reset());

describe('2.5D actor identity and availability', () => {
  it('admits only Prism, Forge and Nova even when legacy atlases are supplied for the entire roster', () => {
    const mixed = new Map(AGENT_SPAWN_DEFS.map(def => [def.id, read<SpriteAtlas>(`sprites/characters/${def.id}.json`)]));
    for (const [id, atlas] of atlases) mixed.set(id, atlas);
    expect(illustratedActorDefs(mixed).map(def => def.id)).toEqual(['prism', 'forge', 'nova']);
    expect(illustratedActorDefs(new Map())).toEqual([]);
    const incomplete = structuredClone(atlases.get('forge')!);
    delete incomplete.frames.forge_idle_nw_0;
    delete incomplete.frames['forge_idle_nw_0.png'];
    expect(illustratedActorDefs(new Map([['forge', incomplete]]))).toEqual([]);
  });

  it('retains the same atlas and explicit facing for every legacy action and all four directions', () => {
    for (const def of actors) {
      const primary = atlases.get(def.id)!;
      const old = read<SpriteAtlas>(`sprites/characters/${def.id}.json`);
      const actions = new Set(Object.keys(old.frames).map(name => name.match(/_(.+)_(?:se|ne)_\d+\.png$/)?.[1]).filter(Boolean) as string[]);
      expect(actions.size).toBeGreaterThanOrEqual(14);
      for (const action of actions) for (const direction of ['se', 'sw', 'ne', 'nw']) {
        const result = resolveActorAnimation(primary, def.id, action, direction);
        expect(result.atlas).toBe(primary);
        expect(result.source).toBe('illustration');
        expect(result.frames.length).toBeGreaterThan(0);
        expect(result.mirrored).toBe(false);
        expect(result.atlas.meta.image).toMatch(/^\/visual-migration\//);
        for (const name of result.frames) expect(name).toMatch(new RegExp(`^${def.id}_.+_${direction}_\\d+\\.png$`));
        if (result.substituted) expect(result.frames).toHaveLength(1);
      }
    }
  });

  it('holds a seated frame for an unsupported seated action without inventing a direction', () => {
    const nova = resolveActorAnimation(atlases.get('nova')!, 'nova', 'game', 'ne', 'sit_type');
    expect(nova.frames).toEqual(['nova_sit_type_ne_0.png']);
    expect(nova.substituted).toBe(true);
    const forge = resolveActorAnimation(atlases.get('forge')!, 'forge', 'game', 'ne', 'sit_type');
    expect(forge.frames).toEqual(['forge_idle_ne_0.png']);
    expect(forge.mirrored).toBe(false);
  });

  it('omits unavailable actors from simulation and seat reservations throughout ambient activity', () => {
    officeStore.getState().setHonestMode(false);
    const grid = new GridMap(read('maps/floor1.tmj'));
    const registry = new ModelRegistry(grid, actors);
    const reservations = new SlotReservationManager(grid);
    const choreography = new Choreographer({ characterManager: registry, gridMap: grid,
      pathfinder: new AStarPathfinder(grid), slotManager: reservations, randomFn: () => .31 });
    choreography.init();
    try {
      expect([...choreography.getAllAgentStates().keys()]).toEqual(['prism', 'forge', 'nova']);
      for (let tick = 0; tick < 1200; tick++) {
        choreography.update(.1);
        registry.update(.1);
      }
      expect(registry.getAllCharacters().map(char => char.id)).toEqual(['prism', 'forge', 'nova']);
      for (const def of AGENT_SPAWN_DEFS.filter(def => !atlases.has(def.id))) {
        expect(registry.getCharacter(def.id)).toBeUndefined();
        expect(choreography.getAgentState(def.id)).toBeUndefined();
        expect(reservations.getAgentReservation(def.id)).toBeNull();
      }
    } finally { choreography.destroy(); registry.destroy(); }
  });
});
