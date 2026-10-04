import { useEffect, useState } from 'react'
import type { Appointment, AppointmentStatus } from '../../types/api'
import { publicApi } from '../../api/public.api'
import { useBranding } from '../hooks/useBranding'
import { useFeedbackToken } from '../hooks/useFeedbackToken'
import { navigate } from '../router'
import { BrandTheme } from '../components/BrandTheme'
import { FlowHeader } from '../components/SiteChrome'
import { Button, Card, DetailRow, Modal, Pill, Textarea } from '../components/ui'
import {
  IconAlert,
  IconCalendar,
  IconCheckCircle,
  IconClock,
  IconHeart,
  IconPhone,
  IconScissors,
  IconSparkle,
  IconUser,
} from '../components/icons'
import {
  extractErrorMessage,
  formatDateLong,
  formatDuration,
  formatTimeRange,
  formatPrice,
} from '../utils/format'

type Phase = 'loading' | 'ready' | 'confirmed' | 'cancelled' | 'error'

/**
 * The SMS link can be opened long after the customer replied, so the
 * initial view has to be derived from the appointment's real status
 * rather than always assuming "awaiting confirmation".
 */
function phaseForStatus(status: AppointmentStatus): Phase {
  if (status === 'CANCELLED' || status === 'EXPIRED' || status === 'NO_SHOW') {
    return 'cancelled'
  }
  if (
    status === 'CONFIRMED' ||
    status === 'CHECKED_IN' ||
    status === 'IN_PROGRESS' ||
    status === 'COMPLETED'
  ) {
    return 'confirmed'
  }
  return 'ready'
}

/**
 * Muted, on-brand status treatment. Mirrors the admin palette so the
 * same appointment never changes colour between the two apps.
 */
const STATUS_TONES: Record<AppointmentStatus, { label: string; pill: 'ok' | 'warn' | 'bad' | 'brand' | 'neutral' }> = {
  PENDING: { label: 'Awaiting confirmation', pill: 'warn' },
  CONFIRMED: { label: 'Confirmed', pill: 'ok' },
  CHECKED_IN: { label: 'Checked in', pill: 'brand' },
  IN_PROGRESS: { label: 'In progress', pill: 'brand' },
  COMPLETED: { label: 'Completed', pill: 'neutral' },
  CANCELLED: { label: 'Cancelled', pill: 'bad' },
  NO_SHOW: { label: 'No show', pill: 'bad' },
  EXPIRED: { label: 'Expired', pill: 'neutral' },
}

export function Confirmation({ token }: { token: string }) {
  const [phase, setPhase] = useState<Phase>('loading')
  const [appt, setAppt] = useState<Appointment | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [cancelOpen, setCancelOpen] = useState(false)
  const [cancelReason, setCancelReason] = useState('')

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const res = await publicApi.viewConfirmation(token)
        if (!cancelled) {
          setAppt(res)
          setPhase(phaseForStatus(res.status))
        }
      } catch (err) {
        if (cancelled) return
        setError(extractErrorMessage(err, 'This link is invalid or has expired.'))
        setPhase('error')
      }
    })()
    return () => { cancelled = true }
  }, [token])

  // The token payload carries the business id, so the confirmation page
  // can pick up the salon's own colours and logo. Resolves from the
  // module-level cache when the customer came straight from booking.
  const { data: branding } = useBranding(appt?.businessId ?? null)

  // Feedback tokens are minted by the backend after the visit and never
  // appear on the appointment, so this resolves one only if the salon's
  // link carried it or the customer opened a feedback form before.
  const { token: feedbackToken } = useFeedbackToken(appt?.businessId ?? null)

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
    const reason = cancelReason.trim() || undefined
    setBusy(true)
    try {
      const res = await publicApi.cancelConfirmation(token, reason)
      setAppt(res)
      setPhase('cancelled')
      setCancelOpen(false)
    } catch (err) {
      setError(extractErrorMessage(err, 'Could not cancel the appointment.'))
      setPhase('error')
      setCancelOpen(false)
    } finally {
      setBusy(false)
    }
  }

  if (phase === 'loading') {
    return (
      <BrandTheme branding={null}>
        <LoadingPanel label="Finding your appointment" />
      </BrandTheme>
    )
  }

  if (phase === 'error' || !appt) {
    return (
      <BrandTheme branding={null}>
        <div className="flex min-h-screen flex-col items-center justify-center gap-3 px-6 text-center">
          <div className="mb-2 flex h-16 w-16 items-center justify-center rounded-2xl bg-bad-soft text-bad">
            <IconAlert className="h-6 w-6" />
          </div>
          <h1 className="font-display text-3xl leading-tight tracking-tight text-ink">
            This link has expired
          </h1>
          <p className="max-w-sm text-[15px] leading-relaxed text-ink-2">
            {error ?? 'Confirmation links are valid for a limited time. Book again or call the salon to sort it out.'}
          </p>
        </div>
      </BrandTheme>
    )
  }

  const start = new Date(appt.scheduledStart)
  const end = new Date(appt.scheduledEnd)
  const status = STATUS_TONES[appt.status] ?? {
    label: appt.status.toLowerCase().replace(/_/g, ' '),
    pill: 'neutral' as const,
  }
  const businessName = branding?.name?.trim() || 'the salon'

  return (
    <BrandTheme branding={branding}>
      <div className="flex min-h-screen flex-col">
        <FlowHeader
          branding={branding}
          backTo={`/book/${appt.businessId}`}
          backLabel={businessName}
        />

        <main className="mx-auto w-full max-w-lg flex-1 px-5 py-10 sm:px-6 sm:py-14">
          <PhaseBanner phase={phase} statusLabel={status.label} />

          <Card className="mt-8" padded={false}>
            <div
              className="border-b border-line px-6 py-6"
              style={{ background: 'var(--brand-soft)' }}
            >
              <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[color:var(--brand-accent)]">
                {formatDateLong(start)}
              </p>
              <p className="mt-2 font-display text-3xl leading-none tracking-tight text-ink">
                {formatTimeRange(start, end)}
              </p>
              {appt.service.durationMinutes > 0 && (
                <p className="mt-2.5 flex items-center gap-2 text-sm text-ink-2">
                  <IconClock className="h-4 w-4 text-ink-3" />
                  {formatDuration(appt.service.durationMinutes)} appointment
                </p>
              )}
            </div>

            <div className="flex flex-col gap-5 p-6">
              <DetailRow
                icon={<IconScissors className="h-4 w-4" />}
                label="Service"
                value={<span className="font-medium">{appt.service.name}</span>}
              />
              {appt.staff && (
                <DetailRow
                  icon={<IconUser className="h-4 w-4" />}
                  label="With"
                  value={`${appt.staff.firstName} ${appt.staff.lastName}`.trim()}
                />
              )}
              {appt.notes && (
                <DetailRow
                  icon={<IconPhone className="h-4 w-4" />}
                  label="Your note"
                  value={appt.notes}
                />
              )}

              <div className="flex flex-wrap items-center gap-2 border-t border-line pt-5">
                <Pill tone={status.pill}>{status.label}</Pill>
                {appt.service.price && appt.service.price !== '0' && (
                  <Pill>{formatPrice(appt.service.price, branding?.currency)}</Pill>
                )}
              </div>
            </div>
          </Card>

          {phase === 'ready' && (
            <div className="mt-7 flex flex-col gap-2.5 sm:flex-row">
              <Button
                onClick={handleConfirm}
                loading={busy}
                fullWidth
                iconLeft={<IconCheckCircle className="h-4 w-4" />}
              >
                {busy ? 'Confirming…' : 'Yes, I will be there'}
              </Button>
              <Button
                variant="danger"
                onClick={() => setCancelOpen(true)}
                disabled={busy}
                fullWidth
              >
                Cancel appointment
              </Button>
            </div>
          )}

          {phase === 'confirmed' && (
            <p className="mt-7 flex items-start gap-2.5 rounded-xl border border-line bg-surface px-4 py-3.5 text-sm leading-relaxed text-ink-2">
              <IconSparkle className="mt-0.5 h-4 w-4 flex-shrink-0 text-[color:var(--brand-accent)]" />
              <span>
                Thanks {appt.customer?.firstName ?? 'for confirming'} —{' '}
                {businessName} has you in the book. You can close this page.
              </span>
            </p>
          )}

          {phase === 'cancelled' && (
            <p className="mt-7 flex items-start gap-2.5 rounded-xl border border-line bg-surface px-4 py-3.5 text-sm leading-relaxed text-ink-2">
              <IconCalendar className="mt-0.5 h-4 w-4 flex-shrink-0 text-ink-3" />
              <span>
                Your slot has been released. Whenever you are ready, book again in a
                couple of taps.
              </span>
            </p>
          )}

          {appt.status === 'COMPLETED' && (
            <FeedbackInvite
              businessName={businessName}
              token={feedbackToken}
            />
          )}

        </main>

        <Modal
          open={cancelOpen}
          onClose={() => setCancelOpen(false)}
          title="Cancel this appointment?"
          description="The slot will be released straight away. This cannot be undone from this page."
          footer={
            <>
              <Button
                variant="danger"
                onClick={handleCancel}
                loading={busy}
                fullWidth
              >
                {busy ? 'Cancelling…' : 'Yes, cancel it'}
              </Button>
              <Button
                variant="ghost"
                onClick={() => setCancelOpen(false)}
                disabled={busy}
                fullWidth
              >
                Keep my appointment
              </Button>
            </>
          }
        >
          <Textarea
            label="Reason (optional)"
            value={cancelReason}
            onChange={e => setCancelReason(e.target.value)}
            rows={3}
            placeholder="Something came up…"
            autoFocus
          />
        </Modal>
      </div>
    </BrandTheme>
  )
}

/* ------------------------------------------------------------------ */
/*  Local pieces                                                       */
/* ------------------------------------------------------------------ */

/**
 * Post-visit feedback prompt.
 *
 * The backend only accepts feedback for a COMPLETED appointment, and the
 * token lives in the salon's SMS rather than the appointment payload. So
 * this is a real button whenever we hold a token, and an honest
 * explanation when we don't — never a link that would 404.
 */
function FeedbackInvite({
  businessName,
  token,
}: {
  businessName: string
  token: string | null
}) {
  return (
    <Card className="mt-7" padded={false}>
      <div
        className="flex flex-col items-center gap-4 px-6 py-7 text-center"
        style={{ background: 'var(--brand-soft)' }}
      >
        <span
          className="flex h-11 w-11 items-center justify-center rounded-full"
          style={{
            background: 'var(--brand-primary)',
            color: 'var(--brand-on-primary)',
          }}
          aria-hidden="true"
        >
          <IconHeart className="h-5 w-5" filled />
        </span>

        <div>
          <h2 className="font-display text-xl leading-tight text-ink">
            How was your visit?
          </h2>
          <p className="mx-auto mt-2 max-w-sm text-[14px] leading-relaxed text-ink-2">
            {token
              ? `Tell ${businessName} what you thought. It takes about a minute and it genuinely helps.`
              : `${businessName} will text you a short feedback link once your appointment is closed. It stays open for a week.`}
          </p>
        </div>

        {token && (
          <Button
            onClick={() => navigate(`/feedback/${token}`)}
            iconLeft={<IconHeart className="h-4 w-4" filled />}
          >
            Leave feedback
          </Button>
        )}
      </div>
    </Card>
  )
}

function PhaseBanner({
  phase,
  statusLabel,
}: {
  phase: Phase
  statusLabel: string
}) {
  const copy: Record<Exclude<Phase, 'loading' | 'error'>, { eyebrow: string; title: string; body: string }> = {
    ready: {
      eyebrow: 'Action needed',
      title: 'Can you make it?',
      body: 'Please let the salon know so they can hold your chair.',
    },
    confirmed: {
      eyebrow: 'All set',
      title: 'See you soon',
      body: 'Your appointment is confirmed.',
    },
    cancelled: {
      eyebrow: 'Cancelled',
      title: 'Your slot is free',
      body: 'No hard feelings — you are welcome back any time.',
    },
  }

  const c = copy[phase as Exclude<Phase, 'loading' | 'error'>]
  if (!c) return null

  return (
    <div className="text-center">
      <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-[color:var(--brand-accent)]">
        {c.eyebrow}
      </p>
      <h1 className="mt-3 font-display text-4xl leading-tight tracking-tight text-ink">
        {c.title}
      </h1>
      <p className="mx-auto mt-3 max-w-xs text-[15px] leading-relaxed text-ink-2">
        {c.body}
      </p>
      {phase === 'ready' && (
        <p className="mt-4 inline-flex">
          <Pill tone="warn">{statusLabel}</Pill>
        </p>
      )}
    </div>
  )
}

function LoadingPanel({ label }: { label: string }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-5">
      <div className="relative flex h-16 w-16 items-center justify-center">
        <span className="absolute inset-0 rounded-full border border-line" />
        <span className="absolute inset-0 animate-spin rounded-full border-2 border-transparent border-t-ink" />
        <IconCalendar className="h-5 w-5 text-ink-3" />
      </div>
      <p className="animate-shimmer text-sm tracking-wide text-ink-3">{label}…</p>
    </div>
  )
}
