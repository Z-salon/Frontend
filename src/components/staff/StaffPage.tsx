// src/components/staff/StaffPage.tsx

import { useEffect, useMemo, useRef, useState } from 'react'
import type {
  Branch,
  Service,
  ServiceCategory,
  Staff,
  StaffDetail,
  StaffStatus,
  StaffServiceQualification,
  StaffTimeOff,
  WeeklySchedule,
  DayOfWeek,
} from '../../types/api'
import { Button, Input, Textarea, Toggle, Modal } from '../ui'
import { EmptyState } from '../services/ServicesPage'
import { useToast } from '../ui/Toast'
import { useBusiness } from '../../contexts/BusinessContext'
import { useBranch } from '../../contexts/BranchContext'
import { staffApi } from '../../api/staff.api'
import { branchesApi } from '../../api/branches.api'
import { servicesApi } from '../../api/services.api'
import { serviceCategoriesApi } from '../../api/service-categories.api'

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const DAY_LABELS = [
  'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday',
] as const

const DAY_LABELS_SHORT = [
  'Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat',
] as const

const DEFAULT_SCHEDULES: WeeklySchedule[] = DAY_LABELS.map((_, i) => ({
  id: `local-${i}`,
  dayOfWeek: i as DayOfWeek,
  isClosed: i === 0,
  intervals:
    i === 0
      ? []
      : [{ startTime: '09:00', endTime: i === 6 ? '17:00' : '18:00' }],
}))

/* ------------------------------------------------------------------ */
/*  Phone + validation helpers                                         */
/* ------------------------------------------------------------------ */

function normalizePhone(raw: string): string | null {
  const cleaned = raw.replace(/[\s\-()]/g, '')
  if (!cleaned) return null

  if (cleaned.startsWith('+')) {
    return /^\+[1-9]\d{1,14}$/.test(cleaned) ? cleaned : null
  }
  if (/^251[79]\d{8}$/.test(cleaned)) return `+${cleaned}`
  if (/^0[79]\d{8}$/.test(cleaned))   return `+251${cleaned.slice(1)}`
  return null
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/* ------------------------------------------------------------------ */
/*  Time parsing                                                       */
/* ------------------------------------------------------------------ */

function normalizeTimeInput(raw: string): string | null {
  const s = raw.trim().toLowerCase().replace(/\s+/g, '')
  if (!s) return null

  const ampm = s.match(/^(\d{1,2})(?::?(\d{1,2}))?(am|pm)$/)
  if (ampm) {
    let h = parseInt(ampm[1], 10)
    const m = ampm[2] ? parseInt(ampm[2], 10) : 0
    const suffix = ampm[3]
    if (h < 1 || h > 12 || m < 0 || m > 59) return null
    if (suffix === 'am' && h === 12) h = 0
    if (suffix === 'pm' && h !== 12) h += 12
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
  }

  const colon = s.match(/^(\d{1,2}):(\d{1,2})$/)
  if (colon) {
    const h = parseInt(colon[1], 10)
    const m = parseInt(colon[2], 10)
    if (h < 0 || h > 23 || m < 0 || m > 59) return null
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
  }

  const compact = s.match(/^(\d{3,4})$/)
  if (compact) {
    const n = compact[1]
    const h = n.length === 3 ? parseInt(n.slice(0, 1), 10) : parseInt(n.slice(0, 2), 10)
    const m = n.length === 3 ? parseInt(n.slice(1), 10)    : parseInt(n.slice(2), 10)
    if (h < 0 || h > 23 || m < 0 || m > 59) return null
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
  }

  const hour = s.match(/^(\d{1,2})$/)
  if (hour) {
    const h = parseInt(hour[1], 10)
    if (h < 0 || h > 23) return null
    return `${String(h).padStart(2, '0')}:00`
  }

  return null
}

function formatTime12h(hhmm: string): string {
  const m = hhmm.match(/^(\d{1,2}):(\d{2})$/)
  if (!m) return hhmm
  let h = parseInt(m[1], 10)
  const min = m[2]
  const suffix = h >= 12 ? 'PM' : 'AM'
  if (h === 0) h = 12
  else if (h > 12) h -= 12
  return `${h}:${min} ${suffix}`
}

/* ------------------------------------------------------------------ */
/*  TimeInput — custom styled dropdown + typeable field                */
/*  Supports `fullWidth` (stretch) and `compact` (narrow) modes        */
/* ------------------------------------------------------------------ */

const HOURS_12 = [12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11] as const
const MINUTES = ['00', '15', '30', '45'] as const

function TimeInput({
  value,
  onChange,
  className = '',
  ariaLabel,
  fullWidth = false,
  compact = false,
}: {
  value: string
  onChange: (v: string) => void
  className?: string
  ariaLabel?: string
  fullWidth?: boolean
  compact?: boolean
}) {
  const [draft, setDraft] = useState(() => formatTime12h(value))
  const [focused, setFocused] = useState(false)
  const [open, setOpen] = useState(false)

  const wrapRef = useRef<HTMLDivElement | null>(null)

  const [hh, mm] = useMemo(() => {
    const m = value.match(/^(\d{2}):(\d{2})$/)
    if (!m) return ['09', '00']
    return [m[1], m[2]]
  }, [value])

  const hour24 = parseInt(hh, 10)
  const hour12 = hour24 === 0 ? 12 : hour24 > 12 ? hour24 - 12 : hour24
  const suffix: 'AM' | 'PM' = hour24 >= 12 ? 'PM' : 'AM'

  useEffect(() => {
    if (!focused) setDraft(formatTime12h(value))
  }, [value, focused])

  useEffect(() => {
    if (!open) return
    function onDoc(e: MouseEvent) {
      if (!wrapRef.current) return
      if (!wrapRef.current.contains(e.target as Node)) setOpen(false)
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  function commitDraft() {
    const normalized = normalizeTimeInput(draft)
    if (normalized) {
      setDraft(formatTime12h(normalized))
      onChange(normalized)
    } else {
      setDraft(formatTime12h(value))
    }
  }

  function pickHour(newHour12: number) {
    let new24 = newHour12
    if (suffix === 'AM') {
      new24 = newHour12 === 12 ? 0 : newHour12
    } else {
      new24 = newHour12 === 12 ? 12 : newHour12 + 12
    }
    onChange(`${String(new24).padStart(2, '0')}:${mm}`)
  }

  function pickMinute(newMin: string) {
    onChange(`${hh}:${newMin}`)
  }

  function pickSuffix(newSuffix: 'AM' | 'PM') {
    let new24 = hour12
    if (newSuffix === 'AM') {
      new24 = hour12 === 12 ? 0 : hour12
    } else {
      new24 = hour12 === 12 ? 12 : hour12 + 12
    }
    onChange(`${String(new24).padStart(2, '0')}:${mm}`)
  }

  return (
    <div ref={wrapRef} className={`relative ${fullWidth ? 'block w-full' : 'inline-block'} ${className}`}>
      <div
        className={`
          flex items-stretch h-9 rounded-xl border bg-surface overflow-hidden
          transition-colors
          ${open ? 'border-ink ring-2 ring-ink-3/20' : 'border-line hover:border-warm focus-within:border-ink focus-within:ring-2 focus-within:ring-ink-3/20'}
        `}
      >
        <input
          type="text"
          inputMode="text"
          value={draft}
          aria-label={ariaLabel}
          onFocus={() => setFocused(true)}
          onBlur={() => { setFocused(false); commitDraft() }}
          onChange={e => setDraft(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter') e.currentTarget.blur()
            if (e.key === 'Escape') { setDraft(formatTime12h(value)); e.currentTarget.blur() }
          }}
          placeholder="9:00 AM"
          className={`
            ${fullWidth ? 'flex-1 min-w-0' : compact ? 'w-[5.25rem]' : 'w-[6.5rem]'}
            ${compact ? 'px-2' : 'px-3'}
            text-sm bg-transparent text-ink focus:outline-none
          `}
        />

        <button
          type="button"
          onClick={() => setOpen(o => !o)}
          aria-label={ariaLabel ? `${ariaLabel} (pick)` : 'Pick time'}
          aria-haspopup="listbox"
          aria-expanded={open}
          className={`
            flex items-center justify-center ${compact ? 'w-7' : 'w-8'} flex-shrink-0
            border-l border-line text-ink-3
            hover:text-ink hover:bg-warm-subtle
            transition-colors
          `}
        >
          <ClockIcon />
        </button>
      </div>

      {open && (
        <div
          className="
            absolute z-50 mt-1.5 left-0
            bg-surface border border-line rounded-2xl shadow-lg
            p-3
          "
          role="listbox"
        >
          <div className="flex items-stretch gap-2">
            <div className="flex flex-col">
              <p className="text-[10px] font-semibold text-ink-3 uppercase tracking-wider mb-1.5 px-2 text-center">
                Hr
              </p>
              <div className="h-44 overflow-y-auto pr-1 -mr-1 flex flex-col">
                {HOURS_12.map(h => (
                  <button
                    key={h}
                    type="button"
                    onClick={() => pickHour(h)}
                    className={`
                      h-7 px-3 rounded-lg text-sm text-center tabular-nums
                      transition-colors
                      ${hour12 === h
                        ? 'bg-ink text-surface font-medium'
                        : 'text-ink-2 hover:bg-warm-subtle hover:text-ink'}
                    `}
                  >
                    {h}
                  </button>
                ))}
              </div>
            </div>

            <div className="w-px bg-line self-stretch my-4" />

            <div className="flex flex-col">
              <p className="text-[10px] font-semibold text-ink-3 uppercase tracking-wider mb-1.5 px-2 text-center">
                Min
              </p>
              <div className="h-44 overflow-y-auto pr-1 -mr-1 flex flex-col">
                {MINUTES.map(m => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => pickMinute(m)}
                    className={`
                      h-7 px-3 rounded-lg text-sm text-center tabular-nums
                      transition-colors
                      ${mm === m
                        ? 'bg-ink text-surface font-medium'
                        : 'text-ink-2 hover:bg-warm-subtle hover:text-ink'}
                    `}
                  >
                    {m}
                  </button>
                ))}
              </div>
            </div>

            <div className="w-px bg-line self-stretch my-4" />

            <div className="flex flex-col">
              <p className="text-[10px] font-semibold text-ink-3 uppercase tracking-wider mb-1.5 px-2 text-center">
                &nbsp;
              </p>
              <div className="h-44 flex flex-col gap-1 justify-center">
                {(['AM', 'PM'] as const).map(s => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => pickSuffix(s)}
                    className={`
                      h-8 px-3 rounded-lg text-xs font-medium
                      transition-colors
                      ${suffix === s
                        ? 'bg-ink text-surface'
                        : 'text-ink-2 hover:bg-warm-subtle hover:text-ink'}
                    `}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function ClockIcon() {
  return (
    <svg
      width="14" height="14" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </svg>
  )
}

/* ------------------------------------------------------------------ */
/*  DateInput — styled custom calendar dropdown                        */
/* ------------------------------------------------------------------ */

const WEEKDAY_LABELS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'] as const
const MONTH_LABELS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
] as const

function pad2(n: number): string {
  return String(n).padStart(2, '0')
}

function toISODate(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`
}

function parseISODate(iso: string): Date | null {
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!m) return null
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
  if (
    d.getFullYear() !== Number(m[1]) ||
    d.getMonth() !== Number(m[2]) - 1 ||
    d.getDate() !== Number(m[3])
  ) return null
  return d
}

function DateInput({
  value,
  onChange,
  min,
  ariaLabel,
  className = '',
}: {
  value: string
  onChange: (v: string) => void
  min?: string
  ariaLabel?: string
  className?: string
}) {
  const [open, setOpen] = useState(false)
  const wrapRef = useRef<HTMLDivElement | null>(null)

  const selected = parseISODate(value)
  const minDate = min ? parseISODate(min) : null

  const [viewYear, setViewYear] = useState(() =>
    (selected ?? new Date()).getFullYear(),
  )
  const [viewMonth, setViewMonth] = useState(() =>
    (selected ?? new Date()).getMonth(),
  )

  useEffect(() => {
    if (!open) return
    const base = selected ?? new Date()
    setViewYear(base.getFullYear())
    setViewMonth(base.getMonth())
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, value])

  useEffect(() => {
    if (!open) return
    function onDoc(e: MouseEvent) {
      if (!wrapRef.current) return
      if (!wrapRef.current.contains(e.target as Node)) setOpen(false)
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const grid = useMemo(() => {
    const firstOfMonth = new Date(viewYear, viewMonth, 1)
    const startOffset = firstOfMonth.getDay()
    const start = new Date(viewYear, viewMonth, 1 - startOffset)
    const cells: { date: Date; inMonth: boolean }[] = []
    for (let i = 0; i < 42; i++) {
      const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i)
      cells.push({ date: d, inMonth: d.getMonth() === viewMonth })
    }
    return cells
  }, [viewYear, viewMonth])

  const today = useMemo(() => toISODate(new Date()), [])

  function prevMonth() {
    const d = new Date(viewYear, viewMonth - 1, 1)
    setViewYear(d.getFullYear())
    setViewMonth(d.getMonth())
  }
  function nextMonth() {
    const d = new Date(viewYear, viewMonth + 1, 1)
    setViewYear(d.getFullYear())
    setViewMonth(d.getMonth())
  }

  function pick(d: Date) {
    onChange(toISODate(d))
    setOpen(false)
  }

  const display = (() => {
    if (!selected) return ''
    return selected.toLocaleDateString(undefined, {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
  })()

  return (
    <div ref={wrapRef} className={`relative w-full ${className}`}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        aria-label={ariaLabel ?? 'Pick a date'}
        aria-haspopup="dialog"
        aria-expanded={open}
        className={`
          flex items-center gap-2 w-full h-10 px-3 text-sm rounded-xl border bg-surface
          text-left transition-colors
          ${open ? 'border-ink ring-2 ring-ink-3/20' : 'border-line hover:border-warm'}
        `}
      >
        <span className={`flex-1 truncate ${value ? 'text-ink' : 'text-ink-3'}`}>
          {value ? display : 'Pick a date'}
        </span>
        <CalendarIcon />
      </button>

      {open && (
        <div
          className="
            absolute z-50 mt-1.5 left-0
            bg-surface border border-line rounded-2xl shadow-lg
            p-3 w-[17rem] max-w-[calc(100vw-2rem)]
          "
          role="dialog"
        >
          <div className="flex items-center justify-between mb-3 px-1">
            <button
              type="button"
              onClick={prevMonth}
              aria-label="Previous month"
              className="w-7 h-7 rounded-lg flex items-center justify-center text-ink-3 hover:text-ink hover:bg-warm-subtle transition-colors"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M15 18l-6-6 6-6" />
              </svg>
            </button>
            <p className="text-sm font-medium text-ink tabular-nums">
              {MONTH_LABELS[viewMonth]} {viewYear}
            </p>
            <button
              type="button"
              onClick={nextMonth}
              aria-label="Next month"
              className="w-7 h-7 rounded-lg flex items-center justify-center text-ink-3 hover:text-ink hover:bg-warm-subtle transition-colors"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M9 18l6-6-6-6" />
              </svg>
            </button>
          </div>

          <div className="grid grid-cols-7 gap-0.5 mb-1">
            {WEEKDAY_LABELS.map(w => (
              <div
                key={w}
                className="h-7 flex items-center justify-center text-[10px] font-semibold text-ink-3 uppercase tracking-wider"
              >
                {w}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-0.5">
            {grid.map((cell, i) => {
              const iso = toISODate(cell.date)
              const isSelected = iso === value
              const isToday = iso === today
              const disabled = !!minDate && cell.date < minDate
              return (
                <button
                  key={i}
                  type="button"
                  onClick={() => !disabled && pick(cell.date)}
                  disabled={disabled}
                  className={`
                    h-8 rounded-lg text-xs tabular-nums
                    flex items-center justify-center
                    transition-colors
                    ${disabled
                      ? 'text-ink-3/30 cursor-not-allowed'
                      : isSelected
                        ? 'bg-ink text-surface font-medium'
                        : cell.inMonth
                          ? 'text-ink-2 hover:bg-warm-subtle hover:text-ink'
                          : 'text-ink-3/60 hover:bg-warm-subtle hover:text-ink'
                    }
                    ${!isSelected && isToday && !disabled ? 'ring-1 ring-ink-3/40' : ''}
                  `}
                >
                  {cell.date.getDate()}
                </button>
              )
            })}
          </div>

          <div className="flex items-center justify-between mt-3 pt-3 border-t border-line px-1">
            <button
              type="button"
              onClick={() => {
                const t = new Date()
                setViewYear(t.getFullYear())
                setViewMonth(t.getMonth())
                if (!minDate || t >= minDate) {
                  onChange(toISODate(t))
                  setOpen(false)
                }
              }}
              className="text-xs text-ink-3 hover:text-ink"
            >
              Today
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="text-xs text-ink-3 hover:text-ink"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function CalendarIcon() {
  return (
    <svg
      width="14" height="14" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
      className="text-ink-3 flex-shrink-0"
    >
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M16 3v4M8 3v4M3 11h18" />
    </svg>
  )
}

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */

export function StaffPage() {
  const toast = useToast()
  const { activeBusinessId } = useBusiness()
  const { activeBranchFilter } = useBranch()

  const [staff,      setStaff]      = useState<Staff[]>([])
  const [branches,   setBranches]   = useState<Branch[]>([])
  const [services,   setServices]   = useState<Service[]>([])
  const [categories, setCategories] = useState<ServiceCategory[]>([])

  const [loading,  setLoading]  = useState(false)
  const [selected, setSelected] = useState<StaffDetail | null>(null)

  const [showModal, setShowModal] = useState(false)
  const [editing,   setEditing]   = useState<Staff | null>(null)

  const [view, setView] = useState<'list' | 'detail'>('list')
  const [detailVisible, setDetailVisible] = useState(false)

  const [togglingStatusId, setTogglingStatusId] = useState<string | null>(null)

  async function refresh() {
    if (!activeBusinessId) return
    setLoading(true)
    try {
      const [staffList, brList, svcList, catList] = await Promise.all([
        staffApi.list(activeBusinessId, { branchId: activeBranchFilter }),
        branchesApi.list(activeBusinessId),
        servicesApi.list(activeBusinessId),
        serviceCategoriesApi.list(activeBusinessId),
      ])
      setStaff(normalizeArray<Staff>(staffList))
      setBranches(normalizeArray<Branch>(brList).filter(b => b.isActive))
      setServices(normalizeArray<Service>(svcList))
      setCategories(normalizeArray<ServiceCategory>(catList))
    } catch (err) {
      console.error('[staff] load failed', err)
      toast.error(extractErrorMessage(err, 'Could not load staff.'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void refresh()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeBusinessId, activeBranchFilter])

  useEffect(() => {
    if (!selected) return
    if (!loading && !staff.some(s => s.id === selected.id)) {
      closeDetail()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeBranchFilter, loading])

  async function openDetail(member: Staff) {
    const optimistic: StaffDetail = {
      ...member,
      branch: member.branch ?? { id: member.branchId, name: '—', isActive: true },
      categoryQualifications: [],
      serviceQualifications: [],
    }
    setSelected(optimistic)
    setView('detail')
    requestAnimationFrame(() => setDetailVisible(true))

    try {
      const detail = await staffApi.get(member.id)
      setSelected(prev => (prev?.id === detail.id ? detail : prev))
    } catch (err) {
      console.error('[staff] detail load failed', err)
      toast.error(extractErrorMessage(err, 'Could not load staff details.'))
    }
  }

  function closeDetail() {
    setDetailVisible(false)
    setTimeout(() => {
      setView('list')
      setSelected(null)
    }, 220)
  }

  async function reloadDetail(): Promise<StaffDetail | null> {
    if (!selected) return null
    try {
      const detail = await staffApi.get(selected.id)
      setSelected(detail)
      return detail
    } catch (err) {
      console.error('[staff] detail reload failed', err)
      return null
    }
  }

  async function fetchDetail(id: string): Promise<StaffDetail | null> {
    try {
      return await staffApi.get(id)
    } catch (err) {
      console.error('[staff] detail fetch failed', err)
      return null
    }
  }

  function openAdd() {
    setEditing(null)
    setShowModal(true)
  }

  function openEdit(member: Staff) {
    setEditing(member)
    setShowModal(true)
  }

  async function handleSave(payload: StaffFormPayload, existingId: string | null) {
    if (!activeBusinessId) return

    const normalizedPhone = payload.phone.trim()
      ? normalizePhone(payload.phone)
      : null

    if (payload.phone.trim() && !normalizedPhone) {
      toast.error('Phone must be a valid number, e.g. +251911223344 or 0911223344')
      return
    }

    const email = payload.email.trim()
    if (email && !EMAIL_REGEX.test(email)) {
      toast.error('Enter a valid email address.')
      return
    }

    try {
      if (existingId) {
        await staffApi.update(existingId, {
          firstName: payload.firstName.trim(),
          lastName:  payload.lastName.trim(),
          email:     email || undefined,
          phone:     normalizedPhone ?? undefined,
          title:     payload.title.trim() || undefined,
          bio:       payload.bio.trim() || undefined,
          status:    payload.status,
        })

        const current = editing
        if (current && current.branchId !== payload.branchId) {
          await staffApi.moveBranch(existingId, payload.branchId)
        }

        const fresh = await fetchDetail(existingId)

        await syncCategoryQualifications(
          existingId,
          payload.categoryIds,
          fresh?.categoryQualifications ?? [],
        )
        await syncServiceQualifications(
          existingId,
          payload.serviceIds,
          fresh?.serviceQualifications ?? [],
        )
      } else {
        const created = await staffApi.create(activeBusinessId, {
          branchId:  payload.branchId,
          firstName: payload.firstName.trim(),
          lastName:  payload.lastName.trim(),
          email:     email || undefined,
          phone:     normalizedPhone ?? undefined,
          title:     payload.title.trim() || undefined,
          bio:       payload.bio.trim() || undefined,
        })

        await syncCategoryQualifications(created.id, payload.categoryIds, [])
        await syncServiceQualifications(created.id, payload.serviceIds, [])
      }

      toast.success(existingId ? 'Staff updated' : 'Staff added')
      setShowModal(false)

      if (existingId && selected?.id === existingId) {
        await reloadDetail()
      }
      await refresh()
    } catch (err) {
      console.error('[staff] save failed', err)
      toast.error(extractErrorMessage(err, 'Could not save the staff member.'))
    }
  }

  async function syncCategoryQualifications(
    staffId: string,
    desiredCategoryIds: string[],
    current: StaffDetail['categoryQualifications'],
  ) {
    const currentActive = current.filter(c => c.isActive).map(c => c.categoryId)
    const desired = new Set(desiredCategoryIds)

    for (const categoryId of desiredCategoryIds) {
      if (!currentActive.includes(categoryId)) {
        try {
          await staffApi.categoryQualifications.add(staffId, categoryId)
        } catch (err: any) {
          if (err?.response?.status !== 409 && err?.status !== 409) {
            console.warn('[staff] add category qual failed', categoryId, err)
          }
        }
      }
    }
    for (const categoryId of currentActive) {
      if (!desired.has(categoryId)) {
        try {
          await staffApi.categoryQualifications.remove(staffId, categoryId)
        } catch (err) {
          console.warn('[staff] remove category qual failed', categoryId, err)
        }
      }
    }
  }

  async function syncServiceQualifications(
    staffId: string,
    desiredServiceIds: string[],
    current: StaffServiceQualification[],
  ) {
    const currentActive = current.filter(s => s.isActive).map(s => s.serviceId)
    const desired = new Set(desiredServiceIds)

    for (const serviceId of desiredServiceIds) {
      if (!currentActive.includes(serviceId)) {
        try {
          await staffApi.serviceQualifications.add(staffId, serviceId)
        } catch (err: any) {
          if (err?.response?.status !== 409 && err?.status !== 409) {
            console.warn('[staff] add service qual failed', serviceId, err)
          }
        }
      }
    }
    for (const serviceId of currentActive) {
      if (!desired.has(serviceId)) {
        try {
          await staffApi.serviceQualifications.remove(staffId, serviceId)
        } catch (err) {
          console.warn('[staff] remove service qual failed', serviceId, err)
        }
      }
    }
  }

  async function toggleStatus(member: Staff) {
    setTogglingStatusId(member.id)
    try {
      const next: StaffStatus = member.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE'
      await staffApi.update(member.id, { status: next })
      toast.success(next === 'ACTIVE' ? 'Staff activated' : 'Staff deactivated')
      if (selected?.id === member.id) {
        await reloadDetail()
      }
      await refresh()
    } catch (err) {
      console.error('[staff] toggle status failed', err)
      toast.error(extractErrorMessage(err, 'Could not change the staff status.'))
    } finally {
      setTogglingStatusId(null)
    }
  }

  return (
    <div className="relative h-full overflow-hidden">
      {view === 'list' && (
        <div className="flex flex-col h-full overflow-hidden">
          <div className="px-4 sm:px-6 lg:px-8 py-4 sm:py-5 bg-surface border-b border-line flex-shrink-0">
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
              <div className="min-w-0">
                <h2 className="font-display text-xl sm:text-2xl lg:text-[1.75rem] text-ink leading-none">Staff</h2>
                <p className="text-ink-3 text-xs sm:text-sm mt-1.5">Manage your team and their services.</p>
              </div>
              <Button onClick={openAdd} size="sm" disabled={loading || branches.length === 0} className="self-start sm:self-auto flex-shrink-0">
                <PlusIcon /> Add Staff
              </Button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-4 sm:px-6 lg:px-8 py-5 sm:py-6">
            {loading && staff.length === 0 ? (
              <LoadingState label="Loading staff…" />
            ) : staff.length === 0 ? (
              <EmptyState
                icon={<PersonIcon />}
                title="No staff members yet"
                description={
                  branches.length === 0
                    ? 'Add a branch first, then add staff.'
                    : 'Add your team to start managing appointments.'
                }
                action={
                  branches.length === 0
                    ? undefined
                    : <Button onClick={openAdd} size="sm"><PlusIcon /> Add Staff</Button>
                }
              />
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                {staff.map(member => {
                  const isActive = member.status === 'ACTIVE'
                  return (
                    <button
                      key={member.id}
                      type="button"
                      onClick={() => void openDetail(member)}
                      className="
                        group relative w-full text-left
                        bg-surface rounded-2xl border border-line
                        p-5 cursor-pointer
                        transition-all duration-200 ease-out
                        hover:border-warm hover:shadow-md hover:-translate-y-0.5
                        active:translate-y-0 active:shadow-sm
                        focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink-3/30 focus-visible:border-ink-3
                      "
                    >
                      <div className="flex items-start justify-between mb-4">
                        <Avatar name={`${member.firstName} ${member.lastName}`} size="lg" />
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${isActive ? 'bg-[#EAF5EC] text-[#2A5F30]' : 'bg-line text-ink-3'}`}>
                          {isActive ? 'Active' : 'Inactive'}
                        </span>
                      </div>
                      <p className="font-semibold text-ink">{member.firstName} {member.lastName}</p>
                      <p className="text-sm text-ink-3 mt-0.5 truncate">{member.title ?? '—'}</p>
                      {member.branch && (
                        <div className="flex items-center gap-2 mt-3">
                          <span className="text-xs text-ink-3 truncate">{member.branch.name}</span>
                        </div>
                      )}
                      <div className="flex items-center justify-between mt-4 pt-4 border-t border-line gap-3">
                        <span className="text-xs text-ink-3 truncate">{member.phone ?? 'No phone'}</span>
                        <span className="text-xs text-ink-3 truncate">{member.email ?? ''}</span>
                      </div>
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {view === 'detail' && selected && (
        <div
          className={`
            absolute inset-0 bg-bg z-20
            transition-all duration-200 ease-out
            ${detailVisible ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-4 pointer-events-none'}
          `}
        >
          <StaffDetailView
            detail={selected}
            branchTimezone={
              branches.find(b => b.id === selected.branchId)?.timezone ??
              'Africa/Addis_Ababa'
            }
            onBack={closeDetail}
            onEdit={() => openEdit(selected)}
            onToggleStatus={() => toggleStatus(selected)}
            togglingStatus={togglingStatusId === selected.id}
          />
        </div>
      )}

      <StaffFormModal
        open={showModal}
        onClose={() => setShowModal(false)}
        member={editing}
        initialDetail={editing && selected?.id === editing.id ? selected : undefined}
        categories={categories}
        services={services}
        branches={branches}
        onSave={handleSave}
      />
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Detail view                                                        */
/* ------------------------------------------------------------------ */

function StaffDetailView({
  detail, branchTimezone, onBack, onEdit, onToggleStatus, togglingStatus,
}: {
  detail: StaffDetail
  branchTimezone: string
  onBack: () => void
  onEdit: () => void
  onToggleStatus: () => void
  togglingStatus: boolean
}) {
  const [activeTab, setActiveTab] = useState<
    'overview' | 'qualifications' | 'schedule' | 'timeoff' | 'feedback'
  >('overview')

  const isActive = detail.status === 'ACTIVE'
  const activeCats = detail.categoryQualifications.filter(q => q.isActive)
  const activeSvcs = detail.serviceQualifications.filter(q => q.isActive)

  const tabs = ['overview', 'qualifications', 'schedule', 'timeoff', 'feedback'] as const

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="px-4 sm:px-6 lg:px-8 py-4 sm:py-5 bg-surface border-b border-line flex-shrink-0">
        <button onClick={onBack} className="flex items-center gap-2 text-sm text-ink-3 hover:text-ink transition-colors mb-5">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 18l-6-6 6-6"/></svg>
          All staff
        </button>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-4 min-w-0">
            <Avatar name={`${detail.firstName} ${detail.lastName}`} size="lg" />
            <div className="min-w-0">
              <div className="flex items-center gap-2.5 flex-wrap">
                <h2 className="font-display text-xl sm:text-2xl text-ink truncate">{detail.firstName} {detail.lastName}</h2>
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium flex-shrink-0 ${isActive ? 'bg-[#EAF5EC] text-[#2A5F30]' : 'bg-line text-ink-3'}`}>
                  {isActive ? 'Active' : 'Inactive'}
                </span>
              </div>
              <p className="text-ink-3 text-sm mt-0.5">{detail.title ?? '—'}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 self-start sm:self-auto flex-shrink-0">
            <Button
              variant="secondary"
              size="sm"
              onClick={onToggleStatus}
              loading={togglingStatus}
              disabled={togglingStatus}
              className={isActive ? '!text-[#B03A3A] !border-[#E5B5B5] hover:!bg-[#FBEDED]' : ''}
            >
              {isActive ? 'Deactivate' : 'Activate'}
            </Button>
            <Button size="sm" onClick={onEdit} disabled={togglingStatus}>Edit</Button>
          </div>
        </div>

        <div className="flex items-center gap-4 sm:gap-6 mt-5 pt-5 border-t border-line overflow-x-auto">
          <Stat label="Category quals" value={String(activeCats.length)} sub="active" />
          <div className="w-px h-8 bg-line flex-shrink-0" />
          <Stat label="Service quals" value={String(activeSvcs.length)} sub="active" />
          <div className="w-px h-8 bg-line flex-shrink-0" />
          <Stat label="Branch" value={detail.branch.name} sub="home" />
        </div>

        <div className="flex gap-1 mt-5 overflow-x-auto">
          {tabs.map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`h-8 px-4 text-xs font-medium rounded-xl transition-colors whitespace-nowrap ${activeTab === tab ? 'bg-ink text-surface' : 'text-ink-3 hover:text-ink hover:bg-warm-subtle'}`}
            >
              {tab === 'timeoff' ? 'Time Off' : tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 sm:px-6 lg:px-8 py-5 sm:py-6">
        {activeTab === 'overview' && (
          <div className="max-w-2xl flex flex-col gap-6">
            <InfoSection title="Contact">
              {detail.phone && <Row label="Phone" value={detail.phone} />}
              {detail.email && <Row label="Email" value={detail.email} />}
            </InfoSection>
            {detail.bio && (
              <InfoSection title="Bio">
                <p className="text-sm text-ink-2 leading-relaxed">{detail.bio}</p>
              </InfoSection>
            )}
            <InfoSection title="Home branch">
              <span className="px-3 py-1.5 rounded-xl bg-warm-subtle text-ink-2 text-sm">{detail.branch.name}</span>
            </InfoSection>
          </div>
        )}

        {activeTab === 'qualifications' && (
          <div className="max-w-2xl flex flex-col gap-6">
            <InfoSection title="Categories they work in">
              <div className="flex flex-wrap gap-2">
                {activeCats.length === 0
                  ? <p className="text-sm text-ink-3">No category qualifications.</p>
                  : activeCats.map(q => (
                    <span key={q.id} className="px-3 py-1.5 rounded-xl bg-warm-subtle text-ink-2 text-sm">
                      {q.category?.name ?? q.categoryId}
                    </span>
                  ))
                }
              </div>
            </InfoSection>

            <InfoSection title="Services they can perform">
              <div className="bg-surface rounded-xl border border-line overflow-hidden">
                {activeSvcs.length === 0
                  ? <p className="text-sm text-ink-3 p-4">No service qualifications.</p>
                  : activeSvcs.map(q => (
                    <div key={q.id} className="flex items-center justify-between px-4 py-3 border-b border-line last:border-0">
                      <div>
                        <p className="text-sm font-medium text-ink">{q.service?.name ?? q.serviceId}</p>
                        <p className="text-xs text-ink-3 capitalize">{q.proficiencyLevel.toLowerCase()}</p>
                      </div>
                    </div>
                  ))
                }
              </div>
            </InfoSection>
          </div>
        )}

        {activeTab === 'schedule' && (
          <StaffScheduleTab
            staffId={detail.id}
            branchTimezone={branchTimezone}
          />
        )}

        {activeTab === 'timeoff' && (
          <StaffTimeOffTab
            staffId={detail.id}
            branchTimezone={branchTimezone}
          />
        )}

        {activeTab === 'feedback' && (
          <div className="max-w-2xl flex flex-col gap-3">
            <p className="text-ink-3 text-sm py-10 text-center">
              Feedback integration coming soon.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Staff schedule tab                                                 */
/* ------------------------------------------------------------------ */

interface ServerScheduleDay {
  day?: number
  dayOfWeek?: number
  configured?: boolean
  source?: string
  isWorking?: boolean
  isClosed?: boolean
  id?: string
  intervals?: Array<{
    id?: string
    startTime?: string
    endTime?: string
    start?: string
    end?: string
    intervalStart?: string
    intervalEnd?: string
  }>
}

function stripToHHmm(value: string | undefined, fallback: string): string {
  if (!value) return fallback
  const m = value.match(/T(\d{2}:\d{2})/)
  if (m) return m[1]
  if (/^\d{1,2}:\d{2}$/.test(value)) return normalizeTimeInput(value) ?? fallback
  return value
}

function normalizeWeeklySchedules(res: unknown): {
  rows: WeeklySchedule[]
  serverHadRows: boolean
} {
  let raw: ServerScheduleDay[] = []
  if (Array.isArray(res)) {
    raw = res as ServerScheduleDay[]
  } else {
    const anyRes = res as any
    if (Array.isArray(anyRes?.data?.data)) raw = anyRes.data.data
    else if (Array.isArray(anyRes?.data))   raw = anyRes.data
    else if (Array.isArray(anyRes?.days))   raw = anyRes.days
  }

  const serverHadRows = raw.some(r => r?.configured === true)

  const byDay = new Map<DayOfWeek, WeeklySchedule>()
  for (const r of raw) {
    const dayNum = r?.day ?? r?.dayOfWeek
    if (typeof dayNum !== 'number') continue
    const day = dayNum as DayOfWeek

    if (r?.configured === false) continue

    const rawIsWorking = r?.isWorking
    const isClosed =
      typeof rawIsWorking === 'boolean' ? !rawIsWorking : !!r?.isClosed

    const intervals = Array.isArray(r?.intervals)
      ? r.intervals.map(i => ({
          id: i?.id,
          startTime: stripToHHmm(
            i?.startTime ?? i?.start ?? i?.intervalStart,
            '09:00',
          ),
          endTime: stripToHHmm(
            i?.endTime ?? i?.end ?? i?.intervalEnd,
            '18:00',
          ),
        }))
      : []

    byDay.set(day, {
      id: r?.id ?? `local-${day}`,
      dayOfWeek: day,
      isClosed,
      intervals,
    })
  }

  const out: WeeklySchedule[] = []
  for (let d = 0; d < 7; d++) {
    const day = d as DayOfWeek
    out.push(
      byDay.get(day) ?? {
        id: `local-${day}`,
        dayOfWeek: day,
        isClosed: true,
        intervals: [],
      },
    )
  }
  return { rows: out, serverHadRows }
}

function StaffScheduleTab({
  staffId,
  branchTimezone,
}: {
  staffId: string
  branchTimezone: string
}) {
  const toast = useToast()
  const [rows, setRows] = useState<WeeklySchedule[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [editingBlank, setEditingBlank] = useState(false)
  const [serverHadRows, setServerHadRows] = useState(false)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    ;(async () => {
      try {
        const res = await staffApi.weeklyHours.get(staffId)
        if (cancelled) return

        const { rows: normalized, serverHadRows: had } = normalizeWeeklySchedules(res)
        setServerHadRows(had)
        setRows(had ? normalized : [])
      } catch (err) {
        if (cancelled) return
        console.error('[staff] schedule load failed', err)
        toast.error(extractErrorMessage(err, 'Could not load the schedule.'))
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [staffId])

  function applyDefaults() {
    setRows(DEFAULT_SCHEDULES.map(r => ({ ...r, intervals: [...r.intervals] })))
    setEditingBlank(true)
  }

  function updateRow(day: DayOfWeek, patch: Partial<WeeklySchedule>) {
    setRows(prev => prev.map(r => (r.dayOfWeek === day ? { ...r, ...patch } : r)))
  }

  function updateInterval(
    day: DayOfWeek,
    idx: number,
    key: 'startTime' | 'endTime',
    value: string,
  ) {
    setRows(prev =>
      prev.map(r => {
        if (r.dayOfWeek !== day) return r
        const intervals = [...(r.intervals ?? [])]
        intervals[idx] = { ...intervals[idx], [key]: value }
        return { ...r, intervals }
      }),
    )
  }

  function addInterval(day: DayOfWeek) {
    setRows(prev =>
      prev.map(r =>
        r.dayOfWeek === day
          ? {
              ...r,
              intervals: [
                ...(r.intervals ?? []),
                { startTime: '09:00', endTime: '18:00' },
              ],
            }
          : r,
      ),
    )
  }

  function removeInterval(day: DayOfWeek, idx: number) {
    setRows(prev =>
      prev.map(r =>
        r.dayOfWeek === day
          ? { ...r, intervals: (r.intervals ?? []).filter((_, i) => i !== idx) }
          : r,
      ),
    )
  }

  async function save() {
    setSaving(true)
    try {
      const sortedRows = rows
        .slice()
        .sort((a, b) => a.dayOfWeek - b.dayOfWeek)

      await Promise.all(
        sortedRows.map(r => {
          const dayPayload = {
            dayOfWeek: r.dayOfWeek,
            isWorking: !r.isClosed,
            intervals: r.isClosed
              ? []
              : (r.intervals ?? []).map(i => ({
                  start: i.startTime,
                  end:   i.endTime,
                })),
          }
          return staffApi.weeklyHours.put(staffId, dayPayload as any)
        }),
      )

      const fresh = await staffApi.weeklyHours.get(staffId)
      const { rows: normalized } = normalizeWeeklySchedules(fresh)
      setRows(normalized)
      setServerHadRows(true)

      setEditingBlank(false)
      toast.success('Schedule saved')
    } catch (err) {
      console.error('[staff] schedule save failed', err)
      const fieldErrors = (err as any)?.fieldErrors
      if (Array.isArray(fieldErrors) && fieldErrors.length > 0) {
        const first = fieldErrors[0]
        const msg = typeof first === 'string'
          ? first
          : first?.field
            ? `${first.field}: ${first.message}`
            : (first?.message ?? String(first))
        toast.error(`Validation: ${msg}`)
      } else {
        toast.error(extractErrorMessage(err, 'Could not save the schedule.'))
      }
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return <LoadingState label="Loading schedule…" />
  }

  if (!serverHadRows && rows.length === 0 && !editingBlank) {
    return (
      <div className="max-w-2xl flex flex-col gap-3">
        <div className="bg-surface rounded-2xl border border-line px-6 py-8 text-center">
          <div className="w-12 h-12 rounded-2xl bg-[#FBF5EA] flex items-center justify-center mx-auto mb-4">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#7A5F2C" strokeWidth="1.8">
              <circle cx="12" cy="12" r="9" />
              <path d="M12 7v5l3 2" />
            </svg>
          </div>
          <p className="text-sm font-medium text-ink mb-1">
            No personal schedule set
          </p>
          <p className="text-xs text-ink-3 mb-5 max-w-sm mx-auto">
            This staff member currently inherits the branch's working hours
            (timezone {branchTimezone}). Set a personal schedule only if they
            work different hours than the branch.
          </p>
          <Button size="sm" onClick={applyDefaults}>
            Set a personal schedule
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-2xl flex flex-col gap-3">
      {editingBlank && (
        <div className="bg-[#FBF5EA] border border-[#E8D5A8] rounded-xl px-4 py-3">
          <p className="text-xs text-[#7A5F2C]">
            Defaults loaded. Review and click <strong>Save schedule</strong> to
            apply them — nothing has been saved yet.
          </p>
        </div>
      )}

      <div className="bg-surface rounded-2xl border border-line overflow-hidden">
        {rows
          .slice()
          .sort((a, b) => a.dayOfWeek - b.dayOfWeek)
          .map(row => {
            const intervals = row.intervals ?? []
            return (
              <div
                key={row.dayOfWeek}
                className="
                  flex flex-col gap-2 px-4 sm:px-5 py-3.5
                  border-b border-line last:border-0
                  sm:flex-row sm:items-start sm:gap-4
                "
              >
                {/* Row 1 (mobile) / left side (desktop): day label + toggle */}
                <div className="flex items-center gap-3 sm:gap-4 sm:flex-shrink-0">
                  <span className="w-14 sm:w-24 text-sm font-medium text-ink">
                    <span className="hidden sm:inline">{DAY_LABELS[row.dayOfWeek]}</span>
                    <span className="sm:hidden">{DAY_LABELS_SHORT[row.dayOfWeek]}</span>
                  </span>
                  <Toggle
                    checked={!row.isClosed}
                    onChange={v =>
                      updateRow(row.dayOfWeek, {
                        isClosed: !v,
                        intervals:
                          v && intervals.length === 0
                            ? [{ startTime: '09:00', endTime: '18:00' }]
                            : intervals,
                      })
                    }
                  />
                  {row.isClosed && (
                    <span className="text-sm text-ink-3">Not working</span>
                  )}
                </div>

                {/* Row 2 (mobile) / right side (desktop): intervals */}
                {!row.isClosed && (
                  <div className="flex flex-col gap-2 flex-1 min-w-0">
                    {intervals.map((iv, idx) => (
                      <div
                        key={idx}
                        className="flex items-center gap-1.5 flex-nowrap"
                      >
                        <div className="flex items-center gap-1.5 min-w-0 flex-nowrap">
                          <TimeInput
                            value={iv.startTime}
                            onChange={v => updateInterval(row.dayOfWeek, idx, 'startTime', v)}
                            ariaLabel={`${DAY_LABELS[row.dayOfWeek]} start time`}
                            compact
                          />
                          <span className="text-ink-3 text-sm flex-shrink-0">–</span>
                          <TimeInput
                            value={iv.endTime}
                            onChange={v => updateInterval(row.dayOfWeek, idx, 'endTime', v)}
                            ariaLabel={`${DAY_LABELS[row.dayOfWeek]} end time`}
                            compact
                          />
                        </div>
                        <button
                          type="button"
                          onClick={() => removeInterval(row.dayOfWeek, idx)}
                          className="
                            w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0
                            text-ink-3 hover:text-[#B03A3A] hover:bg-[#FBEDED]
                            transition-colors
                          "
                          aria-label="Remove interval"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                    <button
                      onClick={() => addInterval(row.dayOfWeek)}
                      className="text-xs text-ink-3 hover:text-ink self-start"
                    >
                      + Add interval
                    </button>
                  </div>
                )}
              </div>
            )
          })}
      </div>

      <div className="flex items-center gap-3">
        <Button size="sm" onClick={save} loading={saving} disabled={saving}>
          Save schedule
        </Button>
        {editingBlank && (
          <button
            type="button"
            onClick={() => {
              setRows([])
              setEditingBlank(false)
            }}
            className="text-xs text-ink-3 hover:text-ink"
          >
            Cancel
          </button>
        )}
      </div>

      <p className="text-[11px] text-ink-3">
        Times are wall-clock in the branch's timezone ({branchTimezone}).
      </p>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Staff time-off tab (§14)                                           */
/* ------------------------------------------------------------------ */

function formatDateLabel(iso: string): string {
  const d = iso.length > 10 ? new Date(iso) : new Date(`${iso}T00:00:00`)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleDateString(undefined, {
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

function StaffTimeOffTab({
  staffId,
  branchTimezone,
}: {
  staffId: string
  branchTimezone: string
}) {
  const toast = useToast()
  const [entries, setEntries] = useState<StaffTimeOff[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)

  const today = useMemo(() => toISODate(new Date()), [])

  const [date, setDate] = useState(today)
  const [allDay, setAllDay] = useState(true)
  const [start, setStart] = useState('09:00')
  const [end, setEnd] = useState('13:00')
  const [reason, setReason] = useState('')

  async function load() {
    setLoading(true)
    try {
      const res = await staffApi.timeOff.list(staffId)
      const list = normalizeArray<StaffTimeOff>(res)
      list.sort((a, b) => a.date.localeCompare(b.date))
      setEntries(list)
    } catch (err) {
      console.error('[staff] time off load failed', err)
      toast.error(extractErrorMessage(err, 'Could not load time off.'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [staffId])

  async function add() {
    if (!date) {
      toast.error('Pick a date.')
      return
    }
    if (!allDay) {
      const s = normalizeTimeInput(start)
      const e = normalizeTimeInput(end)
      if (!s || !e) {
        toast.error('Enter valid start and end times (HH:mm).')
        return
      }
      if (s >= e) {
        toast.error('End time must be after start time.')
        return
      }
    }

    setBusy(true)
    try {
      const input = allDay
        ? ({ date, allDay: true, reason: reason.trim() || undefined } as const)
        : ({
            date,
            allDay: false,
            start: normalizeTimeInput(start)!,
            end: normalizeTimeInput(end)!,
            reason: reason.trim() || undefined,
          } as const)

      const created = await staffApi.timeOff.create(staffId, input)
      setEntries(prev =>
        [...prev, created].sort((a, b) => a.date.localeCompare(b.date)),
      )
      setReason('')
      toast.success('Time off added')
    } catch (err) {
      console.error('[staff] add time off failed', err)
      toast.error(extractErrorMessage(err, 'Could not add time off.'))
    } finally {
      setBusy(false)
    }
  }

  async function remove(id: string) {
    setBusy(true)
    try {
      await staffApi.timeOff.remove(staffId, id)
      setEntries(prev => prev.filter(t => t.id !== id))
      toast.success('Time off removed')
    } catch (err) {
      console.error('[staff] remove time off failed', err)
      toast.error(extractErrorMessage(err, 'Could not remove time off.'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="max-w-2xl flex flex-col gap-3">
      <div className="bg-surface rounded-2xl border border-line overflow-hidden">
        {loading ? (
          <p className="text-sm text-ink-3 py-8 text-center">Loading…</p>
        ) : entries.length === 0 ? (
          <p className="text-sm text-ink-3 py-8 text-center">No time off scheduled.</p>
        ) : (
          entries.map(t => (
            <div
              key={t.id}
              className="flex items-center gap-4 px-4 sm:px-5 py-3.5 border-b border-line last:border-0"
            >
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-ink truncate">
                  {formatDateLabel(t.date)}
                </p>
                <p className="text-xs text-ink-3 mt-0.5 truncate">
                  {t.allDay
                    ? 'All day'
                    : `${formatTime12h(t.start ?? '09:00')} – ${formatTime12h(t.end ?? '18:00')}`}
                  {t.reason ? ` · ${t.reason}` : ''}
                </p>
              </div>
              <button
                onClick={() => void remove(t.id)}
                disabled={busy}
                className="text-xs text-[#B03A3A] hover:text-[#8a2b2b] disabled:opacity-50 flex-shrink-0"
              >
                Remove
              </button>
            </div>
          ))
        )}
      </div>

      <div className="bg-surface rounded-2xl border border-line p-4 sm:p-5 flex flex-col gap-4">
        {/* Date */}
        <div className="min-w-0">
          <label className="text-xs font-medium text-ink-3 uppercase tracking-wider block mb-2">
            Date
          </label>
          <DateInput
            value={date}
            min={today}
            onChange={setDate}
            ariaLabel="Time off date"
          />
        </div>

        {/* All-day toggle */}
        <div className="flex items-center">
          <Toggle
            checked={allDay}
            onChange={v => setAllDay(v)}
            label="All day"
          />
        </div>

        {/* Times — only when not all-day. Start and End sit next to each other. */}
        {!allDay && (
          <div className="flex flex-wrap items-end gap-2 sm:gap-3">
            <div className="min-w-0">
              <label className="text-xs font-medium text-ink-3 uppercase tracking-wider block mb-2">
                Start
              </label>
              <TimeInput
                value={start}
                onChange={setStart}
                ariaLabel="Start time"
              />
            </div>
            <span className="text-ink-3 text-sm pb-2">–</span>
            <div className="min-w-0">
              <label className="text-xs font-medium text-ink-3 uppercase tracking-wider block mb-2">
                End
              </label>
              <TimeInput
                value={end}
                onChange={setEnd}
                ariaLabel="End time"
              />
            </div>
          </div>
        )}

        <Input
          label="Reason (optional)"
          value={reason}
          placeholder="Medical appointment"
          onChange={e => setReason(e.target.value)}
        />

        <div className="flex justify-end">
          <Button size="sm" onClick={add} loading={busy} disabled={busy || !date}>
            Add time off
          </Button>
        </div>
      </div>

      <p className="text-[11px] text-ink-3">
        Times are wall-clock in the branch's timezone ({branchTimezone}).
      </p>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Form modal                                                         */
/* ------------------------------------------------------------------ */

type StaffFormPayload = {
  branchId: string
  firstName: string
  lastName: string
  email: string
  phone: string
  title: string
  bio: string
  status: StaffStatus
  categoryIds: string[]
  serviceIds: string[]
}

function StaffFormModal({
  open, onClose, member, initialDetail, categories, services, branches, onSave,
}: {
  open: boolean
  onClose: () => void
  member: Staff | null
  initialDetail?: StaffDetail
  categories: ServiceCategory[]
  services: Service[]
  branches: Branch[]
  onSave: (payload: StaffFormPayload, existingId: string | null) => Promise<void>
}) {
  const [saving, setSaving] = useState(false)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [form, setForm] = useState<StaffFormPayload>(() => blankForm(branches))
  const [baseline, setBaseline] = useState<StaffFormPayload>(() => blankForm(branches))

  useEffect(() => {
    if (!open) return
    setFieldErrors({})
    if (member) {
      const detail = initialDetail?.id === member.id ? initialDetail : null

      const seedCategoryIds = detail
        ? detail.categoryQualifications
            .filter(q => q.isActive)
            .map(q => q.categoryId)
            .filter(id =>
              categories.some(c =>
                c.id === id &&
                c.status === 'ACTIVE' &&
                c.branchAssignments.some(a => a.branchId === member.branchId && a.isActive),
              ),
            )
        : []

      const seedServiceIds = detail
        ? detail.serviceQualifications
            .filter(q => q.isActive)
            .map(q => q.serviceId)
            .filter(id =>
              services.some(s =>
                s.id === id &&
                s.status === 'ACTIVE' &&
                s.branchAssignments.some(a => a.branchId === member.branchId && a.isActive),
              ),
            )
        : []

      const seeded: StaffFormPayload = {
        branchId:  member.branchId,
        firstName: member.firstName,
        lastName:  member.lastName,
        email:     member.email ?? '',
        phone:     member.phone ?? '',
        title:     member.title ?? '',
        bio:       member.bio ?? '',
        status:    member.status,
        categoryIds: seedCategoryIds,
        serviceIds:  seedServiceIds,
      }
      setForm(seeded)
      setBaseline(seeded)
    } else {
      const blank = blankForm(branches)
      setForm(blank)
      setBaseline(blank)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, member, initialDetail])

  const availableCategories = useMemo(() => {
    if (!form.branchId) return []
    return categories.filter(c =>
      c.status === 'ACTIVE' &&
      c.branchAssignments.some(a => a.branchId === form.branchId && a.isActive),
    )
  }, [categories, form.branchId])

  const availableServices = useMemo(() => {
    if (!form.branchId) return []
    return services.filter(s =>
      s.status === 'ACTIVE' &&
      s.branchAssignments.some(a => a.branchId === form.branchId && a.isActive),
    )
  }, [services, form.branchId])

  function setBranch(branchId: string) {
    setForm(f => {
      const nextCats = f.categoryIds.filter(id =>
        categories.some(c =>
          c.id === id &&
          c.status === 'ACTIVE' &&
          c.branchAssignments.some(a => a.branchId === branchId && a.isActive),
        ),
      )
      const nextSvcs = f.serviceIds.filter(id =>
        services.some(s =>
          s.id === id &&
          s.status === 'ACTIVE' &&
          s.branchAssignments.some(a => a.branchId === branchId && a.isActive),
        ),
      )
      return { ...f, branchId, categoryIds: nextCats, serviceIds: nextSvcs }
    })
  }

  function toggleService(id: string) {
    setForm(f => ({
      ...f,
      serviceIds: f.serviceIds.includes(id)
        ? f.serviceIds.filter(s => s !== id)
        : [...f.serviceIds, id],
    }))
  }
  function toggleCategory(id: string) {
    setForm(f => ({
      ...f,
      categoryIds: f.categoryIds.includes(id)
        ? f.categoryIds.filter(c => c !== id)
        : [...f.categoryIds, id],
    }))
  }

  function validate(): Record<string, string> {
    const e: Record<string, string> = {}

    if (!form.firstName.trim())          e.firstName = 'First name is required'
    else if (form.firstName.length > 100) e.firstName = 'Max 100 characters'

    if (!form.lastName.trim())          e.lastName = 'Last name is required'
    else if (form.lastName.length > 100) e.lastName = 'Max 100 characters'

    if (!form.branchId) e.branchId = 'Select a home branch'

    if (form.email.trim() && !EMAIL_REGEX.test(form.email.trim())) {
      e.email = 'Enter a valid email address'
    }

    if (form.phone.trim() && !normalizePhone(form.phone)) {
      e.phone = 'Use format +251911223344 or 0911223344'
    }

    if (form.title.length > 100) e.title = 'Max 100 characters'
    if (form.bio.length   > 1000) e.bio   = 'Max 1000 characters'

    return e
  }

  async function handleSave() {
    const errs = validate()
    if (Object.keys(errs).length) {
      setFieldErrors(errs)
      return
    }
    setFieldErrors({})
    setSaving(true)
    try {
      await onSave(form, member?.id ?? null)
    } finally {
      setSaving(false)
    }
  }

  const dirty = useMemo(() => {
    if (
      form.branchId  !== baseline.branchId  ||
      form.firstName !== baseline.firstName ||
      form.lastName  !== baseline.lastName  ||
      form.email     !== baseline.email     ||
      form.phone     !== baseline.phone     ||
      form.title     !== baseline.title     ||
      form.bio       !== baseline.bio       ||
      form.status    !== baseline.status
    ) {
      return true
    }
    if (form.categoryIds.length !== baseline.categoryIds.length) return true
    if (form.serviceIds.length  !== baseline.serviceIds.length)  return true
    const bCats = new Set(baseline.categoryIds)
    for (const id of form.categoryIds) if (!bCats.has(id)) return true
    const bSvcs = new Set(baseline.serviceIds)
    for (const id of form.serviceIds) if (!bSvcs.has(id)) return true
    return false
  }, [form, baseline])

  const canSave = !saving && dirty

  return (
    <Modal open={open} onClose={onClose} title={member ? 'Edit Staff' : 'Add Staff'} width="max-w-lg">
      <div className="px-4 sm:px-6 py-5 flex flex-col gap-4 max-h-[65vh] overflow-y-auto">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input
            label="First name"
            value={form.firstName}
            placeholder="Sara"
            onChange={e => setForm(f => ({ ...f, firstName: e.target.value }))}
            error={fieldErrors.firstName}
          />
          <Input
            label="Last name"
            value={form.lastName}
            placeholder="Kebede"
            onChange={e => setForm(f => ({ ...f, lastName: e.target.value }))}
            error={fieldErrors.lastName}
          />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input
            label="Phone"
            type="tel"
            value={form.phone}
            placeholder="+251911223344"
            onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
            error={fieldErrors.phone}
          />
          <Input
            label="Email (optional)"
            type="email"
            value={form.email}
            placeholder="sara@zsalon.com"
            onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
            error={fieldErrors.email}
          />
        </div>
        <Input
          label="Title / Position"
          value={form.title}
          placeholder="Senior Stylist"
          onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
          error={fieldErrors.title}
        />
        <Textarea
          label="Bio (optional)"
          rows={2}
          value={form.bio}
          placeholder="10 years of coloring experience"
          onChange={e => setForm(f => ({ ...f, bio: e.target.value }))}
        />

        <div>
          <label className="text-sm font-medium text-ink-2 block mb-2">Home branch</label>
          <div className="flex gap-2 flex-wrap">
            {branches.map(b => (
              <button
                key={b.id}
                type="button"
                onClick={() => setBranch(b.id)}
                className={`px-3 py-1.5 rounded-xl text-xs border transition-all ${form.branchId === b.id ? 'border-ink bg-ink text-surface' : 'border-line bg-surface text-ink-2 hover:border-warm'}`}
              >
                {form.branchId === b.id ? '✓' : '+'} {b.name}
              </button>
            ))}
          </div>
          {fieldErrors.branchId && <p className="text-xs text-[#B06A6A] mt-2">{fieldErrors.branchId}</p>}
        </div>

        <div>
          <label className="text-sm font-medium text-ink-2 block mb-2">
            Services they can perform <span className="text-ink-3 font-normal">(optional)</span>
          </label>
          <div className="bg-surface rounded-xl border border-line overflow-hidden max-h-44 overflow-y-auto">
            {!form.branchId ? (
              <p className="text-xs text-ink-3 p-3">Pick a home branch first.</p>
            ) : availableServices.length === 0 ? (
              <p className="text-xs text-ink-3 p-3">
                No services are offered at this branch. Assign services to the branch first.
              </p>
            ) : availableServices.map(svc => {
              const checked = form.serviceIds.includes(svc.id)
              return (
                <button
                  key={svc.id}
                  type="button"
                  onClick={() => toggleService(svc.id)}
                  className="flex items-center gap-3 px-4 py-2.5 border-b border-line last:border-0 w-full text-left hover:bg-bg transition-colors"
                >
                  <div className={`w-4 h-4 rounded flex-shrink-0 border-2 flex items-center justify-center ${checked ? 'border-ink bg-ink' : 'border-line'}`}>
                    {checked && <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3"><path d="M20 6L9 17l-5-5"/></svg>}
                  </div>
                  <span className="text-sm text-ink">{svc.name}</span>
                  <span className="text-xs text-ink-3 ml-auto">{svc.category?.name ?? ''}</span>
                </button>
              )
            })}
          </div>
        </div>

        <div>
          <label className="text-sm font-medium text-ink-2 block mb-2">
            Categories they work in <span className="text-ink-3 font-normal">(optional)</span>
          </label>
          {!form.branchId ? (
            <p className="text-xs text-ink-3">Pick a home branch first.</p>
          ) : availableCategories.length === 0 ? (
            <p className="text-xs text-ink-3">
              No categories are offered at this branch. Assign categories to the branch first.
            </p>
          ) : (
            <div className="flex gap-2 flex-wrap">
              {availableCategories.map(c => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => toggleCategory(c.id)}
                  className={`px-3 py-1.5 rounded-xl text-xs border transition-all ${form.categoryIds.includes(c.id) ? 'border-ink bg-ink text-surface' : 'border-line bg-surface text-ink-2 hover:border-warm'}`}
                >
                  {form.categoryIds.includes(c.id) ? '✓' : '+'} {c.name}
                </button>
              ))}
            </div>
          )}
        </div>

        <Toggle
          checked={form.status === 'ACTIVE'}
          onChange={v => setForm(f => ({ ...f, status: v ? 'ACTIVE' : 'INACTIVE' }))}
          label="Active"
        />
      </div>

      <div className="px-4 sm:px-6 pb-5 sm:pb-6 flex gap-2 sm:gap-3 justify-end border-t border-line pt-4">
        <Button variant="ghost" onClick={onClose} disabled={saving}>Cancel</Button>
        <Button onClick={handleSave} loading={saving} disabled={!canSave}>
          {member ? 'Save changes' : 'Add staff member'}
        </Button>
      </div>
    </Modal>
  )
}

function blankForm(branches: Branch[]): StaffFormPayload {
  return {
    branchId:    branches[0]?.id ?? '',
    firstName:   '',
    lastName:    '',
    email:       '',
    phone:       '',
    title:       '',
    bio:         '',
    status:      'ACTIVE',
    categoryIds: [],
    serviceIds:  [],
  }
}

/* ------------------------------------------------------------------ */
/*  Sub-components                                                     */
/* ------------------------------------------------------------------ */

function Stat({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="flex-shrink-0">
      <p className="text-xs text-ink-3">{label}</p>
      <p className="text-lg font-semibold text-ink mt-0.5">
        {value} <span className="text-sm font-normal text-ink-3">{sub}</span>
      </p>
    </div>
  )
}

function InfoSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-surface rounded-2xl border border-line p-5">
      <p className="text-xs font-semibold text-ink-3 uppercase tracking-wider mb-4">{title}</p>
      {children}
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-1.5 gap-3">
      <span className="text-sm text-ink-3 flex-shrink-0">{label}</span>
      <span className="text-sm text-ink text-right truncate">{value}</span>
    </div>
  )
}

function Avatar({ name, size = 'md' }: { name: string; size?: 'sm' | 'md' | 'lg' }) {
  const initials = name.split(' ').map(p => p[0]).filter(Boolean).join('').slice(0, 2).toUpperCase()
  const dim = size === 'lg' ? 'w-12 h-12 text-base' : size === 'sm' ? 'w-7 h-7 text-[10px]' : 'w-9 h-9 text-xs'
  return (
    <div className={`${dim} rounded-full bg-warm flex items-center justify-center font-semibold text-ink-2 flex-shrink-0`}>
      {initials || '?'}
    </div>
  )
}

function LoadingState({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <svg className="animate-spin text-ink-3 mb-4" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 12a9 9 0 11-6.219-8.56" />
      </svg>
      <p className="text-ink-3 text-sm">{label}</p>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function normalizeArray<T>(res: unknown): T[] {
  if (Array.isArray(res)) return res as T[]
  const anyRes = res as any
  if (Array.isArray(anyRes?.data?.data)) return anyRes.data.data as T[]
  if (Array.isArray(anyRes?.data)) return anyRes.data as T[]
  return []
}

function extractErrorMessage(err: unknown, fallback = 'Something went wrong.'): string {
  if (!err) return fallback
  const anyErr = err as any

  if (Array.isArray(anyErr?.fieldErrors) && anyErr.fieldErrors.length > 0) {
    const f = anyErr.fieldErrors[0]
    if (typeof f === 'string') return f
    const prefix = f?.field ? `${f.field}: ` : ''
    return `${prefix}${f?.message ?? JSON.stringify(f)}`
  }

  if (Array.isArray(anyErr?.details) && anyErr.details.length > 0) {
    return formatDetail(anyErr.details[0])
  }

  const data = anyErr?.response?.data ?? anyErr?.data ?? anyErr

  if (Array.isArray(data?.errors) && data.errors.length > 0) {
    return String(data.errors[0])
  }

  if (Array.isArray(data?.details) && data.details.length > 0) {
    return formatDetail(data.details[0])
  }

  if (typeof data?.message === 'string' && data.message) return data.message
  if (typeof anyErr?.message === 'string' && anyErr.message) return anyErr.message
  return fallback
}

function formatDetail(detail: any): string {
  if (typeof detail === 'string') return detail
  if (detail && typeof detail === 'object') {
    const field = detail.field ? `${detail.field}: ` : ''
    return `${field}${detail.message ?? JSON.stringify(detail)}`
  }
  return String(detail)
}

function PlusIcon() { return <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 5v14M5 12h14"/></svg> }
function PersonIcon() { return <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2M12 11a4 4 0 100-8 4 4 0 000 8z"/></svg> }