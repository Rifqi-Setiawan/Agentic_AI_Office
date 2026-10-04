import React, { useEffect, useState } from 'react';
import { useOfficeStore } from '../store/officeStore';
import { AudioControl } from './AudioControl';
import { worldController as worldApp } from '../world/worldController';

export const TopBar: React.FC = () => {
  const connectionStatus = useOfficeStore((s) => s.connectionStatus);
  const lastSeq = useOfficeStore((s) => s.lastSeq);
  const vitals = useOfficeStore((s) => s.vitals);
  const timeOfDay = useOfficeStore((s) => s.timeOfDay);
  const atmosphereOverride = useOfficeStore((s) => s.atmosphereOverride);
  const isAgentSidebarOpen = useOfficeStore((s) => s.isAgentSidebarOpen);
  const setAgentSidebarOpen = useOfficeStore((s) => s.setAgentSidebarOpen);
  const isFounderPanelOpen = useOfficeStore((s) => s.isFounderPanelOpen);
  const setFounderPanelOpen = useOfficeStore((s) => s.setFounderPanelOpen);
  const setLoginModalOpen = useOfficeStore((s) => s.setLoginModalOpen);
  const isFounderAuthenticated = useOfficeStore((s) => s.isFounderAuthenticated);
  const agentList = useOfficeStore((s) => s.agentList);
  const activeCollective = useOfficeStore((s) => s.activeCollective);
  const isHonestMode = useOfficeStore((s) => s.isHonestMode);
  const setHonestMode = useOfficeStore((s) => s.setHonestMode);

  // Jam waktu nyata Asia/Jakarta (WIB)
  const [wibTime, setWibTime] = useState<string>('');
  const [currentZoom, setCurrentZoom] = useState<number>(1);

  const handleZoom = (level: 1 | 2 | 3) => {
    worldApp.setZoomLevel(level);
    setCurrentZoom(level);
  };

  const handleFlight = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const zoneId = e.target.value;
    if (zoneId) {
      worldApp.flyToZone(zoneId);
      e.target.value = '';
    }
  };

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
            className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium bg-emerald-950/80 text-emerald-300 border border-emerald-800/80 shadow-sm"
            role="status"
            aria-label="Status koneksi: SSE Terhubung"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 motion-safe:animate-pulse" />
            <span>SSE Aktif</span>
            {lastSeq > 0 && <span className="tabular-nums font-mono text-[10px] opacity-75">#{lastSeq}</span>}
          </span>
        );
      case 'fallback_polling':
        return (
          <span
            className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium bg-amber-950/80 text-amber-300 border border-amber-800/80 shadow-sm"
            role="status"
            aria-label="Status koneksi: Fallback Polling Snapshot"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 motion-safe:animate-ping" />
            <span>Polling Snapshot (5s)</span>
            {lastSeq > 0 && <span className="tabular-nums font-mono text-[10px] opacity-75">#{lastSeq}</span>}
          </span>
        );
      case 'connecting':
      case 'reconnecting':
        return (
          <span
            className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium bg-yellow-950/80 text-yellow-300 border border-yellow-800/80"
            role="status"
            aria-label="Status koneksi: Menghubungkan ulang"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-yellow-400 motion-safe:animate-pulse" />
            <span>Menghubungkan...</span>
          </span>
        );
      case 'disconnected':
      default:
        return (
          <span
            className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium bg-rose-950/80 text-rose-300 border border-rose-800/80"
            role="status"
            aria-label="Status koneksi: Terputus"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
            <span>Terputus</span>
          </span>
        );
    }
  };

  const getAtmosphereLabel = () => {
    let baseLabel = '☀️ Siang';
    switch (timeOfDay) {
      case 'dawn':
        baseLabel = '🌅 Fajar';
        break;
      case 'day':
        baseLabel = '☀️ Siang';
        break;
      case 'dusk':
        baseLabel = '🌇 Senja';
        break;
      case 'night':
        baseLabel = '🌙 Malam';
        break;
    }
    if (atmosphereOverride && atmosphereOverride !== 'auto') {
      return `${baseLabel} (Manual)`;
    }
    return baseLabel;
  };

  return (
    <header
      id="top-bar"
      className="pointer-events-auto w-full px-3 py-2 bg-[#14141e]/95 backdrop-blur-md border-b border-[#282d3f] flex flex-wrap items-center justify-between shadow-lg select-none gap-2 text-xs"
      role="banner"
    >
      {/* Brand & Project Info & Toggle Sidebar */}
      <div className="flex items-center gap-2.5">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-sm bg-[#2bb3c0] shadow-[0_0_8px_rgba(43,179,192,0.8)]" />
          <h1 className="text-sm font-semibold tracking-display text-[#f5f0e1]">
            Agentic AI Office <span className="text-[#2bb3c0] text-xs font-mono">v2</span>
          </h1>
        </div>
        <span className="text-[#687594] text-xs">•</span>
        {getConnectionBadge()}

        {/* Indikator Event Kolektif Aktif (Rapat / Sholat / Break) */}
        {activeCollective?.active && (
          <div
            data-testid="collective-event-badge"
            className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-indigo-950/80 border border-indigo-700/80 text-indigo-200 text-xs font-medium animate-pulse"
            role="status"
            aria-label={`Event Kolektif Aktif: ${activeCollective.title}`}
          >
            <span aria-hidden="true">{activeCollective.kind === 'sholat' ? '🕌' : '📢'}</span>
            <span className="font-semibold">{activeCollective.title}</span>
            <span className="text-[10px] text-indigo-400">
              ({activeCollective.kind}) • <span className="tabular-nums font-mono">{activeCollective.participants?.length ?? 0}</span> undangan
            </span>
          </div>
        )}

        {/* Tombol Toggle Daftar Agen */}
        <button
          type="button"
          onClick={() => setAgentSidebarOpen(!isAgentSidebarOpen)}
          aria-expanded={isAgentSidebarOpen}
          aria-controls="agent-sidebar"
          aria-label={isAgentSidebarOpen ? 'Tutup daftar agen' : 'Buka daftar agen'}
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded border text-xs font-medium transition-colors focus-visible:ring-2 focus-visible:ring-[#2bb3c0] focus-visible:outline-none ${
            isAgentSidebarOpen
              ? 'bg-[#2bb3c0] text-[#14141e] border-[#2bb3c0] font-bold'
              : 'bg-[#1a1c29] border-[#282d3f] text-[#f5f0e1] hover:bg-[#282d3f]'
          }`}
        >
          <span>👥</span>
          <span>Daftar Agen</span>
          <span className="tabular-nums font-mono text-[10px] px-1 py-0.2 rounded bg-black/20">
            {agentList.length || 16}
          </span>
        </button>
      </div>

      <AudioControl />

      {/* Center: Live WIB Digital Clock & Atmosphere + Camera Controls */}
      <div className="flex items-center gap-2 text-xs text-[#9ca8b8] flex-wrap">
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-[#1a1c29] border border-[#282d3f]">
          <span className="text-xs" aria-label={`Mode atmosfer: ${getAtmosphereLabel()}`}>
            {getAtmosphereLabel()}
          </span>
          <span className="text-[#687594]">•</span>
          <time className="tabular-nums font-mono font-medium text-[#f5f0e1] tracking-wider" aria-label="Waktu WIB Saat Ini">
            {wibTime || '--:--:-- WIB'}
          </time>
        </div>

        {/* Camera Zoom (1x, 2x, 3x) */}
        <div className="flex items-center rounded bg-[#1a1c29] border border-[#282d3f] p-0.5" role="group" aria-label="Kontrol Zoom Kamera">
          {([1, 2, 3] as const).map((lvl) => (
            <button
              key={lvl}
              type="button"
              onClick={() => handleZoom(lvl)}
              className={`px-2 py-0.5 text-[11px] font-mono rounded transition-colors focus-visible:ring-1 focus-visible:ring-[#2bb3c0] focus-visible:outline-none ${
                currentZoom === lvl
                  ? 'bg-[#2bb3c0] text-[#14141e] font-bold shadow-sm'
                  : 'text-[#9ca8b8] hover:text-[#f5f0e1] hover:bg-[#282d3f]'
              }`}
              aria-label={`Skala Zoom ${lvl}x`}
            >
              {lvl}x
            </button>
          ))}
        </div>

        {/* Quick Zone Flight */}
        <select
          onChange={handleFlight}
          defaultValue=""
          className="bg-[#1a1c29] border border-[#282d3f] text-[#9ca8b8] text-[11px] rounded px-2 py-1 outline-none hover:text-[#f5f0e1] focus:border-[#2bb3c0] cursor-pointer focus-visible:ring-1 focus-visible:ring-[#2bb3c0]"
          aria-label="Pilih Zona Flight"
        >
          <option value="" disabled>
            ✈️ Terbang ke Zona...
          </option>
          <option value="Z01">Z01 Ruang CEO (Jarvis)</option>
          <option value="Z02">Z02 Boardroom</option>
          <option value="Z03">Z03 Ruang Arsitektur (Daedalus)</option>
          <option value="Z04">Z04 Ruang Kelas (Merlin)</option>
          <option value="Z05">Z05 Perpustakaan (Scribe)</option>
          <option value="Z06">Z06 Lab Riset (Oracle)</option>
          <option value="Z07">Z07 Studio Desain (Muse)</option>
          <option value="Z08">Z08 Dev Pods (Prism/Forge/Nova)</option>
          <option value="Z09">Z09 Graphics Lab (Steward)</option>
          <option value="Z10">Z10 QA Station (Sentinel)</option>
          <option value="Z11">Z11 Release Dock (Relay)</option>
          <option value="Z12">Z12 Data Center &amp; SOC (Vector/Bastion)</option>
          <option value="Z13">Z13 Lobi (Warden)</option>
          <option value="Z14">Z14 Kafetaria &amp; Lounge</option>
          <option value="Z15">Z15 Arcade</option>
          <option value="Z16">Z16 Musholla</option>
          <option value="Z17">Z17 Kolam luar</option>
        </select>
      </div>

      {/* Right: Founder Auth & Host Vitals Chip */}
      <div className="flex items-center gap-2">
        {/* Toggle Mode Jujur (F22) */}
        <button
          type="button"
          role="switch"
          aria-checked={isHonestMode}
          aria-label="Mode Jujur (matikan simulasi ambient)"
          onClick={() => setHonestMode(!isHonestMode)}
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded border text-xs font-medium transition-colors focus-visible:ring-2 focus-visible:ring-[#2bb3c0] focus-visible:outline-none ${
            isHonestMode
              ? 'bg-amber-500/20 text-amber-300 border-amber-500/70 shadow-[0_0_8px_rgba(245,158,11,0.25)] font-semibold'
              : 'bg-[#1a1c29] border-[#282d3f] text-[#9ca8b8] hover:text-[#f5f0e1] hover:bg-[#282d3f]'
          }`}
          title="Mode Jujur: Matikan simulasi ambient, agen idle tetap diam di zonanya"
        >
          <span
            className={`w-2 h-2 rounded-full transition-colors ${
              isHonestMode ? 'bg-amber-400 motion-safe:animate-pulse' : 'bg-[#687594]'
            }`}
          />
          <span>Mode Jujur</span>
          <span
            className={`text-[10px] font-mono px-1 py-0.2 rounded ${
              isHonestMode ? 'bg-amber-400/30 text-amber-200' : 'bg-black/20 text-[#687594]'
            }`}
          >
            {isHonestMode ? 'Aktif' : 'Off'}
          </span>
        </button>

        {/* Founder Controls */}
        {!isFounderAuthenticated ? (
          <button
            type="button"
            onClick={() => setLoginModalOpen(true)}
            aria-label="Buka form login Founder"
            className="flex items-center gap-1 px-2.5 py-1 rounded bg-[#1a1c29] border border-[#282d3f] hover:border-amber-400 text-amber-300 hover:text-amber-200 text-xs font-medium transition-colors focus-visible:ring-2 focus-visible:ring-amber-400 focus-visible:outline-none"
          >
            <span>🔐</span>
            <span>Login Founder</span>
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setFounderPanelOpen(!isFounderPanelOpen)}
            aria-expanded={isFounderPanelOpen}
            aria-label="Buka panel kontrol Founder"
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded border text-xs font-semibold transition-colors focus-visible:ring-2 focus-visible:ring-amber-400 focus-visible:outline-none ${
              isFounderPanelOpen
                ? 'bg-amber-400 text-[#14141e] border-amber-400'
                : 'bg-amber-950/60 border-amber-800 text-amber-200 hover:bg-amber-950'
            }`}
          >
            <span>👑</span>
            <span>Panel Founder</span>
          </button>
        )}

        {/* Telemetri Vitals Host */}
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
