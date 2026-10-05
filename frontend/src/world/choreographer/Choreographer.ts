import type { GridMap } from '../../navigation/GridMap';
import { type AStarPathfinder, vectorToFacing } from '../../navigation/AStarPathfinder';
import type { SlotReservationManager } from '../../navigation/SlotReservationManager';
import type { InteractionSlot, PathNode } from '../../navigation/types';
import type { InteractionSlot as WorldInteractionSlot } from '../types';
import { DEFAULT_WALK_SPEED, type CharacterController as Character } from '../simulation/CharacterModel';
import type { CharacterRegistry as CharacterManager } from '../simulation/CharacterRegistry';
import { AGENT_SPAWN_DEFS } from '../simulation/roster';
import { officeStore, type OfficeState } from '../../store/officeStore';
import type { AgentState, CollectiveEventState, OfficeEvent } from '../../types/office';
import type {
  AgentChoreographyState,
  ChoreographerBubbleEvent,
  ChoreographerConfig,
} from './types';
import { CollectiveManager } from './CollectiveManager';
import { AmbientScheduler } from './AmbientScheduler';
import { getRandomConversation, getConversationsBetween } from '../bubble/conversationBank';

export class Choreographer {
  private characterManager: CharacterManager;
  private gridMap: GridMap;
  private pathfinder: AStarPathfinder;
  private slotManager: SlotReservationManager;
  private randomFn: () => number;

  private collectiveManager: CollectiveManager;
  private ambientScheduler: AmbientScheduler;

  private agentStates = new Map<string, AgentChoreographyState>();
  private bubbleListeners = new Set<(event: ChoreographerBubbleEvent) => void>();
  private recentBubbles: ChoreographerBubbleEvent[] = [];
  private processedEventSeqs = new Set<number>();

  private storeUnsubscribe: (() => void) | null = null;
  private isInitialized = false;

  constructor(config: ChoreographerConfig) {
    this.characterManager = config.characterManager;
    this.gridMap = config.gridMap;
    this.pathfinder = config.pathfinder;
    this.slotManager = config.slotManager;
    this.randomFn = config.randomFn ?? Math.random;

    if (config.onBubble) {
      this.bubbleListeners.add(config.onBubble);
    }

    const bubbleDispatcher = (event: ChoreographerBubbleEvent) => {
      this.recentBubbles.push(event);
      if (this.recentBubbles.length > 100) {
        this.recentBubbles.shift();
      }
      for (const listener of this.bubbleListeners) {
        try {
          listener(event);
        } catch (err) {
          console.error('[Choreographer] Error pada bubble listener:', err);
        }
      }
    };

    this.collectiveManager = new CollectiveManager(
      this.gridMap,
      this.pathfinder,
      this.slotManager,
      this.randomFn,
      bubbleDispatcher,
    );

    this.ambientScheduler = new AmbientScheduler(
      this.gridMap,
      this.pathfinder,
      this.slotManager,
      this.randomFn,
    );
  }

  /**
   * Inisialisasi choreographer:
   * 1. Inisialisasi state agen yang tersedia pada character manager.
   * 2. Cadangkan slot meja masing-masing di SlotReservationManager.
   * 3. Pasang subscription ke vanilla Zustand officeStore.
   */
  public init(): void {
    if (this.isInitialized) return;

    for (const def of AGENT_SPAWN_DEFS) {
      // A scene may omit agents whose artwork is unavailable. They must not
      // reserve invisible seats or join activities through choreography state.
      if (!this.characterManager.getCharacter(def.id)) continue;
      let deskSlot = this.gridMap.getSlot(def.defaultSlotId);
      if (!deskSlot) {
        deskSlot = this.slotManager.findDeskForAgent(def.id) ?? undefined;
      }

      const deskSlotId = deskSlot ? deskSlot.id : def.defaultSlotId;

      const state: AgentChoreographyState = {
        agentId: def.id,
        currentLayer: 'ambient',
        currentActivityKey: 'desk_init',
        lastActivityKey: null,
        activityDuration: 30 + this.randomFn() * 30,
        activityRemaining: 30 + this.randomFn() * 30,
        targetSlotId: deskSlotId,
        lastGx: def.fallbackGx,
        lastGy: def.fallbackGy,
        timeAtTile: 0,
        deskSlotId,
        workStatus: 'idle',
        currentTask: null,
        celebrateRemaining: 0,
        needsInputReported: false,
        sholatNotified: false,
      };

      this.agentStates.set(def.id, state);

      // Cadangkan slot meja awal jika ada
      if (deskSlot) {
        this.slotManager.reserveSlot(deskSlot.id, def.id, { releasePrevious: true });
      }
    }

    // Cadangkan event awal agar tidak diproses ulang saat inisialisasi
    for (const ev of officeStore.getState().recentEvents) {
      this.processedEventSeqs.add(ev.seq);
    }

    // Sambungkan ke store
    this.subscribeToStore();
    this.isInitialized = true;
  }

  /**
   * Berlangganan perubahan state dari vanilla Zustand store.
   */
  private subscribeToStore(): void {
    this.storeUnsubscribe = officeStore.subscribe((state: OfficeState, prevState: OfficeState) => {
      // 1. Cek perubahan event kolektif
      if (state.activeCollective !== prevState.activeCollective) {
        this.onCollectiveEventChanged(state.activeCollective);
      }

      // 2. Cek pembaruan delta agen
      if (state.agents !== prevState.agents) {
        for (const [id, agentData] of Object.entries(state.agents)) {
          const prevData = prevState.agents[id];
          const prevTask = prevData?.task;
          const currTask = agentData.task;
          const taskChanged =
            prevTask?.id !== currTask?.id ||
            prevTask?.status !== currTask?.status ||
            prevTask?.block_kind !== currTask?.block_kind;

          if (!prevData || prevData.work !== agentData.work || taskChanged) {
            this.onAgentStateChanged(id, agentData);
          }
        }
      }

      // 3. Cek penambahan event kantor (T2.2 / F20: Reaksi berbasis event)
      if (state.recentEvents !== prevState.recentEvents) {
        for (let i = state.recentEvents.length - 1; i >= 0; i--) {
          const ev = state.recentEvents[i];
          if (!this.processedEventSeqs.has(ev.seq)) {
            this.processedEventSeqs.add(ev.seq);
            this.handleOfficeEvent(ev);
          }
        }
        if (this.processedEventSeqs.size > 1000) {
          const seqs = Array.from(this.processedEventSeqs).slice(-500);
          this.processedEventSeqs = new Set(seqs);
        }
      }

      // 4. Cek perubahan status Mode Jujur (F22)
      if (state.isHonestMode !== prevState.isHonestMode) {
        this.onHonestModeChanged(state.isHonestMode);
      }
    });

    // Jalankan rekonsiliasi awal
    const currentStore = officeStore.getState();
    if (currentStore.activeCollective) {
      this.onCollectiveEventChanged(currentStore.activeCollective);
    }
    for (const [id, agentData] of Object.entries(currentStore.agents)) {
      this.onAgentStateChanged(id, agentData);
    }
  }

  /**
   * Handler saat terjadi perubahan status atau task pada seorang agen.
   */
  public onAgentStateChanged(agentId: string, agentData: AgentState): void {
    const state = this.agentStates.get(agentId);
    const char = this.characterManager.getCharacter(agentId);
    if (!state || !char) return;

    const prevWork = state.workStatus;
    const newWork = agentData.work;
    state.workStatus = newWork;
    state.currentTask = agentData.task ?? null;

    // Sinkronkan visual status kerja ke karakter (badge hanya untuk 'working')
    char.setWorkStatus(newWork, state.currentTask);

    // ==========================================
    // LAPISAN PRIORITAS 1: TASK NYATA
    // ==========================================
    if (newWork !== 'idle' && this.collectiveManager.isAgentInCollective(agentId)) {
      this.collectiveManager.removeAgentFromCollective(agentId);
    }
    if (newWork === 'working') {
      // Jika sebelumnya ikut event kolektif, lepaskan dari event kolektif
      if (this.collectiveManager.isAgentInCollective(agentId)) {
        this.collectiveManager.removeAgentFromCollective(agentId);
      }

      state.currentLayer = 'task';
      state.currentActivityKey = 'working_task';
      this.sendAgentToDesk(agentId, state, char, true);
    } else if (newWork === 'stale') {
      state.currentLayer = 'task';
      state.currentActivityKey = 'stale_task';
      this.sendAgentToDesk(agentId, state, char, false);
    } else if (newWork === 'blocked') {
      state.currentLayer = 'task';
      state.currentActivityKey = 'blocked_task';
      if (agentData.task?.block_kind === 'needs_input') {
        this.sendAgentToJarvisDoor(agentId, state, char);
      } else {
        this.sendAgentToDesk(agentId, state, char, false);
      }
    } else if (newWork === 'done_recent') {
      state.currentLayer = 'task';
      state.currentActivityKey = 'done_celebrate';
      state.celebrateRemaining = 45; // Selebrasi 45 detik sesuai spec
      char.playAnimation('celebrate');
    } else if (newWork === 'failed') {
      state.currentLayer = 'task';
      state.currentActivityKey = 'task_failed';
      this.sendAgentToDesk(agentId, state, char, false);
      this.triggerBastionInspectionIfAvailable(agentId);
    } else if (newWork === 'idle') {
      // Jika baru saja beralih dari working/task ke idle
      if (prevWork !== 'idle') {
        state.currentLayer = 'ambient';
        state.celebrateRemaining = 0;
        state.needsInputReported = false;
        state.sholatNotified = false;

        // Cek apakah ada event kolektif aktif (Prioritas 2)
        if (this.collectiveManager.isCollectiveActive()) {
          this.collectiveManager.setCollectiveEvent(
            this.collectiveManager.getActiveCollective(),
            this.agentStates,
            (id) => this.characterManager.getCharacter(id),
          );
        } else {
          // Jadwalkan ambient baru
          this.ambientScheduler.scheduleNextAmbientActivity(agentId, state, char);
        }
      }
    } else if (newWork === 'off_duty') {
      state.currentLayer = 'task';
      char.visible = false;
    }
  }

  /**
   * Handler saat terjadi perubahan pada activeCollective di store.
   */
  public onCollectiveEventChanged(collective: CollectiveEventState | null): void {
    // Reset status notifikasi sholat jika event berganti
    if (!collective || collective.kind !== 'sholat') {
      for (const st of this.agentStates.values()) {
        st.sholatNotified = false;
      }
    }

    this.collectiveManager.setCollectiveEvent(
      collective,
      this.agentStates,
      (id) => this.characterManager.getCharacter(id),
    );
  }

  /**
   * Menangani perubahan status Mode Jujur (F22).
   * Saat aktif: matikan simulasi ambient, agen ambient/idle segera kembali ke meja zonanya.
   */
  public onHonestModeChanged(isHonestMode: boolean): void {
    if (!isHonestMode) return;

    for (const [agentId, state] of this.agentStates) {
      if (state.currentLayer === 'ambient' && state.workStatus === 'idle') {
        const char = this.characterManager.getCharacter(agentId);
        if (!char) continue;

        const deskSlot = this.gridMap.getSlot(state.deskSlotId);
        if (!deskSlot) continue;

        const currSlot = char.getCurrentSlot();
        if (currSlot?.id === deskSlot.id && char.fsmState === 'act') {
          continue;
        }

        // Kembalikan agen ke mejanya
        this.sendAgentToDesk(agentId, state, char, false);
      }
    }
  }

  /**
   * Mengirim agen kembali ke mejanya untuk mengerjakan task.
   * Untuk kriteria penerimaan: Forge harus tiba di mejanya dalam <= 10 dtk.
   */
  public sendAgentToDesk(
    agentId: string,
    state: AgentChoreographyState,
    char: Character,
    isUrgentWork: boolean,
  ): void {
    const deskSlot = this.gridMap.getSlot(state.deskSlotId);
    if (!deskSlot) return;

    // Jika agen sudah berada di slot meja kerjanya
    const currSlot = char.getCurrentSlot();
    if (currSlot && currSlot.id === deskSlot.id && char.fsmState === 'act') {
      return;
    }

    // Lepaskan slot sebelumnya dan cadangkan meja kerja
    this.slotManager.releaseAllForAgent(agentId);
    this.slotManager.reserveSlot(deskSlot.id, agentId, { releasePrevious: true });
    state.targetSlotId = deskSlot.id;

    const path = this.pathfinder.findPath(
      { gx: char.gx, gy: char.gy },
      { gx: deskSlot.gx, gy: deskSlot.gy },
    );

    if (path) {
      if (isUrgentWork) {
        // Jamin Forge dan agen lain tiba dalam <= 10 detik dari titik mana pun di peta
        const steps = Math.max(0, path.length - 1);
        if (steps > 0) {
          // 2.5 tile/detik x 9 detik = 22.5 tile. Jika jarak > 22 tile, sesuaikan kecepatan agar tiba <= 9 dtk
          char.speed = Math.max(DEFAULT_WALK_SPEED, steps / 9.0);
        } else {
          char.speed = DEFAULT_WALK_SPEED;
        }
      } else {
        char.speed = DEFAULT_WALK_SPEED;
      }

      char.onArrive = () => {
        char.speed = DEFAULT_WALK_SPEED;
      };

      char.walk(path, deskSlot as unknown as WorldInteractionSlot);
    } else {
      char.speed = DEFAULT_WALK_SPEED;
      char.setGridPosition(deskSlot.gx, deskSlot.gy);
      char.act(deskSlot as unknown as WorldInteractionSlot);
    }
  }

  /**
   * Task blocked needs_input: agen berjalan ke pintu Ruang Jarvis (Z01 door_queue).
   */
  private sendAgentToJarvisDoor(
    agentId: string,
    state: AgentChoreographyState,
    char: Character,
  ): void {
    const doorQueueSlots = [
      this.gridMap.getSlot('slot_z01_door_queue_1'),
      this.gridMap.getSlot('slot_z01_door_queue_2'),
      this.gridMap.getSlot('slot_z01_door_queue_3'),
    ].filter((s): s is InteractionSlot => s !== undefined);

    let chosenSlot = doorQueueSlots.find((s) => this.slotManager.isAvailable(s.id));
    if (!chosenSlot && doorQueueSlots.length > 0) {
      chosenSlot = doorQueueSlots[0];
    }

    if (!chosenSlot) {
      this.sendAgentToDesk(agentId, state, char, false);
      return;
    }

    this.slotManager.releaseAllForAgent(agentId);
    this.slotManager.reserveSlot(chosenSlot.id, agentId, { releasePrevious: true });
    state.targetSlotId = chosenSlot.id;

    char.speed = DEFAULT_WALK_SPEED;
    const path = this.pathfinder.findPath(
      { gx: char.gx, gy: char.gy },
      { gx: chosenSlot.gx, gy: chosenSlot.gy },
    );

    if (path) {
      char.walk(path, chosenSlot as unknown as WorldInteractionSlot);
    } else {
      char.setGridPosition(chosenSlot.gx, chosenSlot.gy);
      char.act(chosenSlot as unknown as WorldInteractionSlot);
    }
  }

  /**
   * Jika ada task failed, Bastion (jika idle) datang mengecek.
   */
  private triggerBastionInspectionIfAvailable(failedAgentId: string): void {
    this.handleTaskFailedReaction({
      seq: 0,
      ts: Math.floor(Date.now() / 1000),
      board: 'office-v2',
      kind: 'task_failed',
      agent: failedAgentId,
      message: `Eksekusi task pada agen ${failedAgentId} gagal`,
    });
  }

  /**
   * Pembaruan per frame (dipanggil dari WorldApp ticker).
   * @param dt Delta waktu dalam detik.
   */
  public update(dt: number): void {
    if (!this.isInitialized) return;
    this.collectiveManager.update(this.agentStates, id => this.characterManager.getCharacter(id));

    for (const [agentId, state] of this.agentStates.entries()) {
      const char = this.characterManager.getCharacter(agentId);
      if (!char) continue;

      // 1. Monitor posisi & pergerakan agen untuk watchdog anti-stuck
      const currentTileGx = Math.round(char.gx);
      const currentTileGy = Math.round(char.gy);

      if (char.fsmState === 'walk') {
        state.timeAtTile = 0;
        state.lastGx = currentTileGx;
        state.lastGy = currentTileGy;
      } else {
        if (state.lastGx === currentTileGx && state.lastGy === currentTileGy) {
          state.timeAtTile += dt;
        } else {
          state.lastGx = currentTileGx;
          state.lastGy = currentTileGy;
          state.timeAtTile = 0;
        }
      }

      // 2. Jika agen baru saja tiba di mejanya saat 'working', pastikan kecepatan normal
      if (state.workStatus === 'working' && char.fsmState === 'act') {
        char.speed = DEFAULT_WALK_SPEED;
      }

      // 3. Update selebrasi done_recent
      if (state.workStatus === 'done_recent') {
        state.celebrateRemaining -= dt;
        if (state.celebrateRemaining <= 0) {
          // Selebrasi selesai, beralih ke ambient jika store belum update
          state.workStatus = 'idle';
          char.setWorkStatus('idle');
          this.ambientScheduler.scheduleNextAmbientActivity(agentId, state, char);
        }
        continue;
      }

      // 3b. Update reaksi event khusus (T2.2 / F20: Reaksi berbasis event)
      if (state.currentActivityKey === 'jarvis_comment_talk') {
        if (char.fsmState !== 'walk') {
          state.activityRemaining -= dt;
          if (state.activityRemaining <= 0) {
            char.isCommenting = false;
            state.currentLayer = 'ambient';
            state.currentActivityKey = 'ambient_idle';
            this.sendAgentToDesk('jarvis', state, char, false);
          }
        }
        continue;
      }

      if (state.currentActivityKey === 'sentinel_fail_stamp') {
        state.activityRemaining -= dt;
        if (state.activityRemaining <= 0) {
          state.currentLayer = 'ambient';
          state.currentActivityKey = 'ambient_idle';
          char.playAnimation('idle');
        }
        continue;
      }

      if (state.currentActivityKey === 'relay_delivery') {
        if (char.fsmState !== 'walk') {
          state.activityRemaining -= dt;
          if (state.activityRemaining <= 0) {
            char.setCarryingParcel(false);
            state.currentLayer = 'ambient';
            state.currentActivityKey = 'ambient_idle';
            this.sendAgentToDesk('relay', state, char, false);
          }
        }
        continue;
      }

      if (state.currentActivityKey === 'bastion_inspect_failed') {
        if (char.fsmState !== 'walk') {
          state.activityRemaining -= dt;
          if (state.activityRemaining <= 0) {
            char.isInspecting = false;
            state.currentLayer = 'ambient';
            state.currentActivityKey = 'ambient_idle';
            this.sendAgentToDesk('bastion', state, char, false);
          }
        }
        continue;
      }

      // 3c. Update mondar-mandir Vector saat alert RAM (T2.4 / F23)
      if (state.currentActivityKey === 'vector_ram_pacing') {
        if (char.fsmState !== 'walk') {
          this.stepVectorPacing(char);
        }
        continue;
      }

      // 4. Jika agen sedang 'working', 'stale', atau 'blocked', mereka berada di bawah kendali Lapisan 1
      if (state.currentLayer === 'task') {
        continue;
      }

      // 5. Jika ada event kolektif aktif (Lapisan 2)
      if (this.collectiveManager.isCollectiveActive()) {
        // Pastikan agen yang idle mengikuti event kolektif jika belum ditugaskan
        if (state.workStatus === 'idle' && !this.collectiveManager.isAgentInCollective(agentId)) {
          this.collectiveManager.setCollectiveEvent(
            this.collectiveManager.getActiveCollective(),
            this.agentStates,
            (id) => this.characterManager.getCharacter(id),
          );
        }
        continue;
      }

      // Khusus avatar Rifqi: di mode Founder dikendalikan manual (klik-untuk-jalan);
      // di mode publik, Rifqi dikendalikan oleh ambient scheduler seperti agen biasa.
      if (agentId === 'rifqi' && this.isFounderMode()) {
        continue;
      }

      // ==========================================
      // LAPISAN PRIORITAS 3: AMBIENT SCHEDULER
      // ==========================================
      if (officeStore.getState().isHonestMode) {
        // Mode Jujur aktif: matikan ambient, agen idle tetap diam di mejanya/zonanya
        const deskSlot = this.gridMap.getSlot(state.deskSlotId);
        const currSlot = char.getCurrentSlot();
        if (deskSlot && (!currSlot || currSlot.id !== deskSlot.id)) {
          if (char.fsmState !== 'walk') {
            this.sendAgentToDesk(agentId, state, char, false);
          }
        } else if (char.fsmState === 'idle') {
          if (deskSlot && deskSlot.anim) {
            char.act(deskSlot as unknown as WorldInteractionSlot);
          }
        }
        continue;
      }

      if (char.fsmState === 'act') {
        state.activityRemaining -= dt;
        if (state.activityRemaining <= 0) {
          // Durasi aktivitas ambient habis (30–120 detik tercapai)
          char.leave();
          this.ambientScheduler.scheduleNextAmbientActivity(agentId, state, char);
        }
      } else if (char.fsmState === 'idle') {
        // Jika karakter idle tanpa aktivitas selama > 2 detik, jadwalkan aktivitas berikutnya
        if (state.timeAtTile > 2) {
          this.ambientScheduler.scheduleNextAmbientActivity(agentId, state, char);
        }
      }

      // 6. Anti-Stuck Watchdog:
      // Kriteria penerimaan 3: Tidak ada agen yang macet di satu tempat > 5 menit (300 dtk) kecuali sedang kerja.
      // Jika agen non-working berada di tile yang sama > 125 detik, paksa transisi ke aktivitas baru.
      if (state.workStatus !== 'working' && state.timeAtTile > 125) {
        char.leave();
        this.ambientScheduler.scheduleNextAmbientActivity(agentId, state, char);
      }
    }
  }

  /**
   * Mengecek apakah mode Founder saat ini aktif (terautentikasi dan proyeksi founder).
   */
  public isFounderMode(): boolean {
    const store = officeStore.getState();
    return Boolean(store.isFounderAuthenticated && store.projection === 'founder');
  }

  /**
   * Menangani klik lantai untuk avatar Rifqi pada mode Founder (F17 / T1.19).
   * Pada mode publik, klik lantai ditolak dan Rifqi tidak dapat dikendalikan.
   * Pada klik area tak terjangkau, Rifqi tidak macet dan perintah diabaikan dengan aman.
   */
  public handleFloorClick(gx: number, gy: number): boolean {
    if (!this.isFounderMode()) {
      return false;
    }

    const rifqi = this.characterManager.getCharacter('rifqi');
    if (!rifqi) return false;

    // Pastikan koordinat bulat
    const targetGx = Math.round(gx);
    const targetGy = Math.round(gy);

    // Kriteria Penerimaan 1: Area tak terjangkau tidak membuat Rifqi macet
    if (!this.gridMap.isWalkable(targetGx, targetGy)) {
      return false;
    }

    const startGx = Math.round(rifqi.gx);
    const startGy = Math.round(rifqi.gy);

    const path = this.pathfinder.findPath(
      { gx: startGx, gy: startGy },
      { gx: targetGx, gy: targetGy },
      { ignoredTiles: [{ gx: startGx, gy: startGy }] },
    );

    if (!path || path.length === 0) {
      return false;
    }

    // Lepaskan slot sebelumnya (misal lounge/sofa)
    this.slotManager.releaseAllForAgent('rifqi');

    const rifqiState = this.agentStates.get('rifqi');
    if (rifqiState) {
      rifqiState.currentLayer = 'task'; // Melindungi dari gangguan ambient scheduler
      rifqiState.currentActivityKey = 'founder_walk';
      rifqiState.targetSlotId = null;
    }

    rifqi.speed = DEFAULT_WALK_SPEED;
    rifqi.onArrive = () => {
      rifqi.idle();
    };

    rifqi.walk(path);
    return true;
  }

  /**
   * Menangani klik agent (F17 / T1.19):
   * 1. Selalu membuka inspector di HUD untuk agen yang diklik (baik mode publik maupun Founder).
   * 2. Di mode Founder:
   *    - Agen menoleh ke arah Rifqi ("agent menoleh")
   *    - Rifqi berjalan menghampiri agen ke tile adjacent walkable ("Rifqi menghampiri")
   *    - Keduanya saling berhadapan saat Rifqi tiba.
   * 3. Di mode publik:
   *    - Mengembalikan false (Rifqi tidak digerakkan, agen tidak dipaksa menoleh).
   * 4. Jika agen di area tak terjangkau:
   *    - Rifqi tidak macet, inspector tetap terbuka.
   */
  public handleAgentClick(agentId: string): boolean {
    // 1. Selalu buka inspector di HUD
    officeStore.getState().selectAgent(agentId);

    // 2. Kriteria Penerimaan 2: Mode publik tidak bisa mengendalikan Rifqi
    if (!this.isFounderMode()) {
      return false;
    }

    // Klik Rifqi sendiri hanya membuka inspector tanpa gerak
    if (agentId === 'rifqi') {
      return true;
    }

    const rifqi = this.characterManager.getCharacter('rifqi');
    const targetAgent = this.characterManager.getCharacter(agentId);
    if (!rifqi || !targetAgent) {
      return false;
    }

    // 3. Agen menoleh ke arah posisi Rifqi saat ini
    const dxToRifqi = rifqi.gx - targetAgent.gx;
    const dyToRifqi = rifqi.gy - targetAgent.gy;
    if (Math.abs(dxToRifqi) > 0.01 || Math.abs(dyToRifqi) > 0.01) {
      targetAgent.setFacing(vectorToFacing(dxToRifqi, dyToRifqi));
    }

    // 4. Cari kandidat tile adjacent di sekitar target agent yang walkable
    const targetGx = Math.round(targetAgent.gx);
    const targetGy = Math.round(targetAgent.gy);

    const offsets: Array<[number, number]> = [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
      [1, 1],
      [-1, -1],
      [1, -1],
      [-1, 1],
    ];

    const candidates = offsets
      .map(([ox, oy]) => ({ gx: targetGx + ox, gy: targetGy + oy }))
      .filter((p) => this.gridMap.isWalkable(p.gx, p.gy));

    // Cek apakah Rifqi sudah berada di salah satu tile adjacent
    const currRifqiGx = Math.round(rifqi.gx);
    const currRifqiGy = Math.round(rifqi.gy);
    const isAlreadyAdjacent = candidates.some(
      (c) => c.gx === currRifqiGx && c.gy === currRifqiGy,
    );

    if (isAlreadyAdjacent) {
      rifqi.idle();
      rifqi.setFacing(vectorToFacing(targetAgent.gx - rifqi.gx, targetAgent.gy - rifqi.gy));
      return true;
    }

    if (candidates.length === 0) {
      // Tidak ada tile adjacent yang walkable (area tak terjangkau)
      // Rifqi tidak macet
      return false;
    }

    // Urutkan kandidat berdasar jarak terdekat dari Rifqi
    candidates.sort(
      (a, b) =>
        Math.hypot(a.gx - rifqi.gx, a.gy - rifqi.gy) -
        Math.hypot(b.gx - rifqi.gx, b.gy - rifqi.gy),
    );

    const startGx = currRifqiGx;
    const startGy = currRifqiGy;
    let chosenPath: PathNode[] | null = null;

    for (const cand of candidates) {
      const path = this.pathfinder.findPath(
        { gx: startGx, gy: startGy },
        cand,
        { ignoredTiles: [{ gx: startGx, gy: startGy }] },
      );
      if (path && path.length > 0) {
        if (!chosenPath || path.length < chosenPath.length) {
          chosenPath = path;
        }
      }
    }

    if (!chosenPath || chosenPath.length === 0) {
      // Kriteria Penerimaan 1: Agen di area tak terjangkau tidak membuat Rifqi macet
      return false;
    }

    this.slotManager.releaseAllForAgent('rifqi');

    const rifqiState = this.agentStates.get('rifqi');
    if (rifqiState) {
      rifqiState.currentLayer = 'task';
      rifqiState.currentActivityKey = 'founder_approach';
      rifqiState.targetSlotId = null;
    }

    rifqi.speed = DEFAULT_WALK_SPEED;
    rifqi.onArrive = () => {
      rifqi.idle();
      // Keduanya saling menatap saat Rifqi tiba
      const dGx = targetAgent.gx - rifqi.gx;
      const dGy = targetAgent.gy - rifqi.gy;
      if (Math.abs(dGx) > 0.01 || Math.abs(dGy) > 0.01) {
        rifqi.setFacing(vectorToFacing(dGx, dGy));
        targetAgent.setFacing(vectorToFacing(-dGx, -dGy));
      }
    };

    rifqi.walk(chosenPath);
    return true;
  }

  /**
   * Menjalankan simulasi headless selama N detik.
   * Sangat berguna untuk pengujian headless 1 jam (3.600 detik).
   */
  public simulate(seconds: number, dt = 0.5): void {
    const steps = Math.ceil(seconds / dt);
    for (let i = 0; i < steps; i++) {
      this.update(dt);
      this.characterManager.update(dt);
    }
  }

  /**
   * Menerbitkan bubble message dan mendistribusikannya ke seluruh listener.
   */
  public emitBubble(
    agentId: string,
    text: string,
    kind: 'collective' | 'task' | 'ambient' | 'stamp' = 'task',
    isStamp?: boolean,
  ): void {
    const event: ChoreographerBubbleEvent = {
      agentId,
      text,
      timestamp: Date.now(),
      kind,
      isStamp: isStamp ?? (kind === 'stamp'),
    };
    this.recentBubbles.push(event);
    if (this.recentBubbles.length > 100) {
      this.recentBubbles.shift();
    }
    for (const listener of this.bubbleListeners) {
      try {
        listener(event);
      } catch (err) {
        console.error('[Choreographer] Error pada bubble listener:', err);
      }
    }
  }

  public onBubble(listener: (event: ChoreographerBubbleEvent) => void): () => void {
    this.bubbleListeners.add(listener);
    return () => {
      this.bubbleListeners.delete(listener);
    };
  }

  public getRecentBubbles(): ChoreographerBubbleEvent[] {
    return [...this.recentBubbles];
  }

  /**
   * Memicu percakapan dua arah (F27) antar dua agen yang sedang berdekatan atau berinteraksi.
   */
  public triggerTwoWayConversation(agentA: string, agentB: string): boolean {
    const conv = getRandomConversation(agentA, agentB, this.randomFn);
    if (!conv || conv.turns.length === 0) return false;

    // Emit giliran pertama
    const turn1 = conv.turns[0];
    this.emitBubble(turn1.agent, turn1.text, 'ambient');

    // Emit giliran kedua setelah jeda singkat jika ada
    if (conv.turns.length > 1) {
      const turn2 = conv.turns[1];
      setTimeout(() => {
        this.emitBubble(turn2.agent, turn2.text, 'ambient');
      }, 3500);
    }

    return true;
  }

  /**
   * Mengambil daftar percakapan yang tersedia untuk dua agen.
   */
  public getAvailableConversationsBetween(agentA: string, agentB: string) {
    return getConversationsBetween(agentA, agentB);
  }

  /**
   * Menangani event linimasa kantor dan memicu reaksi karakter (T2.2 / F20).
   */
  public handleOfficeEvent(event: OfficeEvent): void {
    if (!event || !event.kind) return;

    switch (event.kind) {
      case 'task_commented': {
        this.handleTaskCommentedReaction(event);
        break;
      }
      case 'task_blocked': {
        this.handleTaskBlockedReaction(event);
        break;
      }
      case 'task_done': {
        this.handleTaskDoneReaction(event);
        break;
      }
      case 'task_failed': {
        this.handleTaskFailedReaction(event);
        break;
      }
      default:
        break;
    }
  }

  /**
   * Reaksi 1: task_commented oleh jarvis -> Jarvis berjalan ke meja assignee dan stand_talk.
   */
  public handleTaskCommentedReaction(event: OfficeEvent): void {
    const actor = event.actor?.toLowerCase();
    const isJarvisActor = actor === 'jarvis' || (!actor && event.message?.toLowerCase().includes('jarvis'));
    if (!isJarvisActor) return;

    const assigneeId = event.agent || (event.task as { assignee?: string } | undefined)?.assignee;
    if (!assigneeId || assigneeId.toLowerCase() === 'jarvis') return;

    const jarvisChar = this.characterManager.getCharacter('jarvis');
    const jarvisState = this.agentStates.get('jarvis');
    if (!jarvisChar || !jarvisState) return;

    const assigneeState = this.agentStates.get(assigneeId);
    const deskSlotId = assigneeState?.deskSlotId || this.slotManager.findDeskForAgent(assigneeId)?.id;
    const deskSlot = deskSlotId ? this.gridMap.getSlot(deskSlotId) : undefined;
    if (!deskSlot) return;

    // Cari kandidat tile adjacent yang walkable di sekitar meja assignee
    const offsets: Array<[number, number]> = [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
      [1, 1],
      [-1, -1],
      [1, -1],
      [-1, 1],
    ];

    const candidates = offsets
      .map(([ox, oy]) => ({ gx: deskSlot.gx + ox, gy: deskSlot.gy + oy }))
      .filter((p) => this.gridMap.isWalkable(p.gx, p.gy));

    if (candidates.length === 0) return;

    candidates.sort(
      (a, b) =>
        Math.hypot(a.gx - jarvisChar.gx, a.gy - jarvisChar.gy) -
        Math.hypot(b.gx - jarvisChar.gx, b.gy - jarvisChar.gy),
    );

    const currGx = Math.round(jarvisChar.gx);
    const currGy = Math.round(jarvisChar.gy);
    const isAlreadyAdjacent = candidates.some((c) => c.gx === currGx && c.gy === currGy);

    jarvisState.currentLayer = 'task';
    jarvisState.currentActivityKey = 'jarvis_comment_talk';
    jarvisState.targetSlotId = null;
    this.slotManager.releaseAllForAgent('jarvis');

    const onArriveAtAssignee = () => {
      jarvisChar.setFacing(vectorToFacing(deskSlot.gx - jarvisChar.gx, deskSlot.gy - jarvisChar.gy));
      jarvisChar.playAnimation('stand_talk');
      jarvisChar.isCommenting = true;
      jarvisState.activityRemaining = 8;
      this.emitBubble('jarvis', `Catatan koordinasi untuk @${assigneeId}: Pastikan acceptance criteria terpenuhi.`, 'task');
    };

    if (isAlreadyAdjacent) {
      onArriveAtAssignee();
      return;
    }

    let chosenPath: PathNode[] | null = null;
    for (const cand of candidates) {
      const path = this.pathfinder.findPath(
        { gx: currGx, gy: currGy },
        cand,
        { ignoredTiles: [{ gx: currGx, gy: currGy }] },
      );
      if (path && path.length > 0) {
        if (!chosenPath || path.length < chosenPath.length) {
          chosenPath = path;
        }
      }
    }

    if (chosenPath) {
      jarvisChar.speed = Math.max(3.5, chosenPath.length / 5.0);
      jarvisChar.onArrive = () => {
        jarvisChar.speed = DEFAULT_WALK_SPEED;
        onArriveAtAssignee();
      };
      jarvisChar.walk(chosenPath);
    } else {
      onArriveAtAssignee();
    }
  }

  /**
   * Reaksi 2: task_blocked setelah run Sentinel -> stempel merah FAIL.
   */
  public handleTaskBlockedReaction(event: OfficeEvent): void {
    const eventAny = event as unknown as Record<string, unknown>;
    const taskObj = (event.task || {}) as Record<string, unknown>;
    const isSentinelRun =
      String(event.actor || '').toLowerCase() === 'sentinel' ||
      String(event.agent || '').toLowerCase() === 'sentinel' ||
      String(event.message || '').toLowerCase().includes('sentinel') ||
      String(eventAny.reviewer || '').toLowerCase() === 'sentinel' ||
      String(taskObj.reviewer || '').toLowerCase() === 'sentinel' ||
      String(taskObj.last_run_profile || '').toLowerCase() === 'sentinel';

    if (!isSentinelRun) return;

    const sentinelChar = this.characterManager.getCharacter('sentinel');
    const sentinelState = this.agentStates.get('sentinel');
    if (!sentinelChar || !sentinelState) return;

    sentinelState.currentLayer = 'task';
    sentinelState.currentActivityKey = 'sentinel_fail_stamp';
    sentinelState.activityRemaining = 6;

    sentinelChar.showFailStamp(6.0);
    sentinelChar.playAnimation('stand_talk');
    this.emitBubble('sentinel', 'FAIL. Kembalikan ke pembuatnya.', 'stamp');
  }

  /**
   * Reaksi 3: task_done dengan branch_name -> Relay membawa paket ke konveyor.
   */
  public handleTaskDoneReaction(event: OfficeEvent): void {
    const branchName = event.task?.branch_name || (event as { branch_name?: string }).branch_name;
    if (!branchName) return;

    const relayChar = this.characterManager.getCharacter('relay');
    const relayState = this.agentStates.get('relay');
    if (!relayChar || !relayState) return;

    relayChar.setCarryingParcel(true);
    relayState.currentLayer = 'task';
    relayState.currentActivityKey = 'relay_delivery';
    relayState.targetSlotId = null;
    this.slotManager.releaseAllForAgent('relay');

    // Tile persis di depan konveyor Release Dock Z11 (gx: 33, gy: 15)
    const conveyorGx = 33;
    const conveyorGy = 15;

    const onArriveAtConveyor = () => {
      relayChar.setFacing('SE'); // Menghadap ke arah konveyor di gx: 34
      relayChar.playAnimation('stand_talk');
      relayState.activityRemaining = 5;
      this.emitBubble('relay', 'Siap kirim. Paket berangkat.', 'task');
    };

    if (Math.round(relayChar.gx) === conveyorGx && Math.round(relayChar.gy) === conveyorGy) {
      onArriveAtConveyor();
      return;
    }

    const path = this.pathfinder.findPath(
      { gx: Math.round(relayChar.gx), gy: Math.round(relayChar.gy) },
      { gx: conveyorGx, gy: conveyorGy },
    );

    if (path) {
      relayChar.speed = DEFAULT_WALK_SPEED;
      relayChar.onArrive = onArriveAtConveyor;
      relayChar.walk(path);
    } else {
      relayChar.setGridPosition(conveyorGx, conveyorGy);
      onArriveAtConveyor();
    }
  }

  /**
   * Reaksi 4: task_failed -> Bastion mengecek.
   */
  public handleTaskFailedReaction(event: OfficeEvent): void {
    const failedAgentId = event.agent || (event.task as { assignee?: string } | undefined)?.assignee;
    if (!failedAgentId || failedAgentId.toLowerCase() === 'bastion') return;

    const bastionChar = this.characterManager.getCharacter('bastion');
    const bastionState = this.agentStates.get('bastion');
    if (!bastionChar || !bastionState) return;

    const failedState = this.agentStates.get(failedAgentId);
    const deskSlotId = failedState?.deskSlotId || this.slotManager.findDeskForAgent(failedAgentId)?.id;
    const deskSlot = deskSlotId ? this.gridMap.getSlot(deskSlotId) : undefined;
    if (!deskSlot) return;

    const offsets: Array<[number, number]> = [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
      [1, 1],
      [-1, -1],
      [1, -1],
      [-1, 1],
    ];

    const candidates = offsets
      .map(([ox, oy]) => ({ gx: deskSlot.gx + ox, gy: deskSlot.gy + oy }))
      .filter((p) => this.gridMap.isWalkable(p.gx, p.gy));

    if (candidates.length === 0) return;

    candidates.sort(
      (a, b) =>
        Math.hypot(a.gx - bastionChar.gx, a.gy - bastionChar.gy) -
        Math.hypot(b.gx - bastionChar.gx, b.gy - bastionChar.gy),
    );

    const currGx = Math.round(bastionChar.gx);
    const currGy = Math.round(bastionChar.gy);
    const isAlreadyAdjacent = candidates.some((c) => c.gx === currGx && c.gy === currGy);

    bastionState.currentLayer = 'task';
    bastionState.currentActivityKey = 'bastion_inspect_failed';
    bastionState.targetSlotId = null;
    this.slotManager.releaseAllForAgent('bastion');
    bastionChar.isInspecting = true;
    this.emitBubble('bastion', 'Ada yang jatuh. Saya ke sana.', 'task');

    const onArriveAtFailed = () => {
      bastionChar.setFacing(vectorToFacing(deskSlot.gx - bastionChar.gx, deskSlot.gy - bastionChar.gy));
      bastionChar.playAnimation('stand_talk');
      bastionState.activityRemaining = 6;
    };

    if (isAlreadyAdjacent) {
      onArriveAtFailed();
      return;
    }

    let chosenPath: PathNode[] | null = null;
    for (const cand of candidates) {
      const path = this.pathfinder.findPath(
        { gx: currGx, gy: currGy },
        cand,
        { ignoredTiles: [{ gx: currGx, gy: currGy }] },
      );
      if (path && path.length > 0) {
        if (!chosenPath || path.length < chosenPath.length) {
          chosenPath = path;
        }
      }
    }

    if (chosenPath) {
      bastionChar.speed = DEFAULT_WALK_SPEED;
      bastionChar.onArrive = onArriveAtFailed;
      bastionChar.walk(chosenPath);
    } else {
      onArriveAtFailed();
    }
  }

  public getAgentState(agentId: string): AgentChoreographyState | undefined {
    return this.agentStates.get(agentId);
  }

  public getAllAgentStates(): Map<string, AgentChoreographyState> {
    return new Map(this.agentStates);
  }

  public getCollectiveManager(): CollectiveManager {
    return this.collectiveManager;
  }

  public getAmbientScheduler(): AmbientScheduler {
    return this.ambientScheduler;
  }

  public getSlotManager(): SlotReservationManager {
    return this.slotManager;
  }

  public getGridMap(): GridMap {
    return this.gridMap;
  }

  public isVectorRamPacingActive = false;

  /**
   * Mengaktifkan/menonaktifkan mondar-mandir Vector di Data Center Z12 saat RAM > 85% (T2.4 / F23).
   */
  public setVectorRamPacing(active: boolean): void {
    if (this.isVectorRamPacingActive === active) return;
    this.isVectorRamPacingActive = active;

    const vectorChar = this.characterManager.getCharacter('vector');
    const vectorState = this.agentStates.get('vector');
    if (!vectorChar || !vectorState) return;

    if (active) {
      vectorState.currentLayer = 'task';
      vectorState.currentActivityKey = 'vector_ram_pacing';
      vectorState.targetSlotId = null;
      this.slotManager.releaseAllForAgent('vector');
      this.emitBubble('vector', 'RAM di atas 85%! Server butuh optimasi...', 'task');
      this.stepVectorPacing(vectorChar);
    } else {
      if (vectorState.currentActivityKey === 'vector_ram_pacing') {
        vectorState.currentLayer = 'ambient';
        vectorState.currentActivityKey = 'ambient_idle';
        this.sendAgentToDesk('vector', vectorState, vectorChar, false);
      }
    }
  }

  /**
   * Mengarahkan Vector mondar-mandir di antara lorong rak server Data Center Z12.
   */
  private stepVectorPacing(char: Character): void {
    if (!this.isVectorRamPacingActive) return;

    // Titik mondar-mandir di lorong Data Center Z12
    const waypointA = { gx: 38, gy: 14 };
    const waypointB = { gx: 38, gy: 18 };

    const distA = Math.hypot(char.gx - waypointA.gx, char.gy - waypointA.gy);
    const distB = Math.hypot(char.gx - waypointB.gx, char.gy - waypointB.gy);

    const target = distA < distB ? waypointB : waypointA;

    const path = this.pathfinder.findPath(
      { gx: char.gx, gy: char.gy },
      { gx: target.gx, gy: target.gy },
    );
    if (path && path.length > 0) {
      char.speed = DEFAULT_WALK_SPEED;
      char.walk(path);
    } else {
      const altTarget = target === waypointB ? waypointA : waypointB;
      const altPath = this.pathfinder.findPath(
        { gx: char.gx, gy: char.gy },
        { gx: altTarget.gx, gy: altTarget.gy },
      );
      if (altPath && altPath.length > 0) {
        char.speed = DEFAULT_WALK_SPEED;
        char.walk(altPath);
      }
    }
  }

  public destroy(): void {
    if (this.storeUnsubscribe) {
      this.storeUnsubscribe();
      this.storeUnsubscribe = null;
    }
    this.processedEventSeqs.clear();
    this.bubbleListeners.clear();
    this.agentStates.clear();
    this.isInitialized = false;
  }
}
