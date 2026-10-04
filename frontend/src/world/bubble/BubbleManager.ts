import type { BubbleCamera as CameraManager, BubbleScreen as Application } from '../simulation/BubblePorts';
import type { CharacterRegistry as CharacterManager } from '../simulation/CharacterRegistry';
import type { CharacterController as Character } from '../simulation/CharacterModel';
import { AGENT_SPAWN_DEFS } from '../simulation/roster';
import { officeStore } from '../../store/officeStore';
import type { AgentState } from '../../types/office';
import {
  BUBBLE_PRIORITY_MAP,
  BubbleItem,
  BubbleKind,
  BubbleManagerConfig,
  BubblePriority,
  BubbleRequest,
  DEFAULT_BUBBLE_DURATION_SEC,
  DEFAULT_COOLDOWN_SEC,
  MAX_ACTIVE_BUBBLES,
  PlaceholderContext,
} from './types';
import { BubblePool } from './BubblePool';
import { getRandomDialogLine } from './dialogBank';
import { ConversationPair, getConversationById } from './conversationBank';
import { resolvePlaceholders } from './placeholder';

let nextBubbleId = 1;

export class BubbleManager {
  private container: HTMLElement;
  private pool: BubblePool;
  private characterManager: CharacterManager | null = null;
  private camera: CameraManager | null = null;
  private app: Application | null = null;

  private readonly maxBubbles: number;
  private readonly defaultDuration: number;
  private readonly cooldownSec: number;
  private readonly randomFn: () => number;

  private activeBubbles: BubbleItem[] = [];
  private lastEmittedAt = new Map<string, number>();
  private currentTime = 0; // Virtual/cumulative time dalam detik
  private createdOwnContainer = false;

  private storeUnsubscribe: (() => void) | null = null;
  private prevAgentWorkStates = new Map<string, string>();
  private activeConversation: {
    conversation: ConversationPair;
    currentTurnIndex: number;
    turnDuration: number;
    delayRemaining: number;
    context?: PlaceholderContext;
    onComplete?: () => void;
  } | null = null;

  constructor(config: BubbleManagerConfig = {}) {
    this.maxBubbles = config.maxBubbles ?? MAX_ACTIVE_BUBBLES;
    this.defaultDuration = config.bubbleDurationSec ?? DEFAULT_BUBBLE_DURATION_SEC;
    this.cooldownSec = config.cooldownSec ?? DEFAULT_COOLDOWN_SEC;
    this.randomFn = config.randomFn ?? Math.random;
    this.characterManager = config.characterManager ?? null;
    this.camera = config.camera ?? null;
    this.app = config.app ?? null;

    // Resolusi kontainer DOM untuk pool bubble overlay
    if (config.container) {
      this.container = config.container;
    } else if (typeof document !== 'undefined') {
      const existing = document.getElementById('bubble-layer');
      if (existing) {
        this.container = existing;
      } else {
        const created = document.createElement('div');
        created.id = 'bubble-layer';
        created.className = 'fixed inset-0 z-10 pointer-events-none overflow-hidden';
        document.body.appendChild(created);
        this.container = created;
        this.createdOwnContainer = true;
      }
    } else {
      // Fallback untuk unit test headless tanpa document
      this.container = {
        appendChild: () => {},
        removeChild: () => {},
      } as unknown as HTMLElement;
    }

    this.pool = new BubblePool(this.container, this.maxBubbles);
    this.initStoreListener();
  }

  /**
   * Menghubungkan listener ke vanilla Zustand store untuk mendeteksi transisi
   * status agen (working, done_recent, blocked, failed) secara otomatis.
   */
  private initStoreListener(): void {
    if (typeof officeStore === 'undefined' || !officeStore.subscribe) return;

    this.storeUnsubscribe = officeStore.subscribe((state) => {
      const agents = state.agents;
      if (!agents) return;

      for (const [agentId, agent] of Object.entries(agents)) {
        const prevWork = this.prevAgentWorkStates.get(agentId);
        const currentWork = agent.work;

        if (prevWork !== currentWork) {
          this.prevAgentWorkStates.set(agentId, currentWork);

          // Pemicuan dialog berdasarkan transisi status
          if (prevWork && currentWork !== 'idle' && currentWork !== 'off_duty') {
            this.handleAgentStateTransition(agent, currentWork, state.projection);
          }
        }
      }
    });
  }

  private handleAgentStateTransition(
    agent: AgentState,
    newWork: string,
    projection: 'public' | 'founder',
  ): void {
    let dialogState: 'working' | 'done' | 'blocked' | 'failed' | null = null;
    let priority: BubblePriority = BubblePriority.WORKING;
    let kind: BubbleKind = 'working';

    switch (newWork) {
      case 'working':
        dialogState = 'working';
        priority = BubblePriority.WORKING;
        kind = 'working';
        break;
      case 'done_recent':
        dialogState = 'done';
        priority = BubblePriority.DONE;
        kind = 'done';
        break;
      case 'blocked':
        dialogState = 'blocked';
        priority = BubblePriority.BLOCKED;
        kind = 'blocked';
        break;
      case 'failed':
        dialogState = 'failed';
        priority = BubblePriority.FAILED;
        kind = 'failed';
        break;
    }

    if (dialogState) {
      this.triggerDialog(agent.id, dialogState, {
        mode: projection,
        agentId: agent.id,
        agentName: agent.name,
        doneToday: agent.done_today,
        task: agent.task,
        projectName: agent.task?.board,
      }, priority, kind);
    }
  }

  /**
   * Memeriksa apakah agen tertentu sedang dalam masa cooldown 20 detik.
   */
  public isAgentOnCooldown(agentId: string): boolean {
    const last = this.lastEmittedAt.get(agentId);
    if (last === undefined) return false;
    return this.currentTime - last < this.cooldownSec;
  }

  /**
   * Mengembalikan sisa waktu cooldown dalam detik.
   */
  public getRemainingCooldown(agentId: string): number {
    const last = this.lastEmittedAt.get(agentId);
    if (last === undefined) return 0;
    const elapsed = this.currentTime - last;
    return Math.max(0, this.cooldownSec - elapsed);
  }

  /**
   * Memeriksa apakah karakter berada di dalam batas pandang kamera (viewport).
   * Sesuai spec 03: Bubble ambient hanya muncul untuk agent yang sedang berada di area pandang kamera.
   */
  public isAgentInCameraView(agentId: string): boolean {
    if (!this.characterManager) return true;
    const char = this.characterManager.getCharacter(agentId);
    if (!char) return false;

    if (this.camera) {
      const viewport = this.camera.getViewport();
      if (viewport && typeof viewport.getVisibleBounds === 'function') {
        const bounds = viewport.getVisibleBounds();
        return (
          char.x >= bounds.x - 32 &&
          char.x <= bounds.x + bounds.width + 32 &&
          char.y >= bounds.y - 32 &&
          char.y <= bounds.y + bounds.height + 32
        );
      }
    }

    return true;
  }

  /**
   * Meminta penayangan bubble baru dengan validasi cooldown, kapasitas pool,
   * batasan kamera viewport, serta hierarki prioritas.
   */
  public requestBubble(request: BubbleRequest): boolean {
    const { agentId, force = false } = request;

    // 1. Cek Cooldown (20 dtk per agent)
    if (!force && this.isAgentOnCooldown(agentId)) {
      return false;
    }

    // 2. Tentukan Prioritas dan Kind
    const kind: BubbleKind = request.kind ?? (
      request.state === 'failed' ? 'failed' :
      request.state === 'blocked' ? 'blocked' :
      request.state === 'done' ? 'done' :
      request.state === 'collective' ? 'collective' :
      request.state === 'ambient' ? 'ambient' :
      request.state === 'working' ? 'working' :
      'working'
    );

    const priority: BubblePriority = request.priority ?? BUBBLE_PRIORITY_MAP[kind];

    // 3. Cek Kamera Viewport untuk Bubble Ambient (Spec 03 aturan bubble)
    if (kind === 'ambient' && !force && !this.isAgentInCameraView(agentId)) {
      return false;
    }

    // 4. Resolusi Teks Dialog dan Placeholder
    let rawText = request.text;
    if (!rawText && request.state) {
      rawText = getRandomDialogLine(agentId, request.state, this.randomFn);
    }
    if (!rawText) {
      rawText = '...';
    }

    const context: PlaceholderContext = {
      ...request.context,
      agentId,
      mode: request.context?.mode ?? (typeof officeStore !== 'undefined' ? officeStore.getState().projection : 'public'),
    };

    const finalText = resolvePlaceholders(rawText, context);

    // 5. Cek Kapasitas Pool (Maksimal 3 bubble tampil bersamaan)
    if (this.activeBubbles.length >= this.maxBubbles) {
      // Cari bubble aktif dengan prioritas terendah
      let lowestIndex = -1;
      let lowestPriority = Infinity;

      for (let i = 0; i < this.activeBubbles.length; i++) {
        if (this.activeBubbles[i].priority < lowestPriority) {
          lowestPriority = this.activeBubbles[i].priority;
          lowestIndex = i;
        }
      }

      // Jika permintaan baru memiliki prioritas lebih tinggi dari yang terendah, lakukan eviksi!
      if (priority > lowestPriority && lowestIndex !== -1) {
        const evicted = this.activeBubbles.splice(lowestIndex, 1)[0];
        this.pool.release(evicted.element);
      } else {
        // Kapasitas penuh dan prioritas baru tidak mencukupi untuk eviksi
        return false;
      }
    }

    // 6. Ambil elemen DOM dari pool
    const element = this.pool.acquire();
    if (!element) {
      return false;
    }

    // 7. Ambil Metadata Agen
    const agentDef = AGENT_SPAWN_DEFS.find((d) => d.id === agentId);
    const agentName = request.context?.agentName || agentDef?.name || agentId.toUpperCase();
    const signatureColor = agentDef?.signatureColor || '#2bb3c0';

    // 8. Terapkan Konten Visual ke DOM
    this.pool.setContent(element, {
      agentName,
      text: finalText,
      signatureColor,
      isStamp: request.isStamp,
    });

    const duration = request.duration ?? this.defaultDuration;
    const bubbleItem: BubbleItem = {
      id: `bubble_${nextBubbleId++}`,
      agentId,
      agentName,
      signatureColor,
      text: finalText,
      priority,
      kind,
      duration,
      remaining: duration,
      element,
      isStamp: request.isStamp,
    };

    // 9. Posisikan Segera di Layar
    this.positionBubbleElement(bubbleItem);
    this.pool.show(element);

    // 10. Catat Cooldown dan Masukkan ke Daftar Aktif
    this.lastEmittedAt.set(agentId, this.currentTime);
    this.activeBubbles.push(bubbleItem);

    return true;
  }

  /**
   * Alias untuk requestBubble.
   */
  public showBubble(request: BubbleRequest): boolean {
    return this.requestBubble(request);
  }

  /**
   * Memicu dialog spesifik berdasarkan state (working, done, blocked, failed, ambient, collective).
   */
  public triggerDialog(
    agentId: string,
    state: 'working' | 'done' | 'blocked' | 'failed' | 'ambient' | 'collective',
    context?: PlaceholderContext,
    priority?: BubblePriority,
    kind?: BubbleKind,
  ): boolean {
    return this.requestBubble({
      agentId,
      state,
      context,
      priority,
      kind,
    });
  }

  /**
   * Menangani event bubble dari Choreographer.
   */
  public handleChoreographerBubble(event: {
    agentId: string;
    text: string;
    kind?: 'task' | 'collective' | 'ambient' | 'stamp';
    isStamp?: boolean;
  }): boolean {
    const kindMap: Record<string, BubbleKind> = {
      task: 'working',
      collective: 'collective',
      ambient: 'ambient',
      stamp: 'failed',
    };
    const kind = kindMap[event.kind || 'task'] || 'working';
    const isStamp = Boolean(event.isStamp || event.kind === 'stamp' || event.text.startsWith('FAIL'));

    return this.requestBubble({
      agentId: event.agentId,
      text: event.text,
      kind,
      priority: isStamp ? BubblePriority.FAILED : BUBBLE_PRIORITY_MAP[kind],
      isStamp,
      force: isStamp || event.kind === 'task' || event.kind === 'stamp',
    });
  }

  /**
   * Pembaruan per frame (dipanggil langsung oleh ticker render loop tanpa React).
   */
  public update(dtSec: number): void {
    this.currentTime += dtSec;

    // 1. Perbarui durasi dan rilis bubble yang sudah habis waktu
    for (let i = this.activeBubbles.length - 1; i >= 0; i--) {
      const bubble = this.activeBubbles[i];
      bubble.remaining -= dtSec;

      if (bubble.remaining <= 0) {
        this.pool.release(bubble.element);
        this.activeBubbles.splice(i, 1);
      }
    }

    // 2. Progresi percakapan dua arah (F27) jika sedang aktif
    if (this.activeConversation) {
      this.activeConversation.delayRemaining -= dtSec;
      if (this.activeConversation.delayRemaining <= 0) {
        const nextTurnIndex = this.activeConversation.currentTurnIndex + 1;
        const conv = this.activeConversation.conversation;
        if (nextTurnIndex < conv.turns.length) {
          this.activeConversation.currentTurnIndex = nextTurnIndex;
          this.activeConversation.delayRemaining = this.activeConversation.turnDuration;
          const turn = conv.turns[nextTurnIndex];
          this.requestBubble({
            agentId: turn.agent,
            text: turn.text,
            kind: 'ambient',
            duration: this.activeConversation.turnDuration,
            force: true,
            context: this.activeConversation.context,
          });
        } else {
          const onComplete = this.activeConversation.onComplete;
          this.activeConversation = null;
          onComplete?.();
        }
      }
    }

    // 3. Perbarui posisi DOM seluruh bubble yang aktif
    for (const bubble of this.activeBubbles) {
      this.positionBubbleElement(bubble);
    }
  }

  /**
   * Menghitung posisi koordinat layar dan menerapkan transform DOM pada elemen.
   */
  private positionBubbleElement(bubble: BubbleItem): void {
    if (!this.characterManager) return;
    const char = this.characterManager.getCharacter(bubble.agentId);
    if (!char) {
      this.pool.hide(bubble.element);
      return;
    }

    const screenPos = this.getCharacterScreenPosition(char);
    if (!screenPos) {
      this.pool.hide(bubble.element);
      return;
    }

    const screenWidth = this.app?.screen?.width ?? (typeof window !== 'undefined' ? window.innerWidth : 1280);
    const screenHeight = this.app?.screen?.height ?? (typeof window !== 'undefined' ? window.innerHeight : 720);

    this.pool.setPosition(bubble.element, screenPos.x, screenPos.y, screenWidth, screenHeight);
  }

  /**
   * Mengonversi koordinat dunia karakter ke koordinat layar (screenX, screenY).
   */
  public getCharacterScreenPosition(char: Character): { x: number; y: number } | null {
    // Offset tinggi kepala karakter (~56px di atas titik kaki)
    const headOffset = 56;
    const worldX = char.x;
    const worldY = char.y - headOffset;

    if (this.camera) {
      const viewport = this.camera.getViewport();
      if (viewport && typeof viewport.toScreen === 'function') {
        const pt = viewport.toScreen(worldX, worldY);
        return { x: pt.x, y: pt.y };
      }
    }

    return { x: worldX, y: worldY };
  }

  /**
   * Menjalankan urutan percakapan dua arah (F27) antar agen.
   */
  public playConversation(
    conversationOrId: ConversationPair | string,
    options: {
      turnDurationSec?: number;
      context?: PlaceholderContext;
      onComplete?: () => void;
    } = {},
  ): boolean {
    const conversation =
      typeof conversationOrId === 'string'
        ? getConversationById(conversationOrId)
        : conversationOrId;

    if (!conversation || conversation.turns.length === 0) {
      return false;
    }

    const turnDuration = options.turnDurationSec ?? 3.5;
    const firstTurn = conversation.turns[0];

    const started = this.requestBubble({
      agentId: firstTurn.agent,
      text: firstTurn.text,
      kind: 'ambient',
      duration: turnDuration,
      force: true,
      context: options.context,
    });

    if (!started) return false;

    if (conversation.turns.length > 1) {
      this.activeConversation = {
        conversation,
        currentTurnIndex: 0,
        turnDuration,
        delayRemaining: turnDuration,
        context: options.context,
        onComplete: options.onComplete,
      };
    } else {
      options.onComplete?.();
    }

    return true;
  }

  /**
   * Alias untuk playConversation.
   */
  public triggerConversation(
    conversationOrId: ConversationPair | string,
    options: {
      turnDurationSec?: number;
      context?: PlaceholderContext;
      onComplete?: () => void;
    } = {},
  ): boolean {
    return this.playConversation(conversationOrId, options);
  }

  /**
   * Mengembalikan status percakapan dua arah yang sedang aktif.
   */
  public getActiveConversation(): { id: string; currentTurnIndex: number } | null {
    if (!this.activeConversation) return null;
    return {
      id: this.activeConversation.conversation.id,
      currentTurnIndex: this.activeConversation.currentTurnIndex,
    };
  }

  /**
   * Menghentikan percakapan dua arah yang sedang berjalan.
   */
  public cancelConversation(): void {
    this.activeConversation = null;
  }

  public getActiveBubbles(): readonly BubbleItem[] {
    return [...this.activeBubbles];
  }

  public getActiveCount(): number {
    return this.activeBubbles.length;
  }

  public getCurrentTime(): number {
    return this.currentTime;
  }

  public clearAllBubbles(): void {
    this.cancelConversation();
    for (const bubble of this.activeBubbles) {
      this.pool.release(bubble.element);
    }
    this.activeBubbles = [];
  }

  public resetCooldowns(): void {
    this.lastEmittedAt.clear();
  }

  public setCharacterManager(cm: CharacterManager): void {
    this.characterManager = cm;
  }

  public setCamera(camera: CameraManager): void {
    this.camera = camera;
  }

  public setApp(app: Application): void {
    this.app = app;
  }

  public destroy(): void {
    this.cancelConversation();
    if (this.storeUnsubscribe) {
      this.storeUnsubscribe();
      this.storeUnsubscribe = null;
    }
    this.clearAllBubbles();
    this.pool.destroy();
    if (this.createdOwnContainer && this.container.parentNode) {
      this.container.parentNode.removeChild(this.container);
    }
  }
}
