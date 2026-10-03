import { Container } from 'pixi.js';
import type { FacingDirection } from '../navigation/types';

export interface TiledProperty {
  name: string;
  type: string;
  value: unknown;
}

export interface TiledPolygonPoint {
  x: number;
  y: number;
}

export interface TiledObject {
  id: number;
  name: string;
  type: string;
  point?: boolean;
  x: number;
  y: number;
  width: number;
  height: number;
  visible: boolean;
  properties?: TiledProperty[];
  polygon?: TiledPolygonPoint[];
}

export interface TiledLayer {
  id: number;
  name: string;
  type: 'tilelayer' | 'objectgroup';
  width?: number;
  height?: number;
  data?: number[];
  objects?: TiledObject[];
  visible: boolean;
  opacity: number;
  x?: number;
  y?: number;
}

export interface TiledTilesetTile {
  id: number;
  type?: string;
  image?: string;
  imagewidth?: number;
  imageheight?: number;
  properties?: TiledProperty[];
}

export interface TiledTileset {
  name: string;
  firstgid: number;
  tilewidth: number;
  tileheight: number;
  tilecount: number;
  image?: string;
  tiles?: TiledTilesetTile[];
}

export interface TiledMapDoc {
  width: number;
  height: number;
  tilewidth: number;
  tileheight: number;
  orientation: string;
  renderorder: string;
  layers: TiledLayer[];
  tilesets: TiledTileset[];
  properties?: TiledProperty[];
}

export interface OfficeZone {
  id: string;
  name: string;
  resident: string;
  gx_min: number;
  gx_max: number;
  gy_min: number;
  gy_max: number;
  worldCenter: { x: number; y: number };
  gridCenter: { gx: number; gy: number };
}

export interface InteractionSlot {
  id: string;
  name?: string;
  type: string;
  capacity: number;
  facing: FacingDirection | string;
  anim: string;
  y_offset: number;
  zone: string;
  gx: number;
  gy: number;
  worldPos: { x: number; y: number };
}

export interface MapLayerContainers {
  floor: Container;
  walls_back: Container;
  walls_front: Container;
  furniture: Container;
  collision: Container;
  slots: Container;
  doors: Container;
  zones: Container;
  entities: Container;
}
