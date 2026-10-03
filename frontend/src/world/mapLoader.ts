import { Container, Graphics, Sprite, Texture } from 'pixi.js';
import {
  InteractionSlot,
  MapLayerContainers,
  OfficeZone,
  TiledLayer,
  TiledMapDoc,
  TiledObject,
} from './types';
import {
  calculateZIndex,
  gridToScreen,
  LAYER_OFFSETS,
  MAP_COLS,
  MAP_ROWS,
  WORLD_ORIGIN_X,
  WORLD_ORIGIN_Y,
} from './projection';
import { isLowFurniture } from './depthSort';
import { CullingManager } from './culling';

export interface LoadedOfficeMap {
  mapDoc: TiledMapDoc;
  containers: MapLayerContainers;
  worldRoot: Container;
  zones: Map<string, OfficeZone>;
  slots: InteractionSlot[];
  cullingManager: CullingManager;
  getZone(id: string): OfficeZone | undefined;
  getLayerContainer(layerName: keyof MapLayerContainers): Container;
  addDynamicEntity(entity: Container | Sprite, gx: number, gy: number, offset?: number): void;
  updateEntityPosition(entity: Container | Sprite, gx: number, gy: number, offset?: number): void;
  removeDynamicEntity(entity: Container | Sprite): void;
}

export interface MapLoaderOptions {
  textureProvider?: (frameName: string) => Texture | null;
  originX?: number;
  originY?: number;
  enableCulling?: boolean;
}

/**
 * Tiled Map Loader untuk dunia isometrik 2:1 kantor Hermes.
 * Memetakan setiap layer Tiled ke kontainer Pixi individual sesuai spesifikasi F10.
 */
export class OfficeMapLoader {
  /**
   * Membangun representasi peta isometrik dari dokumen JSON Tiled.
   */
  public static loadFromDoc(
    mapDoc: TiledMapDoc,
    options: MapLoaderOptions = {},
  ): LoadedOfficeMap {
    const originX = options.originX ?? WORLD_ORIGIN_X;
    const originY = options.originY ?? WORLD_ORIGIN_Y;
    const cullingManager = new CullingManager(64);

    // Bangun mapping GID -> nama frame sprite
    const gidToFrameName = new Map<number, string>();
    if (mapDoc.tilesets && mapDoc.tilesets.length > 0) {
      for (const ts of mapDoc.tilesets) {
        const firstgid = ts.firstgid || 1;
        if (ts.tiles) {
          for (const tile of ts.tiles) {
            const gid = firstgid + tile.id;
            let frameName = tile.image || '';
            if (tile.properties) {
              const spriteProp = tile.properties.find((p) => p.name === 'sprite');
              if (spriteProp && typeof spriteProp.value === 'string') {
                frameName = spriteProp.value;
              }
            }
            if (frameName) {
              gidToFrameName.set(gid, frameName);
            }
          }
        }
      }
    }

    // Inisialisasi kontainer root dan kontainer per layer
    const worldRoot = new Container();
    worldRoot.label = 'WorldRoot';

    // Kontainer layer individual
    const floorContainer = new Container();
    floorContainer.label = 'Layer_Floor';
    floorContainer.zIndex = 0;

    const wallsBackContainer = new Container();
    wallsBackContainer.label = 'Layer_WallsBack';
    wallsBackContainer.zIndex = 50;

    const wallsFrontContainer = new Container();
    wallsFrontContainer.label = 'Layer_WallsFront';
    wallsFrontContainer.zIndex = 300;

    const furnitureContainer = new Container();
    furnitureContainer.label = 'Layer_Furniture';
    furnitureContainer.sortableChildren = true;
    furnitureContainer.zIndex = 150;

    // Kontainer entitas berbagi kontainer sortable dengan furniture
    // agar karakter dan furnitur standing ter-depth-sort secara terpadu
    const entitiesContainer = furnitureContainer;

    const collisionContainer = new Container();
    collisionContainer.label = 'Layer_Collision';
    collisionContainer.visible = false;
    collisionContainer.zIndex = 900;

    const slotsContainer = new Container();
    slotsContainer.label = 'Layer_Slots';
    slotsContainer.zIndex = 910;

    const doorsContainer = new Container();
    doorsContainer.label = 'Layer_Doors';
    doorsContainer.zIndex = 920;

    const zonesContainer = new Container();
    zonesContainer.label = 'Layer_Zones';
    zonesContainer.zIndex = 930;

    // Tambahkan layer ke worldRoot secara hierarkis
    worldRoot.addChild(floorContainer);
    worldRoot.addChild(wallsBackContainer);
    worldRoot.addChild(furnitureContainer);
    worldRoot.addChild(wallsFrontContainer);
    worldRoot.addChild(collisionContainer);
    worldRoot.addChild(slotsContainer);
    worldRoot.addChild(doorsContainer);
    worldRoot.addChild(zonesContainer);

    const layerContainers: MapLayerContainers = {
      floor: floorContainer,
      walls_back: wallsBackContainer,
      walls_front: wallsFrontContainer,
      furniture: furnitureContainer,
      collision: collisionContainer,
      slots: slotsContainer,
      doors: doorsContainer,
      zones: zonesContainer,
      entities: entitiesContainer,
    };

    const zonesMap = new Map<string, OfficeZone>();
    const slotsList: InteractionSlot[] = [];

    const cols = mapDoc.width || MAP_COLS;
    const rows = mapDoc.height || MAP_ROWS;

    // Helper untuk membuat sprite dari frame name
    const createSprite = (frameName: string): Sprite => {
      let texture: Texture | null = null;
      if (options.textureProvider) {
        texture = options.textureProvider(frameName);
      }
      const sprite = new Sprite(texture || Texture.WHITE);
      sprite.label = frameName;
      sprite.anchor.set(0.5, 0.5);
      return sprite;
    };

    // Proses seluruh layer Tiled
    for (const layer of mapDoc.layers) {
      if (layer.type === 'tilelayer' && layer.data) {
        this.processTileLayer(
          layer,
          cols,
          rows,
          gidToFrameName,
          createSprite,
          layerContainers,
          cullingManager,
          originX,
          originY,
        );
      } else if (layer.type === 'objectgroup' && layer.objects) {
        this.processObjectLayer(
          layer,
          layerContainers,
          zonesMap,
          slotsList,
          originX,
          originY,
        );
      }
    }

    const loadedMap: LoadedOfficeMap = {
      mapDoc,
      containers: layerContainers,
      worldRoot,
      zones: zonesMap,
      slots: slotsList,
      cullingManager,
      getZone(id: string): OfficeZone | undefined {
        return zonesMap.get(id);
      },
      getLayerContainer(layerName: keyof MapLayerContainers): Container {
        return layerContainers[layerName];
      },
      addDynamicEntity(entity: Container | Sprite, gx: number, gy: number, offset = LAYER_OFFSETS.CHARACTER): void {
        const pos = gridToScreen(gx, gy, originX, originY);
        entity.x = pos.x;
        entity.y = pos.y;
        entity.zIndex = calculateZIndex(gx, gy, offset);
        entitiesContainer.addChild(entity);
        cullingManager.register(entity);
      },
      updateEntityPosition(entity: Container | Sprite, gx: number, gy: number, offset = LAYER_OFFSETS.CHARACTER): void {
        const pos = gridToScreen(gx, gy, originX, originY);
        entity.x = pos.x;
        entity.y = pos.y;
        entity.zIndex = calculateZIndex(gx, gy, offset);
      },
      removeDynamicEntity(entity: Container | Sprite): void {
        entitiesContainer.removeChild(entity);
        cullingManager.unregister(entity);
      },
    };

    return loadedMap;
  }

  private static processTileLayer(
    layer: TiledLayer,
    cols: number,
    rows: number,
    gidToFrameName: Map<number, string>,
    createSprite: (frame: string) => Sprite,
    containers: MapLayerContainers,
    cullingManager: CullingManager,
    originX: number,
    originY: number,
  ): void {
    if (!layer.data) return;

    for (let gy = 0; gy < rows; gy++) {
      for (let gx = 0; gx < cols; gx++) {
        const idx = gy * cols + gx;
        const gid = layer.data[idx];
        if (!gid || gid === 0) continue;

        const frameName = gidToFrameName.get(gid) || `tile_gid_${gid}`;
        const pos = gridToScreen(gx, gy, originX, originY);

        if (layer.name === 'floor') {
          const sprite = createSprite(frameName);
          sprite.x = pos.x;
          sprite.y = pos.y;
          sprite.zIndex = calculateZIndex(gx, gy, LAYER_OFFSETS.FLOOR);
          containers.floor.addChild(sprite);
          cullingManager.register(sprite);
        } else if (layer.name === 'walls_back') {
          const sprite = createSprite(frameName);
          sprite.x = pos.x;
          sprite.y = pos.y;
          sprite.zIndex = calculateZIndex(gx, gy, LAYER_OFFSETS.WALL_BACK);
          containers.walls_back.addChild(sprite);
          cullingManager.register(sprite);
        } else if (layer.name === 'walls_front') {
          const sprite = createSprite(frameName);
          sprite.x = pos.x;
          sprite.y = pos.y;
          // Dinding depan di-sort bersama entitas agar karakter di balik dinding ter-occlude
          sprite.zIndex = calculateZIndex(gx, gy, LAYER_OFFSETS.WALL_FRONT);
          containers.entities.addChild(sprite);
          cullingManager.register(sprite);
        } else if (layer.name === 'furniture') {
          // Spesifikasi F10: Furnitur rendah di-bake ke layer lantai
          if (isLowFurniture(frameName)) {
            const sprite = createSprite(frameName);
            sprite.x = pos.x;
            sprite.y = pos.y;
            sprite.zIndex = calculateZIndex(gx, gy, LAYER_OFFSETS.BAKED_FURNITURE);
            containers.floor.addChild(sprite);
            cullingManager.register(sprite);
          } else {
            // Furnitur berdiri dimasukkan ke kontainer furniture/entities ber-sortable zIndex
            const sprite = createSprite(frameName);
            sprite.x = pos.x;
            sprite.y = pos.y;
            sprite.zIndex = calculateZIndex(gx, gy, LAYER_OFFSETS.FURNITURE);
            containers.furniture.addChild(sprite);
            cullingManager.register(sprite);
          }
        } else if (layer.name === 'collision') {
          // Debug collision marker
          const g = new Graphics();
          g.poly([
            pos.x, pos.y - 16,
            pos.x + 32, pos.y,
            pos.x, pos.y + 16,
            pos.x - 32, pos.y,
          ]);
          g.fill({ color: 0xff0000, alpha: 0.25 });
          containers.collision.addChild(g);
        }
      }
    }
  }

  private static processObjectLayer(
    layer: TiledLayer,
    containers: MapLayerContainers,
    zonesMap: Map<string, OfficeZone>,
    slotsList: InteractionSlot[],
    originX: number,
    originY: number,
  ): void {
    if (!layer.objects) return;

    for (const obj of layer.objects) {
      if (layer.name === 'zones') {
        const props = this.extractProps(obj);
        const zoneId = (props.zone_id as string) || obj.name.split(' ')[0] || `Z${obj.id}`;
        const name = (props.name as string) || obj.name;
        const resident = (props.resident as string) || 'Umum';
        const gx_min = Number(props.gx_min ?? 0);
        const gx_max = Number(props.gx_max ?? 0);
        const gy_min = Number(props.gy_min ?? 0);
        const gy_max = Number(props.gy_max ?? 0);

        const centerGx = (gx_min + gx_max) / 2;
        const centerGy = (gy_min + gy_max) / 2;
        const worldCenter = gridToScreen(centerGx, centerGy, originX, originY);

        const zoneInfo: OfficeZone = {
          id: zoneId,
          name,
          resident,
          gx_min,
          gx_max,
          gy_min,
          gy_max,
          worldCenter,
          gridCenter: { gx: centerGx, gy: centerGy },
        };
        zonesMap.set(zoneId, zoneInfo);

        // Debug visualisasi polygon zona
        if (obj.polygon && obj.polygon.length > 0) {
          const g = new Graphics();
          g.label = `ZonePoly_${zoneId}`;
          const points: number[] = [];
          for (const pt of obj.polygon) {
            // Tiled polygon points dalam koordinat grid pixel (TILE_HEIGHT = 32)
            const ptGx = gx_min + pt.x / 32;
            const ptGy = gy_min + pt.y / 32;
            const scr = gridToScreen(ptGx, ptGy, originX, originY);
            points.push(scr.x, scr.y);
          }
          if (points.length >= 6) {
            g.poly(points);
            g.stroke({ width: 1.5, color: 0x00f0ff, alpha: 0.35 });
            containers.zones.addChild(g);
          }
        }
      } else if (layer.name === 'slots') {
        const props = this.extractProps(obj);
        const gx = Number(props.gx ?? 0);
        const gy = Number(props.gy ?? 0);
        const worldPos = gridToScreen(gx, gy, originX, originY);

        const slotInfo: InteractionSlot = {
          id: obj.name,
          type: (props.type as string) || obj.type || 'chair',
          capacity: Number(props.capacity ?? 1),
          facing: (props.facing as string) || 'se',
          anim: (props.anim as string) || 'idle',
          y_offset: Number(props.y_offset ?? 0),
          zone: (props.zone as string) || '',
          gx,
          gy,
          worldPos,
        };
        slotsList.push(slotInfo);
      } else if (layer.name === 'doors') {
        const props = this.extractProps(obj);
        const gx = Number(props.gx ?? 0);
        const gy = Number(props.gy ?? 0);
        const worldPos = gridToScreen(gx, gy, originX, originY);

        const g = new Graphics();
        g.label = `Door_${obj.name}`;
        g.circle(worldPos.x, worldPos.y, 4);
        g.fill({ color: 0x3fa66b, alpha: 0.5 });
        containers.doors.addChild(g);
      }
    }
  }

  private static extractProps(obj: TiledObject): Record<string, unknown> {
    const res: Record<string, unknown> = {};
    if (obj.properties) {
      for (const p of obj.properties) {
        res[p.name] = p.value;
      }
    }
    return res;
  }
}
