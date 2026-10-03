import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Character, DEFAULT_WALK_SPEED } from './Character';
import { officeStore } from '../store/officeStore';
import type { InteractionSlot } from './types';
import fs from 'node:fs';
import path from 'node:path';

describe('T1.13 Character Entity & Motion FSM', () => {
  beforeEach(() => {
    officeStore.getState().reset();
  });

  describe('AnimatedSprite 4 Arah (Mirror)', () => {
    it('mirrors sprite horizontally on SW and NW, un-mirrored on SE and NE', () => {
      const char = new Character({
        id: 'jarvis',
        name: 'Jarvis',
        initialFacing: 'SE',
      });

      // SE: scale.x = 1
      expect(char.facing).toBe('SE');
      expect(char.spriteWrapper.scale.x).toBe(1);

      // SW: mirror horizontal (scale.x = -1)
      char.setFacing('SW');
      expect(char.facing).toBe('SW');
      expect(char.spriteWrapper.scale.x).toBe(-1);

      // NE: un-mirrored (scale.x = 1)
      char.setFacing('NE');
      expect(char.facing).toBe('NE');
      expect(char.spriteWrapper.scale.x).toBe(1);

      // NW: mirror horizontal (scale.x = -1)
      char.setFacing('NW');
      expect(char.facing).toBe('NW');
      expect(char.spriteWrapper.scale.x).toBe(-1);
    });

    it('sets anchor to feet position (0.5, 0.92) for grounding at tile center', () => {
      const char = new Character({
        id: 'daedalus',
        name: 'Daedalus',
      });

      expect(char.animatedSprite.anchor.x).toBe(0.5);
      expect(char.animatedSprite.anchor.y).toBeCloseTo(0.92, 2);
    });
  });

  describe('FSM Gerak: idle -> walk(path) -> arrive -> act(anim slot) -> leave', () => {
    it('transitions through complete FSM lifecycle', () => {
      const char = new Character({
        id: 'steward',
        name: 'Steward',
        initialGx: 0,
        initialGy: 0,
      });

      const stateTransitions: string[] = [];
      char.onStateChange = (from, to) => {
        stateTransitions.push(`${from}->${to}`);
      };

      // 1. Initial State: idle
      expect(char.fsmState).toBe('idle');

      // 2. walk(path)
      const path = [
        { gx: 0, gy: 0 },
        { gx: 2, gy: 0 },
        { gx: 2, gy: 3 },
      ];
      char.walk(path);
      expect(char.fsmState).toBe('walk');

      // 3. Update hingga tiba di akhir jalur -> arrive
      // Total jarak = 2 (ke (2,0)) + 3 (ke (2,3)) = 5 tile.
      // Pada kecepatan 2.5 tile/dtk, butuh 2.0 detik.
      char.update(1.0); // setengah perjalanan: gx ~ 2, gy ~ 0.5
      expect(char.fsmState).toBe('walk');
      expect(char.gx).toBeCloseTo(2, 1);

      char.update(1.1); // tiba di titik akhir
      expect(char.fsmState).toBe('idle'); // arrive otomatis fallback ke idle jika tanpa target slot

      // 4. act(slot) dengan y_offset saat duduk
      const deskSlot: InteractionSlot = {
        id: 'slot_z09_desk_steward',
        type: 'desk:steward',
        capacity: 1,
        facing: 'SE',
        anim: 'sit_type',
        y_offset: -6,
        zone: 'Z09',
        gx: 25,
        gy: 12,
        worldPos: { x: 100, y: 100 },
      };

      char.act(deskSlot);
      expect(char.fsmState).toBe('act');
      expect(char.slotYOffset).toBe(-6);
      expect(char.spriteWrapper.y).toBe(-6); // Terangkat 6 px agar tidak tenggelam di balik meja
      expect(char.facing).toBe('SE');

      // 5. leave()
      char.leave();
      expect(char.fsmState).toBe('idle');
      expect(char.slotYOffset).toBe(0);
      expect(char.spriteWrapper.y).toBe(0); // Kembali normal berdiri

      expect(stateTransitions).toContain('idle->walk');
      expect(stateTransitions).toContain('walk->arrive');
      expect(stateTransitions).toContain('arrive->idle');
      expect(stateTransitions).toContain('idle->act');
      expect(stateTransitions).toContain('act->leave');
      expect(stateTransitions).toContain('leave->idle');
    });

    it('automatically transitions from arrive to act when targetSlot is supplied to walk()', () => {
      const char = new Character({
        id: 'forge',
        name: 'Forge',
        initialGx: 10,
        initialGy: 10,
      });

      const targetSlot: InteractionSlot = {
        id: 'slot_z08_desk_forge',
        type: 'desk:forge',
        capacity: 1,
        facing: 'SW',
        anim: 'sit_type',
        y_offset: -6,
        zone: 'Z08',
        gx: 12,
        gy: 10,
        worldPos: { x: 200, y: 200 },
      };

      // Jalur 2 tile
      char.walk([{ gx: 10, gy: 10 }, { gx: 12, gy: 10 }], targetSlot);
      expect(char.fsmState).toBe('walk');

      // 2 tile / 2.5 tile/dtk = 0.8 detik
      char.update(0.85);

      // Harusnya otomatis arrive lalu act(targetSlot)
      expect(char.fsmState).toBe('act');
      expect(char.getCurrentSlot()?.id).toBe('slot_z08_desk_forge');
      expect(char.slotYOffset).toBe(-6);
      expect(char.facing).toBe('SW');
      expect(char.spriteWrapper.scale.x).toBe(-1); // SW mirrored
    });
  });

  describe('Kecepatan Jalan 2,5 tile/dtk', () => {
    it('moves at exactly 2.5 tiles per second on orthogonal path', () => {
      const char = new Character({
        id: 'vector',
        name: 'Vector',
        initialGx: 0,
        initialGy: 0,
        speed: DEFAULT_WALK_SPEED,
      });

      // Jalur lurus 5 tile sepanjang sumbu X
      char.walk([{ gx: 0, gy: 0 }, { gx: 5, gy: 0 }]);

      // Setelah 1.0 detik, harus berpindah tepat 2.5 tile
      char.update(1.0);
      expect(char.gx).toBeCloseTo(2.5, 4);
      expect(char.gy).toBeCloseTo(0, 4);

      // Setelah 1.0 detik lagi (total 2.0 dtk), tiba di 5.0 tile
      char.update(1.0);
      expect(char.gx).toBeCloseTo(5.0, 4);
      expect(char.gy).toBeCloseTo(0, 4);
      expect(char.fsmState).toBe('idle'); // Jalur selesai
    });

    it('moves at constant 2.5 tiles per second on diagonal Euclidean path', () => {
      const char = new Character({
        id: 'prism',
        name: 'Prism',
        initialGx: 0,
        initialGy: 0,
        speed: 2.5,
      });

      // Jalur diagonal segitiga 3-4-5 (panjang = 5 tile)
      char.walk([{ gx: 0, gy: 0 }, { gx: 3, gy: 4 }]);

      // 1.0 detik -> jarak 2.5 tile (setengah perjalanan)
      char.update(1.0);
      const distTravelled = Math.hypot(char.gx, char.gy);
      expect(distTravelled).toBeCloseTo(2.5, 3);
      expect(char.gx).toBeCloseTo(1.5, 2);
      expect(char.gy).toBeCloseTo(2.0, 2);
    });
  });

  describe('Badge Task Nyata & Mahkota Rifqi', () => {
    it('shows task badge only when work === "working" and pulses over time', () => {
      const char = new Character({
        id: 'sentinel',
        name: 'Sentinel',
      });

      // Default: idle -> badge tidak terlihat
      expect(char.badgeContainer.visible).toBe(false);

      // Ubah status ke working -> badge terlihat
      char.setWorkStatus('working', {
        id: 't_test',
        title: 'Verifikasi QA',
        board: 'office-v2',
        status: 'running',
        block_kind: null,
      });
      expect(char.badgeContainer.visible).toBe(true);

      const initialScaleX = char.badgeGfx.scale.x;
      // Update animasi pulse
      char.update(0.25);
      expect(char.badgeGfx.scale.x).not.toBe(initialScaleX);

      // Kembalikan ke idle -> badge sembunyi
      char.setWorkStatus('idle');
      expect(char.badgeContainer.visible).toBe(false);
    });

    it('renders floating golden crown exclusively for Rifqi', () => {
      const rifqi = new Character({
        id: 'rifqi',
        name: 'Rifqi',
      });
      const jarvis = new Character({
        id: 'jarvis',
        name: 'Jarvis',
      });

      expect(rifqi.crownContainer).toBeDefined();
      expect(rifqi.crownContainer).not.toBeNull();
      expect(jarvis.crownContainer).toBeNull();

      const initialCrownY = rifqi.crownContainer!.y;
      rifqi.update(0.5);
      // Mahkota harus melayang naik/turun
      expect(rifqi.crownContainer!.y).not.toBe(initialCrownY);
    });
  });

  describe('Event Klik & Hover ke HUD', () => {
    it('dispatches selectAgent to officeStore on click/tap', () => {
      const char = new Character({
        id: 'muse',
        name: 'Muse',
      });

      const clickSpy = vi.fn();
      char.onClickCallback = clickSpy;

      expect(officeStore.getState().selectedAgentId).toBeNull();

      // Trigger klik
      char.handleClick();

      expect(officeStore.getState().selectedAgentId).toBe('muse');
      expect(clickSpy).toHaveBeenCalledTimes(1);
    });

    it('dispatches hoverAgent to officeStore and reveals NameTag on hover', () => {
      const char = new Character({
        id: 'warden',
        name: 'Warden',
      });

      expect(char.nameTagContainer.visible).toBe(false);
      expect(officeStore.getState().hoveredAgentId).toBeNull();

      // Pointer enter (hover)
      char.handleHover(true);
      expect(char.nameTagContainer.visible).toBe(true);
      expect(officeStore.getState().hoveredAgentId).toBe('warden');

      // Pointer leave
      char.handleHover(false);
      expect(char.nameTagContainer.visible).toBe(false);
      expect(officeStore.getState().hoveredAgentId).toBeNull();
    });
  });

  describe('Validasi Frame Sprite Atlas Nyata', () => {
    it('parses actual character json atlas without missing animation frames', () => {
      const chars = ['jarvis', 'forge', 'rifqi'];
      const charsDir = path.resolve(__dirname, '../../public/sprites/characters');

      for (const cid of chars) {
        const jsonPath = path.join(charsDir, `${cid}.json`);
        expect(fs.existsSync(jsonPath)).toBe(true);
        const atlas = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));

        expect(atlas.frames[`${cid}_idle_se_0.png`]).toBeDefined();
        expect(atlas.frames[`${cid}_walk_se_0.png`]).toBeDefined();
        expect(atlas.frames[`${cid}_walk_ne_5.png`]).toBeDefined();
        expect(atlas.frames[`${cid}_sit_type_se_0.png`]).toBeDefined();
      }
    });
  });
});
