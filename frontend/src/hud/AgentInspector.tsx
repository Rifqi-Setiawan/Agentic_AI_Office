import React, { useEffect, useState } from 'react';
import { useOfficeStore } from '../store/officeStore';
import type { TaskRef } from '../types/office';

export interface AgentMetaInfo {
  id: string;
  name: string;
  role: string;
  signatureColor: string;
  model: string;
  department?: string;
  alias?: string;
}

export const AGENT_PERSONA_CATALOG: Record<string, AgentMetaInfo> = {
  jarvis: {
    id: 'jarvis',
    name: 'Jarvis',
    role: 'Principal Orchestrator',
    department: 'Leadership & Dispatch',
    signatureColor: '#1F3A68',
    model: 'ag/gemini-3.8-flash-high',
  },
  daedalus: {
    id: 'daedalus',
    name: 'Daedalus',
    role: 'System Architect',
    department: 'Architecture & Specs',
    signatureColor: '#2F6FB3',
    model: 'ag/gemini-3.8-flash-high',
  },
  oracle: {
    id: 'oracle',
    name: 'Oracle',
    role: 'Research Scientist',
    department: 'Research & Strategy',
    signatureColor: '#8A4FBF',
    model: 'google/gemini-1.5-pro',
  },
  merlin: {
    id: 'merlin',
    name: 'Merlin',
    role: 'Knowledge Mentor',
    department: 'Knowledge & Mentoring',
    signatureColor: '#B5652B',
    model: 'ag/gemini-3.8-flash-high',
  },
  muse: {
    id: 'muse',
    name: 'Muse',
    role: 'Design Lead',
    department: 'Design & Visual Systems',
    signatureColor: '#E0567A',
    model: 'ag/gemini-3.8-flash-high',
  },
  prism: {
    id: 'prism',
    name: 'Prism',
    role: 'Frontend Specialist',
    department: 'Frontend Engineering',
    signatureColor: '#2BB3C0',
    model: 'ag/gemini-3.8-flash-high',
  },
  forge: {
    id: 'forge',
    name: 'Forge',
    role: 'Backend Specialist',
    department: 'Core Engineering',
    signatureColor: '#D9622B',
    model: 'ag/gemini-3.8-flash-high',
  },
  vector: {
    id: 'vector',
    name: 'Vector',
    role: 'Data Engineer',
    department: 'Data Infrastructure',
    signatureColor: '#3FA66B',
    model: 'ag/gemini-3.8-flash-high',
  },
  sentinel: {
    id: 'sentinel',
    name: 'Sentinel',
    role: 'QA Lead & Auditor',
    department: 'Quality Assurance',
    signatureColor: '#D23C3C',
    model: 'ag/gemini-3.8-flash-high',
  },
  bastion: {
    id: 'bastion',
    name: 'Bastion',
    role: 'Security & SOC Officer',
    department: 'Security & Operations',
    signatureColor: '#6B7785',
    model: 'ag/gemini-3.8-flash-high',
  },
  relay: {
    id: 'relay',
    name: 'Relay',
    role: 'Release Officer',
    department: 'Release & CI/CD',
    signatureColor: '#6D5BD0',
    model: 'ag/gemini-3.8-flash-high',
  },
  warden: {
    id: 'warden',
    name: 'Warden',
    role: 'Operations & Facilities',
    department: 'Infrastructure & Ops',
    signatureColor: '#8E8E3A',
    model: 'ag/gemini-3.8-flash-high',
  },
  steward: {
    id: 'steward',
    name: 'Steward',
    role: 'Graphics & Engine Lead',
    department: 'Engine & Graphics',
    signatureColor: '#9CC23A',
    model: 'ag/gemini-3.8-flash-high',
  },
  scribe: {
    id: 'scribe',
    name: 'Scribe',
    role: 'Documentation & Librarian',
    department: 'Knowledge & Documentation',
    signatureColor: '#7A4A2E',
    model: 'ag/gemini-3.8-flash-high',
  },
  nova: {
    id: 'nova',
    name: 'Nova',
    role: 'Ops & Automation',
    department: 'Automation & Scripts',
    signatureColor: '#F2C230',
    model: 'ag/gemini-3.8-flash-high',
  },
  rifqi: {
    id: 'rifqi',
    name: 'Rifqi',
    role: 'Founder & Visionary',
    department: 'Executive',
    signatureColor: '#F5F0E1',
    model: 'founder-direct',
  },
  guest: {
    id: 'guest',
    name: 'Tamu',
    role: 'Pengunjung Kantor',
    department: 'Visitor',
    signatureColor: '#9CA8B8',
    model: 'guest-persona',
  },
};

export const AgentInspector: React.FC = () => {
  const selectedAgentId = useOfficeStore((s) => s.selectedAgentId);
  const selectAgent = useOfficeStore((s) => s.selectAgent);
  const agents = useOfficeStore((s) => s.agents);
  const projection = useOfficeStore((s) => s.projection);
  const isFounderAuthenticated = useOfficeStore((s) => s.isFounderAuthenticated);

  // Proyeksi founder hanya sah jika projection === 'founder' DAN user terautentikasi sebagai founder
  const isFounderMode = projection === 'founder' && isFounderAuthenticated;

  const [recentTasks, setRecentTasks] = useState<TaskRef[]>([]);

  // Keyboard shortcut: Escape untuk menutup inspector
  useEffect(() => {
    if (!selectedAgentId) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        selectAgent(null);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [selectedAgentId, selectAgent]);

  // Muat detail agent tambahan jika endpoint tersedia
  useEffect(() => {
    if (!selectedAgentId) {
      setRecentTasks([]);
      return;
    }

    let isMounted = true;
    const fetchDetail = async () => {
      try {
        const baseUrl =
          typeof window !== 'undefined' && window.location && window.location.origin
            ? window.location.origin
            : 'http://localhost';
        const projParam = isFounderMode ? '?projection=founder' : '?projection=public';
        const res = await fetch(`${baseUrl}/api/v1/agents/${selectedAgentId}${projParam}`, {
          credentials: 'include',
        });
        if (res.ok) {
          const data = await res.json();
          if (isMounted && data.recent_tasks) {
            setRecentTasks(data.recent_tasks);
          }
        }
      } catch {
        // Fallback anggun: jika endpoint belum siap atau offline, tidak melempar error
      }
    };

    fetchDetail();
    return () => {
      isMounted = false;
    };
  }, [selectedAgentId, isFounderMode]);

  if (!selectedAgentId) {
    return null;
  }

  const agentState = agents[selectedAgentId];
  const meta = AGENT_PERSONA_CATALOG[selectedAgentId] || {
    id: selectedAgentId,
    name: selectedAgentId,
    role: 'Spesialis Agen',
    signatureColor: '#2bb3c0',
    model: 'ag/gemini-3.8-flash-high',
  };

  const name = agentState?.name || meta.name;
  const role = agentState?.role || meta.role;
  const department = meta.department || 'Engineering';
  const signatureColor = meta.signatureColor;
  const presence = agentState?.presence || 'on_duty';
  const workStatus = agentState?.work || 'idle';
  const task = agentState?.task || null;
  const doneToday = agentState?.done_today ?? 0;
  const currentAction = agentState?.action || 'Siaga di meja kerja';
  const zone = agentState?.zone || 'Kantor Hermes';
  const model = meta.model;

  return (
    <aside
      className="pointer-events-auto fixed top-20 right-4 z-30 w-84 sm:w-96 max-w-[calc(100vw-2rem)] bg-[#14141e]/98 backdrop-blur-md border border-[#282d3f] rounded-lg shadow-2xl text-xs overflow-hidden select-none animate-in fade-in slide-in-from-right-4 duration-200 motion-reduce:transition-none"
      role="dialog"
      aria-label={`Detail Agen ${name}`}
      data-testid="agent-inspector"
    >
      {/* Header bar dengan aksen warna persona */}
      <div
        className="h-1.5 w-full"
        style={{ backgroundColor: signatureColor }}
        aria-hidden="true"
      />

      <div className="flex items-center justify-between px-3.5 py-2.5 bg-[#1a1c29] border-b border-[#282d3f] gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <span
            className="w-3.5 h-3.5 rounded-full border border-white/20 shrink-0 shadow-sm"
            style={{ backgroundColor: signatureColor }}
            aria-hidden="true"
          />
          <div className="min-w-0">
            <h2 className="font-bold text-[#f5f0e1] truncate text-sm leading-tight tracking-display">
              {name}
            </h2>
            <p className="text-[10px] text-[#9ca8b8] font-mono truncate">
              {`@${selectedAgentId} · ${role}`}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => selectAgent(null)}
          aria-label="Tutup panel inspector"
          className="text-[#9ca8b8] hover:text-[#f5f0e1] p-1 rounded hover:bg-[#282d3f] transition-colors shrink-0 focus-visible:ring-2 focus-visible:ring-[#2bb3c0] focus-visible:outline-none"
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

      {/* Konten detail inspector */}
      <div className="p-3.5 space-y-3 font-mono text-[11px] text-[#9ca8b8] max-h-[calc(100vh-10rem)] overflow-y-auto">
        {/* Status kehadiran & status kerja */}
        <div className="grid grid-cols-2 gap-2">
          <div className="bg-[#1a1c29]/70 p-2 rounded border border-[#282d3f]/60">
            <span className="text-[10px] text-[#687594] block uppercase">Kehadiran:</span>
            <div className="mt-1 flex items-center gap-1.5">
              <span
                className={`w-2 h-2 rounded-full ${
                  presence === 'on_duty'
                    ? 'bg-emerald-400'
                    : presence === 'off_duty'
                    ? 'bg-slate-400'
                    : 'bg-amber-400'
                }`}
              />
              <span className="text-[#f5f0e1] font-semibold capitalize">
                {presence === 'on_duty'
                  ? 'Bertugas'
                  : presence === 'off_duty'
                  ? 'Lepas Tugas'
                  : 'Siaga'}
              </span>
            </div>
          </div>

          <div className="bg-[#1a1c29]/70 p-2 rounded border border-[#282d3f]/60">
            <span className="text-[10px] text-[#687594] block uppercase">Status Kerja:</span>
            <div className="mt-1 flex items-center gap-1.5">
              {workStatus === 'working' ? (
                <span className="inline-flex items-center gap-1 text-amber-300 font-semibold">
                  <span className="w-2 h-2 rounded-full bg-amber-400 motion-safe:animate-pulse" />
                  Bekerja
                </span>
              ) : workStatus === 'done_recent' ? (
                <span className="inline-flex items-center gap-1 text-emerald-300 font-semibold">
                  <span className="w-2 h-2 rounded-full bg-emerald-400" />
                  Baru Selesai
                </span>
              ) : workStatus === 'blocked' ? (
                <span className="inline-flex items-center gap-1 text-rose-300 font-semibold">
                  <span className="w-2 h-2 rounded-full bg-rose-400" />
                  Terblokir
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-slate-300 font-semibold">
                  <span className="w-2 h-2 rounded-full bg-slate-400" />
                  Idle
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Model AI, Departemen, dan Zona */}
        <div className="space-y-1.5 bg-[#1a1c29]/40 p-2.5 rounded border border-[#282d3f]/40 text-[10px]">
          <div className="flex justify-between items-center">
            <span className="text-[#687594]">Model AI:</span>
            <span className="text-[#2bb3c0] font-semibold">{model}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-[#687594]">Departemen:</span>
            <span className="text-[#f5f0e1]">{department}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-[#687594]">Zona Saat Ini:</span>
            <span className="text-[#f5f0e1]">{zone}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-[#687594]">Tugas Selesai Hari Ini:</span>
            <span className="tabular-nums text-[#f5f0e1] font-bold">{doneToday} Tugas</span>
          </div>
        </div>

        {/* Aktivitas terkini */}
        <div>
          <span className="text-[10px] text-[#687594] uppercase tracking-wider block mb-1">
            Aktivitas Terkini:
          </span>
          <p className="bg-[#1a1c29] p-2 rounded border border-[#282d3f] text-[#f5f0e1] leading-relaxed break-words">
            {currentAction}
          </p>
        </div>

        {/* Task Aktif */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] text-[#687594] uppercase tracking-wider">
              Task Aktif:
            </span>
            {isFounderMode && (
              <span className="px-1.5 py-0.5 rounded text-[9px] bg-amber-950/80 text-amber-300 border border-amber-800 font-mono">
                👑 Telemetri Founder
              </span>
            )}
          </div>

          {task ? (
            <div className="bg-[#1a1c29] p-2.5 rounded border border-[#282d3f] space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[#2bb3c0] font-semibold">#{task.id}</span>
                <span className="px-1.5 py-0.5 rounded text-[9px] bg-amber-950/60 text-amber-300 border border-amber-800/60 uppercase">
                  {task.status}
                </span>
              </div>

              <div>
                <p className="text-[#f5f0e1] font-medium leading-tight">{task.title}</p>
                <p className="text-[10px] text-[#687594] mt-0.5 font-mono">
                  Board: {task.board || 'Proyek internal'}
                </p>
              </div>

              {task.block_kind && (
                <p className="text-rose-400 text-[10px]">
                  Terblokir: {task.block_kind}
                </p>
              )}

              {/* FIELD-FIELD FOUNDER: HANYA TAMPIL SAAT isFounderMode === true */}
              {isFounderMode && (
                <div
                  data-testid="founder-task-fields"
                  className="mt-2 pt-2 border-t border-[#282d3f] space-y-2 text-[10px]"
                >
                  {task.body && (
                    <div>
                      <span className="text-[#687594] uppercase block mb-0.5">
                        Deskripsi Tugas:
                      </span>
                      <p className="text-[#f5f0e1] bg-[#14141e] p-1.5 rounded border border-[#282d3f]/60 leading-relaxed whitespace-pre-wrap">
                        {task.body}
                      </p>
                    </div>
                  )}

                  {task.summary && (
                    <div>
                      <span className="text-[#687594] uppercase block mb-0.5">
                        Ringkasan Selesai:
                      </span>
                      <p className="text-emerald-300 bg-[#14141e] p-1.5 rounded border border-[#282d3f]/60 leading-relaxed">
                        {task.summary}
                      </p>
                    </div>
                  )}

                  {task.result && (
                    <div>
                      <span className="text-[#687594] uppercase block mb-0.5">Hasil Run:</span>
                      <p className="text-[#f5f0e1] bg-[#14141e] p-1.5 rounded border border-[#282d3f]/60 leading-relaxed">
                        {task.result}
                      </p>
                    </div>
                  )}

                  {task.error && (
                    <div>
                      <span className="text-rose-400 uppercase block mb-0.5">Error:</span>
                      <p className="text-rose-200 bg-rose-950/40 p-1.5 rounded border border-rose-800 leading-relaxed">
                        {task.error}
                      </p>
                    </div>
                  )}

                  {/* Metadata Teknis */}
                  <div className="bg-[#14141e] p-1.5 rounded border border-[#282d3f]/50 space-y-0.5">
                    <span className="text-[#687594] font-semibold uppercase block">
                      Metadata Sistem:
                    </span>
                    {task.workspace_path && (
                      <div className="flex justify-between gap-1">
                        <span className="text-[#687594]">Workspace:</span>
                        <span className="text-[#f5f0e1] font-mono truncate">{task.workspace_path}</span>
                      </div>
                    )}
                    {task.branch_name && (
                      <div className="flex justify-between gap-1">
                        <span className="text-[#687594]">Branch:</span>
                        <span className="text-[#f5f0e1] font-mono truncate">{task.branch_name}</span>
                      </div>
                    )}
                    {task.worker_pid !== null && task.worker_pid !== undefined && (
                      <div className="flex justify-between gap-1">
                        <span className="text-[#687594]">Worker PID:</span>
                        <span className="tabular-nums font-mono text-emerald-400">
                          {task.worker_pid}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <p className="text-[#687594] italic bg-[#1a1c29]/50 p-2 rounded border border-[#282d3f]/40">
              Tidak ada task aktif saat ini.
            </p>
          )}
        </div>

        {/* Riwayat Task Terakhir */}
        {recentTasks.length > 0 && (
          <div>
            <span className="text-[10px] text-[#687594] uppercase tracking-wider block mb-1">
              Riwayat 5 Tugas Terakhir:
            </span>
            <div className="space-y-1 bg-[#1a1c29]/50 p-1.5 rounded border border-[#282d3f]/40">
              {recentTasks.map((t) => (
                <div
                  key={t.id}
                  className="flex items-center justify-between gap-2 p-1 rounded bg-[#14141e]/60 border border-[#282d3f]/40 text-[10px]"
                >
                  <div className="min-w-0">
                    <p className="text-[#f5f0e1] truncate">{t.title}</p>
                    <span className="text-[#687594] font-mono">#{t.id}</span>
                  </div>
                  <span className="px-1 py-0.2 rounded text-[9px] bg-slate-800 text-slate-300 uppercase shrink-0">
                    {t.status}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </aside>
  );
};