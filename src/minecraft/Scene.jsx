import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { Billboard, Html, OrbitControls } from '@react-three/drei'
import * as THREE from 'three'
import { generateWorld } from './world'
import { Blocks, Plants } from './Blocks'
import { Player, Villagers } from './People'
import { repeatTexture, CUTAWAY, WIND } from './textures'
import { Animals, Boats, WindStreaks, Warung, Clinic, Studio, RowBoat, Fisherman, Farmer } from './Life'
import { Person } from './Person'
import { useMultiplayer, Peers } from './Multiplayer'
import { rng } from './noise'
import { describe, timeAgo } from './github'

// ——— Papan nama kayu yang menempel di atas pintu ———
function drawSign(canvas, text) {
  const g = canvas.getContext('2d')
  const W = canvas.width
  const H = canvas.height
  g.fillStyle = '#a8834f'
  g.fillRect(0, 0, W, H)
  // serat kayu
  for (let y = 0; y < H; y += 8) {
    g.fillStyle = y % 16 ? '#9c784a' : '#b08a53'
    g.fillRect(0, y, W, 3)
  }
  g.strokeStyle = '#5a3a20'
  g.lineWidth = 8
  g.strokeRect(4, 4, W - 8, H - 8)
  g.fillStyle = '#3a2410'
  g.textAlign = 'center'
  g.textBaseline = 'middle'
  let size = 30
  do {
    g.font = `${size}px "Press Start 2P"`
    size -= 2
  } while (g.measureText(text).width > W - 40 && size > 10)
  g.fillText(text, W / 2, H / 2 + 2)
}

export function DoorSign({ pos, rot, text, width = 4.2 }) {
  const canvas = useMemo(() => {
    const c = document.createElement('canvas')
    c.width = 384
    c.height = 96
    return c
  }, [])
  const tex = useMemo(() => {
    const x = new THREE.CanvasTexture(canvas)
    x.colorSpace = THREE.SRGBColorSpace
    x.anisotropy = 4
    return x
  }, [canvas])
  useEffect(() => {
    let alive = true
    drawSign(canvas, text)
    tex.needsUpdate = true
    document.fonts
      .load('30px "Press Start 2P"')
      .catch(() => {})
      .then(() => {
        if (!alive) return
        drawSign(canvas, text)
        tex.needsUpdate = true
      })
    return () => {
      alive = false
    }
  }, [canvas, tex, text])
  return (
    <group position={pos} rotation-y={rot}>
      <mesh position={[0, 0, 0.045]}>
        <planeGeometry args={[width, width / 4]} />
        <meshLambertMaterial map={tex} />
      </mesh>
      <mesh castShadow>
        <boxGeometry args={[width + 0.08, width / 4 + 0.08, 0.08]} />
        <meshLambertMaterial color="#5a3a20" />
      </mesh>
    </group>
  )
}

// ——— papan nama besar di atas atap (dua sisi, ditopang 2 tiang kayu) ———
// tinggi papan & panjang tiang dihitung dari bentuk atap supaya tiang selalu menempel
function RoofSign({ world, x: cx, z: cz, half, door, outside, text, width = 6.5, lift = 0.5 }) {
  const fx = outside[0] - door[0]
  const fz = outside[1] - door[1]
  const rot = Math.atan2(fx, fz)
  const h = width / 4
  // papan ditaruh di bagian depan atap (bukan di tengah) supaya tidak menabrak cerobong/bendera
  const fl = Math.hypot(fx, fz) || 1
  const x = cx + (fx / fl) * (half - 0.5)
  const z = cz + (fz / fl) * (half - 0.5)
  const { bottom, posts } = useMemo(() => {
    const topAt = (wx, wz) => {
      for (let y = 24; y >= -1; y--) if (world.blockAt(Math.round(wx), y, Math.round(wz))) return y + 0.5
      return 0.5
    }
    // titik di sepanjang papan (sumbu x lokal papan → dunia)
    const at = (lx) => [x + Math.cos(rot) * lx, z - Math.sin(rot) * lx]
    let max = 0
    for (let lx = -width / 2; lx <= width / 2; lx += 0.5) max = Math.max(max, topAt(...at(lx)))
    const b = max + lift
    const px = width / 2 - 0.5
    return { bottom: b, posts: [-px, px].map((lx) => ({ lx, top: topAt(...at(lx)) })) }
  }, [world, x, z, rot, width])
  const y = bottom + h / 2
  return (
    <group position={[x, 0, z]} rotation-y={rot}>
      {posts.map((p) => (
        <mesh key={p.lx} position={[p.lx, (p.top + bottom) / 2, 0]} castShadow>
          <boxGeometry args={[0.18, bottom - p.top + 0.1, 0.18]} />
          <meshLambertMaterial color="#5a3a20" />
        </mesh>
      ))}
      {/* depan & belakang sama-sama ada tulisan */}
      <DoorSign pos={[0, y, 0.05]} rot={0} text={text} width={width} />
      <DoorSign pos={[0, y, -0.05]} rot={Math.PI} text={text} width={width} />
    </group>
  )
}

// ——— Bangunan yang bisa diklik: kotak tak terlihat + garis seleksi + papan nama ———
function Station({ s, label, hovered, onHover, onSelect, consumed }) {
  const size = s.half * 2 + 1
  const h = s.height + 1
  const edges = useMemo(() => new THREE.EdgesGeometry(new THREE.BoxGeometry(size + 0.06, h + 0.06, size + 0.06)), [size, h])
  return (
    <group position={[s.x, h / 2 - 0.5, s.z]}>
      <mesh
        onPointerOver={(e) => {
          e.stopPropagation()
          onHover(s.id)
        }}
        onPointerOut={() => onHover(null)}
        onClick={(e) => {
          e.stopPropagation()
          if (e.delta > 6) return // itu geser kamera, bukan klik
          consumed.current = performance.now()
          onSelect(s.id)
        }}
      >
        <boxGeometry args={[size, h, size]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
      {hovered && (
        <lineSegments geometry={edges}>
          <lineBasicMaterial color="#141414" />
        </lineSegments>
      )}
      {/* hanya tempat game yang pakai label melayang; bangunan lain pakai papan di pintu */}
      {s.game && (
        <Html position={[0, h / 2 + 1.4, 0]} center zIndexRange={[15, 5]}>
          <button
            className={`mc-nametag ${hovered ? 'is-hot' : ''}`}
            onClick={() => onSelect(s.id)}
            onPointerEnter={() => onHover(s.id)}
            onPointerLeave={() => onHover(null)}
          >
            {label}
          </button>
        </Html>
      )}
    </group>
  )
}

// ——— Meja di dalam tiap bangunan: kertas berisi konten + lilin ———
const paperTex = (() => {
  let t
  return () => {
    if (t) return t
    const c = document.createElement('canvas')
    c.width = 16
    c.height = 16
    const g = c.getContext('2d')
    g.fillStyle = '#f2ead3'
    g.fillRect(0, 0, 16, 16)
    g.fillStyle = '#8a7a5a'
    for (let y = 3; y < 15; y += 2) g.fillRect(2, y, y % 4 === 1 ? 9 : 12, 1)
    g.fillStyle = '#b02e26'
    g.fillRect(2, 1, 6, 1)
    t = new THREE.CanvasTexture(c)
    t.magFilter = THREE.NearestFilter
    t.colorSpace = THREE.SRGBColorSpace
    return t
  }
})()

function Desk({ s, lit, onPaper, consumed }) {
  const fx = s.outside[0] - s.door[0]
  const fz = s.outside[1] - s.door[1]
  const rot = Math.atan2(fx, fz)
  const flame = useRef()
  const paper = useRef()
  const { gl } = useThree()
  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    if (flame.current) flame.current.scale.y = 1 + Math.sin(t * 12) * 0.15
    if (paper.current) {
      // kertas berkedip pelan & sedikit melayang saat bisa diklik
      paper.current.material.emissiveIntensity = lit ? 0.25 + Math.sin(t * 4) * 0.2 : 0
      paper.current.position.y = lit ? 0.8 + Math.sin(t * 3) * 0.015 : 0.78
    }
  })
  return (
    <group position={[s.desk[0], 0.5, s.desk[1]]} rotation-y={rot}>
      {/* daun meja + kaki */}
      <mesh position={[0, 0.72, 0]} castShadow receiveShadow>
        <boxGeometry args={[1.1, 0.1, 0.8]} />
        <meshLambertMaterial color="#8a5a30" />
      </mesh>
      {[[-0.47, -0.32], [0.47, -0.32], [-0.47, 0.32], [0.47, 0.32]].map(([x, z], i) => (
        <mesh key={i} position={[x, 0.34, z]}>
          <boxGeometry args={[0.1, 0.68, 0.1]} />
          <meshLambertMaterial color="#6b4423" />
        </mesh>
      ))}
      {/* kertas */}
      <mesh
        ref={paper}
        position={[0.05, 0.78, 0.02]}
        rotation={[-Math.PI / 2, 0, 0.12]}
        onClick={(e) => {
          if (!lit) return
          e.stopPropagation()
          consumed.current = performance.now()
          onPaper()
        }}
        onPointerOver={() => lit && (gl.domElement.style.cursor = 'pointer')}
        onPointerOut={() => (gl.domElement.style.cursor = 'grab')}
      >
        <planeGeometry args={[0.5, 0.62]} />
        <meshLambertMaterial map={paperTex()} emissive="#ffd451" emissiveIntensity={0} />
      </mesh>
      {/* lilin */}
      <mesh position={[-0.4, 0.86, -0.22]}>
        <boxGeometry args={[0.1, 0.16, 0.1]} />
        <meshLambertMaterial color="#efe6cf" />
      </mesh>
      <mesh ref={flame} position={[-0.4, 0.98, -0.22]}>
        <boxGeometry args={[0.05, 0.09, 0.05]} />
        <meshBasicMaterial color="#ffc94a" />
      </mesh>
      {lit && <pointLight position={[0, 2.2, 0.4]} intensity={14} distance={9} decay={1.6} color="#ffe2b0" />}
    </group>
  )
}

// ——— Papan panggung: repo yang terakhir dikerjakan (live dari GitHub) ———
function wrap(g, text, maxW) {
  const words = text.split(' ')
  const lines = []
  let line = ''
  for (const w of words) {
    const test = line ? `${line} ${w}` : w
    if (g.measureText(test).width > maxW && line) {
      lines.push(line)
      line = w
    } else line = test
  }
  if (line) lines.push(line)
  return lines
}

function drawBoard(canvas, repo, lang, t) {
  const g = canvas.getContext('2d')
  const W = canvas.width
  const H = canvas.height
  g.fillStyle = '#22301f'
  g.fillRect(0, 0, W, H)
  for (let i = 0; i < 900; i++) {
    g.fillStyle = `rgba(255,255,255,${Math.random() * 0.04})`
    g.fillRect(Math.random() * W, Math.random() * H, 3, 3)
  }
  g.strokeStyle = '#6b4423'
  g.lineWidth = 14
  g.strokeRect(7, 7, W - 14, H - 14)
  g.textBaseline = 'top'
  g.fillStyle = '#ffd451'
  g.font = '20px "Press Start 2P"'
  g.fillText(`▶ ${t.nowTitle.toUpperCase()}`, 36, 36)
  if (!repo) {
    g.fillStyle = '#e8e8e8'
    g.font = '28px "Pixelify Sans"'
    g.fillText('...', 36, 110)
    return
  }
  const d = describe(repo, lang)
  g.fillStyle = '#ffffff'
  // judul mengecil otomatis supaya tidak keluar papan
  let size = 34
  do {
    g.font = `${size}px "Press Start 2P"`
    size -= 2
  } while (g.measureText(d.title).width > W - 72 && size > 14)
  g.fillText(d.title, 36, 84)
  g.fillStyle = '#9fd3ff'
  g.font = '28px "Pixelify Sans"'
  g.fillText(repo.name, 36, 136, W - 72)
  g.fillStyle = '#e8e8e8'
  g.font = '27px "Pixelify Sans"'
  wrap(g, d.desc, W - 72).slice(0, 6).forEach((l, i) => g.fillText(l, 36, 190 + i * 36))
  g.fillStyle = '#c6c6c6'
  g.font = '24px "Pixelify Sans"'
  g.fillText(`${repo.language || ''}  ·  ${t.updated}: ${timeAgo(repo.pushedAt, lang)}`, 36, H - 70)
  g.fillStyle = '#ffd451'
  const cta = `${t.clickDetail} ▶`
  g.fillText(cta, W - 36 - g.measureText(cta).width, H - 70)
}

function StageBoard({ repo, lang, t }) {
  const canvas = useMemo(() => {
    const c = document.createElement('canvas')
    c.width = 700
    c.height = 520
    return c
  }, [])
  const tex = useMemo(() => {
    const x = new THREE.CanvasTexture(canvas)
    x.colorSpace = THREE.SRGBColorSpace
    x.anisotropy = 4
    return x
  }, [canvas])
  useEffect(() => {
    let alive = true
    Promise.all([
      document.fonts.load('20px "Press Start 2P"'),
      document.fonts.load('27px "Pixelify Sans"'),
    ])
      .catch(() => {})
      .then(() => {
        if (!alive) return
        drawBoard(canvas, repo, lang, t)
        tex.needsUpdate = true
      })
    return () => {
      alive = false
    }
  }, [canvas, tex, repo, lang, t])
  return (
    <group position={[0, 4.6, -3]}>
      <mesh position={[0, 0, 0.53]}>
        <planeGeometry args={[7, 5.2]} />
        <meshBasicMaterial map={tex} toneMapped={false} />
      </mesh>
      <mesh position={[0, 0, 0.45]} castShadow>
        <boxGeometry args={[7.1, 5.3, 0.14]} />
        <meshLambertMaterial color="#6b4423" />
      </mesh>
    </group>
  )
}

// ——— Rumah Zafira: kasur + papan nama ———
function ZafiraHome({ world, home, label }) {
  const [bx, bz] = home.tf(-2, 1.5)
  return (
    <>
      <group position={[bx, 0.5, bz]} rotation-y={home.rot}>
        {/* rangka kayu */}
        <mesh position={[0, 0.22, 0]} castShadow receiveShadow>
          <boxGeometry args={[1, 0.44, 2]} />
          <meshLambertMaterial color="#8a5a30" />
        </mesh>
        {/* kasur & selimut merah muda */}
        <mesh position={[0, 0.5, 0]} receiveShadow>
          <boxGeometry args={[0.96, 0.12, 1.96]} />
          <meshLambertMaterial color="#f2ead3" />
        </mesh>
        <mesh position={[0, 0.53, -0.3]} receiveShadow>
          <boxGeometry args={[0.98, 0.1, 1.3]} />
          <meshLambertMaterial color="#0284c7" />
        </mesh>
        {/* bantal */}
        <mesh position={[0, 0.6, 0.72]}>
          <boxGeometry args={[0.8, 0.12, 0.4]} />
          <meshLambertMaterial color="#ffffff" />
        </mesh>
      </group>
      <RoofSign world={world} x={home.x} z={home.z} half={3} door={home.door} outside={home.outside} text={label} />
    </>
  )
}

// ambil "foto" dari tampilan 3D saat ini (render ulang lalu salin isi kanvas)
// sudut foto: dari kamera tripod Zahra, menatap Zafira (seperti foto studio)
function PhotoCapture({ captureRef, studio, playerRef }) {
  const { gl, scene, camera } = useThree()
  const flashLight = useRef()
  useEffect(() => {
    if (!captureRef) return
    captureRef.current = () => {
      const p = playerRef.current
      const saved = { pos: camera.position.clone(), quat: camera.quaternion.clone(), view: camera.view && { ...camera.view } }
      const cut = CUTAWAY.uOn.value
      CUTAWAY.uOn.value = 0 // tanpa efek tembus pandang di foto
      if (studio && p) {
        const [tx, tz] = studio.tripod
        // cahaya blitz dari arah kamera
        flashLight.current.position.set(tx, 2.2, tz)
        flashLight.current.intensity = 40
        camera.clearViewOffset()
        camera.position.set(tx, 1.85, tz)
        camera.lookAt(p.position.x, p.position.y + 1.25, p.position.z)
        camera.updateMatrixWorld()
      }
      gl.render(scene, camera)
      const url = gl.domElement.toDataURL('image/jpeg', 0.92)
      flashLight.current.intensity = 0
      CUTAWAY.uOn.value = cut
      // kembalikan kamera seperti semula
      camera.position.copy(saved.pos)
      camera.quaternion.copy(saved.quat)
      if (saved.view?.enabled) camera.setViewOffset(saved.view.fullWidth, saved.view.fullHeight, saved.view.offsetX, saved.view.offsetY, saved.view.width, saved.view.height)
      camera.updateMatrixWorld()
      return url
    }
  }, [captureRef, gl, scene, camera, studio, playerRef])
  return <pointLight ref={flashLight} intensity={0} distance={14} decay={1.4} color="#ffffff" />
}

// pengunjung lain (realtime) — hanya aktif setelah perkenalan selesai
function MultiplayerLayer({ enabled, playerRef, t, onCount }) {
  const { peers, ids } = useMultiplayer({ enabled, playerRef, animals: t.mp.animals, onCount })
  return <Peers peers={peers} ids={ids} animals={t.mp.animals} label={t.mp.visitor} />
}

// jam bersama untuk efek angin (rumput, bunga, daun)
function WindClock() {
  useFrame(({ clock }) => {
    WIND.uTime.value = clock.elapsedTime
  })
  return null
}

// ——— Awan kotak datar yang melayang pelan ———
function Clouds({ mode }) {
  const cloudMat = useMemo(() => new THREE.MeshLambertMaterial({ color: '#ffffff', transparent: true, opacity: 0.88 }), [])
  const clouds = useMemo(() => {
    const r = rng(77)
    return Array.from({ length: 18 }, () => {
      const cells = []
      const w = 3 + Math.floor(r() * 5)
      const d = 2 + Math.floor(r() * 3)
      for (let x = 0; x < w; x++)
        for (let z = 0; z < d; z++) if (r() > 0.25 || (x > 0 && x < w - 1)) cells.push([x * 3, z * 3])
      return { cells, x: (r() * 2 - 1) * 120, y: 34 + r() * 8, z: (r() * 2 - 1) * 110, speed: 0.5 + r() * 0.6 }
    })
  }, [])
  const refs = useRef([])
  useFrame((_, dt) => {
    cloudMat.color.lerp(tmpColor.set(TIMES[mode].cloud), Math.min(1, dt * 1.5))
    refs.current.forEach((g, i) => {
      if (!g) return
      g.position.x += clouds[i].speed * dt
      if (g.position.x > 130) g.position.x = -130
    })
  })
  return clouds.map((c, i) => (
    <group key={i} ref={(el) => (refs.current[i] = el)} position={[c.x, c.y, c.z]}>
      {c.cells.map(([x, z], j) => (
        <mesh key={j} position={[x, 0, z]} material={cloudMat}>
          <boxGeometry args={[3, 1, 3]} />
        </mesh>
      ))}
    </group>
  ))
}

// ——— Mode waktu: pagi / sore / malam (transisi halus) ———
export const TIMES = {
  pagi: {
    fog: '#b4d0ff', hemiSky: '#dceeff', hemiGround: '#7a6a4a', hemi: 1.1,
    sun: '#ffffff', sunI: 1.9, sunDir: [-30, 50, 20],
    body: '#fff6b0', bodyPos: [-90, 110, -120], stars: 0, cloud: '#ffffff',
  },
  sore: {
    fog: '#f2b08a', hemiSky: '#ffd2b0', hemiGround: '#5a3a2a', hemi: 0.85,
    sun: '#ffb070', sunI: 1.6, sunDir: [-55, 18, -10],
    body: '#ff9a50', bodyPos: [-150, 32, -60], stars: 0.15, cloud: '#ffd0b0',
  },
  malam: {
    fog: '#16203f', hemiSky: '#3a4a80', hemiGround: '#141a2a', hemi: 0.5,
    sun: '#9fb4ff', sunI: 0.45, sunDir: [30, 50, -20],
    body: '#e8eeff', bodyPos: [100, 95, -110], stars: 1, cloud: '#5a6488',
  },
}

const tmpColor = new THREE.Color()
const tmpVec = new THREE.Vector3()

function SkyBodies({ mode, hemi, light }) {
  const body = useRef()
  const disc = useRef()
  const glow = useRef()
  const starsRef = useRef()
  const { scene } = useThree()
  const stars = useMemo(() => {
    const r = rng(5)
    const pos = []
    for (let i = 0; i < 700; i++) {
      const a = r() * Math.PI * 2
      const e = 0.12 + r() * 1.3
      pos.push(Math.cos(a) * Math.cos(e) * 320, Math.sin(e) * 320, Math.sin(a) * Math.cos(e) * 320)
    }
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
    return g
  }, [])

  useFrame((_, rawDt) => {
    const k = Math.min(1, rawDt * 1.5)
    const T = TIMES[mode]
    if (scene.fog) scene.fog.color.lerp(tmpColor.set(T.fog), k)
    if (hemi.current) {
      hemi.current.color.lerp(tmpColor.set(T.hemiSky), k)
      hemi.current.groundColor.lerp(tmpColor.set(T.hemiGround), k)
      hemi.current.intensity += (T.hemi - hemi.current.intensity) * k
    }
    if (light.current) {
      light.current.color.lerp(tmpColor.set(T.sun), k)
      light.current.intensity += (T.sunI - light.current.intensity) * k
      light.current.userData.dir = T.sunDir
    }
    if (body.current) {
      body.current.position.lerp(tmpVec.set(...T.bodyPos), k)
      disc.current.material.color.lerp(tmpColor.set(T.body), k)
      glow.current.material.color.lerp(tmpColor.set(T.body), k)
    }
    if (starsRef.current) starsRef.current.material.opacity += (T.stars - starsRef.current.material.opacity) * k
  })

  return (
    <>
      <Billboard ref={body} position={TIMES[mode].bodyPos}>
        <mesh ref={disc}>
          <planeGeometry args={[18, 18]} />
          <meshBasicMaterial color={TIMES[mode].body} fog={false} />
        </mesh>
        <mesh ref={glow} position={[0, 0, -0.1]}>
          <planeGeometry args={[26, 26]} />
          <meshBasicMaterial color={TIMES[mode].body} transparent opacity={0.3} fog={false} />
        </mesh>
      </Billboard>
      <points ref={starsRef} geometry={stars}>
        <pointsMaterial color="#ffffff" size={2.2} sizeAttenuation={false} transparent opacity={0} fog={false} depthWrite={false} />
      </points>
    </>
  )
}

function Sea() {
  const map = useMemo(() => repeatTexture('water', 160), [])
  return (
    <mesh rotation-x={-Math.PI / 2} position={[0, 0.3, 0]}>
      <planeGeometry args={[640, 640]} />
      <meshLambertMaterial map={map} transparent opacity={0.82} depthWrite={false} />
    </mesh>
  )
}

// ——— Kamera: intro dari udara, lalu mengikuti Zafira ———
function CameraRig({ playerRef, panelOpen, panelShift, controls, light, introActive, focus, wake, home }) {
  const { camera, size } = useThree()
  const intro = useRef(0)
  const shift = useRef({ x: 0, y: 0 })
  const narrow = size.width < 768
  const tmp = useMemo(() => new THREE.Vector3(), [])
  const goal = useMemo(() => new THREE.Vector3(), [])
  const orbit = useRef(0.8)
  const saved = useRef(null) // jarak kamera sebelum menyorot rumah
  const returning = useRef(0)
  const focusTarget = useMemo(() => new THREE.Vector3(), [])
  const focusTime = useRef(0)
  const freeLook = useRef(null) // posisi Zafira saat pengguna mulai menggeser pandangan
  const preUpdate = useMemo(() => new THREE.Vector3(), [])
  const wasWake = useRef(false)

  // adegan selesai → kamera meluncur keluar rumah ke posisi biasa
  useEffect(() => {
    const c = controls.current
    if (wake || !wasWake.current || !c) return
    wasWake.current = false
    const dist = narrow ? 44 : 34
    saved.current = new THREE.Vector3(dist * 0.55, dist * 0.62, dist * 0.55)
    returning.current = 1.8
    c.enabled = true
  }, [wake, controls, narrow])

  // masuk rumah → simpan jarak kamera; keluar → kembali ke jarak semula
  useEffect(() => {
    const c = controls.current
    if (!c) return
    if (focus) {
      if (!saved.current) saved.current = camera.position.clone().sub(c.target)
      focusTime.current = 0
      c.minDistance = 0.5
      c.enabled = false
    } else if (saved.current) {
      returning.current = 1.4
      c.enabled = true
    }
  }, [focus, camera, controls])

  useEffect(() => {
    camera.position.set(10, 120, 140)
    controls.current?.target.set(0, 0, 0)
  }, [camera, controls])

  useFrame((_, rawDt) => {
    const c = controls.current
    const p = playerRef.current
    if (!c || !p) return
    const dt = Math.min(rawDt, 0.05)
    tmp.set(p.position.x, p.position.y + 1.2, p.position.z)

    if (wake && home && !introActive) {
      // adegan bangun tidur: kamera di dalam rumah, menatap Zafira
      // pojok belakang kamar → Zafira terlihat berjalan menjauh ke pintu
      const [cx, cz] = home.tf(2, 0.4)
      goal.set(cx, 2.9, cz)
      const k = 1 - Math.exp(-dt * (wake === 'asleep' ? 1.2 : 3))
      camera.position.lerp(goal, k)
      c.target.lerp(tmp.set(p.position.x, p.position.y + 0.9, p.position.z), k)
      c.enabled = false
      c.minDistance = 0.5
      intro.current = 1
      wasWake.current = true
    } else if (introActive) {
      // saat perkenalan: kamera berputar pelan mengelilingi desa
      orbit.current += dt * 0.07
      const k = 1 - Math.exp(-dt * 1.5)
      goal.set(Math.cos(orbit.current) * 62, 44, Math.sin(orbit.current) * 62)
      camera.position.lerp(goal, k)
      c.target.lerp(tmp.set(0, 2, 0), k)
    } else if (intro.current < 1) {
      // terbang turun dari langit ke Zafira
      intro.current = Math.min(1, intro.current + dt * 0.45)
      const k = 1 - Math.exp(-dt * 2.2)
      const dist = narrow ? 44 : 34
      goal.set(tmp.x + dist * 0.55, tmp.y + dist * 0.62, tmp.z + dist * 0.55)
      c.target.lerp(tmp, k)
      camera.position.lerp(goal, k)
    } else if (focus) {
      // POV masuk rumah: dulu ke depan pintu, lalu masuk & menatap kertas di meja
      focusTime.current += dt
      const fx = focus.outside[0] - focus.door[0]
      const fz = focus.outside[1] - focus.door[1]
      const fl = Math.hypot(fx, fz) || 1
      const ux = fx / fl
      const uz = fz / fl
      if (focusTime.current < 0.9) {
        goal.set(focus.outside[0] + ux * 1.5, 2.4, focus.outside[1] + uz * 1.5)
        focusTarget.set(focus.door[0], 1.6, focus.door[1])
      } else {
        // POV mata Zafira, menunduk ke kertas di meja
        goal.set(focus.inside[0] + ux * 0.35, 2.15, focus.inside[1] + uz * 0.35)
        focusTarget.set(focus.desk[0], 1.25, focus.desk[1])
      }
      const k = 1 - Math.exp(-dt * 3.2)
      c.target.lerp(focusTarget, k)
      camera.position.lerp(goal, k)
      p.visible = focusTime.current < 0.8
    } else if (returning.current > 0) {
      // keluar rumah: kembali mengikuti Zafira
      p.visible = true
      returning.current -= dt
      const k = 1 - Math.exp(-dt * 3.5)
      c.target.lerp(tmp, k)
      camera.position.lerp(goal.copy(tmp).add(saved.current), k)
      if (returning.current <= 0) {
        saved.current = null
        c.minDistance = 10
      }
    } else {
      // sedang melihat-lihat → kembali mengikuti begitu Zafira jalan lagi
      if (freeLook.current && p.position.distanceTo(freeLook.current) > 0.4) freeLook.current = null
      // batasi area geser supaya tidak keluar dunia
      const r = Math.hypot(c.target.x, c.target.z)
      if (r > 58) {
        const s = 58 / r
        const ox = c.target.x * (s - 1)
        const oz = c.target.z * (s - 1)
        c.target.x += ox
        c.target.z += oz
        camera.position.x += ox
        camera.position.z += oz
      }
    }
    if (!introActive && !focus && !wake && returning.current <= 0 && intro.current >= 1 && !freeLook.current) {
      // ikuti Zafira; sudut & zoom tetap bisa diatur pengguna
      const k = 1 - Math.exp(-dt * 5)
      const dx = (tmp.x - c.target.x) * k
      const dy = (tmp.y - c.target.y) * k
      const dz = (tmp.z - c.target.z) * k
      c.target.x += dx
      c.target.y += dy
      c.target.z += dz
      camera.position.x += dx
      camera.position.y += dy
      camera.position.z += dz
    }

    // zoom dekat ke Zafira → blok yang menghalangi jadi tembus pandang
    const close = camera.position.distanceTo(c.target) < 42
    const cutOn = !introActive && !focus && !wake && close ? 1 : 0
    CUTAWAY.uOn.value += (cutOn - CUTAWAY.uOn.value) * Math.min(1, dt * 4)
    CUTAWAY.uPlayer.value.set(p.position.x, p.position.y + 1, p.position.z)
    CUTAWAY.uCam.value.copy(camera.position)

    // bayangan matahari ikut bergerak bersama pemain
    if (light.current) {
      const [lx, ly, lz] = light.current.userData.dir || [-30, 50, 20]
      light.current.position.set(c.target.x + lx, c.target.y + ly, c.target.z + lz)
      light.current.target.position.copy(c.target)
    }

    // panel menutupi kanan (desktop) / bawah (HP) → geser pusat pandang
    const k2 = 1 - Math.exp(-dt * 4)
    const want = panelOpen
      ? narrow ? { x: 0, y: size.height * 0.24 } : { x: Math.min(panelShift, size.width * 0.28), y: 0 }
      : { x: 0, y: 0 }
    shift.current.x += (want.x - shift.current.x) * k2
    shift.current.y += (want.y - shift.current.y) * k2
    if (Math.abs(shift.current.x) + Math.abs(shift.current.y) < 0.5) camera.clearViewOffset()
    else camera.setViewOffset(size.width, size.height, shift.current.x, shift.current.y, size.width, size.height)
    // hanya geseran (pan) pengguna yang menggeser target di dalam update()
    preUpdate.copy(c.target)
    c.update()
    const following = !introActive && !focus && !wake && returning.current <= 0 && intro.current >= 1
    if (following && c.target.distanceTo(preUpdate) > 0.002 && !freeLook.current) freeLook.current = p.position.clone()
  })
  return null
}

// ——— Klik tanah = jalan ke sana (ray-march ke peta ketinggian, ringan untuk HP) ———
function GroundClick({ world, consumed, onGroundClick }) {
  const { gl, camera } = useThree()
  useEffect(() => {
    const el = gl.domElement
    const ray = new THREE.Raycaster()
    const ndc = new THREE.Vector2()
    let down = null
    const onDown = (e) => (down = [e.clientX, e.clientY])
    const onUp = (e) => {
      if (!down || Math.hypot(e.clientX - down[0], e.clientY - down[1]) > 6) return
      const r = el.getBoundingClientRect()
      ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1)
      ray.setFromCamera(ndc, camera)
      const o = ray.ray.origin.clone()
      const d = ray.ray.direction.clone()
      // tunggu sebentar: kalau klik ini mengenai bangunan/karakter, abaikan
      setTimeout(() => {
        if (performance.now() - consumed.current < 300) return
        for (let t = 0; t < 400; t += 0.25) {
          const x = o.x + d.x * t
          const y = o.y + d.y * t
          const z = o.z + d.z * t
          if (y <= world.ground(x, z) + 0.5) {
            onGroundClick([x, z])
            return
          }
        }
      }, 30)
    }
    el.addEventListener('pointerdown', onDown)
    el.addEventListener('pointerup', onUp)
    return () => {
      el.removeEventListener('pointerdown', onDown)
      el.removeEventListener('pointerup', onUp)
    }
  }, [gl, camera, world, consumed, onGroundClick])
  return null
}

// penanda kecil di tanah yang diklik
function TargetMarker({ marker, world }) {
  const ref = useRef()
  useEffect(() => {
    if (ref.current) ref.current.material.opacity = 0.9
  }, [marker])
  useFrame((_, dt) => {
    if (!ref.current) return
    ref.current.rotation.z += dt * 2
    ref.current.material.opacity = Math.max(0, ref.current.material.opacity - dt * 0.6)
  })
  if (!marker) return null
  const [x, z] = marker.to
  return (
    <mesh ref={ref} position={[x, world.ground(x, z) + 0.53, z]} rotation-x={-Math.PI / 2}>
      <ringGeometry args={[0.32, 0.48, 4]} />
      <meshBasicMaterial color="#ffffff" transparent opacity={0.9} depthWrite={false} />
    </mesh>
  )
}

export default function Scene({
  labels, hovered, setHovered, onSelect, command, bubble, onEnter, onNearDoor, onManualMove,
  onGroundClick, onAvatarClick, panelOpen, panelShift, marker, introActive, focusId, onPaper,
  repo, lang, t, sound, onTalk, onApproach, timeMode = 'pagi', wake, onWakeDone, onDialog, onOrder, onAte, onNurse, onPhotographer, captureRef, onBoard, onRideDone, onRideState, multiplayer, onOnline,
}) {
  const world = useMemo(() => generateWorld(), [])
  const controls = useRef()
  const playerRef = useRef()
  const light = useRef()
  const hemi = useRef()
  const consumed = useRef(0)
  const { gl, size, scene } = useThree()
  const narrow = size.width < 768

  useEffect(() => {
    gl.domElement.style.cursor = hovered ? 'pointer' : 'grab'
  }, [hovered, gl])

  useEffect(() => {
    const l = light.current
    if (!l) return
    scene.add(l.target)
    return () => scene.remove(l.target)
  }, [scene])

  return (
    <>
      <fog attach="fog" args={[TIMES[timeMode].fog, 70, 170]} />
      <hemisphereLight ref={hemi} args={['#dceeff', '#7a6a4a', 1.1]} />
      <directionalLight
        ref={light}
        intensity={1.9}
        castShadow
        shadow-mapSize={narrow ? [1024, 1024] : [1536, 1536]}
        shadow-camera-left={-34}
        shadow-camera-right={34}
        shadow-camera-top={34}
        shadow-camera-bottom={-34}
        shadow-camera-far={160}
        shadow-bias={-0.0006}
      />
      <SkyBodies mode={timeMode} hemi={hemi} light={light} />
      <Clouds mode={timeMode} />
      <Sea />
      <Blocks byType={world.byType} blockAt={world.blockAt} />
      <Plants plants={world.plants} />
      <WindClock />
      {world.warung && <Warung w={world.warung} t={t} consumed={consumed} Person={Person} DoorSign={DoorSign} onOrder={onOrder} />}
      <Animals world={world} lang={lang} consumed={consumed} />
      <Boats Person={Person} />
      <WindStreaks center={playerRef} />
      <Villagers world={world} playerRef={playerRef} consumed={consumed} villagers={t.villagers} sound={sound} onTalk={onTalk} onApproach={onApproach} eatLine={t.warung.eatLine} eatingLabel={t.warung.eating} />
      <Player
        world={world}
        command={command}
        bubble={bubble}
        playerRef={playerRef}
        onEnter={onEnter}
        onNearDoor={onNearDoor}
        onManualMove={onManualMove}
        wake={wake}
        onWakeDone={onWakeDone}
        wakeText={t.wakeText[timeMode]}
        exploreText={t.exploreText}
        onDialog={onDialog}
        eatTexts={t.warung}
        rideTexts={t.ride}
        onRideDone={onRideDone}
        onRideState={onRideState}
        onAte={onAte}
        onClick={() => {
          consumed.current = performance.now()
          onAvatarClick()
        }}
      />
      <TargetMarker marker={marker} world={world} />
      <StageBoard repo={repo} lang={lang} t={t} />
      {world.clinic && (
        <>
          <Clinic c={world.clinic} name={t.clinic.nurse} consumed={consumed} Person={Person} onNurse={onNurse} />
          <RoofSign
            world={world}
            x={world.clinic.x}
            z={world.clinic.z}
            half={world.clinic.half}
            door={world.clinic.door}
            outside={world.clinic.outside}
            text={t.clinic.name}
            lift={1.4}
          />
        </>
      )}
      {world.studio && (
        <>
          <Studio s={world.studio} name={t.studio.photographer} consumed={consumed} Person={Person} onPhotographer={onPhotographer} />
          <RoofSign
            world={world}
            x={world.studio.x}
            z={world.studio.z}
            half={world.studio.half}
            door={world.studio.door}
            outside={world.studio.outside}
            text={t.studio.name}
            lift={1.2}
          />
        </>
      )}
      {world.dock && (
        <>
          <RowBoat dock={world.dock} onBoard={onBoard} consumed={consumed} label={t.ride.label} />
          <Fisherman dock={world.dock} t={t} consumed={consumed} Person={Person} />
        </>
      )}
      <Farmer farm={world.farm} t={t} consumed={consumed} Person={Person} />
      <MultiplayerLayer enabled={multiplayer} playerRef={playerRef} t={t} onCount={onOnline} />
      <PhotoCapture captureRef={captureRef} studio={world.studio} playerRef={playerRef} />
      {world.home && <ZafiraHome world={world} home={world.home} label={t.homeLabel} />}
      {world.stations.filter((s) => s.desk).map((s) => (
        <Desk key={s.id} s={s} lit={focusId === s.id} onPaper={onPaper} consumed={consumed} />
      ))}
      {world.stations
        .filter((s) => s.desk)
        .map((s) => (
          <RoofSign
            key={'sign-' + s.id}
            world={world}
            half={s.half}
            x={s.x}
            z={s.z}
            door={s.door}
            outside={s.outside}
            text={labels[s.id]}
          />
        ))}
      {world.stations.slice(1).map((s) => (
        <Station
          key={s.id}
          s={s}
          label={labels[s.id]}
          hovered={hovered === s.id}
          onHover={setHovered}
          onSelect={onSelect}
          consumed={consumed}
        />
      ))}
      <GroundClick world={world} consumed={consumed} onGroundClick={onGroundClick} />
      <OrbitControls
        ref={controls}
        makeDefault
        enablePan
        screenSpacePanning={false}
        panSpeed={1.2}
        touches={{ ONE: THREE.TOUCH.PAN, TWO: THREE.TOUCH.DOLLY_ROTATE }}
        enableDamping
        minDistance={10}
        maxDistance={90}
        minPolarAngle={0.2}
        maxPolarAngle={1.3}
      />
      <CameraRig playerRef={playerRef} panelOpen={panelOpen} panelShift={panelShift} controls={controls} light={light} introActive={introActive} wake={wake} home={world.home} focus={world.stations.find((s) => s.id === focusId && s.id !== 'home') || null} />
    </>
  )
}
