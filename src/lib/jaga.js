// Client for Hosan's link-agent service (Bright Data + Daytona + TokenRouter).
// Dev: calls /api/* which Vite proxies to http://localhost:8000.
// Response shape: { agent, risk: 0-100, findings: [string], evidence: {}, summary? }

const URL_RE = /((?:https?:\/\/|www\.)\S+|[a-z0-9-]+(?:\.[a-z0-9-]+)*\.[a-z]{2,}(?:\/\S*)?)/i

// Pull the first link out of a pasted message (or return null).
export function extractUrl(text) {
  const m = (text || '').match(URL_RE)
  if (!m) return null
  let u = m[0].replace(/[.,)]+$/, '')
  if (!/^https?:\/\//i.test(u)) u = 'https://' + u
  return u
}

// POST a URL to the link agent. Throws if the service isn't reachable.
export async function investigateLink(url, { phone } = {}) {
  const res = await fetch('/api/investigate-link', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url, phone }),
  })
  if (!res.ok) throw new Error(`Link API responded ${res.status}`)
  return res.json()
}

// Map a 0-100 risk score to the verdict route variant.
export function verdictVariant(risk) {
  if (risk >= 60) return 'scam'
  if (risk >= 30) return 'careful'
  return 'safe'
}
