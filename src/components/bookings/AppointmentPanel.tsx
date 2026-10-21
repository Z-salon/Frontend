// src/components/bookings/AppointmentPanel.tsx

import { useEffect, useMemo, useRef, useState } from 'react'
import type {
  Appointment,
  AppointmentStatus,
  AppointmentStaffRef,
  AppointmentReceipt,
  AppointmentReminder,
  AppointmentReminderType,
  AppointmentReminderStatus,
  AppointmentFollowUp,
  AppointmentFollowUpOutcome,
  ResolveAppointmentFollowUpInput,
} from '../../types/api'
import { StatusBadge, Avatar, Button, Modal } from '../ui'
import { useToast } from '../ui/Toast'
import { appointmentsApi } from '../../api/appointments.api'
import { receiptsApi } from '../../api/receipts.api'
import { useAppointmentFeedback } from '../../hooks/useAppointmentFeedback'
import { useServiceUsages } from '../../hooks/useServiceUsages'
import { ServiceUsageSection } from './ServiceUsageSection'
import { AppointmentPaymentsSection } from './AppointmentPaymentsSection'
import { useAppointmentPayments } from '../../hooks/useAppointmentPayments'
import { ReceiptReviewModal } from '../bookings/ReceiptReviewModal'
import {
  PaymentsForm,
  emptyPaymentsDraft,
  isPaymentsDraftEmpty,
  paymentsDraftToInput,
  validatePaymentsDraft,
  type PaymentsDraft,
} from './PaymentsForm'
import {
  ServiceUsageForm,
  draftToInput,
  emptyDraft,
  isDraftEmpty,
  validateDraft,
  type ServiceUsageDraft,
} from './ServiceUsageForm'

/* ------------------------------------------------------------------ */
/*  Props                                                              */
/* ------------------------------------------------------------------ */

interface PanelProps {
  appointment: Appointment | null
  businessId: string
  /** IANA timezone used to render the appointment's times. */
  timezone?: string
  /** Resolved branch name. Pass the branch's display name, not its id. */
  branchName?: string
  /** Resolved customer name. Falls back to "Customer" when missing. */
  customerName?: string
  /** Resolved customer phone (primary). Optional. */
  customerPhone?: string
  /** Resolved staff name (first + last). Falls back to the payload's ref. */
  staffName?: string
  onClose: () => void
  onChanged: (updated: Appointment) => void
  /**
   * Opens the Feedback section on a specific submission. Fired by the
   * post-visit feedback block; omitted, the block renders read-only.
   */
  onViewFeedback?: (submissionId: string) => void
  /**
   * Refetch callback. The follow-up/reminder sections call this after a
   * resolve so the panel sees fresh `needsFollowUp` / `followUp` /
   * `reminders` state. If omitted, the panel only updates its local copy.
   */
  onRefresh?: () => void
}

/* ------------------------------------------------------------------ */
/*  Actions                                                            */
/* ------------------------------------------------------------------ */

type ActionKind = 'transition' | 'no-show' | 'cancel'

interface ActionDef {
  label: string
  kind: ActionKind
  status?: AppointmentStatus
  variant?: 'primary' | 'secondary' | 'destructive'
  /** `actualEnd` opens the completion modal. `reason` uses a native prompt. */
  prompt?: 'reason' | 'actualEnd'
}

const ACTIONS: Partial<Record<AppointmentStatus, ActionDef[]>> = {
  PENDING: [
    { label: 'Confirm', kind: 'transition', status: 'CONFIRMED', variant: 'primary' },
    { label: 'Cancel',  kind: 'cancel', variant: 'destructive' },
  ],
  CONFIRMED: [
    { label: 'Check in', kind: 'transition', status: 'CHECKED_IN', variant: 'primary' },
    { label: 'No-show',  kind: 'no-show', variant: 'secondary' },
    { label: 'Cancel',   kind: 'cancel', variant: 'destructive' },
  ],
  CHECKED_IN: [
    { label: 'Start service', kind: 'transition', status: 'IN_PROGRESS', variant: 'primary' },
    { label: 'No-show',       kind: 'no-show', variant: 'secondary' },
    { label: 'Cancel',        kind: 'cancel', variant: 'destructive' },
  ],
  IN_PROGRESS: [
    { label: 'Mark complete', kind: 'transition', status: 'COMPLETED', variant: 'primary', prompt: 'actualEnd' },
    { label: 'Cancel',        kind: 'cancel', variant: 'destructive' },
  ],
  COMPLETED: [],
  CANCELLED: [],
  NO_SHOW: [],
  EXPIRED: [],
}

const DEFAULT_TZ = 'Africa/Addis_Ababa'

/* ------------------------------------------------------------------ */
/*  Staff ref helper — the payload sends a single object, not an array  */
/* ------------------------------------------------------------------ */

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

function staffRefName(ref: AppointmentStaffRef | null): string {
  if (!ref) return ''
  return `${ref.firstName ?? ''} ${ref.lastName ?? ''}`.trim()
}

/* ------------------------------------------------------------------ */
/*  Time helpers                                                       */
/* ------------------------------------------------------------------ */

/** HH:mm (24h) in the given IANA timezone. */
function hhmmInTZ(iso: string, timezone: string): string {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: timezone,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(iso))
}

/** "09:00" → "9:00 AM". "14:30" → "2:30 PM". "00:15" → "12:15 AM". */
function formatAmPm(hhmm: string): string {
  const [hStr, mStr] = hhmm.split(':')
  const h = Number(hStr)
  const m = Number(mStr)
  const suffix = h >= 12 ? 'PM' : 'AM'
  const h12 = h % 12 === 0 ? 12 : h % 12
  return `${h12}:${String(m).padStart(2, '0')} ${suffix}`
}

/**
 * Build an ISO string combining the *date* of `anchorIso` with the
 * wall-clock time given by `hhmm`, interpreting the time in the given
 * IANA timezone.
 */
function composeActualEnd(
  anchorIso: string,
  hhmm: string,
  timezone: string,
): string {
  const ymd = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(anchorIso))

  const [y, mo, d] = ymd.split('-').map(Number)
  const [h, m] = hhmm.split(':').map(Number)
  const local = new Date(y, mo - 1, d, h, m, 0, 0)
  return local.toISOString()
}

/** Whole minutes between two ISO instants, clamped to ≥ 0. */
function minutesBetween(startIso: string, endIso: string): number {
  const start = new Date(startIso).getTime()
  const end = new Date(endIso).getTime()
  return Math.max(0, Math.round((end - start) / 60000))
}

function formatDuration(min: number): string {
  if (min < 60) return `${min} min`
  const h = Math.floor(min / 60)
  const m = min % 60
  return m === 0 ? `${h} hr` : `${h} hr ${m} min`
}

/** Current wall-clock HH:mm in the given timezone. */
function nowHHmmInTZ(timezone: string): string {
  return hhmmInTZ(new Date().toISOString(), timezone)
}

/**
 * Compose an ISO from a `YYYY-MM-DD` date string + `HH:mm` time, in the
 * given IANA timezone. Mirror of {@link composeActualEnd} with a different
 * anchor — used by the reschedule picker.
 */
function composeDateTimeInTZ(
  ymd: string,
  hhmm: string,
  _timezone: string,
): string | null {
  const dateParts = ymd.split('-').map(Number)
  const timeParts = hhmm.split(':').map(Number)
  if (dateParts.length !== 3 || timeParts.length !== 2) return null
  const [y, mo, d] = dateParts
  const [h, m] = timeParts
  if ([y, mo, d, h, m].some(n => Number.isNaN(n))) return null
  const local = new Date(y, mo - 1, d, h, m, 0, 0)
  return local.toISOString()
}

/** `YYYY-MM-DD` in the given IANA timezone. */
function ymdInTZ(iso: string, timezone: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(iso))
}

/* ------------------------------------------------------------------ */
/*  TimePicker — typable single field with overflow dropdown           */
/* ------------------------------------------------------------------ */

interface TimePickerProps {
  value: string
  onChange: (hhmm: string) => void
  stepMinutes?: number
  label?: string
  hint?: string
  error?: string
  onNow?: () => void
  disabled?: boolean
}

function buildTimeOptions(
  stepMinutes: number,
): Array<{ value: string; label: string }> {
  const out: Array<{ value: string; label: string }> = []
  for (let m = 0; m < 24 * 60; m += stepMinutes) {
    const hh = String(Math.floor(m / 60)).padStart(2, '0')
    const mm = String(m % 60).padStart(2, '0')
    const value = `${hh}:${mm}`
    out.push({ value, label: formatAmPm(value) })
  }
  return out
}

function parseTimeInput(raw: string): string | null {
  if (!raw) return null
  const s = raw.trim().toLowerCase().replace(/\s+/g, '')

  let meridiem: 'AM' | 'PM' | null = null
  let body = s
  if (body.endsWith('am')) {
    meridiem = 'AM'
    body = body.slice(0, -2)
  } else if (body.endsWith('pm')) {
    meridiem = 'PM'
    body = body.slice(0, -2)
  } else if (body.endsWith('a')) {
    meridiem = 'AM'
    body = body.slice(0, -1)
  } else if (body.endsWith('p')) {
    meridiem = 'PM'
    body = body.slice(0, -1)
  }

  let h = 0
  let m = 0

  if (body.includes(':')) {
    const [hPart, mPart] = body.split(':')
    if (!/^\d{1,2}$/.test(hPart)) return null
    if (!/^\d{0,2}$/.test(mPart)) return null
    h = Number(hPart)
    m = mPart === '' ? 0 : Number(mPart)
  } else {
    if (!/^\d{1,4}$/.test(body)) return null
    if (body.length <= 2) {
      h = Number(body)
      m = 0
    } else if (body.length === 3) {
      h = Number(body.slice(0, 1))
      m = Number(body.slice(1))
    } else {
      h = Number(body.slice(0, 2))
      m = Number(body.slice(2))
    }
  }

  if (meridiem) {
    if (h < 1 || h > 12) return null
    if (meridiem === 'AM') h = h === 12 ? 0 : h
    else h = h === 12 ? 12 : h + 12
  }

  if (h < 0 || h > 23) return null
  if (m < 0 || m > 59) return null
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

function snapToStep(hhmm: string, stepMinutes: number): string {
  const [hStr, mStr] = hhmm.split(':')
  const total = Number(hStr) * 60 + Number(mStr)
  const snapped = Math.round(total / stepMinutes) * stepMinutes
  const wrapped = ((snapped % (24 * 60)) + 24 * 60) % (24 * 60)
  const hh = String(Math.floor(wrapped / 60)).padStart(2, '0')
  const mm = String(wrapped % 60).padStart(2, '0')
  return `${hh}:${mm}`
}

function TimePicker({
  value,
  onChange,
  stepMinutes = 15,
  label,
  hint,
  error,
  onNow,
  disabled,
}: TimePickerProps) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [highlight, setHighlight] = useState(0)

  const triggerRef = useRef<HTMLInputElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)

  const [panelRect, setPanelRect] = useState<DOMRect | null>(null)

  const allOptions = useMemo(
    () => buildTimeOptions(stepMinutes),
    [stepMinutes],
  )

  const filteredOptions = useMemo(() => {
    if (!query.trim()) return allOptions
    const q = query.trim().toLowerCase()
    return allOptions.filter(o => {
      const label = o.label.toLowerCase().replace(/\s+/g, '')
      const val = o.value.toLowerCase()
      return label.includes(q.replace(/\s+/g, '')) || val.includes(q)
    })
  }, [allOptions, query])

  useEffect(() => {
    setHighlight(h => {
      if (filteredOptions.length === 0) return 0
      return Math.min(h, filteredOptions.length - 1)
    })
  }, [filteredOptions])

  useEffect(() => {
    if (!open) return
    function update() {
      if (triggerRef.current) {
        setPanelRect(triggerRef.current.getBoundingClientRect())
      }
    }
    update()
    window.addEventListener('scroll', update, true)
    window.addEventListener('resize', update)
    return () => {
      window.removeEventListener('scroll', update, true)
      window.removeEventListener('resize', update)
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    function onDoc(e: MouseEvent) {
      const t = e.target as Node
      if (
        triggerRef.current?.contains(t) ||
        panelRef.current?.contains(t)
      ) {
        return
      }
      commitOrRevert()
    }
    function onEsc(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setOpen(false)
        setQuery('')
      }
    }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onEsc)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('keydown', onEsc)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  function commitOrRevert() {
    const parsed = query ? parseTimeInput(query) : null
    if (parsed) {
      onChange(snapToStep(parsed, stepMinutes))
    }
    setOpen(false)
    setQuery('')
  }

  function openPanel() {
    if (disabled) return
    setOpen(true)
    setQuery('')
    requestAnimationFrame(() => {
      const selectedIdx = allOptions.findIndex(o => o.value === value)
      setHighlight(selectedIdx >= 0 ? selectedIdx : 0)
    })
  }

  function selectOption(v: string) {
    onChange(v)
    setOpen(false)
    setQuery('')
    triggerRef.current?.blur()
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault()
      if (!open) {
        openPanel()
        return
      }
      setHighlight(h => {
        const next = e.key === 'ArrowDown' ? h + 1 : h - 1
        const len = filteredOptions.length
        if (len === 0) return 0
        return ((next % len) + len) % len
      })
      return
    }
    if (e.key === 'Enter') {
      e.preventDefault()
      if (open && filteredOptions[highlight]) {
        selectOption(filteredOptions[highlight].value)
        return
      }
      const parsed = parseTimeInput(query)
      if (parsed) {
        onChange(snapToStep(parsed, stepMinutes))
      }
      setOpen(false)
      setQuery('')
      triggerRef.current?.blur()
      return
    }
    if (e.key === 'Tab') {
      commitOrRevert()
    }
  }

  const displayValue = formatAmPm(value)

  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <div className="flex items-center justify-between">
          <label className="text-sm font-medium text-ink-2">{label}</label>
          {onNow && (
            <button
              type="button"
              onClick={onNow}
              disabled={disabled}
              className="text-xs text-ink-3 hover:text-ink transition-colors disabled:opacity-50"
            >
              Now
            </button>
          )}
        </div>
      )}

      <div className="relative">
        <input
          ref={triggerRef}
          type="text"
          value={open ? query : displayValue}
          placeholder="e.g. 2:30 PM"
          disabled={disabled}
          onFocus={openPanel}
          onChange={e => {
            setQuery(e.target.value)
            if (!open) setOpen(true)
          }}
          onKeyDown={handleKeyDown}
          className={`
            w-full h-10 px-3 pr-9 rounded-[10px]
            border bg-surface text-ink text-sm
            placeholder:text-ink-3
            focus:outline-none focus:border-ink-3 focus:ring-2 focus:ring-ink-3/10
            transition-colors
            disabled:opacity-50 disabled:cursor-not-allowed
            ${error ? 'border-[#C47B7B]' : 'border-line'}
          `}
        />
        <button
          type="button"
          tabIndex={-1}
          onClick={() => (open ? commitOrRevert() : openPanel())}
          className="absolute right-2 top-1/2 -translate-y-1/2 w-6 h-6 rounded-md flex items-center justify-center text-ink-3 hover:text-ink transition-colors"
          aria-label="Toggle time options"
        >
          <svg
            className={`transition-transform ${open ? 'rotate-180' : ''}`}
            width="12" height="12" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="2"
            strokeLinecap="round" strokeLinejoin="round"
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </button>
      </div>

      {error && <p className="text-xs text-[#B06A3A]">{error}</p>}
      {hint && !error && <p className="text-xs text-ink-3">{hint}</p>}

      {open && panelRect && (
        <div
          ref={panelRef}
          style={{
            position: 'fixed',
            top: panelRect.bottom + 6,
            left: panelRect.left,
            width: panelRect.width,
            zIndex: 100,
          }}
          className="
            rounded-[10px] border border-line bg-surface
            shadow-lg shadow-black/10
            overflow-hidden
          "
        >
          <div className="max-h-56 overflow-y-auto py-1">
            {filteredOptions.length === 0 ? (
              <p className="px-3 py-2 text-sm text-ink-3">No matching time</p>
            ) : (
              filteredOptions.map((o, i) => {
                const selected = o.value === value
                const highlighted = i === highlight
                return (
                  <button
                    key={o.value}
                    type="button"
                    onMouseEnter={() => setHighlight(i)}
                    onClick={() => selectOption(o.value)}
                    className={`
                      w-full px-3 py-2 text-left text-sm
                      flex items-center justify-between gap-2
                      transition-colors
                      ${highlighted ? 'bg-warm-subtle' : ''}
                      ${selected ? 'text-ink font-medium' : 'text-ink-2'}
                    `}
                  >
                    <span>{o.label}</span>
                    {selected && (
                      <svg
                        width="14" height="14" viewBox="0 0 24 24" fill="none"
                        stroke="currentColor" strokeWidth="2.2"
                        strokeLinecap="round" strokeLinejoin="round"
                        className="text-ink flex-shrink-0"
                      >
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    )}
                  </button>
                )
              })
            )}
          </div>
        </div>
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Panel                                                              */
/* ------------------------------------------------------------------ */

export function AppointmentPanel({
  appointment: appointmentProp,
  businessId,
  timezone = DEFAULT_TZ,
  branchName,
  customerName,
  customerPhone,
  staffName,
  onClose,
  onChanged,
  onViewFeedback,
  onRefresh,
}: PanelProps) {
  const toast = useToast()
  const [busyKey, setBusyKey] = useState<string | null>(null)

  const [current, setCurrent] = useState<Appointment | null>(appointmentProp)

  const currentIdRef = useRef<string | null>(appointmentProp?.id ?? null)

  useEffect(() => {
    const nextId = appointmentProp?.id ?? null
    if (nextId !== currentIdRef.current) {
      currentIdRef.current = nextId
      setCurrent(appointmentProp)
    } else if (
      busyKey === null &&
      appointmentProp !== null &&
      current !== null &&
      appointmentProp !== current &&
      appointmentProp.status !== current.status
    ) {
      setCurrent(appointmentProp)
    }
  }, [appointmentProp, busyKey, current])

  const appointment = current
  const appointmentId = appointment?.id ?? null
  const appointmentStatus = appointment?.status ?? null

  const applyLocal = (updated: Appointment) => {
    setCurrent(updated)
    onChanged(updated)
  }

  const [showNoShow, setShowNoShow] = useState(false)
  const [noShowReason, setNoShowReason] = useState('')
  const [submittingNoShow, setSubmittingNoShow] = useState(false)

  const [showCancel, setShowCancel] = useState(false)
  const [cancelReason, setCancelReason] = useState('')
  const [cancelRefund, setCancelRefund] = useState(true)
  const [submittingCancel, setSubmittingCancel] = useState(false)

  const [showComplete, setShowComplete] = useState(false)
  const [completeTime, setCompleteTime] = useState('')
  const [submittingComplete, setSubmittingComplete] = useState(false)

  const [sendingFeedback, setSendingFeedback] = useState(false)

  const serviceUsage = useServiceUsages(businessId, appointmentId ?? undefined, appointmentStatus ?? undefined)
  const [completeDraft, setCompleteDraft] = useState<ServiceUsageDraft>(emptyDraft())
  const [completeUsageError, setCompleteUsageError] = useState<string | null>(null)

  const payments = useAppointmentPayments(businessId, appointmentId ?? undefined)
  const [completePayDraft, setCompletePayDraft] = useState<PaymentsDraft>(emptyPaymentsDraft())
  const [completePayError, setCompletePayError] = useState<string | null>(null)

  const feedback = useAppointmentFeedback(businessId, appointment)

  /* ── Reminder / follow-up ──────────────────────────────────────── */

  const [showResolveFollowUp, setShowResolveFollowUp] = useState(false)
  const [remindersExpanded, setRemindersExpanded] = useState(false)

  /**
   * `reminders` and `followUp` come straight off the appointment object
   * returned by the single-get endpoint (§1 of the reminder API doc). No
   * separate fetch is needed — `appointmentsApi.get` already returns them.
   */
  const reminders = appointment?.reminders ?? []
  const openFollowUp: AppointmentFollowUp | null =
    appointment?.followUp && appointment.followUp.status === 'OPEN'
      ? appointment.followUp
      : null

  /**
   * The follow-up block belongs to CONFIRMED appointments only — per the
   * reminder doc, follow-ups are raised when a CONFIRMED appointment
   * passes its confirmation deadline. PENDING appointments never get one.
   */
  const showFollowUpBlock =
    appointmentStatus === 'CONFIRMED' &&
    (openFollowUp !== null || appointment?.needsFollowUp === true)

  /* ── Customer confirmation link (dev-only endpoint) ──────────────
   *
   * Only fetched for CONFIRMED appointments. PENDING is the deposit-
   * verification stage — the customer hasn't got a live appointment yet,
   * so there's nothing to cancel or re-confirm. Once staff confirm the
   * deposit and the appointment flips to CONFIRMED, the customer gets a
   * link that lets them keep or cancel the booking. */

  const [confirmLink, setConfirmLink] = useState<string | null>(null)
  const [confirmLinkLoading, setConfirmLinkLoading] = useState(false)

  useEffect(() => {
    if (!appointmentId) {
      setConfirmLink(null)
      return
    }
    if (appointmentStatus !== 'CONFIRMED') {
      setConfirmLink(null)
      return
    }

    let cancelled = false
    setConfirmLinkLoading(true)
    appointmentsApi
      .confirmationLink(businessId, appointmentId)
      .then(res => {
        if (cancelled) return
        // `http` may or may not unwrap the envelope, so tolerate both.
        // Response shape: { success, data: { token, confirmationUrl } }
        const d: any = (res as any)?.data ?? res
        setConfirmLink(d?.confirmationUrl ?? null)
      })
      .catch(() => {
        // 404 = endpoint disabled in production, or the appointment isn't
        // in a state that supports it. Silent — the block just renders
        // without a link.
        if (cancelled) return
        setConfirmLink(null)
      })
      .finally(() => {
        if (!cancelled) setConfirmLinkLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [businessId, appointmentId, appointmentStatus])

  /* ── Receipt: fetch when the appointment is PENDING ──────────────── */

  const [receipt, setReceipt] = useState<AppointmentReceipt | null>(null)
  const [receiptLoading, setReceiptLoading] = useState(false)
  const [showReceiptImage, setShowReceiptImage] = useState(false)
  const [showReceiptReview, setShowReceiptReview] = useState(false)

  useEffect(() => {
    if (!appointmentId) {
      setReceipt(null)
      return
    }
    if (appointmentStatus !== 'PENDING') {
      setReceipt(null)
      return
    }

    let cancelled = false
    setReceiptLoading(true)
    receiptsApi
      .getForAppointment(businessId, appointmentId)
      .then(r => {
        if (cancelled) return
        setReceipt(r)
      })
      .catch(() => {
        if (cancelled) return
        setReceipt(null)
      })
      .finally(() => {
        if (!cancelled) setReceiptLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [businessId, appointmentId, appointmentStatus])

  if (!appointment) return null

  const actions = ACTIONS[appointment.status] ?? []

  /* ---------------- Time formatting ---------------- */

  const startTime = hhmmInTZ(appointment.scheduledStart, timezone)
  const endTime = hhmmInTZ(appointment.scheduledEnd, timezone)

  const startTimeAmPm = formatAmPm(startTime)
  const endTimeAmPm = formatAmPm(endTime)

  const formattedDate = new Intl.DateTimeFormat('en-GB', {
    timeZone: timezone,
    weekday: 'short',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date(appointment.scheduledStart))

  /* ---------------- Derived display values ---------------- */

  const name = customerName ?? 'Customer'
  const branch = branchName ?? '—'

  const ref = appointmentStaff(appointment)
  const staff = staffName?.trim() || staffRefName(ref) || '—'

  const totalAmount = Number(appointment.totalAmount || 0)

  /* ---------------- Completion modal helpers ---------------- */

  const scheduledDurationMin = minutesBetween(
    appointment.scheduledStart,
    appointment.scheduledEnd,
  )

  const previewActualEnd = completeTime
    ? composeActualEnd(appointment.scheduledStart, completeTime, timezone)
    : null
  const previewDurationMin = previewActualEnd
    ? minutesBetween(appointment.scheduledStart, previewActualEnd)
    : null

  const completeInvalid =
    !completeTime ||
    !previewActualEnd ||
    previewDurationMin === null ||
    previewActualEnd <= appointment.scheduledStart

  /* ---------------- Action dispatch ---------------- */

  async function runAction(action: ActionDef) {
    if (!appointment) return
    const key = `${action.kind}:${action.status ?? ''}`
    setBusyKey(key)

    try {
      let updated: Appointment

      if (action.kind === 'transition' && action.status) {
        const body: Parameters<typeof appointmentsApi.updateStatus>[2] = {
          status: action.status,
        }

        if (action.prompt === 'actualEnd') {
          setCompleteTime(endTime)
          setCompleteDraft(emptyDraft(appointment.service.name))
          setCompleteUsageError(null)
          setCompletePayDraft(emptyPaymentsDraft())
          setCompletePayError(null)
          setShowComplete(true)
          setBusyKey(null)
          return
        }

        if (action.prompt === 'reason') {
          const raw = window.prompt('Reason (optional):')
          if (raw === null) {
            setBusyKey(null)
            return
          }
          if (raw.trim()) body.reason = raw.trim()
        }

        updated = await appointmentsApi.updateStatus(
          businessId,
          appointment.id,
          body,
        )
      } else if (action.kind === 'no-show') {
        setNoShowReason('')
        setShowNoShow(true)
        setBusyKey(null)
        return
      } else if (action.kind === 'cancel') {
        setCancelReason('')
        setCancelRefund(true)
        setShowCancel(true)
        setBusyKey(null)
        return
      } else {
        setBusyKey(null)
        return
      }

      toast.success('Appointment updated')
      applyLocal(updated)
    } catch (err) {
      console.error('[appointment] action failed', err)
      toast.error(extractErrorMessage(err, 'Could not update the appointment.'))
    } finally {
      setBusyKey(null)
    }
  }

  async function submitComplete() {
    if (!appointment) return
    if (completeInvalid || !previewActualEnd) return

    const wantsUsage = !isDraftEmpty(completeDraft)
    if (wantsUsage) {
      const invalid = validateDraft(completeDraft)
      if (invalid) {
        setCompleteUsageError(invalid)
        return
      }
    }

    const wantsPayment = !isPaymentsDraftEmpty(completePayDraft)
    if (wantsPayment) {
      const invalid = validatePaymentsDraft(completePayDraft)
      if (invalid) {
        setCompletePayError(invalid)
        return
      }
    }

    setSubmittingComplete(true)
    setCompleteUsageError(null)
    setCompletePayError(null)

    let usageSaved = false
    if (wantsUsage) {
      const created = await serviceUsage.add(draftToInput(completeDraft))
      if (!created) {
        setCompleteUsageError(
          'Could not save the service usage, so the appointment was not completed. Check the details and try again.',
        )
        setSubmittingComplete(false)
        return
      }
      usageSaved = true
    }

    let paymentSaved = false
    if (wantsPayment) {
      const input = paymentsDraftToInput(completePayDraft)
      if (input) {
        const created = await payments.record(input)
        if (!created) {
          setCompletePayError(
            usageSaved
              ? 'Service usage was saved, but the payment could not be recorded, so the appointment was not completed. Record the payment from the panel, then retry — do not add the usage again.'
              : 'Could not record the payment, so the appointment was not completed. Check the amounts and try again.',
          )
          setSubmittingComplete(false)
          return
        }
        paymentSaved = true
      }
    }

    try {
      const updated = await appointmentsApi.updateStatus(
        businessId,
        appointment.id,
        {
          status: 'COMPLETED',
          actualEnd: previewActualEnd,
        },
      )
      const savedBits = [
        wantsUsage && 'service usage',
        paymentSaved && 'payment',
      ].filter(Boolean) as string[]
      toast.success(
        savedBits.length
          ? `Appointment completed and ${savedBits.join(' and ')} saved`
          : 'Appointment completed',
      )
      applyLocal(updated)
      setShowComplete(false)
    } catch (err) {
      console.error('[appointment] complete failed', err)
      const savedBits = [
        usageSaved && 'service usage',
        paymentSaved && 'payment',
      ].filter(Boolean) as string[]

      if (savedBits.length) {
        toast.error(
          `${savedBits.join(' and ')} saved, but completing the appointment failed. Retry "Mark as complete" — do not add them again.`,
        )
      } else {
        toast.error(extractErrorMessage(err, 'Could not complete the appointment.'))
      }
    } finally {
      setSubmittingComplete(false)
    }
  }

  async function submitNoShow() {
    if (!appointment) return
    setSubmittingNoShow(true)
    try {
      const updated = await appointmentsApi.noShow(
        businessId,
        appointment.id,
        noShowReason.trim() || undefined,
      )
      toast.success('Marked as no-show')
      applyLocal(updated)
      setShowNoShow(false)
    } catch (err) {
      console.error('[appointment] no-show failed', err)
      toast.error(extractErrorMessage(err, 'Could not mark the appointment.'))
    } finally {
      setSubmittingNoShow(false)
    }
  }

  async function submitCancel() {
    if (!appointment) return
    setSubmittingCancel(true)
    try {
      const updated = await appointmentsApi.cancel(businessId, appointment.id, {
        reason: cancelReason.trim() || undefined,
        refund: cancelRefund,
      })
      toast.success('Appointment cancelled')
      applyLocal(updated)
      setShowCancel(false)
    } catch (err) {
      console.error('[appointment] cancel failed', err)
      toast.error(extractErrorMessage(err, 'Could not cancel the appointment.'))
    } finally {
      setSubmittingCancel(false)
    }
  }

  /* ---------------- Render ---------------- */

  return (
    <>
      <div className="w-full lg:w-[320px] flex-shrink-0 bg-surface border-l border-line flex flex-col h-full overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-line flex-shrink-0">
          <p className="text-sm font-semibold text-ink">Appointment</p>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-lg flex items-center justify-center text-ink-3 hover:bg-warm-subtle hover:text-ink transition-colors"
            aria-label="Close panel"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          <div className="px-5 pt-5 pb-4 border-b border-line">
            <div className="mb-4 flex items-center gap-2 flex-wrap">
              <StatusBadge status={appointment.status} />
              {appointment.needsFollowUp && (
                <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-[#FBF0E8] text-[#8A4B1F]">
                  Follow-up
                </span>
              )}
            </div>
            <div className="flex items-center gap-3">
              <Avatar name={name} size="lg" />
              <div className="min-w-0">
                <p className="font-semibold text-ink text-sm truncate">{name}</p>
                {customerPhone && (
                  <p className="text-ink-3 text-sm truncate">{customerPhone}</p>
                )}
              </div>
            </div>
          </div>

          {/* ── PENDING: deposit verification only ──────────────────────
              At this stage the customer has been asked to send a deposit
              receipt. The only job here is verifying that receipt — the
              customer has no live appointment yet, so no confirmation
              link and no follow-up. */}
          {appointment.status === 'PENDING' && (
            <div className="px-5 py-4 border-b border-line">
              <p className="text-[10px] font-semibold text-ink-3 uppercase tracking-wider mb-3">
                Deposit
              </p>

              {receiptLoading && (
                <p className="text-sm text-ink-3">Checking for a receipt…</p>
              )}

              {!receiptLoading && receipt && receipt.status === 'PENDING' && (
                <button
                  type="button"
                  onClick={() => setShowReceiptImage(true)}
                  className="focus-ring w-full flex items-start gap-3 rounded-xl border border-dashed border-warm bg-warm-subtle/40 px-3.5 py-3 text-left hover:bg-warm-subtle transition-colors"
                >
                  <span
                    className="mt-0.5 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg"
                    style={{
                      background: 'var(--brand-soft-strong)',
                      color: 'var(--brand-accent)',
                    }}
                    aria-hidden="true"
                  >
                    <ReceiptIcon className="h-4 w-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium text-ink">
                      Receipt submitted
                    </span>
                    <span className="mt-0.5 block text-xs text-ink-3">
                      {Number(receipt.submittedAmount).toLocaleString()} ETB ·{' '}
                      click to view
                    </span>
                  </span>
                </button>
              )}

              {!receiptLoading && receipt && receipt.status === 'REJECTED' && (
                <div className="rounded-xl border border-dashed border-line bg-bg px-3.5 py-3">
                  <p className="text-sm font-medium text-ink">Receipt rejected</p>
                  {receipt.rejectionReason && (
                    <p className="mt-0.5 text-xs text-ink-3">
                      {receipt.rejectionReason}
                    </p>
                  )}
                  <p className="mt-1.5 text-xs text-ink-3">
                    Waiting for the customer to submit a corrected receipt.
                  </p>
                </div>
              )}

              {!receiptLoading && !receipt && (
                <p className="text-sm text-ink-3">
                  No receipt yet — waiting on the customer.
                </p>
              )}

              {/* A short hint so the receptionist knows what the next step
                  is. Once the deposit is approved, the appointment flips
                  to CONFIRMED and the customer link appears there. */}
              <p className="mt-3 text-xs text-ink-3 leading-relaxed">
                Approve the deposit to confirm the appointment. The customer
                confirmation link becomes available once the appointment is
                confirmed.
              </p>
            </div>
          )}

          <div className="px-5 py-4 border-b border-line">
            <p className="text-[10px] font-semibold text-ink-3 uppercase tracking-wider mb-3.5">
              Details
            </p>
            <div className="flex flex-col gap-3">
              <Row label="Service"  value={appointment.service.name} />
              <Row label="Staff"    value={staff} />
              <Row label="Branch"   value={branch} />
              <Row label="Date"     value={formattedDate} />
              <Row label="Time"     value={`${startTimeAmPm} – ${endTimeAmPm}`} />
              <Row label="Duration" value={`${appointment.service.durationMinutes} min`} />
              {appointment.bookingSource === 'WALK_IN' && (
                <Row label="Type" value="Walk-in" />
              )}
            </div>
          </div>

          {/* ── CONFIRMED: customer link + follow-up ────────────────────
              The appointment is now live. The customer can keep or cancel
              it from the link below. If the confirmation deadline passed
              without a response, the follow-up block appears underneath. */}
          {appointment.status === 'CONFIRMED' && (
            <div className="px-5 py-4 border-b border-line bg-warm-subtle/30">
              <p className="text-[10px] font-semibold text-ink-3 uppercase tracking-wider mb-2">
                Customer confirmation link
              </p>
              <p className="text-sm text-ink-2 leading-relaxed mb-3">
                Share this with the customer if they want to review, keep, or
                cancel their appointment.
              </p>

              {confirmLinkLoading && (
                <p className="text-xs text-ink-3 mb-3">
                  Loading confirmation link…
                </p>
              )}

              {!confirmLinkLoading && confirmLink && (
                <div className="rounded-xl border border-line bg-bg px-3.5 py-3">
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <p className="text-[11px] text-ink-3">
                      Confirmation link
                    </p>
                    <button
                      type="button"
                      onClick={async () => {
                        try {
                          await navigator.clipboard.writeText(confirmLink)
                          toast.success('Confirmation link copied.')
                        } catch {
                          toast.error('Could not copy the link.')
                        }
                      }}
                      className="text-[11px] text-ink-3 hover:text-ink transition-colors"
                    >
                      Copy
                    </button>
                  </div>
                  <a
                    href={confirmLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-ink underline underline-offset-2 break-all hover:text-ink-2"
                  >
                    {confirmLink}
                  </a>
                </div>
              )}

              {/* No empty state. In production the dev-only endpoint 404s
                  by design and there's genuinely no link to fetch — the
                  customer receives it via SMS instead. */}
            </div>
          )}

          {/* ── Follow-up block ────────────────────────────────────────
              CONFIRMED-only. Fires when the confirmation deadline passed
              without a customer response. Sits below the confirmation
              link so the staff can act on the follow-up once they've
              reached the customer. */}
          {showFollowUpBlock && (
            <div className="px-5 py-4 border-b border-line bg-[#FBF0E8]/40">
              <div className="flex items-center justify-between gap-2 mb-2">
                <p className="text-[10px] font-semibold text-[#8A4B1F] uppercase tracking-wider">
                  Follow-up required
                </p>
              </div>

              <p className="text-sm text-ink-2 leading-relaxed mb-3">
                The confirmation deadline passed without a customer response.
                Contact the customer and record the outcome. This does not
                cancel the appointment automatically.
              </p>

              {openFollowUp ? (
                <div className="flex flex-col gap-3">
                  <div className="bg-bg rounded-xl px-3.5 py-3 flex flex-col gap-1.5 text-xs">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-ink-3">Raised</span>
                      <span className="text-ink">
                        {new Date(openFollowUp.createdAt).toLocaleString()}
                      </span>
                    </div>
                    {openFollowUp.staffName && (
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-ink-3">Assigned</span>
                        <span className="text-ink truncate">
                          {openFollowUp.staffName}
                        </span>
                      </div>
                    )}
                  </div>

                  <Button
                    variant="primary"
                    size="sm"
                    fullWidth
                    onClick={() => setShowResolveFollowUp(true)}
                  >
                    Resolve follow-up
                  </Button>
                </div>
              ) : (
                <p className="text-xs text-ink-3">
                  Follow-up details are still loading. Refresh the appointment
                  if this persists.
                </p>
              )}
            </div>
          )}

          {appointment.notes && (
            <div className="px-5 py-4">
              <p className="text-[10px] font-semibold text-ink-3 uppercase tracking-wider mb-3">
                Notes
              </p>
              <p className="text-sm text-ink-2 leading-relaxed">
                {appointment.notes}
              </p>
            </div>
          )}

          {/* ── Reminders block ─────────────────────────────────────── */}
          {reminders.length > 0 && (
            <div className="px-5 py-4 border-t border-line">
              <button
                type="button"
                onClick={() => setRemindersExpanded(v => !v)}
                className="w-full flex items-center justify-between gap-2 mb-1"
                aria-expanded={remindersExpanded}
              >
                <span className="text-[10px] font-semibold text-ink-3 uppercase tracking-wider">
                  Confirmation reminders ({reminders.length})
                </span>
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className={`text-ink-3 transition-transform ${remindersExpanded ? 'rotate-180' : ''}`}
                >
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </button>

              {!remindersExpanded && (
                <p className="text-xs text-ink-3 mt-1">
                  {summarizeReminders(reminders)}
                </p>
              )}

              {remindersExpanded && (
                <div className="mt-3 flex flex-col gap-2">
                  {reminders
                    .slice()
                    .sort(
                      (a, b) =>
                        new Date(a.scheduledAt).getTime() -
                        new Date(b.scheduledAt).getTime(),
                    )
                    .map(r => (
                      <ReminderRow key={r.id} reminder={r} />
                    ))}
                </div>
              )}
            </div>
          )}

          <div className="px-5 py-4 border-t border-line">
            <ServiceUsageSection
              businessId={businessId}
              appointmentId={appointment.id}
              status={appointment.status}
              serviceName={appointment.service.name}
              onChanged={() => onChanged(appointment)}
            />
          </div>

          <div className="px-5 py-4 border-t border-line">
            <AppointmentPaymentsSection
              businessId={businessId}
              appointmentId={appointment.id}
              totalAmount={totalAmount}
              onChanged={() => onChanged(appointment)}
            />
          </div>

          {feedback.state !== 'inactive' && (
            <div className="px-5 py-4 border-t border-line">
              <p className="text-[10px] font-semibold text-ink-3 uppercase tracking-wider mb-3">
                Customer feedback
              </p>

              {feedback.state === 'loading' && (
                <p className="text-sm text-ink-3">Checking for a response…</p>
              )}

              {feedback.state === 'awaiting' && (
                <div className="flex flex-col gap-3">
                  <p className="text-sm text-ink-2 leading-relaxed">
                    No response yet. The customer received a feedback link when
                    this appointment was completed, and it stays open for seven
                    days.
                  </p>

                  {feedback.url && (
                    <div className="rounded-xl border border-line bg-bg px-3.5 py-3">
                      <p className="text-[11px] text-ink-3 mb-1">
                        Feedback link
                      </p>
                      <a
                        href={feedback.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-ink underline underline-offset-2 break-all hover:text-ink-2"
                      >
                        {feedback.url}
                      </a>
                    </div>
                  )}

                  <Button
                    variant="secondary"
                    size="sm"
                    fullWidth
                    loading={sendingFeedback}
                    disabled={sendingFeedback}
                    onClick={async () => {
                      setSendingFeedback(true)
                      const delivered = await feedback.resend()
                      setSendingFeedback(false)

                      if (delivered === null) {
                        toast.error('Could not resend the feedback link.')
                        return
                      }
                      if (delivered) {
                        toast.success('Feedback link sent to the customer.')
                      } else {
                        toast.error('Link created, but the SMS was not delivered.')
                      }
                      feedback.reload()
                    }}
                  >
                    Resend feedback link
                  </Button>
                </div>
              )}

              {feedback.state === 'error' && (
                <p className="text-sm text-ink-3 leading-relaxed">
                  Could not check for a response.
                  <button
                    type="button"
                    onClick={feedback.reload}
                    className="ml-1.5 underline underline-offset-2 hover:text-ink"
                  >
                    Retry
                  </button>
                </p>
              )}

              {feedback.state === 'received' && feedback.submission && (
                <div className="flex flex-col gap-3">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm font-medium text-ink">
                      Response received
                      {feedback.submission.is_anonymous && ' · anonymous'}
                    </span>
                    <span className="text-xs text-ink-3 flex-shrink-0">
                      {new Date(feedback.submission.submitted_at).toLocaleDateString()}
                    </span>
                  </div>

                  {feedback.url && (
                    <div className="rounded-xl border border-line bg-bg px-3.5 py-3">
                      <p className="text-[11px] text-ink-3 mb-1">
                        Feedback link
                      </p>
                      <a
                        href={feedback.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-ink underline underline-offset-2 break-all hover:text-ink-2"
                      >
                        {feedback.url}
                      </a>
                    </div>
                  )}

                  {onViewFeedback && (
                    <Button
                      variant="secondary"
                      size="sm"
                      fullWidth
                      onClick={() => onViewFeedback(feedback.submission!.id)}
                    >
                      View response
                    </Button>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {actions.length > 0 && (
          <div className="px-5 py-4 border-t border-line flex-shrink-0 flex flex-col gap-2">
            {actions.map(action => {
              const key = `${action.kind}:${action.status ?? ''}`
              const isThis = busyKey === key
              const disabled = busyKey !== null && !isThis
              return (
                <Button
                  key={key}
                  variant={action.variant ?? 'secondary'}
                  fullWidth
                  size="sm"
                  loading={isThis}
                  disabled={disabled || isThis}
                  onClick={() => void runAction(action)}
                >
                  {action.label}
                </Button>
              )
            })}

            {appointment.status === 'PENDING' &&
              receipt?.status === 'PENDING' && (
                <Button
                  variant="secondary"
                  fullWidth
                  size="sm"
                  onClick={() => setShowReceiptReview(true)}
                >
                  Review deposit
                </Button>
              )}
          </div>
        )}
      </div>

      {/* ── Resolve follow-up modal ──────────────────────────────────── */}
      <ResolveFollowUpModal
        open={showResolveFollowUp}
        businessId={businessId}
        followUp={openFollowUp}
        timezone={timezone}
        scheduledStart={appointment.scheduledStart}
        onClose={() => setShowResolveFollowUp(false)}
        onResolved={updated => {
          setShowResolveFollowUp(false)

          if (updated.outcome === 'CONFIRMED') {
            applyLocal({
              ...appointment,
              status:
                appointment.status === 'PENDING' ? 'CONFIRMED' : appointment.status,
              confirmedAt:
                appointment.confirmedAt ?? new Date().toISOString(),
              needsFollowUp: false,
              followUp: updated,
            })
          } else if (updated.outcome === 'CANCELLED') {
            applyLocal({
              ...appointment,
              status: 'CANCELLED',
              cancelledAt: new Date().toISOString(),
              needsFollowUp: false,
              followUp: updated,
            })
          } else if (updated.outcome === 'RESCHEDULED' && updated.newStartTime) {
            applyLocal({
              ...appointment,
              scheduledStart: updated.newStartTime,
              needsFollowUp: false,
              followUp: updated,
            })
          }

          toast.success('Follow-up resolved')
          onRefresh?.()
        }}
      />

      {/* ── Receipt image modal (view-only) ─────────────────────────── */}
      <Modal
        open={showReceiptImage}
        onClose={() => setShowReceiptImage(false)}
        title="Customer receipt"
        width="max-w-lg"
      >
        {receipt && (
          <div className="px-6 py-5 flex flex-col gap-4">
            <div className="rounded-xl border border-line overflow-hidden bg-bg">
              <img
                src={receipt.receiptImageUrl}
                alt="Receipt submitted by the customer"
                className="w-full max-h-[70vh] object-contain bg-bg"
              />
            </div>

            <div className="bg-bg rounded-xl px-4 py-3 flex flex-col gap-2 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-ink-3">Declared amount</span>
                <span className="text-ink font-medium">
                  {Number(receipt.submittedAmount).toLocaleString()} ETB
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-ink-3">Submitted</span>
                <span className="text-ink">
                  {new Date(receipt.submittedAt).toLocaleString()}
                </span>
              </div>
              {receipt.customerNote && (
                <div className="pt-2 border-t border-line">
                  <p className="text-xs text-ink-3 mb-1">Customer note</p>
                  <p className="text-sm text-ink-2 leading-relaxed">
                    {receipt.customerNote}
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        <div className="px-6 pb-6 flex gap-3 justify-end border-t border-line pt-4">
          <Button
            variant="ghost"
            onClick={() => setShowReceiptImage(false)}
          >
            Close
          </Button>
          <Button
            onClick={() => {
              setShowReceiptImage(false)
              setShowReceiptReview(true)
            }}
          >
            Review
          </Button>
        </div>
      </Modal>

      {/* ── Receipt review modal (approve / reject) ─────────────────── */}
      <ReceiptReviewModal
        open={showReceiptReview}
        businessId={businessId}
        receipt={receipt}
        onClose={() => setShowReceiptReview(false)}
        onVerified={updated => {
          setShowReceiptReview(false)

          if (!appointment) return

          if (updated.status === 'APPROVED') {
            applyLocal({
              ...appointment,
              status: 'CONFIRMED',
              confirmedAt: appointment.confirmedAt ?? new Date().toISOString(),
            })
          } else if (updated.status === 'REJECTED') {
            setReceipt(updated)
          }
        }}
      />

      {/* ── Complete appointment modal ─────────────────────────────── */}
      <Modal
        open={showComplete}
        onClose={() => !submittingComplete && setShowComplete(false)}
        title="Mark as complete?"
        width="max-w-lg"
      >
        <div className="px-6 py-5 flex flex-col gap-4">
          <p className="text-sm text-ink-2 leading-relaxed">
            Record the time the service actually finished. The scheduled time
            is unaffected — this only logs the real end so the staff member is
            released early when appropriate.
          </p>

          <div className="bg-bg rounded-xl px-4 py-3 flex flex-col gap-2 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-ink-3">Scheduled</span>
              <span className="text-ink font-medium">
                {startTimeAmPm} – {endTimeAmPm}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-ink-3">Scheduled duration</span>
              <span className="text-ink">{formatDuration(scheduledDurationMin)}</span>
            </div>
            {previewActualEnd && previewDurationMin !== null && (
              <div className="flex items-center justify-between pt-2 border-t border-line">
                <span className="text-ink-3">Actual duration</span>
                <span className="text-ink font-semibold">
                  {formatDuration(previewDurationMin)}
                </span>
              </div>
            )}
          </div>

          <TimePicker
            label="Actual end time"
            value={completeTime}
            onChange={setCompleteTime}
            onNow={() => setCompleteTime(nowHHmmInTZ(timezone))}
            disabled={submittingComplete}
            error={
              completeTime && completeInvalid
                ? `End time must be after the appointment start (${startTimeAmPm}).`
                : undefined
            }
            hint={
              !completeTime || !completeInvalid
                ? `Default is the scheduled end (${endTimeAmPm}). Leave as-is if the service finished on time.`
                : undefined
            }
          />

          <div className="border-t border-line pt-4 flex flex-col gap-3">
            <div>
              <p className="text-sm font-medium text-ink">Service usage</p>
              <p className="text-xs text-ink-3 leading-relaxed mt-0.5">
                Log what was actually performed and any products used.
                Optional, but it keeps the service history accurate.
              </p>
            </div>

            <ServiceUsageForm
              draft={completeDraft}
              onChange={setCompleteDraft}
              disabled={submittingComplete}
            />

            {completeUsageError && (
              <p className="text-xs text-[#B06A6A]">{completeUsageError}</p>
            )}
          </div>

          <div className="border-t border-line pt-4 flex flex-col gap-3">
            <div>
              <p className="text-sm font-medium text-ink">Payment</p>
              <p className="text-xs text-ink-3 leading-relaxed mt-0.5">
                Record what was collected, split across methods if needed.
                Optional.
              </p>
            </div>

            <PaymentsForm
              draft={completePayDraft}
              onChange={setCompletePayDraft}
              methods={payments.methods}
              disabled={submittingComplete}
              outstanding={Math.max(0, totalAmount - payments.paidTotal)}
              onReloadMethods={payments.reloadMethods}
            />

            {completePayError && (
              <p className="text-xs text-[#B06A6A]">{completePayError}</p>
            )}
          </div>
        </div>
        <div className="px-6 pb-6 flex gap-3 justify-end border-t border-line pt-4">
          <Button
            variant="ghost"
            onClick={() => setShowComplete(false)}
            disabled={submittingComplete}
          >
            Cancel
          </Button>
          <Button
            onClick={() => void submitComplete()}
            loading={submittingComplete}
            disabled={submittingComplete || completeInvalid || !!completeUsageError}
          >
            {isDraftEmpty(completeDraft) && isPaymentsDraftEmpty(completePayDraft)
              ? 'Mark as complete'
              : 'Complete & save'}
          </Button>
        </div>
      </Modal>

      {/* ── No-show confirmation modal ─────────────────────────────── */}
      <Modal
        open={showNoShow}
        onClose={() => !submittingNoShow && setShowNoShow(false)}
        title="Mark as no-show?"
        width="max-w-md"
      >
        <div className="px-6 py-5 flex flex-col gap-4">
          <p className="text-sm text-ink-2 leading-relaxed">
            This marks the appointment as <strong>No-show</strong> and records
            that the customer didn&apos;t arrive. Use it only when the customer
            definitely missed the appointment.
          </p>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-ink-2">
              Reason (optional)
            </label>
            <input
              type="text"
              value={noShowReason}
              onChange={e => setNoShowReason(e.target.value)}
              placeholder="e.g. Customer didn't arrive within 20 minutes"
              className="h-10 px-3 rounded-[10px] border border-line text-sm bg-surface text-ink placeholder:text-ink-3 focus:outline-none focus:border-warm"
              autoFocus
            />
          </div>
        </div>
        <div className="px-6 pb-6 flex gap-3 justify-end border-t border-line pt-4">
          <Button
            variant="ghost"
            onClick={() => setShowNoShow(false)}
            disabled={submittingNoShow}
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={() => void submitNoShow()}
            loading={submittingNoShow}
            disabled={submittingNoShow}
          >
            Mark as no-show
          </Button>
        </div>
      </Modal>

      {/* ── Cancel confirmation modal ─────────────────────────────── */}
      <Modal
        open={showCancel}
        onClose={() => !submittingCancel && setShowCancel(false)}
        title="Cancel appointment?"
        width="max-w-md"
      >
        <div className="px-6 py-5 flex flex-col gap-4">
          <p className="text-sm text-ink-2 leading-relaxed">
            This cancels the appointment. If the customer has already paid, you
            can optionally create a refund request.
          </p>

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-ink-2">
              Reason (optional)
            </label>
            <input
              type="text"
              value={cancelReason}
              onChange={e => setCancelReason(e.target.value)}
              placeholder="e.g. Customer can't make it"
              className="h-10 px-3 rounded-[10px] border border-line text-sm bg-surface text-ink placeholder:text-ink-3 focus:outline-none focus:border-warm"
              autoFocus
            />
          </div>

          <label className="flex items-start gap-3 cursor-pointer select-none">
            <span
              className={`
                mt-0.5 w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0
                ${cancelRefund ? 'border-ink bg-ink' : 'border-line bg-surface'}
              `}
              onClick={() => setCancelRefund(v => !v)}
            >
              {cancelRefund && (
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3">
                  <path d="M20 6L9 17l-5-5" />
                </svg>
              )}
            </span>
            <span className="text-sm text-ink-2">
              Create a refund request for any money already paid
              <span className="block text-xs text-ink-3 mt-0.5">
                Skips silently if the customer hasn't paid anything.
              </span>
            </span>
          </label>
        </div>
        <div className="px-6 pb-6 flex gap-3 justify-end border-t border-line pt-4">
          <Button
            variant="ghost"
            onClick={() => setShowCancel(false)}
            disabled={submittingCancel}
          >
            Keep appointment
          </Button>
          <Button
            variant="destructive"
            onClick={() => void submitCancel()}
            loading={submittingCancel}
            disabled={submittingCancel}
          >
            Cancel appointment
          </Button>
        </div>
      </Modal>
    </>
  )
}

/* ------------------------------------------------------------------ */
/*  Resolve follow-up modal                                            */
/* ------------------------------------------------------------------ */

type FollowUpOutcomeChoice = AppointmentFollowUpOutcome

function ResolveFollowUpModal({
  open,
  businessId,
  followUp,
  timezone,
  scheduledStart,
  onClose,
  onResolved,
}: {
  open: boolean
  businessId: string
  followUp: AppointmentFollowUp | null
  timezone: string
  scheduledStart: string
  onClose: () => void
  onResolved: (updated: AppointmentFollowUp) => void
}) {
  const toast = useToast()

  const [outcome, setOutcome] = useState<FollowUpOutcomeChoice>('CONFIRMED')
  const [note, setNote] = useState('')
  const [newDate, setNewDate] = useState(() => ymdInTZ(scheduledStart, timezone))
  const [newTime, setNewTime] = useState(() => hhmmInTZ(scheduledStart, timezone))
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!open) return
    setOutcome('CONFIRMED')
    setNote('')
    setNewDate(ymdInTZ(scheduledStart, timezone))
    setNewTime(hhmmInTZ(scheduledStart, timezone))
  }, [open, scheduledStart, timezone])

  const newStartIso =
    outcome === 'RESCHEDULED'
      ? composeDateTimeInTZ(newDate, newTime, timezone)
      : null

  const rescheduleInvalid =
    outcome === 'RESCHEDULED' &&
    (!newStartIso || Number.isNaN(Date.parse(newStartIso)))

  async function submit() {
    if (!followUp) return
    if (rescheduleInvalid) return

    setSubmitting(true)
    try {
      const input: ResolveAppointmentFollowUpInput =
        outcome === 'RESCHEDULED'
          ? {
              outcome: 'RESCHEDULED',
              newStartTime: newStartIso!,
              note: note.trim() || undefined,
            }
          : {
              outcome,
              note: note.trim() || undefined,
            }

      const updated = await appointmentsApi.resolveFollowUp(
        businessId,
        followUp.id,
        input,
      )
      onResolved(updated)
    } catch (err) {
      console.error('[follow-up] resolve failed', err)
      toast.error(extractErrorMessage(err, 'Could not resolve the follow-up.'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={() => !submitting && onClose()}
      title="Resolve follow-up"
      width="max-w-lg"
    >
      <div className="px-6 py-5 flex flex-col gap-4">
        <p className="text-sm text-ink-2 leading-relaxed">
          Record what happened when you reached the customer. The outcome is
          applied to the appointment in the same operation.
        </p>

        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-ink-2">Outcome</label>
          <div className="grid grid-cols-3 gap-2">
            {(['CONFIRMED', 'CANCELLED', 'RESCHEDULED'] as const).map(o => {
              const selected = outcome === o
              return (
                <button
                  key={o}
                  type="button"
                  onClick={() => setOutcome(o)}
                  disabled={submitting}
                  className={`
                    h-10 px-3 rounded-[10px] border text-sm font-medium
                    transition-colors disabled:opacity-50
                    ${selected
                      ? 'border-ink bg-ink text-surface'
                      : 'border-line bg-surface text-ink-2 hover:border-ink-3'}
                  `}
                >
                  {o === 'CONFIRMED'
                    ? 'Confirmed'
                    : o === 'CANCELLED'
                      ? 'Cancelled'
                      : 'Rescheduled'}
                </button>
              )
            })}
          </div>
        </div>

        {outcome === 'RESCHEDULED' && (
          <div className="flex flex-col gap-3 border-t border-line pt-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-ink-2">
                New date
              </label>
              <input
                type="date"
                value={newDate}
                onChange={e => setNewDate(e.target.value)}
                disabled={submitting}
                className="h-10 px-3 rounded-[10px] border border-line text-sm bg-surface text-ink focus:outline-none focus:border-warm disabled:opacity-50"
              />
            </div>

            <TimePicker
              label="New time"
              value={newTime}
              onChange={setNewTime}
              onNow={() => setNewTime(nowHHmmInTZ(timezone))}
              disabled={submitting}
            />

            {rescheduleInvalid && (
              <p className="text-xs text-[#B06A3A]">
                Pick a valid date and time.
              </p>
            )}
          </div>
        )}

        <div className="flex flex-col gap-1.5 border-t border-line pt-4">
          <label className="text-sm font-medium text-ink-2">
            Note (optional)
          </label>
          <textarea
            value={note}
            onChange={e => setNote(e.target.value)}
            rows={3}
            disabled={submitting}
            placeholder="e.g. Called at 10:15, customer confirmed."
            className="w-full px-3 py-2.5 rounded-[10px] border border-line text-sm bg-surface text-ink placeholder:text-ink-3 focus:outline-none focus:border-warm resize-none disabled:opacity-50"
          />
        </div>
      </div>

      <div className="px-6 pb-6 flex gap-3 justify-end border-t border-line pt-4">
        <Button variant="ghost" onClick={onClose} disabled={submitting}>
          Cancel
        </Button>
        <Button
          onClick={() => void submit()}
          loading={submitting}
          disabled={submitting || rescheduleInvalid}
        >
          Resolve
        </Button>
      </div>
    </Modal>
  )
}

/* ------------------------------------------------------------------ */
/*  Reminder row + summary                                             */
/* ------------------------------------------------------------------ */

function ReminderRow({ reminder }: { reminder: AppointmentReminder }) {
  const { label, tone } = describeReminder(reminder)

  return (
    <div className="rounded-xl border border-line bg-bg px-3 py-2.5 flex flex-col gap-1">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium text-ink">
          {reminderTypeLabel(reminder.type)}
        </span>
        <span className={`text-[10px] font-semibold uppercase tracking-wider ${tone}`}>
          {label}
        </span>
      </div>
      <div className="text-[11px] text-ink-3 flex items-center gap-2 flex-wrap">
        <span>Scheduled {new Date(reminder.scheduledAt).toLocaleString()}</span>
        {reminder.sentAt && (
          <>
            <span>·</span>
            <span>Sent {new Date(reminder.sentAt).toLocaleString()}</span>
          </>
        )}
      </div>
      {reminder.lastError && (
        <p className="text-[11px] text-[#B06A6A]">{reminder.lastError}</p>
      )}
    </div>
  )
}

function reminderTypeLabel(t: AppointmentReminderType): string {
  switch (t) {
    case 'ack_first_prompt':
      return 'First prompt'
    case 'ack_second_prompt':
      return 'Second prompt'
    case 'ack_deadline':
      return 'Deadline'
  }
}

function describeReminder(r: AppointmentReminder): {
  label: string
  tone: string
} {
  const status = r.status as AppointmentReminderStatus
  switch (status) {
    case 'PENDING':
      return { label: 'Pending', tone: 'text-ink-3' }
    case 'CLAIMED':
      return { label: 'Claimed', tone: 'text-[#7A5F2C]' }
    case 'SENT':
      return { label: 'Sent', tone: 'text-[#2A5F30]' }
    case 'FAILED':
      return { label: 'Failed', tone: 'text-[#B06A6A]' }
    case 'SKIPPED':
      return { label: 'Skipped', tone: 'text-ink-3' }
  }
}

function summarizeReminders(reminders: AppointmentReminder[]): string {
  const sent = reminders.filter(r => r.status === 'SENT').length
  const failed = reminders.filter(r => r.status === 'FAILED').length
  const pending = reminders.filter(
    r => r.status === 'PENDING' || r.status === 'CLAIMED',
  ).length

  const parts: string[] = []
  if (sent) parts.push(`${sent} sent`)
  if (failed) parts.push(`${failed} failed`)
  if (pending) parts.push(`${pending} pending`)
  return parts.length ? parts.join(' · ') : 'No delivery activity yet'
}

/* ------------------------------------------------------------------ */
/*  Receipt icon                                                       */
/* ------------------------------------------------------------------ */

function ReceiptIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M6 3.5h12v17l-2-1.5-2 1.5-2-1.5-2 1.5-2-1.5-2 1.5v-17Z" />
      <path d="M9 8.5h6M9 12h6M9 15.5h4" />
    </svg>
  )
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <span className="text-sm text-ink-3 flex-shrink-0">{label}</span>
      <span className="text-sm text-ink text-right truncate">{value}</span>
    </div>
  )
}

function extractErrorMessage(err: unknown, fallback = 'Something went wrong.'): string {
  if (!err) return fallback
  const anyErr = err as any

  if (Array.isArray(anyErr?.fieldErrors) && anyErr.fieldErrors.length > 0) {
    const f = anyErr.fieldErrors[0]
    const prefix = f.field ? `${f.field}: ` : ''
    return `${prefix}${f.message}`
  }
  if (Array.isArray(anyErr?.details) && anyErr.details.length > 0) {
    const d = anyErr.details[0]
    if (typeof d === 'string') return d
    if (d && typeof d === 'object') {
      const field = d.field ? `${d.field}: ` : ''
      return `${field}${d.message ?? JSON.stringify(d)}`
    }
  }
  const data = anyErr?.response?.data ?? anyErr?.data ?? anyErr
  if (Array.isArray(data?.errors) && data.errors.length > 0) {
    return String(data.errors[0])
  }
  if (Array.isArray(data?.details) && data.details.length > 0) {
    const d = data.details[0]
    if (typeof d === 'string') return d
    if (d && typeof d === 'object') {
      const field = d.field ? `${d.field}: ` : ''
      return `${field}${d.message ?? JSON.stringify(d)}`
    }
  }
  if (typeof data?.message === 'string' && data.message) return data.message
  if (typeof anyErr?.message === 'string' && anyErr.message) return anyErr.message
  return fallback
}