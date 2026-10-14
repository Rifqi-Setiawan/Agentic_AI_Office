// Random deterministik (seed tetap → pulau selalu sama tiap kali dibuka)

export function rng(seed) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function hash(ix, iz, seed) {
  const s = Math.sin(ix * 127.1 + iz * 311.7 + seed * 74.7) * 43758.5453
  return s - Math.floor(s)
}

const smooth = (t) => t * t * (3 - 2 * t)

// Value noise 2D, hasil 0..1
export function noise2(x, z, seed = 0) {
  const ix = Math.floor(x)
  const iz = Math.floor(z)
  const fx = smooth(x - ix)
  const fz = smooth(z - iz)
  const a = hash(ix, iz, seed)
  const b = hash(ix + 1, iz, seed)
  const c = hash(ix, iz + 1, seed)
  const d = hash(ix + 1, iz + 1, seed)
  return a + (b - a) * fx + (c - a) * fz + (a - b - c + d) * fx * fz
}
