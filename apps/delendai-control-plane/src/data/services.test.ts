import { describe, expect, it } from 'vitest'
import { SERVICES_FIXTURES, countByStatus, serviceTone } from '@/data/services'

describe('services model', () => {
  it('counts services by status', () => {
    const counts = countByStatus(SERVICES_FIXTURES)
    expect(counts.up).toBeGreaterThan(0)
    expect(counts.up + counts.degraded + counts.down).toBe(
      SERVICES_FIXTURES.length
    )
  })

  it('maps service status to a signal tone', () => {
    expect(serviceTone('up')).toBe('ok')
    expect(serviceTone('degraded')).toBe('warn')
    expect(serviceTone('down')).toBe('danger')
  })

  it('fixture grid contains the control plane itself on its SSOT port', () => {
    const self = SERVICES_FIXTURES.find(
      (s) => s.name === 'delendai-control-plane'
    )
    expect(self?.port).toBe(25156)
    expect(self?.kind).toBe('web')
  })

  it('every fixture row carries a port, kind, status and health', () => {
    for (const s of SERVICES_FIXTURES) {
      expect(s.port).toBeGreaterThanOrEqual(0)
      expect(['inference', 'orchestration', 'web', 'data', 'ops']).toContain(
        s.kind
      )
      expect(['up', 'degraded', 'down']).toContain(s.status)
      expect(s.health).toBeGreaterThanOrEqual(0)
      expect(s.health).toBeLessThanOrEqual(100)
      expect(s.name.length).toBeGreaterThan(0)
    }
  })
})
