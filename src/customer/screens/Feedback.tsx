import { useEffect, useState } from 'react'
import type { FeedbackFormResponse } from '../../types/api'
import { http } from '../../api/http'
import { Link } from '../router'

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

  function setAnswer(catId: string, patch: Partial<ResponseAnswer>) {
    setAnswers(prev => ({
      ...prev,
      [catId]: { category_id: catId, ...prev[catId], ...patch },
    }))
  }

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
      <div className="min-h-screen flex items-center justify-center bg-bg">
        <p className="text-sm text-ink-3">Loading…</p>
      </div>
    )
  }

  if (phase === 'submitted') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-bg gap-3 px-6 text-center">
        <h1 className="font-display text-2xl text-ink">Thanks!</h1>
        <p className="text-sm text-ink-3 max-w-sm">
          Your feedback helps us improve.
        </p>
      </div>
    )
  }

  if (phase === 'expired') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-bg gap-3 px-6 text-center">
        <h1 className="font-display text-2xl text-ink">Link expired</h1>
        <p className="text-sm text-ink-3 max-w-sm">
          This feedback link is no longer valid.
        </p>
      </div>
    )
  }

  if (phase === 'already') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-bg gap-3 px-6 text-center">
        <h1 className="font-display text-2xl text-ink">Already submitted</h1>
        <p className="text-sm text-ink-3 max-w-sm">
          We already have your feedback. Thanks again!
        </p>
      </div>
    )
  }

  if (phase === 'error' || !form) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-bg gap-3 px-6 text-center">
        <h1 className="font-display text-2xl text-ink">Link unavailable</h1>
        <p className="text-sm text-ink-3 max-w-md">
          {error ?? 'This feedback link could not be loaded.'}
        </p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-bg text-ink">
      <div className="max-w-lg mx-auto px-5 sm:px-6 py-12">
        <h1 className="font-display text-2xl mb-1">
          How did we do?
        </h1>
        <p className="text-sm text-ink-3 mb-8">
          {form.business.name} would love your feedback.
        </p>

        <div className="flex flex-col gap-6">
          {form.categories.map(cat => (
            <div
              key={cat.id}
              className="bg-surface rounded-2xl border border-line p-5"
            >
              <p className="font-medium text-ink">{cat.name}</p>
              {cat.description && (
                <p className="text-sm text-ink-3 mt-1">{cat.description}</p>
              )}

              <div className="mt-4">
                {cat.type === 'RATING' && (
                  <RatingInput
                    min={cat.rating_scale_min ?? 1}
                    max={cat.rating_scale_max ?? 5}
                    value={answers[cat.id]?.rating_value}
                    onChange={v => setAnswer(cat.id, { rating_value: v })}
                  />
                )}

                {cat.type === 'TEXT' && (
                  <textarea
                    value={answers[cat.id]?.text_response ?? ''}
                    onChange={e => setAnswer(cat.id, { text_response: e.target.value })}
                    rows={3}
                    placeholder="Anything you'd like to add…"
                    className="w-full px-3 py-2.5 rounded-xl border border-line text-sm bg-bg text-ink placeholder:text-ink-3 focus:outline-none focus:border-warm resize-none"
                  />
                )}

                {cat.type === 'BOOLEAN' && (
                  <div className="flex gap-2">
                    {[true, false].map(v => (
                      <button
                        key={String(v)}
                        type="button"
                        onClick={() => setAnswer(cat.id, { boolean_response: v })}
                        className={`
                          h-9 px-4 rounded-xl text-sm border transition-colors
                          ${answers[cat.id]?.boolean_response === v
                            ? 'border-ink bg-ink text-surface'
                            : 'border-line text-ink-2 hover:border-warm'}
                        `}
                      >
                        {v ? 'Yes' : 'No'}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        <label className="flex items-center gap-2 mt-6 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={isAnonymous}
            onChange={e => setIsAnonymous(e.target.checked)}
            className="w-4 h-4"
          />
          <span className="text-sm text-ink-2">
            Submit anonymously
          </span>
        </label>

        <button
          type="button"
          disabled={busy}
          onClick={submit}
          className="mt-6 w-full h-11 rounded-xl text-sm font-medium bg-ink text-surface hover:bg-ink/90 disabled:opacity-50"
        >
          {busy ? 'Submitting…' : 'Submit feedback'}
        </button>

        <p className="text-[11px] text-ink-3 mt-6 text-center">
          Powered by <Link to="/" className="text-ink-2 underline underline-offset-2">Z-Salon</Link>
        </p>
      </div>
    </div>
  )
}

function RatingInput({
  min, max, value, onChange,
}: {
  min: number
  max: number
  value: number | undefined
  onChange: (v: number) => void
}) {
  const options: number[] = []
  for (let i = min; i <= max; i++) options.push(i)

  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map(n => (
        <button
          key={n}
          type="button"
          onClick={() => onChange(n)}
          className={`
            w-9 h-9 rounded-lg text-sm font-medium transition-colors
            ${value === n
              ? 'bg-ink text-surface'
              : 'bg-warm-subtle text-ink-2 hover:bg-warm'}
          `}
        >
          {n}
        </button>
      ))}
    </div>
  )
}

function extractErrorMessage(err: unknown, fallback: string): string {
  const anyErr = err as any
  const data = anyErr?.response?.data ?? anyErr?.data ?? anyErr
  if (typeof data?.message === 'string') return data.message
  if (Array.isArray(data?.errors) && data.errors.length > 0) return String(data.errors[0])
  if (typeof anyErr?.message === 'string') return anyErr.message
  return fallback
}