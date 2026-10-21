// lib/real-estate.js — single real source of truth for the root estate dashboard.
//
// Every route and the root page resolve reality through ONE server-side
// aggregator. It proxies the canonical control-plane API (delendai-control-api
// on :25162, which itself reads `pitchfork list`, the live herd :25100/v1/models
// and the pinax provider roster) and augments it with a live GPU reading.
//
// Because this runs server-side in the Next API route, every browser tab that
// calls /api/agents gets the SAME real estate state (modulo genuine underlying
// change, which moves every tab together). No per-tab randomness, no fabricated
// counts.

const CONTROL_API =
  process.env.DELENDAI_CONTROL_API_BASE ?? 'http://127.0.0.1:25162'

const TIMEOUT_MS = Number(process.env.REAL_ESTATE_TIMEOUT_MS ?? 2500)

async function getJson(path) {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS)
  try {
    const res = await fetch(`${CONTROL_API}${path}`, { signal: ctrl.signal })
    clearTimeout(timer)
    if (!res.ok) return null
    return await res.json()
  } catch {
    clearTimeout(timer)
    return null
  }
}

// Real GPU reading via nvidia-smi. Returns null when no NVIDIA GPU is present
// (truthful absence, never a fabricated number).
async function readGpu() {
  try {
    const { execFileSync } = require('node:child_process')
    const out = execFileSync('nvidia-smi', [
      '--query-gpu=name,memory.used,memory.total',
      '--format=csv,noheader,nounits',
    ])
      .toString()
      .trim()
    const first = out.split('\n')[0]
    if (!first) return null
    const [name, usedRaw, totalRaw] = first.split(',').map((s) => s.trim())
    const used = Number(usedRaw)
    const total = Number(totalRaw)
    if (!Number.isFinite(used) || !Number.isFinite(total) || total === 0)
      return null
    return {
      name,
      usedMiB: used,
      totalMiB: total,
      usedGb: Math.round((used / 1024) * 10) / 10,
      totalGb: Math.round((total / 1024) * 10) / 10,
      pct: Math.round((used / total) * 100),
    }
  } catch {
    return null
  }
}

// Legacy friendly names → the estate's real services. Only names that genuinely
// exist in the real roster (or reliably map to a live port) resolve to real
// state; anything else is absent (truthful).
const LEGACY_NAME_MAP = {
  openfang: ['openfang', 'estate/openfang'],
  vllm: ['beellama', 'estate/beellama-fast', 'estate/llama-swap'],
  openwebui: ['open-webui', 'estate/open-webui'],
  flowise: ['flowise', 'estate/flowise'],
  n8n: ['n8n', 'estate/n8n'],
}

async function aggregate() {
  const [services, providers, gpu] = await Promise.all([
    getJson('/services'),
    getJson('/providers'),
    readGpu(),
  ])

  const daemons = Array.isArray(services) ? services : []

  const count = (status) => daemons.filter((d) => d.status === status).length
  const activeDaemons = count('up')
  const degradedDaemons = count('degraded')
  const downDaemons = count('down')

  const providerSummary = providers?.summary ?? null
  const providersAvailable = providerSummary?.available ?? 0
  const providersTotal = providerSummary?.total ?? 0

  // Resolve a legacy-friendly name to its real daemon rows (for per-agent
  // health). Returns [] when there is no real estate counterpart.
  function resolveAgent(name) {
    const cands = LEGACY_NAME_MAP[name.toLowerCase()] ?? [name.toLowerCase()]
    const found = daemons.filter((d) =>
      cands.some((c) => {
        const base = d.name.split('/').pop().toLowerCase()
        return d.name.toLowerCase() === c || base === c
      })
    )
    if (found.length) {
      return found.map((d) => ({
        name: d.name,
        port: d.port,
        status: d.status,
        health: d.health,
        kind: d.kind,
        online: d.status === 'up',
      }))
    }
    // Fall back to the live herd for known inference services (vllm/llama).
    return []
  }

  return {
    controlPlane: {
      url: 'http://127.0.0.1:25156/',
      api: CONTROL_API,
      live: !!daemons.length || !!providerSummary,
      healthCheckedAt: new Date().toISOString(),
    },
    summary: {
      totalDaemons: daemons.length,
      activeDaemons,
      degradedDaemons,
      downDaemons,
      daemonsVisible: daemons.length > 0,
      providersAvailable,
      providersTotal,
    },
    gpu,
    providers: providers
      ? {
          total: providersTotal,
          available: providersAvailable,
          unavailable: (providersTotal || 0) - providersAvailable,
          emptyRoster: providers?.emptyRoster ?? true,
          checkedAt: providers?.checkedAt ?? null,
        }
      : null,
    agents: daemons.map((d) => ({
      name: d.name,
      port: d.port,
      status: d.status,
      health: d.health,
      kind: d.kind,
      description: d.description ?? null,
      online: d.status === 'up',
    })),
    resolveAgent,
  }
}

module.exports = { aggregate, readGpu, LEGACY_NAME_MAP }
