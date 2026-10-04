import { useCallback, useEffect, useState } from 'react'
import { feedbackApi } from '../api/feedback.api'
import type { FeedbackSubmission } from '../types/api'

/* ------------------------------------------------------------------ */
/*  Appointment → feedback lookup (admin)                              */
/*                                                                     */
/*  The backend mints exactly one FeedbackRequest per appointment      */
/*  (`UNIQUE(appointment_id)`) when it reaches COMPLETED, and only     */
/*  stores the token's SHA-256 hash — so the raw link is unrecoverable */
/*  and cannot be shown here. What the admin CAN do is see whether the  */
/*  customer responded, and open that response.                        */
/*                                                                     */
/*  Two honest caveats, both properties of the API rather than bugs:   */
/*                                                                     */
/*  1. `FeedbackListQuery` has no `appointment_id` filter, so matching  */
/*     happens client-side. We narrow the query with a `submitted_at`  */
/*     date window instead of paging the whole business — a request is */
/*     created at completion and expires 7 days later, so a ±60 day    */
/*     window around the appointment covers every possible response.   */
/*  2. Anonymous submissions come back with `appointment: null`, so     */
/*     they cannot be attributed to any appointment. A customer who    */
/*     responds anonymously therefore reads as "awaiting" here even    */
/*     though their response is in the Feedback page.                  */
/* ------------------------------------------------------------------ */

const DAY_MS = 24 * 60 * 60 * 1000

/** Widest possible window between a visit and an expired request. */
const RESPONSE_WINDOW_DAYS = 60

export type AppointmentFeedbackState =
  /** Not applicable — the appointment isn't COMPLETED. */
  | 'inactive'
  | 'loading'
  /** No attributable response yet. See caveat 2 above. */
  | 'awaiting'
  | 'received'
  /** Lookup failed — never block the panel on this. */
  | 'error'

export interface AppointmentFeedback {
  state: AppointmentFeedbackState
  submission: FeedbackSubmission | null
  reload: () => void
  /**
   * Asks the backend to re-mint the token and re-send the link. Resolves to
   * whether the SMS was accepted, or `null` when it failed — the caller
   * reports that; the panel never blocks on it.
   *
   * The endpoint is proposed, not implemented, so this currently 404s. See
   * docs/FEEDBACK-RESEND-PROPOSAL.md.
   */
  resend: () => Promise<boolean | null>
}

/**
 * Defensive unwrap. `http` already returns `data`, but several admin
 * screens guard against serializers that nest the array one level deeper.
 */
function unwrapArray<T>(res: unknown): T[] {
  const anyRes = res as any
  if (Array.isArray(res)) return res as T[]
  if (Array.isArray(anyRes?.data)) return anyRes.data as T[]
  if (Array.isArray(anyRes?.items)) return anyRes.items as T[]
  return []
}

function windowFor(scheduledStart: string): { from: string; to: string } | null {
  const parsed = Date.parse(scheduledStart)
  if (Number.isNaN(parsed)) return null
  return {
    from: new Date(parsed - DAY_MS).toISOString(),
    to: new Date(parsed + RESPONSE_WINDOW_DAYS * DAY_MS).toISOString(),
  }
}

export function useAppointmentFeedback(
  businessId: string | undefined,
  appointment: { id: string; status: string; scheduledStart: string } | null,
): AppointmentFeedback {
  const [state, setState] = useState<AppointmentFeedbackState>('inactive')
  const [submission, setSubmission] = useState<FeedbackSubmission | null>(null)
  const [nonce, setNonce] = useState(0)

  const reload = useCallback(() => setNonce(n => n + 1), [])

  const appointmentId = appointment?.id ?? null
  const status = appointment?.status ?? null
  const scheduledStart = appointment?.scheduledStart ?? null

  useEffect(() => {
    // Feedback only exists once the appointment is closed out.
    if (!appointmentId || status !== 'COMPLETED' || !businessId) {
      setState('inactive')
      setSubmission(null)
      return
    }

    let cancelled = false
    setState('loading')

    void (async () => {
      try {
        const win = scheduledStart ? windowFor(scheduledStart) : null
        const res = await feedbackApi.list(businessId, {
          limit: 100,
          ...(win ? { from_date: win.from, to_date: win.to } : {}),
        })
        if (cancelled) return

        // One request per appointment, so at most one match.
        const match =
          unwrapArray<FeedbackSubmission>(res).find(
            s => s.appointment?.id === appointmentId,
          ) ?? null

        setSubmission(match)
        setState(match ? 'received' : 'awaiting')
      } catch {
        if (cancelled) return
        setSubmission(null)
        setState('error')
      }
    })()

    return () => {
      cancelled = true
    }
  }, [appointmentId, status, scheduledStart, businessId, nonce])

  const resend = useCallback(async (): Promise<boolean | null> => {
    if (!businessId || !appointmentId) return null
    try {
      const res = await feedbackApi.resendAppointment(businessId, appointmentId)
      const anyRes = res as any
      const delivered = anyRes?.data?.delivered ?? anyRes?.delivered
      return typeof delivered === 'boolean' ? delivered : true
    } catch {
      return null
    }
  }, [businessId, appointmentId])

  return { state, submission, reload, resend }
}