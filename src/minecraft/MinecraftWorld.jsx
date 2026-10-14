import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Canvas } from '@react-three/fiber'
import Scene from './Scene'
import Panel, { panelWidth } from './Panel'
import Intro from './Intro'
import { QuestLog, QuestComplete, loadQuests, saveQuests, EXPLORE_QUESTS, GAME_QUESTS } from './Quests'
import { STATION_IDS } from './world'
import { blockIcon, textureURL } from './textures'
import { fetchRecentRepos } from './github'
import { UI, profile } from '../data'
import {
  startAmbient, stopAmbient, clickSound, advancementSound, unlockAudio, clingSound, typeSound, shutterSound,
} from '../sound'

const ICONS = ['grass', 'planks', 'bookshelf', 'crafting', 'glow', 'log', 'wool_red']

function Loading({ t, done, hidden, onStart }) {
  const [chosenLang, setChosenLang] = useState(null)
  // t di sini selalu bahasa Indonesia; tombol bahasa ditulis dua-duanya
  const [p, setP] = useState(0)
  useEffect(() => {
    const id = setInterval(() => setP((x) => Math.min(done ? 100 : 90, x + (done ? 20 : 7))), 60)
    return () => clearInterval(id)
  }, [done])
  const dirt = useMemo(() => textureURL('dirt'), [])
  return (
    <div
      className={`mc-loading fixed inset-0 z-50 flex flex-col items-center justify-center gap-4 transition-opacity duration-500 ${
        hidden ? 'pointer-events-none opacity-0' : ''
      }`}
      style={{ backgroundImage: `url(${dirt})` }}
    >
      {!(done && p >= 100) && (
        <img src={blockIcon('grass')} alt="" className="mc-loader h-14 w-14 [image-rendering:pixelated]" />
      )}
      <div className="font-pixel text-[14px] text-white [text-shadow:2px_2px_0_#3f3f3f]">
        {done && p >= 100 ? t.loading : t.waitTitle}
        {!(done && p >= 100) && <span className="mc-dots" />}
      </div>
      {done && p >= 100 ? (
        !chosenLang ? (
          <div className="mc-pop flex flex-col items-center gap-3">
            <div className="text-[17px] text-[#e0e0e0]">Pilih bahasa · Choose language</div>
            <button className="mc-btn w-72 !py-2 !text-[20px]" onClick={() => setChosenLang('id')} autoFocus>
              Bahasa Indonesia
            </button>
            <button className="mc-btn w-72 !py-2 !text-[20px]" onClick={() => setChosenLang('en')}>
              English
            </button>
          </div>
        ) : (
          <div key="music" className="mc-pop flex flex-col items-center gap-3">
            <div className="text-[17px] text-[#e0e0e0]">{chosenLang === 'en' ? 'Play background music?' : 'Pakai musik latar?'}</div>
            <button className="mc-btn w-72 !py-2 !text-[20px]" onClick={() => onStart(chosenLang, true)} autoFocus>
              🎵 {chosenLang === 'en' ? 'Yes, with music' : 'Ya, pakai musik'}
            </button>
            <button className="mc-btn w-72 !py-2 !text-[20px]" onClick={() => onStart(chosenLang, false)}>
              🔇 {chosenLang === 'en' ? 'No music' : 'Tanpa musik'}
            </button>
            <div className="max-w-xs text-center text-[13px] text-[#a0a0a0]">
              {chosenLang === 'en' ? 'Sound effects stay on.' : 'Efek suara tetap nyala.'}
            </div>
          </div>
        )
      ) : (
        <>
          <div className="h-2 w-64 border border-black bg-[#4a4a4a]">
            <div className="h-full bg-[#80ff20] transition-[width]" style={{ width: `${p}%` }} />
          </div>
          <div className="px-6 text-center text-[16px] leading-snug text-[#c6c6c6]">
            {t.loadingSub.split(' · ').map((line) => (
              <div key={line}>{line}</div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

// Kotak dialog bawah layar (pita kertas penuh) untuk adegan animasi.
// Lanjut kalau diklik/ditekan, atau otomatis 10 detik setelah teks selesai.
function Dialog({ text, name = 'Rifqi', t, onEnd }) {
  const [shown, setShown] = useState(0)
  const [left, setLeft] = useState(10)
  const end = useRef(onEnd)
  end.current = onEnd
  const typing = shown < text.length

  useEffect(() => {
    if (!typing) return
    const id = setTimeout(() => {
      if (text[shown] !== ' ') typeSound()
      setShown((n) => n + 1)
    }, 45)
    return () => clearTimeout(id)
  }, [shown, typing, text])

  useEffect(() => {
    if (typing) return
    setLeft(10)
    const started = Date.now()
    const id = setInterval(() => {
      const l = 10 - Math.floor((Date.now() - started) / 1000)
      setLeft(l)
      if (l <= 0) {
        clearInterval(id)
        end.current()
      }
    }, 200)
    return () => clearInterval(id)
  }, [typing])

  const next = () => (typing ? setShown(text.length) : end.current())
  useEffect(() => {
    const on = (e) => {
      if (e.key === 'Enter' || e.key === ' ' || e.key === 'e' || e.key === 'E') {
        e.preventDefault()
        next()
      }
    }
    window.addEventListener('keydown', on)
    return () => window.removeEventListener('keydown', on)
  })

  return (
    <div className="fixed inset-0 z-[42] cursor-pointer bg-black/20" onClick={next}>
      <div className="mc-dialogbar absolute inset-x-0 bottom-0">
        <div className="mx-auto max-w-3xl px-6 pb-7 pt-5">
          <div className="mc-dialog-name">{name}</div>
          <div className="mc-dialog-line !mx-0" />
          <p className="mt-3 min-h-[60px] text-[20px] leading-snug text-[#3a2410] md:text-[24px]">
            {text.slice(0, shown)}
            {typing && <span className="mc-caret">▌</span>}
          </p>
          <div className="mt-2 text-right text-[14px] text-[#7a4e22]">
            {typing ? '' : `${t.tapNext} ▼ (${Math.max(0, left)})`}
          </div>
        </div>
      </div>
    </div>
  )
}

// Foto polaroid hasil jepretan Zahra (bisa diunduh)
function Polaroid({ url, t, onClose }) {
  const date = new Date().toLocaleDateString(t.studio.locale, { day: 'numeric', month: 'long', year: 'numeric' })
  return (
    <div className="fixed inset-0 z-[55] flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="mc-polaroid mc-lift" onClick={(e) => e.stopPropagation()}>
        <img src={url} alt={t.studio.caption} className="aspect-[4/3] w-full bg-black object-cover" />
        <div className="mt-3 text-center text-[20px] text-[#3a2410]">{t.studio.caption}</div>
        <div className="text-center text-[14px] text-[#7a5c33]">{date}</div>
        <div className="mt-3 flex justify-center gap-2">
          <a className="mc-btn" href={url} download="foto-bareng-zahra.jpg">
            {t.studio.save}
          </a>
          <button className="mc-btn" onClick={onClose}>
            {t.close}
          </button>
        </div>
      </div>
    </div>
  )
}

function Hotbar({ active, labels, onSelect }) {
  const [tip, setTip] = useState(null)
  useEffect(() => {
    setTip(labels[STATION_IDS.indexOf(active)])
    const id = setTimeout(() => setTip(null), 2200)
    return () => clearTimeout(id)
  }, [active, labels])
  return (
    <div className="fixed inset-x-0 bottom-2 z-40 flex flex-col items-center gap-1">
      {tip && <div className="mc-itemname">{tip}</div>}
      <nav className="mc-hotbar" aria-label="Sections">
        {STATION_IDS.map((id, i) => (
          <button
            key={id}
            className={`mc-hotslot ${active === id ? 'is-active' : ''}`}
            onClick={() => onSelect(id)}
            title={`${labels[i]} (${i + 1})`}
            aria-label={labels[i]}
            aria-current={active === id}
          >
            <img src={blockIcon(ICONS[i])} alt="" />
            <span className="mc-hotnum">{i + 1}</span>
          </button>
        ))}
      </nav>
    </div>
  )
}

function Chat({ lines }) {
  return (
    <div className="pointer-events-none fixed bottom-[150px] left-2 z-20 hidden w-[min(420px,60vw)] space-y-0.5 md:block">
      {lines.map((l) => (
        <div key={l.id} className="mc-chat">
          <span className="text-[#ffd451]">&lt;{l.who}&gt;</span> {l.text}
        </div>
      ))}
    </div>
  )
}

function Toasts({ toasts }) {
  return (
    <div className="pointer-events-none fixed right-2 top-16 z-40 space-y-2 md:top-4">
      {toasts.map((x) => (
        <div key={x.id} className="mc-toast">
          <img src={blockIcon(x.icon)} alt="" className="h-8 w-8 [image-rendering:pixelated]" />
          <div>
            <div className="text-[14px] text-[#ffd451]">{x.title}</div>
            <div className="text-[15px] text-white">{x.text}</div>
          </div>
        </div>
      ))}
    </div>
  )
}

export default function MinecraftWorld() {
  const [lang, setLang] = useState('id')
  const t = UI[lang]
  const [active, setActive] = useState('home') // panel yang terbuka
  const [target, setTarget] = useState('home') // slot hotbar yang disorot
  const [command, setCommand] = useState(null) // perintah ke Zafira
  const [nearDoor, setNearDoor] = useState(null)
  const [focusId, setFocusId] = useState(null) // rumah yang sedang disorot kamera
  const panelTimer = useRef()
  const [marker, setMarker] = useState(null)
  const [hovered, setHovered] = useState(null)
  const [ready, setReady] = useState(false)
  const [phase, setPhase] = useState('loading') // loading → intro → play
  const [dialog, setDialog] = useState(null) // kotak dialog bawah (adegan)
  const [ride, setRide] = useState({ riding: false, nearDock: false }) // status naik perahu
  const [online, setOnline] = useState(0) // jumlah pengunjung yang sedang online
  // mode waktu awal mengikuti jam pengunjung
  const [timeMode, setTimeMode] = useState(() => {
    const h = new Date().getHours()
    return h >= 5 && h < 15 ? 'pagi' : h >= 15 && h < 18 ? 'sore' : 'malam'
  })
  const sound = true // efek suara (ketik, klik, obrolan warga) selalu nyala
  const [music, setMusic] = useState(false) // musik latar dipilih di awal
  const [bubble, setBubble] = useState(null)
  const [toasts, setToasts] = useState([])
  const [chat, setChat] = useState([])
  const [narrow, setNarrow] = useState(() => window.innerWidth < 768)
  const visited = useRef(new Set())

  const labels = t.stations
  const labelMap = useMemo(
    () => ({ ...Object.fromEntries(STATION_IDS.map((id, i) => [id, labels[i]])), now: t.nowTitle, ...t.games }),
    [labels, t],
  )
  const [repos, setRepos] = useState(null)
  useEffect(() => {
    fetchRecentRepos().then(setRepos)
  }, [])

  useEffect(() => {
    const on = () => setNarrow(window.innerWidth < 768)
    window.addEventListener('resize', on)
    return () => window.removeEventListener('resize', on)
  }, [])

  // bunyi "cling" untuk semua tombol bergaya batu
  useEffect(() => {
    const on = (e) => {
      if (e.target.closest?.('.mc-btn, .mc-qtab')) clingSound()
    }
    document.addEventListener('pointerdown', on)
    return () => document.removeEventListener('pointerdown', on)
  }, [])

  // pesan chat sambutan (ganti saat bahasa diganti)
  useEffect(() => {
    if (phase !== 'play') return
    setChat([
      { id: 'w' + lang, who: 'Rifqi', text: t.chatWelcome },
      { id: 't' + lang, who: 'Rifqi', text: t.chatTip },
    ])
    const id = setTimeout(() => setChat([]), 12000)
    return () => clearTimeout(id)
  }, [phase, lang, t])

  const pushToast = useCallback((toast) => {
    const id = Math.random()
    setToasts((x) => [...x, { ...toast, id }])
    setTimeout(() => setToasts((x) => x.filter((y) => y.id !== id)), 4200)
  }, [])

  const setHash = (id) => history.replaceState(null, '', id === 'home' ? window.location.pathname : `#${id}`)

  // pilih tujuan (hotbar / klik bangunan / tombol Masuk) → Zafira jalan ke sana
  const select = useCallback(
    (id) => {
      setHovered(null)
      clearTimeout(panelTimer.current)
      setFocusId(null)
      setActive('home')
      setTarget(id)
      if (sound) clickSound()
      setCommand({ type: 'enter', id: id === 'home' ? 'now' : id, n: Math.random() })
    },
    [sound],
  )

  // ——— quest ———
  const [quests, setQuests] = useState(loadQuests)
  const [showComplete, setShowComplete] = useState(false)
  const questsRef = useRef(quests)
  const completeQuest = useCallback(
    (id) => {
      const cur = questsRef.current
      if (cur.has(id)) return
      const next = new Set(cur)
      next.add(id)
      questsRef.current = next
      setQuests(next)
      saveQuests(next)
      const label = ['talk', 'eat', 'ekg', 'photo', 'boat'].includes(id) ? t.q[id] : labelMap[id]
      pushToast({ icon: id.startsWith('game_') ? 'ore_diamond' : 'glow', title: t.q.done, text: label })
      if (sound) advancementSound()
      const exploreDone = EXPLORE_QUESTS.every((q) => next.has(q))
      const justExplored = exploreDone && EXPLORE_QUESTS.includes(id)
      const all = exploreDone && GAME_QUESTS.every((q) => next.has(q))
      if (all) setTimeout(() => setShowComplete(true), 900)
      else if (justExplored) {
        setTimeout(() => pushToast({ icon: 'slime', title: t.q.stageDone, text: t.q.suggest }), 900)
        setChat([{ id: 'q' + Math.random(), who: 'Rifqi', text: t.q.suggest }])
      }
    },
    [t, labelMap, sound, pushToast],
  )

  // Zafira sudah masuk ke dalam bangunan → buka panelnya
  const onEnter = useCallback(
    (id) => {
      if (id === 'now' || id.startsWith('game_')) {
        // panggung & game: tidak masuk ruangan, langsung tampilkan panelnya
        setActive(id)
        if (id === 'now') completeQuest('now')
        setTarget('home')
        if (sound) clickSound()
        return
      }
      setFocusId(id)
      setTarget(id)
      setHash(id)
    },
    [sound, completeQuest],
  )

  // kertas di meja diklik → kertas terangkat jadi lembar konten
  const openPaper = useCallback(
    (id) => {
      if (!id) return
      setActive(id)
      if (sound) clickSound()
      completeQuest(id)
    },
    [sound, completeQuest],
  )

  // ——— foto di studio Zahra ———
  const captureRef = useRef(null)
  const [flash, setFlash] = useState(false)
  const [photo, setPhoto] = useState(null)
  const takePhoto = useCallback(() => {
    setFlash(true)
    shutterSound()
    setTimeout(() => {
      try {
        const url = captureRef.current?.()
        if (url) setPhoto(url)
      } catch (e) {
        /* kanvas tidak bisa disalin */
      }
      setFlash(false)
      completeQuest('photo')
    }, 140)
  }, [completeQuest])

  // pesan mie ayam → Zafira jalan ke warung, duduk, dan makan
  const orderNoodles = useCallback(() => {
    clearTimeout(panelTimer.current)
    setFocusId(null)
    setActive('home')
    setCommand({ type: 'eat', n: Math.random() })
  }, [])

  const closePanel = useCallback(() => {
    clearTimeout(panelTimer.current)
    setFocusId(null)
    setActive('home')
    setTarget('home')
    setHash('home')
    setCommand({ type: 'exit', n: Math.random() })
  }, [])

  const onGroundClick = useCallback((to) => {
    clearTimeout(panelTimer.current)
    setFocusId(null)
    setActive('home')
    setTarget('home')
    setHash('home')
    setCommand({ type: 'move', to, n: Math.random() })
    setMarker({ to, n: Math.random() })
  }, [])

  const onManualMove = useCallback(() => {
    clearTimeout(panelTimer.current)
    setFocusId(null)
    setActive('home')
    setTarget('home')
    setHash('home')
  }, [])

  // buka langsung dari link, mis. .../#work
  useEffect(() => {
    if (phase !== 'play') return
    const h = window.location.hash.replace('#', '')
    if (STATION_IDS.includes(h) && h !== 'home') setTimeout(() => select(h), 1800)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase])

  // keyboard: 1–7 pindah section, E/Enter masuk, Esc keluar
  useEffect(() => {
    const on = (e) => {
      if (phase === 'wake' && e.key === 'Escape') setPhase('play') // lewati adegan
      if (phase !== 'play' || e.target.closest?.('input, textarea')) return
      const n = Number(e.key)
      if (n >= 1 && n <= STATION_IDS.length) select(STATION_IDS[n - 1])
      if (e.key === 'Escape') {
        if (active !== 'home' && focusId) setActive('home') // taruh kertas kembali
        else if (active !== 'home' || focusId) closePanel()
      }
      if ((e.key === 'e' || e.key === 'E' || e.key === 'Enter') && focusId && active === 'home') openPaper(focusId)
      if ((e.key === 'e' || e.key === 'E' || e.key === 'Enter') && nearDoor && active === 'home') select(nearDoor)
    }
    window.addEventListener('keydown', on)
    return () => window.removeEventListener('keydown', on)
  }, [select, closePanel, nearDoor, active, phase, focusId, openPaper])

  const toggleMusic = () => {
    if (music) stopAmbient()
    else startAmbient()
    setMusic(!music)
  }

  const avatarClick = useCallback(() => {
    setBubble({ text: t.bubbles[0], n: Math.random() })
    if (sound) clickSound()
  }, [t, sound])

  const panelOpen = active !== 'home'
  const isTouch = useMemo(() => window.matchMedia?.('(pointer: coarse)').matches, [])
  const playing = phase === 'play'

  const start = (chosen, withMusic) => {
    setLang(chosen)
    unlockAudio()
    if (withMusic) startAmbient()
    setMusic(withMusic)
    setPhase('intro')
  }

  return (
    <main className="mc-sky fixed inset-0 select-none overflow-hidden" data-panel={panelOpen || !!focusId ? '1' : '0'}>
      {/* lapisan langit untuk tiap mode (transisi lewat opacity) */}
      {['pagi', 'sore', 'malam'].map((m) => (
        <div key={m} className={`mc-sky-layer mc-sky-${m} ${timeMode === m ? 'opacity-100' : 'opacity-0'}`} />
      ))}
      <Canvas
        shadows
        dpr={[1, 1.5]}
        camera={{ fov: 40, near: 0.5, far: 500, position: [10, 120, 140] }}
        gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
        onCreated={() => setTimeout(() => setReady(true), 300)}
      >
        <Suspense fallback={null}>
          <Scene
            labels={labelMap}
            hovered={hovered}
            setHovered={setHovered}
            onSelect={select}
            command={command}
            bubble={bubble}
            onEnter={onEnter}
            onNearDoor={setNearDoor}
            onManualMove={onManualMove}
            onGroundClick={onGroundClick}
            onAvatarClick={avatarClick}
            panelShift={panelOpen ? (narrow ? 0 : panelWidth(active) / 2) : 0}
            panelOpen={panelOpen}
            marker={marker}
            introActive={phase === 'loading' || phase === 'intro'}
            wake={phase === 'wake' ? 'waking' : playing ? null : 'asleep'}
            onWakeDone={() => setPhase('play')}
            onDialog={(text) => setDialog({ text, n: Math.random() })}
            onOrder={orderNoodles}
            captureRef={captureRef}
            onBoard={() => {
              clearTimeout(panelTimer.current)
              setFocusId(null)
              setActive('home')
              setCommand({ type: 'boat', n: Math.random() })
            }}
            onRideDone={() => completeQuest('boat')}
            onRideState={setRide}
            multiplayer={playing}
            onOnline={setOnline}
            onPhotographer={(to, face) => {
              // Zafira berdiri di depan kamera, Zahra menyapa, lalu jepret!
              clearTimeout(panelTimer.current)
              setFocusId(null)
              setActive('home')
              setCommand({ type: 'move', to, face, run: true, n: Math.random() })
              const [first, ...rest] = t.studio.lines.map((text) => ({ text, name: t.studio.photographer }))
              setDialog({ ...first, rest, onDone: takePhoto, n: Math.random() })
            }}
            onNurse={(to, face) => {
              // Zafira menghampiri Zulfa, lalu Zulfa menjelaskan EKG lewat dialog bawah
              clearTimeout(panelTimer.current)
              setFocusId(null)
              setActive('home')
              setCommand({ type: 'move', to, face, run: true, n: Math.random() })
              const [first, ...rest] = t.clinic.lines.map((text) => ({ text, name: t.clinic.nurse }))
              setDialog({ ...first, rest, onDone: () => completeQuest('ekg'), n: Math.random() })
            }}
            onAte={() => completeQuest('eat')}
            focusId={focusId}
            onPaper={() => openPaper(focusId)}
            repo={repos?.[0]}
            lang={lang}
            t={t}
            sound={sound}
            timeMode={timeMode}
            onTalk={() => completeQuest('talk')}
            onApproach={(to, face) => {
              setActive('home')
              setFocusId(null)
              setCommand({ type: 'move', to, face, run: true, n: Math.random() })
            }}
          />
        </Suspense>
      </Canvas>

      {/* logo + splash */}
      <header className={`pointer-events-none fixed left-3 top-3 z-20 transition-opacity duration-500 md:left-5 md:top-4 ${playing ? '' : 'opacity-0'}`}>
        {/* HP: nama dipecah 2 baris (ZAFIRA / NUR KAMILA) supaya tidak menabrak tombol */}
        <h1 className="mc-logo">
          <span className="block md:inline">RIFQI SETIAWAN</span>{' '}
          <span className="block text-[12px] font-pixel text-[#38bdf8] md:inline md:text-[14px]">· SOVEREIGN HQ</span>
        </h1>
        {playing && online > 0 && (
          // HP: di bawah baris tombol & teks singkat supaya tidak menabrak tombol
          <div className="mc-online mt-2 !flex w-max">
            <span className="mc-online-dot" /> {online} <span className="md:hidden">online</span>
            <span className="hidden md:inline">{t.mp.online}</span>
          </div>
        )}
      </header>

      {/* tombol kanan atas */}
      {/* tombol kanan atas (di HP dibuat ramping supaya sebaris dengan nama) */}
      <div className="fixed right-2 top-3 z-40 flex gap-1.5 md:right-5 md:top-4 md:gap-2">
        <button className="mc-btn mc-top" onClick={() => setLang(lang === 'id' ? 'en' : 'id')} aria-label="Language">
          {lang === 'id' ? 'ID' : 'EN'} ⇄
        </button>
        <button className="mc-btn mc-top" onClick={toggleMusic} aria-pressed={music}>
          {music ? '🎵' : '🔇'} <span className="hidden sm:inline">{t.music}: {music ? t.on : t.off}</span>
        </button>
      </div>

      {playing && focusId && !panelOpen && (
        <div className="fixed inset-x-0 bottom-[104px] z-40 flex justify-center gap-2 px-3">
          <button className="mc-btn mc-pop !px-5 !text-[18px]" onClick={() => openPaper(focusId)}>
            📜 {t.readPaper} <span className="hidden opacity-70 sm:inline">[E]</span>
          </button>
          <button className="mc-btn mc-pop" onClick={closePanel}>
            🚪 {t.leave} <span className="hidden opacity-70 sm:inline">[Esc]</span>
          </button>
        </div>
      )}

      {/* sedang naik perahu: petunjuk kemudi + tombol turun di dermaga */}
      {playing && ride.riding && !dialog && (
        <div className="fixed inset-x-0 bottom-[104px] z-40 flex flex-col items-center gap-2 px-3">
          {ride.nearDock && (
            <button className="mc-btn mc-pop !px-5 !text-[18px]" onClick={() => setCommand({ type: 'unboard', n: Math.random() })}>
              {t.ride.unboard}
            </button>
          )}
          <div className="pointer-events-none text-center text-[15px] text-white [text-shadow:2px_2px_0_#3f3f3f]">
            {isTouch ? t.ride.hintTouch : t.ride.hint}
          </div>
        </div>
      )}

      {playing && !panelOpen && !nearDoor && !focusId && !dialog && !ride.riding && (
        <div className="pointer-events-none fixed inset-x-0 bottom-[112px] z-10 px-4 text-center text-[15px] text-white [text-shadow:2px_2px_0_#3f3f3f]">
          {isTouch ? t.hintTouch : t.hint}
        </div>
      )}

      {/* tombol masuk saat Zafira berdiri di depan pintu */}
      {playing && !panelOpen && nearDoor && !focusId && (
        <div className="fixed inset-x-0 bottom-[104px] z-40 flex justify-center">
          <button className="mc-btn mc-pop !px-5 !text-[18px]" onClick={() => select(nearDoor)}>
            {nearDoor.startsWith('game_') ? `🎮 ${t.play}` : `🚪 ${t.enter}`}: {labelMap[nearDoor]} <span className="hidden opacity-70 sm:inline">[E]</span>
          </button>
        </div>
      )}

      {playing && !dialog && (
        <QuestLog
          done={quests}
          t={t}
          labels={labelMap}
          compact={panelOpen || !!focusId}
          onGo={(id) =>
            id === 'eat'
              ? orderNoodles()
              : id === 'boat'
                ? setCommand({ type: 'boat', n: Math.random() })
                : select(id === 'now' ? 'home' : id)
          }
        />
      )}
      {showComplete && <QuestComplete t={t} onClose={() => setShowComplete(false)} />}

      {dialog && (
        <Dialog
          key={dialog.n}
          text={dialog.text}
          name={dialog.name}
          t={t}
          onEnd={() => {
            // dialog berantai: lanjut ke kalimat berikutnya, atau selesai
            if (dialog.rest?.length) {
              const [next, ...rest] = dialog.rest
              setDialog({ ...next, rest, onDone: dialog.onDone, n: Math.random() })
            } else {
              setDialog(null)
              dialog.onDone?.()
            }
          }}
        />
      )}

      {!dialog && <Chat lines={chat} />}
      {flash && <div className="mc-flash pointer-events-none fixed inset-0 z-[60]" />}
      {photo && <Polaroid url={photo} t={t} onClose={() => setPhoto(null)} />}
      <Toasts toasts={toasts} />

      {panelOpen && (
        <Panel
          id={active}
          title={labelMap[active]}
          lang={lang}
          t={t}
          onClose={() => (focusId ? setActive('home') : closePanel())}
          onLeave={closePanel}
          repos={repos}
          sound={sound}
          onGameDone={completeQuest}
        />
      )}

      {playing && !dialog && <Hotbar active={target} labels={labels} onSelect={select} />}
      {phase === 'intro' && <Intro t={t} onDone={() => setPhase('wake')} />}
      {phase === 'wake' && (
        <button className="mc-btn fixed bottom-6 right-4 z-40" onClick={() => setPhase('play')}>
          {t.skip} ⏭
        </button>
      )}
      <Loading t={t} done={ready} hidden={phase !== 'loading'} onStart={start} />
    </main>
  )
}
