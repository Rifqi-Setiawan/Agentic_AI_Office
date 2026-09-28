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

  return (
    <div
      onClick={() => data.onInspect?.(data.id)}
      className={`group relative min-w-[240px] max-w-[280px] rounded-xl border bg-slate-950/90 p-3.5 backdrop-blur-md transition-all duration-300 hover:scale-[1.03] hover:shadow-2xl cursor-pointer ${
        isWorking
          ? 'border-cyan-500/80 shadow-[0_0_25px_rgba(6,182,212,0.35)] ring-1 ring-cyan-400/50'
          : 'border-slate-800/80 shadow-lg hover:border-slate-700'
      }`}
      style={{
        borderTopColor: data.color,
        borderTopWidth: '3px',
      }}
    >
      {/* Target input handle */}
      <Handle
        type="target"
        position={Position.Top}
        className="!h-2.5 !w-2.5 !border-2 !border-slate-900 !bg-cyan-400"
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
              isWorking
                ? 'animate-pulse bg-emerald-400 shadow-[0_0_8px_#34d399]'
                : 'bg-slate-600'
            }`}
          />
          <span
            className={`text-[9px] font-mono font-semibold uppercase ${
              isWorking ? 'text-emerald-400' : 'text-slate-500'
            }`}
          >
            {isWorking ? 'ACTIVE' : 'IDLE'}
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
