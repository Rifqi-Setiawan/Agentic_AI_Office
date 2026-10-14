import { useEffect, useMemo, useRef, useState } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import * as THREE from 'three'
import { rng } from './noise'
import { Person } from './Person'
import { typeSound } from '../sound'
import { ROWBOAT } from './Life'

// ——— jalan mengikuti antrean titik (hasil A*), tinggi mengikuti tanah ———
function stepAlong(group, queue, speed, dt) {
  if (!queue.length) return false
  const [tx, tz] = queue[0]
  const p = group.position
  const dx = tx - p.x
  const dz = tz - p.z
  const d = Math.hypot(dx, dz)
  if (d < 0.1) {
    queue.shift()
    return queue.length > 0
  }
  const step = Math.min(d, speed * dt)
  p.x += (dx / d) * step
  p.z += (dz / d) * step
  turnTo(group, Math.atan2(dx, dz), dt * 12)
  return true
}

function turnTo(group, want, k) {
  let diff = want - group.rotation.y
  diff = Math.atan2(Math.sin(diff), Math.cos(diff))
  group.rotation.y += diff * Math.min(1, k)
}

function followGround(group, world, dt) {
  const want = world.ground(group.position.x, group.position.z) + 0.5
  group.position.y += (want - group.position.y) * Math.min(1, dt * 14)
}

// Bar "Makan..." di atas kepala; progres diisi lewat ref (tanpa re-render tiap frame)
function EatBar({ fill, label, y = 2.45 }) {
  return (
    <Html position={[0, y, 0]} zIndexRange={[19, 9]} style={{ pointerEvents: 'none' }}>
      <div className="mc-eatbar">
        <div className="mc-eatbar-label">{label}</div>
        <div className="mc-eatbar-track">
          <div ref={fill} className="mc-eatbar-fill" />
        </div>
      </div>
    </Html>
  )
}

// kursi warung yang sedang dipakai (indeks kursi → id warga / 'zafira'), dibaca juga oleh mangkuk di meja
export const WARUNG_SEATS = [null, null, null]

const ZAFIRA = {
  skin: '#e7b48f',
  hair: '#1e293b',
  shirt: '#0f172a',
  pants: '#334155',
  eyes: '#1e3a8a',
  longHair: false,
}

const KEYS = {
  KeyW: [0, 1], ArrowUp: [0, 1], KeyS: [0, -1], ArrowDown: [0, -1],
  KeyA: [-1, 0], ArrowLeft: [-1, 0], KeyD: [1, 0], ArrowRight: [1, 0],
}

// Zafira = karakter yang kamu kendalikan
export function Player({ world, command, bubble, playerRef, onEnter, onNearDoor, onManualMove, onClick, wake, onWakeDone, wakeText, exploreText, onDialog, eatTexts, onAte, rideTexts, onRideDone, onRideState }) {
  const [eatingUI, setEatingUI] = useState(false)
  const eatFill = useRef()
  const group = playerRef
  const moving = useRef(false)
  const queue = useRef([])
  const speed = useRef(5)
  const pendingEnter = useRef(null)
  const insideId = useRef(null)
  const near = useRef(null)
  const nearTimer = useRef(0)
  const pressed = useRef(new Set())
  const { camera } = useThree()
  const [say, setSay] = useState(null)
  const fwd = useMemo(() => new THREE.Vector3(), [])
  const bodyRef = useRef()
  const pose = useRef({ legs: null })
  const meal = useRef({ seat: -1, time: 0, pending: false })
  const swimT = useRef(0)
  const ride = useRef({ pending: false, active: false, i: 0 })
  const ripple = useRef()
  const standUpFromMeal = (g) => {
    const M = meal.current
    if (M.seat < 0) return
    if (WARUNG_SEATS[M.seat] === 'zafira') WARUNG_SEATS[M.seat] = null
    const wasSitting = M.time > 0 && !M.pending
    meal.current = { seat: -1, time: 0, pending: false }
    setEatingUI(false)
    pose.current.legs = null
    if (wasSitting && g) g.position.y = world.ground(g.position.x, g.position.z) + 0.5
  }
  const wakeT = useRef(0)
  const wakeQueue = useRef(null)
  const wakeDone = useRef(false)
  const saidMorning = useRef(false)

  // adegan dilewati → langsung berdiri di depan rumah
  useEffect(() => {
    if (wake || !world.home || wakeDone.current) return
    if (wakeT.current > 0 || !saidMorning.current) {
      wakeDone.current = true
      pose.current.legs = null
      if (bodyRef.current) {
        bodyRef.current.rotation.x = 0
        bodyRef.current.position.y = 0
      }
      const [x, z] = world.home.outside
      group.current.position.set(x, world.ground(x, z) + 0.5, z)
      group.current.rotation.y = world.home.rot + Math.PI
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wake])

  // ——— adegan bangun tidur: berbaring → duduk → berdiri → jalan keluar ———
  const runWake = (g, dt) => {
    const H = world.home
    const ss = (a, b, t) => {
      const x = Math.min(1, Math.max(0, (t - a) / (b - a)))
      return x * x * (3 - 2 * x)
    }
    const BED = 1.05
    const lie = { p: [-2, BED, 0.55], rx: -Math.PI / 2, lift: 0.25, legs: 0 }
    const sit = { p: [-2, BED - 0.62, 1.0], rx: 0, lift: 0, legs: -Math.PI / 2 }
    const stand = { p: [-1, 0.5, 0.2], rx: 0, lift: 0, legs: 0 }
    const mix = (a, b, k) => ({
      p: a.p.map((v, i) => v + (b.p[i] - v) * k),
      rx: a.rx + (b.rx - a.rx) * k,
      lift: a.lift + (b.lift - a.lift) * k,
      legs: a.legs + (b.legs - a.legs) * k,
    })
    const t = wakeT.current
    const apply = (s) => {
      const [wx, wz] = H.tf(s.p[0], s.p[2])
      g.position.set(wx, s.p[1], wz)
      g.rotation.y = H.rot + Math.PI
      bodyRef.current.rotation.x = s.rx
      bodyRef.current.position.y = s.lift
      pose.current.legs = s.legs
    }
    if (wake === 'asleep') {
      apply(lie)
      moving.current = false
      return
    }
    wakeT.current += dt
    if (t < 4.5) {
      let s = lie
      if (t > 1.6) s = mix(lie, sit, ss(1.6, 2.7, t))
      if (t > 3.8) s = mix(sit, stand, ss(3.8, 4.5, t))
      apply(s)
      moving.current = false
      if (t > 3.8 && !saidMorning.current) {
        saidMorning.current = true
        onDialog(wakeText)
      }
      return
    }
    // jalan keluar rumah
    pose.current.legs = null
    bodyRef.current.rotation.x = 0
    bodyRef.current.position.y = 0
    if (!wakeQueue.current) wakeQueue.current = [H.tf(0, -1.5), H.door, H.outside, [H.outside[0], H.outside[1] - 1.5]]
    moving.current = stepAlong(g, wakeQueue.current, 2.6, dt)
    followGround(g, world, dt)
    if (!moving.current && !wakeDone.current) {
      wakeDone.current = true
      g.rotation.y = H.rot + Math.PI // menghadap ke desa
      onDialog(exploreText)
      onWakeDone()
    }
  }

  const station = (id) => world.stations.find((s) => s.id === id)

  useEffect(() => {
    const down = (e) => {
      if (!KEYS[e.code] || e.target.closest?.('input, textarea')) return
      pressed.current.add(e.code)
      if (e.code.startsWith('Arrow')) e.preventDefault()
    }
    const up = (e) => pressed.current.delete(e.code)
    const blur = () => pressed.current.clear()
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    window.addEventListener('blur', blur)
    return () => {
      window.removeEventListener('keydown', down)
      window.removeEventListener('keyup', up)
      window.removeEventListener('blur', blur)
    }
  }, [])

  useEffect(() => {
    if (!command) return
    const g = group.current
    if (ride.current.active) {
      // sedang di perahu: klik laut = arahkan perahu ke sana; 'unboard' = turun di dermaga
      if (command.type === 'move') ride.current.target = command.to
      if (command.type === 'unboard') {
        const D = world.dock
        ride.current = { pending: false, active: false }
        ROWBOAT.riding = false
        ROWBOAT.sailing = false
        ROWBOAT.x = D.boatDock[0]
        ROWBOAT.z = D.boatDock[1]
        ROWBOAT.rot = D.heading + Math.PI / 2
        pose.current.legs = null
        g.rotation.set(0, D.heading + Math.PI, 0)
        const [bx, bz] = D.board
        g.position.set(bx, world.ground(bx, bz) + 0.5, bz)
        setSay(rideTexts.done)
        setTimeout(() => setSay(null), 3000)
        onRideState({ riding: false, nearDock: false })
      }
      return
    }
    ride.current.pending = false
    // perintah baru → berhenti makan dulu (kalau sedang di warung)
    standUpFromMeal(g)
    const from = [g.position.x, g.position.z]
    const go = (to, extra = []) => {
      const path = world.findPath(from, to, { swim: true })
      if (!path) {
        g.position.set(to[0], world.ground(to[0], to[1]) + 0.5, to[1])
        queue.current = [...extra]
      } else queue.current = [...path, ...extra]
    }
    if (command.type === 'boat') {
      // jalan ke dermaga, lalu naik perahu
      const D = world.dock
      if (!D) return
      ride.current = { pending: true, active: false, i: 0 }
      insideId.current = null
      pendingEnter.current = null
      speed.current = 7
      go(D.board)
      return
    }
    if (command.type === 'eat') {
      // pesan mie ayam → jalan ke bangku kosong, lalu duduk makan
      const W = world.warung
      const free = WARUNG_SEATS.findIndex((x) => x === null)
      if (!W || free < 0) {
        setSay(eatTexts.full)
        setTimeout(() => setSay(null), 2500)
        return
      }
      WARUNG_SEATS[free] = 'zafira'
      meal.current = { seat: free, time: 0, pending: true }
      insideId.current = null
      pendingEnter.current = null
      speed.current = 6
      go(W.seats[free], [W.seats[free]])
      return
    }
    if (command.type === 'enter') {
      const s = station(command.id)
      if (insideId.current === command.id) {
        onEnter(command.id)
        return
      }
      insideId.current = null
      pendingEnter.current = command.id
      speed.current = 7.5
      go(s.outside, [s.door, s.inside])
    } else if (command.type === 'exit') {
      const s = insideId.current && station(insideId.current)
      insideId.current = null
      pendingEnter.current = null
      speed.current = 5
      if (s) queue.current = [s.door, s.outside]
    } else if (command.type === 'move') {
      insideId.current = null
      pendingEnter.current = null
      speed.current = command.run ? 7.5 : 5.5
      const path = world.findPath(from, command.to, { swim: true })
      if (path) queue.current = path
      g.userData.faceAfter = command.face || null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [command])

  useEffect(() => {
    if (!bubble) return
    setSay(bubble.text)
    const id = setTimeout(() => setSay(null), 3200)
    return () => clearTimeout(id)
  }, [bubble])

  useFrame(({ clock }, rawDt) => {
    const g = group.current
    const dt = Math.min(rawDt, 0.05)
    if (wake && world.home) {
      runWake(g, dt)
      return
    }

    // ——— naik perahu: Zafira duduk di perahu & kamu yang mengemudikan ———
    const R = ride.current
    if (R.active) {
      // perahu hanya boleh di air (laut sekitar pulau), tidak boleh naik ke darat
      const canSail = (x, z) => Math.hypot(x, z) < 82 && (Math.abs(x) > 60 || Math.abs(z) > 60 || world.isWater(x, z))
      let mx = 0
      let mz = 0
      let ix = 0
      let iz = 0
      for (const k of pressed.current) {
        ix += KEYS[k][0]
        iz += KEYS[k][1]
      }
      if (ix || iz) {
        R.target = null
        camera.getWorldDirection(fwd)
        fwd.y = 0
        fwd.normalize()
        mx = fwd.x * iz - fwd.z * ix
        mz = fwd.z * iz + fwd.x * ix
      } else if (R.target) {
        mx = R.target[0] - ROWBOAT.x
        mz = R.target[1] - ROWBOAT.z
        if (Math.hypot(mx, mz) < 0.6) {
          R.target = null
          mx = 0
          mz = 0
        }
      }
      const len = Math.hypot(mx, mz)
      let sailing = false
      if (len > 0.001) {
        mx /= len
        mz /= len
        const step = 6 * dt
        const nx = ROWBOAT.x + mx * step
        const nz = ROWBOAT.z + mz * step
        // cek ujung depan perahu juga supaya tidak menabrak pantai
        if (canSail(nx, nz) && canSail(nx + mx * 1.3, nz + mz * 1.3)) {
          // hitung putaran mengelilingi pulau (untuk quest)
          const a0 = Math.atan2(ROWBOAT.z, ROWBOAT.x)
          const a1 = Math.atan2(nz, nx)
          let da = a1 - a0
          da = Math.atan2(Math.sin(da), Math.cos(da))
          R.turn += da
          ROWBOAT.x = nx
          ROWBOAT.z = nz
          sailing = true
          if (!R.lapDone && Math.abs(R.turn) > Math.PI * 2 * 0.97) {
            R.lapDone = true
            setSay(rideTexts.lap)
            setTimeout(() => setSay(null), 3000)
            onRideDone()
          }
        } else R.target = null
        let diff = Math.atan2(mx, mz) - ROWBOAT.rot
        diff = Math.atan2(Math.sin(diff), Math.cos(diff))
        ROWBOAT.rot += diff * Math.min(1, dt * 5)
      }
      ROWBOAT.sailing = sailing
      // Zafira ikut terayun bersama perahu (rumus sama dengan RowBoat)
      const tt = clock.elapsedTime
      g.position.set(ROWBOAT.x, 0.28 + Math.sin(tt * 1.6) * 0.05 + 0.12, ROWBOAT.z)
      g.rotation.set(Math.cos(tt * 1.2) * 0.03, ROWBOAT.rot, Math.sin(tt * 1.4) * 0.04)
      pose.current.legs = -Math.PI / 2
      pose.current.swim = false
      moving.current = false
      if (ripple.current) ripple.current.visible = false
      // dekat dermaga → boleh turun
      const near = Math.hypot(ROWBOAT.x - world.dock.boatDock[0], ROWBOAT.z - world.dock.boatDock[1]) < 5
      if (near !== R.near) {
        R.near = near
        onRideState({ riding: true, nearDock: near })
      }
      return
    }

    // ——— makan mie ayam di warung ———
    const M = meal.current
    if (M.seat >= 0 && !M.pending && M.time > 0) {
      if (pressed.current.size) standUpFromMeal(g)
      else {
        const W = world.warung
        const [sx, sz] = W.seats[M.seat]
        g.position.set(sx, world.ground(sx, sz) + 0.5 - 0.33, sz)
        g.rotation.y = W.rot
        pose.current.legs = -Math.PI / 2
        moving.current = false
        M.time -= dt
        if (!eatingUI) setEatingUI(true)
        if (eatFill.current) eatFill.current.style.width = `${Math.min(100, (1 - M.time / 7) * 100)}%`
        if (M.time <= 0) {
          setEatingUI(false)
          standUpFromMeal(g)
          setSay(eatTexts.done)
          setTimeout(() => setSay(null), 3000)
          onAte()
        }
        return
      }
    }

    // kontrol keyboard (relatif terhadap arah kamera)
    let ix = 0
    let iz = 0
    for (const k of pressed.current) {
      ix += KEYS[k][0]
      iz += KEYS[k][1]
    }
    if (ix || iz) {
      queue.current = []
      pendingEnter.current = null
      if (insideId.current) {
        insideId.current = null
        onManualMove()
      }
      camera.getWorldDirection(fwd)
      fwd.y = 0
      fwd.normalize()
      const rx = -fwd.z
      const rz = fwd.x
      let mx = fwd.x * iz + rx * ix
      let mz = fwd.z * iz + rz * ix
      const len = Math.hypot(mx, mz) || 1
      mx /= len
      mz /= len
      const step = 5.5 * dt
      const p = g.position
      const h0 = world.ground(p.x, p.z)
      const free = (x, z) =>
        [[0, 0], [0.28, 0], [-0.28, 0], [0, 0.28], [0, -0.28]].every(
          ([ox, oz]) =>
            (world.canWalk(x + ox, z + oz) || world.isWater(x + ox, z + oz)) &&
            Math.abs(world.ground(x + ox, z + oz) - h0) <= 1,
        )
      if (free(p.x + mx * step, p.z + mz * step)) {
        p.x += mx * step
        p.z += mz * step
      } else if (free(p.x + mx * step, p.z)) p.x += mx * step
      else if (free(p.x, p.z + mz * step)) p.z += mz * step
      turnTo(g, Math.atan2(mx, mz), dt * 14)
      moving.current = true
      g.userData.face = undefined
    } else {
      moving.current = stepAlong(g, queue.current, speed.current, dt)
      if (!moving.current && ride.current.pending) {
        ride.current = { pending: false, active: true, turn: 0, lapDone: false, near: true, target: null }
        ROWBOAT.riding = true
        setSay(rideTexts.start)
        setTimeout(() => setSay(null), 3500)
        onRideState({ riding: true, nearDock: true })
      }
      if (!moving.current && meal.current.pending) {
        meal.current.pending = false
        meal.current.time = 7
      }
      if (!moving.current && pendingEnter.current) {
        const id = pendingEnter.current
        pendingEnter.current = null
        insideId.current = id
        const s = station(id)
        g.userData.face = Math.atan2(s.inside[0] - s.outside[0], s.inside[1] - s.outside[1])
        onEnter(id)
      }
      if (!moving.current && g.userData.faceAfter) {
        const [fx, fz] = g.userData.faceAfter
        g.userData.face = Math.atan2(fx - g.position.x, fz - g.position.z)
        g.userData.faceAfter = null
      }
      if (moving.current) g.userData.face = undefined
      else if (g.userData.face !== undefined) turnTo(g, g.userData.face, dt * 6)
    }
    // berenang: badan tenggelam sampai bahu, terapung naik-turun, tangan mengayuh
    const inWater = world.isWater(g.position.x, g.position.z)
    pose.current.swim = inWater
    swimT.current += dt
    if (inWater) {
      const want = -1.0 + Math.sin(swimT.current * 2.5) * 0.06
      g.position.y += (want - g.position.y) * Math.min(1, dt * 6)
    } else followGround(g, world, dt)
    if (ripple.current) {
      ripple.current.visible = inWater
      ripple.current.position.set(g.position.x, 0.33, g.position.z)
      const k = (swimT.current * 0.8) % 1
      ripple.current.scale.setScalar(0.8 + k * 1.2)
      ripple.current.material.opacity = (1 - k) * 0.6
    }

    // dekat pintu? munculkan tombol "Masuk"
    nearTimer.current -= dt
    if (nearTimer.current <= 0) {
      nearTimer.current = 0.15
      let found = null
      if (!insideId.current && !pendingEnter.current)
        for (const s of world.stations.filter((x) => x.desk || x.game))
          if (Math.hypot(g.position.x - s.outside[0], g.position.z - s.outside[1]) < 2.6) found = s.id
      if (found !== near.current) {
        near.current = found
        onNearDoor(found)
      }
    }
  })

  return (
    <>
    <mesh ref={ripple} rotation-x={-Math.PI / 2} visible={false}>
      <ringGeometry args={[0.55, 0.75, 20]} />
      <meshBasicMaterial color="#ffffff" transparent opacity={0.5} depthWrite={false} />
    </mesh>
    <group ref={group} position={[0, 0.5, 2]}>
      <group ref={bodyRef}>
        <Person
          look={ZAFIRA}
          moving={moving}
          pose={pose}
          onClick={(e) => {
            e.stopPropagation()
            onClick()
          }}
        />
      </group>
      {eatingUI && !say && <EatBar fill={eatFill} label={eatTexts.eating} />}
      {say && (
        <Html position={[0, 2.35, 0]} zIndexRange={[20, 10]} style={{ pointerEvents: 'none' }}>
          <div className="mc-speech">
            <div className="mc-speech-name">Rifqi</div>
            {say}
          </div>
        </Html>
      )}
    </group>
    </>
  )
}

const VILLAGERS = [
  // 0: Jarvis (Chief Orchestrator) — Charcoal tech suit, cyan eyes
  { skin: '#f0d0b0', hair: '#1e293b', shirt: '#0f172a', pants: '#334155', eyes: '#38bdf8' },
  // 1: Oracle (Research Scientist) — Deep navy knit, violet eyes
  { skin: '#e2d4c0', hair: '#1e1b4b', shirt: '#1e3a8a', pants: '#172554', eyes: '#a855f7' },
  // 2: Daedalus (Systems Architect) — Slate jacket, titanium glasses
  { skin: '#d9a07a', hair: '#334155', shirt: '#475569', pants: '#1e293b', eyes: '#94a3b8' },
  // 3: Forge (Specialist Backend) — Rust-orange hoodie, dark cargo
  { skin: '#d49b70', hair: '#7c2d12', shirt: '#ea580c', pants: '#431407', eyes: '#fbbf24' },
  // 4: Prism (Frontend Engineer) — Rose/fuchsia designer top
  { skin: '#fad0c4', hair: '#831843', shirt: '#db2777', pants: '#500724', eyes: '#f43f5e' },
  // 5: Sentinel (Independent QA) — Silver-grey tactical polo, emerald eyes
  { skin: '#e2e8f0', hair: '#475569', shirt: '#94a3b8', pants: '#334155', eyes: '#22c55e' },
  // 6: Bastion (Principal SRE) — Forest-green tactical jacket, dark combat slacks
  { skin: '#c98f6b', hair: '#14532d', shirt: '#166534', pants: '#052e16', eyes: '#4ade80' },
]

function Villager({ world, look, seed, playerRef, lines, name, consumed, sound, onTalk, onApproach, eatLine, eatingLabel }) {
  const [eatingUI, setEatingUI] = useState(false)
  const eatFill = useRef()
  const group = useRef()
  const moving = useRef(false)
  const queue = useRef([])
  const wait = useRef(0.5 + seed * 0.7)
  const talkTime = useRef(0)
  const waiting = useRef(0) // menunggu Zafira datang
  const lineIdx = useRef(0)
  const [say, setSay] = useState(null)
  const [hover, setHover] = useState(false)
  const hoverRef = useRef(false)
  const hoverOn = (v) => {
    hoverRef.current = v
    setHover(v)
  }
  const r = useMemo(() => rng(seed * 97 + 13), [seed])
  const start = world.pois[(seed * 3) % world.pois.length]
  const pose = useRef({ legs: null })
  const meal = useRef({ seat: -1, eating: 0 }) // seat ≥ 0 = sedang menuju/duduk di warung
  const { gl } = useThree()

  const startTalk = () => {
    waiting.current = 0
    talkTime.current = 5
    setSay(lines[lineIdx.current % lines.length])
    lineIdx.current += 1
    if (sound) typeSound()
    onTalk()
  }

  // diklik → warga berhenti & menunggu, Zafira jalan menghampiri, lalu ngobrol
  const talk = (e) => {
    e?.stopPropagation?.()
    consumed.current = performance.now()
    // sedang makan → cukup ngobrol dari kursi
    if (meal.current.eating > 0) {
      setSay(lines[lineIdx.current % lines.length])
      lineIdx.current += 1
      if (sound) typeSound()
      onTalk()
      setTimeout(() => setSay(null), 4000)
      return
    }
    if (meal.current.seat >= 0) {
      WARUNG_SEATS[meal.current.seat] = null
      meal.current.seat = -1
    }
    queue.current = []
    moving.current = false
    const g = group.current
    const p = playerRef.current
    if (p && Math.hypot(p.position.x - g.position.x, p.position.z - g.position.z) < 2.4) {
      startTalk()
      return
    }
    waiting.current = 10
    // titik di samping warga, di sisi yang menghadap Zafira
    const dx = p ? p.position.x - g.position.x : 1
    const dz = p ? p.position.z - g.position.z : 0
    const d = Math.hypot(dx, dz) || 1
    onApproach([g.position.x + (dx / d) * 1.5, g.position.z + (dz / d) * 1.5], [g.position.x, g.position.z])
  }

  useFrame((_, rawDt) => {
    const g = group.current
    const dt = Math.min(rawDt, 0.05)
    const p = playerRef.current
    const W = world.warung
    // ——— makan di warung: duduk di bangku menghadap meja ———
    if (meal.current.eating > 0) {
      meal.current.eating -= dt
      if (!eatingUI) setEatingUI(true)
      if (eatFill.current) eatFill.current.style.width = `${Math.min(100, (1 - meal.current.eating / meal.current.total) * 100)}%`
      const [sx, sz] = W.seats[meal.current.seat]
      g.position.set(sx, world.ground(sx, sz) + 0.5 - 0.22, sz)
      g.rotation.y = W.rot
      pose.current.legs = -Math.PI / 2
      moving.current = false
      if (meal.current.eating <= 0) {
        // selesai makan → berdiri lagi
        setEatingUI(false)
        WARUNG_SEATS[meal.current.seat] = null
        meal.current.seat = -1
        pose.current.legs = null
        g.position.y = world.ground(sx, sz) + 0.5
        setSay(eatLine)
        setTimeout(() => setSay(null), 3000)
        wait.current = 2
      }
      return
    }
    if (waiting.current > 0) {
      waiting.current -= dt
      moving.current = false
      if (p) {
        turnTo(g, Math.atan2(p.position.x - g.position.x, p.position.z - g.position.z), dt * 6)
        if (Math.hypot(p.position.x - g.position.x, p.position.z - g.position.z) < 2.2) startTalk()
      }
      followGround(g, world, dt)
      return
    }
    if (talkTime.current > 0) {
      talkTime.current -= dt
      if (p) turnTo(g, Math.atan2(p.position.x - g.position.x, p.position.z - g.position.z), dt * 8)
      if (talkTime.current <= 0) {
        setSay(null)
        wait.current = 1
      }
      followGround(g, world, dt)
      return
    }
    if (hoverRef.current) {
      moving.current = false
      if (p) turnTo(g, Math.atan2(p.position.x - g.position.x, p.position.z - g.position.z), dt * 4)
    } else if (queue.current.length) {
      moving.current = stepAlong(g, queue.current, 1.8, dt)
      // sampai di kursi warung → duduk makan
      if (!queue.current.length && meal.current.seat >= 0) {
        meal.current.eating = 9 + r() * 6
        meal.current.total = meal.current.eating
      }
    } else {
      moving.current = false
      wait.current -= dt
      if (wait.current <= 0) {
        wait.current = 2 + r() * 5
        // kadang lapar → ke warung mie ayam kalau ada kursi kosong
        const free = W ? WARUNG_SEATS.findIndex((x) => x === null) : -1
        if (free >= 0 && r() < 0.3) {
          const path = world.findPath([g.position.x, g.position.z], W.seats[free])
          if (path) {
            WARUNG_SEATS[free] = seed
            meal.current.seat = free
            queue.current = [...path, W.seats[free]]
            return
          }
        }
        const t = world.pois[Math.floor(r() * world.pois.length)]
        const path = world.findPath([g.position.x, g.position.z], [t[0] + (r() - 0.5) * 2, t[1] + (r() - 0.5) * 2])
        if (path) queue.current = path
      }
    }
    followGround(g, world, dt)
  })

  return (
    <group ref={group} position={[start[0], 0.5, start[1]]} scale={0.92}>
      <Person
        look={look}
        moving={moving}
        pose={pose}
        onClick={talk}
      />
      {/* kotak klik yang lebih besar dari badan supaya gampang diketuk di HP */}
      <mesh
        position={[0, 1, 0]}
        onClick={talk}
        onPointerOver={(e) => {
          e.stopPropagation()
          hoverOn(true)
          gl.domElement.style.cursor = 'pointer'
        }}
        onPointerOut={() => {
          hoverOn(false)
          gl.domElement.style.cursor = 'grab'
        }}
      >
        <boxGeometry args={[1.8, 2.8, 1.8]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
      {eatingUI && !say && <EatBar fill={eatFill} label={eatingLabel} y={2.7} />}
      <Html position={[0, 2.35, 0]} zIndexRange={[18, 8]}>
        {say ? (
          <div className="mc-speech pointer-events-none">
            <div className="mc-speech-name">{name}</div>
            {say}
          </div>
        ) : eatingUI ? null : (
          // tombol 💬 selalu tampil di atas kepala → gampang diketuk
          <button
            className={`mc-talkbtn ${hover ? 'is-hot' : ''}`}
            onClick={talk}
            onPointerEnter={() => hoverOn(true)}
            onPointerLeave={() => hoverOn(false)}
            aria-label={name}
          >
            💬{hover && <span className="ml-1">{name}</span>}
          </button>
        )}
      </Html>
    </group>
  )
}

export function Villagers({ world, playerRef, consumed, villagers, sound, onTalk, onApproach, eatLine, eatingLabel }) {
  return VILLAGERS.map((look, i) => (
    <Villager
      key={i}
      world={world}
      look={look}
      seed={i + 1}
      playerRef={playerRef}
      consumed={consumed}
      name={villagers[i].name}
      lines={villagers[i].lines}
      sound={sound}
      onTalk={onTalk}
      onApproach={onApproach}
      eatLine={eatLine}
      eatingLabel={eatingLabel}
    />
  ))
}
