import { afterEach, describe, expect, it } from 'vitest'
import {
  fetchChannels,
  fetchDashboards,
  fetchRouterUsage,
  fetchServices,
  fetchProviders,
  pingControlApi,
} from '@/api/client'

// Bun's builtin test `vi` lacks stubGlobal; stub globalThis.fetch directly
// and restore the real binding after each test.
const realFetch = globalThis.fetch

function stubFetch(
  impl: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>
) {
  globalThis.fetch = impl
}

const ok = (body: unknown) =>
  Promise.resolve({
    ok: true,
    status: 200,
    json: () => Promise.resolve(body),
  } as Response)

const notOk = (status: number) =>
  Promise.resolve({
    ok: false,
    status,
    json: () => Promise.resolve({}),
  } as Response)

afterEach(() => {
  globalThis.fetch = realFetch
})

describe('api/client', () => {
  it('pingControlApi returns true when /health answers ok', async () => {
    stubFetch(() => ok({}))
    await expect(pingControlApi('http://x', 500)).resolves.toBe(true)
  })

  it('pingControlApi returns false when /health does not answer ok', async () => {
    stubFetch(() => notOk(503))
    await expect(pingControlApi('http://x', 500)).resolves.toBe(false)
  })

  it('pingControlApi returns false when fetch rejects (aborted/timeout)', async () => {
    stubFetch(() => Promise.reject(new Error('timeout')))
    await expect(pingControlApi('http://x', 500)).resolves.toBe(false)
  })

  it('fetchProviders returns the ready model from the API', async () => {
    const model = {
      kind: 'ready',
      checkedAt: '2026-10-20T22:40:00.000Z',
      summary: { total: 1, available: 1, unavailable: 0 },
      emptyRoster: false,
      rows: [],
      quota: { present: false, updatedAt: null, note: null },
    }
    stubFetch(() => ok(model))
    await expect(fetchProviders('http://x', 500)).resolves.toEqual(model)
  })

  it('fetchProviders degrades when the model is not a ready model', async () => {
    stubFetch(() => ok({ kind: 'bogus' }))
    await expect(fetchProviders('http://x', 500)).resolves.toMatchObject({
      kind: 'ready',
      emptyRoster: true,
      rows: [],
    })
  })

  it('fetchProviders degrades to a truthful empty model on error', async () => {
    stubFetch(() => Promise.reject(new Error('down')))
    await expect(fetchProviders('http://x', 500)).resolves.toMatchObject({
      kind: 'ready',
      emptyRoster: true,
      rows: [],
    })
  })

  it('fetchServices returns rows when present', async () => {
    stubFetch(() => ok([{ daemon: 'a' }]))
    await expect(fetchServices('http://x', 500)).resolves.toEqual([
      { daemon: 'a' },
    ])
  })

  it('fetchServices returns [] when the body is not an array', async () => {
    stubFetch(() => ok({ not: 'array' }))
    await expect(fetchServices('http://x', 500)).resolves.toEqual([])
  })

  it('fetchServices returns [] when the response is not ok', async () => {
    stubFetch(() => notOk(500))
    await expect(fetchServices('http://x', 500)).resolves.toEqual([])
  })

  it('fetchServices returns [] when the request errors', async () => {
    stubFetch(() => Promise.reject(new Error('down')))
    await expect(fetchServices('http://x', 500)).resolves.toEqual([])
  })

  it('fetchChannels returns rows when the API returns an array', async () => {
    const channels = [{ id: 'kappa_board', name: 'kappa_board' }]
    stubFetch(() => ok(channels))
    await expect(fetchChannels('http://x', 500)).resolves.toEqual(channels)
  })

  it('fetchChannels returns [] on non-array (idempotent-safe)', async () => {
    stubFetch(() => ok({ not: 'array' }))
    await expect(fetchChannels('http://x', 500)).resolves.toEqual([])
  })

  it('fetchChannels returns [] when the request errors', async () => {
    stubFetch(() => Promise.reject(new Error('nope')))
    await expect(fetchChannels('http://x', 500)).resolves.toEqual([])
  })

  it('fetchDashboards returns the dashboards list', async () => {
    const model = { dashboards: [{ id: 'portal', url: 'http://x:25101' }] }
    stubFetch(() => ok(model))
    await expect(fetchDashboards('http://x', 500)).resolves.toEqual(
      model.dashboards
    )
  })

  it('fetchDashboards returns [] when the model is missing dashboards', async () => {
    stubFetch(() => ok({}))
    await expect(fetchDashboards('http://x', 500)).resolves.toEqual([])
  })

  it('fetchDashboards returns [] when the request errors', async () => {
    stubFetch(() => Promise.reject(new Error('nope')))
    await expect(fetchDashboards('http://x', 500)).resolves.toEqual([])
  })

  it('fetchRouterUsage returns rows when present=true', async () => {
    stubFetch(() => ok({ present: true, rows: [{ provider: 'deepseek' }] }))
    await expect(fetchRouterUsage('http://x', 500)).resolves.toMatchObject({
      present: true,
      rows: [{ provider: 'deepseek' }],
    })
  })

  it('fetchRouterUsage returns no-usage when not present', async () => {
    stubFetch(() => ok({ present: false }))
    await expect(fetchRouterUsage('http://x', 500)).resolves.toMatchObject({
      present: false,
      rows: [],
    })
  })

  it('fetchRouterUsage returns no-usage on error', async () => {
    stubFetch(() => Promise.reject(new Error('down')))
    await expect(fetchRouterUsage('http://x', 500)).resolves.toMatchObject({
      present: false,
      rows: [],
      note: 'no real usage data',
    })
  })
})