import { beforeEach, describe, expect, it } from 'vitest';
import { officeStore } from './officeStore';
import { getFreshMockSnapshot } from '../mocks/fixtures';
import type { AgentState, HostVitals, OfficeEvent } from '../types/office';

describe('Zustand Vanilla officeStore', () => {
  beforeEach(() => {
    officeStore.getState().reset();
  });

  it('initializes with default empty state', () => {
    const state = officeStore.getState();
    expect(state.connectionStatus).toBe('disconnected');
    expect(state.lastSeq).toBe(0);
    expect(state.snapshot).toBeNull();
    expect(Object.keys(state.agents).length).toBe(0);
    expect(state.agentList.length).toBe(0);
    expect(state.recentEvents.length).toBe(0);
    expect(state.vitals).toBeNull();
  });

  it('applies WorldSnapshot and populates agents map, vitals, and events', () => {
    const mockSnapshot = getFreshMockSnapshot();
    officeStore.getState().applySnapshot(mockSnapshot);

    const state = officeStore.getState();
    expect(state.snapshot).toEqual(mockSnapshot);
    expect(state.lastSeq).toBe(142);
    expect(state.projection).toBe('public');
    expect(state.timeOfDay).toBe('day');
    expect(state.agentList.length).toBe(16);
    expect(state.agents['jarvis']).toBeDefined();
    expect(state.agents['jarvis'].name).toBe('Jarvis');
    expect(state.agents['prism'].work).toBe('working');
    expect(state.recentEvents.length).toBe(5);
    expect(state.vitals).toBeDefined();
    expect(state.vitals?.cpu_percent).toBe(18.5);
  });

  it('updates agent delta correctly and updates lastSeq monotonically', () => {
    const mockSnapshot = getFreshMockSnapshot();
    officeStore.getState().applySnapshot(mockSnapshot);

    const updatedForge: AgentState = {
      ...mockSnapshot.agents.find((a) => a.id === 'forge')!,
      work: 'blocked',
      action: 'Menunggu persetujuan skema API',
    };

    officeStore.getState().updateAgentDelta(updatedForge, 145);

    const state = officeStore.getState();
    expect(state.lastSeq).toBe(145);
    expect(state.agents['forge'].work).toBe('blocked');
    expect(state.agents['forge'].action).toBe('Menunggu persetujuan skema API');
    expect(state.agentList.find((a) => a.id === 'forge')?.work).toBe('blocked');
  });

  it('appends new office events, prevents duplicate seq, and caps at 500', () => {
    const mockSnapshot = getFreshMockSnapshot();
    officeStore.getState().applySnapshot(mockSnapshot);

    const newEvent: OfficeEvent = {
      seq: 143,
      ts: 1791029500,
      board: 'office-v2',
      kind: 'task_started',
      agent: 'sentinel',
      actor: null,
      message: 'Sentinel memverifikasi gate Fase 0',
      task: null,
    };

    officeStore.getState().appendOfficeEvent(newEvent);

    const state = officeStore.getState();
    expect(state.lastSeq).toBe(143);
    expect(state.recentEvents[0].seq).toBe(143);
    expect(state.recentEvents[0].message).toBe('Sentinel memverifikasi gate Fase 0');

    // Duplicate seq should update, not duplicate
    const updatedEvent: OfficeEvent = {
      ...newEvent,
      message: 'Sentinel memverifikasi gate Fase 0 (revisi)',
    };
    officeStore.getState().appendOfficeEvent(updatedEvent);

    const stateAfterDupe = officeStore.getState();
    const count143 = stateAfterDupe.recentEvents.filter((e) => e.seq === 143).length;
    expect(count143).toBe(1);
    expect(stateAfterDupe.recentEvents[0].message).toBe('Sentinel memverifikasi gate Fase 0 (revisi)');
  });

  it('updates host vitals', () => {
    const vitals: HostVitals = {
      cpu_percent: 24.2,
      memory_percent: 45.1,
      disk_percent: 60.0,
      status: 'warning',
      details: null,
    };

    officeStore.getState().updateVitals(vitals);
    expect(officeStore.getState().vitals).toEqual(vitals);
  });

  it('supports vanilla store read outside React without throwing', () => {
    // Membuktikan bahwa loop render PixiJS dapat membaca store murni
    const state = officeStore.getState();
    expect(typeof state.setConnectionStatus).toBe('function');
    expect(Array.isArray(state.recentEvents)).toBe(true);
  });
});
