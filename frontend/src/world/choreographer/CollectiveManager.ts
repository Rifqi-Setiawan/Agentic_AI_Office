import type { GridMap } from '../../navigation/GridMap';
import type { AStarPathfinder } from '../../navigation/AStarPathfinder';
import type { SlotReservationManager } from '../../navigation/SlotReservationManager';
import type { InteractionSlot } from '../../navigation/types';
import type { CollectiveEventState } from '../../types/office';
import type {
  AgentChoreographyState,
  ChoreographerBubbleEvent,
  CollectiveSlotAssignment,
} from './types';
import type { Character } from '../Character';
import type { InteractionSlot as WorldInteractionSlot } from '../types';

export class CollectiveManager {
  private gridMap: GridMap;
  private pathfinder: AStarPathfinder;
  private slotManager: SlotReservationManager;
  private randomFn: () => number;
  private activeCollective: CollectiveEventState | null = null;
  private collectiveAssignments = new Map<string, CollectiveSlotAssignment>();
  private onBubble?: (event: ChoreographerBubbleEvent) => void;

  constructor(
    gridMap: GridMap,
    pathfinder: AStarPathfinder,
    slotManager: SlotReservationManager,
    randomFn?: () => number,
    onBubble?: (event: ChoreographerBubbleEvent) => void,
  ) {
    this.gridMap = gridMap;
    this.pathfinder = pathfinder;
    this.slotManager = slotManager;
    this.randomFn = randomFn ?? Math.random;
    this.onBubble = onBubble;
  }

  public getActiveCollective(): CollectiveEventState | null {
    return this.activeCollective;
  }

  public isCollectiveActive(): boolean {
    if (!this.activeCollective) return false;
    if (this.activeCollective.active === false) return false;
    const now = Math.floor(Date.now() / 1000);
    if (this.activeCollective.expires_at && now > this.activeCollective.expires_at) {
      return false;
    }
    return true;
  }

  /**
   * Mengatur atau memperbarui event kolektif dari store.
   */
  public setCollectiveEvent(
    collective: CollectiveEventState | null,
    agentStates: Map<string, AgentChoreographyState>,
    getCharacter: (id: string) => Character | undefined,
  ): void {
    const prevKind = this.activeCollective?.kind;
    const isNewActive = collective && collective.active !== false;

    if (!isNewActive) {
      if (this.activeCollective) {
        this.endCurrentCollective(agentStates, getCharacter);
      }
      this.activeCollective = null;
      return;
    }

    // Jika ada pergantian event kolektif
    if (this.activeCollective && this.activeCollective.id !== collective.id) {
      this.endCurrentCollective(agentStates, getCharacter);
    }

    this.activeCollective = collective;
    this.planAndDispatchCollective(collective, agentStates, getCharacter, prevKind !== collective.kind);
  }

  /**
   * Mengakhiri event kolektif yang sedang berjalan dan melepaskan reservasi slot.
   */
  public endCurrentCollective(
    agentStates: Map<string, AgentChoreographyState>,
    getCharacter: (id: string) => Character | undefined,
  ): void {
    for (const [agentId, assign] of this.collectiveAssignments.entries()) {
      this.slotManager.releaseSlot(assign.slot.id, agentId);
      const state = agentStates.get(agentId);
      if (state && state.currentLayer === 'collective') {
        state.currentLayer = 'ambient';
        state.targetSlotId = null;
        state.activityRemaining = 0; // Segera pilih ambient berikutnya
      }

      const char = getCharacter(agentId);
      if (char && char.fsmState === 'act') {
        char.leave();
      }
    }

    this.collectiveAssignments.clear();
  }

  /**
   * Menghitung penugasan slot dan memerintahkan agen non-working menuju slot event kolektif.
   */
  private planAndDispatchCollective(
    collective: CollectiveEventState,
    agentStates: Map<string, AgentChoreographyState>,
    getCharacter: (id: string) => Character | undefined,
    isInitialStart: boolean,
  ): void {
    switch (collective.kind) {
      case 'sholat':
        this.dispatchSholat(collective, agentStates, getCharacter, isInitialStart);
        break;
      case 'rapat':
        this.dispatchRapat(collective, agentStates, getCharacter);
        break;
      case 'break':
        this.dispatchBreak(collective, agentStates, getCharacter);
        break;
    }
  }

  /**
   * Event Kolektif V1: Sholat Berjamaah
   * - Imam dipilih acak antara Jarvis dan Merlin (yang sedang tidak working).
   * - Shaf diisi berurutan (shaf 1 lalu shaf 2).
   * - Agen yang sedang 'working' TETAP di mejanya dan mengirim bubble "Nyusul setelah task ini".
   */
  private dispatchSholat(
    collective: CollectiveEventState,
    agentStates: Map<string, AgentChoreographyState>,
    getCharacter: (id: string) => Character | undefined,
    isInitialStart: boolean,
  ): void {
    const specified = collective.participants && collective.participants.length > 0
      ? new Set(collective.participants)
      : null;

    // Filter kandidat partisipan yang tidak sedang working
    const eligibleAgents: string[] = [];
    const workingAgents: string[] = [];

    for (const [agentId, state] of agentStates.entries()) {
      if (specified && !specified.has(agentId)) continue;

      if (state.workStatus === 'working') {
        workingAgents.push(agentId);
        // Aturan: Agen yang sedang kerja mengirim bubble "Nyusul setelah task ini"
        if (isInitialStart || !state.sholatNotified) {
          state.sholatNotified = true;
          this.emitBubble(agentId, 'Nyusul setelah task ini', 'collective');
        }
      } else {
        eligibleAgents.push(agentId);
      }
    }

    // 1. Pilih Imam: Jarvis atau Merlin secara acak (jika memenuhi syarat)
    let imamId: string | null = null;
    const canJarvis = eligibleAgents.includes('jarvis');
    const canMerlin = eligibleAgents.includes('merlin');

    if (canJarvis && canMerlin) {
      imamId = this.randomFn() < 0.5 ? 'jarvis' : 'merlin';
    } else if (canJarvis) {
      imamId = 'jarvis';
    } else if (canMerlin) {
      imamId = 'merlin';
    } else if (eligibleAgents.length > 0) {
      imamId = eligibleAgents[0];
    }

    // 2. Tempatkan Imam di slot_z16_imam
    const imamSlot = this.gridMap.getSlot('slot_z16_imam');
    if (imamId && imamSlot) {
      this.assignAgentToSlot(imamId, imamSlot, 'imam', agentStates, getCharacter);
    }

    // 3. Peserta lainnya mengisi shaf 1 dan shaf 2 berurutan
    const otherParticipants = eligibleAgents.filter((id) => id !== imamId);

    // Ambil daftar slot shaf secara berurutan: shaf1_1..8 lalu shaf2_1..8
    const shafSlots: InteractionSlot[] = [];
    for (let i = 1; i <= 8; i++) {
      const s = this.gridMap.getSlot(`slot_z16_shaf1_${i}`);
      if (s) shafSlots.push(s);
    }
    for (let i = 1; i <= 8; i++) {
      const s = this.gridMap.getSlot(`slot_z16_shaf2_${i}`);
      if (s) shafSlots.push(s);
    }

    for (let i = 0; i < otherParticipants.length && i < shafSlots.length; i++) {
      const participantId = otherParticipants[i];
      const slot = shafSlots[i];
      this.assignAgentToSlot(participantId, slot, 'shaf', agentStates, getCharacter);
    }
  }

  /**
   * Event Kolektif V1: Rapat Mendadak
   * - Presenter di slot_z02_presenter (Jarvis atau peserta pertama).
   * - Anggota rapat duduk di slot_z02_seat_1..12 berurutan.
   * - Agen 'working' tetap bekerja di mejanya.
   */
  private dispatchRapat(
    collective: CollectiveEventState,
    agentStates: Map<string, AgentChoreographyState>,
    getCharacter: (id: string) => Character | undefined,
  ): void {
    const specified = collective.participants && collective.participants.length > 0
      ? new Set(collective.participants)
      : null;

    const eligibleAgents: string[] = [];
    for (const [agentId, state] of agentStates.entries()) {
      if (specified && !specified.has(agentId)) continue;
      if (state.workStatus !== 'working') {
        eligibleAgents.push(agentId);
      }
    }

    if (eligibleAgents.length === 0) return;

    // Presenter: prioritaskan Jarvis jika tersedia, atau peserta pertama
    const presenterId = eligibleAgents.find((id) => id === 'jarvis') || eligibleAgents[0];
    const presenterSlot = this.gridMap.getSlot('slot_z02_presenter');

    if (presenterSlot && presenterId) {
      this.assignAgentToSlot(presenterId, presenterSlot, 'presenter', agentStates, getCharacter);
    }

    const attendees = eligibleAgents.filter((id) => id !== presenterId);
    const seatSlots: InteractionSlot[] = [];
    for (let i = 1; i <= 12; i++) {
      const s = this.gridMap.getSlot(`slot_z02_seat_${i}`);
      if (s) seatSlots.push(s);
    }

    for (let i = 0; i < attendees.length && i < seatSlots.length; i++) {
      this.assignAgentToSlot(attendees[i], seatSlots[i], 'attendee', agentStates, getCharacter);
    }
  }

  /**
   * Event Kolektif V1: Break Time
   * - Agen menuju Kafetaria Z14 (cafe_seat, counter_queue, lounge_sofa).
   * - Agen 'working' tetap bekerja di mejanya.
   */
  private dispatchBreak(
    collective: CollectiveEventState,
    agentStates: Map<string, AgentChoreographyState>,
    getCharacter: (id: string) => Character | undefined,
  ): void {
    const specified = collective.participants && collective.participants.length > 0
      ? new Set(collective.participants)
      : null;

    const eligibleAgents: string[] = [];
    for (const [agentId, state] of agentStates.entries()) {
      if (specified && !specified.has(agentId)) continue;
      if (state.workStatus !== 'working') {
        eligibleAgents.push(agentId);
      }
    }

    if (eligibleAgents.length === 0) return;

    // Kumpulkan slot Z14
    const breakSlots: InteractionSlot[] = [
      ...this.gridMap.getSlotsByType('cafe_seat'),
      ...this.gridMap.getSlotsByType('counter_queue'),
      ...this.gridMap.getSlotsByType('lounge_sofa'),
    ];

    let slotIdx = 0;
    for (const agentId of eligibleAgents) {
      if (slotIdx >= breakSlots.length) break;
      const slot = breakSlots[slotIdx++];
      this.assignAgentToSlot(agentId, slot, 'participant', agentStates, getCharacter);
    }
  }

  /**
   * Menugaskan agen ke slot kolektif tertentu dan memulai navigasi A*.
   */
  private assignAgentToSlot(
    agentId: string,
    slot: InteractionSlot,
    role: 'imam' | 'shaf' | 'presenter' | 'attendee' | 'participant',
    agentStates: Map<string, AgentChoreographyState>,
    getCharacter: (id: string) => Character | undefined,
  ): void {
    const char = getCharacter(agentId);
    const state = agentStates.get(agentId);
    if (!char || !state) return;

    // Jika sudah ditugaskan ke slot ini
    const existing = this.collectiveAssignments.get(agentId);
    if (existing && existing.slot.id === slot.id) return;

    // Lepaskan slot sebelumnya
    this.slotManager.releaseAllForAgent(agentId);

    // Reservasi slot kolektif
    this.slotManager.reserveSlot(slot.id, agentId, { releasePrevious: true });
    this.collectiveAssignments.set(agentId, { agentId, slot, role });

    state.currentLayer = 'collective';
    state.targetSlotId = slot.id;

    // Cari jalur A*
    const path = this.pathfinder.findPath(
      { gx: char.gx, gy: char.gy },
      { gx: slot.gx, gy: slot.gy },
    );

    if (path) {
      char.walk(path, slot as unknown as WorldInteractionSlot);
    } else {
      // Fallback teleport jika koordinat sudah sama atau tertutup
      char.setGridPosition(slot.gx, slot.gy);
      char.act(slot as unknown as WorldInteractionSlot);
    }
  }

  private emitBubble(agentId: string, text: string, kind: 'collective' | 'task' | 'ambient'): void {
    if (this.onBubble) {
      this.onBubble({
        agentId,
        text,
        timestamp: Date.now(),
        kind,
      });
    }
  }

  /**
   * Menghapus seorang agen dari partisipasi event kolektif saat menerima task nyata.
   */
  public removeAgentFromCollective(agentId: string): void {
    const assign = this.collectiveAssignments.get(agentId);
    if (assign) {
      this.slotManager.releaseSlot(assign.slot.id, agentId);
      this.collectiveAssignments.delete(agentId);
    }
  }

  public isAgentInCollective(agentId: string): boolean {
    return this.collectiveAssignments.has(agentId);
  }

  public getAssignment(agentId: string): CollectiveSlotAssignment | undefined {
    return this.collectiveAssignments.get(agentId);
  }
}
