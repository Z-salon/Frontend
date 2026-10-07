// src/api/appointments.api.ts

import { http } from './http'
import type {
  Appointment,
  AppointmentListResult,
  AppointmentStatus,
  AppointmentStatusHistoryEntry,
  BookingSource,
  ServiceUsage,
  ServiceUsageInput,
  ServiceUsageUpdateInput,
  AppointmentPaymentsInput,
  AppointmentPayment,
  AppointmentFinancials,
} from '../types/api'

/* ------------------------------------------------------------------ */
/*  Input types                                                        */
/* ------------------------------------------------------------------ */

export interface AppointmentListQuery {
  branchId?: string
  customerId?: string
  serviceId?: string
  staffId?: string
  status?: AppointmentStatus
  bookingSource?: BookingSource
  /** ISO 8601 — inclusive lower bound. */
  startDate?: string
  /** ISO 8601 — inclusive upper bound. */
  endDate?: string
  page?: number
  /** ≤ 100 per §5.3. */
  limit?: number
}

export interface CreateWalkInInput {
  branchId: string
  customerId: string
  serviceId: string
  staffId: string
  /**
   * ISO 8601. Omit → server defaults to "now" in the branch timezone.
   * Client-supplied `scheduledEnd` is ignored (see guide §0.4).
   */
  scheduledStart?: string
  notes?: string
  internalNotes?: string
}

export interface CreateStaffBookingInput extends CreateWalkInInput {
  /** Required — 'STAFF' (front desk) or 'PHONE'. */
  bookingSource: Extract<BookingSource, 'STAFF' | 'PHONE'>
  /**
   * Required only when the service has a deposit policy. The server
   * rejects with 400 if a deposit is required and no verified payment
   * is supplied.
   */
  paymentMethodId?: string
  amount?: number
  paymentReference?: string
}

export interface TransitionStatusInput {
  status: AppointmentStatus
  /** Stored in the status history. */
  reason?: string
  /** Only meaningful when transitioning to COMPLETED. ISO 8601. */
  actualEnd?: string
}

export interface RescheduleInput {
  newStartTime: string
  reason?: string
  staffId?: string
}

export interface ExtendInput {
  /** Integer, 1–480 (§5.7). */
  extensionMinutes: number
  reason?: string
}

export interface CancelInput {
  reason?: string
  /** true → creates a PENDING RefundRequest. */
  refund?: boolean
  /** Defaults to the full PAID amount. Capped at the paid total. */
  refundAmount?: number
}

/* ------------------------------------------------------------------ */
/*  API                                                                */
/* ------------------------------------------------------------------ */

export const appointmentsApi = {
  /* ---------------------------------------------------------------- */
  /*  §5.3 — List                                                      */
  /* ---------------------------------------------------------------- */

  list: (businessId: string, query?: AppointmentListQuery) => {
    const qs = new URLSearchParams()
    if (query?.branchId)      qs.set('branchId', query.branchId)
    if (query?.customerId)    qs.set('customerId', query.customerId)
    if (query?.serviceId)     qs.set('serviceId', query.serviceId)
    if (query?.staffId)       qs.set('staffId', query.staffId)
    if (query?.status)        qs.set('status', query.status)
    if (query?.bookingSource) qs.set('bookingSource', query.bookingSource)
    if (query?.startDate)     qs.set('startDate', query.startDate)
    if (query?.endDate)       qs.set('endDate', query.endDate)
    if (query?.page  != null) qs.set('page',  String(query.page))
    if (query?.limit != null) qs.set('limit', String(query.limit))
    const suffix = qs.toString() ? `?${qs.toString()}` : ''
    // The list envelope nests the array: `data: { data: [...], meta }`.
    // `http.get` unwraps the outer `data`, so the caller receives
    // `{ data: Appointment[], meta }`.
    return http.get<AppointmentListResult>(
      `/businesses/${businessId}/appointments${suffix}`,
    )
  },

  /* ---------------------------------------------------------------- */
  /*  §5.3 — Get one                                                   */
  /* ---------------------------------------------------------------- */

  get: (businessId: string, appointmentId: string) =>
    http.get<Appointment>(
      `/businesses/${businessId}/appointments/${appointmentId}`,
    ),

  /**
   * Money figures for one appointment. The server computes every amount,
   * including the `refundable` ceiling used by the Create Refund form —
   * the client never derives it from the other fields.
   *
   * `GET /businesses/:businessId/appointments/:id/financials`
   */
  financials: (businessId: string, appointmentId: string) =>
    http.get<AppointmentFinancials>(
      `/businesses/${businessId}/appointments/${appointmentId}/financials`,
    ),

  /* ---------------------------------------------------------------- */
  /*  §5.1 — Create walk-in                                            */
  /* ---------------------------------------------------------------- */

  createWalkIn: (businessId: string, input: CreateWalkInInput) =>
    http.post<Appointment>(
      `/businesses/${businessId}/appointments/walk-in`,
      input,
    ),

  /* ---------------------------------------------------------------- */
  /*  §5.2 — Create phone / staff booking                              */
  /* ---------------------------------------------------------------- */

  createStaffBooking: (
    businessId: string,
    input: CreateStaffBookingInput,
  ) =>
    http.post<Appointment>(
      `/businesses/${businessId}/appointments/staff-booking`,
      input,
    ),

  /* ---------------------------------------------------------------- */
  /*  §5.4 — Reschedule                                                */
  /* ---------------------------------------------------------------- */

  reschedule: (
    businessId: string,
    appointmentId: string,
    body: RescheduleInput,
  ) =>
    http.patch<Appointment>(
      `/businesses/${businessId}/appointments/${appointmentId}/reschedule`,
      body,
    ),

  /* ---------------------------------------------------------------- */
  /*  §5.5 — Change the booked service                                 */
  /* ---------------------------------------------------------------- */

  changeService: (
    businessId: string,
    appointmentId: string,
    serviceId: string,
  ) =>
    http.patch<Appointment>(
      `/businesses/${businessId}/appointments/${appointmentId}/service`,
      { serviceId },
    ),

  /* ---------------------------------------------------------------- */
  /*  §5.6 — Status transition                                         */
  /* ---------------------------------------------------------------- */

  updateStatus: (
    businessId: string,
    appointmentId: string,
    input: TransitionStatusInput,
  ) =>
    http.patch<Appointment>(
      `/businesses/${businessId}/appointments/${appointmentId}/status`,
      input,
    ),

  /* ---------------------------------------------------------------- */
  /*  §5.7 — Extend an IN_PROGRESS appointment                         */
  /* ---------------------------------------------------------------- */

  extend: (
    businessId: string,
    appointmentId: string,
    body: ExtendInput,
  ) =>
    http.post<Appointment>(
      `/businesses/${businessId}/appointments/${appointmentId}/extend`,
      body,
    ),

  /* ---------------------------------------------------------------- */
  /*  §5.8 — Assign / reassign staff                                   */
  /* ---------------------------------------------------------------- */

  assignStaff: (
    businessId: string,
    appointmentId: string,
    staffId: string,
  ) =>
    http.post<Appointment>(
      `/businesses/${businessId}/appointments/${appointmentId}/staff`,
      { staffId },
    ),

  /**
   * §5.8 — Staff manually confirms the customer showed up.
   * Sets confirmationStatus=CONFIRMED. 400 if already confirmed.
   */
  confirmAttendance: (businessId: string, appointmentId: string) =>
    http.post<Appointment>(
      `/businesses/${businessId}/appointments/${appointmentId}/confirm-attendance`,
    ),

  /* ---------------------------------------------------------------- */
  /*  §5.9 — No-show                                                   */
  /* ---------------------------------------------------------------- */

  noShow: (
    businessId: string,
    appointmentId: string,
    reason?: string,
  ) =>
    http.post<Appointment>(
      `/businesses/${businessId}/appointments/${appointmentId}/no-show`,
      reason ? { reason } : {},
    ),

  /* ---------------------------------------------------------------- */
  /*  §5.10 — Cancel (optionally with refund)                          */
  /* ---------------------------------------------------------------- */

  cancel: (
    businessId: string,
    appointmentId: string,
    body: CancelInput = {},
  ) =>
    http.post<Appointment>(
      `/businesses/${businessId}/appointments/${appointmentId}/cancel`,
      body,
    ),

  /* ---------------------------------------------------------------- */
  /*  §5.11 — Status history                                           */
  /* ---------------------------------------------------------------- */

  statusHistory: (businessId: string, appointmentId: string) =>
    http.get<AppointmentStatusHistoryEntry[]>(
      // NOTE: the guide lists this as `/appointments/:id/status-history`
      // — no `/businesses` prefix, same mount as the other shared routes.
      `/appointments/${appointmentId}/status-history`,
    ),

  /* ---------------------------------------------------------------- */
  /*  §5.3 — Notes-only update                                         */
  /* ---------------------------------------------------------------- */

  updateNotes: (
    businessId: string,
    appointmentId: string,
    patch: { notes?: string | null; internalNotes?: string | null },
  ) =>
    http.patch<Appointment>(
      `/businesses/${businessId}/appointments/${appointmentId}`,
      patch,
    ),

  /* ---------------------------------------------------------------- */
  /*  §6.2 — List service usages for an appointment                    */
  /* ---------------------------------------------------------------- */

  listServiceUsages: (businessId: string, appointmentId: string) =>
    http.get<ServiceUsage[]>(
      `/businesses/${businessId}/appointments/${appointmentId}/service-usages`,
    ),

  /**
   * §6.1 — Record what was actually performed.
   *
   * Rejected with 400 unless the appointment is CHECKED_IN, IN_PROGRESS, or
   * COMPLETED, so this is safe to call before the COMPLETED transition.
   * Returns 201 with the created record.
   */
  addServiceUsage: (
    businessId: string,
    appointmentId: string,
    input: ServiceUsageInput,
  ) =>
    http.post<ServiceUsage>(
      `/businesses/${businessId}/appointments/${appointmentId}/service-usages`,
      input,
    ),

  /**
   * §6.3 — Update a record. Only the provided fields change; `productsUsed`
   * replaces the stored array wholesale. Returns the updated record.
   */
  updateServiceUsage: (
    businessId: string,
    usageId: string,
    patch: ServiceUsageUpdateInput,
  ) =>
    http.patch<ServiceUsage>(
      `/businesses/${businessId}/service-usages/${usageId}`,
      patch,
    ),

  /* ---------------------------------------------------------------- */
  /*  §7.1 — Record money received (supports split tender)             */
  /* ---------------------------------------------------------------- */

  /**
   * `POST /businesses/:businessId/appointments/:id/payments`
   *
   * Send `payments: [...]` to record several methods in one transaction —
   * 1000 cash + 1500 card creates two rows atomically. Each entry needs a
   * method belonging to this business and active, and `amount > 0`, else 400.
   * Every row is created with `status=PAID` and `paidAt=now`.
   *
   * There is no edit endpoint: to change a recorded amount you void it
   * (§7.2) and record a replacement, which keeps the audit trail intact.
   */
  recordPayments: (
    businessId: string,
    appointmentId: string,
    input: AppointmentPaymentsInput,
  ) =>
    http.post<AppointmentPayment[]>(
      `/businesses/${businessId}/appointments/${appointmentId}/payments`,
      input,
    ),

  /**
   * §7.2 — Void a payment. `reason` is required (400 without it) and only
   * `PAID` payments can be voided. Status becomes `VOIDED`, which is
   * terminal — this is not a delete and not reversible.
   */
  voidPayment: (businessId: string, paymentId: string, reason: string) =>
    http.patch<AppointmentPayment>(
      `/businesses/${businessId}/payments/${paymentId}/void`,
      { reason },
    ),

  /** §6.4 — Hard delete. Returns `{ data: null }`. */
  deleteServiceUsage: (businessId: string, usageId: string) =>
    http.delete<null>(
      `/businesses/${businessId}/service-usages/${usageId}`,
    ),

  /* ---------------------------------------------------------------- */
  /*  §7.2 — List payments for an appointment                          */
  /* ---------------------------------------------------------------- */

  listPayments: (businessId: string, appointmentId: string) =>
    http.get<AppointmentPayment[]>(
      `/businesses/${businessId}/appointments/${appointmentId}/payments`,
    ),
}

export default appointmentsApi
