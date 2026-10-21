import type { IChatChannel, IChatMessage } from '@/types'

/**
 * channels — kappa-board channel model over `~/.fleet-bus/squawk-root`
 * (the default bridge root). Each channel is a directory under the root whose
 * `<seq>-<sender>-msg.md` files carry YAML frontmatter (`seq/from/to/channel/
 * ts/status/title`) plus a body, followed by the squawk `.channels-index`
 * convention. Reading is defensive: a missing root, an unreadable channel, or
 * a malformed file degrades to a clean empty view — never a crash.
 */

export const DEFAULT_BRIDGE_ROOT = '/home/toxic/.fleet-bus/squawk-root'

const HEADER_RE = /^---\n([\s\S]*?)\n---\n?([\s\S]*)$/

function parseNumber(value: string | undefined, fallback: number): number {
  if (value === undefined || value.trim() === '') return fallback
  const n = Number(value.trim())
  return Number.isFinite(n) ? n : fallback
}

function parseField(header: string, key: string): string | null {
  // scan line-by-line: hard anchor at a line start so `$` is line-scoped.
  const rx = new RegExp(`(?:^|\\n)${key}:\\s*(.*?)(?:\\n|$)`, 'i')
  const m = header.match(rx)
  if (!m) return null
  const v = m[1].trim()
  if (v === '' || v === 'null') return null
  // strip surrounding quotes
  return v.replace(/^["']|["']$/g, '')
}

/** Parse a single channel message .md file into an IChatMessage. */
export function parseMessageFile(
  raw: string,
  channel: string,
  fallbackSeq: number
): IChatMessage {
  const headerMatch = raw.match(HEADER_RE)
  if (!headerMatch) {
    return {
      seq: fallbackSeq,
      from: 'unknown',
      to: 'all',
      channel,
      ts: null,
      status: null,
      title: null,
      body: raw.trim(),
    }
  }
  const header = headerMatch[1]
  const body = (headerMatch[2] ?? '').trim()
  const field = (key: string) => parseField(header, key)

  return {
    seq: parseNumber(field('seq') ?? undefined, fallbackSeq),
    from: field('from') ?? 'unknown',
    to: field('to') ?? 'all',
    channel: field('channel') ?? channel,
    ts: field('ts'),
    status: field('status'),
    title: field('title'),
    body,
  }
}

/**
 * Build the channel list from a bridge root directory. `readDir`/`readFile`
 * are injected so tests run without touching the real filesystem.
 */
export async function loadChannels(
  root: string,
  io: {
    readDir: (dir: string) => Promise<string[]>
    stat: (path: string) => Promise<{ isDirectory(): boolean }>
    readFile: (path: string) => Promise<string>
  }
): Promise<readonly IChatChannel[]> {
  let entries: string[]
  try {
    entries = await io.readDir(root)
  } catch {
    return []
  }

  const channels: IChatChannel[] = []
  for (const entry of entries) {
    if (entry.startsWith('.')) continue
    const full = `${root}/${entry}`
    let isDir = false
    try {
      isDir = (await io.stat(full)).isDirectory()
    } catch {
      continue
    }
    if (!isDir) continue

    channels.push(await loadChannel(entry, full, io))
  }

  // deterministic: newest-last activity first
  return [...channels].sort((a, b) =>
    (b.lastMessageAt ?? '').localeCompare(a.lastMessageAt ?? '')
  )
}

async function loadChannel(
  name: string,
  dir: string,
  io: {
    readDir: (d: string) => Promise<string[]>
    readFile: (p: string) => Promise<string>
  }
): Promise<IChatChannel> {
  let files: string[]
  try {
    files = await io.readDir(dir)
  } catch {
    files = []
  }

  const messages: IChatMessage[] = []
  const msgFiles = files.filter((f) => f.endsWith('-msg.md'))

  for (const f of msgFiles) {
    const seq = parseNumber(f.split('-')[0], messages.length + 1)
    let raw = ''
    try {
      raw = await io.readFile(`${dir}/${f}`)
    } catch {
      continue
    }
    messages.push(parseMessageFile(raw, name, seq))
  }

  messages.sort((a, b) => a.seq - b.seq)

  const last = messages.length > 0 ? messages[messages.length - 1] : null

  return {
    name,
    members: uniqueMembers(messages),
    topic: '',
    created: null,
    messageCount: messages.length,
    lastMessageAt: last?.ts ?? null,
    messages,
  }
}

function uniqueMembers(messages: readonly IChatMessage[]): readonly string[] {
  const seen = new Set<string>()
  for (const m of messages) seen.add(m.from)
  return [...seen]
}

/** Read the squawk `.channels-index` for topic/created metadata (best-effort). */
export function parseChannelsIndex(raw: string): Map<string, string> {
  const map = new Map<string, string>()
  for (const line of raw.split('\n')) {
    const m = line.match(/^([\dT:\-+]+)\t(.+)$/)
    if (m) map.set(m[2].trim(), m[1].trim())
  }
  return map
}

/** Defensive channel fixtures used when the bridge root is absent. */
export function channelStub(): readonly IChatChannel[] {
  const now = new Date().toISOString()
  return [
    {
      name: 'kappa_board',
      members: ['springboard', 'kappa'],
      topic: 'kappa board as a squawk chat channel',
      created: now,
      messageCount: 1,
      lastMessageAt: now,
      messages: [
        {
          seq: 1,
          from: 'springboard',
          to: 'all',
          channel: 'kappa_board',
          ts: now,
          status: 'discussion',
          title: 'bridge online',
          body: 'kappa board bridge reached (host-side stub: ~/.fleet-bus/squawk-root not mounted in this runtime).',
        },
      ],
    },
  ]
}
