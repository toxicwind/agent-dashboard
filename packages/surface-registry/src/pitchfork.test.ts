import { describe, expect, it } from 'vitest'
import {
  parsePitchforkDaemons,
  parsePitchforkManifests,
  portFromUrl,
} from './pitchfork.ts'

const KAPPA_ACP = `# kappa-serve daemon — connectable kappa server (ACP/attach) + gatehouse upstream.
# Port SSOT: config/ports.env KAPPA_ACP_PORT=25159.
[daemons.kappa-acp]
run = "exec /home/toxic/estate/bin/kappa-serve.sh"
dir = "/home/toxic/estate"
mise = false
retry = true
boot_start = true
ready_http = "http://127.0.0.1:25159/"
`

const KIMI_CODE = `[daemons.kimi-code]
port = 25126
run = "exec kimi web --no-open --port 25126" # literal: \${} not expanded in run lines
dir = "/home/toxic/kimi-code-npm"
mise = true
retry = true
ready_http = "http://127.0.0.1:25126/health"
health_http = { url = "http://127.0.0.1:25126/health", interval = "30s", timeout = "5s", retries = 3 }
depends = ["gatehouse"]
auto = ["start"]
env = { KIMI_CODE_PORT = "25126", DISPLAY = ":99" }
`

describe('pitchfork manifest parser', () => {
  it('extracts a daemon block with its run, dir and readiness URL', () => {
    const daemons = parsePitchforkDaemons(KAPPA_ACP)
    expect(daemons).toHaveLength(1)
    expect(daemons[0].id).toBe('kappa-acp')
    expect(daemons[0].run).toBe('exec /home/toxic/estate/bin/kappa-serve.sh')
    expect(daemons[0].dir).toBe('/home/toxic/estate')
    expect(daemons[0].readyHttp).toBe('http://127.0.0.1:25159/')
    expect(daemons[0].mise).toBe(false)
    expect(daemons[0].retry).toBe(true)
  })

  it('reads the port, health table, deps and env of a daemon', () => {
    const daemons = parsePitchforkDaemons(KIMI_CODE)
    expect(daemons).toHaveLength(1)
    expect(daemons[0].port).toBe(25126)
    expect(daemons[0].healthHttp).toEqual({
      url: 'http://127.0.0.1:25126/health',
      interval: '30s',
      timeout: '5s',
      retries: 3,
    })
    expect(daemons[0].depends).toEqual(['gatehouse'])
    expect(daemons[0].auto).toEqual(['start'])
    expect(daemons[0].env).toEqual({ KIMI_CODE_PORT: '25126', DISPLAY: ':99' })
  })

  it('drops a trailing comment from a run line', () => {
    const daemons = parsePitchforkDaemons(KIMI_CODE)
    expect(daemons[0].run).toBe('exec kimi web --no-open --port 25126')
  })

  it('returns nothing for a manifest without daemons', () => {
    expect(parsePitchforkDaemons('[tasks.x]\nrun = "y"\n')).toEqual([])
    expect(parsePitchforkDaemons('')).toEqual([])
  })

  it('merges fragments and sorts by daemon id', () => {
    const daemons = parsePitchforkManifests([
      { file: 'b.toml', source: KIMI_CODE },
      { file: 'a.toml', source: KAPPA_ACP },
    ])
    expect(daemons.map((daemon) => daemon.id)).toEqual([
      'kappa-acp',
      'kimi-code',
    ])
  })

  it('merges a later fragment onto an earlier partial definition', () => {
    const daemons = parsePitchforkManifests([
      { file: 'a.toml', source: '[daemons.kimi-code]\nrun = "exec kimi"\n' },
      { file: 'b.toml', source: '[daemons.kimi-code]\nport = 25126\n' },
    ])
    expect(daemons).toHaveLength(1)
    expect(daemons[0].run).toBe('exec kimi')
    expect(daemons[0].port).toBe(25126)
  })
})

describe('portFromUrl', () => {
  it('reads the port out of a URL', () => {
    expect(portFromUrl('http://127.0.0.1:25159/')).toBe(25159)
    expect(portFromUrl('https://my.tau.sh/')).toBeNull()
    expect(portFromUrl(null)).toBeNull()
  })
})
