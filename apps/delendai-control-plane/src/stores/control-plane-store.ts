import { create } from 'zustand'
import {
  fetchProviders,
  fetchRouterUsage,
  fetchServices,
  fetchChannels,
  pingControlApi,
  DEFAULT_CONTROL_API,
} from '@/api/client'
import { DEFAULT_BRIDGE_ROOT } from '@/data/channels'
import type {
  IChatChannel,
  IProviderStatusReadyModel,
  IRouterUsageRow,
  IServiceRow,
} from '@/types'

interface ControlPlaneState {
  providers: IProviderStatusReadyModel | null
  services: readonly IServiceRow[] | null
  routerUsage: readonly IRouterUsageRow[] | null
  channels: readonly IChatChannel[] | null
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
    const [providers, services, routerUsage, live] = await Promise.all([
      fetchProviders(),
      fetchServices(),
      fetchRouterUsage(),
      pingControlApi(),
    ])
    set({
      providers,
      services,
      routerUsage,
      meta: {
        controlApi: DEFAULT_CONTROL_API,
        bridgeRoot: DEFAULT_BRIDGE_ROOT,
        live,
      },
    })
  },
}))
