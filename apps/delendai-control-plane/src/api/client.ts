import {
  PROVIDER_STATUS_FIXTURES,
  ROUTER_USAGE_FIXTURES,
} from '@/data/provider-record'
import { SERVICES_FIXTURES } from '@/data/services'
import { channelStub } from '@/data/channels'
import type {
  IChatChannel,
  IProviderStatusReadyModel,
  IRouterUsageRow,
  IServiceRow,
} from '@/types'

/**
 * api — typed fetch over the DelendAI control-plane API. Degrades gracefully:
 * when the API is unreachable (no VITE_CONTROL_API server yet), the caller
 * falls back to its local fixture model so the dashboard always renders.
 */

export const DEFAULT_CONTROL_API =
  (import.meta.env.VITE_CONTROL_API as string | undefined) ??
  'http://127.0.0.1:25100/v1'

const JSON_HEADERS = { 'Content-Type': 'application/json' }

async function getJson<T>(url: string, timeoutMs = 4000): Promise<T> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const res = await fetch(url, {
      headers: JSON_HEADERS,
      signal: controller.signal,
    })
    if (!res.ok) {
      throw new Error(`GET ${url} -> ${res.status}`)
    }
    return (await res.json()) as T
  } finally {
    clearTimeout(timer)
  }
}

/** Fetch providers; on failure return the frozen showcase fixture. */
export async function fetchProviders(
  base = DEFAULT_CONTROL_API,
  timeoutMs = 4000
): Promise<IProviderStatusReadyModel> {
  try {
    return await getJson<IProviderStatusReadyModel>(
      `${base}/providers`,
      timeoutMs
    )
  } catch {
    return PROVIDER_STATUS_FIXTURES
  }
}

/** Fetch services; on failure return the live-spot fixture grid. */
export async function fetchServices(
  base = DEFAULT_CONTROL_API,
  timeoutMs = 4000
): Promise<readonly IServiceRow[]> {
  try {
    const rows = await getJson<readonly IServiceRow[]>(
      `${base}/services`,
      timeoutMs
    )
    return Array.isArray(rows) && rows.length > 0 ? rows : SERVICES_FIXTURES
  } catch {
    return SERVICES_FIXTURES
  }
}

/** Fetch router usage/cost; on failure return the showcase rows. */
export async function fetchRouterUsage(
  base = DEFAULT_CONTROL_API,
  timeoutMs = 4000
): Promise<readonly IRouterUsageRow[]> {
  try {
    return await getJson<readonly IRouterUsageRow[]>(
      `${base}/router/usage`,
      timeoutMs
    )
  } catch {
    return ROUTER_USAGE_FIXTURES as readonly IRouterUsageRow[]
  }
}

/** Health probe: true when the control API answers. */
export async function pingControlApi(
  base = DEFAULT_CONTROL_API,
  timeoutMs = 1500
): Promise<boolean> {
  try {
    const res = await fetch(`${base}/health`, {
      signal: AbortSignal.timeout(timeoutMs),
    })
    return res.ok
  } catch {
    return false
  }
}

/** Fetch kappa chat channels; on absence of the API, fall back to a stub. */
export async function fetchChannels(
  base = DEFAULT_CONTROL_API,
  timeoutMs = 4000
): Promise<readonly IChatChannel[]> {
  try {
    const rows = await getJson<readonly IChatChannel[]>(
      `${base}/channels`,
      timeoutMs
    )
    return Array.isArray(rows) && rows.length > 0 ? rows : channelStub()
  } catch {
    return channelStub()
  }
}
