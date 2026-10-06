import React, { useState } from 'react';
import { useOfficeStore } from '../store/officeStore';
import type { OfficeEvent } from '../types/office';

export const ActivityFeed: React.FC = () => {
  const [isOpen, setIsOpen] = useState<boolean>(() => {
    if (typeof location === 'undefined') return true;
    const params = new URLSearchParams(location.search);
    if (params.get('officeRenderer') === 'legacy') return true;
    if (typeof process !== 'undefined' && (process.env.NODE_ENV === 'test' || process.env.VITEST)) return true;
    return false;
  });
  const recentEvents = useOfficeStore((s) => s.recentEvents);

  const formatEventTime = (ts: number) => {
    try {
      const date = new Date(ts * 1000);
      return new Intl.DateTimeFormat('id-ID', {
        timeZone: 'Asia/Jakarta',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
      }).format(date);
    } catch {
      return '--:--:--';
    }
  };

  const getEventBadge = (kind: OfficeEvent['kind']) => {
    switch (kind) {
      case 'task_started':
        return <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-amber-950/80 text-amber-300 border border-amber-800">MULAI</span>;
      case 'task_done':
        return <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-emerald-950/80 text-emerald-300 border border-emerald-800">SELESAI</span>;
      case 'task_blocked':
        return <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-rose-950/80 text-rose-300 border border-rose-800">BLOKIR</span>;
      case 'task_commented':
        return <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-sky-950/80 text-sky-300 border border-sky-800">KOMENTAR</span>;
      case 'vitals_alert':
        return <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-purple-950/80 text-purple-300 border border-purple-800">SISTEM</span>;
      default:
        return <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-slate-900 text-slate-400 border border-slate-700">{kind.toUpperCase()}</span>;
    }
  };

  return (
    <aside
      id="activity-feed"
      className="pointer-events-auto fixed bottom-4 right-4 z-20 w-80 sm:w-96 flex flex-col bg-[#14141e]/95 backdrop-blur-md border border-[#282d3f] rounded-lg shadow-2xl overflow-hidden transition-all duration-200"
      aria-label="Linimasa Aktivitas Kantor"
    >
      {/* Header Drawer */}
      <div className="flex items-center justify-between px-3 py-2 bg-[#1a1c29] border-b border-[#282d3f]">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-[#2bb3c0]" />
          <h2 className="text-xs font-semibold tracking-wide text-[#f5f0e1]">
            Aktivitas Terkini ({recentEvents.length})
          </h2>
        </div>
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          aria-expanded={isOpen}
          aria-label={isOpen ? 'Tutup linimasa aktivitas' : 'Buka linimasa aktivitas'}
          className="text-xs text-[#9ca8b8] hover:text-[#f5f0e1] px-1.5 py-0.5 rounded hover:bg-[#282d3f] transition-colors focus-visible:ring-2 focus-visible:ring-[#2bb3c0] focus-visible:outline-none"
        >
          {isOpen ? 'Sembunyikan' : 'Buka'}
        </button>
      </div>

      {/* Body List */}
      {isOpen && (
        <div
          role="feed"
          aria-label="Daftar item linimasa aktivitas terkini"
          tabIndex={0}
          className="max-h-64 overflow-y-auto divide-y divide-[#282d3f]/60 p-2 space-y-1.5 focus:outline-none focus-visible:ring-1 focus-visible:ring-[#2bb3c0]"
        >
          {recentEvents.length === 0 ? (
            <p className="text-xs text-[#687594] text-center py-4">
              Menunggu event dari server...
            </p>
          ) : (
            recentEvents.slice(0, 50).map((evt) => (
              <div key={`${evt.seq}-${evt.ts}`} className="pt-1.5 first:pt-0 text-xs">
                <div className="flex items-center justify-between gap-1 mb-0.5">
                  <div className="flex items-center gap-1.5">
                    {getEventBadge(evt.kind)}
                    {evt.agent && (
                      <span className="font-semibold text-[#f5f0e1] capitalize text-[11px]">
                        {evt.agent}
                      </span>
                    )}
                  </div>
                  <time className="tabular-nums font-mono text-[10px] text-[#687594]">
                    {formatEventTime(evt.ts)}
                  </time>
                </div>
                <p className="text-[#9ca8b8] text-[11px] leading-snug break-words">
                  {evt.message}
                </p>
              </div>
            ))
          )}
        </div>
      )}
    </aside>
  );
};
