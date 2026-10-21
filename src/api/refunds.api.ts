import { http } from './http'
import type {
  CompleteRefundRequestInput,
  CreateRefundRequestInput,
  RefundRequest,
  RefundRequestListQuery,
  RefundRequestListResult,
  RejectRefundRequestInput,
} from '../types/api'

/* ------------------------------------------------------------------ */
/*  Refund requests (§8)                                              */
/*                                                                     */
/*  The operational refund queue. This is deliberately separate from   */
/*  `financeApi.refunds`, which is read-only reporting/analytics.      */
/*  No fetch calls live in components — every call goes through here.  */
/* ------------------------------------------------------------------ */

function path(businessId: string): string {
  return `/businesses/${businessId}/refund-requests`
}

export const refundsApi = {
  /**
   * `GET /businesses/:businessId/refund-requests`
   *
   * Server-side pagination. `meta` is the backend's; the list is never
   * paginated in memory.
   */
  list: async (
    businessId: string,
    query: RefundRequestListQuery = {},
  ): Promise<RefundRequestListResult> => {
    const envelope = await http.getEnvelope<RefundRequest[]>(
      path(businessId),
      {
        query: {
          status: query.status,
          page: query.page,
          limit: query.limit,
        },
      },
    )

    const payload = envelope?.data as unknown
    const data: RefundRequest[] = Array.isArray(payload)
      ? (payload as RefundRequest[])
      : Array.isArray((payload as { data?: unknown } | null | undefined)?.data)
        ? ((payload as { data: RefundRequest[] }).data)
        : []

    return {
      data,
      meta: envelope?.meta ?? null,
    }
  },

  /** `GET /businesses/:businessId/refund-requests/:refundRequestId` */
  get: (businessId: string, refundRequestId: string) =>
    http.get<RefundRequest>(`${path(businessId)}/${refundRequestId}`),

  /** `POST /businesses/:businessId/refund-requests` */
  create: (businessId: string, input: CreateRefundRequestInput) =>
    http.post<RefundRequest>(path(businessId), input),

  /** `POST /businesses/:businessId/refund-requests/:id/approve` — no body. */
  approve: (businessId: string, refundRequestId: string) =>
    http.post<RefundRequest>(`${path(businessId)}/${refundRequestId}/approve`),

  /** `POST /businesses/:businessId/refund-requests/:id/reject` */
  reject: (
    businessId: string,
    refundRequestId: string,
    input: RejectRefundRequestInput,
  ) =>
    http.post<RefundRequest>(
      `${path(businessId)}/${refundRequestId}/reject`,
      input,
    ),

  /** `POST /businesses/:businessId/refund-requests/:id/complete` */
  complete: (
    businessId: string,
    refundRequestId: string,
    input: CompleteRefundRequestInput,
  ) =>
    http.post<RefundRequest>(
      `${path(businessId)}/${refundRequestId}/complete`,
      input,
    ),
}

export default refundsApi