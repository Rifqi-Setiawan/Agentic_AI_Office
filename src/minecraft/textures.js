import * as THREE from 'three'
import { rng } from './noise'

// =====================================================================
//  Tekstur pixel 16×16, semuanya digambar lewat kode (bukan aset Minecraft).
// =====================================================================

const S = 16
const canvases = {}

function make(name, seed, draw) {
  const c = document.createElement('canvas')
  c.width = S
  c.height = S
  const g = c.getContext('2d')
  const r = rng(seed)
  const px = (x, y, col) => {
    g.fillStyle = col
    g.fillRect(x, y, 1, 1)
  }
  const pick = (arr) => arr[Math.floor(r() * arr.length)]
  draw({ g, r, px, pick })
  canvases[name] = c
}

const fill = (px, pick, pal) => {
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) px(x, y, pick(pal))
}

const GRASS = ['#5d9b3a', '#6aaa45', '#7cbd52', '#4f8a31', '#67a640']
const DIRT = ['#866043', '#79553a', '#966c4a', '#8b6446', '#6e4c33']
const STONE = ['#7d7d7d', '#8a8a8a', '#747474', '#808080', '#6b6b6b']
const PLANK = ['#b08a53', '#a8834f', '#b9935c', '#9f7b48']
const LEAF = ['#3f7d2a', '#4a8f32', '#2f6a20', '#559b3a']

function buildAll() {
  make('grass_top', 1, ({ px, pick }) => fill(px, pick, GRASS))
  make('dirt', 2, ({ px, pick, r }) => {
    fill(px, pick, DIRT)
    for (let i = 0; i < 10; i++) px(Math.floor(r() * S), Math.floor(r() * S), '#5a3d27')
  })
  make('grass_side', 3, ({ px, pick, r }) => {
    fill(px, pick, DIRT)
    for (let x = 0; x < S; x++) {
      const d = 3 + (r() < 0.45 ? 1 : 0) + (r() < 0.2 ? 1 : 0)
      for (let y = 0; y < d; y++) px(x, y, pick(GRASS))
    }
  })
  make('path', 4, ({ px, pick }) => fill(px, pick, ['#94784a', '#a08552', '#8a6d40', '#9a7c4c']))
  make('stone', 5, ({ px, pick, r }) => {
    fill(px, pick, STONE)
    for (let i = 0; i < 6; i++) {
      const x = Math.floor(r() * 13)
      const y = Math.floor(r() * S)
      for (let k = 0; k < 3; k++) px(x + k, y, '#666666')
    }
  })
  make('cobble', 6, ({ g, px, r, pick }) => {
    g.fillStyle = '#4f4f4f'
    g.fillRect(0, 0, S, S)
    for (let i = 0; i < 14; i++) {
      const w = 3 + Math.floor(r() * 4)
      const h = 2 + Math.floor(r() * 3)
      const x = Math.floor(r() * (S - 2))
      const y = Math.floor(r() * (S - 2))
      const base = pick(['#8f8f8f', '#7a7a7a', '#9c9c9c', '#868686'])
      for (let yy = 0; yy < h; yy++)
        for (let xx = 0; xx < w; xx++) if (x + xx < S && y + yy < S) px(x + xx, y + yy, base)
      px(x, y, '#b0b0b0')
    }
  })
  make('stonebrick', 7, ({ px, pick }) => {
    fill(px, pick, ['#7f7f7f', '#878787', '#797979'])
    for (let y = 0; y < S; y++) {
      for (let x = 0; x < S; x++) {
        const row = Math.floor(y / 4)
        const off = row % 2 ? 4 : 0
        if (y % 4 === 3 || (x + off) % 8 === 7) px(x, y, '#555555')
      }
    }
  })
  make('planks', 8, ({ px, pick, r }) => {
    fill(px, pick, PLANK)
    for (let y = 0; y < S; y++) {
      const row = Math.floor(y / 4)
      for (let x = 0; x < S; x++) {
        if (y % 4 === 3) px(x, y, '#7a5c33')
        if (x === (row * 5 + 3) % S && y % 4 !== 3) px(x, y, '#86663a')
      }
    }
    for (let i = 0; i < 8; i++) px(Math.floor(r() * S), Math.floor(r() * S), '#c39d65')
  })
  make('log_side', 9, ({ px, r }) => {
    const cols = ['#6b5130', '#5a4327', '#7a5e39', '#634a2c']
    for (let x = 0; x < S; x++) {
      const c = cols[(x + (x % 3 === 0 ? 1 : 0)) % cols.length]
      for (let y = 0; y < S; y++) px(x, y, r() < 0.12 ? '#4a3620' : c)
    }
  })
  make('log_top', 10, ({ px }) => {
    for (let y = 0; y < S; y++) {
      for (let x = 0; x < S; x++) {
        const d = Math.max(Math.abs(x - 7.5), Math.abs(y - 7.5))
        let c = d > 6.5 ? '#6b5130' : Math.floor(d) % 2 ? '#a88552' : '#c4a06a'
        if (d < 1) c = '#b8945f'
        px(x, y, c)
      }
    }
  })
  make('leaves', 11, ({ g, px, pick, r }) => {
    g.clearRect(0, 0, S, S)
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) if (r() > 0.18) px(x, y, pick(LEAF))
  })
  make('glass', 12, ({ g, px }) => {
    g.clearRect(0, 0, S, S)
    for (let i = 0; i < S; i++) {
      px(i, 0, '#dbeef5')
      px(i, S - 1, '#dbeef5')
      px(0, i, '#dbeef5')
      px(S - 1, i, '#dbeef5')
    }
    for (let i = 3; i < 7; i++) px(i, 10 - i, 'rgba(255,255,255,0.85)')
    for (let i = 8; i < 11; i++) px(i, 16 - i, 'rgba(255,255,255,0.85)')
  })
  make('water', 13, ({ px, pick }) => fill(px, pick, ['#3d6fd6', '#4677de', '#3566cc', '#4a7fe3']))
  make('sand', 14, ({ px, pick }) => fill(px, pick, ['#dbd3a0', '#e3dbb0', '#cfc58f', '#d8cf9a']))
  make('brick', 15, ({ px, pick }) => {
    fill(px, pick, ['#9a4f3f', '#a5574a', '#8e4636'])
    for (let y = 0; y < S; y++) {
      for (let x = 0; x < S; x++) {
        const row = Math.floor(y / 4)
        const off = row % 2 ? 4 : 0
        if (y % 4 === 3 || (x + off) % 8 === 7) px(x, y, '#a7a59b')
      }
    }
  })
  make('bookshelf', 16, ({ px, pick, r }) => {
    fill(px, pick, PLANK)
    const books = ['#8c2b2b', '#2b4f8c', '#2f7a3a', '#8c6d2b', '#5b2b8c', '#2b7a7a']
    for (const [y0, y1] of [[2, 6], [9, 13]]) {
      let x = 1
      while (x < 15) {
        const w = r() < 0.3 ? 2 : 1
        const col = pick(books)
        const top = y0 + (r() < 0.3 ? 1 : 0)
        for (let xx = 0; xx < w && x + xx < 15; xx++)
          for (let y = top; y <= y1; y++) px(x + xx, y, y === top ? '#e8d7a8' : col)
        x += w
      }
    }
    for (let x = 0; x < S; x++) {
      px(x, 7, '#7a5c33')
      px(x, 14, '#7a5c33')
    }
  })
  make('crafting_top', 17, ({ px, pick }) => {
    fill(px, pick, PLANK)
    for (let i = 0; i < S; i++) {
      px(i, 0, '#5a4327')
      px(i, 15, '#5a4327')
      px(0, i, '#5a4327')
      px(15, i, '#5a4327')
      px(i, 5, '#7a5c33')
      px(i, 10, '#7a5c33')
      px(5, i, '#7a5c33')
      px(10, i, '#7a5c33')
    }
  })
  make('crafting_side', 18, ({ px, pick }) => {
    fill(px, pick, PLANK)
    for (let x = 0; x < S; x++) {
      px(x, 0, '#5a4327')
      px(x, 1, '#5a4327')
    }
    // gergaji & palu kecil
    for (let x = 3; x < 8; x++) px(x, 6, '#c8c8c8')
    for (let y = 5; y < 9; y++) px(8, y, '#6b5130')
    for (let y = 5; y < 12; y++) px(11, y, '#6b5130')
    for (let x = 10; x < 14; x++) px(x, 5, '#8a8a8a')
  })
  make('furnace', 19, ({ px, pick }) => {
    fill(px, pick, STONE)
    for (let y = 8; y < 14; y++) for (let x = 4; x < 12; x++) px(x, y, '#1e1e1e')
    for (let x = 5; x < 11; x++) {
      px(x, 12, '#ff9a2e')
      px(x, 11, x % 2 ? '#ffd451' : '#ff7a2e')
    }
    for (let x = 3; x < 13; x++) px(x, 2, '#555555')
  })
  make('glow', 20, ({ px, pick, r }) => {
    fill(px, pick, ['#f9d46b', '#e8b74a', '#fff0a8', '#f2c75a'])
    for (let i = 0; i < 10; i++) px(Math.floor(r() * S), Math.floor(r() * S), '#a8742a')
  })
  make('wool_red', 21, ({ px, pick }) => fill(px, pick, ['#b02e26', '#a72a22', '#bb352c']))
  make('wool_white', 22, ({ px, pick }) => fill(px, pick, ['#e9ecec', '#dfe3e3', '#f2f4f4']))
  make('wool_blue', 23, ({ px, pick }) => fill(px, pick, ['#3c4fa0', '#35489a', '#4558aa']))

  make('farmland', 24, ({ px, pick }) => {
    fill(px, pick, ['#5a3d27', '#4f3522', '#634430'])
    for (let y = 0; y < S; y += 4) for (let x = 0; x < S; x++) px(x, y, '#3f2a1a')
  })

  const ore = (name, seed, cols) =>
    make(name, seed, ({ px, pick, r }) => {
      fill(px, pick, STONE)
      for (let i = 0; i < 6; i++) {
        const x = 1 + Math.floor(r() * 12)
        const y = 1 + Math.floor(r() * 12)
        px(x, y, cols[0])
        px(x + 1, y, cols[1])
        px(x, y + 1, cols[1])
        if (r() < 0.6) px(x + 1, y + 1, cols[0])
      }
    })
  ore('ore_coal', 25, ['#2b2b2b', '#444444'])
  ore('ore_gold', 26, ['#f6d32b', '#c99a2e'])
  ore('ore_diamond', 27, ['#5ee6e0', '#2fb8b2'])
  make('slime', 28, ({ px, pick }) => {
    fill(px, pick, ['#76c95b', '#6abf4f', '#82d466'])
    for (let i = 0; i < S; i++) {
      px(i, 0, '#4f9a3a')
      px(i, 15, '#4f9a3a')
      px(0, i, '#4f9a3a')
      px(15, i, '#4f9a3a')
    }
  })
  make('wool_green', 35, ({ px, pick }) => fill(px, pick, ['#3f8f4a', '#3a8544', '#46995a']))
  make('wool_pink', 34, ({ px, pick }) => fill(px, pick, ['#f08cb4', '#e57fa8', '#f59ac0']))
  make('wool_black', 29, ({ px, pick }) => fill(px, pick, ['#1d1d21', '#25252a', '#18181c']))

  // ——— tanaman (sprite silang) ———
  make('poppy', 30, ({ g, px }) => {
    g.clearRect(0, 0, S, S)
    for (let y = 7; y < 16; y++) px(8, y, '#3f7d2a')
    px(7, 11, '#4a8f32')
    px(6, 10, '#4a8f32')
    for (const [x, y] of [[7, 4], [8, 4], [9, 4], [6, 5], [7, 5], [8, 5], [9, 5], [10, 5], [7, 6], [8, 6], [9, 6]])
      px(x, y, '#d8312a')
    px(8, 5, '#3a1a10')
  })
  make('dandelion', 31, ({ g, px }) => {
    g.clearRect(0, 0, S, S)
    for (let y = 8; y < 16; y++) px(8, y, '#3f7d2a')
    px(9, 12, '#4a8f32')
    for (const [x, y] of [[7, 6], [8, 6], [9, 6], [7, 7], [8, 7], [9, 7], [8, 5]]) px(x, y, '#f6d32b')
  })
  make('wheat', 33, ({ g, px, r }) => {
    g.clearRect(0, 0, S, S)
    for (let x = 1; x < S; x += 3) {
      const h = 9 + Math.floor(r() * 5)
      for (let y = S - 1; y > S - 1 - h; y--) px(x, y, y < S - h + 3 ? '#d9b13b' : '#8aa83a')
      px(x + 1, S - h + 1, '#c99a2e')
    }
  })
  make('tallgrass', 32, ({ g, px, r }) => {
    g.clearRect(0, 0, S, S)
    for (let i = 0; i < 7; i++) {
      const x = 2 + Math.floor(r() * 12)
      const h = 5 + Math.floor(r() * 7)
      for (let y = S - 1; y > S - 1 - h; y--) px(x, y, r() < 0.5 ? '#5d9b3a' : '#4f8a31')
    }
  })
}

// ——— Bagaimana tiap blok memetakan tekstur ke 6 sisi (+x,-x,+y,-y,+z,-z) ———
const FACES = {
  grass: ['grass_side', 'grass_side', 'grass_top', 'dirt', 'grass_side', 'grass_side'],
  log: ['log_side', 'log_side', 'log_top', 'log_top', 'log_side', 'log_side'],
  bookshelf: ['bookshelf', 'bookshelf', 'planks', 'planks', 'bookshelf', 'bookshelf'],
  crafting: ['crafting_side', 'crafting_side', 'crafting_top', 'planks', 'crafting_side', 'crafting_side'],
  furnace: ['furnace', 'furnace', 'stone', 'stone', 'furnace', 'furnace'],
  farmland: ['dirt', 'dirt', 'farmland', 'dirt', 'dirt', 'dirt'],
}

export const BLOCK_TYPES = [
  'grass', 'dirt', 'path', 'stone', 'cobble', 'stonebrick', 'planks', 'log', 'leaves', 'glass',
  'water', 'sand', 'brick', 'bookshelf', 'crafting', 'furnace', 'glow', 'wool_red', 'wool_white', 'wool_blue', 'farmland',
  'ore_coal', 'ore_gold', 'ore_diamond', 'slime', 'wool_black', 'wool_pink', 'wool_green',
]

// Blok yang tidak menutupi tetangganya (tembus pandang)
export const SEE_THROUGH = new Set(['leaves', 'glass', 'water'])

let built = false
const ensure = () => {
  if (!built) {
    buildAll()
    built = true
  }
}

const texCache = {}
function tex(name) {
  if (!texCache[name]) {
    const t = new THREE.CanvasTexture(canvases[name])
    t.magFilter = THREE.NearestFilter
    t.minFilter = THREE.NearestMipmapLinearFilter
    t.colorSpace = THREE.SRGBColorSpace
    texCache[name] = t
  }
  return texCache[name]
}

// ——— "Tembus pandang" di antara kamera & Zafira (supaya dia tidak tertutup rumah/pohon) ———
export const CUTAWAY = {
  uPlayer: { value: new THREE.Vector3() },
  uCam: { value: new THREE.Vector3() },
  uOn: { value: 0 },
}

// Waktu bersama untuk efek angin (diperbarui tiap frame dari Scene)
export const WIND = { uTime: { value: 0 } }

function withCutaway(m, sway = false) {
  m.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, CUTAWAY, WIND)
    shader.vertexShader = `varying vec3 vCutPos;
uniform float uTime;
${shader.vertexShader}`
      .replace(
        '#include <begin_vertex>',
        sway
          ? `#include <begin_vertex>
      // daun bergoyang pelan tertiup angin
      transformed.x += sin(uTime * 1.6 + transformed.y * 0.7 + transformed.z * 0.4) * 0.045;
      transformed.z += cos(uTime * 1.3 + transformed.x * 0.5) * 0.035;`
          : '#include <begin_vertex>',
      )
      .replace(
      '#include <project_vertex>',
      `#include <project_vertex>
      vec4 cutP = vec4(transformed, 1.0);
      #ifdef USE_INSTANCING
        cutP = instanceMatrix * cutP;
      #endif
      vCutPos = (modelMatrix * cutP).xyz;`,
    )
    shader.fragmentShader =
      `uniform vec3 uPlayer;
uniform vec3 uCam;
uniform float uOn;
varying vec3 vCutPos;
` +
      shader.fragmentShader.replace(
        'void main() {',
        `void main() {
        if (uOn > 0.01) {
          vec3 seg = uPlayer - uCam;
          float t = clamp(dot(vCutPos - uCam, seg) / dot(seg, seg), 0.0, 1.0);
          float d = length(vCutPos - (uCam + seg * t));
          float r = 2.8 * uOn;
          if (t < 0.96 && d < r && vCutPos.y > uPlayer.y - 0.9) {
            float a = smoothstep(r, r * 0.35, d);
            // pola titik-titik (screen-door) supaya terlihat transparan
            float checker = mod(floor(gl_FragCoord.x) + floor(gl_FragCoord.y), 2.0);
            if (a > 0.85 || (a > 0.25 && checker < 1.0)) discard;
          }
        }`,
      )
  }
  m.customProgramCacheKey = () => (sway ? 'cutaway-sway' : 'cutaway')
  return m
}

const matCache = {}
export function blockMaterial(type) {
  ensure()
  if (matCache[type]) return matCache[type]
  const opts = (name) => {
    const o = { map: tex(name) }
    if (type === 'leaves') Object.assign(o, { alphaTest: 0.5, side: THREE.DoubleSide })
    if (type === 'glass') Object.assign(o, { alphaTest: 0.1 })
    if (type === 'water') Object.assign(o, { transparent: true, opacity: 0.72, depthWrite: false })
    return o
  }
  let m
  if (type === 'glow') m = withCutaway(new THREE.MeshBasicMaterial({ map: tex('glow') }))
  else if (FACES[type]) m = FACES[type].map((n) => withCutaway(new THREE.MeshLambertMaterial(opts(n))))
  else m = withCutaway(new THREE.MeshLambertMaterial(opts(type)), type === 'leaves')
  matCache[type] = m
  return m
}

export function plantMaterial(name) {
  ensure()
  const key = 'plant_' + name
  if (!matCache[key]) {
    const m = new THREE.MeshLambertMaterial({ map: tex(name), alphaTest: 0.5, side: THREE.DoubleSide })
    // rumput & bunga bergoyang: hanya bagian atas yang bergerak
    m.onBeforeCompile = (shader) => {
      Object.assign(shader.uniforms, WIND)
      shader.vertexShader = `uniform float uTime;
${shader.vertexShader}`.replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        vec4 plantPos = instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);
        float top = max(0.0, position.y + 0.5);
        transformed.x += sin(uTime * 2.4 + plantPos.x * 0.6 + plantPos.z * 0.35) * 0.14 * top;
        transformed.z += cos(uTime * 1.9 + plantPos.z * 0.5) * 0.08 * top;`,
      )
    }
    m.customProgramCacheKey = () => 'plant-sway'
    matCache[key] = m
  }
  return matCache[key]
}

// Ikon kubus isometrik (buat slot hotbar & inventory)
const iconCache = {}
export function blockIcon(type) {
  ensure()
  if (iconCache[type]) return iconCache[type]
  const f = FACES[type] || Array(6).fill(type)
  const top = canvases[f[2]]
  const left = canvases[f[4]]
  const right = canvases[f[0]]
  const c = document.createElement('canvas')
  c.width = 32
  c.height = 34
  const g = c.getContext('2d')
  g.imageSmoothingEnabled = false
  const face = (img, m, shade) => {
    g.setTransform(...m)
    g.drawImage(img, 0, 0)
    if (shade) {
      g.fillStyle = `rgba(0,0,0,${shade})`
      g.fillRect(0, 0, S, S)
    }
  }
  face(top, [1, -0.5, 1, 0.5, 0, 8], 0)
  face(left, [1, 0.5, 0, 1.125, 0, 8], 0.18)
  face(right, [1, -0.5, 0, 1.125, 16, 16], 0.38)
  iconCache[type] = c.toDataURL()
  return iconCache[type]
}

export function textureURL(name) {
  ensure()
  return canvases[name].toDataURL()
}

export function repeatTexture(name, n) {
  ensure()
  const t = new THREE.CanvasTexture(canvases[name])
  t.magFilter = THREE.NearestFilter
  t.minFilter = THREE.NearestMipmapLinearFilter
  t.colorSpace = THREE.SRGBColorSpace
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  t.repeat.set(n, n)
  return t
}
