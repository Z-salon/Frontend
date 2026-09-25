// src/components/bookings/Dashboard.tsx

import { useEffect, useMemo, useRef, useState } from 'react'
import type {
  Appointment,
  AppointmentStatus,
  AppointmentStaffRef,
  Branch,
  Customer,
  Staff,
} from '../../types/api'
import { getStatusConfig, Button, StyledSelect } from '../ui'

const HOUR_HEIGHT    = 80
const CALENDAR_START = 8
const CALENDAR_END   = 20
const HOURS = Array.from(
  { length: CALENDAR_END - CALENDAR_START },
  (_, i) => CALENDAR_START + i,
)

type CalendarView = 'day' | 'week' | 'list'

const FILTER_ALL = 'all'
const FILTER_NOSHOW = '__noshow'
const FILTER_EXPIRED = '__expired'

const DEFAULT_TZ = 'Africa/Addis_Ababa'

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

/**
 * Read the appointment's staff reference. The API sends a single
 * `AppointmentStaffRef` object (nullable). Older client code used to see
 * an array; tolerate both so nothing silently breaks during migration.
 */
function appointmentStaff(
  a: Appointment | null | undefined,
): AppointmentStaffRef | null {
  if (!a) return null
  const raw = a.staff as unknown
  if (!raw) return null
  if (Array.isArray(raw)) {
    return ((raw[0] as AppointmentStaffRef) ?? null)
  }
  return raw as AppointmentStaffRef
}

function localHHmm(iso: string, timezone: string): string {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: timezone,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(iso))
}

function localDateISO(iso: string, timezone: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(iso))
}

function durationMinutes(a: Appointment): number {
  const start = new Date(a.scheduledStart).getTime()
  const end   = new Date(a.scheduledEnd).getTime()
  return Math.max(1, Math.round((end - start) / 60000))
}

function todayISO(timezone: string): string {
  return localDateISO(new Date().toISOString(), timezone)
}

/**
 * Customer display name. Prefers the joined `customer` on the
 * appointment payload, then falls back to a lookup in the passed list.
 */
function customerLabel(a: Appointment, customers: Customer[]): string {
  if (a.customer) {
    const name = `${a.customer.firstName ?? ''} ${a.customer.lastName ?? ''}`.trim()
    if (name) return name
  }
  const c = customers.find(x => x.id === a.customerId)
  if (!c) return 'Customer'
  return `${c.firstName} ${c.lastName}`.trim() || 'Customer'
}

function branchLabel(a: Appointment, branches: Branch[]): string {
  return branches.find(b => b.id === a.branchId)?.name ?? 'Unknown branch'
}

function primaryStaffLabel(a: Appointment): string {
  const ref = appointmentStaff(a)
  if (!ref) return '—'
  const name = `${ref.firstName ?? ''} ${ref.lastName ?? ''}`.trim()
  return name || '—'
}

function staffFullName(s: Staff): string {
  return `${s.firstName} ${s.lastName}`.trim()
}

function prettyStatus(s: AppointmentStatus): string {
  switch (s) {
    case 'PENDING':     return 'Pending'
    case 'CONFIRMED':   return 'Confirmed'
    case 'CHECKED_IN':  return 'Checked in'
    case 'IN_PROGRESS': return 'In progress'
    case 'COMPLETED':   return 'Completed'
    case 'CANCELLED':   return 'Cancelled'
    case 'NO_SHOW':     return 'No-show'
    case 'EXPIRED':     return 'Expired'
  }
}

const ALL_STATUSES: AppointmentStatus[] = [
  'PENDING',
  'CONFIRMED',
  'CHECKED_IN',
  'IN_PROGRESS',
  'COMPLETED',
  'CANCELLED',
  'NO_SHOW',
  'EXPIRED',
]

/* ------------------------------------------------------------------ */
/*  Dashboard                                                          */
/* ------------------------------------------------------------------ */

interface DashboardProps {
  appointments: Appointment[]
  customers: Customer[]
  branches: Branch[]
  staff: Staff[]
  timezone?: string
  activeBranchId?: string | null
  onSelectAppointment: (a: Appointment) => void
  onNewBooking: () => void
  onWalkIn: () => void
  onUpdateAppointment: (id: string, changes: Partial<Appointment>) => void
}

export function BookingDashboard({
  appointments,
  customers,
  branches,
  staff,
  timezone = DEFAULT_TZ,
  activeBranchId = null,
  onSelectAppointment,
  onNewBooking,
  onWalkIn,
}: DashboardProps) {
  const [view, setView] = useState<CalendarView>('day')
  const [selectedDate, setSelectedDate] = useState(new Date())
  const [filterStaff, setFilterStaff] = useState<string>(FILTER_ALL)
  const [filterStatus, setFilterStatus] = useState<'all' | AppointmentStatus>('all')
  const [showLegend, setShowLegend] = useState(false)
  const [showDatePicker, setShowDatePicker] = useState(false)

  /* ── Branch scoping ──────────────────────────────────────────── */
  const isAllBranches = !activeBranchId || activeBranchId.length === 0

  const branchScopedAppointments = useMemo(
    () =>
      isAllBranches
        ? appointments
        : appointments.filter(a => a.branchId === activeBranchId),
    [appointments, isAllBranches, activeBranchId],
  )

  const showBranchOnCards = isAllBranches

  const selectedISO = localDateISO(selectedDate.toISOString(), timezone)
  const todayStr    = todayISO(timezone)
  const isToday     = selectedISO === todayStr

  const dayAppts = useMemo(
    () =>
      branchScopedAppointments.filter(
        a => localDateISO(a.scheduledStart, timezone) === selectedISO,
      ),
    [branchScopedAppointments, selectedISO, timezone],
  )

  /* ── Filter option lists ─────────────────────────────────────── */

  const staffFilterOptions = useMemo(() => {
    const pool = isAllBranches
      ? staff
      : staff.filter(s => s.branchId === activeBranchId)

    const sorted = [...pool]
      .filter(s => s.status === 'ACTIVE')
      .sort((a, b) => staffFullName(a).localeCompare(staffFullName(b)))

    return [
      { value: FILTER_ALL,     label: 'All staff' },
      { value: FILTER_NOSHOW,  label: 'No-shows' },
      { value: FILTER_EXPIRED, label: 'Expired' },
      ...sorted.map(s => ({ value: s.id, label: staffFullName(s) })),
    ]
  }, [staff, isAllBranches, activeBranchId])

  const statusFilterOptions = useMemo(
    () => [
      { value: 'all', label: 'All statuses' },
      ...ALL_STATUSES.map(s => ({ value: s, label: prettyStatus(s) })),
    ],
    [],
  )

  /* ── Filtering ───────────────────────────────────────────────── */

  const filtered = useMemo(() => {
    return dayAppts.filter(a => {
      if (filterStaff === FILTER_NOSHOW) {
        if (a.status !== 'NO_SHOW') return false
      } else if (filterStaff === FILTER_EXPIRED) {
        if (a.status !== 'EXPIRED') return false
      } else if (filterStaff !== FILTER_ALL) {
        // The staff ref uses `id` on the payload; `staffId` is a
        // transitional alias on the type. Accept either.
        const ref = appointmentStaff(a)
        const refId = ref?.id ?? ref?.staffId
        if (!ref || refId !== filterStaff) return false
      }
      if (filterStatus !== 'all' && a.status !== filterStatus) return false
      return true
    })
  }, [dayAppts, filterStaff, filterStatus])

  /* ── Navigation ──────────────────────────────────────────────── */

  const prevDay = () => setSelectedDate(d => new Date(d.getTime() - 86400000))
  const nextDay = () => setSelectedDate(d => new Date(d.getTime() + 86400000))
  const goToday = () => setSelectedDate(new Date())

  const formattedDate = selectedDate.toLocaleDateString('en-GB', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  })

  /* ── Stats ───────────────────────────────────────────────────── */

  const todayRevenue = useMemo(
    () =>
      dayAppts
        .filter(a => a.status === 'COMPLETED')
        .reduce((sum, a) => sum + Number(a.totalAmount || 0), 0),
    [dayAppts],
  )

  const pendingCount = dayAppts.filter(a => a.status === 'PENDING').length

  /* ── Render ──────────────────────────────────────────────────── */

  return (
    <div className="flex flex-col h-full">
      {/* ── Page header ──────────────────────────────────────────── */}
      <div className="px-3 sm:px-6 lg:px-8 py-4 sm:py-5 bg-surface border-b border-line flex-shrink-0">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-4 sm:mb-5">
          <div className="min-w-0">
            <h2 className="font-display text-xl sm:text-2xl lg:text-[1.75rem] text-ink leading-none">
              Bookings
            </h2>
            <p className="text-ink-3 text-xs sm:text-sm mt-1.5">
              Manage your appointments and daily schedule.
            </p>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <Button variant="secondary" onClick={onWalkIn} size="sm">
              <PlusIcon /> Walk-in
            </Button>
            <Button onClick={onNewBooking} size="sm">
              <PlusIcon /> New Booking
            </Button>
          </div>
        </div>

        {/* Stat chips */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mb-4 sm:mb-5">
          <StatChip label="Today" value={String(dayAppts.length)} unit="appointments" />
          <div className="hidden sm:block w-px h-5 bg-line" />
          <StatChip label="Revenue" value={todayRevenue.toLocaleString()} unit="ETB" />
          <div className="hidden sm:block w-px h-5 bg-line" />
          <StatChip label="Pending" value={String(pendingCount)} unit="to confirm" />

          <div className="relative ml-auto">
            <button
              type="button"
              onClick={() => setShowLegend(v => !v)}
              aria-label="Status legend"
              className="w-7 h-7 rounded-full border border-line text-ink-3 hover:text-ink hover:bg-warm-subtle flex items-center justify-center transition-colors"
            >
              <HelpIcon />
            </button>
            {showLegend && (
              <LegendPopover onClose={() => setShowLegend(false)} />
            )}
          </div>
        </div>

        {/* Controls */}
        <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-3">
          {/* Date nav */}
          <div className="flex items-center gap-2 min-w-0 xl:flex-shrink-0">
            <button
              onClick={prevDay}
              aria-label="Previous day"
              className="w-8 h-8 rounded-lg border border-line flex items-center justify-center text-ink-3 hover:bg-bg hover:text-ink transition-colors flex-shrink-0"
            >
              <ChevronLeft />
            </button>

            <div className="relative flex-1 min-w-0 xl:flex-none">
              <button
                type="button"
                onClick={() => setShowDatePicker(v => !v)}
                className="
                  w-full h-8 px-3 rounded-lg border border-line bg-surface
                  text-sm font-medium text-ink text-center truncate
                  hover:bg-warm-subtle transition-colors
                  xl:min-w-[220px]
                "
                aria-haspopup="dialog"
                aria-expanded={showDatePicker}
              >
                {formattedDate}
              </button>
              {showDatePicker && (
                <DatePickerPopover
                  value={selectedDate}
                  timezone={timezone}
                  onChange={d => {
                    setSelectedDate(d)
                    setShowDatePicker(false)
                  }}
                  onClose={() => setShowDatePicker(false)}
                />
              )}
            </div>

            <button
              onClick={nextDay}
              aria-label="Next day"
              className="w-8 h-8 rounded-lg border border-line flex items-center justify-center text-ink-3 hover:bg-bg hover:text-ink transition-colors flex-shrink-0"
            >
              <ChevronRight />
            </button>

            {!isToday && (
              <button
                onClick={goToday}
                className="text-xs text-ink-3 hover:text-ink transition-colors border border-line rounded-lg px-2.5 h-8 flex-shrink-0"
              >
                Today
              </button>
            )}
          </div>

          {/* Filters + view switcher */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 min-w-0 xl:flex-shrink-0">
            <div className="grid grid-cols-2 sm:flex sm:items-center gap-2 min-w-0">
              <div className="min-w-0 sm:w-[150px] xl:w-[170px]">
                <StyledSelect
                  value={filterStaff}
                  onChange={setFilterStaff}
                  options={staffFilterOptions}
                  compact
                />
              </div>
              <div className="min-w-0 sm:w-[140px] xl:w-[160px]">
                <StyledSelect
                  value={filterStatus}
                  onChange={v => setFilterStatus(v as 'all' | AppointmentStatus)}
                  options={statusFilterOptions}
                  compact
                />
              </div>
            </div>
            <div className="flex border border-line rounded-xl overflow-hidden flex-shrink-0 self-start sm:self-auto">
              {(['day', 'week', 'list'] as CalendarView[]).map(v => (
                <button
                  key={v}
                  onClick={() => setView(v)}
                  className={`h-8 px-3 text-xs font-medium transition-colors ${
                    view === v
                      ? 'bg-ink text-surface'
                      : 'text-ink-3 hover:text-ink hover:bg-warm-subtle'
                  }`}
                >
                  {v.charAt(0).toUpperCase() + v.slice(1)}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── Calendar content ─────────────────────────────────────── */}
      <div className="flex-1 overflow-hidden">
        {view === 'day' && (
          <DayView
            appointments={filtered}
            customers={customers}
            branches={branches}
            timezone={timezone}
            showBranch={showBranchOnCards}
            onSelect={onSelectAppointment}
          />
        )}
        {view === 'week' && (
          <WeekView
            appointments={branchScopedAppointments}
            customers={customers}
            timezone={timezone}
            selectedDate={selectedDate}
            onSelectDate={setSelectedDate}
            onSelect={onSelectAppointment}
          />
        )}
        {view === 'list' && (
          <ListView
            appointments={filtered}
            customers={customers}
            branches={branches}
            timezone={timezone}
            showBranch={showBranchOnCards}
            onSelect={onSelectAppointment}
            formattedDate={formattedDate}
          />
        )}
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Stat chip                                                          */
/* ------------------------------------------------------------------ */

function StatChip({ label, value, unit }: { label: string; value: string; unit: string }) {
  return (
    <div className="flex items-baseline gap-1.5">
      <span className="text-xs text-ink-3">{label}</span>
      <span className="text-sm font-semibold text-ink">{value}</span>
      <span className="text-xs text-ink-3">{unit}</span>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Date picker popover                                                */
/* ------------------------------------------------------------------ */

function DatePickerPopover({
  value,
  timezone,
  onChange,
  onClose,
}: {
  value: Date
  timezone: string
  onChange: (d: Date) => void
  onClose: () => void
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [viewMonth, setViewMonth] = useState(() => {
    const d = new Date(value)
    d.setDate(1)
    return d
  })

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    function onEsc(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onEsc)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('keydown', onEsc)
    }
  }, [onClose])

  const todayStr = todayISO(timezone)
  const valueStr = localDateISO(value.toISOString(), timezone)

  const firstOfMonth = new Date(viewMonth)
  const startWeekday = (firstOfMonth.getDay() + 6) % 7
  const daysInMonth = new Date(
    firstOfMonth.getFullYear(),
    firstOfMonth.getMonth() + 1,
    0,
  ).getDate()
  const grid: Array<Date | null> = [
    ...Array.from({ length: startWeekday }, () => null),
    ...Array.from(
      { length: daysInMonth },
      (_, i) => new Date(viewMonth.getFullYear(), viewMonth.getMonth(), i + 1),
    ),
  ]
  while (grid.length % 7 !== 0) grid.push(null)

  const monthLabel = viewMonth.toLocaleDateString('en-GB', {
    month: 'long',
    year: 'numeric',
  })

  function prevMonth() {
    setViewMonth(m => {
      const d = new Date(m)
      d.setMonth(d.getMonth() - 1)
      return d
    })
  }
  function nextMonth() {
    setViewMonth(m => {
      const d = new Date(m)
      d.setMonth(d.getMonth() + 1)
      return d
    })
  }

  return (
    <div
      ref={ref}
      className="
        absolute left-0 top-10 z-40
        w-[280px] p-3
        bg-surface rounded-2xl border border-line shadow-lg
      "
    >
      <div className="flex items-center justify-between mb-2">
        <button
          type="button"
          onClick={prevMonth}
          className="w-7 h-7 rounded-lg flex items-center justify-center text-ink-3 hover:bg-warm-subtle hover:text-ink transition-colors"
          aria-label="Previous month"
        >
          <ChevronLeft />
        </button>
        <p className="text-sm font-semibold text-ink">{monthLabel}</p>
        <button
          type="button"
          onClick={nextMonth}
          className="w-7 h-7 rounded-lg flex items-center justify-center text-ink-3 hover:bg-warm-subtle hover:text-ink transition-colors"
          aria-label="Next month"
        >
          <ChevronRight />
        </button>
      </div>

      <div className="grid grid-cols-7 mb-1">
        {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => (
          <span key={i} className="text-[10px] text-ink-3 font-medium text-center py-1">
            {d}
          </span>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-0.5">
        {grid.map((d, i) => {
          if (!d) return <span key={i} />
          const dStr = localDateISO(d.toISOString(), timezone)
          const isSelected = dStr === valueStr
          const isTodayCell = dStr === todayStr
          return (
            <button
              key={i}
              type="button"
              onClick={() => onChange(d)}
              className={`
                h-8 rounded-lg text-xs font-medium transition-colors
                ${isSelected
                  ? 'bg-ink text-surface'
                  : isTodayCell
                    ? 'bg-warm-subtle text-ink'
                    : 'text-ink-2 hover:bg-warm-subtle hover:text-ink'}
              `}
            >
              {d.getDate()}
            </button>
          )
        })}
      </div>

      <div className="flex items-center justify-between mt-2 pt-2 border-t border-line">
        <button
          type="button"
          onClick={() => onChange(new Date())}
          className="text-xs text-ink-3 hover:text-ink"
        >
          Today
        </button>
        <button
          type="button"
          onClick={onClose}
          className="text-xs text-ink-3 hover:text-ink"
        >
          Close
        </button>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Legend popover                                                     */
/* ------------------------------------------------------------------ */

function LegendPopover({ onClose }: { onClose: () => void }) {
  const statuses: AppointmentStatus[] = [
    'PENDING',
    'CONFIRMED',
    'CHECKED_IN',
    'IN_PROGRESS',
    'COMPLETED',
    'CANCELLED',
    'NO_SHOW',
    'EXPIRED',
  ]
  return (
    <>
      <div className="fixed inset-0 z-30" onClick={onClose} aria-hidden="true" />
      <div className="absolute right-0 top-9 z-40 w-64 bg-surface rounded-2xl border border-line shadow-lg p-4">
        <p className="text-[10px] font-semibold text-ink-3 uppercase tracking-wider mb-3">
          Status colors
        </p>
        <div className="flex flex-col gap-2.5">
          {statuses.map(s => {
            const cfg = getStatusConfig(s)
            return (
              <div key={s} className="flex items-center gap-3">
                <span
                  className="w-3 h-3 rounded-full flex-shrink-0"
                  style={{ backgroundColor: cfg.dot }}
                />
                <span className="text-sm text-ink-2">{prettyStatus(s)}</span>
              </div>
            )
          })}
        </div>
      </div>
    </>
  )
}

/* ------------------------------------------------------------------ */
/*  Day view                                                           */
/* ------------------------------------------------------------------ */

function DayView({
  appointments,
  customers,
  branches,
  timezone,
  showBranch,
  onSelect,
}: {
  appointments: Appointment[]
  customers: Customer[]
  branches: Branch[]
  timezone: string
  showBranch: boolean
  onSelect: (a: Appointment) => void
}) {
  const totalH = HOURS.length * HOUR_HEIGHT

  function topFromHHmm(hhmm: string): number {
    const [h, m] = hhmm.split(':').map(Number)
    return ((h - CALENDAR_START) + m / 60) * HOUR_HEIGHT
  }

  function heightFromMinutes(duration: number): number {
    return Math.max((duration / 60) * HOUR_HEIGHT, 34)
  }

  return (
    <div className="h-full overflow-y-auto bg-bg">
      {appointments.length === 0 ? (
        <EmptyDay />
      ) : (
        <div className="flex w-full min-w-0" style={{ minHeight: totalH + 48 }}>
          <div
            className="w-14 sm:w-16 flex-shrink-0 bg-surface border-r border-line relative"
            style={{ height: totalH + 48 }}
          >
            <div className="h-8" />
            {HOURS.map(h => (
              <div
                key={h}
                className="absolute flex justify-end pr-2 sm:pr-3 w-full"
                style={{ top: (h - CALENDAR_START) * HOUR_HEIGHT + 32 }}
              >
                <span className="text-[11px] text-ink-3 -translate-y-2.5">
                  {h === 12 ? '12 PM' : h > 12 ? `${h - 12} PM` : `${h} AM`}
                </span>
              </div>
            ))}
          </div>

          <div className="flex-1 min-w-0 relative" style={{ height: totalH + 48 }}>
            <div className="h-8" />
            {HOURS.map(h => (
              <div
                key={h}
                className="absolute left-0 right-0 border-t border-line"
                style={{ top: (h - CALENDAR_START) * HOUR_HEIGHT + 32 }}
              />
            ))}
            {HOURS.map(h => (
              <div
                key={`hf-${h}`}
                className="absolute left-0 right-0 border-t border-line/30"
                style={{ top: (h - CALENDAR_START) * HOUR_HEIGHT + HOUR_HEIGHT / 2 + 32 }}
              />
            ))}

            <CurrentTime />

            {appointments.map(appt => {
              const startHHmm = localHHmm(appt.scheduledStart, timezone)
              const t = topFromHHmm(startHHmm)
              const dur = durationMinutes(appt)
              const ht = heightFromMinutes(dur)
              const cfg = getStatusConfig(appt.status)
              const compact = ht <= 50
              const name = customerLabel(appt, customers)
              const staff = primaryStaffLabel(appt)
              const price = Number(appt.totalAmount || 0)
              const branch = showBranch ? branchLabel(appt, branches) : null

              return (
                <div
                  key={appt.id}
                  onClick={() => onSelect(appt)}
                  className="absolute left-2 right-2 sm:left-4 sm:right-4 rounded-xl cursor-pointer overflow-hidden group transition-all duration-100 hover:shadow-md"
                  style={{
                    top: t + 32,
                    height: ht,
                    backgroundColor: cfg.bg,
                    borderLeft: `3px solid ${cfg.dot}`,
                  }}
                >
                  <div className="px-3 py-2 h-full flex flex-col justify-center">
                    {compact ? (
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-xs font-semibold truncate" style={{ color: cfg.text }}>
                          {name}
                        </span>
                        <span className="text-xs opacity-70 truncate" style={{ color: cfg.text }}>
                          {appt.service.name}
                        </span>
                      </div>
                    ) : (
                      <>
                        <p className="text-sm font-semibold leading-tight truncate" style={{ color: cfg.text }}>
                          {name}
                        </p>
                        <p className="text-xs opacity-75 truncate mt-0.5" style={{ color: cfg.text }}>
                          {appt.service.name}
                        </p>
                        <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                          <span className="text-[11px] opacity-60" style={{ color: cfg.text }}>
                            {startHHmm} · {staff}
                          </span>
                          {ht >= 70 && branch && (
                            <span className="text-[11px] opacity-55" style={{ color: cfg.text }}>
                              {branch}
                            </span>
                          )}
                          {ht >= 90 && (
                            <span className="text-[11px] opacity-55" style={{ color: cfg.text }}>
                              {price.toLocaleString()} ETB
                            </span>
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
    <div
      className="absolute left-0 right-0 pointer-events-none z-10 flex items-center"
      style={{ top: t }}
    >
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
          <rect x="3" y="4" width="18" height="18" rx="2" />
          <path d="M16 2v4M8 2v4M3 10h18" />
        </svg>
      </div>
      <p className="font-display text-xl text-ink mb-1">No appointments today</p>
      <p className="text-ink-3 text-sm">Your schedule is clear.</p>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Week view                                                          */
/* ------------------------------------------------------------------ */

function WeekView({
  appointments,
  customers,
  timezone,
  selectedDate,
  onSelectDate,
  onSelect,
}: {
  appointments: Appointment[]
  customers: Customer[]
  timezone: string
  selectedDate: Date
  onSelectDate: (d: Date) => void
  onSelect: (a: Appointment) => void
}) {
  const start = new Date(selectedDate)
  start.setDate(selectedDate.getDate() - ((selectedDate.getDay() + 6) % 7))
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start)
    d.setDate(start.getDate() + i)
    return d
  })
  const todayStr = todayISO(timezone)

  return (
    <div className="h-full w-full overflow-y-auto bg-bg flex flex-col">
      <div className="grid grid-cols-7 border-b border-line bg-surface flex-shrink-0">
        {days.map(d => {
          const ds = localDateISO(d.toISOString(), timezone)
          const isToday = ds === todayStr
          const count = appointments.filter(
            a => localDateISO(a.scheduledStart, timezone) === ds,
          ).length
          return (
            <button
              key={ds}
              onClick={() => onSelectDate(new Date(d))}
              className={`py-2 sm:py-3 text-center border-r border-line last:border-0 hover:bg-warm-subtle transition-colors ${
                isToday ? 'bg-warm-subtle' : ''
              }`}
            >
              <p className="text-[10px] sm:text-[11px] text-ink-3 uppercase tracking-wider">
                {d.toLocaleDateString('en-GB', { weekday: 'short' })}
              </p>
              <p className={`text-base sm:text-lg font-semibold mt-0.5 ${isToday ? 'text-ink' : 'text-ink-2'}`}>
                {d.getDate()}
              </p>
              {count > 0 && (
                <p className="hidden sm:block text-[11px] text-ink-3 mt-0.5">
                  {count} appt{count !== 1 ? 's' : ''}
                </p>
              )}
            </button>
          )
        })}
      </div>
      <div className="flex-1 grid grid-cols-7 divide-x divide-line">
        {days.map(d => {
          const ds = localDateISO(d.toISOString(), timezone)
          const appts = appointments
            .filter(a => localDateISO(a.scheduledStart, timezone) === ds)
            .sort(
              (a, b) =>
                new Date(a.scheduledStart).getTime() -
                new Date(b.scheduledStart).getTime(),
            )
          return (
            <div key={ds} className="p-1.5 sm:p-2 flex flex-col gap-1.5 overflow-y-auto">
              {appts.map(a => {
                const cfg = getStatusConfig(a.status)
                const startHHmm = localHHmm(a.scheduledStart, timezone)
                const name = customerLabel(a, customers)
                return (
                  <button
                    key={a.id}
                    onClick={() => onSelect(a)}
                    className="text-left p-1.5 sm:p-2 rounded-lg w-full transition-all hover:shadow-sm"
                    style={{ backgroundColor: cfg.bg, borderLeft: `2px solid ${cfg.dot}` }}
                  >
                    <p className="text-[11px] font-semibold" style={{ color: cfg.text }}>
                      {startHHmm}
                    </p>
                    <p
                      className="text-[10px] sm:text-[11px] truncate mt-0.5"
                      style={{ color: cfg.text, opacity: 0.85 }}
                    >
                      {name}
                    </p>
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

/* ------------------------------------------------------------------ */
/*  List view                                                          */
/* ------------------------------------------------------------------ */

function ListView({
  appointments,
  customers,
  branches,
  timezone,
  showBranch,
  onSelect,
  formattedDate,
}: {
  appointments: Appointment[]
  customers: Customer[]
  branches: Branch[]
  timezone: string
  showBranch: boolean
  onSelect: (a: Appointment) => void
  formattedDate: string
}) {
  const sorted = useMemo(
    () =>
      [...appointments].sort(
        (a, b) =>
          new Date(a.scheduledStart).getTime() -
          new Date(b.scheduledStart).getTime(),
      ),
    [appointments],
  )

  return (
    <div className="h-full overflow-y-auto p-4 sm:p-6 lg:p-8">
      <p className="text-xs text-ink-3 uppercase tracking-wider mb-5">
        {formattedDate}
      </p>
      {sorted.length === 0 ? (
        <div className="text-center py-16">
          <p className="font-display text-xl text-ink mb-1">No appointments</p>
          <p className="text-ink-3 text-sm">Schedule is clear for this day.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2 max-w-2xl">
          {sorted.map(a => {
            const cfg = getStatusConfig(a.status)
            const startHHmm = localHHmm(a.scheduledStart, timezone)
            const endHHmm = localHHmm(a.scheduledEnd, timezone)
            const name = customerLabel(a, customers)
            const staff = primaryStaffLabel(a)
            const price = Number(a.totalAmount || 0)
            const branch = showBranch ? branchLabel(a, branches) : null
            const meta = [a.service.name, staff, branch].filter(Boolean).join(' · ')

            return (
              <button
                key={a.id}
                onClick={() => onSelect(a)}
                className="flex items-center gap-3 sm:gap-5 p-3 sm:p-4 bg-surface rounded-2xl border border-line hover:border-warm transition-all text-left w-full group"
              >
                <div className="text-right w-[60px] sm:w-[72px] flex-shrink-0">
                  <p className="text-sm font-semibold text-ink">{startHHmm}</p>
                  <p className="text-xs text-ink-3 mt-0.5">{endHHmm}</p>
                </div>
                <div className="w-px h-8 bg-line flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-ink text-sm truncate">{name}</p>
                  <p className="text-ink-3 text-xs mt-0.5 truncate">{meta}</p>
                </div>
                <div className="hidden sm:flex items-center gap-4 flex-shrink-0">
                  <span className="text-sm font-semibold text-ink-2">
                    {price.toLocaleString()} ETB
                  </span>
                  <span
                    className="text-xs font-medium px-2.5 py-1 rounded-full"
                    style={{ backgroundColor: cfg.bg, color: cfg.text }}
                  >
                    {cfg.label}
                  </span>
                </div>
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  className="text-ink-3 group-hover:text-ink transition-colors flex-shrink-0"
                >
                  <path d="M9 18l6-6-6-6" />
                </svg>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Icons                                                              */
/* ------------------------------------------------------------------ */

function PlusIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
      <path d="M12 5v14M5 12h14" />
    </svg>
  )
}
function ChevronLeft() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M15 18l-6-6 6-6" />
    </svg>
  )
}
function ChevronRight() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M9 18l6-6-6-6" />
    </svg>
  )
}
function HelpIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="10" />
      <path d="M9.09 9a3 3 0 015.83 1c0 2-3 3-3 3" />
      <path d="M12 17h.01" />
    </svg>
  )
}