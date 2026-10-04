import React, { useState } from 'react';
import { useOfficeStore } from '../store/officeStore';

export const SnapshotInspector: React.FC = () => {
  const [isExpanded, setIsExpanded] = useState<boolean>(false);
  const snapshot = useOfficeStore((s) => s.snapshot);
  const lastSeq = useOfficeStore((s) => s.lastSeq);
  const lastUpdateTs = useOfficeStore((s) => s.lastUpdateTs);
  const projection = useOfficeStore((s) => s.projection);
  const connectionStatus = useOfficeStore((s) => s.connectionStatus);

  const formatTimestamp = (ts: number) => {
    if (!ts) return '-';
    try {
      return new Intl.DateTimeFormat('id-ID', {
        timeZone: 'Asia/Jakarta',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
      }).format(new Date(ts * 1000)) + ' WIB';
    } catch {
      return `${ts}`;
    }
  };

  return (
    <div
      className="pointer-events-auto fixed bottom-4 left-4 z-20 bg-[#14141e]/95 backdrop-blur-md border border-[#282d3f] rounded-lg shadow-xl text-xs max-w-sm overflow-hidden select-none"
      role="region"
      aria-label="Panel Verifikasi Mock Snapshot"
      data-snapshot-panel
      data-expanded={isExpanded}
    >
      <div className="flex items-center justify-between px-3 py-2 bg-[#1a1c29] border-b border-[#282d3f] gap-2">
        <div className="flex items-center gap-2">
          <span
            className={`w-2 h-2 rounded-full ${
              snapshot ? 'bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.8)]' : 'bg-amber-400'
            }`}
          />
          <span className="font-semibold text-[#f5f0e1]">
            {snapshot ? 'Snapshot Terverifikasi' : 'Menunggu Snapshot...'}
          </span>
        </div>
        <button
          type="button"
          onClick={() => setIsExpanded(!isExpanded)}
          aria-expanded={isExpanded}
          aria-label={isExpanded ? 'Tutup detail snapshot' : 'Lihat detail snapshot'}
          className="text-xs text-[#9ca8b8] hover:text-[#f5f0e1] px-1.5 py-0.5 rounded hover:bg-[#282d3f] transition-colors"
        >
          {isExpanded ? 'Tutup' : 'Detail'}
        </button>
      </div>

      <div data-snapshot-content className="p-3 space-y-1.5 font-mono text-[11px] text-[#9ca8b8]">
        <div className="flex justify-between">
          <span className="text-[#687594]">Status:</span>
          <span className="text-[#f5f0e1] capitalize">{connectionStatus}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-[#687594]">Sequence ID:</span>
          <span className="tabular-nums text-[#2bb3c0] font-semibold">#{lastSeq}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-[#687594]">Proyeksi:</span>
          <span className="text-[#f5f0e1] uppercase">{projection}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-[#687594]">Waktu Update:</span>
          <span className="tabular-nums text-[#f5f0e1]">{formatTimestamp(lastUpdateTs)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-[#687594]">Agen Termuat:</span>
          <span className="tabular-nums font-semibold text-emerald-400">
            {snapshot ? `${snapshot.agents.length} Agen` : '0 Agen'}
          </span>
        </div>

        {isExpanded && snapshot && (
          <div className="mt-2 pt-2 border-t border-[#282d3f] space-y-1 text-[10px]">
            <p className="text-[#687594]">Sumber: Mock SSE Dev Stream (/api/v1/stream)</p>
            <p className="text-[#687594]">Fallback: Polling Snapshot (/api/v1/snapshot 5 dtk)</p>
            <div className="mt-1 max-h-32 overflow-y-auto bg-[#1a1c29] p-1.5 rounded border border-[#282d3f]/50">
              <span className="text-[#687594]">Daftar Agen Aktif:</span>
              <ul className="mt-0.5 space-y-0.5 list-disc list-inside text-slate-300">
                {snapshot.agents.map((a) => (
                  <li key={a.id}>
                    <span className="text-white capitalize">{a.name}</span> ({a.role}) -{' '}
                    <span className="text-amber-300">{a.work}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
