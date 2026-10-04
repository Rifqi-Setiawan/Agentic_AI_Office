import { Container, Graphics, Sprite, Texture } from 'pixi.js';
import type { LoadedOfficeMap } from './mapLoader';
import type { CharacterManager } from './CharacterManager';
import type { Choreographer } from './choreographer/Choreographer';
import type { HostVitals } from '../types/office';
import { calculateZIndex, gridToScreen, LAYER_OFFSETS, WORLD_ORIGIN_X, WORLD_ORIGIN_Y } from './projection';

export interface VitalsEnvironmentManagerOptions {
  loadedMap: LoadedOfficeMap;
  characterManager: CharacterManager;
  choreographer?: Choreographer | null;
  textureProvider?: (frameName: string) => Texture | null;
  originX?: number;
  originY?: number;
}

export interface VitalsThresholdStatus {
  cpuPercent: number;
  memoryPercent: number;
  diskPercent: number;
  cpuHighDuration: number;
  isCpuAlert: boolean;
  isRamAlert: boolean;
  isDiskAlert: boolean;
}

interface RackVisualEffect {
  sprite: Sprite;
  ledOverlay: Graphics;
  glowOverlay: Graphics;
}

interface BoxSpawnPoint {
  gx: number;
  gy: number;
  offsetY: number;
}

const DEFAULT_BOX_SPAWN_POINTS: BoxSpawnPoint[] = [
  { gx: 37, gy: 18, offsetY: 0 },
  { gx: 37, gy: 18, offsetY: -12 }, // Kardus bertumpuk
  { gx: 37, gy: 17, offsetY: 0 },
  { gx: 41, gy: 18, offsetY: 0 },
  { gx: 41, gy: 18, offsetY: -12 }, // Kardus bertumpuk
  { gx: 40, gy: 15, offsetY: 0 },
];

/**
 * VitalsEnvironmentManager mengelola perubahan dinamis lingkungan kantor
 * berdasarkan metrik telemetri host (CPU, RAM, Disk) sesuai spesifikasi F23 / Dokumen 04:
 *
 * 1. CPU > 80% selama 60 dtk:
 *    - LED rak server berkedip cepat
 *    - Kipas AC berputar cepat
 *    - Bastion berkeringat
 * 2. RAM > 85%:
 *    - Rak server menyala oranye
 *    - Vector mondar-mandir
 * 3. Disk > 85%:
 *    - Kardus mulai menumpuk di Data Center
 */
export class VitalsEnvironmentManager {
  private loadedMap: LoadedOfficeMap;
  private characterManager: CharacterManager;
  private choreographer: Choreographer | null = null;
  private textureProvider: ((frameName: string) => Texture | null) | null = null;
  private originX: number;
  private originY: number;

  // State durasi dan ambang batas
  private cpuHighDuration = 0;
  private isCpuAlert = false;
  private isRamAlert = false;
  private isDiskAlert = false;

  private lastVitals: HostVitals | null = null;
  private animTime = 0;

  // Elemen visual Pixi
  private rackEffects: RackVisualEffect[] = [];
  private acContainer: Container | null = null;
  private acFanContainer: Container | null = null;
  private acAirStreamGfx: Graphics | null = null;
  private cardboardBoxesContainer: Container | null = null;
  private cardboardBoxSprites: Sprite[] = [];

  constructor(options: VitalsEnvironmentManagerOptions) {
    this.loadedMap = options.loadedMap;
    this.characterManager = options.characterManager;
    this.choreographer = options.choreographer || null;
    this.textureProvider = options.textureProvider || null;
    this.originX = options.originX ?? WORLD_ORIGIN_X;
    this.originY = options.originY ?? WORLD_ORIGIN_Y;

    this.initRackEffects();
    this.initAcUnit();
    this.initCardboardBoxes();
  }

  /**
   * Menemukan dan memasang visual effect (LED overlay & orange glow) pada seluruh rak server di Data Center.
   */
  private initRackEffects(): void {
    const furnitureContainer = this.loadedMap.containers.furniture;
    const rackSprites = (furnitureContainer.children as Sprite[]).filter(
      (c) => c.label === 'furniture_server_rack.png',
    );

    for (const rackSprite of rackSprites) {
      // 1. Overlay LED indikator rak
      const ledOverlay = new Graphics();
      ledOverlay.label = 'ServerRack_LedOverlay';
      ledOverlay.x = rackSprite.x;
      ledOverlay.y = rackSprite.y;
      ledOverlay.zIndex = rackSprite.zIndex + 1;
      furnitureContainer.addChild(ledOverlay);

      // 2. Overlay kilau oranye saat beban RAM tinggi (>85%)
      const glowOverlay = new Graphics();
      glowOverlay.label = 'ServerRack_GlowOverlay';
      glowOverlay.visible = false;
      glowOverlay.x = rackSprite.x;
      glowOverlay.y = rackSprite.y;
      glowOverlay.zIndex = rackSprite.zIndex + 1;
      furnitureContainer.addChild(glowOverlay);

      this.rackEffects.push({
        sprite: rackSprite,
        ledOverlay,
        glowOverlay,
      });
    }
  }

  /**
   * Menginisialisasi unit pendingin AC di dinding Data Center (Z12: gx: 38, gy: 11).
   */
  private initAcUnit(): void {
    const furnitureContainer = this.loadedMap.containers.furniture;

    const pos = gridToScreen(38, 11, this.originX, this.originY);

    const acContainer = new Container();
    acContainer.label = 'DataCenter_AcUnit';
    acContainer.x = pos.x;
    acContainer.y = pos.y - 24; // Terpasang di dinding atas
    acContainer.zIndex = calculateZIndex(38, 11, LAYER_OFFSETS.FURNITURE + 5);

    // Sasis AC pendingin data center
    const acCasing = new Graphics();
    acCasing.roundRect(-24, -12, 48, 24, 3);
    acCasing.fill({ color: 0x334155, alpha: 0.95 }); // Slate-700
    acCasing.stroke({ width: 1.5, color: 0x64748b, alpha: 1.0 });

    // Kisi ventilasi bawah
    acCasing.rect(-20, 3, 40, 5);
    acCasing.fill({ color: 0x0f172a, alpha: 0.9 });

    // Lampu indikator status AC
    acCasing.circle(18, -6, 2);
    acCasing.fill({ color: 0x22c55e, alpha: 1.0 }); // Hijau aktif

    acContainer.addChild(acCasing);

    // Kipas pendingin berputar di dalam unit AC
    const acFanContainer = new Container();
    acFanContainer.label = 'AcFan';
    acFanContainer.x = -8;
    acFanContainer.y = -1;

    const fanGfx = new Graphics();
    // Baling-baling kipas 4 bilah
    fanGfx.circle(0, 0, 2);
    fanGfx.fill({ color: 0x94a3b8 });
    // Bilah silang
    fanGfx.poly([-6, -2, 6, 2, 4, 3, -4, -1]);
    fanGfx.fill({ color: 0xe2e8f0, alpha: 0.9 });
    fanGfx.poly([-2, 6, 2, -6, 3, -4, -1, 4]);
    fanGfx.fill({ color: 0xe2e8f0, alpha: 0.9 });

    acFanContainer.addChild(fanGfx);
    acContainer.addChild(acFanContainer);

    // Garis aliran angin sejuk saat AC berputar kencang
    const airStreamGfx = new Graphics();
    airStreamGfx.label = 'AcAirStream';
    airStreamGfx.visible = false;
    acContainer.addChild(airStreamGfx);

    furnitureContainer.addChild(acContainer);

    this.acContainer = acContainer;
    this.acFanContainer = acFanContainer;
    this.acAirStreamGfx = airStreamGfx;
  }

  /**
   * Menginisialisasi tumpukan kardus arsip/data di lantai Data Center (Z12).
   */
  private initCardboardBoxes(): void {
    const furnitureContainer = this.loadedMap.containers.furniture;

    const cardboardContainer = new Container();
    cardboardContainer.label = 'DataCenter_CardboardContainer';
    cardboardContainer.visible = false;

    let boxTexture: Texture = Texture.WHITE;
    if (this.textureProvider) {
      const tex = this.textureProvider('furniture_cardboard_box.png');
      if (tex) boxTexture = tex;
    }

    for (let i = 0; i < DEFAULT_BOX_SPAWN_POINTS.length; i++) {
      const pt = DEFAULT_BOX_SPAWN_POINTS[i];
      const pos = gridToScreen(pt.gx, pt.gy, this.originX, this.originY);

      const boxSprite = new Sprite(boxTexture);
      boxSprite.label = `furniture_cardboard_box_${i}`;
      boxSprite.anchor.set(0.5, 0.5);
      boxSprite.x = pos.x;
      boxSprite.y = pos.y + pt.offsetY;
      boxSprite.zIndex = calculateZIndex(
        pt.gx,
        pt.gy,
        LAYER_OFFSETS.FURNITURE + (pt.offsetY < 0 ? 2 : 1),
      );

      cardboardContainer.addChild(boxSprite);
      this.cardboardBoxSprites.push(boxSprite);
    }

    furnitureContainer.addChild(cardboardContainer);
    this.cardboardBoxesContainer = cardboardContainer;
  }

  /**
   * Pembaruan telemetri vitals dan evaluasi ambang batas per frame.
   */
  public update(dtSec: number, vitals: HostVitals | null): void {
    if (!vitals) return;

    this.lastVitals = vitals;
    const prevCpuAlert = this.isCpuAlert;
    const prevRamAlert = this.isRamAlert;
    const prevDiskAlert = this.isDiskAlert;

    // 1. Ambang CPU: > 80% selama 60 detik kumulatif kontinu
    if (vitals.cpu_percent > 80) {
      this.cpuHighDuration += dtSec;
    } else {
      this.cpuHighDuration = 0;
    }
    const newCpuAlert = this.cpuHighDuration >= 60;

    // 2. Ambang RAM: > 85%
    const newRamAlert = vitals.memory_percent > 85;

    // 3. Ambang Disk: > 85%
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
      this.applyDiskAlert(newDiskAlert);
      if (newDiskAlert && this.choreographer) {
        this.choreographer.emitBubble(
          'vector',
          'Penyimpanan disk menipis (> 85%), kardus data menumpuk!',
          'task',
        );
      }
    }

    // Update animasi prosedural (LED berkedip, rotasi kipas, kilau oranye)
    this.updateAnimations(dtSec);
  }

  /**
   * Menangani aktivasi/deaktivasi efek visual CPU alert.
   */
  private applyCpuAlert(active: boolean): void {
    const bastion = this.characterManager.getCharacter('bastion');
    if (bastion) {
      bastion.setSweating(active);
    }
  }

  /**
   * Menangani aktivasi/deaktivasi efek visual RAM alert.
   */
  private applyRamAlert(active: boolean): void {
    // 1. Rak server menyala oranye
    for (const rack of this.rackEffects) {
      rack.sprite.tint = active ? 0xffa500 : 0xffffff;
      rack.glowOverlay.visible = active;
    }

    // 2. Vector mondar-mandir
    if (this.choreographer) {
      this.choreographer.setVectorRamPacing(active);
    }
  }

  /**
   * Menangani aktivasi/deaktivasi penumpukan kardus saat Disk alert.
   */
  private applyDiskAlert(active: boolean): void {
    if (this.cardboardBoxesContainer) {
      this.cardboardBoxesContainer.visible = active;
    }
  }

  /**
   * Animasi prosedural kontinu untuk LED rak server, kipas AC, dan kilau oranye.
   */
  private updateAnimations(dtSec: number): void {
    this.animTime += dtSec;

    // 1. Animasi LED Rak Server
    // Kecepatan kedip: cepat (~8 Hz) saat CPU alert, normal (~1 Hz) saat normal
    const blinkFreq = this.isCpuAlert ? 32 : 4;
    const isLit = Math.sin(this.animTime * blinkFreq) > 0;
    const ledColor = this.isCpuAlert
      ? isLit
        ? 0xef4444 // Merah membara
        : 0xfacc15 // Kuning peringatan
      : isLit
        ? 0x22c55e // Hijau stabil
        : 0x06b6d4; // Cyan normal

    for (const rack of this.rackEffects) {
      rack.ledOverlay.clear();
      // Gambar LED baris atas & bawah pada rak server
      rack.ledOverlay.rect(-6, -14, 3, 2);
      rack.ledOverlay.rect(-1, -14, 3, 2);
      rack.ledOverlay.rect(4, -14, 3, 2);
      rack.ledOverlay.rect(-6, 2, 3, 2);
      rack.ledOverlay.rect(-1, 2, 3, 2);
      rack.ledOverlay.fill({ color: ledColor, alpha: isLit ? 1.0 : 0.4 });

      // Animasi kilau oranye rak saat RAM alert
      if (this.isRamAlert) {
        rack.glowOverlay.clear();
        const pulse = 0.35 + 0.18 * Math.sin(this.animTime * 6);
        rack.glowOverlay.roundRect(-16, -26, 32, 52, 4);
        rack.glowOverlay.fill({ color: 0xf97316, alpha: pulse });
      }
    }

    // 2. Animasi Kipas AC
    if (this.acFanContainer) {
      if (this.isCpuAlert) {
        // Berputar cepat saat CPU > 80% (25 rad/dtk ~ 4 putaran/dtk)
        this.acFanContainer.rotation += 25 * dtSec;
        if (this.acAirStreamGfx) {
          this.acAirStreamGfx.visible = true;
          this.acAirStreamGfx.clear();
          const streamAlpha = 0.4 + 0.3 * Math.sin(this.animTime * 12);
          // Garis hembusan angin dingin mengarah ke bawah
          this.acAirStreamGfx.poly([-12, 10, -16, 22]);
          this.acAirStreamGfx.stroke({ width: 1.5, color: 0x38bdf8, alpha: streamAlpha });
          this.acAirStreamGfx.poly([0, 10, 0, 24]);
          this.acAirStreamGfx.stroke({ width: 1.5, color: 0x7dd3fc, alpha: streamAlpha * 0.85 });
          this.acAirStreamGfx.poly([12, 10, 16, 22]);
          this.acAirStreamGfx.stroke({ width: 1.5, color: 0x38bdf8, alpha: streamAlpha });
        }
      } else {
        // Rotasi lambat / idle
        this.acFanContainer.rotation += 0.5 * dtSec;
        if (this.acAirStreamGfx) {
          this.acAirStreamGfx.visible = false;
        }
      }
    }
  }

  /**
   * Majukan waktu durasi CPU tinggi secara manual (sangat berguna untuk pengujian terisolasi).
   */
  public advanceCpuDuration(seconds: number): void {
    if (this.lastVitals && this.lastVitals.cpu_percent > 80) {
      this.cpuHighDuration += seconds;
      const newCpuAlert = this.cpuHighDuration >= 60;
      if (newCpuAlert !== this.isCpuAlert) {
        this.isCpuAlert = newCpuAlert;
        this.applyCpuAlert(newCpuAlert);
      }
    }
  }

  /**
   * Mengatur nilai kumulatif durasi CPU tinggi secara langsung untuk pengujian.
   */
  public setCpuHighDuration(seconds: number): void {
    this.cpuHighDuration = seconds;
    const newCpuAlert = this.cpuHighDuration >= 60;
    if (newCpuAlert !== this.isCpuAlert) {
      this.isCpuAlert = newCpuAlert;
      this.applyCpuAlert(newCpuAlert);
    }
  }

  public getStatus(): VitalsThresholdStatus {
    return {
      cpuPercent: this.lastVitals?.cpu_percent ?? 0,
      memoryPercent: this.lastVitals?.memory_percent ?? 0,
      diskPercent: this.lastVitals?.disk_percent ?? 0,
      cpuHighDuration: this.cpuHighDuration,
      isCpuAlert: this.isCpuAlert,
      isRamAlert: this.isRamAlert,
      isDiskAlert: this.isDiskAlert,
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

  public isCardboardPiledUp(): boolean {
    return this.isDiskAlert && Boolean(this.cardboardBoxesContainer?.visible);
  }

  public getCardboardBoxCount(): number {
    return this.isDiskAlert ? this.cardboardBoxSprites.length : 0;
  }

  public getServerRacks(): Sprite[] {
    return this.rackEffects.map((r) => r.sprite);
  }

  public destroy(): void {
    if (this.acContainer && this.acContainer.parent) {
      this.acContainer.parent.removeChild(this.acContainer);
      this.acContainer.destroy({ children: true });
      this.acContainer = null;
    }
    if (this.cardboardBoxesContainer && this.cardboardBoxesContainer.parent) {
      this.cardboardBoxesContainer.parent.removeChild(this.cardboardBoxesContainer);
      this.cardboardBoxesContainer.destroy({ children: true });
      this.cardboardBoxesContainer = null;
    }
    for (const rack of this.rackEffects) {
      if (rack.ledOverlay.parent) rack.ledOverlay.parent.removeChild(rack.ledOverlay);
      rack.ledOverlay.destroy();
      if (rack.glowOverlay.parent) rack.glowOverlay.parent.removeChild(rack.glowOverlay);
      rack.glowOverlay.destroy();
    }
    this.rackEffects = [];
    this.cardboardBoxSprites = [];
  }
}
