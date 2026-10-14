import { useEffect, useMemo, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import { createClient } from '@supabase/supabase-js'
import { Person } from './Person'

// =====================================================================
//  Pengunjung lain secara realtime (Supabase Realtime: broadcast + presence)
//  Tidak ada tabel & tidak ada data pribadi: hanya nama acak + posisi.
// =====================================================================

// kunci publik (publishable) — memang aman ditaruh di website
const SUPABASE_URL = 'https://nigztoxqlvsplmkumgfi.supabase.co'
const SUPABASE_KEY = 'sb_publishable_FPK5m2JZqfiIHYYEZIcGbg_HX2LRYuW'
const CHANNEL = 'sovereign-hq-rifqi'

const LOOKS = [
  { skin: '#e7b48f', hair: '#2e1f17', shirt: '#3c9ad8', pants: '#2f2f4f' },
  { skin: '#c98f6b', hair: '#5b3a22', shirt: '#f2b13c', pants: '#3b3b3b', longHair: true },
  { skin: '#8d5a3b', hair: '#1b1410', shirt: '#9b59b6', pants: '#3c4fa0' },
  { skin: '#f0c7a1', hair: '#d8b45a', shirt: '#2ecc71', pants: '#5a4327', longHair: true },
  { skin: '#d9a07a', hair: '#7a3b1e', shirt: '#e74c3c', pants: '#2f2f4f' },
  { skin: '#a8724f', hair: '#2e1f17', shirt: '#1abc9c', pants: '#3b3b3b', longHair: true },
]

let client = null
const getClient = () => (client ||= createClient(SUPABASE_URL, SUPABASE_KEY, { realtime: { params: { eventsPerSecond: 10 } } }))

// nama acak untuk diri sendiri (disimpan di sesi supaya tidak berubah saat refresh)
function myIdentity(animals) {
  try {
    const saved = JSON.parse(sessionStorage.getItem('mp-me') || 'null')
    if (saved) return saved
  } catch (e) {
    /* abaikan */
  }
  const me = {
    id: Math.random().toString(36).slice(2, 10),
    animal: Math.floor(Math.random() * animals.length),
    look: Math.floor(Math.random() * LOOKS.length),
  }
  try {
    sessionStorage.setItem('mp-me', JSON.stringify(me))
  } catch (e) {
    /* abaikan */
  }
  return me
}

export function useMultiplayer({ enabled, playerRef, animals, onCount }) {
  const peers = useRef(new Map()) // id → { x, y, z, ry, look, name, moving, ... , t }
  const [ids, setIds] = useState([])
  const me = useMemo(() => myIdentity(animals), [animals])

  useEffect(() => {
    if (!enabled) return
    let alive = true
    const supabase = getClient()
    const channel = supabase.channel(CHANNEL, {
      config: { broadcast: { self: false }, presence: { key: me.id } },
    })
    const refreshIds = () => alive && setIds([...peers.current.keys()])

    channel.on('broadcast', { event: 'pos' }, ({ payload }) => {
      if (!payload || payload.id === me.id) return
      const isNew = !peers.current.has(payload.id)
      peers.current.set(payload.id, { ...payload, t: Date.now() })
      if (isNew) refreshIds()
    })
    channel.on('presence', { event: 'sync' }, () => {
      const state = channel.presenceState()
      const online = new Set(Object.keys(state))
      onCount(online.size)
      let changed = false
      for (const id of peers.current.keys())
        if (!online.has(id)) {
          peers.current.delete(id)
          changed = true
        }
      if (changed) refreshIds()
    })
    channel.subscribe((status) => {
      if (status === 'SUBSCRIBED') channel.track({ animal: me.animal, look: me.look })
    })

    // kirim posisi ±4x per detik, hanya kalau bergerak (+ detak tiap 3 detik)
    let last = null
    let lastSent = 0
    const timer = setInterval(() => {
      const p = playerRef.current
      if (!p) return
      const now = Date.now()
      const cur = { x: +p.position.x.toFixed(2), y: +p.position.y.toFixed(2), z: +p.position.z.toFixed(2), ry: +p.rotation.y.toFixed(2) }
      const moved = !last || Math.abs(cur.x - last.x) + Math.abs(cur.z - last.z) + Math.abs(cur.y - last.y) > 0.04 || Math.abs(cur.ry - last.ry) > 0.05
      if (!moved && now - lastSent < 3000) return
      last = cur
      lastSent = now
      channel.send({ type: 'broadcast', event: 'pos', payload: { id: me.id, animal: me.animal, look: me.look, ...cur } })
    }, 250)

    // hapus pengunjung yang lama tidak terdengar
    const sweep = setInterval(() => {
      let changed = false
      for (const [id, v] of peers.current)
        if (Date.now() - v.t > 12000) {
          peers.current.delete(id)
          changed = true
        }
      if (changed) refreshIds()
    }, 3000)

    return () => {
      alive = false
      clearInterval(timer)
      clearInterval(sweep)
      supabase.removeChannel(channel)
      peers.current.clear()
      setIds([])
      onCount(0)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, me])

  return { peers, ids, me }
}

// karakter pengunjung lain: bergerak halus menuju posisi terakhir yang diterima
function Peer({ id, peers, animals, label }) {
  const group = useRef()
  const moving = useRef(false)
  const pose = useRef({ legs: null, swim: false })
  const info = peers.current.get(id)
  const look = LOOKS[(info?.look ?? 0) % LOOKS.length]
  const name = `${label} ${animals[(info?.animal ?? 0) % animals.length]}`
  useFrame((_, rawDt) => {
    const g = group.current
    const v = peers.current.get(id)
    if (!g || !v) return
    const dt = Math.min(rawDt, 0.05)
    const k = 1 - Math.exp(-dt * 8)
    const dx = v.x - g.position.x
    const dz = v.z - g.position.z
    const far = Math.hypot(dx, dz) > 12
    if (far) g.position.set(v.x, v.y, v.z)
    else {
      g.position.x += dx * k
      g.position.y += (v.y - g.position.y) * k
      g.position.z += dz * k
    }
    let diff = v.ry - g.rotation.y
    diff = Math.atan2(Math.sin(diff), Math.cos(diff))
    g.rotation.y += diff * k
    moving.current = Math.hypot(dx, dz) > 0.08
    // berenang kalau posisinya rendah (di air)
    pose.current.swim = v.y < -0.4
  })
  return (
    <group ref={group} position={[info?.x || 0, info?.y || 0.5, info?.z || 0]}>
      <Person look={look} moving={moving} pose={pose} />
      <Html position={[0, 2.35, 0]} zIndexRange={[17, 7]} style={{ pointerEvents: 'none' }}>
        <div className="mc-peer">{name}</div>
      </Html>
    </group>
  )
}

export function Peers({ peers, ids, animals, label }) {
  return ids.map((id) => <Peer key={id} id={id} peers={peers} animals={animals} label={label} />)
}
