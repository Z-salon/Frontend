import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import type { BrandingPayload } from '../../types/api'
import type { BookingStep } from '../screens/Booking'

interface BookingDraft {
  branchId: string | null
  serviceId: string | null
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
}

interface BookingContextValue {
  businessId: string
  branding: BrandingPayload
  step: BookingStep
  setStep: (s: BookingStep) => void
  draft: BookingDraft
  updateDraft: (patch: Partial<BookingDraft>) => void
  resetDraft: () => void
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

  const value = useMemo<BookingContextValue>(
    () => ({
      businessId,
      branding,
      step,
      setStep,
      draft,
      updateDraft,
      resetDraft,
    }),
    [businessId, branding, step, draft, updateDraft, resetDraft],
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