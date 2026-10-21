/**
 * drift — the machine gate.
 *
 * Re-derives the surface manifest from the estate SSOTs and compares it with
 * the committed artifact. When they differ the estate moved a port (or a
 * daemon changed) and the dashboard would be serving a stale URL — so the
 * check exits non-zero and tells the operator to regenerate.
 *
 * The comparison is byte-exact on the rendered artifacts, which makes the
 * result independent of key ordering inside the JSON.
 */

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  deriveManifest,
  defaultOutDir,
  MANIFEST_JSON_NAME,
  MANIFEST_TS_NAME,
  renderManifestModule,
} from './generate.ts'
import { manifestToJson } from './compose.ts'
import { DEFAULT_ESTATE_ROOT } from './estate.ts'

export interface DriftOptions {
  readonly estateRoot?: string
  readonly outDir?: string
}

export interface DriftResult {
  readonly ok: boolean
  readonly jsonPath: string
  readonly tsPath: string
  /** The files that no longer match the estate. */
  readonly drifted: readonly string[]
  /** A short, human-readable description of the difference. */
  readonly detail: string
}

function readIfExists(path: string): string | null {
  try {
    return readFileSync(path, 'utf8')
  } catch {
    return null
  }
}

/** Compare the committed artifacts with a fresh derivation of the manifest. */
export function checkDrift(options: DriftOptions = {}): DriftResult {
  const estateRoot = options.estateRoot ?? DEFAULT_ESTATE_ROOT
  const outDir = options.outDir ?? defaultOutDir()
  const jsonPath = join(outDir, MANIFEST_JSON_NAME)
  const tsPath = join(outDir, MANIFEST_TS_NAME)

  const manifest = deriveManifest(estateRoot)
  const expectedJson = manifestToJson(manifest)
  const expectedTs = renderManifestModule(manifest)

  const actualJson = readIfExists(jsonPath)
  const actualTs = readIfExists(tsPath)

  const drifted: string[] = []
  if (actualJson === null) drifted.push(jsonPath)
  else if (actualJson !== expectedJson) drifted.push(jsonPath)
  if (actualTs === null) drifted.push(tsPath)
  else if (actualTs !== expectedTs) drifted.push(tsPath)

  const detail =
    drifted.length === 0
      ? 'surface manifest matches the estate SSOTs'
      : `surface manifest is stale: ${drifted.join(', ')} differ from the estate SSOTs. Run: pnpm --filter @ranch/surface-registry generate`

  return { ok: drifted.length === 0, jsonPath, tsPath, drifted, detail }
}
