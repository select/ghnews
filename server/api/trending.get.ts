import { defineEventHandler, getQuery } from 'h3'

export default defineEventHandler(async (event) => {
  const query = getQuery(event) as Record<string, string | undefined>
  const days = Number(query.days || '7')
  const per_page = Number(query.per_page || '50')

  const date = new Date()
  date.setDate(date.getDate() - days)
  const iso = date.toISOString().split('T')[0]

  const q = `created:>${iso}`
  const url = `https://api.github.com/search/repositories?q=${encodeURIComponent(q)}&sort=stars&order=desc&per_page=${per_page}`

  const headers: Record<string, string> = {
    'Accept': 'application/vnd.github+json',
    'User-Agent': 'nuxt-app'
  }
  const token = process.env.GITHUB_TOKEN || process.env.NUXT_PUBLIC_GITHUB_TOKEN
  if (token) headers['Authorization'] = `Bearer ${token}`

  const res = await fetch(url, { headers })
  if (!res.ok) {
    const text = await res.text()
    event.node.res.statusCode = res.status
    return { error: text }
  }

  const data = await res.json()
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
      url: r.owner?.html_url
    }
  }))

  return { total_count: data.total_count, items }
})
