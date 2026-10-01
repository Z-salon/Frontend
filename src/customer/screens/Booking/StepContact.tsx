import { useRef, useState } from 'react'
import { useBooking } from '../../context/BookingContext'
import { otpApi } from '../../../api/otp.api'
import { publicApi } from '../../../api/public.api'
import { normalizeEthiopianPhone } from '../../utils/phone'

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

export function StepContact() {
  const { businessId, draft, updateDraft, setStep } = useBooking()
  const inFlight = useRef(false)

  const [phase, setPhase] = useState<Phase>('details')
  const [firstName, setFirstName] = useState(draft.firstName)
  const [lastName, setLastName] = useState(draft.lastName)
  const [phone, setPhone] = useState(draft.phone)
  const [otp, setOtp] = useState('')
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
      })
      setPhone(normalized)
      setPhase('otp')
    } catch (err) {
      setError(extractErrorMessage(err, 'Could not send the code.'))
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
      if (draft.notes?.trim()) payload.notes = draft.notes.trim()

      // TEMP: keep this until the flow is green — remove afterwards.
      // eslint-disable-next-line no-console
      console.log('[booking] POST payload', JSON.stringify(payload, null, 2))

      await publicApi.createBooking(businessId, payload as any)

      updateDraft({ firstName: fn, lastName: ln, phone: normalizedPhone })
      setStep('done')
    } catch (err) {
      // TEMP: log the server's complaint so we can see which field failed.
      // eslint-disable-next-line no-console
      console.error('[booking] failed', (err as any)?.response?.data ?? err)
      setError(extractErrorMessage(err, 'Could not complete the booking.'))
      setPhase('otp')
    } finally {
      inFlight.current = false
      setBusy(false)
    }
  }

  if (phase === 'details') {
    return (
      <section>
        <h2 className="font-display text-2xl mb-1">Your details</h2>
        <p className="text-sm text-ink-3 mb-6">
          We'll text a code to confirm your number.
        </p>

        <div className="flex flex-col gap-4 max-w-md">
          <Field
            label="First name"
            value={firstName}
            onChange={setFirstName}
            placeholder="Hana"
            required
          />
          <Field
            label="Last name"
            value={lastName}
            onChange={setLastName}
            placeholder="Girma"
            required
          />
          <Field
            label="Phone"
            value={phone}
            onChange={setPhone}
            placeholder="+251 9XX XXX XXX"
            type="tel"
            required
          />

          {error && <p className="text-xs text-[#B03A3A]">{error}</p>}

          <button
            type="button"
            disabled={busy}
            onClick={sendOtp}
            className="h-11 rounded-xl text-sm font-medium bg-ink text-surface hover:bg-ink/90 disabled:opacity-50"
          >
            {busy ? 'Sending code…' : 'Send verification code'}
          </button>
        </div>
      </section>
    )
  }

  return (
    <section>
      <h2 className="font-display text-2xl mb-1">Enter the code</h2>
      <p className="text-sm text-ink-3 mb-6">
        We sent a 6-digit code to {phone || draft.phone}.
      </p>

      <div className="flex flex-col gap-4 max-w-md">
        <Field
          label="Verification code"
          value={otp}
          onChange={setOtp}
          placeholder="123456"
          type="text"
          required
        />

        {error && <p className="text-xs text-[#B03A3A]">{error}</p>}

        <button
          type="button"
          disabled={busy || phase === 'submitting'}
          onClick={verifyAndBook}
          className="h-11 rounded-xl text-sm font-medium bg-ink text-surface hover:bg-ink/90 disabled:opacity-50"
        >
          {phase === 'submitting' ? 'Booking…' : 'Confirm booking'}
        </button>

        <button
          type="button"
          disabled={busy}
          onClick={() => setPhase('details')}
          className="text-sm text-ink-3 hover:text-ink self-start"
        >
          Back
        </button>
      </div>
    </section>
  )
}

function Field({
  label, value, onChange, placeholder, type = 'text', required,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
  type?: string
  required?: boolean
}) {
  return (
    <div>
      <label className="text-xs font-semibold text-ink-3 mb-1.5 block">
        {label}
        {required && <span className="text-[#B03A3A]"> *</span>}
      </label>
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full h-11 px-3 rounded-xl border border-line text-sm bg-bg text-ink placeholder:text-ink-3 focus:outline-none focus:border-ink"
      />
    </div>
  )
}

function extractErrorMessage(err: unknown, fallback: string): string {
  const anyErr = err as any
  const data = anyErr?.response?.data ?? anyErr?.data ?? anyErr
  if (typeof data?.message === 'string') return data.message
  if (Array.isArray(data?.errors) && data.errors.length > 0) return String(data.errors[0])
  if (Array.isArray(data?.details) && data.details.length > 0) {
    const d = data.details[0]
    return d?.message ? `${d.field}: ${d.message}` : String(d)
  }
  if (typeof anyErr?.message === 'string') return anyErr.message
  return fallback
}