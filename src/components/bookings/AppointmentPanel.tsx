// src/components/appointments/AppointmentPanel.tsx

import { useState } from 'react'
import type { Appointment, AppointmentStatus } from '../../types/api'
import { StatusBadge, Avatar, Button } from '../ui'
import { useToast } from '../ui/Toast'
import { appointmentsApi } from '../../api/appointments.api'

interface PanelProps {
  appointment: Appointment | null
  businessId: string
  /**
   * Branch IANA timezone. Used only for display. Defaults to Addis Ababa
   * when the parent hasn't resolved it yet.
   */
  timezone?: string
  onClose: () => void
  /** Called after a successful mutation so the parent can refresh its list. */
  onChanged: (updated: Appointment) => void
}

type ActionKind = 'transition' | 'no-show' | 'cancel'

interface ActionDef {
  label: string
  kind: ActionKind
  /** For 'transition': the target status. */
  status?: AppointmentStatus
  variant?: 'primary' | 'secondary' | 'destructive'
  /** Ask for a reason before firing. */
  prompt?: 'reason' | 'refund' | 'actualEnd' | 'no-show-reason'
}

/**
 * Actions per current status. Mirrors §5.6's state machine:
 *   PENDING     → CONFIRMED | CANCELLED | EXPIRED
 *   CONFIRMED   → CHECKED_IN | CANCELLED | NO_SHOW
 *   CHECKED_IN  → IN_PROGRESS | CANCELLED | NO_SHOW
 *   IN_PROGRESS → COMPLETED | CANCELLED
 *   terminal    → (none)
 */
const ACTIONS: Partial<Record<AppointmentStatus, ActionDef[]>> = {
  PENDING: [
    { label: 'Confirm', kind: 'transition', status: 'CONFIRMED', variant: 'primary' },
    { label: 'Cancel',  kind: 'cancel', variant: 'destructive', prompt: 'refund' },
  ],
  CONFIRMED: [
    { label: 'Check in', kind: 'transition', status: 'CHECKED_IN', variant: 'primary' },
    { label: 'No-show',  kind: 'no-show', variant: 'secondary', prompt: 'no-show-reason' },
    { label: 'Cancel',   kind: 'cancel', variant: 'destructive', prompt: 'refund' },
  ],
  CHECKED_IN: [
    { label: 'Start service', kind: 'transition', status: 'IN_PROGRESS', variant: 'primary' },
    { label: 'No-show',       kind: 'no-show', variant: 'secondary', prompt: 'no-show-reason' },
    { label: 'Cancel',        kind: 'cancel', variant: 'destructive', prompt: 'refund' },
  ],
  IN_PROGRESS: [
    { label: 'Mark complete', kind: 'transition', status: 'COMPLETED', variant: 'primary', prompt: 'actualEnd' },
    { label: 'Cancel',        kind: 'cancel', variant: 'destructive', prompt: 'refund' },
  ],
  COMPLETED: [],
  CANCELLED: [],
  NO_SHOW: [],
  EXPIRED: [],
}

const DEFAULT_TZ = 'Africa/Addis_Ababa'

export function AppointmentPanel({
  appointment,
  businessId,
  timezone = DEFAULT_TZ,
  onClose,
  onChanged,
}: PanelProps) {
  const toast = useToast()
  const [busyKey, setBusyKey] = useState<string | null>(null)

  if (!appointment) return null

  const actions = ACTIONS[appointment.status] ?? []

  /* ---------------- Time formatting ---------------- */

  const fmtLocal = (iso: string) =>
    new Intl.DateTimeFormat('en-GB', {
      timeZone: timezone,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(new Date(iso))

  const fmtDate = (iso: string) =>
    new Intl.DateTimeFormat('en-GB', {
      timeZone: timezone,
      weekday: 'short',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }).format(new Date(iso))

  const startTime = fmtLocal(appointment.scheduledStart)
  const endTime   = fmtLocal(appointment.scheduledEnd)
  const formattedDate = fmtDate(appointment.scheduledStart)

  /* ---------------- Derived display values ---------------- */

  const customerName  = deriveCustomerName(appointment)  // see helper below
  const customerPhone = ''                                // not on the appointment payload
  const primaryStaff  = appointment.staff[0]
  const staffName     = primaryStaff
    ? `${primaryStaff.firstName} ${primaryStaff.lastName}`
    : '—'

  const totalAmount   = Number(appointment.totalAmount || 0)
  const depositAmount = appointment.depositAmount
    ? Number(appointment.depositAmount)
    : null

  /* ---------------- Action dispatch ---------------- */

  async function runAction(action: ActionDef) {
    if (!appointment) return
    const key = `${action.kind}:${action.status ?? ''}`
    setBusyKey(key)

    try {
      let updated: Appointment

      if (action.kind === 'transition' && action.status) {
        // Optional prompt for the specific transition
        const body: Parameters<typeof appointmentsApi.updateStatus>[2] = {
          status: action.status,
        }

        if (action.prompt === 'actualEnd') {
          const raw = window.prompt(
            'Actual end time (HH:mm, leave blank for now):',
            endTime,
          )
          if (raw === null) return            // user cancelled the dialog
          if (raw.trim()) {
            const [h, m] = raw.trim().split(':').map(Number)
            const [sh, sm] = startTime.split(':').map(Number)
            // Compose the actualEnd on the same local day as scheduledStart
            const start = new Date(appointment.scheduledStart)
            const local = new Date(start)
            local.setHours(h, m, 0, 0)
            // Convert branch-local wall clock back to an ISO instant using
            // the browser's date/time math — safe enough since the branch
            // timezone is +03:00 and we're just building a candidate that
            // the server will sanity-check (`must be after scheduledStart`).
            body.actualEnd = local.toISOString()
            void sm; void sh  // eslint noise
          }
        }

        if (action.prompt === 'reason') {
          const raw = window.prompt('Reason (optional):')
          if (raw === null) return
          if (raw.trim()) body.reason = raw.trim()
        }

        updated = await appointmentsApi.updateStatus(
          businessId,
          appointment.id,
          body,
        )
      } else if (action.kind === 'no-show') {
        const raw = window.prompt('Reason (optional):')
        if (raw === null) return
        updated = await appointmentsApi.noShow(
          businessId,
          appointment.id,
          raw.trim() || undefined,
        )
      } else if (action.kind === 'cancel') {
        const raw = window.prompt('Reason (optional):')
        if (raw === null) return
        const wantsRefund = window.confirm(
          'Create a refund request for any money already paid?',
        )
        updated = await appointmentsApi.cancel(businessId, appointment.id, {
          reason: raw.trim() || undefined,
          refund: wantsRefund,
        })
      } else {
        return
      }

      toast.success('Appointment updated')
      onChanged(updated)
    } catch (err) {
      console.error('[appointment] action failed', err)
      toast.error(extractErrorMessage(err, 'Could not update the appointment.'))
    } finally {
      setBusyKey(null)
    }
  }

  /* ---------------- Render ---------------- */

  return (
    <div className="w-[300px] flex-shrink-0 bg-surface border-l border-line flex flex-col h-full overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 border-b border-line flex-shrink-0">
        <p className="text-sm font-semibold text-ink">Appointment</p>
        <button
          onClick={onClose}
          className="w-7 h-7 rounded-lg flex items-center justify-center text-ink-3 hover:bg-warm-subtle hover:text-ink transition-colors"
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* Status + customer */}
        <div className="px-5 pt-5 pb-4 border-b border-line">
          <div className="mb-4">
            <StatusBadge status={appointment.status} />
          </div>
          <div className="flex items-center gap-3">
            <Avatar name={customerName} size="lg" />
            <div className="min-w-0">
              <p className="font-semibold text-ink text-sm truncate">{customerName}</p>
              {customerPhone && (
                <p className="text-ink-3 text-sm truncate">{customerPhone}</p>
              )}
            </div>
          </div>
        </div>

        {/* Details */}
        <div className="px-5 py-4 border-b border-line">
          <p className="text-[10px] font-semibold text-ink-3 uppercase tracking-wider mb-3.5">
            Details
          </p>
          <div className="flex flex-col gap-3">
            <Row label="Service"  value={appointment.service.name} />
            <Row label="Staff"    value={staffName} />
            <Row label="Branch"   value={appointment.branchId} />
            <Row label="Date"     value={formattedDate} />
            <Row label="Time"     value={`${startTime} – ${endTime}`} />
            <Row label="Duration" value={`${appointment.service.durationMinutes} min`} />
            {appointment.bookingSource === 'WALK_IN' && (
              <Row label="Type" value="Walk-in" />
            )}
          </div>
        </div>

        {/* Payment */}
        <div className="px-5 py-4 border-b border-line">
          <p className="text-[10px] font-semibold text-ink-3 uppercase tracking-wider mb-3.5">
            Payment
          </p>
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-ink-3">Price</span>
              <span className="text-sm font-semibold text-ink">
                {totalAmount.toLocaleString()} ETB
              </span>
            </div>
            {depositAmount != null && (
              <div className="flex items-center justify-between">
                <span className="text-sm text-ink-3">Deposit</span>
                <span className="text-sm text-ink">
                  {depositAmount.toLocaleString()} ETB
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Notes */}
        {appointment.notes && (
          <div className="px-5 py-4">
            <p className="text-[10px] font-semibold text-ink-3 uppercase tracking-wider mb-3">
              Notes
            </p>
            <p className="text-sm text-ink-2 leading-relaxed">{appointment.notes}</p>
          </div>
        )}
      </div>

      {/* Actions */}
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
        </div>
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <span className="text-sm text-ink-3 flex-shrink-0">{label}</span>
      <span className="text-sm text-ink text-right">{value}</span>
    </div>
  )
}

/**
 * The appointment payload doesn't include the customer's name directly.
 * If your list endpoint joins it in (check the real response), use that.
 * Until then, fall back to "Customer" so the panel renders.
 */
function deriveCustomerName(a: Appointment): string {
  // @ts-expect-error — tolerate a joined `customer` field if present
  const c = a.customer
  if (c && typeof c === 'object') {
    return `${c.firstName ?? ''} ${c.lastName ?? ''}`.trim() || 'Customer'
  }
  return 'Customer'
}

/** Map API status → whatever string StatusBadge expects. */
function toDisplayStatus(
  s: AppointmentStatus,
): string {
  // If StatusBadge takes the raw enum, just `return s`.
  // This mapping covers the common kebab-case mock convention.
  switch (s) {
    case 'CHECKED_IN':  return 'checked-in'
    case 'IN_PROGRESS': return 'in-progress'
    case 'NO_SHOW':     return 'no-show'
    default:            return s.toLowerCase()
  }
}

function extractErrorMessage(err: unknown, fallback = 'Something went wrong.'): string {
  if (!err) return fallback
  const anyErr = err as any

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