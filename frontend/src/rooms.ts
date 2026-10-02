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
      // Clean interactive hotspots over the high-res 3D architectural illustration
      { id: 'pool', type: 'hotspot', sprite: 'hotspot', x: 89.0, y: 33.0, interactive: true, label: '🏊 Kolam Renang Rooftop' },
      { id: 'sunbed', type: 'hotspot', sprite: 'hotspot', x: 84.0, y: 22.0, interactive: true, label: '☀️ Kursi Berjemur Sundeck' },
      { id: 'espresso', type: 'hotspot', sprite: 'hotspot', x: 73.0, y: 65.0, interactive: true, label: '☕ Mesin Kopi Espresso' },
      { id: 'billiards', type: 'hotspot', sprite: 'hotspot', x: 14.0, y: 21.0, interactive: true, label: '🎱 Meja Biliar Laken Hijau' },
      { id: 'arcade', type: 'hotspot', sprite: 'hotspot', x: 18.0, y: 12.0, interactive: true, label: '🕹️ Mesin Dingdong Arcade' },
      { id: 'meeting-display', type: 'hotspot', sprite: 'hotspot', x: 40.0, y: 19.0, interactive: true, label: '📊 Dashboard Telemetri Ruang Rapat' },
      { id: 'server-rack', type: 'hotspot', sprite: 'hotspot', x: 54.0, y: 73.0, interactive: true, label: '🗄️ Server Rack Data Lakehouse' },
      { id: 'chemistry-bench', type: 'hotspot', sprite: 'hotspot', x: 21.0, y: 82.0, interactive: true, label: '🧪 Meja Laboratorium & Rumus Fisika' },
      { id: 'kanban-board', type: 'hotspot', sprite: 'hotspot', x: 56.0, y: 46.0, interactive: true, label: '📋 Agile Sprint Scrum Board' },
      { id: 'boss-desk', type: 'hotspot', sprite: 'hotspot', x: 61.0, y: 17.0, interactive: true, label: '👑 Meja Eksekutif CEO Jarvis' },
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
      { id: 'spot-pool-swim-1', type: 'swimming', x: 89.0, y: 33.0, facing: 'down', spriteFacing: 'front-left', zIndex: 40 },
      { id: 'spot-pool-swim-2', type: 'swimming', x: 87.0, y: 38.0, facing: 'down', spriteFacing: 'rear-right', zIndex: 42 },
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
      { id: 'W-center', x: 50.0, y: 44.0, connections: ['W-dev-west', 'W-dev-east', 'W-scrum', 'W-hall-boss', 'W-hall-meeting', 'W-hall-server'] },
      { id: 'W-dev-west', x: 32.0, y: 44.0, connections: ['W-center', 'W-dev-south', 'W-hall-reception', 'W-hall-arcade', 'W-hall-lab'] },
      { id: 'W-dev-south', x: 32.0, y: 56.0, connections: ['W-dev-west', 'W-hall-lab'] },
      { id: 'W-dev-east', x: 46.0, y: 48.0, connections: ['W-center', 'W-hall-cafe', 'W-scrum'] },
      { id: 'W-scrum', x: 55.0, y: 46.0, connections: ['W-center', 'W-dev-east', 'W-hall-pool'] },
      { id: 'W-hall-boss', x: 61.0, y: 28.0, connections: ['W-center', 'W-boss-desk', 'W-hall-meeting', 'W-hall-pool'] },
      { id: 'W-boss-desk', x: 60.5, y: 17.0, connections: ['W-hall-boss'] },
      { id: 'W-hall-meeting', x: 40.0, y: 30.0, connections: ['W-center', 'W-meeting-table', 'W-hall-boss', 'W-hall-arcade'] },
      { id: 'W-meeting-table', x: 40.0, y: 21.0, connections: ['W-hall-meeting'] },
      { id: 'W-hall-arcade', x: 22.0, y: 32.0, connections: ['W-dev-west', 'W-arcade-center', 'W-hall-meeting'] },
      { id: 'W-arcade-center', x: 16.0, y: 21.0, connections: ['W-hall-arcade'] },
      { id: 'W-hall-reception', x: 14.0, y: 44.0, connections: ['W-dev-west'] },
      { id: 'W-hall-lab', x: 24.0, y: 62.0, connections: ['W-dev-west', 'W-dev-south', 'W-lab-chem', 'W-lab-lib'] },
      { id: 'W-lab-chem', x: 20.0, y: 80.0, connections: ['W-hall-lab', 'W-lab-lib'] },
      { id: 'W-lab-lib', x: 33.0, y: 75.0, connections: ['W-hall-lab', 'W-lab-chem'] },
      { id: 'W-hall-server', x: 54.0, y: 64.0, connections: ['W-center', 'W-server-aisle'] },
      { id: 'W-server-aisle', x: 53.0, y: 75.0, connections: ['W-hall-server'] },
      { id: 'W-hall-cafe', x: 68.0, y: 54.0, connections: ['W-dev-east', 'W-cafe-bar', 'W-cafe-dining', 'W-hall-pool'] },
      { id: 'W-cafe-bar', x: 73.0, y: 65.0, connections: ['W-hall-cafe', 'W-cafe-dining'] },
      { id: 'W-cafe-dining', x: 80.0, y: 75.0, connections: ['W-hall-cafe', 'W-cafe-bar'] },
      { id: 'W-hall-pool', x: 75.0, y: 32.0, connections: ['W-scrum', 'W-hall-boss', 'W-hall-cafe', 'W-pool-deck', 'W-pool-water'] },
      { id: 'W-pool-deck', x: 84.0, y: 22.0, connections: ['W-hall-pool', 'W-pool-water'] },
      { id: 'W-pool-water', x: 88.0, y: 34.0, connections: ['W-pool-deck', 'W-hall-pool'] },
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
