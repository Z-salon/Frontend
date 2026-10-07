import { useCallback, useEffect, useState } from 'react'
import type {
  Expense,
  PaymentMethod,
  RecordExpensePaymentRequest,
  VoidExpenseRequest,
} from '../../types/api'
import { expensesApi } from '../../api/expenses.api'
import { apiErrorMessage } from '../../api/errors'
import { centsToInput, formatMoney, toCents } from '../../lib/money'
import { formatExpenseDate } from '../../lib/dates'
import { Button, Input, Modal, Select, Textarea } from '../ui'
import { LoadingState } from '../ui/EmptyState'
import { ExpenseStatusBadge } from './expenseStatus'

/* ------------------------------------------------------------------ */
/*  Expense details                                                    */
/*                                                                     */
/*  The list row only carries enough to render the table; this view     */
/*  always re-fetches the single-expense endpoint, then hosts the       */
/*  three mutations allowed by the backend: edit, record payment, void. */
/* ------------------------------------------------------------------ */

function DetailRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2 border-b border-line last:border-0">
      <span className="text-xs text-ink-3 flex-shrink-0 pt-0.5">{label}</span>
      <span className="text-sm text-ink text-right break-words min-w-0">{children}</span>
    </div>
  )
}

function DialogError({ message }: { message: string }) {
  return (
    <p className="text-xs text-[#B03A3A] bg-[#FBEDED] border border-[#E5B5B5] rounded-xl px-3 py-2">
      {message}
    </p>
  )
}

export function ExpenseDetailsModal({
  businessId,
  expenseId,
  methods,
  recordPayment,
  voidExpense,
  onClose,
  onEdit,
}: {
  businessId: string
  /** `null` → closed. */
  expenseId: string | null
  methods: PaymentMethod[]
  recordPayment: (id: string, input: RecordExpensePaymentRequest) => Promise<Expense>
  voidExpense: (id: string, input: VoidExpenseRequest) => Promise<Expense>
  onClose: () => void
  onEdit: (expense: Expense) => void
}) {
  const [expense, setExpense] = useState<Expense | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [payOpen, setPayOpen] = useState(false)
  const [voidOpen, setVoidOpen] = useState(false)

  const load = useCallback(async () => {
    if (!expenseId) return
    setLoading(true)
    setError(null)
    try {
      const fetched = await expensesApi.get(businessId, expenseId)
      setExpense(fetched)
    } catch (err) {
      console.error('[expenses] detail load failed', err)
      setExpense(null)
      setError('Unable to load this expense.')
    } finally {
      setLoading(false)
    }
  }, [businessId, expenseId])

  useEffect(() => {
    if (!expenseId) {
      setExpense(null)
      setPayOpen(false)
      setVoidOpen(false)
      return
    }
    setExpense(null)
    void load()
  }, [expenseId, load])

  const voided = expense?.status === 'VOIDED'
  const outstandingCents = expense
    ? Math.max(0, toCents(expense.amount) - toCents(expense.amountPaid))
    : 0
  const canRecordPayment = !!expense && !voided && outstandingCents > 0

  async function handlePayment(input: RecordExpensePaymentRequest) {
    if (!expense) throw new Error('No expense.')
    const updated = await recordPayment(expense.id, input)
    setExpense(updated)
    return updated
  }

  async function handleVoid(input: VoidExpenseRequest) {
    if (!expense) throw new Error('No expense.')
    const updated = await voidExpense(expense.id, input)
    setExpense(updated)
    return updated
  }

  return (
    <Modal
      open={expenseId !== null}
      onClose={onClose}
      title="Expense Details"
      width="max-w-lg"
    >
      {loading && <LoadingState label="Loading expense…" />}

      {!loading && error && (
        <div className="px-6 py-10 text-center">
          <p className="text-sm text-ink-3 mb-3">{error}</p>
          <Button size="sm" variant="secondary" onClick={() => void load()}>
            Retry
          </Button>
        </div>
      )}

      {!loading && !error && expense && (
        <>
          <div className="px-6 py-5">
            <div className="flex items-start justify-between gap-3 mb-4">
              <p className="font-display text-xl text-ink break-words">
                {expense.description?.trim() || 'Expense'}
              </p>
              <ExpenseStatusBadge status={expense.status} />
            </div>

            <div className="flex flex-col">
              <DetailRow label="Amount">{formatMoney(expense.amount)} ETB</DetailRow>
              <DetailRow label="Amount Paid">
                {formatMoney(expense.amountPaid)} ETB
              </DetailRow>
              {!voided && outstandingCents > 0 && (
                <DetailRow label="Outstanding">
                  <span className="text-[#B06A6A]">
                    {formatMoney(centsToInput(outstandingCents))} ETB
                  </span>
                </DetailRow>
              )}

              {expense.category?.name && (
                <DetailRow label="Category">{expense.category.name}</DetailRow>
              )}
              {expense.branch?.name && (
                <DetailRow label="Branch">{expense.branch.name}</DetailRow>
              )}
              {expense.paymentMethod?.name && (
                <DetailRow label="Payment Method">{expense.paymentMethod.name}</DetailRow>
              )}
              {expense.vendor && <DetailRow label="Vendor">{expense.vendor}</DetailRow>}
              {expense.receiptNumber && (
                <DetailRow label="Receipt Number">{expense.receiptNumber}</DetailRow>
              )}
              <DetailRow label="Expense Date">
                {formatExpenseDate(expense.expenseDate)}
              </DetailRow>
              {expense.dueDate && (
                <DetailRow label="Due Date">{formatExpenseDate(expense.dueDate)}</DetailRow>
              )}
              {expense.paidAt && (
                <DetailRow label="Paid At">{formatExpenseDate(expense.paidAt)}</DetailRow>
              )}
              {expense.notes && <DetailRow label="Notes">{expense.notes}</DetailRow>}
              {expense.createdBy?.phone && (
                <DetailRow label="Created By">{expense.createdBy.phone}</DetailRow>
              )}
              <DetailRow label="Created">{formatExpenseDate(expense.createdAt)}</DetailRow>

              {voided && (
                <>
                  {expense.voidedAt && (
                    <DetailRow label="Voided At">
                      {formatExpenseDate(expense.voidedAt)}
                    </DetailRow>
                  )}
                  {expense.voidReason && (
                    <DetailRow label="Void Reason">{expense.voidReason}</DetailRow>
                  )}
                </>
              )}
            </div>
          </div>

          {!voided && (
            <div className="px-6 pb-6 flex flex-wrap justify-end gap-2 border-t border-line pt-4">
              <Button variant="secondary" size="sm" onClick={() => onEdit(expense)}>
                Edit
              </Button>
              {canRecordPayment && (
                <Button size="sm" onClick={() => setPayOpen(true)}>
                  Record Payment
                </Button>
              )}
              <Button variant="destructive" size="sm" onClick={() => setVoidOpen(true)}>
                Void Expense
              </Button>
            </div>
          )}
        </>
      )}

      {expense && payOpen && (
        <RecordPaymentDialog
          expense={expense}
          methods={methods}
          onClose={() => setPayOpen(false)}
          onRecorded={() => setPayOpen(false)}
          onRecord={handlePayment}
        />
      )}

      {expense && voidOpen && (
        <VoidExpenseDialog
          onClose={() => setVoidOpen(false)}
          onVoided={() => setVoidOpen(false)}
          onVoid={handleVoid}
        />
      )}
    </Modal>
  )
}

/* ------------------------------------------------------------------ */
/*  Record payment                                                     */
/* ------------------------------------------------------------------ */

function RecordPaymentDialog({
  expense,
  methods,
  onClose,
  onRecorded,
  onRecord,
}: {
  expense: Expense
  methods: PaymentMethod[]
  onClose: () => void
  onRecorded: (expense: Expense) => void
  onRecord: (input: RecordExpensePaymentRequest) => Promise<Expense>
}) {
  const outstandingCents = Math.max(
    0,
    toCents(expense.amount) - toCents(expense.amountPaid),
  )
  const activeMethods = methods.filter(m => m.isActive)
  const [amount, setAmount] = useState(centsToInput(outstandingCents))
  const [methodId, setMethodId] = useState(expense.paymentMethod?.id ?? '')
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  async function submit() {
    const cents = toCents(amount)
    if (!amount.trim() || cents <= 0) {
      setFormError('Enter an amount greater than zero.')
      return
    }
    if (cents > outstandingCents) {
      setFormError(
        `Payment exceeds the remaining balance (${formatMoney(centsToInput(outstandingCents))} ETB).`,
      )
      return
    }

    setSaving(true)
    setFormError(null)
    try {
      /* Only the confirmed payment contract fields go on the wire:
         `amount` (number, required) and `paymentMethodId` (optional UUID).
         `paidAt` is omitted so the server stamps it. UI-only fields such as
         reference/notes are not part of this endpoint and would 400. */
      const input: RecordExpensePaymentRequest = { amount: cents / 100 }
      if (methodId) input.paymentMethodId = methodId
      const updated = await onRecord(input)
      onRecorded(updated)
    } catch (err) {
      console.error('[expenses] record payment failed', err)
      setFormError(apiErrorMessage(err, 'Could not record the payment.'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal open onClose={onClose} title="Record Payment" width="max-w-md">
      <div className="px-6 py-5 flex flex-col gap-4">
        <div className="bg-bg rounded-xl px-4 py-3 flex flex-col gap-1.5">
          <div className="flex justify-between text-sm">
            <span className="text-ink-3">Expense Amount</span>
            <span className="text-ink font-medium">{formatMoney(expense.amount)} ETB</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-ink-3">Amount Paid</span>
            <span className="text-ink font-medium">{formatMoney(expense.amountPaid)} ETB</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-ink-3">Outstanding</span>
            <span className="text-[#B06A6A] font-medium">
              {formatMoney(centsToInput(outstandingCents))} ETB
            </span>
          </div>
        </div>

        <Input
          label="Payment Amount (ETB) *"
          type="number"
          min="0"
          step="0.01"
          value={amount}
          onChange={e => setAmount(e.target.value)}
        />

        <Select
          label="Payment Method"
          value={methodId}
          onChange={e => setMethodId(e.target.value)}
        >
          <option value="">Select payment method</option>
          {activeMethods.map(m => (
            <option key={m.id} value={m.id}>
              {m.name}
            </option>
          ))}
        </Select>

        {formError && <DialogError message={formError} />}

        <div className="flex justify-end gap-2 pt-1">
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={() => void submit()} loading={saving} disabled={saving}>
            {saving ? 'Recording…' : 'Record Payment'}
          </Button>
        </div>
      </div>
    </Modal>
  )
}

/* ------------------------------------------------------------------ */
/*  Void expense                                                       */
/* ------------------------------------------------------------------ */

function VoidExpenseDialog({
  onClose,
  onVoided,
  onVoid,
}: {
  onClose: () => void
  onVoided: (expense: Expense) => void
  onVoid: (input: VoidExpenseRequest) => Promise<Expense>
}) {
  const [reason, setReason] = useState('')
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  async function submit() {
    if (!reason.trim()) {
      setFormError('A void reason is required.')
      return
    }
    setSaving(true)
    setFormError(null)
    try {
      const updated = await onVoid({ reason: reason.trim() })
      onVoided(updated)
    } catch (err) {
      console.error('[expenses] void failed', err)
      setFormError(apiErrorMessage(err, 'Could not void the expense.'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal open onClose={onClose} title="Void Expense" width="max-w-md">
      <div className="px-6 py-5 flex flex-col gap-4">
        <p className="text-sm text-ink-2">
          Are you sure you want to void this expense?
        </p>

        <Textarea
          label="Void reason *"
          rows={3}
          value={reason}
          onChange={e => setReason(e.target.value)}
          placeholder="Why is this expense being voided?"
        />

        {formError && <DialogError message={formError} />}

        <div className="flex justify-end gap-2 pt-1">
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={() => void submit()}
            loading={saving}
            disabled={saving}
          >
            {saving ? 'Voiding…' : 'Void Expense'}
          </Button>
        </div>
      </div>
    </Modal>
  )
}