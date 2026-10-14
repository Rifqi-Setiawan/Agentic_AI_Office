import { useLayoutEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { blockMaterial, plantMaterial, SEE_THROUGH } from './textures'

const tmp = new THREE.Object3D()

// ——— Mesh dunia: hanya sisi blok yang terlihat yang dibuat (seperti game voxel asli) ———
// Urutan sisi sama dengan tekstur: +x, -x, +y, -y, +z, -z
const FACE_DIRS = [
  [1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1],
]
// sudut tiap sisi: kiri-bawah, kanan-bawah, kanan-atas, kiri-atas (dilihat dari luar)
const FACE_CORNERS = [
  [[0.5, -0.5, 0.5], [0.5, -0.5, -0.5], [0.5, 0.5, -0.5], [0.5, 0.5, 0.5]],
  [[-0.5, -0.5, -0.5], [-0.5, -0.5, 0.5], [-0.5, 0.5, 0.5], [-0.5, 0.5, -0.5]],
  [[-0.5, 0.5, 0.5], [0.5, 0.5, 0.5], [0.5, 0.5, -0.5], [-0.5, 0.5, -0.5]],
  [[-0.5, -0.5, -0.5], [0.5, -0.5, -0.5], [0.5, -0.5, 0.5], [-0.5, -0.5, 0.5]],
  [[-0.5, -0.5, 0.5], [0.5, -0.5, 0.5], [0.5, 0.5, 0.5], [-0.5, 0.5, 0.5]],
  [[0.5, -0.5, -0.5], [-0.5, -0.5, -0.5], [-0.5, 0.5, -0.5], [0.5, 0.5, -0.5]],
]
const UV = [0, 0, 1, 0, 1, 1, 0, 1]

function buildWorldMeshes(byType, blockAt) {
  const groups = new Map()
  for (const [type, positions] of Object.entries(byType)) {
    const mats = blockMaterial(type)
    for (const [x, y, z] of positions) {
      for (let f = 0; f < 6; f++) {
        const [dx, dy, dz] = FACE_DIRS[f]
        const n = blockAt(x + dx, y + dy, z + dz)
        // sisi tertutup blok padat, atau sesama blok tembus pandang (daun-daun, air-air)
        if (n && (!SEE_THROUGH.has(n) || n === type)) continue
        const material = Array.isArray(mats) ? mats[f] : mats
        let g = groups.get(material)
        if (!g) {
          g = { material, type, pos: [], nor: [], uv: [], idx: [] }
          groups.set(material, g)
        }
        const base = g.pos.length / 3
        for (const [cx, cy, cz] of FACE_CORNERS[f]) {
          g.pos.push(x + cx, y + cy, z + cz)
          g.nor.push(dx, dy, dz)
        }
        g.uv.push(...UV)
        g.idx.push(base, base + 1, base + 2, base, base + 2, base + 3)
      }
    }
  }
  return [...groups.values()].map((g) => {
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.Float32BufferAttribute(g.pos, 3))
    geo.setAttribute('normal', new THREE.Float32BufferAttribute(g.nor, 3))
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(g.uv, 2))
    geo.setIndex(g.idx)
    geo.computeBoundingSphere()
    return { geo, material: g.material, shadows: g.type !== 'water' && g.type !== 'glass' }
  })
}

export function Blocks({ byType, blockAt }) {
  const meshes = useMemo(() => buildWorldMeshes(byType, blockAt), [byType, blockAt])
  return meshes.map((m, i) => (
    <mesh key={i} geometry={m.geo} material={m.material} castShadow={m.shadows} receiveShadow />
  ))
}

// Tanaman = 2 bidang menyilang (seperti bunga di game voxel)
const cross = (() => {
  const a = new THREE.PlaneGeometry(0.85, 0.85)
  a.rotateY(Math.PI / 4)
  const b = new THREE.PlaneGeometry(0.85, 0.85)
  b.rotateY(-Math.PI / 4)
  const g = mergeGeometries([a, b])
  g.translate(0, -0.075, 0)
  return g
})()

function PlantKind({ kind, items }) {
  const ref = useRef()
  const material = useMemo(() => plantMaterial(kind), [kind])
  useLayoutEffect(() => {
    items.forEach((p, i) => {
      tmp.position.set(p.x, p.y, p.z)
      tmp.updateMatrix()
      ref.current.setMatrixAt(i, tmp.matrix)
    })
    ref.current.instanceMatrix.needsUpdate = true
    ref.current.computeBoundingSphere()
  }, [items])
  return <instancedMesh ref={ref} args={[cross, material, items.length]} />
}

export function Plants({ plants }) {
  const groups = useMemo(() => {
    const g = {}
    for (const p of plants) (g[p.kind] ||= []).push(p)
    return g
  }, [plants])
  return Object.entries(groups).map(([kind, items]) => <PlantKind key={kind} kind={kind} items={items} />)
}
