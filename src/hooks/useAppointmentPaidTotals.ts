import { useCallback, useEffect, useRef, useState } from 'react'
import { appointmentsApi } from '../api/appointments.api'
import type { AppointmentPayment } from '../types/api'

/* ------------------------------------------------------------------ */
/*  Paid totals across many appointments                               */
/*                                                                     */
/*  There is no business-wide payments endpoint (§7.2 only lists        */
/*  payments per appointment), so a list that wants "what was actually  */
/*  paid" has to fan out. FinancePaymentsTab does the same thing.       */
/*                                                                     */
/*  Requests run sequentially in small batches rather than all at once:  */
/*  a customer with a long history would otherwise fire dozens of        */
/*  parallel calls and get rate-limited. Totals are published            */
/*  incrementally so rows fill in as they resolve instead of the whole  */
/*  list blocking on the slowest appointment.                           */
/*                                                                     */
/*  Only pass ids you actually intend to render. Callers should limit   */
/*  this to rows that need the figure.                                 */
/* ------------------------------------------------------------------ */

const BATCH_SIZE = 4

export interface UseAppointmentPaidTotals {
  /** Appointment id → sum of non-voided payments. */
  totals: Record<string, number>
  loading: boolean
  /** Re-run the fan-out. Call after recording or voiding a payment. */
  reload: () => void
}

function unwrapArray<T>(res: unknown): T[] {
  if (Array.isArray(res)) return res as T[]
  const anyRes = res as { data?: { data?: unknown } }
  if (Array.isArray(anyRes?.data?.data)) return anyRes.data.data as T[]
  if (Array.isArray(anyRes?.data)) return anyRes.data as T[]
  return []
}

export function useAppointmentPaidTotals(
  businessId: string | null | undefined,
  appointmentIds: string[],
): UseAppointmentPaidTotals {
  const [totals, setTotals] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(false)
  const [nonce, setNonce] = useState(0)
  const fetchedFor = useRef('')

  const reload = useCallback(() => setNonce(n => n + 1), [])

  // Join into a stable key so an inline array prop doesn't retrigger the
  // effect on every render.
  const key = [...new Set(appointmentIds)].sort().join(',')

  useEffect(() => {
    if (!businessId || !key) {
      fetchedFor.current = ''
      setTotals({})
      setLoading(false)
      return
    }

    const ids = key.split(',')
    let cancelled = false
    const signature = `${businessId}|${key}`

    /* Only wipe the cache when the set of appointments actually changed.
       A manual reload() is usually right after a payment was saved, and
       blanking here would flash the stale quoted price before the fresh
       total lands. */
    if (fetchedFor.current !== signature) {
      fetchedFor.current = signature
      setTotals({})
    }
    setLoading(true)

    void (async () => {
      for (let i = 0; i < ids.length; i += BATCH_SIZE) {
        if (cancelled) return
        const batch = ids.slice(i, i + BATCH_SIZE)

        // Settled rather than all-or-nothing: one 404 shouldn't blank out
        // the totals that already resolved.
        const results = await Promise.all(
          batch.map(async id => {
            try {
              const res = await appointmentsApi.listPayments(businessId, id)
              const rows = unwrapArray<AppointmentPayment>(res)
              const sum = rows
                .filter(p => p.status !== 'VOIDED')
                .reduce((acc, p) => acc + (Number(p.amount) || 0), 0)
              return [id, sum] as const
            } catch {
              return [id, null] as const
            }
          }),
        )

        if (cancelled) return
        setTotals(prev => {
          const next = { ...prev }
          for (const [id, sum] of results) {
            if (sum !== null) next[id] = sum
          }
          return next
        })
      }
      if (!cancelled) setLoading(false)
    })()

    return () => { cancelled = true }
  }, [businessId, key, nonce])

  return { totals, loading, reload }
}
