/**
 * rules — the agent → surface composition table.
 *
 * This is the ONE place that knows which estate daemon backs which agent's
 * web UI. It deliberately names SSOT *keys* and *daemon ids* — never port
 * numbers — so a port can only ever come from `config/ports.env` (or from
 * the daemon's own `ready_http`/`health_http`), never from a literal in this
 * repository.
 *
 * The shape mirrors the estate's own `scripts/open-web-uis.ts` registry
 * (`id` / `portKey` / `path` / `description` / `authRequired`), minus the
 * hardcoded default ports: the port always comes from the SSOT.
 */

import type { AgentKind, SurfaceAuthMode } from './manifest.ts'

export interface AgentSurfaceRule {
  readonly agent: AgentKind
  readonly id: string
  readonly title: string
  /** The pitchfork daemon that backs this surface, when there is one. */
  readonly daemonId: string | null
  /** The `config/ports.env` key that owns the surface's port. */
  readonly portKey: string | null
  /**
   * Legacy `config/ports.env` keys to try when `portKey` is absent.
   *
   * A rename of a port key (e.g. `ESTATE_CHAT_PORT` -> `SQUAWK_CHAT_PORT`)
   * must never make a surface lose its port, so the legacy name stays
   * resolvable until the SSOT itself is migrated.
   */
  readonly portKeyFallbacks?: readonly string[]
  /** Path of the web UI on the surface's base URL. */
  readonly webPath: string
  /** Path of the HTTP API on the surface's base URL. */
  readonly apiPath: string | null
  /** Path used for a liveness probe. */
  readonly healthPath: string | null
  readonly authMode: SurfaceAuthMode
  /**
   * The repo that owns the surface. Relative paths are resolved against the
   * estate root; absolute paths are used as-is.
   */
  readonly ownerRepo: string | null
  /** The directory of the surface inside `ownerRepo`, when it is not the repo root. */
  readonly ownerSubdir: string | null
  /** Where the surface's base URL comes from. */
  readonly baseUrlSource: 'port' | 'tau-relay'
  readonly notes: string
}

export const AGENT_SURFACE_RULES: readonly AgentSurfaceRule[] = [
  {
    agent: 'tau',
    id: 'tau-collab-web',
    title: 'Tau Collab Web',
    daemonId: null,
    portKey: null,
    webPath: '/',
    apiPath: null,
    healthPath: null,
    authMode: 'room-key',
    ownerRepo: 'ranch/tau',
    ownerSubdir: 'packages/collab-web',
    baseUrlSource: 'tau-relay',
    notes:
      'Tau has no local port for its web UI: the collab-web SPA is served from the collab relay origin (wss:// → https://) declared by @tau/tau-wire. Per-chat deep links come from `tau collab link <instanceId>`. The relay origin is NOT reachable from the box (curl 000), so the supervised local plane for tau is `tau-acp` below.',
  },
  {
    agent: 'tau',
    id: 'tau-acp',
    title: 'Tau ACP (local chute)',
    daemonId: 'tau-chute',
    portKey: 'TAU_CHUTE_PORT',
    webPath: '',
    apiPath: null,
    healthPath: null,
    authMode: 'none',
    ownerRepo: 'ranch/barn/chute',
    ownerSubdir: null,
    baseUrlSource: 'port',
    notes:
      'The tau engine speaks ACP over stdio only, so `chute` (ranch/barn/chute) exposes it on a real supervised TCP port (TAU_CHUTE_PORT). One child per connection, `mcpServers` normalised on session/new. Liveness is a TCP connect; the protocol handshake is an ACP `initialize` frame.',
  },
  {
    agent: 'kappa',
    id: 'kappa-console',
    title: 'Kappa Console',
    daemonId: 'kappa-acp',
    portKey: 'KAPPA_ACP_PORT',
    webPath: '/console',
    apiPath: '/session',
    healthPath: '/api/health',
    authMode: 'basic',
    ownerRepo: 'ranch/kappa/kappa-code',
    ownerSubdir: 'packages/cli',
    baseUrlSource: 'port',
    notes:
      'The Kappa Console SPA is served by the kappa server itself under /console; the session API is /session and liveness is /api/health. The server is Basic-auth protected (username `kappa`, password from the keyring at runtime).',
  },
  {
    agent: 'kimi',
    id: 'kimi-web',
    title: 'Kimi Web',
    daemonId: 'kimi-code',
    portKey: 'KIMI_CODE_PORT',
    webPath: '/',
    apiPath: '/api/v1/sessions',
    healthPath: '/api/v1/healthz',
    authMode: 'bearer',
    ownerRepo: '/home/toxic/src/local/kimi-code-estate',
    ownerSubdir: 'apps/kimi-web',
    baseUrlSource: 'port',
    notes:
      '`kimi web` serves the Vue SPA and the REST+WS API under /api/v1 behind a persistent bearer token. Every response is the envelope {code,msg,data}; code 0 means ok.',
  },
  {
    agent: 'squawk',
    id: 'squawk-chat',
    title: 'Squawk Chat',
    daemonId: 'squawk-chat',
    portKey: 'SQUAWK_CHAT_PORT',
    portKeyFallbacks: ['ESTATE_CHAT_PORT'],
    webPath: '/v1',
    apiPath: '/v1/channels',
    healthPath: '/v1/health',
    authMode: 'bearer',
    ownerRepo: 'ranch/squawk-chat',
    ownerSubdir: null,
    baseUrlSource: 'port',
    notes:
      'The squawk HTTP/WS/MCP chat plane. Bearer token from ~/.config/squawk-chat-token (0600); legacy file names stay valid fallbacks. The port key was renamed from ESTATE_CHAT_PORT, so the legacy key is still resolvable.',
  },
  {
    agent: 'squawk',
    id: 'squawk-feed',
    title: 'Squawk Feed',
    daemonId: 'squawk-feed',
    portKey: 'SQUAWK_FEED_PORT',
    webPath: '/',
    apiPath: '/feed',
    healthPath: '/health',
    authMode: 'bearer',
    ownerRepo: 'ranch/squawk',
    ownerSubdir: null,
    baseUrlSource: 'port',
    notes:
      'The file-backed squawk feed: channels live under ~/.fleet-bus/squawk-root. The feed token file is ~/.fleet-bus/squawk-relay/feed-token.',
  },
  {
    agent: 'squawk',
    id: 'squawk-ws',
    title: 'Squawk WebSocket',
    daemonId: 'squawk-ws',
    portKey: 'SQUAWK_WS_PORT',
    webPath: '/',
    apiPath: '/v1/stream',
    healthPath: null,
    authMode: 'bearer',
    ownerRepo: 'ranch/squawk',
    ownerSubdir: null,
    baseUrlSource: 'port',
    notes:
      'The squawk websocket plane: live fan-out of the file-backed channels to every connected client.',
  },
  {
    agent: 'squawk',
    id: 'squawk-history',
    title: 'Squawk History',
    daemonId: 'squawk-history',
    portKey: 'SQUAWK_HISTORY_PORT',
    webPath: '/',
    apiPath: '/history',
    healthPath: '/health',
    authMode: 'none',
    ownerRepo: 'ranch/squawk',
    ownerSubdir: null,
    baseUrlSource: 'port',
    notes:
      'Read-only history over the squawk channel archives, used to backfill a client that joined late.',
  },
  {
    agent: 'squawk',
    id: 'squawk-ui',
    title: 'Squawk UI',
    daemonId: 'fleet-ui',
    portKey: 'FLEET_UI_PORT',
    webPath: '/',
    apiPath: null,
    healthPath: '/',
    authMode: 'none',
    ownerRepo: 'ranch/squawk',
    ownerSubdir: null,
    baseUrlSource: 'port',
    notes:
      'The squawk web UI. The port key is FLEET_UI_PORT because the daemon is still named fleet-ui.',
  },
] as const

/** The rule for one agent, or null when the agent is not registered. */
export function ruleForAgent(agent: AgentKind): AgentSurfaceRule | null {
  return AGENT_SURFACE_RULES.find((rule) => rule.agent === agent) ?? null
}
