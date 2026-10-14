import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

// =====================================================================
//  Karakter kotak-kotak (desain sendiri): Zafira + warga yang jalan-jalan
// =====================================================================

function pixelTex(draw) {
  const c = document.createElement('canvas')
  c.width = 8
  c.height = 8
  const g = c.getContext('2d')
  draw((x, y, col) => {
    g.fillStyle = col
    g.fillRect(x, y, 1, 1)
  })
  const t = new THREE.CanvasTexture(c)
  t.magFilter = THREE.NearestFilter
  t.minFilter = THREE.NearestFilter
  t.colorSpace = THREE.SRGBColorSpace
  return t
}

function headMaterials({ skin, hair, eyes = '#2b1d14', longHair, cheeks }) {
  const face = pixelTex((p) => {
    for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) p(x, y, skin)
    for (let x = 0; x < 8; x++) {
      p(x, 0, hair)
      p(x, 1, hair)
    }
    p(0, 2, hair)
    p(7, 2, hair)
    if (longHair) for (let y = 2; y < 7; y++) {
      p(0, y, hair)
      p(7, y, hair)
    }
    p(1, 4, '#ffffff')
    p(2, 4, eyes)
    p(5, 4, eyes)
    p(6, 4, '#ffffff')
    if (cheeks) {
      p(1, 5, cheeks)
      p(6, 5, cheeks)
    }
    p(3, 6, '#a0604a')
    p(4, 6, '#a0604a')
  })
  const side = pixelTex((p) => {
    for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) p(x, y, skin)
    for (let x = 0; x < 8; x++) {
      p(x, 0, hair)
      p(x, 1, hair)
    }
    const backRows = longHair ? 8 : 5
    for (let y = 0; y < backRows; y++) for (let x = 0; x < (longHair ? 6 : 3); x++) p(x, y, hair)
  })
  const sideFlip = side.clone()
  sideFlip.repeat.x = -1
  sideFlip.offset.x = 1
  sideFlip.needsUpdate = true
  const flat = (c) => new THREE.MeshLambertMaterial({ color: c })
  return [
    new THREE.MeshLambertMaterial({ map: sideFlip }), // +x
    new THREE.MeshLambertMaterial({ map: side }), // -x
    flat(hair), // atas
    flat(skin), // bawah
    new THREE.MeshLambertMaterial({ map: face }), // depan (+z)
    flat(hair), // belakang
  ]
}

const LIMB = new THREE.BoxGeometry(0.25, 0.75, 0.25)
const BODY = new THREE.BoxGeometry(0.5, 0.75, 0.25)
const HEAD = new THREE.BoxGeometry(0.5, 0.5, 0.5)

export function Person({ look, moving, onClick, children, pose }) {
  const head = useMemo(() => headMaterials(look), [look])
  const mats = useMemo(
    () => ({
      shirt: new THREE.MeshLambertMaterial({ color: look.shirt }),
      sleeve: new THREE.MeshLambertMaterial({ color: look.sleeve || look.shirt }),
      pants: new THREE.MeshLambertMaterial({ color: look.pants }),
      hair: new THREE.MeshLambertMaterial({ color: look.hair }),
      apron: look.apron ? new THREE.MeshLambertMaterial({ color: look.apron }) : null,
    }),
    [look],
  )
  const armL = useRef()
  const armR = useRef()
  const legL = useRef()
  const legR = useRef()
  const headRef = useRef()
  const t = useRef(Math.random() * 10)

  useFrame((_, dt) => {
    const m = moving.current
    t.current += dt * (m ? 9 : 1.5)
    const swing = m ? Math.sin(t.current) * 0.7 : 0
    const ease = 1 - Math.exp(-dt * 12)
    const legs = pose?.current?.legs
    for (const [r, s] of [[armL, swing], [armR, -swing], [legL, -swing], [legR, swing]])
      r.current.rotation.x += (s - r.current.rotation.x) * ease
    if (pose?.current?.fishing) {
      armL.current.rotation.x = -1.1
      armR.current.rotation.x = -1.1 + Math.sin(t.current * 0.8) * 0.05
    }
    if (pose?.current?.harvest) {
      armR.current.rotation.x = -0.9 + Math.sin(t.current * 6) * 0.7
      armL.current.rotation.x = -0.4
    }
    if (pose?.current?.swim) {
      // gaya bebas: tangan berputar bergantian, kaki menendang kecil
      const tt = t.current * (m ? 1.4 : 0.6)
      armL.current.rotation.x = -tt * 1.2
      armR.current.rotation.x = -tt * 1.2 + Math.PI
      legL.current.rotation.x = Math.sin(tt * 3) * 0.3
      legR.current.rotation.x = -Math.sin(tt * 3) * 0.3
    }
    if (legs != null) {
      legL.current.rotation.x = legs
      legR.current.rotation.x = legs
    }
    headRef.current.rotation.y = m ? 0 : Math.sin(t.current * 0.6) * 0.35
  })

  return (
    <group onClick={onClick}>
      <mesh ref={headRef} position={[0, 1.75, 0]} geometry={HEAD} material={head} castShadow />
      {look.longHair && (
        <mesh position={[0, 1.42, -0.2]} castShadow material={mats.hair}>
          <boxGeometry args={[0.5, 0.45, 0.12]} />
        </mesh>
      )}
      <mesh position={[0, 1.125, 0]} geometry={BODY} material={mats.shirt} castShadow />
      {mats.apron && (
        <mesh position={[0, 1.0, 0.13]} material={mats.apron}>
          <boxGeometry args={[0.4, 0.6, 0.02]} />
        </mesh>
      )}
      <group ref={armL} position={[0.375, 1.5, 0]}>
        <mesh position={[0, -0.375, 0]} geometry={LIMB} material={mats.sleeve} castShadow />
      </group>
      <group ref={armR} position={[-0.375, 1.5, 0]}>
        <mesh position={[0, -0.375, 0]} geometry={LIMB} material={mats.sleeve} castShadow />
      </group>
      <group ref={legL} position={[0.125, 0.75, 0]}>
        <mesh position={[0, -0.375, 0]} geometry={LIMB} material={mats.pants} castShadow />
      </group>
      <group ref={legR} position={[-0.125, 0.75, 0]}>
        <mesh position={[0, -0.375, 0]} geometry={LIMB} material={mats.pants} castShadow />
      </group>
      {children}
    </group>
  )
}
