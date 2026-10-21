import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Meter } from '@/components/ui/meter'
import { useControlPlane } from '@/hooks/use-control-plane'
import { formatUsd } from '@/lib/utils'
import type { IRouterUsageRow } from '@/types'

const recTone = {
  retain: 'ok',
  review: 'warn',
  demote: 'danger',
} as const

/**
 * Router — real use/cost when the estate publishes it; otherwise a truthful
 * "no real usage data" state. Never fabricated rows.
 */
export function RouterPage() {
  const { routerUsage } = useControlPlane()
  const present = routerUsage?.present ?? false
  const rows = (routerUsage?.rows ?? []) as readonly IRouterUsageRow[]
  const totalCost = rows.reduce((a, r) => a + r.cost, 0)

  return (
    <div className="mx-auto max-w-[1100px] space-y-5 p-5">
      <header>
        <h1 className="text-lg font-semibold tracking-tight text-fg-100">
          Router
        </h1>
        <p className="text-xs text-fg-500">
          Use &amp; cost per model — real data only
        </p>
      </header>

      {!present ? (
        <Card>
          <CardBody>
            <p className="text-sm text-fg-400">
              {routerUsage?.note ?? 'No real usage data yet.'} The estate
              publishes no per-model router ledger; shown only when one is
              available.
            </p>
          </CardBody>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Usage by model</CardTitle>
            <div className="numeric text-sm text-fg-400">
              total <span className="text-fg-100">{formatUsd(totalCost)}</span>
            </div>
          </CardHeader>
          <CardBody className="space-y-2 p-0">
            <table className="w-full text-left text-[13px]">
              <thead>
                <tr className="border-b border-ink-600/50 text-[10px] uppercase tracking-[0.12em] text-fg-500">
                  <th className="px-4 py-2 font-medium">Model</th>
                  <th className="px-4 py-2 font-medium">Cost</th>
                  <th className="px-4 py-2 font-medium">Tokens</th>
                  <th className="px-4 py-2 font-medium">Saved</th>
                  <th className="px-4 py-2 font-medium">Share</th>
                  <th className="px-4 py-2 font-medium">Action</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr
                    key={r.key}
                    className="border-b border-ink-700/40 last:border-0 hover:bg-ink-800/30"
                  >
                    <td className="px-4 py-3">
                      <code className="rounded bg-ink-700/30 px-1.5 py-0.5 text-[12px] text-fg-100">
                        {r.key}
                      </code>
                    </td>
                    <td className="numeric px-4 py-3 text-fg-300">
                      {formatUsd(r.cost)}
                    </td>
                    <td className="numeric px-4 py-3 text-fg-400">{r.used}</td>
                    <td className="numeric px-4 py-3 text-ok-400">
                      +{r.saved}
                    </td>
                    <td className="w-40 px-4 py-3">
                      <Meter
                        pct={r.bar}
                        tone={r.pct < 15 ? 'violet' : 'accent'}
                        showPct={false}
                        label={`${r.pct}%`}
                      />
                    </td>
                    <td className="px-4 py-3">
                      <Badge tone={recTone[r.recommendation]}>
                        {r.recommendation}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardBody>
        </Card>
      )}
    </div>
  )
}
