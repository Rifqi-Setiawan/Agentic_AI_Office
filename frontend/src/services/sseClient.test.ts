import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { OfficeSSEClient } from './sseClient';
import { officeStore } from '../store/officeStore';
import { getFreshMockSnapshot } from '../mocks/fixtures';

class MockEventSource {
  static instances: MockEventSource[] = [];
  url: string;
  onopen: (() => void) | null = null;
  onerror: ((err: unknown) => void) | null = null;
  listeners: Record<string, ((e: MessageEvent) => void)[]> = {};

  constructor(url: string) {
    this.url = url;
    MockEventSource.instances.push(this);
  }

  addEventListener(event: string, cb: (e: MessageEvent) => void) {
    this.listeners[event] = this.listeners[event] || [];
    this.listeners[event].push(cb);
  }

  emit(event: string, data: unknown, lastEventId?: string) {
    const list = this.listeners[event] || [];
    const eventObj = {
      data: typeof data === 'string' ? data : JSON.stringify(data),
      lastEventId: lastEventId || '',
    } as MessageEvent;
    for (const cb of list) {
      cb(eventObj);
    }
  }

  close() {}
}

describe('OfficeSSEClient (Backoff & Fallback Polling)', () => {
  let client: OfficeSSEClient;

  beforeEach(() => {
    vi.useFakeTimers();
    MockEventSource.instances = [];
    vi.stubGlobal('EventSource', MockEventSource);
    officeStore.getState().reset();

    client = new OfficeSSEClient({
      streamUrl: '/api/v1/stream',
      snapshotUrl: '/api/v1/snapshot',
      initialBackoffMs: 1000,
      maxBackoffMs: 30000,
      backoffMultiplier: 2,
      fallbackPollIntervalMs: 5000,
    });
  });

  afterEach(() => {
    client.stop();
    vi.clearAllTimers();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('initializes with default backoff 1000 ms', () => {
    expect(client.getCurrentBackoffMs()).toBe(1000);
    expect(client.isFallbackPollingActive()).toBe(false);
  });

  it('performs exponential backoff on disconnect up to 30000 ms', () => {
    client.start();
    expect(MockEventSource.instances.length).toBe(1);

    // 1st disconnect: delay = 1000ms, next = 2000ms
    client.handleDisconnect('Gagal koneksi 1');
    expect(client.getCurrentBackoffMs()).toBe(2000);
    expect(client.isFallbackPollingActive()).toBe(true);

    // 2nd disconnect: delay = 2000ms, next = 4000ms
    client.handleDisconnect('Gagal koneksi 2');
    expect(client.getCurrentBackoffMs()).toBe(4000);

    // 3rd disconnect: 4000ms -> 8000ms
    client.handleDisconnect('Gagal koneksi 3');
    expect(client.getCurrentBackoffMs()).toBe(8000);

    // 4th disconnect: 8000ms -> 16000ms
    client.handleDisconnect('Gagal koneksi 4');
    expect(client.getCurrentBackoffMs()).toBe(16000);

    // 5th disconnect: 16000ms -> 30000ms (capped at max 30s)
    client.handleDisconnect('Gagal koneksi 5');
    expect(client.getCurrentBackoffMs()).toBe(30000);

    // 6th disconnect: remains at max 30000ms
    client.handleDisconnect('Gagal koneksi 6');
    expect(client.getCurrentBackoffMs()).toBe(30000);
  });

  it('triggers fallback snapshot polling every 5000 ms during disconnect', async () => {
    const mockSnapshot = getFreshMockSnapshot();
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockSnapshot,
    });
    vi.stubGlobal('fetch', fetchMock);

    client.start();
    client.handleDisconnect('Koneksi terputus');

    expect(client.isFallbackPollingActive()).toBe(true);
    // Polling pertama dipanggil segera saat disconnect
    expect(fetchMock).toHaveBeenCalledTimes(1);

    // Maju 5 detik -> polling kedua dipanggil
    await vi.advanceTimersByTimeAsync(5000);
    expect(fetchMock).toHaveBeenCalledTimes(2);

    // Maju 5 detik lagi -> polling ketiga dipanggil
    await vi.advanceTimersByTimeAsync(5000);
    expect(fetchMock).toHaveBeenCalledTimes(3);

    // Snapshot berhasil diaplikasikan ke store
    expect(officeStore.getState().snapshot).toEqual(mockSnapshot);
    expect(officeStore.getState().connectionStatus).toBe('fallback_polling');
  });

  it('dispatches SSE events properly to officeStore', () => {
    client.start();
    const es = MockEventSource.instances[0];
    expect(es).toBeDefined();

    // Trigger onopen
    es.onopen?.();
    expect(officeStore.getState().connectionStatus).toBe('connected');

    // Trigger snapshot event
    const snapshot = getFreshMockSnapshot();
    es.emit('snapshot', snapshot);
    expect(officeStore.getState().snapshot).toEqual(snapshot);
    expect(officeStore.getState().lastSeq).toBe(142);

    // Trigger agent event
    const agentDelta = {
      ...snapshot.agents[0],
      work: 'working' as const,
      action: 'Aksi baru dari SSE',
    };
    es.emit('agent', agentDelta, '143');
    expect(officeStore.getState().agents['jarvis'].action).toBe('Aksi baru dari SSE');
    expect(officeStore.getState().lastSeq).toBe(143);

    // Trigger vitals event
    const vitals = {
      cpu_percent: 29.5,
      memory_percent: 48.0,
      disk_percent: 60.0,
      status: 'healthy' as const,
      details: null,
    };
    es.emit('vitals', vitals);
    expect(officeStore.getState().vitals?.cpu_percent).toBe(29.5);
  });

  it('stops fallback polling and cleans up when stopped', () => {
    client.start();
    client.handleDisconnect('Putus');
    expect(client.isFallbackPollingActive()).toBe(true);

    client.stop();
    expect(client.isFallbackPollingActive()).toBe(false);
    expect(officeStore.getState().connectionStatus).toBe('disconnected');
  });
});
