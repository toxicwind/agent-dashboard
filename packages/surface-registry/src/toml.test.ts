import { describe, expect, it } from 'vitest'
import { parseToml, TomlParseError } from './toml.ts'

describe('toml subset parser', () => {
  it('parses a table header with dotted keys', () => {
    const doc = parseToml('[daemons.kappa-acp]\nrun = "exec serve"\n')
    expect(doc).toEqual({ daemons: { 'kappa-acp': { run: 'exec serve' } } })
  })

  it('parses integers, floats and booleans', () => {
    const doc = parseToml('a = 1\nb = 2.5\nc = true\nd = false\n')
    expect(doc.a).toBe(1)
    expect(doc.b).toBe(2.5)
    expect(doc.c).toBe(true)
    expect(doc.d).toBe(false)
  })

  it('parses single-line arrays', () => {
    const doc = parseToml('auto = ["start"]\ndepends = ["gatehouse", "herd"]\n')
    expect(doc.auto).toEqual(['start'])
    expect(doc.depends).toEqual(['gatehouse', 'herd'])
  })

  it('parses multi-line arrays', () => {
    const doc = parseToml('depends = [\n  "gatehouse",\n  "herd",\n]\n')
    expect(doc.depends).toEqual(['gatehouse', 'herd'])
  })

  it('parses inline tables', () => {
    const doc = parseToml(
      'health_http = { url = "http://127.0.0.1:25126/health", interval = "30s", retries = 3 }\n'
    )
    expect(doc.health_http).toEqual({
      url: 'http://127.0.0.1:25126/health',
      interval: '30s',
      retries: 3,
    })
  })

  it('parses inline tables with quoted values', () => {
    const doc = parseToml('env = { AWR_MCP_PORT = "25198", HOST = "a.b" }\n')
    expect(doc.env).toEqual({ AWR_MCP_PORT: '25198', HOST: 'a.b' })
  })

  it('strips line and trailing comments', () => {
    const doc = parseToml('# leading\nport = 25126 # trailing\n')
    expect(doc.port).toBe(25126)
  })

  it('keeps a hash inside a string', () => {
    const doc = parseToml('run = "exec a # b"\n')
    expect(doc.run).toBe('exec a # b')
  })

  it('parses literal strings without escapes', () => {
    const doc = parseToml("run = 'C:\\path\\to\\thing'\n")
    expect(doc.run).toBe('C:\\path\\to\\thing')
  })

  it('parses basic-string escapes', () => {
    const doc = parseToml('run = "a\\tb\\nc"\n')
    expect(doc.run).toBe('a\tb\nc')
  })

  it('parses dotted keys into nested tables', () => {
    const doc = parseToml('health_http.url = "http://x/health"\n')
    expect(doc.health_http).toEqual({ url: 'http://x/health' })
  })

  it('parses quoted table names', () => {
    const doc = parseToml('[tasks."open-uis"]\nrun = "bun x"\n')
    expect(doc.tasks).toEqual({ 'open-uis': { run: 'bun x' } })
  })

  it('parses array-of-tables headers', () => {
    const doc = parseToml('[[items]]\nid = "a"\n\n[[items]]\nid = "b"\n')
    expect(doc.items).toEqual([{ id: 'a' }, { id: 'b' }])
  })

  it('throws with a line number on a malformed value', () => {
    expect(() => parseToml('a = [1, 2\n')).toThrow(TomlParseError)
    try {
      parseToml('a = 1\nb = [1, 2\n')
    } catch (error) {
      expect((error as TomlParseError).line).toBeGreaterThan(1)
    }
  })

  it('throws on an unterminated string', () => {
    expect(() => parseToml('a = "open\n')).toThrow(TomlParseError)
  })

  it('returns an empty document for empty input', () => {
    expect(parseToml('')).toEqual({})
    expect(parseToml('\n\n# only comments\n')).toEqual({})
  })
})
