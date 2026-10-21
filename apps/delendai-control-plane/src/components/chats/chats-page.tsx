import { useState } from 'react'
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge, Dot } from '@/components/ui/badge'
import { useControlPlane } from '@/hooks/use-control-plane'
import { timeAgo } from '@/lib/utils'
import type { ChatAgent, IAgentChat, IChatSurface } from '@/types'

type SourceFilter = 'all' | ChatAgent

const SOURCES: { key: SourceFilter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'tau', label: 'Tau' },
  { key: 'kappa', label: 'Kappa' },
  { key: 'kimi', label: 'Kimi' },
  { key: 'squawk', label: 'Squawk' },
]

const AGENT_TONE: Record<ChatAgent, 'ok' | 'accent' | 'violet' | 'warn'> = {
  tau: 'ok',
  kappa: 'accent',
  kimi: 'violet',
  squawk: 'warn',
}

/**
 * Unified Chats — every running agent chat on the estate, discovered by the
 * control-plane API.
 *
 * The browser asks the server; the server reads the live sources (Tau rollout
 * files, Kappa session databases, the Kimi web daemon, the Squawk board) and
 * composes the surface registry from the estate SSOTs. Nothing here guesses a
 * port, and nothing is fabricated: an unreachable API reads as "unavailable",
 * never as "no chats exist".
 */
export function ChatsPage() {
  const { chats, surfaces, refreshChats } = useControlPlane()
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>('all')

  const rows = chats?.rows ?? []
  const filtered =
    sourceFilter === 'all'
      ? rows
      : rows.filter((row) => row.agent === sourceFilter)
  const counts = SOURCES.reduce<Record<string, number>>((acc, { key }) => {
    acc[key] =
      key === 'all' ? rows.length : rows.filter((r) => r.agent === key).length
    return acc
  }, {})

  return (
    <div className="mx-auto max-w-[1000px] space-y-5 p-5">
      <header className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-lg font-semibold tracking-tight text-fg-100">
            Chats
          </h1>
          <p className="text-xs text-fg-500">
            {chats === null
              ? 'control API unreachable — chats cannot be discovered'
              : `${rows.length} chat${rows.length !== 1 ? 's' : ''} across tau · kappa · kimi · squawk`}
            {chats ? ` · ${chats.summary.live} live` : ''}
          </p>
        </div>

        <div className="flex items-center gap-3">
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
                <span className="mr-1.5 inline-block size-1.5 rounded-full bg-fg-500" />
                {label}
                <span className="ml-1.5 text-[10px] text-fg-500">
                  {counts[key] ?? 0}
                </span>
              </button>
            ))}
          </div>

          <button
            onClick={() => void refreshChats()}
            className="rounded-md bg-ink-700/60 px-3 py-1 text-[12px] font-medium text-fg-200 transition-colors hover:bg-ink-600/60"
          >
            Refresh
          </button>
        </div>
      </header>

      {chats === null ? (
        <Card>
          <CardBody>
            <p className="text-sm text-fg-500">
              The control-plane API did not answer. Nothing is shown because
              nothing could be verified — not because the estate is empty.
            </p>
          </CardBody>
        </Card>
      ) : filtered.length === 0 ? (
        <Card>
          <CardBody>
            <p className="text-sm text-fg-500">
              {sourceFilter === 'all'
                ? 'No chats found across any source.'
                : `No ${sourceFilter} chats found.`}
            </p>
          </CardBody>
        </Card>
      ) : (
        <div className="space-y-3">
          {filtered.map((row) => (
            <SessionCard key={row.id} session={row} />
          ))}
        </div>
      )}

      <SurfacesPanel surfaces={surfaces ?? []} />
    </div>
  )
}

function SessionCard({ session }: { session: IAgentChat }) {
  const tone = AGENT_TONE[session.agent]
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Dot tone={tone} />
          <CardTitle className="numeric">{session.title}</CardTitle>
          <Badge tone={tone}>{session.agent}</Badge>
          <Badge tone={session.status === 'live' ? 'ok' : 'muted'}>
            {session.status}
          </Badge>
        </div>
        <div className="text-[11px] text-fg-500">
          {session.updatedAt ? timeAgo(session.updatedAt) : 'no activity'}
          {session.project ? ` · ${session.project}` : ''}
        </div>
      </CardHeader>
      <CardBody>
        <div className="flex items-center justify-between gap-3">
          <span className="truncate text-[11px] text-fg-500">
            {session.source}
          </span>
          {session.webUrl && (
            <a
              href={session.webUrl}
              target="_blank"
              rel="noreferrer"
              className="shrink-0 text-[11px] text-accent-300 hover:underline"
            >
              open surface ↗
            </a>
          )}
        </div>
      </CardBody>
    </Card>
  )
}

/**
 * The surface registry: which daemon backs each agent's chat, the port it
 * owns, and whether it actually answers. `live: null` means "not probed from
 * this box" — it is never rendered as down.
 */
function SurfacesPanel({ surfaces }: { surfaces: readonly IChatSurface[] }) {
  if (surfaces.length === 0) return null
  return (
    <section className="space-y-3">
      <header className="flex items-baseline justify-between">
        <h2 className="text-sm font-semibold tracking-tight text-fg-200">
          Surfaces
        </h2>
        <span className="text-[11px] text-fg-500">
          {surfaces.length} composed from the estate SSOTs
        </span>
      </header>
      <div className="grid gap-3 sm:grid-cols-2">
        {surfaces.map((surface) => {
          const live = surface.live
          return (
            <Card key={surface.id}>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Dot
                    tone={
                      live === true ? 'ok' : live === false ? 'danger' : 'muted'
                    }
                  />
                  <CardTitle className="numeric">{surface.name}</CardTitle>
                  <Badge tone={AGENT_TONE[surface.agent]}>
                    {surface.agent}
                  </Badge>
                  {surface.auth !== 'none' && (
                    <Badge tone="muted">{surface.auth}</Badge>
                  )}
                </div>
                <div className="text-[11px] text-fg-500">
                  {surface.port ? `:${surface.port}` : 'no port'} ·{' '}
                  {surface.state}
                  {surface.daemon ? ` · ${surface.daemon}` : ''}
                </div>
              </CardHeader>
              <CardBody>
                <p className="line-clamp-2 text-[11px] leading-relaxed text-fg-400">
                  {surface.live === null
                    ? `${surface.note} (liveness not probed from this box)`
                    : surface.note}
                </p>
                {surface.url && (
                  <a
                    href={surface.url}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-2 inline-block text-[11px] text-accent-300 hover:underline"
                  >
                    {surface.url} ↗
                  </a>
                )}
              </CardBody>
            </Card>
          )
        })}
      </div>
    </section>
  )
}
