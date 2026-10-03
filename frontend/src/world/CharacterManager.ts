import { Assets, Container, Spritesheet } from 'pixi.js';
import { Character, CharacterTextures } from './Character';
import { LoadedOfficeMap } from './mapLoader';
import { FacingDirection, GridPoint } from '../navigation/types';
import type { InteractionSlot } from './types';
import { officeStore } from '../store/officeStore';

export interface AgentSpawnDef {
  id: string;
  name: string;
  role: string;
  signatureColor: string;
  defaultSlotId: string;
  fallbackGx: number;
  fallbackGy: number;
  fallbackFacing: FacingDirection;
}

/**
 * Konfigurasi 16 Agen Spesialis + 1 Tamu Generik + 1 Founder
 * Sesuai blueprint spec 03 dan pemetaan slot peta floor1.tmj.
 */
export const AGENT_SPAWN_DEFS: AgentSpawnDef[] = [
  {
    id: 'jarvis',
    name: 'Jarvis',
    role: 'Principal Orchestrator',
    signatureColor: '#1F3A68',
    defaultSlotId: 'slot_z01_desk_jarvis',
    fallbackGx: 4,
    fallbackGy: 3,
    fallbackFacing: 'SE',
  },
  {
    id: 'daedalus',
    name: 'Daedalus',
    role: 'System Architect',
    signatureColor: '#2F6FB3',
    defaultSlotId: 'slot_z03_desk_daedalus',
    fallbackGx: 23,
    fallbackGy: 3,
    fallbackFacing: 'SE',
  },
  {
    id: 'merlin',
    name: 'Merlin',
    role: 'Knowledge Mentor',
    signatureColor: '#B5652B',
    defaultSlotId: 'slot_z04_whiteboard',
    fallbackGx: 31,
    fallbackGy: 2,
    fallbackFacing: 'SW',
  },
  {
    id: 'scribe',
    name: 'Scribe',
    role: 'Documentation & Librarian',
    signatureColor: '#7A4A2E',
    defaultSlotId: 'slot_z05_desk_scribe',
    fallbackGx: 36,
    fallbackGy: 4,
    fallbackFacing: 'SE',
  },
  {
    id: 'oracle',
    name: 'Oracle',
    role: 'Research Scientist',
    signatureColor: '#8A4FBF',
    defaultSlotId: 'slot_z06_desk_oracle',
    fallbackGx: 6,
    fallbackGy: 13,
    fallbackFacing: 'SE',
  },
  {
    id: 'muse',
    name: 'Muse',
    role: 'Design Lead',
    signatureColor: '#E0567A',
    defaultSlotId: 'slot_z07_desk_muse',
    fallbackGx: 10,
    fallbackGy: 13,
    fallbackFacing: 'SE',
  },
  {
    id: 'prism',
    name: 'Prism',
    role: 'Frontend Specialist',
    signatureColor: '#2BB3C0',
    defaultSlotId: 'slot_z08_desk_prism',
    fallbackGx: 17,
    fallbackGy: 12,
    fallbackFacing: 'SE',
  },
  {
    id: 'forge',
    name: 'Forge',
    role: 'Backend Specialist',
    signatureColor: '#D9622B',
    defaultSlotId: 'slot_z08_desk_forge',
    fallbackGx: 17,
    fallbackGy: 14,
    fallbackFacing: 'SE',
  },
  {
    id: 'nova',
    name: 'Nova',
    role: 'Ops & Automation',
    signatureColor: '#F2C230',
    defaultSlotId: 'slot_z08_desk_nova',
    fallbackGx: 17,
    fallbackGy: 16,
    fallbackFacing: 'SE',
  },
  {
    id: 'steward',
    name: 'Steward',
    role: 'Graphics & Engine Lead',
    signatureColor: '#9CC23A',
    defaultSlotId: 'slot_z09_desk_steward',
    fallbackGx: 25,
    fallbackGy: 12,
    fallbackFacing: 'SE',
  },
  {
    id: 'sentinel',
    name: 'Sentinel',
    role: 'QA Lead & Auditor',
    signatureColor: '#D23C3C',
    defaultSlotId: 'slot_z10_desk_sentinel',
    fallbackGx: 29,
    fallbackGy: 12,
    fallbackFacing: 'SE',
  },
  {
    id: 'relay',
    name: 'Relay',
    role: 'Release Officer',
    signatureColor: '#6D5BD0',
    defaultSlotId: 'slot_z11_desk_relay',
    fallbackGx: 33,
    fallbackGy: 12,
    fallbackFacing: 'SE',
  },
  {
    id: 'vector',
    name: 'Vector',
    role: 'Data Engineer',
    signatureColor: '#3FA66B',
    defaultSlotId: 'slot_z12_desk_vector',
    fallbackGx: 37,
    fallbackGy: 13,
    fallbackFacing: 'SE',
  },
  {
    id: 'bastion',
    name: 'Bastion',
    role: 'Security & SOC Officer',
    signatureColor: '#6B7785',
    defaultSlotId: 'slot_z12_desk_bastion',
    fallbackGx: 41,
    fallbackGy: 13,
    fallbackFacing: 'SE',
  },
  {
    id: 'warden',
    name: 'Warden',
    role: 'Operations & Facilities',
    signatureColor: '#8E8E3A',
    defaultSlotId: 'slot_z13_desk_warden',
    fallbackGx: 4,
    fallbackGy: 25,
    fallbackFacing: 'SE',
  },
  {
    id: 'rifqi',
    name: 'Rifqi',
    role: 'Founder & Visionary',
    signatureColor: '#F5F0E1',
    defaultSlotId: 'slot_z14_lounge_1',
    fallbackGx: 14,
    fallbackGy: 28,
    fallbackFacing: 'SE',
  },
  {
    id: 'guest',
    name: 'Tamu',
    role: 'Pengunjung Kantor',
    signatureColor: '#9CA8B8',
    defaultSlotId: 'slot_z08_desk_guest',
    fallbackGx: 17,
    fallbackGy: 18,
    fallbackFacing: 'SE',
  },
];

/**
 * CharacterManager mengelola seluruh instans entitas karakter kantor,
 * pemuatan tekstur atlas, pembaruan FSM, dan sinkronisasi ke store/HUD.
 */
export class CharacterManager {
  private loadedMap: LoadedOfficeMap | null = null;
  private characters = new Map<string, Character>();
  private entitiesContainer: Container | null = null;
  private isLoaded = false;

  constructor(loadedMap?: LoadedOfficeMap) {
    if (loadedMap) {
      this.attachToMap(loadedMap);
    }
  }

  /**
   * Menghubungkan manager ke peta kantor yang telah dimuat.
   */
  public attachToMap(loadedMap: LoadedOfficeMap): void {
    this.loadedMap = loadedMap;
    this.entitiesContainer = loadedMap.containers.entities;
  }

  /**
   * Menginisialisasi dan menempatkan seluruh 16 karakter (+ Rifqi & Guest)
   * di meja/posisi asal masing-masing.
   */
  public spawnAllAgents(): void {
    const slotsMap = new Map<string, InteractionSlot>();
    if (this.loadedMap) {
      for (const slot of this.loadedMap.slots) {
        slotsMap.set(slot.id, slot);
      }
    }

    for (const def of AGENT_SPAWN_DEFS) {
      if (this.characters.has(def.id)) continue;

      const slot = slotsMap.get(def.defaultSlotId);
      const gx = slot ? slot.gx : def.fallbackGx;
      const gy = slot ? slot.gy : def.fallbackGy;
      let facing = def.fallbackFacing;
      if (slot?.facing) {
        const f = slot.facing.toUpperCase();
        if (f === 'SE' || f === 'SW' || f === 'NE' || f === 'NW') {
          facing = f as FacingDirection;
        }
      }

      const char = new Character({
        id: def.id,
        name: def.name,
        role: def.role,
        signatureColor: def.signatureColor,
        initialGx: gx,
        initialGy: gy,
        initialFacing: facing,
      });

      // Jika ada slot meja kerja, tempatkan langsung dalam status 'act' (duduk)
      if (slot) {
        char.act(slot);
      } else {
        char.idle();
      }

      this.addCharacter(char);
    }

    this.isLoaded = true;
  }

  public isSpawned(): boolean {
    return this.isLoaded;
  }

  /**
   * Mendaftarkan satu karakter ke dalam manager dan kontainer entitas.
   */
  public addCharacter(character: Character): void {
    this.characters.set(character.id, character);

    if (this.entitiesContainer) {
      this.entitiesContainer.addChild(character);
    }
    if (this.loadedMap?.cullingManager) {
      this.loadedMap.cullingManager.register(character);
    }
  }

  /**
   * Menghapus karakter dari manager dan kontainer rendering.
   */
  public removeCharacter(id: string): void {
    const char = this.characters.get(id);
    if (!char) return;

    if (this.entitiesContainer) {
      this.entitiesContainer.removeChild(char);
    }
    if (this.loadedMap?.cullingManager) {
      this.loadedMap.cullingManager.unregister(char);
    }
    this.characters.delete(id);
  }

  public getCharacter(id: string): Character | undefined {
    return this.characters.get(id);
  }

  public getAllCharacters(): Character[] {
    return Array.from(this.characters.values());
  }

  /**
   * Memerintahkan karakter untuk bergerak di sepanjang jalur A*.
   */
  public moveCharacter(
    id: string,
    path: GridPoint[],
    targetSlot?: InteractionSlot,
  ): boolean {
    const char = this.characters.get(id);
    if (!char) return false;

    char.walk(path, targetSlot);
    return true;
  }

  /**
   * Memuat tekstur atlas untuk karakter tertentu secara asinkron.
   */
  public async loadCharacterSpritesheet(id: string): Promise<boolean> {
    if (typeof window === 'undefined') return false;

    try {
      const sheet = (await Assets.load(
        `/sprites/characters/${id}.json`,
      )) as Spritesheet;
      if (!sheet || !sheet.textures) return false;

      const textures = this.parseCharacterTextures(id, sheet);
      const char = this.characters.get(id);
      if (char) {
        char.setTextures(textures);
      }
      return true;
    } catch (err) {
      console.warn(`[CharacterManager] Gagal memuat atlas untuk ${id}:`, err);
      return false;
    }
  }

  /**
   * Memuat seluruh atlas karakter secara paralel.
   */
  public async loadAllCharacterSpritesheets(): Promise<void> {
    const promises = AGENT_SPAWN_DEFS.map((def) =>
      this.loadCharacterSpritesheet(def.id),
    );
    await Promise.allSettled(promises);
  }

  /**
   * Mengurai textures dari Spritesheet Pixi ke struktur CharacterTextures.
   */
  private parseCharacterTextures(
    characterId: string,
    sheet: Spritesheet,
  ): CharacterTextures {
    const result: CharacterTextures = {};
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
    ];
    const dirs: Array<'se' | 'ne'> = ['se', 'ne'];

    for (const anim of anims) {
      result[anim] = { se: [], ne: [] };
      for (const dir of dirs) {
        let frameIdx = 0;
        while (true) {
          const frameName = `${characterId}_${anim}_${dir}_${frameIdx}.png`;
          const tex = sheet.textures[frameName];
          if (!tex) break;
          result[anim][dir].push(tex);
          frameIdx++;
        }
      }
    }

    return result;
  }

  /**
   * Pembaruan per frame:
   * 1. Update FSM dan gerak masing-masing karakter.
   * 2. Sinkronisasi state dari vanilla store (status kerja, task badge, seleksi).
   * 3. Sort children di entitiesContainer untuk menjaga depth sorting 100% konsisten.
   */
  public update(dt: number): void {
    const state = officeStore.getState();
    const selectedId = state.selectedAgentId;
    const storeAgents = state.agents;

    for (const char of this.characters.values()) {
      // 1. Update gerak & FSM
      char.update(dt);

      // 2. Sinkronkan dengan data store jika tersedia
      const agentData = storeAgents[char.id];
      if (agentData) {
        char.setWorkStatus(agentData.work, agentData.task);
      }

      // 3. Sinkronkan status terpilih
      char.setSelected(char.id === selectedId);
    }

    // 4. Sortir depth sorting jika kontainer mendukung sortableChildren
    if (this.entitiesContainer && this.entitiesContainer.sortableChildren) {
      this.entitiesContainer.sortChildren();
    }
  }

  public destroy(): void {
    for (const char of this.characters.values()) {
      char.destroy({ children: true });
    }
    this.characters.clear();
    this.entitiesContainer = null;
    this.loadedMap = null;
    this.isLoaded = false;
  }
}
