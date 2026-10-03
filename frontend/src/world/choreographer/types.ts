import type { CharacterManager } from '../CharacterManager';
import type { GridMap } from '../../navigation/GridMap';
import type { AStarPathfinder } from '../../navigation/AStarPathfinder';
import type { SlotReservationManager } from '../../navigation/SlotReservationManager';
import type { InteractionSlot } from '../../navigation/types';
import type { AgentWork, TaskRef } from '../../types/office';

export type PriorityLayer = 'task' | 'collective' | 'ambient';

export interface AmbientActivityDef {
  key: string;
  name: string;
  weight: number;
  zone?: string;
  slotTypes?: string[];
  slotIds?: string[];
  anim?: string;
}

export interface PersonaAmbientConfig {
  agentId: string;
  personaName: string;
  activities: AmbientActivityDef[];
}

export interface ChoreographerBubbleEvent {
  agentId: string;
  text: string;
  timestamp: number;
  kind?: 'task' | 'collective' | 'ambient';
}

export interface AgentChoreographyState {
  agentId: string;
  currentLayer: PriorityLayer;
  currentActivityKey: string | null;
  lastActivityKey: string | null;
  activityDuration: number;
  activityRemaining: number;
  targetSlotId: string | null;
  lastGx: number;
  lastGy: number;
  timeAtTile: number;
  deskSlotId: string;
  workStatus: AgentWork;
  currentTask: TaskRef | null;
  celebrateRemaining: number;
  needsInputReported: boolean;
  sholatNotified: boolean;
}

export interface ChoreographerConfig {
  characterManager: CharacterManager;
  gridMap: GridMap;
  pathfinder: AStarPathfinder;
  slotManager: SlotReservationManager;
  randomFn?: () => number;
  onBubble?: (event: ChoreographerBubbleEvent) => void;
}

export interface CollectiveSlotAssignment {
  agentId: string;
  slot: InteractionSlot;
  role: 'imam' | 'shaf' | 'presenter' | 'attendee' | 'participant';
}
