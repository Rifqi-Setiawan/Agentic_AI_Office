export interface Agent {
  id: string
  name: string
  role: string
  title?: string
  model?: string
  state: 'idle' | 'working' | 'thinking' | 'executing' | 'auditing'
  task?: string
  status_desc?: string
  color: string
}

export interface TelemetryEvent {
  timestamp: string | number
  type: string
  agent?: string
  detail?: string
  status?: string
  status_desc?: string
  tool?: string
}

export interface SystemVitals {
  cpu_cores?: number
  load_1m?: number
  ram_used_gib?: number
  ram_total_gib?: number
  ram_pct?: number
  uptime?: string
}

export interface ChatMessage {
  id?: number | string
  sender: string
  role?: string
  text: string
  timestamp?: string
}

export const CANONICAL_ROSTER: Agent[] = [
  { id: 'jarvis', name: 'Jarvis', role: 'jarvis', title: 'Lord Commander & Chief Orchestrator', model: 'ag/gemini-3.8-flash', state: 'idle', color: '#f59e0b' },
  { id: 'senku', name: 'Senku', role: 'senku', title: 'Grand Maester of Research & Science', model: 'ag/claude-opus-4-6-thinking', state: 'idle', color: '#10b981' },
  { id: 'swe-verifier', name: 'swe-QA', role: 'swe-verifier', title: 'Independent Quality Verification', model: 'ag/gemini-3.8-flash', state: 'idle', color: '#8b5cf6' },
  { id: 'swe-backend', name: 'swe-backend', role: 'swe-backend', title: 'Backend Architecture & APIs', model: 'ag/gemini-3.8-flash', state: 'idle', color: '#3b82f6' },
  { id: 'swe-frontend', name: 'swe-frontend', role: 'swe-frontend', title: 'Frontend UI/UX Engineering', model: 'ag/gemini-3.8-flash', state: 'idle', color: '#06b6d4' },
  { id: 'data-engineer', name: 'data-engineer', role: 'data-engineer', title: 'DuckDB Medallion Lakehouse', model: 'ag/gemini-3.8-flash', state: 'idle', color: '#14b8a6' },
  { id: 'devops-engineer', name: 'devops-engineer', role: 'devops-engineer', title: 'Principal SRE & Infrastructure', model: 'ag/gemini-3.8-flash', state: 'idle', color: '#f97316' },
  { id: 'ui-designer', name: 'ui-designer', role: 'ui-designer', title: 'Principal Design Systems', model: 'ag/gemini-3.8-flash', state: 'idle', color: '#ec4899' },
  { id: 'tech-mentor', name: 'tech-mentor', role: 'tech-mentor', title: 'Interactive Architecture Tutor', model: 'ag/gemini-3.8-flash', state: 'idle', color: '#6366f1' },
  { id: 'github-manager', name: 'github-manager', role: 'github-manager', title: 'Global Git & Release PIC', model: 'ag/gemini-3.8-flash', state: 'idle', color: '#64748b' },
  { id: 'office-lead', name: 'office-lead', role: 'office-lead', title: 'Virtual Systems & Stronghold', model: 'cx/gpt-5.6-sol', state: 'idle', color: '#4f46e5' },
  { id: 'paperwright', name: 'paperwright', role: 'paperwright', title: 'LaTeX Manuscript Scribe', model: 'ag/gemini-3.8-flash', state: 'idle', color: '#a855f7' },
  { id: 'vps-assistant', name: 'vps-assistant', role: 'vps-assistant', title: 'General Operations Utility', model: 'ag/gemini-3.8-flash', state: 'idle', color: '#84cc16' },
  { id: 'rifqi', name: 'Rifqi Setiawan', role: 'founder', title: 'Founder & Principal Authority', model: 'human-authority', state: 'idle', color: '#eab308' },
]
