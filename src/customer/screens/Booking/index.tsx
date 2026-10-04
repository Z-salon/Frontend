import { useEffect, useState } from 'react'
import { useBranding } from '../../hooks/useBranding'
import { BrandTheme } from '../../components/BrandTheme'
import { FlowHeader } from '../../components/SiteChrome'
import { MessageScreen } from '../../components/ui'
import { BookingProvider, useBooking } from '../../context/BookingContext'
import { StepProgress } from './StepProgress'
import { BookingSummary, MobileSummaryBar } from './BookingSummary'
import { StepBranch } from './StepBranch'
import { StepService } from './StepService'
import { StepDate } from './StepDate'
import { StepStaff } from './StepStaff'
import { StepSlot } from './StepSlot'
import { StepContact } from './StepContact'
import { StepPrepay } from './StepPrepay'
import { StepDone } from './StepDone'
import { STEP_LABELS, type BookingStep } from './steps'

export type { BookingStep } from './steps'

export function Booking({ businessId }: { businessId: string }) {
  const { data: branding, loading, error } = useBranding(businessId)

  if (loading) {
    return (
      <BrandTheme branding={branding}>
        <FlowSkeleton />
      </BrandTheme>
    )
  }

  if (error || !branding) {
    return (
      <BrandTheme branding={null}>
        <MessageScreen
          tone="error"
          eyebrow="Booking"
          title="Booking is unavailable"
          body={error ?? 'We could not load this salon right now. Please try again shortly.'}
        />
      </BrandTheme>
    )
  }

  return (
    <BrandTheme branding={branding}>
      <BookingProvider businessId={businessId} branding={branding}>
        <BookingShell businessId={businessId} />
      </BookingProvider>
    </BrandTheme>
  )
}

function BookingShell({ businessId }: { businessId: string }) {
  const {
    branding,
    step,
    setStep,
    draft,
    updateDraft,
    requiresStaffChoice,
    steps: railSteps,
  } = useBooking()
  const [summaryOpen, setSummaryOpen] = useState(false)

  // On first mount, honour ?branch= from the URL if present.
  // Also clears downstream selections so a stale service/slot from a
  // different branch doesn't leak into this session.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const branchFromUrl = params.get('branch')
    if (branchFromUrl) {
      updateDraft({
        branchId: branchFromUrl,
        branchName: null,
        serviceId: null,
        serviceName: null,
        serviceCategoryName: null,
        serviceDurationMinutes: null,
        servicePrice: null,
        staffId: null,
        staffName: null,
        slotStart: null,
        slotEnd: null,
      })
    }
    // Only run on mount — the URL is authoritative at entry, not after.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // The stylist step is only part of the flow for `CUSTOMER_CHOOSES`
  // services, so never leave the customer sitting on it otherwise.
  useEffect(() => {
    if (step === 'staff' && !requiresStaffChoice) setStep('slot')
  }, [step, requiresStaffChoice, setStep])

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

    // Only customer-chooses services need an explicit stylist.
    if (step === 'staff') return
    if (requiresStaffChoice && !draft.staffId) {
      setStep('staff')
      return
    }

    if (step === 'slot') return
    if (!draft.slotStart) {
      setStep('slot')
      return
    }

    // 'contact' has no additional prereqs beyond the ones above.
    if (step === 'contact') return

    // 'prepay' is only valid when the created appointment actually owes
    // a deposit. A deep-link, back-button, or stale draft could land
    // here — bounce to the right step rather than show a step with
    // nothing to collect.
    if (step === 'prepay') {
      if (!draft.appointmentId) {
        setStep('contact')
        return
      }
      if (!draft.requiresDeposit) {
        setStep('done')
        return
      }
      return
    }

    // 'done' is terminal — nothing further to guard.
  }, [
    step,
    draft.branchId,
    draft.serviceId,
    draft.date,
    draft.staffId,
    draft.slotStart,
    draft.appointmentId,
    draft.requiresDeposit,
    requiresStaffChoice,
    setStep,
  ])

  // Resolve the deep-linked branch's display name. Runs separately from
  // the mount effect because `branding` is still loading on first paint.
  useEffect(() => {
    if (!draft.branchId || draft.branchName) return
    const match = branding?.branches.find(b => b.id === draft.branchId)
    if (match) updateDraft({ branchName: match.name })
  }, [branding, draft.branchId, draft.branchName, updateDraft])

  // Close the mobile summary sheet whenever the customer advances.
  useEffect(() => {
    setSummaryOpen(false)
  }, [step])

  /**
   * Jump back to an earlier answer. The guard effect pushes the customer
   * forward again if they then try to skip a prerequisite, so a rail tap
   * always lands somewhere valid.
   */
  function jumpTo(target: BookingStep) {
    if (target === 'done') return
    setStep(target)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const isDone = step === 'done'

  return (
    <div className="flex min-h-screen flex-col bg-bg text-ink">
      <FlowHeader
        branding={branding}
        backTo={`/book/${businessId}`}
        backLabel="Back to salon"
        step={isDone ? undefined : STEP_LABELS[step]}
      />

      <main className="mx-auto w-full max-w-6xl flex-1 px-5 pb-8 pt-7 sm:px-8 sm:pb-12 sm:pt-10">
        {!isDone && (
          <StepProgress
            steps={railSteps}
            labels={STEP_LABELS}
            current={step}
            onJump={jumpTo}
          />
        )}

        <div
          className={[
            isDone
              ? 'flex flex-1 items-center justify-center'
              : 'mt-8 lg:grid lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start lg:gap-10',
          ].join(' ')}
        >
          <div className="min-w-0">
            {step === 'branch' && <StepBranch />}
            {step === 'service' && <StepService />}
            {step === 'date' && <StepDate />}
            {step === 'staff' && <StepStaff />}
            {step === 'slot' && <StepSlot />}
            {step === 'contact' && <StepContact />}
            {step === 'prepay' && <StepPrepay />}
            {step === 'done' && <StepDone />}
          </div>

          {!isDone && (
            <aside className="hidden lg:block">
              <div className="sticky top-24">
                <BookingSummary
                  onEdit={s => {
                    setStep(s)
                    window.scrollTo({ top: 0, behavior: 'smooth' })
                  }}
                />
              </div>
            </aside>
          )}
        </div>
      </main>

      {!isDone && (
        <>
          <div className="lg:hidden">
            <MobileSummaryBar onOpen={() => setSummaryOpen(true)} />
          </div>

          {summaryOpen && (
            <div className="fixed inset-0 z-50 flex items-end lg:hidden">
              <div
                className="animate-fade-in absolute inset-0 bg-ink/35 backdrop-blur-[3px]"
                onClick={() => setSummaryOpen(false)}
                aria-hidden="true"
              />
              <div className="animate-sheet-in relative max-h-[88vh] w-full overflow-y-auto rounded-t-3xl border-t border-line bg-bg p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-float">
                <div
                  className="mx-auto mb-4 h-1 w-10 rounded-full bg-line"
                  aria-hidden="true"
                />
                <BookingSummary
                  onEdit={s => {
                    setSummaryOpen(false)
                    setStep(s)
                  }}
                />
                <button
                  type="button"
                  onClick={() => setSummaryOpen(false)}
                  className="focus-ring mt-4 h-11 w-full rounded-xl border border-line bg-surface text-sm font-medium text-ink-2 transition-colors hover:bg-surface-2 active:scale-[0.99]"
                >
                  Keep editing
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}

/** Neutral placeholder so the frame does not jump once branding lands. */
function FlowSkeleton() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-bg">
      <div className="animate-shimmer flex items-center gap-2.5 text-sm text-ink-3">
        <span className="h-1.5 w-1.5 rounded-full bg-ink-3" />
        Preparing your booking…
      </div>
    </div>
  )
}