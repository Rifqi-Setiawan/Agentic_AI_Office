import React, { useMemo } from 'react'
import {
  ReactFlow,
  Controls,
  Background,
  BackgroundVariant,
  Node,
  Edge,
  MarkerType,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { CustomAgentNode } from './CustomAgentNode'

interface ExecutionGraphProps {
  agents: any[]
  onInspectAgent: (agentId: string) => void
}

const nodeTypes = {
  agentNode: CustomAgentNode,
}

export const ExecutionGraph: React.FC<ExecutionGraphProps> = ({ agents, onInspectAgent }) => {
  // Build lookup map for quick state merge
  const agentStateMap = useMemo(() => {
    const map = new Map<string, any>()
    agents.forEach(a => map.set(a.id, a))
    return map
  }, [agents])

  // Hierarchical Node Layout
  const nodes: Node[] = useMemo(() => {
    const getAgent = (id: string, defName: string, title: string, color: string, emoji: string, model: string) => {
      const live = agentStateMap.get(id) || {}
      return {
        id,
        name: live.name || defName,
        role: live.role || id,
        title,
        model: live.model || model,
        state: live.state || 'idle',
        activeTool: live.status_desc || live.task,
        task: live.task,
        color,
        emoji,
        onInspect: onInspectAgent,
      }
    }

    return [
      // ── Level 1: Chief Orchestrator (Apex) ──
      {
        id: 'vps-boss',
        type: 'agentNode',
        position: { x: 550, y: 40 },
        data: getAgent('vps-boss', 'Jarvis', 'Chief Orchestrator & Planner', '#f59e0b', '👑', 'ag/gemini-3.8-flash'),
      },

      // ── Level 2: Science & Architecture Council ──
      {
        id: 'professor',
        type: 'agentNode',
        position: { x: 210, y: 230 },
        data: getAgent('professor', 'Senku', 'Distinguished Research Scientist', '#10b981', '🧪', 'cx/gpt-5.6-sol'),
      },
      {
        id: 'tech-mentor',
        type: 'agentNode',
        position: { x: 890, y: 230 },
        data: getAgent('tech-mentor', 'tech-mentor', 'Technical Architecture Tutor', '#6366f1', '🎓', 'ag/gemini-3.8-flash'),
      },

      // ── Level 3: Specialist Engineering Squad ──
      {
        id: 'swe-backend',
        type: 'agentNode',
        position: { x: 40, y: 420 },
        data: getAgent('swe-backend', 'swe-backend', 'Backend Architecture & APIs', '#3b82f6', '⚙️', 'ag/gemini-3.8-flash'),
      },
      {
        id: 'swe-frontend',
        type: 'agentNode',
        position: { x: 380, y: 420 },
        data: getAgent('swe-frontend', 'swe-frontend', 'Frontend UI/UX Engineering', '#06b6d4', '🎨', 'ag/gemini-3.8-flash'),
      },
      {
        id: 'swe-verifier',
        type: 'agentNode',
        position: { x: 720, y: 420 },
        data: getAgent('swe-verifier', 'swe-QA', 'Independent Quality Verification', '#8b5cf6', '🛡️', 'ag/gemini-3.8-flash'),
      },
      {
        id: 'data-engineer',
        type: 'agentNode',
        position: { x: 1060, y: 420 },
        data: getAgent('data-engineer', 'data-engineer', 'DuckDB Medallion Lakehouse', '#14b8a6', '🌊', 'ag/gemini-3.8-flash'),
      },

      // ── Level 4: Operations, SRE, & Governance ──
      {
        id: 'devops-engineer',
        type: 'agentNode',
        position: { x: 40, y: 610 },
        data: getAgent('devops-engineer', 'devops-engineer', 'Principal SRE & Infrastructure', '#f97316', '🚀', 'ag/gemini-3.8-flash'),
      },
      {
        id: 'ui-designer',
        type: 'agentNode',
        position: { x: 380, y: 610 },
        data: getAgent('ui-designer', 'ui-designer', 'Principal Design Systems', '#ec4899', '✨', 'ag/gemini-3.8-flash'),
      },
      {
        id: 'github-manager',
        type: 'agentNode',
        position: { x: 720, y: 610 },
        data: getAgent('github-manager', 'github-manager', 'Global Git & Release PIC', '#64748b', '🐙', 'ag/gemini-3.8-flash'),
      },
      {
        id: 'office-lead',
        type: 'agentNode',
        position: { x: 1060, y: 610 },
        data: getAgent('office-lead', 'office-lead', 'Virtual Systems & Telemetry', '#4f46e5', '🏢', 'cx/gpt-5.6-sol'),
      },

      // ── Level 5: Utility & Scribe ──
      {
        id: 'paperwright',
        type: 'agentNode',
        position: { x: 210, y: 800 },
        data: getAgent('paperwright', 'paperwright', 'LaTeX Manuscript Scribe', '#a855f7', '📜', 'ag/gemini-3.8-flash'),
      },
      {
        id: 'vps-assistant',
        type: 'agentNode',
        position: { x: 550, y: 800 },
        data: getAgent('vps-assistant', 'vps-assistant', 'General Operations Utility', '#84cc16', '⚡', 'ag/gemini-3.8-flash'),
      },
      {
        id: 'rifqi',
        type: 'agentNode',
        position: { x: 890, y: 800 },
        data: getAgent('rifqi', 'Rifqi Setiawan', 'Founder & Final Authority', '#eab308', '👑', 'human-authority'),
      },
    ]
  }, [agentStateMap, onInspectAgent])

  // Dynamic Edges showing live delegation pathways
  const edges: Edge[] = useMemo(() => {
    const isNodeActive = (id: string) => {
      const a = agentStateMap.get(id)
      return a && a.state && a.state !== 'idle'
    }

    const makeEdge = (id: string, source: string, target: string) => {
      const active = isNodeActive(source) || isNodeActive(target)
      return {
        id,
        source,
        target,
        animated: active,
        style: {
          stroke: active ? '#06b6d4' : '#334155',
          strokeWidth: active ? 2.5 : 1.5,
          filter: active ? 'drop-shadow(0 0 6px rgba(6,182,212,0.8))' : undefined,
        },
        markerEnd: {
          type: MarkerType.ArrowClosed,
          color: active ? '#06b6d4' : '#475569',
        },
      }
    }

    return [
      // Boss -> Council
      makeEdge('e-boss-senku', 'vps-boss', 'professor'),
      makeEdge('e-boss-mentor', 'vps-boss', 'tech-mentor'),
      makeEdge('e-boss-qa', 'vps-boss', 'swe-verifier'),

      // Council -> Engineering
      makeEdge('e-senku-data', 'professor', 'data-engineer'),
      makeEdge('e-senku-paper', 'professor', 'paperwright'),
      makeEdge('e-mentor-backend', 'tech-mentor', 'swe-backend'),
      makeEdge('e-mentor-frontend', 'tech-mentor', 'swe-frontend'),

      // Engineering -> Support & Ops
      makeEdge('e-backend-qa', 'swe-backend', 'swe-verifier'),
      makeEdge('e-frontend-ui', 'swe-frontend', 'ui-designer'),
      makeEdge('e-qa-github', 'swe-verifier', 'github-manager'),
      makeEdge('e-backend-devops', 'swe-backend', 'devops-engineer'),
      makeEdge('e-boss-assistant', 'vps-boss', 'vps-assistant'),
      makeEdge('e-boss-office', 'vps-boss', 'office-lead'),
      makeEdge('e-boss-founder', 'vps-boss', 'rifqi'),
    ]
  }, [agentStateMap])

  return (
    <div className="h-full w-full rounded-2xl border border-slate-800/80 bg-slate-950/60 overflow-hidden relative shadow-2xl">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.12 }}
        minZoom={0.3}
        maxZoom={1.5}
        proOptions={{ hideAttribution: true }}
      >
        <Background variant={BackgroundVariant.Dots} gap={24} size={1} color="#334155" />
        <Controls
          className="!bg-slate-900 !border-slate-800 !fill-slate-300 !shadow-xl [&>button]:!border-slate-800 [&>button:hover]:!bg-slate-800"
          showInteractive={false}
        />
      </ReactFlow>
    </div>
  )
}
