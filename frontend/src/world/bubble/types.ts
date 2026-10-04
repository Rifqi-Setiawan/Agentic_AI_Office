import type { BubbleCamera as CameraManager, BubbleScreen as Application } from '../simulation/BubblePorts';
import type { CharacterRegistry as CharacterManager } from '../simulation/CharacterRegistry';
import type { TaskRef } from '../../types/office';

/**
 * Nilai prioritas bubble sesuai spesifikasi blueprint 03:
 * event Founder > gagal > blocked > selesai > event kolektif > mulai kerja > ambient
 */
export enum BubblePriority {
  AMBIENT = 1,
  WORKING = 2,
  COLLECTIVE = 3,
  DONE = 4,
  BLOCKED = 5,
  FAILED = 6,
  FOUNDER = 7,
}

export type BubbleKind =
  | 'founder'
  | 'failed'
  | 'blocked'
  | 'done'
  | 'collective'
  | 'working'
  | 'ambient';

export const BUBBLE_PRIORITY_MAP: Record<BubbleKind, BubblePriority> = {
  founder: BubblePriority.FOUNDER,
  failed: BubblePriority.FAILED,
  blocked: BubblePriority.BLOCKED,
  done: BubblePriority.DONE,
  collective: BubblePriority.COLLECTIVE,
  working: BubblePriority.WORKING,
  ambient: BubblePriority.AMBIENT,
};

export const MAX_ACTIVE_BUBBLES = 3;
export const DEFAULT_BUBBLE_DURATION_SEC = 4.0;
export const DEFAULT_COOLDOWN_SEC = 20.0;

export interface PlaceholderContext {
  mode?: 'public' | 'founder';
  agentId?: string;
  agentName?: string;
  doneToday?: number;
  duration?: number | string; // detik atau string durasi terformat
  projectName?: string; // nama proyek/board
  peerAgentName?: string;
  task?: TaskRef | null;
}

export interface BubbleItem {
  id: string;
  agentId: string;
  agentName: string;
  signatureColor: string;
  text: string;
  priority: BubblePriority;
  kind: BubbleKind;
  duration: number;
  remaining: number;
  element: HTMLElement;
  isStamp?: boolean;
}

export interface BubbleRequest {
  agentId: string;
  text?: string;
  state?: 'working' | 'done' | 'blocked' | 'failed' | 'ambient' | 'collective';
  kind?: BubbleKind;
  priority?: BubblePriority;
  duration?: number;
  context?: PlaceholderContext;
  force?: boolean; // Bypass cooldown dan kamera check jika diperlukan (misal event Founder darurat)
  isStamp?: boolean;
}

export interface BubbleManagerConfig {
  container?: HTMLElement | null;
  characterManager?: CharacterManager | null;
  camera?: CameraManager | null;
  app?: Application | null;
  maxBubbles?: number;
  bubbleDurationSec?: number;
  cooldownSec?: number;
  randomFn?: () => number;
  timeFn?: () => number;
}
