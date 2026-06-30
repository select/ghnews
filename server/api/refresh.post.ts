import { spawn } from 'child_process'
import { resolve } from 'path'

/**
 * Runs the fetch-trending script to refresh today's trending data.
 * Only callable from localhost (guarded by the client UI); the script
 * writes new files into public/data/ and updates index.json.
 */
export default defineEventHandler(async (event) => {
  // Block non-localhost callers as a safety net
  const host = getHeader(event, 'host') || ''
  const url = getRequestURL(event)
  const hostname = url.hostname || host.split(':')[0]
  if (hostname !== 'localhost' && hostname !== '127.0.0.1' && hostname !== '0.0.0.0') {
    throw createError({ statusCode: 403, statusMessage: 'Forbidden: localhost only' })
  }

  const script = resolve(process.cwd(), 'scripts/fetch-trending.ts')
  const env = { ...process.env }
  // Provide the dev token if missing so local refreshes work without export
  if (!env.GITHUB_TOKEN && env.GH_TOKEN) env.GITHUB_TOKEN = env.GH_TOKEN

  return new Promise((resolve) => {
    const child = spawn('npx', ['tsx', script], {
      env,
      cwd: process.cwd(),
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    let stdout = ''
    let stderr = ''
    child.stdout.on('data', (d) => { stdout += d })
    child.stderr.on('data', (d) => { stderr += d })
    child.on('error', (err) => {
      resolve({ ok: false, exitCode: -1, stdout, stderr: stderr + (err?.message || String(err)) })
    })
    child.on('close', (code) => {
      resolve({ ok: code === 0, exitCode: code ?? -1, stdout, stderr })
    })
  })
})
