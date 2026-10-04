// Baseline rules retained; drawing is represented as scene-owned effect state.
import type { CharacterRegistry } from './CharacterRegistry';
import type { Choreographer } from '../Choreographer';
import type { BubbleManager } from '../bubble';
import type { InteractionSlot } from '../types';
import type { EasterEggState } from '../easterEgg/types';
import { officeStore } from '../../store/officeStore';
const KONAMI_SEQUENCE = ['arrowup','arrowup','arrowdown','arrowdown','arrowleft','arrowright','arrowleft','arrowright','b','a'];
export class EasterEggModel {
  private konamiIndex = 0; private isKonamiActive = false; private konamiRemaining = 0;
  private oracleClicks = 0; private lastOracleClickTs = 0; private oracleShockRemaining = 0;
  private isGlitchTileActive = false; private glitchTileRemaining = 0;
  private isNoDeployFridayActive = false; private sleepingAgentId: string | null = null;
  private espressoClicks = 0;
  private getNow: () => Date; private randomFn: () => number;
  readonly confetti: { x: number; y: number; vx: number; vy: number; remaining: number; color: string }[] = [];
  constructor(private characterManager: CharacterRegistry, private choreographer: Choreographer, private bubbleManager: BubbleManager | null,
    config: { getNow?: () => Date; randomFn?: () => number } = {}) {
    this.getNow = config.getNow ?? (() => new Date()); this.randomFn = config.randomFn ?? Math.random;
  }
  private showGlitchTileGraphics(gx: number, gy: number) { this.glitchPosition = { gx, gy }; }
  glitchPosition = { gx: 25, gy: 16 };
  private clearGlitchTileGraphics() { /* Scene reads state. */ }
  private showNoDeployFridaySticker() { /* Scene reads state. */ }
  private hideNoDeployFridaySticker() { /* Scene reads state. */ }
  private spawnConfettiParticles(x: number, y: number) {
    const colors = ['#22d3ee','#a855f7','#a3e635','#fbbf24','#f97316'];
    for (let i=0; i<24; i++) this.confetti.push({x,y,vx:(this.randomFn()-.5)*100,vy:-30-this.randomFn()*80,remaining:2.2,color:colors[i%5]});
  }
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

  public triggerKonamiCode(): boolean {
    this.isKonamiActive = true;
    this.konamiRemaining = 5.0;

    const characters = this.characterManager.getAllCharacters();
    for (const char of characters) {

      // Mainkan animasi selebrasi/tari
      char.playAnimation('celebrate', true);

      // Real task badges are derived independently by the scene.
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

    // 2. Rambutnya berdiri sebentar (animasi eureka / special)
    this.oracleShockRemaining = 4.0;
    oracle.playAnimation('eureka', true);

    // Real task status is unchanged by this reaction.

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

  public is3AmWib(now: Date = this.getNow()): boolean {
    const wib = new Date(now.getTime() + 7 * 3600 * 1000);
    return wib.getUTCHours() === 3;
  }

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
    if (this.confetti.length > 0) {
      for (let i=this.confetti.length-1; i>=0; i--) {
        const p = this.confetti[i]; p.x += p.vx*dtSec; p.y += p.vy*dtSec; p.vy += 120*dtSec; p.remaining -= dtSec;
        if (p.remaining <= 0) this.confetti.splice(i,1);
      }
    }

    // 4. Update timer tile glitch Steward
    if (this.isGlitchTileActive) {
      this.glitchTileRemaining -= dtSec;
      if (this.glitchTileRemaining <= 0) {
        this.glitchTileRemaining = 0;
        this.isGlitchTileActive = false;
        this.clearGlitchTileGraphics();
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

      } else if (char.fsmState === 'act') {
        char.playAnimation(char.getCurrentSlot()?.anim || 'idle');
      } else if (char.fsmState === 'walk') {
        char.playAnimation('walk');
      } else {
        char.playAnimation('idle');
      }
    }
  }

  public enforceRealTaskInvariants(): void {

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
  destroy() { this.confetti.length = 0; }
}
