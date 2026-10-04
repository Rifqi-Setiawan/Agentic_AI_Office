// FSM extracted from Character.ts at ae7473c. No Pixi instance or second clock.
import type { FacingDirection, GridPoint } from '../../navigation/types';
import type { InteractionSlot } from '../types';
import type { AgentWork, TaskRef } from '../../types/office';
import { vectorToFacing } from '../../navigation/AStarPathfinder';
import { gridToScreen, calculateZIndex, LAYER_OFFSETS, WORLD_ORIGIN_X, WORLD_ORIGIN_Y } from '../projection';

export type CharacterFsmState = 'idle' | 'walk' | 'arrive' | 'act' | 'leave';
export const DEFAULT_WALK_SPEED = 2.5;
export interface ModelConfig {
  id: string; name: string; role?: string; signatureColor?: string;
  initialGx?: number; initialGy?: number; initialFacing?: FacingDirection; speed?: number;
}
export class CharacterModel {
  readonly id: string;
  readonly characterName: string;
  role: string;
  signatureColor: string;
  gx: number; gy: number;
  x = 0; y = 0; zIndex = 0;
  facing: FacingDirection = 'SE';
  fsmState: CharacterFsmState = 'idle';
  speed = DEFAULT_WALK_SPEED;
  originX = WORLD_ORIGIN_X; originY = WORLD_ORIGIN_Y;
  slotYOffset = 0;
  workStatus: AgentWork = 'idle'; currentTask: TaskRef | null = null;
  isSelected = false; isHovered = false; visible = true;
  isShowingFailStamp = false; isCarryingParcel = false;
  isInspecting = false; isCommenting = false; isSweating = false;
  animationTime = 0; travelDistance = 0; loop = true;
  private failStampRemaining = 0;
  private currentPath: GridPoint[] = []; private currentPathIndex = 0;
  private currentSlot: InteractionSlot | null = null;
  private targetSlot?: InteractionSlot;
  private currentAnimation = 'idle'; private workGestureTime = 0;
  onStateChange?: (from: CharacterFsmState, to: CharacterFsmState) => void;
  onArrive?: (slot?: InteractionSlot) => void;
  onAct?: (slot: InteractionSlot) => void;
  onLeave?: (slot?: InteractionSlot) => void;
  constructor(config: ModelConfig) {
    this.id = config.id; this.characterName = config.name;
    this.role = config.role ?? 'Spesialis Agen'; this.signatureColor = config.signatureColor ?? '#2bb3c0';
    this.gx = config.initialGx ?? 0; this.gy = config.initialGy ?? 0;
    this.facing = config.initialFacing ?? 'SE'; this.speed = config.speed ?? DEFAULT_WALK_SPEED;
    this.updateScreenPosition();
  }
  getCurrentAnimation() { return this.currentAnimation; }
  setFacing(facing: FacingDirection) { this.facing = facing; }
  playAnimation(name: string, loop = true) {
    if (name !== this.currentAnimation) this.animationTime = 0;
    this.currentAnimation = name; this.loop = loop;
  }
  setSelected(selected: boolean) { this.isSelected = selected; }
  showFailStamp(duration = 5) { this.isShowingFailStamp = true; this.failStampRemaining = duration; }
  setCarryingParcel(carrying: boolean) { this.isCarryingParcel = carrying; }
  setSweating(sweating: boolean) { this.isSweating = sweating; }
  update(dt: number) {
    this.animationTime += dt;
    this.updateWorkGesture(dt);
    if (this.isShowingFailStamp) {
      this.failStampRemaining -= dt;
      if (this.failStampRemaining <= 0) this.isShowingFailStamp = false;
    }
    if (this.fsmState === 'walk' && this.currentPath.length) this.updateMovement(dt);
  }
  public setWorkStatus(status: AgentWork, task?: TaskRef | null): void {
    if (status !== this.workStatus || task?.id !== this.currentTask?.id) {
      this.workGestureTime = 0;
    }
    this.workStatus = status;
    this.currentTask = task ?? null;

    // Badge task nyata hanya muncul saat work = working

    this.updateWorkGesture(0);
  }

  private updateWorkGesture(dt: number): void {
    if (this.isShowingFailStamp || this.isCommenting || this.isInspecting || this.isCarryingParcel) {
      return;
    }
    const ownStation = this.currentSlot?.type === `desk:${this.id}` ||
      (this.id === 'merlin' && this.currentSlot?.id === 'slot_z04_whiteboard');
    if (this.fsmState !== 'act' || !ownStation || !this.currentSlot) return;
    if (this.workStatus === 'working' && this.currentTask) {
      this.workGestureTime += dt;
      // Pertahankan animasi mengetik, diselingi gerak khas selama dua detik.
      const animation = this.workGestureTime % 8 < 2 ? 'special' : this.currentSlot.anim;
      if (this.currentAnimation !== animation) this.playAnimation(animation);
    } else if (['stale', 'blocked', 'failed', 'off_duty', 'working'].includes(this.workStatus) || this.currentAnimation === 'special') {
      const animation = this.workStatus === 'idle' ? this.currentSlot.anim : 'idle';
      if (this.currentAnimation !== animation) this.playAnimation(animation);
    }
  }

  public setGridPosition(gx: number, gy: number): void {
    this.gx = gx;
    this.gy = gy;
    this.updateScreenPosition();
  }

  public updateScreenPosition(): void {
    const pos = gridToScreen(this.gx, this.gy, this.originX, this.originY);
    this.x = pos.x;
    this.y = pos.y;
    // zIndex dihitung dari titik kaki entitas
    this.zIndex = calculateZIndex(this.gx, this.gy, LAYER_OFFSETS.CHARACTER);
    // Terapkan y_offset dari slot (saat duduk) ke sprite wrapper
  }

  public walk(path: GridPoint[], targetSlot?: InteractionSlot): void {
    this.targetSlot = targetSlot;

    if (!path || path.length === 0) {
      if (targetSlot) {
        this.arrive();
      } else {
        this.idle();
      }
      return;
    }

    const prevFsm = this.fsmState;
    this.fsmState = 'walk';
    this.currentPath = [...path];

    // Reset slotYOffset saat mulai berjalan
    this.slotYOffset = 0;

    // Jika waypoint pertama adalah posisi saat ini, langsung tuju waypoint kedua
    if (
      this.currentPath.length > 1 &&
      Math.abs(this.currentPath[0].gx - this.gx) < 0.05 &&
      Math.abs(this.currentPath[0].gy - this.gy) < 0.05
    ) {
      this.currentPathIndex = 1;
    } else {
      this.currentPathIndex = 0;
    }

    // Tentukan arah hadap awal ke waypoint berikutnya
    const target = this.currentPath[this.currentPathIndex];
    if (target) {
      const dx = target.gx - this.gx;
      const dy = target.gy - this.gy;
      if (Math.abs(dx) > 0.01 || Math.abs(dy) > 0.01) {
        this.setFacing(vectorToFacing(dx, dy));
      }
    }

    this.playAnimation('walk');
    this.onStateChange?.(prevFsm, 'walk');
  }

  public arrive(): void {
    const prevFsm = this.fsmState;
    this.fsmState = 'arrive';
    this.currentPath = [];
    this.currentPathIndex = 0;

    this.onStateChange?.(prevFsm, 'arrive');

    // Jika ada target slot yang dituju, otomatis masuk ke mode 'act'
    if (this.targetSlot) {
      const slot = this.targetSlot;
      this.targetSlot = undefined;
      this.onArrive?.(slot);
      this.act(slot);
    } else {
      this.idle();
      this.onArrive?.();
    }
  }

  public act(slot: InteractionSlot): void {
    const prevFsm = this.fsmState;
    this.fsmState = 'act';
    this.currentSlot = slot;

    // Terapkan properti slot
    this.slotYOffset = slot.y_offset ?? 0;

    if (slot.facing) {
      const f = slot.facing.toUpperCase();
      if (f === 'SE' || f === 'SW' || f === 'NE' || f === 'NW') {
        this.setFacing(f as FacingDirection);
      }
    }

    const animToPlay = slot.anim || 'sit_type';
    this.playAnimation(animToPlay);
    this.workGestureTime = 0;
    this.updateWorkGesture(0);

    this.onStateChange?.(prevFsm, 'act');
    this.onAct?.(slot);
  }

  public leave(): void {
    const prevFsm = this.fsmState;
    this.fsmState = 'leave';

    const leavingSlot = this.currentSlot;
    this.currentSlot = null;
    this.slotYOffset = 0;

    this.onStateChange?.(prevFsm, 'leave');
    this.onLeave?.(leavingSlot ?? undefined);

    this.idle();
  }

  public idle(): void {
    const prevFsm = this.fsmState;
    this.fsmState = 'idle';
    this.playAnimation('idle');
    this.onStateChange?.(prevFsm, 'idle');
  }

  public getCurrentSlot(): InteractionSlot | null {
    return this.currentSlot;
  }

  private updateMovement(dt: number): void {
    let remainingDist = this.speed * dt;

    while (remainingDist > 0 && this.currentPathIndex < this.currentPath.length) {
      const target = this.currentPath[this.currentPathIndex];
      const dx = target.gx - this.gx;
      const dy = target.gy - this.gy;
      const dist = Math.hypot(dx, dy);

      if (dist < 0.0001) {
        // Tiba di waypoint saat ini, lanjutkan ke waypoint berikutnya
        this.gx = target.gx;
        this.gy = target.gy;
        this.currentPathIndex++;

        if (this.currentPathIndex >= this.currentPath.length) {
          // Seluruh jalur selesai
          this.arrive();
          break;
        }

        // Update arah hadap ke waypoint baru
        const nextTarget = this.currentPath[this.currentPathIndex];
        const nextDx = nextTarget.gx - this.gx;
        const nextDy = nextTarget.gy - this.gy;
        this.setFacing(vectorToFacing(nextDx, nextDy));
        continue;
      }

      if (remainingDist >= dist) {
        // Agent mampu menjangkau waypoint ini dalam sisa waktu frame
        this.gx = target.gx;
        this.gy = target.gy;
        remainingDist -= dist;
        this.travelDistance += dist;
        this.currentPathIndex++;

        if (this.currentPathIndex >= this.currentPath.length) {
          this.arrive();
          break;
        }

        const nextTarget = this.currentPath[this.currentPathIndex];
        const nextDx = nextTarget.gx - this.gx;
        const nextDy = nextTarget.gy - this.gy;
        this.setFacing(vectorToFacing(nextDx, nextDy));
      } else {
        // Bergerak sebagian ke arah waypoint
        const ratio = remainingDist / dist;
        this.gx += dx * ratio;
        this.gy += dy * ratio;
        this.travelDistance += remainingDist;
        this.setFacing(vectorToFacing(dx, dy));
        remainingDist = 0;
      }
    }

    // Sinkronkan posisi layar dan depth sort zIndex
    this.updateScreenPosition();
  }
}
export type CharacterController = Pick<CharacterModel,
  'id' | 'characterName' | 'role' | 'signatureColor' | 'gx' | 'gy' | 'x' | 'y' | 'zIndex' | 'facing' | 'fsmState' | 'speed' | 'slotYOffset' | 'workStatus' | 'currentTask' | 'isSelected' | 'isHovered' | 'visible' | 'isShowingFailStamp' | 'isCarryingParcel' | 'isInspecting' | 'isCommenting' | 'isSweating' | 'onStateChange' | 'onArrive' | 'onAct' | 'onLeave' | 'getCurrentAnimation' | 'setFacing' | 'playAnimation' | 'setSelected' | 'showFailStamp' | 'setCarryingParcel' | 'setSweating' | 'update' | 'setWorkStatus' | 'setGridPosition' | 'updateScreenPosition' | 'walk' | 'arrive' | 'act' | 'leave' | 'idle' | 'getCurrentSlot'>;
