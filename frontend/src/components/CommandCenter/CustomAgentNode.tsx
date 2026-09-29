import { memo, useEffect } from 'react'
import { Handle, Position, useUpdateNodeInternals } from '@xyflow/react'
import type { Node, NodeProps } from '@xyflow/react'
import { CARD_HEIGHT, CARD_WIDTH, ROUTES, agentStatus } from './graphModel'
import type { AgentDefinition, AgentId } from './graphModel'

export type AgentNodeData = Record<string, unknown> & {
  definition: AgentDefinition
  state?: string
  invocationCount: number
  selected: boolean
  onInspect: (agentId: AgentId) => void
}
export type AgentFlowNode = Node<AgentNodeData, 'agentNode'>

export const CustomAgentNode = memo(function CustomAgentNode({ data }: NodeProps<AgentFlowNode>) {
  const { definition, invocationCount, selected, onInspect } = data
  const updateNodeInternals = useUpdateNodeInternals()

  useEffect(() => {
    updateNodeInternals(definition.id)
  }, [definition.id, updateNodeInternals])

  const founder = definition.id === 'rifqi'
  const status = founder ? { label: 'Otoritas manusia', tone: 'authority' } : agentStatus(data.state)
  const outgoing = ROUTES.filter(route => route.source === definition.id)
  return (
    <div className={`mc-agent${selected ? ' mc-agent--selected' : ''}`} style={{ width: CARD_WIDTH, height: CARD_HEIGHT }}>
      {definition.id !== 'rifqi' && (
        <Handle type="target" id="in" position={definition.id === 'vps-assistant' ? Position.Left : Position.Top}
          isConnectable={false} className="mc-port" />
      )}
      {outgoing.map(route => (
        <Handle key={route.target} type="source" id={`out:${route.target}`}
          position={route.horizontal ? Position.Right : Position.Bottom} isConnectable={false}
          className="mc-port" style={route.horizontal ? { top: route.sourceOffset } : { left: route.sourceOffset }} />
      ))}
      <button type="button" className="mc-agent__body nodrag nopan" onClick={() => onInspect(definition.id)}
        aria-label={`Periksa ${definition.name}. ${status.label}. ${invocationCount} panggilan aktif.`}
        aria-pressed={selected}>
        <div className="mc-agent__heading">
          <span className="mc-agent__level" aria-label={`Tingkat ${definition.level}`}>L{definition.level}</span>
          <h3>{definition.name}</h3>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
            <path d="M8 5h11v11M19 5 5 19" />
          </svg>
        </div>
        <p className="mc-agent__role">{definition.title}</p>
        <div className="mc-agent__footer">
          <span className={`mc-state mc-state--${status.tone}`}><i aria-hidden="true" />{status.label}</span>
          <span className="mc-agent__calls">{founder ? '' : `${invocationCount} panggilan`}</span>
        </div>
      </button>
    </div>
  )
})
