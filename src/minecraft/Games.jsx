import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { blockIcon, textureURL } from './textures'
import { clickSound, typeSound, advancementSound } from '../sound'

// =====================================================================
//  3 mini game (semua gambar dibuat sendiri)
// =====================================================================

const best = {
  get: (k) => {
    try {
      return Number(localStorage.getItem(`best-${k}`)) || 0
    } catch (e) {
      return 0
    }
  },
  set: (k, v) => {
    try {
      localStorage.setItem(`best-${k}`, String(v))
    } catch (e) {
      /* abaikan */
    }
  },
}

function useCountdown(running, seconds, onEnd) {
  const [left, setLeft] = useState(seconds)
  const end = useRef(onEnd)
  end.current = onEnd
  useEffect(() => {
    if (!running) return
    setLeft(seconds)
    const started = Date.now()
    const id = setInterval(() => {
      const l = Math.max(0, seconds - (Date.now() - started) / 1000)
      setLeft(l)
      if (l <= 0) {
        clearInterval(id)
        end.current()
      }
    }, 100)
    return () => clearInterval(id)
  }, [running, seconds])
  return left
}

function Hud({ items }) {
  return (
    <div className="mb-3 flex flex-wrap gap-2">
      {items.map(([k, v]) => (
        <div key={k} className="mc-inset px-3 py-1 text-[15px] text-[#2a1a08]">
          {k}: <b className="font-pixel text-[11px]">{v}</b>
        </div>
      ))}
    </div>
  )
}

function Result({ title, lines, onAgain, t }) {
  return (
    <div className="mc-inset mc-pop p-4 text-center">
      <div className="font-pixel text-[13px] text-[#2a1a08]">{title}</div>
      {lines.map((l) => (
        <div key={l} className="mt-2 text-[17px] text-[#3a2410]">{l}</div>
      ))}
      <button className="mc-btn mt-3" onClick={onAgain}>↻ {t.g.again}</button>
    </div>
  )
}

// ——— ⛏ Tambang: hancurkan blok, kumpulkan bijih dalam 30 detik ———
const ORES = {
  stone: { hits: 1, pts: 1 },
  ore_coal: { hits: 2, pts: 5 },
  ore_gold: { hits: 3, pts: 20 },
  ore_diamond: { hits: 4, pts: 50 },
}
function newMine() {
  return Array.from({ length: 36 }, () => {
    const r = Math.random()
    const type = r < 0.08 ? 'ore_diamond' : r < 0.2 ? 'ore_gold' : r < 0.42 ? 'ore_coal' : 'stone'
    return { type, hp: ORES[type].hits, broken: false }
  })
}

function MineGame({ t, sound, onDone }) {
  const [state, setState] = useState('ready')
  const [grid, setGrid] = useState(newMine)
  const [score, setScore] = useState(0)
  const [pops, setPops] = useState([])
  const [record, setRecord] = useState(() => best.get('mine'))
  const scoreRef = useRef(0)
  const imgs = useMemo(() => Object.fromEntries(Object.keys(ORES).map((k) => [k, textureURL(k)])), [])

  const finish = useCallback(() => {
    setState('done')
    onDone()
    if (scoreRef.current > best.get('mine')) {
      best.set('mine', scoreRef.current)
      setRecord(scoreRef.current)
      if (sound) advancementSound()
    }
  }, [sound, onDone])
  const left = useCountdown(state === 'play', 30, finish)

  const start = () => {
    setGrid(newMine())
    setScore(0)
    scoreRef.current = 0
    setState('play')
  }

  const hit = (i) => {
    if (state !== 'play') return
    const c = grid[i]
    if (c.broken) return
    if (sound) typeSound()
    const next = grid.slice()
    const hp = c.hp - 1
    if (hp <= 0) {
      next[i] = { ...c, hp: 0, broken: true }
      const pts = ORES[c.type].pts
      scoreRef.current += pts
      setScore(scoreRef.current)
      const id = Math.random()
      setPops((p) => [...p, { id, i, pts }])
      setTimeout(() => setPops((p) => p.filter((x) => x.id !== id)), 700)
      if (sound && pts >= 20) clickSound()
      // semua habis → isi ulang
      if (next.every((x) => x.broken)) {
        setGrid(newMine())
        return
      }
    } else next[i] = { ...c, hp }
    setGrid(next)
  }

  return (
    <div>
      <p className="mb-2 text-[15px] leading-snug text-[#4a3a24]">{t.g.mineHelp}</p>
      <Hud items={[[t.g.time, `${Math.ceil(left)}s`], [t.g.score, score], [t.g.best, record]]} />
      {state === 'done' ? (
        <Result title={t.g.timeUp} lines={[`${t.g.score}: ${score}`]} onAgain={start} t={t} />
      ) : (
        <div className="relative">
          <div className="grid grid-cols-6 gap-1">
            {grid.map((c, i) => (
              <button
                key={i}
                onClick={() => hit(i)}
                className="relative aspect-square border-2 border-[#3a2410] active:scale-95"
                style={{
                  backgroundImage: c.broken ? 'none' : `url(${imgs[c.type]})`,
                  backgroundSize: 'cover',
                  backgroundColor: c.broken ? '#2a1d12' : undefined,
                  imageRendering: 'pixelated',
                }}
                aria-label={c.broken ? '' : c.type}
              >
                {!c.broken && c.hp < ORES[c.type].hits && (
                  <span className="mc-crack" style={{ opacity: 1 - c.hp / ORES[c.type].hits + 0.2 }} />
                )}
                {pops.filter((p) => p.i === i).map((p) => (
                  <span key={p.id} className="mc-floatpts">+{p.pts}</span>
                ))}
              </button>
            ))}
          </div>
          {state === 'ready' && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/40">
              <button className="mc-btn !text-[18px]" onClick={start}>▶ {t.g.play}</button>
            </div>
          )}
        </div>
      )}
      <div className="mt-2 flex flex-wrap gap-3 text-[13px] text-[#4a3a24]">
        {Object.entries(ORES).map(([k, v]) => (
          <span key={k} className="flex items-center gap-1">
            <img src={imgs[k]} alt="" className="h-4 w-4 [image-rendering:pixelated]" /> {v.pts} pt
          </span>
        ))}
      </div>
    </div>
  )
}

// ——— 🃏 Memori Blok: cocokkan pasangan kartu ———
const CARD_TYPES = ['grass', 'planks', 'bookshelf', 'crafting', 'glow', 'log', 'ore_diamond', 'slime']
function newDeck() {
  const pick = CARD_TYPES.slice().sort(() => Math.random() - 0.5).slice(0, 6)
  return [...pick, ...pick]
    .sort(() => Math.random() - 0.5)
    .map((type, i) => ({ id: i, type, open: false, done: false }))
}

function MemoryGame({ t, sound, onDone }) {
  const [deck, setDeck] = useState(newDeck)
  const [sel, setSel] = useState([])
  const [moves, setMoves] = useState(0)
  const [record, setRecord] = useState(() => best.get('memory'))
  const won = deck.every((c) => c.done)

  useEffect(() => {
    if (!won) return
    onDone()
    if (!record || moves < record) {
      best.set('memory', moves)
      setRecord(moves)
    }
    if (sound) advancementSound()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [won])

  const flip = (i) => {
    if (sel.length === 2 || deck[i].open || deck[i].done) return
    if (sound) typeSound()
    const next = deck.map((c, j) => (j === i ? { ...c, open: true } : c))
    const s = [...sel, i]
    setDeck(next)
    setSel(s)
    if (s.length === 2) {
      setMoves((m) => m + 1)
      const [a, b] = s
      if (next[a].type === next[b].type) {
        setTimeout(() => {
          setDeck((d) => d.map((c, j) => (j === a || j === b ? { ...c, done: true } : c)))
          setSel([])
          if (sound) clickSound()
        }, 300)
      } else {
        setTimeout(() => {
          setDeck((d) => d.map((c, j) => (j === a || j === b ? { ...c, open: false } : c)))
          setSel([])
        }, 750)
      }
    }
  }

  const again = () => {
    setDeck(newDeck())
    setSel([])
    setMoves(0)
  }

  return (
    <div>
      <p className="mb-2 text-[15px] leading-snug text-[#4a3a24]">{t.g.memoryHelp}</p>
      <Hud items={[[t.g.moves, moves], [t.g.best, record || '—']]} />
      {won ? (
        <Result title={t.g.win} lines={[`${t.g.moves}: ${moves}`]} onAgain={again} t={t} />
      ) : (
        <div className="grid grid-cols-4 gap-2">
          {deck.map((c, i) => (
            <button
              key={c.id}
              onClick={() => flip(i)}
              className={`mc-card ${c.open || c.done ? 'is-open' : ''} ${c.done ? 'is-done' : ''}`}
              aria-label={c.open || c.done ? c.type : '?'}
            >
              {c.open || c.done ? (
                <img src={blockIcon(c.type)} alt="" className="h-10 w-10 [image-rendering:pixelated]" />
              ) : (
                <span className="font-pixel text-[16px] text-[#f2ead3]">?</span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ——— 🟩 Pukul Slime: ketuk slime yang muncul dari lubang ———
function slimeFace() {
  const c = document.createElement('canvas')
  c.width = 12
  c.height = 12
  const g = c.getContext('2d')
  const p = (x, y, w, h, col) => {
    g.fillStyle = col
    g.fillRect(x, y, w, h)
  }
  p(0, 0, 12, 12, '#6abf4f')
  p(1, 1, 10, 10, '#82d466')
  p(2, 3, 2, 2, '#1d1d21')
  p(8, 3, 2, 2, '#1d1d21')
  p(3, 3, 1, 1, '#ffffff')
  p(9, 3, 1, 1, '#ffffff')
  p(4, 8, 4, 1, '#2f6a20')
  p(1, 1, 2, 1, '#b8f0a0')
  return c.toDataURL()
}

function SlimeGame({ t, sound, onDone }) {
  const [state, setState] = useState('ready')
  const [up, setUp] = useState(-1)
  const [squash, setSquash] = useState(-1)
  const [score, setScore] = useState(0)
  const [record, setRecord] = useState(() => best.get('slime'))
  const scoreRef = useRef(0)
  const face = useMemo(slimeFace, [])
  const grass = useMemo(() => blockIcon('grass'), [])

  const finish = useCallback(() => {
    setState('done')
    setUp(-1)
    onDone()
    if (scoreRef.current > best.get('slime')) {
      best.set('slime', scoreRef.current)
      setRecord(scoreRef.current)
      if (sound) advancementSound()
    }
  }, [sound, onDone])
  const left = useCountdown(state === 'play', 30, finish)

  // slime muncul makin cepat seiring waktu
  useEffect(() => {
    if (state !== 'play') return
    let id
    const tick = () => {
      setUp((u) => {
        let n
        do n = Math.floor(Math.random() * 9)
        while (n === u)
        return n
      })
      const speed = Math.max(750, 1400 - scoreRef.current * 12)
      id = setTimeout(tick, speed)
    }
    tick()
    return () => clearTimeout(id)
  }, [state])

  const start = () => {
    scoreRef.current = 0
    setScore(0)
    setState('play')
  }

  const lastUp = useRef({ i: -1, at: 0 })
  useEffect(() => {
    if (up >= 0) lastUp.current = { i: up, at: 0 }
    else lastUp.current.at = Date.now()
  }, [up])

  const whack = (i) => {
    if (state !== 'play') return
    // ketukan yang sedikit telat (setelah slime turun) tetap dihitung
    const late = lastUp.current.i === i && lastUp.current.at && Date.now() - lastUp.current.at < 350
    if (i !== up && !late) return
    lastUp.current = { i: -1, at: 0 }
    scoreRef.current += 1
    setScore(scoreRef.current)
    setSquash(i)
    setUp(-1)
    if (sound) clickSound()
    setTimeout(() => setSquash(-1), 200)
  }

  return (
    <div>
      <p className="mb-2 text-[15px] leading-snug text-[#4a3a24]">{t.g.slimeHelp}</p>
      <Hud items={[[t.g.time, `${Math.ceil(left)}s`], [t.g.score, score], [t.g.best, record]]} />
      {state === 'done' ? (
        <Result title={t.g.timeUp} lines={[`${t.g.score}: ${score}`]} onAgain={start} t={t} />
      ) : (
        <div className="relative">
          <div className="grid grid-cols-3 gap-2">
            {Array.from({ length: 9 }, (_, i) => (
              <button key={i} className="mc-hole" onPointerDown={() => whack(i)} aria-label={up === i ? 'slime' : 'hole'}>
                <img src={grass} alt="" className="absolute inset-0 m-auto h-[70%] w-[70%] opacity-40 [image-rendering:pixelated]" />
                <img
                  src={face}
                  alt=""
                  className={`mc-slime ${up === i ? 'is-up' : ''} ${squash === i ? 'is-squash' : ''}`}
                />
              </button>
            ))}
          </div>
          {state === 'ready' && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/40">
              <button className="mc-btn !text-[18px]" onClick={start}>▶ {t.g.play}</button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export const GAME_BODIES = { game_mine: MineGame, game_memory: MemoryGame, game_slime: SlimeGame }
