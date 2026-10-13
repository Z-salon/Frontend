import { useState } from 'react'
import type { AppointmentPayment } from '../../types/api'
import { Button, Modal } from '../ui'
import { Input } from '../ui'
import { useToast } from '../ui/Toast'
import { useAppointmentPayments } from '../../hooks/useAppointmentPayments'
import {
  PaymentsForm,
  emptyPaymentsDraft,
  isPaymentsDraftEmpty,
  paymentsDraftToInput,
  validatePaymentsDraft,
  type PaymentsDraft,
} from './PaymentsForm'

/* ------------------------------------------------------------------ */
/*  Payments section                                                   */
/*                                                                     */
/*  Shared by the appointment panel and the customer detail view.       */
/*                                                                     */
/*  There is deliberately no "edit amount" — §7 offers void + re-record */
/*  only. Money that was received is an immutable fact; a correction is */
/*  a new entry that supersedes a voided one.                           */
/* ------------------------------------------------------------------ */

function toNumber(value: string | number | null | undefined): number {
  const n = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(n) ? n : 0
}

export function AppointmentPaymentsSection({
  businessId,
  appointmentId,
  totalAmount,
  onChanged,
}: {
  businessId: string
  appointmentId: string
  /** Appointment total, used for the outstanding hint. Optional. */
  totalAmount?: number | null
  onChanged?: () => void
}) {
  const toast = useToast()
  const payments = useAppointmentPayments(businessId, appointmentId)

  const [adding, setAdding] = useState(false)
  const [draft, setDraft] = useState<PaymentsDraft>(emptyPaymentsDraft())
  const [formError, setFormError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const [voiding, setVoiding] = useState<AppointmentPayment | null>(null)
  const [voidReason, setVoidReason] = useState('')
  const [voidError, setVoidError] = useState<string | null>(null)
  const [voidingBusy, setVoidingBusy] = useState(false)

  const outstanding =
    totalAmount != null ? Math.max(0, totalAmount - payments.paidTotal) : null

  async function save() {
    const invalid = validatePaymentsDraft(draft)
    if (invalid) {
      setFormError(invalid)
      return
    }
    const input = paymentsDraftToInput(draft)
    if (!input) {
      setAdding(false)
      return
    }

    setSaving(true)
    setFormError(null)
    const created = await payments.record(input)
    setSaving(false)

    if (!created) {
      setFormError('Could not record the payment. Nothing was saved — try again.')
      return
    }
    toast.success(
      created.length > 1
        ? `${created.length} payments recorded`
        : 'Payment recorded',
    )
    setAdding(false)
    onChanged?.()
  }

  async function confirmVoid() {
    if (!voiding) return
    const reason = voidReason.trim()
    if (!reason) {
      setVoidError('A reason is required to void a payment.')
      return
    }

    setVoidingBusy(true)
    setVoidError(null)
    const ok = await payments.voidPayment(voiding.id, reason)
    setVoidingBusy(false)

    if (!ok) {
      setVoidError('Could not void the payment.')
      return
    }
    toast.success('Payment voided')
    setVoiding(null)
    setVoidReason('')
    onChanged?.()
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <p className="text-[10px] font-semibold text-ink-3 uppercase tracking-wider">
          Payments
        </p>
        <button
          type="button"
          onClick={() => {
            setDraft(emptyPaymentsDraft())
            setFormError(null)
            setAdding(true)
          }}
          className="text-xs font-medium text-ink-2 hover:text-ink transition-colors"
        >
          + Add
        </button>
      </div>

      {payments.loading && <p className="text-sm text-ink-3">Loading…</p>}

      {!payments.loading && payments.payments.length === 0 && (
        <p className="text-sm text-ink-3 leading-relaxed">
          {payments.error ?? 'No payment recorded yet.'}
        </p>
      )}

      <div className="flex flex-col gap-2.5">
        {payments.payments.map(p => {
          const voided = p.status === 'VOIDED'
          return (
            <div
              key={p.id}
              className={`rounded-xl border px-3.5 py-3 flex flex-col gap-1 ${
                voided ? 'border-line bg-bg opacity-70' : 'border-line'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p
                    className={`text-sm font-medium truncate ${
                      voided ? 'text-ink-3 line-through' : 'text-ink'
                    }`}
                  >
                    {p.paymentMethod?.name ?? 'Payment'}
                  </p>
                  <p className="text-[11px] text-ink-3 mt-0.5">
                    {new Date(p.paidAt).toLocaleString()}
                  </p>
                </div>

                <div className="flex items-center gap-3 flex-shrink-0">
                  <span
                    className={`text-sm font-semibold tabular-nums ${
                      voided ? 'text-ink-3 line-through' : 'text-ink'
                    }`}
                  >
                    {toNumber(p.amount).toLocaleString()} ETB
                  </span>
                  {!voided && (
                    <button
                      type="button"
                      onClick={() => {
                        setVoiding(p)
                        setVoidReason('')
                        setVoidError(null)
                      }}
                      className="text-xs text-ink-3 hover:text-[#B06A6A] transition-colors"
                    >
                      Void
                    </button>
                  )}
                </div>
              </div>

              {voided && (
                <span className="text-[11px] font-medium text-ink-3 uppercase tracking-wide">
                  Voided
                </span>
              )}

              {p.reference && (
                <p className="text-[12px] text-ink-2">Ref: {p.reference}</p>
              )}
              {p.notes && <p className="text-[12px] text-ink-3">{p.notes}</p>}
            </div>
          )
        })}
      </div>

      {payments.payments.length > 0 && (
        <div className="mt-3 pt-3 border-t border-line flex flex-col gap-1.5">
          <div className="flex items-center justify-between text-sm">
            <span className="text-ink-3">Paid</span>
            <span className="font-semibold text-ink tabular-nums">
              {payments.paidTotal.toLocaleString()} ETB
            </span>
          </div>
          {outstanding != null && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-ink-3">Outstanding</span>
              <span
                className={`font-semibold tabular-nums ${
                  outstanding > 0 ? 'text-[#B06A6A]' : 'text-ink-3'
                }`}
              >
                {outstanding.toLocaleString()} ETB
              </span>
            </div>
          )}
        </div>
      )}

      {/* ── Add payments ───────────────────────────────────────────── */}
      <Modal
        open={adding}
        onClose={() => !saving && (setAdding(false), setFormError(null))}
        title="Record payment"
        width="max-w-lg"
      >
        <div className="px-6 py-5">
          <PaymentsForm
            draft={draft}
            onChange={setDraft}
            methods={payments.methods}
            disabled={saving}
            outstanding={outstanding}
            onReloadMethods={payments.reloadMethods}
          />
          {formError && <p className="text-xs text-[#B06A6A] mt-3">{formError}</p>}
        </div>
        <div className="px-6 pb-6 flex gap-3 justify-end border-t border-line pt-4">
          <Button
            variant="ghost"
            onClick={() => setAdding(false)}
            disabled={saving}
          >
            Cancel
          </Button>
          <Button
            onClick={() => void save()}
            loading={saving}
            disabled={saving || isPaymentsDraftEmpty(draft)}
          >
            Record payment
          </Button>
        </div>
      </Modal>

      {/* ── Void confirmation ──────────────────────────────────────── */}
      <Modal
        open={voiding !== null}
        onClose={() => !voidingBusy && setVoiding(null)}
        title="Void this payment?"
        width="max-w-md"
      >
        <div className="px-6 py-5 flex flex-col gap-3">
          <div className="rounded-xl border border-line bg-bg px-4 py-3">
            <p className="text-sm font-medium text-ink">
              {voiding?.paymentMethod?.name ?? 'Payment'} —{' '}
              {voiding ? toNumber(voiding.amount).toLocaleString() : 0} ETB
            </p>
          </div>

          <p className="text-sm text-ink-2 leading-relaxed">
            Voiding marks this payment as voided and removes it from the totals.
            It stays on record for auditing and cannot be undone — to correct
            the amount, record a new payment afterwards.
          </p>

          <Input
            label="Reason"
            value={voidReason}
            onChange={e => setVoidReason(e.target.value)}
            placeholder="Why is this being voided?"
            error={voidError ?? undefined}
            disabled={voidingBusy}
          />
        </div>
        <div className="px-6 pb-6 flex gap-3 justify-end border-t border-line pt-4">
          <Button
            variant="ghost"
            onClick={() => setVoiding(null)}
            disabled={voidingBusy}
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={() => void confirmVoid()}
            loading={voidingBusy}
            disabled={voidingBusy || !voidReason.trim()}
          >
            Void payment
          </Button>
        </div>
      </Modal>
    </div>
  )
}
