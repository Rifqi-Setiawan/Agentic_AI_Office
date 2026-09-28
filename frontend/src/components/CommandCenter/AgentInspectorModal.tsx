import React from 'react'
import { X, Cpu, ShieldCheck, Database, FolderGit2, Terminal, Activity } from 'lucide-react'

interface AgentInspectorModalProps {
  agentId: string | null
  onClose: () => void
  agents: any[]
}

const AGENT_SPEC_METADATA: Record<string, { role: string; desc: string; tools: string[]; permissions: string }> = {
  'vps-boss': {
    role: 'Chief Orchestrator & High-Level Planner',
    desc: 'Governs all projects, evaluates evidence, delegates to specialist agents, and interfaces directly with the user via Telegram.',
    tools: ['delegate_task', 'read_file', 'search_files', 'terminal', 'fact_store'],
    permissions: 'Global Orchestrator · Auto-Approve (YOLO)',
  },
  'professor': {
    role: 'Distinguished Research Scientist',
    desc: 'Conducts deep scientific literature reviews, algorithmic audits, academic paper engineering, and prompt strategy design.',
    tools: ['web_search', 'web_extract', 'terminal', 'read_file', 'write_file'],
    permissions: 'Autonomous Research · Read/Write Sandbox',
  },
  'swe-verifier': {
    role: 'Independent QA & Verification Sentry',
    desc: 'Independently verifies and tests implementations from swe-backend and swe-frontend. Reproduces tests, checks boundaries, and certifies release gates.',
    tools: ['terminal', 'pytest', 'read_file', 'search_files'],
    permissions: 'Strict Isolation · Independent Auditor',
  },
  'swe-backend': {
    role: 'Principal Backend Engineer',
    desc: 'Implements production server APIs (FastAPI), DuckDB/PostgreSQL databases, transactional logic, and control plane services.',
    tools: ['write_file', 'patch', 'terminal', 'pytest'],
    permissions: 'Full Backend Workspace',
  },
  'swe-frontend': {
    role: 'Principal Frontend Engineer',
    desc: 'Builds modern, responsive, anti-slop user interfaces with React, Tailwind CSS, Vite, and Canvas 2D/3D visualizations.',
    tools: ['write_file', 'patch', 'terminal', 'npm'],
    permissions: 'Frontend Workspace',
  },
  'data-engineer': {
    role: 'Principal Lakehouse Data Engineer',
    desc: 'Designs and builds Medallion lakehouses (Bronze, Silver, Gold), DuckDB pipelines, Parquet datasets, and data quality validation.',
    tools: ['python', 'duckdb', 'terminal', 'write_file'],
    permissions: 'Data Pipelines & Lakehouse',
  },
  'devops-engineer': {
    role: 'Principal SRE & DevOps Engineer',
    desc: 'Manages systemd user units, Docker containers, reverse proxy (Caddy), security hardening, and VPS operational vitals.',
    tools: ['systemctl', 'docker', 'terminal', 'read_file'],
    permissions: 'SRE & Infrastructure',
  },
  'ui-designer': {
    role: 'Principal UI/UX & Design Systems Architect',
    desc: 'Conceptualizes design systems, color palettes, typography, interactive mockups, and guarantees anti-AI-slop aesthetic standards.',
    tools: ['read_file', 'write_file', 'terminal'],
    permissions: 'Design Conceptualization',
  },
  'tech-mentor': {
    role: 'Technical Architecture Tutor',
    desc: 'Explains complex distributed systems, Medallion architectures, and answers interactive Q&A in Indonesian with clarity.',
    tools: ['read_file', 'search_files', 'terminal'],
    permissions: 'Interactive Education',
  },
  'github-manager': {
    role: 'Global Git & Release PIC',
    desc: 'Owns Git repository publishing, CI/CD pipeline verification, commit attribution hygiene, and GitHub releases.',
    tools: ['git', 'gh', 'terminal', 'read_file'],
    permissions: 'Release & Version Control',
  },
  'office-lead': {
    role: 'Virtual Systems & Stronghold Lead',
    desc: 'Oversees agent cockpit visualizations, real-time telemetry streaming, and spatial office representations.',
    tools: ['read_file', 'write_file', 'terminal'],
    permissions: 'Cockpit Architecture',
  },
  'paperwright': {
    role: 'LaTeX & Scientific Manuscript Scribe',
    desc: 'Compiles rigorous IEEE conference/journal papers using Tectonic engine and BibTeX citation formatting.',
    tools: ['tectonic', 'read_file', 'write_file', 'terminal'],
    permissions: 'Academic Publishing',
  },
  'vps-assistant': {
    role: 'General Operational Utility',
    desc: 'General-purpose worker for ad-hoc server maintenance, data conversion, scripting, and administrative tasks.',
    tools: ['terminal', 'read_file', 'write_file'],
    permissions: 'General Operational',
  },
  'rifqi': {
    role: 'Founder & Principal Authority',
    desc: 'The human system owner and final decision authority. Directs high-level strategy and approves major architecture overhauls.',
    tools: ['User Prompting', 'Telegram DM', 'Final Approvals'],
    permissions: 'Supreme Authority',
  },
}

export const AgentInspectorModal: React.FC<AgentInspectorModalProps> = ({ agentId, onClose, agents }) => {
  if (!agentId) return null

  const liveAgent = agents.find(a => a.id === agentId) || {}
  const spec = AGENT_SPEC_METADATA[agentId] || {
    role: 'Specialist AI Agent',
    desc: 'Dedicated agent process executing within the Hermes multi-agent sovereign ecosystem.',
    tools: ['terminal', 'read_file', 'write_file'],
    permissions: 'Standard Sandboxed Profile',
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-end bg-black/60 backdrop-blur-sm transition-opacity">
      <div className="h-full w-full max-w-lg border-l border-slate-800 bg-slate-950 p-6 shadow-2xl overflow-y-auto flex flex-col justify-between">
        <div>
          {/* Header */}
          <div className="flex items-center justify-between border-b border-slate-800 pb-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-cyan-500/30 bg-cyan-950/40 text-cyan-400">
                <Cpu className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white font-mono">{liveAgent.name || agentId}</h3>
                <p className="text-xs text-cyan-400 font-mono">{spec.role}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-2 text-slate-400 hover:bg-slate-900 hover:text-white transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Quick Specs */}
          <div className="grid grid-cols-2 gap-3 my-5">
            <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-3">
              <div className="flex items-center gap-2 text-slate-400 text-xs mb-1">
                <Cpu className="h-3.5 w-3.5 text-cyan-400" />
                <span>Foundation Model</span>
              </div>
              <p className="font-mono text-xs font-semibold text-slate-200 truncate">
                {liveAgent.model || 'ag/gemini-3.8-flash'}
              </p>
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-3">
              <div className="flex items-center gap-2 text-slate-400 text-xs mb-1">
                <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
                <span>Authority Level</span>
              </div>
              <p className="font-mono text-xs font-semibold text-slate-200 truncate">
                {spec.permissions}
              </p>
            </div>
          </div>

          {/* Role Description */}
          <div className="mb-5 rounded-xl border border-slate-800/80 bg-slate-900/30 p-4">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 font-mono mb-2">
              Operational Scope & Objective
            </h4>
            <p className="text-xs text-slate-300 leading-relaxed">
              {spec.desc}
            </p>
          </div>

          {/* Assigned Tools */}
          <div className="mb-5">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 font-mono mb-2.5">
              Authorized Toolset Capabilities
            </h4>
            <div className="flex flex-wrap gap-1.5">
              {spec.tools.map(t => (
                <span
                  key={t}
                  className="rounded-md border border-slate-700 bg-slate-900 px-2 py-1 font-mono text-[10px] text-cyan-300"
                >
                  {t}
                </span>
              ))}
            </div>
          </div>

          {/* Current Live State */}
          <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-4 font-mono">
            <div className="flex items-center justify-between text-xs mb-2">
              <span className="text-slate-400">Live Status:</span>
              <span className="font-bold text-emerald-400 uppercase">
                {liveAgent.state || 'IDLE'}
              </span>
            </div>
            <div className="flex items-start justify-between text-xs gap-2">
              <span className="text-slate-400 shrink-0">Current Action:</span>
              <span className="text-right text-slate-200 truncate">
                {liveAgent.status_desc || liveAgent.task || 'Ready on standby'}
              </span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="pt-6 border-t border-slate-800 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-mono font-semibold text-white transition-colors"
          >
            Close Inspector
          </button>
        </div>
      </div>
    </div>
  )
}
