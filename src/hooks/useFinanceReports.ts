import { useCallback, useEffect, useRef, useState } from 'react'
import { financeApi } from '../api/finance.api'
import type {
  FinanceCollectionReport,
  FinanceExpenseReport,
  FinanceOutstandingQuery,
  FinanceOutstandingReport,
  FinanceRefundReport,
  FinanceReportQuery,
  FinanceRevenueReport,
  FinanceSummaryReport,
} from '../types/api'

/* ------------------------------------------------------------------ */
/*  Finance reporting resources                                        */
/*                                                                     */
/*  The project has no React Query, so each report gets the same small */
/*  fetch/abort/retry contract used by the expense ledger. Query keys  */
/*  are the hook arguments themselves: changing a filter re-runs the   */
/*  request rather than reusing a stale response.                      */
/* ------------------------------------------------------------------ */

export interface FinanceResource<T> {
  data: T | null
  loading: boolean
  error: string | null
  reload: () => void
}

/**
 * Shared loader. `deps` are the filter values that must re-trigger a fetch;
 * `fetcher` is held in a ref so callers can pass an inline closure without
 * causing extra requests.
 */
function useFinanceResource<T>(
  businessId: string | null | undefined,
  fallbackError: string,
  fetcher: (businessId: string) => Promise<T>,
  deps: ReadonlyArray<unknown>,
): FinanceResource<T> {
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  /* Rapid filter changes can race; only the newest request may commit. */
  const seq = useRef(0)
  const fetcherRef = useRef(fetcher)
  fetcherRef.current = fetcher

  const load = useCallback(async () => {
    if (!businessId) {
      setData(null)
      setError(null)
      setLoading(false)
      return
    }

    const ticket = ++seq.current
    setLoading(true)
    setError(null)
    try {
      const res = await fetcherRef.current(businessId)
      if (ticket !== seq.current) return
      setData(res)
    } catch (err) {
      if (ticket !== seq.current) return
      console.error('[finance] load failed', err)
      setData(null)
      setError(fallbackError)
    } finally {
      if (ticket === seq.current) setLoading(false)
    }
    // `deps` is a fixed-length list per caller; spread keeps them as the
    // invalidation key without a lint rule to satisfy.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [businessId, fallbackError, ...deps])

  useEffect(() => {
    void load()
  }, [load])

  return { data, loading, error, reload: load }
}

export function useFinanceSummary(
  businessId: string | null | undefined,
  query: FinanceReportQuery,
): FinanceResource<FinanceSummaryReport> {
  const { from, to, branchId } = query
  return useFinanceResource(
    businessId,
    'Unable to load the financial summary.',
    bid => financeApi.summary(bid, { from, to, branchId }),
    [from, to, branchId],
  )
}

export function useFinanceRevenue(
  businessId: string | null | undefined,
  query: FinanceReportQuery,
): FinanceResource<FinanceRevenueReport> {
  const { from, to, branchId } = query
  return useFinanceResource(
    businessId,
    'Unable to load the revenue report.',
    bid => financeApi.revenue(bid, { from, to, branchId }),
    [from, to, branchId],
  )
}

export function useFinanceCollections(
  businessId: string | null | undefined,
  query: FinanceReportQuery,
): FinanceResource<FinanceCollectionReport> {
  const { from, to, branchId } = query
  return useFinanceResource(
    businessId,
    'Unable to load the collection report.',
    bid => financeApi.collections(bid, { from, to, branchId }),
    [from, to, branchId],
  )
}

export function useFinanceRefunds(
  businessId: string | null | undefined,
  query: FinanceReportQuery,
): FinanceResource<FinanceRefundReport> {
  const { from, to, branchId } = query
  return useFinanceResource(
    businessId,
    'Unable to load the refund report.',
    bid => financeApi.refunds(bid, { from, to, branchId }),
    [from, to, branchId],
  )
}

export function useFinanceExpenseReport(
  businessId: string | null | undefined,
  query: FinanceReportQuery,
): FinanceResource<FinanceExpenseReport> {
  const { from, to, branchId } = query
  return useFinanceResource(
    businessId,
    'Unable to load the expense report.',
    bid => financeApi.expenses(bid, { from, to, branchId }),
    [from, to, branchId],
  )
}

export function useFinanceOutstanding(
  businessId: string | null | undefined,
  query: FinanceOutstandingQuery,
): FinanceResource<FinanceOutstandingReport> {
  const { branchId, page = 1, limit = 20 } = query
  return useFinanceResource(
    businessId,
    'Unable to load outstanding balances.',
    bid => financeApi.outstanding(bid, { branchId, page, limit }),
    [branchId, page, limit],
  )
}