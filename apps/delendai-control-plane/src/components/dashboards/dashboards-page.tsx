import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/card'
import { Dot } from '@/components/ui/badge'
import { useControlPlane } from '@/hooks/use-control-plane'
import type { IDashboardLink } from '@/types'

/**
 * Dashboards — the real estate dashboard registry, sourced live from the
 * control-plane API (docs/CONTROL_PLANE.md). Each row links a real UI with a
 * truthful reachability probe; nothing here is a fixture.
 */
export function DashboardsPage() {
  const { dashboards } = useControlPlane()
  const list = dashboards ?? []

  return (
    <div className="mx-auto max-w-[1000px] space-y-5 p-5">
      <header>
        <h1 className="text-lg font-semibold tracking-tight text-fg-100">
          Dashboards
        </h1>
        <p className="text-xs text-fg-500">
          Real estate control-plane UIs · {list.filter((d) => d.live).length}/
          {list.length} reachable
        </p>
      </header>

      {list.length === 0 ? (
        <Card>
          <CardBody>
            <p className="text-sm text-fg-500">
              No dashboard registry yet from the control-plane API.
            </p>
          </CardBody>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {list.map((d) => (
            <DashboardCard key={d.id} link={d} />
          ))}
        </div>
      )}
    </div>
  )
}

function DashboardCard({ link }: { link: IDashboardLink }) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Dot tone={link.live ? 'ok' : 'muted'} />
          <CardTitle className="text-sm font-semibold text-fg-100">
            {link.name}
          </CardTitle>
          <span className="text-[10px] uppercase tracking-wide text-fg-500">
            {link.live ? 'live' : 'unreachable'}
          </span>
        </div>
        <div className="text-[11px] text-fg-500">{link.note}</div>
      </CardHeader>
      <CardBody>
        <a
          href={link.url}
          target="_blank"
          rel="noreferrer"
          className="inline-flex max-w-full items-center gap-1 truncate rounded-md border border-accent-500/30 bg-accent-500/5 px-2.5 py-1.5 font-mono text-[12px] text-accent-300 hover:bg-accent-500/10"
        >
          <span className="truncate">{link.url}</span>
          <span aria-hidden>↗</span>
        </a>
      </CardBody>
    </Card>
  )
}
