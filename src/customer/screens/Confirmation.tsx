// src/customer/screens/Confirmation.tsx

import { useEffect, useMemo, useState } from 'react'
import type { ConfirmationView, BrandingPayload } from '../../types/api'
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
  IconPin,
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
  formatTimezone,
} from '../utils/format'
import { isUrlAddress, mapsUrlFor } from '../lib/locations'

/* ------------------------------------------------------------------ */
/*  Phase                                                              */
/* ------------------------------------------------------------------ */

type Phase = 'loading' | 'action' | 'view' | 'cancelled' | 'past' | 'error'

function phaseFor(appt: ConfirmationView): Phase {
  if (
    appt.status === 'CANCELLED' ||
    appt.status === 'EXPIRED' ||
    appt.status === 'NO_SHOW'
  ) {
    return 'cancelled'
  }
  if (appt.status === 'COMPLETED') return 'past'

  // The server says the customer still needs to confirm. Trust it over
  // the raw status — this is what makes "Can you make it?" show for a
  // CONFIRMED slot the customer hasn't answered for yet.
  if (appt.actions.canConfirm) return 'action'

  return 'view'
}

/* ------------------------------------------------------------------ */
/*  Status pill tone                                                   */
/* ------------------------------------------------------------------ */

/**
 * The pill reflects the *customer's* confirmation state, not the slot's
 * lifecycle status.
 */
function confirmationTone(appt: ConfirmationView): {
  label: string
  pill: 'ok' | 'warn' | 'bad' | 'brand' | 'neutral'
} {
  if (appt.status === 'CANCELLED') return { label: 'Cancelled', pill: 'bad' }
  if (appt.status === 'NO_SHOW')   return { label: 'No show', pill: 'bad' }
  if (appt.status === 'EXPIRED')   return { label: 'Expired', pill: 'neutral' }
  if (appt.status === 'COMPLETED') return { label: 'Completed', pill: 'neutral' }

  switch (appt.confirmationStatus) {
    case 'PENDING':
      return { label: 'Awaiting your confirmation', pill: 'warn' }
    case 'CONFIRMED':
      return { label: 'Confirmed', pill: 'ok' }
    case 'DECLINED':
      return { label: 'Declined', pill: 'bad' }
    case 'EXPIRED':
      return { label: 'Confirmation expired', pill: 'neutral' }
  }
}

/* ------------------------------------------------------------------ */
/*  Synthetic branding fallback                                        */
/* ------------------------------------------------------------------ */

/**
 * The confirmation payload carries `businessName` but no `businessId`,
 * so `useBranding` can only resolve from its module-level cache. When
 * it misses, we build a minimal `BrandingPayload` from what we DO have
 * — the salon's name — so shared components (`BrandTheme`,
 * `FlowHeader`) render the salon's identity instead of a placeholder.
 *
 * Once the backend adds `businessId` (and ideally the full branding) to
 * the confirmation response, the cache miss becomes a rare edge case
 * and this fallback is only used if the branding fetch fails.
 */
function syntheticBranding(
  businessName: string,
  timezone: string | null,
): BrandingPayload {
  return {
    id: '',
    name: businessName,
    slug: '',
    currency: 'ETB',
    timezone: timezone ?? 'Africa/Addis_Ababa',
    logo: null,
    cover: null,
    primaryColor: null,
    secondaryColor: null,
    description: null,
    aboutUs: null,
    website: null,
    facebookUrl: null,
    instagramUrl: null,
    telegramUrl: null,
    tiktokUrl: null,
    branches: [],
    serviceCategories: [],
  }
}

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */

export function Confirmation({ token }: { token: string }) {
  const [phase, setPhase] = useState<Phase>('loading')
  const [appt, setAppt] = useState<ConfirmationView | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [cancelOpen, setCancelOpen] = useState(false)
  const [cancelReason, setCancelReason] = useState('')

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const res = await publicApi.viewConfirmation(token)
        if (cancelled) return
        setAppt(res)
        setPhase(phaseFor(res))
      } catch (err) {
        if (cancelled) return
        setError(
          extractErrorMessage(err, 'This link is invalid or has expired.'),
        )
        setPhase('error')
      }
    })()
    return () => {
      cancelled = true
    }
  }, [token])

  // Cache-only branding; falls back to a synthetic payload built from
  // the appointment's `businessName` so the header shows the real salon
  // even when the cache misses.
  const { data: cachedBranding } = useBranding(null)
  const { token: feedbackToken } = useFeedbackToken(null)

  const businessName =
    cachedBranding?.name?.trim() || appt?.businessName?.trim() || 'the salon'

  const branding = useMemo<BrandingPayload>(
    () =>
      cachedBranding ??
      syntheticBranding(businessName, appt?.branch?.timezone ?? null),
    [cachedBranding, businessName, appt?.branch?.timezone],
  )

  const branch = useMemo(() => (appt ? appt.branch : null), [appt])

  async function handleConfirm() {
    setBusy(true)
    try {
      const res = await publicApi.confirm(token)
      setAppt(res)
      setPhase(phaseFor(res))
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
      setPhase(phaseFor(res))
      setCancelOpen(false)
    } catch (err) {
      setError(extractErrorMessage(err, 'Could not cancel the appointment.'))
      setPhase('error')
      setCancelOpen(false)
    } finally {
      setBusy(false)
    }
  }

  /* ---------------- Loading / error ---------------- */

  if (phase === 'loading') {
    return (
      <BrandTheme branding={branding}>
        <LoadingPanel label="Finding your appointment" />
      </BrandTheme>
    )
  }

  if (phase === 'error' || !appt) {
    return (
      <BrandTheme branding={branding}>
        <div className="flex min-h-screen flex-col items-center justify-center gap-3 px-6 text-center">
          <div className="mb-2 flex h-16 w-16 items-center justify-center rounded-2xl bg-bad-soft text-bad">
            <IconAlert className="h-6 w-6" />
          </div>
          <h1 className="font-display text-3xl leading-tight tracking-tight text-ink">
            This link has expired
          </h1>
          <p className="max-w-sm text-[15px] leading-relaxed text-ink-2">
            {error ??
              'Confirmation links are valid for a limited time. Book again or call the salon to sort it out.'}
          </p>
          {branding.id && (
            <Button
              className="mt-4"
              onClick={() => navigate(`/book/${branding.id}`)}
            >
              Back to {branding.name}
            </Button>
          )}
        </div>
      </BrandTheme>
    )
  }

  /* ---------------- Derived ---------------- */

  const start = new Date(appt.scheduledStart)
  const end = new Date(appt.scheduledEnd)
  const status = confirmationTone(appt)
  const cover = branding.cover?.url
  const primaryPhone =
    branch?.phones?.find(p => p.isPrimary) ??
    branch?.phones?.[0] ??
    null

  const total = Number(appt.totalAmount || 0)

  return (
    <BrandTheme branding={branding}>
      <div className="flex min-h-screen flex-col">
        <FlowHeader
          branding={branding}
          backTo={branding.id ? `/book/${branding.id}` : '/'}
          backLabel={businessName}
        />

        <main className="mx-auto w-full max-w-lg flex-1 px-5 py-10 sm:px-6 sm:py-14">
          <PhaseBanner phase={phase} statusLabel={status.label} />

          {/* ── Appointment hero card ──────────────────────────────── */}
          <Card className="mt-8 overflow-hidden" padded={false}>
            <div className="relative isolate">
              {cover ? (
                <>
                  <img
                    src={cover}
                    alt=""
                    aria-hidden="true"
                    className="absolute inset-0 -z-20 h-full w-full object-cover"
                    loading="eager"
                    decoding="async"
                  />
                  <div
                    className="absolute inset-0 -z-10 bg-gradient-to-br from-ink/85 via-ink/60 to-ink/75"
                    aria-hidden="true"
                  />
                </>
              ) : (
                <div
                  className="absolute inset-0 -z-10"
                  style={{ background: 'var(--brand-soft)' }}
                  aria-hidden="true"
                />
              )}

              <div className="px-6 py-7">
                <p
                  className={`text-[10px] font-semibold uppercase tracking-[0.22em] ${
                    cover
                      ? 'text-white/70'
                      : 'text-[color:var(--brand-accent)]'
                  }`}
                >
                  {formatDateLong(start)}
                </p>
                <p
                  className={`mt-3 font-display text-3xl leading-none tracking-tight ${
                    cover ? 'text-white' : 'text-ink'
                  }`}
                >
                  {formatTimeRange(start, end)}
                </p>
                {appt.service.durationMinutes > 0 && (
                  <p
                    className={`mt-3 flex items-center gap-2 text-sm ${
                      cover ? 'text-white/80' : 'text-ink-2'
                    }`}
                  >
                    <IconClock className="h-4 w-4 flex-shrink-0 opacity-80" />
                    {formatDuration(appt.service.durationMinutes)} appointment
                  </p>
                )}
              </div>
            </div>

            <div className="flex flex-col gap-5 p-6">
              <DetailRow
                icon={<IconScissors className="h-4 w-4" />}
                label="Service"
                value={<span className="font-medium">{appt.service.name}</span>}
              />
              {appt.staffName && (
                <DetailRow
                  icon={<IconUser className="h-4 w-4" />}
                  label="With"
                  value={appt.staffName}
                />
              )}
              {branch && (
                <DetailRow
                  icon={<IconPin className="h-4 w-4" />}
                  label="Where"
                  value={
                    <span>
                      <span className="font-medium">{branch.name}</span>
                      {branch.address && !isUrlAddress(branch.address) && (
                        <>
                          <br />
                          <span className="text-ink-3">{branch.address}</span>
                        </>
                      )}
                    </span>
                  }
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
                {total > 0 && (
                  <Pill>{formatPrice(String(total), branding.currency)}</Pill>
                )}
              </div>
            </div>
          </Card>

          {/* ── Actions, driven entirely by the server's policy ───── */}
          {phase === 'action' && (
            <div className="mt-7 flex flex-col gap-2.5 sm:flex-row">
              {appt.actions.canConfirm && (
                <Button
                  onClick={handleConfirm}
                  loading={busy}
                  fullWidth
                  iconLeft={<IconCheckCircle className="h-4 w-4" />}
                >
                  {busy ? 'Confirming…' : 'Yes, I will be there'}
                </Button>
              )}
              {appt.actions.canCancel && (
                <Button
                  variant="danger"
                  onClick={() => setCancelOpen(true)}
                  disabled={busy}
                  fullWidth
                >
                  Cancel appointment
                </Button>
              )}
            </div>
          )}

          {phase === 'view' && (
            <div
              className="mt-7 flex items-start gap-3 rounded-2xl border border-line px-5 py-4 text-sm leading-relaxed text-ink-2"
              style={{ background: 'var(--brand-soft)' }}
            >
              <IconSparkle className="mt-0.5 h-4 w-4 flex-shrink-0 text-[color:var(--brand-accent)]" />
              <span>
                Thanks for confirming —{' '}
                <strong className="font-semibold text-ink">
                  {businessName}
                </strong>{' '}
                has you in the book. You can close this page.
              </span>
            </div>
          )}

          {phase === 'view' && appt.actions.canCancel && (
            <div className="mt-4 flex justify-center">
              <button
                type="button"
                onClick={() => setCancelOpen(true)}
                className="focus-ring text-sm text-ink-3 underline underline-offset-2 transition-colors hover:text-ink"
              >
                Cancel this appointment
              </button>
            </div>
          )}

          {phase === 'cancelled' && (
            <div className="mt-7 flex flex-col gap-4 rounded-2xl border border-line px-5 py-5 text-sm leading-relaxed text-ink-2">
              <div className="flex items-start gap-3">
                <IconCalendar className="mt-0.5 h-4 w-4 flex-shrink-0 text-ink-3" />
                <span>
                  Your slot has been released. Whenever you are ready, book
                  again in a couple of taps.
                </span>
              </div>
              {branding.id && (
                <Button
                  fullWidth
                  onClick={() => navigate(`/book/${branding.id}`)}
                >
                  Book another time
                </Button>
              )}
            </div>
          )}

          {phase === 'past' && (
            <div className="mt-7 flex items-start gap-3 rounded-2xl border border-line px-5 py-4 text-sm leading-relaxed text-ink-2">
              <IconSparkle className="mt-0.5 h-4 w-4 flex-shrink-0 text-[color:var(--brand-accent)]" />
              <span>
                Thanks for coming in to {businessName}. Hope it was a good
                one.
              </span>
            </div>
          )}

          {/* ── Where to find us ──────────────────────────────────── */}
          {branch && (
            <VisitInfo
              branch={branch}
              phone={primaryPhone?.phone ?? null}
              mapsUrl={mapsUrlFor(branch.address)}
            />
          )}

          {/* ── Feedback invite (past visits only) ────────────────── */}
          {phase === 'past' && (
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
/*  Visit info — mirrors the Locations card on the Landing page        */
/* ------------------------------------------------------------------ */

function VisitInfo({
  branch,
  phone,
  mapsUrl,
}: {
  branch: { name: string; address: string | null; timezone: string }
  phone: string | null
  mapsUrl: string | null
}) {
  return (
    <Card className="mt-7" padded={false}>
      <div className="border-b border-line px-6 py-5">
        <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[color:var(--brand-accent)]">
          Where to find us
        </p>
        <h2 className="mt-2 font-display text-xl leading-snug text-ink">
          {branch.name}
        </h2>
        {branch.address && !isUrlAddress(branch.address) && (
          <p className="mt-1.5 text-sm leading-relaxed text-ink-3">
            {branch.address}
          </p>
        )}
      </div>

      <div className="flex flex-col gap-3 px-6 py-5 text-sm">
        {phone && (
          <a
            href={`tel:${phone}`}
            className="focus-ring inline-flex w-fit items-center gap-2.5 rounded text-ink-2 transition-colors hover:text-ink"
          >
            <IconPhone className="h-4 w-4 flex-shrink-0 text-ink-3" />
            {phone}
          </a>
        )}
        {branch.timezone && (
          <span className="inline-flex items-center gap-2.5 text-ink-2">
            <IconClock className="h-4 w-4 flex-shrink-0 text-ink-3" />
            {formatTimezone(branch.timezone)}
          </span>
        )}
      </div>

      {mapsUrl && (
        <div className="border-t border-line px-6 py-5">
          <a
            href={mapsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="focus-ring inline-flex w-full items-center justify-center gap-1.5 rounded-xl border border-line px-4 py-2.5 text-sm font-semibold text-ink transition-colors hover:border-warm hover:text-[color:var(--brand-accent)]"
          >
            <IconPin className="h-4 w-4" />
            Open in Google Maps
            <span className="sr-only"> (opens in a new tab)</span>
          </a>
        </div>
      )}
    </Card>
  )
}

/* ------------------------------------------------------------------ */
/*  Feedback invite                                                    */
/* ------------------------------------------------------------------ */

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

/* ------------------------------------------------------------------ */
/*  Phase banner                                                       */
/* ------------------------------------------------------------------ */

function PhaseBanner({
  phase,
  statusLabel,
}: {
  phase: Phase
  statusLabel: string
}) {
  const copy: Record<
    Exclude<Phase, 'loading' | 'error'>,
    { eyebrow: string; title: string; body: string }
  > = {
    action: {
      eyebrow: 'Action needed',
      title: 'Can you make it?',
      body: 'Please let the salon know so they can hold your chair.',
    },
    view: {
      eyebrow: "You're in the book",
      title: 'See you soon',
      body: 'Your appointment is confirmed.',
    },
    cancelled: {
      eyebrow: 'Cancelled',
      title: 'Your slot is free',
      body: 'No hard feelings — you are welcome back any time.',
    },
    past: {
      eyebrow: 'Visit completed',
      title: 'Hope it went well',
      body: 'Thanks for coming in.',
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
      {phase === 'action' && (
        <p className="mt-4 inline-flex">
          <Pill tone="warn">{statusLabel}</Pill>
        </p>
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Loading                                                            */
/* ------------------------------------------------------------------ */

function LoadingPanel({ label }: { label: string }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-5">
      <div className="relative flex h-16 w-16 items-center justify-center">
        <span className="absolute inset-0 rounded-full border border-line" />
        <span className="absolute inset-0 animate-spin rounded-full border-2 border-transparent border-t-ink" />
        <IconCalendar className="h-5 w-5 text-ink-3" />
      </div>
      <p className="animate-shimmer text-sm tracking-wide text-ink-3">
        {label}…
      </p>
    </div>
  )
}