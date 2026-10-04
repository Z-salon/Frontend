// src/components/settings/SampleWorkSettings.tsx
//
// Category Sample Work (§8.6) — portfolio photos attached to a service
// category, surfaced on the storefront Landing page.

import { useEffect, useMemo, useState } from 'react'
import { Button, Input, Modal, Select, Textarea } from '../ui'
import { ImageUploader } from '../ui/ImageUploader'
import { useBusiness } from '../../contexts/BusinessContext'
import { useCategorySampleWorks } from '../../hooks/useCategorySampleWorks'
import { serviceCategoriesApi } from '../../api/service-categories.api'
import { extractErrorMessage } from '../../customer/utils/format'
import type { SampleWork, ServiceCategory } from '../../types/api'

const NAME_MAX = 250
const DESC_MAX = 1000

interface FormState {
  name: string
  description: string
  url: string
  publicId: string
  /* Which asset was on the record when the edit form opened, so we can warn
     about the one the server will NOT clean up for us. */
  originalPublicId: string
}

const EMPTY_FORM: FormState = {
  name: '',
  description: '',
  url: '',
  publicId: '',
  originalPublicId: '',
}

/** Accepts only http(s) so a stray `javascript:` can't land in an <img src>. */
function isHttpUrl(value: string): boolean {
  try {
    const u = new URL(value)
    return u.protocol === 'http:' || u.protocol === 'https:'
  } catch {
    return false
  }
}

export function SampleWorkSettings({ businessId }: { businessId: string }) {
  const { isAdminOrOwner } = useBusiness()

  const [categories, setCategories] = useState<ServiceCategory[]>([])
  const [categoriesError, setCategoriesError] = useState<string | null>(null)
  const [activeCategoryId, setActiveCategoryId] = useState('')

  const { items, loading, error, forbidden, reload, create, update, remove } =
    useCategorySampleWorks(activeCategoryId)

  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<SampleWork | null>(null)
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  const [pendingDelete, setPendingDelete] = useState<SampleWork | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  const folder = businessId ? `business/${businessId}/sample-work` : 'business/unknown/sample-work'

  /* ── Categories ─────────────────────────────────────────────────── */

  useEffect(() => {
    if (!businessId) return
    let cancelled = false
    void (async () => {
      try {
        // Inactive categories keep their sample work, so they must be
        // listable here — a draft category still needs photos attached.
        const res = await serviceCategoriesApi.list(businessId, {
          includeInactive: true,
        })
        if (cancelled) return
        const list = Array.isArray(res) ? res : []
        setCategories(list)
        setCategoriesError(null)
        setActiveCategoryId(cur => cur || list[0]?.id || '')
      } catch (err) {
        if (cancelled) return
        setCategoriesError(
          extractErrorMessage(err, 'Could not load service categories.'),
        )
      }
    })()
    return () => {
      cancelled = true
    }
  }, [businessId])

  const activeCategory = useMemo(
    () => categories.find(c => c.id === activeCategoryId) ?? null,
    [categories, activeCategoryId],
  )

  /* ── Form ───────────────────────────────────────────────────────── */

  function openCreate() {
    setEditing(null)
    setForm(EMPTY_FORM)
    setFormError(null)
    setFormOpen(true)
  }

  function openEdit(item: SampleWork) {
    setEditing(item)
    setForm({
      name: item.name,
      description: item.description ?? '',
      url: item.url,
      publicId: item.publicId,
      originalPublicId: item.publicId,
    })
    setFormError(null)
    setFormOpen(true)
  }

  function setField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm(f => ({ ...f, [key]: value }))
  }

  function validate(): string | null {
    const name = form.name.trim()
    if (!name) return 'Name is required.'
    if (name.length > NAME_MAX) return `Name must be ${NAME_MAX} characters or fewer.`
    if (!form.url.trim()) return 'Add an image, or paste an image URL.'
    if (!isHttpUrl(form.url.trim())) return 'That image URL is not valid.'
    // Required by the create schema, and the only handle `remove` uses to
    // delete the stored asset.
    if (!form.publicId.trim()) return 'Public ID is required.'
    if (form.description.length > DESC_MAX)
      return `Description must be ${DESC_MAX} characters or fewer.`
    return null
  }

  async function save() {
    const invalid = validate()
    if (invalid) {
      setFormError(invalid)
      return
    }
    if (!activeCategoryId) return

    setSaving(true)
    setFormError(null)
    try {
      const common = {
        name: form.name.trim(),
        url: form.url.trim(),
        publicId: form.publicId.trim(),
      }
      const description = form.description.trim()

      if (editing) {
        // `null` clears the description; omitting the key would leave the
        // stored value untouched, so an emptied box has to send null.
        await update(editing.id, {
          ...common,
          description: description || null,
        })
      } else {
        // Create takes `string | undefined`, never null — so an empty box
        // omits the field instead of storing "".
        await create(description ? { ...common, description } : common)
      }

      setFormOpen(false)
      setEditing(null)
    } catch (err) {
      setFormError(extractErrorMessage(err, 'Could not save this sample work.'))
    } finally {
      setSaving(false)
    }
  }

  async function confirmDelete() {
    if (!pendingDelete) return
    setDeleting(true)
    setDeleteError(null)
    try {
      await remove(pendingDelete.id)
      setPendingDelete(null)
    } catch (err) {
      setDeleteError(extractErrorMessage(err, 'Could not remove this sample work.'))
    } finally {
      setDeleting(false)
    }
  }

  /* ── Render ─────────────────────────────────────────────────────── */

  if (!businessId) return null

  const replacingImage =
    editing !== null &&
    form.publicId.trim() !== '' &&
    form.publicId.trim() !== form.originalPublicId

  return (
    <section className="bg-surface rounded-2xl border border-line p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-display text-lg text-ink">Sample work</h3>
          <p className="text-sm text-ink-3 mt-1 max-w-xl">
            Portfolio photos shown on your storefront, grouped by service
            category. The first photo of a category becomes its cover.
          </p>
        </div>
        {isAdminOrOwner && (
          <Button size="sm" onClick={openCreate} disabled={!activeCategoryId}>
            Add sample work
          </Button>
        )}
      </div>

      {!isAdminOrOwner && (
        <p className="text-xs text-ink-3 mt-3">
          Only owners and admins can add or remove sample work.
        </p>
      )}

      {categoriesError && (
        <p className="text-sm text-[#B06A6A] mt-4">{categoriesError}</p>
      )}

      {categories.length === 0 && !categoriesError && (
        <p className="text-sm text-ink-3 mt-4">
          No service categories yet. Create one first — sample work always
          belongs to a category.
        </p>
      )}

      {categories.length > 0 && (
        <div className="mt-5 flex flex-col gap-1.5 max-w-sm">
          <Select
            label="Service category"
            value={activeCategoryId}
            onChange={e => setActiveCategoryId(e.target.value)}
          >
            {categories.map(c => (
              <option key={c.id} value={c.id}>
                {c.name}
                {c.status !== 'ACTIVE' ? ' (inactive)' : ''}
              </option>
            ))}
          </Select>
        </div>
      )}

      {activeCategory?.status !== 'ACTIVE' && activeCategory && (
        <p className="text-xs text-[#B06A6A] mt-3">
          {activeCategory.name} is inactive, so this sample work stays hidden
          from your storefront until the category is active again.
        </p>
      )}

      {activeCategoryId && (
        <div className="mt-5">
          {loading && (
            <p className="text-sm text-ink-3">Loading sample work…</p>
          )}

          {!loading && forbidden && (
            <p className="text-sm text-ink-3">
              You don't have access to sample work for this category.
            </p>
          )}

          {!loading && !forbidden && error && (
            <div className="flex flex-wrap items-center gap-3">
              <p className="text-sm text-[#B06A6A]">{error}</p>
              <Button size="sm" variant="ghost" onClick={() => void reload()}>
                Retry
              </Button>
            </div>
          )}

          {!loading && !forbidden && !error && items.length === 0 && (
            <p className="text-sm text-ink-3">
              No sample work for {activeCategory?.name ?? 'this category'} yet.
            </p>
          )}

          {!loading && !forbidden && items.length > 0 && (
            <ul className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {items.map(item => (
                <li
                  key={item.id}
                  className="rounded-xl border border-line overflow-hidden bg-bg flex flex-col"
                >
                  <div className="aspect-square bg-line/40 overflow-hidden">
                    <img
                      src={item.url}
                      alt={item.name}
                      loading="lazy"
                      className="w-full h-full object-cover"
                      onError={e => {
                        // A dead CDN link shouldn't leave a broken-image glyph.
                        e.currentTarget.style.visibility = 'hidden'
                      }}
                    />
                  </div>
                  <div className="p-2.5 flex flex-col gap-1 flex-1">
                    <p className="text-xs font-medium text-ink line-clamp-2">
                      {item.name}
                    </p>
                    {item.description && (
                      <p className="text-[11px] text-ink-3 line-clamp-2">
                        {item.description}
                      </p>
                    )}
                    {isAdminOrOwner && (
                      <div className="flex items-center gap-2 mt-auto pt-1.5">
                        <button
                          onClick={() => openEdit(item)}
                          className="text-[11px] text-ink-3 hover:text-ink transition-colors"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => {
                            setDeleteError(null)
                            setPendingDelete(item)
                          }}
                          className="text-[11px] text-[#B06A6A] hover:text-[#8F5151] transition-colors"
                        >
                          Remove
                        </button>
                      </div>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* ── Add / edit ──────────────────────────────────────────────── */}
      <Modal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title={editing ? 'Edit sample work' : 'Add sample work'}
        width="max-w-xl"
      >
        <div className="px-6 py-5 flex flex-col gap-4">
          {activeCategory && (
            <p className="text-xs text-ink-3">
              Adding to <span className="text-ink-2">{activeCategory.name}</span>
            </p>
          )}

          <ImageUploader
            label="Image"
            hint="PNG, JPG or WEBP, up to 2 MB"
            aspect="square"
            value={form.url}
            folder={folder}
            onChange={asset =>
              setForm(f => ({
                ...f,
                url: asset.imageUrl,
                publicId: asset.publicId,
              }))
            }
            onRemove={() => setForm(f => ({ ...f, url: '', publicId: '' }))}
          />

          <Input
            label="Name"
            value={form.name}
            maxLength={NAME_MAX}
            placeholder="Bridal look — May 2026"
            onChange={e => setField('name', e.target.value)}
          />

          <Textarea
            label="Description"
            rows={3}
            value={form.description}
            maxLength={DESC_MAX}
            placeholder="Soft glam with gold accents"
            onChange={e => setField('description', e.target.value)}
          />

          {/* Manual escape hatch — the schema demands a publicId even for a
              linked image, and that value is what `remove` deletes by. */}
          <details className="text-xs text-ink-3">
            <summary className="cursor-pointer hover:text-ink-2 transition-colors">
              Using a link instead of uploading?
            </summary>
            <div className="flex flex-col gap-3 mt-3">
              <Input
                label="Image URL"
                value={form.url}
                placeholder="https://cdn.example.com/photo.jpg"
                onChange={e => {
                  const url = e.target.value
                  /* Pairing a hand-typed URL with an uploaded file's publicId
                     would point deletion at the wrong asset, so clear it and
                     make the user supply the matching handle. */
                  setForm(f => ({ ...f, url, publicId: '' }))
                }}
              />
              <Input
                label="Public ID"
                hint="Storage handle. Required by the API, and what deleting this item cleans up."
                value={form.publicId}
                onChange={e => setField('publicId', e.target.value)}
              />
            </div>
          </details>

          {replacingImage && (
            <p className="text-xs text-[#B06A6A]">
              Replacing the image leaves the previous file in storage — the API
              only deletes the old asset on removal, not on update.
            </p>
          )}

          {formError && <p className="text-sm text-[#B06A6A]">{formError}</p>}

          <div className="flex items-center justify-end gap-2 pt-1">
            <Button variant="ghost" onClick={() => setFormOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => void save()} loading={saving}>
              {editing ? 'Save changes' : 'Add sample work'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* ── Delete confirmation ─────────────────────────────────────── */}
      <Modal
        open={pendingDelete !== null}
        onClose={() => setPendingDelete(null)}
        title="Remove sample work"
      >
        <div className="px-6 py-5 flex flex-col gap-4">
          <p className="text-sm text-ink-2">
            Remove <span className="font-medium text-ink">{pendingDelete?.name}</span>?
            The stored image is deleted with it, so this can't be undone.
          </p>
          {deleteError && <p className="text-sm text-[#B06A6A]">{deleteError}</p>}
          <div className="flex items-center justify-end gap-2">
            <Button variant="ghost" onClick={() => setPendingDelete(null)}>
              Cancel
            </Button>
            <Button onClick={() => void confirmDelete()} loading={deleting}>
              Remove
            </Button>
          </div>
        </div>
      </Modal>
    </section>
  )
}
