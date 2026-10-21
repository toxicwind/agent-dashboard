/**
 * ports-env — parser for the estate's numeric port SSOT
 * (`/home/toxic/estate/config/ports.env`).
 *
 * The file is a flat `KEY=VALUE` list:
 *
 *   - `#` at the start of a line is a comment line;
 *   - a trailing `# …` (preceded by whitespace) is a comment;
 *   - values are integers for real ports, but non-numeric values are kept as
 *     strings so the caller decides what to do with them.
 *
 * Nothing here knows a port number — the parser only reports what the file
 * says. The numbers live in exactly one place: the SSOT.
 */

export interface PortsEnvEntry {
  readonly key: string
  readonly value: string
  /** The value as a port number, or null when the value is not an integer. */
  readonly port: number | null
  /** 1-based line number in the source file. */
  readonly line: number
}

const KEY_RE = /^[A-Za-z_][A-Za-z0-9_]*$/

/**
 * Strip a trailing `# …` comment from a ports.env line.
 *
 * A `#` only starts a comment when it is at the start of the line or preceded
 * by whitespace, so a value that legitimately contains `#` (a URL fragment,
 * a colour) is never truncated. Quoted regions are skipped entirely.
 */
export function stripPortsEnvComment(line: string): string {
  let quote: string | null = null
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i]
    if (quote) {
      if (ch === quote) quote = null
      continue
    }
    if (ch === '"' || ch === "'") {
      quote = ch
      continue
    }
    if (ch === '#' && (i === 0 || /\s/.test(line[i - 1]))) {
      return line.slice(0, i)
    }
  }
  return line
}

/** Parse every `KEY=VALUE` line of a ports.env file, in file order. */
export function parsePortsEnvEntries(source: string): PortsEnvEntry[] {
  const entries: PortsEnvEntry[] = []
  const lines = source.split('\n')
  for (let i = 0; i < lines.length; i += 1) {
    const raw = lines[i]
    const line = stripPortsEnvComment(raw).trim()
    if (!line) continue
    if (line.startsWith('#')) continue
    const eq = line.indexOf('=')
    if (eq === -1) continue
    const key = line.slice(0, eq).trim()
    if (!KEY_RE.test(key)) continue
    const value = line.slice(eq + 1).trim()
    const asNumber = Number(value)
    const port = value !== '' && Number.isInteger(asNumber) ? asNumber : null
    entries.push({ key, value, port, line: i + 1 })
  }
  return entries
}

/** Every `KEY=VALUE` pair as strings (later keys win). */
export function parsePortsEnvValues(source: string): Record<string, string> {
  const values: Record<string, string> = {}
  for (const entry of parsePortsEnvEntries(source)) {
    values[entry.key] = entry.value
  }
  return values
}

/**
 * Every `KEY=VALUE` pair whose value is an integer, as numbers.
 * Non-numeric entries are skipped — a port map only holds ports.
 */
export function parsePortsEnv(source: string): Record<string, number> {
  const ports: Record<string, number> = {}
  for (const entry of parsePortsEnvEntries(source)) {
    if (entry.port !== null) ports[entry.key] = entry.port
  }
  return ports
}

/** Sorted list of the port keys declared in a ports.env file. */
export function portsEnvKeys(source: string): string[] {
  return Object.keys(parsePortsEnv(source)).sort()
}
