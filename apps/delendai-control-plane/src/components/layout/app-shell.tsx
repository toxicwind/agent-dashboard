import { Route, Routes } from 'react-router-dom'
import { Sidebar } from '@/components/layout/sidebar'
import { Topbar } from '@/components/layout/topbar'
import { useControlPlane } from '@/hooks/use-control-plane'
import { DashboardPage } from '@/components/dashboard/dashboard-page'
import { ProvidersPage } from '@/components/providers/providers-page'
import { RouterPage } from '@/components/router/router-page'
import { TailscalePage } from '@/components/tailscale/tailscale-page'
import { ChatsPage } from '@/components/chats/chats-page'
import { DashboardsPage } from '@/components/dashboards/dashboards-page'

export function App() {
  const { meta } = useControlPlane()

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-ink-950 text-fg-100">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar live={meta.live} controlApi={meta.controlApi} />
        <main className="min-h-0 flex-1 overflow-y-auto">
          <Routes>
            <Route path="/" element={<DashboardPage />} />
            <Route path="/providers" element={<ProvidersPage />} />
            <Route path="/router" element={<RouterPage />} />
            <Route path="/chats" element={<ChatsPage />} />
            <Route path="/dashboards" element={<DashboardsPage />} />
            <Route path="/tailscale" element={<TailscalePage />} />
          </Routes>
        </main>
      </div>
    </div>
  )
}
