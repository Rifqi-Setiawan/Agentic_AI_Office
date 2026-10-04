if (typeof globalThis.navigator === 'undefined') {
  // @ts-expect-error polyfill for Node test environment
  globalThis.navigator = { userAgent: 'node' };
}

if (typeof globalThis.requestAnimationFrame === 'undefined') {
  globalThis.requestAnimationFrame = (callback: FrameRequestCallback): number => {
    return Number(setTimeout(() => callback(Date.now()), 16));
  };
}

if (typeof globalThis.cancelAnimationFrame === 'undefined') {
  globalThis.cancelAnimationFrame = (id: number): void => {
    clearTimeout(id);
  };
}

// Always install in-memory mock for Node test environment
{
  class MockStorage implements Storage {
    private store: Record<string, string> = {};
    public getItem(key: string): string | null {
      return Object.prototype.hasOwnProperty.call(this.store, key) ? this.store[key] : null;
    }
    public setItem(key: string, value: string): void {
      this.store[key] = String(value);
    }
    public removeItem(key: string): void {
      delete this.store[key];
    }
    public clear(): void {
      this.store = {};
    }
    public key(index: number): string | null {
      return Object.keys(this.store)[index] ?? null;
    }
    public get length(): number {
      return Object.keys(this.store).length;
    }
  }

  if (typeof globalThis.Storage === 'undefined') {
    (globalThis as unknown as { Storage: unknown }).Storage = MockStorage;
  }

  const mockStorage = new MockStorage();
  Object.defineProperty(globalThis, 'localStorage', {
    value: mockStorage,
    writable: true,
    configurable: true,
  });
  if (typeof window !== 'undefined') {
    Object.defineProperty(window, 'localStorage', {
      value: mockStorage,
      writable: true,
      configurable: true,
    });
  }
}
