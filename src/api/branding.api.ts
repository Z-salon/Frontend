import { http } from './http'
import type { BrandingPayload } from '../types/api'

export const brandingApi = {
  /** §3.3 — public, no auth. */
  get: (businessId: string) =>
    http.get<BrandingPayload>(
      `/businesses/${businessId}/branding`,
      { auth: false },
    ),
}