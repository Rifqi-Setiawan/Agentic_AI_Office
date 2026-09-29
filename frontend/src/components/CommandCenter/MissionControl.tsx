import { useMemo, useState } from 'react'
import { ExecutionGraph } from './ExecutionGraph'
import { useExecutionFeed } from './useExecutionFeed'
import { AgentDetailModal } from './AgentDetailModal'
import { AGENTS, AGENT_MAP, ROUTE_KEYS, activePairs, canonicalAgent, cleanText } from './graphModel'
import type { AgentId, LiveAgent } from './graphModel'
import type { ConnectionState } from './useExecutionFeed'
import './mission-control.css'

export interface MissionControlProps {
  agents: readonly LiveAgent[]
  events?: readonly unknown[]
  vitals?: unknown
  // Kept so the existing App.tsx remains source-compatible. No chat UI is rendered.
  messages?: readonly unknown[]
  onSendMessage?: (text: string) => void
  activeView?: 'mission-control' | 'spatial-office'
  onSwitchView?: (view: 'mission-control' | 'spatial-office') => void
  executionApiBase?: string
  initialTheme?: 'dark' | 'light'
}
const CONNECTION_LABEL: Record<ConnectionState, string> = {
  connecting: 'Menghubungkan', live: 'SSE tersambung', polling: 'REST snapshot',
  reconnecting: 'Menghubungkan ulang', unauthorized: 'Akses ditolak', stale: 'Data kedaluwarsa',
}
const EVENT_LABELS: Record<string, string> = {
  'span.queued': 'Delegasi masuk antrean', 'span.running': 'Pengerjaan dimulai',
  'span.waiting': 'Menunggu hasil turunan', 'span.completed': 'Delegasi selesai',
  'span.failed': 'Delegasi gagal', 'span.cancelled': 'Delegasi dibatalkan', 'span.expired': 'Lease kedaluwarsa',
  'task.created': 'Kontrak tugas dibuat', 'artifact.submitted': 'Artefak siap diperiksa',
  'artifact.approved': 'Verifikasi disetujui', 'artifact.rejected': 'Verifikasi ditolak',
  'release.authorized': 'Izin rilis diterbitkan', 'release.confirmed': 'Publikasi dikonfirmasi',
}
const GATE_LABELS: Record<string, string> = {
  implementing: 'Implementasi', review: 'Menunggu QA', rejected: 'Perlu perbaikan',
  verified: 'Lolos QA', release_authorized: 'Rilis diizinkan', released: 'Dipublikasikan',
}
function object(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
}
function metric(value: unknown, suffix = ''): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 'Tidak tersedia'
  return `${value.toLocaleString('id-ID', { maximumFractionDigits: 1 })}${suffix}`
}
function clock(value: number): string {
  return new Date(value).toLocaleTimeString('id-ID', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })
}
export function MissionControl({ agents, events = [], vitals, executionApiBase, initialTheme = 'dark' }: MissionControlProps) {
  const feed = useExecutionFeed(executionApiBase)
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null)
  const [missionId, setMissionId] = useState<string | null>(null)
  const [theme, setTheme] = useState(initialTheme)
  const activity = useMemo(() => activePairs(feed.snapshot, feed.elapsedMs, missionId), [feed.snapshot, feed.elapsedMs, missionId])
  const calls = [...activity.values()].flatMap(pair => pair.invocations)
  const activeAgentCount = new Set([...activity.values()].map(pair => pair.callee)).size
  const offGraph = [...activity.entries()].filter(([key]) => !ROUTE_KEYS.has(key)).map(([, pair]) => pair)
  const missionIds = [...new Set(feed.snapshot?.caller_callee_pairs.flatMap(pair => pair.invocations.map(call => call.mission_id)) ?? [])].sort()
  const selectedId = selectedAgentId ? canonicalAgent(selectedAgentId) : null
  const selected = selectedId ? AGENT_MAP.get(selectedId) : null
  const live = agents.find(agent => canonicalAgent(agent.id) === selectedId)
  const selectedCalls = selectedId ? [...activity.values()].filter(pair => pair.caller === selectedId || pair.callee === selectedId) : []
  const hostVitals = object(vitals)
  const visibleEvents = (feed.snapshot?.recent_events ?? []).filter(event => !missionId || event.mission_id === missionId)
  const legacyEvents = events.slice(0, 15).map(object)
  const gates = (feed.snapshot?.release_gates ?? []).filter(gate => !missionId || gate.mission_id === missionId)
  const snapshotFresh = feed.snapshot !== null && feed.elapsedMs < feed.snapshot.freshness_ttl_ms
  return (
    <div className="mc-shell" data-theme={theme}>
      <header className="mc-header">
        <div className="mc-brand"><span className="mc-brand__mark" aria-hidden="true">H</span>
          <div><h1>Hermes Sovereign</h1><p>Mission Control</p></div>
        </div>
        <div className="mc-header__right">
          <span className={`mc-connection${snapshotFresh ? ' mc-connection--fresh' : ''}`} role="status">
            <i aria-hidden="true" />{CONNECTION_LABEL[feed.connection]}
          </span>
          <button type="button" className="mc-button" onClick={() => setTheme(current => current === 'dark' ? 'light' : 'dark')}
            aria-label={`Gunakan tema ${theme === 'dark' ? 'terang' : 'gelap'}`}>{theme === 'dark' ? 'Terang' : 'Gelap'}</button>
        </div>
      </header>
      <main className="mc-main">
        <section className="mc-canvas-section" aria-label="Peta delegasi">
          <div className="mc-toolbar">
            <div><h2>Struktur komando</h2><p>13 agen AI dan 1 otoritas manusia</p></div>
            <label className="mc-filter"><span>Misi</span><select value={missionId ?? ''} onChange={event => setMissionId(event.target.value || null)}>
              <option value="">Semua misi</option>
              {missionId && !missionIds.includes(missionId) && <option value={missionId}>{missionId} (tidak aktif)</option>}
              {missionIds.map(id => <option key={id} value={id}>{id}</option>)}
            </select></label>
          </div>
          <ExecutionGraph agents={agents} onInspectAgent={setSelectedAgentId} snapshot={feed.snapshot}
            elapsedMs={feed.elapsedMs} missionId={missionId} selectedAgentId={selectedAgentId} theme={theme} />
          <div className="mc-canvas-caption">
            {!snapshotFresh ? 'Jalur aktif disembunyikan sampai snapshot valid tersedia.' :
              !feed.snapshot?.instrumentation_seen ? 'Belum ada event delegasi dari runtime. Status kartu tidak menyalakan garis.' :
              `${activity.size} jalur aktif. Klik kartu untuk detail; gunakan zoom agar teks tetap nyaman dibaca.`}
          </div>
        </section>
        <aside className="mc-sidebar" aria-label="Telemetry dan inspeksi agen">
          <section className="mc-section">
            <div className="mc-section__heading"><h2>Eksekusi saat ini</h2><span>{snapshotFresh ? 'Tervalidasi' : 'Tidak mutakhir'}</span></div>
            <div className="mc-stats">
              <div><strong>{snapshotFresh ? activeAgentCount : '-'}</strong><span>Agen terlibat</span></div>
              <div><strong>{snapshotFresh ? calls.length : '-'}</strong><span>Panggilan aktif</span></div>
              <div><strong>{snapshotFresh ? feed.snapshot?.queued_count : '-'}</strong><span>Antrean global</span></div>
            </div>
            {feed.error && <p className="mc-notice" role="status">{cleanText(feed.error)}</p>}
            <dl className="mc-vitals"><div><dt>Load 1 menit</dt><dd>{metric(hostVitals.load_1m)}</dd></div>
              <div><dt>RAM terpakai</dt><dd>{metric(hostVitals.ram_used_gib, ' GiB')}</dd></div>
              <div><dt>RAM total</dt><dd>{metric(hostVitals.ram_total_gib, ' GiB')}</dd></div>
            </dl>
          </section>
          {selected && (
            <section className="mc-section mc-inspector" aria-label={`Detail ${selected.name}`}>
              <div className="mc-section__heading"><h2>{selected.name}</h2>
                <button type="button" className="mc-link-button" onClick={() => setSelectedAgentId(null)}>Tutup</button></div>
              <dl><div><dt>ID runtime</dt><dd>{selected.id}</dd></div><div><dt>Mandat</dt><dd>{selected.title}</dd></div>
                <div><dt>Model</dt><dd>{selected.id === 'rifqi' ? 'Otoritas manusia' : cleanText(live?.model)}</dd></div>
                <div><dt>Aktivitas roster</dt><dd>{cleanText(live?.status_desc ?? live?.task, 'Belum dilaporkan')}</dd></div></dl>
              <p className="mc-muted">Status roster dan event delegasi adalah dua sumber data yang berbeda.</p>
              {selectedCalls.map(pair => <div className="mc-pair-detail" key={`${pair.caller}:${pair.callee}`}>
                <strong>{AGENT_MAP.get(pair.caller)?.name} ke {AGENT_MAP.get(pair.callee)?.name}</strong>
                {pair.invocations.slice(0, 20).map(call => <p key={call.span_id}>{call.task_id} / {call.state === 'running' ? 'berjalan' : 'menunggu'}</p>)}
                {pair.invocations.length > 20 && <p>Menampilkan 20 dari {pair.invocations.length} panggilan.</p>}
              </div>)}
            </section>
          )}
          {offGraph.length > 0 && <section className="mc-section">
            <div className="mc-section__heading"><h2>Delegasi lintas divisi</h2><span>{offGraph.length} jalur</span></div>
            <p className="mc-muted">Relasi nyata di luar pohon organisasi; tidak dialihkan melalui agen lain.</p>
            {offGraph.map(pair => <div className="mc-pair-detail" key={`${pair.caller}:${pair.callee}`}>
              <strong>{AGENT_MAP.get(pair.caller)?.name} ke {AGENT_MAP.get(pair.callee)?.name}</strong>
              <p>{pair.invocations.length} panggilan aktif</p>
            </div>)}
          </section>}
          {gates.length > 0 && <section className="mc-section">
            <div className="mc-section__heading"><h2>Gerbang verifikasi</h2><span>{gates.length} tugas terbaru</span></div>
            {gates.slice(0, 6).map(gate => <div className="mc-gate" key={gate.task_id}>
              <strong>{cleanText(gate.task_id)}</strong><span>{GATE_LABELS[gate.state] ?? cleanText(gate.state)}</span>
              <p>Percobaan {gate.attempt} / versi {gate.version}{!snapshotFresh ? ' / data terakhir' : ''}</p>
            </div>)}
          </section>}
          <section className="mc-section mc-telemetry">
            <div className="mc-section__heading"><h2>Telemetry</h2><span>{snapshotFresh ? 'Event runtime' : 'Riwayat terakhir'}</span></div>
            {visibleEvents.length ? <ol className="mc-events">{visibleEvents.map(event => (
              <li key={event.seq}><div><strong>{EVENT_LABELS[event.kind] ?? cleanText(event.kind)}</strong><time dateTime={new Date(event.at_ms).toISOString()}>{clock(event.at_ms)}</time></div>
                <p>{cleanText(event.actor)}{event.task_id ? ` / ${cleanText(event.task_id)}` : ''}</p></li>
            ))}</ol> : legacyEvents.length && !missionId ? <>
              <p className="mc-muted">Telemetry legacy; tidak digunakan untuk menentukan jalur aktif.</p>
              <ol className="mc-events">{legacyEvents.map((event, index) => <li key={index}>
                <strong>{cleanText(event.tool_name ?? event.tool ?? event.type, 'Event roster')}</strong>
                <p>{cleanText(event.agent_id ?? event.agentId ?? event.agent, 'Identitas tidak tersedia')}</p>
              </li>)}</ol>
            </> : <p className="mc-empty">Belum ada event yang cocok. Tidak ada data simulasi.</p>}
          </section>
          <footer className="mc-sidebar-footer">{AGENTS.length} simpul / revision {feed.snapshot?.revision ?? '-'} / {snapshotFresh ? 'snapshot mutakhir' : 'menunggu snapshot'}</footer>
        </aside>
      </main>
      {selectedAgentId && (
        <AgentDetailModal
          agentId={selectedAgentId}
          onClose={() => setSelectedAgentId(null)}
          agents={agents}
          snapshot={feed.snapshot}
          elapsedMs={feed.elapsedMs}
          theme={theme}
        />
      )}
    </div>
  )
}
