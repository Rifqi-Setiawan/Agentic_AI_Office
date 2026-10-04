import type { GridMap } from '../../navigation/GridMap';
import type { AStarPathfinder } from '../../navigation/AStarPathfinder';
import type { SlotReservationManager } from '../../navigation/SlotReservationManager';
import type { InteractionSlot } from '../../navigation/types';
import type { Character } from '../Character';
import type { InteractionSlot as WorldInteractionSlot } from '../types';
import type {
  AgentChoreographyState,
  AmbientActivityDef,
} from './types';
import { PERSONA_AMBIENT_CONFIGS } from './personaData';
import { officeStore } from '../../store/officeStore';

export class AmbientScheduler {
  private gridMap: GridMap;
  private pathfinder: AStarPathfinder;
  private slotManager: SlotReservationManager;
  private randomFn: () => number;

  constructor(
    gridMap: GridMap,
    pathfinder: AStarPathfinder,
    slotManager: SlotReservationManager,
    randomFn?: () => number,
  ) {
    this.gridMap = gridMap;
    this.pathfinder = pathfinder;
    this.slotManager = slotManager;
    this.randomFn = randomFn ?? Math.random;
  }

  /**
   * Menjadwalkan aktivitas ambient baru untuk seorang agen yang sedang idle.
   * - Menghormati bobot persona (spec bagian 3).
   * - Durasi aktivitas 30–120 detik.
   * - Tidak memilih aktivitas yang sama dua kali berturut-turut.
   */
  public scheduleNextAmbientActivity(
    agentId: string,
    state: AgentChoreographyState,
    char: Character,
  ): boolean {
    // Fitur F22: Mode Jujur mematikan ambient — agen idle diam di mejanya/zonanya
    if (officeStore.getState().isHonestMode) {
      return this.fallbackToDesk(agentId, state, char);
    }

    const config = PERSONA_AMBIENT_CONFIGS[agentId];
    if (!config || config.activities.length === 0) {
      return this.fallbackToDesk(agentId, state, char);
    }

    // 1. Filter agar tidak memilih aktivitas yang sama dua kali berturut-turut
    const lastKey = state.currentActivityKey ?? state.lastActivityKey;
    let candidates = config.activities.filter((act) => act.key !== lastKey);
    if (candidates.length === 0) {
      candidates = config.activities;
    }

    // 2. Pemilihan acak berbobot (weighted random selection)
    const selectedActivity = this.selectWeightedActivity(candidates);
    if (!selectedActivity) {
      return this.fallbackToDesk(agentId, state, char);
    }

    // 3. Cari slot yang cocok dan masih tersedia
    const targetSlot = this.findAvailableSlotForActivity(selectedActivity, agentId, char);
    if (!targetSlot) {
      // Jika semua slot aktivitas tersebut penuh, coba kandidat lain
      const alternateCandidates = candidates.filter((act) => act.key !== selectedActivity.key);
      for (const alt of alternateCandidates) {
        const altSlot = this.findAvailableSlotForActivity(alt, agentId, char);
        if (altSlot) {
          return this.dispatchAgentToAmbientSlot(agentId, alt, altSlot, state, char);
        }
      }
      return this.fallbackToDesk(agentId, state, char);
    }

    return this.dispatchAgentToAmbientSlot(agentId, selectedActivity, targetSlot, state, char);
  }

  /**
   * Melakukan pemilihan acak berbobot dari daftar aktivitas persona.
   */
  private selectWeightedActivity(activities: AmbientActivityDef[]): AmbientActivityDef | null {
    if (activities.length === 0) return null;

    const totalWeight = activities.reduce((sum, act) => sum + act.weight, 0);
    if (totalWeight <= 0) return activities[0];

    const roll = this.randomFn() * totalWeight;
    let accumulated = 0;

    for (const act of activities) {
      accumulated += act.weight;
      if (roll <= accumulated) {
        return act;
      }
    }

    return activities[activities.length - 1];
  }

  /**
   * Menemukan slot interaksi yang cocok dengan definisi aktivitas dan belum penuh.
   */
  private findAvailableSlotForActivity(
    activity: AmbientActivityDef,
    _agentId: string,
    char: Character,
  ): InteractionSlot | null {
    const candidateSlots: InteractionSlot[] = [];

    // Jika aktivitas menentukan slotIds spesifik
    if (activity.slotIds && activity.slotIds.length > 0) {
      for (const id of activity.slotIds) {
        const s = this.gridMap.getSlot(id);
        if (s && this.slotManager.isAvailable(s.id)) {
          candidateSlots.push(s);
        }
      }
    }

    // Jika slotIds belum ada atau belum menemukan slot, cari berdasar slotTypes dan zone
    if (candidateSlots.length === 0 && activity.slotTypes) {
      for (const type of activity.slotTypes) {
        const slotsOfType = this.gridMap.getSlotsByType(type);
        for (const s of slotsOfType) {
          if (activity.zone && s.zone !== activity.zone) continue;
          if (this.slotManager.isAvailable(s.id)) {
            candidateSlots.push(s);
          }
        }
        // Urutan jenis slot menyatakan pilihan utama lalu fallback (mis. renang
        // sebelum kursi kolam); jarak dipakai di dalam jenis yang dipilih.
        if (candidateSlots.length > 0) break;
      }
    }

    if (candidateSlots.length === 0) return null;

    // Pilih slot yang paling dekat dengan posisi agen saat ini untuk efisiensi
    let bestSlot = candidateSlots[0];
    let bestDist = Number.POSITIVE_INFINITY;

    for (const s of candidateSlots) {
      const d = Math.hypot(s.gx - char.gx, s.gy - char.gy);
      if (d < bestDist) {
        bestDist = d;
        bestSlot = s;
      }
    }

    return bestSlot;
  }

  /**
   * Memberangkatkan agen ke slot ambient yang telah ditentukan.
   */
  private dispatchAgentToAmbientSlot(
    agentId: string,
    activity: AmbientActivityDef,
    slot: InteractionSlot,
    state: AgentChoreographyState,
    char: Character,
  ): boolean {
    // Lepaskan slot sebelumnya
    this.slotManager.releaseAllForAgent(agentId);

    // Cadangkan slot baru
    this.slotManager.reserveSlot(slot.id, agentId, { releasePrevious: true });

    // Durasi aktivitas: 30 hingga 120 detik (spec)
    const duration = 30 + this.randomFn() * 90;

    state.currentLayer = 'ambient';
    state.lastActivityKey = state.currentActivityKey;
    state.currentActivityKey = activity.key;
    state.activityDuration = duration;
    state.activityRemaining = duration;
    state.targetSlotId = slot.id;

    // Slot khusus menentukan pose yang cocok dengan furniturnya. Slot generik
    // mengikuti aktivitas persona, mis. minum teh di kursi kafe.
    const slotAnimationTypes = ['pool_swim', 'pool_lounger', 'arcade', 'billiard', 'beanbag', 'whiteboard'];
    const activitySlot = {
      ...slot,
      anim: slotAnimationTypes.includes(slot.type) ? slot.anim : (activity.anim ?? slot.anim),
    };

    // Reset kecepatan ke default (2.5 tile/detik)
    char.speed = 2.5;

    const path = this.pathfinder.findPath(
      { gx: char.gx, gy: char.gy },
      { gx: slot.gx, gy: slot.gy },
    );

    if (path) {
      char.walk(path, activitySlot as unknown as WorldInteractionSlot);
    } else {
      // Jika jalur tak terduga tidak ditemukan, tempatkan di slot
      char.setGridPosition(slot.gx, slot.gy);
      char.act(activitySlot as unknown as WorldInteractionSlot);
    }

    return true;
  }

  /**
   * Fallback aman: kembalikan agen ke mejanya sendiri jika tidak ada slot ambient yang dapat dituju.
   */
  public fallbackToDesk(
    agentId: string,
    state: AgentChoreographyState,
    char: Character,
  ): boolean {
    const deskSlot = this.gridMap.getSlot(state.deskSlotId);
    if (!deskSlot) return false;

    // Jika sudah di meja dan sedang beraktivitas (act), cukup perpanjang durasi
    const currSlot = char.getCurrentSlot();
    if (currSlot && currSlot.id === deskSlot.id && char.fsmState === 'act') {
      state.activityRemaining = 30 + this.randomFn() * 30;
      return true;
    }

    this.slotManager.releaseAllForAgent(agentId);
    this.slotManager.reserveSlot(deskSlot.id, agentId, { releasePrevious: true });

    const duration = 30 + this.randomFn() * 30; // 30–60 detik di meja
    state.currentLayer = 'ambient';
    state.lastActivityKey = state.currentActivityKey;
    state.currentActivityKey = 'desk_relax';
    state.activityDuration = duration;
    state.activityRemaining = duration;
    state.targetSlotId = deskSlot.id;

    char.speed = 2.5;

    const path = this.pathfinder.findPath(
      { gx: char.gx, gy: char.gy },
      { gx: deskSlot.gx, gy: deskSlot.gy },
    );

    if (path) {
      char.walk(path, deskSlot as unknown as WorldInteractionSlot);
    } else {
      char.setGridPosition(deskSlot.gx, deskSlot.gy);
      char.act(deskSlot as unknown as WorldInteractionSlot);
    }

    return true;
  }
}
