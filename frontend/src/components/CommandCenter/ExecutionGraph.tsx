import { useEffect, useMemo, useRef, useState } from 'react'
import { Background, BackgroundVariant, Controls, MarkerType, Panel, ReactFlow, useNodesInitialized, useReactFlow, useUpdateNodeInternals } from '@xyflow/react'
import type { RefObject } from 'react'
import '@xyflow/react/dist/style.css'
import './mission-control.css'
import { CustomAgentNode } from './CustomAgentNode'
import type { AgentFlowNode } from './CustomAgentNode'
import { CircuitEdge } from './CircuitEdge'
import type { CircuitEdgeType } from './CircuitEdge'
import { AGENTS, CARD_HEIGHT, CARD_WIDTH, ROUTES, activePairs, canonicalAgent, pairKey } from './graphModel'
import type { AgentId, ExecutionSnapshot, LiveAgent } from './graphModel'

const nodeTypes = { agentNode: CustomAgentNode }
const edgeTypes = { circuit: CircuitEdge }
export interface ExecutionGraphProps {
  agents: readonly LiveAgent[]
  onInspectAgent: (agentId: string) => void
  snapshot?: ExecutionSnapshot | null
  elapsedMs?: number
  missionId?: string | null
  selectedAgentId?: string | null
  theme?: 'dark' | 'light'
}
function ViewportTools({ host, autoFit, setAutoFit }: {
  host: RefObject<HTMLDivElement>; autoFit: boolean; setAutoFit: (enabled: boolean) => void
}) {
  const { fitView, zoomTo } = useReactFlow()
  const initialized = useNodesInitialized()
  const updateNodeInternals = useUpdateNodeInternals()

  useEffect(() => {
    if (!initialized) return
    AGENTS.forEach(a => updateNodeInternals(a.id))
  }, [initialized, updateNodeInternals])

  useEffect(() => {
    if (!host.current || !autoFit || !initialized) return
    let timer: ReturnType<typeof setTimeout> | undefined
    const fit = () => {
      clearTimeout(timer)
      timer = setTimeout(() => { void fitView({ padding: 0.1, minZoom: 0.25, maxZoom: 1, duration: 0 }) }, 80)
    }
    const observer = new ResizeObserver(fit)
    observer.observe(host.current); fit()
    return () => { observer.disconnect(); clearTimeout(timer) }
  }, [host, autoFit, initialized, fitView])
  return (
    <Panel position="top-left" className="mc-viewport-actions">
      <button type="button" onClick={() => { setAutoFit(true); void fitView({ padding: 0.1, maxZoom: 1, duration: 180 }) }}>Sesuaikan</button>
      <button type="button" onClick={() => { setAutoFit(false); void zoomTo(1, { duration: 180 }) }}>100%</button>
    </Panel>
  )
}
export function ExecutionGraph({ agents, onInspectAgent, snapshot = null, elapsedMs = Infinity,
  missionId = null, selectedAgentId = null, theme = 'dark' }: ExecutionGraphProps) {
  const host = useRef<HTMLDivElement>(null)
  const [autoFit, setAutoFit] = useState(true)
  const activity = useMemo(() => activePairs(snapshot, elapsedMs, missionId), [snapshot, elapsedMs, missionId])
  const agentMap = useMemo(() => {
    const map = new Map<AgentId, LiveAgent>()
    for (const live of agents) {
      const id = canonicalAgent(live.id)
      if (id) map.set(id, live)
    }
    return map
  }, [agents])
  const nodes = useMemo<AgentFlowNode[]>(() => AGENTS.map(definition => {
    const calls = [...activity.values()].filter(pair => pair.callee === definition.id).flatMap(pair => pair.invocations)
    const state = calls.length ? (calls.some(call => call.state === 'running') ? 'running' : 'waiting') : agentMap.get(definition.id)?.state
    return {
      id: definition.id, type: 'agentNode', position: definition.position,
      width: CARD_WIDTH, height: CARD_HEIGHT, style: { width: CARD_WIDTH, height: CARD_HEIGHT },
      draggable: false, connectable: false, selectable: false, focusable: false,
      data: { definition, state, invocationCount: calls.length, selected: selectedAgentId === definition.id, onInspect: onInspectAgent },
    }
  }), [activity, agentMap, selectedAgentId, onInspectAgent])
  const edges = useMemo<CircuitEdgeType[]>(() => ROUTES.map(route => {
    const id = pairKey(route.source, route.target)
    const active = activity.has(id)
    const color = active ? (theme === 'dark' ? '#60a5fa' : '#2563eb') : (theme === 'dark' ? '#475569' : '#b8c4d2')
    return {
      id, source: route.source, target: route.target, type: 'circuit',
      sourceHandle: `out:${route.target}`, targetHandle: 'in',
      selectable: false, focusable: false, reconnectable: false,
      ariaLabel: `${route.source} ke ${route.target}: ${active ? 'delegasi aktif' : 'tidak aktif'}`,
      markerEnd: { type: MarkerType.ArrowClosed, color, width: 13, height: 13 },
      data: { laneOffset: route.laneOffset, horizontal: route.horizontal === true, active },
    }
  }), [activity, theme])
  return (
    <div ref={host} className="mc-graph" data-theme={theme} aria-label="Hierarki komando dan jalur delegasi aktif">
      <ReactFlow<AgentFlowNode, CircuitEdgeType> nodes={nodes} edges={edges} nodeTypes={nodeTypes} edgeTypes={edgeTypes}
        fitView fitViewOptions={{ padding: 0.1, minZoom: 0.25, maxZoom: 1 }} minZoom={0.25} maxZoom={1.6}
        nodesDraggable={false} nodesConnectable={false} edgesReconnectable={false} elementsSelectable={false}
        deleteKeyCode={null} selectionKeyCode={null} colorMode={theme}
        onNodeClick={(_event, node) => {
          if (node?.data?.definition?.id) {
            onInspectAgent(node.data.definition.id)
          }
        }}
        onMoveStart={event => { if (event) setAutoFit(false) }}>
        <Background variant={BackgroundVariant.Dots} gap={24} size={1} />
        <Controls showInteractive={false} position="bottom-left" />
        <ViewportTools host={host} autoFit={autoFit} setAutoFit={setAutoFit} />
        <Panel position="bottom-right" className="mc-graph-legend">
          <span><i className="mc-legend-line mc-legend-line--active" />Delegasi aktif</span>
          <span><i className="mc-legend-line" />Hierarki</span>
        </Panel>
      </ReactFlow>
    </div>
  )
}
