// /api/[...slug] — real estate control-plane proxy.
//
// The old catch-all mapped story-names to hardcoded localhost ports that do not
// exist, so every agent showed offline. This version resolves reality against
// the canonical control-plane API (:25162):
//
//   /api/<agent>/health   → real online/offline for a real daemon or a known
//                           legacy name (e.g. /api/openfang/health,
//                           /api/vllm/health).
//   /api/services         → passthrough to the real control-plane /services.
//   /api/providers        → passthrough to the real control-plane /providers.
//   anything else         → truthful 404 (no fabricated rows).
import { aggregate, LEGACY_NAME_MAP } from './lib/real-estate'

const CONTROL_API =
  process.env.DELENDAI_CONTROL_API_BASE ?? 'http://127.0.0.1:25162'

export default async function handler(req, res) {
  const { slug } = req.query
  const path = Array.isArray(slug) ? slug.join('/') : String(slug ?? '')
  const parts = path.split('/').filter(Boolean)
  const first = (parts[0] ?? '').toLowerCase()

  // Control-plane passthrough routes.
  if (parts[0] === 'services' || parts[0] === 'providers') {
    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), 3000)
    try {
      const r = await fetch(`${CONTROL_API}/${parts[0]}`, {
        signal: ctrl.signal,
      })
      clearTimeout(timer)
      const body = await r.text()
      res
        .status(r.status)
        .setHeader('Content-Type', 'application/json')
        .send(body)
      return
    } catch {
      clearTimeout(timer)
      return res.status(502).json({ error: 'control-plane unreachable' })
    }
  }

  // Legacy per-agent health: /api/<agent>/health
  const data = await aggregate()
  const agentName = first
  const matches = data.resolveAgent(agentName)

  if (matches.length === 0) {
    // Truthful: no real estate counterpart for this name.
    return res
      .status(404)
      .json({ ok: false, error: 'unknown agent', name: agentName })
  }

  const online = matches.some((m) => m.online)
  res.status(200).json({
    ok: true,
    name: agentName,
    online,
    status: online ? 'online' : 'offline',
    detail: matches,
  })
}
