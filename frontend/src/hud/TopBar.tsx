import React, { useEffect, useState } from 'react';
import { useOfficeStore } from '../store/officeStore';

export const TopBar: React.FC = () => {
  const connectionStatus = useOfficeStore((s) => s.connectionStatus);
  const lastSeq = useOfficeStore((s) => s.lastSeq);
  const vitals = useOfficeStore((s) => s.vitals);
  const timeOfDay = useOfficeStore((s) => s.timeOfDay);

  // Jam waktu nyata Asia/Jakarta (WIB)
  const [wibTime, setWibTime] = useState<string>('');

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      // Format ke waktu Asia/Jakarta (WIB, UTC+7)
      const formatted = new Intl.DateTimeFormat('id-ID', {
        timeZone: 'Asia/Jakarta',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
      }).format(now);
      setWibTime(`${formatted} WIB`);
    };

    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  const getConnectionBadge = () => {
    switch (connectionStatus) {
      case 'connected':
        return (
          <span
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-950/80 text-emerald-300 border border-emerald-800/80 shadow-sm"
            role="status"
            aria-label="Status koneksi: SSE Terhubung"
          >
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>SSE Aktif</span>
            {lastSeq > 0 && <span className="tabular-nums font-mono text-[11px] opacity-75">#{lastSeq}</span>}
          </span>
        );
      case 'fallback_polling':
        return (
          <span
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-950/80 text-amber-300 border border-amber-800/80 shadow-sm"
            role="status"
            aria-label="Status koneksi: Fallback Polling Snapshot"
          >
            <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
            <span>Polling Snapshot (5s)</span>
            {lastSeq > 0 && <span className="tabular-nums font-mono text-[11px] opacity-75">#{lastSeq}</span>}
          </span>
        );
      case 'connecting':
      case 'reconnecting':
        return (
          <span
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-yellow-950/80 text-yellow-300 border border-yellow-800/80"
            role="status"
            aria-label="Status koneksi: Menghubungkan ulang"
          >
            <span className="w-2 h-2 rounded-full bg-yellow-400 animate-pulse" />
            <span>Menghubungkan...</span>
          </span>
        );
      case 'disconnected':
      default:
        return (
          <span
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-rose-950/80 text-rose-300 border border-rose-800/80"
            role="status"
            aria-label="Status koneksi: Terputus"
          >
            <span className="w-2 h-2 rounded-full bg-rose-500" />
            <span>Terputus</span>
          </span>
        );
    }
  };

  const getAtmosphereLabel = () => {
    switch (timeOfDay) {
      case 'dawn':
        return '🌅 Fajar';
      case 'day':
        return '☀️ Siang';
      case 'dusk':
        return '🌇 Senja';
      case 'night':
        return '🌙 Malam';
      default:
        return '☀️ Siang';
    }
  };

  return (
    <header
      className="pointer-events-auto w-full px-4 py-2.5 bg-[#14141e]/90 backdrop-blur-md border-b border-[#282d3f] flex items-center justify-between shadow-lg select-none"
      role="banner"
    >
      {/* Brand & Project Info */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-sm bg-[#2bb3c0] shadow-[0_0_8px_rgba(43,179,192,0.8)]" />
          <h1 className="text-sm font-semibold tracking-display text-[#f5f0e1]">
            Agentic AI Office <span className="text-[#2bb3c0] text-xs font-mono">v2</span>
          </h1>
        </div>
        <span className="text-[#687594] text-xs">•</span>
        {getConnectionBadge()}
      </div>

      {/* Center: Live WIB Digital Clock & Atmosphere */}
      <div className="flex items-center gap-3 text-xs text-[#9ca8b8]">
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-[#1a1c29] border border-[#282d3f]">
          <span className="text-xs">{getAtmosphereLabel()}</span>
          <span className="text-[#687594]">•</span>
          <time className="tabular-nums font-mono font-medium text-[#f5f0e1] tracking-wider">
            {wibTime || '--:--:-- WIB'}
          </time>
        </div>
      </div>

      {/* Right: Host Vitals Chip (CPU / RAM / Disk) */}
      <div className="flex items-center gap-2">
        {vitals ? (
          <div
            className="flex items-center gap-2 text-xs font-mono px-3 py-1 rounded bg-[#1a1c29] border border-[#282d3f] shadow-inner"
            aria-label="Telemetri Host VPS"
          >
            <span className="flex items-center gap-1 text-[#9ca8b8]">
              <span className="text-[10px] text-[#687594]">CPU</span>
              <span className="tabular-nums font-semibold text-emerald-400">
                {vitals.cpu_percent.toFixed(1)}%
              </span>
            </span>
            <span className="text-[#282d3f]">|</span>
            <span className="flex items-center gap-1 text-[#9ca8b8]">
              <span className="text-[10px] text-[#687594]">RAM</span>
              <span className="tabular-nums font-semibold text-sky-400">
                {vitals.memory_percent.toFixed(1)}%
              </span>
            </span>
            <span className="text-[#282d3f]">|</span>
            <span className="flex items-center gap-1 text-[#9ca8b8]">
              <span className="text-[10px] text-[#687594]">DISK</span>
              <span className="tabular-nums font-semibold text-slate-300">
                {vitals.disk_percent.toFixed(1)}%
              </span>
            </span>
          </div>
        ) : (
          <div className="text-xs font-mono text-[#687594] px-2 py-1">
            Telemetri memuat...
          </div>
        )}
      </div>
    </header>
  );
};
