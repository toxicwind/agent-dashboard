/**
 * compose — turn the estate SSOTs into the surface manifest.
 *
 * Pure: every input arrives as a value, the output is deterministic
 * (sorted everywhere, no timestamps), so the drift check can compare two
 * derivations byte-for-byte.
 *
 * The composition rules are:
 *
 *   1. `config/ports.env` is the numeric SSOT — it owns every port number.
 *   2. A pitchfork daemon's port is its own `port` key, else the port in its
 *      `ready_http` / `health_http` URL, else a `*_PORT` value in its env.
 *   3. A daemon's SSOT key is the `config/ports.env` key that owns the same
 *      number, preferring a key whose name matches the daemon id.
 *   4. A surface's base URL is `http://127.0.0.1:<port>` for port-backed
 *      surfaces, and the relay origin for tau's collab-web.
 *   5. Secret-looking daemon env values are NEVER published.
 *   6. Only the ports, daemons and mise tasks a chat surface depends on are
 *      published, so unrelated estate churn never trips the drift gate.
 */

import {
  type ManifestDaemon,
  type ManifestSources,
  type ManifestSurface,
  type SurfaceManifest,
} from './manifest.ts'
import { type MiseModel } from './mise.ts'
import { type PitchforkDaemon, portFromUrl } from './pitchfork.ts'
import { type AgentSurfaceRule, AGENT_SURFACE_RULES } from './rules.ts'

export interface ComposeInput {
  readonly sources: ManifestSources
  readonly ports: Readonly<Record<string, number>>
  readonly daemons: readonly PitchforkDaemon[]
  readonly mise: MiseModel
  /** The tau collab relay origin, e.g. `wss://my.tau.sh`. */
  readonly tauRelayUrl: string | null
}

/** Normalise a daemon id into a ports.env key stem: `kappa-acp` → `KAPPA_ACP`. */
export function daemonKeyStem(id: string): string {
  return id
    .replace(/[^A-Za-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .toUpperCase()
}

const PORT_ENV_KEY_RE = /(?:^|_)(?:PORT|PORTS)$/

function envPortValue(daemon: PitchforkDaemon): number | null {
  for (const key of Object.keys(daemon.env).sort()) {
    if (!PORT_ENV_KEY_RE.test(key)) continue
    const port = Number(daemon.env[key])
    if (Number.isInteger(port)) return port
  }
  return null
}

/** The port a daemon actually listens on, from the manifest alone. */
export function daemonPort(daemon: PitchforkDaemon): number | null {
  return (
    daemon.port ??
    portFromUrl(daemon.readyHttp) ??
    portFromUrl(daemon.healthHttp?.url ?? null) ??
    envPortValue(daemon)
  )
}

/** The `config/ports.env` key that owns a daemon's port. */
export function daemonPortKey(
  daemon: PitchforkDaemon,
  ports: Readonly<Record<string, number>>
): string | null {
  const port = daemonPort(daemon)
  if (port === null) return null
  const stem = daemonKeyStem(daemon.id)
  const keys = Object.keys(ports).sort()
  const exact = keys.find((key) => key === `${stem}_PORT`)
  if (exact && ports[exact] === port) return exact
  const matches = keys.filter((key) => ports[key] === port)
  if (matches.length === 0) return null
  const related = matches.find((key) =>
    key.replace(/_PORT$/, '').includes(stem)
  )
  return related ?? matches[0]
}

function manifestDaemon(
  daemon: PitchforkDaemon,
  ports: Readonly<Record<string, number>>
): ManifestDaemon {
  const envPorts: Record<string, number> = {}
  const omittedEnvKeys: string[] = []
  for (const key of Object.keys(daemon.env).sort()) {
    const value = daemon.env[key]
    const asNumber = Number(value)
    if (PORT_ENV_KEY_RE.test(key) && Number.isInteger(asNumber)) {
      envPorts[key] = asNumber
      continue
    }
    // Anything else (tokens, passwords, hosts) is dropped: the manifest is a
    // committed artifact and must never carry a secret.
    omittedEnvKeys.push(key)
  }
  return {
    id: daemon.id,
    port: daemonPort(daemon),
    portKey: daemonPortKey(daemon, ports),
    run: daemon.run,
    dir: daemon.dir,
    readyHttp: daemon.readyHttp,
    healthHttp: daemon.healthHttp,
    envPorts,
    omittedEnvKeys,
  }
}

/** Turn a `wss://` relay origin into the `https://` origin that serves the SPA. */
export function relayOriginToWebOrigin(relayUrl: string | null): string | null {
  if (!relayUrl) return null
  const trimmed = relayUrl.trim()
  if (!trimmed) return null
  if (trimmed.startsWith('wss://'))
    return `https://${trimmed.slice('wss://'.length)}`
  if (trimmed.startsWith('ws://'))
    return `http://${trimmed.slice('ws://'.length)}`
  return trimmed
}

function resolveOwnerPath(estateRoot: string, path: string): string {
  if (path.startsWith('/')) return path
  return `${estateRoot.replace(/\/+$/, '')}/${path}`
}

/** The mise task that references a given port, if any (first by name). */
export function miseTaskForPort(
  mise: MiseModel,
  port: number | null
): string | null {
  if (port === null) return null
  const hit = mise.tasks.find((task) => task.ports.includes(port))
  return hit ? hit.name : null
}

function composeSurface(
  rule: AgentSurfaceRule,
  daemons: readonly PitchforkDaemon[],
  ports: Readonly<Record<string, number>>,
  tauRelayUrl: string | null,
  estateRoot: string,
  mise: MiseModel
): ManifestSurface {
  const daemon = rule.daemonId
    ? (daemons.find((candidate) => candidate.id === rule.daemonId) ?? null)
    : null
  // A rule names the SSOT key that owns its port; a renamed key keeps
  // resolving through `portKeyFallbacks` until the SSOT itself is migrated.
  const portKeys = [rule.portKey, ...(rule.portKeyFallbacks ?? [])].filter(
    (key): key is string => typeof key === 'string' && key.length > 0
  )
  const keyedPort =
    portKeys.reduce<number | null>((found, key) => {
      if (found !== null) return found
      const value = ports[key]
      return typeof value === 'number' ? value : null
    }, null) ?? null
  const port = keyedPort ?? (daemon ? daemonPort(daemon) : null)
  const resolvedPortKey =
    portKeys.find((key) => typeof ports[key] === 'number') ??
    (daemon ? daemonPortKey(daemon, ports) : null)
  const baseUrl =
    rule.baseUrlSource === 'tau-relay'
      ? relayOriginToWebOrigin(tauRelayUrl)
      : port !== null
        ? `http://127.0.0.1:${port}`
        : null
  const ownerRepo = rule.ownerRepo
    ? resolveOwnerPath(estateRoot, rule.ownerRepo)
    : null
  const ownerDir =
    ownerRepo && rule.ownerSubdir
      ? `${ownerRepo}/${rule.ownerSubdir}`
      : ownerRepo

  return {
    agent: rule.agent,
    id: rule.id,
    title: rule.title,
    daemonId: daemon?.id ?? null,
    port,
    portKey: resolvedPortKey,
    baseUrl,
    webPath: rule.webPath,
    apiPath: rule.apiPath,
    healthPath: rule.healthPath,
    authMode: rule.authMode,
    ownerRepo,
    ownerDir,
    daemonDir: daemon?.dir ?? null,
    miseTask: miseTaskForPort(mise, port),
    notes: rule.notes,
  }
}

/** Compose the surface manifest from the parsed estate SSOTs. */
export function composeManifest(input: ComposeInput): SurfaceManifest {
  const estateRoot = input.sources.pitchforkDir.replace(/\/pitchfork\.d$/, '')
  const surfaces: ManifestSurface[] = [...AGENT_SURFACE_RULES]
    .sort((a, b) => a.agent.localeCompare(b.agent))
    .map((rule) =>
      composeSurface(
        rule,
        input.daemons,
        input.ports,
        input.tauRelayUrl,
        estateRoot,
        input.mise
      )
    )

  const ports: Record<string, number> = {}
  for (const surface of surfaces) {
    if (!surface.portKey) continue
    const value = input.ports[surface.portKey]
    if (typeof value === 'number') ports[surface.portKey] = value
  }

  const daemonIds = new Set(
    surfaces.map((surface) => surface.daemonId).filter(Boolean)
  )
  const daemons = [...input.daemons]
    .filter((daemon) => daemonIds.has(daemon.id))
    .sort((a, b) => a.id.localeCompare(b.id))
    .map((daemon) => manifestDaemon(daemon, input.ports))

  return {
    version: 1,
    sources: input.sources,
    ports,
    daemons,
    surfaces,
  }
}

/** Canonical JSON for a manifest — stable key order, so drift is byte-exact. */
export function manifestToJson(manifest: SurfaceManifest): string {
  return `${JSON.stringify(manifest, null, 2)}\n`
}
