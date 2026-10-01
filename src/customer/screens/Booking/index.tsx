import { useEffect } from 'react'
import { useBranding } from '../../hooks/useBranding'
import { themeStyle } from '../../hooks/UseTheme'
import { Link, navigate } from '../../router'
import { BookingProvider, useBooking } from '../../context/BookingContext'
import { StepDots } from './StepDots'
import { StepBranch } from './StepBranch'
import { StepService } from './StepService'
import { StepDate } from './StepDate'
import { StepSlot } from './StepSlot'
import { StepContact } from './StepContact'
import { StepDone } from './StepDone'

type Step = 'branch' | 'service' | 'date' | 'slot' | 'contact' | 'done'

const STEP_ORDER: Step[] = ['branch', 'service', 'date', 'slot', 'contact', 'done']
const STEP_LABELS: Record<Step, string> = {
  branch:  'Location',
  service: 'Service',
  date:    'Date',
  slot:    'Time',
  contact: 'Details',
  done:    'Done',
}

export function Booking({ businessId }: { businessId: string }) {
  const { data: branding, loading, error } = useBranding(businessId)

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-bg">
        <p className="text-sm text-ink-3">Loading…</p>
      </div>
    )
  }

  if (error || !branding) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-bg gap-2 px-6 text-center">
        <h1 className="font-display text-xl text-ink">Page unavailable</h1>
        <p className="text-sm text-ink-3 max-w-md">
          {error ?? 'This booking page could not be loaded.'}
        </p>
      </div>
    )
  }

  return (
    <BookingProvider businessId={businessId} branding={branding}>
      <BookingShell businessId={businessId} />
    </BookingProvider>
  )
}

function BookingShell({ businessId }: { businessId: string }) {
  const { branding, step, setStep, draft, updateDraft } = useBooking()

  // On first mount, honour ?branch= from the URL if present.
  // Also clears downstream selections so a stale service/slot from a
  // different branch doesn't leak into this session.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const branchFromUrl = params.get('branch')
    if (branchFromUrl) {
      updateDraft({
        branchId: branchFromUrl,
        serviceId: null,
        staffId: null,
        slotStart: null,
        slotEnd: null,
      })
    }
    // Only run on mount — the URL is authoritative at entry, not after.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Guard against landing on a step whose prerequisites are missing.
  //
  // Rule: don't touch a step the user is already on. Only force them
  // BACK when a *later* step is missing its prerequisite.
  useEffect(() => {
    if (step === 'branch') return
    if (!draft.branchId) {
      setStep('branch')
      return
    }

    if (step === 'service') return
    if (!draft.serviceId) {
      setStep('service')
      return
    }

    if (step === 'date') return
    if (!draft.date) {
      setStep('date')
      return
    }

    if (step === 'slot') return
    if (!draft.slotStart) {
      setStep('slot')
      return
    }

    // 'contact' and 'done' have no additional prereqs beyond the above.
  }, [
    step,
    draft.branchId,
    draft.serviceId,
    draft.date,
    draft.slotStart,
    setStep,
  ])

  const businessName = branding.name?.trim() || 'Welcome'

  return (
    <div style={themeStyle(branding)} className="min-h-screen bg-bg text-ink">
      <header className="sticky top-0 z-30 backdrop-blur bg-bg/85 border-b border-line">
        <div className="max-w-3xl mx-auto flex items-center justify-between gap-3 px-5 sm:px-8 h-14">
          <Link
            to={`/book/${businessId}`}
            className="flex items-center gap-2 min-w-0 text-ink-3 hover:text-ink transition-colors text-sm"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M15 18l-6-6 6-6" />
            </svg>
            <span className="truncate">{businessName}</span>
          </Link>

          <span className="text-xs text-ink-3">Booking</span>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-5 sm:px-8 py-6 sm:py-10">
        <StepDots
          steps={STEP_ORDER.slice(0, 5)}
          labels={STEP_LABELS}
          current={step === 'done' ? 'contact' : step}
          onJump={s => setStep(s as Step)}
        />

        <div className="mt-8">
          {step === 'branch'  && <StepBranch />}
          {step === 'service' && <StepService />}
          {step === 'date'    && <StepDate />}
          {step === 'slot'    && <StepSlot />}
          {step === 'contact' && <StepContact />}
          {step === 'done'    && <StepDone />}
        </div>
      </div>
    </div>
  )
}

export type BookingStep = Step