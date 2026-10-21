import { readdir, readFile } from 'node:fs/promises'
import { dirname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const HERE = dirname(fileURLToPath(import.meta.url))
const SRC = join(HERE)

async function collect(dir: string, out: string[] = []): Promise<string[]> {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) {
      // The generated manifest is the one place where ports are allowed, and
      // the test fixture is a fake estate that has to spell out its ports.
      if (entry.name === 'generated' || entry.name === 'testing') continue
      await collect(path, out)
      continue
    }
    if (!entry.name.endsWith('.ts')) continue
    if (entry.name.endsWith('.test.ts')) continue
    out.push(path)
  }
  return out
}

describe('the registry rules never hardcode a port', () => {
  it('names ssot keys and daemon ids, never numbers', async () => {
    const files = await collect(SRC)
    expect(files.length).toBeGreaterThan(0)
    const offenders: string[] = []
    for (const file of files) {
      const text = await readFile(file, 'utf8')
      const patterns = [
        /(?:127\.0\.0\.1|localhost|0\.0\.0\.0|\[::1\]):\d{2,5}\b/,
        /https?:\/\/[^\s'"`]*:\d{2,5}\b/,
      ]
      for (const pattern of patterns) {
        const match = pattern.exec(text)
        if (match) offenders.push(`${relative(SRC, file)}: ${match[0]}`)
      }
    }
    expect(offenders).toEqual([])
  })
})
