// src/customer/screens/Booking/StepPrepay.tsx

import { useEffect, useMemo, useRef, useState } from 'react'
import { useBooking } from '../../context/BookingContext'
import { paymentMethodsApi } from '../../../api/payment-methods.api'
import { paymentsApi } from '../../../api/payments.api'
import type { PublicPaymentMethod } from '../../../types/api'
import { Button, Field, Textarea } from '../../components/ui'
import { ImageUploader } from '../../../components/ui/ImageUploader'
import { StepFrame } from './StepFrame'
import {
  IconArrowLeft,
  IconCheck,
  IconCopy,
  IconInfo,
} from '../../components/icons'
import { extractErrorMessage } from '../../utils/format'
import { useCustomerToast } from '../../hooks/useToast'

type Phase = 'form' | 'submitting' | 'submitted'

/* ────────────────────────────────────────────────────────────────── */
/*  Screen                                                            */
/* ────────────────────────────────────────────────────────────────── */

export function StepPrepay() {
  const { businessId, draft, updateDraft, setStep } = useBooking()
  const toast = useCustomerToast()
  const inFlight = useRef(false)

  const [methods, setMethods] = useState<PublicPaymentMethod[] | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const [amount, setAmount] = useState(
    draft.depositAmount ? String(draft.depositAmount) : '',
  )
  const [note, setNote] = useState('')
  const [image, setImage] = useState<{ url: string; publicId: string } | null>(
    null,
  )
  const [phase, setPhase] = useState<Phase>('form')
  const [error, setError] = useState<string | null>(null)

  const folder = businessId
    ? `business/${businessId}/receipts`
    : 'business/unknown/receipts'

  /* Load active payment methods for this business. */
  useEffect(() => {
    let cancelled = false
    paymentMethodsApi
      .publicListNoAuth(businessId)
      .then(list => {
        if (cancelled) return
        setMethods(list)
        // Pre-select when there's only one option, so a single-method
        // salon doesn't force a pointless click.
        if (list.length === 1) setSelectedId(list[0].id)
      })
      .catch(err => {
        if (cancelled) return
        setLoadError(
          extractErrorMessage(err, 'Could not load payment options.'),
        )
      })
    return () => {
      cancelled = true
    }
  }, [businessId])

  const selected = useMemo(
    () => methods?.find(m => m.id === selectedId) ?? null,
    [methods, selectedId],
  )

  /* ── Submit ─────────────────────────────────────────────────────── */

  async function submit() {
    if (inFlight.current) return

    if (!draft.appointmentId) {
      setError('Missing appointment. Please restart the booking.')
      return
    }
    if (!selected) {
      setError('Pick a payment method first.')
      return
    }

    const numeric = Number(amount)
    if (!Number.isFinite(numeric) || numeric <= 0) {
      setError('Enter the amount you sent.')
      return
    }
    if (!image) {
      setError('Attach a photo of your receipt.')
      return
    }

    inFlight.current = true
    setError(null)
    setPhase('submitting')

    try {
      await paymentsApi.submitPublicReceipt(businessId, draft.appointmentId, {
        paymentMethodId: selected.id,
        submittedAmount: numeric,
        receiptImageUrl: image.url,
        receiptImagePublicId: image.publicId,
        customerNote: note.trim() || undefined,
      })
      updateDraft({ receiptStatus: 'PENDING' })
      setPhase('submitted')
      toast.success('Receipt sent — we will confirm shortly.')
    } catch (err) {
      setError(extractErrorMessage(err, 'Could not submit the receipt.'))
      setPhase('form')
    } finally {
      inFlight.current = false
    }
  }

  /* ── Submitted ──────────────────────────────────────────────────── */

  if (phase === 'submitted') {
    return (
      <StepFrame
        title="Receipt received"
        subtitle="Our team will verify your transfer and confirm your appointment by SMS."
      >
        <div className="mt-6 max-w-md rounded-2xl border border-line bg-surface p-6">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-good-soft text-good">
              <IconCheck className="h-5 w-5" />
            </span>
            <div>
              <p className="text-sm font-medium text-ink">
                Awaiting confirmation
              </p>
              <p className="text-xs text-ink-3">
                Usually within a few minutes during business hours.
              </p>
            </div>
          </div>
        </div>

        <Button
          onClick={() => setStep('done')}
          fullWidth
          className="mt-6 max-w-md"
        >
          Continue
        </Button>
      </StepFrame>
    )
  }

  /* ── Form ───────────────────────────────────────────────────────── */

  const submitting = phase === 'submitting'

  return (
    <StepFrame
      title="Confirm with a deposit"
      subtitle="This salon asks for a prepayment. Send the deposit, then upload your receipt — your appointment is confirmed once we verify it."
    >
      {draft.depositAmount !== null && (
        <p className="mt-4 text-sm text-ink-2">
          Deposit required:{' '}
          <span className="font-semibold text-ink">
            {draft.depositAmount} ETB
          </span>
        </p>
      )}

      {loadError && <ErrorNote>{loadError}</ErrorNote>}

      {/* ── 1 · Where did you pay? ────────────────────────────────── */}

      {methods && methods.length > 0 && (
        <section className="mt-6 max-w-md">
          <h3 className="text-xs font-semibold uppercase tracking-[0.2em] text-ink-3">
            1 · Choose where you paid
          </h3>
          <div
            className="mt-3 flex flex-col gap-2.5"
            role="radiogroup"
            aria-label="Payment method"
          >
            {methods.map(m => {
              const active = m.id === selectedId
              return (
                <div
                  key={m.id}
                  role="radio"
                  aria-checked={active}
                  tabIndex={0}
                  onClick={() => setSelectedId(m.id)}
                  onKeyDown={e => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      setSelectedId(m.id)
                    }
                  }}
                  className={[
                    'focus-ring cursor-pointer rounded-xl border px-4 py-3 text-left transition',
                    active
                      ? 'border-[color:var(--brand-accent)] bg-[color:var(--brand-soft)]'
                      : 'border-line bg-surface hover:border-warm',
                  ].join(' ')}
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm font-medium text-ink">
                      {m.name}
                    </span>
                    {active && (
                      <IconCheck className="h-4 w-4 text-[color:var(--brand-accent)]" />
                    )}
                  </div>

                  {(m.accountName || m.accountNumber) && (
                    <div className="mt-1.5 flex items-center gap-2 text-xs text-ink-2">
                      {m.accountName && <span>{m.accountName}</span>}
                      {m.accountNumber && (
                        <span className="font-mono">{m.accountNumber}</span>
                      )}
                      {m.accountNumber && (
                        <button
                          type="button"
                          onClick={e => {
                            e.stopPropagation()
                            void navigator.clipboard
                              ?.writeText(m.accountNumber!)
                              .then(() =>
                                toast.success('Account number copied.'),
                              )
                          }}
                          className="focus-ring rounded p-0.5 text-ink-3 hover:text-ink"
                          aria-label="Copy account number"
                        >
                          <IconCopy className="h-3 w-3" />
                        </button>
                      )}
                    </div>
                  )}

                  {m.instructions && (
                    <p className="mt-1.5 text-xs leading-relaxed text-ink-3">
                      {m.instructions}
                    </p>
                  )}
                </div>
              )
            })}
          </div>
        </section>
      )}

      {/* ── 2 · Send the deposit ──────────────────────────────────── */}

      {selected && (
        <section className="mt-8 max-w-md">
          <h3 className="text-xs font-semibold uppercase tracking-[0.2em] text-ink-3">
            2 · Send the deposit
          </h3>
          <div className="mt-3 flex items-start gap-2.5 rounded-xl border border-line bg-surface-2 px-4 py-3 text-sm text-ink-2">
            <IconInfo className="mt-0.5 h-4 w-4 flex-shrink-0 text-[color:var(--brand-accent)]" />
            <span>
              Complete the transfer in your banking app, then come back here
              to upload the confirmation.
            </span>
          </div>
        </section>
      )}

      {/* ── 3 · Upload the receipt ────────────────────────────────── */}

      {selected && (
        <section className="mt-8 max-w-md">
          <h3 className="text-xs font-semibold uppercase tracking-[0.2em] text-ink-3">
            3 · Upload your receipt
          </h3>

          <div className="mt-3 flex flex-col gap-4">
            <Field
              label="Amount sent (ETB)"
              value={amount}
              onChange={e => setAmount(e.target.value.replace(/[^\d.]/g, ''))}
              inputMode="decimal"
              placeholder="400"
              required
            />

            <ImageUploader
              label="Receipt image"
              hint="A clear photo or screenshot showing the amount and reference."
              aspect="square"
              value={image?.url ?? ''}
              folder={folder}
              onChange={asset =>
                setImage({ url: asset.imageUrl, publicId: asset.publicId })
              }
              onRemove={() => setImage(null)}
            />

            <Textarea
              label="Note (optional)"
              value={note}
              onChange={e => setNote(e.target.value)}
              rows={2}
              placeholder="e.g. Sent from CBE, ref 88123"
            />

            {error && <ErrorNote>{error}</ErrorNote>}

            <Button
              onClick={() => void submit()}
              loading={submitting}
              disabled={submitting}
              fullWidth
            >
              {submitting ? 'Sending…' : 'Submit receipt'}
            </Button>
          </div>
        </section>
      )}

      {/* ── Back ──────────────────────────────────────────────────── */}

      <div className="mt-7">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setStep('contact')}
          disabled={submitting}
          iconLeft={<IconArrowLeft className="h-3.5 w-3.5" />}
        >
          Back
        </Button>
      </div>
    </StepFrame>
  )
}

/* ────────────────────────────────────────────────────────────────── */
/*  Local pieces                                                      */
/* ────────────────────────────────────────────────────────────────── */

function ErrorNote({ children }: { children: React.ReactNode }) {
  return (
    <p className="mt-4 flex items-start gap-2.5 rounded-xl border border-[#E8CBCB] bg-bad-soft px-4 py-3 text-sm leading-relaxed text-bad">
      <IconInfo className="mt-px h-4 w-4 flex-shrink-0" />
      <span>{children}</span>
    </p>
  )
}