import { useMemo, useRef, useState } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import * as THREE from 'three'
import { rng } from './noise'
import { typeSound } from '../sound'
import { WARUNG_SEATS } from './People'

// =====================================================================
//  Kehidupan di dunia: hewan, kapal di laut, dan garis angin
//  (semua model dibuat dari kotak, desain sendiri)
// =====================================================================

const box = new THREE.BoxGeometry(1, 1, 1)
const matCache = {}
const mat = (c) => (matCache[c] ||= new THREE.MeshLambertMaterial({ color: c }))

function Part({ p, s, c, ...rest }) {
  return <mesh geometry={box} material={mat(c)} position={p} scale={s} castShadow {...rest} />
}

// ——— model hewan: [badan, kepala, kaki, detail] ———
const SPECIES = {
  sheep: {
    speed: 0.8, legH: 0.42, sound: { id: 'Mbeeek!', en: 'Baaa!' },
    body: { s: [0.75, 0.6, 1.05], c: '#eceeee' },
    head: { s: [0.42, 0.42, 0.42], c: '#d9c3a5', z: 0.62, y: 0.12 },
    leg: '#8a8a8a',
    extra: [{ p: [0, 0.3, 0.62], s: [0.46, 0.18, 0.3], c: '#eceeee' }],
    eyes: '#2b1d14',
  },
  pig: {
    speed: 0.9, legH: 0.3, sound: { id: 'Ngok ngok!', en: 'Oink oink!' },
    body: { s: [0.65, 0.55, 0.95], c: '#f2a8b1' },
    head: { s: [0.48, 0.45, 0.45], c: '#f2a8b1', z: 0.62, y: 0.04 },
    leg: '#e8939e',
    extra: [{ p: [0, -0.02, 0.88], s: [0.24, 0.16, 0.06], c: '#e07f8a' }],
    eyes: '#2b1d14',
  },
  cow: {
    speed: 0.7, legH: 0.5, sound: { id: 'Mooo!', en: 'Mooo!' },
    body: { s: [0.8, 0.7, 1.3], c: '#5a3d27' },
    head: { s: [0.5, 0.5, 0.42], c: '#5a3d27', z: 0.82, y: 0.14 },
    leg: '#3e2a1b',
    extra: [
      { p: [0.18, 0.22, 0.1], s: [0.46, 0.28, 0.5], c: '#f2f2f2' },
      { p: [0, 0.02, 1.06], s: [0.34, 0.2, 0.08], c: '#e8c4a8' },
      { p: [0.3, 0.46, 0.82], s: [0.1, 0.14, 0.1], c: '#e8e2cf' },
      { p: [-0.3, 0.46, 0.82], s: [0.1, 0.14, 0.1], c: '#e8e2cf' },
    ],
    eyes: '#1b1410',
  },
  chicken: {
    speed: 1.1, legH: 0.22, sound: { id: 'Petok petok!', en: 'Cluck cluck!' },
    body: { s: [0.36, 0.34, 0.46], c: '#f4f4f0' },
    head: { s: [0.26, 0.3, 0.24], c: '#f4f4f0', z: 0.24, y: 0.26 },
    leg: '#e8b030',
    extra: [
      { p: [0, 0.48, 0.28], s: [0.08, 0.1, 0.14], c: '#d8312a' },
      { p: [0, 0.3, 0.42], s: [0.12, 0.07, 0.1], c: '#f0a020' },
    ],
    eyes: '#1b1410',
    legW: 0.06,
  },
}

function Animal({ world, kind, home, seed, lang, consumed }) {
  const sp = SPECIES[kind]
  const group = useRef()
  const legs = useRef([])
  const headRef = useRef()
  const r = useMemo(() => rng(seed * 31 + 7), [seed])
  const state = useRef({ target: null, wait: r() * 3, t: r() * 10, graze: 0 })
  const [say, setSay] = useState(null)
  const { gl } = useThree()
  const bodyY = sp.legH + sp.body.s[1] / 2

  const lineClear = (ax, az, bx, bz) => {
    const d = Math.hypot(bx - ax, bz - az)
    const h0 = world.ground(ax, az)
    for (let s = 0.3; s < d; s += 0.3) {
      const x = ax + ((bx - ax) * s) / d
      const z = az + ((bz - az) * s) / d
      if (!world.canWalk(x, z) || Math.abs(world.ground(x, z) - h0) > 1) return false
    }
    return true
  }

  useFrame((_, rawDt) => {
    const g = group.current
    if (!g) return
    const dt = Math.min(rawDt, 0.05)
    const st = state.current
    st.t += dt
    let moving = false
    if (st.target) {
      const dx = st.target[0] - g.position.x
      const dz = st.target[1] - g.position.z
      const d = Math.hypot(dx, dz)
      if (d < 0.1) st.target = null
      else {
        const step = Math.min(d, sp.speed * dt)
        g.position.x += (dx / d) * step
        g.position.z += (dz / d) * step
        let diff = Math.atan2(dx, dz) - g.rotation.y
        diff = Math.atan2(Math.sin(diff), Math.cos(diff))
        g.rotation.y += diff * Math.min(1, dt * 6)
        moving = true
      }
    } else {
      st.wait -= dt
      if (st.wait <= 0) {
        st.wait = 2 + r() * 5
        if (r() < 0.35) st.graze = 2 + r() * 2 // menunduk makan rumput
        else {
          const a = r() * Math.PI * 2
          const dist = 1.5 + r() * 4
          const tx = home[0] + Math.cos(a) * dist
          const tz = home[1] + Math.sin(a) * dist
          if (world.canWalk(tx, tz) && lineClear(g.position.x, g.position.z, tx, tz)) st.target = [tx, tz]
        }
      }
    }
    st.graze = Math.max(0, st.graze - dt)
    // kaki melangkah & kepala menunduk saat makan
    const swing = moving ? Math.sin(st.t * 10) * 0.6 : 0
    legs.current.forEach((l, i) => l && (l.rotation.x = i % 3 === 0 ? swing : -swing))
    if (headRef.current) headRef.current.rotation.x += ((st.graze > 0 ? 0.7 : 0) - headRef.current.rotation.x) * Math.min(1, dt * 5)
    const want = world.ground(g.position.x, g.position.z) + 0.5 + (moving ? Math.abs(Math.sin(st.t * 10)) * 0.03 : 0)
    g.position.y += (want - g.position.y) * Math.min(1, dt * 12)
  })

  const speak = (e) => {
    e.stopPropagation()
    consumed.current = performance.now()
    setSay(sp.sound[lang] || sp.sound.id)
    typeSound()
    state.current.target = null
    state.current.wait = 2
    setTimeout(() => setSay(null), 1800)
  }

  const lw = sp.legW || 0.18
  const lx = sp.body.s[0] / 2 - lw / 2 - 0.02
  const lz = sp.body.s[2] / 2 - lw / 2 - 0.04
  // posisi & arah awal dihitung sekali saja (supaya tidak lompat saat re-render)
  const [start, startRot] = useMemo(() => {
    const rr = rng(seed * 13 + 1)
    return [[home[0] + (rr() - 0.5) * 2, home[1] + (rr() - 0.5) * 2], rr() * Math.PI * 2]
  }, [home, seed])

  return (
    <group
      ref={group}
      position={[start[0], world.ground(start[0], start[1]) + 0.5, start[1]]}
      rotation-y={startRot}
      onClick={speak}
      onPointerOver={() => (gl.domElement.style.cursor = 'pointer')}
      onPointerOut={() => (gl.domElement.style.cursor = 'grab')}
    >
      <Part p={[0, bodyY, 0]} s={sp.body.s} c={sp.body.c} />
      <group ref={headRef} position={[0, bodyY + sp.head.y, sp.head.z - sp.head.s[2] / 2]}>
        <Part p={[0, 0, sp.head.s[2] / 2]} s={sp.head.s} c={sp.head.c} />
        <Part p={[sp.head.s[0] * 0.28, sp.head.s[1] * 0.12, sp.head.s[2] + 0.005]} s={[0.07, 0.07, 0.01]} c={sp.eyes} />
        <Part p={[-sp.head.s[0] * 0.28, sp.head.s[1] * 0.12, sp.head.s[2] + 0.005]} s={[0.07, 0.07, 0.01]} c={sp.eyes} />
      </group>
      {sp.extra.map((x, i) => (
        <Part key={i} p={[x.p[0], bodyY + x.p[1], x.p[2]]} s={x.s} c={x.c} />
      ))}
      {[[lx, lz], [-lx, lz], [lx, -lz], [-lx, -lz]].map(([x, z], i) => (
        <group key={i} ref={(el) => (legs.current[i] = el)} position={[x, sp.legH, z]}>
          <Part p={[0, -sp.legH / 2, 0]} s={[lw, sp.legH, lw]} c={sp.leg} />
        </group>
      ))}
      {say && (
        <Html position={[0, bodyY + 1.1, 0]} zIndexRange={[18, 8]} style={{ pointerEvents: 'none' }}>
          <div className="mc-speech">{say}</div>
        </Html>
      )}
    </group>
  )
}

export function Animals({ world, lang, consumed }) {
  const herd = useMemo(() => {
    const r = rng(404)
    // padang rumput dekat kebun, kolam, dan di antara hutan
    const spots = [
      ['sheep', [-30, 10]], ['sheep', [-31, 13]], ['sheep', [-28, -10]],
      ['pig', [-22, -12]], ['pig', [-20, 14]],
      ['cow', [30, -9]], ['cow', [33, 7]],
      ['chicken', [-24, 6]], ['chicken', [-23, 7]], ['chicken', [20, 6]], ['chicken', [6, -12]],
      ['sheep', [10, 31]], ['cow', [-10, -33]], ['pig', [36, 16]],
    ]
    const ok = []
    for (const [kind, [x, z]] of spots) {
      // geser sedikit sampai ketemu tanah yang bisa dipijak
      for (let tries = 0; tries < 30; tries++) {
        const px = x + (tries ? (r() - 0.5) * 8 : 0)
        const pz = z + (tries ? (r() - 0.5) * 8 : 0)
        if (world.canWalk(px, pz)) {
          ok.push({ kind, home: [px, pz] })
          break
        }
      }
    }
    return ok
  }, [world])
  return herd.map((a, i) => <Animal key={i} world={world} kind={a.kind} home={a.home} seed={i + 1} lang={lang} consumed={consumed} />)
}

// ——— kapal kayu berlayar mengelilingi pulau ———
const SAILOR = { skin: '#c98f6b', hair: '#2e1f17', shirt: '#2b4f8c', pants: '#f2ead3', sleeve: '#f2f2f2' }
const SAILOR2 = { skin: '#e7b48f', hair: '#7a3b1e', shirt: '#f2f2f2', pants: '#2b4f8c', longHair: true }

function Boat({ radius, speed, phase, sail, Person }) {
  const still = useRef(false)
  const ref = useRef()
  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    const a = phase + t * speed
    const g = ref.current
    g.position.set(Math.cos(a) * radius, 0.25 + Math.sin(t * 1.3 + phase) * 0.08, Math.sin(a) * radius)
    g.rotation.y = -a + (speed > 0 ? Math.PI : 0)
    g.rotation.z = Math.sin(t * 1.1 + phase) * 0.05
    g.rotation.x = Math.cos(t * 0.9 + phase) * 0.03
  })
  return (
    <group ref={ref}>
      {/* lambung kapal */}
      <Part p={[0, 0, 0]} s={[1.6, 0.5, 4]} c="#7a5230" />
      <Part p={[0, 0.3, 0]} s={[1.3, 0.2, 3.6]} c="#a8834f" />
      <Part p={[0, 0.2, 2.1]} s={[1, 0.5, 0.4]} c="#6b4423" />
      <Part p={[0, 0.35, -1.9]} s={[1.4, 0.5, 0.3]} c="#6b4423" />
      {/* tiang & layar */}
      <Part p={[0, 2.1, 0.2]} s={[0.14, 3.6, 0.14]} c="#5a3a20" />
      <Part p={[0, 2.3, 0.35]} s={[1.9, 2.2, 0.06]} c={sail} />
      <Part p={[0.35, 4.05, 0.2]} s={[0.6, 0.3, 0.04]} c="#d8312a" />
      {/* awak kapal: juru mudi di buritan + satu di haluan */}
      <Part p={[0, 0.85, -1.35]} s={[0.12, 0.6, 0.12]} c="#5a3a20" />
      <Part p={[0, 1.2, -1.32]} s={[0.6, 0.6, 0.06]} c="#8a5a30" />
      {Person && (
        <>
          <group position={[0, 0.4, -1.75]} scale={0.8}>
            <Person look={SAILOR} moving={still} />
          </group>
          <group position={[0.25, 0.4, 1.3]} rotation-y={0.6} scale={0.8}>
            <Person look={SAILOR2} moving={still} />
          </group>
        </>
      )}
    </group>
  )
}

export function Boats({ Person }) {
  return (
    <>
      <Boat radius={58} speed={0.035} phase={0} sail="#f2ead3" Person={Person} />
      <Boat radius={64} speed={-0.025} phase={2.4} sail="#f2ead3" Person={Person} />
      <Boat radius={61} speed={0.03} phase={4.2} sail="#f08cb4" Person={Person} />
    </>
  )
}

// ——— garis-garis angin tipis yang melintas ———
export function WindStreaks({ center }) {
  // center = ref ke objek yang diikuti (Zafira)
  const COUNT = 14
  const items = useMemo(() => {
    const r = rng(9)
    return Array.from({ length: COUNT }, () => ({ life: r() * 4, r }))
  }, [])
  const refs = useRef([])
  const material = useMemo(
    () => new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide }),
    [],
  )
  const mats = useMemo(() => items.map(() => material.clone()), [items, material])
  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 0.05)
    const c = center.current
    items.forEach((it, i) => {
      const m = refs.current[i]
      if (!m) return
      it.life -= dt
      if (it.life <= 0) {
        // muncul lagi di sekitar kamera
        it.life = 2.5 + it.r() * 2
        it.max = it.life
        const cx = c ? c.position.x : 0
        const cz = c ? c.position.z : 0
        m.position.set(cx - 18 + it.r() * 20, 2 + it.r() * 7, cz - 16 + it.r() * 32)
        m.scale.set(1.5 + it.r() * 2.5, 1, 1)
      }
      m.position.x += dt * 6
      const k = it.max ? it.life / it.max : 0
      mats[i].opacity = Math.sin(k * Math.PI) * 0.35
    })
  })
  return items.map((_, i) => (
    <mesh key={i} ref={(el) => (refs.current[i] = el)} material={mats[i]} rotation-x={-0.7}>
      <planeGeometry args={[1, 0.05]} />
    </mesh>
  ))
}

// ——— Warung mie ayam: meja, bangku, mangkuk berasap, dan penjual ———
function Bowl({ seatIdx, pos, rot }) {
  const ref = useRef()
  const steam = useRef([])
  useFrame(({ clock }) => {
    const busy = WARUNG_SEATS[seatIdx] !== null
    if (ref.current) ref.current.visible = busy
    const t = clock.elapsedTime
    steam.current.forEach((s, i) => {
      if (!s) return
      const k = (t * 0.6 + i / 3) % 1
      s.position.y = 0.15 + k * 0.6
      s.position.x = Math.sin(t * 2 + i) * 0.05
      s.material.opacity = (1 - k) * 0.5
    })
  })
  return (
    <group ref={ref} position={pos} rotation-y={rot} visible={false}>
      <Part p={[0, 0.06, 0]} s={[0.3, 0.12, 0.3]} c="#f4f4f0" />
      <Part p={[0, 0.125, 0]} s={[0.24, 0.02, 0.24]} c="#f0c95a" />
      <Part p={[0.05, 0.14, 0.03]} s={[0.1, 0.03, 0.08]} c="#8a5a30" />
      <Part p={[-0.06, 0.14, -0.05]} s={[0.06, 0.02, 0.06]} c="#4f9a3a" />
      {[0, 1, 2].map((i) => (
        <mesh key={i} ref={(el) => (steam.current[i] = el)} position={[0, 0.2, 0]}>
          <boxGeometry args={[0.07, 0.07, 0.07]} />
          <meshBasicMaterial color="#ffffff" transparent opacity={0.4} depthWrite={false} />
        </mesh>
      ))}
    </group>
  )
}

// ——— gerobak mie ayam (kayu, roda, etalase kaca, panci berasap) ———
function Gerobak({ w, text, DoorSign }) {
  const [cx, cz] = w.tf(0, 1)
  const steam = useRef([])
  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    steam.current.forEach((s, i) => {
      if (!s) return
      const k = (t * 0.5 + i / 4) % 1
      s.position.y = 2.25 + k * 0.9
      s.position.x = 0.6 + Math.sin(t * 1.5 + i) * 0.08
      s.material.opacity = (1 - k) * 0.45
    })
  })
  const wheel = useMemo(() => {
    const g = new THREE.CylinderGeometry(0.36, 0.36, 0.12, 12)
    g.rotateZ(Math.PI / 2)
    return g
  }, [])
  const glass = useMemo(
    () => new THREE.MeshLambertMaterial({ color: '#cfe8f5', transparent: true, opacity: 0.35, depthWrite: false }),
    [],
  )
  return (
    <group position={[cx, 0.5, cz]} rotation-y={w.rot}>
      {/* roda */}
      {[-0.98, 0.98].map((x) => (
        <group key={x}>
          <mesh geometry={wheel} material={mat('#2b2b2b')} position={[x, 0.36, 0.1]} castShadow />
          <Part p={[x, 0.36, 0.1]} s={[0.14, 0.14, 0.14]} c="#8a8a8a" />
        </group>
      ))}
      {/* badan gerobak */}
      <Part p={[0, 0.9, 0]} s={[1.8, 0.7, 0.95]} c="#c0392b" />
      <Part p={[0, 1.27, 0]} s={[1.9, 0.06, 1.05]} c="#a8834f" />
      <Part p={[0, 0.58, -0.49]} s={[1.8, 0.06, 0.02]} c="#f2f2f2" />
      {/* etalase kaca + isinya */}
      <mesh position={[0, 1.6, 0]} material={glass}>
        <boxGeometry args={[1.7, 0.6, 0.85]} />
      </mesh>
      {[[-0.86, -0.43], [0.86, -0.43], [-0.86, 0.43], [0.86, 0.43]].map(([x, z], i) => (
        <Part key={i} p={[x, 1.6, z]} s={[0.05, 0.6, 0.05]} c="#6b4423" />
      ))}
      <Part p={[0, 1.93, 0]} s={[1.9, 0.06, 1.0]} c="#a8834f" />
      <Part p={[-0.45, 1.38, 0]} s={[0.5, 0.16, 0.4]} c="#f0c95a" />
      <Part p={[0.05, 1.36, 0.05]} s={[0.3, 0.12, 0.3]} c="#8a5a30" />
      {[0, 1, 2].map((i) => (
        <Part key={i} p={[0.55, 1.34 + i * 0.09, 0]} s={[0.32, 0.07, 0.32]} c="#f4f4f0" />
      ))}
      {/* panci di atas */}
      <Part p={[0.6, 2.1, 0.1]} s={[0.5, 0.32, 0.5]} c="#9a9a9a" />
      <Part p={[0.6, 2.28, 0.1]} s={[0.54, 0.04, 0.54]} c="#7a7a7a" />
      {[0, 1, 2, 3].map((i) => (
        <mesh key={i} ref={(el) => (steam.current[i] = el)} position={[0.6, 2.3, 0.1]}>
          <boxGeometry args={[0.1, 0.1, 0.1]} />
          <meshBasicMaterial color="#ffffff" transparent opacity={0.4} depthWrite={false} />
        </mesh>
      ))}
      {/* pegangan dorong (ke arah penjual) & kaki depan */}
      {[-0.7, 0.7].map((x) => (
        <Part key={x} p={[x, 1.05, 0.85]} s={[0.07, 0.07, 0.8]} c="#6b4423" />
      ))}
      <Part p={[0, 0.3, -0.35]} s={[0.12, 0.6, 0.12]} c="#6b4423" />
      {/* tulisan MIE AYAM di depan gerobak */}
      <DoorSign pos={[0, 0.92, -0.5]} rot={Math.PI} text={text} width={1.6} />
    </group>
  )
}

export function Warung({ w, t, consumed, Person, DoorSign, onOrder }) {
  const [say, setSay] = useState(null)
  const idx = useRef(0)
  const { gl } = useThree()
  const [tx, tz] = w.table
  const [sx, sz] = w.seller
  const benchCenter = w.tf(0, -2)
  const sellerLook = useMemo(
    () => ({ skin: '#d9a07a', hair: '#2e1f17', shirt: '#f2f2f2', pants: '#3b3b3b', apron: '#d8312a' }),
    [],
  )
  const still = useRef(false)

  const talk = (e) => {
    e.stopPropagation()
    consumed.current = performance.now()
    setSay(t.warung.lines[idx.current % t.warung.lines.length])
    idx.current += 1
    typeSound()
    setTimeout(() => setSay(null), 4000)
    onOrder() // Zafira ikut pesan & makan
  }

  return (
    <>
      {/* meja panjang */}
      <group position={[tx, 0.5, tz]} rotation-y={w.rot}>
        <Part p={[0, 0.72, 0]} s={[3, 0.1, 0.8]} c="#8a5a30" />
        {[[-1.35, -0.3], [1.35, -0.3], [-1.35, 0.3], [1.35, 0.3]].map(([x, z], i) => (
          <Part key={i} p={[x, 0.34, z]} s={[0.1, 0.68, 0.1]} c="#6b4423" />
        ))}
      </group>
      {/* bangku */}
      <group position={[benchCenter[0], 0.5, benchCenter[1]]} rotation-y={w.rot}>
        <Part p={[0, 0.38, -0.05]} s={[3, 0.08, 0.4]} c="#a8834f" />
        {[-1.3, 1.3].map((x) => (
          <Part key={x} p={[x, 0.17, -0.05]} s={[0.1, 0.34, 0.3]} c="#7a5230" />
        ))}
      </group>
      {/* mangkuk mie ayam di depan tiap kursi */}
      {w.seats.map((_, i) => {
        const [bx, bz] = w.tf(i - 1, -1.2)
        return <Bowl key={i} seatIdx={i} pos={[bx, 0.5 + 0.77, bz]} rot={w.rot} />
      })}
      {/* penjual di balik gerobak */}
      <group
        position={[sx, 0.5, sz]}
        rotation-y={w.rot + Math.PI}
        scale={0.92}
        onClick={talk}
        onPointerOver={() => (gl.domElement.style.cursor = 'pointer')}
        onPointerOut={() => (gl.domElement.style.cursor = 'grab')}
      >
        <Person look={sellerLook} moving={still} />
        <mesh position={[0, 1, 0]} onClick={talk}>
          <boxGeometry args={[1.4, 2.4, 1.4]} />
          <meshBasicMaterial transparent opacity={0} depthWrite={false} />
        </mesh>
        <Html position={[0, 2.4, 0]} zIndexRange={[18, 8]}>
          {say ? (
            <div className="mc-speech pointer-events-none">
              <div className="mc-speech-name">{t.warung.seller}</div>
              {say}
            </div>
          ) : (
            <button className="mc-talkbtn" onClick={talk} aria-label={t.warung.seller}>
              💬
            </button>
          )}
        </Html>
      </group>
      <Gerobak w={w} text={t.warung.cartText} DoorSign={DoorSign} />
    </>
  )
}

// ——— Puskesmas: monitor EKG bergerak + Perawat Zulfa ———
function ecgTexture() {
  const c = document.createElement('canvas')
  c.width = 256
  c.height = 96
  const g = c.getContext('2d')
  g.fillStyle = '#081a10'
  g.fillRect(0, 0, 256, 96)
  g.strokeStyle = 'rgba(80,255,120,0.12)'
  for (let x = 0; x < 256; x += 16) g.strokeRect(x, 0, 16, 96)
  // satu detak: garis datar → P → QRS tajam → T
  g.strokeStyle = '#5dff7a'
  g.lineWidth = 4
  g.beginPath()
  const base = 60
  const pts = [[0, base], [40, base], [52, base - 8], [64, base], [78, base], [86, base + 10], [96, 10], [106, base + 22], [114, base], [140, base], [158, base - 14], [176, base], [256, base]]
  pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)))
  g.stroke()
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  t.wrapS = THREE.RepeatWrapping
  t.repeat.set(1.5, 1)
  return t
}

const NURSE = { skin: '#e7b48f', hair: '#2e1f17', shirt: '#f4f6f8', sleeve: '#f4f6f8', pants: '#f4f6f8', longHair: true, cheeks: '#e89a86' }

export function Clinic({ c, name, consumed, Person, onNurse, label }) {
  const tex = useMemo(ecgTexture, [])
  const still = useRef(false)
  const [hover, setHover] = useState(false)
  const { gl } = useThree()
  useFrame((_, dt) => {
    tex.offset.x = (tex.offset.x + dt * 0.35) % 1
  })
  const [mx, mz] = c.monitor
  const [nx, nz] = c.nurse
  const talk = (e) => {
    e.stopPropagation()
    consumed.current = performance.now()
    onNurse(c.visitor, c.nurse)
  }
  return (
    <>
      {/* monitor EKG di dinding depan */}
      <group position={[mx, 2.1, mz]} rotation-y={c.rot + Math.PI}>
        <Part p={[0, 0, -0.04]} s={[1.5, 0.75, 0.08]} c="#2b2b2b" />
        <mesh position={[0, 0, 0.005]}>
          <planeGeometry args={[1.32, 0.6]} />
          <meshBasicMaterial map={tex} toneMapped={false} />
        </mesh>
      </group>
      {/* Perawat Zulfa */}
      <group
        position={[nx, 0.5, nz]}
        rotation-y={c.rot + Math.PI}
        scale={0.88}
        onClick={talk}
        onPointerOver={() => (gl.domElement.style.cursor = 'pointer')}
        onPointerOut={() => (gl.domElement.style.cursor = 'grab')}
      >
        <Person look={NURSE} moving={still}>
          {/* topi perawat dengan palang merah */}
          <Part p={[0, 2.05, 0.02]} s={[0.42, 0.12, 0.36]} c="#ffffff" />
          <Part p={[0, 2.06, 0.21]} s={[0.08, 0.08, 0.01]} c="#d8312a" />
          <Part p={[0, 2.06, 0.21]} s={[0.2, 0.03, 0.01]} c="#d8312a" />
        </Person>
        <mesh position={[0, 1, 0]} onClick={talk}>
          <boxGeometry args={[1.4, 2.4, 1.4]} />
          <meshBasicMaterial transparent opacity={0} depthWrite={false} />
        </mesh>
        <Html position={[0, 2.45, 0]} zIndexRange={[18, 8]}>
          <button
            className={`mc-talkbtn ${hover ? 'is-hot' : ''}`}
            onClick={talk}
            onPointerEnter={() => setHover(true)}
            onPointerLeave={() => setHover(false)}
            aria-label={name}
          >
            💬{hover && <span className="ml-1">{name}</span>}
          </button>
        </Html>
      </group>
    </>
  )
}

// ——— Studio foto: Zahra si fotografer, kamera di tripod, lampu softbox ———
const PHOTOGRAPHER = { skin: '#e7b48f', hair: '#3b2a1d', shirt: '#2b2b2b', sleeve: '#2b2b2b', pants: '#c9b48a', longHair: true, cheeks: '#e89a86' }

export function Studio({ s, name, consumed, Person, onPhotographer }) {
  const still = useRef(false)
  const [hover, setHover] = useState(false)
  const { gl } = useThree()
  const [px, pz] = s.photographer
  const [tx, tz] = s.tripod
  const [bx, bz] = s.softbox
  // kamera tripod menghadap tempat Zafira berdiri
  const camRot = Math.atan2(s.visitor[0] - tx, s.visitor[1] - tz)
  const talk = (e) => {
    e.stopPropagation()
    consumed.current = performance.now()
    onPhotographer(s.visitor, s.tripod)
  }
  return (
    <>
      {/* tripod + kamera */}
      <group position={[tx, 0.5, tz]} rotation-y={camRot}>
        {[0, 2.1, 4.2].map((a) => (
          <Part
            key={a}
            p={[Math.sin(a) * 0.22, 0.6, Math.cos(a) * 0.22]}
            s={[0.05, 1.25, 0.05]}
            c="#3a3a3a"
            rotation={[Math.cos(a) * 0.3, 0, -Math.sin(a) * 0.3]}
          />
        ))}
        <Part p={[0, 1.32, 0]} s={[0.45, 0.32, 0.26]} c="#1d1d21" />
        <Part p={[0, 1.32, 0.2]} s={[0.2, 0.2, 0.18]} c="#4a4a4a" />
        <Part p={[0, 1.32, 0.3]} s={[0.14, 0.14, 0.02]} c="#6fb6e8" />
        <Part p={[-0.12, 1.53, 0]} s={[0.12, 0.08, 0.12]} c="#e0e0e0" />
      </group>
      {/* lampu softbox */}
      <group position={[bx, 0.5, bz]} rotation-y={camRot + 0.5}>
        <Part p={[0, 0.9, 0]} s={[0.06, 1.8, 0.06]} c="#3a3a3a" />
        <Part p={[0, 1.95, 0]} s={[0.8, 0.8, 0.3]} c="#2b2b2b" />
        <mesh position={[0, 1.95, 0.16]}>
          <planeGeometry args={[0.7, 0.7]} />
          <meshBasicMaterial color="#fffbe8" />
        </mesh>
      </group>
      {/* Zahra si fotografer */}
      <group
        position={[px, 0.5, pz]}
        rotation-y={s.rot + Math.PI - 0.4}
        scale={0.88}
        onClick={talk}
        onPointerOver={() => (gl.domElement.style.cursor = 'pointer')}
        onPointerOut={() => (gl.domElement.style.cursor = 'grab')}
      >
        <Person look={PHOTOGRAPHER} moving={still}>
          {/* kamera tergantung di leher */}
          <Part p={[0, 1.05, 0.2]} s={[0.26, 0.18, 0.12]} c="#1d1d21" />
          <Part p={[0, 1.05, 0.28]} s={[0.1, 0.1, 0.06]} c="#6fb6e8" />
        </Person>
        <mesh position={[0, 1, 0]} onClick={talk}>
          <boxGeometry args={[1.4, 2.4, 1.4]} />
          <meshBasicMaterial transparent opacity={0} depthWrite={false} />
        </mesh>
        <Html position={[0, 2.45, 0]} zIndexRange={[18, 8]}>
          <button
            className={`mc-talkbtn ${hover ? 'is-hot' : ''}`}
            onClick={talk}
            onPointerEnter={() => setHover(true)}
            onPointerLeave={() => setHover(false)}
            aria-label={name}
          >
            💬 <span className="ml-1">{name}</span>
          </button>
        </Html>
      </group>
    </>
  )
}

// ——— perahu dayung di dermaga (dipakai Zafira untuk keliling pulau) ———
// posisi perahu diperbarui oleh Player saat sedang naik
export const ROWBOAT = { x: 0, z: 0, rot: 0, riding: false, ready: false }

export function RowBoat({ dock, onBoard, consumed, label }) {
  const ref = useRef()
  const oars = useRef([])
  const { gl } = useThree()
  const [hover, setHover] = useState(false)
  useFrame(({ clock }) => {
    const g = ref.current
    if (!g) return
    if (!ROWBOAT.ready) {
      ROWBOAT.x = dock.boatDock[0]
      ROWBOAT.z = dock.boatDock[1]
      ROWBOAT.rot = dock.heading + Math.PI / 2
      ROWBOAT.ready = true
    }
    const t = clock.elapsedTime
    g.position.set(ROWBOAT.x, 0.28 + Math.sin(t * 1.6) * 0.05, ROWBOAT.z)
    g.rotation.set(Math.cos(t * 1.2) * 0.03, ROWBOAT.rot, Math.sin(t * 1.4) * 0.04)
    // dayung bergerak saat sedang dipakai
    oars.current.forEach((o, i) => o && (o.rotation.x = ROWBOAT.riding && ROWBOAT.sailing ? Math.sin(t * 5) * 0.6 : 0.2 * (i ? 1 : -1)))
  })
  const board = (e) => {
    e.stopPropagation()
    consumed.current = performance.now()
    onBoard()
  }
  return (
    <group
      ref={ref}
      onClick={board}
      onPointerOver={() => (gl.domElement.style.cursor = 'pointer')}
      onPointerOut={() => (gl.domElement.style.cursor = 'grab')}
    >
      <Part p={[0, 0, 0]} s={[1.1, 0.35, 2.6]} c="#8a5a30" />
      <Part p={[0, 0.18, 0]} s={[0.9, 0.06, 2.3]} c="#b08a53" />
      <Part p={[0, 0.25, -1.25]} s={[0.7, 0.3, 0.2]} c="#6b4423" />
      <Part p={[0, 0.25, 1.2]} s={[0.9, 0.3, 0.2]} c="#6b4423" />
      <Part p={[0, 0.3, 0.2]} s={[1.0, 0.08, 0.3]} c="#6b4423" />
      {[-1, 1].map((s, i) => (
        <group key={s} ref={(el) => (oars.current[i] = el)} position={[s * 0.6, 0.35, 0.2]}>
          <Part p={[s * 0.5, -0.1, 0]} s={[1.1, 0.06, 0.06]} c="#a8834f" rotation={[0, 0, s * -0.35]} />
          <Part p={[s * 1.05, -0.32, 0]} s={[0.12, 0.25, 0.04]} c="#a8834f" />
        </group>
      ))}
      <mesh position={[0, 0.5, 0]}>
        <boxGeometry args={[1.8, 1.6, 3]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
      <Html position={[0, 1.4, 0]} zIndexRange={[18, 8]}>
        <button
          className={`mc-talkbtn ${hover ? 'is-hot' : ''}`}
          onClick={board}
          onPointerEnter={() => setHover(true)}
          onPointerLeave={() => setHover(false)}
        >
          ⛵ <span className="ml-1">{label}</span>
        </button>
      </Html>
    </group>
  )
}

// ——— pemancing di ujung dermaga ———
const FISHER = { skin: '#c98f6b', hair: '#5b3a22', shirt: '#4f7a9a', pants: '#3b3b3b', sleeve: '#4f7a9a' }

export function Fisherman({ dock, t, consumed, Person }) {
  const pose = useRef({ legs: -Math.PI / 2, fishing: true })
  const still = useRef(false)
  const bob = useRef()
  const fish = useRef()
  const [say, setSay] = useState(null)
  const idx = useRef(0)
  const { gl } = useThree()
  const [fx, fz] = dock.fisher
  const [bx, bz] = dock.bobber
  const catchT = useRef(6)
  useFrame(({ clock }, dt) => {
    const time = clock.elapsedTime
    catchT.current -= dt
    // pelampung naik-turun; menjelang dapat ikan, pelampung tenggelam
    const dip = catchT.current < 1.2 && catchT.current > 0 ? -0.25 : 0
    if (bob.current) bob.current.position.y = 0.35 + Math.sin(time * 2) * 0.04 + dip
    if (fish.current) {
      if (catchT.current <= 0 && catchT.current > -1.2) {
        const k = -catchT.current / 1.2
        fish.current.visible = true
        fish.current.position.set(bx, 0.3 + Math.sin(k * Math.PI) * 1.8, bz)
        fish.current.rotation.z = k * 6
      } else fish.current.visible = false
    }
    if (catchT.current <= -1.2) {
      catchT.current = 8 + Math.random() * 8
      setSay(t.fisher.catch)
      setTimeout(() => setSay(null), 2200)
    }
  })
  const talk = (e) => {
    e.stopPropagation()
    consumed.current = performance.now()
    setSay(t.fisher.lines[idx.current % t.fisher.lines.length])
    idx.current += 1
    typeSound()
    setTimeout(() => setSay(null), 3500)
  }
  // joran dari tangan ke arah pelampung
  return (
    <>
      <group
        position={[fx, 0.5 - 0.56, fz]}
        rotation-y={dock.heading}
        scale={0.9}
        onClick={talk}
        onPointerOver={() => (gl.domElement.style.cursor = 'pointer')}
        onPointerOut={() => (gl.domElement.style.cursor = 'grab')}
      >
        <Person look={FISHER} moving={still} pose={pose}>
          {/* topi */}
          <Part p={[0, 2.03, 0]} s={[0.6, 0.06, 0.6]} c="#c9b48a" />
          <Part p={[0, 2.12, 0]} s={[0.4, 0.14, 0.4]} c="#c9b48a" />
        </Person>
        {/* joran */}
        <Part p={[0, 1.55, 1.4]} s={[0.05, 0.05, 2.6]} c="#6b4423" rotation={[-0.45, 0, 0]} />
        <mesh position={[0, 0.75, 2.75]}>
          <boxGeometry args={[0.01, 1.7, 0.01]} />
          <meshBasicMaterial color="#e8e8e8" />
        </mesh>
        <mesh position={[0, 1.2, 0]} onClick={talk}>
          <boxGeometry args={[1.2, 2.2, 1.2]} />
          <meshBasicMaterial transparent opacity={0} depthWrite={false} />
        </mesh>
        <Html position={[0, 2.5, 0]} zIndexRange={[18, 8]} style={{ pointerEvents: 'none' }}>
          {say ? (
            <div className="mc-speech">
              <div className="mc-speech-name">{t.fisher.name}</div>
              {say}
            </div>
          ) : null}
        </Html>
      </group>
      <mesh ref={bob} position={[bx, 0.35, bz]}>
        <boxGeometry args={[0.16, 0.16, 0.16]} />
        <meshLambertMaterial color="#d8312a" />
      </mesh>
      <group ref={fish} visible={false}>
        <Part p={[0, 0, 0]} s={[0.12, 0.22, 0.45]} c="#f08a3c" />
        <Part p={[0, 0, -0.28]} s={[0.04, 0.22, 0.14]} c="#e06a20" />
      </group>
    </>
  )
}

// ——— petani bercaping memanen padi di sawah ———
const FARMER = { skin: '#b97d55', hair: '#2e1f17', shirt: '#6f8f3a', pants: '#4a3a24', sleeve: '#6f8f3a' }

export function Farmer({ farm, t, consumed, Person }) {
  const group = useRef()
  const moving = useRef(false)
  const pose = useRef({ legs: null, harvest: false })
  const [say, setSay] = useState(null)
  const idx = useRef(0)
  const { gl } = useThree()
  // jalur kerja: baris kiri & kanan saluran air, menyeberang lewat pematang
  const route = useMemo(() => {
    const { x, z, half } = farm
    const L = x - 2
    const R = x + 2
    return [[L, z - half + 0.5], [L, z + half - 0.5], [x, z + half + 1], [R, z + half - 0.5], [R, z - half + 0.5], [x, z - half - 1]]
  }, [farm])
  const st = useRef({ i: 0, work: 0 })
  useFrame((_, rawDt) => {
    const g = group.current
    if (!g) return
    const dt = Math.min(rawDt, 0.05)
    const s = st.current
    if (say) {
      moving.current = false
      pose.current.harvest = false
      return
    }
    if (s.work > 0) {
      s.work -= dt
      moving.current = false
      pose.current.harvest = true
      return
    }
    pose.current.harvest = false
    const [tx, tz] = route[s.i]
    const dx = tx - g.position.x
    const dz = tz - g.position.z
    const d = Math.hypot(dx, dz)
    if (d < 0.1) {
      s.i = (s.i + 1) % route.length
      return
    }
    const step = Math.min(d, 1.1 * dt)
    g.position.x += (dx / d) * step
    g.position.z += (dz / d) * step
    g.rotation.y = Math.atan2(dx, dz)
    moving.current = true
    // sesekali berhenti memanen
    if (Math.random() < dt * 0.35) s.work = 2 + Math.random() * 2
  })
  const talk = (e) => {
    e.stopPropagation()
    consumed.current = performance.now()
    setSay(t.farmer.lines[idx.current % t.farmer.lines.length])
    idx.current += 1
    typeSound()
    setTimeout(() => setSay(null), 3500)
  }
  return (
    <group
      ref={group}
      position={[route[0][0], 0.5, route[0][1]]}
      scale={0.9}
      onClick={talk}
      onPointerOver={() => (gl.domElement.style.cursor = 'pointer')}
      onPointerOut={() => (gl.domElement.style.cursor = 'grab')}
    >
      <Person look={FARMER} moving={moving} pose={pose}>
        {/* caping (topi kerucut) */}
        <mesh position={[0, 2.12, 0]} castShadow>
          <coneGeometry args={[0.62, 0.32, 8]} />
          <meshLambertMaterial color="#d9b878" />
        </mesh>
      </Person>
      <mesh position={[0, 1.1, 0]} onClick={talk}>
        <boxGeometry args={[1.2, 2.2, 1.2]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
      <Html position={[0, 2.5, 0]} zIndexRange={[18, 8]} style={{ pointerEvents: 'none' }}>
        {say ? (
          <div className="mc-speech">
            <div className="mc-speech-name">{t.farmer.name}</div>
            {say}
          </div>
        ) : null}
      </Html>
    </group>
  )
}
