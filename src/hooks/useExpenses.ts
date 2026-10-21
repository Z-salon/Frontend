import { useCallback, useEffect, useRef, useState } from 'react'
import { expensesApi } from '../api/expenses.api'
import type {
  CreateExpenseRequest,
  Expense,
  ExpenseListQuery,
  ExpenseStatus,
  PaginationMeta,
  RecordExpensePaymentRequest,
  UpdateExpenseRequest,
  VoidExpenseRequest,
} from '../types/api'

/* ------------------------------------------------------------------ */
/*  Expense ledger (§5)                                                */
/*                                                                     */
/*  Server-side pagination and filtering: changing a filter or the     */
/*  page re-requests the endpoint rather than hiding loaded rows.      */
/*                                                                     */
/*  Mutations always refetch the current page instead of splicing a    */
/*  row in — a new expense may or may not belong to the active filter,  */
/*  and `status`/`amountPaid` are the server's to recompute.           */
/* ------------------------------------------------------------------ */

export interface ExpensesQuery {
  from?: string
  to?: string
  branchId?: string
  categoryId?: string
  status?: ExpenseStatus
  page?: number
  limit?: number
}

export interface UseExpenses {
  expenses: Expense[]
  meta: PaginationMeta | null
  loading: boolean
  error: string | null
  reload: () => Promise<void>
  create: (input: CreateExpenseRequest) => Promise<Expense>
  update: (id: string, input: UpdateExpenseRequest) => Promise<Expense>
  recordPayment: (id: string, input: RecordExpensePaymentRequest) => Promise<Expense>
  voidExpense: (id: string, input: VoidExpenseRequest) => Promise<Expense>
}

export function useExpenses(
  businessId: string | null | undefined,
  query: ExpensesQuery,
): UseExpenses {
  const {
    from,
    to,
    branchId,
    categoryId,
    status,
    page = 1,
    limit = 20,
  } = query

  const [expenses, setExpenses] = useState<Expense[]>([])
  const [meta, setMeta] = useState<PaginationMeta | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  /* Rapid filter changes can race; only the newest request may commit. */
  const seq = useRef(0)

  const load = useCallback(async () => {
    if (!businessId) {
      setExpenses([])
      setMeta(null)
      return
    }

    const ticket = ++seq.current
    setLoading(true)
    setError(null)
    try {
      const listQuery: ExpenseListQuery = {
        from,
        to,
        branchId,
        categoryId,
        status,
        page,
        limit,
      }
      const res = await expensesApi.list(businessId, listQuery)
      if (ticket !== seq.current) return
      setExpenses(res.data)
      setMeta(res.meta)
    } catch (err) {
      if (ticket !== seq.current) return
      console.error('[expenses] load failed', err)
      setExpenses([])
      setMeta(null)
      setError('Unable to load expenses.')
    } finally {
      if (ticket === seq.current) setLoading(false)
    }
  }, [businessId, from, to, branchId, categoryId, status, page, limit])

  useEffect(() => {
    void load()
  }, [load])

  const create = useCallback(
    async (input: CreateExpenseRequest) => {
      if (!businessId) throw new Error('No business selected.')
      const created = await expensesApi.create(businessId, input)
      await load()
      return created
    },
    [businessId, load],
  )

  const update = useCallback(
    async (id: string, input: UpdateExpenseRequest) => {
      if (!businessId) throw new Error('No business selected.')
      const updated = await expensesApi.update(businessId, id, input)
      await load()
      return updated
    },
    [businessId, load],
  )

  const recordPayment = useCallback(
    async (id: string, input: RecordExpensePaymentRequest) => {
      if (!businessId) throw new Error('No business selected.')
      const updated = await expensesApi.recordPayment(businessId, id, input)
      await load()
      return updated
    },
    [businessId, load],
  )

  const voidExpense = useCallback(
    async (id: string, input: VoidExpenseRequest) => {
      if (!businessId) throw new Error('No business selected.')
      const updated = await expensesApi.void(businessId, id, input)
      await load()
      return updated
    },
    [businessId, load],
  )

  return {
    expenses,
    meta,
    loading,
    error,
    reload: load,
    create,
    update,
    recordPayment,
    voidExpense,
  }
}