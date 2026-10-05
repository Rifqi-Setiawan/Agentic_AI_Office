import { AGENT_SPAWN_DEFS } from '../simulation/roster';
import { animationFrames, type SpriteAtlas } from './AssetRegistry';

/** Four neutral views let every turn/action retain the same illustrated agent. */
export function illustratedActorDefs(atlases: ReadonlyMap<string, SpriteAtlas>) {
  return AGENT_SPAWN_DEFS.filter(def => {
    const atlas = atlases.get(def.id);
    return atlas?.meta.candidate === true && ['se', 'sw', 'ne', 'nw'].every(direction =>
      animationFrames(atlas, def.id, 'idle', direction).length > 0);
  });
}
