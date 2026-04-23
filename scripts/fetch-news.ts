/**
 * Fetch trending GitHub repos and save to public/data/<date>.json
 *
 * Generates one JSON file per day. Each file contains repos created in
 * the last `--days` days (default 7), sorted by stars.
 *
 * - If `public/data/<today>.json` already exists → skip
 * - Updates public/data/index.json with the list of available dates
 *
 * Usage:  pnpm fetch-news
 *         pnpm fetch-news -- --days 1
 *         GITHUB_TOKEN=xxx pnpm fetch-news
 */

import { writeFileSync, readFileSync, existsSync, mkdirSync, readdirSync } from 'fs'
import { resolve, dirname } from 'path'

// ── helpers ──────────────────────────────────────────────────────────────

function today(): string {
  return new Date().toISOString().split('T')[0]
}

function isoDaysAgo(days: number): string {
  const d = new Date()
  d.setDate(d.getDate() - days)
  return d.toISOString().split('T')[0]
}

function parseArgs(): { days: number } {
  const args = process.argv.slice(2)
  let days = 7
  const daysIdx = args.indexOf('--days')
  if (daysIdx !== -1 && args[daysIdx + 1]) {
    days = Number(args[daysIdx + 1]) || 7
  }
  return { days }
}

// ── config ───────────────────────────────────────────────────────────────

const PER_PAGE = 50
const DATA_DIR = resolve(dirname(import.meta.url.replace('file://', '')), '..', 'public', 'data')

// ── main ──────────────────────────────────────────────────────────────────

async function main() {
  const { days } = parseArgs()
  const date = today()
  const dayFile = resolve(DATA_DIR, `${date}.json`)

  // ensure data dir exists
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true })

  // skip if we already have today's data
  if (existsSync(dayFile)) {
    const existing = JSON.parse(readFileSync(dayFile, 'utf-8'))
    if (existing.items && existing.items.length > 0) {
      console.log(`⏭  ${date}.json already exists (${existing.items.length} items) – skipping`)
      updateIndex()
      return
    }
  }

  // build GitHub search query – repos created in last N days, sorted by stars
  const since = isoDaysAgo(days)
  const q = `created:>${since}`
  const url = `https://api.github.com/search/repositories?q=${encodeURIComponent(q)}&sort=stars&order=desc&per_page=${PER_PAGE}`

  const headers: Record<string, string> = {
    Accept: 'application/vnd.github+json',
    'User-Agent': 'ghnews-fetch',
  }
  const token = process.env.GITHUB_TOKEN
  if (token) headers['Authorization'] = `Bearer ${token}`

  console.log(`Fetching repos created after ${since} (last ${days} days) …`)
  const res = await fetch(url, { headers })

  if (!res.ok) {
    const text = await res.text()
    console.error(`GitHub API error ${res.status}: ${text}`)
    process.exit(1)
  }

  const data = await res.json() as any

  const items = (data.items || []).map((r: any) => ({
    id: r.id,
    name: r.name,
    full_name: r.full_name,
    html_url: r.html_url,
    description: r.description,
    stars: r.stargazers_count,
    forks: r.forks_count,
    language: r.language,
    created_at: r.created_at,
    owner: {
      login: r.owner?.login,
      avatar: r.owner?.avatar_url,
      url: r.owner?.html_url,
    },
  }))

  const payload = {
    date,
    since,
    days,
    fetched_at: new Date().toISOString(),
    total_count: data.total_count,
    items,
  }

  writeFileSync(dayFile, JSON.stringify(payload, null, 2) + '\n')
  console.log(`✓ Wrote ${dayFile} (${items.length} items)`)

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
  console.log(`✓ Updated index.json – ${dates.length} date(s): ${dates.join(', ')}`)
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
