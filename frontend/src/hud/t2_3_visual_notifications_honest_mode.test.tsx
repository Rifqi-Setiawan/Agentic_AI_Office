import { renderToString } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { officeStore } from '../store/officeStore';
import { getFreshMockSnapshot } from '../mocks/fixtures';
import { TopBar } from './TopBar';
import { ToastContainer } from './ToastContainer';
import { FlyingIconLayer } from './FlyingIconLayer';
import { HudRoot } from './HudRoot';
import { HONEST_MODE_STORAGE_KEY } from '../store/honestModeStorage';

describe('T2.3 HUD: Notifikasi Visual (Toast, Flying Icon) dan Toggle Mode Jujur', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
    officeStore.getState().reset();
    officeStore.getState().applySnapshot(getFreshMockSnapshot());
    officeStore.getState().setConnectionStatus('connected');
  });

  // ============================================================================
  // Fitur F22: Toggle Mode Jujur & Aksesibilitas
  // ============================================================================
  describe('F22: Toggle Mode Jujur di TopBar', () => {
    it('menampilkan tombol switch Mode Jujur dengan atribut ARIA lengkap dan status default nonaktif', () => {
      const html = renderToString(<TopBar />);

      expect(html).toContain('role="switch"');
      expect(html).toContain('aria-label="Mode Jujur (matikan simulasi ambient)"');
      expect(html).toContain('aria-checked="false"');
      expect(html).toContain('Mode Jujur');
    });

    it('memperbarui aria-checked="true" dan status visual saat Mode Jujur aktif', () => {
      officeStore.getState().setHonestMode(true);
      const html = renderToString(<TopBar />);

      expect(html).toContain('aria-checked="true"');
      expect(html).toContain('Aktif');
      expect(localStorage.getItem(HONEST_MODE_STORAGE_KEY)).toBe('true');
    });

    it('menghormati preferensi Mode Jujur dari localStorage saat startup', () => {
      localStorage.setItem(HONEST_MODE_STORAGE_KEY, 'true');
      officeStore.getState().reset();

      const state = officeStore.getState();
      expect(state.isHonestMode).toBe(true);

      const html = renderToString(<TopBar />);
      expect(html).toContain('aria-checked="true"');
    });
  });

  // ============================================================================
  // Fitur F21: Toast Kecil saat Task Mulai / Selesai
  // ============================================================================
  describe('F21: Toast Notifikasi Visual Task', () => {
    it('tidak me-render toast jika antrean toasts kosong', () => {
      const html = renderToString(<ToastContainer />);
      expect(html).not.toContain('data-testid="task-toast"');
    });

    it('me-render toast task_started dengan format ramah pengguna dan atribut ARIA lengkap', () => {
      officeStore.getState().addToast({
        kind: 'task_started',
        agent: 'forge',
        title: 'Task Dimulai',
        message: 'Forge mulai mengerjakan scaffold antarmuka',
      });

      const html = renderToString(<ToastContainer />);

      expect(html).toContain('role="status"');
      expect(html).toContain('aria-live="polite"');
      expect(html).toContain('data-testid="task-toast"');
      expect(html).toContain('data-toast-kind="task_started"');
      expect(html).toContain('MULAI');
      expect(html).toContain('Forge');
      expect(html).toContain('Forge mulai mengerjakan scaffold antarmuka');
      expect(html).toContain('aria-label="Tutup notifikasi"');
    });

    it('me-render toast task_done dengan badge SELESAI dan styling sukses', () => {
      officeStore.getState().addToast({
        kind: 'task_done',
        agent: 'relay',
        title: 'Task Selesai',
        message: 'Relay menyelesaikan publikasi rilis v2.0.0',
      });

      const html = renderToString(<ToastContainer />);

      expect(html).toContain('data-toast-kind="task_done"');
      expect(html).toContain('SELESAI');
      expect(html).toContain('Relay');
      expect(html).toContain('Relay menyelesaikan publikasi rilis v2.0.0');
    });

    it('mendukung penutupan toast secara manual', () => {
      const toastId = officeStore.getState().addToast({
        kind: 'task_started',
        agent: 'prism',
        title: 'Task Dimulai',
        message: 'Prism mulai bekerja',
      });

      expect(officeStore.getState().toasts.length).toBe(1);
      officeStore.getState().dismissToast(toastId);
      expect(officeStore.getState().toasts.length).toBe(0);
    });
  });

  // ============================================================================
  // Fitur F21: Flying Icon Layer
  // ============================================================================
  describe('F21: Ikon Terbang (Flying Icon) dari Agent ke Feed', () => {
    it('me-render container FlyingIconLayer dengan pointer-events-none', () => {
      const html = renderToString(<FlyingIconLayer />);
      expect(html).toContain('pointer-events-none');
      expect(html).toContain('id="flying-icon-layer"');
    });

    it('me-render item ikon terbang dengan data agent, simbol, dan koordinat', () => {
      officeStore.getState().addFlyingIcon({
        agentId: 'forge',
        kind: 'task_started',
        startX: 400,
        startY: 300,
        targetX: 950,
        targetY: 600,
        color: '#D9622B',
        symbol: '⚡',
      });

      const html = renderToString(<FlyingIconLayer />);
      expect(html).toContain('data-testid="flying-task-icon"');
      expect(html).toContain('data-agent="forge"');
      expect(html).toContain('data-kind="task_started"');
      expect(html).toContain('⚡');
    });
  });

  // ============================================================================
  // Integrasi HudRoot
  // ============================================================================
  describe('HudRoot Terintegrasi', () => {
    it('me-render HudRoot dengan menyertakan ToastContainer dan FlyingIconLayer', () => {
      officeStore.getState().addToast({
        kind: 'task_started',
        agent: 'forge',
        title: 'Task Dimulai',
        message: 'Forge mulai bekerja',
      });

      const html = renderToString(<HudRoot />);

      expect(html).toContain('id="flying-icon-layer"');
      expect(html).toContain('data-testid="task-toast"');
      expect(html).toContain('role="switch"');
      expect(html).toContain('Mode Jujur');
    });
  });
});
