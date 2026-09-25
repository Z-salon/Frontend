import { http } from './http';
import type {
  BrandingPayload,
  BrandingUpdateInput,
  BusinessConfig,
} from '../types/api';

export const businessApi = {
  /**
   * §3.1 — Bearer required.
   * Resolves the caller's FIRST ACTIVE membership. For multi-business users,
   * rely on /auth/me memberships for selection; use this only when you need
   * the enriched config (slug, phones, updatedAt).
   */
  me: () => http.get<BusinessConfig>('/businesses/me'),

  /** §3.2 — Bearer + BUSINESS_UPDATE. Strict body; unknown fields → 400. */
  update: (
    businessId: string,
    patch: { name?: string; currency?: string; timezone?: string },
  ) => http.patch<BusinessConfig>(`/businesses/${businessId}`, patch),

  /**
   * §3.3 — PUBLIC, no auth.
   * No membership check. Treat as storefront data.
   */
  branding: (businessId: string) =>
    http.get<BrandingPayload>(`/businesses/${businessId}/branding`, {
      auth: false,
    }),

  /**
   * §3.4 — Bearer + BUSINESS_MANAGE_BRANDING.
   * Do NOT send address/phone/email — strict schema rejects them (§11.2).
   */
  updateBranding: (businessId: string, patch: BrandingUpdateInput) =>
    http.patch<BusinessConfig>(
      `/businesses/${businessId}/branding`,
      patch,
    ),
};