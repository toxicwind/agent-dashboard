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
 *   GET /chats         → RUNNING agent chats (tau / kappa / kimi / squawk
 *                        board) + the chat surface registry, both derived from
 *                        live sources
 *   GET /surfaces      → the chat surface registry alone (daemons + ports +
 *                        truthful live probe), composed from the estate SSOTs
 *                        (config/ports.env + pitchfork.d) by @ranch/surface-
 *                        registry and enriched with live supervisor state
 *   GET /router/usage  → real usage/cost IF the estate publishes it, else an
 *                        explicit { present:false } — NEVER fabricated
 *
 * Port SSOT: config/ports.env DELENDAI_CONTROL_API_PORT (pitchfork
 * daemons.delendai-control-api).
 */

import {
  closeSync,
  openSync,
  readSync,
  readFileSync,
  readdirSync,
  statSync,
} from 'node:fs'
import { connect } from 'node:net'
import { Database } from 'bun:sqlite'
import {
  composeManifest,
  daemonPort,
  readEstateSources,
  type ManifestSurface,
  type PitchforkDaemon,
  type SurfaceManifest,
} from '../../packages/surface-registry/src/index.ts'

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

// ─── Chat surface + running chat sources (all live, all overridable) ───────
const PORTS_ENV =
  process.env.ESTATE_PORTS_ENV ?? '/home/toxic/estate/config/ports.env'
const TAU_SESSION_ROOT =
  process.env.TAU_SESSION_ROOT ?? '/home/toxic/.tau/agent/sessions'
const KAPPA_STATE_DIR =
  process.env.KAPPA_STATE_DIR ?? '/home/toxic/.local/share/kappa'
const KAPPA_ACP_URL = process.env.KAPPA_ACP_URL ?? 'http://127.0.0.1:25159'
const KIMI_CODE_URL = process.env.KIMI_CODE_URL ?? 'http://127.0.0.1:25126'
const TAU_CHUTE_URL = process.env.TAU_CHUTE_URL ?? 'http://127.0.0.1:25111'
/** A session touched inside this window counts as live (not persisted-only). */
const LIVE_WINDOW_MS = 5 * 60 * 1000

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
    const raw = readFileSync(PORTS_ENV, 'utf8')
    const base = name.split('/').pop() ?? name
    const needle = base.replace(/-/g, '').toLowerCase()
    for (const line of raw.split('\n')) {
      // A trailing `# comment` is allowed — ports.env annotates most keys,
      // and a strict `$` anchor silently missed every annotated port.
      const m = line.match(/^([A-Z0-9_]+)=(\d{4,5})\b/)
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

// ─── Running agent chats + chat surface registry ────────────────────────────

type ChatAgent = 'tau' | 'kappa' | 'kimi' | 'squawk'
type ChatStatus = 'live' | 'idle' | 'unavailable'

interface AgentChat {
  id: string
  agent: ChatAgent
  title: string
  status: ChatStatus
  updatedAt: string | null
  createdAt: string | null
  project: string | null
  webUrl: string | null
  source: string
}

interface ChatSurface {
  id: string
  agent: ChatAgent
  name: string
  daemon: string
  state: string
  port: number | null
  url: string | null
  /** null = not probed (unknown); true = answering; false = refusing. */
  live: boolean | null
  auth: 'none' | 'bearer' | 'basic' | 'room-key'
  note: string
}

// ─── Surface registry: SSOT-driven, live daemon state, truthful probes ──────
// The registry is composed from the estate's own SSOTs (config/ports.env,
// pitchfork.d/*.toml, mise.toml) by @ranch/surface-registry. The server NEVER
// hardcodes a port and never guesses which daemon backs an agent: it reads
// the composed manifest, then resolves the LIVE supervisor state for the
// daemon that owns each surface.
const ESTATE_ROOT = process.env.ESTATE_ROOT ?? '/home/toxic/estate'
const MANIFEST_TTL_MS = 15_000

let estateCache: {
  at: number
  manifest: SurfaceManifest
  daemons: PitchforkDaemon[]
} | null = null
let daemonCache: {
  at: number
  daemons: Array<{ name: string; state: string }>
} | null = null

/**
 * The composed surface manifest AND every estate daemon, cached briefly so a
 * burst of requests does not re-read the estate SSOTs on every call.
 */
function estateState(): {
  manifest: SurfaceManifest
  daemons: PitchforkDaemon[]
} {
  const now = Date.now()
  if (estateCache && now - estateCache.at < MANIFEST_TTL_MS) return estateCache
  const sources = readEstateSources(ESTATE_ROOT)
  const manifest = composeManifest({
    sources: sources.sources,
    ports: sources.ports,
    daemons: sources.daemons,
    mise: sources.mise,
    tauRelayUrl: sources.tauRelayUrl,
  })
  estateCache = { at: now, manifest, daemons: sources.daemons }
  return estateCache
}

/** The composed surface manifest. */
function surfaceManifest(): SurfaceManifest {
  return estateState().manifest
}

/** The live supervisor daemon list, cached on the same TTL. */
function liveDaemons(): Array<{ name: string; state: string }> {
  const now = Date.now()
  if (daemonCache && now - daemonCache.at < MANIFEST_TTL_MS) {
    return daemonCache.daemons
  }
  const daemons = parsePitchforkList(runCapture(PITCHFORK, ['list']))
  daemonCache = { at: now, daemons }
  return daemons
}

/**
 * Resolve the live supervisor state for a surface.
 *
 * By daemon id first, then by PORT: the port fallback keeps the view honest
 * across a daemon rename (estate/estate-chat → estate/squawk-chat) — the
 * surface still finds the process that actually owns the port.
 */
function daemonStateFor(
  surface: ManifestSurface,
  daemons: PitchforkDaemon[],
  live: Array<{ name: string; state: string }>
): { name: string; state: string } | null {
  const ids: string[] = []
  if (surface.daemonId) ids.push(surface.daemonId)
  if (surface.port !== null) {
    const owner = daemons.find((d) => daemonPort(d) === surface.port)
    if (owner) ids.push(owner.id)
  }
  for (const id of ids) {
    const hit = live.find(
      (d) =>
        d.name === id || d.name.endsWith(`/${id}`) || id.endsWith(`/${d.name}`)
    )
    if (hit) return hit
  }
  return null
}

/** The local base URL of an agent's surface, when it has one. */
function surfaceUrlFor(agent: ChatAgent): string | null {
  const manifest = surfaceManifest()
  const hit = manifest.surfaces.find(
    (s) => s.agent === agent && s.baseUrl?.startsWith('http://127.0.0.1')
  )
  return hit?.baseUrl ?? null
}

/** HTTP liveness: any answer below 500 means the surface is up. */
async function probeHttp(url: string, timeoutMs = 1200): Promise<boolean> {
  try {
    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), timeoutMs)
    const res = await fetch(url, { signal: ctrl.signal })
    clearTimeout(timer)
    return res.status < 500
  } catch {
    return false
  }
}

/** TCP liveness for surfaces that speak a non-HTTP protocol (ACP over TCP). */
function probeTcp(port: number, timeoutMs = 1200): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = connect({ host: '127.0.0.1', port })
    let settled = false
    const done = (value: boolean) => {
      if (settled) return
      settled = true
      try {
        socket.destroy()
      } catch {
        /* already closed */
      }
      resolve(value)
    }
    socket.setTimeout(timeoutMs, () => done(false))
    socket.once('connect', () => done(true))
    socket.once('error', () => done(false))
  })
}

// tau stores every session as a rollout file under
//   <project-slug>/<timestamp>_<uuid>.jsonl   (main session)
//   <project-slug>/<timestamp>_<uuid>/<name>.jsonl (subagent rollouts)
// The FILE TREE is the source of truth: the tau `threads` table is stale
// (newest row 2026-10-09 while the tree carries same-day sessions).
function tauChats(limit: number): AgentChat[] {
  let projects: string[] = []
  try {
    projects = readdirSync(TAU_SESSION_ROOT)
  } catch {
    return []
  }

  const found: Array<{ file: string; mtime: number }> = []
  for (const project of projects) {
    if (project.startsWith('.')) continue
    const dir = `${TAU_SESSION_ROOT}/${project}`
    let entries: string[] = []
    try {
      entries = readdirSync(dir)
    } catch {
      continue
    }
    for (const entry of entries) {
      // ONLY a top-level rollout file is a chat. A directory here is a
      // session's working directory (bash logs + subagent rollouts), not a
      // chat of its own — counting it produced duplicate, titleless rows.
      if (!entry.endsWith('.jsonl')) continue
      const file = `${dir}/${entry}`
      let mtime = 0
      try {
        const st = statSync(file)
        if (!st.isFile()) continue
        mtime = st.mtimeMs
      } catch {
        continue
      }
      if (mtime > 0) found.push({ file, mtime })
    }
  }
  found.sort((a, b) => b.mtime - a.mtime)

  const now = Date.now()
  const rows: AgentChat[] = []
  for (const { file, mtime } of found.slice(0, limit)) {
    const head = readHead(file)
    const base = file.split('/').pop() ?? file
    const id = head.session?.id ?? base.replace(/\.jsonl$/, '')
    const created = head.session?.timestamp ?? null
    rows.push({
      id: `tau:${id}`,
      agent: 'tau',
      // A session without a title still deserves a human label: the rollout
      // file name carries the timestamp + uuid, which is more useful than "".
      title: head.title?.trim() || id || base.replace(/\.jsonl$/, ''),
      status: now - mtime <= LIVE_WINDOW_MS ? 'live' : 'idle',
      updatedAt: new Date(mtime).toISOString(),
      createdAt: created,
      project: head.session?.cwd ?? projectOf(file),
      // tau's own web UI is the collab-web shell; a per-session control link
      // is minted by `tau collab link <pid>` and is NOT derivable from the
      // rollout file, so the surface root is the honest deep link here.
      webUrl: surfaceUrlFor('tau'),
      source: file,
    })
  }
  return rows
}

function projectOf(file: string): string | null {
  const rel = file.slice(TAU_SESSION_ROOT.length + 1)
  const slug = rel.split('/')[0]
  if (!slug) return null
  // The slug is the cwd with '/' replaced by '-'.
  return slug.replace(/^-/, '/').replace(/-/g, '/')
}

function readHead(file: string): {
  title?: string
  session?: { id: string; timestamp: string; cwd: string }
} {
  // Rollout files can be megabytes; only the head records (title + session)
  // are needed, so read a bounded prefix instead of the whole file.
  let raw = ''
  let fd: number | null = null
  try {
    fd = openSync(file, 'r')
    const buf = Buffer.alloc(8192)
    const n = readSync(fd, buf, 0, 8192, 0)
    raw = buf.subarray(0, n).toString('utf8')
  } catch {
    return {}
  } finally {
    try {
      if (fd !== null) closeSync(fd)
    } catch {
      /* already closed */
    }
  }
  const out: {
    title?: string
    session?: { id: string; timestamp: string; cwd: string }
  } = {}
  for (const line of raw.split('\n').slice(0, 8)) {
    if (!line.trim()) continue
    let rec: Record<string, unknown>
    try {
      rec = JSON.parse(line) as Record<string, unknown>
    } catch {
      continue
    }
    if (rec.type === 'title' && typeof rec.title === 'string') {
      out.title = rec.title
    }
    if (rec.type === 'session' && typeof rec.id === 'string') {
      out.session = {
        id: rec.id,
        timestamp: typeof rec.timestamp === 'string' ? rec.timestamp : '',
        cwd: typeof rec.cwd === 'string' ? rec.cwd : '',
      }
    }
  }
  return out
}

// kappa keeps sessions in SQLite (one DB per profile). Read every kappa DB
// in the state dir so the view covers the main profile AND the local/anon
// profiles that a running seat may be using.
function kappaChats(limit: number): AgentChat[] {
  let dbs: string[] = []
  try {
    dbs = readdirSync(KAPPA_STATE_DIR).filter(
      (f) => f.startsWith('kappa') && f.endsWith('.db')
    )
  } catch {
    return []
  }

  const rows: AgentChat[] = []
  const kappaBase = surfaceUrlFor('kappa') ?? KAPPA_ACP_URL
  for (const name of dbs) {
    let db: Database | null = null
    try {
      db = new Database(`${KAPPA_STATE_DIR}/${name}`, { readonly: true })
      const stmt = db.query(
        `select id, title, directory, project_id, time_created, time_updated
         from session order by time_updated desc limit ?`
      )
      const stmtRows = stmt.all(limit) as Array<{
        id: string
        title: string | null
        directory: string | null
        project_id: string | null
        time_created: number | null
        time_updated: number | null
      }>
      const now = Date.now()
      for (const s of stmtRows) {
        const updated = typeof s.time_updated === 'number' ? s.time_updated : 0
        rows.push({
          id: `kappa:${s.id}`,
          agent: 'kappa',
          title: s.title || s.id,
          status: updated && now - updated <= LIVE_WINDOW_MS ? 'live' : 'idle',
          updatedAt: updated ? new Date(updated).toISOString() : null,
          createdAt:
            typeof s.time_created === 'number'
              ? new Date(s.time_created).toISOString()
              : null,
          project: s.directory ?? null,
          // The Kappa Console SPA is served at /console by the kappa server
          // and routes sessions under their project.
          webUrl: s.project_id
            ? `${kappaBase}/console/projects/${encodeURIComponent(s.project_id)}`
            : `${kappaBase}/console/projects`,
          source: name,
        })
      }
    } catch {
      /* unreadable/locked DB — skip, never fabricate */
    } finally {
      try {
        db?.close()
      } catch {
        /* already closed */
      }
    }
  }
  // The same session can live in more than one profile DB (main + local +
  // anon). Keep the freshest copy of each session id, never the duplicates.
  const byId = new Map<string, AgentChat>()
  for (const row of rows) {
    const seen = byId.get(row.id)
    if (!seen) {
      byId.set(row.id, row)
      continue
    }
    if (
      String(row.updatedAt ?? '').localeCompare(String(seen.updatedAt ?? '')) >
      0
    ) {
      byId.set(row.id, row)
    }
  }
  return [...byId.values()]
}

// kimi runs as a supervised daemon (estate/kimi-code) that serves a web UI
// and a session API behind a bearer token. On this host the daemon is
// currently `available disabled`, so the probe finds nothing and the list is
// empty BY DESIGN — the adapter never fabricates sessions.
async function kimiChats(): Promise<AgentChat[]> {
  const res = await probe(KIMI_CODE_URL)
  if (!res.live) return []
  try {
    const body = (await res.response.json()) as {
      sessions?: Array<{ id?: string; title?: string; updatedAt?: string }>
    }
    const list = Array.isArray(body.sessions) ? body.sessions : []
    return list.map((s) => ({
      id: `kimi:${s.id ?? 'unknown'}`,
      agent: 'kimi',
      title: s.title ?? s.id ?? 'kimi session',
      status: 'idle' as ChatStatus,
      updatedAt: s.updatedAt ?? null,
      createdAt: null,
      project: null,
      webUrl: surfaceUrlFor('kimi') ?? KIMI_CODE_URL,
      source: 'kimi-code',
    }))
  } catch {
    return []
  }
}

async function probe(
  url: string,
  timeoutMs = 1500
): Promise<{
  live: boolean
  status: number | null
  response: Response | null
}> {
  try {
    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), timeoutMs)
    const response = await fetch(url, { signal: ctrl.signal })
    clearTimeout(timer)
    return { live: response.status < 500, status: response.status, response }
  } catch {
    return { live: false, status: null, response: null }
  }
}

// The chat surface registry is COMPOSED from the estate SSOTs by
// @ranch/surface-registry: the rules table names the daemon id and the SSOT
// port key, the manifest fills in the numbers, and the LIVE supervisor state
// plus a real liveness probe finish the row. A daemon whose name merely
// mentions an agent (nim-kimi-sidecar, kimiclaw-a) is NOT a chat surface,
// and no port is ever written by hand here.
const AUTH_MODES: Record<string, ChatSurface['auth']> = {
  none: 'none',
  bearer: 'bearer',
  basic: 'basic',
  'room-key': 'room-key',
}

async function surfaces(): Promise<ChatSurface[]> {
  const { manifest, daemons } = estateState()
  const live = liveDaemons()
  const rows: ChatSurface[] = []

  for (const surface of manifest.surfaces) {
    const daemon = daemonStateFor(surface, daemons, live)
    const url = surface.baseUrl
    const isLocal = url?.startsWith('http://127.0.0.1') ?? false

    // Liveness is a real probe: a daemon can be "running" while its socket
    // refuses, and a reserved port can be "available" with nothing behind it.
    // Remote origins are NOT probed from the box — `live` stays null
    // ("unknown") instead of pretending they are down.
    let liveState: boolean | null = null
    if (isLocal && url) {
      if (surface.healthPath) {
        liveState = await probeHttp(`${url}${surface.healthPath}`)
      } else if (surface.port !== null) {
        liveState = await probeTcp(surface.port)
      }
    }

    rows.push({
      id: surface.id,
      agent: surface.agent,
      name: surface.title,
      daemon: daemon?.name ?? surface.daemonId ?? 'unmanaged',
      state: daemon?.state ?? 'unknown',
      port: surface.port,
      url,
      live: liveState,
      auth: AUTH_MODES[surface.authMode] ?? 'none',
      note: surface.notes,
    })
  }

  return rows.sort(
    (a, b) => a.agent.localeCompare(b.agent) || a.id.localeCompare(b.id)
  )
}

/** The Squawk board channels are chats too — the fleet's shared chat plane. */
function squawkChats(board: Array<Record<string, unknown>>): AgentChat[] {
  const base = surfaceUrlFor('squawk')
  const now = Date.now()
  return board.map((channel) => {
    const name = String(channel.name ?? 'channel')
    const last =
      typeof channel.lastMessageAt === 'string' ? channel.lastMessageAt : null
    const lastMs = last ? Date.parse(last) : Number.NaN
    const live = Number.isFinite(lastMs) && now - lastMs <= LIVE_WINDOW_MS
    const topic = typeof channel.topic === 'string' ? channel.topic.trim() : ''
    return {
      id: `squawk:${name}`,
      agent: 'squawk' as const,
      title: topic ? `${name} — ${topic}` : name,
      status: (live ? 'live' : 'idle') as ChatStatus,
      updatedAt: last,
      createdAt: typeof channel.created === 'string' ? channel.created : null,
      project: null,
      webUrl: base ? `${base}/v1/channels/${encodeURIComponent(name)}` : null,
      source: 'squawk-board',
    }
  })
}

async function chats() {
  const [tau, kappa, kimi, board, surfs] = [
    tauChats(30),
    kappaChats(30),
    await kimiChats(),
    await channels(),
    await surfaces(),
  ]
  const rows = [...tau, ...kappa, ...kimi, ...squawkChats(board)].sort(
    (a, b) => {
      if (a.status !== b.status) return a.status === 'live' ? -1 : 1
      return String(b.updatedAt ?? '').localeCompare(String(a.updatedAt ?? ''))
    }
  )
  return {
    kind: 'ready' as const,
    generatedAt: new Date().toISOString(),
    summary: {
      total: rows.length,
      live: rows.filter((r) => r.status === 'live').length,
      idle: rows.filter((r) => r.status === 'idle').length,
      unavailable: rows.filter((r) => r.status === 'unavailable').length,
    },
    rows,
    surfaces: surfs,
    notes: [
      'Live = the session was written to inside the last 5 minutes.',
      'kimi-code runs as a supervised daemon that is currently disabled on this host, so its chat list is empty by design.',
      'Surfaces are composed from the estate SSOTs (config/ports.env + pitchfork.d); `live` is a real probe and null when the origin is not probed from the box.',
    ],
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
        case '/chats':
          return respond(await chats())
        case '/surfaces':
          return respond(await surfaces())
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
