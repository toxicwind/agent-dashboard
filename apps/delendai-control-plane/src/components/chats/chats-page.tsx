import { useState } from 'react'
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge, Dot } from '@/components/ui/badge'
import { useControlPlane } from '@/hooks/use-control-plane'
import { timeAgo } from '@/lib/utils'
import { loadUnifiedChats } from '@/data/unified-chats'
import type { UnifiedChatSession } from '@/data/unified-chats'

type SourceFilter = 'all' | 'tau' | 'kappa' | 'kimi'

const SOURCES: { key: SourceFilter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'tau', label: 'Tau' },
  { key: 'kappa', label: 'Kappa' },
  { key: 'kimi', label: 'Kimi' },
]

/**
 * Unified Chats — aggregates sessions from Tau (JSONL), Kappa (board), and
 * Kimi (web daemon) into a single view. A source filter tab bar lets the user
 * focus on one estate, or see everything together.
 */
export function ChatsPage() {
  const { channels, refreshChannels } = useControlPlane()
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>('all')

  // Lazy-load unified sessions on mount
  const [sessions, setSessions] = useState<UnifiedChatSession[]>([])
  const [loading, setLoading] = useState(true)

  if (loading) {
    ;(async () => {
      try {
        const result = await loadUnifiedChats({
          kappaChannels: channels,
        })
        setSessions(result.sessions)
      } catch {
        setSessions([])
      }
      setLoading(false)
    })()
  }

  const filtered =
    sourceFilter === 'all'
      ? sessions
      : sessions.filter((s) => s.source === sourceFilter)

  return (
    <div className="mx-auto max-w-[1000px] space-y-5 p-5">
      <header className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-lg font-semibold tracking-tight text-fg-100">
            Chats
          </h1>
          <p className="text-xs text-fg-500">
            {sessions.length} session{sessions.length !== 1 ? 's' : ''} across
            tau · kappa · kimi
          </p>
        </div>

        {/* source filter tabs */}
        <div className="flex gap-1 rounded-lg bg-ink-800/60 p-1">
          {SOURCES.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setSourceFilter(key)}
              className={`rounded-md px-3 py-1 text-[12px] font-medium transition-colors ${
                sourceFilter === key
                  ? 'bg-ink-600/60 text-fg-100'
                  : 'text-fg-500 hover:text-fg-200'
              }`}
            >
              <span className="mr-1.5 inline-block size-1.5 rounded-full" style={{}} />
              {label}
            </button>
          ))}
        </div>
      </header>

      {loading ? (
        <Card>
          <CardBody>
            <p className="text-sm text-fg-500">Loading sessions…</p>
          </CardBody>
        </Card>
      ) : filtered.length === 0 ? (
        <Card>
          <CardBody>
            <p className="text-sm text-fg-500">
              {sourceFilter === 'all'
                ? 'No sessions found across any source.'
                : `No ${sourceFilter} sessions found.`}
            </p>
          </CardBody>
        </Card>
      ) : (
        <div className="space-y-3">
          {filtered.map((s) => (
            <SessionCard key={s.id} session={s} />
          ))}
        </div>
      )}
    </div>
  )
}

function SessionCard({ session }: { session: UnifiedChatSession }) {
  const sourceTone =
    session.source === 'tau'
      ? ('ok' as const)
      : session.source === 'kappa'
        ? ('accent' as const)
        : ('violet' as const)

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Dot tone={sourceTone} />
          <CardTitle className="numeric">{session.title}</CardTitle>
          <Badge tone={sourceTone}>{session.source}</Badge>
          <Badge tone="muted">
            {session.messageCount} msg{session.messageCount !== 1 ? 's' : ''}
          </Badge>
        </div>
        <div className="text-[11px] text-fg-500">
          {timeAgo(session.lastActivity)}
        </div>
      </CardHeader>
      <CardBody>
        {session.preview && (
          <p className="line-clamp-2 text-xs leading-relaxed text-fg-300">
            {session.preview}
          </p>
        )}
      </CardBody>
    </Card>
  )
}
