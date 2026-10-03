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
