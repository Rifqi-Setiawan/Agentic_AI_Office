import React, { useState } from 'react'
import { ExecutionGraph } from './ExecutionGraph'
import { AgentSquadMatrix } from './AgentSquadMatrix'
import { TelemetryStream } from './TelemetryStream'
import { AgentInspectorModal } from './AgentInspectorModal'
import { 
  Server, Cpu, HardDrive, Clock, Globe, Shield, Terminal, 
  Send, Sparkles, LayoutDashboard, Box
} from 'lucide-react'

interface MissionControlProps {
  agents: any[]
  events: any[]
  vitals?: any
  messages: any[]
  onSendMessage: (text: string) => void
  activeView: 'mission-control' | 'spatial-office'
  onSwitchView: (view: 'mission-control' | 'spatial-office') => void
}

export const MissionControl: React.FC<MissionControlProps> = ({
  agents,
  events,
  vitals,
  messages,
  onSendMessage,
  activeView,
  onSwitchView,
}) => {
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null)
  const [inputText, setInputText] = useState('')

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault()
    if (!inputText.trim()) return
    onSendMessage(inputText.trim())
    setInputText('')
  }

  const activeCount = agents.filter(a => a.state && a.state !== 'idle').length

  return (
    <div className="flex flex-col h-screen w-screen bg-[#080b11] text-slate-100 font-sans overflow-hidden">
      {/* ── Top Executive Navbar ── */}
      <header className="h-14 border-b border-slate-800/80 bg-slate-950/80 backdrop-blur-xl px-5 flex items-center justify-between shrink-0 z-30">
        {/* Left: Branding & Beacon */}
        <div className="flex items-center gap-3">
          <div className="relative flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-3 w-3 bg-cyan-500 shadow-[0_0_10px_#06b6d4]" />
          </div>
          <div className="flex items-center gap-2">
            <h1 className="font-mono text-sm font-black tracking-wider text-white">
              HERMES SOVEREIGN
            </h1>
            <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-cyan-950 text-cyan-400 border border-cyan-800/60">
              MISSION CONTROL
            </span>
          </div>
        </div>

        {/* Center: Live Status Indicator */}
        <div className="hidden md:flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-cyan-400 animate-pulse shadow-[0_0_8px_#22d3ee]" />
          <span className="text-xs font-mono text-slate-300 font-semibold tracking-wider uppercase">
            Autonomous Multi-Agent Neural Mesh
          </span>
          <span className="text-[10px] font-mono text-cyan-400 bg-cyan-950/80 px-2 py-0.5 rounded border border-cyan-800/50">
            Real-Time Synced
          </span>
        </div>

        {/* Right: Real-time Host Vitals */}
        <div className="flex items-center gap-4 text-xs font-mono text-slate-400">
          <div className="flex items-center gap-1.5">
            <Cpu className="h-3.5 w-3.5 text-cyan-400" />
            <span>Load: {vitals?.load_1m ?? '0.65'}</span>
          </div>

          <div className="flex items-center gap-1.5">
            <HardDrive className="h-3.5 w-3.5 text-indigo-400" />
            <span>RAM: {vitals?.ram_used_gib ?? '7.6'} / {vitals?.ram_total_gib ?? '54.9'} GB</span>
          </div>

          <div className="flex items-center gap-1.5">
            <Clock className="h-3.5 w-3.5 text-emerald-400" />
            <span>{vitals?.uptime ?? '12d 9h'}</span>
          </div>

          <div className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-emerald-950/60 border border-emerald-800 text-emerald-400">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span>{activeCount} Active</span>
          </div>
        </div>
      </header>

      {/* ── Main Layout Body ── */}
      <main className="flex-1 p-4 grid grid-cols-12 gap-4 min-h-0 overflow-hidden">
        {/* Left / Center: Full Height Execution DAG Graph (8 cols, 100% height) */}
        <div className="col-span-8 h-full min-h-0">
          <ExecutionGraph agents={agents} onInspectAgent={setSelectedAgentId} />
        </div>

        {/* Right Sidebar: Squad Directory & Live Telemetry Stream (4 cols, 100% height) */}
        <div className="col-span-4 h-full min-h-0 flex flex-col gap-4">
          {/* Top: 14-Agent Live Squad Matrix (50% height) */}
          <div className="h-1/2 min-h-0">
            <AgentSquadMatrix agents={agents} onInspectAgent={setSelectedAgentId} />
          </div>

          {/* Bottom: Live Telemetry Stream (50% height) */}
          <div className="h-1/2 min-h-0">
            <TelemetryStream events={events} />
          </div>
        </div>
      </main>

      {/* Slide-out Inspector Drawer */}
      <AgentInspectorModal
        agentId={selectedAgentId}
        onClose={() => setSelectedAgentId(null)}
        agents={agents}
      />
    </div>
  )
}
