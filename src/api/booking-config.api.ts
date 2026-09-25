import { http } from './http';
import type { BookingConfig, BookingConfigPatch } from '../types/api';

export const bookingConfigApi = {
  /** §7.1 — Bearer + branch scope. Canonical grouped shape. */
  get: (businessId: string, branchId: string) =>
    http.get<BookingConfig>(
      `/${businessId}/branches/${branchId}/booking-config`,
    ),

  /**
   * §7.2 — Bearer + branch scope + Owner/Admin or BRANCH_MANAGER.
   *
   * MUST use nested `booking` / `cancellation` / `confirmation` groups.
   * A flat body of top-level field names is rejected by the strict schema
   * (§11.2). Omitted sections are left untouched.
   */
  patch: (
    businessId: string,
    branchId: string,
    patch: BookingConfigPatch,
  ) =>
    http.patch<BookingConfig>(
      `/${businessId}/branches/${branchId}/booking-config`,
      patch,
    ),
};