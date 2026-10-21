/**
 * pitchfork — reader for pitchfork daemon manifests.
 *
 * A pitchfork manifest is a TOML file with one `[daemons.<id>]` table per
 * daemon. The estate keeps them as fragments under
 * `/home/toxic/estate/pitchfork.d/*.toml` (plus per-project `pitchfork.d/`
 * directories), and the same shape appears inside the monolithic
 * `/home/toxic/estate/pitchfork.toml`.
 *
 * This module turns those fragments into a typed, sorted daemon list. It is
 * deliberately narrow: it reads the fields the surface registry needs
 * (port, run, dir, ready_http, health_http, env) and ignores the rest.
 */

import { parseToml, type TomlTable, type TomlValue } from './toml.ts'

export interface PitchforkHealthHttp {
  readonly url: string
  readonly interval: string | null
  readonly timeout: string | null
  readonly retries: number | null
}

export interface PitchforkDaemon {
  readonly id: string
  readonly port: number | null
  readonly run: string | null
  readonly dir: string | null
  readonly readyHttp: string | null
  readonly healthHttp: PitchforkHealthHttp | null
  /** Daemon env table. Values are kept verbatim — callers must not publish
   *  secret-looking entries. */
  readonly env: Record<string, string>
  readonly depends: readonly string[]
  readonly auto: readonly string[]
  readonly mise: boolean | null
  readonly retry: boolean | null
}

function asString(value: TomlValue | undefined): string | null {
  if (typeof value === 'string') return value
  if (typeof value === 'number' || typeof value === 'boolean')
    return String(value)
  return null
}

function asNumber(value: TomlValue | undefined): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string') {
    const parsed = Number(value)
    if (Number.isFinite(parsed)) return parsed
  }
  return null
}

function asBoolean(value: TomlValue | undefined): boolean | null {
  if (typeof value === 'boolean') return value
  if (value === 'true') return true
  if (value === 'false') return false
  return null
}

function asStringArray(value: TomlValue | undefined): string[] {
  if (!Array.isArray(value)) return []
  const out: string[] = []
  for (const item of value) {
    const str = asString(item)
    if (str !== null) out.push(str)
  }
  return out
}

function asStringMap(value: TomlValue | undefined): Record<string, string> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  const out: Record<string, string> = {}
  for (const [key, raw] of Object.entries(value as TomlTable)) {
    const str = asString(raw)
    if (str !== null) out[key] = str
  }
  return out
}

function asHealthHttp(
  value: TomlValue | undefined
): PitchforkHealthHttp | null {
  if (typeof value === 'string')
    return { url: value, interval: null, timeout: null, retries: null }
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const table = value as TomlTable
  const url = asString(table.url)
  if (!url) return null
  return {
    url,
    interval: asString(table.interval),
    timeout: asString(table.timeout),
    retries: asNumber(table.retries),
  }
}

/** Extract every `[daemons.<id>]` table from one manifest's TOML source. */
export function parsePitchforkDaemons(source: string): PitchforkDaemon[] {
  const doc = parseToml(source)
  const daemons = doc.daemons
  if (!daemons || typeof daemons !== 'object' || Array.isArray(daemons))
    return []

  const out: PitchforkDaemon[] = []
  for (const [id, raw] of Object.entries(daemons as TomlTable)) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) continue
    const table = raw as TomlTable
    out.push({
      id,
      port: asNumber(table.port),
      run: asString(table.run),
      dir: asString(table.dir),
      readyHttp: asString(table.ready_http),
      healthHttp: asHealthHttp(table.health_http),
      env: asStringMap(table.env),
      depends: asStringArray(table.depends),
      auto: asStringArray(table.auto),
      mise: asBoolean(table.mise),
      retry: asBoolean(table.retry),
    })
  }
  return out.sort((a, b) => a.id.localeCompare(b.id))
}

/** Parse many manifest sources at once, de-duplicating by daemon id. */
export function parsePitchforkManifests(
  sources: ReadonlyArray<{ file: string; source: string }>
): PitchforkDaemon[] {
  const byId = new Map<string, PitchforkDaemon>()
  for (const { source } of [...sources].sort((a, b) =>
    a.file.localeCompare(b.file)
  )) {
    for (const daemon of parsePitchforkDaemons(source)) {
      const existing = byId.get(daemon.id)
      // A later fragment may complete an earlier partial definition; merge
      // field-by-field so a fragment that only sets `port` keeps the `run`
      // line from the monolithic manifest.
      byId.set(daemon.id, existing ? mergeDaemon(existing, daemon) : daemon)
    }
  }
  return [...byId.values()].sort((a, b) => a.id.localeCompare(b.id))
}

function mergeDaemon(
  base: PitchforkDaemon,
  next: PitchforkDaemon
): PitchforkDaemon {
  return {
    id: base.id,
    port: next.port ?? base.port,
    run: next.run ?? base.run,
    dir: next.dir ?? base.dir,
    readyHttp: next.readyHttp ?? base.readyHttp,
    healthHttp: next.healthHttp ?? base.healthHttp,
    env: { ...base.env, ...next.env },
    depends: next.depends.length ? next.depends : base.depends,
    auto: next.auto.length ? next.auto : base.auto,
    mise: next.mise ?? base.mise,
    retry: next.retry ?? base.retry,
  }
}

/** Extract the `:port` from a URL, or null when there is none. */
export function portFromUrl(url: string | null): number | null {
  if (!url) return null
  const match = url.match(/^[a-z][a-z0-9+.-]*:\/\/[^/:]+:(\d+)/i)
  if (!match) return null
  const port = Number(match[1])
  return Number.isInteger(port) ? port : null
}
