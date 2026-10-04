import { useEffect, useMemo, useState } from 'react'
import { availabilityApi, type AvailabilitySlot } from '../../../api/availability.api'
import { extractErrorMessage } from '../../utils/format'

interface EligibleStaff {
  id: string
  firstName: string
  lastName: string
  /** How many of the day's open slots this stylist can take. */
  slotCount: number
  firstStartTime: string
}

interface RosterState {
  loading: boolean
  error: string | null
  /** Every stylist who can take the service at this branch on this date. */
  staff: EligibleStaff[]
  slots: AvailabilitySlot[]
  timezone: string
  retry: () => void
}

/**
 * Who can actually take this service, on this date.
 *
 * There is no public staff-listing endpoint, so the roster is derived from
 * the availability response: each slot carries the staff members free at
 * that time, and the union of those across the day is the eligible set.
 * That also gives a free "how busy are they" signal to show the customer,
 * which matters because a stylist with three open slots is a much safer
 * pick than one with a single slot.
 *
 * Omit `staffId` to get the whole roster; pass one to get just that
 * stylist's bookable times.
 */
export function useEligibleStaff({
  businessId,
  branchId,
  serviceId,
  date,
  staffId,
}: {
  businessId: string
  branchId: string | null
  serviceId: string | null
  date: string | null
  staffId?: string | null
}): RosterState {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [slots, setSlots] = useState<AvailabilitySlot[]>([])
  const [timezone, setTimezone] = useState('')
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    if (!branchId || !serviceId || !date) return
    let cancelled = false
    setLoading(true)
    setError(null)

    ;(async () => {
      try {
        const res = await availabilityApi.slots(businessId, {
          branchId,
          serviceId,
          date,
          staffId: staffId ?? undefined,
          source: 'PUBLIC',
        })
        if (cancelled) return
        setSlots(res.availableSlots ?? [])
        setTimezone(res.timezone ?? '')
      } catch (err) {
        if (cancelled) return
        setSlots([])
        setError(extractErrorMessage(err, 'Could not load availability.'))
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [businessId, branchId, serviceId, date, staffId, attempt])

  const staff = useMemo<EligibleStaff[]>(() => {
    const byId = new Map<string, EligibleStaff>()
    for (const slot of slots) {
      for (const member of slot.staff) {
        const existing = byId.get(member.id)
        if (existing) {
          existing.slotCount += 1
        } else {
          byId.set(member.id, {
            id: member.id,
            firstName: member.firstName,
            lastName: member.lastName,
            slotCount: 1,
            firstStartTime: slot.startTime,
          })
        }
      }
    }
    // Most availability first — the roster doubles as a recommendation.
    return [...byId.values()].sort(
      (a, b) =>
        b.slotCount - a.slotCount ||
        a.firstStartTime.localeCompare(b.firstStartTime) ||
        `${a.lastName}${a.firstName}`.localeCompare(`${b.lastName}${b.firstName}`),
    )
  }, [slots])

  return { loading, error, staff, slots, timezone, retry: () => setAttempt(a => a + 1) }
}