import { useEffect } from 'react'
import { AGENT_MAP, canonicalAgent, cleanText, agentStatus, activePairs } from './graphModel'
import type { AgentId, ExecutionSnapshot, LiveAgent } from './graphModel'

export interface AgentDetailMetadata {
  id: AgentId
  level: number
  levelLabel: string
  name: string
  title: string
  role: string
  model: string
  provider: string
  permissions: string
  workspace: string
  description: string
  responsibilities: string[]
  tools: string[]
  delegator: string | null
  subordinates: string[]
}

export const AGENT_SPEC_RECORD: Record<AgentId, AgentDetailMetadata> = {
  rifqi: {
    id: 'rifqi',
    level: 0,
    levelLabel: 'Level 0 — Human Governance',
    name: 'Rifqi Setiawan',
    title: 'Founder dan Otoritas Tertinggi',
    role: 'System Owner & Supreme Human Authority',
    model: 'Otoritas Manusia',
    provider: 'Direct Ingress (Telegram / CLI)',
    permissions: 'Otoritas Tertinggi (Hak Veto Mutlak & Persetujuan Arsitektur)',
    workspace: 'Sovereign Host Root (/srv)',
    description: 'Pemilik sistem dan otoritas pengambil keputusan tertinggi. Memberikan arahan strategis, persetujuan arsitektur utama, dan memegang hak veto atas seluruh operasi VPS serta ekosistem multi-agen.',
    responsibilities: [
      'Pemberi mandat utama dan pengambil keputusan strategis tertinggi.',
      'Otorisasi operasi berisiko tinggi, perubahan privilege, dan publikasi repositori.',
      'Evaluasi hasil deliverables dan penetapan standar kualitas anti-AI-slop.',
      'Komunikasi dua arah langsung dengan Jarvis via Telegram dan Voice Memos.',
    ],
    tools: ['Telegram DM', 'Voice Memos', 'Final Approval Gate', 'Mission Directives'],
    delegator: null,
    subordinates: ['Jarvis'],
  },
  jarvis: {
    id: 'jarvis',
    level: 1,
    levelLabel: 'Level 1 — Executive Orchestration',
    name: 'Jarvis',
    title: 'Orkestrasi dan Perencanaan',
    role: 'Chief Orchestrator & High-Level Planner',
    model: 'ag/gemini-3.8-flash-high',
    provider: '9Router (Loopback 127.0.0.1:8080)',
    permissions: 'Global Orchestrator · Auto-Approve (YOLO Mode)',
    workspace: '/srv/hermes-control',
    description: 'Pimpinan orkestrator otonom seluruh ekosistem VPS. Bertanggung jawab atas perencanaan tingkat tinggi, klasifikasi permintaan, dekomposisi tugas terukur, dan perutean ke agen spesialis.',
    responsibilities: [
      'Klasifikasi permintaan (proyek ada, peningkatan, server ops, proyek baru).',
      'Dekomposisi tugas terukur dan penetapan acceptance criteria sebelum delegasi.',
      'Pengawasan eksekusi sub-agen, verifikasi bukti empiris, dan sintesis laporan tunggal.',
      'Menjaga batasan memori global dan tata kelola hirarki agen sovereign.',
    ],
    tools: ['delegate_task', 'read_file', 'search_files', 'terminal', 'fact_store', 'memory', 'skill_view'],
    delegator: 'Rifqi Setiawan',
    subordinates: ['vps-assistant', 'Senku', 'swe-backend', 'swe-frontend', 'tech-mentor'],
  },
  'vps-assistant': {
    id: 'vps-assistant',
    level: 1,
    levelLabel: 'Level 1 — Executive Suite',
    name: 'vps-assistant',
    title: 'Asisten Eksekutif dan Co-pilot',
    role: 'General Operational Utility & Executive Co-pilot',
    model: 'ag/gemini-3.8-flash-high',
    provider: '9Router (Loopback 127.0.0.1:8080)',
    permissions: 'General Operational · Read/Write Sandbox',
    workspace: '/srv/hermes-control',
    description: 'Eksekutor operasional serbaguna yang bekerja berdampingan dengan Jarvis. Menangani eksekusi tugas ad-hoc yang tidak memerlukan agen spesialis khusus.',
    responsibilities: [
      'Pemeliharaan server ad-hoc, sanitasi cache, dan inspeksi direktori.',
      'Konversi data cepat, scripting otomatisasi shell, dan operasi file.',
      'Pengumpulan telemetri awal dan eksekusi tugas utilitas rutin.',
      'Mendukung kapasitas pemrosesan Jarvis tanpa mengambil alih peran arsitektur.',
    ],
    tools: ['terminal', 'read_file', 'write_file', 'patch', 'search_files'],
    delegator: 'Jarvis',
    subordinates: [],
  },
  senku: {
    id: 'senku',
    level: 2,
    levelLabel: 'Level 2 — Research & Science Pillar',
    name: 'Senku',
    title: 'Riset dan Sains',
    role: 'Distinguished Research Scientist',
    model: 'ag/claude-opus-4-6-thinking',
    provider: '9Router (Loopback 127.0.0.1:8080)',
    permissions: 'Autonomous Research Sandbox · First-Principles',
    workspace: '/srv/hermes-control/services',
    description: 'Ilmuwan riset komputasi dan domain intelligence. Menangani penyelidikan mendalam berbasis first-principles, telaah pustaka akademis peer-reviewed, dan kalibrasi epistemik.',
    responsibilities: [
      'Riset mendalam multi-domain dan dekomposisi masalah kompleks.',
      'Telaah literatur akademik terverifikasi (DOI, arXiv, Crossref, Semantic Scholar).',
      'Penyusunan arsitektur riset untuk implementasi pipeline dan naskah ilmiah.',
      'Kalibrasi epistemik (memisahkan fakta terbukti dari hipotesis spekulatif).',
    ],
    tools: ['web_search', 'web_extract', 'terminal', 'read_file', 'write_file', 'fact_store'],
    delegator: 'Jarvis',
    subordinates: ['data-engineer', 'paperwright'],
  },
  'swe-backend': {
    id: 'swe-backend',
    level: 2,
    levelLabel: 'Level 2 — Core Software Pillar',
    name: 'swe-backend',
    title: 'API dan Rekayasa Backend',
    role: 'Principal Backend Software Engineer',
    model: 'ag/gemini-3.8-flash-high',
    provider: '9Router (Loopback 127.0.0.1:8080)',
    permissions: 'Full Backend Workspace · ACID Standards',
    workspace: '/srv/hermes-control/services',
    description: 'Spesialis rekayasa backend performa tinggi. Bertanggung jawab atas server logic, API contract REST/SSE/WebSocket, koneksi database transaksional, dan pipeline internal.',
    responsibilities: [
      'Implementasi REST API contracts strictly-typed dengan FastAPI dan Pydantic.',
      'Arsitektur persistensi ACID, skema relasional (PostgreSQL), dan analitik (DuckDB).',
      'Desain rate limiting, background workers, idempotency, dan error handling.',
      'Penulisan automated test suite 100% lulus sebelum diserahkan ke swe-QA.',
    ],
    tools: ['write_file', 'patch', 'terminal', 'pytest', 'read_file', 'search_files'],
    delegator: 'Jarvis',
    subordinates: ['swe-QA'],
  },
  'swe-frontend': {
    id: 'swe-frontend',
    level: 2,
    levelLabel: 'Level 2 — Frontend & Presentation Pillar',
    name: 'swe-frontend',
    title: 'Antarmuka dan Frontend',
    role: 'Principal Frontend Software Engineer',
    model: 'ag/gemini-3.8-flash-high',
    provider: '9Router (Loopback 127.0.0.1:8080)',
    permissions: 'Frontend Workspace · Anti-AI-Slop Standard',
    workspace: '/srv/hermes-control/services',
    description: 'Spesialis rekayasa antarmuka pengguna modern. Membangun aplikasi web interaktif, responsif, dan bebas AI-slop menggunakan React, Next.js 15, Vite, dan Tailwind CSS.',
    responsibilities: [
      'Implementasi antarmuka web modern dengan arsitektur decoupled (React/Next.js).',
      'Penegakan standar anti-AI-slop (tabular-nums, hairline borders, responsif mobile).',
      'Visualisasi data interaktif, Canvas 2D/3D, dan konsumsi REST/WebSocket contracts.',
      'Verifikasi visual headless menggunakan browser_navigate dan browser_vision.',
    ],
    tools: ['write_file', 'patch', 'terminal', 'browser_navigate', 'browser_vision', 'read_file'],
    delegator: 'Jarvis',
    subordinates: ['ui-designer'],
  },
  'tech-mentor': {
    id: 'tech-mentor',
    level: 2,
    levelLabel: 'Level 2 — Platform & Education Pillar',
    name: 'tech-mentor',
    title: 'Arsitektur dan Sistem',
    role: 'Interactive Technical Architecture Tutor',
    model: 'ag/gemini-3.8-flash-high',
    provider: '9Router (Loopback 127.0.0.1:8080)',
    permissions: 'Interactive Education & Architecture Review',
    workspace: '/srv/hermes-control',
    description: 'Tutor teknis dan partner pembelajaran interaktif untuk Rifqi. Menjelaskan konsep arsitektur sistem terdistribusi, data engineering, dan metodologi rekayasa dalam Bahasa Indonesia.',
    responsibilities: [
      'Mentoring konsep data engineering, Kimball Star Schema, dan sistem terdistribusi.',
      'Menjawab pertanyaan konseptual dengan analogi jernih dan kode contoh konkret.',
      'Membantu dekomposisi fase pembelajaran dan pendalaman teknologi modern.',
      'Melakukan telaah arsitektural komparatif sebelum implementasi dilakukan.',
    ],
    tools: ['read_file', 'search_files', 'terminal', 'fact_store'],
    delegator: 'Jarvis',
    subordinates: ['devops-engineer'],
  },
  'data-engineer': {
    id: 'data-engineer',
    level: 3,
    levelLabel: 'Level 3 — Data & Lakehouse Specialist',
    name: 'data-engineer',
    title: 'Data Pipeline dan Lakehouse',
    role: 'Principal Lakehouse Data Engineer',
    model: 'ag/gemini-3.8-flash-high',
    provider: '9Router (Loopback 127.0.0.1:8080)',
    permissions: 'Data Pipelines & Lakehouse Workspace',
    workspace: '/srv/hermes-control/services',
    description: 'Insinyur pipeline data dan arsitektur analitik. Membangun Medallion Lakehouse (Bronze, Silver, Gold) berbasis DuckDB dan Apache Parquet dengan standar kualitas data ketat.',
    responsibilities: [
      'Konstruksi arsitektur Medallion Lakehouse (Bronze raw, Silver clean, Gold marts).',
      'Pemodelan Star Schema analitik dan optimalisasi query kolumnar DuckDB/Parquet.',
      'Penegakan 5-layer data quality assertions (L1 Schema hingga L5 Temporal as-of).',
      'Desain ingestion pipeline efemeral tanpa residu memori (/dev/shm & /tmp).',
    ],
    tools: ['duckdb', 'python', 'terminal', 'write_file', 'read_file', 'patch'],
    delegator: 'Senku',
    subordinates: [],
  },
  paperwright: {
    id: 'paperwright',
    level: 3,
    levelLabel: 'Level 3 — Scientific Publishing Specialist',
    name: 'paperwright',
    title: 'Naskah Akademik dan LaTeX',
    role: 'Scientific Manuscript & IEEE LaTeX Specialist',
    model: 'ag/gemini-3.8-flash-high',
    provider: '9Router (Loopback 127.0.0.1:8080)',
    permissions: 'Academic Publishing Workspace',
    workspace: '/srv/apps/hermes/workspaces/paperwright',
    description: 'Spesialis penyusunan manuskrip ilmiah dan publikasi akademik. Mengubah sintesis riset menjadi naskah IEEEtran dua kolom yang terkompilasi bersih via Tectonic.',
    responsibilities: [
      'Penulisan naskah akademik standar IEEEtran dua kolom dengan rigor ilmiah tinggi.',
      'Kompilasi lokal deterministik menggunakan mesin Tectonic tanpa TeX Live bloat.',
      'Manajemen sitasi BibTeX otomatis dan verifikasi silang DOI non-halusinasi.',
      'Penyusunan tabel ilmiah, notasi matematika, dan diagram arsitektur publikasi.',
    ],
    tools: ['tectonic', 'read_file', 'write_file', 'patch', 'terminal'],
    delegator: 'Senku',
    subordinates: [],
  },
  'swe-verifier': {
    id: 'swe-verifier',
    level: 3,
    levelLabel: 'Level 3 — Quality Assurance Sentry',
    name: 'swe-QA',
    title: 'Verifikasi Independen',
    role: 'Independent QA & Verification Sentry',
    model: 'ag/gemini-3.8-flash-high',
    provider: '9Router (Loopback 127.0.0.1:8080)',
    permissions: 'Strict Zero Self-Approval · Independent Auditor',
    workspace: '/srv/hermes-control',
    description: 'Penjaga gerbang kualitas independen. Melakukan audit kode secara objektif, mereproduksi pengujian, menguji skenario kegagalan, dan menegakkan prinsip pantang self-approve.',
    responsibilities: [
      'Reproduksi independen seluruh unit, integrasi, dan contract automated tests.',
      'Pengujian adversial terhadap batasan input, skenario edge case, dan kegagalan jaringan.',
      'Verifikasi statis (Ruff, Mypy) dan audit ketiadaan jejak AI pada kode/commit.',
      'Menerbitkan sertifikasi resmi PASS sebelum kode diizinkan masuk ke gerbang rilis.',
    ],
    tools: ['pytest', 'terminal', 'read_file', 'search_files', 'git'],
    delegator: 'swe-backend',
    subordinates: ['github-manager'],
  },
  'ui-designer': {
    id: 'ui-designer',
    level: 3,
    levelLabel: 'Level 3 — Design Systems Specialist',
    name: 'ui-designer',
    title: 'Sistem Desain',
    role: 'Principal UI/UX & Design Systems Architect',
    model: 'ag/gemini-3.8-flash-high',
    provider: '9Router (Loopback 127.0.0.1:8080)',
    permissions: 'Design Systems & Prototyping Workspace',
    workspace: '/srv/hermes-control',
    description: 'Arsitek sistem desain visual dan estetika dashboard. Bertanggung jawab atas prototipe tahap 1 (standalone visual mockups) dan penegakan estetika human-crafted anti-slop.',
    responsibilities: [
      'Perancangan sistem bento grid, palet warna semantik, dan tipografi tabular.',
      'Pembuatan prototipe visual interaktif tanpa langkah build (standalone HTML preview).',
      'Penegakan 10 Larangan Anti-AI-Slop (larangan gradien ungu, teks promosi, dll).',
      'Optimasi hierarki visual dan keterbacaan data instan (<3 detik glanceability).',
    ],
    tools: ['read_file', 'write_file', 'patch', 'terminal'],
    delegator: 'swe-frontend',
    subordinates: [],
  },
  'devops-engineer': {
    id: 'devops-engineer',
    level: 3,
    levelLabel: 'Level 3 — SRE & Infrastructure Specialist',
    name: 'devops-engineer',
    title: 'SRE dan Infrastruktur',
    role: 'Principal SRE & Infrastructure Engineer',
    model: 'ag/gemini-3.8-flash-high',
    provider: '9Router (Loopback 127.0.0.1:8080)',
    permissions: 'SRE & Infrastructure Workspace',
    workspace: '/srv/hermes-control',
    description: 'Penanggung jawab keandalan operasional host VPS dan infrastruktur layanan. Mengelola systemd units, reverse proxy Caddy dengan SSL otomatis, dan postur keamanan.',
    responsibilities: [
      'Manajemen daemons, user systemd services, automated timers, dan rotasi log.',
      'Konfigurasi reverse proxy Caddy modular (subdomain TLS otomatis port 443).',
      'Pemantauan vital host (vCPU load, RAM headroom, NVMe disk, socket probes).',
      'Peninjauan postur keamanan VPS (kebijakan SSH key-only, UFW, dan loopback isolation).',
    ],
    tools: ['systemctl', 'caddy', 'docker', 'terminal', 'read_file', 'journalctl'],
    delegator: 'tech-mentor',
    subordinates: ['office-lead'],
  },
  'github-manager': {
    id: 'github-manager',
    level: 4,
    levelLabel: 'Level 4 — Git & Release Gatekeeper',
    name: 'github-manager',
    title: 'Gerbang Rilis dan Publikasi',
    role: 'Global Git & Release PIC',
    model: 'ag/gemini-3.8-flash-high',
    provider: '9Router (Loopback 127.0.0.1:8080)',
    permissions: 'Release Gatekeeper · Strict Hygiene',
    workspace: '/srv/hermes-control',
    description: 'Penanggung jawab tunggal penerbitan dan higienitas Git/GitHub secara global. Mengelola branches, pull requests, releases, dan memastikan 100% atribusi manusia tanpa jejak AI.',
    responsibilities: [
      'Penerbitan commit resmi dengan author: Muhammad Rifqi Setiawan.',
      'Menjamin nol kata jejak AI pada branch names, commit messages, dan dokumentasi.',
      'Pemeriksaan gerbang rilis (hanya mempublikasikan kode yang lolos sertifikasi QA).',
      'Pengelolaan GitHub releases, changelog, dan sinkronisasi HEAD di projects.yaml.',
    ],
    tools: ['git', 'gh', 'terminal', 'read_file'],
    delegator: 'swe-QA',
    subordinates: [],
  },
  'office-lead': {
    id: 'office-lead',
    level: 4,
    levelLabel: 'Level 4 — Observability & Cockpit Lead',
    name: 'office-lead',
    title: 'Cockpit dan Observabilitas',
    role: 'Virtual Systems & Observability Lead',
    model: 'cx/gpt-5.6-sol',
    provider: '9Router (Loopback 127.0.0.1:8080)',
    permissions: 'Cockpit Observability Workspace',
    workspace: '/srv/hermes-control/services/agent-cockpit',
    description: 'Spesialis observabilitas ekosistem multi-agen dan arsitek Mission Control. Mengelola streaming telemetri langsung, pelacakan span delegasi, dan transparansi eksekusi sistem.',
    responsibilities: [
      'Pemeliharaan visualisasi Mission Control dan rendering DAG eksekusi real-time.',
      'Integrasi aliran event telemetri (SSE / REST polling) dengan fallback toleran.',
      'Pemantauan latensi span delegasi, antrean global, dan status gerbang rilis.',
      'Menjamin transparansi penuh eksekusi otonom 13 agen AI kepada otoritas manusia.',
    ],
    tools: ['read_file', 'write_file', 'patch', 'terminal'],
    delegator: 'devops-engineer',
    subordinates: [],
  },
}

export interface AgentDetailModalProps {
  agentId: string | null
  onClose: () => void
  agents: readonly LiveAgent[]
  snapshot?: ExecutionSnapshot | null
  elapsedMs?: number
  theme?: 'dark' | 'light'
}

export function AgentDetailModal({
  agentId,
  onClose,
  agents,
  snapshot = null,
  elapsedMs = Infinity,
}: AgentDetailModalProps) {
  useEffect(() => {
    if (!agentId) return
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [agentId, onClose])

  if (!agentId) return null

  const canonical = canonicalAgent(agentId)
  if (!canonical) return null

  const spec = AGENT_SPEC_RECORD[canonical]
  const definition = AGENT_MAP.get(canonical)
  const live = agents.find(a => canonicalAgent(a.id) === canonical)

  const activity = activePairs(snapshot, elapsedMs, null)
  const invocations = [...activity.values()]
    .filter(pair => pair.caller === canonical || pair.callee === canonical)
    .flatMap(pair => pair.invocations)

  const founder = canonical === 'rifqi'
  const status = founder ? { label: 'Otoritas manusia', tone: 'authority' } : agentStatus(live?.state)

  return (
    <div
      className="mc-modal-backdrop"
      onClick={e => {
        if (e.target === e.currentTarget) onClose()
      }}
      role="presentation"
    >
      <div
        className="mc-modal-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="mc-agent-detail-title"
      >
        {/* Header */}
        <header className="mc-modal-header">
          <div className="mc-modal-header__meta">
            <span className="mc-modal-tier-badge">{spec.levelLabel}</span>
            <h2 id="mc-agent-detail-title" className="mc-modal-title">
              {spec.name}
            </h2>
            <p className="mc-modal-subtitle">{spec.title} &bull; <span className="mc-modal-role">{spec.role}</span></p>
          </div>
          <button
            type="button"
            className="mc-modal-close"
            onClick={onClose}
            aria-label="Tutup detail agen"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </header>

        {/* Scrollable Body */}
        <div className="mc-modal-body">
          {/* Quick Specifications Grid */}
          <section className="mc-detail-grid" aria-label="Spesifikasi agen">
            <div className="mc-detail-cell">
              <span className="mc-detail-label">Status Operasional</span>
              <div className="mc-detail-val">
                <span className={`mc-state mc-state--${status.tone}`}>
                  <i aria-hidden="true" />
                  {status.label}
                </span>
                {!founder && (
                  <span className="mc-badge-calls">
                    {invocations.length} panggilan aktif
                  </span>
                )}
              </div>
            </div>

            <div className="mc-detail-cell">
              <span className="mc-detail-label">Foundation Model</span>
              <div className="mc-detail-val">
                <code className="mc-code-chip">{spec.model}</code>
              </div>
            </div>

            <div className="mc-detail-cell">
              <span className="mc-detail-label">Penyedia & Rute</span>
              <div className="mc-detail-val font-mono">{spec.provider}</div>
            </div>

            <div className="mc-detail-cell">
              <span className="mc-detail-label">Hak Akses & Batasan Sandbox</span>
              <div className="mc-detail-val font-mono">{spec.permissions}</div>
            </div>

            <div className="mc-detail-cell mc-detail-cell--full">
              <span className="mc-detail-label">Workspace / Direktori Kerja</span>
              <div className="mc-detail-val">
                <code className="mc-code-chip">{spec.workspace}</code>
              </div>
            </div>
          </section>

          {/* Deskripsi & Ringkasan Mandat */}
          <section className="mc-modal-section">
            <h3 className="mc-section-title">Deskripsi Mandat</h3>
            <p className="mc-section-desc">{spec.description}</p>
          </section>

          {/* Tanggung Jawab Operasional */}
          <section className="mc-modal-section">
            <h3 className="mc-section-title">Ruang Lingkup & Tanggung Jawab</h3>
            <ul className="mc-detail-list">
              {spec.responsibilities.map((item, idx) => (
                <li key={idx}>
                  <svg className="mc-bullet-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </section>

          {/* Alat & Kapabilitas yang Diizinkan */}
          <section className="mc-modal-section">
            <h3 className="mc-section-title">Alat & Kapabilitas Resmi (Authorized Tools)</h3>
            <div className="mc-tools-wrap">
              {spec.tools.map(tool => (
                <span key={tool} className="mc-tool-tag">
                  {tool}
                </span>
              ))}
            </div>
          </section>

          {/* Garis Komando & Delegasi */}
          <section className="mc-modal-section">
            <h3 className="mc-section-title">Hierarki & Garis Komando</h3>
            <div className="mc-hierarchy-box">
              <div className="mc-hierarchy-row">
                <span className="mc-hierarchy-label">Atasan Langsung:</span>
                <span className="mc-hierarchy-val">
                  {spec.delegator ? (
                    <strong>{spec.delegator}</strong>
                  ) : (
                    <em>(Pemberi mandat utama / Tidak memiliki atasan)</em>
                  )}
                </span>
              </div>
              <div className="mc-hierarchy-row">
                <span className="mc-hierarchy-label">Bawahan / Delegasi Langsung:</span>
                <span className="mc-hierarchy-val">
                  {spec.subordinates.length > 0 ? (
                    spec.subordinates.map(sub => (
                      <span key={sub} className="mc-sub-badge">
                        {sub}
                      </span>
                    ))
                  ) : (
                    <em>(Spesialis daun eksekusi / Tanpa bawahan langsung)</em>
                  )}
                </span>
              </div>
            </div>
          </section>

          {/* Aktivitas Terkini Roster */}
          <section className="mc-modal-section">
            <h3 className="mc-section-title">Aktivitas Roster Saat Ini</h3>
            <div className="mc-activity-box">
              <p className="mc-activity-text">
                {founder
                  ? 'Siaga memberikan mandat strategis dan arahan arsitektur tingkat tinggi.'
                  : cleanText(live?.status_desc ?? live?.task, 'Siaga di workstation — siap menerima instruksi.')}
              </p>
              {invocations.length > 0 && (
                <div className="mc-active-invocations">
                  <span className="mc-invocations-title">Invocations Terdeteksi:</span>
                  <ul>
                    {invocations.map(inv => (
                      <li key={inv.span_id}>
                        <code>{inv.task_id}</code> &bull;{' '}
                        <span className="mc-inv-state">
                          {inv.state === 'running' ? 'sedang berjalan' : 'menunggu'}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </section>
        </div>

        {/* Footer */}
        <footer className="mc-modal-footer">
          <span className="mc-modal-footer-note">
            Hermes Sovereign Autonomous Multi-Agent Hierarchy
          </span>
          <button
            type="button"
            className="mc-button mc-modal-close-btn"
            onClick={onClose}
          >
            Tutup Detail
          </button>
        </footer>
      </div>
    </div>
  )
}
