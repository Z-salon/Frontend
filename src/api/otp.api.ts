import { http } from './http'

export const otpApi = {
  /** §2.1 — public. Always returns 200 to avoid enumeration. */
  request: (
    phone: string,
    purpose: 'PHONE_VERIFICATION' = 'PHONE_VERIFICATION',
  ) =>
    http.post<void>('/auth/otp/request', { phone, purpose }, { auth: false }),

  /** §2.2 — public. Returns a `verificationToken` on success. */
  verify: (
    phone: string,
    otp: string,
    purpose: 'PHONE_VERIFICATION' = 'PHONE_VERIFICATION',
  ) =>
    http.post<{ verificationToken: string }>(
      '/auth/otp/verify',
      { phone, otp, purpose },
      { auth: false },
    ),
}