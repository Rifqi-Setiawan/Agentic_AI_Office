// Ambient musik + kicau burung, dibangkitkan via Web Audio API (tanpa file).
let ctx = null
let master = null
let timers = []
let playing = false

// progresi chord lembut (Hz)
const CHORDS = [
  [261.63, 329.63, 392.0], // C
  [392.0, 493.88, 587.33], // G
  [220.0, 261.63, 329.63], // Am
  [349.23, 440.0, 523.25], // F
]
let chordIdx = 0

function note(freq, start, dur, vol = 0.14, type = 'sine') {
  const o = ctx.createOscillator()
  const g = ctx.createGain()
  o.type = type
  o.frequency.value = freq
  o.connect(g)
  g.connect(master)
  g.gain.setValueAtTime(0, start)
  g.gain.linearRampToValueAtTime(vol, start + 0.15)
  g.gain.exponentialRampToValueAtTime(0.001, start + dur)
  o.start(start)
  o.stop(start + dur + 0.1)
}

function loopChords() {
  if (!playing) return
  const t = ctx.currentTime
  const chord = CHORDS[chordIdx % CHORDS.length]
  chord.forEach((f, i) => note(f, t, 2.4, 0.09, 'triangle'))
  // melodi kecil ceria
  note(chord[2] * 2, t + 0.1, 0.5, 0.06, 'sine')
  note(chord[1] * 2, t + 0.9, 0.5, 0.05, 'sine')
  chordIdx++
  const id = setTimeout(loopChords, 2200)
  timers.push(id)
}

function chirp() {
  const t = ctx.currentTime
  const o = ctx.createOscillator()
  const g = ctx.createGain()
  o.type = 'sine'
  const base = 1700 + Math.random() * 500
  o.frequency.setValueAtTime(base, t)
  o.frequency.exponentialRampToValueAtTime(base + 900, t + 0.07)
  o.frequency.exponentialRampToValueAtTime(base + 100, t + 0.15)
  g.gain.setValueAtTime(0, t)
  g.gain.linearRampToValueAtTime(0.05, t + 0.02)
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.22)
  o.connect(g)
  g.connect(master)
  o.start(t)
  o.stop(t + 0.25)
}

function loopBirds() {
  if (!playing) return
  const n = 1 + Math.floor(Math.random() * 2)
  for (let i = 0; i < n; i++) setTimeout(chirp, i * 180)
  const id = setTimeout(loopBirds, 2500 + Math.random() * 4000)
  timers.push(id)
}

export function startAmbient() {
  if (playing) return
  ctx = ctx || new (window.AudioContext || window.webkitAudioContext)()
  if (ctx.state === 'suspended') ctx.resume()
  master = ctx.createGain()
  master.gain.setValueAtTime(0, ctx.currentTime)
  master.gain.linearRampToValueAtTime(0.5, ctx.currentTime + 1.5)
  master.connect(ctx.destination)
  playing = true
  loopChords()
  loopBirds()
}

export function stopAmbient() {
  if (!playing) return
  playing = false
  timers.forEach(clearTimeout)
  timers = []
  if (master && ctx) master.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.5)
}

export function isPlaying() {
  return playing
}

// Efek klik pendek & nada "pencapaian" (Web Audio, tanpa file)
function ensureCtx() {
  ctx = ctx || new (window.AudioContext || window.webkitAudioContext)()
  if (ctx.state === 'suspended') ctx.resume()
  return ctx
}

function beep(freq, start, dur, vol, type) {
  const o = ctx.createOscillator()
  const g = ctx.createGain()
  o.type = type
  o.frequency.setValueAtTime(freq, start)
  g.gain.setValueAtTime(vol, start)
  g.gain.exponentialRampToValueAtTime(0.001, start + dur)
  o.connect(g)
  g.connect(ctx.destination)
  o.start(start)
  o.stop(start + dur + 0.02)
}

export function clickSound() {
  try {
    ensureCtx()
    const t = ctx.currentTime
    beep(520, t, 0.05, 0.08, 'square')
    beep(780, t + 0.03, 0.05, 0.05, 'square')
  } catch (e) {
    /* tidak didukung */
  }
}

export function advancementSound() {
  try {
    ensureCtx()
    const t = ctx.currentTime
    ;[523.25, 659.25, 783.99, 1046.5].forEach((f, i) => beep(f, t + i * 0.09, 0.35, 0.07, 'triangle'))
  } catch (e) {
    /* tidak didukung */
  }
}

// Bunyi ketikan pendek (nada acak sedikit supaya terasa alami)
export function typeSound() {
  try {
    ensureCtx()
    const t = ctx.currentTime
    beep(380 + Math.random() * 160, t, 0.035, 0.035, 'square')
  } catch (e) {
    /* tidak didukung */
  }
}

export function unlockAudio() {
  try {
    ensureCtx()
  } catch (e) {
    /* tidak didukung */
  }
}

// Denting "cling" untuk tombol
export function clingSound() {
  try {
    ensureCtx()
    const t = ctx.currentTime
    beep(1318.5, t, 0.18, 0.06, 'triangle')
    beep(1975.5, t + 0.06, 0.28, 0.05, 'triangle')
  } catch (e) {
    /* tidak didukung */
  }
}

// Bunyi jepret kamera (desis pendek)
export function shutterSound() {
  try {
    ensureCtx()
    const t = ctx.currentTime
    const len = Math.floor(ctx.sampleRate * 0.12)
    const buf = ctx.createBuffer(1, len, ctx.sampleRate)
    const d = buf.getChannelData(0)
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len)
    const src = ctx.createBufferSource()
    const g = ctx.createGain()
    src.buffer = buf
    g.gain.setValueAtTime(0.25, t)
    src.connect(g)
    g.connect(ctx.destination)
    src.start(t)
    beep(1800, t, 0.04, 0.05, 'square')
  } catch (e) {
    /* tidak didukung */
  }
}
