// src/api/appointments.api.ts

import { http } from './http'
import type {
  Appointment,
  AppointmentStatus,
  AppointmentStatusHistoryEntry,
  BookingSource,
  ServiceUsage,
  AppointmentPayment,
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
    return http.get<Appointment[]>(
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

  /* ---------------------------------------------------------------- */
  /*  §7.2 — List payments for an appointment                          */
  /* ---------------------------------------------------------------- */

  listPayments: (businessId: string, appointmentId: string) =>
    http.get<AppointmentPayment[]>(
      `/businesses/${businessId}/appointments/${appointmentId}/payments`,
    ),
}

export default appointmentsApi
