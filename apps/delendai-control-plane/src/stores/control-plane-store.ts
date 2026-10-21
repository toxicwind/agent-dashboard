import { create } from 'zustand'
import {
  fetchProviders,
  fetchRouterUsage,
  fetchServices,
  fetchChannels,
  fetchChats,
  fetchDashboards,
  fetchSurfaces,
  pingControlApi,
  DEFAULT_CONTROL_API,
} from '@/api/client'
import { DEFAULT_BRIDGE_ROOT } from '@/data/channels'
import type {
  IChatChannel,
  IChatSurface,
  IChatsModel,
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
  /** Running agent chats, server-discovered. `null` = not loaded / unreachable. */
  chats: IChatsModel | null
  /** Chat surface registry, server-composed from the estate SSOTs. */
  surfaces: readonly IChatSurface[] | null
  meta: {
    controlApi: string
    bridgeRoot: string
    live: boolean
  }
  refresh: () => Promise<void>
  refreshChannels: () => Promise<void>
  refreshChats: () => Promise<void>
}

export const useControlPlaneStore = create<ControlPlaneState>((set) => ({
  providers: null,
  services: null,
  routerUsage: null,
  channels: null,
  dashboards: null,
  chats: null,
  surfaces: null,
  meta: {
    controlApi: DEFAULT_CONTROL_API,
    bridgeRoot: DEFAULT_BRIDGE_ROOT,
    live: false,
  },
  refreshChannels: async () => {
    const channels = await fetchChannels()
    set({ channels })
  },
  refreshChats: async () => {
    const [chats, surfaces] = await Promise.all([fetchChats(), fetchSurfaces()])
    set({ chats, surfaces })
  },
  refresh: async () => {
    const [
      providers,
      services,
      routerUsage,
      channels,
      dashboards,
      chats,
      surfaces,
      live,
    ] = await Promise.all([
      fetchProviders(),
      fetchServices(),
      fetchRouterUsage(),
      fetchChannels(),
      fetchDashboards(),
      fetchChats(),
      fetchSurfaces(),
      pingControlApi(),
    ])
    set({
      providers,
      services,
      routerUsage,
      channels,
      dashboards,
      chats,
      surfaces,
      meta: {
        controlApi: DEFAULT_CONTROL_API,
        bridgeRoot: DEFAULT_BRIDGE_ROOT,
        live,
      },
    })
  },
}))
