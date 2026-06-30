/**
 * Import the last year of GitHub trending data from
 * https://github.com/larsbijl/trending_archive into ghnews's data format.
 *
 * The archive stores daily Markdown files (YYYY-MM-DD.md) grouped by language.
 * It only has repo name + url + description — no stars/forks/created_at — so
 * we import partial data: stars/forks are 0, created_at is the trending date
 * (so date separators reflect when a repo was trending), owner is parsed from
 * owner/name.
 *
 * Existing public/data/<date>.json files are NOT overwritten (real, enriched
 * data wins). index.json is rebuilt afterwards.
 *
 * Usage:
 *   pnpm import-archive                  # clone the archive to a temp dir
 *   pnpm import-archive -- --src=PATH    # use a local clone
 *   pnpm import-archive -- --months=12  # window size (default 12)
 */

import { readdirSync, readFileSync, existsSync, writeFileSync, mkdirSync } from 'fs'
import { resolve, dirname } from 'path'
import { spawnSync } from 'child_process'
import { tmpdir } from 'os'

// ── helpers ──────────────────────────────────────────────────────────────

function parseArgs(): { src: string | null; months: number } {
  const args = process.argv.slice(2)
  let src: string | null = null
  let months = 12
  for (const a of args) {
    if (a.startsWith('--src=')) src = a.slice('--src='.length)
    else if (a.startsWith('--months=')) months = Number(a.slice('--months='.length)) || 12
  }
  return { src, months }
}

function isoMonthsAgo(months: number): string {
  const d = new Date()
  d.setMonth(d.getMonth() - months)
  return d.toISOString().split('T')[0]
}

function stableId(s: string): number {
  // 32-bit FNV-1a hash → positive int, safe for use as a Vue :key / repo.id
  let h = 0x811c9dc5
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0
  }
  return h
}

// ── archive acquisition ──────────────────────────────────────────────────

function ensureArchive(src: string | null): string {
  if (src) {
    if (!existsSync(resolve(src, 'README.md')) && !existsSync(resolve(src, 'index.py'))) {
      throw new Error(`--src=${src} does not look like the trending_archive repo`)
    }
    return src
  }
  const dest = resolve(tmpdir(), 'trending_archive-import')
  if (existsSync(resolve(dest, 'README.md'))) {
    console.log(`♻  Reusing cached clone at ${dest}`)
    return dest
  }
  console.log(`⬇  Cloning larsbijl/trending_archive → ${dest}`)
  const r = spawnSync('git', ['clone', '--depth', '1', 'https://github.com/larsbijl/trending_archive.git', dest], { stdio: 'inherit' })
  if (r.status !== 0) throw new Error('git clone failed')
  return dest
}

// ── markdown parsing ─────────────────────────────────────────────────────

const REPO_RE = /^\* \[([^)]+)\]\(([^)]+)\)(?::\s*(.*))?$/

function parseMd(path: string, date: string): any[] {
  const lines = readFileSync(path, 'utf-8').split('\n')
  let lang = ''
  const items: any[] = []
  for (const line of lines) {
    const m = line.match(REPO_RE)
    if (!m) {
      const lm = line.match(/^####\s+(.*)$/)
      if (lm) lang = lm[1].trim().toLowerCase()
      continue
    }
    const fullName = m[1].trim()
    const url = m[2].trim()
    const description = (m[3] || '').trim()
    const slash = fullName.lastIndexOf('/')
    const owner = slash >= 0 ? fullName.slice(0, slash) : fullName
    const name = slash >= 0 ? fullName.slice(slash + 1) : fullName
    items.push({
      id: stableId(fullName),
      name,
      full_name: fullName,
      html_url: url,
      description,
      stars: 0,
      forks: 0,
      language: lang || null,
      created_at: `${date}T00:00:00Z`,
      owner: { login: owner, avatar: '', url: `https://github.com/${owner}` },
      _trending_date: date,
      _source: 'archive',
    })
  }
  return items
}

// ── index.json ───────────────────────────────────────────────────────────

function updateIndex(dataDir: string) {
  const files = readdirSync(dataDir)
    .filter(f => /^\d{4}-\d{2}-\d{2}\.json$/.test(f))
    .sort()
    .reverse()
  const dates = files.map(f => f.replace(/\.json$/, ''))
  const index = { dates, updated_at: new Date().toISOString() }
  writeFileSync(resolve(dataDir, 'index.json'), JSON.stringify(index, null, 2) + '\n')
  console.log(`✓ Updated index.json – ${dates.length} date(s)`)
}

// ── main ──────────────────────────────────────────────────────────────────

function main() {
  const { src, months } = parseArgs()
  const archiveDir = ensureArchive(src)
  const dataDir = resolve(dirname('.'), 'public', 'data')
  if (!existsSync(dataDir)) mkdirSync(dataDir, { recursive: true })

  const cutoff = isoMonthsAgo(months)
  console.log(`Importing trending data since ${cutoff} (last ${months} months)`)

  // Collect all daily md files (skip _short), anywhere in the tree
  const allMd: string[] = []
  function walk(dir: string) {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = resolve(dir, entry.name)
      if (entry.isDirectory()) walk(full)
      else if (/^\d{4}-\d{2}-\d{2}\.md$/.test(entry.name)) allMd.push(full)
    }
  }
  walk(archiveDir)

  const inRange = allMd
    .map(p => ({ path: p, date: (p.split('/').pop() || '').replace(/\.md$/, '') }))
    .filter(x => x.date >= cutoff)
    .sort((a, b) => (a.date < b.date ? 1 : -1))

  let written = 0
  let skipped = 0
  let totalItems = 0
  for (const { path, date } of inRange) {
    const out = resolve(dataDir, `${date}.json`)
    if (existsSync(out)) {
      skipped++
      continue
    }
    const items = parseMd(path, date)
    if (items.length === 0) continue
    const payload = { date, items, _source: 'archive', _partial: true }
    writeFileSync(out, JSON.stringify(payload, null, 2) + '\n')
    written++
    totalItems += items.length
  }

  console.log(`✓ Wrote ${written} day file(s) (${totalItems} items), skipped ${skipped} existing`)
  updateIndex(dataDir)
}

main()
