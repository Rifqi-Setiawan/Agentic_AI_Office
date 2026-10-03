import { renderToString } from 'react-dom/server';
import { beforeEach, describe, expect, it } from 'vitest';
import { HudRoot } from './HudRoot';
import { TopBar } from './TopBar';
import { AgentStatusBar } from './AgentStatusBar';
import { ActivityFeed } from './ActivityFeed';
import { SnapshotInspector } from './SnapshotInspector';
import { officeStore } from '../store/officeStore';
import { getFreshMockSnapshot } from '../mocks/fixtures';

describe('HUD React Components (Isolated Root)', () => {
  beforeEach(() => {
    officeStore.getState().reset();
    officeStore.getState().applySnapshot(getFreshMockSnapshot());
    officeStore.getState().setConnectionStatus('connected');
  });

  it('renders TopBar with WIB time label, status badge, and tabular-nums vitals', () => {
    const html = renderToString(<TopBar />);
    expect(html).toContain('Agentic AI Office');
    expect(html).toContain('SSE Aktif');
    expect(html).toContain('tabular-nums');
    expect(html).toContain('CPU');
    expect(html).toContain('RAM');
    expect(html).toContain('DISK');
    expect(html).toContain('18.5');
  });

  it('renders AgentStatusBar with 16 agents and correct breakdown', () => {
    const html = renderToString(<AgentStatusBar />);
    expect(html).toContain('Status Agen Kantor:');
    expect(html).toContain('16'); // 16 agents
    expect(html).toContain('Bekerja:');
    expect(html).toContain('Idle:');
    expect(html).toContain('tabular-nums');
  });

  it('renders ActivityFeed with events from snapshot', () => {
    const html = renderToString(<ActivityFeed />);
    expect(html).toContain('Aktivitas Terkini');
    expect(html).toContain('Prism mulai mengerjakan scaffold frontend');
    expect(html).toContain('Daedalus menyelesaikan penyusunan ADR-001..004');
    expect(html).toContain('tabular-nums');
  });

  it('renders SnapshotInspector confirming snapshot receipt from mock', () => {
    const html = renderToString(<SnapshotInspector />);
    expect(html).toContain('Snapshot Terverifikasi');
    expect(html).toContain('142');
    expect(html).toContain('public');
    expect(html).toContain('16 Agen');
    expect(html).toContain('connected');
  });

  it('renders full HudRoot cleanly without errors', () => {
    const html = renderToString(<HudRoot />);
    expect(html).toContain('pointer-events-none');
    expect(html).toContain('pointer-events-auto');
    expect(html).toContain('Agentic AI Office');
    expect(html).toContain('Snapshot Terverifikasi');
  });
});
