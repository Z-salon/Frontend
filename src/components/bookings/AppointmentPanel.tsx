// src/components/appointments/AppointmentPanel.tsx

import { useEffect, useMemo, useRef, useState } from 'react'
import type {
  Appointment,
  AppointmentStatus,
  AppointmentStaffRef,
  AppointmentReceipt,
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
 *
 * For a single-timezone deployment (Africa/Addis_Ababa, +03:00, no DST)
 * this produces an exact instant. For other zones it's best-effort and
 * the server will sanity-check (`actualEnd` must be after `scheduledStart`).
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

/* ------------------------------------------------------------------ */
/*  TimePicker — typable single field with overflow dropdown           */
/* ------------------------------------------------------------------ */

interface TimePickerProps {
  /** "HH:mm" 24-hour. */
  value: string
  onChange: (hhmm: string) => void
  /** Step between options, in minutes. Default 15. */
  stepMinutes?: number
  label?: string
  hint?: string
  error?: string
  /** Optional shortcut that sets the picker to "now" in the target zone. */
  onNow?: () => void
  disabled?: boolean
}

/** Build the option list at a given step. */
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

/**
 * Parse loose user input into "HH:mm" (24h).
 * Accepts: "2:30 pm", "230p", "1430", "14:30", "2pm", "14", "9:05a".
 * Returns null if the input doesn't resolve to a valid time.
 */
function parseTimeInput(raw: string): string | null {
  if (!raw) return null
  const s = raw.trim().toLowerCase().replace(/\s+/g, '')

  // Detect meridiem suffix
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

/** Snap an arbitrary "HH:mm" to the nearest step boundary. */
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
}: PanelProps) {
  const toast = useToast()
  const [busyKey, setBusyKey] = useState<string | null>(null)

  /**
   * The panel keeps its own copy of the appointment so a local write
   * (approve a receipt, change status, complete) reflects immediately,
   * without waiting for the parent to re-thread a new prop.
   *
   * Re-sync policy: only when the *identity* changes (a different
   * appointment is selected). An update to the same appointment — the
   * parent refetch handing back a fresh object with the same id — does
   * not clobber the panel's local state, which prevents the brief
   * flicker that would happen if the parent's list lags the write.
   */
  const [current, setCurrent] = useState<Appointment | null>(appointmentProp)

  const currentIdRef = useRef<string | null>(appointmentProp?.id ?? null)

  useEffect(() => {
    const nextId = appointmentProp?.id ?? null
    if (nextId !== currentIdRef.current) {
      currentIdRef.current = nextId
      setCurrent(appointmentProp)
    } else if (
      // Same id but the parent handed us something meaningfully newer
      // (e.g. it refetched and the server value is now available). We
      // accept it only when the panel isn't mid-write — busyKey is null.
      busyKey === null &&
      appointmentProp !== null &&
      current !== null &&
      appointmentProp !== current &&
      // Only accept if the status actually differs. Otherwise ignore —
      // the parent may pass a re-created object on every render.
      appointmentProp.status !== current.status
    ) {
      setCurrent(appointmentProp)
    }
  }, [appointmentProp, busyKey, current])

  const appointment = current
  const appointmentId = appointment?.id ?? null
  const appointmentStatus = appointment?.status ?? null

  /** Apply a locally-changed appointment and let the parent know. */
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

  // Completion modal state
  const [showComplete, setShowComplete] = useState(false)
  const [completeTime, setCompleteTime] = useState('') // "HH:mm" 24h
  const [submittingComplete, setSubmittingComplete] = useState(false)

  const [sendingFeedback, setSendingFeedback] = useState(false)

  // Service usage — recorded while completing, then read-only afterwards.
  const serviceUsage = useServiceUsages(businessId, appointmentId ?? undefined, appointmentStatus ?? undefined)
  const [completeDraft, setCompleteDraft] = useState<ServiceUsageDraft>(emptyDraft())
  const [completeUsageError, setCompleteUsageError] = useState<string | null>(null)

  // Payments recorded in the same modal. `paidTotal` already includes anything
  // recorded earlier, so the outstanding hint stays accurate.
  const payments = useAppointmentPayments(businessId, appointmentId ?? undefined)
  const [completePayDraft, setCompletePayDraft] = useState<PaymentsDraft>(emptyPaymentsDraft())
  const [completePayError, setCompletePayError] = useState<string | null>(null)

  // Post-visit feedback. Only meaningful once the appointment is COMPLETED,
  // and the hook stays idle for every other status.
  const feedback = useAppointmentFeedback(businessId, appointment)

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
    // The receipt block only lives while the appointment is PENDING.
    // After approval the appointment flips to CONFIRMED and the payment
    // moves into the Payments section, so we stop fetching.
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
        // 404 = no receipt yet. Normal for a PENDING appointment waiting
        // on the customer, so stay silent.
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
          // Prefill with what was booked — staff usually confirm it rather
          // than retype, and it keeps the record consistent with the
          // appointment even if the catalogue name changed since booking.
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

    // Validate everything before any write, so we never half-complete.
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

    // Usage is saved FIRST, while the appointment is still IN_PROGRESS —
    // §6.1 accepts CHECKED_IN / IN_PROGRESS / COMPLETED. If the usage write
    // fails we abort rather than completing, because once the appointment is
    // COMPLETED the staff member has moved on and the entry is easy to forget.
    // `add` resolves null on failure rather than throwing.
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

    // Payments next. Each block is optional, but a block the user filled in
    // must succeed — otherwise we'd complete the appointment and silently
    // drop what they recorded.
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
        // Those blocks are persisted but the appointment is still
        // IN_PROGRESS. Say so plainly — otherwise the natural response is to
        // re-enter them and create duplicate records.
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
            <div className="mb-4">
              <StatusBadge status={appointment.status} />
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

          {/* ── Pending receipt block (only for PENDING appointments) ── */}

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
                      {feedback.submission.isAnonymous && ' · anonymous'}
                    </span>
                    <span className="text-xs text-ink-3 flex-shrink-0">
                      {new Date(feedback.submission.submittedAt).toLocaleDateString()}
                    </span>
                  </div>
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

            {/* Quick path into the reviewer when the deposit is what's
                holding up the confirmation. Only shown when a PENDING
                receipt exists. */}
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
            /**
             * §7.3 — approving a PENDING receipt atomically confirms
             * the appointment server-side. Mirror that locally so the
             * panel flips to CONFIRMED immediately: the deposit block
             * disappears, the status badge updates, and the action
             * buttons change from Confirm/Cancel to Check in/No-show/
             * Cancel.
             */
            applyLocal({
              ...appointment,
              status: 'CONFIRMED',
              confirmedAt: appointment.confirmedAt ?? new Date().toISOString(),
            })
          } else if (updated.status === 'REJECTED') {
            // The appointment stays PENDING. Show the rejection reason
            // in the deposit block so the receptionist can tell the
            // customer what to fix.
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
/*  Receipt icon                                                       */
/* ------------------------------------------------------------------ */

/**
 * Small document-with-lines glyph. Lives here because it's only used by
 * the pending-receipt block and doesn't warrant a slot in the shared
 * icon set (which is otherwise all customer-facing).
 */
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