import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { checkDrift } from './drift.ts'
import { generate } from './generate.ts'
import {
  createEstateFixture,
  type EstateFixture,
} from './testing/estate-fixture.ts'

let fixture: EstateFixture | null = null
let outDir: string | null = null

function makeOutDir(): string {
  return mkdtempSync(join(tmpdir(), 'surface-registry-out-'))
}

afterEach(() => {
  fixture?.cleanup()
  fixture = null
  if (outDir) rmSync(outDir, { recursive: true, force: true })
  outDir = null
})

describe('generator', () => {
  it('writes the manifest artifacts', () => {
    fixture = createEstateFixture()
    outDir = makeOutDir()
    const result = generate({ estateRoot: fixture.root, outDir })
    expect(result.changed).toBe(true)
    expect(readFileSync(result.jsonPath, 'utf8')).toContain('"version": 1')
    expect(readFileSync(result.tsPath, 'utf8')).toContain(
      'export const SURFACE_MANIFEST'
    )
  })

  it('is deterministic: a second run changes nothing and writes the same bytes', () => {
    fixture = createEstateFixture()
    outDir = makeOutDir()
    const first = generate({ estateRoot: fixture.root, outDir })
    const second = generate({ estateRoot: fixture.root, outDir })
    expect(second.changed).toBe(false)
    expect(second.json).toBe(first.json)
    expect(second.ts).toBe(first.ts)
  })

  it('composes the surface ports from the estate SSOT', () => {
    fixture = createEstateFixture()
    outDir = makeOutDir()
    const result = generate({ estateRoot: fixture.root, outDir })
    const manifest = JSON.parse(readFileSync(result.jsonPath, 'utf8'))
    const kappa = manifest.surfaces.find(
      (surface: { agent: string }) => surface.agent === 'kappa'
    )
    expect(kappa.port).toBe(25159)
    expect(kappa.baseUrl).toBe('http://127.0.0.1:25159')
  })
})

describe('drift check', () => {
  it('passes when the committed artifact matches the estate', () => {
    fixture = createEstateFixture()
    outDir = makeOutDir()
    generate({ estateRoot: fixture.root, outDir })
    const result = checkDrift({ estateRoot: fixture.root, outDir })
    expect(result.ok).toBe(true)
    expect(result.drifted).toEqual([])
  })

  it('fails when the estate moved a port', () => {
    fixture = createEstateFixture()
    outDir = makeOutDir()
    generate({ estateRoot: fixture.root, outDir })
    fixture.writePortsEnv('KAPPA_ACP_PORT=25199\nKIMI_CODE_PORT=25126\n')
    const result = checkDrift({ estateRoot: fixture.root, outDir })
    expect(result.ok).toBe(false)
    expect(result.drifted.length).toBeGreaterThan(0)
    expect(result.detail).toContain('stale')
  })

  it('fails when the committed artifact is missing', () => {
    fixture = createEstateFixture()
    outDir = makeOutDir()
    const result = checkDrift({ estateRoot: fixture.root, outDir })
    expect(result.ok).toBe(false)
    expect(result.drifted).toHaveLength(2)
  })

  it('passes again after regenerating', () => {
    fixture = createEstateFixture()
    outDir = makeOutDir()
    generate({ estateRoot: fixture.root, outDir })
    fixture.writePortsEnv('KAPPA_ACP_PORT=25199\nKIMI_CODE_PORT=25126\n')
    expect(checkDrift({ estateRoot: fixture.root, outDir }).ok).toBe(false)
    generate({ estateRoot: fixture.root, outDir })
    expect(checkDrift({ estateRoot: fixture.root, outDir }).ok).toBe(true)
  })

  it('does not trip on an estate change no chat surface depends on', () => {
    fixture = createEstateFixture()
    outDir = makeOutDir()
    generate({ estateRoot: fixture.root, outDir })
    fixture.writePortsEnv(
      'KAPPA_ACP_PORT=25159\nKIMI_CODE_PORT=25126\nUNRELATED_PORT=25999\n'
    )
    expect(checkDrift({ estateRoot: fixture.root, outDir }).ok).toBe(true)
  })
})
