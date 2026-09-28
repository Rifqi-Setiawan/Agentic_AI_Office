/** Runtime validation: malformed/unknown identities fail closed instead of lighting guessed edges. */
import { canonicalAgent, pairKey } from './graphModel'
import type { AgentId, ExecutionSnapshot } from './graphModel'
const record = (value: unknown): Record<string, unknown> => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Expected an object')
  return value as Record<string, unknown>
}
const text = (value: unknown): string => {
  if (typeof value !== 'string' || value.length > 128 || !/^[A-Za-z0-9][A-Za-z0-9_.:-]*$/.test(value)) throw new Error('Invalid identifier')
  return value
}
const number = (value: unknown): number => {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) throw new Error('Invalid integer')
  return value
}
const list = (value: unknown, max: number): unknown[] => {
  if (!Array.isArray(value) || value.length > max) throw new Error('Invalid array')
  return value
}
const agent = (value: unknown): AgentId => {
  const id = canonicalAgent(text(value))
  if (!id) throw new Error('Unknown agent ID')
  return id
}
const optionalId = (value: unknown): string | null => value === null ? null : text(value)
export function decodeSnapshot(input: unknown): ExecutionSnapshot {
  const data = record(input)
  if (data.schema_version !== 1 || data.type !== 'delegation_snapshot') throw new Error('Unsupported execution schema')
  const ttl = number(data.freshness_ttl_ms)
  if (ttl < 1000 || ttl > 30000 || typeof data.instrumentation_seen !== 'boolean') throw new Error('Invalid freshness metadata')
  const seenSpans = new Set<string>(), seenPairs = new Set<string>()
  const pairs = list(data.caller_callee_pairs, 196).map(value => {
    const item = record(value), caller = agent(item.caller), callee = agent(item.callee)
    const key = pairKey(caller, callee)
    if (caller === callee || seenPairs.has(key)) throw new Error('Duplicate or self delegation pair')
    seenPairs.add(key)
    const invocations = list(item.invocations, 4096).map(raw => {
      const call = record(raw), span_id = text(call.span_id)
      if (seenSpans.has(span_id) || !['running', 'waiting'].includes(String(call.state))) throw new Error('Invalid active invocation')
      seenSpans.add(span_id)
      return { span_id, mission_id: text(call.mission_id), task_id: text(call.task_id),
        state: call.state as 'running' | 'waiting', expires_at_ms: number(call.expires_at_ms) }
    })
    return { caller, callee, invocations }
  })
  if (seenSpans.size > 4096) throw new Error('Invocation limit exceeded')
  const chains = list(data.active_delegation_chains, 4096).map(raw => {
    const item = record(raw), path = list(item.active_delegation_path, 65).map(agent)
    const span_ids = list(item.span_ids, 64).map(text)
    if (path.length !== span_ids.length + 1 || path.length < 2 || new Set(span_ids).size !== span_ids.length) throw new Error('Invalid delegation chain')
    const mission_id = text(item.mission_id)
    span_ids.forEach((span, index) => {
      const pair = pairs.find(p => p.caller === path[index] && p.callee === path[index + 1])
      if (!pair?.invocations.some(call => call.span_id === span && call.mission_id === mission_id)) throw new Error('Chain and invocation projection disagree')
    })
    return { chain_id: text(item.chain_id), mission_id, task_id: text(item.task_id), span_ids,
      active_delegation_path: path, expires_at_ms: number(item.expires_at_ms) }
  })
  const covered = new Set(chains.flatMap(chain => chain.span_ids))
  if (covered.size !== seenSpans.size || [...seenSpans].some(id => !covered.has(id))) throw new Error('Active invocation lacks ancestry')
  const events = list(data.recent_events, 50).map(raw => {
    const event = record(raw)
    return { seq: number(event.seq), kind: text(event.kind), at_ms: number(event.at_ms), actor: text(event.actor),
      mission_id: optionalId(event.mission_id), task_id: optionalId(event.task_id), span_id: optionalId(event.span_id) }
  })
  const gates = list(data.release_gates, 30).map(raw => {
    const gate = record(raw)
    return { task_id: text(gate.task_id), mission_id: text(gate.mission_id), state: text(gate.state),
      version: number(gate.version), attempt: number(gate.attempt), artifact_digest: optionalId(gate.artifact_digest),
      updated_at_ms: number(gate.updated_at_ms) }
  })
  return { schema_version: 1, type: 'delegation_snapshot', stream_id: text(data.stream_id), revision: number(data.revision),
    generated_at_ms: number(data.generated_at_ms), freshness_ttl_ms: ttl, instrumentation_seen: data.instrumentation_seen,
    active_delegation_chains: chains, caller_callee_pairs: pairs, queued_count: number(data.queued_count),
    recent_events: events, release_gates: gates }
}
export function canReplace(previous: ExecutionSnapshot | null, incoming: ExecutionSnapshot): boolean {
  return !previous || incoming.stream_id !== previous.stream_id || incoming.revision > previous.revision ||
    (incoming.revision === previous.revision && incoming.generated_at_ms > previous.generated_at_ms)
}
