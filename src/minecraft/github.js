// =====================================================================
//  Ambil repo GitHub yang terakhir di-push → ditampilkan di panggung.
//  Tanpa token (batas 60 request/jam per IP), jadi hasilnya di-cache 15 menit.
// =====================================================================

import { profile, repoNotes, repoFallback } from '../data'

const USER = profile.github.split('/').pop()
const EXCLUDE = new Set(['portfolio', USER, `${USER}a`]) // repo portfolio & profil
const CACHE_KEY = 'gh-recent-v1'
const TTL = 15 * 60 * 1000

export async function fetchRecentRepos() {
  try {
    const cached = JSON.parse(sessionStorage.getItem(CACHE_KEY) || 'null')
    if (cached && Date.now() - cached.at < TTL) return cached.repos
  } catch (e) {
    /* storage tidak tersedia */
  }
  try {
    const res = await fetch(`https://api.github.com/users/${USER}/repos?sort=pushed&per_page=12`, {
      headers: { Accept: 'application/vnd.github+json' },
    })
    if (!res.ok) throw new Error(res.status)
    const data = await res.json()
    const repos = data
      .filter((r) => !r.fork && !r.archived && !EXCLUDE.has(r.name))
      .slice(0, 5)
      .map((r) => ({
        name: r.name,
        description: r.description,
        language: r.language,
        url: r.html_url,
        pushedAt: r.pushed_at,
        topics: r.topics || [],
      }))
    try {
      sessionStorage.setItem(CACHE_KEY, JSON.stringify({ at: Date.now(), repos }))
    } catch (e) {
      /* abaikan */
    }
    return repos
  } catch (e) {
    return repoFallback
  }
}

// Gabungkan data GitHub dengan catatan buatan sendiri (judul & deskripsi 2 bahasa)
export function describe(repo, lang) {
  const note = repoNotes[repo.name] || {}
  const en = lang === 'en'
  return {
    title: (en ? note.titleEn : note.title) || prettify(repo.name),
    desc: (en ? note.descEn : note.desc) || repo.description || '',
    points: (en ? note.pointsEn : note.points) || [],
    tags: note.tags || [repo.language, ...repo.topics].filter(Boolean).join(' · '),
  }
}

export const prettify = (name) => name.replace(/[-_]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())

export function timeAgo(iso, lang) {
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000)
  const units = lang === 'en'
    ? [[86400 * 30, 'month'], [86400 * 7, 'week'], [86400, 'day'], [3600, 'hour'], [60, 'minute']]
    : [[86400 * 30, 'bulan'], [86400 * 7, 'minggu'], [86400, 'hari'], [3600, 'jam'], [60, 'menit']]
  for (const [sec, name] of units) {
    const n = Math.floor(s / sec)
    if (n >= 1) return lang === 'en' ? `${n} ${name}${n > 1 ? 's' : ''} ago` : `${n} ${name} lalu`
  }
  return lang === 'en' ? 'just now' : 'baru saja'
}
