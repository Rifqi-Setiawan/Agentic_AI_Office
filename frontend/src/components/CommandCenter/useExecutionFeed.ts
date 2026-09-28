import { useEffect, useRef, useState } from 'react'
import { canReplace, decodeSnapshot } from './executionProtocol'
import type { ExecutionSnapshot } from './graphModel'
export type ConnectionState = 'connecting' | 'live' | 'polling' | 'reconnecting' | 'unauthorized' | 'stale'
export interface ExecutionFeed {
  snapshot: ExecutionSnapshot | null; elapsedMs: number; connection: ConnectionState; error: string | null
}
export function useExecutionFeed(base = '/api/v1/execution'): ExecutionFeed {
  const [snapshot, setSnapshot] = useState<ExecutionSnapshot | null>(null)
  const [connection, setConnection] = useState<ConnectionState>('connecting')
  const [error, setError] = useState<string | null>(null)
  const [tick, setTick] = useState(0)
  const latest = useRef<ExecutionSnapshot | null>(null)
  const receivedAt = useRef<number | null>(null)
  useEffect(() => {
    // Same-origin only: credentials must never be sent to a configured third party.
    if (!base.startsWith('/') || base.startsWith('//') || base.includes('?') || base.includes('#')) {
      setError('Alamat telemetry harus berupa path pada origin yang sama.')
      setConnection('stale')
      return
    }
    let disposed = false, generation = 0, failures = 0
    let stream: EventSource | null = null
    let timer: ReturnType<typeof setTimeout> | undefined
    let controller: AbortController | null = null
    latest.current = null; receivedAt.current = null; setSnapshot(null); setConnection('connecting')
    const accept = (raw: unknown, mode: 'live' | 'polling') => {
      const next = decodeSnapshot(raw)
      if (!canReplace(latest.current, next)) return
      latest.current = next
      receivedAt.current = performance.now()
      setSnapshot(next); setConnection(mode); setError(null)
    }
    const schedule = () => {
      if (disposed || timer !== undefined) return
      stream?.close(); stream = null
      setConnection(latest.current ? 'polling' : 'reconnecting')
      const delay = Math.min(10000, 1000 * (2 ** Math.min(failures++, 4))) + Math.random() * 250
      timer = setTimeout(() => { timer = undefined; void connect() }, delay)
    }
    const connect = async () => {
      const current = ++generation
      controller?.abort(); controller = new AbortController()
      const requestController = controller
      const timeout = setTimeout(() => requestController.abort(), 7000)
      try {
        const response = await fetch(`${base}/snapshot`, { credentials: 'same-origin', cache: 'no-store', signal: controller.signal })
        if (disposed || current !== generation) return
        if (response.status === 401 || response.status === 403) {
          latest.current = null; receivedAt.current = null; setSnapshot(null)
          stream?.close(); stream = null
          setConnection('unauthorized'); setError('Akses telemetry ditolak. Periksa sesi atau autentikasi reverse proxy.')
          return
        }
        if (!response.ok) throw new Error(`Telemetry HTTP ${response.status}`)
        const body: unknown = await response.json()
        if (disposed || current !== generation) return
        accept(body, 'polling')
        stream = new EventSource(`${base}/events`, { withCredentials: true })
        const disconnect = () => {
          if (disposed || current !== generation) return
          generation++
          schedule()
        }
        stream.addEventListener('delegation_snapshot', event => {
          if (disposed || current !== generation) return
          try {
            const data: unknown = JSON.parse((event as MessageEvent<string>).data)
            accept(data, 'live'); failures = 0
          } catch {
            setError('Payload delegasi tidak valid; snapshot terakhir akan kedaluwarsa.')
            disconnect()
          }
        })
        stream.addEventListener('stream_error', disconnect)
        stream.onerror = disconnect
      } catch (caught) {
        if (!disposed && current === generation) {
          setError(caught instanceof Error ? caught.message : 'Telemetry tidak tersedia')
          schedule()
        }
      } finally { clearTimeout(timeout) }
    }
    void connect()
    const clock = setInterval(() => {
      setTick(value => value + 1)
      // A proxy may hold an SSE socket open without forwarding any frames.
      if (stream && receivedAt.current !== null && performance.now() - receivedAt.current > 13000) {
        generation++; schedule()
      }
    }, 500)
    return () => {
      disposed = true; generation++
      controller?.abort(); stream?.close()
      clearTimeout(timer); clearInterval(clock)
    }
  }, [base])
  void tick
  const elapsedMs = receivedAt.current === null ? Number.POSITIVE_INFINITY : Math.max(0, performance.now() - receivedAt.current)
  const stale = snapshot !== null && elapsedMs >= snapshot.freshness_ttl_ms
  return { snapshot, elapsedMs, connection: stale && connection !== 'unauthorized' ? 'stale' : connection, error }
}
