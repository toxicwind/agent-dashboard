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

import type { IChatChannel } from '@/types'

// ─── Types ──────────────────────────────────────────────────────────────────

export interface UnifiedChatSession {
  id: string
  source: 'tau' | 'kappa' | 'kimi'
  title: string
  lastActivity: string | null
  messageCount: number
  preview: string
}

export interface UnifiedChatsResult {
  sessions: UnifiedChatSession[]
  summary: {
    total: number
    bySource: { tau: number; kappa: number; kimi: number }
  }
}

// ─── Tau sessions ───────────────────────────────────────────────────────────

export const DEFAULT_TAU_SESSIONS_ROOT =
  '/home/toxic/.tau/agent/sessions'

function tauSessionFromPath(
  filename: string,
  firstLine: string | null,
  mtimeMs: number,
  lineCount: number
): UnifiedChatSession {
  // Filename pattern: <agent>-<seed>-<title>.jsonl or <title>.jsonl
  const name = filename.replace(/\.jsonl$/, '')
  // Extract title from filename: strip leading agent prefix and seed
  const parts = name.split('-')
  let title = name
  // Heuristic: if it looks like "agent-seed-title" (seed = digits), take from third part
  if (
    parts.length >= 3 &&
    /^\d+$/.test(parts[1]) &&
    parts[1].length >= 3 &&
    parts[1].length <= 8
  ) {
    title = parts.slice(2).join('-')
  }
  // Humanise: replace hyphens/underscores with spaces
  title = title.replace(/[-_]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())

  return {
    id: name,
    source: 'tau',
    title,
    lastActivity: new Date(mtimeMs).toISOString(),
    messageCount: Math.max(1, lineCount),
    preview: firstLine ? firstLine.slice(0, 160) : `Session ${name}`,
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
    let lineCount = 0
    try {
      const raw = await io.readFile(`${root}/${entry}`)
      firstLine = raw.split('\n', 1)[0] ?? null
      mtimeMs = (await io.stat(`${root}/${entry}`)).mtimeMs
      lineCount = raw.split('\n').filter((l) => l.trim()).length
    } catch {
      continue
    }

    sessions.push(tauSessionFromPath(entry, firstLine, mtimeMs, lineCount))
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
  channels: readonly IChatChannel[] | null | undefined
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
        ? ch.messages[ch.messages.length - 1].title ?? ''
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
  const kappaChannels = options.kappaChannels ?? null

  // Browser SPA: tauIo must be injected (Node.js fs is unavailable in the
  // browser). When absent we return an empty tau list rather than crashing.
  if (options.tauIo) {
    const [tauSessions, kappaSessions, kimiSessions] = await Promise.all([
      loadTauSessions(tauRoot, options.tauIo),
      loadKappaSessions(kappaChannels),
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

  // Fallback when tauIo not provided (SPA without injected fs):
  // still load kappa + kimi via HTTP
  const [kappaSessions, kimiSessions] = await Promise.all([
    loadKappaSessions(kappaChannels),
    loadKimiSessions(options.kimiPorts),
  ])
  const all = [...kappaSessions, ...kimiSessions]
  return {
    sessions: all,
    summary: {
      total: all.length,
      bySource: {
        tau: 0,
        kappa: kappaSessions.length,
        kimi: kimiSessions.length,
      },
    },
  }
}
