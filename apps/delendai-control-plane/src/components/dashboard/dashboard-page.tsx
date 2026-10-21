import { Server, Boxes, Gauge, MessagesSquare, Activity } from 'lucide-react'
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/card'
import { Kpi } from '@/components/ui/kpi'
import { Badge, Dot } from '@/components/ui/badge'
import { Meter } from '@/components/ui/meter'
import { useControlPlane } from '@/hooks/use-control-plane'
import { countByStatus, serviceTone } from '@/data/services'
import { formatWhen } from '@/lib/utils'
import type { IProviderStatusReadyModel } from '@/types'

export function DashboardPage() {
  const { providers, services, channels, routerUsage } = useControlPlane()

  const svc = services ?? []
  const svcCounts = countByStatus(svc)
  const prov = providers
  const available = prov?.summary.available ?? 0
  const total = prov?.summary.total ?? 0
  const anyOver = (prov?.rows ?? []).some((r) =>
    r.quota.some((q) => (q.usedPct ?? 0) > 100)
  )
  const totalSpend = (routerUsage?.rows ?? []).reduce((a, r) => a + r.cost, 0)
  const firstChat = channels?.[0]

  return (
    <div className="mx-auto max-w-[1400px] space-y-5 p-5">
      {/* KPI band */}
      <section className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <Kpi
          label="Daemons up"
          value={
            <>
              {svcCounts.up}
              <span className="text-sm text-fg-500">/{svc.length}</span>
            </>
          }
          sub={
            svcCounts.degraded > 0 || svcCounts.down > 0
              ? `${svcCounts.degraded} degraded · ${svcCounts.down} down`
              : 'all systems nominal'
          }
          tone={
            svcCounts.down > 0
              ? 'danger'
              : svcCounts.degraded > 0
                ? 'warn'
                : 'ok'
          }
          icon={<Server className="size-4" />}
        />
        <Kpi
          label="Providers reachable"
          value={
            <>
              {available}
              <span className="text-sm text-fg-500">/{total}</span>
            </>
          }
          sub={anyOver ? 'quota exceeded detected' : 'all within budget'}
          tone={anyOver ? 'warn' : 'accent'}
          icon={<Boxes className="size-4" />}
        />
        <Kpi
          label="Quota pressure"
          value={<>{peakQuota(prov)}</>}
          sub={
            prov?.quota.present
              ? `updated ${formatWhen(prov.quota.updatedAt)}`
              : 'no quota data'
          }
          tone={anyOver ? 'danger' : 'violet'}
          icon={<Gauge className="size-4" />}
        />
        <Kpi
          label="Router spend"
          value={<>${totalSpend.toFixed(2)}</>}
          sub={
            routerUsage?.present
              ? `${routerUsage.rows.length} usage rows`
              : 'no real usage data'
          }
          tone="accent"
          icon={<Activity className="size-4" />}
        />
      </section>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
        {/* Services grid */}
        <Card className="xl:col-span-2">
          <CardHeader>
            <CardTitle>Services</CardTitle>
            <div className="flex gap-2 text-[11px] text-fg-400">
              <span className="flex items-center gap-1">
                <Dot tone="ok" />
                {svcCounts.up} up
              </span>
              <span className="flex items-center gap-1">
                <Dot tone="warn" />
                {svcCounts.degraded}
              </span>
              <span className="flex items-center gap-1">
                <Dot tone="danger" />
                {svcCounts.down}
              </span>
            </div>
          </CardHeader>
          <CardBody className="p-0">
            <table className="w-full text-left text-[13px]">
              <thead>
                <tr className="border-b border-ink-600/50 text-[10px] uppercase tracking-[0.12em] text-fg-500">
                  <th className="px-4 py-2 font-medium">Service</th>
                  <th className="px-4 py-2 font-medium">Port</th>
                  <th className="px-4 py-2 font-medium">Status</th>
                  <th className="hidden px-4 py-2 font-medium md:table-cell">
                    Kind
                  </th>
                  <th className="hidden px-4 py-2 font-medium md:table-cell">
                    Health
                  </th>
                </tr>
              </thead>
              <tbody>
                {svc.map((s) => (
                  <tr
                    key={s.name}
                    className="border-b border-ink-700/40 last:border-0 hover:bg-ink-800/30"
                  >
                    <td className="px-4 py-2.5">
                      <div className="font-medium text-fg-100">{s.name}</div>
                      <div className="text-[11px] text-fg-500">
                        {s.description}
                      </div>
                    </td>
                    <td className="numeric px-4 py-2.5 text-fg-300">
                      {s.port || '—'}
                    </td>
                    <td className="px-4 py-2.5">
                      <Badge tone={serviceTone(s.status)}>{s.status}</Badge>
                    </td>
                    <td className="hidden px-4 py-2.5 text-fg-400 md:table-cell">
                      {s.kind}
                    </td>
                    <td className="hidden w-32 px-4 py-2.5 md:table-cell">
                      <Meter
                        pct={s.health}
                        tone={
                          s.status === 'up'
                            ? 'ok'
                            : s.status === 'degraded'
                              ? 'warn'
                              : 'danger'
                        }
                        showPct={false}
                        label={`${s.health}%`}
                        live={false}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardBody>
        </Card>

        {/* Recent kappa chat */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MessagesSquare className="size-4 text-accent-300" /> Recent kappa
              chat
            </CardTitle>
            <Badge tone="accent">{firstChat?.name ?? 'none'}</Badge>
          </CardHeader>
          <CardBody className="space-y-3">
            {firstChat && firstChat.messages.length > 0 ? (
              firstChat.messages
                .slice(-3)
                .reverse()
                .map((m) => (
                  <div
                    key={m.seq}
                    className="rounded-lg border border-ink-700/40 bg-ink-850/60 p-3"
                  >
                    <div className="flex items-center gap-2 text-[11px] text-fg-500">
                      <span className="font-medium text-fg-300">{m.from}</span>
                      <span>·</span>
                      <span>{formatWhen(m.ts)}</span>
                    </div>
                    {m.title && (
                      <div className="mt-1 text-[13px] font-medium text-fg-100">
                        {m.title}
                      </div>
                    )}
                    <p className="mt-1 line-clamp-3 text-xs leading-relaxed text-fg-300">
                      {m.body}
                    </p>
                  </div>
                ))
            ) : (
              <p className="text-xs text-fg-500">
                No messages yet on the bridge root.
              </p>
            )}
            <div className="flex items-center justify-between pt-1 text-[11px] text-fg-500">
              <span>{firstChat?.messageCount ?? 0} messages</span>
              <span className="uppercase tracking-wide">
                {firstChat?.topic || 'no topic'}
              </span>
            </div>
          </CardBody>
        </Card>
      </div>
    </div>
  )
}

function peakQuota(model: IProviderStatusReadyModel | null): string {
  if (!model) return '—'
  const peak = Math.max(
    0,
    ...model.rows.flatMap((r) => r.quota.map((q) => q.usedPct ?? 0))
  )
  return peak === 0 ? '0%' : `${Math.round(peak)}%`
}
