import { useEffect, useState } from 'react'
import { useBooking } from '../../context/BookingContext'
import { availabilityApi, type AvailabilitySlot } from '../../../api/availability.api'

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
  const { businessId, draft, updateDraft, setStep } = useBooking()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [slots, setSlots] = useState<AvailabilitySlot[]>([])
  const [timezone, setTimezone] = useState<string>('')

  useEffect(() => {
    if (!draft.branchId || !draft.serviceId || !draft.date) return
    let cancelled = false
    setLoading(true)
    setError(null)

    ;(async () => {
      try {
        const res = await availabilityApi.slots(businessId, {
          branchId: draft.branchId!,
          serviceId: draft.serviceId!,
          date: draft.date!,
          source: 'PUBLIC',
        })
        if (cancelled) return
        setSlots(res.availableSlots ?? [])
        setTimezone(res.timezone ?? '')
      } catch (err) {
        if (cancelled) return
        setError(extractErrorMessage(err, 'Could not load availability.'))
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()

    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [businessId, draft.branchId, draft.serviceId, draft.date])

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
      setError('This time slot could not be booked. Please pick another.')
      return
    }

    updateDraft({
      slotStart,
      slotEnd,
      staffId: slot.staff[0]?.id ?? null,
    })
    setStep('contact')
  }

  if (loading) {
    return (
      <section>
        <h2 className="font-display text-2xl mb-1">Finding times…</h2>
        <p className="text-sm text-ink-3">Checking availability.</p>
      </section>
    )
  }

  if (error) {
    return (
      <section>
        <h2 className="font-display text-2xl mb-1">Something went wrong</h2>
        <p className="text-sm text-ink-3 mb-4">{error}</p>
        <button
          type="button"
          onClick={() => setStep('date')}
          className="text-sm text-ink-2 underline underline-offset-2"
        >
          Pick another date
        </button>
      </section>
    )
  }

  if (slots.length === 0) {
    return (
      <section>
        <h2 className="font-display text-2xl mb-1">No times available</h2>
        <p className="text-sm text-ink-3 mb-4">
          There's nothing open on {draft.date}. Try a different day or call
          the salon.
        </p>
        <button
          type="button"
          onClick={() => setStep('date')}
          className="text-sm text-ink-2 underline underline-offset-2"
        >
          Pick another date
        </button>
      </section>
    )
  }

  return (
    <section>
      <h2 className="font-display text-2xl mb-1">Pick a time</h2>
      <p className="text-sm text-ink-3 mb-6">
        {formatDateLabel(draft.date!)}
        {timezone ? ` · times shown in ${timezone.replace('_', ' ')}` : ''}
      </p>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {slots.map((slot, i) => (
          <button
            key={i}
            type="button"
            onClick={() => pick(slot)}
            className="
              h-11 rounded-xl border border-line text-sm font-medium text-ink
              hover:border-warm hover:bg-warm-subtle transition-colors
              tabular-nums
            "
          >
            {formatSlotTime(slot.startTime)}
          </button>
        ))}
      </div>
    </section>
  )
}

/* ------------------------------------------------------------------ */
/*  Formatting                                                         */
/* ------------------------------------------------------------------ */

/**
 * The slot's `startTime` is ISO with the branch's offset (e.g.
 * "2026-09-24T09:00:00.000+03:00"). We extract the wall-clock time by
 * reading the offset-adjusted hours directly from the string rather
 * than the user's local Date, so the customer sees the same time
 * regardless of their device timezone.
 */
function formatSlotTime(iso: string): string {
  // Try to parse the "HH:mm" part straight from the ISO string first —
  // this preserves the branch's wall-clock time.
  const m = iso.match(/T(\d{2}):(\d{2})/)
  if (m) {
    let h = parseInt(m[1], 10)
    const min = m[2]
    const suffix = h >= 12 ? 'PM' : 'AM'
    if (h === 0) h = 12
    else if (h > 12) h -= 12
    return `${h}:${min} ${suffix}`
  }
  // Fallback: parse as a Date in the customer's local timezone.
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  let h = d.getHours()
  const min = String(d.getMinutes()).padStart(2, '0')
  const suffix = h >= 12 ? 'PM' : 'AM'
  if (h === 0) h = 12
  else if (h > 12) h -= 12
  return `${h}:${min} ${suffix}`
}

/** "2026-09-24" → "Wed, Sep 24" */
function formatDateLabel(isoDate: string): string {
  const m = isoDate.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!m) return isoDate
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
  return d.toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  })
}

function extractErrorMessage(err: unknown, fallback: string): string {
  const anyErr = err as any
  const data = anyErr?.response?.data ?? anyErr?.data ?? anyErr
  if (typeof data?.message === 'string') return data.message
  if (Array.isArray(data?.errors) && data.errors.length > 0) return String(data.errors[0])
  if (Array.isArray(data?.details) && data.details.length > 0) {
    const d = data.details[0]
    return d?.message ? `${d.field}: ${d.message}` : String(d)
  }
  if (typeof anyErr?.message === 'string') return anyErr.message
  return fallback
}