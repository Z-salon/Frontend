import { useMemo, useState } from 'react'
import { useBooking } from '../../context/BookingContext'
import type { AvailabilitySlot } from '../../../api/availability.api'
import { Button, Pill, Skeleton } from '../../components/ui'
import { StepFrame, StepNotice } from './StepFrame'
import { useEligibleStaff } from './useEligibleStaff'
import {
  IconAlert,
  IconArrowLeft,
  IconClock,
  IconScissors,
  IconSparkle,
} from '../../components/icons'
import {
  DAY_PARTS,
  dayPartOf,
  formatDateLong,
  formatIsoTime,
  formatTimezone,
  type DayPart,
} from '../../utils/format'

/**
 * Ensures `scheduledStart` is always a full ISO 8601 string with a
 * timezone (Z or ±HH:MM) and seconds. The backend validates it with
 * `z.string().datetime()` which rejects:
 *   - "2026-10-24T09:00"        (no seconds)
 *   - "2026-10-24 09:00:00"     (space separator)
 *   - "09:00"                   (time only)
 *
 * We normalize defensively here so a backend response that's slightly
 * off-spec doesn't blow up at booking-submit time.
 */
function normalizeToIso(input: string, tz: string): string {
  // Already full ISO with seconds and offset/Z — accept as-is.
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/.test(input)) {
    return input
  }

  // Missing seconds but has offset or Z: "2026-10-24T09:00+03:00"
  const withSeconds = input.replace(
    /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2})(\.\d+)?(Z|[+-]\d{2}:\d{2})?$/,
    (_, base, frac, offset) => {
      const useOffset = offset ?? offsetFor(tz)
      const useFrac = frac ?? '.000'
      return `${base}:00${useFrac}${useOffset}`
    },
  )
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/.test(withSeconds)) {
    return withSeconds
  }

  // Nothing we recognize. Throw so we notice in dev rather than sending
  // garbage to the server.
  throw new Error(`Unrecognized slot time format: ${input}`)
}

/**
 * Cheap "now"-based offset lookup for a small set of IANA zones.
 * We only need this for the case where the backend sends a local time
 * without an offset. If the backend always sends an offset (per §4.1),
 * this path never runs.
 */
function offsetFor(tz: string): string {
  // Addis Ababa is UTC+3 year round (no DST) — the primary case.
  if (tz === 'Africa/Addis_Ababa' || tz === 'Africa/Asmara' || tz === 'Africa/Nairobi') {
    return '+03:00'
  }
  // Fallback: derive from the user's own timezone. This is a best-effort
  // guess and only used when the server omitted an offset.
  const off = -new Date().getTimezoneOffset() // minutes east of UTC
  const sign = off >= 0 ? '+' : '-'
  const hh = String(Math.floor(Math.abs(off) / 60)).padStart(2, '0')
  const mm = String(Math.abs(off) % 60).padStart(2, '0')
  return `${sign}${hh}:${mm}`
}


export function StepSlot() {
  const { businessId, draft, updateDraft, setStep, requiresStaffChoice } = useBooking()

  // For customer-chooses services the customer's own stylist scopes the
  // calendar. Otherwise the whole roster is queried and the slot carries
  // whoever is free, which is how salon-assigns / any-available behave.
  const scopedStaffId = requiresStaffChoice ? draft.staffId : null
  const { loading, error, slots, timezone, retry } = useEligibleStaff({
    businessId,
    branchId: draft.branchId,
    serviceId: draft.serviceId,
    date: draft.date,
    staffId: scopedStaffId,
  })

  // Slot normalisation can fail independently of the fetch, so keep it
  // separate from the hook's error.
  const [pickError, setPickError] = useState<string | null>(null)
  const message = pickError ?? error

  // Bucket the flat slot list into Morning / Afternoon / Evening. The
  // hour is read from the raw ISO string so the grouping matches the
  // salon's own wall clock, not the customer's device.
  const grouped = useMemo(() => {
    const buckets = new Map<DayPart, AvailabilitySlot[]>()
    for (const part of DAY_PARTS) buckets.set(part.key, [])
    for (const slot of slots) buckets.get(dayPartOf(slot.startTime))!.push(slot)
    return DAY_PARTS.map(part => ({ ...part, slots: buckets.get(part.key)! })).filter(
      g => g.slots.length > 0,
    )
  }, [slots])

  function pick(slot: AvailabilitySlot) {
    // Normalize the time to full ISO 8601 before storing on the draft.
    // This guarantees `scheduledStart` passes `z.string().datetime()`
    // regardless of whether the backend included seconds or an offset.
    let slotStart: string
    let slotEnd: string
    try {
      slotStart = normalizeToIso(slot.startTime, timezone)
      slotEnd = normalizeToIso(slot.serviceEndTime, timezone)
    } catch (err) {
      // Should never happen if the backend is well-behaved — but if it
      // does, fail visibly rather than sending a broken payload.
      // eslint-disable-next-line no-console
      console.error('[slot] could not normalize time', err, slot)
      setPickError('This time slot could not be booked. Please pick another.')
      return
    }

    updateDraft({
      slotStart,
      slotEnd,
      // For customer-chooses services the stylist is theirs to keep;
      // otherwise take whoever the slot offers.
      ...(scopedStaffId ? {} : { staffId: slot.staff[0]?.id ?? null }),
    })
    setStep('contact')
  }

  const subtitle = [
    draft.date ? formatDateLong(draft.date) : null,
    draft.staffName ? `with ${draft.staffName}` : null,
    timezone ? `times in ${formatTimezone(timezone)}` : null,
  ]
    .filter(Boolean)
    .join(' · ')

  if (loading) {
    return (
      <StepFrame title="Finding times" subtitle="Checking the calendar.">
        <div className="flex flex-col gap-6">
          {[0, 1].map(g => (
            <div key={g}>
              <Skeleton className="mb-3 h-3 w-24" />
              <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
                {[0, 1, 2, 3, 4, 5].map(i => (
                  <Skeleton key={i} className="h-[4.25rem]" />
                ))}
              </div>
            </div>
          ))}
        </div>
      </StepFrame>
    )
  }

  if (message && slots.length === 0) {
    return (
      <StepFrame
        title="Something went wrong"
        subtitle={message}
      >
        <StepNotice
          icon={<IconAlert className="h-6 w-6" />}
          title="We couldn't load times"
          body="The calendar did not respond. Try again, or pick another day."
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

  if (slots.length === 0) {
    // Reached most often by changing the date after picking a stylist, so
    // offer a way back to the roster as well as the calendar.
    const recovery = requiresStaffChoice ? (
      <div className="flex flex-wrap justify-center gap-2.5">
        <Button onClick={() => setStep('staff')} iconLeft={<IconScissors className="h-4 w-4" />}>
          Choose another stylist
        </Button>
        <Button variant="outline" onClick={() => setStep('date')}>
          Pick another date
        </Button>
      </div>
    ) : (
      <Button onClick={() => setStep('date')}>Pick another date</Button>
    )

    return (
      <StepFrame
        title={draft.staffName ? 'No times with this stylist' : 'No times left that day'}
        subtitle={subtitle}
      >
        <StepNotice
          icon={<IconClock className="h-6 w-6" />}
          title={draft.staffName ? `${draft.staffName} is fully booked` : 'Fully booked'}
          body={
            draft.staffName
              ? 'Every slot on this date is taken. Pick another stylist for this date, or try the next day.'
              : 'Every chair is taken on this date. Try the next day, or call the salon and we will see what we can do.'
          }
          action={recovery}
        />
      </StepFrame>
    )
  }

  return (
    <StepFrame
      title="Pick a time"
      subtitle={subtitle}
    >
      {message && (
        <p className="mb-6 flex items-start gap-2.5 rounded-xl border border-[#E8CBCB] bg-bad-soft px-4 py-3 text-sm leading-relaxed text-bad">
          <IconAlert className="mt-px h-4 w-4 flex-shrink-0" />
          <span>{message}</span>
        </p>
      )}

      <div className="flex flex-col gap-7">
        {grouped.map(group => (
          <div key={group.key}>
            <h2 className="mb-3 flex items-baseline gap-2.5">
              <span className="font-display text-lg text-ink">{group.label}</span>
              <span className="text-[11px] uppercase tracking-[0.18em] text-ink-3">
                {group.range}
              </span>
            </h2>

            <div
              className="grid grid-cols-2 gap-2.5 sm:grid-cols-3"
              role="radiogroup"
              aria-label={`${group.label} times`}
            >
              {group.slots.map((slot, i) => {
                const staffName = slot.staff[0]
                  ? `${slot.staff[0].firstName} ${slot.staff[0].lastName}`.trim()
                  : null

                return (
                  <button
                    key={`${slot.startTime}-${i}`}
                    type="button"
                    role="radio"
                    aria-checked="false"
                    onClick={() => pick(slot)}
                    className="focus-ring group flex flex-col items-start justify-center gap-0.5 rounded-xl border border-line bg-surface px-3.5 py-3 text-left transition-[transform,border-color,box-shadow] duration-200 hover:-translate-y-px hover:border-warm hover:shadow-card"
                  >
                    <span className="text-[15px] font-semibold tabular-nums text-ink">
                      {formatIsoTime(slot.startTime)}
                    </span>
                    {staffName ? (
                      <span className="truncate text-[11px] text-ink-3">with {staffName}</span>
                    ) : (
                      <span className="text-[11px] text-ink-3">Any available</span>
                    )}
                  </button>
                )
              })}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-7 flex flex-wrap items-center gap-3">
        <Pill tone="brand">
          <IconSparkle className="h-3 w-3" />
          {slots.length} {slots.length === 1 ? 'time' : 'times'} open
        </Pill>
        {requiresStaffChoice && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setStep('staff')}
            iconLeft={<IconScissors className="h-3.5 w-3.5" />}
          >
            Change stylist
          </Button>
        )}
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
