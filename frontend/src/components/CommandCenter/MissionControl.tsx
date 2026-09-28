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

        {/* Center: View Switcher */}
        <div className="flex items-center gap-1 bg-slate-900/90 border border-slate-800 p-1 rounded-xl">
          <button
            type="button"
            onClick={() => onSwitchView('mission-control')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono font-semibold transition-all ${
              activeView === 'mission-control'
                ? 'bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/20'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <LayoutDashboard className="h-3.5 w-3.5" />
            <span>Mission Control (HUD)</span>
          </button>

          <button
            type="button"
            onClick={() => onSwitchView('spatial-office')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono font-semibold transition-all ${
              activeView === 'spatial-office'
                ? 'bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/20'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Box className="h-3.5 w-3.5" />
            <span>3D Spatial View</span>
          </button>
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

      {/* ── Main Bento Grid Body ── */}
      <main className="flex-1 p-4 grid grid-cols-12 grid-rows-12 gap-4 min-h-0 overflow-hidden">
        {/* Top-Left: Dynamic Execution DAG Graph (7 cols, 8 rows) */}
        <div className="col-span-8 row-span-8 min-h-0">
          <ExecutionGraph agents={agents} onInspectAgent={setSelectedAgentId} />
        </div>

        {/* Top-Right: 14-Agent Live Squad Matrix (4 cols, 8 rows) */}
        <div className="col-span-4 row-span-8 min-h-0">
          <AgentSquadMatrix agents={agents} onInspectAgent={setSelectedAgentId} />
        </div>

        {/* Bottom-Left: Live Telemetry Stream (7 cols, 4 rows) */}
        <div className="col-span-8 row-span-4 min-h-0">
          <TelemetryStream events={events} />
        </div>

        {/* Bottom-Right: Interactive Channel & Quick Command (4 cols, 4 rows) */}
        <div className="col-span-4 row-span-4 min-h-0 flex flex-col rounded-2xl border border-slate-800/80 bg-slate-950/70 backdrop-blur-md p-3.5 shadow-2xl">
          <div className="flex items-center justify-between pb-2 border-b border-slate-800/80 shrink-0">
            <div className="flex items-center gap-2">
              <Terminal className="h-4 w-4 text-cyan-400" />
              <h3 className="font-mono text-xs font-bold uppercase tracking-wider text-slate-200">
                Direct Command & Channel
              </h3>
            </div>
            <span className="text-[9px] font-mono text-slate-500">#office-general</span>
          </div>

          {/* Messages list */}
          <div className="flex-1 overflow-y-auto space-y-1.5 my-2 pr-1 font-mono text-[10px]">
            {messages.slice(-15).map((m, i) => (
              <div key={i} className="flex items-start gap-1.5">
                <span className="font-bold text-cyan-300 shrink-0">{m.sender}:</span>
                <span className="text-slate-300 break-words">{m.text}</span>
              </div>
            ))}
          </div>

          {/* Quick Input Bar */}
          <form onSubmit={handleSend} className="shrink-0 flex items-center gap-2 mt-auto">
            <input
              type="text"
              value={inputText}
              onChange={e => setInputText(e.target.value)}
              placeholder="Send instruction to office..."
              className="flex-1 rounded-xl border border-slate-800 bg-slate-900/90 px-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500 font-mono"
            />
            <button
              type="submit"
              className="flex items-center justify-center p-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold transition-colors"
            >
              <Send className="h-3.5 w-3.5" />
            </button>
          </form>
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
