import type { ServiceUsageInput, ServiceUsageProduct } from '../../types/api'
import { Input, Textarea } from '../ui'

/* ------------------------------------------------------------------ */
/*  Service usage form                                                */
/*                                                                     */
/*  Used in the "Mark as complete" modal and in the add-usage modal   */
/*  on a completed appointment. Kept dumb — it owns no networking.    */
/* ------------------------------------------------------------------ */

/**
 * Quantity is a `number` on the wire but a text field in the UI, so the
 * draft keeps it as a string and we only coerce on submit.
 */
export interface ProductDraft {
  name: string
  quantity: string
  unit: string
}

export interface ServiceUsageDraft {
  serviceName: string
  serviceDetails: string
  productsUsed: ProductDraft[]
  notes: string
}

export function emptyDraft(serviceName = ''): ServiceUsageDraft {
  return { serviceName, serviceDetails: '', productsUsed: [], notes: '' }
}

const EMPTY_PRODUCT: ProductDraft = { name: '', quantity: '', unit: '' }

export function draftFromUsage(usage: {
  serviceName: string
  serviceDetails: string | null
  productsUsed: ServiceUsageProduct[] | null
  notes: string | null
}): ServiceUsageDraft {
  return {
    serviceName: usage.serviceName,
    serviceDetails: usage.serviceDetails ?? '',
    productsUsed: (usage.productsUsed ?? []).map(p => ({
      name: p.name,
      quantity: String(p.quantity),
      unit: p.unit,
    })),
    notes: usage.notes ?? '',
  }
}

/**
 * Blank-tolerant validation, mirroring the API: only `serviceName` is
 * required, and a product row counts only once all three fields are filled.
 * Rows the user started but abandoned are dropped rather than rejected —
 * the API 400s on a blank `serviceName`, which is a hostile way to lose
 * an entire completion.
 */
export function validateDraft(draft: ServiceUsageDraft): string | null {
  if (!draft.serviceName.trim()) return 'Enter what service was performed.'

  for (const p of draft.productsUsed) {
    const anyFilled = p.name.trim() || p.quantity.trim() || p.unit.trim()
    if (!anyFilled) continue
    if (!p.name.trim()) return 'Every product needs a name.'
    if (!p.unit.trim()) return `Add a unit for “${p.name.trim()}”.`
    const qty = Number(p.quantity)
    if (!p.quantity.trim() || Number.isNaN(qty) || qty <= 0) {
      return `“${p.name.trim()}” needs a quantity greater than zero.`
    }
  }

  return null
}

/** Drops half-filled product rows; `null` when none remain. */
export function draftToInput(draft: ServiceUsageDraft): ServiceUsageInput {
  const products = draft.productsUsed
    .filter(p => p.name.trim() && p.quantity.trim() && p.unit.trim())
    .map<ServiceUsageProduct>(p => ({
      name: p.name.trim(),
      quantity: Number(p.quantity),
      unit: p.unit.trim(),
    }))

  return {
    serviceName: draft.serviceName.trim(),
    serviceDetails: draft.serviceDetails.trim() || null,
    productsUsed: products.length ? products : null,
    notes: draft.notes.trim() || null,
  }
}

/** True when the user filled in nothing worth persisting. */
export function isDraftEmpty(draft: ServiceUsageDraft): boolean {
  return (
    !draft.serviceName.trim() &&
    !draft.serviceDetails.trim() &&
    !draft.notes.trim() &&
    !draft.productsUsed.some(
      p => p.name.trim() || p.quantity.trim() || p.unit.trim(),
    )
  )
}

export function ServiceUsageForm({
  draft,
  onChange,
  disabled = false,
  showNotes = true,
}: {
  draft: ServiceUsageDraft
  onChange: (next: ServiceUsageDraft) => void
  disabled?: boolean
  showNotes?: boolean
}) {
  function update<K extends keyof ServiceUsageDraft>(
    key: K,
    value: ServiceUsageDraft[K],
  ) {
    onChange({ ...draft, [key]: value })
  }

  function setProduct(i: number, patch: Partial<ProductDraft>) {
    update(
      'productsUsed',
      draft.productsUsed.map((p, idx) => (idx === i ? { ...p, ...patch } : p)),
    )
  }

  return (
    <div className="flex flex-col gap-3.5">
      <Input
        label="Service performed"
        value={draft.serviceName}
        onChange={e => update('serviceName', e.target.value)}
        disabled={disabled}
        placeholder="e.g. Haircut + Beard"
      />

      <Textarea
        label="What was done"
        rows={2}
        value={draft.serviceDetails}
        onChange={e => update('serviceDetails', e.target.value)}
        disabled={disabled}
        placeholder="e.g. Scissor cut, fade, beard shaping"
      />

      {/* Products */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-ink-2">Products used</span>
          <button
            type="button"
            disabled={disabled}
            onClick={() => update('productsUsed', [...draft.productsUsed, { ...EMPTY_PRODUCT }])}
            className="text-xs font-medium text-ink-2 hover:text-ink disabled:opacity-50 disabled:hover:text-ink-2 transition-colors"
          >
            + Add product
          </button>
        </div>

        {draft.productsUsed.length === 0 ? (
          <p className="text-xs text-ink-3">
            Optional. Leave empty if nothing was used.
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            {draft.productsUsed.map((p, i) => (
              <div key={i} className="flex items-start gap-2">
                <div className="flex-1 min-w-0">
                  <Input
                    value={p.name}
                    onChange={e => setProduct(i, { name: e.target.value })}
                    disabled={disabled}
                    placeholder="Product"
                  />
                </div>
                <div className="w-20 flex-shrink-0">
                  <Input
                    type="number"
                    min="0"
                    step="any"
                    value={p.quantity}
                    onChange={e => setProduct(i, { quantity: e.target.value })}
                    disabled={disabled}
                    placeholder="Qty"
                  />
                </div>
                <div className="w-20 flex-shrink-0">
                  <Input
                    value={p.unit}
                    onChange={e => setProduct(i, { unit: e.target.value })}
                    disabled={disabled}
                    placeholder="ml"
                  />
                </div>
                <button
                  type="button"
                  aria-label="Remove product"
                  disabled={disabled}
                  onClick={() =>
                    update(
                      'productsUsed',
                      draft.productsUsed.filter((_, idx) => idx !== i),
                    )
                  }
                  className="h-10 w-8 flex-shrink-0 text-ink-3 hover:text-ink disabled:opacity-50 transition-colors"
                >
                  &times;
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {showNotes && (
        <Textarea
          label="Notes"
          rows={2}
          value={draft.notes}
          onChange={e => update('notes', e.target.value)}
          disabled={disabled}
          placeholder="Anything worth remembering for next time"
        />
      )}
    </div>
  )
}
