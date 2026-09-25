// src/components/dashboard/DashboardPage.tsx

import { useEffect, useMemo, useState } from 'react'
import type {
  Appointment as ApiAppointment,
  BusinessConfig,
} from '../../types/api'
import type {
  Appointment,
  Customer,
  FeedbackItem,
  Transaction,
  Branch,
} from '../../types'
import { businessApi } from '../../api/business.api'
import { appointmentsApi } from '../../api/appointments.api'
import { useBusiness } from '../../contexts/BusinessContext'
import { useBranch, ALL_BRANCHES } from '../../contexts/BranchContext'

interface DashboardPageProps {
  appointments: Appointment[]
  customers: Customer[]
  feedback: FeedbackItem[]
  transactions: Transaction[]
  branches: Branch[]
  onNavigate: (section: string) => void
  onNewBooking: () => void
  onWalkIn: () => void
  onAddExpense: () => void
}

export function DashboardPage({
  appointments, customers, feedback, transactions, branches: branchesProp,
  onNavigate, onNewBooking, onWalkIn, onAddExpense,
}: DashboardPageProps) {
  const { activeBusinessId } = useBusiness()
  const {
    branches: branchesCtx,
    activeBranchId,
    activeBranchFilter,
    loading: branchesLoading,
  } = useBranch()

  /* ------------------------------------------------------------------ */
  /*  Prefer context branches; fall back to the prop.                    */
  /* ------------------------------------------------------------------ */

  const branches = branchesCtx.length > 0 ? branchesCtx : branchesProp

  /* ------------------------------------------------------------------ */
  /*  Live business config — greeting + currency come from here.         */
  /* ------------------------------------------------------------------ */

  const [config, setConfig] = useState<BusinessConfig | null>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const res = await businessApi.me()
        if (!cancelled) setConfig(res)
      } catch (err) {
        console.warn('[dashboard] businessApi.me failed', err)
      }
    })()
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeBusinessId])

  const businessName = config?.name ?? 'your salon'
  const currency = config?.currency ?? 'ETB'

  /* ------------------------------------------------------------------ */
  /*  Live appointments for TODAY from the API.                          */
  /*                                                                     */
  /*  Filtered by the ACTIVE BRANCH when the user has picked one.        */
  /*  When the filter is "all", the whole business is queried.           */
  /* ------------------------------------------------------------------ */

  const todayStr = useMemo(
    () => new Date().toISOString().split('T')[0],
    [],
  )

  const [liveToday, setLiveToday] = useState<ApiAppointment[] | null>(null)

  useEffect(() => {
    if (!activeBusinessId) return
    let cancelled = false

    const dayStart = new Date()
    dayStart.setHours(0, 0, 0, 0)
    const dayEnd = new Date(dayStart)
    dayEnd.setDate(dayEnd.getDate() + 1)

    ;(async () => {
      try {
        const res = await appointmentsApi.list(activeBusinessId, {
          branchId: activeBranchFilter,
          startDate: dayStart.toISOString(),
          endDate: dayEnd.toISOString(),
          limit: 100,
        })

        const list = unwrapArray<ApiAppointment>(res)
        if (!cancelled) setLiveToday(list)
      } catch (err) {
        console.warn('[dashboard] appointmentsApi.list failed', err)
        if (!cancelled) setLiveToday(null)
      }
    })()

    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeBusinessId, activeBranchFilter])

  /**
   * Normalize a server appointment into the UI's `Appointment` shape.
   * Time fields (`startTime`, `endTime`) are normalized to **12-hour
   * AM/PM strings** (e.g. `9:00 AM`) so the dashboard renders them
   * consistently without any 24-hour values leaking through.
   */
  function normalizeForUi(a: ApiAppointment): Appointment {
    const start = new Date(a.scheduledStart)
    const end = new Date(a.scheduledEnd)

    const localDate = toLocalISODate(start)
    const startHHmm = hhmmFromDate(start)
    const endHHmm = hhmmFromDate(end)

    const customer = a.customer
      ? `${a.customer.firstName} ${a.customer.lastName}`.trim()
      : '—'

    const customerPhone =
      a.customer?.phones?.find(p => p.isPrimary)?.phone
      ?? a.customer?.phones?.[0]?.phone
      ?? ''

    const staff = a.staff
      ? `${a.staff.firstName} ${a.staff.lastName}`.trim()
      : '—'

    const duration =
      Number.isFinite(start.getTime()) && Number.isFinite(end.getTime())
        ? Math.max(0, Math.round((end.getTime() - start.getTime()) / 60000))
        : a.service.durationMinutes

    const branchName = branches.find(b => b.id === a.branchId)?.name ?? '—'

    const paymentStatus: string =
      a.depositAmount == null && Number(a.totalAmount) > 0
        ? 'unpaid'
        : a.depositAmount != null
          ? 'partial'
          : 'unknown'

    return {
      id: a.id,
      branchId: a.branchId,
      branchName,
      customerId: a.customerId,
      customerName: customer,
      customerPhone,
      staffId: a.staff?.id ?? '',
      staffName: staff,
      serviceId: a.service.id,
      serviceName: a.service.name,
      customTitle: undefined,
      date: localDate,
      startTime: to12h(startHHmm),
      endTime: to12h(endHHmm),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ...({ startTime24: startHHmm } as any),
      duration,
      price: Number(a.totalAmount) || 0,
      paymentStatus,
      status: toUiStatus(a.status),
      notes: a.notes ?? undefined,
    } as Appointment
  }

  /**
   * `todayAppts` prefers the live API list; falls back to the prop.
   *
   * When the branch context is filtering by a specific branch, the
   * prop-based fallback is also filtered by that branch id, so both
   * the live and fallback paths respect the active filter.
   */
  const todayAppts = useMemo<Appointment[]>(() => {
    const source: Appointment[] = Array.isArray(liveToday)
      ? liveToday.map(normalizeForUi)
      : appointments.filter(a =>
          a.date === todayStr &&
          (activeBranchFilter == null || a.branchId === activeBranchFilter),
        )

    return source
      .slice()
      .sort((a, b) => {
        const at = (a as any).startTime24 ?? parse12h(a.startTime)
        const bt = (b as any).startTime24 ?? parse12h(b.startTime)
        return at.localeCompare(bt)
      })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [liveToday, appointments, todayStr, activeBranchFilter])

  /* ------------------------------------------------------------------ */
  /*  Derived metrics                                                    */
  /*                                                                     */
  /*  Transactions, customers, and feedback are all prop-fed, so when    */
  /*  a branch is active we filter them locally to match.                */
  /* ------------------------------------------------------------------ */

  const filteredTransactions = useMemo(
    () =>
      activeBranchFilter == null
        ? transactions
        : transactions.filter(t => t.branchId === activeBranchFilter),
    [transactions, activeBranchFilter],
  )

  const filteredAppointments = useMemo(
    () =>
      activeBranchFilter == null
        ? appointments
        : appointments.filter(a => a.branchId === activeBranchFilter),
    [appointments, activeBranchFilter],
  )

  // Customers are business-wide; we don't have a branchId on them, so
  // they're not filtered. Debtors are derived from customer records
  // which are already scoped by the API layer for non-admin roles.
  const todayRevenue = filteredTransactions
    .filter(t => t.type === 'revenue' && t.date === todayStr)
    .reduce((s, t) => s + (t.amountPaid ?? t.amount), 0)

  const outstanding = customers.reduce(
    (s, c) => s + (c.outstandingBalance ?? 0),
    0,
  )

  const avgRating = feedback.length
    ? (feedback.reduce((s, f) => s + f.overallRating, 0) / feedback.length).toFixed(1)
    : '—'

  const debtors = customers.filter(c => (c.outstandingBalance ?? 0) > 0)

  /* 7-day revenue chart data */
  const chartDays: { label: string; value: number }[] = []
  for (let i = 6; i >= 0; i--) {
    const d = new Date()
    d.setDate(d.getDate() - i)
    const ds = toLocalISODate(d)
    chartDays.push({
      label: d.toLocaleDateString('en', { weekday: 'short' }),
      value: filteredTransactions
        .filter(t => t.type === 'revenue' && t.date === ds)
        .reduce((s, t) => s + (t.amountPaid ?? t.amount), 0),
    })
  }
  const chartMax = Math.max(...chartDays.map(d => d.value), 1)

  const recentFeedback = [...feedback]
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 3)

  const hour = new Date().getHours()
  const greeting =
    hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'

  /* Active-branch display name for the header subtitle. */
  const activeBranchName =
    activeBranchId === ALL_BRANCHES
      ? null
      : branches.find(b => b.id === activeBranchId)?.name ?? null

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="px-4 sm:px-6 lg:px-8 py-4 sm:py-5 bg-surface border-b border-line flex-shrink-0">
        <h2 className="font-display text-xl sm:text-2xl lg:text-[1.75rem] text-ink leading-none mb-1">
          {greeting}, {businessName}.
        </h2>
        <p className="text-ink-3 text-xs sm:text-sm">
          {activeBranchName ? (
            <>
              Here's what's happening at{' '}
              <span className="text-ink-2 font-medium">{activeBranchName}</span>{' '}
              today.
            </>
          ) : (
            <>Here's what's happening today.</>
          )}
        </p>
      </div>

      <div className="flex-1 overflow-y-auto px-4 sm:px-6 lg:px-8 py-5 sm:py-6">
        {/* Key metrics */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6 sm:mb-8">
          {[
            {
              label: "Today's appointments",
              value: String(todayAppts.length),
              sub: `${todayAppts.filter(a => a.status === 'completed').length} completed`,
            },
            {
              label: "Today's revenue",
              value: `${fmt(todayRevenue)} ${currency}`,
              sub: 'collected today',
            },
            {
              label: 'Outstanding',
              value: `${fmt(outstanding)} ${currency}`,
              sub: `${debtors.length} customer${debtors.length !== 1 ? 's' : ''}`,
            },
            {
              label: 'Average rating',
              value: `${avgRating} ★`,
              sub: `${feedback.length} reviews`,
            },
          ].map(m => (
            <div
              key={m.label}
              className="bg-surface rounded-2xl border border-line px-4 sm:px-6 py-4 sm:py-5 min-w-0"
            >
              <p className="text-[11px] sm:text-xs text-ink-3 mb-2 truncate">
                {m.label}
              </p>
              <p className="font-display text-lg sm:text-xl lg:text-2xl text-ink truncate">
                {m.value}
              </p>
              <p className="text-[11px] sm:text-xs text-ink-3 mt-1 truncate">
                {m.sub}
              </p>
            </div>
          ))}
        </div>

        {/* Quick actions */}
        <div className="flex items-center gap-2 mb-6 sm:mb-8 overflow-x-auto pb-1 -mx-4 px-4 sm:mx-0 sm:px-0 sm:pb-0 sm:flex-wrap">
          <button
            onClick={onNewBooking}
            className="flex items-center gap-2 px-3 sm:px-4 py-2 sm:py-2.5 bg-ink text-surface rounded-xl text-xs sm:text-sm font-medium hover:bg-ink/90 transition-colors flex-shrink-0 whitespace-nowrap"
          >
            <span>+</span> New booking
          </button>
          <button
            onClick={onWalkIn}
            className="flex items-center gap-2 px-3 sm:px-4 py-2 sm:py-2.5 bg-surface border border-line text-ink rounded-xl text-xs sm:text-sm font-medium hover:bg-warm-subtle transition-colors flex-shrink-0 whitespace-nowrap"
          >
            <span>+</span> Walk-in
          </button>
          <button
            onClick={() => onNavigate('customers')}
            className="flex items-center gap-2 px-3 sm:px-4 py-2 sm:py-2.5 bg-surface border border-line text-ink rounded-xl text-xs sm:text-sm font-medium hover:bg-warm-subtle transition-colors flex-shrink-0 whitespace-nowrap"
          >
            <span>+</span> Customer
          </button>
          <button
            onClick={onAddExpense}
            className="flex items-center gap-2 px-3 sm:px-4 py-2 sm:py-2.5 bg-surface border border-line text-ink rounded-xl text-xs sm:text-sm font-medium hover:bg-warm-subtle transition-colors flex-shrink-0 whitespace-nowrap"
          >
            <span>+</span> Expense
          </button>
        </div>

        {/* Main grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 sm:gap-6">
          <div className="lg:col-span-2 flex flex-col gap-5 sm:gap-6 min-w-0">
            {/* Today's appointments */}
            <div className="bg-surface rounded-2xl border border-line overflow-hidden">
              <div className="flex items-center justify-between px-4 sm:px-6 py-3.5 sm:py-4 border-b border-line gap-3">
                <p className="font-medium text-ink text-sm sm:text-base">
                  Today's schedule
                </p>
                <button
                  onClick={() => onNavigate('bookings')}
                  className="text-xs text-ink-3 hover:text-ink transition-colors flex-shrink-0 whitespace-nowrap"
                >
                  View all →
                </button>
              </div>

              {todayAppts.length === 0 ? (
                <div className="py-8 sm:py-10 px-4 text-center">
                  <p className="font-display text-lg sm:text-xl text-ink mb-1">
                    No appointments today
                  </p>
                  <p className="text-ink-3 text-xs sm:text-sm mb-4">
                    {activeBranchName
                      ? `No bookings at ${activeBranchName} yet.`
                      : 'Your calendar is clear.'}
                  </p>
                  <button
                    onClick={onNewBooking}
                    className="px-4 py-2 bg-ink text-surface rounded-xl text-sm font-medium hover:bg-ink/90 transition-colors"
                  >
                    + New booking
                  </button>
                </div>
              ) : (
                <div className="divide-y divide-line">
                  {todayAppts.map(a => (
                    <div
                      key={a.id}
                      className="flex items-center gap-3 sm:gap-4 px-4 sm:px-6 py-3 sm:py-3.5"
                    >
                      <span className="text-xs sm:text-sm font-medium text-ink-3 w-16 flex-shrink-0 tabular-nums">
                        {a.startTime}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-ink truncate">
                          {a.customTitle ?? a.serviceName}
                        </p>
                        <p className="text-xs text-ink-3 truncate">
                          {a.customerName} · {a.staffName}
                        </p>
                      </div>
                      <StatusPill status={a.status} />
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Revenue chart */}
            <div className="bg-surface rounded-2xl border border-line p-4 sm:p-6">
              <div className="flex items-center justify-between mb-4 sm:mb-5 gap-3">
                <div className="min-w-0">
                  <p className="font-medium text-ink text-sm sm:text-base">
                    Revenue — last 7 days
                  </p>
                  <p className="text-xs text-ink-3 mt-0.5">
                    {activeBranchName
                      ? `Daily collection at ${activeBranchName} in ${currency}`
                      : `Daily collection in ${currency}`}
                  </p>
                </div>
              </div>
              <div className="flex items-end gap-1.5 sm:gap-2 h-20 sm:h-24">
                {chartDays.map((d, i) => {
                  const pct =
                    d.value > 0 ? Math.max((d.value / chartMax) * 100, 6) : 0
                  const isToday = i === 6
                  return (
                    <div
                      key={i}
                      className="flex-1 flex flex-col items-center gap-1 sm:gap-1.5 min-w-0"
                    >
                      <div
                        className="w-full flex items-end"
                        style={{ height: '80px' }}
                      >
                        <div
                          className={`w-full rounded-t-lg transition-all ${
                            isToday ? 'bg-ink' : 'bg-warm-subtle'
                          }`}
                          style={{ height: `${pct}%` }}
                          title={`${d.label}: ${fmt(d.value)} ${currency}`}
                        />
                      </div>
                      <span
                        className={`text-[10px] ${
                          isToday ? 'font-semibold text-ink' : 'text-ink-3'
                        }`}
                      >
                        {d.label}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Branch overview — only when viewing "all" and there are 2+ branches */}
            {branches.length > 1 && activeBranchId === ALL_BRANCHES && (
              <div className="bg-surface rounded-2xl border border-line overflow-hidden">
                <div className="px-4 sm:px-6 py-3.5 sm:py-4 border-b border-line">
                  <p className="font-medium text-ink text-sm sm:text-base">
                    Branch overview
                  </p>
                </div>
                <div className="divide-y divide-line">
                  {branches.map(b => {
                    const bAppts = todayAppts.filter(a => a.branchId === b.id)
                    const bRev = transactions
                      .filter(t => t.branchId === b.id && t.type === 'revenue')
                      .reduce((s, t) => s + (t.amountPaid ?? t.amount), 0)
                    return (
                      <div
                        key={b.id}
                        className="flex items-center justify-between gap-3 px-4 sm:px-6 py-3.5 sm:py-4"
                      >
                        <div className="min-w-0">
                          <p className="font-medium text-ink text-sm truncate">
                            {b.name}
                          </p>
                          <p className="text-xs text-ink-3 truncate">
                            {bAppts.length} appointments today
                          </p>
                        </div>
                        <p className="font-semibold text-ink text-sm flex-shrink-0 tabular-nums">
                          {fmt(bRev)} {currency}
                        </p>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Right column */}
          <div className="flex flex-col gap-5 sm:gap-6 min-w-0">
            {/* Recent feedback */}
            <div className="bg-surface rounded-2xl border border-line overflow-hidden">
              <div className="flex items-center justify-between px-4 sm:px-5 py-3.5 sm:py-4 border-b border-line gap-3">
                <div className="min-w-0">
                  <p className="font-medium text-ink text-sm">Recent feedback</p>
                  <span className="text-[9px] font-semibold text-ink-3 tracking-wider">
                    PRIVATE
                  </span>
                </div>
                <button
                  onClick={() => onNavigate('feedback')}
                  className="text-xs text-ink-3 hover:text-ink transition-colors flex-shrink-0 whitespace-nowrap"
                >
                  View all →
                </button>
              </div>
              <div className="divide-y divide-line">
                {recentFeedback.length === 0 ? (
                  <p className="px-5 py-6 text-sm text-ink-3 text-center">
                    No feedback yet.
                  </p>
                ) : (
                  recentFeedback.map(f => (
                    <div key={f.id} className="px-4 sm:px-5 py-3.5 sm:py-4">
                      <div className="flex items-center gap-1 mb-1">
                        {[1, 2, 3, 4, 5].map(i => (
                          <svg
                            key={i}
                            width="10"
                            height="10"
                            viewBox="0 0 24 24"
                            fill={i <= f.overallRating ? '#C4A97D' : 'none'}
                            stroke="#C4A97D"
                            strokeWidth="1.5"
                          >
                            <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                          </svg>
                        ))}
                      </div>
                      {f.comment && (
                        <p className="text-xs text-ink-2 mb-1 line-clamp-2">
                          "{f.comment}"
                        </p>
                      )}
                      <p className="text-[10px] text-ink-3 truncate">
                        {f.anonymous ? 'Anonymous' : f.customerName} ·{' '}
                        {f.serviceName}
                      </p>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Outstanding payments */}
            {debtors.length > 0 && (
              <div className="bg-surface rounded-2xl border border-line overflow-hidden">
                <div className="flex items-center justify-between px-4 sm:px-5 py-3.5 sm:py-4 border-b border-line gap-3">
                  <p className="font-medium text-ink text-sm">Outstanding</p>
                  <button
                    onClick={() => onNavigate('finance')}
                    className="text-xs text-ink-3 hover:text-ink transition-colors flex-shrink-0 whitespace-nowrap"
                  >
                    View all →
                  </button>
                </div>
                <div className="divide-y divide-line">
                  {debtors.slice(0, 4).map(c => (
                    <div
                      key={c.id}
                      className="flex items-center justify-between gap-3 px-4 sm:px-5 py-3 sm:py-3.5"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-7 h-7 rounded-full bg-warm-subtle flex items-center justify-center text-ink-3 text-xs font-semibold flex-shrink-0">
                          {c.name.slice(0, 2).toUpperCase()}
                        </div>
                        <p className="text-sm text-ink truncate">{c.name}</p>
                      </div>
                      <p className="text-sm font-semibold text-[#B06A6A] flex-shrink-0 tabular-nums">
                        {fmt(c.outstandingBalance ?? 0)}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Status pill                                                        */
/* ------------------------------------------------------------------ */

function StatusPill({ status }: { status: string }) {
  const MAP: Record<string, string> = {
    pending:        'bg-[#F0EBE5] text-[#7A6F68]',
    confirmed:      'bg-[#EAF0EA] text-[#2A6139]',
    'checked-in':   'bg-[#E8F0FB] text-[#1E4D8C]',
    'in-progress':  'bg-[#EBF5FF] text-[#1A5FA8]',
    completed:      'bg-[#EAF0EA] text-[#2A6139]',
    cancelled:      'bg-[#FAEAEA] text-[#B06A6A]',
    'no-show':      'bg-[#F5EAEA] text-[#9B4A4A]',
  }
  const label = status.replace('-', ' ').replace(/\b\w/g, c => c.toUpperCase())
  return (
    <span
      className={`text-[10px] font-semibold px-2 py-1 rounded-full capitalize flex-shrink-0 whitespace-nowrap ${
        MAP[status] ?? 'bg-warm-subtle text-ink-3'
      }`}
    >
      {label}
    </span>
  )
}

/* ------------------------------------------------------------------ */
/*  Time helpers — everything the UI displays is 12-hour AM/PM.        */
/* ------------------------------------------------------------------ */

function pad2(n: number): string {
  return String(n).padStart(2, '0')
}

/** Format a Date as `YYYY-MM-DD` using **local** calendar fields. */
function toLocalISODate(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`
}

/** Extract `HH:mm` (24-hour) from a Date. */
function hhmmFromDate(d: Date): string {
  if (Number.isNaN(d.getTime())) return ''
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`
}

/** Extract `HH:mm` (24-hour) from an ISO datetime string. */
function isoTimeFromIso(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return hhmmFromDate(d)
}

/**
 * Convert a 24-hour `HH:mm` string to a 12-hour `h:mm AM/PM` string.
 */
function to12h(hhmm: string): string {
  const m = hhmm.match(/^(\d{1,2}):(\d{2})$/)
  if (!m) return hhmm
  let h = parseInt(m[1], 10)
  const min = m[2]
  const suffix = h >= 12 ? 'PM' : 'AM'
  if (h === 0) h = 12
  else if (h > 12) h -= 12
  return `${h}:${min} ${suffix}`
}

/**
 * Best-effort parse of a 12-hour or 24-hour string back to a 24-hour
 * `HH:mm` for sorting when the `startTime24` companion field is missing.
 */
function parse12h(value: string): string {
  if (!value) return '00:00'
  const v = value.trim()

  if (/^\d{1,2}:\d{2}$/.test(v) && !/[ap]m/i.test(v)) {
    const [h, m] = v.split(':')
    return `${pad2(parseInt(h, 10))}:${m}`
  }

  const m = v.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i)
  if (!m) return '00:00'
  let h = parseInt(m[1], 10)
  const min = m[2]
  const suffix = m[3].toUpperCase()
  if (suffix === 'AM' && h === 12) h = 0
  else if (suffix === 'PM' && h !== 12) h += 12
  return `${pad2(h)}:${min}`
}

/**
 * Map API `AppointmentStatus` (§12) to the UI's lowercase slug form.
 */
function toUiStatus(s: ApiAppointment['status']): string {
  return s.toLowerCase().replace('_', '-')
}

/**
 * Unwrap an array from any of the shapes the API returns.
 */
function unwrapArray<T>(res: unknown): T[] {
  if (Array.isArray(res)) return res as T[]
  const anyRes = res as any
  if (Array.isArray(anyRes?.data?.data)) return anyRes.data.data as T[]
  if (Array.isArray(anyRes?.data)) return anyRes.data as T[]
  return []
}

function fmt(n: number) {
  return n.toLocaleString('en')
}