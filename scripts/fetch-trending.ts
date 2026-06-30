/**
 * Scrape https://github.com/trending (the whole page, no language filter)
 * and save the repos to public/data/<date>.json in ghnews's data format.
 *
 * Unlike the search-API approach, this captures the actual trending
 * page — repos of any age that are trending today, with their real current
 * stars/forks — so no enrichment is needed.
 *
 * - Fetches `https://github.com/trending?since=<window>` (default daily)
 * - Parses each <article class="Box-row"> → name, description, language,
 *   stars, forks, stars-today/week/month, owner
 * - Writes public/data/<today>.json (merges by repo id across re-scrapes
 *   within the same day by default, keeping the earliest first_seen and
 *   refreshing counts from the latest scrape)
 * - Updates public/data/index.json
 *
 * Usage:
 *   pnpm fetch-trending
 *   pnpm fetch-trending -- --since=weekly
 *   pnpm fetch-trending -- --no-merge   # replace today's file instead of unioning
 */

import { writeFileSync, readFileSync, existsSync, mkdirSync, readdirSync } from 'fs'
import { resolve, dirname } from 'path'

// ── helpers ──────────────────────────────────────────────────────────────

function today(): string {
  return new Date().toISOString().split('T')[0]
}

function parseArgs(): { since: 'daily' | 'weekly' | 'monthly'; merge: boolean } {
  const args = process.argv.slice(2)
  let since: 'daily' | 'weekly' | 'monthly' = 'daily'
  let merge = true
  for (const a of args) {
    if (a.startsWith('--since=')) {
      const v = a.slice('--since='.length)
      if (v === 'daily' || v === 'weekly' || v === 'monthly') since = v
    } else if (a === '--no-merge') {
      merge = false
    }
  }
  return { since, merge }
}

function num(s: string | undefined | null): number {
  if (!s) return 0
  return Number(s.replace(/[^0-9]/g, '')) || 0
}

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&#x27;/g, "'")
}

function stripTags(s: string): string {
  return decodeEntities(s.replace(/<[^>]+>/g, '').trim())
}

// ── config ───────────────────────────────────────────────────────────────

const DATA_DIR = resolve(dirname(import.meta.url.replace('file://', '')), '..', 'public', 'data')
const TRENDING_URL = (since: string) => `https://github.com/trending?since=${since}`

// ── scraping ─────────────────────────────────────────────────────────────

interface RepoRow {
  full_name: string
  description: string
  language: string | null
  stars: number
  forks: number
  stars_today: number
  window: 'today' | 'this week' | 'this month'
}

function parseTrending(html: string): RepoRow[] {
  const rows: RepoRow[] = []
  const articleRe = /<article[^>]*class="Box-row"[^>]*>([\s\S]*?)<\/article>/g
  let art: RegExpExecArray | null
  while ((art = articleRe.exec(html)) !== null) {
    const a = art[1]

    const href = a.match(/<h2[^>]*>\s*<a [^>]*href="\/([^"]+)"/)
    const fullName = href ? href[1] : ''
    if (!fullName) continue

    const desc = a.match(/<p class="[^"]*col-9[^"]*"[^>]*>([\s\S]*?)<\/p>/)
    const description = desc ? stripTags(desc[1]) : ''

    const lang = a.match(/itemprop="programmingLanguage"[^>]*>([^<]+)</)
    const language = lang ? lang[1].trim() : null

    const sm = a.match(/\/stargazers"[^>]*>([\s\S]*?)<\/a>/)
    const stars = num(stripTags(sm ? sm[1] : ''))

    const fm = a.match(/\/forks"[^>]*>([\s\S]*?)<\/a>/)
    const forks = num(stripTags(fm ? fm[1] : ''))

    const today = a.match(/([\d,]+)\s*stars\s+(today|this week|this month)/)
    const starsToday = today ? num(today[1]) : 0
    const window = today
      ? (today[2] === 'today' ? 'today' : today[2] === 'this week' ? 'this week' : 'this month')
      : 'today'

    rows.push({ full_name: fullName, description, language, stars, forks, stars_today: starsToday, window })
  }
  return rows
}

async function fetchTrending(since: string): Promise<RepoRow[]> {
  const url = TRENDING_URL(since)
  console.log(`Fetching ${url} …`)
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; ghnews-fetch/1.0)',
      Accept: 'text/html,application/xhtml+xml',
      'Accept-Language': 'en-US,en;q=0.9',
    },
  })
  if (!res.ok) {
    const text = await res.text()
    console.error(`Trending fetch error ${res.status}: ${text.slice(0, 200)}`)
    process.exit(1)
  }
  const html = await res.text()
  const rows = parseTrending(html)
  console.log(`Parsed ${rows.length} trending repo(s)`)
  return rows
}

// ── social preview banner ───────────────────────────────────────────────
// GitHub only exposes a repo's custom social-preview image via the page's
// <meta property="og:image">. When an owner uploads one it's hosted on
// repository-images.githubusercontent.com; repos without a custom preview
// return a generated OG card (opengraph.githubassets.com) instead, which we
// build client-side — so here we keep only the *real* banner URL.

const OG_IMG_RE = /<meta\s+property="og:image"\s+content="([^"]+)"/i

async function fetchBanner(fullName: string): Promise<string | null> {
  try {
    const res = await fetch(`https://github.com/${fullName}`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; ghnews-fetch/1.0)',
        Accept: 'text/html,application/xhtml+xml',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      signal: AbortSignal.timeout(8000),
    })
    if (!res.ok) return null
    const html = await res.text()
    const url = OG_IMG_RE.exec(html)?.[1]
    if (url && url.startsWith('https://repository-images.githubusercontent.com/')) {
      return url
    }
    return null
  } catch {
    return null
  }
}

async function mapPool<T, R>(items: T[], limit: number, fn: (item: T, i: number) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length)
  let i = 0
  const workers = new Array(Math.min(limit, items.length)).fill(0).map(async () => {
    while (i < items.length) {
      const idx = i++
      out[idx] = await fn(items[idx], idx)
    }
  })
  await Promise.all(workers)
  return out
}

// ── main ──────────────────────────────────────────────────────────────────

async function main() {
  const { since, merge } = parseArgs()
  const date = today()
  const dayFile = resolve(DATA_DIR, `${date}.json`)
  const now = new Date().toISOString()

  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true })

  const rows = await fetchTrending(since)

  const scraped = rows.map((r) => {
    const slash = r.full_name.lastIndexOf('/')
    const owner = slash >= 0 ? r.full_name.slice(0, slash) : r.full_name
    const name = slash >= 0 ? r.full_name.slice(slash + 1) : r.full_name
    return {
      id: r.full_name,           // stable across days; full_name is unique
      name,
      full_name: r.full_name,
      html_url: `https://github.com/${r.full_name}`,
      description: r.description,
      stars: r.stars,
      forks: r.forks,
      stars_today: r.stars_today,
      window: r.window,
      language: r.language,
      created_at: `${date}T00:00:00Z`,   // trending date (no real created_at from the page)
      first_seen: now,                    // when this repo first entered today's snapshots
      last_seen: now,                     // last time it was confirmed trending today
      owner: {
        login: owner,
        avatar: `https://github.com/${owner}.png`,
        url: `https://github.com/${owner}`,
      },
    }
  })

  // Resolve custom social-preview banners (real banner only; null otherwise).
  console.log('Fetching social-preview banners…')
  const banners = await mapPool(scraped, 5, (item) => fetchBanner(item.full_name))
  let bannerHits = 0
  scraped.forEach((item, i) => {
    if (banners[i]) {
      item.banner_url = banners[i]
      bannerHits++
    }
  })
  console.log(`  banners: ${bannerHits}/${scraped.length} have a custom preview`)

  let items = scraped
  let firstFetchedAt = now
  let lastFetchedAt = now
  let snapshotCount = 1

  if (merge && existsSync(dayFile)) {
    const prev = JSON.parse(readFileSync(dayFile, 'utf-8'))
    const prevItems: any[] = prev.items || []
    firstFetchedAt = prev.fetched_at || now
    snapshotCount = (prev.snapshots || 1) + 1

    // index previous by id, keeping earliest first_seen
    const byId = new Map<string, any>()
    for (const it of prevItems) byId.set(it.id, it)

    // union: scraped items (fresh counts) + any previous item not seen this scrape
    const merged: any[] = []
    let added = 0
    for (const it of scraped) {
      const old = byId.get(it.id)
      if (old) {
        merged.push({ ...it, first_seen: old.first_seen || old.last_seen || now, last_seen: now, banner_url: it.banner_url || old.banner_url })
      } else {
        merged.push(it)
        added++
      }
    }
    for (const old of prevItems) {
      if (!scraped.some(s => s.id === old.id)) {
        // kept from a prior snapshot, not trending now → preserve as-is, bump last_seen
        merged.push({ ...old, last_seen: now })
      }
    }
    items = merged
    console.log(`  merged: ${scraped.length} scraped + ${prevItems.length} previous → ${items.length} unique (${added} new)`, )
  }

  const payload = {
    date,
    since,
    fetched_at: lastFetchedAt,          // time of this (latest) scrape
    first_fetched_at: firstFetchedAt,    // time of the first scrape for the day
    snapshots: snapshotCount,            // how many scrapes went into this file today
    updated_at: now,
    total_count: items.length,
    items,
  }

  writeFileSync(dayFile, JSON.stringify(payload, null, 2) + '\n')
  console.log(`✓ Wrote ${dayFile} (${items.length} items, snapshot #${snapshotCount})`)

  updateIndex()
}

// ── index.json ────────────────────────────────────────────────────────────

function updateIndex() {
  const files = readdirSync(DATA_DIR)
    .filter(f => /^\d{4}-\d{2}-\d{2}\.json$/.test(f))
    .sort()
    .reverse()                      // newest first

  const dates = files.map(f => f.replace(/\.json$/, ''))
  const index = { dates, updated_at: new Date().toISOString() }

  const indexPath = resolve(DATA_DIR, 'index.json')
  writeFileSync(indexPath, JSON.stringify(index, null, 2) + '\n')
  console.log(`✓ Updated index.json – ${dates.length} date(s)`)
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
