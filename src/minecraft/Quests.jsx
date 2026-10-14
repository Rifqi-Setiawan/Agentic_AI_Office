import { useEffect, useState } from 'react'
import { blockIcon } from './textures'

// =====================================================================
//  Daftar quest di kanan layar
//  Tahap 1: jelajahi desa → Tahap 2: main game di tiap pojok dunia
// =====================================================================

export const EXPLORE_QUESTS = ['now', 'about', 'education', 'tech', 'work', 'journey', 'contact', 'talk', 'eat', 'ekg', 'photo']
export const GAME_QUESTS = ['game_mine', 'game_memory', 'game_slime', 'boat']

const ICON = {
  now: 'stonebrick', about: 'planks', education: 'bookshelf', tech: 'crafting', work: 'glow',
  journey: 'log', contact: 'wool_blue', talk: 'wool_white', eat: 'wool_red', ekg: 'wool_green', photo: 'glass', boat: 'planks',
  game_mine: 'ore_diamond', game_memory: 'crafting', game_slime: 'slime',
}

const KEY = 'quests-v1'
export function loadQuests() {
  try {
    return new Set(JSON.parse(localStorage.getItem(KEY) || '[]'))
  } catch (e) {
    return new Set()
  }
}
export function saveQuests(set) {
  try {
    localStorage.setItem(KEY, JSON.stringify([...set]))
  } catch (e) {
    /* abaikan */
  }
}

function Item({ id, done, label, hint, onGo }) {
  return (
    <li>
      <button
        className={`flex w-full items-center gap-2 px-1 py-0.5 text-left hover:bg-white/10 ${done ? 'opacity-60' : ''}`}
        onClick={() => onGo(id)}
        disabled={!onGo || ['talk', 'ekg', 'photo'].includes(id)}
      >
        <img src={blockIcon(ICON[id])} alt="" className="h-5 w-5 shrink-0 [image-rendering:pixelated]" />
        <span className="min-w-0 flex-1">
          <span className={`block text-[15px] leading-tight ${done ? 'line-through' : ''}`}>{label}</span>
          {hint && !done && <span className="block text-[12px] leading-tight text-[#c6c6c6]">{hint}</span>}
        </span>
        <span className={`font-pixel text-[10px] ${done ? 'text-[#80ff20]' : 'text-[#8b8b8b]'}`}>{done ? '✔' : '○'}</span>
      </button>
    </li>
  )
}

export function QuestLog({ done, t, labels, onGo, compact }) {
  const [open, setOpen] = useState(() => window.innerWidth >= 768)
  const exploreDone = EXPLORE_QUESTS.every((q) => done.has(q))
  const total = EXPLORE_QUESTS.length + GAME_QUESTS.length
  const count = [...EXPLORE_QUESTS, ...GAME_QUESTS].filter((q) => done.has(q)).length
  const allDone = count === total

  const [tab, setTab] = useState(exploreDone ? 2 : 1)

  // tahap 1 selesai → buka daftar & pindah ke tab tahap 2
  useEffect(() => {
    if (exploreDone) setTab(2)
    if (exploreDone && !allDone) setOpen(true)
  }, [exploreDone, allDone])

  const stage1 = EXPLORE_QUESTS.filter((q) => done.has(q)).length
  const stage2 = GAME_QUESTS.filter((q) => done.has(q)).length
  const show = open && !compact
  return (
    <aside className="fixed right-2 top-[50px] z-20 flex w-[min(300px,calc(100vw-24px))] flex-col items-end md:right-5 md:top-[68px]">
      <button className="mc-btn" onClick={() => setOpen(!open)} aria-expanded={show}>
        📜 {t.q.title} {count}/{total} {show ? '▴' : '▾'}
      </button>
      {show && (
        <div className="mc-quest mc-pop mt-2 w-full p-3">
          {/* tab tahap 1 & 2 bersebelahan */}
          <div className="grid grid-cols-2 gap-1" role="tablist">
            <button role="tab" aria-selected={tab === 1} className={`mc-qtab ${tab === 1 ? 'is-on' : ''}`} onClick={() => setTab(1)}>
              {t.q.tab1} {exploreDone ? '✔' : `${stage1}/${EXPLORE_QUESTS.length}`}
            </button>
            <button
              role="tab"
              aria-selected={tab === 2}
              className={`mc-qtab ${tab === 2 ? 'is-on' : ''}`}
              onClick={() => exploreDone && setTab(2)}
              disabled={!exploreDone}
            >
              {t.q.tab2} {exploreDone ? (allDone ? '✔' : `${stage2}/${GAME_QUESTS.length}`) : '🔒'}
            </button>
          </div>

          {tab === 1 ? (
            <>
              <div className="mt-3 font-pixel text-[9px] text-[#ffd451]">{t.q.explore}</div>
              <ul className="mt-2 space-y-0.5">
                {EXPLORE_QUESTS.map((id) => (
                  <Item
                    key={id}
                    id={id}
                    done={done.has(id)}
                    label={['talk', 'eat', 'ekg', 'photo'].includes(id) ? t.q[id] : `${t.q.visit} ${labels[id]}`}
                    onGo={onGo}
                  />
                ))}
              </ul>
              {!exploreDone && <div className="mt-2 text-[12px] text-[#c6c6c6]">{t.q.lockedGames}</div>}
            </>
          ) : (
            <>
              <div className="mc-suggest mt-3">💡 {allDone ? t.q.allDone : t.q.suggest}</div>
              <div className="mt-3 font-pixel text-[9px] text-[#ffd451]">{t.q.games}</div>
              <ul className="mt-2 space-y-0.5">
                {GAME_QUESTS.map((id) => (
                  <Item
                    key={id}
                    id={id}
                    done={done.has(id)}
                    label={id === 'boat' ? t.q.boat : `${t.q.play} ${labels[id]}`}
                    hint={t.q.where[id]}
                    onGo={onGo}
                  />
                ))}
              </ul>
            </>
          )}
        </div>
      )}
    </aside>
  )
}

export function QuestComplete({ t, onClose }) {
  return (
    <div className="fixed inset-0 z-[46] flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="mc-parchment mc-lift max-w-md text-center" onClick={(e) => e.stopPropagation()}>
        <div className="font-pixel text-[18px] leading-snug text-[#3a2410] md:text-[22px]">QUEST COMPLETE!</div>
        <div className="mt-3 flex justify-center gap-2">
          {['ore_diamond', 'glow', 'slime', 'bookshelf', 'grass'].map((b) => (
            <img key={b} src={blockIcon(b)} alt="" className="h-9 w-9 [image-rendering:pixelated]" />
          ))}
        </div>
        <p className="mt-3 text-[18px] leading-snug text-[#3a2410]">{t.q.finalText}</p>
        <button className="mc-btn mt-4" onClick={onClose}>{t.q.thanks} ▶</button>
      </div>
    </div>
  )
}
