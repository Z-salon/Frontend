import { useEffect, useMemo, useState } from 'react'
import type {
  CreateExpenseRequest,
  Expense,
  ExpenseCategory,
  PaymentMethod,
  UpdateExpenseRequest,
} from '../../types/api'
import { apiErrorMessage } from '../../api/errors'
import { toCents, formatMoney } from '../../lib/money'
import { isoToDateInput, todayInput } from '../../lib/dates'
import { Button, Input, Modal, Select } from '../ui'

/* ------------------------------------------------------------------ */
/*  Add / Edit expense                                                 */
/*                                                                     */
/*  One form for both mutations. Only fields the create/update         */
/*  contract accepts are collected — `amountPaid`, `status` and the    */
/*  void fields belong to the server (payment / void endpoints).       */
/* ------------------------------------------------------------------ */

interface Draft {
  categoryId: string
  amount: string
  branchId: string
  paymentMethodId: string
  expenseDate: string
  dueDate: string
  vendor: string
  receiptNumber: string
  description: string
  notes: string
}

function initialDraft(expense: Expense | null | undefined, categories: ExpenseCategory[]): Draft {
  if (expense) {
    return {
      categoryId: expense.categoryId,
      amount: expense.amount ?? '',
      branchId: expense.branchId,
      paymentMethodId: expense.paymentMethod?.id ?? '',
      expenseDate: isoToDateInput(expense.expenseDate),
      dueDate: isoToDateInput(expense.dueDate),
      vendor: expense.vendor ?? '',
      receiptNumber: expense.receiptNumber ?? '',
      description: expense.description ?? '',
      notes: expense.notes ?? '',
    }
  }
  const firstCategory = categories.find(c => c.isActive)
  return {
    categoryId: firstCategory?.id ?? '',
    amount: '',
    branchId: '',
    paymentMethodId: '',
    expenseDate: todayInput(),
    dueDate: '',
    vendor: '',
    receiptNumber: '',
    description: '',
    notes: '',
  }
}

function buildPayload(d: Draft): CreateExpenseRequest {
  const payload: CreateExpenseRequest = {
    branchId: d.branchId,
    categoryId: d.categoryId,
    amount: Number(d.amount),
    expenseDate: d.expenseDate,
  }
  const description = d.description.trim()
  const vendor = d.vendor.trim()
  const receiptNumber = d.receiptNumber.trim()
  const notes = d.notes.trim()
  if (description) payload.description = description
  if (vendor) payload.vendor = vendor
  if (receiptNumber) payload.receiptNumber = receiptNumber
  if (notes) payload.notes = notes
  if (d.dueDate) payload.dueDate = d.dueDate
  if (d.paymentMethodId) payload.paymentMethodId = d.paymentMethodId
  return payload
}

function FormError({ message }: { message: string }) {
  return (
    <p className="text-xs text-[#B03A3A] bg-[#FBEDED] border border-[#E5B5B5] rounded-xl px-3 py-2">
      {message}
    </p>
  )
}

export function ExpenseFormModal({
  open,
  expense,
  categories,
  branches,
  methods,
  create,
  update,
  onClose,
  onSaved,
  onManageCategories,
}: {
  open: boolean
  /** Present → edit mode. */
  expense?: Expense | null
  categories: ExpenseCategory[]
  branches: Array<{ id: string; name: string }>
  methods: PaymentMethod[]
  create: (input: CreateExpenseRequest) => Promise<Expense>
  update: (id: string, input: UpdateExpenseRequest) => Promise<Expense>
  onClose: () => void
  onSaved: (expense: Expense) => void
  onManageCategories?: () => void
}) {
  const editing = !!expense
  const [draft, setDraft] = useState<Draft>(() => initialDraft(expense, categories))
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  // Re-seed every time the dialog opens (or switches records).
  useEffect(() => {
    if (!open) return
    setDraft(initialDraft(expense, categories))
    setFormError(null)
    setSaving(false)
    // Intentionally keyed on identity only: re-seeding on every `categories`
    // refresh would wipe what the user has typed mid-edit.
  }, [open, expense?.id])

  const activeCategories = useMemo(
    () => categories.filter(c => c.isActive),
    [categories],
  )
  const activeMethods = useMemo(() => methods.filter(m => m.isActive), [methods])

  // Keep the record's own (possibly retired) category / branch / method
  // selectable while editing — otherwise saving would silently reassign it.
  const extraCategory =
    expense && !activeCategories.some(c => c.id === expense.categoryId)
      ? { id: expense.categoryId, name: expense.category?.name ?? 'Current category' }
      : null
  const extraBranch =
    expense && !branches.some(b => b.id === expense.branchId)
      ? { id: expense.branchId, name: expense.branch?.name ?? 'Current branch' }
      : null
  const extraMethod =
    expense?.paymentMethod &&
    !activeMethods.some(m => m.id === expense.paymentMethod!.id)
      ? { id: expense.paymentMethod.id, name: expense.paymentMethod.name }
      : null

  function set<K extends keyof Draft>(key: K, value: Draft[K]) {
    setDraft(prev => ({ ...prev, [key]: value }))
  }

  function validate(): string | null {
    if (!draft.categoryId) return 'Select a category.'
    if (!draft.branchId) return 'Select a branch.'
    if (!draft.expenseDate) return 'Choose an expense date.'
    const cents = toCents(draft.amount)
    if (!draft.amount.trim() || cents <= 0) return 'Enter an amount greater than zero.'
    if (expense) {
      const paid = toCents(expense.amountPaid)
      if (cents < paid) {
        return `Amount cannot be less than the amount already paid (${formatMoney(expense.amountPaid)} ETB).`
      }
    }
    return null
  }

  async function submit() {
    const problem = validate()
    if (problem) {
      setFormError(problem)
      return
    }

    setSaving(true)
    setFormError(null)
    try {
      const payload = buildPayload(draft)
      const saved = expense
        ? await update(expense.id, payload)
        : await create(payload)
      onSaved(saved)
    } catch (err) {
      // Keep the form open with what was typed so it can be corrected.
      console.error('[expenses] save failed', err)
      setFormError(
        apiErrorMessage(
          err,
          editing ? 'Could not save the expense.' : 'Could not create the expense.',
        ),
      )
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editing ? 'Edit Expense' : 'Add Expense'}
      width="max-w-xl"
    >
      <form
        className="px-6 py-5 flex flex-col gap-4"
        onSubmit={e => {
          e.preventDefault()
          void submit()
        }}
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Select
            label="Category *"
            value={draft.categoryId}
            onChange={e => set('categoryId', e.target.value)}
          >
            <option value="">Select category</option>
            {extraCategory && (
              <option value={extraCategory.id}>{extraCategory.name}</option>
            )}
            {activeCategories.map(c => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>

          <Select
            label="Branch *"
            value={draft.branchId}
            onChange={e => set('branchId', e.target.value)}
          >
            <option value="">Select branch</option>
            {extraBranch && <option value={extraBranch.id}>{extraBranch.name}</option>}
            {branches.map(b => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </Select>

          <Input
            label="Amount (ETB) *"
            type="number"
            min="0"
            step="0.01"
            value={draft.amount}
            onChange={e => set('amount', e.target.value)}
            placeholder="0.00"
          />

          <Select
            label="Payment Method"
            value={draft.paymentMethodId}
            onChange={e => set('paymentMethodId', e.target.value)}
          >
            <option value="">Select payment method</option>
            {extraMethod && <option value={extraMethod.id}>{extraMethod.name}</option>}
            {activeMethods.map(m => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </Select>

          <Input
            label="Expense Date *"
            type="date"
            value={draft.expenseDate}
            onChange={e => set('expenseDate', e.target.value)}
          />

          <Input
            label="Due Date"
            type="date"
            value={draft.dueDate}
            onChange={e => set('dueDate', e.target.value)}
          />

          <Input
            label="Vendor"
            value={draft.vendor}
            onChange={e => set('vendor', e.target.value)}
            placeholder="e.g. Ethiopia Utilities"
          />

          <Input
            label="Receipt Number"
            value={draft.receiptNumber}
            onChange={e => set('receiptNumber', e.target.value)}
            placeholder="e.g. REC-1001"
          />
        </div>

        <Input
          label="Description"
          value={draft.description}
          onChange={e => set('description', e.target.value)}
          placeholder="e.g. Weekly cleaning service"
        />

        <Input
          label="Notes"
          value={draft.notes}
          onChange={e => set('notes', e.target.value)}
          placeholder="Optional"
        />

        {activeCategories.length === 0 && !extraCategory && (
          <p className="text-xs text-ink-3">
            No active expense categories yet.{' '}
            {onManageCategories && (
              <button
                type="button"
                onClick={onManageCategories}
                className="font-medium text-ink hover:underline"
              >
                Create one in Categories
              </button>
            )}
          </p>
        )}

        {formError && <FormError message={formError} />}

        <div className="flex justify-end gap-2 sm:gap-3 pt-1">
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button type="submit" loading={saving} disabled={saving}>
            {saving ? 'Saving…' : editing ? 'Save Changes' : 'Create Expense'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}