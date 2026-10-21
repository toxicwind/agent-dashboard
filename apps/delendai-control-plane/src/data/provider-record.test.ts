import { describe, expect, it } from 'vitest'
import {
  PROVIDER_STATUS_FIXTURES,
  anyOverQuota,
  deriveSummary,
  dominantMeter,
  meterOverload,
  stateTone,
  usedPct,
} from '@/data/provider-record'
import type { IProviderStatusRow } from '@/types'

describe('provider-record / quota render-model', () => {
  it('computes usedPct as used/limit whole percent', () => {
    expect(usedPct(412, 1000)).toBe(41)
    expect(usedPct(63, 50)).toBe(126) // exceeds 100
    expect(usedPct(null, 50)).toBeNull()
    expect(usedPct(10, 0)).toBeNull()
    expect(usedPct(10, null)).toBeNull()
  })

  it('marks meters over 100 as overloaded (quota-exceeded)', () => {
    expect(meterOverload(126)).toBe(true)
    expect(meterOverload(100)).toBe(false)
    expect(meterOverload(null)).toBe(false)
  })

  it('picks the dominant (highest over-100) meter for a row', () => {
    const row: IProviderStatusRow = {
      id: 'x',
      state: 'quota-exceeded',
      reachable: false,
      modelId: 'x',
      modelAvailable: true,
      cliInstalled: true,
      cliVersion: '0.44.0',
      authenticated: true,
      authTier: 'plus',
      installHint: null,
      quota: [
        { window: 'hourly', limit: 50, used: 63, resetAt: null, usedPct: 126 },
        {
          window: 'monthly',
          limit: 20000,
          used: 9200,
          resetAt: null,
          usedPct: 46,
        },
      ],
    }
    expect(dominantMeter(row)?.usedPct).toBe(126)
  })

  it('prefers a sub-100 meter when no meter exceeds 100', () => {
    const row: IProviderStatusRow = {
      id: 'y',
      state: 'available',
      reachable: true,
      modelId: 'y',
      modelAvailable: true,
      cliInstalled: true,
      cliVersion: '2.1.0',
      authenticated: true,
      authTier: 'max',
      installHint: null,
      quota: [
        {
          window: 'weekly',
          limit: 1000,
          used: 412,
          resetAt: null,
          usedPct: 41,
        },
        {
          window: 'monthly',
          limit: 5000,
          used: 900,
          resetAt: null,
          usedPct: 18,
        },
      ],
    }
    expect(dominantMeter(row)?.usedPct).toBe(41)
  })

  it('returns null dominant meter when a row has no quota', () => {
    const row: IProviderStatusRow = {
      id: 'z',
      state: 'not-installed',
      reachable: false,
      modelId: 'z',
      modelAvailable: null,
      cliInstalled: false,
      cliVersion: null,
      authenticated: null,
      authTier: null,
      installHint: null,
      quota: [],
    }
    expect(dominantMeter(row)).toBeNull()
  })

  it('derives summary from rows reachability', () => {
    const s = deriveSummary(PROVIDER_STATUS_FIXTURES.rows)
    expect(s.total).toBe(4)
    expect(s.available).toBe(2)
    expect(s.unavailable).toBe(2)
  })

  it('detects any over-quota provider in the showcase', () => {
    expect(anyOverQuota(PROVIDER_STATUS_FIXTURES)).toBe(true)
  })

  it('maps provider states to dashboard signal tones', () => {
    expect(stateTone('available')).toBe('ok')
    expect(stateTone('rate-limited')).toBe('warn')
    expect(stateTone('quota-exceeded')).toBe('danger')
    expect(stateTone('error')).toBe('danger')
    expect(stateTone('not-installed')).toBe('muted')
  })

  it('showcase fixture is a ready model with a quota summary', () => {
    expect(PROVIDER_STATUS_FIXTURES.kind).toBe('ready')
    expect(PROVIDER_STATUS_FIXTURES.quota.present).toBe(true)
  })
})
