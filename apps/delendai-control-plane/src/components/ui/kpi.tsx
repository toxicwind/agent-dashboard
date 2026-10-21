import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

const accentMap = {
  ok: 'text-ok-400',
  warn: 'text-warn-300',
  danger: 'text-danger-300',
  accent: 'text-accent-300',
  violet: 'text-violet-400',
} as const

/**
 * Kpi — the Dashboard accent KPI card: a micro-label, a large numeric value,
 * an optional delta/sub-line and a leading glyph. The Widget2Code grammar:
 * widget = label frame + one hero value + a supporting meter or delta.
 */
export function Kpi({
  label,
  value,
  sub,
  icon,
  tone = 'accent',
  className,
}: {
  label: string
  value: ReactNode
  sub?: ReactNode
  icon?: ReactNode
  tone?: keyof typeof accentMap
  className?: string
}) {
  return (
    <div
      className={cn(
        'glass-panel relative overflow-hidden rounded-[--radius-panel] bg-ink-850/70 px-4 py-3.5',
        className
      )}
    >
      <div className="flex items-center justify-between">
        <span className="micro-label">{label}</span>
        {icon && (
          <span className={cn('shrink-0', accentMap[tone])}>{icon}</span>
        )}
      </div>
      <div className="mt-2 flex items-baseline gap-2">
        <span
          className={cn(
            'numeric text-2xl font-semibold leading-none tracking-tight',
            accentMap[tone]
          )}
        >
          {value}
        </span>
      </div>
      {sub && <div className="mt-2 text-xs text-fg-400">{sub}</div>}
    </div>
  )
}
