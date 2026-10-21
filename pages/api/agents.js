// /api/agents — real estate agent fleet summary, server-side aggregated.
// Proxies the canonical control-plane API (:25162) + live nvidia-smi GPU.
// One real route → the same real state for every tab.
import { aggregate } from './lib/real-estate'

export default async function handler(req, res) {
  const data = await aggregate()
  const payload = {
    ok: true,
    source: 'delendai-control-api (:25162) + nvidia-smi',
    ...data,
  }
  res.setHeader('Cache-Control', 'no-store')
  res.status(200).json(payload)
}
