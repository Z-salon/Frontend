import { useState } from 'react'
import type { AuthScreen as AuthScreenType } from '../../types'
import { Button, Input } from '../ui'

interface AuthProps {
  screen: AuthScreenType
  onNavigate: (s: AuthScreenType) => void
  onLogin: () => void
  onSignup: () => void
}

export function AuthScreen({ screen, onNavigate, onLogin, onSignup }: AuthProps) {
  return (
    <div className="min-h-screen bg-bg flex items-center justify-center p-6">
      <div className="w-full max-w-sm">
        {screen === 'login'  && <LoginForm    onNavigate={onNavigate} onLogin={onLogin} />}
        {screen === 'signup' && <SignupForm   onNavigate={onNavigate} onSignup={onSignup} />}
        {screen === 'forgot' && <ForgotForm   onNavigate={onNavigate} />}
        {screen === 'reset'  && <ResetForm    onNavigate={onNavigate} />}
        {screen === 'verify' && <VerifyScreen onNavigate={onNavigate} />}
      </div>
    </div>
  )
}

function BrandMark() {
  return (
    <div className="mb-10 text-center">
      <h1 className="font-display text-[2.75rem] text-ink leading-none tracking-tight">Z-salon</h1>
      <p className="text-warm text-xl mt-1.5 font-display italic">ዘsalon</p>
    </div>
  )
}

function LoginForm({ onNavigate, onLogin }: { onNavigate: (s: AuthScreenType) => void; onLogin: () => void }) {
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState('')

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!email || !password) { setError('Please enter your email and password.'); return }
    setError('')
    setLoading(true)
    setTimeout(() => { setLoading(false); onLogin() }, 1100)
  }

  return (
    <div>
      <BrandMark />
      <p className="text-center text-ink-3 text-sm mb-8 -mt-6">Manage your salon beautifully.</p>

      {error && (
        <div className="mb-5 px-4 py-3 rounded-xl bg-[#F5EAEA] text-[#B06A6A] text-sm border border-[#E8C4C4]">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Input
          label="Email"
          type="email"
          placeholder="hello@zsalon.com"
          value={email}
          onChange={e => setEmail(e.target.value)}
          autoComplete="email"
        />
        <div>
          <Input
            label="Password"
            type="password"
            placeholder="••••••••"
            value={password}
            onChange={e => setPassword(e.target.value)}
            autoComplete="current-password"
          />
          <div className="flex justify-end mt-2">
            <button
              type="button"
              className="text-xs text-ink-3 hover:text-ink-2 transition-colors"
              onClick={() => onNavigate('forgot')}
            >
              Forgot password?
            </button>
          </div>
        </div>
        <div className="pt-1">
          <Button type="submit" fullWidth loading={loading} size="lg">Log in</Button>
        </div>
      </form>

      <div className="my-6 flex items-center gap-3">
        <div className="flex-1 h-px bg-line" />
        <span className="text-xs text-ink-3">or</span>
        <div className="flex-1 h-px bg-line" />
      </div>

      <Button variant="secondary" fullWidth size="lg" onClick={onLogin}>
        <GoogleIcon /> Continue with Google
      </Button>

      <p className="text-center text-sm text-ink-3 mt-8">
        Don&apos;t have an account?{' '}
        <button
          className="text-ink font-medium hover:underline underline-offset-2 transition-all"
          onClick={() => onNavigate('signup')}
        >
          Create your salon
        </button>
      </p>
    </div>
  )
}

function SignupForm({ onNavigate, onSignup }: { onNavigate: (s: AuthScreenType) => void; onSignup: () => void }) {
  const [form, setForm]     = useState({ name: '', email: '', password: '', confirm: '' })
  const [loading, setLoading] = useState(false)
  const [errors, setErrors]   = useState<Record<string, string>>({})

  function validate() {
    const e: Record<string, string> = {}
    if (!form.name)               e.name     = 'Name is required'
    if (!form.email)              e.email    = 'Email is required'
    if (form.password.length < 8) e.password = 'Password must be at least 8 characters'
    if (form.password !== form.confirm) e.confirm = 'Passwords do not match'
    return e
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const errs = validate()
    if (Object.keys(errs).length) { setErrors(errs); return }
    setErrors({})
    setLoading(true)
    setTimeout(() => { setLoading(false); onSignup() }, 1100)
  }

  return (
    <div>
      <BrandMark />
      <p className="text-center text-ink-3 text-sm mb-8 -mt-6">Create your salon account.</p>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Input label="Full name"         placeholder="Sara Bekele"        value={form.name}     onChange={e => setForm(f => ({ ...f, name: e.target.value }))}     error={errors.name} />
        <Input label="Email" type="email" placeholder="hello@zsalon.com"  value={form.email}    onChange={e => setForm(f => ({ ...f, email: e.target.value }))}    error={errors.email} />
        <Input label="Password"  type="password" placeholder="••••••••"   value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} error={errors.password} />
        <Input label="Confirm password" type="password" placeholder="••••••••" value={form.confirm} onChange={e => setForm(f => ({ ...f, confirm: e.target.value }))} error={errors.confirm} />
        <div className="pt-1">
          <Button type="submit" fullWidth loading={loading} size="lg">Create account</Button>
        </div>
      </form>

      <p className="text-center text-sm text-ink-3 mt-8">
        Already have an account?{' '}
        <button className="text-ink font-medium hover:underline underline-offset-2" onClick={() => onNavigate('login')}>
          Log in
        </button>
      </p>
    </div>
  )
}

function ForgotForm({ onNavigate }: { onNavigate: (s: AuthScreenType) => void }) {
  const [email, setEmail]   = useState('')
  const [sent, setSent]     = useState(false)
  const [loading, setLoading] = useState(false)

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!email) return
    setLoading(true)
    setTimeout(() => { setLoading(false); setSent(true) }, 1000)
  }

  if (sent) {
    return (
      <div className="text-center">
        <div className="w-16 h-16 rounded-full bg-warm-subtle flex items-center justify-center mx-auto mb-6">
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#8A847F" strokeWidth="1.5">
            <path d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
        </div>
        <h2 className="font-display text-2xl text-ink mb-2">Check your email</h2>
        <p className="text-ink-3 text-sm mb-8 leading-relaxed">We sent a reset link to<br /><span className="text-ink-2 font-medium">{email}</span></p>
        <div className="flex flex-col gap-3 items-center">
          <Button onClick={() => onNavigate('reset')}>Set new password</Button>
          <Button variant="ghost" onClick={() => onNavigate('login')}>Back to login</Button>
        </div>
      </div>
    )
  }

  return (
    <div>
      <div className="mb-8 text-center">
        <h2 className="font-display text-3xl text-ink mb-3">Forgot password?</h2>
        <p className="text-ink-3 text-sm leading-relaxed">Enter your email and we&apos;ll send you a reset link.</p>
      </div>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Input label="Email" type="email" placeholder="hello@zsalon.com" value={email} onChange={e => setEmail(e.target.value)} />
        <Button type="submit" fullWidth loading={loading} size="lg">Send reset link</Button>
      </form>
      <p className="text-center text-sm text-ink-3 mt-6">
        <button className="text-ink font-medium hover:underline underline-offset-2" onClick={() => onNavigate('login')}>
          Back to login
        </button>
      </p>
    </div>
  )
}

function ResetForm({ onNavigate }: { onNavigate: (s: AuthScreenType) => void }) {
  const [password,  setPassword]  = useState('')
  const [confirm,   setConfirm]   = useState('')
  const [error,     setError]     = useState('')
  const [loading,   setLoading]   = useState(false)

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!password || !confirm) { setError('Please fill in both fields.'); return }
    if (password !== confirm) { setError('Passwords do not match.'); return }
    if (password.length < 8) { setError('Password must be at least 8 characters.'); return }
    setError('')
    setLoading(true)
    setTimeout(() => { setLoading(false); onNavigate('login') }, 1000)
  }

  return (
    <div>
      <BrandMark />
      <h2 className="font-display text-2xl text-ink mb-1">Set new password</h2>
      <p className="text-ink-3 text-sm mb-7">Enter and confirm your new password.</p>
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <Input label="New password" type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Min. 8 characters" />
        <Input label="Confirm password" type="password" value={confirm} onChange={e => setConfirm(e.target.value)} placeholder="Repeat password" />
        {error && <p className="text-sm text-[#B06A6A]">{error}</p>}
        <Button type="submit" loading={loading} fullWidth>Update password</Button>
      </form>
      <p className="text-center text-sm text-ink-3 mt-5">
        <button className="text-ink underline underline-offset-2" onClick={() => onNavigate('login')}>Back to login</button>
      </p>
    </div>
  )
}

function VerifyScreen({ onNavigate }: { onNavigate: (s: AuthScreenType) => void }) {
  return (
    <div className="text-center">
      <div className="w-16 h-16 rounded-full bg-warm-subtle flex items-center justify-center mx-auto mb-6">
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#8A847F" strokeWidth="1.5">
          <path d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
        </svg>
      </div>
      <h2 className="font-display text-2xl text-ink mb-2">Verify your email</h2>
      <p className="text-ink-3 text-sm mb-8">Click the link in your inbox to continue.</p>
      <Button variant="secondary" onClick={() => onNavigate('login')}>Back to login</Button>
    </div>
  )
}

function GoogleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
    </svg>
  )
}
