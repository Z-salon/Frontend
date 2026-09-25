import { http } from './http';
import type {
  PaymentMethod,
  PaymentMethodInput,
  PublicPaymentMethod,
} from '../types/api';

export const paymentMethodsApi = {
  /**
   * §4.1 — Bearer required, no membership check.
   * Customer-facing list. Only active methods, ordered by displayOrder.
   * Projection omits isActive/displayOrder/businessId/timestamps.
   */
  publicList: (businessId: string) =>
    http.get<PublicPaymentMethod[]>(
      `/businesses/${businessId}/payment-methods/public`,
    ),

  /**
   * §4.2 — Bearer + membership + OWNER only (hard-coded, §11.5).
   * NO schema validation server-side — validate on the client (§11.3).
   * Do NOT send businessId in the body.
   */
  create: (businessId: string, input: PaymentMethodInput) =>
    http.post<PaymentMethod>(
      `/businesses/${businessId}/payment-methods`,
      input,
    ),

  /** §4.3 — Bearer + membership (any active member). */
  list: (businessId: string, q?: { active?: boolean }) =>
    http.get<PaymentMethod[]>(
      `/businesses/${businessId}/payment-methods`,
      { query: q },
    ),

  /**
   * §4.4 — Bearer + membership + OWNER only.
   * Method must belong to businessId (else 404).
   */
  update: (
    businessId: string,
    id: string,
    patch: Partial<PaymentMethodInput>,
  ) =>
    http.patch<PaymentMethod>(
      `/businesses/${businessId}/payment-methods/${id}`,
      patch,
    ),

  /**
   * §4.5 — Bearer + membership + OWNER only.
   * Used-in-receipt methods cannot be deleted (400). Deactivate instead.
   */
  remove: (businessId: string, id: string) =>
    http.delete<null>(`/businesses/${businessId}/payment-methods/${id}`),

  /**
   * §4.6 — Bearer + membership + Owner/Admin.
   * Max 50 items. Duplicate names → 400. No schema validation.
   */
  createBatch: (businessId: string, items: PaymentMethodInput[]) =>
    http.post<PaymentMethod[]>(
      `/businesses/${businessId}/payment-methods/batch`,
      { items },
    ),
};