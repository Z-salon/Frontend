import type { EmployeeAssignmentMode } from '../../../types/api'

/**
 * Booking wizard step graph.
 *
 * `staff` is a conditional step: it only exists for services configured as
 * `CUSTOMER_CHOOSES`. The salon-assigns mode is not part of this MVP, so
 * every other assignment mode falls straight through from date to time and
 * keeps the historical "first available stylist on the chosen slot"
 * behaviour.
 */
export type BookingStep =
  | 'branch'
  | 'service'
  | 'date'
  | 'staff'
  | 'slot'
  | 'contact'
  | 'prepay'
  | 'done'

const STEP_ORDER: BookingStep[] = [
  'branch',
  'service',
  'date',
  'staff',
  'slot',
  'contact',
  'done',
]

export const STEP_LABELS: Record<BookingStep, string> = {
  branch: 'Location',
  service: 'Service',
  date: 'Date',
  staff: 'Stylist',
  slot: 'Time',
  contact: 'Details',
  prepay: 'Deposit',
  done: 'Confirmed',
}

/** The only assignment mode that puts a stylist picker in front of the customer. */
export const CUSTOMER_CHOOSES: EmployeeAssignmentMode = 'CUSTOMER_CHOOSES'

export function requiresStaffChoice(
  mode: EmployeeAssignmentMode | null | undefined,
): boolean {
  return mode === CUSTOMER_CHOOSES
}

/** Steps the customer can navigate between; `done` is terminal. */
export function progressSteps(mode: EmployeeAssignmentMode | null | undefined): BookingStep[] {
  return STEP_ORDER.filter(step => step !== 'done' && (
    step !== 'staff' || requiresStaffChoice(mode)
  ))
}

/** 1-based position of `step` in the rail, falling back to 1. */
export function stepNumber(
  steps: BookingStep[],
  step: BookingStep,
): number {
  const idx = steps.indexOf(step)
  return idx === -1 ? 1 : idx + 1
}