// src/api/staff.api.ts

import { http } from './http';
import type {
  Staff,
  StaffDetail,
  StaffStatus,
  ProficiencyLevel,
  StaffCategoryQualification,
  StaffServiceQualification,
  StaffTimeOff,
  StaffTimeOffInput,
  StaffTimeOffUpdateInput,
  WeeklySchedule,
} from '../types/api';

/* ------------------------------------------------------------------ */
/*  Staff (§12)                                                        */
/* ------------------------------------------------------------------ */

export const staffApi = {
  /**
   * §12.3 — Bearer + membership + OWNER/ADMIN.
   * `branchId` must be an active branch in the business.
   * Returns the created Staff row (no nested `branch`).
   */
  create: (
    businessId: string,
    input: {
      branchId: string;
      firstName: string;
      lastName: string;
      email?: string;
      phone?: string;
      title?: string;
      bio?: string;
    },
  ) => http.post<Staff>(`/businesses/${businessId}/staff`, input),

  /**
   * §12.4 — Bearer + membership. Any active member.
   * Branch managers are auto-filtered to their branches; other roles see everything.
   * Returns Staff rows with a nested `branch: { id, name, isActive }`.
   */
  list: (
    businessId: string,
    q?: { branchId?: string; status?: StaffStatus },
  ) =>
    http.get<Staff[]>(`/businesses/${businessId}/staff`, { query: q }),

  /**
   * §12.5 — Bearer. Membership resolved from the staff row.
   * Returns the Staff object plus `branch`, `categoryQualifications` and
   * `serviceQualifications` (active only).
   */
  get: (staffId: string) =>
    http.get<StaffDetail>(`/staff/${staffId}`),

  /**
   * §12.6 — Bearer. Owner/Admin OR Branch Manager.
   * All fields optional; the body is NOT `.strict()`, so send only the fields below.
   * `email` / `phone` cannot be cleared (omit to leave unchanged).
   */
  update: (
    staffId: string,
    patch: {
      firstName?: string;
      lastName?: string;
      email?: string;
      phone?: string;
      title?: string;
      bio?: string;
      status?: StaffStatus;
    },
  ) => http.patch<Staff>(`/staff/${staffId}`, patch),

  /**
   * §12.7 — Bearer + membership + OWNER/ADMIN.
   * Move a staff member to another active branch in the same business.
   */
  moveBranch: (staffId: string, branchId: string) =>
    http.patch<Staff>(`/staff/${staffId}/branch`, { branchId }),

  /* ---------------------------------------------------------------- */
  /*  Weekly hours                                                    */
  /*                                                                  */
  /*  The staff weekly-hours endpoint uses a DIFFERENT shape than the */
  /*  branch endpoint (§6.2). What we've learned from the server's    */
  /*  own validation errors:                                          */
  /*                                                                  */
  /*    GET  /staff/{staffId}/weekly-hours                            */
  /*    PUT  /staff/{staffId}/weekly-hours                            */
  /*                                                                  */
  /*    • The PUT body is an OBJECT (not a bare array).               */
  /*    • It is NOT wrapped in `{ days: [...] }`.                     */
  /*    • Each day entry uses `dayOfWeek`, `isWorking`, `intervals` — */
  /*      where `isWorking` is the INVERSE of the branch endpoint's   */
  /*      `isClosed`, and `intervals` is `[{ start, end }]`.          */
  /*                                                                  */
  /*  The wrapper key is not documented — inferred from server error  */
  /*  messages during integration. The caller (`StaffScheduleTab`)    */
  /*  currently sends `{ schedule: [...] }`. If the server continues  */
  /*  to 400 with "Expected object, received array", change that      */
  /*  wrapper key in the caller; this API function is agnostic about  */
  /*  the internal shape.                                             */
  /*                                                                  */
  /*  GET returns the same shape the PUT expects — a plain array of   */
  /*  `WeeklySchedule` rows is the normalization target.              */
  /* ---------------------------------------------------------------- */
  weeklyHours: {
    /**
     * Returns the staff member's weekly schedule. The response may be a
     * bare array, an object with a wrapper key, or `null` — the caller
     * normalizes it (see `normalizeWeeklySchedules` in StaffPage).
     */
    get: (staffId: string) =>
      http.get<WeeklySchedule[]>(`/staff/${staffId}/weekly-hours`),

    /**
     * Full replace of the week. The body shape is:
     *
     *   { <wrapperKey>: [ { dayOfWeek, isWorking, intervals: [{ start, end }] }, … ] }
     *
     * The wrapper key is not part of this signature — the caller supplies
     * the full body. Pass `unknown` so the client doesn't bake in an
     * assumption the server will reject.
     */
    put: (staffId: string, input: unknown) =>
      http.put<WeeklySchedule[]>(
        `/staff/${staffId}/weekly-hours`,
        input,
      ),
  },

  /* ---------------------------------------------------------------- */
  /*  Qualifications (§13)                                            */
  /* ---------------------------------------------------------------- */

  categoryQualifications: {
    /**
     * §13.2 — Bearer + Owner/Admin OR branch-manager scope.
     * The category must be ACTIVE and actively assigned to the staff's branch.
     * 201 on create/reactivate, 409 if already active.
     */
    add: (staffId: string, categoryId: string) =>
      http.post<StaffCategoryQualification>(
        `/staff/${staffId}/category-qualifications`,
        { categoryId },
      ),

    /**
     * §13.2 — Soft delete (`isActive: false`). Idempotent — 200 even if
     * nothing was active.
     */
    remove: (staffId: string, categoryId: string) =>
      http.delete<void>(
        `/staff/${staffId}/category-qualifications/${categoryId}`,
      ),
  },

  serviceQualifications: {
    /**
     * §13.3 — Bearer + Owner/Admin OR branch-manager scope.
     * The service must be ACTIVE and actively assigned to the staff's branch.
     * 201 on create; if a row exists with the same level → 409,
     * different level → update + 201.
     */
    add: (
      staffId: string,
      serviceId: string,
      proficiencyLevel?: ProficiencyLevel,
    ) =>
      http.post<StaffServiceQualification>(
        `/staff/${staffId}/service-qualifications`,
        { serviceId, proficiencyLevel },
      ),

    /**
     * §13.3 — Soft delete (`isActive: false`). Idempotent.
     */
    remove: (staffId: string, serviceId: string) =>
      http.delete<void>(
        `/staff/${staffId}/service-qualifications/${serviceId}`,
      ),
  },

  /* ---------------------------------------------------------------- */
  /*  Time off (§14)                                                  */
  /* ---------------------------------------------------------------- */

  timeOff: {
    /**
     * §14.2 — Bearer + membership + scope.
     * `from` / `to` are inclusive bounds on `date` (YYYY-MM-DD).
     */
    list: (
      staffId: string,
      q?: { from?: string; to?: string },
    ) =>
      http.get<StaffTimeOff[]>(`/staff/${staffId}/time-off`, { query: q }),

    /**
     * §14.3 — Bearer + membership + scope.
     * `allDay: true` → omit `start` and `end`.
     * `allDay: false` → both `start` and `end` required, `start < end`.
     */
    create: (staffId: string, input: StaffTimeOffInput) =>
      http.post<StaffTimeOff>(`/staff/${staffId}/time-off`, input),

    /**
     * §14.4 — Bearer + membership + scope.
     * `date` cannot be changed. Switching `allDay` true → false requires both times.
     */
    update: (
      staffId: string,
      timeOffId: string,
      patch: StaffTimeOffUpdateInput,
    ) =>
      http.patch<StaffTimeOff>(
        `/staff/${staffId}/time-off/${timeOffId}`,
        patch,
      ),

    /**
     * §14.5 — Bearer + membership + scope. Hard delete. Idempotent.
     */
    remove: (staffId: string, timeOffId: string) =>
      http.delete<void>(`/staff/${staffId}/time-off/${timeOffId}`),
  },
};

/* ------------------------------------------------------------------ */
/*  Batch (§15.3)                                                      */
/* ------------------------------------------------------------------ */

export interface BatchCreateStaffItem {
  branchId: string;
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  title?: string;
  bio?: string;
  /** uuids; each must be ACTIVE and in the business. */
  serviceIds?: string[];
  /** uuids; each must be ACTIVE and in the business. */
  categoryIds?: string[];
}

/**
 * §15.3 — Bearer + membership + OWNER/ADMIN.
 * Atomic. Max 50 items per request.
 * Returns the created Staff rows (no nested `branch`).
 *
 * NOTE: the batch endpoint does NOT validate that each service/category is
 * actually offered at the staff member's branch — validate client-side if
 * that matters to your UX.
 */
export const staffBatchApi = {
  create: (
    businessId: string,
    items: BatchCreateStaffItem[],
  ) =>
    http.post<Staff[]>(`/businesses/${businessId}/staff/batch`, { items }),
};