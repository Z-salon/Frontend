import { http } from './http';
import type {
  DateOverride,
  DateOverrideInput,
  WeeklyHoursInput,
  WeeklySchedule,
} from '../types/api';

export const workingHoursApi = {
  /** §6.1 — Bearer + branch scope. */
  getWeekly: (businessId: string, branchId: string) =>
    http.get<WeeklySchedule[]>(
      `/${businessId}/branches/${branchId}/weekly-hours`,
    ),

  /**
   * §6.2 — Bearer + branch scope + Owner/Admin or BRANCH_MANAGER.
   * DESTRUCTIVE: full replace, must send all 7 days (0–6), each once.
   * isClosed:true ⇒ empty intervals; isClosed:false ⇒ ≥ 1 interval.
   * Intervals within a day must not overlap.
   */
  replaceWeekly: (
    businessId: string,
    branchId: string,
    input: WeeklyHoursInput,
  ) =>
    http.put<WeeklySchedule[]>(
      `/${businessId}/branches/${branchId}/weekly-hours`,
      input,
    ),

  // ── §6.3 Date overrides ────────────────────────────────────────────────
  dateOverrides: {
    list: (
      businessId: string,
      branchId: string,
      q?: { from?: string; to?: string; upcoming?: boolean },
    ) =>
      http.get<DateOverride[]>(
        `/${businessId}/branches/${branchId}/date-overrides`,
        { query: q },
      ),

    create: (
      businessId: string,
      branchId: string,
      input: DateOverrideInput,
    ) =>
      http.post<DateOverride>(
        `/${businessId}/branches/${branchId}/date-overrides`,
        input,
      ),

    update: (
      businessId: string,
      branchId: string,
      overrideId: string,
      patch: Partial<DateOverrideInput>,
    ) =>
      http.patch<DateOverride>(
        `/${businessId}/branches/${branchId}/date-overrides/${overrideId}`,
        patch,
      ),

    remove: (
      businessId: string,
      branchId: string,
      overrideId: string,
    ) =>
      http.delete<void>(
        `/${businessId}/branches/${branchId}/date-overrides/${overrideId}`,
      ),
  },
};