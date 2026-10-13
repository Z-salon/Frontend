// src/api/availability.api.ts

import { http } from './http'

export interface AvailabilitySlot {
  /** ISO 8601 with the branch's offset, e.g. "2026-09-24T09:00:00.000+03:00". */
  startTime: string
  /** ISO 8601 — the service duration's end. */
  serviceEndTime: string
  /** ISO 8601 — the reserved end (includes buffer). */
  reservedEndTime: string
  staff: Array<{ id: string; firstName: string; lastName: string }>
}

export interface AvailabilityResult {
  date: string
  branchId: string
  serviceId: string
  timezone: string
  availableSlots: AvailabilitySlot[]
}

export interface AvailabilityQuery {
  branchId: string
  serviceId: string
  /** YYYY-MM-DD, branch-local. */
  date: string
  staffId?: string
  /** PUBLIC (default) | INTERNAL. Staff-booking uses INTERNAL. */
  source?: 'PUBLIC' | 'INTERNAL'
}

export interface ValidateSlotInput {
  branchId: string
  serviceId: string
  staffId: string
  /** Full ISO 8601 (UTC or with offset). */
  startTime: string
  source?: 'PUBLIC' | 'INTERNAL'
  excludeAppointmentId?: string
}

export interface ValidateSlotResult {
  valid: boolean
  overrideAllowed: boolean
  conflictType?: string
  reason?: string
}

export const availabilityApi = {
  /** §4.1 — GET /businesses/:businessId/availability */
  slots: (businessId: string, query: AvailabilityQuery) => {
    const qs = new URLSearchParams()
    qs.set('branchId', query.branchId)
    qs.set('serviceId', query.serviceId)
    qs.set('date', query.date)
    if (query.staffId) qs.set('staffId', query.staffId)
    if (query.source) qs.set('source', query.source)
    return http.get<AvailabilityResult>(
      `/businesses/${businessId}/availability?${qs.toString()}`,
    )
  },

  /** §4.4 — POST /businesses/:businessId/availability/validate */
  validate: (businessId: string, input: ValidateSlotInput) =>
    http.post<ValidateSlotResult>(
      `/businesses/${businessId}/availability/validate`,
      input,
    ),
}

export default availabilityApi