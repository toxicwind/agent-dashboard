import { create } from 'zustand'
import {
  fetchProviders,
  fetchRouterUsage,
  fetchServices,
  fetchChannels,
  fetchDashboards,
  pingControlApi,
  DEFAULT_CONTROL_API,
} from '@/api/client'
import { DEFAULT_BRIDGE_ROOT } from '@/data/channels'
import type {
  IChatChannel,
  IDashboardLink,
  IProviderStatusReadyModel,
  IRouterUsageRow,
  IServiceRow,
} from '@/types'

interface RouterUsageState {
  present: boolean
  rows: readonly IRouterUsageRow[]
  note: string | null
}

interface ControlPlaneState {
  providers: IProviderStatusReadyModel | null
  services: readonly IServiceRow[] | null
  routerUsage: RouterUsageState | null
  channels: readonly IChatChannel[] | null
  dashboards: readonly IDashboardLink[] | null
  meta: {
    controlApi: string
    bridgeRoot: string
    live: boolean
  }
  refresh: () => Promise<void>
  refreshChannels: () => Promise<void>
}

export const useControlPlaneStore = create<ControlPlaneState>((set) => ({
  providers: null,
  services: null,
  routerUsage: null,
  channels: null,
  dashboards: null,
  meta: {
    controlApi: DEFAULT_CONTROL_API,
    bridgeRoot: DEFAULT_BRIDGE_ROOT,
    live: false,
  },
  refreshChannels: async () => {
    const channels = await fetchChannels()
    set({ channels })
  },
  refresh: async () => {
    const [providers, services, routerUsage, channels, dashboards, live] =
      await Promise.all([
        fetchProviders(),
        fetchServices(),
        fetchRouterUsage(),
        fetchChannels(),
        fetchDashboards(),
        pingControlApi(),
      ])
    set({
      providers,
      services,
      routerUsage,
      channels,
      dashboards,
      meta: {
        controlApi: DEFAULT_CONTROL_API,
        bridgeRoot: DEFAULT_BRIDGE_ROOT,
        live,
      },
    })
  },
}))
