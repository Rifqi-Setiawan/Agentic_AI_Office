import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getSavedHonestMode, saveHonestMode, HONEST_MODE_STORAGE_KEY } from './honestModeStorage';
import { officeStore } from './officeStore';
import type { OfficeEvent } from '../types/office';

describe('T2.3: Storage Preferensi Mode Jujur (Acceptance Criteria)', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
    officeStore.getState().reset();
  });

  it('mengembalikan false secara default jika localStorage kosong', () => {
    expect(getSavedHonestMode()).toBe(false);
  });

  it('mengembalikan true jika tersimpan nilai "true" di localStorage', () => {
    localStorage.setItem(HONEST_MODE_STORAGE_KEY, 'true');
    expect(getSavedHonestMode()).toBe(true);
  });

  it('menyimpan nilai boolean ke localStorage dengan benar', () => {
    saveHonestMode(true);
    expect(localStorage.getItem(HONEST_MODE_STORAGE_KEY)).toBe('true');

    saveHonestMode(false);
    expect(localStorage.getItem(HONEST_MODE_STORAGE_KEY)).toBe('false');
  });

  it('menangani exception localStorage (SecurityError / QuotaExceededError) dengan try/catch tanpa crash', () => {
    const getItemSpy = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('SecurityError: The operation is insecure.');
    });
    const setItemSpy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError: Storage quota exceeded.');
    });

    // Harus menangkap error dan mengembalikan false tanpa melemparkan error
    expect(() => getSavedHonestMode()).not.toThrow();
    expect(getSavedHonestMode()).toBe(false);

    // Harus menangkap error simpan tanpa melempar error
    expect(() => saveHonestMode(true)).not.toThrow();

    getItemSpy.mockRestore();
    setItemSpy.mockRestore();
  });
});

describe('T2.3: State Store Mode Jujur & Notifikasi Visual (F21, F22)', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
    officeStore.getState().reset();
  });

  it('menginisialisasi isHonestMode dari getSavedHonestMode()', () => {
    const state = officeStore.getState();
    expect(typeof state.isHonestMode).toBe('boolean');
    expect(state.isHonestMode).toBe(false);
  });

  it('setHonestMode memperbarui state dan menyimpan ke localStorage', () => {
    officeStore.getState().setHonestMode(true);
    expect(officeStore.getState().isHonestMode).toBe(true);
    expect(localStorage.getItem(HONEST_MODE_STORAGE_KEY)).toBe('true');

    officeStore.getState().setHonestMode(false);
    expect(officeStore.getState().isHonestMode).toBe(false);
    expect(localStorage.getItem(HONEST_MODE_STORAGE_KEY)).toBe('false');
  });

  it('dapat menambahkan dan menutup toast secara manual via store', () => {
    const toastId = officeStore.getState().addToast({
      kind: 'task_started',
      agent: 'prism',
      title: 'Task Dimulai',
      message: 'Prism mulai mengerjakan T2.3',
    });

    expect(toastId).toBeDefined();
    expect(officeStore.getState().toasts.length).toBe(1);
    expect(officeStore.getState().toasts[0].agent).toBe('prism');

    officeStore.getState().dismissToast(toastId);
    expect(officeStore.getState().toasts.length).toBe(0);
  });

  it('memicu toast dan flying icon otomatis saat appendOfficeEvent menerima task_started', () => {
    const event: OfficeEvent = {
      seq: 201,
      ts: 1791030000,
      board: 'office-v2',
      kind: 'task_started',
      agent: 'forge',
      actor: null,
      message: 'Forge mulai mengerjakan tugas arsitektur',
    };

    officeStore.getState().appendOfficeEvent(event);

    const state = officeStore.getState();
    // Toast harus muncul
    expect(state.toasts.length).toBe(1);
    expect(state.toasts[0].kind).toBe('task_started');
    expect(state.toasts[0].agent).toBe('forge');
    expect(state.toasts[0].message).toContain('Forge mulai mengerjakan');

    // Flying icon harus dipicu
    expect(state.flyingIcons.length).toBe(1);
    expect(state.flyingIcons[0].agentId).toBe('forge');
    expect(state.flyingIcons[0].kind).toBe('task_started');
  });

  it('memicu toast dan flying icon otomatis saat appendOfficeEvent menerima task_done', () => {
    const event: OfficeEvent = {
      seq: 202,
      ts: 1791030050,
      board: 'office-v2',
      kind: 'task_done',
      agent: 'relay',
      actor: null,
      message: 'Relay menyelesaikan rilis v2.0.0',
    };

    officeStore.getState().appendOfficeEvent(event);

    const state = officeStore.getState();
    expect(state.toasts.length).toBe(1);
    expect(state.toasts[0].kind).toBe('task_done');
    expect(state.toasts[0].agent).toBe('relay');

    expect(state.flyingIcons.length).toBe(1);
    expect(state.flyingIcons[0].agentId).toBe('relay');
    expect(state.flyingIcons[0].kind).toBe('task_done');
  });

  it('tidak memicu task toast untuk event jenis lain seperti task_commented atau vitals_alert', () => {
    const eventComment: OfficeEvent = {
      seq: 203,
      ts: 1791030100,
      board: 'office-v2',
      kind: 'task_commented',
      agent: 'bastion',
      actor: 'jarvis',
      message: 'Jarvis menambahkan komentar koordinasi',
    };

    officeStore.getState().appendOfficeEvent(eventComment);
    expect(officeStore.getState().toasts.length).toBe(0);
    expect(officeStore.getState().flyingIcons.length).toBe(0);
  });
});
