#!/usr/bin/env bun
/**
 * gatehouse-serve.ts — real TypeScript runner for the estate gatehouse
 * (mcpproxy-go) server, replacing the fragile `gatehouse-serve.sh` bash shims.
 *
 * Sources the gatehouse API key + optional EXA key from secretsmith (the SSOT),
 * ensures mcp_config.json exists (seeds from .dist), then spawns `gatehouse
 * serve`. Pure TypeScript; no bash indirection.
 */
import { existsSync, chmodSync, readFileSync, writeFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'

const ESTATE = '/home/toxic/estate'
const CFG = `${ESTATE}/ranch/barn/gatehouse/mcp_config.json`
const DIST = `${ESTATE}/ranch/barn/gatehouse/mcp_config.json.dist`

function secret(key: string): string | undefined {
  // secretsmith env is the SSOT (opt-in export lines); fall back to ~/.secrets
  const sm = spawnSync('/home/toxic/.local/bin/secretsmith', ['env'], {
    encoding: 'utf8',
  })
  if (sm.status === 0) {
    const m = sm.stdout.match(new RegExp(`^${key}=(.*)$`, 'm'))
    if (m) return m[1]
  }
  const s = readFileSync('/home/toxic/.secrets', 'utf8')
  const m = s.match(new RegExp(`^${key}=(.*)$`, 'm'))
  return m?.[1]
}

const apiKey = secret('MCPPROXY_API_KEY')
if (!apiKey) {
  console.error('MCPPROXY_API_KEY missing from secretsmith/~/.secrets')
  process.exit(1)
}
const exa = secret('EXA_API_KEY')
const env: typeof process.env = { ...process.env, MCPPROXY_API_KEY: apiKey }
if (exa) env.EXA_API_KEY = exa

if (!existsSync(CFG) && existsSync(DIST)) {
  writeFileSync(CFG, readFileSync(DIST, 'utf8'))
  chmodSync(CFG, 0o600)
}
if (!existsSync(CFG)) throw new Error(`no gatehouse config at ${CFG}`)

// gatehouse is mcpproxy-go: its `serve` entrypoint is the Go gateway binary.
// NOTE: propylon/gatehouse SEGFAULTS (dumped core, exit 139); use the known-good
// propylon/gatehouse-v0.51.0 (verified: prints 'mcpproxy serve [flags]', exit 0).
const GATEHOUSE_BIN = '/home/toxic/estate/ranch/propylon/gatehouse-v0.51.0'
if (!existsSync(GATEHOUSE_BIN))
  throw new Error(`gatehouse (mcpproxy-go) binary missing: ${GATEHOUSE_BIN}`)

const result = spawnSync(GATEHOUSE_BIN, ['serve', '--listen=127.0.0.1:25127'], {
  env,
  stdio: 'inherit',
})
process.exit(result.status ?? 1)
