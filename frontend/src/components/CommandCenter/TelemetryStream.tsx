import React, { useState } from 'react'
import { Terminal, Activity, Filter, CheckCircle2, AlertTriangle, ArrowRight } from 'lucide-react'

interface TelemetryStreamProps {
  events: any[]
}

export const TelemetryStream: React.FC<TelemetryStreamProps> = ({ events }) => {
  const [filter, setFilter] = useState<'all' | 'tool' | 'delegation' | 'error'>('all')

  const filteredEvents = events.filter(e => {
    if (filter === 'all') return true
    if (filter === 'tool') return e.type === 'tool' || e.tool || (e.detail && e.detail.includes('tool'))
    if (filter === 'delegation') return e.type === 'delegation' || e.type === 'session'
    if (filter === 'error') return e.status === 'error' || (e.detail && e.detail.toLowerCase().includes('error'))
    return true
  })

  return (
    <div className="flex flex-col h-full rounded-2xl border border-slate-800/80 bg-slate-950/70 backdrop-blur-md p-4 shadow-2xl">
      <div className="flex items-center justify-between pb-3 border-b border-slate-800/80">
        <div className="flex items-center gap-2">
          <Activity className="h-4 w-4 text-cyan-400" />
          <h3 className="font-mono text-xs font-bold uppercase tracking-wider text-slate-200">
            Live Telemetry & Execution Stream
          </h3>
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-1 bg-slate-900/80 p-0.5 rounded-lg border border-slate-800">
          {(['all', 'tool', 'delegation', 'error'] as const).map(f => (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              className={`px-2 py-0.5 rounded text-[9px] font-mono capitalize transition-colors ${
                filter === f
                  ? 'bg-cyan-500 text-slate-950 font-bold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {/* Stream list */}
      <div className="mt-3 flex-1 overflow-y-auto space-y-2 pr-1 font-mono text-[10px]">
        {filteredEvents.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 text-slate-500">
            <Terminal className="h-6 w-6 mb-2 stroke-1" />
            <p>Awaiting live telemetry events...</p>
          </div>
        ) : (
          filteredEvents.slice(0, 40).map((ev, idx) => {
            const isError = ev.status === 'error' || (ev.detail && ev.detail.toLowerCase().includes('error'))
            return (
              <div
                key={idx}
                className="flex items-start gap-2.5 p-2 rounded-lg bg-slate-900/40 border border-slate-800/50 hover:border-slate-700/80 transition-colors"
              >
                <span className="text-slate-500 shrink-0 text-[9px] mt-0.5">
                  {ev.timestamp ? new Date(ev.timestamp).toLocaleTimeString() : 'now'}
                </span>

                {/* Badge for Agent */}
                <span className="px-1.5 py-0.5 rounded bg-slate-800 text-cyan-300 font-semibold shrink-0 text-[9px]">
                  {ev.agent || 'Jarvis'}
                </span>

                {/* Detail */}
                <div className="flex-1 min-w-0 text-slate-300">
                  <div className="flex items-center gap-1.5 truncate">
                    {isError ? (
                      <AlertTriangle className="h-3 w-3 text-rose-400 shrink-0" />
                    ) : (
                      <CheckCircle2 className="h-3 w-3 text-emerald-400 shrink-0" />
                    )}
                    <span className="truncate">{ev.detail || ev.status_desc || JSON.stringify(ev)}</span>
                  </div>
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
