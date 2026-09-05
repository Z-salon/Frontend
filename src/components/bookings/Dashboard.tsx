import { useState } from 'react'
import type { Appointment, CalendarView, AppointmentStatus } from '../../types'
import { getStatusConfig, Button } from '../ui'

const HOUR_HEIGHT    = 80
const CALENDAR_START = 8
const CALENDAR_END   = 20
const HOURS = Array.from({ length: CALENDAR_END - CALENDAR_START }, (_, i) => CALENDAR_START + i)

interface DashboardProps {
  appointments: Appointment[]
  onSelectAppointment: (a: Appointment) => void
  onNewBooking: () => void
  onWalkIn: () => void
  onUpdateAppointment: (id: string, changes: Partial<Appointment>) => void
}

export function BookingDashboard({ appointments, onSelectAppointment, onNewBooking, onWalkIn }: DashboardProps) {
  const [view, setView]               = useState<CalendarView>('day')
  const [selectedDate, setSelectedDate] = useState(new Date())
  const [filterStaff, setFilterStaff]   = useState('all')
  const [filterStatus, setFilterStatus] = useState('all')

  const dateStr    = selectedDate.toISOString().split('T')[0]
  const isToday    = dateStr === new Date().toISOString().split('T')[0]
  const dayAppts   = appointments.filter(a => a.date === dateStr)
  const filtered   = dayAppts.filter(a => {
    if (filterStaff !== 'all' && a.staffName !== filterStaff) return false
    if (filterStatus !== 'all' && a.status !== filterStatus) return false
    return true
  })

  const prevDay  = () => setSelectedDate(d => new Date(d.getTime() - 86400000))
  const nextDay  = () => setSelectedDate(d => new Date(d.getTime() + 86400000))
  const goToday  = () => setSelectedDate(new Date())

  const formattedDate = selectedDate.toLocaleDateString('en-GB', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  })

  const todayRevenue = dayAppts
    .filter(a => a.status === 'completed')
    .reduce((sum, a) => sum + a.price, 0)

  return (
    <div className="flex flex-col h-full">
      {/* Page header */}
      <div className="px-8 py-5 bg-surface border-b border-line flex-shrink-0">
        <div className="flex items-start justify-between mb-5">
          <div>
            <h2 className="font-display text-[1.75rem] text-ink leading-none">Bookings</h2>
            <p className="text-ink-3 text-sm mt-1.5">Manage your appointments and daily schedule.</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="secondary" onClick={onWalkIn} size="sm">
              <PlusIcon /> Walk-in
            </Button>
            <Button onClick={onNewBooking} size="sm">
              <PlusIcon /> New Booking
            </Button>
          </div>
        </div>

        {/* Stat chips */}
        <div className="flex items-center gap-4 mb-5">
          <StatChip label="Today" value={String(dayAppts.length)} unit="appointments" />
          <div className="w-px h-5 bg-line" />
          <StatChip label="Revenue" value={todayRevenue.toLocaleString()} unit="ETB" />
          <div className="w-px h-5 bg-line" />
          <StatChip label="Pending" value={String(dayAppts.filter(a => a.status === 'pending').length)} unit="to confirm" />
        </div>

        {/* Controls */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button onClick={prevDay} className="w-8 h-8 rounded-lg border border-line flex items-center justify-center text-ink-3 hover:bg-bg hover:text-ink transition-colors">
              <ChevronLeft />
            </button>
            <span className="text-sm font-medium text-ink min-w-[210px] text-center px-2">{formattedDate}</span>
            <button onClick={nextDay} className="w-8 h-8 rounded-lg border border-line flex items-center justify-center text-ink-3 hover:bg-bg hover:text-ink transition-colors">
              <ChevronRight />
            </button>
            {!isToday && (
              <button onClick={goToday} className="text-xs text-ink-3 hover:text-ink transition-colors border border-line rounded-lg px-2.5 h-8 ml-1">Today</button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <select value={filterStaff} onChange={e => setFilterStaff(e.target.value)}
              className="h-8 px-2.5 rounded-xl border border-line text-xs bg-bg text-ink focus:outline-none cursor-pointer">
              <option value="all">All staff</option>
              {['Sara', 'Hana', 'Meron'].map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
              className="h-8 px-2.5 rounded-xl border border-line text-xs bg-bg text-ink focus:outline-none cursor-pointer">
              <option value="all">All statuses</option>
              {(['pending','confirmed','checked-in','in-progress','completed','cancelled','no-show'] as AppointmentStatus[]).map(s => (
                <option key={s} value={s}>{s.replace('-', ' ').replace(/^\w/, c => c.toUpperCase())}</option>
              ))}
            </select>
            <div className="flex border border-line rounded-xl overflow-hidden ml-1">
              {(['day', 'week', 'list'] as CalendarView[]).map(v => (
                <button key={v} onClick={() => setView(v)}
                  className={`h-8 px-3 text-xs font-medium transition-colors ${view === v ? 'bg-ink text-surface' : 'text-ink-3 hover:text-ink hover:bg-warm-subtle'}`}>
                  {v.charAt(0).toUpperCase() + v.slice(1)}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Calendar content */}
      <div className="flex-1 overflow-hidden">
        {view === 'day'  && <DayView  appointments={filtered}     onSelect={onSelectAppointment} />}
        {view === 'week' && <WeekView appointments={appointments} selectedDate={selectedDate} onSelectDate={setSelectedDate} onSelect={onSelectAppointment} />}
        {view === 'list' && <ListView appointments={filtered}     onSelect={onSelectAppointment} formattedDate={formattedDate} />}
      </div>
    </div>
  )
}

function StatChip({ label, value, unit }: { label: string; value: string; unit: string }) {
  return (
    <div className="flex items-baseline gap-1.5">
      <span className="text-xs text-ink-3">{label}</span>
      <span className="text-sm font-semibold text-ink">{value}</span>
      <span className="text-xs text-ink-3">{unit}</span>
    </div>
  )
}

function DayView({ appointments, onSelect }: { appointments: Appointment[]; onSelect: (a: Appointment) => void }) {
  const totalH = HOURS.length * HOUR_HEIGHT

  function top(time: string) {
    const [h, m] = time.split(':').map(Number)
    return ((h - CALENDAR_START) + m / 60) * HOUR_HEIGHT
  }
  function height(duration: number) {
    return Math.max((duration / 60) * HOUR_HEIGHT, 34)
  }

  return (
    <div className="h-full overflow-y-auto bg-bg">
      {appointments.length === 0 ? (
        <EmptyDay />
      ) : (
        <div className="flex" style={{ minHeight: totalH + 48 }}>
          {/* Time labels */}
          <div className="w-16 flex-shrink-0 bg-surface border-r border-line relative" style={{ height: totalH + 48 }}>
            <div className="h-8" />
            {HOURS.map(h => (
              <div key={h} className="absolute flex justify-end pr-3 w-full" style={{ top: (h - CALENDAR_START) * HOUR_HEIGHT + 32 }}>
                <span className="text-[11px] text-ink-3 -translate-y-2.5">
                  {h === 12 ? '12 PM' : h > 12 ? `${h - 12} PM` : `${h} AM`}
                </span>
              </div>
            ))}
          </div>

          {/* Grid */}
          <div className="flex-1 relative" style={{ height: totalH + 48 }}>
            <div className="h-8" />
            {HOURS.map(h => (
              <div key={h} className="absolute left-0 right-0 border-t border-line" style={{ top: (h - CALENDAR_START) * HOUR_HEIGHT + 32 }} />
            ))}
            {HOURS.map(h => (
              <div key={`hf-${h}`} className="absolute left-0 right-0 border-t border-line/30" style={{ top: (h - CALENDAR_START) * HOUR_HEIGHT + HOUR_HEIGHT / 2 + 32 }} />
            ))}

            <CurrentTime />

            {/* Appointment blocks */}
            {appointments.map(appt => {
              const t  = top(appt.startTime)
              const ht = height(appt.duration)
              const cfg = getStatusConfig(appt.status)
              const compact = ht <= 50

              return (
                <div
                  key={appt.id}
                  onClick={() => onSelect(appt)}
                  className="absolute left-4 right-4 rounded-xl cursor-pointer overflow-hidden group transition-all duration-100 hover:shadow-md"
                  style={{ top: t + 32, height: ht, backgroundColor: cfg.bg, borderLeft: `3px solid ${cfg.dot}` }}
                >
                  <div className="px-3 py-2 h-full flex flex-col justify-center">
                    {compact ? (
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold truncate" style={{ color: cfg.text }}>{appt.customerName}</span>
                        <span className="text-xs opacity-70 truncate" style={{ color: cfg.text }}>{appt.serviceName}</span>
                      </div>
                    ) : (
                      <>
                        <p className="text-sm font-semibold leading-tight truncate" style={{ color: cfg.text }}>
                          {appt.customTitle || appt.customerName}
                        </p>
                        <p className="text-xs opacity-75 truncate mt-0.5" style={{ color: cfg.text }}>{appt.serviceName}</p>
                        <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                          <span className="text-[11px] opacity-60" style={{ color: cfg.text }}>{appt.startTime} · {appt.staffName}</span>
                          {ht >= 70 && (
                            <span className="text-[11px] opacity-55" style={{ color: cfg.text }}>{appt.price.toLocaleString()} ETB</span>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

function CurrentTime() {
  const now = new Date()
  const h = now.getHours()
  const m = now.getMinutes()
  if (h < CALENDAR_START || h >= CALENDAR_END) return null
  const t = ((h - CALENDAR_START) + m / 60) * HOUR_HEIGHT + 32
  return (
    <div className="absolute left-0 right-0 pointer-events-none z-10 flex items-center" style={{ top: t }}>
      <div className="w-2 h-2 rounded-full bg-[#7B9FAB] -ml-1 flex-shrink-0" />
      <div className="flex-1 h-px bg-[#7B9FAB] opacity-70" />
    </div>
  )
}

function EmptyDay() {
  return (
    <div className="flex flex-col items-center justify-center h-full text-center py-24">
      <div className="w-14 h-14 rounded-2xl bg-warm-subtle flex items-center justify-center mb-5">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#8A847F" strokeWidth="1.5">
          <rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>
        </svg>
      </div>
      <p className="font-display text-xl text-ink mb-1">No appointments today</p>
      <p className="text-ink-3 text-sm">Your schedule is clear.</p>
    </div>
  )
}

function WeekView({ appointments, selectedDate, onSelectDate, onSelect }: {
  appointments: Appointment[]
  selectedDate: Date
  onSelectDate: (d: Date) => void
  onSelect: (a: Appointment) => void
}) {
  const start = new Date(selectedDate)
  start.setDate(selectedDate.getDate() - ((selectedDate.getDay() + 6) % 7)) // Monday
  const days = Array.from({ length: 7 }, (_, i) => { const d = new Date(start); d.setDate(start.getDate() + i); return d })
  const todayStr = new Date().toISOString().split('T')[0]

  return (
    <div className="h-full overflow-y-auto bg-bg flex flex-col">
      <div className="grid grid-cols-7 border-b border-line bg-surface flex-shrink-0">
        {days.map(d => {
          const ds      = d.toISOString().split('T')[0]
          const isToday = ds === todayStr
          const count   = appointments.filter(a => a.date === ds).length
          return (
            <button key={ds} onClick={() => onSelectDate(new Date(d))}
              className={`py-3 text-center border-r border-line last:border-0 hover:bg-warm-subtle transition-colors ${isToday ? 'bg-warm-subtle' : ''}`}>
              <p className="text-[11px] text-ink-3 uppercase tracking-wider">{d.toLocaleDateString('en-GB', { weekday: 'short' })}</p>
              <p className={`text-lg font-semibold mt-0.5 ${isToday ? 'text-ink' : 'text-ink-2'}`}>{d.getDate()}</p>
              {count > 0 && (
                <p className="text-[11px] text-ink-3 mt-0.5">{count} appt{count !== 1 ? 's' : ''}</p>
              )}
            </button>
          )
        })}
      </div>
      <div className="flex-1 grid grid-cols-7 divide-x divide-line">
        {days.map(d => {
          const ds   = d.toISOString().split('T')[0]
          const appts = appointments.filter(a => a.date === ds).sort((a, b) => a.startTime.localeCompare(b.startTime))
          return (
            <div key={ds} className="p-2 flex flex-col gap-1.5 overflow-y-auto">
              {appts.map(a => {
                const cfg = getStatusConfig(a.status)
                return (
                  <button key={a.id} onClick={() => onSelect(a)}
                    className="text-left p-2 rounded-lg w-full transition-all hover:shadow-sm"
                    style={{ backgroundColor: cfg.bg, borderLeft: `2px solid ${cfg.dot}` }}>
                    <p className="text-[11px] font-semibold" style={{ color: cfg.text }}>{a.startTime}</p>
                    <p className="text-[11px] truncate mt-0.5" style={{ color: cfg.text, opacity: 0.85 }}>{a.customerName}</p>
                    <p className="text-[10px] truncate mt-0.5" style={{ color: cfg.text, opacity: 0.65 }}>{a.serviceName}</p>
                  </button>
                )
              })}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function ListView({ appointments, onSelect, formattedDate }: {
  appointments: Appointment[]
  onSelect: (a: Appointment) => void
  formattedDate: string
}) {
  const sorted = [...appointments].sort((a, b) => a.startTime.localeCompare(b.startTime))

  return (
    <div className="h-full overflow-y-auto p-8">
      <p className="text-xs text-ink-3 uppercase tracking-wider mb-5">{formattedDate}</p>
      {sorted.length === 0 ? (
        <div className="text-center py-16">
          <p className="font-display text-xl text-ink mb-1">No appointments</p>
          <p className="text-ink-3 text-sm">Schedule is clear for this day.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2 max-w-2xl">
          {sorted.map(a => {
            const cfg = getStatusConfig(a.status)
            const [eh, em] = (() => {
              const [h, m] = a.startTime.split(':').map(Number)
              const total = h * 60 + m + a.duration
              return [Math.floor(total / 60), total % 60]
            })()
            const endTime = `${String(eh).padStart(2,'0')}:${String(em).padStart(2,'0')}`

            return (
              <button key={a.id} onClick={() => onSelect(a)}
                className="flex items-center gap-5 p-4 bg-surface rounded-2xl border border-line hover:border-warm transition-all text-left w-full group">
                <div className="text-right w-[72px] flex-shrink-0">
                  <p className="text-sm font-semibold text-ink">{a.startTime}</p>
                  <p className="text-xs text-ink-3 mt-0.5">{endTime}</p>
                </div>
                <div className="w-px h-8 bg-line flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-ink text-sm">{a.customerName}</p>
                  <p className="text-ink-3 text-xs mt-0.5">{a.serviceName} · {a.staffName} · {a.branchName}</p>
                </div>
                <div className="flex items-center gap-4 flex-shrink-0">
                  <span className="text-sm font-semibold text-ink-2">{a.price.toLocaleString()} ETB</span>
                  <span className="text-xs font-medium px-2.5 py-1 rounded-full" style={{ backgroundColor: cfg.bg, color: cfg.text }}>{cfg.label}</span>
                </div>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-ink-3 group-hover:text-ink transition-colors flex-shrink-0">
                  <path d="M9 18l6-6-6-6"/>
                </svg>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

function PlusIcon() {
  return <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 5v14M5 12h14"/></svg>
}
function ChevronLeft() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 18l-6-6 6-6"/></svg>
}
function ChevronRight() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 18l6-6-6-6"/></svg>
}
