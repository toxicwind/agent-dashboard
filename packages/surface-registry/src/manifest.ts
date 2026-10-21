/**
 * manifest — the shape of the generated surface registry.
 *
 * The registry is a machine-readable description of every agent-chat surface
 * the estate can serve: which daemon backs it, which port it listens on,
 * where its web UI lives, how it authenticates and which repo owns it.
 *
 * It is GENERATED (see `generate.ts`) and never hand-edited — `drift.ts`
 * re-derives it from the estate SSOTs and fails when the committed artifact
 * no longer matches. Consumers therefore never hardcode a port: they read it
 * from here.
 *
 * Scope: the registry covers the AGENT CHAT SURFACES only. Ports, daemons
 * and mise tasks that no chat surface depends on are intentionally absent, so
 * unrelated estate churn never trips the drift gate.
 */

export type AgentKind = 'tau' | 'kappa' | 'kimi' | 'squawk'

export type SurfaceAuthMode = 'none' | 'basic' | 'bearer' | 'room-key'

export interface ManifestDaemon {
  readonly id: string
  readonly port: number | null
  /** The `config/ports.env` key that owns this daemon's port, when one does. */
  readonly portKey: string | null
  readonly run: string | null
  readonly dir: string | null
  readonly readyHttp: string | null
  readonly healthHttp: {
    readonly url: string
    readonly interval: string | null
    readonly timeout: string | null
    readonly retries: number | null
  } | null
  /**
   * Daemon env entries whose value is a port. Secret-looking env values are
   * NEVER published here — the key names are listed in `omittedEnvKeys` so
   * the omission is visible without leaking anything.
   */
  readonly envPorts: Readonly<Record<string, number>>
  readonly omittedEnvKeys: readonly string[]
}

export interface ManifestSurface {
  readonly agent: AgentKind
  readonly id: string
  readonly title: string
  readonly daemonId: string | null
  readonly port: number | null
  readonly portKey: string | null
  /** Origin of the surface, e.g. `http://127.0.0.1:<port>`. */
  readonly baseUrl: string | null
  /** Path of the web UI on `baseUrl`, e.g. `/console`. */
  readonly webPath: string
  /** Path of the HTTP API on `baseUrl`, e.g. `/session`. */
  readonly apiPath: string | null
  /** Path used for a liveness probe. */
  readonly healthPath: string | null
  readonly authMode: SurfaceAuthMode
  /** The repo that owns the surface's source. */
  readonly ownerRepo: string | null
  /** The source directory of the surface inside `ownerRepo`. */
  readonly ownerDir: string | null
  /** The runtime directory the backing pitchfork daemon runs in. */
  readonly daemonDir: string | null
  /** The mise task that references this surface's port, when one does. */
  readonly miseTask: string | null
  readonly notes: string
}

export interface ManifestSources {
  readonly portsEnv: string
  readonly pitchforkDir: string
  readonly pitchforkToml: string | null
  readonly miseToml: string
  readonly miseConfDir: string | null
}

export interface SurfaceManifest {
  readonly version: 1
  readonly sources: ManifestSources
  /** The `config/ports.env` entries the chat surfaces depend on, sorted by key. */
  readonly ports: Readonly<Record<string, number>>
  readonly daemons: readonly ManifestDaemon[]
  readonly surfaces: readonly ManifestSurface[]
}

/** An empty manifest — the truthful "nothing is known" registry. */
export function emptyManifest(
  sources?: Partial<ManifestSources>
): SurfaceManifest {
  return {
    version: 1,
    sources: {
      portsEnv: sources?.portsEnv ?? '',
      pitchforkDir: sources?.pitchforkDir ?? '',
      pitchforkToml: sources?.pitchforkToml ?? null,
      miseToml: sources?.miseToml ?? '',
      miseConfDir: sources?.miseConfDir ?? null,
    },
    ports: {},
    daemons: [],
    surfaces: [],
  }
}

/** Look up one agent's surface. */
export function surfaceForAgent(
  manifest: SurfaceManifest,
  agent: AgentKind
): ManifestSurface | null {
  return manifest.surfaces.find((surface) => surface.agent === agent) ?? null
}

/** Look up one daemon by id. */
export function daemonById(
  manifest: SurfaceManifest,
  id: string | null
): ManifestDaemon | null {
  if (!id) return null
  return manifest.daemons.find((daemon) => daemon.id === id) ?? null
}
