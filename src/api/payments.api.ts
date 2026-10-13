// src/api/payments.api.ts
import { http } from './http'
import type {
  PublicPaymentMethod,
  AppointmentReceipt,
  SubmitReceiptInput,
} from '../types/api'

export const paymentsApi = {
  /* ---------------------------------------------------------------- */
  /*  Public (no-account) booking — receipt submission                 */
  /* ---------------------------------------------------------------- */

  /**
   * §10.3 — No bearer. Authorization is implicit: appointment must be
   * PENDING and the phone was OTP-verified when the booking was created.
   */
  submitPublicReceipt: (
    businessId: string,
    appointmentId: string,
    input: SubmitReceiptInput,
  ) =>
    http.post<AppointmentReceipt>(
      `/public/businesses/${businessId}/appointments/${appointmentId}/payment-receipts`,
      input,
      { auth: false },
    ),

  /* ---------------------------------------------------------------- */
  /*  Customer (logged-in) — receipt submission                        */
  /* ---------------------------------------------------------------- */

  /**
   * §9.5 — Bearer required (customer). Only for PENDING appointments.
   * One active receipt per appointment (409 if already pending/approved).
   */
  submitCustomerReceipt: (
    appointmentId: string,
    input: SubmitReceiptInput,
  ) =>
    http.post<AppointmentReceipt>(
      `/customer/appointments/${appointmentId}/receipt`,
      input,
    ),

  /** §9.5 — Bearer required. 404 if no receipt. */
  getCustomerReceipt: (appointmentId: string) =>
    http.get<AppointmentReceipt>(
      `/customer/appointments/${appointmentId}/receipt`,
    ),
}