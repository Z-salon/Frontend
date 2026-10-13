import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import type {
  AppointmentStatus,
  BrandingPayload,
  EmployeeAssignmentMode,
  ReceiptStatus,
} from '../../types/api'
import {
  progressSteps,
  requiresStaffChoice,
  stepNumber,
  type BookingStep,
} from '../screens/Booking/steps'

interface BookingDraft {
  branchId: string | null
  serviceId: string | null
  /**
   * The stylist the customer picked. Only meaningful when the service is
   * `CUSTOMER_CHOOSES`; otherwise it is whatever the chosen slot carried.
   */
  staffId: string | null
  /** YYYY-MM-DD, branch-local. */
  date: string | null
  /** ISO 8601 — the chosen slot's start time. */
  slotStart: string | null
  /** Slot's end (as returned by the API). */
  slotEnd: string | null

  firstName: string
  lastName: string
  phone: string
  verificationToken: string | null

  notes: string

  /**
   * Denormalised display values. The booking summary rail needs the
   * names of the branch/service the customer picked, but the service
   * list is only fetched inside the service step — so each step records
   * what it already has in hand rather than the summary re-querying the
   * API. Purely cosmetic; the ids above stay the source of truth.
   */
  branchName: string | null
  serviceName: string | null
  serviceCategoryName: string | null
  serviceDurationMinutes: number | null
  /** Decimal string, exactly as the API returned it. */
  servicePrice: string | null
  /**
   * Whether the salon wants this service's price disclosed to the
   * customer. Copied from `service.showPriceToCustomer` on selection so
   * every downstream view (summary rail, done screen, prepay) can
   * honour the flag without re-fetching the service record.
   *
   * NOTE: this governs the *service price* only. The deposit amount is
   * separately tracked (`depositAmount`) and is never hidden when a
   * prepayment is required — the customer has to know what to send.
   */
  serviceShowPrice: boolean
  staffName: string | null
  /**
   * Drives whether the wizard inserts the stylist step at all. Captured
   * from the service record on selection so later steps never have to
   * re-query the service list.
   */
  serviceEmployeeAssignmentMode: EmployeeAssignmentMode | null

  /* ---------------------------------------------------------------- */
  /*  Post-create (deposit / approval) state                           */
  /* ---------------------------------------------------------------- */

  /**
   * Set once the create-booking call resolves. Consumed by the prepay
   * step to attach the receipt to the right appointment, and by the done
   * screen to branch its copy.
   */
  appointmentId: string | null

  /**
   * Raw status from the create response. `PENDING` covers two cases:
   *  - deposit required (`requiresDeposit === true`)
   *  - salon approval required, no money owed (`requiresDeposit === false`)
   * The done screen distinguishes them.
   */
  appointmentStatus: AppointmentStatus | null

  /**
   * True when the backend returned `status: PENDING` **and** the
   * appointment carries a positive `depositAmount`. Only then does the
   * wizard insert the prepay step.
   */
  requiresDeposit: boolean

  /**
   * Amount the customer must send, parsed from `appointment.depositAmount`
   * (Decimal-as-string → number). Null when no deposit is expected.
   */
  depositAmount: number | null

  /**
   * Set after the customer submits a receipt; reflects the receipt's own
   * status, not the appointment's. `PENDING` = awaiting salon review.
   */
  receiptStatus: ReceiptStatus | null
}

const EMPTY_DRAFT: BookingDraft = {
  branchId: null,
  serviceId: null,
  staffId: null,
  date: null,
  slotStart: null,
  slotEnd: null,
  firstName: '',
  lastName: '',
  phone: '',
  verificationToken: null,
  notes: '',
  branchName: null,
  serviceName: null,
  serviceCategoryName: null,
  serviceDurationMinutes: null,
  servicePrice: null,
  serviceShowPrice: true,
  staffName: null,
  serviceEmployeeAssignmentMode: null,
  appointmentId: null,
  appointmentStatus: null,
  requiresDeposit: false,
  depositAmount: null,
  receiptStatus: null,
}

interface BookingContextValue {
  businessId: string
  branding: BrandingPayload
  step: BookingStep
  setStep: (s: BookingStep) => void
  draft: BookingDraft
  updateDraft: (patch: Partial<BookingDraft>) => void
  resetDraft: () => void
  /** True when the selected service puts a stylist picker in the flow. */
  requiresStaffChoice: boolean
  /** True when the created appointment requires a prepaid deposit. */
  requiresDeposit: boolean
  /** The rail this run walks, i.e. with `staff` and/or `prepay` included. */
  steps: BookingStep[]
  /** 1-based position of the current step in `steps`. */
  stepIndex: number
  stepTotal: number
}

const BookingContext = createContext<BookingContextValue | null>(null)

export function BookingProvider({
  businessId,
  branding,
  children,
}: {
  businessId: string
  branding: BrandingPayload
  children: ReactNode
}) {
  const [step, setStep] = useState<BookingStep>('branch')
  const [draft, setDraft] = useState<BookingDraft>(EMPTY_DRAFT)

  const updateDraft = useCallback((patch: Partial<BookingDraft>) => {
    setDraft(prev => ({ ...prev, ...patch }))
  }, [])

  const resetDraft = useCallback(() => setDraft(EMPTY_DRAFT), [])

  const needsStaff = requiresStaffChoice(draft.serviceEmployeeAssignmentMode)
  const needsPrepay = draft.requiresDeposit

  /**
   * The rail is derived, not hardcoded:
   *  - `staff` is only present for `CUSTOMER_CHOOSES` services, decided
   *    by `progressSteps(mode)`.
   *  - `prepay` is only present once the created appointment owes a
   *    deposit. It is appended here rather than baked into
   *    `progressSteps` because it depends on a *runtime response*, not
   *    on the service configuration.
   *
   * `done` is never included — it is the success screen, not a rail
   * segment the customer can navigate back to.
   */
  const steps = useMemo<BookingStep[]>(() => {
    const base = progressSteps(draft.serviceEmployeeAssignmentMode)
    return needsPrepay ? [...base, 'prepay'] : base
  }, [draft.serviceEmployeeAssignmentMode, needsPrepay])

  const stepIndex = stepNumber(steps, step)
  const stepTotal = steps.length

  const value = useMemo<BookingContextValue>(
    () => ({
      businessId,
      branding,
      step,
      setStep,
      draft,
      updateDraft,
      resetDraft,
      requiresStaffChoice: needsStaff,
      requiresDeposit: needsPrepay,
      steps,
      stepIndex,
      stepTotal,
    }),
    [
      businessId,
      branding,
      step,
      draft,
      updateDraft,
      resetDraft,
      needsStaff,
      needsPrepay,
      steps,
      stepIndex,
      stepTotal,
    ],
  )

  return (
    <BookingContext.Provider value={value}>{children}</BookingContext.Provider>
  )
}

export function useBooking(): BookingContextValue {
  const ctx = useContext(BookingContext)
  if (!ctx) throw new Error('useBooking() must be used inside <BookingProvider>')
  return ctx
}