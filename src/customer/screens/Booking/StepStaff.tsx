import { useBooking } from '../../context/BookingContext'
import { Button, Pill, Skeleton } from '../../components/ui'
import { StepFrame, StepNotice } from './StepFrame'
import { useEligibleStaff } from './useEligibleStaff'
import {
  IconAlert,
  IconArrowLeft,
  IconCalendar,
  IconChevronRight,
  IconClock,
  IconScissors,
  IconUser,
} from '../../components/icons'
import { formatDateLong, formatIsoTime } from '../../utils/format'

/**
 * Stylist picker, shown only for services configured `CUSTOMER_CHOOSES`.
 *
 * Runs after the date because that is the granularity the backend exposes
 * eligibility at: the roster comes from the availability response for
 * (branch, service, date). Each stylist carries their open-slot count so
 * the customer can see who actually has room before committing.
 */
export function StepStaff() {
  const { businessId, draft, updateDraft, setStep, requiresStaffChoice } = useBooking()
  const { loading, error, staff, retry } = useEligibleStaff({
    businessId,
    branchId: draft.branchId,
    serviceId: draft.serviceId,
    date: draft.date,
  })

  function pick(id: string, name: string) {
    // The stylist and the time are chosen together — a new stylist
    // invalidates whatever slot the customer had highlighted.
    updateDraft({ staffId: id, staffName: name, slotStart: null, slotEnd: null })
    setStep('slot')
  }

  const subtitle = draft.date
    ? `${formatDateLong(draft.date)} · ${draft.serviceName ?? 'your service'}`
    : 'Pick a date first.'

  // SAFETY: this step should be unreachable for salon-assigns and
  // any-available services. If it ever renders, hand the customer back
  // to the time step rather than trapping them here.
  if (!requiresStaffChoice) {
    return (
      <StepFrame title="Pick a time" subtitle={subtitle}>
        <StepNotice
          icon={<IconScissors className="h-6 w-6" />}
          title="No stylist needed"
          body="This service does not ask you to choose who provides it."
          action={<Button onClick={() => setStep('slot')}>Continue</Button>}
        />
      </StepFrame>
    )
  }

  if (loading) {
    return (
      <StepFrame title="Finding stylists" subtitle={subtitle}>
        <div className="flex flex-col gap-2.5">
          {[0, 1, 2].map(i => (
            <Skeleton key={i} className="h-[4.75rem]" />
          ))}
        </div>
      </StepFrame>
    )
  }

  if (error) {
    return (
      <StepFrame title="Something went wrong" subtitle={subtitle}>
        <StepNotice
          icon={<IconAlert className="h-6 w-6" />}
          title="We couldn't load the team"
          body={error}
          action={
            <div className="flex flex-wrap justify-center gap-2.5">
              <Button onClick={retry}>Try again</Button>
              <Button variant="outline" onClick={() => setStep('date')}>
                Pick another date
              </Button>
            </div>
          }
        />
      </StepFrame>
    )
  }

  if (staff.length === 0) {
    return (
      <StepFrame title="Nobody free that day" subtitle={subtitle}>
        <StepNotice
          icon={<IconCalendar className="h-6 w-6" />}
          title="No one is available"
          body="Every stylist is already booked for this service on this date. Try the next day."
          action={<Button onClick={() => setStep('date')}>Pick another date</Button>}
        />
      </StepFrame>
    )
  }

  return (
    <StepFrame title="Who would you like?" subtitle={subtitle}>
      <p className="mb-6 max-w-lg text-[15px] leading-relaxed text-ink-3">
        Pick a stylist and we will show you only the times they are free.
      </p>

      <div className="flex flex-col gap-2.5" role="radiogroup" aria-label="Choose a stylist">
        {staff.map(member => {
          const name = `${member.firstName} ${member.lastName}`.trim()
          const first = member.firstName?.trim()

          return (
            <button
              key={member.id}
              type="button"
              role="radio"
              aria-checked={false}
              onClick={() => pick(member.id, name)}
              className="focus-ring group flex items-center gap-4 rounded-2xl border border-line bg-surface px-4 py-4 text-left transition-[transform,border-color,box-shadow] duration-200 hover:-translate-y-px hover:border-warm hover:shadow-card sm:px-5"
            >
              <span
                className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full font-display text-lg"
                style={{
                  background: 'var(--brand-soft-strong)',
                  color: 'var(--brand-accent)',
                  boxShadow: `inset 0 0 0 1px var(--brand-line)`,
                }}
                aria-hidden="true"
              >
                {first?.charAt(0).toUpperCase() || <IconUser className="h-5 w-5" />}
              </span>

              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium leading-snug text-ink">
                  {name}
                </span>
                <span className="mt-1.5 flex flex-wrap items-center gap-1.5">
                  <Pill>
                    <IconClock className="h-3 w-3" />
                    {member.slotCount} {member.slotCount === 1 ? 'time' : 'times'} open
                  </Pill>
                  <span className="text-[11px] text-ink-3">
                    from {formatIsoTime(member.firstStartTime)}
                  </span>
                </span>
              </span>

              <IconChevronRight
                className="h-4 w-4 flex-shrink-0 text-line transition-colors group-hover:text-ink-3"
                aria-hidden="true"
              />
            </button>
          )
        })}
      </div>

      <div className="mt-7">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setStep('date')}
          iconLeft={<IconArrowLeft className="h-3.5 w-3.5" />}
        >
          Change date
        </Button>
      </div>
    </StepFrame>
  )
}