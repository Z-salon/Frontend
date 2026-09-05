import { type ReactNode } from 'react'
import type { NavSection } from '../../types'

interface ShellProps {
  children: ReactNode
  activeSection: NavSection
  onNavigate: (s: NavSection) => void
}

export function AppShell({ children, activeSection, onNavigate }: ShellProps) {
  return (
    <div className="flex h-full bg-bg overflow-hidden">
      <Sidebar active={activeSection} onNavigate={onNavigate} />
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <TopBar section={activeSection} />
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

function Sidebar({ active, onNavigate }: { active: NavSection; onNavigate: (s: NavSection) => void }) {
  return (
    <aside className="w-56 flex-shrink-0 bg-ink flex flex-col h-full select-none">
      <div className="px-6 py-6 border-b border-white/10">
        <div className="font-display text-2xl text-surface leading-none">Z-salon</div>
        <div className="text-warm text-sm mt-1 font-display italic">ዘsalon</div>
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
          onClick={() => onNavigate('settings')}
          className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 w-full text-left
            ${active === 'settings' ? 'bg-white/12 text-surface' : 'text-white/50 hover:bg-white/6 hover:text-white/80'}`}
        >
          <span className={`flex-shrink-0 ${active === 'settings' ? 'opacity-100' : 'opacity-50'}`}><SettingsIcon /></span>
          Settings
        </button>
      </div>

      <div className="px-3 pb-5">
        <div className="flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-white/6 transition-colors cursor-pointer">
          <div className="w-8 h-8 rounded-full bg-warm flex items-center justify-center text-ink text-xs font-semibold flex-shrink-0">SA</div>
          <div className="flex-1 min-w-0">
            <p className="text-surface text-sm font-medium truncate">Sara Admin</p>
            <p className="text-white/35 text-xs truncate">Z-salon · Bole</p>
          </div>
        </div>
      </div>
    </aside>
  )
}

function TopBar({ section }: { section: NavSection }) {
  const titles: Record<NavSection, string> = {
    bookings:  'Bookings',  dashboard: 'Dashboard', customers: 'Customers',
    services:  'Services',  staff:     'Staff',      branches:  'Branches',
    feedback:  'Feedback',  finance:   'Finance',    settings:  'Settings',
  }
  return (
    <header className="h-14 bg-surface border-b border-line flex items-center justify-between px-6 flex-shrink-0">
      <h1 className="text-sm font-semibold text-ink">{titles[section]}</h1>
      <div className="flex items-center gap-3">
        <select className="h-8 pl-3 pr-2 rounded-xl border border-line text-xs bg-bg text-ink focus:outline-none focus:border-warm cursor-pointer">
          <option>Bole</option>
          <option>Kazanchis</option>
          <option>All branches</option>
        </select>
        <button className="w-8 h-8 rounded-xl flex items-center justify-center text-ink-3 hover:bg-warm-subtle hover:text-ink transition-colors relative">
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 01-3.46 0" />
          </svg>
          <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-[#C4A97D] rounded-full" />
        </button>
        <div className="w-8 h-8 rounded-full bg-warm flex items-center justify-center text-ink text-xs font-semibold cursor-pointer">SA</div>
      </div>
    </header>
  )
}

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
