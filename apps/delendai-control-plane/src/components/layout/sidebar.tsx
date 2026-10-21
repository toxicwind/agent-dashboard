import { useState } from 'react'
import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard,
  Waypoints,
  Radar,
  MessagesSquare,
  GripVertical,
  Boxes,
  PanelsTopLeft,
} from 'lucide-react'
import { cn } from '@/lib/utils'

const NAV = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/providers', label: 'Providers', icon: Boxes },
  { to: '/router', label: 'Router', icon: Radar },
  { to: '/chats', label: 'Chats', icon: MessagesSquare },
  { to: '/dashboards', label: 'Dashboards', icon: PanelsTopLeft },
]

export function Sidebar() {
  // Resizable sidebar (min 210px, max 340px), persisted to localStorage.
  const [width, setWidth] = useState<number>(() => {
    const saved = Number(localStorage.getItem('dcp.sidebar') ?? 232)
    return Number.isFinite(saved) ? saved : 232
  })

  function startDrag(e: React.PointerEvent) {
    e.preventDefault()
    const onMove = (ev: PointerEvent) => {
      const w = Math.min(340, Math.max(210, ev.clientX))
      setWidth(w)
    }
    const onUp = (ev: PointerEvent) => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      localStorage.setItem('dcp.sidebar', String(ev.clientX))
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }

  return (
    <div
      className="relative flex shrink-0 flex-col border-r border-ink-600/50 bg-ink-900/60"
      style={{ width }}
    >
      <div className="flex items-center gap-2 px-4 py-4">
        <div className="flex size-7 items-center justify-center rounded-lg bg-gradient-to-br from-accent-400 to-violet-500 shadow-sm">
          <Waypoints className="size-4 text-ink-950" strokeWidth={2.5} />
        </div>
        <div className="leading-tight">
          <div className="text-sm font-semibold tracking-tight text-fg-100">
            DelendAI
          </div>
          <div className="micro-label">Control Plane</div>
        </div>
      </div>

      <nav className="mt-2 flex flex-1 flex-col gap-0.5 px-2">
        <span className="micro-label px-2 pb-1.5">Overview</span>
        {NAV.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-[13px] font-medium transition-colors',
                isActive
                  ? 'bg-ink-700/60 text-fg-100'
                  : 'text-fg-400 hover:bg-ink-750/60 hover:text-fg-200'
              )
            }
          >
            <Icon className="size-4 shrink-0" strokeWidth={2} />
            {label}
          </NavLink>
        ))}
      </nav>

      <div className="border-t border-ink-600/50 px-4 py-3 text-[11px] text-fg-500">
        <div className="flex items-center gap-1.5">
          <span className="size-1.5 rounded-full bg-ok-400" />
          port 25156 · live
        </div>
      </div>

      {/* resize handle */}
      <button
        aria-label="Resize sidebar"
        onPointerDown={startDrag}
        className="absolute inset-y-0 right-0 flex w-1.5 cursor-ew-resize items-center justify-center text-fg-500 opacity-0 transition-opacity hover:opacity-100"
      >
        <GripVertical className="size-3" />
      </button>
    </div>
  )
}
