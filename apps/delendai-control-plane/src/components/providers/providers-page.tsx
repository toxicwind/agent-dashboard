import { Card, CardBody, CardHeader } from '@/components/ui/card'
import { Badge, Dot } from '@/components/ui/badge'
import { Meter } from '@/components/ui/meter'
import { useControlPlane } from '@/hooks/use-control-plane'
import { stateTone } from '@/data/provider-record'
import { formatWhen } from '@/lib/utils'
import type { IProviderQuotaMeter, IProviderStatusRow } from '@/types'

/**
 * Providers — the DelendAI provider/quota render-model surface. Each row shows
 * reachable state, model, CLI/auth posture, and quota windows whose meters can
 * exceed 100% (quota-exceeded providers turn the meter danger).
 */
export function ProvidersPage() {
  const { providers } = useControlPlane()

  return (
    <div className="mx-auto max-w-[1200px] space-y-5 p-5">
      <header className="flex items-end justify-between">
        <div>
          <h1 className="text-lg font-semibold tracking-tight text-fg-100">
            Providers
          </h1>
          <p className="text-xs text-fg-500">
            Reachable-provider status · quota render-model
          </p>
        </div>
        {providers && (
          <div className="flex gap-2 text-[11px] text-fg-400">
            <span className="flex items-center gap-1">
              <Dot tone="ok" />
              {providers.summary.available} available
            </span>
            <span className="flex items-center gap-1">
              <Dot tone="danger" />
              {providers.summary.unavailable} unavailable
            </span>
            <span className="flex items-center gap-1">
              <Dot tone="muted" />
              {providers.summary.total} total
            </span>
          </div>
        )}
      </header>

      {providers?.emptyRoster ? (
        <Card>
          <CardBody>
            <p className="text-sm text-fg-400">
              No providers configured. Add a roster to{' '}
              <code className="rounded bg-ink-700/40 px-1.5 py-0.5 text-[12px] text-accent-300">
                delendai.config.json
              </code>
              .
            </p>
          </CardBody>
        </Card>
      ) : (
        <div className="space-y-3">
          {(providers?.rows ?? []).map((row) => (
            <ProviderRow key={row.id} row={row} />
          ))}
        </div>
      )}

      {providers?.quota.present && (
        <p className="text-[11px] text-fg-500">
          Quota snapshot updated {formatWhen(providers.quota.updatedAt)}
          {providers.quota.note ? ` · ${providers.quota.note}` : ''}
        </p>
      )}
    </div>
  )
}

function ProviderRow({ row }: { row: IProviderStatusRow }) {
  const tone = stateTone(row.state)
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Dot tone={tone} />
          <span className="numeric text-sm font-semibold text-fg-100">
            {row.id}
          </span>
          <Badge tone={tone}>{row.state}</Badge>
        </div>
        <div className="flex items-center gap-1.5 text-[11px] text-fg-500">
          <span className="text-fg-300">{row.modelId}</span>
          {row.cliInstalled && <span>· cli {row.cliVersion}</span>}
          {row.authenticated && <span>· auth {row.authTier}</span>}
        </div>
      </CardHeader>
      <CardBody className="space-y-3">
        {row.installHint && (
          <div className="rounded-md border border-warn-500/30 bg-warn-500/5 px-3 py-2 text-xs text-warn-300">
            <span className="font-medium">Not installed</span> —{' '}
            <code className="rounded bg-ink-700/40 px-1 py-0.5 text-[11px]">
              {row.installHint.command}
            </code>
            <span className="text-fg-500"> · {row.installHint.caveat}</span>
          </div>
        )}
        {row.quota.length === 0 && !row.installHint ? (
          <p className="text-xs text-fg-500">No quota windows tracked.</p>
        ) : (
          row.quota.map((q) => <QuotaRow key={q.window} q={q} />)
        )}
      </CardBody>
    </Card>
  )
}

function QuotaRow({ q }: { q: IProviderQuotaMeter }) {
  const tone = q.usedPct !== null && q.usedPct > 100 ? 'danger' : 'accent'
  return (
    <div className="flex items-center gap-3">
      <span className="micro-label w-16 shrink-0">{q.window}</span>
      <Meter
        pct={q.usedPct}
        tone={tone}
        className="flex-1"
        label={`${q.usedPct ?? '—'}%`}
      />
      <span className="numeric w-24 shrink-0 text-right text-[11px] text-fg-500">
        {q.used ?? '—'} / {q.limit ?? '∞'}
      </span>
      <span className="w-24 shrink-0 text-right text-[11px] text-fg-500">
        {toBadge(q.resetAt)}
      </span>
    </div>
  )
}

function toBadge(iso: string | null): string {
  if (!iso) return '—'
  return `resets ${formatWhen(iso)}`
}
