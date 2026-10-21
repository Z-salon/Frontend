// src/api/public.api.ts

import { http } from './http'
import type { Appointment, ConfirmationView } from '../types/api'

/* ------------------------------------------------------------------ */
/*  Input types                                                        */
/* ------------------------------------------------------------------ */

export interface PublicBookingInput {
  verificationToken: string
  firstName: string
  lastName: string
  phone: string
  branchId: string
  serviceId: string
  staffId?: string
  scheduledStart: string // ISO 8601
  notes?: string
}

export interface PublicReceiptInput {
  paymentMethodId: string
  submittedAmount?: number
  receiptImageUrl: string
  receiptImagePublicId: string
  customerNote?: string
}

/* ------------------------------------------------------------------ */
/*  API                                                                */
/* ------------------------------------------------------------------ */

export const publicApi = {
  /* ---------------------------------------------------------------- */
  /*  Public booking                                                    */
  /* ---------------------------------------------------------------- */

  createBooking: (businessId: string, input: PublicBookingInput) =>
    http.post<Appointment>(
      `/public/businesses/${businessId}/bookings`,
      input,
      { auth: false },
    ),

  submitReceipt: (
    businessId: string,
    appointmentId: string,
    input: PublicReceiptInput,
  ) =>
    http.post<void>(
      `/public/businesses/${businessId}/appointments/${appointmentId}/payment-receipts`,
      input,
      { auth: false },
    ),

  /* ---------------------------------------------------------------- */
  /*  Tokenized SMS confirmation links (§10.4)                          */
  /*                                                                    */
  /*  The customer's SMS contains a URL like:                           */
  /*    https://frontend.example.com/appointments/confirm/{token}       */
  /*  The frontend extracts the token from the route and sends it back  */
  /*  to these endpoints. The response is a reduced `ConfirmationView`  */
  /*  (branch as a nested object, `staffName` flat, `businessName`,     */
  /*  and a server-computed `actions` policy) — not the admin           */
  /*  `Appointment` shape.                                              */
  /* ---------------------------------------------------------------- */

  viewConfirmation: (token: string) =>
    http.get<ConfirmationView>(`/public/appointments/confirm/${token}`, {
      auth: false,
    }),

  confirm: (token: string) =>
    http.post<ConfirmationView>(
      `/public/appointments/confirm/${token}/confirm`,
      {},
      { auth: false },
    ),

  cancelConfirmation: (token: string, reason?: string) =>
    http.post<ConfirmationView>(
      `/public/appointments/confirm/${token}/cancel`,
      { reason },
      { auth: false },
    ),

  rescheduleConfirmation: (token: string, newStartTime: string) =>
    http.post<ConfirmationView>(
      `/public/appointments/confirm/${token}/reschedule`,
      { newStartTime },
      { auth: false },
    ),
}

export default publicApi