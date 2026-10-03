export interface GridPoint {
  gx: number;
  gy: number;
}

export type FacingDirection = 'SE' | 'SW' | 'NE' | 'NW';

export type CompassDirection = 'N' | 'NE' | 'E' | 'SE' | 'S' | 'SW' | 'W' | 'NW';

export interface InteractionSlot {
  id: string;
  name: string;
  zone: string;
  type: string;
  capacity: number;
  gx: number;
  gy: number;
  facing: FacingDirection;
  anim: string;
  y_offset: number;
}

export interface DoorDef {
  id: number;
  name: string;
  from: string;
  to: string;
  gx: number;
  gy: number;
}

export interface ZoneDef {
  id: string;
  name: string;
  resident: string;
  gx_min: number;
  gx_max: number;
  gy_min: number;
  gy_max: number;
}

export interface PathNode extends GridPoint {
  direction?: FacingDirection;
}

export interface PathfinderOptions {
  /**
   * Jika false (default), agent tidak akan memotong sudut dinding (diagonal corner cutting dicegah).
   * Jika true, pemotongan sudut diperbolehkan asalkan kedua dinding tidak sama-sama memblokir.
   */
  allowCornerCutting?: boolean;

  /**
   * Indeks atau koordinat tile tambahan yang dianggap terhalang (misalnya agent lain yang sedang diam).
   */
  extraBlocked?: Set<number> | GridPoint[];

  /**
   * Indeks atau koordinat tile yang harus diabaikan status collision-nya (misalnya posisi awal/tujuan khusus).
   */
  ignoredTiles?: Set<number> | GridPoint[];
}

export type ReservationStatus =
  | 'reserved'
  | 'queued'
  | 'already_reserved'
  | 'already_queued'
  | 'not_found';

export interface SlotReservationResult {
  success: boolean;
  status: ReservationStatus;
  slotId: string;
  position: number; // 0 jika occupant aktif, 1..N untuk antrean
}

export type ReleaseStatus =
  | 'released'
  | 'queue_cancelled'
  | 'not_reserved'
  | 'not_found';

export interface SlotReleaseResult {
  success: boolean;
  status: ReleaseStatus;
  slotId: string;
  promotedAgentId: string | null;
}

export interface AgentTrajectory {
  agentId: string;
  currentPos: GridPoint;
  targetPos?: GridPoint;
  path?: GridPoint[];
  priority?: number;
}

export type EncounterKind = 'head_on' | 'converging' | 'blocked';

export interface EncounterDetection {
  kind: EncounterKind;
  agentA: string;
  agentB: string;
  conflictPoint: GridPoint;
}

export interface AvoidanceResolution {
  encounter: EncounterDetection;
  yieldingAgentId: string;
  passingAgentId: string;
  sidestepTile: GridPoint | null;
  detourPath: GridPoint[] | null;
}
