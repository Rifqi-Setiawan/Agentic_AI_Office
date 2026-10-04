/**
 * Modul penyimpanan lokal (localStorage) untuk preferensi Mode Jujur (F22).
 * Sesuai Acceptance Criteria:
 * - Toggle tersimpan per viewer (localStorage, dengan try/catch).
 */

export const HONEST_MODE_STORAGE_KEY = 'office_honest_mode';

function getStorage(): Storage | null {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      return window.localStorage;
    }
    if (typeof globalThis !== 'undefined' && globalThis.localStorage) {
      return globalThis.localStorage;
    }
  } catch (err) {
    console.warn('[ModeJujur] Akses ke storage diblokir:', err);
  }
  return null;
}

/**
 * Membaca status Mode Jujur dari localStorage dengan pembungkus try/catch.
 * Aman dipanggil di lingkungan SSR, headless testing, atau ketika browser
 * memblokir akses storage (Private Browsing / SecurityError).
 */
export function getSavedHonestMode(): boolean {
  try {
    const storage = getStorage();
    if (storage) {
      const val = storage.getItem(HONEST_MODE_STORAGE_KEY);
      return val === 'true';
    }
  } catch (err) {
    console.warn('[ModeJujur] Gagal membaca preferensi dari localStorage:', err);
  }
  return false;
}

/**
 * Menyimpan status Mode Jujur ke localStorage dengan pembungkus try/catch.
 */
export function saveHonestMode(enabled: boolean): void {
  try {
    const storage = getStorage();
    if (storage) {
      storage.setItem(HONEST_MODE_STORAGE_KEY, String(enabled));
    }
  } catch (err) {
    console.warn('[ModeJujur] Gagal menyimpan preferensi ke localStorage:', err);
  }
}
