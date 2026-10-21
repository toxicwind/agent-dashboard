import { cn } from '@/lib/utils'

type MeterTone = 'ok' | 'warn' | 'danger' | 'accent' | 'violet'

const fillClasses: Record<MeterTone, string> = {
  ok: 'from-ok-400 to-ok-500',
  warn: 'from-warn-300 to-warn-500',
  danger: 'from-danger-400 to-danger-600',
  accent: 'from-accent-300 to-accent-500',
  violet: 'from-violet-400 to-violet-500',
}

/**
 * Meter — a quota bar. `pct` may exceed 100 (quota-exceeded providers): the
 * fill clamps at 100% width but the label keeps the true percent and turns
 * danger. `live` toggles an animated sheen for a live-data feel.
 */
export function Meter({
  pct,
  tone = 'accent',
  live = true,
  label,
  showPct = true,
  className,
}: {
  pct: number | null
  tone?: MeterTone
  live?: boolean
  label?: string
  showPct?: boolean
  className?: string
}) {
  const over = pct !== null && pct > 100
  const width = pct === null ? 0 : Math.min(100, pct)
  const toneToUse = over ? 'danger' : tone

  return (
    <div className={cn('flex items-center gap-2', className)}>
      <div className="relative h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-ink-700/60">
        <div
          className={cn(
            'absolute inset-y-0 left-0 rounded-full bg-gradient-to-r transition-[width] duration-700 ease-out',
            fillClasses[toneToUse],
            live &&
              'after:absolute after:inset-0 after:animate-pulse after:bg-gradient-to-r after:from-transparent after:via-white/25 after:to-transparent'
          )}
          style={{ width: `${width}%` }}
        />
      </div>
      {(showPct || label) && (
        <span
          className={cn(
            'numeric shrink-0 text-[11px] leading-none',
            over ? 'text-danger-300' : 'text-fg-400'
          )}
        >
          {label ?? (pct === null ? '—' : `${pct}${over ? '% ▲' : '%'}`)}
        </span>
      )}
    </div>
  )
}
