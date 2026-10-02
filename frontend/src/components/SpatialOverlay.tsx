import React, { useState } from 'react'
import { Agent } from '../types'
import { TEAM_ROOMS, TeamRoom } from '../rooms'

interface SpatialOverlayProps {
  agents: Agent[]
  selectedRoomId: string
  onSelectRoom: (room: TeamRoom) => void
  onSendToPool?: (agentId?: string) => void
  onSendToMeeting?: () => void
  onSendToLab?: () => void
  onSendToWork?: () => void
}

// Isometric polygonal boundaries for all 9 rooms (percentages 0-100)
export const SPATIAL_ROOM_POLYGONS: Record<string, {
  name: string
  icon: string
  tagline: string
  points: string
  center: { x: number; y: number }
}> = {
  'arcade-room': {
    name: 'Arcade & Game Lounge',
    icon: '🕹️',
    tagline: 'Meja Biliar & Game Dingdong Retro',
    points: '3.5,4.0 28.0,4.0 28.0,32.0 3.5,32.0',
    center: { x: 16.0, y: 18.0 },
  },
  'meeting-room': {
    name: 'Ruang Rapat Kaca (Boardroom)',
    icon: '🤝',
    tagline: 'Meja Bundar 10 Kursi & Dashboard Telemetri',
    points: '28.5,3.0 50.0,3.0 50.0,31.0 28.5,31.0',
    center: { x: 39.0, y: 17.0 },
  },
  'boss-office': {
    name: 'Ruang Bos (Executive Suite)',
    icon: '👑',
    tagline: 'Meja Mahoni CEO & Sofa Tamu Eksekutif',
    points: '50.5,3.0 70.5,3.0 70.5,31.0 50.5,31.0',
    center: { x: 61.0, y: 17.0 },
  },
  'rooftop-pool': {
    name: 'Rooftop Terrace & Kolam Renang',
    icon: '🏊',
    tagline: 'Kolam Renang Biru Toska & Sundeck Patio',
    points: '71.0,2.0 99.0,2.0 99.0,52.0 71.0,52.0',
    center: { x: 85.0, y: 27.0 },
  },
  'resepsionis': {
    name: 'Lobby & Resepsionis',
    icon: '🏢',
    tagline: 'Meja Resepsi Marmer & Logo Kubus 3D',
    points: '3.0,32.5 17.0,32.5 17.0,58.0 3.0,58.0',
    center: { x: 10.0, y: 45.0 },
  },
  'swe-office': {
    name: 'Software Engineering Pods',
    icon: '💻',
    tagline: '4 Pod Meja Kerja + Scrum Board',
    points: '17.5,32.5 61.5,32.5 61.5,59.0 17.5,59.0',
    center: { x: 39.0, y: 46.0 },
  },
  'senku-lab': {
    name: 'Laboratorium & Perpustakaan Senku',
    icon: '🧪',
    tagline: 'Rak Buku Plafon, Papan Rumus, & Lab Kimia',
    points: '3.0,59.0 42.0,59.0 42.0,93.0 3.0,93.0',
    center: { x: 22.0, y: 76.0 },
  },
  'data-lab': {
    name: 'Data Center & Lakehouse Server',
    icon: '🗄️',
    tagline: 'Acoustic Glass Room & LED Server Racks',
    points: '42.5,59.0 64.5,59.0 64.5,93.0 42.5,93.0',
    center: { x: 53.5, y: 76.0 },
  },
  'cafeteria': {
    name: 'Kafetaria & Bar Kopi',
    icon: '☕',
    tagline: 'Mesin Espresso, Bar Stool, & Dining Table',
    points: '65.0,54.0 96.0,54.0 96.0,89.0 65.0,89.0',
    center: { x: 80.0, y: 71.0 },
  },
}

// True pool water basin polygon (precise 5-point isometric basin)
export const POOL_WATER_POINTS = '80.6,28.4 91.0,25.6 96.4,35.7 93.5,39.7 84.1,35.8'

// Architectural Solid Glass Partitions & Wall Segments
export const GLASS_WALLS = [
  // Glass wall between Boss Office & Boardroom
  { x1: 50.2, y1: 3.0, x2: 50.2, y2: 31.0, doorY: 28.0 },
  // Glass wall between Boardroom & Arcade
  { x1: 28.2, y1: 3.0, x2: 28.2, y2: 31.0, doorY: 28.0 },
  // Partition wall separating north suites from open floor
  { x1: 3.0, y1: 31.5, x2: 70.5, y2: 31.5 },
  // Perimeter glass sliding doors to pool patio
  { x1: 70.8, y1: 2.0, x2: 70.8, y2: 52.0, doorY: 38.0 },
  // Server room acoustic glass walls
  { x1: 42.5, y1: 59.0, x2: 64.5, y2: 59.0, doorX: 54.0 },
  { x1: 64.5, y1: 59.0, x2: 64.5, y2: 92.0 },
  { x1: 42.5, y1: 59.0, x2: 42.5, y2: 92.0 },
  // Lab partition
  { x1: 3.0, y1: 58.5, x2: 42.0, y2: 58.5, doorX: 24.0 },
  // Cafeteria partition
  { x1: 64.8, y1: 53.5, x2: 96.0, y2: 53.5, doorX: 68.0 },
]

export const SpatialOverlay: React.FC<SpatialOverlayProps> = ({
  agents,
  selectedRoomId,
  onSelectRoom,
  onSendToPool,
}) => {
  const [hoveredRoomId, setHoveredRoomId] = useState<string | null>(null)
  const [ripplePos, setRipplePos] = useState<{ x: number; y: number } | null>(null)

  const handlePoolClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    const rect = e.currentTarget.getBoundingClientRect()
    const x = ((e.clientX - rect.left) / rect.width) * 100
    const y = ((e.clientY - rect.top) / rect.height) * 100
    setRipplePos({ x, y })
    setTimeout(() => setRipplePos(null), 1200)

    if (onSendToPool) {
      onSendToPool()
    }
  }

  const swimmers = agents.filter(a => a.state === 'swimming')

  return (
    <div
      className="spatial-overlay"
      style={{
        position: 'absolute',
        inset: 0,
        pointerEvents: 'none',
        zIndex: 15,
      }}
    >
      <svg
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        style={{
          width: '100%',
          height: '100%',
          position: 'absolute',
          inset: 0,
        }}
      >
        <defs>
          <filter id="glassSheen">
            <feGaussianBlur stdDeviation="0.4" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>

        {/* 9 Detected Architectural Room Boundaries */}
        {Object.entries(SPATIAL_ROOM_POLYGONS).map(([roomId, data]) => {
          const isSelected = selectedRoomId === roomId
          const isHovered = hoveredRoomId === roomId
          const teamRoom = TEAM_ROOMS.find(r => r.id === roomId)

          return (
            <polygon
              key={roomId}
              points={data.points}
              className={`spatial-room-polygon ${isHovered ? 'hovered' : ''} ${isSelected ? 'selected' : ''}`}
              style={{
                fill: isSelected
                  ? 'rgba(56, 189, 248, 0.06)'
                  : isHovered
                  ? 'rgba(255, 255, 255, 0.04)'
                  : 'transparent',
                stroke: isSelected
                  ? '#38bdf8'
                  : isHovered
                  ? 'rgba(255, 255, 255, 0.4)'
                  : 'rgba(255, 255, 255, 0.06)',
                strokeWidth: isSelected ? '0.35' : isHovered ? '0.25' : '0.12',
                strokeDasharray: isSelected ? 'none' : '0.8, 0.8',
                transition: 'all 0.2s ease',
                cursor: 'pointer',
                pointerEvents: 'auto',
              }}
              onMouseEnter={() => setHoveredRoomId(roomId)}
              onMouseLeave={() => setHoveredRoomId(null)}
              onClick={() => teamRoom && onSelectRoom(teamRoom)}
            />
          )
        })}

        {/* Architectural Glass Walls (Coded Collision Geometry) */}
        {GLASS_WALLS.map((wall, idx) => (
          <line
            key={`wall-${idx}`}
            x1={wall.x1}
            y1={wall.y1}
            x2={wall.x2}
            y2={wall.y2}
            stroke="rgba(56, 189, 248, 0.35)"
            strokeWidth="0.22"
            strokeLinecap="round"
            filter="url(#glassSheen)"
          />
        ))}

        {/* Active Swimming Pool Basin (True Interactive Aquatic Zone) */}
        <polygon
          points={POOL_WATER_POINTS}
          className="spatial-pool-water"
          style={{
            fill: 'rgba(6, 182, 212, 0.12)',
            stroke: 'rgba(56, 189, 248, 0.55)',
            strokeWidth: '0.25',
            cursor: 'pointer',
            pointerEvents: 'auto',
            transition: 'all 0.2s ease',
          }}
          onClick={handlePoolClick}
        />

        {/* Real-time Swimming Water Ripples for Active Swimmers */}
        {swimmers.map(a => (
          <g key={`swimmer-wave-${a.id}`}>
            <ellipse
              cx={a.position.x}
              cy={a.position.y}
              rx={2.2}
              ry={1.0}
              fill="rgba(56, 189, 248, 0.25)"
              stroke="#38bdf8"
              strokeWidth="0.22"
              className="svg-water-ripple"
            />
            <ellipse
              cx={a.position.x}
              cy={a.position.y}
              rx={3.4}
              ry={1.5}
              fill="none"
              stroke="rgba(6, 182, 212, 0.6)"
              strokeWidth="0.15"
              className="svg-water-ripple-outer"
            />
          </g>
        ))}
      </svg>

      {/* Click-to-dive Water Splash Ripple Wave */}
      {ripplePos && (
        <div
          className="water-ripple-wave"
          style={{
            position: 'absolute',
            left: `${ripplePos.x}%`,
            top: `${ripplePos.y}%`,
            transform: 'translate(-50%, -50%)',
            pointerEvents: 'none',
          }}
        />
      )}

      {/* Floating Hover Badge on Active Detected Room */}
      {hoveredRoomId && SPATIAL_ROOM_POLYGONS[hoveredRoomId] && (
        <div
          className="detected-room-tooltip"
          style={{
            position: 'absolute',
            left: `${SPATIAL_ROOM_POLYGONS[hoveredRoomId].center.x}%`,
            top: `${SPATIAL_ROOM_POLYGONS[hoveredRoomId].center.y}%`,
            transform: 'translate(-50%, -100%)',
            background: 'rgba(13, 14, 16, 0.94)',
            backdropFilter: 'blur(8px)',
            border: '1px solid rgba(56, 189, 248, 0.4)',
            borderRadius: '6px',
            padding: '5px 12px',
            boxShadow: '0 4px 16px rgba(0, 0, 0, 0.6)',
            pointerEvents: 'none',
            zIndex: 100,
            whiteSpace: 'nowrap',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 13 }}>{SPATIAL_ROOM_POLYGONS[hoveredRoomId].icon}</span>
            <span style={{ fontSize: 11, fontWeight: 700, fontFamily: 'JetBrains Mono', color: '#f1f5f9' }}>
              {SPATIAL_ROOM_POLYGONS[hoveredRoomId].name}
            </span>
          </div>
          <div style={{ fontSize: 9, color: '#38bdf8', marginTop: 1, fontFamily: 'JetBrains Mono' }}>
            {SPATIAL_ROOM_POLYGONS[hoveredRoomId].tagline}
          </div>
          <div style={{ fontSize: 9, color: '#94a3b8', marginTop: 2, fontFamily: 'JetBrains Mono' }}>
            👥 {agents.filter(a => {
              const r = TEAM_ROOMS.find(tr => tr.id === hoveredRoomId)
              return r && r.roles.includes(a.role)
            }).length} Agen Aktif • Klik untuk Menuju Ruangan
          </div>
        </div>
      )}
    </div>
  )
}

export default SpatialOverlay
