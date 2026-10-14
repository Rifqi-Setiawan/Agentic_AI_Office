import { rng, noise2 } from './noise'
import { SEE_THROUGH } from './textures'

// =====================================================================
//  Dunia luas: desa di tengah, bukit & hutan di luar, laut di pinggir.
//  Koordinat blok = bilangan bulat. Permukaan desa di y = 0.
// =====================================================================

export const STATION_IDS = ['home', 'about', 'education', 'tech', 'work', 'journey', 'contact']

export const SIZE = 60 // setengah lebar area yang dihitung
const LAND = 54 // jari-jari daratan
const VILLAGE = 30 // jari-jari desa (datar)
const RING = 21 // jarak bangunan dari alun-alun
const ROAD_RING = 12
const POND = { x: 25, z: 1, r: 3.2 }
const FARM = { x: -26, z: 0, half: 3 }
const DOCK_ANGLE = (-95 * Math.PI) / 180 // dermaga di pantai utara

const key = (x, y, z) => `${x},${y},${z}`

// [id, x, z, setengah lebar, pembangun]
const GAMES = [
  ['game_mine', 29, 29, 3, mineEntrance],
  ['game_memory', -29, 29, 3, marketStall],
  ['game_slime', -29, -29, 4, slimeArena],
]
const W = SIZE * 2 + 1
const idx = (x, z) => (x + SIZE) * W + (z + SIZE)
const inside = (x, z) => x >= -SIZE && x <= SIZE && z >= -SIZE && z <= SIZE

export function generateWorld() {
  const blocks = new Map()
  const set = (x, y, z, t) => blocks.set(key(x, y, z), t)
  const del = (x, y, z) => blocks.delete(key(x, y, z))
  const rand = rng(2026)

  const edgeOf = (x, z) => LAND * (0.86 + 0.14 * noise2(x / 11 + 40, z / 11 + 40, 3))

  // ——— rencana bangunan ———
  const builders = { about: house, education: library, tech: workshop, work: gallery, journey: tower, contact: cottage }
  const halves = { about: 3, education: 3, tech: 3, work: 4, journey: 2, contact: 2 }
  const makePlot = (id, x, z, half, build, game = false) => {
    // pintu menghadap ke alun-alun (arah kardinal terdekat)
    let k
    let f
    if (Math.abs(x) > Math.abs(z)) [k, f] = x > 0 ? [3, [-1, 0]] : [1, [1, 0]]
    else [k, f] = z > 0 ? [0, [0, -1]] : [2, [0, 1]]
    const doorX = x + f[0] * half
    const doorZ = z + f[1] * half
    return {
      id, x, z, k, half, f, build, game,
      door: [doorX, doorZ],
      outside: [doorX + f[0] * 2, doorZ + f[1] * 2],
      // titik berdiri di depan meja & posisi meja (dinding belakang)
      inside: game ? [doorX - f[0] * 1.5, doorZ - f[1] * 1.5] : [x - f[0] * (half - 2), z - f[1] * (half - 2)],
      desk: game ? null : [x - f[0] * (half - 1), z - f[1] * (half - 1)],
      approach: [doorX + f[0] * 4, doorZ + f[1] * 4],
    }
  }
  const plots = STATION_IDS.slice(1).map((id, i) => {
    const a = ((i * 60 + 30) * Math.PI) / 180
    return makePlot(id, Math.round(Math.cos(a) * RING), Math.round(Math.sin(a) * RING), halves[id], builders[id])
  })
  // 3 mini game di pojok desa
  for (const [id, x, z, half, build] of GAMES) plots.push(makePlot(id, x, z, half, build, true))
  // rumah Zafira (tempat adegan bangun tidur)
  plots.push({ ...makePlot('home_zafira', -8, 16, 3, zafiraHouse, true), deco: 'home' })
  // warung mie ayam (tempat warga makan)
  plots.push({ ...makePlot('warung', 8, -15, 3, warungStall, true), deco: 'warung' })
  // puskesmas tempat Perawat Zulfa
  plots.push({ ...makePlot('puskesmas', 11, 21, 3, puskesmas, true), deco: 'puskesmas' })
  // studio foto milik Zahra
  plots.push({ ...makePlot('studio', -11, -20, 3, photoStudio, true), deco: 'studio' })

  // dermaga di pantai utara: cari garis pantai di arah DOCK_ANGLE
  const ux = Math.cos(DOCK_ANGLE)
  const uz = Math.sin(DOCK_ANGLE)
  let shoreR = 30
  while (shoreR < 58 && Math.hypot(ux * shoreR, uz * shoreR) <= edgeOf(ux * shoreR, uz * shoreR)) shoreR += 0.25
  plots.push({
    ...makePlot('dock', Math.round(ux * (shoreR - 3)), Math.round(uz * (shoreR - 3)), 1, () => 2, true),
    deco: 'dock',
  })

  const distToSeg = (px, pz, a, b) => {
    const dx = b[0] - a[0]
    const dz = b[1] - a[1]
    const t = Math.max(0, Math.min(1, ((px - a[0]) * dx + (pz - a[1]) * dz) / (dx * dx + dz * dz || 1)))
    return Math.hypot(px - (a[0] + dx * t), pz - (a[1] + dz * t))
  }
  const roadDist = (x, z) => {
    let d = Math.abs(Math.hypot(x, z) - ROAD_RING)
    for (const p of plots)
      d = Math.min(d, distToSeg(x, z, [0, 0], p.approach), distToSeg(x, z, p.approach, p.door))
    return d
  }
  const plotDist = (x, z) => Math.min(...plots.map((p) => Math.max(Math.abs(x - p.x), Math.abs(z - p.z)) - p.half))
  const nearPond = (x, z) => Math.hypot(x - POND.x, (z - POND.z) * 1.3)
  const nearFarm = (x, z) => Math.max(Math.abs(x - FARM.x), Math.abs(z - FARM.z)) - FARM.half

  // ——— tinggi medan per kolom ———
  const height = new Int16Array(W * W).fill(-99) // -99 = laut
  const isSand = new Uint8Array(W * W)
  for (let x = -SIZE; x <= SIZE; x++) {
    for (let z = -SIZE; z <= SIZE; z++) {
      const d = Math.hypot(x, z)
      const edge = edgeOf(x, z)
      if (d > edge) continue
      const v = Math.min(1, Math.max(0, (d - VILLAGE) / 10))
      const n = noise2(x / 13, z / 13, 7) * 0.7 + noise2(x / 5, z / 5, 9) * 0.3
      let h = Math.round(Math.max(0, n - 0.42) * 14 * v)
      const shore = Math.min(1, (edge - d) / 4)
      h = Math.round(h * shore)
      if (d > VILLAGE - 2 && (roadDist(x, z) < 2.6 || plotDist(x, z) < 4)) h = 0 // ratakan jalan & area game
      height[idx(x, z)] = h
      if (edge - d < 2.6 && h === 0) isSand[idx(x, z)] = 1
    }
  }
  const H = (x, z) => (inside(x, z) ? height[idx(x, z)] : -99)

  // ——— blok medan (hanya yang kelihatan: atas + sisi yang terbuka) ———
  for (let x = -SIZE; x <= SIZE; x++) {
    for (let z = -SIZE; z <= SIZE; z++) {
      const h = H(x, z)
      if (h === -99) {
        // dasar laut dangkal di dekat pantai
        if ([H(x + 1, z), H(x - 1, z), H(x, z + 1), H(x, z - 1), H(x + 2, z), H(x - 2, z), H(x, z + 2), H(x, z - 2)].some((n) => n !== -99))
          set(x, -1, z, 'sand')
        continue
      }
      const low = Math.min(h - 1, ...[H(x + 1, z), H(x - 1, z), H(x, z + 1), H(x, z - 1)].map((n) => (n === -99 ? -2 : n)))
      const sand = isSand[idx(x, z)]
      for (let y = low; y <= h; y++) {
        let t = y === h ? 'grass' : y >= h - 3 ? 'dirt' : 'stone'
        if (sand) t = 'sand'
        set(x, y, z, t)
      }
    }
  }

  // ——— alun-alun, jalan, kolam, kebun ———
  for (let x = -SIZE; x <= SIZE; x++) {
    for (let z = -SIZE; z <= SIZE; z++) {
      if (H(x, z) !== 0) continue
      if (Math.hypot(x, z) <= 4.2) set(x, 0, z, 'cobble')
      else if (roadDist(x, z) < 1.3) set(x, 0, z, 'path')
      if (nearPond(x, z) < POND.r) {
        set(x, 0, z, 'water')
        set(x, -1, z, 'sand')
      }
      if (nearFarm(x, z) <= 0) set(x, 0, z, x === FARM.x ? 'water' : 'farmland')
      if (nearFarm(x, z) === 1) set(x, 0, z, 'log')
    }
  }

  // ——— bangunan ———
  let home = null
  let warung = null
  let clinic = null
  let studio = null
  let dock = null
  const stations = [{ id: 'home', x: 0, z: 0, height: 2, half: 2, outside: [0, 2], inside: [0, 2] }]
  for (const p of plots) {
    const place = (lx, ly, lz, t) => {
      let x = lx
      let z = lz
      for (let i = 0; i < p.k; i++) [x, z] = [-z, x]
      if (t) set(p.x + x, ly, p.z + z, t)
      else del(p.x + x, ly, p.z + z)
    }
    const h = p.build(place, p.half)
    if (p.deco) {
      // titik-titik adegan (koordinat lokal rumah → dunia)
      const tf = (lx, lz) => {
        let x = lx
        let z = lz
        for (let i = 0; i < p.k; i++) [x, z] = [-z, x]
        return [p.x + x, p.z + z]
      }
      const rot = (-p.k * Math.PI) / 2
      if (p.deco === 'home') home = { x: p.x, z: p.z, height: h, rot, tf, door: p.door, outside: p.outside }
      else if (p.deco === 'puskesmas') {
        clinic = {
          x: p.x, z: p.z, height: h, rot, tf, half: p.half, door: p.door, outside: p.outside,
          nurse: tf(1.7, -p.half - 1.2),
          visitor: tf(0.2, -p.half - 2.6),
          monitor: tf(-2, -p.half - 0.53),
        }
      } else if (p.deco === 'dock') {
        // jembatan kayu (pier) menjorok ke laut, lebar 3 blok
        const px = -uz
        const pz = ux
        const cells = new Set()
        for (let r = shoreR - 2; r <= shoreR + 6; r += 0.5)
          for (const w of [-1, 0, 1]) cells.add(`${Math.round(ux * r + px * w)},${Math.round(uz * r + pz * w)}`)
        for (const c of cells) {
          const [x, z] = c.split(',').map(Number)
          if (!inside(x, z)) continue
          set(x, 0, z, 'planks')
          if (!blocks.has(key(x, -1, z))) set(x, -1, z, 'log') // tiang penyangga
          height[idx(x, z)] = 0
        }
        const end = shoreR + 5.6
        const at = (r, w = 0) => [ux * r + px * w, uz * r + pz * w]
        const boatDock = at(end - 1.5, 2.6)
        const ride = [boatDock, at(66, 2.6)]
        for (let k = 1; k <= 36; k++) {
          const a = DOCK_ANGLE + (k * Math.PI * 2) / 36
          ride.push([Math.cos(a) * 66, Math.sin(a) * 66])
        }
        ride.push(at(66, 2.6), boatDock)
        dock = {
          heading: Math.atan2(ux, uz), // arah menghadap laut
          fisher: at(end, -0.6),
          bobber: at(end + 3.2, -0.6),
          board: at(end - 1.5, 1),
          boatDock,
          ride,
        }
      } else if (p.deco === 'studio') {
        studio = {
          x: p.x, z: p.z, height: h, rot, tf, half: p.half, door: p.door, outside: p.outside,
          photographer: tf(1.9, -p.half - 1.3),
          tripod: tf(0.3, -p.half - 2.0),
          visitor: tf(0.3, -p.half - 4.6),
          softbox: tf(-1.8, -p.half - 2.2),
        }
      } else {
        // kursi menghadap gerobak (+z lokal), meja di antara kursi & gerobak
        warung = {
          x: p.x, z: p.z, height: h, rot, tf,
          seats: [tf(-1, -2), tf(0, -2), tf(1, -2)],
          table: tf(0, -1),
          seller: tf(0, 2),
          front: tf(0, -5),
        }
      }
      continue
    }
    stations.push({
      id: p.id, x: p.x, z: p.z, height: h, half: p.half,
      outside: p.outside, inside: p.inside, door: p.door, desk: p.desk, game: p.game,
    })
  }

  // ——— panggung "Sedang Dikerjakan" di alun-alun ———
  for (let x = -3; x <= 3; x++) for (let z = -3; z <= -1; z++) set(x, 1, z, z === -1 ? 'stonebrick' : 'planks')
  for (const x of [-4, 4]) for (let y = 1; y <= 7; y++) set(x, y, -3, 'log')
  for (let x = -4; x <= 4; x++) set(x, 8, -3, 'planks')
  for (const x of [-3, 3]) set(x, 2, -1, 'glow')
  stations.push({
    id: 'now', x: 0, z: -3, height: 7, half: 3,
    outside: [0, 2], door: [0, 1], inside: [0, 1],
  })

  // ——— lampu jalan ———
  const lamps = []
  // 1 lampu per jalan ke 6 bangunan utama, selang-seling kiri/kanan, tidak terlalu dekat satu sama lain
  plots
    .filter((p) => !p.game)
    .forEach((p, i) => {
      const len = Math.hypot(p.approach[0], p.approach[1])
      const side = i % 2 ? 1 : -1
      const nx = (-p.approach[1] / len) * side
      const nz = (p.approach[0] / len) * side
      const lx = Math.round(p.approach[0] * 0.7 + nx * 2.2)
      const lz = Math.round(p.approach[1] * 0.7 + nz * 2.2)
      if (roadDist(lx, lz) < 1.3 || plotDist(lx, lz) < 1) return
      if (lamps.some(([x, z]) => Math.hypot(x - lx, z - lz) < 7)) return
      lamps.push([lx, lz])
    })
  // alun-alun: cukup 2 lampu di depan
  for (const [x, z] of [[4, 4], [-4, 4]]) lamps.push([x, z])
  for (const [x, z] of lamps) {
    set(x, 1, z, 'log')
    set(x, 2, z, 'log')
    set(x, 3, z, 'glow')
  }

  // ——— pohon (hutan di luar desa, sedikit di dalam desa) ———
  const trees = []
  const tryTree = (x, z) => {
    const h = H(x, z)
    if (h === -99 || isSand[idx(x, z)]) return
    const d = Math.hypot(x, z)
    if (d > edgeOf(x, z) - 3 || d < 7) return
    if (roadDist(x, z) < 2.5 || plotDist(x, z) < 3 || nearPond(x, z) < POND.r + 2.5 || nearFarm(x, z) < 3) return
    if (lamps.some(([lx, lz]) => Math.hypot(lx - x, lz - z) < 2.5)) return
    // area depan pintu tiap bangunan harus bersih (supaya bangunan & papan namanya kelihatan)
    if (plots.some((p) => distToSeg(x, z, p.door, [p.door[0] + p.f[0] * 12, p.door[1] + p.f[1] * 12]) < p.half + 3)) return
    if (trees.some(([tx, tz]) => Math.hypot(tx - x, tz - z) < (d > VILLAGE ? 5 : 7))) return
    trees.push([x, z])
    const th = 4 + Math.floor(rand() * 3)
    for (let y = h + 1; y <= h + th; y++) set(x, y, z, 'log')
    for (let dy = -1; dy <= 2; dy++) {
      const r = dy <= 0 ? 2 : 1
      for (let dx = -r; dx <= r; dx++)
        for (let dz = -r; dz <= r; dz++) {
          const corner = Math.abs(dx) === r && Math.abs(dz) === r
          if (corner && (dy === 2 || rand() < 0.5)) continue
          if (dy === 2 && Math.abs(dx) + Math.abs(dz) > 1) continue
          const k = key(x + dx, h + th + dy, z + dz)
          if (!blocks.has(k)) blocks.set(k, 'leaves')
        }
    }
  }
  for (let i = 0; i < 2600; i++) {
    const a = rand() * Math.PI * 2
    const d = Math.sqrt(rand()) * LAND
    const inVillage = d < VILLAGE
    if (inVillage && rand() < 0.75) continue
    tryTree(Math.round(Math.cos(a) * d), Math.round(Math.sin(a) * d))
  }

  // ——— tanaman ———
  const plants = []
  for (let x = -SIZE; x <= SIZE; x++) {
    for (let z = -SIZE; z <= SIZE; z++) {
      const h = H(x, z)
      if (h === -99) continue
      const top = blocks.get(key(x, h, z))
      if (top === 'farmland') {
        plants.push({ x, y: h + 1, z, kind: 'wheat' })
        continue
      }
      if (top !== 'grass' || blocks.has(key(x, h + 1, z))) continue
      if (plotDist(x, z) < 1 || roadDist(x, z) < 1.8 || Math.hypot(x, z) < 5) continue
      const r = rand()
      if (r < 0.025) plants.push({ x, y: h + 1, z, kind: 'poppy' })
      else if (r < 0.05) plants.push({ x, y: h + 1, z, kind: 'dandelion' })
      else if (r < 0.2) plants.push({ x, y: h + 1, z, kind: 'tallgrass' })
    }
  }

  // ——— peta jalan kaki (buat karakter) ———
  // lantai = permukaan medan (lantai bangunan juga y = 0)
  const walk = new Uint8Array(W * W)
  for (let x = -SIZE; x <= SIZE; x++) {
    for (let z = -SIZE; z <= SIZE; z++) {
      const h = H(x, z)
      if (h === -99) continue
      const floorT = blocks.get(key(x, h, z))
      if (!floorT || floorT === 'water') continue
      if (blocks.has(key(x, h + 1, z)) || blocks.has(key(x, h + 2, z))) continue
      walk[idx(x, z)] = 1
    }
  }
  for (const p of plots) if (p.desk) walk[idx(p.desk[0], p.desk[1])] = 0 // meja menghalangi

  // ——— air yang bisa direnangi Zafira: laut di sekitar pulau + kolam ———
  const swim = new Uint8Array(W * W)
  for (let x = -SIZE; x <= SIZE; x++) {
    for (let z = -SIZE; z <= SIZE; z++) {
      const h = H(x, z)
      if (h === -99) swim[idx(x, z)] = 1
      else if (blocks.get(key(x, h, z)) === 'water' && !blocks.has(key(x, h + 1, z))) swim[idx(x, z)] = 1
    }
  }
  if (warung) for (const lx of [-1, 0, 1]) for (const lz of [-1, 1]) {
    const [x, z] = warung.tf(lx, lz)
    walk[idx(x, z)] = 0 // meja & gerobak warung
  }

  // ——— buang blok yang tertutup penuh (hemat GPU) ———
  const solid = (x, y, z) => {
    const t = blocks.get(key(x, y, z))
    return t && !SEE_THROUGH.has(t)
  }
  const byType = {}
  for (const [k, t] of blocks) {
    const [x, y, z] = k.split(',').map(Number)
    if (
      solid(x + 1, y, z) && solid(x - 1, y, z) && solid(x, y + 1, z) &&
      solid(x, y - 1, z) && solid(x, y, z + 1) && solid(x, y, z - 1)
    ) continue
    ;(byType[t] ||= []).push([x, y, z])
  }

  const ground = (x, z) => {
    const h = H(Math.round(x), Math.round(z))
    return h === -99 ? 0 : h
  }
  const canWalk = (x, z) => {
    const rx = Math.round(x)
    const rz = Math.round(z)
    return inside(rx, rz) && walk[idx(rx, rz)] === 1
  }

  // titik-titik tujuan warga
  const pois = [[0, 0], [2, 1], [-2, -1]]
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2
    pois.push([Math.round(Math.cos(a) * ROAD_RING), Math.round(Math.sin(a) * ROAD_RING)])
  }
  for (const p of plots) pois.push(p.approach)
  pois.push([POND.x - 5, POND.z], [FARM.x + 5, FARM.z])
  if (warung) pois.push(warung.front)

  return {
    byType, plants, stations, pois,
    ground, canWalk,
    findPath: (from, to, opts) => findPath(walk, height, from, to, opts?.swim ? swim : null),
    isWater: (x, z) => {
      const rx = Math.round(x)
      const rz = Math.round(z)
      return inside(rx, rz) && swim[idx(rx, rz)] === 1
    },
    blockAt: (x, y, z) => blocks.get(key(x, y, z)),
    home,
    warung,
    clinic,
    studio,
    dock,
    farm: FARM,
  }
}

// =====================================================================
//  A* di grid 2D + penghalusan jalur (supaya tidak zig-zag)
// =====================================================================

function findPath(walk, rawHeight, from, to, swim = null) {
  const sx = Math.round(from[0])
  const sz = Math.round(from[1])
  let tx = Math.round(to[0])
  let tz = Math.round(to[1])
  const ok = (x, z) => inside(x, z) && (walk[idx(x, z)] === 1 || (swim && swim[idx(x, z)] === 1))
  // laut (-99) dianggap setinggi -1 supaya bisa dimasuki dari pantai
  const height = swim ? rawHeight.map((h) => (h === -99 ? -1 : h)) : rawHeight
  // kalau tujuan tidak bisa diinjak, cari sel terdekat yang bisa
  if (!ok(tx, tz)) {
    let best = null
    for (let r = 1; r <= 4 && !best; r++)
      for (let dx = -r; dx <= r; dx++)
        for (let dz = -r; dz <= r; dz++)
          if (ok(tx + dx, tz + dz) && (!best || Math.hypot(dx, dz) < best[2])) best = [tx + dx, tz + dz, Math.hypot(dx, dz)]
    if (!best) return null
    ;[tx, tz] = best
  }
  if (!ok(sx, sz)) return [[tx, tz]]

  const N = W * W
  const g = new Float32Array(N).fill(Infinity)
  const came = new Int32Array(N).fill(-1)
  const closed = new Uint8Array(N)
  const heap = []
  const push = (f, i) => {
    heap.push([f, i])
    let c = heap.length - 1
    while (c > 0) {
      const p = (c - 1) >> 1
      if (heap[p][0] <= heap[c][0]) break
      ;[heap[p], heap[c]] = [heap[c], heap[p]]
      c = p
    }
  }
  const pop = () => {
    const top = heap[0]
    const last = heap.pop()
    if (heap.length) {
      heap[0] = last
      let c = 0
      for (;;) {
        const l = c * 2 + 1
        const r = l + 1
        let m = c
        if (l < heap.length && heap[l][0] < heap[m][0]) m = l
        if (r < heap.length && heap[r][0] < heap[m][0]) m = r
        if (m === c) break
        ;[heap[m], heap[c]] = [heap[c], heap[m]]
        c = m
      }
    }
    return top
  }
  const hx = (x, z) => {
    const dx = Math.abs(x - tx)
    const dz = Math.abs(z - tz)
    return Math.max(dx, dz) + 0.414 * Math.min(dx, dz)
  }
  const start = idx(sx, sz)
  const goal = idx(tx, tz)
  g[start] = 0
  push(hx(sx, sz), start)
  let found = false
  let steps = 0
  while (heap.length && steps++ < 40000) {
    const [, i] = pop()
    if (closed[i]) continue
    closed[i] = 1
    if (i === goal) {
      found = true
      break
    }
    const x = Math.floor(i / W) - SIZE
    const z = (i % W) - SIZE
    const hi = height[i]
    for (let dx = -1; dx <= 1; dx++)
      for (let dz = -1; dz <= 1; dz++) {
        if (!dx && !dz) continue
        const nx = x + dx
        const nz = z + dz
        if (!ok(nx, nz)) continue
        if (dx && dz && (!ok(x + dx, z) || !ok(x, z + dz))) continue // jangan potong sudut
        const j = idx(nx, nz)
        if (Math.abs(height[j] - hi) > 1) continue
        const cost = g[i] + (dx && dz ? 1.414 : 1) + Math.abs(height[j] - hi) * 0.5
        if (cost < g[j]) {
          g[j] = cost
          came[j] = i
          push(cost + hx(nx, nz), j)
        }
      }
  }
  if (!found) return null
  const cells = []
  for (let i = goal; i !== -1; i = came[i]) cells.push([Math.floor(i / W) - SIZE, (i % W) - SIZE])
  cells.reverse()

  // penghalusan: lompati titik selama garis lurusnya aman
  const clear = (a, b) => {
    const d = Math.hypot(b[0] - a[0], b[1] - a[1])
    const n = Math.ceil(d / 0.25)
    const px = (-(b[1] - a[1]) / (d || 1)) * 0.3
    const pz = ((b[0] - a[0]) / (d || 1)) * 0.3
    let prevH = height[idx(a[0], a[1])]
    for (let s = 1; s <= n; s++) {
      const x = a[0] + ((b[0] - a[0]) * s) / n
      const z = a[1] + ((b[1] - a[1]) * s) / n
      for (const o of [0, 1, -1]) {
        const cx = Math.round(x + px * o)
        const cz = Math.round(z + pz * o)
        if (!ok(cx, cz)) return false
        if (Math.abs(height[idx(cx, cz)] - prevH) > 1) return false
      }
      prevH = height[idx(Math.round(x), Math.round(z))]
    }
    return true
  }
  const out = []
  let i = 0
  while (i < cells.length - 1) {
    let j = cells.length - 1
    while (j > i + 1 && !clear(cells[i], cells[j])) j--
    out.push(cells[j])
    i = j
  }
  return out
}

// =====================================================================
//  Bangunan (koordinat lokal, pintu di sisi -z, lantai di y = 0)
//  Tiap fungsi mengembalikan tinggi bangunan (buat posisi papan nama).
// =====================================================================

function walls(place, half, y0, y1, pick) {
  for (let y = y0; y <= y1; y++)
    for (let x = -half; x <= half; x++)
      for (let z = -half; z <= half; z++)
        if (Math.abs(x) === half || Math.abs(z) === half) place(x, y, z, pick(x, y, z))
}

function floor(place, half, t) {
  for (let x = -half; x <= half; x++) for (let z = -half; z <= half; z++) place(x, 0, z, t)
}

function door(place, h) {
  place(0, 1, -h, null)
  place(0, 2, -h, null)
  place(-1, 3, -h, 'glow')
}

// Tentang — rumah kayu beratap genteng bata
function house(place, h) {
  floor(place, h, 'planks')
  walls(place, h, 1, 3, (x, y, z) => {
    if (Math.abs(x) === h && Math.abs(z) === h) return 'log'
    if (y === 2 && (Math.abs(x) === 1 || Math.abs(z) === 1)) return 'glass'
    return 'planks'
  })
  door(place, h)
  for (let dy = 0; dy <= h + 1; dy++) {
    const ax = h + 1 - dy
    for (let z = -h - 1; z <= h + 1; z++) {
      place(ax, 4 + dy, z, 'brick')
      place(-ax, 4 + dy, z, 'brick')
    }
    for (let x = -ax + 1; x <= ax - 1; x++) {
      place(x, 4 + dy, -h, 'planks')
      place(x, 4 + dy, h, 'planks')
    }
  }
  place(0, 5, -h, 'glass')
  place(h - 1, 1, h - 1, 'crafting')
  place(-h + 1, 1, h - 1, 'bookshelf')
  return h + 6
}

// Pendidikan — perpustakaan rak buku + menara lampu
function library(place, h) {
  floor(place, h, 'planks')
  walls(place, h, 1, 4, (x, y, z) => {
    if (Math.abs(x) === h && Math.abs(z) === h) return 'log'
    if ((y === 2 || y === 3) && Math.abs(x) === 2 && Math.abs(z) === h) return 'glass'
    return y === 4 ? 'stonebrick' : 'bookshelf'
  })
  door(place, h)
  for (let x = -h - 1; x <= h + 1; x++) for (let z = -h - 1; z <= h + 1; z++) place(x, 5, z, 'planks')
  for (let x = -1; x <= 1; x++) for (let z = -1; z <= 1; z++) place(x, 6, z, 'stonebrick')
  place(0, 7, 0, 'glow')
  return 8
}

// Teknologi — bengkel batu dengan meja crafting & tungku
function workshop(place, h) {
  floor(place, h, 'stone')
  walls(place, h, 1, 3, (x, y, z) => {
    if (Math.abs(x) === h && Math.abs(z) === h) return 'stonebrick'
    if (y === 2 && Math.abs(z) === 0) return 'glass'
    return 'cobble'
  })
  door(place, h)
  for (let x = -1; x <= 1; x++) place(x, 1, -h, null)
  for (let x = -1; x <= 1; x++) place(x, 2, -h, null)
  for (let x = -h; x <= h; x++) for (let z = -h; z <= h; z++) place(x, 4, z, 'stonebrick')
  place(-h + 1, 1, h - 1, 'crafting')
  place(h - 1, 1, h - 1, 'furnace')
  place(h - 1, 2, h - 1, 'furnace')
  place(h - 2, 1, h - 1, 'furnace')
  for (let y = 5; y <= 8; y++) place(h - 1, y, h - 1, 'brick')
  return 9
}

// Proyek — galeri batu besar berjendela lebar
function gallery(place, h) {
  floor(place, h, 'stonebrick')
  walls(place, h, 1, 5, (x, y, z) => {
    if (Math.abs(x) === h && Math.abs(z) === h) return 'stonebrick'
    if (y === 5) return 'stonebrick'
    if ((y === 2 || y === 3) && (Math.abs(x) % 2 === 1 || Math.abs(z) % 2 === 1)) return 'glass'
    return 'wool_white'
  })
  for (let y = 1; y <= 3; y++) for (let x = -1; x <= 1; x++) place(x, y, -h, null)
  place(-2, 4, -h, 'glow')
  place(2, 4, -h, 'glow')
  for (let x = -h; x <= h; x++) for (let z = -h; z <= h; z++) place(x, 6, z, 'stonebrick')
  for (let x = -h + 1; x <= h - 1; x++)
    for (let z = -h + 1; z <= h - 1; z++)
      if (Math.abs(x) === h - 1 || Math.abs(z) === h - 1) place(x, 7, z, (x + z) % 2 ? 'wool_blue' : 'wool_white')
  for (let x = -2; x <= 2; x++) for (let z = -2; z <= 2; z++) place(x, 7, z, 'glass')
  place(0, 8, 0, 'glow')
  for (const x of [-2, 2]) place(x, 1, h - 1, 'glow')
  return 9
}

// Perjalanan — menara pantau dengan bendera (pintu = celah di antara tiang)
function tower(place) {
  floor(place, 2, 'planks')
  for (const x of [-2, 2]) for (const z of [-2, 2]) for (let y = 1; y <= 10; y++) place(x, y, z, 'log')
  for (const y of [5, 9]) {
    for (let x = -3; x <= 3; x++)
      for (let z = -3; z <= 3; z++) {
        if (y === 5 && (Math.abs(x) === 3 || Math.abs(z) === 3)) continue
        place(x, y, z, 'planks')
      }
  }
  for (let x = -3; x <= 3; x++) for (let z = -3; z <= 3; z++) place(x, 11, z, 'planks')
  for (let y = 12; y <= 16; y++) place(0, y, 0, 'log')
  for (let x = 1; x <= 4; x++) for (let y = 14; y <= 16; y++) place(x, y, 0, 'wool_red')
  place(0, 10, 0, 'glow')
  return 17
}

// Kontak — pondok pos kecil beratap biru
function cottage(place, h) {
  floor(place, h, 'planks')
  walls(place, h, 1, 3, (x, y, z) => {
    if (Math.abs(x) === h && Math.abs(z) === h) return 'log'
    if (y === 1) return 'cobble'
    if (y === 2 && Math.abs(x) === h && z === 0) return 'glass'
    return 'planks'
  })
  door(place, h)
  for (let x = -h - 1; x <= h + 1; x++) for (let z = -h - 1; z <= h + 1; z++) place(x, 4, z, 'wool_blue')
  for (let x = -h; x <= h; x++) for (let z = -h; z <= h; z++) place(x, 5, z, 'wool_blue')
  for (let x = -1; x <= 1; x++) for (let z = -1; z <= 1; z++) place(x, 6, z, 'wool_white')
  place(h - 1, 1, -h + 1, 'bookshelf')
  return 7
}

// =====================================================================
//  Tempat mini game
// =====================================================================

// ⛏ Tambang — bukit batu berisi bijih dengan lorong masuk
function mineEntrance(place, h) {
  const ores = ['ore_coal', 'ore_gold', 'ore_diamond']
  for (let y = 1; y <= 5; y++) {
    const r = h + 1 - Math.floor((y - 1) * 0.8)
    for (let x = -r; x <= r; x++)
      for (let z = -r; z <= r; z++) {
        if (Math.abs(x) + Math.abs(z) > r + 1) continue
        const t = (x * 7 + y * 3 + z * 5) % 9 === 0 ? ores[(x + z + y + 9) % 3] : y > 3 ? 'stone' : 'cobble'
        place(x, y, z, t)
      }
  }
  // lorong
  for (let z = -h - 1; z <= 1; z++) for (let y = 1; y <= 2; y++) place(0, y, z, null)
  floor(place, 1, 'stone')
  place(-1, 3, -h - 1, 'glow')
  place(1, 3, -h - 1, 'glow')
  place(0, 1, 2, 'ore_diamond')
  return 6
}

// 🃏 Memori — kios pasar beratap belang
function marketStall(place, h) {
  floor(place, h, 'planks')
  for (const x of [-h, h]) for (const z of [-h, h]) for (let y = 1; y <= 3; y++) place(x, y, z, 'log')
  for (let x = -h - 1; x <= h + 1; x++)
    for (let z = -h - 1; z <= h + 1; z++) place(x, 4, z, (x + h + 1) % 2 ? 'wool_red' : 'wool_white')
  for (let x = -h; x <= h; x++) for (let z = -h + 1; z <= h - 1; z++) place(x, 5, z, (x + h) % 2 ? 'wool_red' : 'wool_white')
  for (let x = -h + 1; x <= h - 1; x++) place(x, 1, h - 1, 'crafting')
  place(-h + 1, 2, h - 1, 'bookshelf')
  place(h - 1, 2, h - 1, 'glow')
  return 6
}

// 🟩 Pukul Slime — arena berpagar kayu dengan patung slime
function slimeArena(place, h) {
  for (let x = -h; x <= h; x++)
    for (let z = -h; z <= h; z++) {
      if (Math.abs(x) === h || Math.abs(z) === h) {
        if (Math.abs(x) <= 1 && z === -h) continue // pintu masuk
        place(x, 1, z, 'log')
      }
    }
  for (const [x, z] of [[-h, -h], [h, -h], [-h, h], [h, h]]) {
    place(x, 2, z, 'log')
    place(x, 3, z, 'glow')
  }
  // patung slime 3×3×3 + wajah
  for (let x = -1; x <= 1; x++) for (let y = 1; y <= 3; y++) for (let z = 1; z <= 3; z++) place(x, y, z, 'slime')
  place(-1, 3, 0, 'wool_black')
  place(1, 3, 0, 'wool_black')
  place(0, 2, 0, 'wool_black')
  return 5
}

// =====================================================================
//  Rumah Zafira — atap merah muda, kasur di pojok belakang
// =====================================================================
function zafiraHouse(place, h) {
  floor(place, h, 'planks')
  walls(place, h, 1, 3, (x, y, z) => {
    if (Math.abs(x) === h && Math.abs(z) === h) return 'log'
    if (y === 2 && (Math.abs(x) === 1 || Math.abs(z) === 1)) return 'glass'
    return 'wool_white'
  })
  door(place, h)
  for (let dy = 0; dy <= h + 1; dy++) {
    const ax = h + 1 - dy
    for (let z = -h - 1; z <= h + 1; z++) {
      place(ax, 4 + dy, z, 'wool_blue')
      place(-ax, 4 + dy, z, 'wool_blue')
    }
    for (let x = -ax + 1; x <= ax - 1; x++) {
      place(x, 4 + dy, -h, 'wool_white')
      place(x, 4 + dy, h, 'wool_white')
    }
  }
  place(h - 1, 1, h - 1, 'bookshelf')
  place(h - 1, 2, h - 1, 'bookshelf')
  place(h - 1, 1, h - 2, 'crafting')
  place(1, 3, h - 1, 'glow')
  return h + 6
}

// =====================================================================
//  Warung mie ayam — cukup area datar; gerobak & meja dibuat di Life.jsx
// =====================================================================
function warungStall() {
  // gerobak, meja, dan bangku dibuat sebagai model 3D di Life.jsx (tanpa atap)
  return 3
}

// =====================================================================
//  Puskesmas — dinding putih, atap hijau, palang merah di atas pintu
// =====================================================================
function puskesmas(place, h) {
  floor(place, h, 'stonebrick')
  walls(place, h, 1, 3, (x, y, z) => {
    if (y === 1) return 'stonebrick'
    if (y === 2 && Math.abs(x) === h && Math.abs(z) === 1) return 'glass'
    if (y === 2 && Math.abs(z) === h && Math.abs(x) === 2) return 'glass'
    return 'wool_white'
  })
  door(place, h)
  place(-1, 3, -h, 'wool_white') // lampu pintu diganti dinding (ada monitor EKG)
  for (let x = -h - 1; x <= h + 1; x++) for (let z = -h - 1; z <= h + 1; z++) place(x, 4, z, 'wool_green')
  // dinding depan menjulang dengan palang merah
  for (let x = -2; x <= 2; x++) for (let y = 5; y <= 7; y++) place(x, y, -h, 'wool_white')
  place(0, 5, -h, 'wool_red')
  place(0, 6, -h, 'wool_red')
  place(0, 7, -h, 'wool_red')
  place(-1, 6, -h, 'wool_red')
  place(1, 6, -h, 'wool_red')
  // isi: rak obat & kasur periksa
  place(h - 1, 1, h - 1, 'bookshelf')
  place(-h + 1, 1, h - 1, 'wool_white')
  place(-h + 1, 1, h - 2, 'wool_white')
  place(0, 3, 0, 'glow')
  return 8
}

// =====================================================================
//  Studio foto — dinding hitam, kaca besar, ikon kamera di atap
// =====================================================================
function photoStudio(place, h) {
  floor(place, h, 'planks')
  walls(place, h, 1, 3, (x, y, z) => {
    if (z === -h && Math.abs(x) <= 2) return 'glass' // etalase kaca depan
    if (Math.abs(x) === h && Math.abs(z) === h) return 'wool_white'
    return 'wool_black'
  })
  door(place, h)
  place(-1, 3, -h, 'glass')
  for (let x = -h - 1; x <= h + 1; x++) for (let z = -h - 1; z <= h + 1; z++) place(x, 4, z, 'wool_white')
  // ikon kamera di atap depan: badan hitam, lensa, blitz
  for (let x = -2; x <= 2; x++) for (let y = 5; y <= 6; y++) place(x, y, -h, 'wool_black')
  place(1, 7, -h, 'wool_black')
  place(0, 5, -h - 1, 'glass')
  place(0, 6, -h - 1, 'glass')
  place(-2, 7, -h, 'glow')
  // isi studio: latar putih & lampu
  for (let x = -2; x <= 2; x++) for (let y = 1; y <= 3; y++) place(x, y, h - 1, 'wool_white')
  place(0, 3, 0, 'glow')
  return 8
}
