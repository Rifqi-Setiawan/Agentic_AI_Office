if (typeof globalThis.navigator === 'undefined') {
  // @ts-expect-error polyfill for Node test environment
  globalThis.navigator = { userAgent: 'node' };
}
