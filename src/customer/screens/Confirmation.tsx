import { useEffect, useState } from 'react'
import type { Appointment } from '../../types/api'
import { publicApi } from '../../api/public.api'
import { Link } from '../router'

type Phase = 'loading' | 'ready' | 'confirmed' | 'cancelled' | 'error'

export function Confirmation({ token }: { token: string }) {
  const [phase, setPhase] = useState<Phase>('loading')
  const [appt, setAppt] = useState<Appointment | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const res = await publicApi.viewConfirmation(token)
        if (!cancelled) {
          setAppt(res)
          setPhase('ready')
        }
      } catch (err) {
        if (cancelled) return
        setError(extractErrorMessage(err, 'This link is invalid or has expired.'))
        setPhase('error')
      }
    })()
    return () => { cancelled = true }
  }, [token])

  async function handleConfirm() {
    setBusy(true)
    try {
      const res = await publicApi.confirm(token)
      setAppt(res)
      setPhase('confirmed')
    } catch (err) {
      setError(extractErrorMessage(err, 'Could not confirm the appointment.'))
      setPhase('error')
    } finally {
      setBusy(false)
    }
  }

  async function handleCancel() {
    const reason = window.prompt('Reason (optional):') ?? undefined
    setBusy(true)
    try {
      const res = await publicApi.cancelConfirmation(token, reason)
      setAppt(res)
      setPhase('cancelled')
    } catch (err) {
      setError(extractErrorMessage(err, 'Could not cancel the appointment.'))
      setPhase('error')
    } finally {
      setBusy(false)
    }
  }

  if (phase === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-bg">
        <p className="text-sm text-ink-3">Loading…</p>
      </div>
    )
  }

  if (phase === 'error' || !appt) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-bg gap-3 px-6 text-center">
        <h1 className="font-display text-2xl text-ink">Link unavailable</h1>
        <p className="text-sm text-ink-3 max-w-md">
          {error ?? 'This link is invalid or has expired.'}
        </p>
      </div>
    )
  }

  const start = new Date(appt.scheduledStart)
  const end = new Date(appt.scheduledEnd)

  return (
    <div className="min-h-screen bg-bg text-ink">
      <div className="max-w-lg mx-auto px-5 sm:px-6 py-12">
        {phase === 'ready' && (
          <>
            <h1 className="font-display text-2xl mb-1">Your appointment</h1>
            <p className="text-sm text-ink-3 mb-6">
              Please confirm you'll be there.
            </p>
          </>
        )}
        {phase === 'confirmed' && (
          <>
            <h1 className="font-display text-2xl mb-1">Confirmed ✓</h1>
            <p className="text-sm text-ink-3 mb-6">
              We look forward to seeing you.
            </p>
          </>
        )}
        {phase === 'cancelled' && (
          <>
            <h1 className="font-display text-2xl mb-1">Cancelled</h1>
            <p className="text-sm text-ink-3 mb-6">
              Your appointment has been cancelled.
            </p>
          </>
        )}

        <div className="bg-surface rounded-2xl border border-line p-5 mb-4">
          <p className="font-medium text-ink">{appt.service.name}</p>
          <p className="text-sm text-ink-3 mt-1">
            {formatDate(start)} · {formatTime(start)} – {formatTime(end)}
          </p>
          {appt.staff && (
            <p className="text-sm text-ink-3 mt-0.5">
              With {appt.staff.firstName} {appt.staff.lastName}
            </p>
          )}
          <p className="text-xs text-ink-3 mt-3">
            Status: {appt.status.toLowerCase().replace('_', ' ')}
          </p>
        </div>

        {phase === 'ready' && (
          <div className="flex flex-col sm:flex-row gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={handleConfirm}
              className="flex-1 h-11 rounded-xl text-sm font-medium bg-ink text-surface hover:bg-ink/90 disabled:opacity-50"
            >
              {busy ? 'Working…' : 'Confirm attendance'}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={handleCancel}
              className="flex-1 h-11 rounded-xl text-sm font-medium border border-line text-[#B03A3A] hover:bg-[#FBEDED] disabled:opacity-50"
            >
              Cancel appointment
            </button>
          </div>
        )}

        <p className="text-[11px] text-ink-3 mt-6 text-center">
          Powered by{' '}
          <a href="https://zsalon.com" className="text-ink-2 underline underline-offset-2">
            Z-Salon
          </a>
        </p>
      </div>
    </div>
  )
}

function formatDate(d: Date) {
  return d.toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  })
}
function formatTime(d: Date) {
  let h = d.getHours()
  const m = String(d.getMinutes()).padStart(2, '0')
  const suffix = h >= 12 ? 'PM' : 'AM'
  if (h === 0) h = 12
  else if (h > 12) h -= 12
  return `${h}:${m} ${suffix}`
}
function extractErrorMessage(err: unknown, fallback: string): string {
  const anyErr = err as any
  const data = anyErr?.response?.data ?? anyErr?.data ?? anyErr
  if (typeof data?.message === 'string') return data.message
  if (Array.isArray(data?.errors) && data.errors.length > 0) return String(data.errors[0])
  if (typeof anyErr?.message === 'string') return anyErr.message
  return fallback
}