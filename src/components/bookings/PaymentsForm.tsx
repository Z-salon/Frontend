import type { PaymentMethod } from '../../types/api'
import { Input } from '../ui'

/* ------------------------------------------------------------------ */
/*  Split-tender payment form                                          */
/*                                                                     */
/*  Amount stays a string in the draft because it's a text field; it's  */
/*  coerced to a number on submit. Blank rows are dropped rather than   */
/*  rejected — §7.1 400s on `amount <= 0`, which is a poor way to lose   */
/*  an entire completion.                                               */
/* ------------------------------------------------------------------ */

export interface PaymentLineDraft {
  paymentMethodId: string
  amount: string
}

export interface PaymentsDraft {
  lines: PaymentLineDraft[]
  reference: string
  notes: string
}

export function emptyPaymentsDraft(): PaymentsDraft {
  return {
    lines: [{ paymentMethodId: '', amount: '' }],
    reference: '',
    notes: '',
  }
}

function isLineEmpty(l: PaymentLineDraft): boolean {
  return !l.paymentMethodId && !l.amount.trim()
}

/** Rows with a method chosen but no/zero amount — a genuine mistake. */
export function validatePaymentsDraft(draft: PaymentsDraft): string | null {
  const filled = draft.lines.filter(l => !isLineEmpty(l))

  if (filled.length === 0) return null // nothing entered; skip payments

  for (const l of filled) {
    if (!l.paymentMethodId) return 'Choose a payment method for each amount.'
    const amt = Number(l.amount)
    if (!l.amount.trim() || !Number.isFinite(amt) || amt <= 0) {
      return 'Each amount must be greater than zero.'
    }
  }

  return null
}

export function paymentsDraftTotal(draft: PaymentsDraft): number {
  return draft.lines.reduce((sum, l) => {
    if (isLineEmpty(l) || !l.paymentMethodId) return sum
    const amt = Number(l.amount)
    return sum + (Number.isFinite(amt) ? amt : 0)
  }, 0)
}

/**
 * True when the user entered nothing worth persisting. A row left entirely
 * blank doesn't count.
 */
export function isPaymentsDraftEmpty(draft: PaymentsDraft): boolean {
  return draft.lines.every(isLineEmpty) && !draft.reference.trim() && !draft.notes.trim()
}

/**
 * Returns `null` when there's nothing to send, so the caller can skip the
 * request entirely rather than posting an empty array.
 */
export function paymentsDraftToInput(
  draft: PaymentsDraft,
): { payments: Array<{ paymentMethodId: string; amount: number }>; reference: string | null; notes: string | null } | null {
  const payments = draft.lines
    .filter(l => !isLineEmpty(l) && l.paymentMethodId)
    .map(l => ({ paymentMethodId: l.paymentMethodId, amount: Number(l.amount) }))

  if (payments.length === 0) return null

  return {
    payments,
    reference: draft.reference.trim() || null,
    notes: draft.notes.trim() || null,
  }
}

export function PaymentsForm({
  draft,
  onChange,
  methods,
  disabled = false,
  outstanding,
  onReloadMethods,
}: {
  draft: PaymentsDraft
  onChange: (next: PaymentsDraft) => void
  methods: PaymentMethod[]
  disabled?: boolean
  /** Amount still owed, when known. Drives a non-blocking hint. */
  outstanding?: number | null
  /** Re-fetch methods after they are created in Finance. */
  onReloadMethods?: () => Promise<void>
}) {
  function setLine(i: number, patch: Partial<PaymentLineDraft>) {
    onChange({
      ...draft,
      lines: draft.lines.map((l, idx) => (idx === i ? { ...l, ...patch } : l)),
    })
  }

  const total = paymentsDraftTotal(draft)
  const over = outstanding != null && total > outstanding + 0.001

  return (
    <div className="flex flex-col gap-3.5">
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-ink-2">Payment methods</span>
          <button
            type="button"
            disabled={disabled}
            onClick={() =>
              onChange({
                ...draft,
                lines: [...draft.lines, { paymentMethodId: '', amount: '' }],
              })
            }
            className="text-xs font-medium text-ink-2 hover:text-ink disabled:opacity-50 transition-colors"
          >
            + Add method
          </button>
        </div>

        {methods.length === 0 ? (
          <div className="flex items-center gap-3">
            <p className="text-xs text-ink-3">
              No active payment methods configured. Add one in Finance → Payment
              methods first.
            </p>
            {onReloadMethods && (
              <button
                type="button"
                onClick={() => void onReloadMethods()}
                className="text-xs font-medium text-ink-2 hover:text-ink transition-colors flex-shrink-0"
              >
                Refresh
              </button>
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {draft.lines.map((l, i) => (
              <div key={i} className="flex items-start gap-2">
                <div className="flex-1 min-w-0">
                  <select
                    value={l.paymentMethodId}
                    disabled={disabled}
                    onChange={e => setLine(i, { paymentMethodId: e.target.value })}
                    className="h-10 w-full px-3 rounded-[10px] border border-line text-sm bg-surface text-ink focus:outline-none focus:ring-1 focus:ring-warm/20 transition-all duration-150 disabled:opacity-60"
                  >
                    <option value="">Method…</option>
                    {methods.map(m => (
                      <option key={m.id} value={m.id}>
                        {m.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="w-28 flex-shrink-0">
                  <Input
                    type="number"
                    min="0"
                    step="any"
                    value={l.amount}
                    disabled={disabled}
                    onChange={e => setLine(i, { amount: e.target.value })}
                    placeholder="Amount"
                  />
                </div>
                {draft.lines.length > 1 && (
                  <button
                    type="button"
                    aria-label="Remove payment line"
                    disabled={disabled}
                    onClick={() =>
                      onChange({
                        ...draft,
                        lines: draft.lines.filter((_, idx) => idx !== i),
                      })
                    }
                    className="h-10 w-8 flex-shrink-0 text-ink-3 hover:text-ink disabled:opacity-50 transition-colors"
                  >
                    &times;
                  </button>
                )}
              </div>
            ))}
          </div>
        )}

        {total > 0 && (
          <div className="flex items-center justify-between text-sm">
            <span className="text-ink-3">Total</span>
            <span className="font-semibold text-ink tabular-nums">
              {total.toLocaleString()} ETB
            </span>
          </div>
        )}
      </div>

      <Input
        label="Reference"
        value={draft.reference}
        disabled={disabled}
        onChange={e => onChange({ ...draft, reference: e.target.value })}
        placeholder="e.g. CBE-TXN-88123"
      />

      <Input
        label="Notes"
        value={draft.notes}
        disabled={disabled}
        onChange={e => onChange({ ...draft, notes: e.target.value })}
        placeholder="Optional"
      />

      {over && outstanding != null && (
        <p className="text-xs text-[#B06A6A]">
          That&apos;s {Math.round(total - outstanding).toLocaleString()} ETB more
          than the appointment total. Check the amounts before recording.
        </p>
      )}
    </div>
  )
}
