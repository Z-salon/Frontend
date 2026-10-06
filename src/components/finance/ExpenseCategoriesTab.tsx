import { useMemo, useRef, useState } from 'react'
import type {
  CreateExpenseCategoryRequest,
  ExpenseCategory,
  UpdateExpenseCategoryRequest,
} from '../../types/api'
import { ApiError } from '../../api/errors'
import { Button, Input, Modal, Select, Toggle } from '../ui'
import { EmptyState, LoadingState } from '../ui/EmptyState'
import { useToast } from '../ui/Toast'
import { useExpenseCategories } from '../../hooks/useExpenseCategories'

/* ------------------------------------------------------------------ */
/*  Expense categories                                                 */
/*                                                                     */
/*  Finance → Categories is the only writer for `/expense-categories`. */
/*  The old editor in the Expenses tab, and the copy in Settings, both  */
/*  fabricated rows client-side (`ec${Date.now()}`) and saved them to    */
/*  local React state, so a category could be created, renamed and       */
/*  "deactivated" without the server ever hearing about it.              */
/*                                                                     */
/*  Everything rendered here comes off the endpoint: the rows, their    */
/*  ids, and the Active/Inactive pill (which is `isActive`, nothing      */
/*  else). Activation is a PATCH with `{ isActive }` — there is no      */
/*  DELETE endpoint and no local status to drift.                       */
/* ------------------------------------------------------------------ */

interface Draft {
  name: string
  description: string
}

const EMPTY_DRAFT: Draft = { name: '', description: '' }

interface EditDraft extends Draft {
  isActive: boolean
}

/** `description` is optional in the contract, so a blank one is left out of
 *  the payload entirely rather than sent as an empty string. */
function toCreateInput(d: Draft): CreateExpenseCategoryRequest {
  const name = d.name.trim()
  const description = d.description.trim()
  return description ? { name, description } : { name }
}

function toUpdateInput(d: EditDraft): UpdateExpenseCategoryRequest {
  const description = d.description.trim()
  return {
    name: d.name.trim(),
    isActive: d.isActive,
    ...(description ? { description } : {}),
  }
}

/**
 * Backend-first error copy: a duplicate name or a rejected field arrives as a
 * 4xx with a message worth reading, so it beats our own fallback. The fallback
 * only covers the cases where the server said nothing useful.
 */
function reason(err: unknown, fallback: string): string {
  if (err instanceof ApiError) {
    if (err.status === 403)
      return 'You do not have permission to manage expense categories. Ask the business owner to make this change.'
    if (err.fieldErrors?.length) return err.fieldErrors.map(f => f.message).join(' ')
    if (err.message && err.message !== 'Validation failed') return err.message
  }
  return fallback
}

function LayersIcon() {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 2L2 7l10 5 10-5-10-5z" />
      <path d="M2 12l10 5 10-5" />
      <path d="M2 17l10 5 10-5" />
    </svg>
  )
}

function StatusPill({ active }: { active: boolean }) {
  return (
    <span
      className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
        active ? 'bg-[#EAF5EC] text-[#2A5F30]' : 'bg-line text-ink-3'
      }`}
    >
      {active ? 'Active' : 'Inactive'}
    </span>
  )
}

function FormError({ message }: { message: string }) {
  return (
    <p className="text-xs text-[#B03A3A] bg-[#FBEDED] border border-[#E5B5B5] rounded-xl px-3 py-2">
      {message}
    </p>
  )
}

export function ExpenseCategoriesTab({ businessId }: { businessId?: string }) {
  const toast = useToast()
  const [includeInactive, setIncludeInactive] = useState(false)
  const { categories, loading, error, reload, create, update, setActive } =
    useExpenseCategories(businessId, { includeInactive })

  const [search, setSearch] = useState('')
  /* Ids of rows with a status PATCH in flight — the button for that row is
     disabled so a double click cannot send the same request twice. */
  const [pending, setPending] = useState<string[]>([])

  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT)
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)
  const formRef = useRef<HTMLDivElement>(null)

  const [editing, setEditing] = useState<ExpenseCategory | null>(null)
  const [editDraft, setEditDraft] = useState<EditDraft>({
    ...EMPTY_DRAFT,
    isActive: true,
  })
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  /* Search filters what the backend returned — there is no search parameter in
     the contract, so this stays on the client. */
  const visible = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return categories
    return categories.filter(
      c =>
        c.name.toLowerCase().includes(q) ||
        (c.description ?? '').toLowerCase().includes(q),
    )
  }, [categories, search])

  /** Convenience check against the loaded rows. The server still has the final
   *  say on uniqueness — this only saves a pointless round trip. */
  function clashesWith(name: string, excludeId?: string): boolean {
    const n = name.trim().toLowerCase()
    if (!n) return false
    return categories.some(c => c.id !== excludeId && c.name.trim().toLowerCase() === n)
  }

  function revealForm() {
    formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }

  function resetDraft() {
    setDraft(EMPTY_DRAFT)
    setCreateError(null)
  }

  async function submitCreate() {
    const name = draft.name.trim()
    if (!name) {
      setCreateError('Category name is required.')
      return
    }
    if (clashesWith(name)) {
      setCreateError('An expense category with this name already exists.')
      return
    }

    setCreating(true)
    setCreateError(null)
    try {
      const created = await create(toCreateInput(draft))
      // Only now — after the server confirmed and assigned the id — does the
      // form clear.
      resetDraft()
      toast.success(`${created.name} added.`)
    } catch (err) {
      // The form keeps what was typed so it can be corrected and retried.
      console.error('[expense-categories] create failed', err)
      setCreateError(reason(err, 'Could not create the expense category.'))
    } finally {
      setCreating(false)
    }
  }

  function openEdit(c: ExpenseCategory) {
    setEditDraft({
      name: c.name,
      description: c.description ?? '',
      isActive: c.isActive,
    })
    setSaveError(null)
    setEditing(c)
  }

  async function submitEdit() {
    if (!editing) return
    const name = editDraft.name.trim()
    if (!name) {
      setSaveError('Category name is required.')
      return
    }
    if (clashesWith(name, editing.id)) {
      setSaveError('An expense category with this name already exists.')
      return
    }

    setSaving(true)
    setSaveError(null)
    try {
      const updated = await update(editing.id, toUpdateInput(editDraft))
      setEditing(null)
      toast.success(`${updated.name} updated.`)
    } catch (err) {
      console.error('[expense-categories] update failed', err)
      setSaveError(reason(err, 'Could not save the expense category.'))
    } finally {
      setSaving(false)
    }
  }

  async function toggleActive(c: ExpenseCategory) {
    const next = !c.isActive
    setPending(prev => (prev.includes(c.id) ? prev : [...prev, c.id]))
    try {
      await setActive(c.id, next)
      toast.success(next ? `${c.name} activated.` : `${c.name} deactivated.`)
    } catch (err) {
      console.error('[expense-categories] status update failed', err)
      toast.error(
        reason(err, `Could not ${next ? 'activate' : 'deactivate'} ${c.name}.`),
      )
    } finally {
      setPending(prev => prev.filter(id => id !== c.id))
    }
  }

  if (!businessId) {
    return (
      <p className="text-sm text-ink-3 py-8 text-center">
        Select a business to manage its expense categories.
      </p>
    )
  }

  const showSpinner = loading && categories.length === 0 && !error
  const showNothingYet = !loading && !error && categories.length === 0
  const showNoMatches =
    !showSpinner && !showNothingYet && categories.length > 0 && visible.length === 0

  return (
    <div className="flex flex-col gap-5 max-w-3xl">
      <div>
        <h3 className="text-sm font-semibold text-ink">Expense Categories</h3>
        <p className="text-xs text-ink-3 mt-1">
          Manage the categories used to classify business expenses.
        </p>
      </div>

      {/* ---- Toolbar ---- */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="relative sm:w-72">
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-3"
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <circle cx="11" cy="11" r="8" />
            <path d="M21 21l-4.35-4.35" />
          </svg>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search categories…"
            aria-label="Search categories"
            className="h-9 w-full pl-9 pr-3 rounded-xl border border-line text-sm bg-bg text-ink placeholder:text-ink-3 focus:outline-none focus:border-warm"
          />
        </div>
        <Toggle
          checked={includeInactive}
          onChange={setIncludeInactive}
          label="Show inactive"
        />
      </div>

      {error && (
        <div className="flex items-center justify-between gap-3 px-4 py-3 rounded-xl bg-bg border border-line">
          <p className="text-xs text-ink-3">{error}</p>
          <button
            onClick={() => void reload()}
            className="text-xs font-medium text-ink hover:underline flex-shrink-0"
          >
            Retry
          </button>
        </div>
      )}

      {/* ---- List ---- */}
      {showSpinner ? (
        <LoadingState label="Loading expense categories…" />
      ) : showNothingYet ? (
        <EmptyState
          icon={<LayersIcon />}
          title="No expense categories yet."
          description="Create your first expense category to start organizing expenses."
          action={
            <Button size="sm" onClick={revealForm}>
              Create Category
            </Button>
          }
        />
      ) : showNoMatches ? (
        <EmptyState
          icon={<LayersIcon />}
          title="No expense categories found."
          description={
            search.trim()
              ? 'Try a different name or description.'
              : 'Nothing to show for this filter.'
          }
          action={
            search.trim() ? (
              <Button size="sm" variant="secondary" onClick={() => setSearch('')}>
                Clear search
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className="bg-surface rounded-2xl border border-line overflow-hidden">
          <div className="hidden sm:grid grid-cols-[1fr_110px_170px] gap-4 px-5 py-3 border-b border-line">
            {['Category', 'Status', 'Actions'].map(h => (
              <span
                key={h}
                className={`text-[11px] font-semibold text-ink-3 uppercase tracking-wider ${
                  h === 'Actions' ? 'text-right' : ''
                }`}
              >
                {h}
              </span>
            ))}
          </div>

          {visible.map(c => {
            const busy = pending.includes(c.id)
            return (
              <div
                key={c.id}
                className={`flex flex-col sm:grid sm:grid-cols-[1fr_110px_170px] sm:items-center gap-2 sm:gap-4 px-4 sm:px-5 py-3.5 border-b border-line last:border-0 ${
                  c.isActive ? 'bg-surface' : 'bg-bg'
                }`}
              >
                <div className="min-w-0">
                  <span
                    className={`text-sm font-medium truncate block ${
                      c.isActive ? 'text-ink' : 'text-ink-3'
                    }`}
                  >
                    {c.name}
                  </span>
                  {c.description && (
                    <p className="text-xs text-ink-3 mt-0.5 truncate">{c.description}</p>
                  )}
                </div>

                <div className="sm:w-fit">
                  <StatusPill active={c.isActive} />
                </div>

                <div className="flex items-center gap-4 sm:justify-end flex-shrink-0">
                  <button
                    onClick={() => openEdit(c)}
                    disabled={busy}
                    className="text-xs font-medium text-ink-3 hover:text-ink transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => void toggleActive(c)}
                    disabled={busy}
                    className="text-xs font-medium text-ink-3 hover:text-ink transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {busy ? 'Saving…' : c.isActive ? 'Deactivate' : 'Activate'}
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* ---- Add ---- */}
      <div
        ref={formRef}
        className="bg-surface rounded-2xl border border-line px-4 sm:px-5 py-5"
      >
        <p className="text-sm font-semibold text-ink">Add Expense Category</p>
        <p className="text-xs text-ink-3 mt-1">
          Categories are unique per business and used when recording an expense.
        </p>

        <form
          className="flex flex-col gap-4 mt-4"
          onSubmit={e => {
            e.preventDefault()
            void submitCreate()
          }}
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Name *"
              value={draft.name}
              onChange={e => setDraft({ ...draft, name: e.target.value })}
              placeholder="e.g. Rent"
              autoComplete="off"
            />
            <Input
              label="Description"
              value={draft.description}
              onChange={e => setDraft({ ...draft, description: e.target.value })}
              placeholder="Optional — e.g. Studio rent"
            />
          </div>

          {createError && <FormError message={createError} />}

          <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 sm:gap-3">
            <Button
              variant="ghost"
              onClick={resetDraft}
              disabled={creating}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              loading={creating}
              disabled={creating || !draft.name.trim()}
            >
              {creating ? 'Creating…' : 'Create Category'}
            </Button>
          </div>
        </form>
      </div>

      {/* ---- Edit ---- */}
      <Modal
        open={editing !== null}
        onClose={() => setEditing(null)}
        title="Edit Expense Category"
        width="max-w-md"
      >
        <div className="px-4 sm:px-6 py-5 flex flex-col gap-4">
          <Input
            label="Name *"
            value={editDraft.name}
            onChange={e => setEditDraft({ ...editDraft, name: e.target.value })}
            autoComplete="off"
          />
          <Input
            label="Description"
            value={editDraft.description}
            onChange={e =>
              setEditDraft({ ...editDraft, description: e.target.value })
            }
            placeholder="Optional"
          />
          <Select
            label="Status"
            value={editDraft.isActive ? 'active' : 'inactive'}
            onChange={e =>
              setEditDraft({ ...editDraft, isActive: e.target.value === 'active' })
            }
          >
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </Select>

          {saveError && <FormError message={saveError} />}
        </div>

        <div className="px-4 sm:px-6 pb-5 sm:pb-6 flex justify-end gap-2 sm:gap-3 border-t border-line pt-4">
          <Button variant="ghost" onClick={() => setEditing(null)} disabled={saving}>
            Cancel
          </Button>
          <Button
            onClick={() => void submitEdit()}
            loading={saving}
            disabled={saving || !editDraft.name.trim()}
          >
            {saving ? 'Saving…' : 'Save Changes'}
          </Button>
        </div>
      </Modal>
    </div>
  )
}