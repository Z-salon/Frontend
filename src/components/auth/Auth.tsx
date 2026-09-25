import { useState } from "react"
import type { AuthScreen as AuthScreenType } from "../../types"
import { Button, Input } from "../ui"
import { useToast } from "../ui/Toast"
import { authApi } from "../../api/auth.api"
import { useAuth } from "../../hooks/useAuth"

interface AuthProps {
  screen: AuthScreenType
  phone?: string
  onNavigate: (s: AuthScreenType) => void
  onLogin: () => void
  onSignup: (phone?: string) => void
  onVerified: () => void
  onEditPhone: () => void
}

export function AuthScreen({
  screen,
  phone,
  onNavigate,
  onLogin,
  onSignup,
  onVerified,
  onEditPhone,
}: AuthProps) {
  return (
    <div className="min-h-screen bg-bg flex items-center justify-center p-6">
      <div className="w-full max-w-sm">
        {screen === "login" && (
          <LoginForm onNavigate={onNavigate} onLogin={onLogin} />
        )}
        {screen === "signup" && (
          <SignupForm onNavigate={onNavigate} onSignup={onSignup} />
        )}
        {screen === "forgot" && <ForgotForm onNavigate={onNavigate} />}
        {screen === "reset" && <ResetForm onNavigate={onNavigate} />}
        {screen === "verify" && (
          <VerifyScreen
            phone={phone}
            onNavigate={onNavigate}
            onVerified={onVerified}
            onEditPhone={onEditPhone}
          />
        )}
      </div>
    </div>
  )
}

function BrandMark() {
  return (
    <div className="mb-10 text-center">
      <h1 className="font-display text-[2.75rem] text-ink leading-none tracking-tight">
        Z-salon
      </h1>
      <p className="text-warm text-xl mt-1.5 font-display italic">ዘsalon</p>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Shared validators                                                  */
/* ------------------------------------------------------------------ */

function normalizePhone(raw: string): string | null {
  const cleaned = raw.replace(/[\s\-()]/g, "")
  if (!cleaned) return null

  if (cleaned.startsWith("+")) {
    return /^\+[1-9]\d{1,14}$/.test(cleaned) ? cleaned : null
  }
  if (/^251[79]\d{8}$/.test(cleaned)) {
    return `+${cleaned}`
  }
  if (/^0[79]\d{8}$/.test(cleaned)) {
    return `+251${cleaned.slice(1)}`
  }
  return null
}

const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/

function extractErrorMessage(
  err: unknown,
  fallback = "Something went wrong. Please try again.",
): string {
  if (!err) return fallback
  const anyErr = err as any
  const data = anyErr?.response?.data ?? anyErr?.data ?? anyErr

  if (Array.isArray(data?.errors) && data.errors.length > 0) {
    return String(data.errors[0])
  }
  if (typeof data?.message === "string" && data.message) {
    return data.message
  }
  if (typeof anyErr?.message === "string" && anyErr.message) {
    return anyErr.message
  }
  return fallback
}

/**
 * Unwraps the raw backend response from an http helper that returns
 * `data` directly. Logs the full `{ success, message, data? }` envelope.
 *
 * Works whether the underlying client is axios (response lives on
 * `err.response` for failures) or a custom fetch wrapper.
 */
function unwrapResponse(
  result: unknown,
): { success?: boolean; message?: string; data?: unknown } | undefined {
  if (!result) return undefined
  const anyRes = result as any

  // If the http helper returned the full envelope already
  if (anyRes.success !== undefined && anyRes.message !== undefined) {
    return {
      success: anyRes.success,
      message: anyRes.message,
      data: anyRes.data,
    }
  }

  // Axios-style: response lives under .data
  const body = anyRes?.data
  if (body && (body.success !== undefined || body.message !== undefined)) {
    return { success: body.success, message: body.message, data: body.data }
  }

  return undefined
}

/* ------------------------------------------------------------------ */
/*  Password input with show/hide toggle                               */
/* ------------------------------------------------------------------ */

function PasswordInput({
  label,
  value,
  onChange,
  placeholder,
  autoComplete,
  error,
}: {
  label: string
  value: string
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void
  placeholder?: string
  autoComplete?: string
  error?: string
}) {
  const [visible, setVisible] = useState(false)

  return (
    <div className="relative">
      <Input
        label={label}
        type={visible ? "text" : "password"}
        placeholder={placeholder}
        value={value}
        onChange={onChange}
        autoComplete={autoComplete}
        error={error}
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? "Hide password" : "Show password"}
        className="absolute right-3 top-[2.15rem] text-ink-3 hover:text-ink-2 transition-colors"
        tabIndex={-1}
      >
        {visible ? <EyeOffIcon /> : <EyeIcon />}
      </button>
    </div>
  )
}

function EyeIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  )
}

function EyeOffIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  )
}

/* ------------------------------------------------------------------ */
/*  Login                                                              */
/* ------------------------------------------------------------------ */

function LoginForm({
  onNavigate,
  onLogin,
}: {
  onNavigate: (s: AuthScreenType) => void
  onLogin: () => void
}) {
  const toast = useToast()
  const { login } = useAuth()
  const [phone, setPhone] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!phone || !password) {
      setError("Please enter your phone number and password.")
      return
    }
    const normalized = normalizePhone(phone)
    if (!normalized) {
      setError(
        "Enter a valid Ethiopian phone number, e.g. +251912345678, 0912345678 or 0712345678.",
      )
      return
    }

    setError("")
    setLoading(true)
    try {
      const res = await authApi.login(normalized, password)
      console.log("[auth] login response:", unwrapResponse(res))
      // Persist the token in AuthContext + hydrate /auth/me. Navigation to
      // the dashboard is driven by `status` flipping to 'authenticated'.
      await login(res.accessToken)
      toast.success("Logged in")
      onLogin()
    } catch (err) {
      const msg = extractErrorMessage(
        err,
        "Unable to log in. Check your phone and password.",
      )
      setError(msg)
      toast.error(msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <BrandMark />
      <p className="text-center text-ink-3 text-sm mb-8 -mt-6">
        Manage your salon beautifully.
      </p>

      {error && (
        <div className="mb-5 px-4 py-3 rounded-xl bg-[#F5EAEA] text-[#B06A6A] text-sm border border-[#E8C4C4]">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Input
          label="Phone number"
          type="tel"
          placeholder="+251912345678"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          autoComplete="tel"
        />
        <div>
          <PasswordInput
            label="Password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
          />
          <div className="flex justify-end mt-2">
            <button
              type="button"
              className="text-xs text-ink-3 hover:text-ink-2 transition-colors"
              onClick={() => onNavigate("forgot")}
            >
              Forgot password?
            </button>
          </div>
        </div>
        <div className="pt-1">
          <Button type="submit" fullWidth loading={loading} size="lg">
            Log in
          </Button>
        </div>
      </form>

      <p className="text-center text-sm text-ink-3 mt-8">
        Don&apos;t have an account?{" "}
        <button
          className="text-ink font-medium hover:underline underline-offset-2 transition-all"
          onClick={() => onNavigate("signup")}
        >
          Create your salon
        </button>
      </p>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Signup                                                             */
/* ------------------------------------------------------------------ */

function SignupForm({
  onNavigate,
  onSignup,
}: {
  onNavigate: (s: AuthScreenType) => void
  onSignup: (phone?: string) => void
}) {
  const toast = useToast()
  const [form, setForm] = useState({
    phone: "",
    password: "",
    confirm: "",
    businessName: "",
    currency: "ETB",
    timezone: "Africa/Addis_Ababa",
  })
  const [loading, setLoading] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [topError, setTopError] = useState("")

  function validate() {
    const e: Record<string, string> = {}

    if (!form.phone) e.phone = "Phone number is required"
    else if (!normalizePhone(form.phone))
      e.phone =
        "Enter a valid phone, e.g. +251912345678, 0912345678 or 0712345678"

    if (!form.password) e.password = "Password is required"
    else if (!PASSWORD_REGEX.test(form.password))
      e.password = "Min 8 chars, with lowercase, uppercase and a number"

    if (form.password !== form.confirm) e.confirm = "Passwords do not match"

    if (!form.businessName.trim()) e.businessName = "Business name is required"
    else if (form.businessName.trim().length > 100)
      e.businessName = "Business name must be 100 characters or fewer"

    if (form.currency.length !== 3)
      e.currency = "Currency must be exactly 3 characters"

    if (!form.timezone) e.timezone = "Timezone is required"

    return e
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const errs = validate()
    if (Object.keys(errs).length) {
      setErrors(errs)
      return
    }
    setErrors({})
    setTopError("")
    setLoading(true)

    const normalizedPhone = normalizePhone(form.phone)!

    try {
      const res = await authApi.register({
        phone: normalizedPhone,
        password: form.password,
        business: {
          name: form.businessName.trim(),
          currency: form.currency,
          timezone: form.timezone,
        },
      })

      // The backend returns { success: true, message: "If this phone number
      // is eligible, a verification code has been sent." } with a 201 and no
      // `data` — the OTP itself is delivered by SMS, not in the response.
      console.log("[auth] register response:", unwrapResponse(res))

      toast.success("Account created")
      onSignup(normalizedPhone)
    } catch (err) {
      const msg = extractErrorMessage(
        err,
        "Could not create your account. Please try again.",
      )
      setTopError(msg)
      toast.error(msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <BrandMark />
      <p className="text-center text-ink-3 text-sm mb-8 -mt-6">
        Create your salon account.
      </p>

      {topError && (
        <div className="mb-5 px-4 py-3 rounded-xl bg-[#F5EAEA] text-[#B06A6A] text-sm border border-[#E8C4C4]">
          {topError}
        </div>
      )}

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Input
          label="Phone number"
          type="tel"
          placeholder="+251912345678"
          value={form.phone}
          onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
          autoComplete="tel"
          error={errors.phone}
        />
        <PasswordInput
          label="Password"
          placeholder="Min. 8 characters"
          value={form.password}
          onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
          autoComplete="new-password"
          error={errors.password}
        />
        <PasswordInput
          label="Confirm password"
          placeholder="Repeat password"
          value={form.confirm}
          onChange={(e) => setForm((f) => ({ ...f, confirm: e.target.value }))}
          autoComplete="new-password"
          error={errors.confirm}
        />

        <div className="pt-2">
          <p className="text-xs uppercase tracking-wide text-ink-3 mb-1">
            Business details
          </p>
        </div>

        <Input
          label="Business name"
          placeholder="Bella Salon"
          value={form.businessName}
          onChange={(e) =>
            setForm((f) => ({ ...f, businessName: e.target.value }))
          }
          error={errors.businessName}
        />

        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-ink-2">Currency</label>
            <select
              value={form.currency}
              onChange={(e) =>
                setForm((f) => ({ ...f, currency: e.target.value }))
              }
              className="w-full px-3 py-2.5 rounded-xl border border-line bg-surface text-ink text-sm focus:outline-none focus:border-ink-3 transition-colors"
            >
              <option value="ETB">ETB — Ethiopian Birr</option>
              <option value="USD">USD — US Dollar</option>
              <option value="EUR">EUR — Euro</option>
              <option value="GBP">GBP — British Pound</option>
              <option value="KES">KES — Kenyan Shilling</option>
              <option value="NGN">NGN — Nigerian Naira</option>
              <option value="ZAR">ZAR — South African Rand</option>
            </select>
            {errors.currency && (
              <p className="text-xs text-[#B06A6A]">{errors.currency}</p>
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-ink-2">Timezone</label>
            <select
              value={form.timezone}
              onChange={(e) =>
                setForm((f) => ({ ...f, timezone: e.target.value }))
              }
              className="w-full px-3 py-2.5 rounded-xl border border-line bg-surface text-ink text-sm focus:outline-none focus:border-ink-3 transition-colors"
            >
              <option value="Africa/Addis_Ababa">Africa/Addis_Ababa</option>
              <option value="Africa/Nairobi">Africa/Nairobi</option>
              <option value="Africa/Lagos">Africa/Lagos</option>
              <option value="Africa/Johannesburg">Africa/Johannesburg</option>
              <option value="Africa/Cairo">Africa/Cairo</option>
              <option value="Europe/London">Europe/London</option>
              <option value="America/New_York">America/New_York</option>
            </select>
            {errors.timezone && (
              <p className="text-xs text-[#B06A6A]">{errors.timezone}</p>
            )}
          </div>
        </div>

        <div className="pt-1">
          <Button type="submit" fullWidth loading={loading} size="lg">
            Create account
          </Button>
        </div>
      </form>

      <p className="text-center text-xs text-ink-3 mt-4 leading-relaxed">
        We&apos;ll send a verification code to your phone.
      </p>

      <p className="text-center text-sm text-ink-3 mt-6">
        Already have an account?{" "}
        <button
          className="text-ink font-medium hover:underline underline-offset-2"
          onClick={() => onNavigate("login")}
        >
          Log in
        </button>
      </p>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Forgot password                                                    */
/* ------------------------------------------------------------------ */

function ForgotForm({
  onNavigate,
}: {
  onNavigate: (s: AuthScreenType) => void
}) {
  const toast = useToast()
  const [phone, setPhone] = useState("")
  const [sent, setSent] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!phone) {
      setError("Please enter your phone number.")
      return
    }
    const normalized = normalizePhone(phone)
    if (!normalized) {
      setError("Enter a valid Ethiopian phone number.")
      return
    }
    setError("")
    setLoading(true)
    try {
      const res = await authApi.forgotPassword(normalized)
      console.log("[auth] forgotPassword response:", unwrapResponse(res))
      toast.info("Reset code sent")
      setSent(true)
    } catch (err) {
      const msg = extractErrorMessage(
        err,
        "Could not send the reset code. Please try again.",
      )
      setError(msg)
      toast.error(msg)
    } finally {
      setLoading(false)
    }
  }

  if (sent) {
    const display = normalizePhone(phone) ?? phone
    return (
      <div className="text-center">
        <div className="w-16 h-16 rounded-full bg-warm-subtle flex items-center justify-center mx-auto mb-6">
          <svg
            width="26"
            height="26"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#8A847F"
            strokeWidth="1.5"
          >
            <path d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
        </div>
        <h2 className="font-display text-2xl text-ink mb-2">
          Check your phone
        </h2>
        <p className="text-ink-3 text-sm mb-8 leading-relaxed">
          We sent a reset code via SMS to
          <br />
          <span className="text-ink-2 font-medium">{display}</span>
        </p>
        <div className="flex flex-col gap-3 items-center">
          <Button onClick={() => onNavigate("reset")}>Set new password</Button>
          <Button variant="ghost" onClick={() => onNavigate("login")}>
            Back to login
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div>
      <div className="mb-8 text-center">
        <h2 className="font-display text-3xl text-ink mb-3">
          Forgot password?
        </h2>
        <p className="text-ink-3 text-sm leading-relaxed">
          Enter your phone number and we&apos;ll send you a reset code by SMS.
        </p>
      </div>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Input
          label="Phone number"
          type="tel"
          placeholder="+251912345678"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          autoComplete="tel"
          error={error}
        />
        <Button type="submit" fullWidth loading={loading} size="lg">
          Send reset code
        </Button>
      </form>
      <p className="text-center text-sm text-ink-3 mt-6">
        <button
          className="text-ink font-medium hover:underline underline-offset-2"
          onClick={() => onNavigate("login")}
        >
          Back to login
        </button>
      </p>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Reset password                                                     */
/* ------------------------------------------------------------------ */

function ResetForm({
  onNavigate,
}: {
  onNavigate: (s: AuthScreenType) => void
}) {
  const toast = useToast()
  const [password, setPassword] = useState("")
  const [confirm, setConfirm] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!password || !confirm) {
      setError("Please fill in both fields.")
      return
    }
    if (!PASSWORD_REGEX.test(password)) {
      setError("Min 8 chars, with lowercase, uppercase and a number.")
      return
    }
    if (password !== confirm) {
      setError("Passwords do not match.")
      return
    }
    setError("")
    setLoading(true)
    try {
      // TODO: password reset is a 3-call flow — /forgot → /reset/verify → /reset.
      // This screen has no OTP step, so we can't call /reset yet.
      toast.info("Password reset flow incomplete")
      onNavigate("login")
    } catch (err) {
      const msg = extractErrorMessage(err, "Could not update your password.")
      setError(msg)
      toast.error(msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <BrandMark />
      <h2 className="font-display text-2xl text-ink mb-1">Set new password</h2>
      <p className="text-ink-3 text-sm mb-7">
        Enter and confirm your new password.
      </p>
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <PasswordInput
          label="New password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Min. 8 characters"
          autoComplete="new-password"
        />
        <PasswordInput
          label="Confirm password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          placeholder="Repeat password"
          autoComplete="new-password"
        />
        {error && <p className="text-sm text-[#B06A6A]">{error}</p>}
        <Button type="submit" loading={loading} fullWidth>
          Update password
        </Button>
      </form>
      <p className="text-center text-sm text-ink-3 mt-5">
        <button
          className="text-ink underline underline-offset-2"
          onClick={() => onNavigate("login")}
        >
          Back to login
        </button>
      </p>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  OTP Verify screen                                                  */
/* ------------------------------------------------------------------ */

const OTP_LENGTH = 6
const OTP_REGEX = /^\d{4,8}$/

function VerifyScreen({
  phone,
  onNavigate,
  onVerified,
  onEditPhone,
}: {
  phone?: string
  onNavigate: (s: AuthScreenType) => void
  onVerified: () => void
  onEditPhone: () => void
}) {
  const toast = useToast()
  const { login } = useAuth()
  const [digits, setDigits] = useState<string[]>(Array(OTP_LENGTH).fill(""))
  const [loading, setLoading] = useState(false)
  const [resending, setResending] = useState(false)
  const [error, setError] = useState("")
  const [info, setInfo] = useState("")

  const inputsRef = useState<Array<HTMLInputElement | null>>([])[0]

  const code = digits.join("")

  function fillFrom(startIndex: number, raw: string) {
    const cleaned = raw.replace(/\D/g, "")
    if (!cleaned) return

    const next = [...digits]
    for (let i = 0; i < cleaned.length && startIndex + i < OTP_LENGTH; i++) {
      next[startIndex + i] = cleaned[i]
    }
    setDigits(next)

    const lastFilled = Math.min(startIndex + cleaned.length - 1, OTP_LENGTH - 1)
    const focusIndex =
      lastFilled + 1 < OTP_LENGTH ? lastFilled + 1 : OTP_LENGTH - 1
    inputsRef[focusIndex]?.focus()
  }

  function setDigitAt(index: number, value: string) {
    fillFrom(index, value)
  }

  function handlePaste(
    index: number,
    e: React.ClipboardEvent<HTMLInputElement>,
  ) {
    e.preventDefault()
    const pasted = e.clipboardData.getData("text")
    if (!pasted) return
    fillFrom(index, pasted)
  }

  function handleKeyDown(
    index: number,
    e: React.KeyboardEvent<HTMLInputElement>,
  ) {
    if (e.key === "Backspace") {
      if (digits[index]) {
        const next = [...digits]
        next[index] = ""
        setDigits(next)
      } else if (index > 0) {
        inputsRef[index - 1]?.focus()
        const next = [...digits]
        next[index - 1] = ""
        setDigits(next)
      }
      e.preventDefault()
    } else if (e.key === "ArrowLeft" && index > 0) {
      inputsRef[index - 1]?.focus()
    } else if (e.key === "ArrowRight" && index < OTP_LENGTH - 1) {
      inputsRef[index + 1]?.focus()
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!OTP_REGEX.test(code)) {
      setError("Enter the code from the SMS.")
      return
    }
    if (!phone) {
      setError("Missing phone number. Please go back and re-enter it.")
      return
    }
    setError("")
    setInfo("")
    setLoading(true)
    try {
      const res = await authApi.registerVerify(phone, code)
      console.log("[auth] registerVerify response:", unwrapResponse(res))
      // Register/verify completes onboarding + logs the user in, so persist
      // the token in AuthContext before signalling completion.
      await login(res.accessToken)
      toast.success("Phone verified")
      onVerified()
    } catch (err) {
      const msg = extractErrorMessage(
        err,
        "That code is incorrect or expired. Please try again.",
      )
      setError(msg)
      toast.error(msg)
    } finally {
      setLoading(false)
    }
  }

  async function handleResend() {
    if (!phone) {
      setError("Missing phone number. Please go back and re-enter it.")
      return
    }
    setError("")
    setInfo("")
    setResending(true)
    try {
      const res = await authApi.resendOtp(phone, "PHONE_VERIFICATION")
      console.log("[auth] resendOtp response:", unwrapResponse(res))
      toast.info("New code sent")
      setInfo("We sent a new code to your phone.")
    } catch (err) {
      const msg = extractErrorMessage(
        err,
        "Could not resend the code. Please wait a moment and try again.",
      )
      setError(msg)
      toast.error(msg)
    } finally {
      setResending(false)
    }
  }

  return (
    <div>
      <BrandMark />

      <div className="text-center mb-8">
        <h2 className="font-display text-2xl text-ink mb-2">
          Verify your phone
        </h2>
        <p className="text-ink-3 text-sm leading-relaxed">
          Enter the {OTP_LENGTH}-digit code we sent
          {phone ? (
            <>
              {" "}
              to <span className="text-ink-2 font-medium">{phone}</span>
            </>
          ) : (
            " by SMS"
          )}
          .
        </p>
      </div>

      {error && (
        <div className="mb-5 px-4 py-3 rounded-xl bg-[#F5EAEA] text-[#B06A6A] text-sm border border-[#E8C4C4]">
          {error}
        </div>
      )}
      {info && !error && (
        <div className="mb-5 px-4 py-3 rounded-xl bg-warm-subtle text-ink-2 text-sm border border-line">
          {info}
        </div>
      )}

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="flex justify-center gap-2">
          {digits.map((d, i) => (
            <input
              key={i}
              ref={(el) => {
                inputsRef[i] = el
              }}
              type="text"
              inputMode="numeric"
              autoComplete={i === 0 ? "one-time-code" : "off"}
              maxLength={OTP_LENGTH}
              value={d}
              onChange={(e) => setDigitAt(i, e.target.value)}
              onPaste={(e) => handlePaste(i, e)}
              onKeyDown={(e) => handleKeyDown(i, e)}
              onFocus={(e) => e.target.select()}
              className="w-11 h-13 text-center text-lg font-medium rounded-xl border border-line bg-surface text-ink focus:outline-none focus:border-ink-3 transition-colors"
              style={{ height: "3.25rem" }}
            />
          ))}
        </div>

        <div className="pt-1">
          <Button
            type="submit"
            fullWidth
            loading={loading}
            size="lg"
            disabled={code.length < OTP_LENGTH}
          >
            Verify
          </Button>
        </div>
      </form>

      <div className="mt-6 flex flex-col items-center gap-3">
        <button
          type="button"
          onClick={handleResend}
          disabled={resending}
          className="text-sm text-ink-3 hover:text-ink-2 transition-colors disabled:opacity-50"
        >
          {resending ? "Sending…" : "Didn't get the code? Resend"}
        </button>

        <button
          type="button"
          onClick={onEditPhone}
          className="text-xs text-ink-3 hover:text-ink-2 transition-colors"
        >
          Wrong number? Go back
        </button>
      </div>
    </div>
  )
}
