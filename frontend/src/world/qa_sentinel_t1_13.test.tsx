import { beforeEach, describe, expect, it } from 'vitest';
import { renderToString } from 'react-dom/server';

import { performance } from 'node:perf_hooks';
import fs from 'node:fs';
import path from 'node:path';

import { Character, CharacterFsmState } from './Character';
import { CharacterManager, AGENT_SPAWN_DEFS } from './CharacterManager';
import { OfficeMapLoader } from './mapLoader';
import { TiledMapDoc, InteractionSlot } from './types';
import { officeStore } from '../store/officeStore';
import { AgentInspector } from '../hud/AgentInspector';
import { getFreshMockSnapshot } from '../mocks/fixtures';

describe('SENTINEL INDEPENDENT QA: T1.13 Entitas Karakter dan FSM Gerak', () => {
  beforeEach(() => {
    officeStore.getState().reset();
  });

  describe('1. Invariant & Architecture: AnimatedSprite 4 Arah (Mirror)', () => {
    it('verifies exact horizontal mirroring rules for 4 isometric facing directions', () => {
      const char = new Character({
        id: 'sentinel',
        name: 'Sentinel',
        role: 'QA Lead',
        initialFacing: 'SE',
      });

      // SE: direct sprite
      expect(char.facing).toBe('SE');
      expect(char.spriteWrapper.scale.x).toBe(1);

      // SW: horizontal mirror of SE
      char.setFacing('SW');
      expect(char.facing).toBe('SW');
      expect(char.spriteWrapper.scale.x).toBe(-1);

      // NE: direct sprite
      char.setFacing('NE');
      expect(char.facing).toBe('NE');
      expect(char.spriteWrapper.scale.x).toBe(1);

      // NW: horizontal mirror of NE
      char.setFacing('NW');
      expect(char.facing).toBe('NW');
      expect(char.spriteWrapper.scale.x).toBe(-1);
    });

    it('verifies anchor coordinates (0.5, 0.92) for isometric tile grounding', () => {
      const char = new Character({ id: 'test_anchor', name: 'Anchor Test' });
      expect(char.animatedSprite.anchor.x).toBe(0.5);
      expect(char.animatedSprite.anchor.y).toBeCloseTo(0.92, 2);
    });
  });

  describe('2. Invariant & Architecture: FSM Locomotion Lifecycle & Edge Cases', () => {
    it('verifies full FSM cycle: idle -> walk -> arrive -> act -> leave -> idle', () => {
      const char = new Character({ id: 'fsm_tester', name: 'FSM Tester', initialGx: 5, initialGy: 5 });
      const transitions: Array<{ from: CharacterFsmState; to: CharacterFsmState }> = [];
      char.onStateChange = (from, to) => transitions.push({ from, to });

      expect(char.fsmState).toBe('idle');

      // Test slot
      const deskSlot: InteractionSlot = {
        id: 'slot_test_desk',
        type: 'desk:qa',
        capacity: 1,
        facing: 'SW',
        anim: 'sit_type',
        y_offset: -6,
        zone: 'Z10',
        gx: 5,
        gy: 10,
        worldPos: { x: 300, y: 300 },
      };

      // Walk to slot
      char.walk([{ gx: 5, gy: 5 }, { gx: 5, gy: 10 }], deskSlot);
      expect(char.fsmState).toBe('walk');
      expect(char.slotYOffset).toBe(0);

      // Advance time until destination reached (distance = 5 tiles, speed = 2.5 tile/s -> 2.0s)
      char.update(2.05);

      // Should automatically arrive and transition to act on deskSlot
      expect(char.fsmState).toBe('act');
      expect(char.getCurrentSlot()?.id).toBe('slot_test_desk');
      expect(char.slotYOffset).toBe(-6);
      expect(char.spriteWrapper.y).toBe(-6);
      expect(char.facing).toBe('SW');
      expect(char.spriteWrapper.scale.x).toBe(-1);

      // Leave slot
      char.leave();
      expect(char.fsmState).toBe('idle');
      expect(char.getCurrentSlot()).toBeNull();
      expect(char.slotYOffset).toBe(0);
      expect(char.spriteWrapper.y).toBe(0);

      // Check recorded transitions
      expect(transitions).toEqual([
        { from: 'idle', to: 'walk' },
        { from: 'walk', to: 'arrive' },
        { from: 'arrive', to: 'act' },
        { from: 'act', to: 'leave' },
        { from: 'leave', to: 'idle' },
      ]);
    });

    it('handles edge case: walk with empty path or single current waypoint immediately arrives/idles', () => {
      const char = new Character({ id: 'empty_path', name: 'Empty Path', initialGx: 2, initialGy: 2 });
      char.walk([]);
      expect(char.fsmState).toBe('idle');

      const slot: InteractionSlot = {
        id: 'slot_instant',
        type: 'instant',
        capacity: 1,
        facing: 'SE',
        anim: 'sit_type',
        y_offset: -4,
        zone: 'Z01',
        gx: 2,
        gy: 2,
        worldPos: { x: 100, y: 100 },
      };

      char.walk([], slot);
      expect(char.fsmState).toBe('act');
      expect(char.slotYOffset).toBe(-4);
    });

    it('handles high dt overshoot across multiple waypoints in a single frame', () => {
      const char = new Character({ id: 'fast_mover', name: 'Fast Mover', initialGx: 0, initialGy: 0, speed: 2.5 });
      const zigzagPath = [
        { gx: 0, gy: 0 },
        { gx: 1, gy: 0 },
        { gx: 1, gy: 1 },
        { gx: 2, gy: 1 },
        { gx: 2, gy: 2 },
      ]; // Total distance = 1 + 1 + 1 + 1 = 4 tiles

      char.walk(zigzagPath);
      expect(char.fsmState).toBe('walk');

      // Delta time = 2.0 seconds -> 5.0 tiles travelled, which exceeds total path length (4.0)
      char.update(2.0);

      expect(char.fsmState).toBe('idle');
      expect(char.gx).toBe(2);
      expect(char.gy).toBe(2);
    });
  });

  describe('3. Invariant: Kecepatan Jalan Konstan 2.5 tile/detik', () => {
    it('verifies exact 2.5 tiles/sec on 8 distinct directional vectors', () => {
      const directions: Array<{ dx: number; dy: number; name: string }> = [
        { dx: 1, dy: 0, name: 'E' },
        { dx: -1, dy: 0, name: 'W' },
        { dx: 0, dy: 1, name: 'S' },
        { dx: 0, dy: -1, name: 'N' },
        { dx: 1, dy: 1, name: 'SE' },
        { dx: -1, dy: 1, name: 'SW' },
        { dx: 1, dy: -1, name: 'NE' },
        { dx: -1, dy: -1, name: 'NW' },
      ];

      for (const dir of directions) {
        const char = new Character({ id: `speed_${dir.name}`, name: `Speed ${dir.name}`, initialGx: 10, initialGy: 10 });
        const targetGx = 10 + dir.dx * 10;
        const targetGy = 10 + dir.dy * 10;

        char.walk([{ gx: 10, gy: 10 }, { gx: targetGx, gy: targetGy }]);

        // 1.0 second elapsed
        char.update(1.0);

        const distTraveled = Math.hypot(char.gx - 10, char.gy - 10);
        expect(distTraveled, `Direction ${dir.name} should travel 2.5 tiles in 1 sec`).toBeCloseTo(2.5, 4);
      }
    });
  });

  describe('4. Invariant: Task Badge & Founder Crown Exclusivity', () => {
    it('verifies badge visibility is strictly gated on work === "working"', () => {
      const char = new Character({ id: 'badge_tester', name: 'Badge Tester' });

      const nonWorkingStates: Array<'idle' | 'done_recent' | 'blocked'> = ['idle', 'done_recent', 'blocked'];
      for (const st of nonWorkingStates) {
        char.setWorkStatus(st);
        expect(char.badgeContainer.visible, `Badge must be hidden when status is ${st}`).toBe(false);
      }

      char.setWorkStatus('working', { id: 't1', title: 'Task', board: 'b', status: 'running', block_kind: null });
      expect(char.badgeContainer.visible).toBe(true);

      // Pulse update
      const initialScale = char.badgeGfx.scale.x;
      char.update(0.1);
      expect(char.badgeGfx.scale.x).not.toBe(initialScale);
    });

    it('verifies Rifqi golden floating crown exists exclusively for rifqi entity', () => {
      const allDefIds = AGENT_SPAWN_DEFS.map((d) => d.id);
      for (const id of allDefIds) {
        const char = new Character({ id, name: id });
        if (id === 'rifqi') {
          expect(char.crownContainer, 'Rifqi must have crownContainer').not.toBeNull();
          expect(char.crownGfx, 'Rifqi must have crownGfx').not.toBeNull();
        } else {
          expect(char.crownContainer, `Agent ${id} must NOT have crownContainer`).toBeNull();
          expect(char.crownGfx, `Agent ${id} must NOT have crownGfx`).toBeNull();
        }
      }
    });
  });

  describe('5. Acceptance Criterion 1: 16 Karakter Berjalan Bersamaan Tanpa Penurunan FPS di Bawah 60', () => {
    it('verifies 16 characters simultaneous walking benchmark maintains > 60 FPS (frame budget < 16.67ms)', () => {
      const mapPath = path.resolve(__dirname, '../../public/maps/floor1.tmj');
      const rawMap = fs.readFileSync(mapPath, 'utf-8');
      const mapDoc = JSON.parse(rawMap) as TiledMapDoc;
      const loadedMap = OfficeMapLoader.loadFromDoc(mapDoc);
      const manager = new CharacterManager(loadedMap);
      manager.spawnAllAgents();

      const AGENT_IDS = [
        'jarvis', 'daedalus', 'oracle', 'merlin', 'muse', 'prism', 'forge', 'vector',
        'sentinel', 'bastion', 'relay', 'warden', 'steward', 'scribe', 'nova', 'rifqi',
      ];

      expect(AGENT_IDS.length).toBe(16);

      // Set each character on a complex path
      for (const id of AGENT_IDS) {
        const char = manager.getCharacter(id)!;
        const curGx = char.gx;
        const curGy = char.gy;
        const testPath = [
          { gx: curGx, gy: curGy },
          { gx: curGx + 4, gy: curGy },
          { gx: curGx + 4, gy: curGy + 4 },
          { gx: curGx, gy: curGy + 4 },
          { gx: curGx, gy: curGy },
        ];
        manager.moveCharacter(id, testPath);
        expect(char.fsmState).toBe('walk');
      }

      // Benchmark 180 frames (3 full seconds at 60 FPS)
      const FRAMES = 180;
      const DT = 1.0 / 60.0;

      // JIT warm-up
      for (let f = 0; f < 20; f++) {
        manager.update(DT);
      }

      const t0 = performance.now();
      for (let f = 0; f < FRAMES; f++) {
        manager.update(DT);
      }
      const t1 = performance.now();

      const totalTimeMs = t1 - t0;
      const avgFrameMs = totalTimeMs / FRAMES;
      const fps = 1000.0 / avgFrameMs;

      console.log(`[Sentinel QA Benchmark] 16 Agents Walking: avg ${avgFrameMs.toFixed(4)} ms/frame -> ${fps.toFixed(1)} FPS`);

      // Must be < 16.67 ms (60 FPS budget)
      expect(avgFrameMs).toBeLessThan(16.67);
      expect(avgFrameMs).toBeLessThan(5.0);
      expect(fps).toBeGreaterThanOrEqual(60.0);
    });
  });

  describe('6. Acceptance Criterion 2: Klik Karakter Membuka Inspector yang Benar', () => {
    it('verifies clicking every agent opens the exact inspector with verified attributes and Indonesian locale', () => {
      officeStore.getState().applySnapshot(getFreshMockSnapshot());

      for (const def of AGENT_SPAWN_DEFS) {
        const char = new Character({
          id: def.id,
          name: def.name,
          role: def.role,
          signatureColor: def.signatureColor,
        });

        // Trigger click on character
        char.handleClick();
        expect(officeStore.getState().selectedAgentId).toBe(def.id);

        const html = renderToString(<AgentInspector />);
        expect(html).toContain('data-testid="agent-inspector"');
        expect(html).toContain(`@${def.id}`);
        expect(html).toContain(def.name);
        expect(html).toContain(def.signatureColor);

        // Verify Indonesian UI labels
        expect(html).toContain('Kehadiran:');
        expect(html).toContain('Status Kerja:');
        expect(html).toContain('Model AI:');
        expect(html).toContain('Zona Saat Ini:');
        expect(html).toContain('Tugas Selesai Hari Ini:');
        expect(html).toContain('Aktivitas Terkini:');
        expect(html).toContain('Task Aktif:');
      }
    });

    it('verifies closing inspector resets selectedAgentId and unmounts dialog', () => {
      officeStore.getState().selectAgent('jarvis');
      expect(officeStore.getState().selectedAgentId).toBe('jarvis');
      expect(renderToString(<AgentInspector />)).toContain('Jarvis');

      officeStore.getState().selectAgent(null);
      expect(officeStore.getState().selectedAgentId).toBeNull();
      expect(renderToString(<AgentInspector />)).toBe('');
    });
  });

  describe('7. Invariant: Hover Interaction & Store Sync', () => {
    it('verifies hoverAgent syncs to store and toggles NameTag visibility', () => {
      const char = new Character({ id: 'oracle', name: 'Oracle' });
      expect(char.nameTagContainer.visible).toBe(false);
      expect(officeStore.getState().hoveredAgentId).toBeNull();

      char.handleHover(true);
      expect(char.nameTagContainer.visible).toBe(true);
      expect(officeStore.getState().hoveredAgentId).toBe('oracle');

      char.handleHover(false);
      expect(char.nameTagContainer.visible).toBe(false);
      expect(officeStore.getState().hoveredAgentId).toBeNull();
    });
  });
});
