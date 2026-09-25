import { useEffect, useState, useRef, type ReactNode } from 'react'
import type { NavSection } from '../../types'
import { useBusiness } from '../../contexts/BusinessContext'
import { useBranch, ALL_BRANCHES } from '../../contexts/BranchContext'

interface ShellProps {
  children: ReactNode
  activeSection: NavSection
  onNavigate: (s: NavSection) => void
}

export function AppShell({ children, activeSection, onNavigate }: ShellProps) {
  // Sidebar state for mobile: hidden by default, toggled by the hamburger.
  // On lg+ screens the sidebar is always visible regardless of this flag.
  const [mobileNavOpen, setMobileNavOpen] = useState(false)

  // Close the mobile drawer whenever the user navigates.
  function handleNavigate(section: NavSection) {
    onNavigate(section)
    setMobileNavOpen(false)
  }

  return (
    <div className="flex h-full bg-bg overflow-hidden">
      {/* Desktop sidebar — fixed width, hidden below lg */}
      <div className="hidden lg:flex">
        <Sidebar active={activeSection} onNavigate={handleNavigate} />
      </div>

      {/* Mobile drawer — overlay + slide-in sidebar */}
      {mobileNavOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div
            className="absolute inset-0 bg-ink/50 backdrop-blur-sm"
            onClick={() => setMobileNavOpen(false)}
            aria-hidden="true"
          />
          <div className="absolute inset-y-0 left-0 w-64 max-w-[80vw] shadow-2xl">
            <Sidebar
              active={activeSection}
              onNavigate={handleNavigate}
              onClose={() => setMobileNavOpen(false)}
            />
          </div>
        </div>
      )}

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <TopBar
          section={activeSection}
          onMenuClick={() => setMobileNavOpen(true)}
        />
        <main className="flex-1 overflow-hidden">{children}</main>
      </div>
    </div>
  )
}

const NAV: { id: NavSection; label: string; enabled: boolean }[] = [
  { id: 'dashboard', label: 'Dashboard', enabled: true  },
  { id: 'bookings',  label: 'Bookings',  enabled: true  },
  { id: 'customers', label: 'Customers', enabled: true  },
  { id: 'services',  label: 'Services',  enabled: true  },
  { id: 'staff',     label: 'Staff',     enabled: true  },
  { id: 'branches',  label: 'Branches',  enabled: true  },
  { id: 'feedback',  label: 'Feedback',  enabled: true  },
  { id: 'finance',   label: 'Finance',   enabled: true  },
]

/* ------------------------------------------------------------------ */
/*  Sidebar                                                            */
/* ------------------------------------------------------------------ */

function Sidebar({
  active,
  onNavigate,
  onClose,
}: {
  active: NavSection
  onNavigate: (s: NavSection) => void
  /** Only provided when rendered as a mobile drawer — shows the close button. */
  onClose?: () => void
}) {
  const { activeMembership } = useBusiness()
  const businessName = activeMembership?.business?.name ?? 'Z-salon'

  return (
    <aside className="w-56 lg:w-56 w-64 max-w-[80vw] flex-shrink-0 bg-ink flex flex-col h-full select-none">
      <div className="px-6 py-6 border-b border-white/10 flex items-center justify-between gap-2">
        <div>
          <div className="font-display text-2xl text-surface leading-none">Z-salon</div>
          <div className="text-warm text-sm mt-1 font-display italic">ዘsalon</div>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            aria-label="Close menu"
            className="lg:hidden w-8 h-8 flex items-center justify-center rounded-lg text-white/50 hover:text-white/80 hover:bg-white/6 transition-colors"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      <nav className="flex-1 py-4 px-3 flex flex-col gap-0.5 overflow-y-auto">
        {NAV.map(item => {
          const isActive  = active === item.id
          const isEnabled = item.enabled
          return (
            <button
              key={item.id}
              onClick={() => isEnabled && onNavigate(item.id)}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 w-full text-left
                ${isActive   ? 'bg-white/12 text-surface'
                : isEnabled  ? 'text-white/50 hover:bg-white/6 hover:text-white/80'
                             : 'text-white/25 cursor-not-allowed'}`}
            >
              <span className={`flex-shrink-0 ${isActive ? 'opacity-100' : isEnabled ? 'opacity-50' : 'opacity-20'}`}>
                <NavIcon id={item.id} />
              </span>
              {item.label}
              {!isEnabled && (
                <span className="ml-auto text-[10px] bg-white/8 text-white/25 px-1.5 py-0.5 rounded-md">Soon</span>
              )}
            </button>
          )
        })}
      </nav>

      <div className="mx-4 border-t border-white/10 mb-2" />

      <div className="px-3 pb-2">
        <button
          onClick={() => onNavigate('settings' as NavSection)}
          className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 w-full text-left
            ${active === ('settings' as NavSection) ? 'bg-white/12 text-surface' : 'text-white/50 hover:bg-white/6 hover:text-white/80'}`}
        >
          <span className={`flex-shrink-0 ${active === ('settings' as NavSection) ? 'opacity-100' : 'opacity-50'}`}>
            <SettingsIcon />
          </span>
          Settings
        </button>
      </div>

      <div className="px-3 pb-5">
        <div className="flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-white/6 transition-colors cursor-pointer">
          <div className="w-8 h-8 rounded-full bg-warm flex items-center justify-center text-ink text-xs font-semibold flex-shrink-0">
            {businessName.charAt(0).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-surface text-sm font-medium truncate">{businessName}</p>
            <p className="text-white/35 text-xs truncate">Business</p>
          </div>
        </div>
      </div>
    </aside>
  )
}

/* ------------------------------------------------------------------ */
/*  TopBar                                                             */
/* ------------------------------------------------------------------ */

function TopBar({ section, onMenuClick }: { section: NavSection; onMenuClick: () => void }) {
  const { branches, activeBranchId, setActiveBranchId, loading } = useBranch()

  const titles: Record<NavSection, string> = {
    bookings:  'Bookings',  dashboard: 'Dashboard', customers: 'Customers',
    services:  'Services',  staff:     'Staff',      branches:  'Branches',
    feedback:  'Feedback',  finance:   'Finance',    settings:  'Settings',
  } as Record<NavSection, string>

  const branchOptions = [
    ...branches.map(b => ({ value: b.id, label: b.name })),
    ...(branches.length > 1 ? [{ value: ALL_BRANCHES, label: 'All branches' }] : []),
  ]

  return (
    <header className="h-14 bg-surface border-b border-line flex items-center justify-between gap-2 px-4 sm:px-6 flex-shrink-0">
      <div className="flex items-center gap-3 min-w-0">
        <button
          onClick={onMenuClick}
          aria-label="Open menu"
          className="lg:hidden -ml-1 w-9 h-9 rounded-xl flex items-center justify-center text-ink-3 hover:bg-warm-subtle hover:text-ink transition-colors flex-shrink-0"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 12h18M3 6h18M3 18h18" />
          </svg>
        </button>

        <h1 className="text-sm font-semibold text-ink truncate">{titles[section]}</h1>
      </div>

      <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
        <div className="hidden sm:block">
          <BranchSelect
            value={activeBranchId}
            onChange={setActiveBranchId}
            options={branchOptions}
            loading={loading}
          />
        </div>
        <NotificationsButton />
      </div>
    </header>
  )
}

/* ------------------------------------------------------------------ */
/*  Branch select — custom dropdown                                    */
/* ------------------------------------------------------------------ */

function BranchSelect({
  value,
  onChange,
  options,
  loading,
}: {
  value: string
  onChange: (v: string) => void
  options: { value: string; label: string }[]
  loading: boolean
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    function onEsc(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onEsc)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('keydown', onEsc)
    }
  }, [open])

  const selected = options.find(o => o.value === value)
  const placeholder = loading
    ? 'Loading…'
    : options.length === 0
      ? 'No branches'
      : 'Select branch'

  const disabled = loading || options.length === 0

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen(o => !o)}
        className="
          h-8 min-w-[9rem] max-w-[14rem] px-3 pr-2
          rounded-[10px]
          border border-line bg-surface text-ink text-xs font-medium
          flex items-center justify-between gap-2 text-left
          focus:outline-none focus:border-ink-3 focus:ring-2 focus:ring-ink-3/10
          transition-colors
          disabled:opacity-50 disabled:cursor-not-allowed
        "
      >
        <span className="truncate flex items-center gap-2 min-w-0">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"
            className="text-ink-3 flex-shrink-0">
            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" />
            <circle cx="12" cy="10" r="3" />
          </svg>
          <span className="truncate">{selected?.label ?? placeholder}</span>
        </span>
        <svg
          className={`flex-shrink-0 text-ink-3 transition-transform ${open ? 'rotate-180' : ''}`}
          width="12" height="12" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {open && !disabled && (
        <div className="
          absolute right-0 z-30 mt-1.5
          min-w-[11rem] max-w-[16rem]
          max-h-72 overflow-y-auto
          rounded-[10px] border border-line bg-surface
          shadow-lg shadow-black/5
          py-1
        ">
          {options.map(o => {
            const isSelected = o.value === value
            return (
              <button
                key={o.value}
                type="button"
                onClick={() => { onChange(o.value); setOpen(false) }}
                className={`
                  w-full px-3 py-2 text-left text-xs
                  flex items-center justify-between gap-2 transition-colors
                  ${isSelected
                    ? 'bg-warm-subtle text-ink font-medium'
                    : 'text-ink-2 hover:bg-warm-subtle hover:text-ink'}
                `}
              >
                <span className="truncate">{o.label}</span>
                {isSelected && (
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
                    stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"
                    className="text-ink flex-shrink-0">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                )}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Notifications                                                      */
/* ------------------------------------------------------------------ */

type Notification = {
  id: string
  title: string
  body: string
  createdAt: string
  read: boolean
}

function NotificationsButton() {
  const [open, setOpen] = useState(false)
  const [items, setItems] = useState<Notification[]>([])
  const ref = useRef<HTMLDivElement>(null)

  const unread = items.filter(n => !n.read).length

  useEffect(() => {
    if (!open) return
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    function onEsc(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onEsc)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('keydown', onEsc)
    }
  }, [open])

  function markAllRead() {
    setItems(prev => prev.map(n => ({ ...n, read: true })))
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(o => !o)}
        aria-label="Notifications"
        className="w-8 h-8 rounded-xl flex items-center justify-center text-ink-3 hover:bg-warm-subtle hover:text-ink transition-colors relative flex-shrink-0"
      >
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 01-3.46 0" />
        </svg>
        {unread > 0 && (
          <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-[#C4A97D] rounded-full" />
        )}
      </button>

      {open && (
        <div className="
          absolute right-0 mt-2
          w-80 max-w-[calc(100vw-2rem)]
          rounded-xl border border-line bg-surface
          shadow-lg shadow-black/5
          overflow-hidden z-30
        ">
          <div className="flex items-center justify-between px-4 py-3 border-b border-line">
            <p className="text-sm font-medium text-ink">Notifications</p>
            {items.length > 0 && unread > 0 && (
              <button
                onClick={markAllRead}
                className="text-xs text-ink-3 hover:text-ink-2 transition-colors"
              >
                Mark all read
              </button>
            )}
          </div>

          {items.length === 0 ? (
            <div className="px-4 py-8 text-center">
              <div className="w-10 h-10 rounded-full bg-warm-subtle flex items-center justify-center mx-auto mb-3">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#8A847F" strokeWidth="1.5">
                  <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 01-3.46 0" />
                </svg>
              </div>
              <p className="text-sm text-ink-2 font-medium">You&apos;re all caught up</p>
              <p className="text-xs text-ink-3 mt-0.5">New notifications will show up here.</p>
            </div>
          ) : (
            <ul className="max-h-80 overflow-y-auto divide-y divide-line">
              {items.map(n => (
                <li key={n.id} className="px-4 py-3 hover:bg-warm-subtle/40 transition-colors">
                  <p className="text-sm font-medium text-ink">{n.title}</p>
                  <p className="text-xs text-ink-3 mt-0.5 leading-relaxed">{n.body}</p>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Icons                                                              */
/* ------------------------------------------------------------------ */

function NavIcon({ id }: { id: NavSection }) {
  switch (id) {
    case 'dashboard': return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>
    case 'bookings':  return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>
    case 'customers': return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M9 11a4 4 0 100-8 4 4 0 000 8zM23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/></svg>
    case 'services':  return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/></svg>
    case 'staff':     return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2M12 11a4 4 0 100-8 4 4 0 000 8z"/></svg>
    case 'branches':  return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><path d="M9 22V12h6v10"/></svg>
    case 'feedback':  return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>
    case 'finance':   return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/></svg>
    case 'settings':  return <SettingsIcon />
    default: return null
  }
}

function SettingsIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <circle cx="12" cy="12" r="3"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/>
    </svg>
  )
}