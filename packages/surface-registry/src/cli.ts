#!/usr/bin/env node
/**
 * cli — `surface-registry generate` / `surface-registry check`.
 *
 *   generate   compose the manifest from the estate SSOTs and write the
 *              committed artifacts (idempotent, deterministic).
 *   check      re-derive the manifest and fail when the committed artifact
 *              no longer matches — the machine gate that keeps the dashboard
 *              from ever serving a stale port.
 *
 * Exit codes: 0 = ok, 1 = drift (or a failed write), 2 = bad usage.
 */

import { DEFAULT_ESTATE_ROOT } from './estate.ts'
import { checkDrift } from './drift.ts'
import { generate } from './generate.ts'

const USAGE = `surface-registry <generate|check> [--estate-root <path>] [--out-dir <path>]

  generate   write src/generated/surfaces.json + surfaces.ts from the estate SSOTs
  check      fail (exit 1) when the committed manifest drifted from the estate`
interface Args {
  readonly command: string
  readonly estateRoot: string
  readonly outDir?: string
}

function parseArgs(argv: readonly string[]): Args {
  let command = ''
  let estateRoot = DEFAULT_ESTATE_ROOT
  let outDir: string | undefined

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]
    if (arg === '--estate-root') {
      estateRoot = argv[i + 1] ?? estateRoot
      i += 1
      continue
    }
    if (arg === '--out-dir') {
      outDir = argv[i + 1]
      i += 1
      continue
    }
    if (arg === '--help' || arg === '-h') {
      command = 'help'
      continue
    }
    if (!arg.startsWith('-') && !command) command = arg
  }

  return { command, estateRoot, outDir }
}

function main(argv: readonly string[]): number {
  const args = parseArgs(argv)

  if (args.command === 'help' || args.command === '') {
    console.log(USAGE)
    return args.command === '' ? 2 : 0
  }

  if (args.command === 'generate') {
    const result = generate({
      estateRoot: args.estateRoot,
      outDir: args.outDir,
    })
    const surfaces = result.manifest.surfaces
      .map((surface) => `${surface.agent}:${surface.baseUrl ?? 'unresolved'}`)
      .join(' ')
    console.log(
      `[surface-registry] ${result.changed ? 'wrote' : 'unchanged'} ${result.jsonPath}, ${result.tsPath}`
    )
    console.log(`[surface-registry] surfaces ${surfaces}`)
    return 0
  }

  if (args.command === 'check') {
    const result = checkDrift({
      estateRoot: args.estateRoot,
      outDir: args.outDir,
    })
    if (result.ok) {
      console.log(`[surface-registry] ${result.detail}`)
      return 0
    }
    console.error(`[surface-registry] ${result.detail}`)
    return 1
  }

  console.error(`[surface-registry] unknown command: ${args.command}`)
  console.error(USAGE)
  return 2
}

process.exitCode = main(process.argv.slice(2))
