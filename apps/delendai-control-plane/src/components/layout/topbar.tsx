import { Search, Radio } from 'lucide-react'
import { cn } from '@/lib/utils'

export function Topbar({
  live,
  controlApi,
}: {
  live: boolean
  controlApi: string
}) {
  return (
    <header className="flex h-14 shrink-0 items-center gap-4 border-b border-ink-600/50 bg-ink-900/50 px-4 backdrop-blur">
      <div className="flex min-w-0 flex-1 items-center gap-2 rounded-md border border-ink-700/60 bg-ink-850/70 px-2.5 py-1.5 text-fg-400">
        <Search className="size-3.5 shrink-0" />
        <span className="truncate text-xs">{controlApi}</span>
      </div>
      <div
        className={cn(
          'flex items-center gap-1.5 rounded-[--radius-chip] px-2.5 py-1 text-[11px] font-medium',
          live ? 'bg-ok-500/10 text-ok-400' : 'bg-ink-700/40 text-fg-500'
        )}
      >
        <Radio className="size-3" strokeWidth={2.5} />
        {live ? 'API live' : 'API unreachable'}
      </div>
    </header>
  )
}
