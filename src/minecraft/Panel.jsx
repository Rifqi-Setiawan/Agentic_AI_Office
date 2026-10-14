import { useEffect, useState } from 'react'
import Img from '../components/Img'
import { blockIcon } from './textures'
import { describe, timeAgo, prettify } from './github'
import { GAME_BODIES } from './Games'
import {
  profile, stats, projects, tech, journey, achievements, certifications, education,
} from '../data'

// Lebar panel di desktop (dipakai kamera untuk menggeser pandangan)
export const panelWidth = (id) => (id === 'work' && window.innerWidth >= 1100 ? 680 : id === 'now' ? 520 : 460)

const MARK = { edu: 'EDU', work: 'JOB', award: 'WIN', cert: 'CERT', project: 'APP' }
const MARK_COLOR = {
  edu: 'bg-[#3c4fa0]', work: 'bg-[#6f4e37]', award: 'bg-[#c8961e]', cert: 'bg-[#2b7a7a]', project: 'bg-[#b02e26]',
}

function SectionTitle({ children }) {
  return <h3 className="mb-2 mt-5 font-pixel text-[10px] uppercase text-[#3f3f3f] first:mt-0">{children}</h3>
}

function About({ lang, t }) {
  return (
    <div>
      <div className="flex items-center gap-4">
        <div className="mc-frame shrink-0">
          <Img src={profile.photo} alt={profile.name} className="h-24 w-24 object-cover [image-rendering:auto]" />
        </div>
        <div>
          <div className="font-pixel text-[12px] leading-5 text-[#2a2a2a]">{profile.name}</div>
          <div className="mt-1 text-[15px] text-[#3f3f3f]">{lang === 'en' ? profile.roleEn : profile.role}</div>
          <div className="mt-1 text-[14px] text-[#555]">📍 {profile.location}</div>
        </div>
      </div>
      <p className="mt-4 text-[16px] leading-snug text-[#2a2a2a]">{lang === 'en' ? profile.summaryEn : profile.summary}</p>
      <SectionTitle>{t.stats}</SectionTitle>
      <div className="grid grid-cols-3 gap-2">
        {stats.map((s) => (
          <div key={s.label} className="mc-slot flex-col !h-auto py-2">
            <span className="font-pixel text-[14px] text-[#2a2a2a]">{s.n}{s.suffix}</span>
            <span className="mt-1 text-center text-[13px] leading-tight text-[#3f3f3f]">{lang === 'en' ? s.labelEn : s.label}</span>
          </div>
        ))}
      </div>
      <SectionTitle>{t.awards}</SectionTitle>
      <div className="space-y-2">
        {achievements.map((a) => (
          <div key={a.title} className="mc-adv">
            <img src={blockIcon('glow')} alt="" className="h-8 w-8 [image-rendering:pixelated]" />
            <div>
              <div className="text-[14px] text-[#ffd451]">{lang === 'en' ? a.placeEn : a.place}</div>
              <div className="text-[15px] leading-tight text-white">{a.title}</div>
              <div className="text-[13px] text-white/60">{a.org}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function Education({ lang, t }) {
  return (
    <div>
      <SectionTitle>{t.education}</SectionTitle>
      <div className="space-y-2">
        {education.map((e) => (
          <div key={e.school} className="mc-inset flex items-center gap-3 p-3">
            <img src={blockIcon('bookshelf')} alt="" className="h-9 w-9 [image-rendering:pixelated]" />
            <div>
              <div className="text-[17px] leading-tight text-[#2a2a2a]">{e.school}</div>
              <div className="text-[15px] text-[#3f3f3f]">{lang === 'en' ? e.degreeEn : e.degree}</div>
              <div className="text-[13px] text-[#666]">{lang === 'en' ? e.periodEn : e.period}</div>
            </div>
          </div>
        ))}
      </div>
      <SectionTitle>{t.certs}</SectionTitle>
      <ul className="space-y-2">
        {certifications.map((c) => (
          <li key={c} className="mc-inset flex items-center gap-3 px-3 py-2 text-[15px] text-[#2a2a2a]">
            <span className="mc-paper" aria-hidden />
            {c}
          </li>
        ))}
      </ul>
    </div>
  )
}

function Tech() {
  return (
    <div className="grid grid-cols-4 gap-2 sm:grid-cols-5">
      {tech.map((x) => (
        <div key={x.name} className="mc-slot group relative flex-col !h-[76px] gap-1">
          {x.logo ? (
            <img src={`/images/tech/${x.logo}.svg`} alt="" className="h-8 w-8 object-contain" />
          ) : (
            <span className="text-2xl leading-none">{x.emoji}</span>
          )}
          <span className="px-1 text-center text-[12px] leading-tight text-[#2a2a2a]">{x.name}</span>
        </div>
      ))}
    </div>
  )
}

// Proyek = buku foto 2 halaman (terinspirasi item "Portfolio")
function Work({ lang, t }) {
  const [narrow, setNarrow] = useState(() => window.innerWidth < 1100)
  useEffect(() => {
    const on = () => setNarrow(window.innerWidth < 1100)
    window.addEventListener('resize', on)
    return () => window.removeEventListener('resize', on)
  }, [])
  const per = narrow ? 1 : 2
  const [page, setPage] = useState(0)
  const pages = Math.ceil(projects.length / per)
  const cur = Math.min(page, pages - 1)
  const shown = projects.slice(cur * per, cur * per + per)

  return (
    <div>
      <div className={`mc-book grid gap-0 ${per === 2 ? 'grid-cols-2' : 'grid-cols-1'}`}>
        {shown.map((p, i) => (
          <article key={p.idx} className={`mc-page ${per === 2 && i === 0 ? 'mc-page-left' : ''}`}>
            <div className="mc-photo">
              <Img src={p.image} alt={p.name} className="aspect-[4/3] w-full bg-[#e9e2cc] object-contain" />
            </div>
            <div className="mt-2 font-pixel text-[10px] text-[#7a5c33]">#{p.idx}</div>
            <h4 className="text-[20px] leading-tight text-[#3a2a14]">{p.name}</h4>
            <p className="mt-1 text-[15px] leading-snug text-[#4a3a24]">{lang === 'en' ? p.descEn : p.desc}</p>
            <div className="mt-2 text-[13px] text-[#7a5c33]">{p.tags}</div>
            <a href={p.link} target="_blank" rel="noreferrer" className="mc-btn mt-3 inline-flex">
              {t.openRepo} ↗
            </a>
          </article>
        ))}
      </div>
      <div className="mt-3 flex items-center justify-between gap-2">
        <button className="mc-btn" disabled={cur === 0} onClick={() => setPage(cur - 1)}>◀ {t.prev}</button>
        <span className="font-pixel text-[9px] text-[#3f3f3f]">{t.page} {cur + 1}/{pages}</span>
        <button className="mc-btn" disabled={cur >= pages - 1} onClick={() => setPage(cur + 1)}>{t.next} ▶</button>
      </div>
    </div>
  )
}

function Journey({ lang }) {
  return (
    <ol className="relative space-y-4 border-l-4 border-[#7a5c33] pl-4">
      {[...journey].reverse().map((y) => (
        <li key={y.year}>
          <div className="absolute -left-[11px] mt-0.5 h-[18px] w-[18px] border-2 border-[#141414] bg-[#ffd451]" />
          <div className="font-pixel text-[12px] text-[#2a2a2a]">{y.year}</div>
          <ul className="mt-2 space-y-1.5">
            {y.items.map((it) => (
              <li key={it.text} className="flex items-start gap-2 text-[15px] leading-snug text-[#2a2a2a]">
                <span className={`mt-0.5 shrink-0 px-1.5 font-pixel text-[7px] leading-[16px] text-white ${MARK_COLOR[it.type]}`}>
                  {MARK[it.type]}
                </span>
                {lang === 'en' ? it.textEn : it.text}
              </li>
            ))}
          </ul>
        </li>
      ))}
    </ol>
  )
}

function Contact({ t }) {
  const links = [
    { label: 'Email', value: profile.email, href: `mailto:${profile.email}`, icon: 'wool_red' },
    { label: 'GitHub', value: profile.github.replace('https://', ''), href: profile.github, icon: 'stonebrick' },
    { label: 'LinkedIn', value: profile.linkedin.replace('https://www.', '').replace('https://', ''), href: profile.linkedin, icon: 'wool_blue' },
    { label: 'Portfolio Live', value: profile.portfolio.replace('https://', ''), href: profile.portfolio, icon: 'glow' },
  ]
  return (
    <div>
      <p className="text-[17px] leading-snug text-[#2a2a2a]">{t.contactLead}</p>
      <div className="mt-4 space-y-2">
        {links.map((l) => (
          <a
            key={l.label}
            href={l.href}
            target={l.href.startsWith('http') ? '_blank' : undefined}
            rel="noreferrer"
            className="mc-btn flex w-full !justify-start gap-3 !py-2"
          >
            <img src={blockIcon(l.icon)} alt="" className="h-7 w-7 [image-rendering:pixelated]" />
            <span className="text-left">
              <span className="block text-[12px] opacity-80">{l.label}</span>
              <span className="block break-all text-[15px]">{l.value}</span>
            </span>
          </a>
        ))}
      </div>
      <p className="mt-4 text-[14px] text-[#555]">📍 {profile.location}</p>
    </div>
  )
}

// Panggung: repo yang terakhir dikerjakan + repo lain yang baru diperbarui
function Now({ lang, t, repos }) {
  if (!repos?.length) return <p className="text-[16px] text-[#3a2410]">...</p>
  const [main, ...others] = repos
  const d = describe(main, lang)
  return (
    <div>
      <p className="text-[16px] leading-snug text-[#4a3a24]">{t.nowLead}</p>
      <article className="mc-inset mt-3 p-3">
        <div className="font-pixel text-[9px] text-[#b02e26]">● LIVE · GITHUB</div>
        <h3 className="mt-1 text-[22px] leading-tight text-[#2a1a08]">{d.title}</h3>
        <div className="text-[15px] text-[#2b4f8c]">{main.name}</div>
        <p className="mt-2 text-[16px] leading-snug text-[#2a1a08]">{d.desc}</p>
        {d.points.length > 0 && (
          <ul className="mt-2 space-y-1">
            {d.points.map((x) => (
              <li key={x} className="flex gap-2 text-[15px] leading-snug text-[#2a1a08]">
                <span className="mt-[6px] h-2 w-2 shrink-0 bg-[#7a4e22]" />
                {x}
              </li>
            ))}
          </ul>
        )}
        <div className="mt-2 text-[14px] text-[#7a5c33]">{d.tags}</div>
        <div className="mt-1 text-[14px] text-[#7a5c33]">
          {t.updated}: {timeAgo(main.pushedAt, lang)}
        </div>
        <a href={main.url} target="_blank" rel="noreferrer" className="mc-btn mt-3 inline-flex">
          {t.openRepo} ↗
        </a>
      </article>
      {others.length > 0 && (
        <>
          <SectionTitle>{t.recent}</SectionTitle>
          <ul className="space-y-2">
            {others.map((r) => (
              <li key={r.name}>
                <a href={r.url} target="_blank" rel="noreferrer" className="mc-inset flex items-center justify-between gap-3 px-3 py-2 hover:brightness-105">
                  <span>
                    <span className="block text-[16px] text-[#2a1a08]">{describe(r, lang).title || prettify(r.name)}</span>
                    <span className="block text-[13px] text-[#7a5c33]">
                      {r.language || '—'} · {timeAgo(r.pushedAt, lang)}
                    </span>
                  </span>
                  <span className="text-[#7a4e22]">↗</span>
                </a>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  )
}

const BODY = {
  ...GAME_BODIES,
  now: Now, about: About, education: Education, tech: Tech, work: Work, journey: Journey, contact: Contact }

export default function Panel({ id, title, lang, t, onClose, onLeave, repos, sound, onGameDone }) {
  const Body = BODY[id]
  if (!Body) return null
  return (
    <section
      key={id}
      className="mc-sheet mc-lift fixed inset-x-2 bottom-[76px] z-30 flex max-h-[58vh] flex-col md:inset-x-auto md:bottom-24 md:right-4 md:top-16 md:max-h-none"
      style={{ '--panel-w': `${panelWidth(id)}px` }}
      aria-label={title}
    >
      <header className="flex items-center justify-between gap-2 px-4 pb-2 pt-3">
        <h2 className="font-pixel text-[13px] text-[#3a2410]">{title}</h2>
        <div className="flex gap-2">
          <button className="mc-btn !h-8 !py-0" onClick={onLeave}>
            🚪 <span className="hidden sm:inline">{t.leave}</span>
          </button>
          <button className="mc-btn !h-8 !w-8 !p-0" onClick={onClose} aria-label={t.close} title={`${t.close} (Esc)`}>
            ✕
          </button>
        </div>
      </header>
      <div className="mc-scroll mx-3 mb-3 flex-1 overflow-y-auto px-1 pb-1">
        <Body lang={lang} t={t} repos={repos} sound={sound} onDone={() => onGameDone?.(id)} />
      </div>
    </section>
  )
}
