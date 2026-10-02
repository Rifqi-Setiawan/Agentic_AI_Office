import * as THREE from 'three'
import { preloadGLTF } from './officeModelBuilder'

export interface Agent3DDef {
  id: string
  name: string
  role: string
  color: string
  emoji: string
  position: THREE.Vector3
  targetPosition: THREE.Vector3
  facing: string
  state: 'idle' | 'walking' | 'working' | 'meeting' | 'swimming' | 'praying'
  speechText?: string
  task?: string
  screenPos?: { x: number; y: number; visible: boolean }
  modelType: 'suit' | 'casual' | 'worker'
  rotationY?: number
}

export const INITIAL_3D_AGENTS: Agent3DDef[] = [
  {
    id: 'vps-boss',
    name: 'Jarvis',
    role: 'Chief Orchestrator',
    color: '#eab308',
    emoji: '👑',
    position: new THREE.Vector3(9.0, 1.0, -7.5),
    targetPosition: new THREE.Vector3(9.0, 1.0, -7.5),
    facing: 'south',
    state: 'working',
    speechText: 'Lord Commander memantau status seluruh VPS 👑',
    task: 'Governing 14 Sovereign Agents',
    modelType: 'suit',
    rotationY: 0,
  },
  {
    id: 'vps-assistant',
    name: 'vps-assistant',
    role: 'General Utility',
    color: '#a855f7',
    emoji: '⚡',
    position: new THREE.Vector3(11.2, 1.0, -5.2),
    targetPosition: new THREE.Vector3(11.2, 1.0, -5.2),
    facing: 'south-west',
    state: 'idle',
    speechText: 'Nunggu keputusan Rifqi 📋',
    task: 'Operational Task Runner',
    modelType: 'casual',
    rotationY: -Math.PI / 4,
  },
  {
    id: 'rifqi',
    name: 'Rifqi Setiawan',
    role: 'Supreme Authority',
    color: '#38bdf8',
    emoji: '💼',
    position: new THREE.Vector3(11.0, -0.4, 6.0),
    targetPosition: new THREE.Vector3(11.0, -0.4, 6.0),
    facing: 'east',
    state: 'swimming',
    speechText: 'Santai di kolam renang rooftop 🏊',
    task: 'Founder & Supreme Authority',
    modelType: 'suit',
    rotationY: Math.PI / 2,
  },
  {
    id: 'senku',
    name: 'Senku',
    role: 'Research Scientist',
    color: '#22c55e',
    emoji: '🧪',
    position: new THREE.Vector3(-11.0, 0.0, 0.9),
    targetPosition: new THREE.Vector3(-11.0, 0.0, 0.9),
    facing: 'north',
    state: 'working',
    speechText: 'Riset 10,000,000% logis dan presisi 🧪',
    task: 'Scientific Systems & Algorithms',
    modelType: 'casual',
    rotationY: Math.PI,
  },
  {
    id: 'paperwright',
    name: 'paperwright',
    role: 'Scientific Scribe',
    color: '#ec4899',
    emoji: '📜',
    position: new THREE.Vector3(-8.8, 0.0, 1.2),
    targetPosition: new THREE.Vector3(-8.8, 0.0, 1.2),
    facing: 'north',
    state: 'working',
    speechText: 'Kompilasi TeX PDF manuscript bersih 📄',
    task: 'LaTeX & Academic Publications',
    modelType: 'casual',
    rotationY: Math.PI,
  },
  {
    id: 'swe-backend',
    name: 'swe-backend',
    role: 'Backend Architect',
    color: '#3b82f6',
    emoji: '💻',
    position: new THREE.Vector3(0.0, 0.0, 1.8),
    targetPosition: new THREE.Vector3(0.0, 0.0, 1.8),
    facing: 'north',
    state: 'working',
    speechText: 'Worktree bersih, FastAPI latency 12ms 🚀',
    task: 'High-Concurrency APIs & DuckDB',
    modelType: 'casual',
    rotationY: Math.PI,
  },
  {
    id: 'swe-frontend',
    name: 'swe-frontend',
    role: 'Frontend Specialist',
    color: '#06b6d4',
    emoji: '🎨',
    position: new THREE.Vector3(-4.0, 0.0, 1.8),
    targetPosition: new THREE.Vector3(-4.0, 0.0, 1.8),
    facing: 'north',
    state: 'working',
    speechText: 'Three.js 60 FPS tanpa visual jitter 🎯',
    task: 'WebGL 3D & Responsive UI',
    modelType: 'casual',
    rotationY: Math.PI,
  },
  {
    id: 'swe-qa',
    name: 'swe-QA',
    role: 'Independent Verifier',
    color: '#10b981',
    emoji: '🛡️',
    position: new THREE.Vector3(0.0, 0.0, 5.3),
    targetPosition: new THREE.Vector3(0.0, 0.0, 5.3),
    facing: 'north',
    state: 'working',
    speechText: 'Semua 31 unit test PASS 100% ✅',
    task: 'Independent QA & Verification',
    modelType: 'worker',
    rotationY: Math.PI,
  },
  {
    id: 'ui-designer',
    name: 'ui-designer',
    role: 'Principal UI/UX',
    color: '#f43f5e',
    emoji: '✨',
    position: new THREE.Vector3(-4.0, 0.0, 5.3),
    targetPosition: new THREE.Vector3(-4.0, 0.0, 5.3),
    facing: 'north',
    state: 'working',
    speechText: 'Anti-AI-slop design system aktif ✨',
    task: 'Aesthetics & Interaction Design',
    modelType: 'casual',
    rotationY: Math.PI,
  },
  {
    id: 'data-engineer',
    name: 'data-engineer',
    role: 'Lakehouse Specialist',
    color: '#f59e0b',
    emoji: '🌊',
    position: new THREE.Vector3(6.0, 0.0, 7.2),
    targetPosition: new THREE.Vector3(6.0, 0.0, 7.2),
    facing: 'south',
    state: 'working',
    speechText: 'Parquet Medallion sync sukses 📊',
    task: 'DuckLake ACID Pipelines',
    modelType: 'worker',
    rotationY: 0,
  },
  {
    id: 'devops-engineer',
    name: 'devops-engineer',
    role: 'Infrastructure SRE',
    color: '#6366f1',
    emoji: '🚀',
    position: new THREE.Vector3(4.0, 0.0, 7.2),
    targetPosition: new THREE.Vector3(4.0, 0.0, 7.2),
    facing: 'south',
    state: 'working',
    speechText: 'Uptime 9 hari, Caddy reverse proxy sehat 🛡️',
    task: 'Systemd & Azure VM Telemetry',
    modelType: 'worker',
    rotationY: 0,
  },
  {
    id: 'tech-mentor',
    name: 'tech-mentor',
    role: 'Architecture Tutor',
    color: '#8b5cf6',
    emoji: '🎓',
    position: new THREE.Vector3(-1.0, 1.0, -6.5),
    targetPosition: new THREE.Vector3(-1.0, 1.0, -6.5),
    facing: 'east',
    state: 'meeting',
    speechText: 'Diskusi arsitektur microservices di ruang kaca 🤝',
    task: 'Interactive Technical Tutoring',
    modelType: 'suit',
    rotationY: Math.PI / 2,
  },
  {
    id: 'chief-architect',
    name: 'chief-architect',
    role: 'Chief Architect',
    color: '#64748b',
    emoji: '🏛️',
    position: new THREE.Vector3(1.2, 1.0, -6.5),
    targetPosition: new THREE.Vector3(1.2, 1.0, -6.5),
    facing: 'west',
    state: 'meeting',
    speechText: 'Review blueprint sistem terdistribusi 📐',
    task: 'Systems Architecture & RFCs',
    modelType: 'suit',
    rotationY: -Math.PI / 2,
  },
  {
    id: 'dimas-musholla',
    name: 'Dimas GL-01',
    role: 'Visiting Dev',
    color: '#059669',
    emoji: '🕌',
    position: new THREE.Vector3(-11.0, -0.9, 7.5),
    targetPosition: new THREE.Vector3(-11.0, -0.9, 7.5),
    facing: 'north',
    state: 'praying',
    speechText: 'Allāhu akbar... ٱللَّٰهُ أَكْبَرُ 🤲',
    task: 'Sholat Berjamaah di Musholla',
    modelType: 'casual',
    rotationY: Math.PI,
  },
]

export async function createAgent3DInstance(agent: Agent3DDef): Promise<THREE.Group> {
  const modelUrl =
    agent.modelType === 'suit'
      ? '/models/characters/figure_Suit.glb'
      : agent.modelType === 'worker'
      ? '/models/characters/figure_Worker.glb'
      : '/models/characters/figure_Casual.glb'

  const group = new THREE.Group()
  group.name = `Agent_${agent.id}`
  group.position.copy(agent.position)
  group.userData = { id: agent.id, baseY: agent.position.y, state: agent.state }

  try {
    const model = await preloadGLTF(modelUrl)
    // Scale standard human down to fit low-poly desks & chairs
    model.scale.set(0.72, 0.72, 0.72)
    if (agent.rotationY !== undefined) {
      model.rotation.y = agent.rotationY
    }
    group.add(model)
  } catch (err) {
    console.error(`Failed to load 3D character model for ${agent.name}:`, err)
    // Fallback: stylized capsule
    const bodyGeo = new THREE.CapsuleGeometry(0.3, 0.45, 8, 16)
    const bodyMat = new THREE.MeshStandardMaterial({ color: agent.color })
    const body = new THREE.Mesh(bodyGeo, bodyMat)
    body.position.y = 0.45
    group.add(body)
  }

  // Soft Contact Drop Shadow under feet
  const shadowGeo = new THREE.CircleGeometry(0.42, 16)
  const shadowMat = new THREE.MeshBasicMaterial({
    color: 0x000000,
    transparent: true,
    opacity: 0.35,
    depthWrite: false,
  })
  const shadow = new THREE.Mesh(shadowGeo, shadowMat)
  shadow.rotation.x = -Math.PI / 2
  shadow.position.y = 0.02
  group.add(shadow)

  return group
}
