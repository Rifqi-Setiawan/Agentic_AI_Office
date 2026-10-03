import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useOfficeStore } from '../store/officeStore';
import { AGENT_PERSONA_CATALOG } from './AgentInspector';
import { worldApp } from '../world/WorldApp';

export const AgentSidebar: React.FC = () => {
  const isOpen = useOfficeStore((s) => s.isAgentSidebarOpen);
  const setOpen = useOfficeStore((s) => s.setAgentSidebarOpen);
  const agentList = useOfficeStore((s) => s.agentList);
  const selectedAgentId = useOfficeStore((s) => s.selectedAgentId);
  const selectAgent = useOfficeStore((s) => s.selectAgent);

  const [searchQuery, setSearchQuery] = useState<string>('');
  const [focusedIndex, setFocusedIndex] = useState<number>(0);
  const listRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);

  // Siapkan daftar agen terpadu dari store atau catalog statis
  const displayAgents = useMemo(() => {
    // Buat daftar dasar dari katalog persona untuk menjaga urutan persona resmi
    const catalogKeys = Object.keys(AGENT_PERSONA_CATALOG);

    return catalogKeys.map((id) => {
      const liveState = agentList.find((a) => a.id === id);
      const meta = AGENT_PERSONA_CATALOG[id];

      return {
        id,
        name: liveState?.name || meta.name,
        role: liveState?.role || meta.role,
        signatureColor: meta.signatureColor,
        presence: liveState?.presence || 'on_duty',
        work: liveState?.work || 'idle',
        done_today: liveState?.done_today ?? 0,
        action: liveState?.action || 'Siaga di meja kerja',
        zone: liveState?.zone || null,
        task: liveState?.task || null,
      };
    });
  }, [agentList]);

  // Filter agen berdasarkan query pencarian
  const filteredAgents = useMemo(() => {
    if (!searchQuery.trim()) return displayAgents;
    const q = searchQuery.toLowerCase().trim();
    return displayAgents.filter(
      (a) =>
        a.name.toLowerCase().includes(q) ||
        a.role.toLowerCase().includes(q) ||
        a.id.toLowerCase().includes(q) ||
        a.work.toLowerCase().includes(q),
    );
  }, [displayAgents, searchQuery]);

  // Reset fokus ketika query atau status buka berubah
  useEffect(() => {
    setFocusedIndex(0);
  }, [searchQuery, isOpen]);

  // Keyboard shortcut global: Escape untuk menutup sidebar
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, setOpen]);

  // Navigasi keyboard di dalam list agen (Arrow Up, Arrow Down, Home, End, Enter, Space)
  const handleListKeyDown = (e: React.KeyboardEvent) => {
    if (filteredAgents.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      const nextIndex = (focusedIndex + 1) % filteredAgents.length;
      setFocusedIndex(nextIndex);
      itemRefs.current[nextIndex]?.focus();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      const prevIndex = (focusedIndex - 1 + filteredAgents.length) % filteredAgents.length;
      setFocusedIndex(prevIndex);
      itemRefs.current[prevIndex]?.focus();
    } else if (e.key === 'Home') {
      e.preventDefault();
      setFocusedIndex(0);
      itemRefs.current[0]?.focus();
    } else if (e.key === 'End') {
      e.preventDefault();
      const lastIndex = filteredAgents.length - 1;
      setFocusedIndex(lastIndex);
      itemRefs.current[lastIndex]?.focus();
    }
  };

  const handleSelectAgent = (agent: { id: string; zone: string | null }) => {
    selectAgent(agent.id);
    if (agent.zone) {
      worldApp.flyToZone(agent.zone);
    }
  };

  if (!isOpen) {
    return null;
  }

  return (
    <aside
      id="agent-sidebar"
      className="pointer-events-auto fixed top-12 left-0 bottom-0 z-30 w-72 sm:w-80 bg-[#14141e]/95 backdrop-blur-md border-r border-[#282d3f] flex flex-col shadow-2xl select-none animate-in slide-in-from-left duration-200 motion-reduce:transition-none"
      role="region"
      aria-label="Daftar Agen Kantor"
      data-testid="agent-sidebar"
    >
      {/* Header Sidebar */}
      <div className="flex items-center justify-between px-3.5 py-2.5 bg-[#1a1c29] border-b border-[#282d3f]">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-[#2bb3c0]" aria-hidden="true" />
          <h2 className="text-xs font-bold tracking-wide text-[#f5f0e1]">
            Daftar Agen ({filteredAgents.length})
          </h2>
        </div>

        <button
          type="button"
          onClick={() => setOpen(false)}
          aria-label="Tutup daftar agen"
          className="text-[#9ca8b8] hover:text-[#f5f0e1] p-1 rounded hover:bg-[#282d3f] transition-colors focus-visible:ring-2 focus-visible:ring-[#2bb3c0] focus-visible:outline-none"
        >
          <svg
            className="w-4 h-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Input Pencarian Agen */}
      <div className="p-2.5 bg-[#14141e] border-b border-[#282d3f]/60">
        <label htmlFor="agent-search-input" className="sr-only">
          Cari agen berdasarkan nama atau peran
        </label>
        <div className="relative">
          <input
            id="agent-search-input"
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Cari agen atau peran..."
            aria-label="Cari agen berdasarkan nama atau peran"
            className="w-full bg-[#1a1c29] border border-[#282d3f] text-[#f5f0e1] placeholder-[#687594] text-xs rounded px-2.5 py-1.5 focus:border-[#2bb3c0] focus-visible:ring-1 focus-visible:ring-[#2bb3c0] focus-visible:outline-none"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              aria-label="Hapus teks pencarian"
              className="absolute right-2 top-1.5 text-[#687594] hover:text-[#f5f0e1] text-xs"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Daftar Agen Navigasi Keyboard */}
      <div
        ref={listRef}
        onKeyDown={handleListKeyDown}
        role="listbox"
        aria-label="Daftar agen kantor yang dapat dinavigasi dengan tombol panah"
        className="flex-1 overflow-y-auto p-2 space-y-1 focus:outline-none"
        tabIndex={0}
      >
        {filteredAgents.length === 0 ? (
          <p className="text-xs text-[#687594] text-center py-6">
            Tidak ada agen yang cocok dengan &quot;{searchQuery}&quot;
          </p>
        ) : (
          filteredAgents.map((agent, idx) => {
            const isSelected = selectedAgentId === agent.id;
            const isFocused = focusedIndex === idx;

            return (
              <button
                key={agent.id}
                ref={(el) => {
                  itemRefs.current[idx] = el;
                }}
                type="button"
                role="option"
                aria-selected={isSelected}
                tabIndex={isFocused ? 0 : -1}
                onClick={() => handleSelectAgent(agent)}
                onFocus={() => setFocusedIndex(idx)}
                aria-label={`Pilih agen ${agent.name}, peran ${agent.role}, status kerja ${agent.work}`}
                className={`w-full text-left p-2 rounded flex items-center justify-between gap-2.5 transition-colors focus-visible:ring-2 focus-visible:ring-[#2bb3c0] focus-visible:outline-none ${
                  isSelected
                    ? 'bg-[#282d3f] border border-[#2bb3c0]/60 shadow-sm'
                    : 'bg-[#1a1c29]/70 hover:bg-[#1a1c29] border border-[#282d3f]/40 hover:border-[#282d3f]'
                }`}
              >
                {/* Kolom Kiri: Avatar Aksen & Nama */}
                <div className="flex items-center gap-2.5 min-w-0">
                  <span
                    className="w-3 h-3 rounded-full shrink-0 shadow-sm border border-white/20"
                    style={{ backgroundColor: agent.signatureColor }}
                    aria-hidden="true"
                  />
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="font-bold text-xs text-[#f5f0e1] truncate leading-tight">
                        {agent.name}
                      </span>
                      <span className="text-[10px] text-[#687594] font-mono">
                        @{agent.id}
                      </span>
                    </div>
                    <p className="text-[11px] text-[#9ca8b8] truncate leading-tight">
                      {agent.role}
                    </p>
                  </div>
                </div>

                {/* Kolom Kanan: Status Kerja & Task Done */}
                <div className="flex flex-col items-end gap-1 shrink-0 text-[10px]">
                  {agent.work === 'working' ? (
                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-amber-950/60 text-amber-300 font-semibold border border-amber-800/60">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-400 motion-safe:animate-pulse" />
                      Bekerja
                    </span>
                  ) : agent.work === 'done_recent' ? (
                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-emerald-950/60 text-emerald-300 font-semibold border border-emerald-800/60">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                      Selesai
                    </span>
                  ) : agent.work === 'blocked' ? (
                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-rose-950/60 text-rose-300 font-semibold border border-rose-800/60">
                      <span className="w-1.5 h-1.5 rounded-full bg-rose-400" />
                      Terblokir
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-[#14141e] text-slate-400 border border-[#282d3f]">
                      Idle
                    </span>
                  )}

                  <span className="text-[10px] text-[#687594]">
                    Hari ini:{' '}
                    <strong className="tabular-nums font-mono text-[#f5f0e1]">
                      {agent.done_today}
                    </strong>
                  </span>
                </div>
              </button>
            );
          })
        )}
      </div>

      {/* Footer Petunjuk Navigasi Keyboard */}
      <div className="px-3 py-2 bg-[#1a1c29]/90 border-t border-[#282d3f] text-[10px] text-[#687594] flex items-center justify-between">
        <span>Gunakan ↑ ↓ untuk navigasi</span>
        <span>Enter untuk memilih</span>
      </div>
    </aside>
  );
};