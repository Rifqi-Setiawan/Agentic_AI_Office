import { renderToString } from 'react-dom/server';
import { beforeEach, describe, expect, it } from 'vitest';
import { HudRoot } from './HudRoot';
import { TopBar } from './TopBar';
import { AgentSidebar } from './AgentSidebar';
import { AgentInspector } from './AgentInspector';
import { LoginModal } from './LoginModal';
import { FounderPanel } from './FounderPanel';
import { ActivityFeed } from './ActivityFeed';
import { officeStore } from '../store/officeStore';
import { getFreshMockSnapshot } from '../mocks/fixtures';
import type { AgentState, TaskRef } from '../types/office';
import * as fs from 'fs';
import * as path from 'path';

describe('T1.17 HUD: TopBar, Feed, Inspector, Sidebar, and Founder Panel', () => {
  beforeEach(() => {
    officeStore.getState().reset();
    officeStore.getState().applySnapshot(getFreshMockSnapshot());
    officeStore.getState().setConnectionStatus('connected');
  });

  // ============================================================================
  // Acceptance Criterion 1: Semua kontrol bisa dioperasikan dengan keyboard & label ARIA lengkap
  // ============================================================================
  describe('Acceptance Criterion 1: Kontrol Keyboard & Kelengkapan ARIA', () => {
    it('renders TopBar with complete ARIA labels, keyboard-accessible controls, and WIB clock', () => {
      const html = renderToString(<TopBar />);

      // Banner role
      expect(html).toContain('role="banner"');

      // Status koneksi ARIA label
      expect(html).toContain('aria-label="Status koneksi: SSE Terhubung"');

      // Jam WIB & chip atmosfer
      expect(html).toContain('aria-label="Waktu WIB Saat Ini"');
      expect(html).toContain('WIB');
      expect(html).toContain('tabular-nums');

      // Kontrol Zoom Kamera
      expect(html).toContain('aria-label="Kontrol Zoom Kamera"');
      expect(html).toContain('aria-label="Skala Zoom 1x"');
      expect(html).toContain('aria-label="Skala Zoom 2x"');
      expect(html).toContain('aria-label="Skala Zoom 3x"');

      // Dropdown Zona Flight
      expect(html).toContain('aria-label="Pilih Zona Flight"');

      // Tombol Toggle Sidebar Agen
      expect(html).toContain('aria-label="Buka daftar agen"');
      expect(html).toContain('aria-controls="agent-sidebar"');
      expect(html).toContain('aria-expanded="false"');

      // Tombol Login Founder
      expect(html).toContain('aria-label="Buka form login Founder"');
    });

    it('updates TopBar when atmosphere is manually overridden', () => {
      officeStore.getState().setAtmosphereOverride('night');
      const html = renderToString(<TopBar />);
      expect(html).toContain('🌙 Malam (Manual)');
      expect(html).toContain('aria-label="Mode atmosfer: 🌙 Malam (Manual)"');
    });

    it('renders AgentSidebar with role="region", role="listbox", role="option", and keyboard navigability', () => {
      officeStore.getState().setAgentSidebarOpen(true);
      const html = renderToString(<AgentSidebar />);

      // Sidebar container ARIA
      expect(html).toContain('role="region"');
      expect(html).toContain('aria-label="Daftar Agen Kantor"');
      expect(html).toContain('id="agent-sidebar"');

      // Tombol tutup sidebar
      expect(html).toContain('aria-label="Tutup daftar agen"');

      // Input pencarian
      expect(html).toContain('aria-label="Cari agen berdasarkan nama atau peran"');

      // Listbox agen
      expect(html).toContain('role="listbox"');
      expect(html).toContain('role="option"');
      expect(html).toContain('aria-selected=');

      // Petunjuk keyboard di footer
      expect(html).toContain('Gunakan ↑ ↓ untuk navigasi');
      expect(html).toContain('Enter untuk memilih');

      // Seluruh 16 agen harus tercantum
      const agentNames = [
        'Jarvis',
        'Daedalus',
        'Oracle',
        'Merlin',
        'Muse',
        'Prism',
        'Forge',
        'Vector',
        'Sentinel',
        'Bastion',
        'Relay',
        'Warden',
        'Steward',
        'Scribe',
        'Nova',
        'Rifqi',
      ];
      for (const name of agentNames) {
        expect(html).toContain(name);
      }
    });

    it('renders AgentInspector with dialog role, AI model info, status, done today, and close button', () => {
      officeStore.getState().selectAgent('prism');
      const html = renderToString(<AgentInspector />);

      // Dialog accessibility
      expect(html).toContain('role="dialog"');
      expect(html).toContain('aria-label="Detail Agen Prism"');
      expect(html).toContain('aria-label="Tutup panel inspector"');

      // Model AI
      expect(html).toContain('Model AI:');
      expect(html).toContain('ag/gemini-3.8-flash-high');

      // Departemen & Zona
      expect(html).toContain('Departemen:');
      expect(html).toContain('Frontend Engineering');

      // Kehadiran dan Status Kerja
      expect(html).toContain('Kehadiran:');
      expect(html).toContain('Bertugas');
      expect(html).toContain('Status Kerja:');
      expect(html).toContain('Bekerja');

      // Task selesai hari ini (tabular-nums)
      expect(html).toContain('Tugas Selesai Hari Ini:');
      expect(html).toContain('tabular-nums');

      // Aktivitas terkini
      expect(html).toContain('Aktivitas Terkini:');
    });

    it('renders LoginModal with role="dialog", aria-modal="true", and accessible password input', () => {
      officeStore.getState().setLoginModalOpen(true);
      const html = renderToString(<LoginModal />);

      expect(html).toContain('role="dialog"');
      expect(html).toContain('aria-modal="true"');
      expect(html).toContain('aria-labelledby="login-dialog-title"');
      expect(html).toContain('aria-label="Tutup form login"');
      expect(html).toContain('aria-label="Kata sandi Founder"');
      expect(html).toContain('aria-label="Masuk sebagai Founder"');
      expect(html).toContain('aria-label="Batal dan tutup login"');
    });

    it('renders FounderPanel with role="dialog", collective trigger buttons, and atmosphere radio group', () => {
      officeStore.getState().setFounderAuthenticated(true);
      officeStore.getState().setFounderPanelOpen(true);
      const html = renderToString(<FounderPanel />);

      // Dialog panel founder
      expect(html).toContain('role="dialog"');
      expect(html).toContain('aria-label="Panel Kontrol Founder"');
      expect(html).toContain('aria-label="Tutup panel Founder"');
      expect(html).toContain('aria-label="Keluar dari sesi Founder"');

      // Trigger event kolektif (F15)
      expect(html).toContain('aria-label="Picu event Rapat Mendadak di Boardroom"');
      expect(html).toContain('aria-label="Picu event Break Time di Kafetaria dan Lounge"');
      expect(html).toContain('aria-label="Picu event Sholat Berjamaah di Musholla"');

      // Override mode atmosfer
      expect(html).toContain('role="radiogroup"');
      expect(html).toContain('aria-label="Pengaturan Mode Atmosfer"');
      expect(html).toContain('role="radio"');
      expect(html).toContain('aria-label="Mode atmosfer: Otomatis WIB"');
      expect(html).toContain('aria-label="Mode atmosfer: Siang (06-17)"');
      expect(html).toContain('aria-label="Mode atmosfer: Malam (18-05)"');
    });

    it('renders ActivityFeed with max 50 items and complete ARIA attributes', () => {
      const html = renderToString(<ActivityFeed />);

      expect(html).toContain('aria-label="Linimasa Aktivitas Kantor"');
      expect(html).toContain('role="feed"');
      expect(html).toContain('aria-label="Daftar item linimasa aktivitas terkini"');
      expect(html).toContain('tabindex="0"');
      expect(html).toContain('aria-label="Tutup linimasa aktivitas"');
    });
  });

  // ============================================================================
  // Acceptance Criterion 2: Proyeksi publik tidak pernah menampilkan field Founder
  // ============================================================================
  describe('Acceptance Criterion 2: Proyeksi Publik Bebas dari Kebocoran Field Founder (Anti-Leak)', () => {
    it('strictly DOES NOT render Founder fields (body, summary, result, error, workspace_path, branch, pid) in public projection', () => {
      // 1. Simulasikan state di mana task agent memiliki nilai canary Founder
      const leakCanaryTask: TaskRef = {
        id: 't_canary_test',
        title: 'Pengembangan modul backend dan database',
        board: 'Proyek internal',
        status: 'running',
        block_kind: null,
        started_at: 1791028300,
        // Field-field rahasia Founder yang TIDAK BOLEH bocor:
        body: 'LEAK-CANARY-BODY-RESTRICTED-PROMPT-12345',
        summary: 'LEAK-CANARY-SUMMARY-INTERNAL-DATA',
        result: 'LEAK-CANARY-RESULT-SECRET-KEY',
        error: 'LEAK-CANARY-ERROR-TRACEBACK',
        workspace_path: '/srv/apps/hermes/workspaces/t_d72aae8f/secret',
        branch_name: 'feature/founder-secret-branch',
        worker_pid: 99999,
      };

      const agentWithCanary: AgentState = {
        ...officeStore.getState().agents['forge'],
        task: leakCanaryTask,
      };

      officeStore.getState().updateAgentDelta(agentWithCanary);
      officeStore.getState().setProjection('public');
      officeStore.getState().setFounderAuthenticated(false);
      officeStore.getState().selectAgent('forge');

      // 2. Render AgentInspector pada mode publik
      const html = renderToString(<AgentInspector />);

      // Pastikan inspector terbuka
      expect(html).toContain('Forge');
      expect(html).toContain('Pengembangan modul backend dan database');

      // VERIFIKASI KETAT ANTI-LEAK:
      // Tidak boleh ada satupun token canary atau path internal yang dirender di DOM publik
      expect(html).not.toContain('LEAK-CANARY-BODY-RESTRICTED-PROMPT-12345');
      expect(html).not.toContain('LEAK-CANARY-SUMMARY-INTERNAL-DATA');
      expect(html).not.toContain('LEAK-CANARY-RESULT-SECRET-KEY');
      expect(html).not.toContain('LEAK-CANARY-ERROR-TRACEBACK');
      expect(html).not.toContain('/srv/apps/hermes');
      expect(html).not.toContain('feature/founder-secret-branch');
      expect(html).not.toContain('99999');

      // Container field founder tidak boleh ada di DOM
      expect(html).not.toContain('data-testid="founder-task-fields"');
      expect(html).not.toContain('👑 Telemetri Founder');
    });

    it('renders full Founder fields when projection is founder AND founder is authenticated', () => {
      const founderTask: TaskRef = {
        id: 't_founder_verified',
        title: 'Pembangunan Fitur F14 HUD dan F06 Login Founder',
        board: 'office-v2',
        status: 'running',
        block_kind: null,
        started_at: 1791028300,
        body: 'Implementasi lengkap antarmuka HUD dan otentikasi Founder.',
        summary: 'Komponen TopBar, AgentSidebar, dan FounderPanel selesai.',
        result: 'Test 100% lulus tanpa regresi.',
        error: null,
        workspace_path: '/srv/hermes-control/services/office-v2',
        branch_name: 'office-v2',
        worker_pid: 2230217,
      };

      const agentWithTask: AgentState = {
        ...officeStore.getState().agents['prism'],
        task: founderTask,
      };

      officeStore.getState().updateAgentDelta(agentWithTask);
      officeStore.getState().setProjection('founder');
      officeStore.getState().setFounderAuthenticated(true);
      officeStore.getState().selectAgent('prism');

      const html = renderToString(<AgentInspector />);

      // Harus menampilkan badge Founder
      expect(html).toContain('👑 Telemetri Founder');
      expect(html).toContain('data-testid="founder-task-fields"');

      // Field Founder harus dirender
      expect(html).toContain('Implementasi lengkap antarmuka HUD dan otentikasi Founder.');
      expect(html).toContain('Komponen TopBar, AgentSidebar, dan FounderPanel selesai.');
      expect(html).toContain('Test 100% lulus tanpa regresi.');
      expect(html).toContain('/srv/hermes-control/services/office-v2');
      expect(html).toContain('office-v2');
      expect(html).toContain('2230217');
    });

    it('verifies full HudRoot in public mode does not leak Founder data across entire tree', () => {
      officeStore.getState().setProjection('public');
      officeStore.getState().setFounderAuthenticated(false);
      officeStore.getState().selectAgent('jarvis');
      officeStore.getState().setAgentSidebarOpen(true);

      const html = renderToString(<HudRoot />);

      expect(html).not.toContain('data-testid="founder-task-fields"');
      expect(html).not.toContain('data-testid="founder-panel"');
      expect(html).not.toContain('LEAK-CANARY');
      expect(html).not.toContain('/srv/apps/hermes');
    });
  });

  // ============================================================================
  // Kepatuhan prefers-reduced-motion
  // ============================================================================
  describe('Kepatuhan prefers-reduced-motion', () => {
    it('verifies index.css contains prefers-reduced-motion media query with animation override', () => {
      const cssPath = path.resolve(__dirname, '../index.css');
      const cssContent = fs.readFileSync(cssPath, 'utf-8');

      expect(cssContent).toContain('@media (prefers-reduced-motion: reduce)');
      expect(cssContent).toContain('animation-duration: 0.01ms !important');
      expect(cssContent).toContain('transition-duration: 0.01ms !important');
    });

    it('verifies HUD components include motion-safe and motion-reduce utility classes', () => {
      officeStore.getState().setAgentSidebarOpen(true);
      const sidebarHtml = renderToString(<AgentSidebar />);
      expect(sidebarHtml).toContain('motion-reduce:transition-none');

      const topBarHtml = renderToString(<TopBar />);
      expect(topBarHtml).toContain('motion-safe:animate-pulse');
    });
  });

  // ============================================================================
  // Interaktivitas Store dan Aksi-Aksi HUD
  // ============================================================================
  describe('Aksi Store untuk HUD (Sidebar, Founder Panel, Modal, Atmosfer)', () => {
    it('toggles sidebar and inspector cleanly via store', () => {
      expect(officeStore.getState().isAgentSidebarOpen).toBe(false);
      officeStore.getState().setAgentSidebarOpen(true);
      expect(officeStore.getState().isAgentSidebarOpen).toBe(true);

      officeStore.getState().selectAgent('merlin');
      expect(officeStore.getState().selectedAgentId).toBe('merlin');
    });

    it('sets atmosphere override and reflects in timeOfDay', () => {
      expect(officeStore.getState().atmosphereOverride).toBe('auto');

      officeStore.getState().setAtmosphereOverride('dusk');
      expect(officeStore.getState().atmosphereOverride).toBe('dusk');
      expect(officeStore.getState().timeOfDay).toBe('dusk');

      // Kembalikan ke otomatis
      officeStore.getState().setAtmosphereOverride('auto');
      expect(officeStore.getState().atmosphereOverride).toBe('auto');
      expect(officeStore.getState().timeOfDay).toBe('day'); // dari snapshot
    });

    it('manages Founder authentication and panels', () => {
      expect(officeStore.getState().isFounderAuthenticated).toBe(false);
      expect(officeStore.getState().projection).toBe('public');

      // Login berhasil
      officeStore.getState().setFounderAuthenticated(true);
      expect(officeStore.getState().isFounderAuthenticated).toBe(true);
      expect(officeStore.getState().projection).toBe('founder');

      officeStore.getState().setFounderPanelOpen(true);
      expect(officeStore.getState().isFounderPanelOpen).toBe(true);

      // Logout
      officeStore.getState().setFounderAuthenticated(false);
      expect(officeStore.getState().isFounderAuthenticated).toBe(false);
      expect(officeStore.getState().projection).toBe('public');
    });
  });
});