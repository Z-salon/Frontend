import { useRef, useState } from 'react'
import { useBooking } from '../../context/BookingContext'
import { otpApi } from '../../../api/otp.api'
import { publicApi } from '../../../api/public.api'
import { normalizeEthiopianPhone } from '../../utils/phone'
import { useCustomerToast } from '../../hooks/useToast'
import { Button, Field, Pill, Textarea } from '../../components/ui'
import { StepFrame } from './StepFrame'
import {
  IconArrowLeft,
  IconInfo,
  IconMessage,
  IconPhone,
  IconShield,
} from '../../components/icons'
import { extractErrorMessage, formatDateShort, formatIsoTime } from '../../utils/format'

type Phase = 'details' | 'otp' | 'submitting'


/**
 * The backend validates `scheduledStart` with `z.string().datetime()`.
 * Zod v3's `.datetime()` rejects timezone OFFSETS like `+03:00` unless
 * the schema opts in with `{ offset: true }`. We don't know whether the
 * backend schema has that option, so we normalize to UTC (`Z`) here —
 * `Z` is accepted either way, and the instant is identical.
 */
function toUtcIso(input: string): string {
  const d = new Date(input)
  if (Number.isNaN(d.getTime())) {
    throw new Error(`Invalid slot time: ${input}`)
  }
  return d.toISOString() // always ends in Z, always has seconds + ms
}

/**
 * `+251911223344` → `+251 ••• ••• 344` so the guest can sanity-check the
 * number without us echoing the whole thing back at them.
 */
function maskPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '')
  if (digits.length < 7) return phone
  const countryCode = digits.startsWith('251') ? '251' : digits.slice(0, digits.length - 9)
  return `+${countryCode} ••• ••• ${digits.slice(-3)}`
}

export function StepContact() {
  const { businessId, draft, updateDraft, setStep } = useBooking()
  const toast = useCustomerToast()
  const inFlight = useRef(false)

  const [phase, setPhase] = useState<Phase>('details')
  const [firstName, setFirstName] = useState(draft.firstName)
  const [lastName, setLastName] = useState(draft.lastName)
  const [phone, setPhone] = useState(draft.phone)
  const [otp, setOtp] = useState('')
  const [notes, setNotes] = useState(draft.notes)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function sendOtp() {
    const normalized = normalizeEthiopianPhone(phone)
    if (!normalized) {
      setError('Enter a valid Ethiopian phone number (e.g. +251911223344).')
      return
    }
    if (!firstName.trim()) {
      setError('First name is required.')
      return
    }
    if (!lastName.trim()) {
      setError('Last name is required.')
      return
    }

    setError(null)
    setBusy(true)
    try {
      await otpApi.request(normalized)
      // Persist the NORMALIZED phone so downstream code never sees the raw
      // user-typed string.
      updateDraft({
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        phone: normalized,
        notes: notes.trim(),
      })
      setPhone(normalized)
      setPhase('otp')
    } catch (err) {
      setError(extractErrorMessage(err, 'Could not send the code.'))
    } finally {
      setBusy(false)
    }
  }

  /** Re-send the SMS without bouncing the guest back to the form. */
  async function resendOtp() {
    const normalized = normalizeEthiopianPhone(phone)
    if (!normalized) {
      setError('That phone number does not look right. Change it and try again.')
      return
    }

    setError(null)
    setBusy(true)
    try {
      await otpApi.request(normalized)
      setOtp('')
      toast.success('A fresh code is on its way.')
    } catch (err) {
      setError(extractErrorMessage(err, 'Could not resend the code.'))
    } finally {
      setBusy(false)
    }
  }

  async function verifyAndBook() {
    if (inFlight.current) return
    if (!otp.trim()) {
      setError('Enter the code we sent you.')
      return
    }

    // Re-normalize here from local state — do NOT trust draft.phone,
    // which may not have flushed yet on a fast submit.
    const normalizedPhone = normalizeEthiopianPhone(phone)
    const fn = firstName.trim()
    const ln = lastName.trim()

    if (!normalizedPhone) {
      setError('Phone number is invalid. Go back and re-enter it.')
      return
    }
    if (!fn || !ln) {
      setError('First and last name are required.')
      return
    }
    if (!draft.branchId || !draft.serviceId || !draft.slotStart) {
      setError('Missing booking details. Please restart the flow.')
      return
    }

    // Convert the slot time to UTC. `Z` is accepted by `z.string().datetime()`
    // regardless of whether the backend schema opts into offsets.
    let scheduledStart: string
    try {
      scheduledStart = toUtcIso(draft.slotStart)
    } catch (err) {
      setError('The selected time is invalid. Please pick another slot.')
      // eslint-disable-next-line no-console
      console.error('[booking] bad slotStart', draft.slotStart, err)
      return
    }

    inFlight.current = true
    setError(null)
    setBusy(true)
    setPhase('submitting')

    try {
      const verify = await otpApi.verify(normalizedPhone, otp.trim())
      const verificationToken = verify.verificationToken

      const payload: Record<string, unknown> = {
        verificationToken,
        firstName: fn,
        lastName: ln,
        phone: normalizedPhone,
        branchId: draft.branchId,
        serviceId: draft.serviceId,
        scheduledStart,
      }
      if (draft.staffId) payload.staffId = draft.staffId
      if (notes.trim()) payload.notes = notes.trim()

      const appointment = await publicApi.createBooking(businessId, payload as any)

      // The backend signals "needs a prepayment" by returning status PENDING
      // *and* a positive depositAmount. `PENDING` alone is ambiguous — it
      // also covers the "salon approval required" case, which owes no money
      // and must NOT route the customer through the receipt step.
      const depositAmount =
        appointment.depositAmount !== null && appointment.depositAmount !== undefined
          ? Number(appointment.depositAmount)
          : null

      const requiresDeposit =
        appointment.status === 'PENDING' &&
        depositAmount !== null &&
        Number.isFinite(depositAmount) &&
        depositAmount > 0

      updateDraft({
        firstName: fn,
        lastName: ln,
        phone: normalizedPhone,
        appointmentId: appointment.id,
        appointmentStatus: appointment.status,
        requiresDeposit,
        depositAmount,
        receiptStatus: null,
      })

      setStep(requiresDeposit ? 'prepay' : 'done')
    } catch (err) {
      setError(extractErrorMessage(err, 'Could not complete the booking.'))
      setPhase('otp')
    } finally {
      inFlight.current = false
      setBusy(false)
    }
  }

  const submitting = phase === 'submitting'

  if (phase === 'details') {
    return (
      <StepFrame
        title="Who's coming in?"
        subtitle="We will text you a short code to confirm your number, then your appointment is locked in."
      >
        <RecapStrip />

        <div className="mt-8 flex max-w-md flex-col gap-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field
              label="First name"
              value={firstName}
              onChange={e => setFirstName(e.target.value)}
              placeholder="Hana"
              autoComplete="given-name"
              required
            />
            <Field
              label="Last name"
              value={lastName}
              onChange={e => setLastName(e.target.value)}
              placeholder="Girma"
              autoComplete="family-name"
              required
            />
          </div>

          <Field
            label="Phone"
            value={phone}
            onChange={e => setPhone(e.target.value)}
            placeholder="+251 9XX XXX XXX"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            hint="Ethiopian mobile numbers only — we send the confirmation by SMS."
            required
          />

          <Textarea
            label="Anything we should know? (optional)"
            value={notes}
            onChange={e => setNotes(e.target.value)}
            rows={3}
            placeholder="Allergies, inspiration photos, preferred stylist…"
          />

          {error && <ErrorNote>{error}</ErrorNote>}

          <Button
            onClick={sendOtp}
            loading={busy}
            fullWidth
            className="mt-1"
            iconRight={<IconMessage className="h-4 w-4" />}
          >
            {busy ? 'Sending code…' : 'Send verification code'}
          </Button>

          <p className="flex items-start gap-2 text-xs leading-relaxed text-ink-3">
            <IconShield className="mt-px h-4 w-4 flex-shrink-0 text-[color:var(--brand-accent)]" />
            Your number is only used for this appointment and its reminders.
          </p>
        </div>

        <div className="mt-7">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setStep('slot')}
            iconLeft={<IconArrowLeft className="h-3.5 w-3.5" />}
          >
            Change time
          </Button>
        </div>
      </StepFrame>
    )
  }

  return (
    <StepFrame
      title="Enter your code"
      subtitle={
        <>
          We sent a 6-digit code to{' '}
          <span className="font-medium text-ink-2">{maskPhone(phone || draft.phone)}</span>.
        </>
      }
    >
      <RecapStrip />

      <div className="mt-8 flex max-w-md flex-col gap-4">
        <Field
          label="Verification code"
          value={otp}
          onChange={e => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
          placeholder="• • • • • •"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          className="[&_input]:text-center [&_input]:text-xl [&_input]:font-semibold [&_input]:tracking-[0.6em]"
          required
        />

        {error && <ErrorNote>{error}</ErrorNote>}

        <Button
          onClick={verifyAndBook}
          loading={submitting}
          disabled={busy && !submitting}
          fullWidth
          className="mt-1"
        >
          {submitting ? 'Booking…' : 'Confirm booking'}
        </Button>

        <div className="flex items-center justify-between gap-3">
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              setOtp('')
              setError(null)
              setPhase('details')
            }}
            className="focus-ring inline-flex items-center gap-1.5 rounded text-sm text-ink-3 transition-colors hover:text-ink"
          >
            <IconArrowLeft className="h-3.5 w-3.5" />
            Change number
          </button>

          <button
            type="button"
            disabled={busy}
            onClick={resendOtp}
            className="focus-ring rounded text-sm text-[color:var(--brand-accent)] underline decoration-[color:var(--brand-line)] underline-offset-4 transition-colors hover:decoration-current disabled:opacity-50"
          >
            {busy ? 'Resending…' : 'Resend code'}
          </button>
        </div>
      </div>
    </StepFrame>
  )
}

/* ------------------------------------------------------------------ */
/*  Local pieces                                                       */
/* ------------------------------------------------------------------ */

/** Compact repeat of the selection so the guest can catch a mistake. */
function RecapStrip() {
  const { draft } = useBooking()

  return (
    <div
      className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-2xl border px-4 py-3"
      style={{ background: 'var(--brand-soft)', borderColor: 'var(--brand-line)' }}
    >
      <Pill tone="brand">{draft.serviceName ?? 'Appointment'}</Pill>
      {draft.branchName && <Pill>{draft.branchName}</Pill>}
      {draft.date && <Pill>{formatDateShort(draft.date)}</Pill>}
      {draft.slotStart && (
        <Pill>
          <IconPhone className="h-3 w-3" />
          {formatIsoTime(draft.slotStart)}
        </Pill>
      )}
    </div>
  )
}

function ErrorNote({ children }: { children: React.ReactNode }) {
  return (
    <p className="flex items-start gap-2.5 rounded-xl border border-[#E8CBCB] bg-bad-soft px-4 py-3 text-sm leading-relaxed text-bad">
      <IconInfo className="mt-px h-4 w-4 flex-shrink-0" />
      <span>{children}</span>
    </p>
  )
}
