import { useEffect, useState } from 'react'
import { Globe, Shield, Wifi } from 'lucide-react'

interface TailscaleStatus {
  funnel: string
  node: string
  checkedAt: string
}

export function TailscalePage() {
  const [status, setStatus] = useState<TailscaleStatus | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/tailscale')
      .then((r) => r.json())
      .then((d) => setStatus(d))
      .catch(() => setStatus(null))
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="flex flex-col gap-4 p-6">
      <div className="flex items-center gap-2">
        <Globe className="size-5 text-accent-400" />
        <h1 className="text-lg font-semibold text-fg-100">Tailscale</h1>
      </div>
      {loading && <p className="text-fg-400">Loading…</p>}
      {!loading && !status && (
        <p className="text-fg-400">Tailscale status unavailable.</p>
      )}
      {status && (
        <div className="flex flex-col gap-3">
          <section className="rounded-lg border border-ink-600/50 bg-ink-900/60 p-4">
            <h2 className="mb-2 flex items-center gap-1.5 text-sm font-medium text-fg-200">
              <Shield className="size-4" /> Funnel
            </h2>
            <pre className="whitespace-pre-wrap text-xs text-fg-300">{status.funnel}</pre>
          </section>
          <section className="rounded-lg border border-ink-600/50 bg-ink-900/60 p-4">
            <h2 className="mb-2 flex items-center gap-1.5 text-sm font-medium text-fg-200">
              <Wifi className="size-4" /> Node
            </h2>
            <pre className="whitespace-pre-wrap text-xs text-fg-300">{status.node}</pre>
          </section>
          <p className="text-[11px] text-fg-500">Checked at {status.checkedAt}</p>
        </div>
      )}
    </div>
  )
}
