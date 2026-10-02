// ===== ROOM DEFINITIONS =====
// Each room is an empty shell with positions for furniture placement
// Furniture items are placed on a grid within each room

export type RoomId =
  | 'main-office'
  | 'manager-office'
  | 'ceo-office'
  | 'meeting-room'
  | 'kitchen'
  | 'server-room'
  | 'lobby'
  | 'nap-room'
  | 'rooftop'
  | 'gym'
  | 'parking'

export interface Waypoint {
  id: string
  x: number  // percentage
  y: number
  connections: string[]  // ids of connected waypoints
}

export interface FurnitureItem {
  id: string
  type: string        // e.g. 'desk-dual', 'chair-aeron', 'plant-monstera'
  sprite: string      // sprite sheet + frame reference
  x: number           // percentage position within room (0-100)
  y: number
  zIndex?: number
  state?: string      // e.g. 'empty', 'occupied', 'brewing'
  interactive?: boolean
  label?: string
}

export type SpriteFacing = 'front-left' | 'front-right' | 'rear-left' | 'rear-right'

export interface RoomConnection {
  toRoom: RoomId
  position: { x: number; y: number }  // door/exit position in current room (%)
  label?: string
  exitFacing?: SpriteFacing   // agent direction when leaving through this door
  entryFacing?: SpriteFacing  // agent direction when arriving through this door
}

export interface AgentSpot {
  id: string
  type: 'desk' | 'meeting-seat' | 'lounge' | 'standing' | 'water' | 'coffee' | 'filing' | 'printer' | 'door' | 'swimming' | 'sunbathing' | 'meeting' | 'billiards' | 'arcade' | 'dining' | 'reading'
  x: number
  y: number
  facing?: 'up' | 'down' | 'left' | 'right'
  spriteFacing?: SpriteFacing  // which direction the agent faces when at this spot
  zIndex?: number  // explicit z-index override (for agents behind desks)
}

export interface Room {
  id: RoomId
  name: string
  description: string
  background: {
    day: string       // path to empty room background
    night: string
  }
  width: number       // room dimensions in px (rendered)
  height: number
  furniture: FurnitureItem[]
  connections: RoomConnection[]
  agentSpots: AgentSpot[]       // where agents can sit/stand/work
  entryPoint: { x: number; y: number }  // where agents appear when entering
  walkableArea?: { x: number; y: number }[]  // polygon defining where agents can walk
  ambience?: string   // ambient sound loop
  waypoints?: Waypoint[]  // named walkable nodes for pathfinding
}

// ===== ROOM DEFINITIONS =====

export const ROOMS: Record<RoomId, Room> = {
  'main-office': {
    id: 'main-office',
    name: 'Penthouse Office',
    description: 'High-rise executive penthouse with rooftop pool, conference boardroom, engineering pods, research lab, server center, arcade, and cafe',
    background: {
      day: '/rooms/office-day-custom.jpg',
      night: '/rooms/office-night-custom.jpg',
    },
    width: 1672,
    height: 941,
    furniture: [
      // Clean interactive hotspots over the architectural illustration
      { id: 'pool', type: 'hotspot', sprite: 'hotspot', x: 88.5, y: 33.0, interactive: true, label: '🏊 Kolam Renang Rooftop' },
      { id: 'sunbed', type: 'hotspot', sprite: 'hotspot', x: 82.0, y: 18.0, interactive: true, label: '☀️ Kursi Berjemur Sundeck' },
      { id: 'billiards', type: 'hotspot', sprite: 'hotspot', x: 14.0, y: 21.0, interactive: true, label: '🎱 Meja Biliar Laken Hijau' },
      { id: 'arcade', type: 'hotspot', sprite: 'hotspot', x: 18.0, y: 12.0, interactive: true, label: '🕹️ Mesin Dingdong Arcade' },
      { id: 'meeting-display', type: 'hotspot', sprite: 'hotspot', x: 40.0, y: 19.0, interactive: true, label: '📊 Dashboard Telemetri Ruang Rapat' },
      { id: 'kanban-board', type: 'hotspot', sprite: 'hotspot', x: 56.0, y: 46.0, interactive: true, label: '📋 Agile Sprint Scrum Board' },
      { id: 'boss-desk', type: 'hotspot', sprite: 'hotspot', x: 60.5, y: 17.0, interactive: true, label: '👑 Meja Eksekutif CEO Jarvis' },

      // Discrete Props with Depth Z-Sorting (Claude-Office Standard)
      { id: 'espresso', type: 'coffee-machine', sprite: 'coffee-off', x: 73.0, y: 64.0, zIndex: 68, interactive: true, label: '☕ Mesin Kopi Espresso' },
      { id: 'plant-cafe', type: 'plant-monstera', sprite: 'plant-monstera', x: 91.0, y: 84.0, zIndex: 88, label: '🌿 Tanaman Hias Monstera' },
      { id: 'plant-boss', type: 'plant-snake', sprite: 'plant-snake', x: 68.0, y: 14.0, zIndex: 25, label: '🌱 Snake Plant Ruang Bos' },
      { id: 'senku-bookshelf', type: 'decoration', sprite: 'bookshelf', x: 11.5, y: 78.0, zIndex: 75, label: '📚 Rak Buku Sains & Jurnal' },
      { id: 'senku-chalkboard', type: 'decoration', sprite: 'chalkboard-formulas', x: 26.0, y: 68.0, zIndex: 65, label: '🧮 Papan Tulis Rumus Fisika' },
      { id: 'senku-lab-kit', type: 'decoration', sprite: 'lab-equipment', x: 21.5, y: 83.5, zIndex: 88, label: '🧪 Peralatan Kimia & Tabung Reaksi' },
      { id: 'server-rack-1', type: 'furniture', sprite: 'server-rack', x: 46.0, y: 72.0, zIndex: 71, label: '🗄️ Server Rack Primary' },
      { id: 'server-rack-2', type: 'furniture', sprite: 'server-rack', x: 61.0, y: 72.0, zIndex: 71, label: '🗄️ Server Rack Analytics' },
    ],
    connections: [],
    agentSpots: [
      // 14 Dedicated Agent Workstations (Zero overlap, verified against 3D furniture)
      { id: 'spot-boss', type: 'desk', x: 60.5, y: 15.0, facing: 'down', spriteFacing: 'front-left', zIndex: 30 },
      { id: 'spot-vps-assistant', type: 'desk', x: 65.0, y: 25.0, facing: 'down', spriteFacing: 'rear-left', zIndex: 35 },
      { id: 'spot-founder', type: 'desk', x: 84.0, y: 22.0, facing: 'down', spriteFacing: 'front-right', zIndex: 32 },
      { id: 'spot-tech-mentor', type: 'desk', x: 40.5, y: 23.0, facing: 'down', spriteFacing: 'rear-left', zIndex: 33 },
      { id: 'spot-senku', type: 'desk', x: 18.5, y: 83.5, facing: 'down', spriteFacing: 'front-right', zIndex: 85 },
      { id: 'spot-paperwright', type: 'desk', x: 34.8, y: 76.8, facing: 'down', spriteFacing: 'rear-right', zIndex: 80 },
      { id: 'spot-swe-frontend', type: 'desk', x: 27.5, y: 44.5, facing: 'down', spriteFacing: 'front-left', zIndex: 50 },
      { id: 'spot-swe-backend', type: 'desk', x: 41.5, y: 44.5, facing: 'down', spriteFacing: 'front-left', zIndex: 50 },
      { id: 'spot-swe-qa', type: 'desk', x: 29.5, y: 57.0, facing: 'down', spriteFacing: 'front-left', zIndex: 60 },
      { id: 'spot-ui-designer', type: 'desk', x: 43.5, y: 57.0, facing: 'down', spriteFacing: 'front-left', zIndex: 60 },
      { id: 'spot-github-manager', type: 'desk', x: 37.0, y: 46.0, facing: 'down', spriteFacing: 'front-left', zIndex: 52 },
      { id: 'spot-office-lead', type: 'desk', x: 54.0, y: 49.0, facing: 'down', spriteFacing: 'rear-left', zIndex: 55 },
      { id: 'spot-data-engineer', type: 'desk', x: 56.0, y: 80.0, facing: 'down', spriteFacing: 'rear-right', zIndex: 82 },
      { id: 'spot-devops-engineer', type: 'desk', x: 49.0, y: 76.0, facing: 'down', spriteFacing: 'front-right', zIndex: 78 },

      // Activity Spots across the Penthouse (Swimmng, Meetings, Gaming, Cafe, Reading)
      { id: 'spot-pool-swim-1', type: 'swimming', x: 90.0, y: 36.5, facing: 'down', spriteFacing: 'front-left', zIndex: 40 },
      { id: 'spot-pool-swim-2', type: 'swimming', x: 92.5, y: 39.5, facing: 'down', spriteFacing: 'rear-right', zIndex: 42 },
      { id: 'spot-pool-sunbed-2', type: 'sunbathing', x: 82.0, y: 17.5, facing: 'down', spriteFacing: 'front-left', zIndex: 30 },
      { id: 'spot-meeting-seat-1', type: 'meeting', x: 37.5, y: 16.5, facing: 'down', spriteFacing: 'rear-right', zIndex: 28 },
      { id: 'spot-meeting-seat-2', type: 'meeting', x: 43.5, y: 17.0, facing: 'down', spriteFacing: 'rear-left', zIndex: 28 },
      { id: 'spot-meeting-seat-3', type: 'meeting', x: 35.5, y: 20.0, facing: 'down', spriteFacing: 'front-left', zIndex: 31 },
      { id: 'spot-billiards-1', type: 'billiards', x: 14.0, y: 21.0, facing: 'down', spriteFacing: 'front-left', zIndex: 30 },
      { id: 'spot-arcade-1', type: 'arcade', x: 17.5, y: 12.0, facing: 'down', spriteFacing: 'rear-right', zIndex: 25 },
      { id: 'spot-arcade-2', type: 'arcade', x: 21.0, y: 13.0, facing: 'down', spriteFacing: 'rear-right', zIndex: 25 },
      { id: 'spot-lounge-beanbag', type: 'lounge', x: 23.0, y: 23.0, facing: 'down', spriteFacing: 'rear-left', zIndex: 32 },
      { id: 'spot-cafe-espresso', type: 'coffee', x: 73.0, y: 65.0, facing: 'down', spriteFacing: 'rear-right', zIndex: 70 },
      { id: 'spot-cafe-dining-1', type: 'dining', x: 74.0, y: 78.0, facing: 'down', spriteFacing: 'front-left', zIndex: 80 },
      { id: 'spot-cafe-dining-2', type: 'dining', x: 83.0, y: 75.0, facing: 'down', spriteFacing: 'front-right', zIndex: 78 },
      { id: 'spot-library-read', type: 'reading', x: 29.0, y: 69.0, facing: 'down', spriteFacing: 'front-right', zIndex: 72 },
    ],
    entryPoint: { x: 14.0, y: 44.0 },
    waypoints: [
      // Central Open Spine (Main Floor)
      { id: 'W-center', x: 45.0, y: 44.0, connections: ['W-door-arcade', 'W-door-meeting', 'W-door-boss', 'W-door-lab', 'W-door-server', 'W-door-cafe', 'W-door-pool-in', 'W-dev-cluster-1', 'W-dev-cluster-2'] },
      { id: 'W-dev-cluster-1', x: 32.0, y: 46.0, connections: ['W-center', 'W-door-arcade', 'W-door-lab', 'W-dev-cluster-2'] },
      { id: 'W-dev-cluster-2', x: 42.0, y: 52.0, connections: ['W-center', 'W-dev-cluster-1', 'W-door-server', 'W-door-cafe'] },

      // Boss Room (Executive Suite) - Wall at y=31.5, Door at (61.0, 31.5)
      { id: 'W-door-boss', x: 61.0, y: 35.0, connections: ['W-center', 'W-inside-boss', 'W-door-meeting', 'W-door-pool-in'] },
      { id: 'W-inside-boss', x: 61.0, y: 26.0, connections: ['W-door-boss', 'W-boss-desk', 'W-boss-sofa'] },
      { id: 'W-boss-desk', x: 60.5, y: 15.0, connections: ['W-inside-boss'] },
      { id: 'W-boss-sofa', x: 65.0, y: 25.0, connections: ['W-inside-boss'] },

      // Boardroom (Ruang Rapat Kaca) - Glass Wall at y=31.5, Door at (40.0, 31.5)
      { id: 'W-door-meeting', x: 40.0, y: 35.0, connections: ['W-center', 'W-door-boss', 'W-door-arcade', 'W-inside-meeting'] },
      { id: 'W-inside-meeting', x: 40.0, y: 26.0, connections: ['W-door-meeting', 'W-meeting-table', 'W-meeting-east'] },
      { id: 'W-meeting-table', x: 40.0, y: 19.0, connections: ['W-inside-meeting', 'W-meeting-east'] },
      { id: 'W-meeting-east', x: 44.0, y: 18.0, connections: ['W-inside-meeting', 'W-meeting-table'] },

      // Arcade & Game Lounge - Wall at y=31.5, Door at (22.0, 31.5)
      { id: 'W-door-arcade', x: 22.0, y: 35.0, connections: ['W-center', 'W-door-meeting', 'W-inside-arcade', 'W-dev-cluster-1'] },
      { id: 'W-inside-arcade', x: 22.0, y: 26.0, connections: ['W-door-arcade', 'W-arcade-center', 'W-billiards'] },
      { id: 'W-arcade-center', x: 18.0, y: 14.0, connections: ['W-inside-arcade'] },
      { id: 'W-billiards', x: 14.0, y: 21.0, connections: ['W-inside-arcade'] },

      // Senku Lab & Library - Partition at y=58.5, Door at (24.0, 58.5)
      { id: 'W-door-lab', x: 24.0, y: 56.0, connections: ['W-center', 'W-dev-cluster-1', 'W-inside-lab'] },
      { id: 'W-inside-lab', x: 24.0, y: 64.0, connections: ['W-door-lab', 'W-lab-chem', 'W-lab-lib'] },
      { id: 'W-lab-chem', x: 18.5, y: 82.0, connections: ['W-inside-lab', 'W-lab-lib'] },
      { id: 'W-lab-lib', x: 34.0, y: 76.0, connections: ['W-inside-lab', 'W-lab-chem'] },

      // Server Room (Data Lakehouse) - Acoustic Glass Partition at y=59.0, Door at (54.0, 59.0)
      { id: 'W-door-server', x: 54.0, y: 56.0, connections: ['W-center', 'W-dev-cluster-2', 'W-inside-server'] },
      { id: 'W-inside-server', x: 54.0, y: 64.0, connections: ['W-door-server', 'W-server-aisle'] },
      { id: 'W-server-aisle', x: 54.0, y: 78.0, connections: ['W-inside-server'] },

      // Cafeteria & Dining - Partition at y=53.5, Door at (68.0, 53.5)
      { id: 'W-door-cafe', x: 68.0, y: 50.0, connections: ['W-center', 'W-dev-cluster-2', 'W-inside-cafe'] },
      { id: 'W-inside-cafe', x: 68.0, y: 58.0, connections: ['W-door-cafe', 'W-cafe-bar', 'W-cafe-dining'] },
      { id: 'W-cafe-bar', x: 73.0, y: 65.0, connections: ['W-inside-cafe', 'W-cafe-dining'] },
      { id: 'W-cafe-dining', x: 80.0, y: 75.0, connections: ['W-inside-cafe', 'W-cafe-bar'] },

      // Rooftop Pool Terrace - Sliding Glass Doors at x=71.0, Doorway at (71.0, 33.0)
      { id: 'W-door-pool-in', x: 68.0, y: 33.0, connections: ['W-center', 'W-door-boss', 'W-door-pool-out'] },
      { id: 'W-door-pool-out', x: 74.0, y: 33.0, connections: ['W-door-pool-in', 'W-pool-deck'] },
      { id: 'W-pool-deck', x: 82.0, y: 22.0, connections: ['W-door-pool-out', 'W-pool-ladder', 'W-pool-sunbed'] },
      { id: 'W-pool-sunbed', x: 82.0, y: 18.0, connections: ['W-pool-deck'] },
      { id: 'W-pool-ladder', x: 84.0, y: 28.0, connections: ['W-pool-deck', 'W-pool-water'] },
      { id: 'W-pool-water', x: 88.5, y: 33.0, connections: ['W-pool-ladder', 'W-pool-deep'] },
      { id: 'W-pool-deep', x: 92.0, y: 30.0, connections: ['W-pool-water'] },
    ],
  },
  'manager-office': {
    id: 'manager-office',
    name: "Manager's Office",
    description: 'Where the manager briefs agents and reviews work. Connected to main Claude terminal.',
    background: {
      day: '/rooms/ceo-office.png',
      night: '/rooms/ceo-office.png',
    },
    width: 600,
    height: 450,
    furniture: [],
    connections: [
      { toRoom: 'main-office', position: { x: 50, y: 95 }, label: 'Main Office' },
    ],
    agentSpots: [
      { id: 'mgr-spot', type: 'desk', x: 50, y: 40, facing: 'down' },
      { id: 'visitor-1', type: 'standing', x: 35, y: 65, facing: 'up' },
      { id: 'visitor-2', type: 'standing', x: 65, y: 65, facing: 'up' },
    ],
    entryPoint: { x: 50, y: 90 },
  },

  'ceo-office': {
    id: 'ceo-office',
    name: 'CEO Office',
    description: 'Corner office with city views. Bloomberg terminal and whiskey shelf.',
    background: {
      day: '/rooms/ceo-office.png',
      night: '/rooms/ceo-office.png',
    },
    width: 600,
    height: 450,
    furniture: [
    ],
    connections: [
      { toRoom: 'main-office', position: { x: 50, y: 95 }, label: 'Main Office' },
    ],
    agentSpots: [
      { id: 'ceo-spot', type: 'desk', x: 50, y: 45, facing: 'down' },
    ],
    entryPoint: { x: 50, y: 90 },
  },

  'meeting-room': {
    id: 'meeting-room',
    name: 'Meeting Room',
    description: 'Glass-walled room for standups, planning, and heated architecture debates.',
    background: {
      day: '/rooms/meeting-room.png',
      night: '/rooms/meeting-room.png',
    },
    width: 600,
    height: 450,
    furniture: [
    ],
    connections: [
      { toRoom: 'main-office', position: { x: 95, y: 50 }, label: 'Main Office' },
    ],
    agentSpots: [
      { id: 'seat-1', type: 'meeting-seat', x: 30, y: 40, facing: 'right' },
      { id: 'seat-2', type: 'meeting-seat', x: 30, y: 55, facing: 'right' },
      { id: 'seat-3', type: 'meeting-seat', x: 70, y: 40, facing: 'left' },
      { id: 'seat-4', type: 'meeting-seat', x: 70, y: 55, facing: 'left' },
      { id: 'presenter', type: 'standing', x: 50, y: 25, facing: 'down' },
    ],
    entryPoint: { x: 90, y: 50 },
  },

  'kitchen': {
    id: 'kitchen',
    name: 'Kitchen',
    description: 'Espresso machine, kombucha on tap, and a fridge full of La Croix.',
    background: {
      day: '/rooms/kitchen-cafeteria.png',
      night: '/rooms/kitchen-cafeteria.png',
    },
    width: 600,
    height: 450,
    furniture: [
    ],
    connections: [
      { toRoom: 'main-office', position: { x: 5, y: 50 }, label: 'Main Office' },
      { toRoom: 'rooftop', position: { x: 50, y: 5 }, label: 'Rooftop' },
    ],
    agentSpots: [
      { id: 'coffee-spot', type: 'standing', x: 30, y: 35, facing: 'up' },
      { id: 'lunch-1', type: 'meeting-seat', x: 35, y: 65, facing: 'right' },
      { id: 'lunch-2', type: 'meeting-seat', x: 65, y: 65, facing: 'left' },
      { id: 'snack-spot', type: 'standing', x: 15, y: 35, facing: 'up' },
    ],
    entryPoint: { x: 10, y: 50 },
  },

  'server-room': {
    id: 'server-room',
    name: 'Server Room',
    description: 'Cold. Loud. Blinking lights. Where deployments happen.',
    background: {
      day: '/rooms/server-room.png',
      night: '/rooms/server-room.png',
    },
    width: 500,
    height: 400,
    furniture: [
    ],
    connections: [
      { toRoom: 'main-office', position: { x: 50, y: 95 }, label: 'Main Office' },
    ],
    agentSpots: [
      { id: 'server-spot-1', type: 'standing', x: 35, y: 60, facing: 'up' },
      { id: 'server-spot-2', type: 'standing', x: 65, y: 60, facing: 'up' },
    ],
    entryPoint: { x: 50, y: 90 },
    ambience: 'server-hum',
  },

  'lobby': {
    id: 'lobby',
    name: 'Lobby',
    description: 'Where new hires arrive. Swag wall. Pile of Amazon packages.',
    background: {
      day: '/rooms/lobby-reception.png',
      night: '/rooms/lobby-reception.png',
    },
    width: 600,
    height: 450,
    furniture: [
    ],
    connections: [
      { toRoom: 'main-office', position: { x: 50, y: 5 }, label: 'Main Office' },
      { toRoom: 'parking', position: { x: 50, y: 95 }, label: 'Parking' },
    ],
    agentSpots: [
      { id: 'reception-spot', type: 'desk', x: 50, y: 40, facing: 'down' },
      { id: 'waiting-1', type: 'lounge', x: 25, y: 70, facing: 'right' },
      { id: 'waiting-2', type: 'lounge', x: 35, y: 70, facing: 'right' },
    ],
    entryPoint: { x: 50, y: 90 },
  },

  'nap-room': {
    id: 'nap-room',
    name: 'Wellness Room',
    description: 'Sleep pods, meditation cushions, and a Himalayan salt lamp.',
    background: {
      day: '/rooms/nap-wellness-room.png',
      night: '/rooms/nap-wellness-room.png',
    },
    width: 500,
    height: 400,
    furniture: [
    ],
    connections: [
      { toRoom: 'main-office', position: { x: 50, y: 95 }, label: 'Main Office' },
    ],
    agentSpots: [
      { id: 'nap-1', type: 'lounge', x: 25, y: 40, facing: 'down' },
      { id: 'nap-2', type: 'lounge', x: 50, y: 40, facing: 'down' },
      { id: 'nap-3', type: 'lounge', x: 75, y: 40, facing: 'down' },
    ],
    entryPoint: { x: 50, y: 90 },
  },

  'rooftop': {
    id: 'rooftop',
    name: 'Rooftop Terrace',
    description: 'Friday drinks, BBQ, and pretending to have work-life balance.',
    background: {
      day: '/rooms/rooftop-terrace.png',
      night: '/rooms/rooftop-terrace.png',
    },
    width: 700,
    height: 500,
    furniture: [
    ],
    connections: [
      { toRoom: 'kitchen', position: { x: 50, y: 95 }, label: 'Kitchen' },
    ],
    agentSpots: [
      { id: 'roof-1', type: 'lounge', x: 25, y: 50, facing: 'down' },
      { id: 'roof-2', type: 'lounge', x: 65, y: 50, facing: 'down' },
      { id: 'roof-3', type: 'lounge', x: 40, y: 75, facing: 'right' },
    ],
    entryPoint: { x: 50, y: 90 },
  },

  'gym': {
    id: 'gym',
    name: 'Gym',
    description: 'A Peloton, some dumbbells, and a mirror for flexing your PRs.',
    background: {
      day: '/rooms/gym-fitness-room.png',
      night: '/rooms/gym-fitness-room.png',
    },
    width: 500,
    height: 400,
    furniture: [
    ],
    connections: [
      { toRoom: 'main-office', position: { x: 50, y: 95 }, label: 'Main Office' },
    ],
    agentSpots: [
      { id: 'gym-1', type: 'standing', x: 25, y: 45, facing: 'down' },
      { id: 'gym-2', type: 'standing', x: 75, y: 45, facing: 'down' },
    ],
    entryPoint: { x: 50, y: 90 },
  },

  'parking': {
    id: 'parking',
    name: 'Parking Garage',
    description: 'Teslas, e-scooters, and reserved spots nobody respects.',
    background: {
      day: '/rooms/parking-garage.png',
      night: '/rooms/parking-garage.png',
    },
    width: 700,
    height: 500,
    furniture: [
    ],
    connections: [
      { toRoom: 'lobby', position: { x: 50, y: 5 }, label: 'Lobby' },
    ],
    agentSpots: [],
    entryPoint: { x: 50, y: 10 },
  },
}

// ===== ROOM NAVIGATION =====
// Find path between rooms using BFS
export function findRoomPath(from: RoomId, to: RoomId): RoomId[] {
  if (from === to) return [from]

  const visited = new Set<RoomId>()
  const queue: { room: RoomId; path: RoomId[] }[] = [{ room: from, path: [from] }]
  visited.add(from)

  while (queue.length > 0) {
    const { room, path } = queue.shift()!
    const connections = ROOMS[room].connections

    for (const conn of connections) {
      if (conn.toRoom === to) return [...path, to]
      if (!visited.has(conn.toRoom)) {
        visited.add(conn.toRoom)
        queue.push({ room: conn.toRoom, path: [...path, conn.toRoom] })
      }
    }
  }

  return [from] // no path found, stay put
}

// Get all rooms connected to a given room
export function getConnectedRooms(roomId: RoomId): RoomId[] {
  return ROOMS[roomId].connections.map(c => c.toRoom)
}

// Get a free agent spot in a room
export function getFreeSpot(
  roomId: RoomId,
  occupiedSpotIds: Set<string>,
  type?: AgentSpot['type'],
): AgentSpot | null {
  const room = ROOMS[roomId]
  const spots = type
    ? room.agentSpots.filter(s => s.type === type)
    : room.agentSpots

  for (const spot of spots) {
    if (!occupiedSpotIds.has(spot.id)) return spot
  }
  return null
}

// ===== TEAM ROOM NAVIGATION MANIFEST =====
export interface TeamRoom {
  id: string
  name: string
  shortName: string
  icon: string
  tagline: string
  description: string
  camera: {
    x: number   // Center X (0-100)
    y: number   // Center Y (0-100)
    zoom: number // Zoom factor (1.0 - 2.5)
  }
  roles: string[]
}

export const TEAM_ROOMS: TeamRoom[] = [
  {
    id: 'all',
    name: 'Semua Ruangan (Penthouse Overview)',
    shortName: 'Semua',
    icon: '🏢',
    tagline: 'High-Rise Penthouse Headquarters',
    description: 'Denah lengkap 9 ruangan: Penthouse Suite, Ruang Rapat Kaca, Engineering Pods, Lab Senku, Data Center, Rooftop Pool, Arcade, & Kafetaria.',
    camera: { x: 50, y: 50, zoom: 1.05 },
    roles: [
      'vps-boss', 'jarvis', 'vps-assistant', 'swe-frontend', 'swe-backend', 'swe-verifier', 'swe-qa',
      'data-engineer', 'senku', 'professor', 'paperwright', 'devops-engineer', 'ui-designer',
      'tech-mentor', 'github-manager', 'chief-architect', 'office-lead', 'boss', 'founder'
    ],
  },
  {
    id: 'boss-office',
    name: 'Ruang Bos (Executive Suite)',
    shortName: 'Ruang Bos',
    icon: '👑',
    tagline: 'Penthouse CEO Command Suite',
    description: 'Kantor eksekutif pimpinan tertinggi VPS. Dihuni Jarvis (Chief Orchestrator) & VPS Assistant. Dilengkapi meja mahoni mewah, sofa kulit, dan panorama gedung pencakar langit.',
    camera: { x: 62, y: 19, zoom: 2.3 },
    roles: ['vps-boss', 'jarvis', 'vps-assistant', 'boss'],
  },
  {
    id: 'meeting-room',
    name: 'Ruang Rapat Kaca (Boardroom)',
    shortName: 'Rapat Kaca',
    icon: '🤝',
    tagline: 'Glass Wall Executive Boardroom',
    description: 'Ruang rapat kedap suara berdinding kaca transparan dengan meja bundar 10 kursi dan layar dashboard telemetri global untuk perencanaan sprint dan delegasi.',
    camera: { x: 40, y: 19, zoom: 2.3 },
    roles: ['tech-mentor', 'chief-architect'],
  },
  {
    id: 'rooftop-pool',
    name: 'Rooftop Terrace & Kolam Renang',
    shortName: 'Rooftop Pool',
    icon: '🏊',
    tagline: 'Sky Deck & Infinity Pool Lounge',
    description: 'Teras outdoor mewah berlantai dek kayu dengan kolam renang biru toska, kursi berjemur sunbed, payung peneduh, dan pohon palem tropis di atas awan.',
    camera: { x: 84, y: 26, zoom: 2.0 },
    roles: ['rifqi', 'founder'],
  },
  {
    id: 'swe-office',
    name: 'Software Engineering Pods',
    shortName: 'SWE Dev',
    icon: '💻',
    tagline: 'Dev Pods & Agile Collaboration',
    description: 'Pusat rekayasa perangkat lunak: Frontend, Backend, dan Independent QA bekerja di pod multi-monitor bersama Sprint Scrum Board dan workstation ergonomis.',
    camera: { x: 36, y: 48, zoom: 2.1 },
    roles: ['swe-frontend', 'swe-backend', 'swe-verifier', 'swe-qa', 'ui-designer', 'github-manager', 'office-lead'],
  },
  {
    id: 'senku-lab',
    name: 'Laboratorium & Perpustakaan Senku',
    shortName: 'Lab Senku',
    icon: '🧪',
    tagline: 'Research Library & Chemistry Lab',
    description: 'Ruang riset ilmiah Senku & Paperwright. Dilengkapi rak buku kayu tinggi hingga plafon, tangga perpustakaan, papan tulis rumus fisika, mikroskop, dan beker kimia.',
    camera: { x: 23, y: 77, zoom: 2.1 },
    roles: ['senku', 'professor', 'paperwright'],
  },
  {
    id: 'data-lab',
    name: 'Data Center & Lakehouse Server',
    shortName: 'Data Center',
    icon: '🗄️',
    tagline: 'Acoustic Glass Server Facility',
    description: 'Fasilitas data berlantai anti-statis dengan rak server berpendingin khusus, lampu status LED kedip, dan konsol monitoring DuckDB/Iceberg.',
    camera: { x: 53, y: 76, zoom: 2.2 },
    roles: ['data-engineer', 'devops-engineer'],
  },
  {
    id: 'arcade-room',
    name: 'Arcade & Game Lounge',
    shortName: 'Game Room',
    icon: '🕹️',
    tagline: 'Billiards & Retro Recreation',
    description: 'Area hiburan dan relaksasi karyawan: Meja biliar laken hijau, mesin dingdong arcade retro, TV konsol game, dan beanbag warna-warni.',
    camera: { x: 16, y: 19, zoom: 2.3 },
    roles: [],
  },
  {
    id: 'cafeteria',
    name: 'Kafetaria & Bar Kopi',
    shortName: 'Kafetaria',
    icon: '☕',
    tagline: 'Espresso Kitchenette & Balcony Dining',
    description: 'Dapur modern dengan mesin espresso profesional, dispenser air minum, kulkas stainless steel, meja bar, dan area makan dengan pemandangan kota.',
    camera: { x: 78, y: 71, zoom: 2.2 },
    roles: [],
  },
]
