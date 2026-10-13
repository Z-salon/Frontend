import { useState } from 'react'
import type { ServiceUsage } from '../../types/api'
import { Button, Modal } from '../ui'
import { useToast } from '../ui/Toast'
import { canHaveServiceUsage, useServiceUsages } from '../../hooks/useServiceUsages'
import {
  ServiceUsageForm,
  draftFromUsage,
  draftToInput,
  emptyDraft,
  validateDraft,
  type ServiceUsageDraft,
} from './ServiceUsageForm'

/* ------------------------------------------------------------------ */
/*  Service usage section                                              */
/*                                                                     */
/*  One component for both surfaces that show it — the appointment     */
/*  panel and the customer detail overview — so add / edit / delete     */
/*  behave identically and the confirm dialog isn't duplicated.         */
/* ------------------------------------------------------------------ */

export function ServiceUsageSection({
  businessId,
  appointmentId,
  status,
  serviceName,
  onChanged,
}: {
  businessId: string
  appointmentId: string
  status: string
  /** Booked service name, used to prefill a new entry. */
  serviceName: string
  /** Called after any successful mutation, so callers can refresh. */
  onChanged?: () => void
}) {
  const toast = useToast()
  const usages = useServiceUsages(businessId, appointmentId, status)

  const [adding, setAdding] = useState(false)
  const [editing, setEditing] = useState<ServiceUsage | null>(null)
  const [deleting, setDeleting] = useState<ServiceUsage | null>(null)

  const [draft, setDraft] = useState<ServiceUsageDraft>(emptyDraft())
  const [formError, setFormError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [removing, setRemoving] = useState(false)

  // §6.1 rejects any status outside CHECKED_IN / IN_PROGRESS / COMPLETED,
  // so there is nothing to show and nothing to offer.
  if (!canHaveServiceUsage(status)) return null

  function openAdd() {
    setDraft(emptyDraft(serviceName))
    setFormError(null)
    setAdding(true)
  }

  function openEdit(u: ServiceUsage) {
    setDraft(draftFromUsage(u))
    setFormError(null)
    setEditing(u)
  }

  async function save() {
    const invalid = validateDraft(draft)
    if (invalid) {
      setFormError(invalid)
      return
    }

    setSaving(true)
    setFormError(null)

    // A PATCH accepts any subset; draftToInput sends all four, which is
    // exactly what "the form now says this" means.
    const input = draftToInput(draft)
    const result = editing
      ? await usages.update(editing.id, input)
      : await usages.add(input)

    setSaving(false)

    if (!result) {
      setFormError(
        editing
          ? 'Could not update the service usage. Try again.'
          : 'Could not save the service usage. Try again.',
      )
      return
    }

    toast.success(editing ? 'Service usage updated' : 'Service usage added')
    setAdding(false)
    setEditing(null)
    onChanged?.()
  }

  async function confirmDelete() {
    if (!deleting) return
    setRemoving(true)
    const ok = await usages.remove(deleting.id)
    setRemoving(false)

    if (!ok) {
      toast.error('Could not delete the service usage.')
      setDeleting(null)
      return
    }
    toast.success('Service usage deleted')
    setDeleting(null)
    onChanged?.()
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <p className="text-[10px] font-semibold text-ink-3 uppercase tracking-wider">
          Service usage
        </p>
        <button
          type="button"
          onClick={openAdd}
          className="text-xs font-medium text-ink-2 hover:text-ink transition-colors"
        >
          + Add
        </button>
      </div>

      {usages.loading && <p className="text-sm text-ink-3">Loading…</p>}

      {!usages.loading && usages.usages.length === 0 && (
        <p className="text-sm text-ink-3 leading-relaxed">
          {usages.error ?? 'Nothing recorded for this visit.'}
        </p>
      )}

      <div className="flex flex-col gap-2.5">
        {usages.usages.map(u => (
          <div
            key={u.id}
            className="rounded-xl border border-line px-3.5 py-3 flex flex-col gap-1.5"
          >
            <div className="flex items-start justify-between gap-2">
              <p className="text-sm font-medium text-ink">{u.serviceName}</p>
              <div className="flex items-center gap-3 flex-shrink-0">
                <button
                  type="button"
                  onClick={() => openEdit(u)}
                  className="text-xs font-medium text-ink-2 hover:text-ink transition-colors"
                >
                  Edit
                </button>
                <button
                  type="button"
                  aria-label="Delete service usage"
                  onClick={() => setDeleting(u)}
                  className="text-xs text-ink-3 hover:text-[#B06A6A] transition-colors"
                >
                  Delete
                </button>
              </div>
            </div>

            {u.serviceDetails && (
              <p className="text-[13px] text-ink-2 leading-relaxed">{u.serviceDetails}</p>
            )}

            {u.productsUsed && u.productsUsed.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pt-0.5">
                {u.productsUsed.map((prod, i) => (
                  <span
                    key={`${prod.name}-${i}`}
                    className="inline-flex items-center rounded-full bg-bg px-2.5 py-1 text-[11px] text-ink-2"
                  >
                    {prod.name}
                    <span className="text-ink-3">
                      &nbsp;{prod.quantity}
                      {prod.unit}
                    </span>
                  </span>
                ))}
              </div>
            )}

            {u.notes && (
              <p className="text-[13px] text-ink-3 leading-relaxed pt-0.5">{u.notes}</p>
            )}

            <p className="text-[11px] text-ink-3 pt-0.5">
              {new Date(u.recordedAt).toLocaleString()}
            </p>
          </div>
        ))}
      </div>

      {/* ── Add / edit ─────────────────────────────────────────────── */}
      <Modal
        open={adding || editing !== null}
        onClose={() =>
          !saving &&
          (setAdding(false), setEditing(null), setFormError(null))
        }
        title={editing ? 'Edit service usage' : 'Add service usage'}
        width="max-w-lg"
      >
        <div className="px-6 py-5">
          <ServiceUsageForm
            draft={draft}
            onChange={setDraft}
            disabled={saving}
          />
          {formError && <p className="text-xs text-[#B06A6A] mt-3">{formError}</p>}
        </div>
        <div className="px-6 pb-6 flex gap-3 justify-end border-t border-line pt-4">
          <Button
            variant="ghost"
            onClick={() => {
              setAdding(false)
              setEditing(null)
              setFormError(null)
            }}
            disabled={saving}
          >
            Cancel
          </Button>
          <Button onClick={() => void save()} loading={saving}>
            {editing ? 'Save changes' : 'Add usage'}
          </Button>
        </div>
      </Modal>

      {/* ── Delete confirmation ────────────────────────────────────── */}
      <Modal
        open={deleting !== null}
        onClose={() => !removing && (setDeleting(null), setFormError(null))}
        title="Delete this service usage?"
        width="max-w-md"
      >
        <div className="px-6 py-5 flex flex-col gap-3">
          <div className="rounded-xl border border-[#E4D5D5] bg-[#FBF3F3] px-4 py-3 flex flex-col gap-1">
            <p className="text-sm font-medium text-ink">{deleting?.serviceName}</p>
            {deleting?.serviceDetails && (
              <p className="text-[13px] text-ink-2 leading-relaxed">
                {deleting.serviceDetails}
              </p>
            )}
            {deleting?.productsUsed && deleting.productsUsed.length > 0 && (
              <p className="text-[13px] text-ink-3">
                {deleting.productsUsed
                  .map(p => `${p.name} (${p.quantity}${p.unit})`)
                  .join(', ')}
              </p>
            )}
          </div>

          <p className="text-sm text-ink-2 leading-relaxed">
            This removes the record of what was performed, including the
            products used. It cannot be undone, and it disappears from the
            customer&apos;s service history.
          </p>
        </div>
        <div className="px-6 pb-6 flex gap-3 justify-end border-t border-line pt-4">
          <Button
            variant="ghost"
            onClick={() => setDeleting(null)}
            disabled={removing}
          >
            Keep it
          </Button>
          <Button
            variant="destructive"
            onClick={() => void confirmDelete()}
            loading={removing}
            disabled={removing}
          >
            Delete usage
          </Button>
        </div>
      </Modal>
    </div>
  )
}
