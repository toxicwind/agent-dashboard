import { describe, expect, it } from 'vitest'
import { cn, formatCompact, formatUsd, formatWhen, timeAgo } from '@/lib/utils'

describe('lib/utils', () => {
  it('cn merges tailwind classes with twMerge precedence', () => {
    expect(cn('px-2', 'px-4')).toBe('px-4')
    expect(cn('text-red-500 text-blue-500')).toBe('text-blue-500')
    expect(cn('a', false && 'b', null, undefined, '', 'c')).toBe('a c')
  })

  it('formatWhen renders a compact local string or an em dash', () => {
    expect(formatWhen(null)).toBe('—')
    expect(formatWhen('not-a-date')).toBe('—')
    expect(formatWhen('2026-10-20T22:40:00.000Z')).toMatch(
      /^[A-Z][a-z]{2} \d{1,2}/
    )
  })

  it('timeAgo renders relative intervals', () => {
    expect(timeAgo(null)).toBe('never')
    expect(timeAgo('junk')).toBe('never')
    expect(timeAgo(new Date(Date.now() - 30_000).toISOString())).toBe('30s ago')
    expect(timeAgo(new Date(Date.now() - 5 * 60_000).toISOString())).toBe(
      '5m ago'
    )
    expect(timeAgo(new Date(Date.now() - 3 * 3600_000).toISOString())).toBe(
      '3h ago'
    )
    expect(timeAgo(new Date(Date.now() - 2 * 86_400_000).toISOString())).toBe(
      '2d ago'
    )
  })

  it('formatUsd formats small-safe currency', () => {
    expect(formatUsd(2.1)).toBe('$2.10')
    expect(formatUsd(0)).toBe('$0.00')
    expect(formatUsd(1200.5)).toBe('$1200.50')
  })

  it('formatCompact scales to k/m', () => {
    expect(formatCompact(1200)).toBe('1.2k')
    expect(formatCompact(2_500_000)).toBe('2.5m')
    expect(formatCompact(42)).toBe('42')
    expect(formatCompact(0)).toBe('0')
  })
})