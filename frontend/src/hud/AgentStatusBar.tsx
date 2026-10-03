import React from 'react';
import { useOfficeStore } from '../store/officeStore';

export const AgentStatusBar: React.FC = () => {
  const agentList = useOfficeStore((s) => s.agentList);

  const totalAgents = agentList.length;
  const workingCount = agentList.filter((a) => a.work === 'working').length;
  const idleCount = agentList.filter((a) => a.work === 'idle').length;
  const blockedCount = agentList.filter((a) => a.work === 'blocked').length;
  const doneRecentCount = agentList.filter((a) => a.work === 'done_recent').length;
  const totalDoneToday = agentList.reduce((acc, a) => acc + (a.done_today || 0), 0);

  return (
    <nav
      className="pointer-events-auto px-4 py-2 bg-[#1a1c29]/95 backdrop-blur-md border-b border-[#282d3f] flex flex-wrap items-center justify-between text-xs shadow-md select-none"
      aria-label="Ringkasan Status Agen"
    >
      <div className="flex items-center gap-4 flex-wrap">
        <span className="text-[#9ca8b8] font-medium flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-[#2bb3c0]" />
          <span>Status Agen Kantor:</span>
        </span>

        {/* Counter chips */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-[#14141e] border border-[#282d3f] text-[#f5f0e1]">
            <span className="text-[#687594]">Total:</span>
            <strong className="tabular-nums font-mono text-[#f5f0e1]">{totalAgents || 16}</strong>
          </span>

          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-amber-950/40 border border-amber-800/50 text-amber-200">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
            <span>Bekerja:</span>
            <strong className="tabular-nums font-mono font-bold text-amber-300">{workingCount}</strong>
          </span>

          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-950/40 border border-emerald-800/50 text-emerald-200">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            <span>Selesai Baru:</span>
            <strong className="tabular-nums font-mono text-emerald-300">{doneRecentCount}</strong>
          </span>

          {blockedCount > 0 && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-rose-950/40 border border-rose-800/50 text-rose-200">
              <span className="w-1.5 h-1.5 rounded-full bg-rose-400" />
              <span>Terblokir:</span>
              <strong className="tabular-nums font-mono font-bold text-rose-300">{blockedCount}</strong>
            </span>
          )}

          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-[#14141e] border border-[#282d3f] text-[#9ca8b8]">
            <span>Idle:</span>
            <strong className="tabular-nums font-mono text-slate-300">{idleCount}</strong>
          </span>
        </div>
      </div>

      <div className="flex items-center gap-2 text-[#9ca8b8]">
        <span className="text-[#687594]">Total Tugas Hari Ini:</span>
        <span className="tabular-nums font-mono font-bold text-[#f5f0e1] px-2 py-0.5 rounded bg-[#14141e] border border-[#282d3f]">
          {totalDoneToday}
        </span>
      </div>
    </nav>
  );
};
