import { useMemo, useState, type ReactNode } from 'react'
import type { Appointment, AppointmentPayment } from '../../types/api'
import { Button, Select, Textarea } from '../ui'
import { useToast } from '../ui/Toast'
import {
  useRefundAppointments,
  useRefundAppointmentPayments,
  useAppointmentFinancials,
} from '../../hooks/useRefundRequests'
import { refundsApi } from '../../api/refunds.api'
import { apiErrorMessage } from '../../api/errors'
import { formatMoney, toCents } from '../../lib/money'
import { formatDateTime } from '../../lib/dates'

/* ------------------------------------------------------------------ */
/*  Create refund                                                      */
/*                                                                     */
/*  Appointment and payment selection reuse the existing appointment    */
/*  APIs — no eligible-appointment endpoint is invented. After an       */
/*  appointment is picked, the server's appointment financials drive    */
/*  the eligibility panel and the amount ceiling; nothing is derived    */
/*  on the client.                                                     */
/* ------------------------------------------------------------------ */

function amountOrDash(value: string | null | undefined): string {
  if (value === null || value === undefined || value === '') return '—'
  return `${formatMoney(value)} ETB`
}

function EligibilityRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 py-1.5">
      <span className="text-sm text-ink-3">{label}</span>
      <span className="text-sm text-ink tabular-nums">{value}</span>
    </div>
  )
}

function appointmentLabel(a: Appointment): string {
  const c = a.customer
  const name = c
    ? [c.firstName, c.lastName].filter(Boolean).join(' ').trim() || 'Customer'
    : 'Customer'
  const service = a.service?.name ? ` — ${a.service.name}` : ''
  const when = formatDateTime(a.scheduledStart)
  const amount = a.totalAmount ? ` — ${formatMoney(a.totalAmount)} ETB` : ''
  return `${name}${service} — ${when}${amount}`
}

/* Payment-method type labels mirror the backend enum (see the payment
   methods screen); an unknown value is shown verbatim rather than hidden. */
const PAYMENT_TYPE_LABELS: Record<string, string> = {
  CASH: 'Cash',
  MOBILE_MONEY: 'Mobile money',
  BANK_TRANSFER: 'Bank transfer',
  CARD: 'Card',
  OTHER: 'Other',
}

function paymentTypeLabel(type: string | null | undefined): string | null {
  if (!type) return null
  return PAYMENT_TYPE_LABELS[type] ?? type
}

/** Secondary line for a payment row, built only from backend fields. */
function paymentMeta(p: AppointmentPayment): string {
  const parts: Array<string | null> = [
    paymentTypeLabel(p.paymentMethod?.type),
    p.status || null,
    p.reference ? `Ref: ${p.reference}` : null,
    p.paidAt ? `Paid ${formatDateTime(p.paidAt)}` : null,
    p.notes,
  ]
  return parts.filter((part): part is string => !!part).join(' · ')
}

export function CreateRefundView({
  businessId,
  branches = [],
  onBack,
  onCreated,
}: {
  businessId?: string
  branches?: Array<{ id: string; name: string }>
  onBack: () => void
  onCreated: () => void
}) {
  const toast = useToast()

  const [branchId, setBranchId] = useState('')
  const [appointmentId, setAppointmentId] = useState('')
  const [paymentId, setPaymentId] = useState('')
  const [amount, setAmount] = useState('')
  const [reason, setReason] = useState('')

  const [busy, setBusy] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  const appointments = useRefundAppointments(businessId, branchId || undefined)
  const financials = useAppointmentFinancials(businessId, appointmentId || undefined)
  const payments = useRefundAppointmentPayments(businessId, appointmentId || undefined)

  /**
   * The appointments list endpoint nests its collection:
   * `{ data: Appointment[], meta }` (the raw body wraps this once more in
   * the standard success envelope, which `http` already unwraps). Guard
   * against a missing or unexpected payload so the page always renders.
   */
  const appointmentList = useMemo(() => {
    const rows = appointments.data?.data
    return Array.isArray(rows) ? rows : []
  }, [appointments.data])

  const appointmentOptions = useMemo(
    () =>
      appointmentList.map(a => ({
        value: a.id,
        label: appointmentLabel(a),
      })),
    [appointmentList],
  )

  /**
   * Only surface payments that belong to the currently selected
   * appointment. The resource keeps the previous appointment's payload
   * until the new request resolves, so this guard is what prevents
   * appointment A's payments from lingering after B is chosen.
   */
  const paymentList = useMemo(() => {
    const rows = payments.data
    if (!Array.isArray(rows)) return []
    return rows.filter(p => p.appointmentId === appointmentId)
  }, [payments.data, appointmentId])

  /* A refund can only be raised against a payment the server recorded as
     PAID; voided rows are shown for context but cannot be selected. */
  const hasSelectablePayment = paymentList.some(p => p.status === 'PAID')

  const noAppointments =
    !appointments.loading && !appointments.error && appointmentOptions.length === 0

  /* Only trust figures that belong to the currently selected appointment. */
  const financialsData =
    financials.data && financials.data.appointmentId === appointmentId
      ? financials.data
      : null

  const refundableAmount = financialsData?.refundable
  const refundableCents = toCents(refundableAmount)
  const amountCents = toCents(amount)

  /* The amount is only usable once the server reports a finalized
     appointment with a positive refundable ceiling. */
  const isFinalized = financialsData?.finalized === true
  const canRefund = isFinalized && refundableCents > 0

  function onBranchChange(value: string) {
    setBranchId(value)
    setAppointmentId('')
    setPaymentId('')
    setAmount('')
    setFormError(null)
  }

  function onAppointmentChange(value: string) {
    setAppointmentId(value)
    setPaymentId('')
    setAmount('')
    setFormError(null)
  }

  async function handleSubmit() {
    if (!businessId) {
      setFormError('No business is selected.')
      return
    }
    if (!appointmentId) {
      setFormError('Select an appointment.')
      return
    }
    if (!financialsData) {
      setFormError('Financial information is still loading. Please wait.')
      return
    }
    if (!isFinalized) {
      setFormError('This appointment is not finalized, so it cannot be refunded.')
      return
    }
    if (refundableCents <= 0) {
      setFormError('No refundable amount is available for this appointment.')
      return
    }
    if (!paymentId) {
      setFormError('Select the payment being refunded.')
      return
    }
    if (amountCents <= 0) {
      setFormError('Enter a refund amount greater than 0.')
      return
    }
    if (amountCents > refundableCents) {
      setFormError(
        `Refund amount cannot exceed the refundable amount of ${formatMoney(refundableAmount)} ETB.`,
      )
      return
    }
    if (!reason.trim()) {
      setFormError('Enter a reason for the refund.')
      return
    }

    setBusy(true)
    setFormError(null)
    try {
      await refundsApi.create(businessId, {
        appointmentId,
        amount: amountCents / 100,
        paymentId,
        reason: reason.trim(),
      })
      toast.success('Refund request created.')
      onCreated()
    } catch (err) {
      setFormError(apiErrorMessage(err, 'Could not create the refund request.'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="max-w-2xl">
      <button onClick={onBack} className="text-sm text-ink-3 hover:text-ink transition-colors">
        ← Back to Refunds
      </button>

      <h3 className="font-display text-2xl text-ink leading-none mt-4 mb-5">Create Refund</h3>

      <div className="grid gap-4">
        <section className="bg-surface rounded-2xl border border-line px-5 py-4 grid gap-4">
          {branches.length > 0 && (
            <Select
              label="Branch"
              value={branchId}
              onChange={e => onBranchChange(e.target.value)}
            >
              <option value="">All branches</option>
              {branches.map(b => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </Select>
          )}

          <Select
            label="Appointment"
            value={appointmentId}
            onChange={e => onAppointmentChange(e.target.value)}
            disabled={appointments.loading && !appointments.data}
          >
            <option value="">
              {appointments.loading
                ? 'Loading appointments…'
                : noAppointments
                  ? 'No appointments found'
                  : 'Select appointment'}
            </option>
            {appointmentOptions.map(o => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </Select>
          {appointments.error && (
            <p className="text-xs text-[#B06A6A]">{appointments.error}</p>
          )}
          {noAppointments && (
            <p className="text-xs text-ink-3">No appointments found.</p>
          )}
        </section>

        <section className="bg-surface rounded-2xl border border-line px-5 py-4">
          <h4 className="text-xs font-semibold text-ink-3 uppercase tracking-wider mb-2">
            Refund eligibility
          </h4>
          {!appointmentId ? (
            <p className="text-sm text-ink-3 py-2">
              Select an appointment to see its refundable amount.
            </p>
          ) : financials.error ? (
            <p className="text-sm text-[#B06A6A] py-2">
              {financials.error} The appointment may not be eligible for a refund.
            </p>
          ) : !financialsData ? (
            <p className="text-sm text-ink-3 py-2">Loading financial information…</p>
          ) : (
            <>
              <EligibilityRow
                label="Original amount"
                value={amountOrDash(financialsData.originalAmount)}
              />
              <EligibilityRow
                label="Final agreed amount"
                value={amountOrDash(financialsData.finalAgreedAmount)}
              />
              <EligibilityRow
                label="Verified paid"
                value={amountOrDash(financialsData.verifiedPaid)}
              />
              <EligibilityRow
                label="Outstanding"
                value={amountOrDash(financialsData.outstanding)}
              />
              <EligibilityRow
                label="Already refunded"
                value={amountOrDash(financialsData.refunded)}
              />
              <EligibilityRow
                label="Refund reserved"
                value={amountOrDash(financialsData.refundReserved)}
              />
              <div className="flex items-center justify-between gap-4 pt-2 mt-1 border-t border-line">
                <span className="text-sm font-medium text-ink-2">Refundable amount</span>
                <span className="text-sm font-semibold text-ink tabular-nums">
                  {amountOrDash(refundableAmount)}
                </span>
              </div>
              {!isFinalized ? (
                <p className="text-xs text-[#B06A6A] pt-2">
                  This appointment is not finalized, so no refund can be created yet.
                </p>
              ) : refundableCents <= 0 ? (
                <p className="text-sm text-[#B06A6A] py-2">
                  No refundable amount is currently available for this appointment.
                </p>
              ) : null}
            </>
          )}
        </section>

        <section className="bg-surface rounded-2xl border border-line px-5 py-4 grid gap-4">
          <div className="flex flex-col gap-2">
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-ink-2">Payment *</label>
              <p className="text-xs text-ink-3">Select the payment associated with this refund</p>
            </div>

            {!appointmentId ? (
              <p className="text-sm text-ink-3 py-2">Select an appointment first.</p>
            ) : payments.loading ? (
              <p className="text-sm text-ink-3 py-2">Loading payments…</p>
            ) : payments.error ? (
              <div className="flex items-center gap-3 py-2">
                <p className="text-sm text-[#B06A6A]">{payments.error}</p>
                <Button size="sm" variant="secondary" onClick={() => void payments.reload()}>
                  Retry
                </Button>
              </div>
            ) : paymentList.length === 0 ? (
              <p className="text-sm text-ink-3 py-2">
                No payments found for this appointment.
              </p>
            ) : (
              <div className="grid gap-2">
                {paymentList.map(p => {
                  const selectable = p.status === 'PAID'
                  const selected = paymentId === p.id
                  const meta = paymentMeta(p)
                  return (
                    <label
                      key={p.id}
                      className={[
                        'flex items-start gap-3 rounded-xl border px-3.5 py-3 transition-colors',
                        selected ? 'border-warm bg-warm/5' : 'border-line',
                        selectable
                          ? 'cursor-pointer hover:border-ink-3/40'
                          : 'opacity-60 cursor-not-allowed',
                      ].join(' ')}
                    >
                      <input
                        type="radio"
                        name="refund-payment"
                        value={p.id}
                        checked={selected}
                        disabled={!selectable}
                        onChange={() => setPaymentId(p.id)}
                        className="mt-0.5 h-4 w-4 accent-warm"
                      />
                      <span className="flex-1 min-w-0">
                        <span className="flex items-center justify-between gap-3">
                          <span className="text-sm font-medium text-ink truncate">
                            {p.paymentMethod?.name ?? 'Payment'}
                          </span>
                          <span className="text-sm text-ink tabular-nums whitespace-nowrap">
                            {formatMoney(p.amount)} ETB
                          </span>
                        </span>
                        {meta && (
                          <span className="mt-0.5 block text-xs text-ink-3">{meta}</span>
                        )}
                      </span>
                    </label>
                  )
                })}
              </div>
            )}

            {appointmentId &&
              !payments.loading &&
              !payments.error &&
              paymentList.length > 0 &&
              !hasSelectablePayment && (
                <p className="text-xs text-[#B06A6A]">
                  Only paid payments can be refunded.
                </p>
              )}
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-ink-2">Refund amount *</label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                inputMode="decimal"
                value={amount}
                onChange={e => setAmount(e.target.value)}
                placeholder="0.00"
                disabled={!canRefund}
                className="h-10 px-3 rounded-[10px] border border-line text-sm bg-surface text-ink focus:outline-none focus:border-warm focus:ring-1 focus:ring-warm/20 w-40 disabled:opacity-60 disabled:cursor-not-allowed"
              />
              <span className="text-sm text-ink-3">ETB</span>
            </div>
          </div>

          <Textarea
            label="Reason *"
            rows={3}
            value={reason}
            onChange={e => setReason(e.target.value)}
            placeholder="Why is this refund being requested?"
          />
        </section>

        {formError && <p className="text-sm text-[#B06A6A]">{formError}</p>}

        <div className="flex justify-end gap-2">
          <Button variant="secondary" disabled={busy} onClick={onBack}>
            Cancel
          </Button>
          <Button
            loading={busy}
            disabled={busy || !canRefund || !paymentId}
            onClick={handleSubmit}
          >
            {busy ? 'Creating…' : 'Create Refund'}
          </Button>
        </div>
      </div>
    </div>
  )
}