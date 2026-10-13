import { useCallback, useEffect, useState } from 'react'
import { serviceCategoriesApi } from '../api/service-categories.api'
import type { SampleWork, SampleWorkInput, UpdateSampleWorkInput } from '../types/api'
import { extractErrorMessage } from '../customer/utils/format'

/* ------------------------------------------------------------------ */
/*  Category sample works (§8.6)                                        */
/*                                                                     */
/*  Portfolio items attached to a service category. The API wrapper      */
/*  already had `create` + `remove`; nothing called them and the read / */
/*  update endpoints weren't wrapped at all, so the storefront had no   */
/*  way to attach photos.                                                 */
/*                                                                     */
/*  Permissions are asymmetric and enforced server-side:                */
/*    · read  → any active member, but a BRANCH_MANAGER is scoped to     */
/*      categories active in their own branches, which 403s rather than  */
/*      returning an empty list. `forbidden` separates that from a        */
/*      genuinely empty category so the UI doesn't claim "no work yet".  */
/*    · write → OWNER/ADMIN only (`verifyOwnerOrAdmin`).                  */
/*                                                                     */
/*  Writes update local state from the server's response rather than     */
/*  refetching, so a save reflects instantly.                             */
/* ------------------------------------------------------------------ */

export interface UseCategorySampleWorks {
  items: SampleWork[]
  loading: boolean
  error: string | null
  /** True when the read was rejected on permissions, not merely empty. */
  forbidden: boolean
  reload: () => Promise<void>
  create: (input: SampleWorkInput) => Promise<SampleWork>
  update: (id: string, patch: UpdateSampleWorkInput) => Promise<SampleWork>
  remove: (id: string) => Promise<void>
}

function statusOf(err: unknown): number | undefined {
  const anyErr = err as {
    status?: number
    response?: { status?: number }
    data?: { status?: number }
  }
  return anyErr?.status ?? anyErr?.response?.status ?? anyErr?.data?.status
}

export function useCategorySampleWorks(
  categoryId: string | null | undefined,
): UseCategorySampleWorks {
  const [items, setItems] = useState<SampleWork[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [forbidden, setForbidden] = useState(false)

  const load = useCallback(async () => {
    if (!categoryId) {
      setItems([])
      setForbidden(false)
      return
    }
    setLoading(true)
    setError(null)
    try {
      const res = await serviceCategoriesApi.sampleWorks.list(categoryId)
      setItems(Array.isArray(res) ? res : [])
      setForbidden(false)
    } catch (err) {
      setForbidden(statusOf(err) === 403)
      setError(
        extractErrorMessage(err, 'Could not load sample work for this category.'),
      )
    } finally {
      setLoading(false)
    }
  }, [categoryId])

  useEffect(() => {
    void load()
  }, [load])

  const create = useCallback(
    async (input: SampleWorkInput) => {
      if (!categoryId) throw new Error('No category selected.')
      const created = await serviceCategoriesApi.sampleWorks.create(categoryId, input)
      /* Server orders by createdAt desc, so a new item belongs at the top.
         Putting it there locally avoids a refetch flash after saving. */
      setItems(prev => [created, ...prev])
      return created
    },
    [categoryId],
  )

  const update = useCallback(async (id: string, patch: UpdateSampleWorkInput) => {
    const updated = await serviceCategoriesApi.sampleWorks.update(id, patch)
    setItems(prev => prev.map(w => (w.id === id ? updated : w)))
    return updated
  }, [])

  const remove = useCallback(async (id: string) => {
    await serviceCategoriesApi.sampleWorks.remove(id)
    setItems(prev => prev.filter(w => w.id !== id))
  }, [])

  return { items, loading, error, forbidden, reload: load, create, update, remove }
}
