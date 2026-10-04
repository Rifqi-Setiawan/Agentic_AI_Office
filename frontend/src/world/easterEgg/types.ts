import type { Container } from 'pixi.js';
import type { CharacterManager } from '../CharacterManager';
import type { Choreographer } from '../choreographer/Choreographer';
import type { BubbleManager } from '../bubble';
import type { LoadedOfficeMap } from '../mapLoader';

export interface EasterEggState {
  isKonamiActive: boolean;
  konamiRemaining: number;
  oracleClicks: number;
  oracleShockRemaining: number;
  isGlitchTileActive: boolean;
  glitchTileRemaining: number;
  isNoDeployFridayActive: boolean;
  sleepingAgentId: string | null;
  espressoClicks: number;
}

export interface EasterEggConfig {
  characterManager: CharacterManager;
  choreographer?: Choreographer | null;
  bubbleManager?: BubbleManager | null;
  loadedMap?: LoadedOfficeMap | null;
  worldContainer?: Container | null;
  getNow?: () => Date;
  onConfettiBurst?: (x: number, y: number) => void;
  randomFn?: () => number;
}
