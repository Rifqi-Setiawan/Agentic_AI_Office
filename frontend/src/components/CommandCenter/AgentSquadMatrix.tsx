import React from 'react'
import { 
  Crown, Sparkles, Shield, Cpu, Palette, Waves, Rocket, 
  GraduationCap, GitPullRequest, Building2, ScrollText, Zap, UserCheck, Eye
} from 'lucide-react'

interface AgentSquadMatrixProps {
  agents: any[]
  onInspectAgent: (agentId: string) => void
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

export const AgentSquadMatrix: React.FC<AgentSquadMatrixProps> = ({ agents, onInspectAgent }) => {
  return (
    <div className="flex flex-col h-full rounded-2xl border border-slate-800/80 bg-slate-950/70 backdrop-blur-md p-4 shadow-2xl">
      <div className="flex items-center justify-between pb-3 border-b border-slate-800/80">
        <div className="flex items-center gap-2">
          <span className="flex h-2.5 w-2.5 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_8px_#34d399]" />
          <h3 className="font-mono text-xs font-bold uppercase tracking-wider text-slate-200">
            Active Squad Directory (14 Agents)
          </h3>
        </div>
        <span className="text-[10px] font-mono text-emerald-400 bg-emerald-950/40 border border-emerald-800/50 px-2 py-0.5 rounded">
          All Synced
        </span>
      </div>

      <div className="mt-3 flex-1 overflow-y-auto space-y-2.5 pr-1">
        {agents.map(ag => {
          const IconComp = ICON_MAP[ag.id] || Cpu
          const isWorking = ag.state && ag.state !== 'idle'

          return (
            <div
              key={ag.id}
              onClick={() => onInspectAgent(ag.id)}
              className={`group flex items-center justify-between gap-3 p-2.5 rounded-xl border bg-slate-900/60 hover:bg-slate-800/60 transition-all duration-200 cursor-pointer ${
                isWorking 
                  ? 'border-cyan-500/60 shadow-[0_0_12px_rgba(6,182,212,0.15)] ring-1 ring-cyan-500/30' 
                  : 'border-slate-800/80 hover:border-slate-700'
              }`}
            >
              {/* Left: Avatar & Info */}
              <div className="flex items-center gap-2.5 min-w-0">
                <div
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-white/10"
                  style={{ backgroundColor: `${ag.color || '#3b82f6'}20` }}
                >
                  <IconComp className="h-4 w-4" style={{ color: ag.color || '#3b82f6' }} />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="truncate text-xs font-bold text-slate-100 group-hover:text-cyan-400 transition-colors">
                      {ag.name}
                    </span>
                    <span className="text-[10px]">{ag.emoji}</span>
                  </div>
                  <p className="truncate text-[10px] font-mono text-slate-400">
                    {ag.model || 'ag/gemini-3.8-flash'}
                  </p>
                </div>
              </div>

              {/* Right: State & Inspect */}
              <div className="flex items-center gap-2 shrink-0">
                <div className="text-right">
                  <span
                    className={`inline-block px-1.5 py-0.5 rounded text-[9px] font-mono font-semibold uppercase ${
                      isWorking 
                        ? 'bg-emerald-950/80 text-emerald-400 border border-emerald-700/50' 
                        : 'bg-slate-800 text-slate-400'
                    }`}
                  >
                    {isWorking ? 'ACTIVE' : 'IDLE'}
                  </span>
                  {ag.status_desc && (
                    <p className="text-[9px] font-mono text-cyan-300 max-w-[110px] truncate mt-0.5">
                      {ag.status_desc}
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-200 transition-colors"
                  title="Inspect Agent Details"
                >
                  <Eye className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
