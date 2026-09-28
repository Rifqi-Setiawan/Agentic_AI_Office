import React, { memo } from 'react'
import { Handle, Position } from '@xyflow/react'
import { 
  Crown, Sparkles, Shield, Cpu, Palette, Waves, Rocket, 
  GraduationCap, GitPullRequest, Building2, ScrollText, Zap, UserCheck
} from 'lucide-react'

export interface AgentNodeData {
  id: string
  name: string
  role: string
  title: string
  model: string
  state: 'idle' | 'working' | 'thinking' | 'executing' | 'auditing'
  activeTool?: string
  task?: string
  color: string
  emoji: string
  onInspect?: (agentId: string) => void
}

const ICON_MAP: Record<string, any> = {
  'vps-boss': Crown,
  'professor': Sparkles,
  'senku': Sparkles,
  'swe-verifier': Shield,
  'swe-qa': Shield,
  'swe-backend': Cpu,
  'swe-frontend': Palette,
  'data-engineer': Waves,
  'devops-engineer': Rocket,
  'ui-designer': Palette,
  'tech-mentor': GraduationCap,
  'github-manager': GitPullRequest,
  'office-lead': Building2,
  'paperwright': ScrollText,
  'vps-assistant': Zap,
  'rifqi': UserCheck,
}

export const CustomAgentNode = memo(({ data }: { data: AgentNodeData }) => {
  const IconComponent = ICON_MAP[data.id] || Cpu
  const isWorking = data.state !== 'idle'
  const isFounder = data.id === 'rifqi'

  return (
    <div
      onClick={() => data.onInspect?.(data.id)}
      className={`group relative w-[240px] rounded-xl border bg-slate-950/95 p-3 backdrop-blur-md transition-all duration-300 hover:scale-[1.03] hover:shadow-2xl cursor-pointer ${
        isFounder
          ? 'border-amber-500/90 shadow-[0_0_30px_rgba(245,158,11,0.35)] ring-1 ring-amber-400/60'
          : isWorking
          ? 'border-cyan-500/90 shadow-[0_0_30px_rgba(6,182,212,0.4)] ring-1 ring-cyan-400/60'
          : 'border-slate-800/90 shadow-lg hover:border-slate-700'
      }`}
      style={{
        borderTopColor: data.color,
        borderTopWidth: '3px',
      }}
    >
      {/* Target input handle (not needed for Founder root) */}
      {!isFounder && (
        <Handle
          type="target"
          position={Position.Top}
          id="target-top"
          className="!h-2.5 !w-2.5 !border-2 !border-slate-900 !bg-cyan-400"
        />
      )}

      {/* Side Handles for Horizontal Co-pilot / Assistant Routing */}
      <Handle
        type="target"
        position={Position.Left}
        id="target-left"
        className="!h-2 !w-2 !border-2 !border-slate-900 !bg-cyan-400"
      />
      <Handle
        type="source"
        position={Position.Right}
        id="source-right"
        className="!h-2 !w-2 !border-2 !border-slate-900 !bg-cyan-400"
      />

      {/* Header */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2.5 min-w-0">
          <div
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-white/10"
            style={{ backgroundColor: `${data.color}20` }}
          >
            <IconComponent className="h-4 w-4" style={{ color: data.color }} />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <h4 className="truncate text-xs font-bold text-white tracking-wide">{data.name}</h4>
              <span className="text-[10px]">{data.emoji}</span>
            </div>
            <p className="truncate text-[10px] text-slate-400 font-medium">{data.title}</p>
          </div>
        </div>

        {/* State Indicator Beacon */}
        <div className="flex items-center gap-1 shrink-0">
          <span
            className={`inline-block h-2 w-2 rounded-full ${
              isFounder
                ? 'bg-amber-400 shadow-[0_0_8px_#f59e0b]'
                : isWorking
                ? 'animate-pulse bg-emerald-400 shadow-[0_0_8px_#34d399]'
                : 'bg-slate-600'
            }`}
          />
          <span
            className={`text-[9px] font-mono font-semibold uppercase ${
              isFounder
                ? 'text-amber-400 font-bold'
                : isWorking
                ? 'text-emerald-400'
                : 'text-slate-500'
            }`}
          >
            {isFounder ? 'FOUNDER' : isWorking ? 'ACTIVE' : 'IDLE'}
          </span>
        </div>
      </div>

      {/* Model & Runtime Spec Badge */}
      <div className="mt-2.5 flex items-center justify-between gap-1 border-t border-slate-800/80 pt-2">
        <div className="flex items-center gap-1 font-mono text-[9px] text-cyan-300/90 bg-cyan-950/60 px-1.5 py-0.5 rounded border border-cyan-800/40">
          <span>🧠</span>
          <span className="truncate max-w-[120px]">{data.model || 'hermes-core'}</span>
        </div>
        <span className="text-[9px] font-mono text-slate-400">
          {data.activeTool ? `⚡ ${data.activeTool}` : 'ready'}
        </span>
      </div>

      {/* Current Task Teaser */}
      {data.task && (
        <div className="mt-2 text-[10px] text-slate-300 font-mono bg-slate-900/80 rounded px-2 py-1 border border-slate-800/60 truncate">
          {data.task}
        </div>
      )}

      {/* Source output handle */}
      <Handle
        type="source"
        position={Position.Bottom}
        className="!h-2.5 !w-2.5 !border-2 !border-slate-900 !bg-cyan-400"
      />
    </div>
  )
})

CustomAgentNode.displayName = 'CustomAgentNode'
