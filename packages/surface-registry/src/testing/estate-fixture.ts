/**
 * estate-fixture — a throwaway estate tree for the generator tests.
 *
 * Writes a miniature estate (ports.env + pitchfork.d + mise.toml) into a
 * temporary directory so the generator and the drift check can be exercised
 * without touching the real estate.
 */

import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

export interface EstateFixture {
  readonly root: string
  readonly portsEnv: string
  readonly pitchforkDir: string
  readonly miseToml: string
  writePortsEnv(source: string): void
  writePitchfork(name: string, source: string): void
  writeMise(source: string): void
  cleanup(): void
}

export const FIXTURE_PORTS_ENV = `# fixture ports
HERD_PORT=25100
KAPPA_ACP_PORT=25159
KIMI_CODE_PORT=25126
`

export const FIXTURE_PITCHFORK = `[daemons.kappa-acp]
run = "exec /home/toxic/estate/bin/kappa-serve.sh"
dir = "/home/toxic/estate"
ready_http = "http://127.0.0.1:25159/"

[daemons.kimi-code]
port = 25126
run = "exec kimi web --no-open --port 25126"
dir = "/home/toxic/kimi-code-npm"
ready_http = "http://127.0.0.1:25126/health"
health_http = { url = "http://127.0.0.1:25126/health", interval = "30s", timeout = "5s", retries = 3 }
`

export const FIXTURE_MISE = `[env]
_.file = ["config/ports.env"]

[tasks.kimi-build]
run = "bun run build"
description = "build kimi"
`

export function createEstateFixture(): EstateFixture {
  const root = mkdtempSync(join(tmpdir(), 'surface-registry-fixture-'))
  const portsEnv = join(root, 'config/ports.env')
  const pitchforkDir = join(root, 'pitchfork.d')
  const miseToml = join(root, 'mise.toml')

  mkdirSync(join(root, 'config'), { recursive: true })
  mkdirSync(pitchforkDir, { recursive: true })

  const write = (path: string, source: string) =>
    writeFileSync(path, source, 'utf8')
  write(portsEnv, FIXTURE_PORTS_ENV)
  write(join(pitchforkDir, 'agent-chat.toml'), FIXTURE_PITCHFORK)
  write(miseToml, FIXTURE_MISE)

  return {
    root,
    portsEnv,
    pitchforkDir,
    miseToml,
    writePortsEnv(source: string) {
      write(portsEnv, source)
    },
    writePitchfork(name: string, source: string) {
      write(join(pitchforkDir, name), source)
    },
    writeMise(source: string) {
      write(miseToml, source)
    },
    cleanup() {
      rmSync(root, { recursive: true, force: true })
    },
  }
}
