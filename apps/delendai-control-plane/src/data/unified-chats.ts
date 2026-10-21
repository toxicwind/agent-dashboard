/**
 * unified-chats — aggregator that collates session/Chat data from three
 * estates sources:
 *
 *  1. **Tau** — JSONL session files under ~/.tau/agent/sessions/.
 *     Each file is a single agent session; first JSONL line is parsed
 *     for the session header (role/system, user prompt, etc.).
 *
 *  2. **Kappa** — SQLite `kappa-main.db` table `kappa_board_message`,
 *     mirrored by the squawk bridge into squawk-root, but we also read
 *     the SQLite directly for the "Kappa sessions" view.
 *
 *  3. **Kimi** — Web sessions served by the kimi daemon (ports 4097 /
 *     25159) at /sessions or /session; best-effort via HTTP probe.
 *
 * Every getter degrades gracefully when a source is absent or unreachable.
 */

import type { IChatMessage, IChatChannel } from '@/types'

// ─── Types ──────────────────────────────────────────────────────────────────

export interface UnifiedChatSession {
  readonly id: string
  readonly source: 'tau' | 'kappa' | 'kimi'
  readonly title: string
  readonly lastActivity: string | null
  readonly messageCount: number
  readonly preview: string
}

export interface UnifiedChatsResult {
  readonly sessions: UnifiedChatSession[]
  readonly summary: {
    readonly total: number
    readonly bySource: { tau: number; kappa: number; kimi: number }
  }
}

// ─── Tau sessions ───────────────────────────────────────────────────────────

export const DEFAULT_TAU_SESSIONS_ROOT =
  '/home/toxic/.tau/agent/sessions'

function tauSessionFromPath(
  filename: string,
  firstLine: string | null
): UnifiedChatSession {
  // Filename pattern: <agent>-<seed>-<title>.jsonl or <title>.jsonl
  const name = filename.replace(/\.jsonl$/, '')
  // Extract title from filename: strip leading agent prefix and seed
  const parts = name.split('-')
  let title = name
  // Heuristic: if it looks like "agent-seed-title" (seed = digits), take from third part
  if (parts.length >= 3 && /\d{3,8}/.test(parts[1]) && /^\d+$/.test(parts[1])) {
    title = parts.slice(2).join('-')
  }
  // Humanise: replace hyphens/underscores with spaces
  title = title.replace(/[-_]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())

  const preview = firstLine
    ? firstLine.slice(0, 160)
    : `Session ${name}`
  return {
    id: name,
    source: 'tau',
    title,
    lastActivity: null, // parsed from file mtime or JSONL lines
    messageCount: 1, // at least 1 line = 1 message
    preview,
  }
}

export async function loadTauSessions(
  root: string,
  io: {
    readDir: (d: string) => Promise<string[]>
    readFile: (p: string) => Promise<string>
    stat: (p: string) => Promise<{ mtimeMs: number }>
  }
): Promise<UnifiedChatSession[]> {
  let entries: string[]
  try {
    entries = await io.readDir(root)
  } catch {
    return []
  }

  const sessions: UnifiedChatSession[] = []
  for (const entry of entries) {
    if (!entry.endsWith('.jsonl')) continue
    if (entry.startsWith('.')) continue

    let firstLine: string | null = null
    let mtimeMs = 0
    try {
      const raw = await io.readFile(`${root}/${entry}`)
      firstLine = raw.split('\n', 1)[0] ?? null
      const stats = await io.stat(`${root}/${entry}`)
      mtimeMs = stats.mtimeMs
    } catch {
      continue
    }

    const session = tauSessionFromPath(entry, firstLine)
    session.lastActivity = new Date(mtimeMs).toISOString()
    // Count lines for message count estimate
    try {
      const raw2 = await io.readFile(`${root}/${entry}`)
      session.messageCount = Math.max(
        1,
        raw2.split('\n').filter((l) => l.trim()).length
      )
    } catch {
      // Already counted 1 above
    }
    sessions.push(session)
  }

  // newest first
  sessions.sort(
    (a, b) =>
      (b.lastActivity ?? '').localeCompare(a.lastActivity ?? '')
  )
  return sessions
}

// ─── Kappa board sessions ──────────────────────────────────────────────────

export async function loadKappaSessions(
  channels: readonly IChatChannel[] | null
): Promise<UnifiedChatSession[]> {
  if (!channels || channels.length === 0) return []
  return channels.map((ch) => ({
    id: `kappa:${ch.name}`,
    source: 'kappa',
    title: ch.name.replace(/[-_]/g, ' '),
    lastActivity: ch.lastMessageAt,
    messageCount: ch.messageCount,
    preview:
      ch.messages.length > 0
        ? (ch.messages[ch.messages.length - 1].title ?? '')
        : '',
  }))
}

// ─── Kimi web sessions ─────────────────────────────────────────────────────

export const KIMI_SESSION_PORTS = [4097, 25159]

export async function loadKimiSessions(
  ports: number[] = KIMI_SESSION_PORTS,
  timeoutMs = 1500
): Promise<UnifiedChatSession[]> {
  const sessions: UnifiedChatSession[] = []
  for (const port of ports) {
    try {
      const ctrl = new AbortController()
      const timer = setTimeout(() => ctrl.abort(), timeoutMs)
      const res = await fetch(`http://127.0.0.1:${port}/sessions`, {
        signal: ctrl.signal,
      })
      clearTimeout(timer)
      if (!res.ok) continue

      const body = (await res.json()) as {
        sessions?: Array<{
          id?: string
          title?: string
          lastActivity?: string
          messageCount?: number
        }>
      }
      for (const s of body.sessions ?? []) {
        sessions.push({
          id: `kimi:${s.id ?? port}`,
          source: 'kimi',
          title: s.title ?? `kimi session ${s.id ?? port}`,
          lastActivity: s.lastActivity ?? null,
          messageCount: s.messageCount ?? 0,
          preview: s.title ?? '',
        })
      }
    } catch {
      // Port unreachable — best-effort only
    }
  }
  return sessions
}

// ─── Aggregator ─────────────────────────────────────────────────────────────

export async function loadUnifiedChats(
  options: {
    tauRoot?: string
    kappaChannels?: readonly IChatChannel[] | null
    tauIo?: {
      readDir: (d: string) => Promise<string[]>
      readFile: (p: string) => Promise<string>
      stat: (p: string) => Promise<{ mtimeMs: number }>
    }
    kimiPorts?: number[]
  } = {}
): Promise<UnifiedChatsResult> {
  const tauRoot = options.tauRoot ?? DEFAULT_TAU_SESSIONS_ROOT
  const tauIo =
    options.tauIo ??
    ({
      readDir: (d: string) => import('fs').then((m) => m.readdirSync(d)),
      readFile: (p: string) => import('fs').then((m) => m.readFileSync(p, 'utf8')),
      stat: (p: string) =>
        import('fs').then((m) => m.statSync(p)),
    } as unknown as {
      readDir: (d: string) => Promise<string[]>
      readFile: (p: string) => Promise<string>
      stat: (p: string) => Promise<{ mtimeMs: number }>
    })

  const [tauSessions, kappaSessions, kimiSessions] = await Promise.all([
    loadTauSessions(tauRoot, tauIo),
    loadKappaSessions(options.kappaChannels),
    loadKimiSessions(options.kimiPorts),
  ])

  const all = [...tauSessions, ...kappaSessions, ...kimiSessions]

  return {
    sessions: all,
    summary: {
      total: all.length,
      bySource: {
        tau: tauSessions.length,
        kappa: kappaSessions.length,
        kimi: kimiSessions.length,
      },
    },
  }
}
