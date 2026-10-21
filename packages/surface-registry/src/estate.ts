/**
 * estate — the filesystem side of the surface registry.
 *
 * Reads the estate's own SSOTs:
 *
 *   - `config/ports.env`      — the numeric port SSOT;
 *   - `pitchfork.d/*.toml`    — per-daemon manifests (plus the monolithic
 *                                `pitchfork.toml`);
 *   - `mise.toml` (+ `mise/conf.d/*.toml`) — task definitions and the port
 *                                references inside them;
 *   - `ranch/tau/packages/wire/src/index.ts` — the collab relay origin that
 *                                serves tau's collab-web SPA.
 *
 * Every read is defensive: a missing file yields an empty contribution, never
 * an exception. The generator then composes a manifest that is still valid —
 * it just knows less.
 */

import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { type ManifestSources } from './manifest.ts'
import { type MiseModel, parseMiseDocuments } from './mise.ts'
import { type PitchforkDaemon, parsePitchforkManifests } from './pitchfork.ts'
import { parsePortsEnv } from './ports-env.ts'

export const DEFAULT_ESTATE_ROOT = '/home/toxic/estate'

export interface EstateSources {
  readonly sources: ManifestSources
  readonly ports: Readonly<Record<string, number>>
  readonly daemons: readonly PitchforkDaemon[]
  readonly mise: MiseModel
  readonly tauRelayUrl: string | null
}

function readText(path: string): string | null {
  try {
    return readFileSync(path, 'utf8')
  } catch {
    return null
  }
}

function readTomlFiles(dir: string): Array<{ file: string; source: string }> {
  let entries: string[]
  try {
    entries = readdirSync(dir)
  } catch {
    return []
  }
  const out: Array<{ file: string; source: string }> = []
  for (const entry of entries.sort()) {
    if (!entry.endsWith('.toml')) continue
    const file = join(dir, entry)
    const source = readText(file)
    if (source === null) continue
    out.push({ file, source })
  }
  return out
}

/**
 * The tau collab relay origin, read from the `@tau/tau-wire` package that
 * both the host and the collab-web client depend on. The web SPA is served
 * from the same origin, over https.
 */
export function readTauRelayUrl(estateRoot: string): string | null {
  const candidates = [
    join(estateRoot, 'ranch/tau/packages/wire/src/index.ts'),
    join(estateRoot, 'ranch/tau/packages/wire/src/protocol.ts'),
  ]
  for (const file of candidates) {
    const source = readText(file)
    if (source === null) continue
    const match = source.match(/DEFAULT_RELAY_URL\s*=\s*["']([^"']+)["']/)
    if (match) return match[1]
  }
  return null
}

/** Read every estate SSOT the registry composes from. */
export function readEstateSources(
  estateRoot: string = DEFAULT_ESTATE_ROOT
): EstateSources {
  const portsEnvPath = join(estateRoot, 'config/ports.env')
  const pitchforkDir = join(estateRoot, 'pitchfork.d')
  const pitchforkToml = join(estateRoot, 'pitchfork.toml')
  const miseToml = join(estateRoot, 'mise.toml')
  const miseConfDir = join(estateRoot, 'mise/conf.d')

  const portsEnv = readText(portsEnvPath)
  const ports = portsEnv === null ? {} : parsePortsEnv(portsEnv)

  const manifestSources: Array<{ file: string; source: string }> = [
    ...readTomlFiles(pitchforkDir),
  ]
  const monolithic = readText(pitchforkToml)
  if (monolithic !== null) {
    manifestSources.push({ file: pitchforkToml, source: monolithic })
  }
  const daemons = parsePitchforkManifests(manifestSources)

  const miseSources: Array<{ file: string; source: string }> = []
  const miseRoot = readText(miseToml)
  if (miseRoot !== null) miseSources.push({ file: miseToml, source: miseRoot })
  miseSources.push(...readTomlFiles(miseConfDir))
  const mise = parseMiseDocuments(miseSources)

  return {
    sources: {
      portsEnv: portsEnvPath,
      pitchforkDir,
      pitchforkToml: existsSync(pitchforkToml) ? pitchforkToml : null,
      miseToml: miseToml,
      miseConfDir: existsSync(miseConfDir) ? miseConfDir : null,
    },
    ports,
    daemons,
    mise,
    tauRelayUrl: readTauRelayUrl(estateRoot),
  }
}

/** True when the estate root looks like an estate checkout. */
export function estateRootExists(
  estateRoot: string = DEFAULT_ESTATE_ROOT
): boolean {
  try {
    return statSync(estateRoot).isDirectory()
  } catch {
    return false
  }
}
