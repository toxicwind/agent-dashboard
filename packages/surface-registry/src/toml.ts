/**
 * toml — a focused TOML subset parser.
 *
 * The estate has no TOML parser dependency (checked: no `smol-toml`, no
 * `@iarna/toml`, no `toml` package anywhere in the workspace), and the
 * pitchfork.d fragments only use a tiny slice of TOML. This parser covers
 * exactly that slice, plus enough of the rest to fail loudly rather than
 * silently mis-read a file:
 *
 *   - `#` comments (line and trailing, outside strings);
 *   - `[table]` and `[a.b.c]` headers, `[a.b."quoted key"]` too;
 *   - `[[array.of.tables]]` headers;
 *   - bare, quoted and dotted keys;
 *   - basic strings (`"…"` with escapes), literal strings (`'…'`);
 *   - integers, floats, booleans;
 *   - arrays (single-line and multi-line);
 *   - inline tables (`{ a = 1, b = "x" }`).
 *
 * Anything outside the subset raises `TomlParseError` with a line number —
 * a silent mis-parse would be worse than a loud failure, because the whole
 * point of the registry is that a stale port can never reach the dashboard.
 */

export type TomlValue = string | number | boolean | TomlValue[] | TomlTable

export interface TomlTable {
  [key: string]: TomlValue
}

/** A parsed TOML document — a plain nested table. */
export type TomlDocument = TomlTable

export class TomlParseError extends Error {
  readonly line: number
  readonly column: number

  constructor(message: string, line: number, column: number) {
    super(`${message} (line ${line}, column ${column})`)
    this.name = 'TomlParseError'
    this.line = line
    this.column = column
  }
}

const BARE_KEY_RE = /^[A-Za-z0-9_-]+$/

class Scanner {
  readonly src: string
  pos = 0
  line = 1
  column = 1

  constructor(src: string) {
    this.src = src
  }

  get eof(): boolean {
    return this.pos >= this.src.length
  }

  peek(offset = 0): string {
    return this.src[this.pos + offset] ?? ''
  }

  next(): string {
    const ch = this.src[this.pos] ?? ''
    this.pos += 1
    if (ch === '\n') {
      this.line += 1
      this.column = 1
    } else {
      this.column += 1
    }
    return ch
  }

  fail(message: string): never {
    throw new TomlParseError(message, this.line, this.column)
  }

  skipWhitespace(): void {
    while (!this.eof) {
      const ch = this.peek()
      if (ch === ' ' || ch === '\t' || ch === '\r') {
        this.next()
        continue
      }
      if (ch === '\n') {
        this.next()
        continue
      }
      if (ch === '#') {
        while (!this.eof && this.peek() !== '\n') this.next()
        continue
      }
      return
    }
  }

  expect(ch: string): void {
    if (this.peek() !== ch) this.fail(`expected ${JSON.stringify(ch)}`)
    this.next()
  }
}

function isBareKeyChar(ch: string): boolean {
  return /[A-Za-z0-9_-]/.test(ch)
}

function parseKeyPart(scanner: Scanner): string {
  const ch = scanner.peek()
  if (ch === '"' || ch === "'") return parseQuotedString(scanner)
  let raw = ''
  while (!scanner.eof && isBareKeyChar(scanner.peek())) {
    raw += scanner.next()
  }
  if (!raw) scanner.fail('expected a key')
  if (!BARE_KEY_RE.test(raw))
    scanner.fail(`invalid bare key ${JSON.stringify(raw)}`)
  return raw
}

function parseKeyPath(scanner: Scanner): string[] {
  const parts: string[] = [parseKeyPart(scanner)]
  for (;;) {
    scanner.skipWhitespace()
    if (scanner.peek() !== '.') return parts
    scanner.next()
    scanner.skipWhitespace()
    parts.push(parseKeyPart(scanner))
  }
}

function parseQuotedString(scanner: Scanner): string {
  const quote = scanner.next()
  let out = ''
  for (;;) {
    if (scanner.eof) scanner.fail('unterminated string')
    const ch = scanner.next()
    if (ch === quote) return out
    if (quote === '"' && ch === '\\') {
      const esc = scanner.next()
      switch (esc) {
        case 'n':
          out += '\n'
          break
        case 't':
          out += '\t'
          break
        case 'r':
          out += '\r'
          break
        case '"':
          out += '"'
          break
        case '\\':
          out += '\\'
          break
        case 'b':
          out += '\b'
          break
        case 'f':
          out += '\f'
          break
        case 'u': {
          const hex = scanner.src.slice(scanner.pos, scanner.pos + 4)
          if (!/^[0-9a-fA-F]{4}$/.test(hex)) scanner.fail('invalid \\u escape')
          for (let i = 0; i < 4; i += 1) scanner.next()
          out += String.fromCharCode(parseInt(hex, 16))
          break
        }
        case 'U': {
          const hex = scanner.src.slice(scanner.pos, scanner.pos + 8)
          if (!/^[0-9a-fA-F]{8}$/.test(hex)) scanner.fail('invalid \\U escape')
          for (let i = 0; i < 8; i += 1) scanner.next()
          out += String.fromCodePoint(parseInt(hex, 16))
          break
        }
        default:
          scanner.fail(`unsupported escape \\${esc}`)
      }
      continue
    }
    out += ch
  }
}

function parseMultilineBasicString(scanner: Scanner): string {
  // `"""…"""` — the first newline immediately after the opening delimiter is
  // trimmed, per the TOML spec.
  scanner.expect('"')
  scanner.expect('"')
  scanner.expect('"')
  if (scanner.peek() === '\n') scanner.next()
  let out = ''
  for (;;) {
    if (scanner.eof) scanner.fail('unterminated multi-line string')
    if (
      scanner.peek() === '"' &&
      scanner.peek(1) === '"' &&
      scanner.peek(2) === '"'
    ) {
      scanner.next()
      scanner.next()
      scanner.next()
      return out
    }
    out += scanner.next()
  }
}

function parseMultilineLiteralString(scanner: Scanner): string {
  scanner.expect("'")
  scanner.expect("'")
  scanner.expect("'")
  if (scanner.peek() === '\n') scanner.next()
  let out = ''
  for (;;) {
    if (scanner.eof) scanner.fail('unterminated multi-line literal string')
    if (
      scanner.peek() === "'" &&
      scanner.peek(1) === "'" &&
      scanner.peek(2) === "'"
    ) {
      scanner.next()
      scanner.next()
      scanner.next()
      return out
    }
    out += scanner.next()
  }
}

function parseNumber(scanner: Scanner): number {
  let raw = ''
  while (!scanner.eof && /[0-9a-fA-FxXoObB_+.\-eE]/.test(scanner.peek())) {
    raw += scanner.next()
  }
  const cleaned = raw.replace(/_/g, '')
  if (!cleaned) scanner.fail('expected a number')
  const value = Number(cleaned)
  if (!Number.isFinite(value))
    scanner.fail(`invalid number ${JSON.stringify(raw)}`)
  return value
}

function parseArray(scanner: Scanner): TomlValue[] {
  scanner.expect('[')
  const items: TomlValue[] = []
  for (;;) {
    scanner.skipWhitespace()
    if (scanner.eof) scanner.fail('unterminated array')
    if (scanner.peek() === ']') {
      scanner.next()
      return items
    }
    items.push(parseValue(scanner))
    scanner.skipWhitespace()
    if (scanner.peek() === ',') {
      scanner.next()
      continue
    }
    if (scanner.peek() === ']') {
      scanner.next()
      return items
    }
    scanner.fail('expected "," or "]" in array')
  }
}

function parseInlineTable(scanner: Scanner): TomlTable {
  scanner.expect('{')
  const table: TomlTable = {}
  for (;;) {
    scanner.skipWhitespace()
    if (scanner.eof) scanner.fail('unterminated inline table')
    if (scanner.peek() === '}') {
      scanner.next()
      return table
    }
    const path = parseKeyPath(scanner)
    scanner.skipWhitespace()
    scanner.expect('=')
    scanner.skipWhitespace()
    const value = parseValue(scanner)
    assign(table, path, value)
    scanner.skipWhitespace()
    if (scanner.peek() === ',') {
      scanner.next()
      continue
    }
    if (scanner.peek() === '}') {
      scanner.next()
      return table
    }
    scanner.fail('expected "," or "}" in inline table')
  }
}

function parseValue(scanner: Scanner): TomlValue {
  const ch = scanner.peek()
  if (ch === '"') {
    if (scanner.peek(1) === '"' && scanner.peek(2) === '"')
      return parseMultilineBasicString(scanner)
    return parseQuotedString(scanner)
  }
  if (ch === "'") {
    if (scanner.peek(1) === "'" && scanner.peek(2) === "'")
      return parseMultilineLiteralString(scanner)
    return parseQuotedString(scanner)
  }
  if (ch === '[') return parseArray(scanner)
  if (ch === '{') return parseInlineTable(scanner)
  if (ch === 't' || ch === 'f') {
    let word = ''
    while (!scanner.eof && /[a-z]/.test(scanner.peek())) word += scanner.next()
    if (word === 'true') return true
    if (word === 'false') return false
    scanner.fail(`invalid value ${JSON.stringify(word)}`)
  }
  return parseNumber(scanner)
}

function ensureTable(root: TomlTable, path: string[]): TomlTable {
  let current = root
  for (const part of path) {
    const existing = current[part]
    if (existing === undefined) {
      const created: TomlTable = {}
      current[part] = created
      current = created
      continue
    }
    if (Array.isArray(existing)) {
      const last = existing[existing.length - 1]
      if (last && typeof last === 'object' && !Array.isArray(last)) {
        current = last as TomlTable
        continue
      }
      throw new TomlParseError(`cannot redefine ${part}`, 0, 0)
    }
    if (typeof existing !== 'object') {
      throw new TomlParseError(`cannot redefine ${part}`, 0, 0)
    }
    current = existing as TomlTable
  }
  return current
}

function assign(root: TomlTable, path: string[], value: TomlValue): void {
  const parent = ensureTable(root, path.slice(0, -1))
  parent[path[path.length - 1]] = value
}

/** Parse a TOML document into a plain nested object. */
export function parseToml(source: string): TomlTable {
  const scanner = new Scanner(source)
  const root: TomlTable = {}
  let current = root

  for (;;) {
    scanner.skipWhitespace()
    if (scanner.eof) return root

    if (scanner.peek() === '[') {
      scanner.next()
      const isArray = scanner.peek() === '['
      if (isArray) scanner.next()
      scanner.skipWhitespace()
      const path = parseKeyPath(scanner)
      scanner.skipWhitespace()
      scanner.expect(']')
      if (isArray) {
        scanner.expect(']')
        const parent = ensureTable(root, path.slice(0, -1))
        const key = path[path.length - 1]
        const list = Array.isArray(parent[key])
          ? (parent[key] as TomlValue[])
          : []
        const entry: TomlTable = {}
        list.push(entry)
        parent[key] = list
        current = entry
      } else {
        current = ensureTable(root, path)
      }
      continue
    }

    const path = parseKeyPath(scanner)
    scanner.skipWhitespace()
    scanner.expect('=')
    scanner.skipWhitespace()
    const value = parseValue(scanner)
    assign(current, path, value)
  }
}
