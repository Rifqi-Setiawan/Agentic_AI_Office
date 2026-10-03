import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { Sprite, Texture } from 'pixi.js';
import { OfficeMapLoader } from './mapLoader';
import { TiledMapDoc } from './types';
import { isLowFurniture } from './depthSort';

describe('Tiled Map Loader & Layer Containers (Spec F10)', () => {
  const mapPath = path.resolve(__dirname, '../../public/maps/floor1.tmj');
  const rawMap = fs.readFileSync(mapPath, 'utf-8');
  const mapDoc = JSON.parse(rawMap) as TiledMapDoc;

  it('loads floor1.tmj into Pixi containers per layer', () => {
    const loaded = OfficeMapLoader.loadFromDoc(mapDoc);

    expect(loaded.worldRoot).toBeDefined();
    expect(loaded.containers).toBeDefined();

    // Pastikan seluruh layer Tiled memiliki kontainer Pixi individual
    const requiredLayers = [
      'floor',
      'walls_back',
      'walls_front',
      'furniture',
      'collision',
      'slots',
      'doors',
      'zones',
      'entities',
    ] as const;

    for (const name of requiredLayers) {
      const container = loaded.getLayerContainer(name);
      expect(container, `Kontainer layer ${name} harus terdefinisi`).toBeDefined();
    }

    // Layer floor harus berisi 1408 tile lantai + furnitur rendah
    expect(loaded.containers.floor.children.length).toBeGreaterThanOrEqual(1408);

    // Layer collision default-nya invisible
    expect(loaded.containers.collision.visible).toBe(false);

    // Layer entities harus memiliki sortableChildren = true
    expect(loaded.containers.entities.sortableChildren).toBe(true);
  });

  it('bakes low furniture into floor layer and puts standing furniture in sortable entities container', () => {
    const loaded = OfficeMapLoader.loadFromDoc(mapDoc);

    const floorSprites = loaded.containers.floor.children.map((c) => c.label);
    const entitySprites = loaded.containers.entities.children.map((c) => c.label);

    // Furnitur rendah (seperti shaf sholat) harus masuk ke layer floor
    const hasLowRug = floorSprites.some((name) => isLowFurniture(name));
    expect(hasLowRug).toBe(true);

    // Meja dan furnitur tinggi lainnya harus masuk ke layer entities untuk depth sorting
    const hasStandingTable = entitySprites.some((name) => name.includes('table') || name.includes('desk'));
    expect(hasStandingTable).toBe(true);
  });

  it('extracts all 17 zones with valid 2:1 isometric world centers', () => {
    const loaded = OfficeMapLoader.loadFromDoc(mapDoc);

    expect(loaded.zones.size).toBe(17);

    const expectedZoneIds = [
      'Z01', 'Z02', 'Z03', 'Z04', 'Z05', 'Z06', 'Z07', 'Z08',
      'Z09', 'Z10', 'Z11', 'Z12', 'Z13', 'Z14', 'Z15', 'Z16', 'Z17',
    ];

    for (const id of expectedZoneIds) {
      const zone = loaded.getZone(id);
      expect(zone, `Zona ${id} tidak ditemukan`).toBeDefined();
      expect(zone!.worldCenter.x).toBeGreaterThan(0);
      expect(zone!.worldCenter.y).toBeGreaterThan(0);
      expect(zone!.gridCenter.gx).toBeGreaterThanOrEqual(0);
      expect(zone!.gridCenter.gy).toBeGreaterThanOrEqual(0);
    }
  });

  it('extracts all 116 interaction slots with valid world coordinates', () => {
    const loaded = OfficeMapLoader.loadFromDoc(mapDoc);

    expect(loaded.slots.length).toBe(116);
    for (const slot of loaded.slots) {
      expect(slot.id).toBeDefined();
      expect(slot.worldPos.x).toBeGreaterThan(0);
      expect(slot.worldPos.y).toBeGreaterThan(0);
      expect(slot.capacity).toBeGreaterThanOrEqual(1);
    }
  });

  it('manages dynamic entity addition and position updates with depth sort', () => {
    const loaded = OfficeMapLoader.loadFromDoc(mapDoc);

    const char = new Sprite(Texture.WHITE);
    char.label = 'Agent_Dynamic';

    loaded.addDynamicEntity(char, 10, 10);
    expect(loaded.containers.entities.children).toContain(char);
    const initialZ = char.zIndex;

    // Geser karakter ke (12, 12)
    loaded.updateEntityPosition(char, 12, 12);
    expect(char.zIndex).toBeGreaterThan(initialZ);

    loaded.removeDynamicEntity(char);
    expect(loaded.containers.entities.children).not.toContain(char);
  });
});
