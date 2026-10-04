// Threshold decisions extracted verbatim from the baseline VitalsEnvironmentManager.
import type { CharacterRegistry } from './CharacterRegistry';
import type { Choreographer } from '../Choreographer';
import type { HostVitals } from '../../types/office';
export class VitalsModel {
  cpuHighDuration = 0;
  private isCpuAlert = false; private isRamAlert = false; private isDiskAlert = false; private isStale = false;
  private useMonotonicClock = true;
  private clock = () => performance.now() / 1000;
  private cpuHighStartTime: number | null = null;
  private lastVitals: HostVitals | null = null;
  constructor(private characterManager: CharacterRegistry, private choreographer: Choreographer) {}
  private applyCpuAlert(active: boolean) { this.characterManager.getCharacter('bastion')?.setSweating(active); }
  private applyRamAlert(active: boolean) { this.choreographer.setVectorRamPacing(active); }
  public update(dtSec: number, vitals: HostVitals | null, realElapsedSec?: number): void {
    // 1. Missing vitals: reset semua status peringatan dan durasi
    if (!vitals) {
      this.resetCpuThreshold();
      if (this.isRamAlert) {
        this.isRamAlert = false;
        this.applyRamAlert(false);
      }
      if (this.isDiskAlert) {
        this.isDiskAlert = false;
      }
      this.lastVitals = null;
      return;
    }

    this.lastVitals = vitals;
    const isStale =
      this.isStale ||
      Boolean((vitals as { stale?: boolean }).stale) ||
      Boolean((vitals as { is_stale?: boolean }).is_stale) ||
      (vitals as { status: string }).status === 'stale';

    // 2. Stale vitals: reset durasi kontinu dan matikan alert
    if (isStale) {
      this.resetCpuThreshold();
      if (this.isRamAlert) {
        this.isRamAlert = false;
        this.applyRamAlert(false);
      }
      if (this.isDiskAlert) {
        this.isDiskAlert = false;
      }
      return;
    }

    const prevCpuAlert = this.isCpuAlert;
    const prevRamAlert = this.isRamAlert;
    const prevDiskAlert = this.isDiskAlert;

    // 3. Ambang CPU: > 80% selama 60 detik kontinu
    // Low vitals (<= 80%) seketika mereset durasi kontinu
    if (vitals.cpu_percent > 80) {
      if (realElapsedSec !== undefined) {
        this.cpuHighDuration += realElapsedSec;
      } else if (this.useMonotonicClock) {
        const now = this.clock();
        if (this.cpuHighStartTime === null) {
          this.cpuHighStartTime = now;
          this.cpuHighDuration = 0;
        } else {
          this.cpuHighDuration = Math.max(0, now - this.cpuHighStartTime);
        }
      } else {
        this.cpuHighDuration += dtSec;
      }
    } else {
      this.resetCpuThreshold();
    }
    const newCpuAlert = this.cpuHighDuration >= 60;

    // 4. Ambang RAM: > 85%
    const newRamAlert = vitals.memory_percent > 85;

    // 5. Ambang Disk: > 85%
    const newDiskAlert = vitals.disk_percent > 85;

    // Terapkan perubahan state jika ada transisi
    if (newCpuAlert !== prevCpuAlert) {
      this.isCpuAlert = newCpuAlert;
      this.applyCpuAlert(newCpuAlert);
      if (newCpuAlert && this.choreographer) {
        this.choreographer.emitBubble(
          'bastion',
          'Suhu Data Center melonjak! CPU di atas 80%...',
          'task',
        );
      }
    }

    if (newRamAlert !== prevRamAlert) {
      this.isRamAlert = newRamAlert;
      this.applyRamAlert(newRamAlert);
    }

    if (newDiskAlert !== prevDiskAlert) {
      this.isDiskAlert = newDiskAlert;
      if (newDiskAlert && this.choreographer) {
        this.choreographer.emitBubble(
          'vector',
          'Penyimpanan disk menipis (> 85%), kardus data menumpuk!',
          'task',
        );
      }
    }

    // Procedural drawing is owned by the scene's single animation clock.
  }

  public advanceCpuDuration(seconds: number): void {
    if (
      this.lastVitals &&
      this.lastVitals.cpu_percent > 80 &&
      !this.isStale &&
      (this.lastVitals as { status: string }).status !== 'stale'
    ) {
      this.cpuHighDuration += seconds;
      if (this.useMonotonicClock && this.cpuHighStartTime !== null) {
        this.cpuHighStartTime -= seconds;
      }
      const newCpuAlert = this.cpuHighDuration >= 60;
      if (newCpuAlert !== this.isCpuAlert) {
        this.isCpuAlert = newCpuAlert;
        this.applyCpuAlert(newCpuAlert);
      }
    }
  }

  public setCpuHighDuration(seconds: number): void {
    this.cpuHighDuration = seconds;
    if (this.useMonotonicClock) {
      this.cpuHighStartTime = this.clock() - seconds;
    }
    const newCpuAlert = this.cpuHighDuration >= 60;
    if (newCpuAlert !== this.isCpuAlert) {
      this.isCpuAlert = newCpuAlert;
      this.applyCpuAlert(newCpuAlert);
    }
  }

  public setMonotonicClock(clock: () => number): void {
    this.clock = clock;
    this.useMonotonicClock = true;
  }

  public setMonotonicClockEnabled(enabled: boolean): void {
    this.useMonotonicClock = enabled;
    if (!enabled) {
      this.cpuHighStartTime = null;
    }
  }

  public markStale(stale: boolean = true): void {
    this.isStale = stale;
    if (stale) {
      this.resetCpuThreshold();
      if (this.isRamAlert) {
        this.isRamAlert = false;
        this.applyRamAlert(false);
      }
      if (this.isDiskAlert) {
        this.isDiskAlert = false;
      }
    }
  }

  public isStaleVitals(): boolean {
    return (
      this.isStale ||
      Boolean((this.lastVitals as { stale?: boolean })?.stale) ||
      Boolean((this.lastVitals as { is_stale?: boolean })?.is_stale) ||
      (this.lastVitals as { status?: string } | null)?.status === 'stale'
    );
  }

  public resetCpuThreshold(): void {
    this.cpuHighDuration = 0;
    this.cpuHighStartTime = null;
    if (this.isCpuAlert) {
      this.isCpuAlert = false;
      this.applyCpuAlert(false);
    }
  }

  public getStatus() {
    return {
      cpuPercent: this.lastVitals?.cpu_percent ?? 0,
      memoryPercent: this.lastVitals?.memory_percent ?? 0,
      diskPercent: this.lastVitals?.disk_percent ?? 0,
      cpuHighDuration: this.cpuHighDuration,
      isCpuAlert: this.isCpuAlert,
      isRamAlert: this.isRamAlert,
      isDiskAlert: this.isDiskAlert,
      isStale: this.isStaleVitals(),
    };
  }

  public isCpuAlertActive(): boolean {
    return this.isCpuAlert;
  }

  public isRamAlertActive(): boolean {
    return this.isRamAlert;
  }

  public isDiskAlertActive(): boolean {
    return this.isDiskAlert;
  }

  public isLedBlinkingFast(): boolean {
    return this.isCpuAlert;
  }

  public isAcFanSpinning(): boolean {
    return this.isCpuAlert;
  }

  public isBastionSweating(): boolean {
    const bastion = this.characterManager.getCharacter('bastion');
    return Boolean(bastion?.isSweating);
  }

  public isVectorPacing(): boolean {
    if (!this.choreographer) return false;
    return this.choreographer.isVectorRamPacingActive;
  }
  isCardboardPiledUp() { return this.isDiskAlert; }
  getCardboardBoxCount() { return this.isDiskAlert ? 6 : 0; }
  destroy() { this.applyCpuAlert(false); this.applyRamAlert(false); }
}
