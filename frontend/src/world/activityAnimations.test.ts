import { describe, expect, it } from 'vitest';
import { Texture } from 'pixi.js';
import { Character } from './Character';
import type { InteractionSlot } from './types';

const desk: InteractionSlot = {
  id: 'desk', type: 'desk:scribe', capacity: 1, facing: 'SE', anim: 'sit_type',
  y_offset: -6, zone: 'Z05', gx: 0, gy: 0, worldPos: { x: 0, y: 0 },
};
const task = { id: 'fixture-writing', title: 'Menulis dokumentasi', board: 'fixture', status: 'running' as const };

describe('T2.1 pemilihan animasi aktivitas', () => {
  it('hanya menyelingi kerja khas untuk task aktif di meja sendiri dan menghentikannya saat stale', () => {
    const char = new Character({ id: 'scribe', name: 'Scribe' });
    char.act(desk);
    expect(char.getCurrentAnimation()).toBe('sit_type');
    char.setWorkStatus('working', task);
    expect(char.getCurrentAnimation()).toBe('special');
    expect(char.badgeContainer.visible).toBe(true);
    char.update(2.1); // Unit boundary, bukan benchmark durasi.
    expect(char.getCurrentAnimation()).toBe('sit_type');
    char.setWorkStatus('stale', task);
    char.setWorkStatus('working', task);
    expect(char.getCurrentAnimation()).toBe('special');
    char.setWorkStatus('stale', task);
    expect(char.getCurrentAnimation()).toBe('idle');
    expect(char.badgeContainer.visible).toBe(false);
    char.setWorkStatus('working', null);
    expect(char.getCurrentAnimation()).not.toBe('special');
    expect(char.badgeContainer.visible).toBe(false);
    char.act({ ...desk, type: 'pool_swim', anim: 'swim' });
    char.setWorkStatus('working', task);
    char.update(0.1);
    expect(char.getCurrentAnimation()).toBe('swim');
    char.destroy();
  });

  it('menghentikan animasi kerja dasar saat task macet atau gagal, termasuk saat baru tiba', () => {
    const char = new Character({ id: 'scribe', name: 'Scribe' });
    char.act(desk);
    char.setWorkStatus('working', task);
    char.update(2.1);
    expect(char.getCurrentAnimation()).toBe('sit_type');
    char.setWorkStatus('stale', task);
    expect(char.getCurrentAnimation()).toBe('idle');
    char.act(desk);
    expect(char.getCurrentAnimation()).toBe('idle');
    char.setWorkStatus('failed', task);
    expect(char.getCurrentAnimation()).toBe('idle');
    char.setWorkStatus('working', null);
    expect(char.getCurrentAnimation()).toBe('idle');
    char.setWorkStatus('done_recent', { ...task, status: 'done' });
    char.playAnimation('celebrate');
    char.update(0.1);
    expect(char.getCurrentAnimation()).toBe('celebrate');
    char.destroy();
  });

  it('animasi hilang kembali ke idle, tidak menyamar sebagai gerak khas', () => {
    const char = new Character({ id: 'scribe', name: 'Scribe', textures: {
      idle: { se: [Texture.WHITE], ne: [Texture.WHITE] },
      special: { se: [Texture.EMPTY], ne: [Texture.EMPTY] },
    } });
    char.playAnimation('missing');
    expect(char.animatedSprite.textures).toEqual([Texture.WHITE]);
    char.destroy();
  });

  it('Merlin memakai whiteboard ruang kelas sebagai stasiun kerja, bukan whiteboard agen lain', () => {
    const char = new Character({ id: 'merlin', name: 'Merlin' });
    char.setWorkStatus('working', task);
    char.act({ ...desk, id: 'slot_z04_whiteboard', type: 'whiteboard', anim: 'whiteboard' });
    expect(char.getCurrentAnimation()).toBe('special');
    char.update(2.1);
    expect(char.getCurrentAnimation()).toBe('whiteboard');
    char.act({ ...desk, id: 'slot_z06_whiteboard', type: 'whiteboard', anim: 'whiteboard' });
    expect(char.getCurrentAnimation()).toBe('whiteboard');
    char.destroy();
  });
});
