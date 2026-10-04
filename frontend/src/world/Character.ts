import {
  AnimatedSprite,
  Container,
  Graphics,
  Rectangle,
  Text,
  Texture,
} from 'pixi.js';
import { FacingDirection, GridPoint } from '../navigation/types';
import type { InteractionSlot } from './types';
import { vectorToFacing } from '../navigation/AStarPathfinder';
import {
  calculateZIndex,
  gridToScreen,
  LAYER_OFFSETS,
  WORLD_ORIGIN_X,
  WORLD_ORIGIN_Y,
} from './projection';
import { officeStore } from '../store/officeStore';
import type { AgentWork, TaskRef } from '../types/office';

export type CharacterFsmState = 'idle' | 'walk' | 'arrive' | 'act' | 'leave';

export interface CharacterTextures {
  /**
   * Peta animasi -> arah ('se' | 'ne') -> daftar tekstur frame
   * Contoh: textures['walk']['se'] = [t0, t1, t2, t3, t4, t5]
   */
  [animation: string]: {
    se: Texture[];
    ne: Texture[];
  };
}

export interface CharacterConfig {
  id: string;
  name: string;
  role?: string;
  signatureColor?: string;
  initialGx?: number;
  initialGy?: number;
  initialFacing?: FacingDirection;
  speed?: number; // Kecepatan jalan dalam tile/detik (default: 2.5)
  originX?: number;
  originY?: number;
  textures?: CharacterTextures;
  showNameTag?: boolean;
}

/** Kecepatan gerak karakter standar sesuai blueprint: 2,5 tile/detik */
export const DEFAULT_WALK_SPEED = 2.5;

/**
 * Entitas Karakter Isometrik 2:1 dengan AnimatedSprite 4 arah (mirror)
 * dan Finite State Machine (FSM):
 *   idle -> walk(path) -> arrive -> act(anim slot) -> leave -> idle
 */
export class Character extends Container {
  public readonly id: string;
  public readonly characterName: string;
  public role: string;
  public signatureColor: string;

  // Koordinat grid kontinyu (gx, gy)
  public gx: number;
  public gy: number;
  public facing: FacingDirection = 'SE';
  public fsmState: CharacterFsmState = 'idle';
  public speed: number = DEFAULT_WALK_SPEED;

  // Parameter rendering isometrik
  public originX: number;
  public originY: number;
  public slotYOffset = 0; // y_offset dari slot saat duduk

  // Komponen visual Pixi
  public readonly spriteWrapper: Container;
  public readonly animatedSprite: AnimatedSprite;
  public readonly badgeContainer: Container;
  public readonly badgeGfx: Graphics;
  public readonly nameTagContainer: Container;
  public readonly nameTagGfx: Graphics;
  public readonly nameText: Text;
  public crownContainer: Container | null = null;
  public crownGfx: Graphics | null = null;

  // State navigasi dan FSM
  private currentPath: GridPoint[] = [];
  private currentPathIndex = 0;
  private currentSlot: InteractionSlot | null = null;
  private targetSlot?: InteractionSlot;
  private textures: CharacterTextures = {};
  private currentAnimation = 'idle';
  private workGestureTime = 0;

  public getCurrentAnimation(): string {
    return this.currentAnimation;
  }

  // State telemetri / status
  public workStatus: AgentWork = 'idle';
  public currentTask: TaskRef | null = null;
  public isHovered = false;
  public isSelected = false;

  // Timer animasi procedural (pulse badge & floating crown)
  private pulseTime = 0;
  private crownTime = 0;

  // State stempel merah FAIL (Sentinel T2.2 / F20)
  public isShowingFailStamp = false;
  private failStampRemaining = 0;
  public stampContainer: Container | null = null;
  public stampGfx: Graphics | null = null;
  public stampText: Text | null = null;

  // State membawa paket (Relay T2.2 / F20)
  public isCarryingParcel = false;
  public parcelContainer: Container | null = null;

  // State reaksi inspeksi dan komentar (Bastion & Jarvis T2.2 / F20)
  public isInspecting = false;
  public isCommenting = false;

  // State berkeringat saat CPU vitals alert (T2.4 / F23)
  public isSweating = false;
  public sweatContainer: Container | null = null;
  public sweatGfx: Graphics | null = null;
  private sweatAnimTime = 0;

  // Callbacks
  public onStateChange?: (from: CharacterFsmState, to: CharacterFsmState) => void;
  public onArrive?: (slot?: InteractionSlot) => void;
  public onAct?: (slot: InteractionSlot) => void;
  public onLeave?: (slot?: InteractionSlot) => void;
  public onClickCallback?: (character: Character) => void;
  public onHoverCallback?: (character: Character, isHovered: boolean) => void;

  constructor(config: CharacterConfig) {
    super();

    this.id = config.id;
    this.characterName = config.name;
    this.role = config.role || 'Spesialis Agen';
    this.signatureColor = config.signatureColor || '#2bb3c0';
    this.gx = config.initialGx ?? 0;
    this.gy = config.initialGy ?? 0;
    this.facing = config.initialFacing ?? 'SE';
    this.speed = config.speed ?? DEFAULT_WALK_SPEED;
    this.originX = config.originX ?? WORLD_ORIGIN_X;
    this.originY = config.originY ?? WORLD_ORIGIN_Y;

    this.label = `Character_${this.id}`;

    // 1. Kontainer pembungkus sprite (untuk mirror scale.x dan slotYOffset)
    this.spriteWrapper = new Container();
    this.spriteWrapper.label = `SpriteWrapper_${this.id}`;
    this.addChild(this.spriteWrapper);

    // Siapkan tekstur awal
    if (config.textures) {
      this.textures = config.textures;
    } else {
      this.textures = this.createFallbackTextures();
    }

    const initialTextures = this.resolveTextures('idle', this.facing);
    this.animatedSprite = new AnimatedSprite(initialTextures);
    this.animatedSprite.label = `AnimSprite_${this.id}`;
    // Anchor kaki di tengah bawah (x=0.5, y=0.92) agar berpijak tepat di tengah tile diamond
    this.animatedSprite.anchor.set(0.5, 0.92);
    this.animatedSprite.animationSpeed = 0.12;
    this.animatedSprite.play();
    this.spriteWrapper.addChild(this.animatedSprite);

    // 2. Badge task nyata di atas kepala (hanya muncul saat work = working)
    this.badgeContainer = new Container();
    this.badgeContainer.label = `TaskBadge_${this.id}`;
    this.badgeContainer.y = -50;
    this.badgeContainer.visible = false;

    this.badgeGfx = new Graphics();
    this.drawTaskBadge();
    this.badgeContainer.addChild(this.badgeGfx);
    this.addChild(this.badgeContainer);

    // 3. Khusus Rifqi: Mahkota emas kecil melayang (Floating Golden Crown)
    if (this.id === 'rifqi') {
      this.initRifqiCrown();
    }

    // 4. Name Tag label mengambang di atas karakter
    this.nameTagContainer = new Container();
    this.nameTagContainer.label = `NameTag_${this.id}`;
    this.nameTagContainer.y = -62;
    this.nameTagContainer.visible = config.showNameTag ?? false;

    this.nameTagGfx = new Graphics();
    this.nameText = new Text({
      text: this.characterName,
      style: {
        fontFamily: 'Inter, system-ui, sans-serif',
        fontSize: 10,
        fontWeight: 'bold',
        fill: 0xf5f0e1,
      },
    });
    this.nameText.anchor.set(0.5, 0.5);
    this.drawNameTagBackground();

    this.nameTagContainer.addChild(this.nameTagGfx);
    this.nameTagContainer.addChild(this.nameText);
    this.addChild(this.nameTagContainer);

    // 5. Setup interaktivitas Pixi (eventMode static & hitArea)
    this.eventMode = 'static';
    this.cursor = 'pointer';
    this.hitArea = new Rectangle(-22, -60, 44, 62);

    this.setupInteractivity();

    // Set posisi awal dan arah hadap
    this.setFacing(this.facing);
    this.updateScreenPosition();
  }

  /**
   * Menyiapkan interaktivitas pointer klik dan hover untuk karakter.
   */
  private setupInteractivity(): void {
    // Klik karakter -> event ke HUD (membuka inspector)
    this.on('pointertap', (e) => {
      e.stopPropagation?.();
      this.handleClick();
    });

    this.on('pointerdown', (e) => {
      e.stopPropagation?.();
      this.handleClick();
    });

    // Hover karakter -> tampilkan name tag dan emit hover state
    this.on('pointerenter', () => {
      this.handleHover(true);
    });

    this.on('pointerover', () => {
      this.handleHover(true);
    });

    this.on('pointerleave', () => {
      this.handleHover(false);
    });

    this.on('pointerout', () => {
      this.handleHover(false);
    });
  }

  /**
   * Penanganan klik pada karakter: membuka inspector di HUD melalui store.
   */
  public handleClick(): void {
    officeStore.getState().selectAgent(this.id);
    this.onClickCallback?.(this);
  }

  /**
   * Penanganan hover mouse pada karakter.
   */
  public handleHover(hovered: boolean): void {
    this.isHovered = hovered;
    this.nameTagContainer.visible = hovered || this.isSelected;

    if (hovered) {
      officeStore.getState().hoverAgent(this.id);
    } else if (officeStore.getState().hoveredAgentId === this.id) {
      officeStore.getState().hoverAgent(null);
    }

    this.onHoverCallback?.(this, hovered);
  }

  public setSelected(selected: boolean): void {
    this.isSelected = selected;
    this.nameTagContainer.visible = selected || this.isHovered;
  }

  /**
   * Menggambar badge task nyata di atas kepala:
   * Badge pill kecil dengan aksen amber/emas berdenyut.
   */
  private drawTaskBadge(): void {
    this.badgeGfx.clear();

    // Background pill gelap dengan border amber bercahaya
    this.badgeGfx.roundRect(-10, -5, 20, 10, 5);
    this.badgeGfx.fill({ color: 0x1a1c29, alpha: 0.95 });
    this.badgeGfx.stroke({ width: 1.5, color: 0xf59e0b, alpha: 0.9 });

    // Titik pusat berdenyut
    this.badgeGfx.circle(0, 0, 2.5);
    this.badgeGfx.fill({ color: 0xfbbf24, alpha: 1.0 });
  }

  /**
   * Inisialisasi mahkota emas melayang khusus persona Rifqi.
   */
  private initRifqiCrown(): void {
    this.crownContainer = new Container();
    this.crownContainer.label = 'RifqiGoldenCrown';
    this.crownContainer.y = -52;

    this.crownGfx = new Graphics();
    // Gambar mahkota emas 3 puncak
    this.crownGfx.poly([
      -7, 2,   // Kiri bawah
      -7, -4,  // Puncak kiri
      -3, -1,  // Lembah kiri
      0, -6,   // Puncak tengah tinggi
      3, -1,   // Lembah kanan
      7, -4,   // Puncak kanan
      7, 2,    // Kanan bawah
    ]);
    this.crownGfx.fill({ color: 0xffd700 }); // Emas terang
    this.crownGfx.stroke({ width: 1, color: 0xb45309 }); // Bayangan emas tua

    // Permata ruby di puncak tengah
    this.crownGfx.circle(0, -6, 1.2);
    this.crownGfx.fill({ color: 0xef4444 });

    this.crownContainer.addChild(this.crownGfx);
    this.addChild(this.crownContainer);
  }

  /**
   * Menggambar latar belakang Name Tag.
   */
  private drawNameTagBackground(): void {
    this.nameTagGfx.clear();
    const measuredWidth = typeof document !== 'undefined' ? this.nameText.width : this.characterName.length * 7;
    const textWidth = Math.max(36, (measuredWidth || 30) + 12);
    const halfW = textWidth / 2;

    // Pill latar belakang
    this.nameTagGfx.roundRect(-halfW, -7, textWidth, 14, 4);
    this.nameTagGfx.fill({ color: 0x14141e, alpha: 0.88 });
    this.nameTagGfx.stroke({ width: 1, color: 0x282d3f, alpha: 0.85 });

    // Titik signature color di sisi kiri nama
    const sigColorNum = parseInt(this.signatureColor.replace('#', ''), 16) || 0x2bb3c0;
    this.nameTagGfx.circle(-halfW + 5, 0, 2);
    this.nameTagGfx.fill({ color: sigColorNum });
  }

  /**
   * Menampilkan stempel merah FAIL untuk Sentinel (T2.2 / F20).
   * @param duration Durasi tampilan dalam detik (default: 5.0).
   */
  public showFailStamp(duration = 5.0): void {
    this.isShowingFailStamp = true;
    this.failStampRemaining = duration;

    if (!this.stampContainer) {
      this.stampContainer = new Container();
      this.stampContainer.label = `FailStamp_${this.id}`;
      this.stampContainer.y = -52;
      this.stampContainer.rotation = -0.15; // Kemiringan stempel karet ~8.5°

      this.stampGfx = new Graphics();
      this.stampGfx.roundRect(-20, -10, 40, 20, 3);
      this.stampGfx.fill({ color: 0x991b1b, alpha: 0.92 }); // Crimson red
      this.stampGfx.stroke({ width: 2, color: 0xef4444, alpha: 1.0 });

      this.stampText = new Text({
        text: 'FAIL',
        style: {
          fontFamily: 'Impact, Inter, system-ui, sans-serif',
          fontSize: 12,
          fontWeight: '900',
          fill: 0xffffff,
          letterSpacing: 2,
        },
      });
      this.stampText.anchor.set(0.5, 0.5);

      this.stampContainer.addChild(this.stampGfx);
      this.stampContainer.addChild(this.stampText);
      this.addChild(this.stampContainer);
    }

    this.stampContainer.visible = true;
  }

  /**
   * Mengatur status membawa paket rilis untuk Relay (T2.2 / F20).
   * @param carrying Menandai apakah agen sedang memegang paket.
   */
  public setCarryingParcel(carrying: boolean): void {
    this.isCarryingParcel = carrying;

    if (carrying) {
      if (!this.parcelContainer) {
        this.parcelContainer = new Container();
        this.parcelContainer.label = `Parcel_${this.id}`;
        this.parcelContainer.x = 8;
        this.parcelContainer.y = -14;

        const parcelGfx = new Graphics();
        // Boks paket kardus
        parcelGfx.roundRect(-8, -7, 16, 14, 2);
        parcelGfx.fill({ color: 0xd97706, alpha: 1.0 }); // Warna kraft cokelat
        parcelGfx.stroke({ width: 1, color: 0x92400e, alpha: 0.95 });

        // Lakban segel paket
        parcelGfx.rect(-8, -1.5, 16, 3);
        parcelGfx.fill({ color: 0x78350f, alpha: 0.85 });

        // Label pengiriman putih
        parcelGfx.rect(-5, -5, 5, 4);
        parcelGfx.fill({ color: 0xffffff, alpha: 0.95 });

        this.parcelContainer.addChild(parcelGfx);
        this.addChild(this.parcelContainer);
      }
      this.parcelContainer.visible = true;
    } else {
      if (this.parcelContainer) {
        this.parcelContainer.visible = false;
      }
    }
  }

  /**
   * Mengatur efek visual berkeringat saat beban kerja/CPU tinggi (T2.4 / F23).
   * Menampilkan butiran keringat prosedural di samping pelipis/kepala karakter.
   */
  public setSweating(sweating: boolean): void {
    this.isSweating = sweating;

    if (sweating) {
      if (!this.sweatContainer) {
        this.sweatContainer = new Container();
        this.sweatContainer.label = `Sweat_${this.id}`;
        this.sweatContainer.x = 10;
        this.sweatContainer.y = -42; // Di dekat pelipis kepala karakter

        this.sweatGfx = new Graphics();
        this.sweatContainer.addChild(this.sweatGfx);
        this.addChild(this.sweatContainer);
      }
      this.sweatContainer.visible = true;
    } else {
      if (this.sweatContainer) {
        this.sweatContainer.visible = false;
      }
    }
  }

  /**
   * Animasi prosedural butir keringat menetes dan berdenyut halus.
   */
  private updateSweatAnimation(dt: number): void {
    if (!this.sweatGfx) return;

    this.sweatAnimTime += dt * 3.5;
    const cycle = this.sweatAnimTime % 1; // 0..1
    const dropY = cycle * 6;
    const alpha = Math.sin(cycle * Math.PI);

    this.sweatGfx.clear();

    // Butir keringat utama (cyan berkilau)
    this.sweatGfx.poly([
      0, -3 + dropY,
      2.5, 0 + dropY,
      0, 3.5 + dropY,
      -2.5, 0 + dropY,
    ]);
    this.sweatGfx.fill({ color: 0x38bdf8, alpha: Math.max(0.2, alpha * 0.95) });
    this.sweatGfx.stroke({ width: 1, color: 0x0284c7, alpha });

    // Butir keringat sekunder kecil
    const cycle2 = (this.sweatAnimTime + 0.45) % 1;
    const dropY2 = cycle2 * 4.5;
    const alpha2 = Math.sin(cycle2 * Math.PI);
    this.sweatGfx.poly([
      -5, -7 + dropY2,
      -3.5, -5 + dropY2,
      -5, -3 + dropY2,
      -6.5, -5 + dropY2,
    ]);
    this.sweatGfx.fill({ color: 0x38bdf8, alpha: Math.max(0.15, alpha2 * 0.85) });
  }

  /**
   * Menetapkan tekstur karakter dari atlas yang dimuat secara eksternal.
   */
  public setTextures(textures: CharacterTextures): void {
    this.textures = textures;
    this.applyCurrentAnimationTextures();
  }

  /**
   * Menentukan arah hadap karakter (SE, SW, NE, NW)
   * Menggunakan prinsip mirror:
   * - SE: tekstur se, scale.x = 1
   * - SW: tekstur se, scale.x = -1 (mirror horizontal)
   * - NE: tekstur ne, scale.x = 1
   * - NW: tekstur ne, scale.x = -1 (mirror horizontal)
   */
  public setFacing(facing: FacingDirection): void {
    this.facing = facing;

    // Mirror horizontal pada spriteWrapper jika arah barat (SW / NW)
    if (facing === 'SW' || facing === 'NW') {
      this.spriteWrapper.scale.x = -1;
    } else {
      this.spriteWrapper.scale.x = 1;
    }

    this.applyCurrentAnimationTextures();
  }

  /**
   * Memainkan animasi tertentu (idle, walk, sit_type, stand_talk, celebrate, pray, drink).
   */
  public playAnimation(animName: string, loop = true): void {
    this.currentAnimation = animName;
    this.animatedSprite.loop = loop;

    // Kecepatan frame disesuaikan dengan jenis animasi
    if (animName === 'walk') {
      this.animatedSprite.animationSpeed = 0.14; // ~8.4 frame/dtk pada 60fps ticker
    } else if (animName === 'swim') {
      this.animatedSprite.animationSpeed = 0.08;
    } else if (animName === 'game') {
      this.animatedSprite.animationSpeed = 0.12;
    } else if (animName === 'whiteboard') {
      this.animatedSprite.animationSpeed = 0.09;
    } else if (animName === 'special') {
      this.animatedSprite.animationSpeed = 0.10;
    } else if (animName === 'sit_type') {
      this.animatedSprite.animationSpeed = 0.10;
    } else if (animName === 'idle') {
      this.animatedSprite.animationSpeed = 0.08;
    } else {
      this.animatedSprite.animationSpeed = 0.10;
    }

    this.applyCurrentAnimationTextures();
    this.animatedSprite.play();
  }

  private applyCurrentAnimationTextures(): void {
    const textures = this.resolveTextures(this.currentAnimation, this.facing);
    if (textures.length > 0) {
      this.animatedSprite.textures = textures;
      if (!this.animatedSprite.playing) {
        this.animatedSprite.play();
      }
    }
  }

  /**
   * Resolusi tekstur frame berdasarkan nama animasi dan arah hadap.
   */
  private resolveTextures(anim: string, facing: FacingDirection): Texture[] {
    const dirKey: 'se' | 'ne' = (facing === 'SE' || facing === 'SW') ? 'se' : 'ne';

    // Coba temukan di textures provider
    if (this.textures[anim] && this.textures[anim][dirKey]?.length > 0) {
      return this.textures[anim][dirKey];
    }

    // Fallback ke idle jika animasi spesifik belum tersedia
    if (this.textures.idle && this.textures.idle[dirKey]?.length > 0) {
      return this.textures.idle[dirKey];
    }

    return [Texture.WHITE];
  }

  /**
   * Pembuatan tekstur fallback jika spritesheet belum dimuat (misal pada unit test).
   */
  private createFallbackTextures(): CharacterTextures {
    const fallback: CharacterTextures = {};
    const anims = [
      'idle',
      'walk',
      'sit_type',
      'stand_talk',
      'celebrate',
      'pray',
      'pray_berdiri',
      'pray_rukuk',
      'pray_sujud',
      'pray_duduk',
      'drink',
      'swim',
      'game',
      'whiteboard',
      'special',
    ];

    for (const a of anims) {
      fallback[a] = {
        se: [Texture.WHITE],
        ne: [Texture.WHITE],
      };
    }

    return fallback;
  }

  /**
   * Sinkronisasi status kerja dan task dari data telemetri nyata.
   */
  public setWorkStatus(status: AgentWork, task?: TaskRef | null): void {
    if (status !== this.workStatus || task?.id !== this.currentTask?.id) {
      this.workGestureTime = 0;
    }
    this.workStatus = status;
    this.currentTask = task ?? null;

    // Badge task nyata hanya muncul saat work = working
    this.badgeContainer.visible = status === 'working' && this.currentTask !== null;
    this.updateWorkGesture(0);
  }

  /** Gerak khas hanya saat task nyata aktif di meja sendiri; bukan bukti tool call. */
  private updateWorkGesture(dt: number): void {
    if (this.isShowingFailStamp || this.isCommenting || this.isInspecting || this.isCarryingParcel) {
      return;
    }
    const ownStation = this.currentSlot?.type === `desk:${this.id}` ||
      (this.id === 'merlin' && this.currentSlot?.id === 'slot_z04_whiteboard');
    if (this.fsmState !== 'act' || !ownStation || !this.currentSlot) return;
    if (this.workStatus === 'working' && this.currentTask) {
      this.workGestureTime += dt;
      // Pertahankan animasi mengetik, diselingi gerak khas selama dua detik.
      const animation = this.workGestureTime % 8 < 2 ? 'special' : this.currentSlot.anim;
      if (this.currentAnimation !== animation) this.playAnimation(animation);
    } else if (['stale', 'blocked', 'failed', 'off_duty', 'working'].includes(this.workStatus) || this.currentAnimation === 'special') {
      const animation = this.workStatus === 'idle' ? this.currentSlot.anim : 'idle';
      if (this.currentAnimation !== animation) this.playAnimation(animation);
    }
  }

  /**
   * Mengatur posisi grid (gx, gy) dan memperbarui koordinat pixel dunia serta zIndex.
   */
  public setGridPosition(gx: number, gy: number): void {
    this.gx = gx;
    this.gy = gy;
    this.updateScreenPosition();
  }

  public updateScreenPosition(): void {
    const pos = gridToScreen(this.gx, this.gy, this.originX, this.originY);
    this.x = pos.x;
    this.y = pos.y;
    // zIndex dihitung dari titik kaki entitas
    this.zIndex = calculateZIndex(this.gx, this.gy, LAYER_OFFSETS.CHARACTER);
    // Terapkan y_offset dari slot (saat duduk) ke sprite wrapper
    this.spriteWrapper.y = this.slotYOffset;
  }

  // ==========================================
  // FINITE STATE MACHINE (FSM) LOCOMOTION
  // ==========================================

  /**
   * Memulai transisi FSM ke status 'walk' dengan jalur koordinat grid (A* path).
   */
  public walk(path: GridPoint[], targetSlot?: InteractionSlot): void {
    this.targetSlot = targetSlot;

    if (!path || path.length === 0) {
      if (targetSlot) {
        this.arrive();
      } else {
        this.idle();
      }
      return;
    }

    const prevFsm = this.fsmState;
    this.fsmState = 'walk';
    this.currentPath = [...path];

    // Reset slotYOffset saat mulai berjalan
    this.slotYOffset = 0;
    this.spriteWrapper.y = 0;

    // Jika waypoint pertama adalah posisi saat ini, langsung tuju waypoint kedua
    if (
      this.currentPath.length > 1 &&
      Math.abs(this.currentPath[0].gx - this.gx) < 0.05 &&
      Math.abs(this.currentPath[0].gy - this.gy) < 0.05
    ) {
      this.currentPathIndex = 1;
    } else {
      this.currentPathIndex = 0;
    }

    // Tentukan arah hadap awal ke waypoint berikutnya
    const target = this.currentPath[this.currentPathIndex];
    if (target) {
      const dx = target.gx - this.gx;
      const dy = target.gy - this.gy;
      if (Math.abs(dx) > 0.01 || Math.abs(dy) > 0.01) {
        this.setFacing(vectorToFacing(dx, dy));
      }
    }

    this.playAnimation('walk');
    this.onStateChange?.(prevFsm, 'walk');
  }

  /**
   * Transisi FSM ke status 'arrive': dipanggil saat agent tiba di titik akhir jalur.
   */
  public arrive(): void {
    const prevFsm = this.fsmState;
    this.fsmState = 'arrive';
    this.currentPath = [];
    this.currentPathIndex = 0;

    this.onStateChange?.(prevFsm, 'arrive');

    // Jika ada target slot yang dituju, otomatis masuk ke mode 'act'
    if (this.targetSlot) {
      const slot = this.targetSlot;
      this.targetSlot = undefined;
      this.onArrive?.(slot);
      this.act(slot);
    } else {
      this.idle();
      this.onArrive?.();
    }
  }

  /**
   * Transisi FSM ke status 'act': menjalankan animasi slot (misal: sit_type di meja kerja).
   * Menerapkan y_offset dari slot agar agent tidak tenggelam di balik meja saat duduk.
   */
  public act(slot: InteractionSlot): void {
    const prevFsm = this.fsmState;
    this.fsmState = 'act';
    this.currentSlot = slot;

    // Terapkan properti slot
    this.slotYOffset = slot.y_offset ?? 0;
    this.spriteWrapper.y = this.slotYOffset;

    if (slot.facing) {
      const f = slot.facing.toUpperCase();
      if (f === 'SE' || f === 'SW' || f === 'NE' || f === 'NW') {
        this.setFacing(f as FacingDirection);
      }
    }

    const animToPlay = slot.anim || 'sit_type';
    this.playAnimation(animToPlay);
    this.workGestureTime = 0;
    this.updateWorkGesture(0);

    this.onStateChange?.(prevFsm, 'act');
    this.onAct?.(slot);
  }

  /**
   * Transisi FSM ke status 'leave': agent berdiri dan meninggalkan slot.
   */
  public leave(): void {
    const prevFsm = this.fsmState;
    this.fsmState = 'leave';

    const leavingSlot = this.currentSlot;
    this.currentSlot = null;
    this.slotYOffset = 0;
    this.spriteWrapper.y = 0;

    this.onStateChange?.(prevFsm, 'leave');
    this.onLeave?.(leavingSlot ?? undefined);

    this.idle();
  }

  /**
   * Transisi FSM ke status 'idle': agent berdiri siaga di posisinya.
   */
  public idle(): void {
    const prevFsm = this.fsmState;
    this.fsmState = 'idle';
    this.playAnimation('idle');
    this.onStateChange?.(prevFsm, 'idle');
  }

  public getCurrentSlot(): InteractionSlot | null {
    return this.currentSlot;
  }

  /**
   * Perbaruan per frame (dipanggil dari ticker render loop).
   * @param dt Delta waktu dalam detik (misal: 1/60 = ~0.01667)
   */
  public update(dt: number): void {
    this.updateWorkGesture(dt);
    // 1. Update pulse badge task nyata jika sedang bekerja
    if (this.workStatus === 'working' && this.badgeContainer.visible) {
      this.pulseTime += dt;
      const pulse = 1.0 + 0.14 * Math.sin(this.pulseTime * 6);
      this.badgeGfx.scale.set(pulse, pulse);
    }

    // 2. Update float mahkota Rifqi
    if (this.crownContainer && this.crownGfx) {
      this.crownTime += dt;
      this.crownContainer.y = -52 + Math.sin(this.crownTime * 3) * 2.5;
    }

    // 3. Update stempel merah FAIL (Sentinel T2.2 / F20)
    if (this.isShowingFailStamp) {
      this.failStampRemaining -= dt;
      if (this.failStampRemaining <= 0) {
        this.isShowingFailStamp = false;
        if (this.stampContainer) {
          this.stampContainer.visible = false;
        }
      }
    }

    // 3b. Update efek berkeringat (T2.4 / F23: Vitals CPU alert)
    if (this.isSweating) {
      this.updateSweatAnimation(dt);
    }

    // 4. Update FSM gerak jika dalam status 'walk'
    if (this.fsmState === 'walk' && this.currentPath.length > 0) {
      this.updateMovement(dt);
    }
  }

  /**
   * Pembaruan pergerakan kinematis di sepanjang jalur waypoint dengan kecepatan konstan 2.5 tile/dtk.
   */
  private updateMovement(dt: number): void {
    let remainingDist = this.speed * dt;

    while (remainingDist > 0 && this.currentPathIndex < this.currentPath.length) {
      const target = this.currentPath[this.currentPathIndex];
      const dx = target.gx - this.gx;
      const dy = target.gy - this.gy;
      const dist = Math.hypot(dx, dy);

      if (dist < 0.0001) {
        // Tiba di waypoint saat ini, lanjutkan ke waypoint berikutnya
        this.gx = target.gx;
        this.gy = target.gy;
        this.currentPathIndex++;

        if (this.currentPathIndex >= this.currentPath.length) {
          // Seluruh jalur selesai
          this.arrive();
          break;
        }

        // Update arah hadap ke waypoint baru
        const nextTarget = this.currentPath[this.currentPathIndex];
        const nextDx = nextTarget.gx - this.gx;
        const nextDy = nextTarget.gy - this.gy;
        this.setFacing(vectorToFacing(nextDx, nextDy));
        continue;
      }

      if (remainingDist >= dist) {
        // Agent mampu menjangkau waypoint ini dalam sisa waktu frame
        this.gx = target.gx;
        this.gy = target.gy;
        remainingDist -= dist;
        this.currentPathIndex++;

        if (this.currentPathIndex >= this.currentPath.length) {
          this.arrive();
          break;
        }

        const nextTarget = this.currentPath[this.currentPathIndex];
        const nextDx = nextTarget.gx - this.gx;
        const nextDy = nextTarget.gy - this.gy;
        this.setFacing(vectorToFacing(nextDx, nextDy));
      } else {
        // Bergerak sebagian ke arah waypoint
        const ratio = remainingDist / dist;
        this.gx += dx * ratio;
        this.gy += dy * ratio;
        this.setFacing(vectorToFacing(dx, dy));
        remainingDist = 0;
      }
    }

    // Sinkronkan posisi layar dan depth sort zIndex
    this.updateScreenPosition();
  }
}
