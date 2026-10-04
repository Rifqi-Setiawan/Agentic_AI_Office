import type { GridMap } from '../../navigation/GridMap';
import { type AStarPathfinder, vectorToFacing } from '../../navigation/AStarPathfinder';
import type { SlotReservationManager } from '../../navigation/SlotReservationManager';
import type { InteractionSlot, PathNode } from '../../navigation/types';
import type { InteractionSlot as WorldInteractionSlot } from '../types';
import { Character, DEFAULT_WALK_SPEED } from '../Character';
import { CharacterManager, AGENT_SPAWN_DEFS } from '../CharacterManager';
import { officeStore, type OfficeState } from '../../store/officeStore';
import type { AgentState, CollectiveEventState } from '../../types/office';
import type {
  AgentChoreographyState,
  ChoreographerBubbleEvent,
  ChoreographerConfig,
} from './types';
import { CollectiveManager } from './CollectiveManager';
import { AmbientScheduler } from './AmbientScheduler';

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
   * 1. Inisialisasi state seluruh 17 agen.
   * 2. Cadangkan slot meja masing-masing di SlotReservationManager.
   * 3. Pasang subscription ke vanilla Zustand officeStore.
   */
  public init(): void {
    if (this.isInitialized) return;

    for (const def of AGENT_SPAWN_DEFS) {
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
   * Mengirim agen kembali ke mejanya untuk mengerjakan task.
   * Untuk kriteria penerimaan: Forge harus tiba di mejanya dalam <= 10 dtk.
   */
  private sendAgentToDesk(
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
    if (failedAgentId === 'bastion') return;
    const bastionState = this.agentStates.get('bastion');
    const bastionChar = this.characterManager.getCharacter('bastion');
    if (!bastionState || !bastionChar) return;

    if (bastionState.workStatus === 'idle' && bastionState.currentLayer === 'ambient') {
      const failedState = this.agentStates.get(failedAgentId);
      if (!failedState) return;

      const failedSlot = this.gridMap.getSlot(failedState.deskSlotId);
      if (!failedSlot) return;

      // Bastion jalan ke dekat meja agen yang gagal
      const path = this.pathfinder.findPath(
        { gx: bastionChar.gx, gy: bastionChar.gy },
        { gx: failedSlot.gx, gy: failedSlot.gy },
      );

      if (path && path.length > 1) {
        // Berhenti 1 langkah sebelum meja agar tidak menimpa slot
        const approachPath = path.slice(0, Math.max(1, path.length - 1));
        bastionChar.walk(approachPath);
      }
    }
  }

  /**
   * Pembaruan per frame (dipanggil dari WorldApp ticker).
   * @param dt Delta waktu dalam detik.
   */
  public update(dt: number): void {
    if (!this.isInitialized) return;

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
    kind: 'collective' | 'task' | 'ambient' = 'task',
  ): void {
    const event: ChoreographerBubbleEvent = {
      agentId,
      text,
      timestamp: Date.now(),
      kind,
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

  public destroy(): void {
    if (this.storeUnsubscribe) {
      this.storeUnsubscribe();
      this.storeUnsubscribe = null;
    }
    this.bubbleListeners.clear();
    this.agentStates.clear();
    this.isInitialized = false;
  }
}
