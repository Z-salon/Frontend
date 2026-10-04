import { useBooking } from '../../context/BookingContext'
import { navigate } from '../../router'
import { Button, Card, DetailRow, Pill } from '../../components/ui'
import {
  IconCalendar,
  IconCheck,
  IconClock,
  IconMessage,
  IconPin,
  IconScissors,
  IconUser,
  IconSparkle,
} from '../../components/icons'
import {
  formatDateLong,
  formatDuration,
  formatIsoTime,
  formatPrice,
} from '../../utils/format'

export function StepDone() {
  const { businessId, branding, draft, resetDraft, setStep } = useBooking()

  const hasSlot = Boolean(draft.date && draft.slotStart)

  function bookAnother() {
    resetDraft()
    setStep('branch')
    window.scrollTo({ top: 0 })
  }

  return (
    <section className="animate-scale-in mx-auto max-w-xl text-center">
      <div className="relative mx-auto mb-7 flex h-20 w-20 items-center justify-center">
        <span
          className="absolute inset-0 rounded-full opacity-20"
          style={{ background: 'var(--brand-primary)' }}
          aria-hidden="true"
        />
        <span
          className="relative flex h-16 w-16 items-center justify-center rounded-full text-[color:var(--brand-on-primary)]"
          style={{ background: 'var(--brand-primary)' }}
          aria-hidden="true"
        >
          <IconCheck className="h-8 w-8" strokeWidth={2.2} />
        </span>
      </div>

      <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-[color:var(--brand-accent)]">
        <IconSparkle className="mr-1.5 inline h-3.5 w-3.5" />
        Appointment requested
      </p>
      <h1 className="mt-3 font-display text-4xl leading-tight tracking-tight text-ink">
        You&rsquo;re all set
      </h1>
      <p className="mx-auto mt-3 max-w-sm text-[15px] leading-relaxed text-ink-2">
        We&rsquo;ve sent the details to your phone. Use the link in that message to
        confirm, reschedule, or cancel if anything changes.
      </p>

      {hasSlot && (
        <Card className="mt-9 text-left" padded={false}>
          <div
            className="flex items-center justify-between gap-3 border-b border-line px-5 py-3.5"
            style={{ background: 'var(--brand-soft)' }}
          >
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[color:var(--brand-accent)]">
              Your appointment
            </p>
            {draft.serviceDurationMinutes ? (
              <Pill tone="brand">
                <IconClock className="h-3 w-3" />
                {formatDuration(draft.serviceDurationMinutes)}
              </Pill>
            ) : null}
          </div>

          <div className="flex flex-col gap-4 p-5">
            <DetailRow
              icon={<IconScissors className="h-4 w-4" />}
              label="Service"
              value={
                <>
                  <span className="block font-medium">{draft.serviceName}</span>
                  {draft.serviceCategoryName && (
                    <span className="mt-0.5 block text-xs text-ink-3">
                      {draft.serviceCategoryName}
                    </span>
                  )}
                </>
              }
            />
            <DetailRow
              icon={<IconPin className="h-4 w-4" />}
              label="Location"
              value={draft.branchName ?? '—'}
            />
            {draft.staffName && (
              <DetailRow
                icon={<IconUser className="h-4 w-4" />}
                label="Stylist"
                value={draft.staffName}
              />
            )}
            <DetailRow
              icon={<IconCalendar className="h-4 w-4" />}
              label="When"
              value={
                <>
                  <span className="block font-medium">{formatDateLong(draft.date!)}</span>
                  <span className="mt-0.5 block text-xs text-ink-3">
                    {formatIsoTime(draft.slotStart!)}
                  </span>
                </>
              }
            />
            {draft.serviceShowPrice &&
              draft.servicePrice &&
              draft.servicePrice !== '0' && (
                <DetailRow
                  icon={<IconClock className="h-4 w-4" />}
                  label="Price"
                  value={formatPrice(draft.servicePrice, branding.currency)}
                />
              )}
          </div>
        </Card>
      )}

      <p className="mt-6 flex items-start justify-center gap-2.5 text-left text-sm leading-relaxed text-ink-3">
        <IconMessage className="mt-0.5 h-4 w-4 flex-shrink-0 text-[color:var(--brand-accent)]" />
        <span className="max-w-sm">
          Keep an eye on your messages — they carry your confirmation, and after
          your visit a short link asking how it went. If you do not hear from us,
          call the salon and quote your name and time.
        </span>
      </p>

      <div className="mt-9 flex flex-col gap-2.5 sm:flex-row sm:justify-center">
        <Button
          onClick={() => navigate(`/book/${businessId}`)}
        >
          Back to {branding.name?.trim() || 'salon'}
        </Button>
        <Button variant="outline" onClick={bookAnother}>
          Book another
        </Button>
      </div>
    </section>
  )
}