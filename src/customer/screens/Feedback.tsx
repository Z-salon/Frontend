import { useEffect, useMemo, useState } from 'react'
import type { FeedbackFormResponse } from '../../types/api'
import { http } from '../../api/http'
import { useBranding } from '../hooks/useBranding'
import { useFeedbackToken } from '../hooks/useFeedbackToken'
import { navigate } from '../router'
import { BrandTheme } from '../components/BrandTheme'
import {
  Button,
  Card,
  Logo,
  MessageScreen,
  PoweredBy,
  RatingInput,
  Textarea,
} from '../components/ui'
import {
  IconCheck,
  IconHeart,
  IconSparkle,
  IconX,
} from '../components/icons'
import { extractErrorMessage } from '../utils/format'

type Phase = 'loading' | 'ready' | 'submitted' | 'expired' | 'already' | 'error'

interface ResponseAnswer {
  category_id: string
  rating_value?: number
  text_response?: string
  boolean_response?: boolean
}

export function Feedback({ token }: { token: string }) {
  const [phase, setPhase] = useState<Phase>('loading')
  const [form, setForm] = useState<FeedbackFormResponse | null>(null)
  const [answers, setAnswers] = useState<Record<string, Partial<ResponseAnswer>>>({})
  const [isAnonymous, setIsAnonymous] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const res = await http.get<FeedbackFormResponse>(
          `/feedback/${token}`,
          { auth: false },
        )
        if (!cancelled) {
          setForm(res)
          setPhase('ready')
        }
      } catch (err) {
        if (cancelled) return
        const status = (err as any)?.response?.status ?? (err as any)?.status
        if (status === 410) setPhase('expired')
        else if (status === 409) setPhase('already')
        else {
          setError(extractErrorMessage(err, 'This link is invalid or has expired.'))
          setPhase('error')
        }
      }
    })()
    return () => { cancelled = true }
  }, [token])

  // Pull the salon's branding so this page matches the storefront the
  // guest booked from, even though it is opened from a bare SMS link.
  const { data: branding } = useBranding(form?.business.id ?? null)
  const businessName = form?.business.name?.trim() || branding?.name?.trim() || 'the salon'

  // Remember a working token so the confirmation page can offer one-tap
  // feedback access next time. Only once the form has actually loaded, so
  // an expired or already-used token is never cached.
  const { remember } = useFeedbackToken(form?.business.id ?? null)
  useEffect(() => {
    if (form) remember(token, form.business.id)
  }, [form, token, remember])

  const salonHref = form ? `/book/${form.business.id}` : null

  function setAnswer(catId: string, patch: Partial<ResponseAnswer>) {
    setAnswers(prev => ({
      ...prev,
      [catId]: { category_id: catId, ...prev[catId], ...patch },
    }))
  }

  const answeredCount = useMemo(() => {
    if (!form) return 0
    return form.categories.filter(cat => {
      const a = answers[cat.id]
      if (!a) return false
      if (cat.type === 'RATING') return typeof a.rating_value === 'number'
      if (cat.type === 'TEXT') return Boolean(a.text_response?.trim())
      return typeof a.boolean_response === 'boolean'
    }).length
  }, [answers, form])

  async function submit() {
    if (!form) return
    const responses: ResponseAnswer[] = []
    for (const cat of form.categories) {
      const a = answers[cat.id]
      if (!a) continue

      if (cat.type === 'RATING' && typeof a.rating_value === 'number') {
        responses.push({ category_id: cat.id, rating_value: a.rating_value })
      } else if (cat.type === 'TEXT' && a.text_response) {
        responses.push({ category_id: cat.id, text_response: a.text_response })
      } else if (cat.type === 'BOOLEAN' && typeof a.boolean_response === 'boolean') {
        responses.push({ category_id: cat.id, boolean_response: a.boolean_response })
      }
    }

    setBusy(true)
    try {
      await http.post(
        '/feedback/submit',
        { token, is_anonymous: isAnonymous, responses },
        { auth: false },
      )
      setPhase('submitted')
    } catch (err) {
      setError(extractErrorMessage(err, 'Could not submit feedback.'))
      setPhase('error')
    } finally {
      setBusy(false)
    }
  }

  if (phase === 'loading') {
    return (
      <BrandTheme branding={null}>
        <div className="flex min-h-screen flex-col items-center justify-center gap-5">
          <div className="relative flex h-16 w-16 items-center justify-center">
            <span className="absolute inset-0 rounded-full border border-line" />
            <span className="absolute inset-0 animate-spin rounded-full border-2 border-transparent border-t-ink" />
            <IconHeart className="h-5 w-5 text-ink-3" />
          </div>
          <p className="animate-shimmer text-sm tracking-wide text-ink-3">
            Loading your feedback form…
          </p>
        </div>
      </BrandTheme>
    )
  }

  if (phase === 'submitted') {
    return (
      <BrandTheme branding={branding}>
        <MessageScreen
          tone="success"
          eyebrow="Thank you"
          title="That means a lot"
          body={`${businessName} reads every response. We will use it to make the next visit even better.`}
          actions={
            salonHref ? (
              <Button onClick={() => navigate(salonHref)}>Book again</Button>
            ) : undefined
          }
        />
      </BrandTheme>
    )
  }

  if (phase === 'expired') {
    return (
      <BrandTheme branding={branding}>
        <MessageScreen
          tone="expired"
          eyebrow="Link expired"
          title="This link has timed out"
          body="Feedback requests stay open for a week. If you still have thoughts, mention them at your next visit."
        />
      </BrandTheme>
    )
  }

  if (phase === 'already') {
    return (
      <BrandTheme branding={branding}>
        <MessageScreen
          tone="info"
          eyebrow="All set"
          title="You have already shared"
          body="We have your feedback on file — no need to send it twice. Thank you."
        />
      </BrandTheme>
    )
  }

  if (phase === 'error' || !form) {
    return (
      <BrandTheme branding={branding}>
        <MessageScreen
          tone="error"
          eyebrow="Oops"
          title="We could not load this form"
          body={error ?? 'This feedback link could not be opened.'}
        />
      </BrandTheme>
    )
  }

  const total = form.categories.length
  const progress = total === 0 ? 0 : (answeredCount / total) * 100

  return (
    <BrandTheme branding={branding}>
      <div className="mx-auto w-full max-w-lg px-5 py-12 sm:px-6 sm:py-16">
        <header className="text-center">
          <div className="flex justify-center">
            <Logo url={branding?.logo?.url} name={businessName} size="lg" />
          </div>
          <p className="mt-6 text-[10px] font-semibold uppercase tracking-[0.24em] text-[color:var(--brand-accent)]">
            <IconSparkle className="mr-1.5 inline h-3.5 w-3.5" />
            Your visit
          </p>
          <h1 className="mt-3 font-display text-4xl leading-tight tracking-tight text-ink">
            How did we do?
          </h1>
          <p className="mx-auto mt-3 max-w-sm text-[15px] leading-relaxed text-ink-2">
            {businessName} would love a minute of your time. Be honest — it helps
            more than a compliment ever could.
          </p>
        </header>

        {total > 0 && (
          <div className="mt-9">
            <div className="mb-2 flex items-center justify-between text-[11px] font-semibold uppercase tracking-[0.16em] text-ink-3">
              <span>
                {answeredCount} of {total} answered
              </span>
              <span className="text-[color:var(--brand-accent)]">
                {Math.round(progress)}%
              </span>
            </div>
            <div className="h-1 overflow-hidden rounded-full bg-warm-subtle">
              <div
                className="h-full rounded-full transition-[width] duration-500 ease-out"
                style={{ width: `${progress}%`, background: 'var(--brand-primary)' }}
              />
            </div>
          </div>
        )}

        <div className="mt-7 flex flex-col gap-4">
          {form.categories.map(cat => (
            <Card key={cat.id}>
              <h2 className="font-display text-xl leading-snug text-ink">{cat.name}</h2>
              {cat.description && (
                <p className="mt-1.5 text-sm leading-relaxed text-ink-3">
                  {cat.description}
                </p>
              )}

              <div className="mt-5">
                {cat.type === 'RATING' && (
                  <RatingInput
                    min={cat.rating_scale_min ?? 1}
                    max={cat.rating_scale_max ?? 5}
                    value={answers[cat.id]?.rating_value}
                    onChange={v => setAnswer(cat.id, { rating_value: v })}
                  />
                )}

                {cat.type === 'TEXT' && (
                  <Textarea
                    value={answers[cat.id]?.text_response ?? ''}
                    onChange={e => setAnswer(cat.id, { text_response: e.target.value })}
                    rows={3}
                    placeholder="Anything you would like to add…"
                  />
                )}

                {cat.type === 'BOOLEAN' && (
                  <div className="grid grid-cols-2 gap-2.5" role="radiogroup" aria-label={cat.name}>
                    {[true, false].map(v => {
                      const active = answers[cat.id]?.boolean_response === v
                      return (
                        <button
                          key={String(v)}
                          type="button"
                          role="radio"
                          aria-checked={active}
                          onClick={() => setAnswer(cat.id, { boolean_response: v })}
                          className={`
                            focus-ring flex h-12 items-center justify-center gap-2 rounded-xl border
                            text-sm font-medium transition-all duration-200
                            ${
                              active
                                ? 'border-[color:var(--brand-primary)] text-[color:var(--brand-on-primary)] shadow-[0_8px_20px_-14px_rgba(var(--brand-rgb),0.9)]'
                                : 'border-line bg-surface text-ink-2 hover:border-warm'
                            }
                          `}
                          style={
                            active
                              ? { background: 'var(--brand-primary)' }
                              : undefined
                          }
                        >
                          {v ? (
                            <IconCheck className="h-4 w-4" strokeWidth={2.4} />
                          ) : (
                            <IconX className="h-4 w-4" />
                          )}
                          {v ? 'Yes' : 'No'}
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>
            </Card>
          ))}
        </div>

        <label
          className={`focus-within:outline-1 mt-4 flex cursor-pointer items-start gap-3.5 rounded-2xl border p-4 transition-colors ${
            isAnonymous
              ? 'border-[color:var(--brand-line)] bg-[color:var(--brand-soft)]'
              : 'border-line bg-surface hover:border-warm'
          }`}
        >
          <span
            className={`
              mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-md border transition-colors
              ${
                isAnonymous
                  ? 'border-transparent text-[color:var(--brand-on-primary)]'
                  : 'border-line text-transparent'
              }
            `}
            style={isAnonymous ? { background: 'var(--brand-primary)' } : undefined}
          >
            <IconCheck className="h-3 w-3" strokeWidth={3} />
          </span>
          <input
            type="checkbox"
            checked={isAnonymous}
            onChange={e => setIsAnonymous(e.target.checked)}
            className="sr-only"
          />
          <span className="min-w-0">
            <span className="block text-sm font-medium text-ink">Submit anonymously</span>
            <span className="mt-0.5 block text-[13px] leading-relaxed text-ink-3">
              Your name and number will not be attached to this response.
            </span>
          </span>
        </label>

        <Button
          onClick={submit}
          loading={busy}
          fullWidth
          className="mt-6"
        >
          {busy ? 'Sending…' : 'Send feedback'}
        </Button>

        <div className="mt-7">
          <PoweredBy />
        </div>
      </div>
    </BrandTheme>
  )
}
