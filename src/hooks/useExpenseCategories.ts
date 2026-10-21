import { useCallback, useEffect, useRef, useState } from 'react'
import { expenseCategoriesApi } from '../api/expense-categories.api'
import type {
  CreateExpenseCategoryRequest,
  ExpenseCategory,
  UpdateExpenseCategoryRequest,
} from '../types/api'

/* ------------------------------------------------------------------ */
/*  Expense categories                                                 */
/*                                                                     */
/*  Replaces the local-only category editor that used to mint ids like  */
/*  `ec${Date.now()}` and hand the result to App-level state — nothing */
/*  ever reached the server, so every expense saved against those       */
/*  names was writing fiction. The backend is now the only writer.     */
/*                                                                     */
/*  Two things the UI gets from the API rather than inventing:         */
/*    · `isActive` is the status. There is no separate flag to keep in  */
/*      sync, and no DELETE — toggling calls PATCH with `isActive`.     */
/*    · inactive rows only exist in a response that asked for them, so */
/*      flipping "show inactive" re-requests with includeInactive=true. */
/* ------------------------------------------------------------------ */

export interface UseExpenseCategories {
  categories: ExpenseCategory[]
  loading: boolean
  error: string | null
  reload: () => Promise<void>
  create: (input: CreateExpenseCategoryRequest) => Promise<ExpenseCategory>
  update: (id: string, patch: UpdateExpenseCategoryRequest) => Promise<ExpenseCategory>
  setActive: (id: string, isActive: boolean) => Promise<ExpenseCategory>
}

export function useExpenseCategories(
  businessId: string | null | undefined,
  options?: { includeInactive?: boolean },
): UseExpenseCategories {
  const includeInactive = options?.includeInactive ?? false
  const [categories, setCategories] = useState<ExpenseCategory[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  /* Toggling "show inactive" re-runs `load`; without a ticket an older
     response could land last and repopulate the list it no longer matches. */
  const seq = useRef(0)

  const load = useCallback(async () => {
    if (!businessId) {
      setCategories([])
      return
    }

    const ticket = ++seq.current
    setLoading(true)
    setError(null)
    try {
      const res = await expenseCategoriesApi.list(
        businessId,
        // Omitted entirely when off, so the default request is the plain
        // active-only one rather than `includeInactive=false`.
        includeInactive ? { includeInactive: true } : undefined,
      )
      if (ticket !== seq.current) return
      setCategories(Array.isArray(res) ? res : [])
    } catch (err) {
      if (ticket !== seq.current) return
      console.error('[expense-categories] load failed', err)
      setError('Unable to load expense categories. Please try again.')
    } finally {
      if (ticket === seq.current) setLoading(false)
    }
  }, [businessId, includeInactive])

  useEffect(() => {
    void load()
  }, [load])

  /**
   * Folds a server response back into the visible list. The server owns the
   * ordering, so an edited record keeps its slot and a new one is appended;
   * a record that just went inactive leaves an active-only list entirely,
   * because that list must stay exactly what the endpoint would return.
   */
  const applyServerRecord = useCallback(
    (next: ExpenseCategory) => {
      setCategories(prev => {
        const index = prev.findIndex(c => c.id === next.id)
        const visible = includeInactive || next.isActive
        if (index === -1) return visible ? [...prev, next] : prev
        const copy = [...prev]
        if (!visible) return copy.filter(c => c.id !== next.id)
        copy[index] = next
        return copy
      })
    },
    [includeInactive],
  )

  const create = useCallback(
    async (input: CreateExpenseCategoryRequest) => {
      if (!businessId) throw new Error('No business selected.')
      const created = await expenseCategoriesApi.create(businessId, input)
      applyServerRecord(created)
      return created
    },
    [businessId, applyServerRecord],
  )

  const update = useCallback(
    async (id: string, patch: UpdateExpenseCategoryRequest) => {
      if (!businessId) throw new Error('No business selected.')
      const updated = await expenseCategoriesApi.update(businessId, id, patch)
      applyServerRecord(updated)
      return updated
    },
    [businessId, applyServerRecord],
  )

  const setActive = useCallback(
    (id: string, isActive: boolean) => update(id, { isActive }),
    [update],
  )

  return { categories, loading, error, reload: load, create, update, setActive }
}