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
      // ── Level 0: Supreme Authority & Founder (The Apex) ──
      {
        id: 'rifqi',
        type: 'agentNode',
        position: { x: 380, y: 25 },
        data: getAgent('rifqi', 'Rifqi Setiawan', 'Founder & Supreme Authority', '#eab308', '👑', 'human-authority'),
      },

      // ── Level 1: Executive Suite (Jarvis + Direct Assistant) ──
      {
        id: 'vps-boss',
        type: 'agentNode',
        position: { x: 380, y: 165 },
        data: getAgent('vps-boss', 'Jarvis', 'Chief Orchestrator & Planner', '#f59e0b', '👑', 'ag/gemini-3.8-flash'),
      },
      {
        id: 'vps-assistant',
        type: 'agentNode',
        position: { x: 680, y: 165 },
        data: getAgent('vps-assistant', 'vps-assistant', 'Executive Assistant & Co-Pilot', '#84cc16', '⚡', 'ag/gemini-3.8-flash'),
      },

      // ── Level 2: Division Pillars ──
      {
        id: 'professor',
        type: 'agentNode',
        position: { x: 140, y: 320 },
        data: getAgent('professor', 'Senku', 'Distinguished Research Scientist', '#10b981', '🧪', 'cx/gpt-5.6-sol'),
      },
      {
        id: 'swe-backend',
        type: 'agentNode',
        position: { x: 410, y: 320 },
        data: getAgent('swe-backend', 'swe-backend', 'Backend Architecture & APIs', '#3b82f6', '⚙️', 'ag/gemini-3.8-flash'),
      },
      {
        id: 'swe-frontend',
        type: 'agentNode',
        position: { x: 680, y: 320 },
        data: getAgent('swe-frontend', 'swe-frontend', 'Frontend UI/UX Engineering', '#06b6d4', '🎨', 'ag/gemini-3.8-flash'),
      },
      {
        id: 'tech-mentor',
        type: 'agentNode',
        position: { x: 950, y: 320 },
        data: getAgent('tech-mentor', 'tech-mentor', 'Technical Architecture Tutor', '#6366f1', '🎓', 'ag/gemini-3.8-flash'),
      },

      // ── Level 3: Specialist Execution & Independent QA ──
      {
        id: 'data-engineer',
        type: 'agentNode',
        position: { x: 20, y: 485 },
        data: getAgent('data-engineer', 'data-engineer', 'DuckDB Medallion Lakehouse', '#14b8a6', '🌊', 'ag/gemini-3.8-flash'),
      },
      {
        id: 'paperwright',
        type: 'agentNode',
        position: { x: 260, y: 485 },
        data: getAgent('paperwright', 'paperwright', 'LaTeX Manuscript Scribe', '#a855f7', '📜', 'ag/gemini-3.8-flash'),
      },
      {
        id: 'swe-verifier',
        type: 'agentNode',
        position: { x: 410, y: 485 },
        data: getAgent('swe-verifier', 'swe-QA', 'Independent Quality Verification', '#8b5cf6', '🛡️', 'ag/gemini-3.8-flash'),
      },
      {
        id: 'ui-designer',
        type: 'agentNode',
        position: { x: 680, y: 485 },
        data: getAgent('ui-designer', 'ui-designer', 'Principal Design Systems', '#ec4899', '✨', 'ag/gemini-3.8-flash'),
      },
      {
        id: 'devops-engineer',
        type: 'agentNode',
        position: { x: 950, y: 485 },
        data: getAgent('devops-engineer', 'devops-engineer', 'Principal SRE & Infrastructure', '#f97316', '🚀', 'ag/gemini-3.8-flash'),
      },

      // ── Level 4: Publication & Observatory Deck ──
      {
        id: 'github-manager',
        type: 'agentNode',
        position: { x: 410, y: 650 },
        data: getAgent('github-manager', 'github-manager', 'Global Git & Release PIC', '#64748b', '🐙', 'ag/gemini-3.8-flash'),
      },
      {
        id: 'office-lead',
        type: 'agentNode',
        position: { x: 950, y: 650 },
        data: getAgent('office-lead', 'office-lead', 'Virtual Systems & Telemetry', '#4f46e5', '🏢', 'cx/gpt-5.6-sol'),
      },
    ]
  }, [agentStateMap, onInspectAgent])

  // Dynamic Edges showing live delegation pathways
  const edges: Edge[] = useMemo(() => {
    const isNodeActive = (id: string) => {
      const a = agentStateMap.get(id)
      return a && a.state && a.state !== 'idle'
    }

    const anyAgentActive = Array.from(agentStateMap.values()).some(a => a.state && a.state !== 'idle')

    const makeEdge = (
      id: string,
      source: string,
      target: string,
      sourceHandle?: string,
      targetHandle?: string
    ) => {
      const active = (source === 'rifqi' && target === 'vps-boss')
        ? (anyAgentActive || isNodeActive('vps-boss'))
        : (isNodeActive(source) || isNodeActive(target))

      const isSupreme = source === 'rifqi'
      const isAssistant = source === 'vps-boss' && target === 'vps-assistant'

      return {
        id,
        source,
        target,
        sourceHandle,
        targetHandle,
        type: 'smoothstep',
        pathOptions: { borderRadius: 12 },
        animated: active,
        style: {
          stroke: active
            ? (isSupreme ? '#eab308' : isAssistant ? '#84cc16' : '#06b6d4')
            : (isSupreme ? '#854d0e' : isAssistant ? '#365314' : '#334155'),
          strokeWidth: active ? 3 : 1.5,
          strokeDasharray: isAssistant ? '4 4' : undefined,
          filter: active
            ? `drop-shadow(0 0 8px ${isSupreme ? 'rgba(234,179,8,0.9)' : isAssistant ? 'rgba(132,204,22,0.9)' : 'rgba(6,182,212,0.9)'})`
            : undefined,
        },
        markerEnd: {
          type: MarkerType.ArrowClosed,
          color: active
            ? (isSupreme ? '#eab308' : isAssistant ? '#84cc16' : '#06b6d4')
            : '#475569',
        },
      }
    }

    return [
      // 1. Supreme Command: Rifqi -> Jarvis
      makeEdge('e-rifqi-boss', 'rifqi', 'vps-boss'),

      // 2. Executive Co-Pilot: Jarvis -> vps-assistant (Side-by-side horizontal)
      makeEdge('e-boss-assistant', 'vps-boss', 'vps-assistant', 'source-right', 'target-left'),

      // 3. Jarvis -> 4 Division Pillars
      makeEdge('e-boss-senku', 'vps-boss', 'professor'),
      makeEdge('e-boss-backend', 'vps-boss', 'swe-backend'),
      makeEdge('e-boss-frontend', 'vps-boss', 'swe-frontend'),
      makeEdge('e-boss-mentor', 'vps-boss', 'tech-mentor'),

      // 4. Research Pillar: Senku -> Data & Paperwright
      makeEdge('e-senku-data', 'professor', 'data-engineer'),
      makeEdge('e-senku-paper', 'professor', 'paperwright'),

      // 5. Software Pillar: Backend -> QA -> GitHub (Linear Quality Pipeline)
      makeEdge('e-backend-qa', 'swe-backend', 'swe-verifier'),
      makeEdge('e-qa-github', 'swe-verifier', 'github-manager'),

      // 6. Frontend Pillar: Frontend -> UI Designer
      makeEdge('e-frontend-ui', 'swe-frontend', 'ui-designer'),

      // 7. Platform Pillar: Tech Mentor -> DevOps -> Office Lead
      makeEdge('e-mentor-devops', 'tech-mentor', 'devops-engineer'),
      makeEdge('e-devops-office', 'devops-engineer', 'office-lead'),
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
