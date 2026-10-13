import { http } from './http';
import type {
  AuthUser,
  LoginResponse,
  MeResponse,
  OtpPurpose,
  SessionInfo,
} from '../types/api';

export const authApi = {
  /** §2.1 — public. Always 200 to avoid phone enumeration. */
  requestOtp: (phone: string, purpose: OtpPurpose = 'LOGIN') =>
    http.post<{ verificationToken?: string }>('/auth/otp/request', {
      phone,
      purpose,
    }),

  /** §2.2 — public. Returns a short-lived verificationToken. */
  verifyOtp: (phone: string, otp: string, purpose: OtpPurpose = 'LOGIN') =>
    http.post<{ verificationToken: string }>('/auth/otp/verify', {
      phone,
      otp,
      purpose,
    }),

  /** §2.11 — public. Cooldown applies. */
  resendOtp: (phone: string, purpose: OtpPurpose = 'LOGIN') =>
    http.post<void>('/auth/otp/resend', { phone, purpose }),

  /** §2.3 — public. Business owner signup, step 1. OTP sent for PHONE_VERIFICATION. */
  register: (input: {
    phone: string;
    password: string;
    business: { name: string; currency?: string; timezone?: string };
  }) => http.post<void>('/auth/register', input),

  /** §2.4 — public. Step 1 of accepting a team invitation. */
  registerViaInvitation: (invitationToken: string, password: string) =>
    http.post<void>(`/auth/register/${invitationToken}/invitation`, {
      password,
    }),

  /** §2.5 — public. Step 2, completes onboarding + logs the user in. */
  registerVerify: (phone: string, otp: string) =>
    http.post<LoginResponse>('/auth/register/verify', { phone, otp }),

  /** §2.6 — public. */
  login: (phone: string, password: string) =>
    http.post<LoginResponse>('/auth/login', { phone, password }),

  /** §2.7 — public. Complete a passwordless/OTP login. */
  loginComplete: (verificationToken: string) =>
    http.post<LoginResponse>('/auth/login/complete', { verificationToken }),

  /** §2.8 — public. Sends PASSWORD_RESET OTP. */
  forgotPassword: (phone: string) =>
    http.post<void>('/auth/password/forgot', { phone }),

  /** §2.8 — public. */
  resetPasswordVerify: (phone: string, otp: string) =>
    http.post<{ passwordResetToken: string }>('/auth/password/reset/verify', {
      phone,
      otp,
    }),

  /** §2.8 — public. Revokes sessions. */
  resetPassword: (passwordResetToken: string, newPassword: string) =>
    http.post<void>('/auth/password/reset', {
      passwordResetToken,
      newPassword,
    }),

  /** §2.9 — Bearer required. */
  changePassword: (currentPassword: string, newPassword: string) =>
    http.post<void>('/auth/password/change', {
      currentPassword,
      newPassword,
    }),

  /** §2.10 — Bearer required. */
  requestPhoneChange: (currentPassword: string, newPhone: string) =>
    http.post<void>('/auth/phone/change/request', {
      currentPassword,
      newPhone,
    }),

  /** §2.10 — Bearer required. */
  verifyPhoneChange: (newPhone: string, otp: string) =>
    http.post<void>('/auth/phone/change/verify', { newPhone, otp }),

  /**
   * §2.12 — cookie only.
   * `auth: false` → no Bearer header. `skipRefresh: true` prevents recursion
   * when this call itself returns 401.
   */
  refresh: () =>
    http.post<{ accessToken: string }>('/auth/refresh', undefined, {
      auth: false,
      skipRefresh: true,
    }),

  /** §2.13 — Bearer required. Revokes the current session, clears cookie. */
  logout: () => http.post<void>('/auth/logout'),

  /** §2.13 — Bearer required. Revokes every session of the user. */
  logoutAll: () => http.post<void>('/auth/logout-all'),

  /** §2.14 — Bearer required. */
  me: () => http.get<MeResponse>('/auth/me'),

  /** §2.15 — Bearer required. */
  sessions: () => http.get<SessionInfo[]>('/auth/sessions'),

  /** §2.15 — Bearer required. */
  revokeSession: (sessionId: string) =>
    http.delete<void>(`/auth/sessions/${sessionId}`),
};

export type { AuthUser };