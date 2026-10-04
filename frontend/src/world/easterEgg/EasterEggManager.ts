import { Container, Graphics } from 'pixi.js';
import type { CharacterManager } from '../CharacterManager';
import type { Choreographer } from '../choreographer/Choreographer';
import type { BubbleManager } from '../bubble';
import type { LoadedOfficeMap } from '../mapLoader';
import { officeStore } from '../../store/officeStore';
import { gridToScreen, WORLD_ORIGIN_X, WORLD_ORIGIN_Y } from '../projection';
import type { EasterEggConfig, EasterEggState } from './types';
import type { InteractionSlot } from '../types';

export const KONAMI_SEQUENCE = [
  'arrowup',
  'arrowup',
  'arrowdown',
  'arrowdown',
  'arrowleft',
  'arrowright',
  'arrowleft',
  'arrowright',
  'b',
  'a',
];

interface ConfettiParticle {
  gfx: Graphics;
  x: number;
  y: number;
  vx: number;
  vy: number;
  rotation: number;
  vRot: number;
  alpha: number;
  color: number;
  size: number;
}

/**
 * EasterEggManager (F26 / T2.7):
 * Mengelola 6 fitur Easter Egg pada Office v2:
 * 1. Kode Konami → semua agent menari 5 dtk.
 * 2. Klik Oracle 10× → ledakan kecil konfeti kimia dan rambutnya berdiri sebentar.
 * 3. Steward sesekali memperbaiki tile yang "glitch" (lelucon meta: dia yang membangun kantor ini).
 * 4. Jumat setelah pukul 16.00 WIB, Relay menempel stiker "No Deploy Friday" di Release Dock.
 * 5. Pukul 03.00 WIB, kalau tidak ada task berjalan, satu agent acak tertidur di sofa lounge dengan "Zzz".
 * 6. Klik mesin espresso → Jarvis mengucapkan jumlah kopi yang "diminum" kantor hari ini.
 *
 * INVARIANT MUTLAK:
 * "Tidak ada easter egg yang menutupi status task nyata".
 */
export class EasterEggManager {
  private characterManager: CharacterManager;
  private choreographer: Choreographer | null;
  private bubbleManager: BubbleManager | null;
  public readonly loadedMap: LoadedOfficeMap | null;
  private worldContainer: Container | null;
  private getNow: () => Date;
  private onConfettiBurst?: (x: number, y: number) => void;
  private randomFn: () => number;

  // State Easter Egg
  private konamiIndex = 0;
  private isKonamiActive = false;
  private konamiRemaining = 0;
  private preKonamiStates = new Map<string, { anim: string; wasWorking: boolean }>();

  private oracleClicks = 0;
  private lastOracleClickTs = 0;
  private oracleShockRemaining = 0;

  private isGlitchTileActive = false;
  private glitchTileRemaining = 0;
  private glitchGraphics: Graphics | null = null;

  private isNoDeployFridayActive = false;
  private noDeployFridayContainer: Container | null = null;

  private sleepingAgentId: string | null = null;

  private espressoClicks = 0;

  // Partikel konfeti kimia Pixi
  private confettiParticles: ConfettiParticle[] = [];
  private effectsContainer: Container | null = null;

  // Window event listeners
  private keydownListener: ((e: KeyboardEvent) => void) | null = null;

  constructor(config: EasterEggConfig) {
    this.characterManager = config.characterManager;
    this.choreographer = config.choreographer ?? null;
    this.bubbleManager = config.bubbleManager ?? null;
    this.loadedMap = config.loadedMap ?? null;
    this.worldContainer = config.worldContainer ?? null;
    this.getNow = config.getNow ?? (() => new Date());
    this.onConfettiBurst = config.onConfettiBurst;
    this.randomFn = config.randomFn ?? Math.random;

    this.initVisualContainers();
    this.setupKeyboardListener();
  }

  private initVisualContainers(): void {
    if (!this.worldContainer) return;

    this.effectsContainer = new Container();
    this.effectsContainer.label = 'EasterEgg_EffectsContainer';
    this.effectsContainer.zIndex = 400; // Di atas lantai dan entitas
    this.worldContainer.addChild(this.effectsContainer);
  }

  private setupKeyboardListener(): void {
    if (typeof window === 'undefined') return;

    this.keydownListener = (e: KeyboardEvent) => {
      this.handleKeyDown(e);
    };
    window.addEventListener('keydown', this.keydownListener);
  }

  /**
   * Mengembalikan snapshot status easter egg saat ini.
   */
  public getState(): EasterEggState {
    return {
      isKonamiActive: this.isKonamiActive,
      konamiRemaining: this.konamiRemaining,
      oracleClicks: this.oracleClicks,
      oracleShockRemaining: this.oracleShockRemaining,
      isGlitchTileActive: this.isGlitchTileActive,
      glitchTileRemaining: this.glitchTileRemaining,
      isNoDeployFridayActive: this.isNoDeployFridayActive,
      sleepingAgentId: this.sleepingAgentId,
      espressoClicks: this.espressoClicks,
    };
  }

  // =========================================================================
  // 1. KODE KONAMI: Semua agent menari 5 dtk tanpa menutupi status task nyata
  // =========================================================================

  public handleKeyDown(e: KeyboardEvent | { key: string }): boolean {
    const rawKey = e.key.toLowerCase();
    const expected = KONAMI_SEQUENCE[this.konamiIndex];

    if (rawKey === expected) {
      this.konamiIndex++;
      if (this.konamiIndex === KONAMI_SEQUENCE.length) {
        this.konamiIndex = 0;
        this.triggerKonamiCode();
        return true;
      }
    } else {
      // Jika salah, cek apakah tombol yang ditekan adalah tombol awal sequence
      this.konamiIndex = rawKey === KONAMI_SEQUENCE[0] ? 1 : 0;
    }

    return false;
  }

  /**
   * Memicu kode Konami secara terprogram atau via keyboard.
   * Semua agent menari selama 5 detik.
   * INVARIANT: Task badge tetap menyala untuk agent yang sedang mengerjakan task nyata.
   */
  public triggerKonamiCode(): boolean {
    this.isKonamiActive = true;
    this.konamiRemaining = 5.0;
    this.preKonamiStates.clear();

    const characters = this.characterManager.getAllCharacters();
    for (const char of characters) {
      this.preKonamiStates.set(char.id, {
        anim: char.animatedSprite?.playing ? 'act' : 'idle',
        wasWorking: char.workStatus === 'working',
      });

      // Mainkan animasi selebrasi/tari
      char.playAnimation('celebrate', true);

      // INVARIANT: Jangan sembunyikan atau manipulasi task nyata
      if (char.workStatus === 'working') {
        char.badgeContainer.visible = true;
      }
    }

    // Tampilkan notifikasi toast di HUD dan bubble ucapan
    try {
      officeStore.getState().addToast({
        title: '🎉 Easter Egg: Kode Konami!',
        message: 'Kode Konami aktif! Semua agent merayakan dengan menari selama 5 detik!',
        kind: 'info',
        durationMs: 5000,
      });
    } catch {
      // Abaikan jika store mock
    }

    this.emitEasterEggBubble('jarvis', '🎉 Kode Konami diaktifkan! Semua agent menari bersama!');
    return true;
  }

  // =========================================================================
  // 2. KLIK ORACLE 10X: Ledakan kecil konfeti kimia & rambut berdiri
  // =========================================================================

  public handleAgentClick(agentId: string): { count: number; triggered: boolean } {
    if (agentId !== 'oracle') {
      return { count: 0, triggered: false };
    }

    const now = Date.now();
    // Reset counter jika jeda antar klik > 10 detik
    if (this.lastOracleClickTs > 0 && now - this.lastOracleClickTs > 10000) {
      this.oracleClicks = 0;
    }
    this.lastOracleClickTs = now;
    this.oracleClicks++;

    if (this.oracleClicks >= 10) {
      this.oracleClicks = 0;
      this.triggerOracleConfettiReaction();
      return { count: 10, triggered: true };
    }

    return { count: this.oracleClicks, triggered: false };
  }

  public handleOracleClick(): { count: number; triggered: boolean } {
    return this.handleAgentClick('oracle');
  }

  public triggerOracleConfettiReaction(): boolean {
    const oracle = this.characterManager.getCharacter('oracle');
    if (!oracle) return false;

    // 1. Ledakan konfeti kimia (warna kimia: neon cyan, purple, lime, gold, orange)
    const burstX = oracle.x;
    const burstY = oracle.y - 35;
    this.spawnConfettiParticles(burstX, burstY);
    this.onConfettiBurst?.(burstX, burstY);

    // 2. Rambutnya berdiri sebentar (animasi eureka / special)
    this.oracleShockRemaining = 4.0;
    oracle.playAnimation('eureka', true);

    // INVARIANT: Pertahankan status task nyata jika sedang bekerja
    if (oracle.workStatus === 'working') {
      oracle.badgeContainer.visible = true;
    }

    // 3. Dialog khas Oracle
    this.emitEasterEggBubble(
      'oracle',
      '💥 Rambutku berdiri! Eksperimen kimia probabilitas 10 miliar persen!',
    );

    try {
      officeStore.getState().addToast({
        title: '💥 Easter Egg: Percobaan Kimia Oracle!',
        message: 'Oracle diklik 10 kali! Reaksi kimia menghasilkan konfeti dan rambut berdiri.',
        kind: 'info',
        durationMs: 4000,
      });
    } catch {
      // Store mock aman
    }

    return true;
  }

  private spawnConfettiParticles(centerX: number, centerY: number): void {
    if (!this.effectsContainer) return;

    const colors = [0x2bb3c0, 0x8a4fbf, 0x9cc23a, 0xfbbf24, 0xf97316, 0xe0567a];
    const particleCount = 28;

    for (let i = 0; i < particleCount; i++) {
      const angle = (Math.PI * 2 * i) / particleCount + (this.randomFn() - 0.5) * 0.5;
      const speed = 60 + this.randomFn() * 120;
      const color = colors[Math.floor(this.randomFn() * colors.length)];
      const size = 3 + this.randomFn() * 3;

      const gfx = new Graphics();
      gfx.rect(-size / 2, -size / 2, size, size);
      gfx.fill({ color, alpha: 1 });
      gfx.x = centerX;
      gfx.y = centerY;

      this.effectsContainer.addChild(gfx);

      this.confettiParticles.push({
        gfx,
        x: centerX,
        y: centerY,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 40, // Lemparan ke atas
        rotation: this.randomFn() * Math.PI,
        vRot: (this.randomFn() - 0.5) * 10,
        alpha: 1.0,
        color,
        size,
      });
    }
  }

  // =========================================================================
  // 3. STEWARD MEMPERBAIKI TILE GLITCH (Lelucon meta: dia yang bangun kantor)
  // =========================================================================

  /**
   * Memicu Steward memperbaiki tile glitch di Graphics Lab (Z09, gx: 25, gy: 16).
   */
  public triggerStewardGlitchRepair(): boolean {
    const steward = this.characterManager.getCharacter('steward');
    if (!steward) return false;

    // INVARIANT: Jangan ganggu Steward jika sedang mengerjakan task nyata
    if (steward.workStatus === 'working') {
      return false;
    }

    this.isGlitchTileActive = true;
    this.glitchTileRemaining = 6.0;

    // Tampilkan efek visual glitch di koordinat tile
    this.showGlitchTileGraphics(25, 16);

    // Jalankan navigasi Steward ke slot perbaikan tile jika ada choreographer
    if (this.choreographer) {
      const slot = this.choreographer.getGridMap().getSlot('slot_z09_tile_repair');
      if (slot) {
        steward.act(slot as unknown as InteractionSlot);
      }
    }

    this.emitEasterEggBubble(
      'steward',
      'Memperbaiki tile glitch... Aku yang bangun kantor ini, kok bisa ada bug!',
    );

    return true;
  }

  private showGlitchTileGraphics(gx: number, gy: number): void {
    if (!this.effectsContainer) return;

    if (!this.glitchGraphics) {
      this.glitchGraphics = new Graphics();
      this.glitchGraphics.label = 'GlitchTileEffect';
      this.effectsContainer.addChild(this.glitchGraphics);
    }

    const pos = gridToScreen(gx, gy, WORLD_ORIGIN_X, WORLD_ORIGIN_Y);
    this.glitchGraphics.clear();
    this.glitchGraphics.poly([
      pos.x, pos.y - 16,
      pos.x + 32, pos.y,
      pos.x, pos.y + 16,
      pos.x - 32, pos.y,
    ]);
    this.glitchGraphics.stroke({ width: 2, color: 0x22d3ee, alpha: 0.85 });
    this.glitchGraphics.fill({ color: 0xe879f9, alpha: 0.35 });
    this.glitchGraphics.visible = true;
  }

  private clearGlitchTileGraphics(): void {
    if (this.glitchGraphics) {
      this.glitchGraphics.clear();
      this.glitchGraphics.visible = false;
    }
  }

  // =========================================================================
  // 4. NO DEPLOY FRIDAY (Jumat setelah 16.00 WIB di Release Dock Z11)
  // =========================================================================

  /**
   * Memeriksa apakah waktu saat ini adalah Jumat setelah pukul 16.00 WIB (UTC+7).
   */
  public isNoDeployFriday(now: Date = this.getNow()): boolean {
    const wib = new Date(now.getTime() + 7 * 3600 * 1000);
    const dayOfWeek = wib.getUTCDay(); // 5 = Jumat
    const hour = wib.getUTCHours();
    return dayOfWeek === 5 && hour >= 16;
  }

  public checkNoDeployFriday(now?: Date): boolean {
    const isFridayAfter16 = this.isNoDeployFriday(now);
    if (isFridayAfter16 && !this.isNoDeployFridayActive) {
      return this.triggerNoDeployFriday();
    } else if (!isFridayAfter16 && this.isNoDeployFridayActive) {
      this.isNoDeployFridayActive = false;
      this.hideNoDeployFridaySticker();
    }
    return this.isNoDeployFridayActive;
  }

  /**
   * Memicu stiker "No Deploy Friday" di Release Dock (Z11).
   * INVARIANT: Tidak menghalangi Relay mengeksekusi task rilis nyata jika ada.
   */
  public triggerNoDeployFriday(): boolean {
    this.isNoDeployFridayActive = true;
    this.showNoDeployFridaySticker();

    const relay = this.characterManager.getCharacter('relay');
    if (relay && relay.workStatus !== 'working') {
      this.emitEasterEggBubble(
        'relay',
        "⚠️ Stiker terpasang: 'No Deploy Friday'! Tidak ada rilis ke production sore ini.",
      );
    }

    return true;
  }

  private showNoDeployFridaySticker(): void {
    if (!this.effectsContainer) return;

    if (!this.noDeployFridayContainer) {
      this.noDeployFridayContainer = new Container();
      this.noDeployFridayContainer.label = 'Sticker_NoDeployFriday';

      // Posisi papan changelog / conveyor di Release Dock Z11 (gx: 34, gy: 12)
      const pos = gridToScreen(34, 12, WORLD_ORIGIN_X, WORLD_ORIGIN_Y);
      this.noDeployFridayContainer.x = pos.x - 45;
      this.noDeployFridayContainer.y = pos.y - 35;

      const badge = new Graphics();
      badge.roundRect(0, 0, 90, 18, 4);
      badge.fill({ color: 0xf59e0b, alpha: 0.95 });
      badge.stroke({ width: 1.5, color: 0x14141e, alpha: 1.0 });

      // Garis strip diagonal khas stiker peringatan
      badge.rect(4, 3, 82, 12);
      badge.fill({ color: 0xd97706, alpha: 0.4 });

      this.noDeployFridayContainer.addChild(badge);
      this.effectsContainer.addChild(this.noDeployFridayContainer);
    }

    this.noDeployFridayContainer.visible = true;
  }

  private hideNoDeployFridaySticker(): void {
    if (this.noDeployFridayContainer) {
      this.noDeployFridayContainer.visible = false;
    }
  }

  // =========================================================================
  // 5. TIDUR DI SOFA LOUNGE: Pukul 03.00 WIB jika tidak ada task berjalan
  // =========================================================================

  /**
   * Cek apakah waktu saat ini berada pada jam 03.00 WIB (03:00 - 03:59).
   */
  public is3AmWib(now: Date = this.getNow()): boolean {
    const wib = new Date(now.getTime() + 7 * 3600 * 1000);
    return wib.getUTCHours() === 3;
  }

  /**
   * Memeriksa apakah tidak ada task yang sedang berjalan di kantor.
   */
  public hasNoRunningTasks(): boolean {
    try {
      const agents = officeStore.getState().agents;
      const anyWorking = Object.values(agents).some((a) => a.work !== 'idle');
      return !anyWorking;
    } catch {
      return true;
    }
  }

  public checkLoungeSleep(now?: Date): boolean {
    const is3Am = this.is3AmWib(now);
    const noTasks = this.hasNoRunningTasks();

    if (is3Am && noTasks) {
      if (!this.sleepingAgentId) {
        // Pilih satu agen acak yang sedang idle (hindari Rifqi)
        const eligible = this.characterManager
          .getAllCharacters()
          .filter((c) => c.id !== 'rifqi' && c.workStatus === 'idle');

        if (eligible.length > 0) {
          const selected = eligible[Math.floor(this.randomFn() * eligible.length)];
          this.triggerLoungeSleep(selected.id);
          return true;
        }
      }
      return true;
    } else if (this.sleepingAgentId && (!noTasks || !is3Am)) {
      // INVARIANT: Jika task nyata mulai atau jam lewat, segera bangunkan!
      this.wakeUpSleepingAgent();
    }

    return false;
  }

  /**
   * Mengirim satu agent tertidur di sofa lounge Z14 (slot_z14_sofa_1).
   * INVARIANT: Jika ada task berjalan, fungsi ini langsung ditolak.
   */
  public triggerLoungeSleep(agentId = 'oracle'): boolean {
    if (!this.hasNoRunningTasks()) {
      return false; // Task nyata menang
    }

    const char = this.characterManager.getCharacter(agentId);
    if (!char) return false;

    this.sleepingAgentId = agentId;
    char.setGridPosition(17, 24); // Posisi sofa lounge Z14
    char.playAnimation('sit_type');

    this.emitEasterEggBubble(agentId, 'Zzz...');

    return true;
  }

  /**
   * Membangunkan agent yang tertidur di sofa lounge.
   */
  public wakeUpSleepingAgent(): boolean {
    if (!this.sleepingAgentId) return false;

    const agentId = this.sleepingAgentId;
    this.sleepingAgentId = null;

    const char = this.characterManager.getCharacter(agentId);
    if (char) {
      char.idle();
      // Kembalikan ke meja jika ada choreographer
      if (this.choreographer) {
        const state = this.choreographer.getAgentState(agentId);
        if (state) {
          this.choreographer.sendAgentToDesk(agentId, state, char, false);
        }
      }
    }

    return true;
  }

  // =========================================================================
  // 6. KLIK MESIN ESPRESSO: Jarvis mengucapkan jumlah kopi yang diminum
  // =========================================================================

  /**
   * Menangani klik grid tile untuk mendeteksi interaksi dengan mesin espresso.
   * Mesin espresso terletak di Kafetaria Z14 (gx: 13, gy: 23).
   */
  public handleGridClick(gx: number, gy: number): boolean {
    const isEspressoTile =
      (gx === 13 && gy === 23) ||
      (gx === 13 && gy === 24) ||
      (Math.hypot(gx - 13, gy - 23) <= 1.2);

    if (isEspressoTile) {
      this.handleEspressoClick();
      return true;
    }

    return false;
  }

  /**
   * Menangani klik langsung pada mesin espresso.
   * Jarvis mengucapkan jumlah cangkir kopi yang diminum kantor hari ini.
   * INVARIANT: Jarvis yang sedang bekerja tetap mempertahankan task badge aktif.
   */
  public handleEspressoClick(): { coffeeCount: number; message: string } {
    this.espressoClicks++;

    let completedTasks = 0;
    try {
      completedTasks = officeStore
        .getState()
        .recentEvents.filter((e) => e.kind === 'task_done').length;
    } catch {
      completedTasks = 0;
    }

    // Angka kopi didasarkan pada task selesai hari ini + interaksi klik
    const count = Math.max(1, completedTasks + this.espressoClicks);
    const message = `Tercatat ${count} cangkir kopi telah diminum kantor hari ini.`;

    this.emitEasterEggBubble('jarvis', message);

    try {
      officeStore.getState().addToast({
        title: '☕ Mesin Espresso Kafetaria',
        message: `Jarvis: ${message}`,
        kind: 'info',
        durationMs: 4000,
      });
    } catch {
      // Mock aman
    }

    return { coffeeCount: count, message };
  }

  // =========================================================================
  // UPDATE TICKER & PENEGAKAN INVARIANT MUTLAK
  // =========================================================================

  public update(dtSec: number): void {
    // 1. Update timer Konami
    if (this.isKonamiActive) {
      this.konamiRemaining -= dtSec;
      if (this.konamiRemaining <= 0) {
        this.konamiRemaining = 0;
        this.isKonamiActive = false;
        this.restorePostKonamiAnimations();
      }
    }

    // 2. Update timer rambut berdiri Oracle
    if (this.oracleShockRemaining > 0) {
      this.oracleShockRemaining -= dtSec;
      if (this.oracleShockRemaining <= 0) {
        this.oracleShockRemaining = 0;
        const oracle = this.characterManager.getCharacter('oracle');
        if (oracle) {
          oracle.playAnimation(oracle.workStatus === 'working' ? 'sit_type' : 'idle');
        }
      }
    }

    // 3. Update partikel konfeti
    if (this.confettiParticles.length > 0) {
      this.updateConfettiParticles(dtSec);
    }

    // 4. Update timer tile glitch Steward
    if (this.isGlitchTileActive) {
      this.glitchTileRemaining -= dtSec;
      if (this.glitchTileRemaining <= 0) {
        this.glitchTileRemaining = 0;
        this.isGlitchTileActive = false;
        this.clearGlitchTileGraphics();
      } else if (this.glitchGraphics) {
        // Efek flicker glitch
        this.glitchGraphics.alpha = 0.5 + this.randomFn() * 0.5;
      }
    }

    // 5. Cek otomatis No Deploy Friday & 03.00 WIB Sleep
    this.checkNoDeployFriday();
    this.checkLoungeSleep();

    // 6. Penegakan Invariant Mutlak: Tidak ada easter egg menutupi status task nyata
    this.enforceRealTaskInvariants();
  }

  private restorePostKonamiAnimations(): void {
    const characters = this.characterManager.getAllCharacters();
    for (const char of characters) {
      if (char.workStatus === 'working') {
        char.playAnimation('sit_type');
        char.badgeContainer.visible = true;
      } else if (char.fsmState === 'act') {
        char.playAnimation(char.getCurrentSlot()?.anim || 'idle');
      } else if (char.fsmState === 'walk') {
        char.playAnimation('walk');
      } else {
        char.playAnimation('idle');
      }
    }
  }

  private updateConfettiParticles(dtSec: number): void {
    for (let i = this.confettiParticles.length - 1; i >= 0; i--) {
      const p = this.confettiParticles[i];
      p.x += p.vx * dtSec;
      p.y += p.vy * dtSec;
      p.vy += 120 * dtSec; // Gravitasi
      p.rotation += p.vRot * dtSec;
      p.alpha -= 0.45 * dtSec;

      p.gfx.x = p.x;
      p.gfx.y = p.y;
      p.gfx.rotation = p.rotation;
      p.gfx.alpha = Math.max(0, p.alpha);

      if (p.alpha <= 0) {
        p.gfx.destroy();
        this.confettiParticles.splice(i, 1);
      }
    }
  }

  /**
   * INVARIANT MUTLAK:
   * Memastikan tidak ada easter egg apa pun yang menutupi atau memalsukan
   * status task nyata pada karakter atau HUD.
   */
  public enforceRealTaskInvariants(): void {
    const characters = this.characterManager.getAllCharacters();
    for (const char of characters) {
      if (char.workStatus === 'working') {
        // Badge task nyata wajib selalu terlihat
        if (!char.badgeContainer.visible) {
          char.badgeContainer.visible = true;
        }
      }
    }

    // Jika sedang ada task berjalan dan ada agen tidur di lounge, bangunkan segera!
    if (this.sleepingAgentId && !this.hasNoRunningTasks()) {
      this.wakeUpSleepingAgent();
    }

    // Jika Steward sedang memperbaiki glitch tetapi mendapat task, prioritaskan task
    if (this.isGlitchTileActive) {
      const steward = this.characterManager.getCharacter('steward');
      if (steward && steward.workStatus === 'working') {
        this.isGlitchTileActive = false;
        this.clearGlitchTileGraphics();
      }
    }
  }

  private emitEasterEggBubble(agentId: string, text: string): void {
    if (this.choreographer) {
      this.choreographer.emitBubble(agentId, text, 'task');
    } else if (this.bubbleManager) {
      this.bubbleManager.handleChoreographerBubble({
        agentId,
        text,
        kind: 'task',
      });
    }
  }

  public destroy(): void {
    if (typeof window !== 'undefined' && this.keydownListener) {
      window.removeEventListener('keydown', this.keydownListener);
      this.keydownListener = null;
    }

    for (const p of this.confettiParticles) {
      p.gfx.destroy();
    }
    this.confettiParticles = [];

    this.clearGlitchTileGraphics();
    this.hideNoDeployFridaySticker();

    if (this.effectsContainer) {
      this.effectsContainer.destroy({ children: true });
      this.effectsContainer = null;
    }
  }
}
