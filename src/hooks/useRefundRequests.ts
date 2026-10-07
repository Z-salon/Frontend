import { useCallback, useEffect, useRef, useState } from 'react'
import { refundsApi } from '../api/refunds.api'
import { appointmentsApi } from '../api/appointments.api'
import type {
  AppointmentFinancials,
  AppointmentListResult,
  AppointmentPayment,
  PaginationMeta,
  RefundRequest,
  RefundRequestStatus,
} from '../types/api'

/* ------------------------------------------------------------------ */
/*  Refund request resources (§8)                                      */
/*                                                                     */
/*  No React Query in this project, so each resource gets the same     */
/*  small fetch/abort/race contract used by the expense ledger. Every  */
/*  filter value is part of the fetch key: changing it re-requests.    */
/*  Mutations are exposed by `refundsApi`; callers refetch via the     */
/*  returned `reload` so the UI reflects the server's new state.       */
/* ------------------------------------------------------------------ */

export interface RefundRequestsResource {
  requests: RefundRequest[]
  meta: PaginationMeta | null
  loading: boolean
  error: string | null
  reload: () => Promise<void>
}

export interface AsyncResource<T> {
  data: T | null
  loading: boolean
  error: string | null
  reload: () => Promise<void>
}

/**
 * Shared loader. `key` is falsy when there is nothing to fetch (no
 * business / no selected appointment), in which case the resource is
 * reset. `deps` are the filter values that must re-trigger a fetch.
 */
function useAsyncResource<T>(
  key: string | null | undefined,
  fallbackError: string,
  fetcher: () => Promise<T>,
  deps: ReadonlyArray<unknown>,
): AsyncResource<T> {
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  /* Rapid key changes can race; only the newest request may commit. */
  const seq = useRef(0)
  const fetcherRef = useRef(fetcher)
  fetcherRef.current = fetcher

  const load = useCallback(async () => {
    if (!key) {
      setData(null)
      setError(null)
      setLoading(false)
      return
    }

    const ticket = ++seq.current
    setLoading(true)
    setError(null)
    try {
      const res = await fetcherRef.current()
      if (ticket !== seq.current) return
      setData(res)
    } catch (err) {
      if (ticket !== seq.current) return
      console.error('[refunds] load failed', err)
      setData(null)
      setError(fallbackError)
    } finally {
      if (ticket === seq.current) setLoading(false)
    }
    // `deps` is a fixed-length list per caller.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, fallbackError, ...deps])

  useEffect(() => {
    void load()
  }, [load])

  return { data, loading, error, reload: load }
}

export function useRefundRequests(
  businessId: string | null | undefined,
  query: { status?: RefundRequestStatus; page?: number; limit?: number },
): RefundRequestsResource {
  const { status, page = 1, limit = 20 } = query

  const [requests, setRequests] = useState<RefundRequest[]>([])
  const [meta, setMeta] = useState<PaginationMeta | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const seq = useRef(0)

  const load = useCallback(async () => {
    if (!businessId) {
      setRequests([])
      setMeta(null)
      setLoading(false)
      setError(null)
      return
    }

    const ticket = ++seq.current
    setLoading(true)
    setError(null)
    try {
      const res = await refundsApi.list(businessId, { status, page, limit })
      if (ticket !== seq.current) return
      setRequests(res.data)
      setMeta(res.meta)
    } catch (err) {
      if (ticket !== seq.current) return
      console.error('[refunds] list failed', err)
      setRequests([])
      setMeta(null)
      setError('Unable to load refund requests.')
    } finally {
      if (ticket === seq.current) setLoading(false)
    }
  }, [businessId, status, page, limit])

  useEffect(() => {
    void load()
  }, [load])

  return { requests, meta, loading, error, reload: load }
}

export function useRefundRequest(
  businessId: string | null | undefined,
  refundRequestId: string | null | undefined,
): AsyncResource<RefundRequest> {
  return useAsyncResource(
    businessId && refundRequestId ? `${businessId}:${refundRequestId}` : null,
    'Unable to load this refund request.',
    () => refundsApi.get(businessId as string, refundRequestId as string),
    [businessId, refundRequestId],
  )
}

/**
 * The money figures for an appointment, from the canonical appointment
 * financials endpoint. The server owns every amount (`refundable` is the
 * refund ceiling); the client never derives them.
 */
export function useAppointmentFinancials(
  businessId: string | null | undefined,
  appointmentId: string | null | undefined,
): AsyncResource<AppointmentFinancials> {
  return useAsyncResource(
    businessId && appointmentId ? `${businessId}:${appointmentId}` : null,
    'Unable to load the appointment financials.',
    () => appointmentsApi.financials(businessId as string, appointmentId as string),
    [businessId, appointmentId],
  )
}

/** Payments recorded against an appointment, for the refund payment picker. */
export function useRefundAppointmentPayments(
  businessId: string | null | undefined,
  appointmentId: string | null | undefined,
): AsyncResource<AppointmentPayment[]> {
  return useAsyncResource(
    businessId && appointmentId ? `${businessId}:${appointmentId}` : null,
    'Unable to load appointment payments.',
    () => appointmentsApi.listPayments(businessId as string, appointmentId as string),
    [businessId, appointmentId],
  )
}

/**
 * Appointments available to pick from when creating a refund.
 *
 * There is no "eligible appointments" endpoint in the contract, so this
 * reuses the existing appointments list. `branchId` narrows the list; it
 * is never used to invent eligibility.
 */
export function useRefundAppointments(
  businessId: string | null | undefined,
  branchId: string | null | undefined,
): AsyncResource<AppointmentListResult> {
  return useAsyncResource(
    businessId ?? null,
    'Unable to load appointments.',
    () =>
      appointmentsApi.list(businessId as string, {
        branchId: branchId || undefined,
        limit: 100,
        page: 1,
      }),
    [businessId, branchId],
  )
}