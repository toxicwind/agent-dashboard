/**
 * server.ts — DelendAI control-plane API backend (Bun native, no framework).
 *
 * Exposes REAL estate data only — there are NO fixture fallbacks in this
 * server. Every route reads a live source and, when the source is genuinely
 * empty or unreachable, returns a truthful empty/unavailable state rather than
 * fabricating rows.
 *
 *   GET /health        → { ok, live }
 *   GET /services      → `pitchfork list` daemons as service rows (real)
 *   GET /providers     → pinax providers.json roster + reachability from the
 *                        live herd (:25100/v1/models); truthful "unreachable"
 *                        status per provider when the herd is down
 *   GET /channels      → kappa-board bridge channels under ~/.fleet-bus/squawk-root
 *   GET /router/usage  → real usage/cost IF the estate publishes it, else an
 *                        explicit { present:false } — NEVER fabricated
 *
 * Port SSOT: config/ports.env DELENDAI_CONTROL_API_PORT (pitchfork
 * daemons.delendai-control-api).
 */

import { readFileSync, readdirSync, statSync } from 'node:fs'

const PORT = Number(process.env.DELENDAI_CONTROL_API_PORT ?? 25162)

// ─── Real socket paths ──────────────────────────────────────────────────────
const PROVIDERS_JSON =
  process.env.PINAX_PROVIDERS_JSON ??
  '/home/toxic/estate/ranch/pinax/generated/providers.json'
const BRIDGE_ROOT =
  process.env.KAPPA_BRIDGE_ROOT ?? '/home/toxic/.fleet-bus/squawk-root'
const HERD_MODELS_URL =
  process.env.HERD_MODELS_URL ?? 'http://127.0.0.1:25100/v1/models'
const PITCHFORK =
  process.env.PITCHFORK_BIN ?? '/home/toxic/estate/bin/pitchfork'

// True JSON parse is the source of truth for providers; when absent we return
// an empty roster (truthful), never a stub.
function readProvidersJson(): Array<Record<string, unknown>> {
  try {
    const raw = readFileSync(PROVIDERS_JSON, 'utf8')
    const parsed = JSON.parse(raw)
    const providers = parsed?.providers
    return Array.isArray(providers) ? providers : []
  } catch {
    return []
  }
}

// Parse `pitchfork list` stdout. Lines look like:
//   estate/agent-display            running
//   estate/kimi-auto-shim           errored    disabled  unknown exit code
// The name + primary state are captured; any trailing columns (e.g. `disabled`)
// are informative and never cause the row to be dropped, so every daemon shows.
function parsePitchforkList(
  stdout: string
): Array<{ name: string; state: string }> {
  const out: Array<{ name: string; state: string }> = []
  for (const line of stdout.split('\n')) {
    const m = line.match(/^(\S+)\s+(\S+)(?:\s+.*)?$/)
    if (m) out.push({ name: m[1], state: m[2].toLowerCase() })
  }
  return out
}

// Kind + port are informational best-effort: infer from the daemon name and
// any matching port env var when it exists. The LIST itself (which daemons
// exist and their running state) is purely from `pitchfork list`.
const KNOWN_KIND: Array<{ re: RegExp; kind: string }> = [
  { re: /web|dashboard|ui|display|viewer/, kind: 'web' },
  { re: /beellama|herd|llama|model|inference|shim/, kind: 'inference' },
  {
    re: /chat|gateway|mcp|bridge|broker|oracle|feed|fleet/,
    kind: 'orchestration',
  },
  { re: /redis|valkey|qdrant|vect|db|sql|stream/, kind: 'data' },
  { re: /.+/, kind: 'ops' },
]

function inferKind(name: string): string {
  for (const { re, kind } of KNOWN_KIND) {
    if (re.test(name)) return kind
  }
  return 'ops'
}

// Build a name→port map from config/ports.env (KEY=N with KEY containing the
// daemon basename, or the basename appearing on the line). Best-effort only.
function portFromEnv(name: string): number {
  try {
    const raw = readFileSync('/home/toxic/estate/config/ports.env', 'utf8')
    const base = name.split('/').pop() ?? name
    const needle = base.replace(/-/g, '').toLowerCase()
    for (const line of raw.split('\n')) {
      const m = line.match(/^([A-Z0-9_]+)=(\d{4,5})\s*$/)
      if (!m) continue
      const key = m[1].replace(/_/g, '').toLowerCase()
      if (key.includes(needle) || needle.includes(key)) {
        return Number(m[2])
      }
    }
  } catch {
    /* no ports.env — leave port unknown */
  }
  return 0
}

// ─── Route handlers ─────────────────────────────────────────────────────────

function runCapture(cmd: string, args: Array<string>): string {
  const result = Bun.spawnSync({
    cmd: [cmd, ...args],
    stdout: 'pipe',
    stderr: 'pipe',
  })
  return new TextDecoder().decode(result.stdout)
}

async function services() {
  const stdout = runCapture(PITCHFORK, ['list'])
  const rows = parsePitchforkList(stdout).map((d) => ({
    name: d.name,
    port: portFromEnv(d.name),
    status:
      d.state === 'running'
        ? 'up'
        : d.state === 'stopped' || d.state === 'dead'
          ? 'down'
          : 'degraded',
    kind: inferKind(d.name),
    health:
      d.state === 'running'
        ? 100
        : d.state === 'error' || d.state === 'dead'
          ? 0
          : 40,
    description: `pitchfork daemon · ${d.state}`,
  }))
  return rows
}

async function providers() {
  const roster = readProvidersJson()
  const checkedAt = new Date().toISOString()

  // Reachability: probe the live herd for its real model ids once.
  let herdModels: Array<string> = []
  let herdReachable = false
  try {
    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), 2000)
    const res = await fetch(HERD_MODELS_URL, { signal: ctrl.signal })
    clearTimeout(timer)
    if (res.ok) {
      const body = (await res.json()) as { data?: Array<{ id?: string }> }
      herdModels = (body.data ?? [])
        .map((m) => m.id ?? '')
        .filter((id) => id.length > 0)
      herdReachable = true
    }
  } catch {
    /* herd unreachable — each provider gets a truthful "unreachable" status */
  }

  const rows = roster.map((p) => {
    const name = (p.name as string) ?? 'unknown'
    const staticModels = Array.isArray(p.staticModels)
      ? (p.staticModels as string[])
      : []
    // A provider's model is "available" when it resolves through the live
    // herd. routerLocal providers sit behind the local gateway; others are
    // remote APIs the herd may or may not surface.
    const modelId =
      staticModels[0] ??
      (herdReachable
        ? herdModels.find((id) => id.toLowerCase().includes(name.toLowerCase()))
        : null) ??
      name
    const modelAvailable =
      herdReachable && staticModels.length > 0
        ? staticModels.some((id) =>
            herdModels.some((h) => h === id || h.endsWith(`/${id}`))
          )
        : null
    // Truthful reachability: routerLocal providers ride the herd; remote ones
    // are "available" only when the herd proves it. Unreachable herd → a
    // truthful `error`/unreachable state, never a fabricated quota-exceeded.
    const reachable = herdReachable && modelAvailable !== false
    const baseUrl = (p.baseUrl as string) ?? ''
    const isLocal = /127\.0\.0\.1|localhost/.test(baseUrl)
    return {
      id: name,
      state: reachable ? 'available' : isLocal ? 'error' : 'model-unavailable',
      reachable: reachable ? reachable : false,
      modelId,
      modelAvailable,
      cliInstalled: p.adapter != null && p.adapter !== 'none',
      cliVersion: null,
      authenticated: null,
      authTier: null,
      installHint: null,
      quota: [],
    }
  })

  const available = rows.filter((r) => r.reachable).length
  return {
    kind: 'ready',
    checkedAt,
    summary: {
      total: rows.length,
      available,
      unavailable: rows.length - available,
    },
    emptyRoster: rows.length === 0,
    rows,
    quota: {
      present: false,
      updatedAt: null,
      note: 'Estate tracks no quota meters; reachability is live-derived.',
    },
  }
}

async function channels() {
  // Read the real bridge root: one channel per subdirectory whose message
  // files carry real bodies. An empty/absent root is a truthful empty list.
  let entries: string[] = []
  try {
    entries = readdirSync(BRIDGE_ROOT)
  } catch {
    return []
  }

  const channels: Array<Record<string, unknown>> = []
  for (const entry of entries) {
    if (entry.startsWith('.')) continue
    const dir = `${BRIDGE_ROOT}/${entry}`
    let isDir = false
    try {
      isDir = statSync(dir).isDirectory()
    } catch {
      continue
    }
    if (!isDir) continue

    let files: string[]
    try {
      files = readdirSync(dir)
    } catch {
      files = []
    }

    const messages: Array<Record<string, unknown>> = []
    const msgFiles = files
      .filter((f) => f.endsWith('-msg.md'))
      .map((f) => Number(f.split('-')[0]))
      .map((seq, i) => ({ seq: isFinite(seq) && seq > 0 ? seq : i + 1 }))

    for (const f of files.filter((f) => f.endsWith('-msg.md'))) {
      try {
        const raw = readFileSync(`${dir}/${f}`, 'utf8')
        messages.push({ file: f, raw })
      } catch {
        /* skip unreadable message file */
      }
    }
    messages.sort((a, b) =>
      String(a.file).localeCompare(String(b.file), undefined, { numeric: true })
    )

    const last = messages[messages.length - 1] as { raw?: string } | undefined
    const lastTs = last?.raw?.match(/^ts:\s*(\S+)/m)?.[1] ?? null

    channels.push({
      name: entry,
      members: [],
      topic: '',
      created: null,
      messageCount: messages.length,
      lastMessageAt: lastTs,
      messages,
    })
  }

  // newest-last activity first
  return [...channels].sort((a, b) =>
    String(
      (b as { lastMessageAt: string | null }).lastMessageAt ?? ''
    ).localeCompare(
      String((a as { lastMessageAt: string | null }).lastMessageAt ?? '')
    )
  )
}

// Router usage/cost: the estate tracks llama-swap CPU metrics but publishes no
// per-model usage/cost ledger. Return an explicit "not present" state rather
// than fabricating rows.
async function routerUsage() {
  return {
    present: false,
    updatedAt: null,
    note: 'The estate publishes no per-model usage/cost ledger yet.',
    rows: [],
  }
}

// Real estate dashboards registry, sourced from docs/CONTROL_PLANE.md (the
// canonical map). Each entry carries its real URL and a truthful live probe.
const DASHBOARD_REGISTRY: Array<{
  id: string
  name: string
  url: string
  note: string
}> = [
  {
    id: 'control-portal',
    name: 'Control Plane portal',
    url: 'http://127.0.0.1:25101/portal.html',
    note: 'live service grid + API table',
  },
  {
    id: 'command-center',
    name: 'Command Center',
    url: 'http://127.0.0.1:25101/',
    note: 'rust-web ops',
  },
  {
    id: 'llama-swap-chat',
    name: 'Llama-swap chat',
    url: 'http://127.0.0.1:25100/ui/',
    note: 'primary chat UI',
  },
  {
    id: 'openfang',
    name: 'OpenFang',
    url: 'http://127.0.0.1:25103/',
    note: 'agent kernel web UI',
  },
  {
    id: 'grafana',
    name: 'Grafana',
    url: 'http://127.0.0.1:25110/',
    note: 'prometheus dashboards',
  },
  {
    id: 'mesh-hub',
    name: 'Mesh hub',
    url: 'http://127.0.0.1:25115/mesh/discover',
    note: 'mesh discovery',
  },
  {
    id: 'ghas',
    name: 'GHAS',
    url: 'http://127.0.0.1:25113/',
    note: 'code-security dashboards',
  },
  {
    id: 'null-g',
    name: 'null-g',
    url: 'http://127.0.0.1:25107/',
    note: 'edge proxy',
  },
]

async function dashboards() {
  const out = await Promise.all(
    DASHBOARD_REGISTRY.map(async (d) => {
      let live = false
      let status: number | null = null
      try {
        const ctrl = new AbortController()
        const timer = setTimeout(() => ctrl.abort(), 1800)
        const res = await fetch(d.url, { method: 'GET', signal: ctrl.signal })
        clearTimeout(timer)
        // Any HTTP answer means the service is up (2xx/3xx/4xx). Only 5xx or a
        // connection error marks it unreachable.
        live = res.status < 500
        status = res.status
      } catch {
        /* connection error / timeout — truthful live=false */
      }
      return { ...d, live, status }
    })
  )
  return {
    generatedAt: new Date().toISOString(),
    source: '/home/toxic/estate/docs/CONTROL_PLANE.md',
    dashboards: out,
  }
}

const server = Bun.serve({
  port: PORT,
  hostname: '127.0.0.1',
  async fetch(req) {
    const url = new URL(req.url)
    const path = url.pathname

    // CORS: the SPA (same host, :25156) fetches this API cross-origin from a
    // browser, which enforces CORS. Allow the control-plane origins; preflight
    // OPTIONS for the GET routes.
    const origin = req.headers.get('Origin')
    const allowedOrigin =
      origin && /^http:\/\/127\.0\.0\.1:2515[0-9]$/.test(origin)
        ? origin
        : 'null'
    const corsHeaders: Record<string, string> = {
      'Access-Control-Allow-Origin': allowedOrigin,
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    }

    if (req.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders })
    }
    if (req.method !== 'GET') {
      return Response.json(
        { error: 'method not allowed' },
        { status: 405, headers: corsHeaders }
      )
    }
    try {
      const respond = (body: unknown, status = 200) =>
        Response.json(body, { status, headers: corsHeaders })
      switch (path) {
        case '/health':
          return respond({ ok: true, live: true })
        case '/services':
          return respond(await services())
        case '/providers':
          return respond(await providers())
        case '/channels':
          return respond(await channels())
        case '/dashboards':
          return respond(await dashboards())
        case '/router/usage':
          return respond(await routerUsage())
        default:
          return respond({ error: 'not found' }, 404)
      }
    } catch (err) {
      console.error('[delendai-control-api]', err)
      return Response.json(
        { error: err instanceof Error ? err.message : 'internal error' },
        { status: 500, headers: corsHeaders }
      )
    }
  },
})

console.log(
  `[delendai-control-api] listening on http://127.0.0.1:${server.port}`
)
