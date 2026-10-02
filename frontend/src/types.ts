import type { RoomId } from './rooms'

export type AgentState =
  | 'idle'
  | 'walking-to-manager'
  | 'talking-to-manager'
  | 'walking-to-desk'
  | 'working'
  | 'coffee-break'
  | 'swimming'
  | 'sunbathing'
  | 'meeting'
  | 'billiards'
  | 'arcade'
  | 'dining'
  | 'reading'
  | 'completed'
  | 'new-hire'
  | 'changing-room'

export interface Position {
  x: number
  y: number
}

export interface Agent {
  id: string
  name: string
  type: 'subagent' | 'mcp'
  role: string
  state: AgentState
  position: Position
  targetPosition: Position
  deskPosition: Position
  room: RoomId              // which room the agent is currently in
  assignedRoom: RoomId      // where their desk is
  assignedSpotId?: string   // which spot they're assigned to
  task?: string
  statusText?: string
  spriteFacing?: 'front-left' | 'front-right' | 'rear-left' | 'rear-right'
  color: string
  emoji: string
  hiredAt: number
  pathQueue?: { x: number; y: number }[]  // waypoints to walk through
}

export interface OfficeEvent {
  type: 'agent_spawned' | 'agent_working' | 'agent_completed' | 'mcp_call' | 'mcp_done' | 'new_hire' | 'chat_message' | 'chat_typing' | 'chat_reaction' | 'chat_seen'
  agent?: Partial<Agent>
  agentId?: string
  status?: string
  result?: string
  sender?: string
  text?: string
}

import { BOSS_NAME, BOSS_COLOR, BOSS_EMOJI } from './config'

export const AGENT_CONFIGS: Record<string, { color: string; emoji: string; title: string }> = {
  // The boss — configured via office.config.json
  'boss':                  { color: BOSS_COLOR, emoji: BOSS_EMOJI, title: BOSS_NAME },
  'vps-boss':              { color: BOSS_COLOR, emoji: BOSS_EMOJI, title: 'Jarvis (Chief)' },
  'senku':                 { color: '#10b981', emoji: '🧪', title: 'Senku (Scientist)' },
  'professor':             { color: '#10b981', emoji: '🧪', title: 'Senku (Scientist)' },
  'swe-backend':           { color: '#3b82f6', emoji: '⚙️', title: 'swe-backend (APIs)' },
  'swe-frontend':          { color: '#06b6d4', emoji: '🎨', title: 'swe-frontend (UI)' },
  'swe-verifier':          { color: '#8b5cf6', emoji: '🛡️', title: 'swe-QA (Auditor)' },
  'swe-qa':                { color: '#8b5cf6', emoji: '🛡️', title: 'swe-QA (Auditor)' },
  'data-engineer':         { color: '#14b8a6', emoji: '🌊', title: 'data-engineer (Lakehouse)' },
  'devops-engineer':       { color: '#f97316', emoji: '🚀', title: 'devops-engineer (SRE)' },
  'ui-designer':           { color: '#ec4899', emoji: '✨', title: 'ui-designer' },
  'tech-mentor':           { color: '#6366f1', emoji: '🎓', title: 'tech-mentor' },
  'github-manager':        { color: '#64748b', emoji: '🐙', title: 'github-manager' },
  'paperwright':           { color: '#a855f7', emoji: '📜', title: 'paperwright' },
  'vps-assistant':         { color: '#84cc16', emoji: '⚡', title: 'vps-assistant' },
  'office-lead':           { color: '#4f46e5', emoji: '🏢', title: 'office-lead' },
  // Subagents
  'debugger':              { color: '#e74c3c', emoji: '🔍', title: 'Debugger' },
  'code-reviewer':         { color: '#3498db', emoji: '📋', title: 'Reviewer' },
  'frontend-developer':    { color: '#2ecc71', emoji: '🎨', title: 'Frontend' },
  'fullstack-developer':   { color: '#9b59b6', emoji: '⚡', title: 'Fullstack' },
  'test-engineer':         { color: '#f39c12', emoji: '🧪', title: 'Tester' },
  'security-auditor':      { color: '#e67e22', emoji: '🛡️', title: 'Security' },
  'architect-reviewer':    { color: '#1abc9c', emoji: '🏗️', title: 'Architect' },
  'performance-engineer':  { color: '#e91e63', emoji: '🚀', title: 'PerfEng' },
  'database-architect':    { color: '#795548', emoji: '🗄️', title: 'DBA' },
  'typescript-pro':        { color: '#3178c6', emoji: '📘', title: 'TS Pro' },
  'ai-engineer':           { color: '#ff6f00', emoji: '🤖', title: 'AI Eng' },
  'prompt-engineer':       { color: '#ab47bc', emoji: '✍️', title: 'Prompts' },
  'general-purpose':       { color: '#78909c', emoji: '👤', title: 'General' },
  'Explore':               { color: '#4caf50', emoji: '🔭', title: 'Explorer' },
  // MCPs
  'github':                { color: '#f0f0f0', emoji: '🐙', title: 'GitHub' },
  'supabase':              { color: '#3ecf8e', emoji: '⚡', title: 'Supabase' },
  'playwright':            { color: '#45ba4b', emoji: '🎭', title: 'Playwright' },
  'chrome':                { color: '#4285f4', emoji: '🌐', title: 'Chrome' },
  'memory':                { color: '#ff9800', emoji: '🧠', title: 'Memory' },
  'seo':                   { color: '#4caf50', emoji: '📊', title: 'SEO' },
  'gmail':                 { color: '#ea4335', emoji: '📧', title: 'Gmail' },
  'ios-simulator':         { color: '#a2aaad', emoji: '📱', title: 'iOS' },
  'assistant':             { color: '#cc785c', emoji: '🤖', title: 'Claude' },
  'default':               { color: '#95a5a6', emoji: '👤', title: 'Worker' },
}
