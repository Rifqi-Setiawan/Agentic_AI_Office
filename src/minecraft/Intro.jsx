import { useEffect, useMemo, useRef, useState } from 'react'
import { typeSound } from '../sound'

// =====================================================================
//  Perkenalan di awal: kertas coklat + Zafira pixel melambai + teks diketik
// =====================================================================

const SKIN = '#e7b48f'
const SKIN_D = '#cf9a76'
const HAIR = '#1e293b'
const SHIRT = '#0f172a'
const SHIRT_D = '#020617'
const PANTS = '#334155'
const PANTS_D = '#1e293b'
const SHOE = '#0284c7'

// Gambar Rifqi (16×32 pixel). wave = tangan kanan diangkat
function drawZafira(wave) {
  const c = document.createElement('canvas')
  c.width = 16
  c.height = 32
  const g = c.getContext('2d')
  const p = (x, y, col) => {
    g.fillStyle = col
    g.fillRect(x, y, 1, 1)
  }
  const rect = (x0, y0, w, h, col) => {
    g.fillStyle = col
    g.fillRect(x0, y0, w, h)
  }
  // kepala & rambut pendek modern
  rect(4, 0, 8, 8, SKIN)
  rect(3, 0, 10, 3, HAIR)
  p(3, 3, HAIR)
  p(12, 3, HAIR)
  p(5, 4, '#ffffff')
  p(6, 4, '#1e3a8a')
  p(9, 4, '#1e3a8a')
  p(10, 4, '#ffffff')
  p(7, 6, '#a0604a')
  p(8, 6, '#a0604a')
  // badan
  rect(4, 8, 8, 12, SHIRT)
  rect(4, 8, 1, 12, SHIRT_D)
  // tangan kiri (turun)
  rect(0, 8, 4, 10, SHIRT)
  rect(0, 8, 1, 10, SHIRT_D)
  rect(0, 18, 4, 2, SKIN)
  // tangan kanan
  if (wave) {
    rect(12, 0, 4, 10, SHIRT)
    rect(15, 0, 1, 10, SHIRT_D)
    rect(12, 0, 4, 2, SKIN)
    p(15, 0, SKIN_D)
  } else {
    rect(12, 8, 4, 10, SHIRT)
    rect(15, 8, 1, 10, SHIRT_D)
    rect(12, 18, 4, 2, SKIN)
  }
  // kaki
  rect(4, 20, 4, 12, PANTS)
  rect(8, 20, 4, 12, PANTS_D)
  rect(4, 30, 8, 2, SHOE)
  return c.toDataURL()
}

export default function Intro({ t, onDone }) {
  const frames = useMemo(() => [drawZafira(false), drawZafira(true)], [])
  const [frame, setFrame] = useState(1)
  const [line, setLine] = useState(0)
  const [shown, setShown] = useState(0)
  const [leaving, setLeaving] = useState(false)
  const lines = t.intro
  const text = lines[line]
  const typing = shown < text.length
  const last = line === lines.length - 1
  const timer = useRef()

  // lambaian tangan
  useEffect(() => {
    const id = setInterval(() => setFrame((f) => 1 - f), 420)
    return () => clearInterval(id)
  }, [])

  // efek mengetik huruf demi huruf
  useEffect(() => {
    if (!typing) return
    const ch = text[shown]
    const delay = ch === '.' || ch === ',' || ch === '!' ? 160 : 38
    timer.current = setTimeout(() => {
      if (ch && ch !== ' ') typeSound()
      setShown((n) => n + 1)
    }, delay)
    return () => clearTimeout(timer.current)
  }, [shown, typing, text])

  const finish = () => {
    setLeaving(true)
    setTimeout(onDone, 450)
  }

  // klik/Enter/Spasi: selesaikan ketikan → kalimat berikutnya
  const advance = () => {
    if (typing) setShown(text.length)
    else if (!last) {
      setLine((l) => l + 1)
      setShown(0)
    }
  }

  useEffect(() => {
    const on = (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault()
        if (!typing && last) finish()
        else advance()
      }
      if (e.key === 'Escape') finish()
    }
    window.addEventListener('keydown', on)
    return () => window.removeEventListener('keydown', on)
  })

  return (
    <div
      className={`mc-intro fixed inset-0 z-[45] flex items-end justify-center p-3 pb-6 transition-opacity duration-500 md:items-center ${
        leaving ? 'opacity-0' : 'opacity-100'
      }`}
      onClick={advance}
    >
      <div className="mc-parchment mc-pop relative w-full max-w-[760px]" role="dialog" aria-label={t.introTitle}>
        <button
          className="absolute right-3 top-3 text-[15px] text-[#5a3d1e] underline-offset-2 hover:underline"
          onClick={(e) => {
            e.stopPropagation()
            finish()
          }}
        >
          {t.skip} ⏭
        </button>
        <div className="flex items-center gap-4 md:gap-7">
          <div className="mc-portrait shrink-0">
            <img src={frames[frame]} alt="Zafira" className="h-[128px] w-[64px] md:h-[176px] md:w-[88px]" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="mb-2 font-pixel text-[10px] text-[#7a4e22] md:text-[11px]">{t.introTitle}</div>
            <p className="min-h-[96px] text-[19px] leading-snug text-[#3a2410] md:min-h-[120px] md:text-[24px]" aria-live="polite">
              {text.slice(0, shown)}
              <span className={`mc-caret ${typing ? '' : 'is-blink'}`}>▌</span>
            </p>
          </div>
        </div>
        <div className="mt-3 flex items-center justify-between gap-3">
          <div className="flex gap-1.5" aria-hidden>
            {lines.map((_, i) => (
              <span key={i} className={`h-2.5 w-2.5 border border-[#5a3d1e] ${i <= line ? 'bg-[#7a4e22]' : ''}`} />
            ))}
          </div>
          {!typing && last ? (
            <button
              className="mc-btn mc-pop !px-5 !text-[18px]"
              onClick={(e) => {
                e.stopPropagation()
                finish()
              }}
              autoFocus
            >
              {t.explore} ▶
            </button>
          ) : (
            <span className="text-[15px] text-[#7a4e22]">{typing ? '' : t.tapNext} ▼</span>
          )}
        </div>
      </div>
    </div>
  )
}
