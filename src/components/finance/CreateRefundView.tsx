import { useMemo, useState, type ReactNode } from 'react'
import type { Appointment } from '../../types/api'
import { Button, Select, Textarea } from '../ui'
import { useToast } from '../ui/Toast'
import {
  useRefundAppointments,
  useRefundAppointmentPayments,
  useRefundable,
} from '../../hooks/useRefundRequests'
import { refundsApi } from '../../api/refunds.api'
import { apiErrorMessage } from '../../api/errors'
import { formatMoney, toCents } from '../../lib/money'
import { formatExpenseDay } from '../../lib/dates'

/* ------------------------------------------------------------------ */
/*  Create refund                                                      */
/*                                                                     */
/*  Appointment and payment selection reuse the existing appointment    */
/*  APIs — no eligible-appointment endpoint is invented. After an       */
/*  appointment is picked, the server's `refundable` figures drive the  */
/*  eligibility panel and the amount ceiling.                           */
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
  const when = formatExpenseDay(a.scheduledStart)
  return `${name}${service} — ${when}`
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
  const refundable = useRefundable(businessId, appointmentId || undefined)
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

  const paidPayments = useMemo(
    () => (payments.data ?? []).filter(p => p.status === 'PAID'),
    [payments.data],
  )

  /* Only trust figures that belong to the currently selected appointment. */
  const eligibility =
    refundable.data && refundable.data.appointmentId === appointmentId
      ? refundable.data
      : null

  const refundableAmount = eligibility?.refundable
  const refundableCents = toCents(refundableAmount)
  const amountCents = toCents(amount)

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
    if (!paymentId) {
      setFormError('Select the payment being refunded.')
      return
    }
    if (amountCents <= 0) {
      setFormError('Enter a refund amount greater than 0.')
      return
    }
    if (refundableCents <= 0 && eligibility) {
      setFormError('This appointment has no refundable amount.')
      return
    }
    if (refundableCents > 0 && amountCents > refundableCents) {
      setFormError(
        `The amount cannot exceed the refundable ${formatMoney(refundableAmount)} ETB.`,
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
              {appointments.loading ? 'Loading appointments…' : 'Select appointment'}
            </option>
            {appointmentOptions.map(o => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </Select>
          {appointments.error && (
            <p className="text-xs text-[#B06A6A]">{appointments.error}</p>
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
          ) : refundable.error ? (
            <p className="text-sm text-[#B06A6A] py-2">
              {refundable.error} The appointment may not be eligible for a refund.
            </p>
          ) : (
            <>
              <EligibilityRow
                label="Original amount"
                value={refundable.loading && !eligibility ? '…' : amountOrDash(eligibility?.originalAmount)}
              />
              <EligibilityRow
                label="Final agreed amount"
                value={refundable.loading && !eligibility ? '…' : amountOrDash(eligibility?.finalAgreedAmount)}
              />
              <EligibilityRow
                label="Verified paid"
                value={refundable.loading && !eligibility ? '…' : amountOrDash(eligibility?.verifiedPaid)}
              />
              <EligibilityRow
                label="Outstanding"
                value={refundable.loading && !eligibility ? '…' : amountOrDash(eligibility?.outstanding)}
              />
              <EligibilityRow
                label="Already refunded"
                value={refundable.loading && !eligibility ? '…' : amountOrDash(eligibility?.refunded)}
              />
              <EligibilityRow
                label="Refund reserved"
                value={refundable.loading && !eligibility ? '…' : amountOrDash(eligibility?.refundReserved)}
              />
              <div className="flex items-center justify-between gap-4 pt-2 mt-1 border-t border-line">
                <span className="text-sm font-medium text-ink-2">Maximum refundable</span>
                <span className="text-sm font-semibold text-ink tabular-nums">
                  {refundable.loading && !eligibility ? '…' : amountOrDash(refundableAmount)}
                </span>
              </div>
            </>
          )}
        </section>

        <section className="bg-surface rounded-2xl border border-line px-5 py-4 grid gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-ink-2">Refund amount *</label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                inputMode="decimal"
                value={amount}
                onChange={e => setAmount(e.target.value)}
                placeholder="0.00"
                className="h-10 px-3 rounded-[10px] border border-line text-sm bg-surface text-ink focus:outline-none focus:border-warm focus:ring-1 focus:ring-warm/20 w-40"
              />
              <span className="text-sm text-ink-3">ETB</span>
            </div>
          </div>

          <Select
            label="Payment"
            value={paymentId}
            onChange={e => setPaymentId(e.target.value)}
            disabled={!appointmentId || (payments.loading && !payments.data)}
          >
            <option value="">
              {!appointmentId
                ? 'Select an appointment first'
                : payments.loading
                  ? 'Loading payments…'
                  : paidPayments.length === 0
                    ? 'No paid payments for this appointment'
                    : 'Select payment'}
            </option>
            {paidPayments.map(p => (
              <option key={p.id} value={p.id}>
                {formatMoney(p.amount)} ETB
                {p.paymentMethod?.name ? ` — ${p.paymentMethod.name}` : ''}
                {p.reference ? ` — ${p.reference}` : ''}
              </option>
            ))}
          </Select>
          {payments.error && <p className="text-xs text-[#B06A6A]">{payments.error}</p>}

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
          <Button loading={busy} onClick={handleSubmit}>
            {busy ? 'Creating…' : 'Create Refund'}
          </Button>
        </div>
      </div>
    </div>
  )
}