/**
 * Control-plane domain types.
 *
 * The provider vocabulary is re-declared 1:1 from the DelendAI provider
 * render-model (ranch/borrowed/delendai apps/web/src/data/provider-dashboard.ts,
 * f00098 S1 `provider-status.interface.ts`) so its data vocabulary is drawn
 * from the same field-for-field contract the VS Code host renders live.
 */

// ─── Provider / quota (render-model vocabulary) ──────────────────────────────
export type ProviderState =
  | 'available'
  | 'quota-exceeded'
  | 'rate-limited'
  | 'unauthenticated'
  | 'not-installed'
  | 'model-unavailable'
  | 'error'

export type QuotaWindowName = 'hourly' | 'weekly' | 'monthly'

export interface IProviderQuotaMeter {
  readonly window: QuotaWindowName
  readonly limit: number | null
  readonly used: number | null
  readonly resetAt: string | null
  /** `used / limit` in whole percent; `null` when unknown/limit 0. Can exceed 100. */
  readonly usedPct: number | null
}

export interface IProviderStatusRow {
  readonly id: string
  readonly state: ProviderState
  readonly reachable: boolean
  readonly modelId: string
  readonly modelAvailable: boolean | null
  readonly cliInstalled: boolean
  readonly cliVersion: string | null
  readonly authenticated: boolean | null
  readonly authTier: string | null
  readonly installHint: {
    readonly command: string
    readonly dangerous: boolean
    readonly caveat: string
  } | null
  readonly quota: readonly IProviderQuotaMeter[]
}

export interface IProviderStatusReadyModel {
  readonly kind: 'ready'
  readonly checkedAt: string
  readonly summary: {
    readonly total: number
    readonly available: number
    readonly unavailable: number
  }
  readonly emptyRoster: boolean
  readonly rows: readonly IProviderStatusRow[]
  readonly quota: {
    readonly present: boolean
    readonly updatedAt: string | null
    readonly note: string | null
  }
}

// ─── Router usage / cost recommendation ─────────────────────────────────────
export interface IRouterUsageRow {
  readonly key: string // e.g. "openai/gpt-5-codex"
  readonly cost: number // $ spent
  readonly used: number // token units
  readonly saved: number // tokens saved by cost-aware routing
  readonly pct: number // share %
  readonly bar: number // 0..100 meter fill
  readonly recommendation: 'retain' | 'review' | 'demote'
}

// ─── Services grid ──────────────────────────────────────────────────────────
export type ServiceStatus = 'up' | 'degraded' | 'down'
export type ServiceKind = 'inference' | 'orchestration' | 'web' | 'data' | 'ops'

export interface IServiceRow {
  readonly name: string
  readonly port: number
  readonly status: ServiceStatus
  readonly kind: ServiceKind
  readonly health: number // 0..100
  readonly description: string
}

// ─── kappa chat channels ────────────────────────────────────────────────────
export interface IChatMessage {
  readonly seq: number
  readonly from: string
  readonly to: string
  readonly channel: string
  readonly ts: string | null
  readonly status: string | null
  readonly title: string | null
  readonly body: string
}

export interface IChatChannel {
  readonly name: string
  readonly members: readonly string[]
  readonly topic: string
  readonly created: string | null
  readonly messageCount: number
  readonly lastMessageAt: string | null
  readonly messages: readonly IChatMessage[]
}

// ─── Real estate dashboards registry ────────────────────────────────────────
export interface IDashboardLink {
  readonly id: string
  readonly name: string
  readonly url: string
  readonly note: string
  readonly live: boolean
  readonly status: number | null
}

export interface IDashboardsModel {
  readonly generatedAt: string
  readonly source: string
  readonly dashboards: readonly IDashboardLink[]
}

// ─── Running agent chats (tau / kappa / kimi) ───────────────────────────────
export type ChatAgent = 'tau' | 'kappa' | 'kimi' | 'squawk'

/** `live` = written to within the live window; `idle` = persisted only. */
export type ChatStatus = 'live' | 'idle' | 'unavailable'

export interface IAgentChat {
  readonly id: string
  readonly agent: ChatAgent
  readonly title: string
  readonly status: ChatStatus
  readonly updatedAt: string | null
  readonly createdAt: string | null
  readonly project: string | null
  /** Deep link into that agent's own web UI, when one exists. */
  readonly webUrl: string | null
  readonly source: string
}

export interface IChatSurface {
  readonly id: string
  readonly agent: ChatAgent
  readonly name: string
  readonly daemon: string
  readonly state: string
  readonly port: number | null
  readonly url: string | null
  /**
   * `null` = not probed from this box (unknown — never rendered as down),
   * `true` = the surface answered, `false` = it refused.
   */
  readonly live: boolean | null
  readonly auth: 'none' | 'bearer' | 'basic' | 'room-key'
  readonly note: string
}

export interface IChatsModel {
  readonly kind: 'ready'
  readonly generatedAt: string
  readonly summary: {
    readonly total: number
    readonly live: number
    readonly idle: number
    readonly unavailable: number
  }
  readonly rows: readonly IAgentChat[]
  readonly surfaces: readonly IChatSurface[]
  readonly notes: readonly string[]
}

// ─── Control-plane overall model ────────────────────────────────────────────
export interface IControlPlaneModel {
  readonly providers: IProviderStatusReadyModel
  readonly routerUsage: readonly IRouterUsageRow[]
  readonly services: readonly IServiceRow[]
  readonly channels: readonly IChatChannel[]
  readonly meta: {
    readonly controlApi: string
    readonly bridgeRoot: string
    readonly live: boolean
  }
}
