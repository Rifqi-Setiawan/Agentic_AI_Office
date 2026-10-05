import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { GridMap, type RawTiledMap } from './GridMap';
import { AStarPathfinder } from './AStarPathfinder';
import { AGENT_SPAWN_DEFS } from '../world/simulation/roster';
import { SlotReservationManager } from './SlotReservationManager';

const document = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../../public/maps/floor1.tmj'), 'utf8')) as RawTiledMap;
const map = new GridMap(document);
const guest = map.getSlot('slot_z08_desk_guest')!;

describe('Z08 separate temporary Guest desk', () => {
  it('keeps three permanent desks together and places the Guest outside their row', () => {
    const staff = ['prism', 'forge', 'nova'].map(id => map.getSlot(`slot_z08_desk_${id}`)!);
    expect(staff.map(s => [s.gx, s.gy])).toEqual([[17, 12], [17, 14], [17, 16]]);
    expect(guest.gx).toBeGreaterThan(staff[0].gx + 1);
    expect(guest.zone).toBe('Z08');
    expect([guest.gx, guest.gy, guest.facing]).toEqual([22, 12, 'NE']);
    expect(guest.anim).toBe('sit_type');
    const fallback = AGENT_SPAWN_DEFS.find(a => a.id === 'guest')!;
    expect([fallback.fallbackGx, fallback.fallbackGy, fallback.fallbackFacing]).toEqual([guest.gx, guest.gy, guest.facing]);
    expect(map.getAllSlots()).toHaveLength(133);
    expect(map.getZones()).toHaveLength(17);
    expect(map.getDoors()).toHaveLength(26);
  });

  it('keeps every slot reachable with the actual pathfinder, and reaches Guest from each Z08 door', () => {
    const pathfinder = new AStarPathfinder(map);
    const spawn = { gx: 4, gy: 30 };
    for (const slot of map.getAllSlots()) {
      expect(pathfinder.findPath(spawn, slot), `unreachable ${slot.id}`).not.toBeNull();
    }
    const doors = map.getDoors().filter(d => d.from === 'Z08' || d.to === 'Z08');
    expect(doors).toHaveLength(3);
    for (const door of doors) {
      const route = pathfinder.findPath(door, guest)!;
      expect(route, `Guest inaccessible from ${door.name}`).not.toBeNull();
      for (let i = 1; i < route.length; i++) {
        const a = route[i - 1], b = route[i];
        expect(map.isWalkable(b.gx, b.gy)).toBe(true);
        if (a.gx !== b.gx && a.gy !== b.gy) {
          expect(map.isWalkable(a.gx, b.gy) && map.isWalkable(b.gx, a.gy)).toBe(true);
        }
      }
    }
    expect(map.isWalkable(guest.gx, guest.gy)).toBe(true);
    expect(map.isWalkable(guest.gx + 1, guest.gy)).toBe(false);
    expect(map.isWalkable(16, 18)).toBe(true);
  });

  it('replaces standing interactions with two reachable gaming seats and real furniture collision', () => {
    expect(map.getSlot('slot_z08_pair_1')).toBeUndefined();
    expect(map.getSlot('slot_z08_pair_2')).toBeUndefined();
    expect(map.getSlotsByType('pair_stand')).toHaveLength(0);
    const seats = map.getSlotsByType('dev_gaming_seat');
    expect(seats.map(s => [s.id, s.gx, s.gy, s.facing, s.anim, s.capacity])).toEqual([
      ['slot_z08_gaming_1', 19, 16, 'NE', 'game', 1], ['slot_z08_gaming_2', 20, 16, 'NE', 'game', 1],
    ]);
    const pathfinder = new AStarPathfinder(map);
    const slots = map.getSlotsByZone('Z08');
    expect(slots).toHaveLength(6);
    for (const slot of slots) {
      for (const door of map.getDoors().filter(d => d.from === 'Z08' || d.to === 'Z08')) {
        expect(pathfinder.findPath(slot, door), `${slot.id} to ${door.name}`).not.toBeNull();
      }
    }
    for (const [gx, gy] of [[19, 17], [20, 17], [20, 14], [21, 14], [22, 11]]) expect(map.isWalkable(gx, gy)).toBe(false);
    for (const [gx, gy] of [[22, 15], [22, 17], [19, 18], [22, 14]]) expect(map.isWalkable(gx, gy)).toBe(true);
    const reservations = new SlotReservationManager(map);
    expect(reservations.reserveSlot(seats[0].id, 'prism').status).toBe('reserved');
    expect(reservations.reserveSlot(seats[1].id, 'nova').status).toBe('reserved');
    expect(reservations.reserveSlot(seats[0].id, 'forge').status).toBe('queued');
  });
});
