import { useEffect } from 'react'
import { useControlPlaneStore } from '@/stores/control-plane-store'

/**
 * useControlPlane — hydrates the control-plane store on mount and exposes a
 * manual refresh. The store reads REAL estate data from the control-plane API;
 * each getter degrades to a truthful empty/error state when unreachable.
 */
export function useControlPlane() {
  const providers = useControlPlaneStore((s) => s.providers)
  const services = useControlPlaneStore((s) => s.services)
  const routerUsage = useControlPlaneStore((s) => s.routerUsage)
  const channels = useControlPlaneStore((s) => s.channels)
  const dashboards = useControlPlaneStore((s) => s.dashboards)
  const meta = useControlPlaneStore((s) => s.meta)
  const refresh = useControlPlaneStore((s) => s.refresh)
  const refreshChannels = useControlPlaneStore((s) => s.refreshChannels)

  useEffect(() => {
    void refresh()
    void refreshChannels()
  }, [refresh, refreshChannels])

  return {
    providers,
    services,
    routerUsage,
    channels,
    dashboards,
    meta,
    refresh,
    refreshChannels,
  }
}
