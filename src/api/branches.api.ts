// src/api/branches.api.ts

import { http } from './http'
import type {
  Branch,
  BranchDetail,
  BranchPhone,
  WeeklySchedule,
  WeeklyHoursInput,
  DateOverride,
  DateOverrideInput,
} from '../types/api'

/* ------------------------------------------------------------------ */
/*  Types local to this module                                         */
/* ------------------------------------------------------------------ */

export interface CreateBranchInput {
  name: string
  address: string
  timezone?: string
}

export interface UpdateBranchPatch {
  name?: string
  address?: string | null
  timezone?: string
  isActive?: boolean
}

export interface CreateBranchPhoneInput {
  phoneNumber: string
  label?: string
  isPrimary?: boolean
}

export interface UpdateBranchPhonePatch {
  phoneNumber?: string
  label?: string
  isPrimary?: boolean
  isActive?: boolean
}

export interface DateOverridesQuery {
  from?: string
  to?: string
  upcoming?: boolean
}

/* ------------------------------------------------------------------ */
/*  Routing notes (per the endpoint guide)                             */
/*                                                                     */
/*    • Create / List           →  /businesses/:businessId/branches    */
/*    • Detail / Update         →  /:businessId/branches/:branchId     */
/*    • Weekly hours            →  /:businessId/branches/:id/...       */
/*    • Date overrides          →  /:businessId/branches/:id/...       */
/*    • Operating intervals     →  /businesses/:businessId/branches/…  */
/*                                                                     */
/*  The detail/update/hours/overrides routes are mounted on a separate */
/*  branch router that lives at the business root — hence the missing  */
/*  `/businesses` segment. Operating intervals is the outlier: it is   */
/*  mounted under `/businesses` like create/list. Do not "normalize"   */
/*  them; the server will 404.                                         */
/* ------------------------------------------------------------------ */

export const branchesApi = {
  /* ---------------------------------------------------------------- */
  /*  §2.1 Create                                                     */
  /* ---------------------------------------------------------------- */
  create: (businessId: string, input: CreateBranchInput) =>
    http.post<Branch>(`/businesses/${businessId}/branches`, input),

  /* ---------------------------------------------------------------- */
  /*  §2.2 List                                                       */
  /* ---------------------------------------------------------------- */
  list: (businessId: string) =>
    http.get<Branch[]>(`/businesses/${businessId}/branches`),

  /* ---------------------------------------------------------------- */
  /*  §2.3 Detail                                                     */
  /* ---------------------------------------------------------------- */
  get: (businessId: string, branchId: string) =>
    http.get<BranchDetail>(`/${businessId}/branches/${branchId}`),

  /* ---------------------------------------------------------------- */
  /*  §2.4 Update                                                     */
  /*  Used for both edits and activate/deactivate (`{ isActive: … }`).*/
  /* ---------------------------------------------------------------- */
  update: (businessId: string, branchId: string, patch: UpdateBranchPatch) =>
    http.patch<Branch>(`/${businessId}/branches/${branchId}`, patch),

  /* ---------------------------------------------------------------- */
  /*  §2.5 Branch phones                                              */
  /*  Not documented in the endpoint guide. Mirrors the customer-     */
  /*  phone pattern (§3.4) mounted under `/businesses`. If these      */
  /*  404, switch the prefix to `/${businessId}/...` to match the     */
  /*  other branch sub-resources.                                     */
  /* ---------------------------------------------------------------- */
  phones: {
    list: (businessId: string, branchId: string) =>
      http.get<BranchPhone[]>(
        `/businesses/${businessId}/branches/${branchId}/phones`,
      ),

    create: (
      businessId: string,
      branchId: string,
      input: CreateBranchPhoneInput,
    ) =>
      http.post<BranchPhone>(
        `/businesses/${businessId}/branches/${branchId}/phones`,
        input,
      ),

    update: (
      businessId: string,
      branchId: string,
      phoneId: string,
      patch: UpdateBranchPhonePatch,
    ) =>
      http.patch<BranchPhone>(
        `/businesses/${businessId}/branches/${branchId}/phones/${phoneId}`,
        patch,
      ),

    // ⚠ Verify against server. Guide §3.4 uses
    //   PATCH /customers/:id/phones/:phoneId/primary (no body).
    // This client uses POST .../set-primary. If it 404s, change to:
    //   http.patch<BranchPhone>(`.../phones/${phoneId}/primary`)
    setPrimary: (businessId: string, branchId: string, phoneId: string) =>
      http.post<BranchPhone>(
        `/businesses/${businessId}/branches/${branchId}/phones/${phoneId}/set-primary`,
      ),

    remove: (businessId: string, branchId: string, phoneId: string) =>
      http.delete<void>(
        `/businesses/${businessId}/branches/${branchId}/phones/${phoneId}`,
      ),
  },

  /* ---------------------------------------------------------------- */
  /*  §2.5 Weekly hours                                               */
  /* ---------------------------------------------------------------- */
  weeklyHours: {
    get: (businessId: string, branchId: string) =>
      http.get<WeeklySchedule[]>(
        `/${businessId}/branches/${branchId}/weekly-hours`,
      ),

    put: (businessId: string, branchId: string, input: WeeklyHoursInput) =>
      http.put<WeeklySchedule[]>(
        `/${businessId}/branches/${branchId}/weekly-hours`,
        input,
      ),
  },

  /* ---------------------------------------------------------------- */
  /*  §4.2 Operating intervals — merged branch hours for one date     */
  /*                                                                  */
  /*  Mounted under `/businesses/...` (unlike weekly-hours / date-    */
  /*  overrides which sit at the business root). Returns the branch's */
  /*  open intervals for a single branch-local date after weekly      */
  /*  hours and overrides apply. Empty array = closed.                */
  /* ---------------------------------------------------------------- */
  operatingIntervals: (businessId: string, branchId: string, date: string) =>
    http.get<{
      businessId: string
      branchId: string
      date: string
      timezone: string
      intervals: Array<{ start: string; end: string }>
    }>(
      `/businesses/${businessId}/branches/${branchId}/operating-intervals?date=${date}`,
    ),

  /* ---------------------------------------------------------------- */
  /*  §2.6 Date overrides                                             */
  /* ---------------------------------------------------------------- */
  dateOverrides: {
    list: (
      businessId: string,
      branchId: string,
      query?: DateOverridesQuery,
    ) => {
      const qs = new URLSearchParams()
      if (query?.from) qs.set('from', query.from)
      if (query?.to) qs.set('to', query.to)
      if (query?.upcoming) qs.set('upcoming', 'true')
      const suffix = qs.toString() ? `?${qs.toString()}` : ''
      return http.get<DateOverride[]>(
        `/${businessId}/branches/${branchId}/date-overrides${suffix}`,
      )
    },

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

    remove: (businessId: string, branchId: string, overrideId: string) =>
      http.delete<void>(
        `/${businessId}/branches/${branchId}/date-overrides/${overrideId}`,
      ),
  },
}

export default branchesApi