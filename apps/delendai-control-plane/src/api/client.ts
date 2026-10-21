import type {
  IChatChannel,
  IChatSurface,
  IChatsModel,
  IDashboardLink,
  IDashboardsModel,
  IProviderStatusReadyModel,
  IRouterUsageRow,
  IServiceRow,
} from '@/types'

/**
 * api — typed fetch over the DelendAI control-plane API. There are NO fixture
 * fallbacks: every getter degrades to a truthful empty/error state — never
 * fabricated rows — so the dashboard renders only REAL estate data.
 */

export const DEFAULT_CONTROL_API =
  (import.meta.env.VITE_CONTROL_API as string | undefined) ??
  'http://127.0.0.1:25162'

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

/** Fetch real providers; on an unreachable API return a truthful empty model. */
export async function fetchProviders(
  base = DEFAULT_CONTROL_API,
  timeoutMs = 4000
): Promise<IProviderStatusReadyModel | null> {
  const empty: IProviderStatusReadyModel = {
    kind: 'ready',
    checkedAt: new Date().toISOString(),
    summary: { total: 0, available: 0, unavailable: 0 },
    emptyRoster: true,
    rows: [],
    quota: { present: false, updatedAt: null, note: 'API unreachable' },
  }
  try {
    const model = await getJson<IProviderStatusReadyModel>(
      `${base}/providers`,
      timeoutMs
    )
    return model?.kind === 'ready' ? model : empty
  } catch {
    return empty
  }
}

/** Fetch real services; on failure return a truthful empty list (no fixtures). */
export async function fetchServices(
  base = DEFAULT_CONTROL_API,
  timeoutMs = 4000
): Promise<readonly IServiceRow[]> {
  try {
    const rows = await getJson<readonly IServiceRow[]>(
      `${base}/services`,
      timeoutMs
    )
    return Array.isArray(rows) ? rows : []
  } catch {
    return []
  }
}

/** Fetch real router usage; an empty body is a truthful "no data yet" state. */
export async function fetchRouterUsage(
  base = DEFAULT_CONTROL_API,
  timeoutMs = 4000
): Promise<{
  present: boolean
  rows: readonly IRouterUsageRow[]
  note: string | null
}> {
  const none = { present: false, rows: [], note: 'no real usage data' }
  try {
    const body = await getJson<{
      present: boolean
      rows?: readonly IRouterUsageRow[]
      note?: string | null
    }>(`${base}/router/usage`, timeoutMs)
    if (body && body.present && Array.isArray(body.rows)) {
      return { present: true, rows: body.rows, note: body.note ?? null }
    }
    return { present: false, rows: [], note: body?.note ?? none.note }
  } catch {
    return none
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

/** Fetch real kappa channels; a missing/empty root is a truthful empty list. */
export async function fetchChannels(
  base = DEFAULT_CONTROL_API,
  timeoutMs = 4000
): Promise<readonly IChatChannel[]> {
  try {
    const rows = await getJson<readonly IChatChannel[]>(
      `${base}/channels`,
      timeoutMs
    )
    return Array.isArray(rows) ? rows : []
  } catch {
    return []
  }
}

/** Fetch the real estate dashboard registry; an empty list when unreachable. */
export async function fetchDashboards(
  base = DEFAULT_CONTROL_API,
  timeoutMs = 4000
): Promise<readonly IDashboardLink[] | null> {
  try {
    const model = await getJson<IDashboardsModel>(
      `${base}/dashboards`,
      timeoutMs
    )
    return model?.dashboards ?? []
  } catch {
    return []
  }
}

/**
 * Fetch the running agent chats.
 *
 * The server owns discovery: it reads the Tau rollout tree, the Kappa
 * session databases, the Kimi web daemon and the Squawk board, and it
 * resolves every surface from the estate SSOTs. The browser never guesses a
 * port and never fabricates a row — an unreachable API yields `null`, which
 * the UI renders as "unavailable", never as "empty because nothing exists".
 */
export async function fetchChats(
  base = DEFAULT_CONTROL_API,
  timeoutMs = 8000
): Promise<IChatsModel | null> {
  try {
    const model = await getJson<IChatsModel>(`${base}/chats`, timeoutMs)
    return model?.kind === 'ready' ? model : null
  } catch {
    return null
  }
}

/** Fetch the chat surface registry (ports, daemon state, truthful liveness). */
export async function fetchSurfaces(
  base = DEFAULT_CONTROL_API,
  timeoutMs = 8000
): Promise<readonly IChatSurface[] | null> {
  try {
    const rows = await getJson<readonly IChatSurface[]>(
      `${base}/surfaces`,
      timeoutMs
    )
    return Array.isArray(rows) ? rows : []
  } catch {
    return null
  }
}
