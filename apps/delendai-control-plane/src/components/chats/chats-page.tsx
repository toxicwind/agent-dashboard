import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge, Dot } from '@/components/ui/badge'
import { useControlPlane } from '@/hooks/use-control-plane'
import { timeAgo } from '@/lib/utils'
import type { IChatChannel } from '@/types'

/**
 * kappa Chats — the kappa board as squawk chat channels. Channel list is read
 * from ~/.fleet-bus/squawk-root (default bridge root); an absent/empty root is
 * a truthful empty view — never a stub.
 */
export function ChatsPage() {
  const { channels } = useControlPlane()
  const list = channels ?? []

  return (
    <div className="mx-auto max-w-[1000px] space-y-5 p-5">
      <header>
        <h1 className="text-lg font-semibold tracking-tight text-fg-100">
          kappa Chats
        </h1>
        <p className="text-xs text-fg-500">
          squawk channels · bridge root ~/.fleet-bus/squawk-root
        </p>
      </header>

      {list.length === 0 ? (
        <Card>
          <CardBody>
            <p className="text-sm text-fg-500">
              No channels found on the bridge root.
            </p>
          </CardBody>
        </Card>
      ) : (
        <div className="space-y-3">
          {list.map((ch) => (
            <ChannelCard key={ch.name} channel={ch} />
          ))}
        </div>
      )}
    </div>
  )
}

function ChannelCard({ channel }: { channel: IChatChannel }) {
  const recent = channel.messages[channel.messages.length - 1]
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Dot tone="accent" />
          <CardTitle className="numeric">{channel.name}</CardTitle>
          <Badge tone="muted">{channel.messageCount} msgs</Badge>
        </div>
        <div className="text-[11px] text-fg-500">
          last {timeAgo(channel.lastMessageAt)}
        </div>
      </CardHeader>
      <CardBody>
        {channel.topic && (
          <p className="mb-2 text-xs text-fg-400">{channel.topic}</p>
        )}
        {recent ? (
          <div className="rounded-md border border-ink-700/40 bg-ink-850/60 p-3">
            <div className="flex items-center gap-2 text-[11px] text-fg-500">
              <span className="font-medium text-fg-300">{recent.from}</span>
              <span>→ {recent.to}</span>
              <span>· {timeAgo(recent.ts)}</span>
            </div>
            {recent.title && (
              <div className="mt-1 text-[13px] font-medium text-fg-100">
                {recent.title}
              </div>
            )}
            <p className="mt-1 line-clamp-3 text-xs leading-relaxed text-fg-300">
              {recent.body}
            </p>
          </div>
        ) : (
          <p className="text-xs text-fg-500">Empty channel.</p>
        )}
        {channel.members.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {channel.members.map((m) => (
              <span
                key={m}
                className="rounded-[--radius-chip] bg-ink-700/40 px-2 py-0.5 text-[10px] text-fg-400"
              >
                {m}
              </span>
            ))}
          </div>
        )}
      </CardBody>
    </Card>
  )
}
