import type {
  IProviderQuotaMeter,
  IProviderStatusReadyModel,
  IProviderStatusRow,
  ProviderState,
} from '@/types'

/**
 * provider-record — pure model helpers over the DelendAI provider/quota
 * render-model. These are the testable core of the Providers screen: the
 * full provider-status vocabulary is imported as `PROVIDER_STATUS_FIXTURES`.
 */

/** Whole-percent meter: `used / limit * 100`, can exceed 100; null when unknown. */
export function usedPct(
  used: number | null,
  limit: number | null
): number | null {
  if (used === null || limit === null || limit <= 0) return null
  return Math.round((used / limit) * 100)
}

/**
 * Aggregate a provider's meters into one overload figure: max meter > 100 is
 * the "over-quota" driver; else highest usedPct under 100.
 */
export function meterOverload(pct: number | null): boolean {
  return pct !== null && pct > 100
}

/** Human-readable provider state tone for the dashboard signal axis. */
export function stateTone(
  state: ProviderState
): 'ok' | 'warn' | 'danger' | 'muted' {
  switch (state) {
    case 'available':
      return 'ok'
    case 'rate-limited':
      return 'warn'
    case 'quota-exceeded':
    case 'error':
      return 'danger'
    case 'unauthenticated':
    case 'not-installed':
    case 'model-unavailable':
      return 'muted'
    default:
      return 'muted'
  }
}

/** Pick the dominant meter for a row (highest over-100; else highest <100; else null). */
export function dominantMeter(
  row: IProviderStatusRow
): IProviderQuotaMeter | null {
  if (row.quota.length === 0) return null
  const over = row.quota.filter((q) => q.usedPct !== null && q.usedPct > 100)
  if (over.length > 0) {
    return over.reduce((a, b) => ((a.usedPct ?? 0) >= (b.usedPct ?? 0) ? a : b))
  }
  const within = row.quota.filter((q) => q.usedPct !== null)
  if (within.length === 0) return null
  return within.reduce((a, b) => ((a.usedPct ?? 0) >= (b.usedPct ?? 0) ? a : b))
}

/** Summary derived from rows when the API shape omits it. */
export function deriveSummary(rows: readonly IProviderStatusRow[]): {
  total: number
  available: number
  unavailable: number
} {
  const total = rows.length
  const available = rows.filter((r) => r.reachable).length
  return { total, available, unavailable: total - available }
}

/** True when any provider is over quota (drives the Dashboard KPI flag). */
export function anyOverQuota(model: IProviderStatusReadyModel): boolean {
  return model.rows.some((r) => r.quota.some((q) => meterOverload(q.usedPct)))
}

export const PROVIDER_STATES: readonly ProviderState[] = [
  'available',
  'quota-exceeded',
  'rate-limited',
  'unauthenticated',
  'not-installed',
  'model-unavailable',
  'error',
]

/** Frozen showcase mirroring DelendAI's provider-dashboard fixtures (f00098 S1). */
export const PROVIDER_STATUS_FIXTURES: IProviderStatusReadyModel = {
  kind: 'ready',
  checkedAt: '2026-10-20T22:40:00.000Z',
  summary: { total: 4, available: 2, unavailable: 2 },
  emptyRoster: false,
  rows: [
    {
      id: 'freeinference-deepseek',
      state: 'available',
      reachable: true,
      modelId: 'deepseek-v4-flash',
      modelAvailable: true,
      cliInstalled: true,
      cliVersion: '0.9.1',
      authenticated: true,
      authTier: 'free',
      installHint: null,
      quota: [
        {
          window: 'hourly',
          limit: 200,
          used: 84,
          resetAt: '2026-10-20T23:00:00.000Z',
          usedPct: 42,
        },
        {
          window: 'monthly',
          limit: 20000,
          used: 14200,
          resetAt: '2026-11-01T00:00:00.000Z',
          usedPct: 71,
        },
      ],
    },
    {
      id: 'gpt-5-codex',
      state: 'quota-exceeded',
      reachable: false,
      modelId: 'gpt-5-codex',
      modelAvailable: true,
      cliInstalled: true,
      cliVersion: '0.44.0',
      authenticated: true,
      authTier: 'plus',
      installHint: null,
      quota: [
        {
          window: 'hourly',
          limit: 50,
          used: 63,
          resetAt: '2026-10-20T23:00:00.000Z',
          usedPct: 126,
        },
        {
          window: 'monthly',
          limit: 20000,
          used: 9200,
          resetAt: '2026-11-01T00:00:00.000Z',
          usedPct: 46,
        },
      ],
    },
    {
      id: 'claude-sonnet',
      state: 'available',
      reachable: true,
      modelId: 'claude-sonnet-4-5',
      modelAvailable: true,
      cliInstalled: true,
      cliVersion: '2.1.0',
      authenticated: true,
      authTier: 'max',
      installHint: null,
      quota: [
        {
          window: 'weekly',
          limit: 1000,
          used: 684,
          resetAt: '2026-10-26T00:00:00.000Z',
          usedPct: 68,
        },
      ],
    },
    {
      id: 'gemini-pro',
      state: 'not-installed',
      reachable: false,
      modelId: 'gemini-2.5-pro',
      modelAvailable: null,
      cliInstalled: false,
      cliVersion: null,
      authenticated: null,
      authTier: null,
      installHint: {
        command: 'npm install -g @google/gemini-cli',
        dangerous: false,
        caveat: 'Installs a global npm binary; review the package first.',
      },
      quota: [],
    },
  ],
  quota: {
    present: true,
    updatedAt: '2026-10-20T22:35:00.000Z',
    note: null,
  },
}

export const ROUTER_USAGE_FIXTURES = [
  {
    key: 'openai/gpt-5-codex',
    cost: 2.1,
    used: 1200,
    saved: 620,
    pct: 52,
    bar: 100,
    recommendation: 'review',
  },
  {
    key: 'anthropic/claude-sonnet',
    cost: 0.8,
    used: 700,
    saved: 240,
    pct: 34,
    bar: 39,
    recommendation: 'retain',
  },
  {
    key: 'freeinference/deepseek',
    cost: 0.0,
    used: 90,
    saved: 90,
    pct: 9,
    bar: 5,
    recommendation: 'retain',
  },
  {
    key: 'unattributed',
    cost: 0.0,
    used: 90,
    saved: 0,
    pct: 0,
    bar: 0,
    recommendation: 'review',
  },
] as const
