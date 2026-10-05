import { describe, it, expect, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { Character } from './Character';
import { AmbientScheduler } from './choreographer/AmbientScheduler';
import type { AgentChoreographyState } from './choreographer/types';
import { GridMap } from '../navigation/GridMap';
import { AStarPathfinder } from '../navigation/AStarPathfinder';
import { SlotReservationManager } from '../navigation/SlotReservationManager';

function setup(id: string, roll: number) {
  const grid = new GridMap(JSON.parse(fs.readFileSync(path.resolve(__dirname, '../../public/maps/floor1.tmj'), 'utf8')));
  const reservations = new SlotReservationManager(grid);
  const char = new Character({ id, name: id, initialGx: 37, initialGy: 24 });
  const state: AgentChoreographyState = { agentId: id, currentLayer: 'ambient', currentActivityKey: null,
    lastActivityKey: null, activityDuration: 0, activityRemaining: 0, targetSlotId: null,
    lastGx: 37, lastGy: 24, timeAtTile: 0, deskSlotId: '', workStatus: 'idle', currentTask: null,
    celebrateRemaining: 0, needsInputReported: false, sholatNotified: false };
  const scheduler = new AmbientScheduler(grid, new AStarPathfinder(grid), reservations, () => roll);
  return { grid, reservations, char, state, scheduler };
}

describe('T2.1 aktivitas ambient di slot kantor', () => {
  it.each([['prism', 0.99], ['nova', 0.99]] as const)('%s reaches the approved Dev Pod console seats with a game action', (id, roll) => {
    const { grid, char, state, scheduler } = setup(id, roll);
    const walk = vi.spyOn(char, 'walk');
    expect(scheduler.scheduleNextAmbientActivity(id, state, char)).toBe(true);
    expect(walk).toHaveBeenCalledOnce();
    const seat = walk.mock.calls[0][1]!;
    expect(seat.zone).toBe('Z08');
    expect(seat.type).toBe('dev_gaming_seat');
    expect(seat.anim).toBe('game');
    expect(grid.isWalkable(seat.gx, seat.gy)).toBe(true);
    char.arrive();
    expect(char.getCurrentAnimation()).toBe('game');
    char.destroy();
  });
  it.each([
    ['merlin', 0.9, 'drink', 'lounge_sofa'],
    ['merlin', 0, 'whiteboard', 'whiteboard'],
    ['prism', 0, 'game', 'arcade'],
    ['nova', 0.5, 'swim', 'pool_swim'],
  ] as const)('%s memilih aktivitas dan pose slot %s', (id, roll, animation, type) => {
    const { grid, char, state, scheduler } = setup(id, roll);
    const walk = vi.spyOn(char, 'walk');
    expect(scheduler.scheduleNextAmbientActivity(id, state, char)).toBe(true);
    expect(char.getCurrentAnimation()).toBe('walk');
    expect(walk).toHaveBeenCalledOnce();
    const slot = walk.mock.calls[0][1]!;
    expect(slot.type).toBe(type);
    expect(slot.anim).toBe(animation);
    expect(grid.getSlot(slot.id)!.anim).toBe(type === 'lounge_sofa' ? 'sit_type' : animation);
    // Batas FSM kedatangan unit; bukan klaim waktu perjalanan/benchmark.
    char.arrive();
    expect(char.getCurrentAnimation()).toBe(animation);
    expect(char.badgeContainer.visible).toBe(false);
    char.destroy();
  });

  it('kursi kolam menjadi fallback ketika seluruh slot renang terisi', () => {
    const { grid, char, state, scheduler, reservations } = setup('nova', 0.5);
    for (const slot of grid.getSlotsByType('pool_swim')) reservations.reserveSlot(slot.id, `occupant-${slot.id}`);
    const walk = vi.spyOn(char, 'walk');
    expect(scheduler.scheduleNextAmbientActivity('nova', state, char)).toBe(true);
    expect(walk.mock.calls[0][1]!.type).toBe('pool_lounger');
    char.arrive();
    expect(char.getCurrentAnimation()).toBe('sit_type');
    char.destroy();
  });
});
