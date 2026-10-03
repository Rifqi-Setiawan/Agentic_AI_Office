import type {
  DoorDef,
  FacingDirection,
  GridPoint,
  InteractionSlot,
  ZoneDef,
} from './types';

export interface RawTiledProperty {
  name: string;
  type?: string;
  value: unknown;
}

export interface RawTiledObject {
  id: number;
  name: string;
  type?: string;
  x?: number;
  y?: number;
  properties?: RawTiledProperty[];
}

export interface RawTiledLayer {
  name: string;
  type: string;
  data?: number[];
  objects?: RawTiledObject[];
}

export interface RawTiledMap {
  width: number;
  height: number;
  layers: RawTiledLayer[];
}

export interface GridMapConfig {
  width: number;
  height: number;
  collision: Uint8Array | number[];
  slots?: InteractionSlot[];
  doors?: DoorDef[];
  zones?: ZoneDef[];
}

export class GridMap {
  readonly width: number;
  readonly height: number;
  readonly collision: Uint8Array;
  readonly slots: InteractionSlot[] = [];
  readonly doors: DoorDef[] = [];
  readonly zones: ZoneDef[] = [];

  private readonly slotsById = new Map<string, InteractionSlot>();
  private readonly slotsByZone = new Map<string, InteractionSlot[]>();
  private readonly slotsByType = new Map<string, InteractionSlot[]>();
  private readonly doorsByName = new Map<string, DoorDef>();

  constructor(source: RawTiledMap | GridMapConfig) {
    if ('layers' in source) {
      this.width = source.width;
      this.height = source.height;

      const totalTiles = this.width * this.height;
      this.collision = new Uint8Array(totalTiles);

      this.parseTiledLayers(source);
    } else {
      this.width = source.width;
      this.height = source.height;
      const totalTiles = this.width * this.height;

      if (source.collision instanceof Uint8Array) {
        this.collision = new Uint8Array(source.collision);
      } else {
        this.collision = new Uint8Array(totalTiles);
        for (let i = 0; i < Math.min(totalTiles, source.collision.length); i++) {
          this.collision[i] = source.collision[i] !== 0 ? 1 : 0;
        }
      }

      if (source.slots) {
        for (const slot of source.slots) {
          this.registerSlot(slot);
        }
      }
      if (source.doors) {
        for (const door of source.doors) {
          this.doors.push(door);
          this.doorsByName.set(door.name, door);
        }
      }
      if (source.zones) {
        this.zones.push(...source.zones);
      }
    }
  }

  private parseTiledLayers(map: RawTiledMap): void {
    for (const layer of map.layers) {
      if (layer.name === 'collision' && layer.data) {
        for (let i = 0; i < layer.data.length; i++) {
          this.collision[i] = layer.data[i] !== 0 ? 1 : 0;
        }
      } else if (layer.name === 'slots' && layer.objects) {
        for (const obj of layer.objects) {
          const props = this.extractProps(obj.properties);
          const slot: InteractionSlot = {
            id: obj.name,
            name: obj.name,
            zone: String(props.zone ?? ''),
            type: String(props.type ?? obj.type ?? ''),
            capacity: Number(props.capacity ?? 1),
            gx: Number(props.gx ?? 0),
            gy: Number(props.gy ?? 0),
            facing: (props.facing as FacingDirection) ?? 'SE',
            anim: String(props.anim ?? 'idle'),
            y_offset: Number(props.y_offset ?? 0),
          };
          this.registerSlot(slot);
        }
      } else if (layer.name === 'doors' && layer.objects) {
        for (const obj of layer.objects) {
          const props = this.extractProps(obj.properties);
          const door: DoorDef = {
            id: obj.id,
            name: obj.name,
            from: String(props.from ?? ''),
            to: String(props.to ?? ''),
            gx: Number(props.gx ?? 0),
            gy: Number(props.gy ?? 0),
          };
          this.doors.push(door);
          this.doorsByName.set(door.name, door);
        }
      } else if (layer.name === 'zones' && layer.objects) {
        for (const obj of layer.objects) {
          const props = this.extractProps(obj.properties);
          const zoneId = String(props.zone_id ?? obj.name.slice(0, 3));
          const zone: ZoneDef = {
            id: zoneId,
            name: String(props.name ?? obj.name),
            resident: String(props.resident ?? ''),
            gx_min: Number(props.gx_min ?? 0),
            gx_max: Number(props.gx_max ?? 0),
            gy_min: Number(props.gy_min ?? 0),
            gy_max: Number(props.gy_max ?? 0),
          };
          this.zones.push(zone);
        }
      }
    }
  }

  private extractProps(properties?: RawTiledProperty[]): Record<string, unknown> {
    if (!properties || !Array.isArray(properties)) return {};
    const res: Record<string, unknown> = {};
    for (const p of properties) {
      res[p.name] = p.value;
    }
    return res;
  }

  private registerSlot(slot: InteractionSlot): void {
    this.slots.push(slot);
    this.slotsById.set(slot.id, slot);

    let byZone = this.slotsByZone.get(slot.zone);
    if (!byZone) {
      byZone = [];
      this.slotsByZone.set(slot.zone, byZone);
    }
    byZone.push(slot);

    let byType = this.slotsByType.get(slot.type);
    if (!byType) {
      byType = [];
      this.slotsByType.set(slot.type, byType);
    }
    byType.push(slot);
  }

  public isWithinBounds(gx: number, gy: number): boolean {
    return gx >= 0 && gx < this.width && gy >= 0 && gy < this.height;
  }

  public isWalkable(gx: number, gy: number): boolean {
    if (!this.isWithinBounds(gx, gy)) return false;
    return this.collision[gy * this.width + gx] === 0;
  }

  public toIndex(gx: number, gy: number): number {
    return gy * this.width + gx;
  }

  public toCoords(index: number): GridPoint {
    const gx = index % this.width;
    const gy = Math.floor(index / this.width);
    return { gx, gy };
  }

  public setWalkable(gx: number, gy: number, walkable: boolean): void {
    if (!this.isWithinBounds(gx, gy)) return;
    this.collision[gy * this.width + gx] = walkable ? 0 : 1;
  }

  public getSlot(id: string): InteractionSlot | undefined {
    return this.slotsById.get(id);
  }

  public getSlotsByZone(zoneId: string): InteractionSlot[] {
    return this.slotsByZone.get(zoneId) ?? [];
  }

  public getSlotsByType(type: string): InteractionSlot[] {
    return this.slotsByType.get(type) ?? [];
  }

  public getAllSlots(): InteractionSlot[] {
    return this.slots;
  }

  public getDoor(name: string): DoorDef | undefined {
    return this.doorsByName.get(name);
  }

  public getDoors(): DoorDef[] {
    return this.doors;
  }

  public getZones(): ZoneDef[] {
    return this.zones;
  }

  public getZoneAt(gx: number, gy: number): ZoneDef | undefined {
    return this.zones.find(
      (z) => gx >= z.gx_min && gx <= z.gx_max && gy >= z.gy_min && gy <= z.gy_max
    );
  }
}
