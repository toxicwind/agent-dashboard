import { describe, expect, it } from 'vitest'
import {
  composeManifest,
  daemonKeyStem,
  daemonPort,
  daemonPortKey,
  manifestToJson,
  miseTaskForPort,
  relayOriginToWebOrigin,
} from './compose.ts'
import { parseMise } from './mise.ts'
import { parsePitchforkDaemons } from './pitchfork.ts'
import { parsePortsEnv } from './ports-env.ts'
import { createEstateFixture } from './testing/estate-fixture.ts'
import { AGENT_SURFACE_RULES } from './rules.ts'

const FIXTURE_SOURCES = {
  portsEnv: '/estate/config/ports.env',
  pitchforkDir: '/estate/pitchfork.d',
  pitchforkToml: null,
  miseToml: '/estate/mise.toml',
  miseConfDir: null,
}

function composeFixture(tauRelayUrl: string | null = 'wss://my.tau.sh') {
  const fixture = createEstateFixture()
  const ports = parsePortsEnv(
    'HERD_PORT=25100\nKAPPA_ACP_PORT=25159\nKIMI_CODE_PORT=25126\n'
  )
  const daemons = parsePitchforkDaemons(
    '[daemons.kappa-acp]\nready_http = "http://127.0.0.1:25159/"\n\n[daemons.kimi-code]\nport = 25126\n'
  )
  const mise = parseMise('[tasks.kimi-build]\nrun = "bun run build"\n')
  const manifest = composeManifest({
    sources: FIXTURE_SOURCES,
    ports,
    daemons,
    mise,
    tauRelayUrl,
  })
  fixture.cleanup()
  return manifest
}

describe('surface composition', () => {
  it('publishes every rule, sorted by agent', () => {
    const manifest = composeFixture()
    const agents = manifest.surfaces.map((surface) => surface.agent)
    expect([...agents].sort()).toEqual(agents)
    expect(agents.length).toBe(AGENT_SURFACE_RULES.length)
    for (const agent of ['tau', 'kappa', 'kimi']) {
      expect(agents.filter((entry) => entry === agent).length).toBeGreaterThan(
        0
      )
    }
  })

  it('publishes a surface without a base url when its port key is missing from the SSOT', () => {
    const manifest = composeFixture()
    const squawk = manifest.surfaces.find(
      (surface) => surface.agent === 'squawk'
    )
    expect(squawk).toBeDefined()
    expect(squawk?.port).toBeNull()
    expect(squawk?.baseUrl).toBeNull()
  })

  it('takes a port-backed surface port from the ports.env SSOT', () => {
    const manifest = composeFixture()
    const kappa = manifest.surfaces.find((surface) => surface.agent === 'kappa')
    expect(kappa?.portKey).toBe('KAPPA_ACP_PORT')
    expect(kappa?.port).toBe(25159)
    expect(kappa?.baseUrl).toBe('http://127.0.0.1:25159')
  })

  it('derives the tau base URL from the collab relay origin', () => {
    const manifest = composeFixture()
    const tau = manifest.surfaces.find((surface) => surface.agent === 'tau')
    expect(tau?.baseUrl).toBe('https://my.tau.sh')
    expect(tau?.port).toBeNull()
  })

  it('publishes only the ports the surfaces depend on', () => {
    const manifest = composeFixture()
    expect(Object.keys(manifest.ports)).toEqual([
      'KAPPA_ACP_PORT',
      'KIMI_CODE_PORT',
    ])
  })

  it('publishes only the daemons the surfaces depend on', () => {
    const manifest = composeFixture()
    expect(manifest.daemons.map((daemon) => daemon.id)).toEqual([
      'kappa-acp',
      'kimi-code',
    ])
  })

  it('never publishes a secret-looking env value', () => {
    const daemons = parsePitchforkDaemons(
      '[daemons.kappa-acp]\nport = 25159\nenv = { PORT = "25159", TOKEN = "super-secret", PASSWORD = "hunter2" }\n'
    )
    const manifest = composeManifest({
      sources: FIXTURE_SOURCES,
      ports: { KAPPA_ACP_PORT: 25159 },
      daemons,
      mise: parseMise(''),
      tauRelayUrl: null,
    })
    const daemon = manifest.daemons.find(
      (candidate) => candidate.id === 'kappa-acp'
    )
    expect(daemon?.envPorts).toEqual({ PORT: 25159 })
    expect(daemon?.omittedEnvKeys).toEqual(['PASSWORD', 'TOKEN'])
    expect(manifestToJson(manifest)).not.toContain('hunter2')
    expect(manifestToJson(manifest)).not.toContain('super-secret')
  })

  it('resolves the owner repo against the estate root', () => {
    const manifest = composeFixture()
    const kappa = manifest.surfaces.find((surface) => surface.agent === 'kappa')
    expect(kappa?.ownerRepo).toBe('/estate/ranch/kappa/kappa-code')
  })

  it('is deterministic: the same inputs produce byte-identical JSON', () => {
    const first = manifestToJson(composeFixture())
    const second = manifestToJson(composeFixture())
    expect(first).toBe(second)
  })

  it('carries no timestamp, so repeated derivations stay byte-identical', () => {
    const json = manifestToJson(composeFixture())
    expect(json).not.toMatch(/\d{4}-\d{2}-\d{2}T/)
  })
})

describe('composition helpers', () => {
  it('normalises a daemon id into a ports.env key stem', () => {
    expect(daemonKeyStem('kappa-acp')).toBe('KAPPA_ACP')
    expect(daemonKeyStem('kimi-code')).toBe('KIMI_CODE')
  })

  it('reads a daemon port from the port key, then the readiness URL', () => {
    const withPort = parsePitchforkDaemons('[daemons.a]\nport = 1\n')
    const withUrl = parsePitchforkDaemons(
      '[daemons.b]\nready_http = "http://127.0.0.1:2/"\n'
    )
    const withHealth = parsePitchforkDaemons(
      '[daemons.c]\nhealth_http = { url = "http://127.0.0.1:3/health" }\n'
    )
    expect(daemonPort(withPort[0])).toBe(1)
    expect(daemonPort(withUrl[0])).toBe(2)
    expect(daemonPort(withHealth[0])).toBe(3)
  })

  it('maps a daemon to the ports.env key that owns its port', () => {
    const daemons = parsePitchforkDaemons(
      '[daemons.kappa-acp]\nready_http = "http://127.0.0.1:25159/"\n'
    )
    expect(daemonPortKey(daemons[0], { KAPPA_ACP_PORT: 25159 })).toBe(
      'KAPPA_ACP_PORT'
    )
    expect(daemonPortKey(daemons[0], { OTHER_PORT: 25159 })).toBe('OTHER_PORT')
    expect(daemonPortKey(daemons[0], {})).toBeNull()
  })

  it('maps a wss relay origin onto the https origin that serves the SPA', () => {
    expect(relayOriginToWebOrigin('wss://my.tau.sh')).toBe('https://my.tau.sh')
    expect(relayOriginToWebOrigin('ws://127.0.0.1:9224')).toBe(
      'http://127.0.0.1:9224'
    )
    expect(relayOriginToWebOrigin(null)).toBeNull()
  })

  it('finds the mise task that references a port', () => {
    const mise = parseMise('[tasks.serve]\nrun = "exec thing -p 25159"\n')
    expect(miseTaskForPort(mise, 25159)).toBe('serve')
    expect(miseTaskForPort(mise, 99999)).toBeNull()
  })
})

describe('agent surface rules', () => {
  it('names SSOT keys, never port numbers', () => {
    for (const rule of AGENT_SURFACE_RULES) {
      if (rule.portKey === null) continue
      expect(rule.portKey).toMatch(/^[A-Z0-9_]+_PORT$/)
    }
  })

  it('covers tau, kappa and kimi', () => {
    const ids = AGENT_SURFACE_RULES.map((rule) => rule.id)
    expect(new Set(ids).size).toBe(ids.length)
    for (const agent of ['tau', 'kappa', 'kimi']) {
      expect(AGENT_SURFACE_RULES.some((rule) => rule.agent === agent)).toBe(
        true
      )
    }
  })
})
