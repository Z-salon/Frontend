import { http } from './http'
import type { Appointment } from '../types/api'

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

export const publicApi = {
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

  /* Tokenized SMS confirmation links (§10.4) */
  viewConfirmation: (token: string) =>
    http.get<Appointment>(`/public/appointments/confirm/${token}`, {
      auth: false,
    }),

  confirm: (token: string) =>
    http.post<Appointment>(
      `/public/appointments/confirm/${token}/confirm`,
      {},
      { auth: false },
    ),

  cancelConfirmation: (token: string, reason?: string) =>
    http.post<Appointment>(
      `/public/appointments/confirm/${token}/cancel`,
      { reason },
      { auth: false },
    ),

  rescheduleConfirmation: (token: string, newStartTime: string) =>
    http.post<Appointment>(
      `/public/appointments/confirm/${token}/reschedule`,
      { newStartTime },
      { auth: false },
    ),
}