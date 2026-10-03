if (typeof globalThis.navigator === 'undefined') {
  // @ts-expect-error polyfill for Node test environment
  globalThis.navigator = { userAgent: 'node' };
}

import { describe, expect, it } from 'vitest';
import { App } from './App';

describe('Frontend scaffold', () => {
  it('exports App component successfully', () => {
    expect(App).toBeDefined();
    expect(typeof App).toBe('function');
  });

  it('verifies basic math and test runner setup', () => {
    expect(1 + 1).toBe(2);
  });
});
