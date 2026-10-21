// /api/agents/health — REAL per-agent online/offline from the estate.
// ?name=<agent> resolves against the real pitchfork roster via the
// control-plane API. Unknown agents get a truthful 404 (not a fake status).
import { aggregate } from '../lib/real-estate'

export default async function handler(req, res) {
  const name = String(req.query.name ?? '').trim()
  if (!name) {
    return res.status(400).json({
      ok: false,
      error:
        'missing "name" query param, e.g. /api/agents/health?name=beellama',
    })
  }

  const data = await aggregate()
  const matches = data.resolveAgent(name)

  if (!matches.length) {
    return res.status(404).json({ ok: false, error: 'unknown agent', name })
  }

  const online = matches.some((m) => m.online)
  res.setHeader('Cache-Control', 'no-store')
  res.status(200).json({
    ok: true,
    name,
    online,
    status: matches.map((m) => m.status),
    agents: matches,
  })
}
