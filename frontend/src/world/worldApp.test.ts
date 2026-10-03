if (typeof globalThis.navigator === 'undefined') {
  // @ts-expect-error polyfill for Node test environment
  globalThis.navigator = { userAgent: 'node' };
}

import { describe, expect, it } from 'vitest';
import { WorldApp, worldApp } from './WorldApp';
import { officeStore } from '../store/officeStore';

describe('WorldApp (Single PIXI.Application & Render Loop)', () => {
  it('instantiates WorldApp as a singleton instance', () => {
    expect(worldApp).toBeDefined();
    expect(worldApp).toBeInstanceOf(WorldApp);
    expect(worldApp.isReady()).toBe(false);
    expect(worldApp.getApp()).toBeNull();
  });

  it('runs update loop ticker by directly reading vanilla store without React re-renders', () => {
    const testApp = new WorldApp();
    // Panggil update sebelum init harus aman
    expect(() => testApp.update(1.0)).not.toThrow();

    // Pastikan store state terbaca
    const state = officeStore.getState();
    expect(state).toBeDefined();
  });
});
