import { useState } from 'react'
import type { PaymentMethod, PaymentMethodInput } from '../../types/api'
import { ApiError } from '../../api/errors'
import { Button, Input, Modal, Select, Textarea, Toggle } from '../ui'
import { useToast } from '../ui/Toast'
import { usePaymentMethods } from '../../hooks/usePaymentMethods'

/* ------------------------------------------------------------------ */
/*  Payment methods                                                    */
/*                                                                     */
/*  Every payment form in the app (appointment panel, customer          */
/*  overview, completion modal) reads its dropdown from §4.3 filtered   */
/*  to active. That list was always empty because there was no way to   */
/*  populate it, so this tab is the missing write path.                 */
/*                                                                     */
/*  Delete is deliberately secondary to deactivate: the server refuses  */
/*  to remove a method already referenced by a receipt (§4.5), and      */
/*  deactivating keeps historical payments readable.                    */
/* ------------------------------------------------------------------ */

const TYPE_OPTIONS = [
  { value: 'CASH', label: 'Cash' },
  { value: 'MOBILE_MONEY', label: 'Mobile money' },
  { value: 'BANK_TRANSFER', label: 'Bank transfer' },
  { value: 'CARD', label: 'Card' },
  { value: 'OTHER', label: 'Other' },
]

interface Draft {
  name: string
  type: string
  accountName: string
  accountNumber: string
  instructions: string
}

const EMPTY: Draft = {
  name: '',
  type: 'CASH',
  accountName: '',
  accountNumber: '',
  instructions: '',
}

function draftFrom(m: PaymentMethod): Draft {
  return {
    name: m.name ?? '',
    type: m.type || 'OTHER',
    accountName: m.accountName ?? '',
    accountNumber: m.accountNumber ?? '',
    instructions: m.instructions ?? '',
  }
}

/* The server stores free-form strings with no schema validation (§11.3),
   so duplicate names and blank fields are caught here to save a round
   trip and to give a better message than a bare 400. */
function validate(d: Draft, existing: PaymentMethod[], editingId?: string): string | null {
  const name = d.name.trim()
  if (!name) return 'Method name is required.'
  if (name.length > 100) return 'Method name must be 100 characters or fewer.'
  if (!d.type.trim()) return 'Method type is required.'

  const clash = existing.some(
    m =>
      m.id !== editingId &&
      (m.name ?? '').trim().toLowerCase() === name.toLowerCase(),
  )
  if (clash) return 'A payment method with this name already exists.'

  if (d.accountNumber.trim().length > 50)
    return 'Account number must be 50 characters or fewer.'
  if (d.instructions.trim().length > 500)
    return 'Instructions must be 500 characters or fewer.'
  return null
}

function toInput(d: Draft): PaymentMethodInput {
  const out: PaymentMethodInput = { name: d.name.trim(), type: d.type.trim() }
  if (d.accountName.trim()) out.accountName = d.accountName.trim()
  if (d.accountNumber.trim()) out.accountNumber = d.accountNumber.trim()
  if (d.instructions.trim()) out.instructions = d.instructions.trim()
  return out
}

function reason(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.status === 403)
      return 'You do not have permission to change payment methods. Ask the business owner to make this change.'
    if (err.fieldErrors?.length)
      return err.fieldErrors.map(f => f.message).join(' ')
    if (err.isValidationError || err.isConflict)
      return err.message || 'That change was rejected.'
    /* A 5xx is a server fault, not bad input. The backend returns
       error.message in development and "Internal server error" in
       production — surfacing either beats a generic apology, and the
       code plus message is what actually identifies the throw site. */
    if (err.status >= 500) {
      const detail =
        err.message && err.message !== 'Internal server error'
          ? err.message
          : 'no detail returned'
      return `Server error ${err.status} (${err.code}): ${detail}`
    }
  }
  return 'Something went wrong. Try again.'
}

function typeLabel(value: string): string {
  return TYPE_OPTIONS.find(o => o.value === value)?.label ?? value
}

export function FinancePaymentMethodsTab({ businessId }: { businessId?: string }) {
  const toast = useToast()
  const { methods, loading, error, reload, create, update, remove, setActive } =
    usePaymentMethods(businessId)

  const [editorOpen, setEditorOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [draft, setDraft] = useState<Draft>(EMPTY)
  const [formError, setFormError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [pendingDelete, setPendingDelete] = useState<PaymentMethod | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  function openAdd() {
    setEditingId(null)
    setDraft(EMPTY)
    setFormError(null)
    setEditorOpen(true)
  }

  function openEdit(m: PaymentMethod) {
    setEditingId(m.id)
    setDraft(draftFrom(m))
    setFormError(null)
    setEditorOpen(true)
  }

  async function save() {
    const problem = validate(draft, methods, editingId ?? undefined)
    if (problem) {
      setFormError(problem)
      return
    }
    setBusy(true)
    setFormError(null)
    try {
      if (editingId) {
        await update(editingId, toInput(draft))
        toast.success('Payment method updated.')
      } else {
        await create(toInput(draft))
        toast.success('Payment method added.')
      }
      setEditorOpen(false)
    } catch (err) {
      // Keep the raw failure in the console — the inline copy is trimmed to
      // what helps the user, but the stack is what finds the throw site.
      console.error('[payment-methods] create failed', err)
      setFormError(reason(err))
    } finally {
      setBusy(false)
    }
  }

  async function toggleActive(m: PaymentMethod, next: boolean) {
    try {
      await setActive(m.id, next)
      toast.success(
        next ? `${m.name} is now available.` : `${m.name} hidden from new payments.`,
      )
    } catch (err) {
      toast.error(reason(err))
    }
  }

  async function confirmDelete() {
    if (!pendingDelete) return
    setBusy(true)
    setDeleteError(null)
    try {
      await remove(pendingDelete.id)
      toast.success(`${pendingDelete.name} deleted.`)
      setPendingDelete(null)
    } catch (err) {
      setDeleteError(reason(err))
    } finally {
      setBusy(false)
    }
  }

  if (!businessId) {
    return (
      <p className="text-sm text-ink-3 py-8 text-center">
        Select a business to manage its payment methods.
      </p>
    )
  }

  return (
    <div className="flex flex-col gap-5 max-w-3xl">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-sm font-semibold text-ink">Payment methods</h3>
          <p className="text-xs text-ink-3 mt-1">
            Active methods appear in every appointment payment form. Changes are
            saved to your account.
          </p>
        </div>
        <Button size="sm" onClick={openAdd}>
          + Add method
        </Button>
      </div>

      {error && (
        <div className="flex items-center justify-between px-4 py-3 rounded-xl bg-bg border border-line">
          <p className="text-xs text-ink-3">{error}</p>
          <button onClick={() => void reload()} className="text-xs font-medium text-ink hover:underline">
            Retry
          </button>
        </div>
      )}

      {loading && methods.length === 0 ? (
        <p className="text-sm text-ink-3 py-6">Loading payment methods…</p>
      ) : methods.length === 0 ? (
        <div className="px-5 py-8 rounded-2xl border border-dashed border-line text-center">
          <p className="text-sm font-medium text-ink">No payment methods yet</p>
          <p className="text-xs text-ink-3 mt-1.5 max-w-sm mx-auto">
            Add at least one — cash, mobile money, or bank transfer — before
            recording a payment on an appointment.
          </p>
          <Button size="sm" className="mt-4" onClick={openAdd}>
            + Add method
          </Button>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {methods.map(m => (
            <div
              key={m.id}
              className={`px-4 py-3 rounded-xl border border-line ${m.isActive ? 'bg-surface' : 'bg-bg'}`}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-sm font-medium truncate ${m.isActive ? 'text-ink' : 'text-ink-3'}`}
                    >
                      {m.name}
                    </span>
                    <span className="px-1.5 py-0.5 rounded-md bg-warm-subtle text-[10px] font-medium text-ink-3">
                      {typeLabel(m.type)}
                    </span>
                  </div>
                  {(m.accountName || m.accountNumber) && (
                    <p className="text-xs text-ink-3 mt-1 truncate">
                      {m.accountName}
                      {m.accountName && m.accountNumber ? ' · ' : ''}
                      {m.accountNumber}
                    </p>
                  )}
                  {m.instructions && (
                    <p className="text-xs text-ink-3 mt-1">{m.instructions}</p>
                  )}
                </div>

                <div className="flex items-center gap-3 flex-shrink-0">
                  <Toggle
                    checked={m.isActive}
                    onChange={v => void toggleActive(m, v)}
                  />
                  <button
                    onClick={() => openEdit(m)}
                    className="text-xs font-medium text-ink-3 hover:text-ink transition-colors"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => {
                      setDeleteError(null)
                      setPendingDelete(m)
                    }}
                    className="text-xs font-medium text-ink-3 hover:text-[#A33A2A] transition-colors"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ---- Add / edit ---- */}
      <Modal
        open={editorOpen}
        onClose={() => setEditorOpen(false)}
        title={editingId ? 'Edit payment method' : 'Add payment method'}
      >
        <div className="px-6 py-5 flex flex-col gap-4">
          <Input
            label="Name"
            value={draft.name}
            onChange={e => setDraft({ ...draft, name: e.target.value })}
            placeholder="Telebirr"
            autoFocus
          />
          <Select
            label="Type"
            value={draft.type}
            onChange={e => setDraft({ ...draft, type: e.target.value })}
          >
            {TYPE_OPTIONS.map(o => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </Select>
          <Input
            label="Account name"
            value={draft.accountName}
            onChange={e => setDraft({ ...draft, accountName: e.target.value })}
            placeholder="Optional"
          />
          <Input
            label="Account number"
            value={draft.accountNumber}
            onChange={e => setDraft({ ...draft, accountNumber: e.target.value })}
            placeholder="Optional"
          />
          <Textarea
            label="Instructions"
            value={draft.instructions}
            onChange={e => setDraft({ ...draft, instructions: e.target.value })}
            placeholder="Shown to customers on the booking confirmation. Optional."
          />

          {formError && (
            <p className="text-xs text-[#A33A2A] bg-[#A33A2A]/5 px-3 py-2 rounded-lg">
              {formError}
            </p>
          )}

          <div className="flex justify-end gap-2 pt-1">
            <Button variant="ghost" size="sm" onClick={() => setEditorOpen(false)}>
              Cancel
            </Button>
            <Button size="sm" onClick={() => void save()} disabled={busy}>
              {busy ? 'Saving…' : editingId ? 'Save changes' : 'Add method'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* ---- Delete ---- */}
      <Modal
        open={pendingDelete !== null}
        onClose={() => setPendingDelete(null)}
        title="Delete this payment method?"
        width="max-w-md"
      >
        <div className="px-6 py-5 flex flex-col gap-4">
          <p className="text-sm text-ink-3">
            <span className="font-medium text-ink">{pendingDelete?.name}</span> will
            no longer be selectable on any appointment. This cannot be undone.
          </p>
          <p className="text-xs text-ink-3 bg-bg px-3 py-2.5 rounded-lg">
            Prefer deactivating over deleting: existing payments keep pointing at
            this method, and deactivating hides it from new payments without
            touching that history.
          </p>

          {deleteError && (
            <p className="text-xs text-[#A33A2A] bg-[#A33A2A]/5 px-3 py-2 rounded-lg">
              {deleteError}
            </p>
          )}

          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => setPendingDelete(null)}>
              Cancel
            </Button>
            <Button variant="destructive" size="sm" onClick={() => void confirmDelete()} disabled={busy}>
              {busy ? 'Deleting…' : 'Delete method'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
