import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

type Tone = 'ok' | 'warn' | 'danger' | 'muted' | 'accent' | 'violet'

const toneClasses: Record<Tone, string> = {
  ok: 'bg-ok-500/10 text-ok-400 ring-ok-500/30',
  warn: 'bg-warn-500/10 text-warn-300 ring-warn-500/30',
  danger: 'bg-danger-500/10 text-danger-300 ring-danger-500/30',
  muted: 'bg-ink-700/40 text-fg-400 ring-ink-600/50',
  accent: 'bg-accent-500/10 text-accent-300 ring-accent-500/30',
  violet: 'bg-violet-500/10 text-violet-400 ring-violet-500/30',
}

export function Badge({
  tone = 'muted',
  children,
  className,
}: {
  tone?: Tone
  children: ReactNode
  className?: string
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-[--radius-chip] px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.08em] ring-1 ring-inset',
        toneClasses[tone],
        className
      )}
    >
      {children}
    </span>
  )
}

export function Dot({ tone = 'muted' }: { tone?: Tone }) {
  const dot: Record<Tone, string> = {
    ok: 'bg-ok-400',
    warn: 'bg-warn-400',
    danger: 'bg-danger-400',
    muted: 'bg-fg-500',
    accent: 'bg-accent-400',
    violet: 'bg-violet-400',
  }
  return (
    <span
      className={cn('inline-block size-1.5 rounded-[--radius-chip]', dot[tone])}
    />
  )
}
