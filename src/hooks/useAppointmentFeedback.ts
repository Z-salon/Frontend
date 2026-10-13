import { useCallback, useEffect, useState } from 'react'
import { feedbackApi } from '../api/feedback.api'
import type { FeedbackSubmission } from '../types/api'

/* ------------------------------------------------------------------ */
/*  Appointment → feedback lookup (admin)                              */
/*                                                                     */
/*  The backend mints exactly one FeedbackRequest per appointment      */
/*  (`UNIQUE(appointment_id)`) when it reaches COMPLETED. The token is  */
/*  stored as a SHA-256 hash for lookup plus an AES-256-GCM encrypted   */
/*  copy so the shareable URL can be recovered for admin display.       */
/*                                                                     */
/*  This hook does two things:                                         */
/*    1. Fetches the shareable URL from the dedicated GET endpoint      */
/*       (`…/appointments/:id/feedback-request`). Read-only.            */
/*    2. Finds the submission (if any) for the appointment via the      */
/*       admin list, because the list query has no `appointment_id`     */
/*       filter — we narrow with a `submitted_at` window instead.       */
/*                                                                     */
/*  One honest caveat that is a property of the API, not a bug:         */
/*  anonymous submissions come back with `appointment: null`, so they   */
/*  cannot be attributed to any appointment. A customer who responds    */
/*  anonymously therefore reads as "awaiting" here even though their    */
/*  response is visible on the Feedback page.                           */
/* ------------------------------------------------------------------ */

const DAY_MS = 24 * 60 * 60 * 1000

/** Widest possible window between a visit and an expired request. */
const RESPONSE_WINDOW_DAYS = 60

export type AppointmentFeedbackState =
  /** Not applicable — the appointment isn't COMPLETED. */
  | 'inactive'
  | 'loading'
  /** No attributable response yet. See caveat above. */
  | 'awaiting'
  | 'received'
  /** Lookup failed — never block the panel on this. */
  | 'error'

export interface AppointmentFeedback {
  state: AppointmentFeedbackState
  submission: FeedbackSubmission | null
  /**
   * The customer-facing feedback URL, when the request exists. `null`
   * while loading, when the request 404s (appointment predates the
   * feature, or feedback was disabled at completion), or on fetch error.
   */
  url: string | null
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
 * Defensive unwrap for array payloads. `http` already returns `data`, but
 * some admin serializers nest the array one level deeper.
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
  const [url, setUrl] = useState<string | null>(null)
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
      setUrl(null)
      return
    }

    let cancelled = false
    setState('loading')

    void (async () => {
      // ── Fetch the shareable URL ─────────────────────────────────────
      //
      // Read-only. 404 just means no request exists for this appointment
      // (feature predates the visit, or feedback was disabled at
      // completion). We stay silent and leave `url` as null.
      try {
        const res = await feedbackApi.getRequest(businessId, appointmentId)
        if (cancelled) return
        const d: any = (res as any)?.data ?? res
        setUrl(d?.url ?? null)
      } catch {
        if (cancelled) return
        setUrl(null)
      }

      // ── Find the submission for this appointment ───────────────────
      //
      // The list has no `appointment_id` filter, so we narrow by date
      // window and match client-side. Anonymous submissions can't be
      // attributed — see the header comment.
      try {
        const win = scheduledStart ? windowFor(scheduledStart) : null
        const res = await feedbackApi.list(businessId, {
          limit: 100,
          ...(win ? { from_date: win.from, to_date: win.to } : {}),
        })
        if (cancelled) return

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

  return { state, submission, url, reload, resend }
}