import { http } from './http'
import type {
  AppointmentReceipt,
  ReceiptStatus,
} from '../types/api'

/* ------------------------------------------------------------------ */
/*  Input types                                                        */
/* ------------------------------------------------------------------ */

export interface VerifyReceiptInput {
  action: 'APPROVE' | 'REJECT'
  /** Required (and only meaningful) for APPROVE. Defaults to the
   *  submitted amount server-side when omitted. */
  verifiedAmount?: number
  /** Required (and only meaningful) for REJECT. */
  rejectionReason?: string
}

export interface PendingReceiptsQuery {
  branchId?: string
}

/* ------------------------------------------------------------------ */
/*  API                                                                */
/* ------------------------------------------------------------------ */

export const receiptsApi = {
  /**
   * §7.3 — Queue of receipts awaiting review.
   * Auth: Bearer + membership. Optional `branchId` narrows to one branch.
   */
  listPending: (businessId: string, query?: PendingReceiptsQuery) => {
    const qs = new URLSearchParams()
    if (query?.branchId) qs.set('branchId', query.branchId)
    const suffix = qs.toString() ? `?${qs.toString()}` : ''
    return http.get<AppointmentReceipt[]>(
      `/businesses/${businessId}/receipts/pending${suffix}`,
    )
  },

  /**
   * §7.3 — Receipt for one appointment, regardless of status.
   * 404 when the appointment has no receipt.
   */
  getForAppointment: (businessId: string, appointmentId: string) =>
    http.get<AppointmentReceipt>(
      `/businesses/${businessId}/appointments/${appointmentId}/receipt`,
    ),

  /**
   * §7.3 — Approve or reject.
   *  - APPROVE: creates a PAID payment; auto-confirms a PENDING
   *    appointment in the same transaction.
   *  - REJECT:  requires `rejectionReason`.
   */
  verify: (
    businessId: string,
    appointmentId: string,
    input: VerifyReceiptInput,
  ) =>
    http.patch<AppointmentReceipt>(
      `/businesses/${businessId}/appointments/${appointmentId}/receipt/verify`,
      input,
    ),
}