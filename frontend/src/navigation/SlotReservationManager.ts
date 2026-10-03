import type { GridMap } from './GridMap';
import type {
  InteractionSlot,
  SlotReleaseResult,
  SlotReservationResult,
} from './types';

interface SlotState {
  slot: InteractionSlot;
  occupants: string[];
  queue: string[];
}

export class SlotReservationManager {
  private slots = new Map<string, SlotState>();
  private agentToSlot = new Map<
    string,
    { slotId: string; status: 'reserved' | 'queued' }
  >();

  constructor(slotsOrMap: InteractionSlot[] | GridMap) {
    const list =
      'getAllSlots' in slotsOrMap ? slotsOrMap.getAllSlots() : slotsOrMap;
    for (const slot of list) {
      this.slots.set(slot.id, {
        slot,
        occupants: [],
        queue: [],
      });
    }
  }

  /**
   * Mengajukan reservasi slot untuk seorang agen.
   * Satu agent per kapasitas slot (default 1). Jika penuh, agent dimasukkan ke antrean FIFO.
   */
  public reserveSlot(
    slotId: string,
    agentId: string,
    options: { releasePrevious?: boolean } = {}
  ): SlotReservationResult {
    const state = this.slots.get(slotId);
    if (!state) {
      return {
        success: false,
        status: 'not_found',
        slotId,
        position: -1,
      };
    }

    // Jika agen sudah menjadi occupant di slot ini
    if (state.occupants.includes(agentId)) {
      return {
        success: true,
        status: 'already_reserved',
        slotId,
        position: 0,
      };
    }

    // Jika agen sudah mengantre di slot ini
    const existingQueueIdx = state.queue.indexOf(agentId);
    if (existingQueueIdx !== -1) {
      return {
        success: true,
        status: 'already_queued',
        slotId,
        position: existingQueueIdx + 1,
      };
    }

    if (options.releasePrevious) {
      this.releaseAllForAgent(agentId);
    }

    const capacity = state.slot.capacity || 1;

    // Slot masih memiliki kapasitas kosong
    if (state.occupants.length < capacity) {
      state.occupants.push(agentId);
      this.agentToSlot.set(agentId, { slotId, status: 'reserved' });

      return {
        success: true,
        status: 'reserved',
        slotId,
        position: 0,
      };
    }

    // Slot penuh -> masukkan ke antrean FIFO
    state.queue.push(agentId);
    this.agentToSlot.set(agentId, { slotId, status: 'queued' });

    return {
      success: true,
      status: 'queued',
      slotId,
      position: state.queue.length,
    };
  }

  /**
   * Melepaskan reservasi slot seorang agen.
   * Jika ada antrean, agen pertama dalam antrean secara otomatis dipromosikan menjadi occupant.
   */
  public releaseSlot(slotId: string, agentId: string): SlotReleaseResult {
    const state = this.slots.get(slotId);
    if (!state) {
      return {
        success: false,
        status: 'not_found',
        slotId,
        promotedAgentId: null,
      };
    }

    const occupantIdx = state.occupants.indexOf(agentId);
    if (occupantIdx !== -1) {
      state.occupants.splice(occupantIdx, 1);
      this.agentToSlot.delete(agentId);

      let promotedAgentId: string | null = null;
      if (state.queue.length > 0) {
        promotedAgentId = state.queue.shift()!;
        state.occupants.push(promotedAgentId);
        this.agentToSlot.set(promotedAgentId, { slotId, status: 'reserved' });
      }

      return {
        success: true,
        status: 'released',
        slotId,
        promotedAgentId,
      };
    }

    // Cek apakah agen ada di antrean
    const queueIdx = state.queue.indexOf(agentId);
    if (queueIdx !== -1) {
      state.queue.splice(queueIdx, 1);
      this.agentToSlot.delete(agentId);

      return {
        success: true,
        status: 'queue_cancelled',
        slotId,
        promotedAgentId: null,
      };
    }

    return {
      success: false,
      status: 'not_reserved',
      slotId,
      promotedAgentId: null,
    };
  }

  /**
   * Membatalkan antrean agen di slot tertentu tanpa mengganggu occupant aktif.
   */
  public cancelQueue(slotId: string, agentId: string): boolean {
    const state = this.slots.get(slotId);
    if (!state) return false;

    const idx = state.queue.indexOf(agentId);
    if (idx !== -1) {
      state.queue.splice(idx, 1);
      this.agentToSlot.delete(agentId);
      return true;
    }
    return false;
  }

  /**
   * Melepaskan seluruh reservasi dan antrean untuk agen yang bersangkutan.
   * Mengembalikan daftar slotId yang tersentuh.
   */
  public releaseAllForAgent(agentId: string): string[] {
    const touched: string[] = [];
    for (const [slotId, state] of this.slots.entries()) {
      if (state.occupants.includes(agentId)) {
        this.releaseSlot(slotId, agentId);
        touched.push(slotId);
      } else if (state.queue.includes(agentId)) {
        this.cancelQueue(slotId, agentId);
        touched.push(slotId);
      }
    }
    this.agentToSlot.delete(agentId);
    return touched;
  }

  public isAvailable(slotId: string): boolean {
    const state = this.slots.get(slotId);
    if (!state) return false;
    const capacity = state.slot.capacity || 1;
    return state.occupants.length < capacity;
  }

  public getOccupants(slotId: string): string[] {
    return this.slots.get(slotId)?.occupants.slice() ?? [];
  }

  public getPrimaryOccupant(slotId: string): string | null {
    const occ = this.slots.get(slotId)?.occupants;
    return occ && occ.length > 0 ? occ[0] : null;
  }

  public getQueue(slotId: string): string[] {
    return this.slots.get(slotId)?.queue.slice() ?? [];
  }

  public getQueueLength(slotId: string): number {
    return this.slots.get(slotId)?.queue.length ?? 0;
  }

  public getSlot(slotId: string): InteractionSlot | undefined {
    return this.slots.get(slotId)?.slot;
  }

  public getAgentReservation(agentId: string): {
    slotId: string;
    status: 'reserved' | 'queued';
    position: number;
  } | null {
    const current = this.agentToSlot.get(agentId);
    if (!current) return null;

    const state = this.slots.get(current.slotId);
    if (!state) return null;

    if (current.status === 'reserved') {
      return { slotId: current.slotId, status: 'reserved', position: 0 };
    }

    const qIdx = state.queue.indexOf(agentId);
    return {
      slotId: current.slotId,
      status: 'queued',
      position: qIdx !== -1 ? qIdx + 1 : -1,
    };
  }

  public findAvailableSlots(filter?: {
    zone?: string;
    type?: string;
  }): InteractionSlot[] {
    const res: InteractionSlot[] = [];
    for (const state of this.slots.values()) {
      if (filter?.zone && state.slot.zone !== filter.zone) continue;
      if (filter?.type && state.slot.type !== filter.type) continue;
      const capacity = state.slot.capacity || 1;
      if (state.occupants.length < capacity) {
        res.push(state.slot);
      }
    }
    return res;
  }

  public findDeskForAgent(agentId: string): InteractionSlot | null {
    const normalized = agentId.toLowerCase();
    const deskType = `desk:${normalized}`;
    for (const state of this.slots.values()) {
      if (state.slot.type === deskType) {
        return state.slot;
      }
    }
    return null;
  }

  public getStats(): {
    totalSlots: number;
    occupiedSlots: number;
    availableSlots: number;
    queuedAgentsCount: number;
  } {
    let occupied = 0;
    let available = 0;
    let queued = 0;

    for (const state of this.slots.values()) {
      const cap = state.slot.capacity || 1;
      if (state.occupants.length >= cap) {
        occupied++;
      } else {
        available++;
      }
      queued += state.queue.length;
    }

    return {
      totalSlots: this.slots.size,
      occupiedSlots: occupied,
      availableSlots: available,
      queuedAgentsCount: queued,
    };
  }
}
