import { officeStore } from '../store/officeStore';
import type {
  AgentState,
  CollectiveEventState,
  HostVitals,
  OfficeEvent,
  WorldSnapshot,
} from '../types/office';

export interface SSEClientOptions {
  streamUrl?: string;
  snapshotUrl?: string;
  initialBackoffMs?: number;
  maxBackoffMs?: number;
  backoffMultiplier?: number;
  fallbackPollIntervalMs?: number;
  enableFallbackPolling?: boolean;
}

export class OfficeSSEClient {
  private streamUrl: string;
  private snapshotUrl: string;
  private initialBackoffMs: number;
  private maxBackoffMs: number;
  private backoffMultiplier: number;
  private fallbackPollIntervalMs: number;
  private enableFallbackPolling: boolean;

  private currentBackoffMs: number;
  private isRunning = false;
  private eventSource: EventSource | null = null;
  private reconnectTimeoutId: ReturnType<typeof setTimeout> | null = null;
  private fallbackPollIntervalId: ReturnType<typeof setInterval> | null = null;
  private isPollingActive = false;

  constructor(options: SSEClientOptions = {}) {
    this.streamUrl = options.streamUrl ?? '/api/v1/stream';
    this.snapshotUrl = options.snapshotUrl ?? '/api/v1/snapshot';
    this.initialBackoffMs = options.initialBackoffMs ?? 1000;
    this.maxBackoffMs = options.maxBackoffMs ?? 30000;
    this.backoffMultiplier = options.backoffMultiplier ?? 2;
    this.fallbackPollIntervalMs = options.fallbackPollIntervalMs ?? 5000;
    this.enableFallbackPolling = options.enableFallbackPolling ?? true;

    this.currentBackoffMs = this.initialBackoffMs;
  }

  public getCurrentBackoffMs(): number {
    return this.currentBackoffMs;
  }

  public isFallbackPollingActive(): boolean {
    return this.isPollingActive;
  }

  public start(): void {
    if (this.isRunning) return;
    this.isRunning = true;
    this.currentBackoffMs = this.initialBackoffMs;
    this.connect();
  }

  public stop(): void {
    this.isRunning = false;
    this.closeEventSource();
    this.clearReconnectTimeout();
    this.stopFallbackPolling();
    officeStore.getState().setConnectionStatus('disconnected');
  }

  private connect(): void {
    if (!this.isRunning) return;

    this.closeEventSource();
    this.clearReconnectTimeout();

    officeStore.getState().setConnectionStatus(
      this.isPollingActive ? 'fallback_polling' : 'connecting',
    );

    try {
      // Periksa ketersediaan EventSource di browser / environment
      if (typeof EventSource === 'undefined') {
        this.handleDisconnect('EventSource tidak didukung oleh runtime ini');
        return;
      }

      const baseUrl =
        typeof window !== 'undefined' && window.location && window.location.origin
          ? window.location.origin
          : 'http://localhost';
      const streamFullUrl = this.streamUrl.startsWith('http')
        ? this.streamUrl
        : `${baseUrl}${this.streamUrl}`;

      const lastSeq = officeStore.getState().lastSeq;
      const url = new URL(streamFullUrl);
      if (lastSeq > 0) {
        url.searchParams.set('last_event_id', String(lastSeq));
      }

      const es = new EventSource(url.toString());
      this.eventSource = es;

      es.onopen = () => {
        // Koneksi berhasil: reset backoff dan hentikan fallback polling
        this.currentBackoffMs = this.initialBackoffMs;
        this.stopFallbackPolling();
        officeStore.getState().setConnectionStatus('connected');
      };

      // Handler untuk event 'snapshot'
      es.addEventListener('snapshot', (e: MessageEvent) => {
        try {
          const snapshot: WorldSnapshot = JSON.parse(e.data);
          officeStore.getState().applySnapshot(snapshot);
        } catch (err) {
          console.error('[SSE] Gagal mengurai event snapshot:', err);
        }
      });

      // Handler untuk event 'agent' (delta perubahan satu agen)
      es.addEventListener('agent', (e: MessageEvent) => {
        try {
          const agent: AgentState = JSON.parse(e.data);
          const seq = e.lastEventId ? parseInt(e.lastEventId, 10) : undefined;
          officeStore.getState().updateAgentDelta(agent, seq);
        } catch (err) {
          console.error('[SSE] Gagal mengurai event agent delta:', err);
        }
      });

      // Handler untuk event 'event' (feed aktivitas kantor)
      es.addEventListener('event', (e: MessageEvent) => {
        try {
          const officeEvent: OfficeEvent = JSON.parse(e.data);
          const seq = e.lastEventId ? parseInt(e.lastEventId, 10) : undefined;
          officeStore.getState().appendOfficeEvent(officeEvent, seq);
        } catch (err) {
          console.error('[SSE] Gagal mengurai event office feed:', err);
        }
      });

      // Handler untuk event 'vitals' (telemetri host CPU/RAM/Disk)
      es.addEventListener('vitals', (e: MessageEvent) => {
        try {
          const vitals: HostVitals = JSON.parse(e.data);
          officeStore.getState().updateVitals(vitals);
        } catch (err) {
          console.error('[SSE] Gagal mengurai event host vitals:', err);
        }
      });

      // Handler untuk event 'collective' (rapat, break, sholat)
      es.addEventListener('collective', (e: MessageEvent) => {
        try {
          const collective: CollectiveEventState | null = e.data ? JSON.parse(e.data) : null;
          const seq = e.lastEventId ? parseInt(e.lastEventId, 10) : undefined;
          officeStore.getState().updateCollective(collective, seq);
        } catch (err) {
          console.error('[SSE] Gagal mengurai event collective:', err);
        }
      });

      es.onerror = (err) => {
        console.warn('[SSE] Koneksi SSE terputus atau gagal:', err);
        this.handleDisconnect('Koneksi stream SSE terputus');
      };
    } catch (err) {
      console.error('[SSE] Inisialisasi EventSource gagal:', err);
      this.handleDisconnect('Inisialisasi EventSource gagal');
    }
  }

  public handleDisconnect(reason?: string): void {
    if (!this.isRunning) return;

    this.closeEventSource();
    if (reason) {
      officeStore.getState().setError(reason);
    }

    // Aktifkan fallback polling tiap 5 detik jika belum aktif
    if (this.enableFallbackPolling) {
      this.startFallbackPolling();
    } else {
      officeStore.getState().setConnectionStatus('reconnecting');
    }

    // Jadwalkan rekoneksi SSE dengan backoff eksponensial (1s -> 30s)
    const delay = this.currentBackoffMs;
    this.currentBackoffMs = Math.min(
      this.maxBackoffMs,
      Math.round(this.currentBackoffMs * this.backoffMultiplier),
    );

    this.clearReconnectTimeout();
    this.reconnectTimeoutId = setTimeout(() => {
      if (this.isRunning) {
        this.connect();
      }
    }, delay);
  }

  public async pollSnapshotOnce(): Promise<WorldSnapshot | null> {
    try {
      const baseUrl =
        typeof window !== 'undefined' && window.location && window.location.origin
          ? window.location.origin
          : 'http://localhost';
      const resolvedUrl = this.snapshotUrl.startsWith('http')
        ? this.snapshotUrl
        : `${baseUrl}${this.snapshotUrl}`;

      const res = await fetch(resolvedUrl, {
        headers: { Accept: 'application/json' },
      });
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      }
      const snapshot: WorldSnapshot = await res.json();
      officeStore.getState().applySnapshot(snapshot);
      officeStore.getState().setConnectionStatus('fallback_polling');
      return snapshot;
    } catch (err) {
      console.warn('[SSE] Fallback polling snapshot gagal:', err);
      return null;
    }
  }

  private startFallbackPolling(): void {
    if (this.isPollingActive) return;
    this.isPollingActive = true;
    officeStore.getState().setConnectionStatus('fallback_polling');

    // Lakukan polling pertama segera
    this.pollSnapshotOnce();

    // Jalankan interval periodik tiap 5 detik
    this.fallbackPollIntervalId = setInterval(() => {
      if (this.isRunning && this.isPollingActive) {
        this.pollSnapshotOnce();
      }
    }, this.fallbackPollIntervalMs);
  }

  private stopFallbackPolling(): void {
    this.isPollingActive = false;
    if (this.fallbackPollIntervalId !== null) {
      clearInterval(this.fallbackPollIntervalId);
      this.fallbackPollIntervalId = null;
    }
  }

  private closeEventSource(): void {
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }
  }

  private clearReconnectTimeout(): void {
    if (this.reconnectTimeoutId !== null) {
      clearTimeout(this.reconnectTimeoutId);
      this.reconnectTimeoutId = null;
    }
  }
}

export const sseClient = new OfficeSSEClient();
