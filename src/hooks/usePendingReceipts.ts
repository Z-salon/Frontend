import { useCallback, useEffect, useState } from 'react'
import { receiptsApi } from '../api/receipts.api'
import type { AppointmentReceipt } from '../types/api'

interface PendingReceiptsState {
  items: AppointmentReceipt[]
  loading: boolean
  error: string | null
  /** True when the server refused (403 / not a member). */
  forbidden: boolean
  reload: () => void
}

/**
 * Pending receipts queue (§7.3). Mirrors the shape of the other admin
 * data hooks so the UI code stays consistent across panels.
 *
 * Pass a `branchId` to scope to one branch; omit it for the whole
 * business (the endpoint already returns all pending receipts in
 * that case).
 */
export function usePendingReceipts(
  businessId: string | null | undefined,
  branchId?: string | null,
): PendingReceiptsState {
  const [items, setItems] = useState<AppointmentReceipt[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [forbidden, setForbidden] = useState(false)
  const [attempt, setAttempt] = useState(0)

  const reload = useCallback(() => setAttempt(a => a + 1), [])

  useEffect(() => {
    if (!businessId) return
    let cancelled = false

    setLoading(true)
    setError(null)
    setForbidden(false)

    receiptsApi
      .listPending(businessId, { branchId: branchId ?? undefined })
      .then(list => {
        if (cancelled) return
        setItems(list ?? [])
      })
      .catch(err => {
        if (cancelled) return
        const status = (err as any)?.response?.status ?? (err as any)?.status
        if (status === 403) {
          setForbidden(true)
          setItems([])
          return
        }
        setError(
          extractMessage(err, 'Could not load pending receipts.'),
        )
        setItems([])
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [businessId, branchId, attempt])

  return { items, loading, error, forbidden, reload }
}

function extractMessage(err: unknown, fallback: string): string {
  if (!err) return fallback
  const anyErr = err as any
  const data = anyErr?.response?.data ?? anyErr?.data ?? anyErr
  if (typeof data?.message === 'string' && data.message) return data.message
  if (typeof anyErr?.message === 'string' && anyErr.message) return anyErr.message
  return fallback
}