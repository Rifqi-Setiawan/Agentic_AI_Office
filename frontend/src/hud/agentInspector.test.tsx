import { renderToString } from 'react-dom/server';
import { beforeEach, describe, expect, it } from 'vitest';
import { AgentInspector, AGENT_PERSONA_CATALOG } from './AgentInspector';
import { HudRoot } from './HudRoot';
import { Character } from '../world/Character';
import { officeStore } from '../store/officeStore';
import { getFreshMockSnapshot } from '../mocks/fixtures';

describe('T1.13 Acceptance Criterion 2: Klik Karakter Membuka Inspector yang Benar', () => {
  beforeEach(() => {
    officeStore.getState().reset();
    officeStore.getState().applySnapshot(getFreshMockSnapshot());
  });

  it('does not render AgentInspector when no character is selected', () => {
    expect(officeStore.getState().selectedAgentId).toBeNull();
    const html = renderToString(<AgentInspector />);
    expect(html).toBe('');
  });

  it('enforces Acceptance Criterion 2: clicking a character opens the correct inspector with full details', () => {
    // 1. Simulasikan klik pada entitas karakter Jarvis di canvas Pixi
    const jarvisChar = new Character({
      id: 'jarvis',
      name: 'Jarvis',
      role: 'Principal Orchestrator',
      signatureColor: '#1F3A68',
    });

    jarvisChar.handleClick();

    // Verifikasi store mencatat agent terpilih
    expect(officeStore.getState().selectedAgentId).toBe('jarvis');

    // 2. Render AgentInspector
    const html = renderToString(<AgentInspector />);

    // Harus menampilkan inspector dengan data-testid
    expect(html).toContain('data-testid="agent-inspector"');
    expect(html).toContain('aria-label="Detail Agen Jarvis"');

    // Identitas persona
    expect(html).toContain('Jarvis');
    expect(html).toContain('@jarvis');
    expect(html).toContain('Principal Orchestrator');
    expect(html).toContain('ag/gemini-3.8-flash-high');
    expect(html).toContain('#1F3A68');

    // Status kerja dan task
    expect(html).toContain('Bekerja');
    expect(html).toContain('Bertugas');
    expect(html).toContain('Koordinasi orkestrasi Fase 1');
    expect(html).toContain('t_orchestrate_f1');

    // Tombol tutup panel
    expect(html).toContain('aria-label="Tutup panel inspector"');
  });

  it('correctly opens inspector for any of the 16 characters upon click', () => {
    const testAgents = ['daedalus', 'oracle', 'forge', 'sentinel', 'muse', 'nova', 'rifqi'];

    for (const agentId of testAgents) {
      const char = new Character({
        id: agentId,
        name: AGENT_PERSONA_CATALOG[agentId].name,
        role: AGENT_PERSONA_CATALOG[agentId].role,
        signatureColor: AGENT_PERSONA_CATALOG[agentId].signatureColor,
      });

      // Klik karakter
      char.handleClick();
      expect(officeStore.getState().selectedAgentId).toBe(agentId);

      const html = renderToString(<AgentInspector />);
      const meta = AGENT_PERSONA_CATALOG[agentId];

      expect(html).toContain(meta.name);
      expect(html).toContain(`@${agentId}`);
      expect(html).toContain(meta.signatureColor);
    }
  });

  it('closes inspector when selectAgent(null) is called', () => {
    officeStore.getState().selectAgent('forge');
    expect(officeStore.getState().selectedAgentId).toBe('forge');

    let html = renderToString(<AgentInspector />);
    expect(html).toContain('Forge');

    // Tutup panel
    officeStore.getState().selectAgent(null);
    expect(officeStore.getState().selectedAgentId).toBeNull();

    html = renderToString(<AgentInspector />);
    expect(html).toBe('');
  });

  it('renders AgentInspector seamlessly inside HudRoot when agent is selected', () => {
    officeStore.getState().selectAgent('sentinel');

    const html = renderToString(<HudRoot />);
    expect(html).toContain('Sentinel');
    expect(html).toContain('@sentinel');
    expect(html).toContain('QA &amp; Verification');
    expect(html).toContain('data-testid="agent-inspector"');
    expect(html).toContain('Agentic AI Office');
  });
});
