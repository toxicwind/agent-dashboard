import { describe, expect, it, vi } from 'vitest'
import {
  fetchChannels,
  fetchProviders,
  fetchRouterUsage,
  fetchServices,
} from '@/api/client'

const BASE = 'http://ctl.test'
const okJson = <T>(body: T, init?: ResponseInit) =>
  new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
    ...init,
  })

describe('api client — REAL data, no fixture fallbacks', () => {
  it('fetchServices returns the real daemon rows when present', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(okJson([{ name: 'estate/herd', status: 'up' }]))
    )
    const rows = await fetchServices(BASE)
    expect(rows).toEqual([{ name: 'estate/herd', status: 'up' }])
    vi.unstubAllGlobals()
  })

  it('fetchServices is an empty array (never fixtures) when the API fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('net')))
    const rows = await fetchServices(BASE)
    expect(rows).toEqual([])
    vi.unstubAllGlobals()
  })

  it('fetchProviders returns the real ready model when present', async () => {
    const model = {
      kind: 'ready',
      checkedAt: 'now',
      summary: { total: 46, available: 44, unavailable: 2 },
      emptyRoster: false,
      rows: [{ id: 'openai' }],
      quota: { present: false, updatedAt: null, note: null },
    }
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(okJson(model)))
    const got = await fetchProviders(BASE)
    expect(got).toEqual(model)
    vi.unstubAllGlobals()
  })

  it('fetchProviders returns a truthful empty roster when the API is down', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('net')))
    const got = await fetchProviders(BASE)
    expect(got?.emptyRoster).toBe(true)
    expect(got?.rows).toEqual([])
    expect(got?.quota.present).toBe(false)
    vi.unstubAllGlobals()
  })

  it('fetchChannels returns real channels; empty list when absent', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(okJson(['kappa_board'])))
    expect(await fetchChannels(BASE)).toEqual(['kappa_board'])
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('net')))
    expect(await fetchChannels(BASE)).toEqual([])
    vi.unstubAllGlobals()
  })

  it('fetchRouterUsage surfaces the truth: present false when no ledger exists', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          okJson({ present: false, rows: [], note: 'no real usage data' })
        )
    )
    const got = await fetchRouterUsage(BASE)
    expect(got.present).toBe(false)
    expect(got.rows).toEqual([])
    expect(got.note).toContain('no real usage')
    vi.unstubAllGlobals()
  })
})
