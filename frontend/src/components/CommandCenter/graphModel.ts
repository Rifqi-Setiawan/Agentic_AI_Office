/** Pure graph geometry and delegation selectors: no React and no node-state inference. */
export const AGENT_IDS = [
  'rifqi', 'vps-boss', 'vps-assistant', 'professor', 'swe-backend',
  'swe-frontend', 'tech-mentor', 'data-engineer', 'paperwright', 'swe-verifier',
  'ui-designer', 'devops-engineer', 'github-manager', 'office-lead',
] as const
export type AgentId = typeof AGENT_IDS[number]
export interface Point { x: number; y: number }
export const CARD_WIDTH = 264
export const CARD_HEIGHT = 124
const row = (level: number) => 24 + level * 224
const at = (center: number, level: number): Point => ({ x: center - CARD_WIDTH / 2, y: row(level) })
export interface AgentDefinition {
  id: AgentId; name: string; title: string; level: number; position: Point
}
export const AGENTS: readonly AgentDefinition[] = [
  { id: 'rifqi', name: 'Rifqi Setiawan', title: 'Founder dan otoritas tertinggi', level: 0, position: at(868, 0) },
  { id: 'vps-boss', name: 'Jarvis', title: 'Orkestrasi dan perencanaan', level: 1, position: at(868, 1) },
  { id: 'vps-assistant', name: 'vps-assistant', title: 'Asisten eksekutif dan co-pilot', level: 1, position: at(1196, 1) },
  { id: 'professor', name: 'Senku', title: 'Riset dan sains', level: 2, position: at(296, 2) },
  { id: 'swe-backend', name: 'swe-backend', title: 'API dan rekayasa backend', level: 2, position: at(788, 2) },
  { id: 'swe-frontend', name: 'swe-frontend', title: 'Antarmuka dan frontend', level: 2, position: at(1116, 2) },
  { id: 'tech-mentor', name: 'tech-mentor', title: 'Arsitektur dan sistem', level: 2, position: at(1444, 2) },
  { id: 'data-engineer', name: 'data-engineer', title: 'Data pipeline dan lakehouse', level: 3, position: at(132, 3) },
  { id: 'paperwright', name: 'paperwright', title: 'Naskah akademik dan LaTeX', level: 3, position: at(460, 3) },
  { id: 'swe-verifier', name: 'swe-QA', title: 'Verifikasi independen', level: 3, position: at(788, 3) },
  { id: 'ui-designer', name: 'ui-designer', title: 'Sistem desain', level: 3, position: at(1116, 3) },
  { id: 'devops-engineer', name: 'devops-engineer', title: 'SRE dan infrastruktur', level: 3, position: at(1444, 3) },
  { id: 'github-manager', name: 'github-manager', title: 'Gerbang rilis dan publikasi', level: 4, position: at(788, 4) },
  { id: 'office-lead', name: 'office-lead', title: 'Cockpit dan observabilitas', level: 4, position: at(1444, 4) },
]
export const AGENT_MAP = new Map(AGENTS.map(agent => [agent.id, agent]))
export function canonicalAgent(value: string): AgentId | null {
  const normalized = value.trim().toLowerCase()
  const id = ({ jarvis: 'vps-boss', senku: 'professor', 'swe-qa': 'swe-verifier' } as Record<string, string>)[normalized] ?? normalized
  return (AGENT_IDS as readonly string[]).includes(id) ? id as AgentId : null
}
export const pairKey = (caller: string, callee: string) => `${caller}->${callee}`
export interface Route {
  source: AgentId; target: AgentId; sourceOffset: number; laneOffset: number; horizontal?: boolean
}
export const ROUTES: readonly Route[] = [
  { source: 'rifqi', target: 'vps-boss', sourceOffset: 132, laneOffset: 50 },
  { source: 'vps-boss', target: 'vps-assistant', sourceOffset: 62, laneOffset: 0, horizontal: true },
  // Ordered independent ports. Outer branches bend before inner branches.
  { source: 'vps-boss', target: 'professor', sourceOffset: 40, laneOffset: 32 },
  { source: 'vps-boss', target: 'swe-backend', sourceOffset: 100, laneOffset: 68 },
  { source: 'vps-boss', target: 'swe-frontend', sourceOffset: 164, laneOffset: 68 },
  { source: 'vps-boss', target: 'tech-mentor', sourceOffset: 224, laneOffset: 32 },
  { source: 'professor', target: 'data-engineer', sourceOffset: 66, laneOffset: 50 },
  { source: 'professor', target: 'paperwright', sourceOffset: 198, laneOffset: 50 },
  { source: 'swe-backend', target: 'swe-verifier', sourceOffset: 132, laneOffset: 50 },
  { source: 'swe-frontend', target: 'ui-designer', sourceOffset: 132, laneOffset: 50 },
  { source: 'tech-mentor', target: 'devops-engineer', sourceOffset: 132, laneOffset: 50 },
  { source: 'swe-verifier', target: 'github-manager', sourceOffset: 132, laneOffset: 50 },
  { source: 'devops-engineer', target: 'office-lead', sourceOffset: 132, laneOffset: 50 },
]
export const ROUTE_KEYS = new Set(ROUTES.map(route => pairKey(route.source, route.target)))
export function routePoints(route: Route): Point[] {
  const source = AGENT_MAP.get(route.source)!.position
  const target = AGENT_MAP.get(route.target)!.position
  if (route.horizontal) return [
    { x: source.x + CARD_WIDTH, y: source.y + route.sourceOffset },
    { x: target.x, y: target.y + CARD_HEIGHT / 2 },
  ]
  const start = { x: source.x + route.sourceOffset, y: source.y + CARD_HEIGHT }
  const end = { x: target.x + CARD_WIDTH / 2, y: target.y }
  return [start, { x: start.x, y: start.y + route.laneOffset },
    { x: end.x, y: start.y + route.laneOffset }, end]
}
export function roundedPath(input: readonly Point[], radius = 8): string {
  const points = input.filter((point, index) => index === 0 || point.x !== input[index - 1].x || point.y !== input[index - 1].y)
  if (points.length < 2) return ''
  let path = `M ${points[0].x} ${points[0].y}`
  for (let index = 1; index < points.length - 1; index++) {
    const before = points[index - 1], current = points[index], after = points[index + 1]
    const incoming = Math.hypot(current.x - before.x, current.y - before.y)
    const outgoing = Math.hypot(after.x - current.x, after.y - current.y)
    const r = Math.min(radius, incoming / 2, outgoing / 2)
    const entry = { x: current.x + (before.x - current.x) * r / incoming, y: current.y + (before.y - current.y) * r / incoming }
    const exit = { x: current.x + (after.x - current.x) * r / outgoing, y: current.y + (after.y - current.y) * r / outgoing }
    path += ` L ${entry.x} ${entry.y} Q ${current.x} ${current.y} ${exit.x} ${exit.y}`
  }
  const last = points[points.length - 1]
  return `${path} L ${last.x} ${last.y}`
}

export interface DelegationChain {
  chain_id: string; mission_id: string; task_id: string; span_ids: string[]
  active_delegation_path: AgentId[]; expires_at_ms: number
}
export interface Invocation {
  span_id: string; mission_id: string; task_id: string
  state: 'running' | 'waiting'; expires_at_ms: number
}
export interface CallerCalleePair { caller: AgentId; callee: AgentId; invocations: Invocation[] }
export interface ExecutionEvent {
  seq: number; kind: string; at_ms: number; actor: string
  mission_id: string | null; task_id: string | null; span_id: string | null
}
export interface ReleaseGate {
  task_id: string; mission_id: string; state: string; version: number
  attempt: number; artifact_digest: string | null; updated_at_ms: number
}
export interface ExecutionSnapshot {
  schema_version: 1; type: 'delegation_snapshot'; stream_id: string; revision: number
  generated_at_ms: number; freshness_ttl_ms: number; instrumentation_seen: boolean
  active_delegation_chains: DelegationChain[]; caller_callee_pairs: CallerCalleePair[]
  queued_count: number; recent_events: ExecutionEvent[]; release_gates: ReleaseGate[]
}
export interface LiveAgent { id: string; name?: string; state?: string; model?: string; task?: unknown; status_desc?: string }
export type Activity = Map<string, { caller: AgentId; callee: AgentId; invocations: Invocation[] }>

/** Timestamps are compared using elapsed monotonic browser time, not browser wall clock. */
export function activePairs(snapshot: ExecutionSnapshot | null, elapsedMs: number, missionId: string | null = null): Activity {
  const result: Activity = new Map()
  if (!snapshot || elapsedMs < 0 || elapsedMs >= snapshot.freshness_ttl_ms) return result
  const serverNow = snapshot.generated_at_ms + elapsedMs
  for (const pair of snapshot.caller_callee_pairs) {
    const invocations = pair.invocations.filter(call => call.expires_at_ms > serverNow && (!missionId || call.mission_id === missionId))
    if (invocations.length) result.set(pairKey(pair.caller, pair.callee), { ...pair, invocations })
  }
  return result
}

/** Used when adapting a legacy single-path emitter: only ADJACENT pairs count. */
export function adjacentPairs(path: readonly string[]): Set<string> {
  const result = new Set<string>()
  for (let index = 0; index + 1 < path.length; index++) {
    const caller = canonicalAgent(path[index]), callee = canonicalAgent(path[index + 1])
    if (caller && callee) result.add(pairKey(caller, callee))
  }
  return result
}
export function cleanText(value: unknown, fallback = 'Tidak tersedia'): string {
  if (typeof value !== 'string') return fallback
  const clean = value.replace(/[\p{Extended_Pictographic}\p{Regional_Indicator}\u200D\uFE0E\uFE0F\u20E3]/gu, '')
    .replace(/[\u0000-\u001F\u007F]/g, ' ').trim()
  return clean || fallback
}
export function agentStatus(state: unknown): { label: string; tone: string } {
  const value = typeof state === 'string' ? state.toLowerCase() : ''
  if (['working', 'executing', 'running', 'active', 'thinking', 'auditing'].includes(value)) return { label: 'Bekerja', tone: 'working' }
  if (['waiting', 'blocked'].includes(value)) return { label: 'Menunggu', tone: 'waiting' }
  if (['failed', 'error'].includes(value)) return { label: 'Gagal', tone: 'failed' }
  if (value === 'idle') return { label: 'Siaga', tone: 'idle' }
  if (['offline', 'stale', 'expired'].includes(value)) return { label: 'Tidak terhubung', tone: 'unknown' }
  return { label: 'Belum diketahui', tone: 'unknown' }
}
