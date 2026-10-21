import { describe, expect, it } from 'vitest'
import {
  parsePortsEnv,
  parsePortsEnvEntries,
  parsePortsEnvValues,
  portsEnvKeys,
  stripPortsEnvComment,
} from './ports-env.ts'

const SAMPLE = `# Estate Stack - Port SSOT (ALL 25xxx, no hardcodes)
# ─────────────────────────────────────────────────────
HERD_PORT=25100
KAPPA_ACP_PORT=25159  # kappa ACP server
KIMI_CODE_PORT=25126
# owner: kimi-code (vendors/kimi-code)
TAU_CHUTE_PORT=25111
AGENT_DISPLAY_PORT=5900
RUSTDESK_HBBS_NAT_PORT=25220
VALUE_NOT_A_PORT=not-a-number
EMPTY_VALUE=
BAD LINE WITHOUT EQUALS
lower_case=1234
`

describe('ports-env parser', () => {
  it('reads every KEY=VALUE line and skips comments', () => {
    const entries = parsePortsEnvEntries(SAMPLE)
    const keys = entries.map((entry) => entry.key)
    expect(keys).toEqual([
      'HERD_PORT',
      'KAPPA_ACP_PORT',
      'KIMI_CODE_PORT',
      'TAU_CHUTE_PORT',
      'AGENT_DISPLAY_PORT',
      'RUSTDESK_HBBS_NAT_PORT',
      'VALUE_NOT_A_PORT',
      'EMPTY_VALUE',
      'lower_case',
    ])
  })

  it('drops a trailing comment from a value', () => {
    const ports = parsePortsEnv(SAMPLE)
    expect(ports.KAPPA_ACP_PORT).toBe(25159)
    expect(ports.KIMI_CODE_PORT).toBe(25126)
  })

  it('keeps only integer values as ports', () => {
    const ports = parsePortsEnv(SAMPLE)
    expect(ports.VALUE_NOT_A_PORT).toBeUndefined()
    expect(ports.EMPTY_VALUE).toBeUndefined()
    expect(ports.AGENT_DISPLAY_PORT).toBe(5900)
  })

  it('never invents a port for a non-numeric value', () => {
    const entries = parsePortsEnvEntries(SAMPLE)
    const notAPort = entries.find((entry) => entry.key === 'VALUE_NOT_A_PORT')
    expect(notAPort?.port).toBeNull()
    expect(notAPort?.value).toBe('not-a-number')
  })

  it('reports the 1-based line number of every entry', () => {
    const entries = parsePortsEnvEntries(SAMPLE)
    const herd = entries.find((entry) => entry.key === 'HERD_PORT')
    expect(herd?.line).toBe(3)
  })

  it('keeps string values for non-numeric entries', () => {
    const values = parsePortsEnvValues(SAMPLE)
    expect(values.VALUE_NOT_A_PORT).toBe('not-a-number')
    expect(values.EMPTY_VALUE).toBe('')
  })

  it('lists the port keys sorted', () => {
    expect(portsEnvKeys(SAMPLE)).toEqual([
      'AGENT_DISPLAY_PORT',
      'HERD_PORT',
      'KAPPA_ACP_PORT',
      'KIMI_CODE_PORT',
      'RUSTDESK_HBBS_NAT_PORT',
      'TAU_CHUTE_PORT',
      'lower_case',
    ])
  })

  it('returns an empty map for an empty file', () => {
    expect(parsePortsEnv('')).toEqual({})
    expect(parsePortsEnvEntries('')).toEqual([])
  })

  it('ignores a line without an equals sign', () => {
    expect(parsePortsEnvEntries('JUST_A_LINE\n')).toEqual([])
  })
})

describe('ports-env comment stripping', () => {
  it('removes a comment that starts the line', () => {
    expect(stripPortsEnvComment('# owner: kimi-code').trim()).toBe('')
  })

  it('removes a comment that follows whitespace', () => {
    expect(stripPortsEnvComment('KAPPA_ACP_PORT=25159  # kappa').trim()).toBe(
      'KAPPA_ACP_PORT=25159'
    )
  })

  it('keeps a hash that is part of a value', () => {
    expect(stripPortsEnvComment('URL=http://x/y#frag').trim()).toBe(
      'URL=http://x/y#frag'
    )
  })

  it('keeps a hash inside a quoted value', () => {
    expect(stripPortsEnvComment('URL="http://x/y#frag" # note').trim()).toBe(
      'URL="http://x/y#frag"'
    )
  })
})
