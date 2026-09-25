import { useEffect, useRef, useState } from 'react'
import { Button, Input, Toggle } from '../ui'
import { ImageUploader } from '../ui/ImageUploader'
import { useToast } from '../ui/Toast'
import { useBusiness } from '../../contexts/BusinessContext'
import { useAuth } from '../../hooks/useAuth'
import { branchesApi } from '../../api/branches.api'
import { businessApi } from '../../api/business.api'
import { bookingConfigApi } from '../../api/booking-config.api'
import { serviceCategoriesApi } from '../../api/service-categories.api'
import { servicesApi } from '../../api/services.api'
import { workingHoursApi } from '../../api/working-hours.api'
import type { DayOfWeek } from '../../types/api'

interface OnboardingProps {
  onComplete: () => void
}

/* ------------------------------------------------------------------ */
/*  Wizard state shapes                                                */
/* ------------------------------------------------------------------ */

type BranchDraft = {
  key: string
  name: string
  address: string
  timezone: string
  serverId?: string
}

type WeeklyDay = {
  dayOfWeek: DayOfWeek
  isClosed: boolean
  intervals: { start: string; end: string }[]
}

type CategoryDraft = {
  key: string
  name: string
  description: string
  branchKeys: string[]
  serverId?: string
}

type ServiceDraft = {
  key: string
  categoryKey: string
  name: string
  description: string
  durationMinutes: number
  price: number
  employeeAssignmentMode: 'CUSTOMER_CHOOSES' | 'SALON_ASSIGNS' | 'ANY_AVAILABLE'
  showPriceToCustomer: boolean
  depositPolicyType: 'NONE' | 'FIXED' | 'PERCENTAGE' | 'FULL'
  depositAmount: number | null
  branchKeys: string[]
  branchTouched: boolean
  serverId?: string
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

const DAY_LABELS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

const ALL_DAYS: DayOfWeek[] = [0, 1, 2, 3, 4, 5, 6]

function defaultWeeklyDays(): WeeklyDay[] {
  return ALL_DAYS.map(dayOfWeek => {
    if (dayOfWeek === 0) return { dayOfWeek, isClosed: true,  intervals: [] }
    if (dayOfWeek === 6) return { dayOfWeek, isClosed: false, intervals: [{ start: '09:00', end: '17:00' }] }
    return                     { dayOfWeek, isClosed: false, intervals: [{ start: '09:00', end: '18:00' }] }
  })
}

function intervalsOverlap(a: { start: string; end: string }, b: { start: string; end: string }) {
  return a.start < b.end && b.start < a.end
}

function to12Hour(hhmm: string): string {
  const m = hhmm.match(/^(\d{2}):(\d{2})$/)
  if (!m) return hhmm
  let h = parseInt(m[1], 10)
  const min = m[2]
  const suffix = h >= 12 ? 'PM' : 'AM'
  h = h % 12
  if (h === 0) h = 12
  return `${h}:${min} ${suffix}`
}

function parseTimeInput(raw: string): string | null {
  if (!raw) return null
  const s = raw.trim().toLowerCase().replace(/\s+/g, '')

  const ampm = s.match(/^(\d{1,2})(?::?(\d{1,2}))?(am|pm)$/)
  if (ampm) {
    let h = parseInt(ampm[1], 10)
    const m = ampm[2] ? parseInt(ampm[2], 10) : 0
    const isPm = ampm[3] === 'pm'
    if (h < 1 || h > 12 || m < 0 || m > 59) return null
    if (isPm && h !== 12) h += 12
    if (!isPm && h === 12) h = 0
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
  }

  const digits = s.replace(/[^\d:]/g, '')
  if (!digits) return null

  if (digits.includes(':')) {
    const [hStr, mStr = '0'] = digits.split(':')
    const h = parseInt(hStr, 10)
    const m = parseInt(mStr, 10)
    if (isNaN(h) || isNaN(m) || h < 0 || h > 23 || m < 0 || m > 59) return null
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
  }

  if (digits.length <= 2) {
    const h = parseInt(digits, 10)
    if (h < 0 || h > 23) return null
    return `${String(h).padStart(2, '0')}:00`
  }
  if (digits.length === 3) {
    const h = parseInt(digits.slice(0, 1), 10)
    const m = parseInt(digits.slice(1), 10)
    if (h > 23 || m > 59) return null
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
  }
  if (digits.length === 4) {
    const h = parseInt(digits.slice(0, 2), 10)
    const m = parseInt(digits.slice(2), 10)
    if (h > 23 || m > 59) return null
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
  }
  return null
}

function generateTimeOptions(stepMinutes = 30): { value: string; label: string }[] {
  const out: { value: string; label: string }[] = []
  for (let m = 0; m < 24 * 60; m += stepMinutes) {
    const h = Math.floor(m / 60)
    const mm = m % 60
    const value = `${String(h).padStart(2, '0')}:${String(mm).padStart(2, '0')}`
    out.push({ value, label: to12Hour(value) })
  }
  return out
}

const TIME_OPTIONS = generateTimeOptions(30)

function extractErrorMessage(err: unknown, fallback = 'Something went wrong.'): string {
  if (!err) return fallback
  const anyErr = err as any
  const data = anyErr?.response?.data ?? anyErr?.data ?? anyErr

  if (Array.isArray(data?.errors) && data.errors.length > 0) return String(data.errors[0])
  if (typeof data?.message === 'string' && data.message) return data.message
  if (typeof anyErr?.message === 'string' && anyErr.message) return anyErr.message
  return fallback
}

/* ------------------------------------------------------------------ */
/*  Custom Dropdown                                                    */
/* ------------------------------------------------------------------ */

type Option = { value: string; label: string }

function Dropdown({
  label, value, options, onChange, disabled,
}: {
  label: string
  value: string
  options: Option[]
  onChange: (v: string) => void
  disabled?: boolean
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    function onEsc(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onEsc)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('keydown', onEsc)
    }
  }, [open])

  const selected = options.find(o => o.value === value)

  return (
    <div className="flex flex-col gap-1.5" ref={ref}>
      <label className="text-sm font-medium text-ink-2">{label}</label>
      <div className="relative">
        <button
          type="button"
          disabled={disabled}
          onClick={() => setOpen(o => !o)}
          className="
            w-full h-10 px-3 rounded-[10px]
            border border-line bg-surface text-ink text-sm
            flex items-center justify-between gap-2 text-left
            focus:outline-none focus:border-ink-3 focus:ring-2 focus:ring-ink-3/10
            transition-colors disabled:opacity-50 disabled:cursor-not-allowed
          "
        >
          <span className="truncate">{selected?.label ?? 'Select…'}</span>
          <svg
            className={`flex-shrink-0 text-ink-3 transition-transform ${open ? 'rotate-180' : ''}`}
            width="14" height="14" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </button>

        {open && (
          <div className="
            absolute z-20 mt-1.5 w-full
            max-h-64 overflow-y-auto
            rounded-[10px] border border-line bg-surface
            shadow-lg shadow-black/5 py-1
          ">
            {options.map(o => {
              const isSelected = o.value === value
              return (
                <button
                  key={o.value}
                  type="button"
                  onClick={() => { onChange(o.value); setOpen(false) }}
                  className={`
                    w-full px-3 py-2 text-left text-sm
                    flex items-center justify-between gap-2 transition-colors
                    ${isSelected
                      ? 'bg-warm-subtle text-ink font-medium'
                      : 'text-ink-2 hover:bg-warm-subtle hover:text-ink'}
                  `}
                >
                  <span className="truncate">{o.label}</span>
                  {isSelected && (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                      stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"
                      className="text-ink flex-shrink-0">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  )}
                </button>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  TimeField                                                          */
/* ------------------------------------------------------------------ */

function TimeField({
  value, onChange, disabled,
}: {
  value: string
  onChange: (v: string) => void
  disabled?: boolean
}) {
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState(to12Hour(value))
  const [invalid, setInvalid] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => { setDraft(to12Hour(value)); setInvalid(false) }, [value])

  useEffect(() => {
    if (!open) return
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    function onEsc(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onEsc)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('keydown', onEsc)
    }
  }, [open])

  function commit() {
    const parsed = parseTimeInput(draft)
    if (parsed) {
      onChange(parsed)
      setDraft(to12Hour(parsed))
      setInvalid(false)
    } else {
      setInvalid(true)
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      e.preventDefault()
      commit()
      setOpen(false)
      ;(e.target as HTMLInputElement).blur()
    } else if (e.key === 'Escape') {
      setDraft(to12Hour(value))
      setInvalid(false)
      ;(e.target as HTMLInputElement).blur()
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      setOpen(true)
    }
  }

  return (
    <div className="relative" ref={ref}>
      <div
        className={`
          flex items-center
          h-10 pl-3 pr-1 rounded-[10px]
          border bg-surface text-ink text-sm transition-colors
          ${invalid
            ? 'border-[#D4A5A5] focus-within:border-[#B06A6A]'
            : 'border-line focus-within:border-ink-3 focus-within:ring-2 focus-within:ring-ink-3/10'}
          ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
        `}
      >
        <input
          type="text"
          value={draft}
          disabled={disabled}
          placeholder="9:00 AM"
          onChange={e => { setDraft(e.target.value); setInvalid(false) }}
          onBlur={commit}
          onKeyDown={handleKeyDown}
          className="flex-1 min-w-0 h-full bg-transparent text-ink text-sm tabular-nums placeholder:text-ink-3 focus:outline-none"
        />
        <button
          type="button"
          disabled={disabled}
          onClick={() => setOpen(o => !o)}
          aria-label="Pick time"
          className="w-8 h-8 flex items-center justify-center rounded-lg text-ink-3 hover:text-ink-2 hover:bg-warm-subtle transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <svg
            className={`transition-transform ${open ? 'rotate-180' : ''}`}
            width="14" height="14" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </button>
      </div>

      {open && (
        <div className="
          absolute z-20 mt-1.5 w-32
          max-h-64 overflow-y-auto
          rounded-[10px] border border-line bg-surface
          shadow-lg shadow-black/5 py-1
        ">
          {TIME_OPTIONS.map(o => {
            const isSelected = o.value === value
            return (
              <button
                key={o.value}
                type="button"
                onMouseDown={e => e.preventDefault()}
                onClick={() => {
                  onChange(o.value)
                  setDraft(o.label)
                  setInvalid(false)
                  setOpen(false)
                }}
                className={`
                  w-full px-3 py-1.5 text-left text-sm tabular-nums
                  flex items-center justify-between gap-2 transition-colors
                  ${isSelected
                    ? 'bg-warm-subtle text-ink font-medium'
                    : 'text-ink-2 hover:bg-warm-subtle hover:text-ink'}
                `}
              >
                <span>{o.label}</span>
                {isSelected && (
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
                    stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"
                    className="text-ink flex-shrink-0">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                )}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  NumberField                                                        */
/* ------------------------------------------------------------------ */

function NumberField({
  label, value, min, max, onChange,
}: {
  label: string
  value: number
  min?: number
  max?: number
  onChange: (v: number) => void
}) {
  const [draft, setDraft] = useState(String(value))

  useEffect(() => {
    setDraft(prev => {
      const parsed = prev === '' ? NaN : Number(prev)
      return parsed === value ? prev : String(value)
    })
  }, [value])

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const raw = e.target.value
    if (raw === '') { setDraft(''); return }
    const cleaned = raw.replace(/^0+(?=\d)/, '')
    setDraft(cleaned)
    const n = Number(cleaned)
    if (!Number.isNaN(n)) onChange(n)
  }

  function handleBlur() {
    if (draft === '' || Number.isNaN(Number(draft))) {
      const fallback = min ?? 0
      setDraft(String(fallback))
      onChange(fallback)
      return
    }
    let n = Number(draft)
    if (min !== undefined && n < min) n = min
    if (max !== undefined && n > max) n = max
    setDraft(String(n))
    onChange(n)
  }

  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-sm font-medium text-ink-2">{label}</label>
      <input
        type="number"
        inputMode="decimal"
        value={draft}
        min={min}
        max={max}
        onChange={handleChange}
        onBlur={handleBlur}
        onFocus={e => e.target.select()}
        className="h-10 w-full px-3 rounded-[10px] border border-line text-sm bg-surface text-ink focus:outline-none focus:border-ink-3 transition-colors"
      />
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  StorefrontPreview                                                  */
/* ------------------------------------------------------------------ */

function StorefrontPreview({
  branding, business, branches, categories, services,
}: {
  branding: {
    primaryColor: string; secondaryColor: string; logoUrl: string; description: string
    website: string; instagramUrl: string; telegramUrl: string; tiktokUrl: string; facebookUrl: string
  }
  business: { name: string; currency: string; timezone: string }
  branches: BranchDraft[]
  categories: CategoryDraft[]
  services: ServiceDraft[]
}) {
  const primary = branding.primaryColor
  const secondary = branding.secondaryColor
  const salonName = business.name || 'Your salon'

  return (
    <div className="rounded-2xl border border-line overflow-hidden bg-surface shadow-sm">
      <div className="flex items-center gap-2 px-4 py-2.5 bg-bg border-b border-line">
        <span className="w-2.5 h-2.5 rounded-full bg-[#E8C4C4]" />
        <span className="w-2.5 h-2.5 rounded-full bg-[#E8D5A8]" />
        <span className="w-2.5 h-2.5 rounded-full bg-[#C8DBC8]" />
        <div className="flex-1 mx-3 h-6 rounded-md bg-surface border border-line flex items-center px-2">
          <span className="text-[10px] text-ink-3 truncate">
            z-salon.com/{salonName.toLowerCase().replace(/\s+/g, '-')}
          </span>
        </div>
      </div>

      <div className="px-6 pt-6 pb-5" style={{ backgroundColor: primary }}>
        <div className="flex items-center gap-3">
          {branding.logoUrl ? (
            <div className="w-12 h-12 rounded-full overflow-hidden flex-shrink-0 border-2 border-white/40 bg-white">
              <img src={branding.logoUrl} alt="" className="w-full h-full object-cover" />
            </div>
          ) : (
            <div
              className="w-12 h-12 rounded-full flex items-center justify-center text-white text-lg font-semibold flex-shrink-0 border-2 border-white/30"
              style={{ backgroundColor: secondary }}
            >
              {salonName.charAt(0).toUpperCase()}
            </div>
          )}
          <div className="min-w-0">
            <p className="font-display text-xl text-white leading-tight truncate">{salonName}</p>
            <p className="text-white/80 text-xs mt-0.5">
              {branches.length === 0 ? 'Main Branch' : `${branches.length + 1} locations`}
              {' · '}
              {business.currency}
            </p>
          </div>
        </div>

        {branding.description && (
          <p className="text-white/90 text-sm mt-4 leading-relaxed line-clamp-2">
            {branding.description}
          </p>
        )}

        <button
          className="mt-4 h-9 px-4 rounded-lg text-xs font-semibold"
          style={{ backgroundColor: secondary, color: '#fff' }}
        >
          Book an appointment
        </button>
      </div>

      <div className="px-6 py-5">
        <div className="flex items-center justify-between mb-3">
          <p className="text-[10px] font-semibold text-ink-3 uppercase tracking-wider">Services</p>
          <span className="text-[10px] text-ink-3">
            {services.length} service{services.length === 1 ? '' : 's'}
          </span>
        </div>

        {categories.length === 0 ? (
          <div className="rounded-xl border border-dashed border-line p-5 text-center text-xs text-ink-3">
            Categories you add will appear here.
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            {categories.slice(0, 4).map(c => {
              const catServices = services.filter(s => s.categoryKey === c.key && s.name.trim())
              return (
                <div
                  key={c.key}
                  className="rounded-xl border border-line bg-bg px-3 py-2.5 flex items-center gap-2.5"
                >
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-[11px] font-semibold flex-shrink-0"
                    style={{ backgroundColor: primary }}
                  >
                    {c.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-ink truncate">{c.name}</p>
                    <p className="text-[10px] text-ink-3">
                      {catServices.length} service{catServices.length === 1 ? '' : 's'}
                    </p>
                  </div>
                </div>
              )
            })}
            {categories.length > 4 && (
              <div className="col-span-2 text-center text-[10px] text-ink-3 py-1">
                + {categories.length - 4} more categor{categories.length - 4 === 1 ? 'y' : 'ies'}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="px-6 py-4 border-t border-line bg-bg">
        <p className="text-[10px] font-semibold text-ink-3 uppercase tracking-wider mb-2">Find us</p>
        <div className="flex flex-wrap items-center gap-2">
          {branches.length === 0 ? (
            <span className="text-[11px] text-ink-3 px-2.5 py-1 rounded-md border border-line bg-surface">
              Main Branch
            </span>
          ) : (
            branches.slice(0, 3).map(b => (
              <span
                key={b.key}
                className="text-[11px] text-ink-2 px-2.5 py-1 rounded-md border border-line bg-surface truncate max-w-[8rem]"
              >
                {b.name}
              </span>
            ))
          )}
          {branches.length > 3 && (
            <span className="text-[11px] text-ink-3">+{branches.length - 3} more</span>
          )}
        </div>

        {(branding.website || branding.instagramUrl || branding.telegramUrl || branding.tiktokUrl || branding.facebookUrl) && (
          <div className="flex flex-wrap gap-2 mt-3">
            {branding.website && <SocialChip label="Website" href={branding.website} />}
            {branding.instagramUrl && <SocialChip label="Instagram" href={branding.instagramUrl} />}
            {branding.telegramUrl && <SocialChip label="Telegram" href={branding.telegramUrl} />}
            {branding.tiktokUrl && <SocialChip label="TikTok" href={branding.tiktokUrl} />}
            {branding.facebookUrl && <SocialChip label="Facebook" href={branding.facebookUrl} />}
          </div>
        )}
      </div>
    </div>
  )
}

function SocialChip({ label, href }: { label: string; href: string }) {
  return (
    <span className="text-[10px] text-ink-3 px-2 py-0.5 rounded-md border border-line bg-surface" title={href}>
      {label}
    </span>
  )
}

/* ------------------------------------------------------------------ */
/*  Wizard shell                                                       */
/* ------------------------------------------------------------------ */

export function OnboardingWizard({ onComplete }: OnboardingProps) {
  const toast = useToast()
  const { activeBusinessId, activeMembership, isAdminOrOwner } = useBusiness()
  const { reloadMe } = useAuth()

  const [step, setStep] = useState(0)
  const [saving, setSaving] = useState(false)
  const [loadingContext, setLoadingContext] = useState(!activeBusinessId)
  const [timedOut, setTimedOut] = useState(false)

  const business = {
    name:     activeMembership?.business?.name     ?? '',
    currency: activeMembership?.business?.currency ?? 'ETB',
    timezone: activeMembership?.business?.timezone ?? 'Africa/Addis_Ababa',
  }

  const [branches, setBranches] = useState<BranchDraft[]>([])
  const [weeklyDays, setWeeklyDays] = useState<WeeklyDay[]>(defaultWeeklyDays())

  const [booking, setBooking] = useState({
    onlineBookingEnabled: true,
    walkInEnabled: true,
    bookingApprovalRequired: false,
    minimumAdvanceBookingMinutes: 120,
    maximumAdvanceBookingDays: 30,
    bookingBufferMinutes: 0,
    waitlistEnabled: false,

    cancellationWindowMinutes: 60,
    reschedulingEnabled: true,
    customerCancellationEnabled: true,
    customerCancellationPolicy: 'BEFORE_DEADLINE',
    refundPolicyType: 'NO_REFUND' as 'NO_REFUND' | 'FULL_REFUND' | 'PERCENTAGE_REFUND',
    refundPercentage: null as number | null,
    refundDeadlineHours: 24,

    customerConfirmationEnabled: true,
    confirmationReminderHours: 24,
    confirmationDeadlineHours: 2,
    sameDayConfirmationReminderHours: 1,
    pendingAppointmentExpirationMinutes: 30,
  })

  const [categories, setCategories] = useState<CategoryDraft[]>([])
  const [services, setServices] = useState<ServiceDraft[]>([])

  const [branding, setBranding] = useState({
    primaryColor: '#C7B9AD',
    secondaryColor: '#1C1C1C',
    logoUrl: '',
    description: '',
    website: '',
    instagramUrl: '',
    telegramUrl: '',
    tiktokUrl: '',
    facebookUrl: '',
  })

  const TOTAL_STEPS = 7
  const progress = (step / (TOTAL_STEPS - 1)) * 100

  const next = () => setStep(s => Math.min(s + 1, TOTAL_STEPS - 1))
  const prev = () => setStep(s => Math.max(s - 1, 0))

  useEffect(() => {
    if (activeBusinessId) {
      setLoadingContext(false)
      return
    }
    let cancelled = false
    ;(async () => {
      await reloadMe()
      if (!cancelled) setLoadingContext(false)
    })()
    return () => { cancelled = true }
  }, [activeBusinessId, reloadMe])

  useEffect(() => {
    if (activeBusinessId) return
    const t = setTimeout(() => setTimedOut(true), 8000)
    return () => clearTimeout(t)
  }, [activeBusinessId])

  /* ---------------------------------------------------------------- */
  /*  Per-step save + advance handlers                                */
  /* ---------------------------------------------------------------- */

  function guard(): boolean {
    if (!activeBusinessId) {
      toast.error('Missing business context. Please refresh and try again.')
      return false
    }
    if (!isAdminOrOwner) {
      toast.error('Only the salon owner can complete setup.')
      return false
    }
    return true
  }

  async function saveBranchesAndNext() {
    if (!guard()) return
    setSaving(true)
    try {
      const saved: BranchDraft[] = []
      for (const b of branches) {
        if (b.serverId) { saved.push(b); continue }
        const created = await branchesApi.create(activeBusinessId!, {
          name: b.name,
          address: b.address,
          timezone: b.timezone,
        })
        saved.push({ ...b, serverId: created.id })
      }
      setBranches(saved)
      next()
    } catch (err) {
      toast.error(extractErrorMessage(err, 'Could not save your branches. Please try again.'))
    } finally {
      setSaving(false)
    }
  }

  async function saveHoursAndNext() {
    if (!guard()) return
    const primaryBranchId = branches[0]?.serverId
    if (!primaryBranchId) {
      toast.error('No branch found. Please go back and add a branch.')
      return
    }
    setSaving(true)
    try {
      await workingHoursApi.replaceWeekly(activeBusinessId!, primaryBranchId, {
        days: weeklyDays.map(d => ({
          dayOfWeek: d.dayOfWeek,
          isClosed: d.isClosed,
          intervals: d.isClosed ? [] : d.intervals.map(iv => ({
            start: iv.start,
            end: iv.end,
          })),
        })),
      })
      next()
    } catch (err) {
      toast.error(extractErrorMessage(err, 'Could not save your working hours. Please try again.'))
    } finally {
      setSaving(false)
    }
  }

  /**
   * Step 3 — PATCH the booking config, then advance.
   * Body must use nested `booking` / `cancellation` / `confirmation` groups.
   */
  async function saveBookingAndNext() {
    if (!guard()) return
    const primaryBranchId = branches[0]?.serverId
    if (!primaryBranchId) {
      toast.error('No branch found. Please go back and add a branch.')
      return
    }
    setSaving(true)
    try {
      await bookingConfigApi.patch(activeBusinessId!, primaryBranchId, {
        booking: {
          onlineBookingEnabled:         booking.onlineBookingEnabled,
          walkInEnabled:                booking.walkInEnabled,
          bookingApprovalRequired:      booking.bookingApprovalRequired,
          minimumAdvanceBookingMinutes: booking.minimumAdvanceBookingMinutes,
          maximumAdvanceBookingDays:    booking.maximumAdvanceBookingDays,
          bookingBufferMinutes:         booking.bookingBufferMinutes,
          waitlistEnabled:              booking.waitlistEnabled,
        },
        cancellation: {
          cancellationWindowMinutes:    booking.cancellationWindowMinutes,
          reschedulingEnabled:          booking.reschedulingEnabled,
          customerCancellationEnabled:  booking.customerCancellationEnabled,
          customerCancellationPolicy:   booking.customerCancellationPolicy,
          refundPolicyType:             booking.refundPolicyType,
          refundPercentage:             booking.refundPercentage,
          refundDeadlineHours:          booking.refundDeadlineHours,
        },
        confirmation: {
          customerConfirmationEnabled:  booking.customerConfirmationEnabled,
          confirmationReminderHours:    booking.confirmationReminderHours,
          confirmationDeadlineHours:    booking.confirmationDeadlineHours,
          sameDayConfirmationReminderHours: booking.sameDayConfirmationReminderHours,
          pendingAppointmentExpirationMinutes: booking.pendingAppointmentExpirationMinutes,
        },
      })
      next()
    } catch (err) {
      toast.error(extractErrorMessage(err, 'Could not save your booking rules. Please try again.'))
    } finally {
      setSaving(false)
    }
  }

  async function saveCategoriesAndNext() {
    if (!guard()) return
    setSaving(true)
    try {
      const saved: CategoryDraft[] = []
      for (const c of categories) {
        if (c.serverId) { saved.push(c); continue }

        const branchIds = c.branchKeys
          .map(k => branches.find(b => b.key === k)?.serverId)
          .filter((id): id is string => !!id)

        if (branchIds.length === 0) {
          saved.push(c)
          continue
        }

        const created = await serviceCategoriesApi.create(activeBusinessId!, {
          name: c.name,
          description: c.description || undefined,
          branchIds,
        })
        saved.push({ ...c, serverId: created.id })
      }
      setCategories(saved)
      next()
    } catch (err) {
      toast.error(extractErrorMessage(err, 'Could not save your categories. Please try again.'))
    } finally {
      setSaving(false)
    }
  }

  async function saveServicesAndNext() {
    if (!guard()) return
    setSaving(true)
    try {
      const saved: ServiceDraft[] = []
      for (const s of services) {
        if (s.serverId) { saved.push(s); continue }

        const category = categories.find(c => c.key === s.categoryKey)
        if (!category?.serverId) {
          saved.push(s)
          continue
        }

        const branchIds = s.branchKeys
          .map(k => branches.find(b => b.key === k)?.serverId)
          .filter((id): id is string => !!id)

        if (branchIds.length === 0) {
          saved.push(s)
          continue
        }

        const created = await servicesApi.create(activeBusinessId!, {
          categoryId: category.serverId,
          name: s.name,
          description: s.description || undefined,
          durationMinutes: s.durationMinutes,
          price: s.price,
          employeeAssignmentMode: s.employeeAssignmentMode,
          showPriceToCustomer: s.showPriceToCustomer,
          depositPolicyType: s.depositPolicyType,
          depositAmount:
            s.depositPolicyType === 'FIXED' || s.depositPolicyType === 'PERCENTAGE'
              ? s.depositAmount ?? 0
              : null,
          branchIds,
        })
        saved.push({ ...s, serverId: created.id })
      }
      setServices(saved)
      next()
    } catch (err) {
      toast.error(extractErrorMessage(err, 'Could not save your services. Please try again.'))
    } finally {
      setSaving(false)
    }
  }

  async function saveBrandingAndNext() {
    if (!guard()) return
    setSaving(true)
    try {
      await businessApi.updateBranding(activeBusinessId!, {
        primaryColor:   branding.primaryColor,
        secondaryColor: branding.secondaryColor,
        logoUrl:        branding.logoUrl       || undefined,
        description:    branding.description   || undefined,
        website:        branding.website       || undefined,
        instagramUrl:   branding.instagramUrl  || undefined,
        telegramUrl:    branding.telegramUrl   || undefined,
        tiktokUrl:      branding.tiktokUrl     || undefined,
        facebookUrl:    branding.facebookUrl   || undefined,
      })
      next()
    } catch (err) {
      toast.error(extractErrorMessage(err, 'Could not save your branding. Please try again.'))
    } finally {
      setSaving(false)
    }
  }

  /* ---------------------------------------------------------------- */
  /*  Render                                                          */
  /* ---------------------------------------------------------------- */

  if (loadingContext && !timedOut) {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <svg
            className="animate-spin text-ink-3"
            width="24" height="24" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
          >
            <path d="M21 12a9 9 0 11-6.219-8.56" />
          </svg>
          <p className="text-ink-3 text-sm">Loading your business…</p>
        </div>
      </div>
    )
  }

  if (!activeBusinessId) {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center px-6">
        <div className="max-w-sm text-center">
          <h2 className="font-display text-2xl text-ink mb-2">We couldn&apos;t load your business</h2>
          <p className="text-ink-3 text-sm mb-6 leading-relaxed">
            Your session may have expired. Please refresh the page or log in again.
          </p>
          <Button onClick={() => window.location.reload()}>Refresh page</Button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-bg flex flex-col">
      <div className="flex items-center justify-between px-8 py-5 border-b border-line bg-surface">
        <div>
          <span className="font-display text-xl text-ink">Z-salon</span>
          <span className="text-warm font-display italic text-base ml-2">ዘsalon</span>
        </div>
        {step < TOTAL_STEPS - 1 && (
          <span className="text-sm text-ink-3">Step {step + 1} of {TOTAL_STEPS - 1}</span>
        )}
      </div>

      {step < TOTAL_STEPS - 1 && (
        <div className="h-0.5 bg-line">
          <div className="h-full bg-ink transition-all duration-500 ease-out" style={{ width: `${progress}%` }} />
        </div>
      )}

      <div className="flex-1 flex items-start justify-center py-14 px-6 overflow-y-auto">
        <div className="w-full max-w-xl">
          {step === 0 && (
            <StepBranches
              branches={branches}
              onChange={setBranches}
              businessTimezone={business.timezone}
              onNext={saveBranchesAndNext}
              onBack={prev}
              saving={saving}
            />
          )}
          {step === 1 && (
            <StepHours
              days={weeklyDays}
              onChange={setWeeklyDays}
              onNext={saveHoursAndNext}
              onBack={prev}
              saving={saving}
            />
          )}
          {step === 2 && (
            <StepBooking
              data={booking}
              onChange={setBooking}
              onNext={saveBookingAndNext}
              onBack={prev}
              saving={saving}
            />
          )}
          {step === 3 && (
            <StepCategories
              categories={categories}
              branches={branches}
              onChange={setCategories}
              onNext={saveCategoriesAndNext}
              onBack={prev}
              saving={saving}
            />
          )}
          {step === 4 && (
            <StepServices
              services={services}
              categories={categories}
              branches={branches}
              onChange={setServices}
              onNext={saveServicesAndNext}
              onBack={prev}
              saving={saving}
            />
          )}
          {step === 5 && (
            <StepBranding
              data={branding}
              onChange={setBranding}
              business={business}
              businessId={activeBusinessId}
              branches={branches}
              categories={categories}
              services={services}
              onNext={saveBrandingAndNext}
              onBack={prev}
              saving={saving}
            />
          )}
          {step === 6 && (
            <StepComplete
              business={business}
              branches={branches}
              categories={categories}
              services={services}
              weeklyDays={weeklyDays}
              onEnter={onComplete}
            />
          )}
        </div>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Shared UI                                                          */
/* ------------------------------------------------------------------ */

function StepHeader({ title, description }: { title: string; description: string }) {
  return (
    <div className="mb-10">
      <h2 className="font-display text-[2rem] text-ink leading-tight mb-3">{title}</h2>
      <p className="text-ink-3 text-base leading-relaxed">{description}</p>
    </div>
  )
}

function StepNav({
  onBack, onNext, nextLabel = 'Continue', disabled = false, saving = false,
}: {
  onBack?: () => void
  onNext: () => void
  nextLabel?: string
  disabled?: boolean
  saving?: boolean
}) {
  return (
    <div className="flex items-center justify-between mt-10 pt-8 border-t border-line">
      {onBack ? <Button variant="ghost" onClick={onBack} disabled={saving}>Back</Button> : <div />}
      <Button onClick={onNext} size="lg" disabled={disabled} loading={saving}>{nextLabel}</Button>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Step 1 — Branches                                                  */
/* ------------------------------------------------------------------ */

function StepBranches({
  branches, onChange, businessTimezone, onNext, onBack, saving,
}: {
  branches: BranchDraft[]
  onChange: (b: BranchDraft[]) => void
  businessTimezone: string
  onNext: () => void
  onBack: () => void
  saving: boolean
}) {
  const [draft, setDraft] = useState({ name: '', address: '' })

  function add() {
    if (!draft.name.trim() || !draft.address.trim()) return
    onChange([
      ...branches,
      {
        key: `br-${Date.now()}`,
        name: draft.name.trim(),
        address: draft.address.trim(),
        timezone: businessTimezone,
      },
    ])
    setDraft({ name: '', address: '' })
  }

  function remove(key: string) {
    onChange(branches.filter(b => b.key !== key))
  }

  const hasAtLeastOne = branches.length >= 1

  return (
    <div>
      <StepHeader
        title="Add your branches"
        description="Every business gets a Main Branch automatically. Add at least one additional location to continue."
      />
      <div className="flex flex-col gap-4">
        {branches.length === 0 && (
          <div className="text-center py-6 rounded-xl border border-dashed border-line text-sm text-ink-3">
            No branches yet — add at least one to continue.
          </div>
        )}

        {branches.map(b => (
          <div key={b.key} className="px-4 py-3 rounded-xl bg-surface border border-line flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-ink">{b.name}</p>
              <p className="text-xs text-ink-3 mt-0.5">{b.address}</p>
            </div>
            <button
              onClick={() => remove(b.key)}
              disabled={saving}
              className="text-xs text-ink-3 hover:text-[#C47B7B] transition-colors disabled:opacity-50"
            >
              Remove
            </button>
          </div>
        ))}

        <div className="p-5 rounded-xl border border-line bg-surface flex flex-col gap-3">
          <p className="text-xs uppercase tracking-wider text-ink-3">New branch</p>
          <Input
            label="Branch name"
            value={draft.name}
            placeholder="Piassa Branch"
            onChange={e => setDraft(d => ({ ...d, name: e.target.value }))}
          />
          <Input
            label="Address"
            value={draft.address}
            placeholder="Piassa, Addis Ababa"
            onChange={e => setDraft(d => ({ ...d, address: e.target.value }))}
          />
          <div className="flex justify-end">
            <Button
              variant="secondary"
              onClick={add}
              disabled={!draft.name.trim() || !draft.address.trim() || saving}
            >
              Add branch
            </Button>
          </div>
        </div>

        {!hasAtLeastOne && (
          <div className="px-4 py-3 rounded-xl bg-[#FBF5EA] text-[#7A5F2C] text-sm border border-[#E8D5A8]">
            At least one branch is required to continue.
          </div>
        )}
      </div>
      <StepNav
        onBack={onBack}
        onNext={onNext}
        nextLabel="Continue"
        disabled={!hasAtLeastOne}
        saving={saving}
      />
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Step 2 — Weekly hours                                              */
/* ------------------------------------------------------------------ */

function StepHours({
  days, onChange, onNext, onBack, saving,
}: {
  days: WeeklyDay[]
  onChange: (d: WeeklyDay[]) => void
  onNext: () => void
  onBack: () => void
  saving: boolean
}) {
  function update(index: number, changes: Partial<WeeklyDay>) {
    onChange(days.map((d, i) => i === index ? { ...d, ...changes } : d))
  }

  function updateInterval(dayIndex: number, intIndex: number, changes: Partial<{ start: string; end: string }>) {
    const d = days[dayIndex]
    const intervals = d.intervals.map((iv, j) => j === intIndex ? { ...iv, ...changes } : iv)
    update(dayIndex, { intervals })
  }

  function addInterval(dayIndex: number) {
    const d = days[dayIndex]
    update(dayIndex, { intervals: [...d.intervals, { start: '09:00', end: '18:00' }] })
  }

  function removeInterval(dayIndex: number, intIndex: number) {
    const d = days[dayIndex]
    update(dayIndex, { intervals: d.intervals.filter((_, j) => j !== intIndex) })
  }

  const problems: string[] = []
  for (const d of days) {
    if (d.isClosed && d.intervals.length > 0) problems.push(`${DAY_LABELS[d.dayOfWeek]}: must have no intervals when closed`)
    if (!d.isClosed && d.intervals.length === 0) problems.push(`${DAY_LABELS[d.dayOfWeek]}: needs at least one interval`)
    for (let i = 0; i < d.intervals.length; i++) {
      for (let j = i + 1; j < d.intervals.length; j++) {
        if (intervalsOverlap(d.intervals[i], d.intervals[j])) {
          problems.push(`${DAY_LABELS[d.dayOfWeek]}: intervals overlap`)
        }
      }
    }
  }

  return (
    <div>
      <StepHeader
        title="When are you open?"
        description="Set the weekly working hours. This will be applied to your Main Branch."
      />
      <div className="flex flex-col">
        {days.map((d, i) => (
          <div key={d.dayOfWeek} className="py-3.5 border-b border-line last:border-0">
            <div className="flex items-center gap-4">
              <div className="w-24 flex-shrink-0">
                <p className="text-sm font-medium text-ink">{DAY_LABELS[d.dayOfWeek]}</p>
              </div>
              <Toggle
                checked={!d.isClosed}
                onChange={v => update(i, {
                  isClosed: !v,
                  intervals: v && d.intervals.length === 0 ? [{ start: '09:00', end: '18:00' }] : d.intervals,
                })}
              />
              {!d.isClosed ? (
                <span className="text-sm text-ink-3 flex-1">{d.intervals.length} interval{d.intervals.length === 1 ? '' : 's'}</span>
              ) : (
                <span className="text-sm text-ink-3 flex-1">Closed</span>
              )}
            </div>

            {!d.isClosed && (
              <div className="mt-3 pl-[6.5rem] flex flex-col gap-2">
                {d.intervals.map((iv, j) => (
                  <div key={j} className="flex items-center gap-2">
                    <div className="w-[8.5rem]">
                      <TimeField value={iv.start} onChange={v => updateInterval(i, j, { start: v })} />
                    </div>
                    <span className="text-ink-3 text-sm">—</span>
                    <div className="w-[8.5rem]">
                      <TimeField value={iv.end} onChange={v => updateInterval(i, j, { end: v })} />
                    </div>
                    {d.intervals.length > 1 && (
                      <button
                        onClick={() => removeInterval(i, j)}
                        className="text-xs text-ink-3 hover:text-[#C47B7B] transition-colors"
                      >
                        Remove
                      </button>
                    )}
                  </div>
                ))}
                <button
                  onClick={() => addInterval(i)}
                  className="self-start text-xs text-ink-3 hover:text-ink-2 transition-colors"
                >
                  + Add interval
                </button>
              </div>
            )}
          </div>
        ))}
      </div>

      {problems.length > 0 && (
        <div className="mt-5 px-4 py-3 rounded-xl bg-[#F5EAEA] text-[#B06A6A] text-sm border border-[#E8C4C4]">
          {problems[0]}
        </div>
      )}

      <StepNav
        onBack={onBack}
        onNext={onNext}
        disabled={problems.length > 0}
        saving={saving}
      />
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Step 3 — Booking configuration                                     */
/* ------------------------------------------------------------------ */

function StepBooking({
  data, onChange, onNext, onBack, saving,
}: {
  data: {
    onlineBookingEnabled: boolean; walkInEnabled: boolean; bookingApprovalRequired: boolean
    minimumAdvanceBookingMinutes: number; maximumAdvanceBookingDays: number
    bookingBufferMinutes: number; waitlistEnabled: boolean
    cancellationWindowMinutes: number; reschedulingEnabled: boolean
    customerCancellationEnabled: boolean; customerCancellationPolicy: string
    refundPolicyType: 'NO_REFUND' | 'FULL_REFUND' | 'PERCENTAGE_REFUND'
    refundPercentage: number | null; refundDeadlineHours: number
    customerConfirmationEnabled: boolean; confirmationReminderHours: number
    confirmationDeadlineHours: number; sameDayConfirmationReminderHours: number
    pendingAppointmentExpirationMinutes: number
  }
  onChange: (d: typeof data) => void
  onNext: () => void
  onBack: () => void
  saving: boolean
}) {
  return (
    <div>
      <StepHeader
        title="Set up your booking rules"
        description="Configure how customers book, cancel and confirm appointments."
      />
      <div className="flex flex-col gap-7">
        <section>
          <p className="text-xs uppercase tracking-wider text-ink-3 mb-3">Booking</p>
          <div className="flex flex-col gap-3">
            <Toggle checked={data.onlineBookingEnabled}    onChange={v => onChange({ ...data, onlineBookingEnabled: v })}    label="Enable online booking" />
            <Toggle checked={data.walkInEnabled}           onChange={v => onChange({ ...data, walkInEnabled: v })}           label="Enable walk-ins" />
            <Toggle checked={data.bookingApprovalRequired} onChange={v => onChange({ ...data, bookingApprovalRequired: v })} label="Require salon approval for online bookings" />
            <Toggle checked={data.waitlistEnabled}         onChange={v => onChange({ ...data, waitlistEnabled: v })}         label="Enable waitlist" />

            <div className="grid grid-cols-3 gap-3 mt-2">
              <NumberField label="Min. notice (min)"   value={data.minimumAdvanceBookingMinutes} min={0} onChange={v => onChange({ ...data, minimumAdvanceBookingMinutes: v })} />
              <NumberField label="Max. advance (days)" value={data.maximumAdvanceBookingDays}   min={1} onChange={v => onChange({ ...data, maximumAdvanceBookingDays: v })} />
              <NumberField label="Buffer (min)"        value={data.bookingBufferMinutes}        min={0} onChange={v => onChange({ ...data, bookingBufferMinutes: v })} />
            </div>
          </div>
        </section>

        <section>
          <p className="text-xs uppercase tracking-wider text-ink-3 mb-3">Cancellation & refunds</p>
          <div className="flex flex-col gap-3">
            <Toggle checked={data.customerCancellationEnabled} onChange={v => onChange({ ...data, customerCancellationEnabled: v })} label="Allow customer cancellations" />
            <Toggle checked={data.reschedulingEnabled}         onChange={v => onChange({ ...data, reschedulingEnabled: v })}         label="Allow rescheduling" />

            <div className="grid grid-cols-2 gap-3 mt-2">
              <NumberField label="Cancellation window (min)" value={data.cancellationWindowMinutes} min={0} onChange={v => onChange({ ...data, cancellationWindowMinutes: v })} />
              <NumberField label="Refund deadline (hours)"   value={data.refundDeadlineHours}       min={0} onChange={v => onChange({ ...data, refundDeadlineHours: v })} />
            </div>

            <Dropdown
              label="Refund policy"
              value={data.refundPolicyType}
              onChange={v => onChange({ ...data, refundPolicyType: v as typeof data.refundPolicyType })}
              options={[
                { value: 'NO_REFUND', label: 'No refund' },
                { value: 'FULL_REFUND', label: 'Full refund' },
                { value: 'PERCENTAGE_REFUND', label: 'Percentage refund' },
              ]}
            />

            {data.refundPolicyType === 'PERCENTAGE_REFUND' && (
              <NumberField
                label="Refund percentage (%)"
                value={data.refundPercentage ?? 50}
                min={0}
                max={100}
                onChange={v => onChange({ ...data, refundPercentage: v })}
              />
            )}
          </div>
        </section>

        <section>
          <p className="text-xs uppercase tracking-wider text-ink-3 mb-3">Confirmation</p>
          <div className="flex flex-col gap-3">
            <Toggle
              checked={data.customerConfirmationEnabled}
              onChange={v => onChange({ ...data, customerConfirmationEnabled: v })}
              label="Send confirmation reminders"
            />
            {data.customerConfirmationEnabled && (
              <div className="grid grid-cols-3 gap-3">
                <NumberField label="Reminder (hours before)"   value={data.confirmationReminderHours}        min={0} onChange={v => onChange({ ...data, confirmationReminderHours: v })} />
                <NumberField label="Deadline (hours before)"   value={data.confirmationDeadlineHours}        min={0} onChange={v => onChange({ ...data, confirmationDeadlineHours: v })} />
                <NumberField label="Same-day reminder (hours)" value={data.sameDayConfirmationReminderHours} min={0} onChange={v => onChange({ ...data, sameDayConfirmationReminderHours: v })} />
              </div>
            )}
            <NumberField
              label="Pending appointment expiration (min)"
              value={data.pendingAppointmentExpirationMinutes}
              min={0}
              onChange={v => onChange({ ...data, pendingAppointmentExpirationMinutes: v })}
            />
          </div>
        </section>
      </div>
      <StepNav onBack={onBack} onNext={onNext} saving={saving} />
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Step 4 — Service categories                                        */
/* ------------------------------------------------------------------ */

function StepCategories({
  categories, branches, onChange, onNext, onBack, saving,
}: {
  categories: CategoryDraft[]
  branches: BranchDraft[]
  onChange: (c: CategoryDraft[]) => void
  onNext: () => void
  onBack: () => void
  saving: boolean
}) {
  const [draft, setDraft] = useState({ name: '', description: '', branchKeys: [] as string[] })

  function toggleBranch(key: string) {
    setDraft(d => ({
      ...d,
      branchKeys: d.branchKeys.includes(key)
        ? d.branchKeys.filter(k => k !== key)
        : [...d.branchKeys, key],
    }))
  }

  function add() {
    if (!draft.name.trim()) return
    onChange([
      ...categories,
      {
        key: `cat-${Date.now()}`,
        name: draft.name.trim(),
        description: draft.description.trim(),
        branchKeys: draft.branchKeys,
      },
    ])
    setDraft({ name: '', description: '', branchKeys: [] })
  }

  return (
    <div>
      <StepHeader
        title="Create service categories"
        description="Group your services — for example Hair, Nails, Skin. Categories can be shared across branches."
      />
      <div className="flex flex-col gap-4">
        {categories.map(c => (
          <div key={c.key} className="px-4 py-3 rounded-xl bg-surface border border-line">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-ink">{c.name}</p>
                {c.description && <p className="text-xs text-ink-3 mt-0.5">{c.description}</p>}
              </div>
              <button
                onClick={() => onChange(categories.filter(x => x.key !== c.key))}
                disabled={saving}
                className="text-xs text-ink-3 hover:text-[#C47B7B] transition-colors disabled:opacity-50"
              >
                Remove
              </button>
            </div>
          </div>
        ))}

        <div className="p-5 rounded-xl border border-line bg-surface flex flex-col gap-3">
          <p className="text-xs uppercase tracking-wider text-ink-3">New category</p>
          <Input
            label="Name"
            value={draft.name}
            placeholder="Hair"
            onChange={e => setDraft(d => ({ ...d, name: e.target.value }))}
          />
          <Input
            label="Description"
            value={draft.description}
            placeholder="Cuts, coloring and styling"
            onChange={e => setDraft(d => ({ ...d, description: e.target.value }))}
          />

          {branches.length > 0 && (
            <div>
              <p className="text-sm font-medium text-ink-2 mb-2">Available at branches</p>
              <div className="flex flex-wrap gap-2">
                {branches.map(b => (
                  <button
                    key={b.key}
                    type="button"
                    onClick={() => toggleBranch(b.key)}
                    className={`px-3 py-1.5 rounded-full text-xs border transition-colors ${
                      draft.branchKeys.includes(b.key)
                        ? 'border-ink bg-warm-subtle text-ink'
                        : 'border-line text-ink-3 hover:border-ink-3'
                    }`}
                  >
                    {b.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="flex justify-end">
            <Button variant="secondary" onClick={add} disabled={!draft.name.trim() || saving}>
              Add category
            </Button>
          </div>
        </div>
      </div>
      <StepNav onBack={onBack} onNext={onNext} saving={saving} />
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Step 5 — Services                                                  */
/* ------------------------------------------------------------------ */

function StepServices({
  services, categories, branches, onChange, onNext, onBack, saving,
}: {
  services: ServiceDraft[]
  categories: CategoryDraft[]
  branches: BranchDraft[]
  onChange: (s: ServiceDraft[]) => void
  onNext: () => void
  onBack: () => void
  saving: boolean
}) {
  const defaultCategoryKey = categories[0]?.key ?? ''

  function branchesForCategory(categoryKey: string): string[] {
    return categories.find(c => c.key === categoryKey)?.branchKeys ?? []
  }

  function add() {
    if (!defaultCategoryKey) return
    const inherited = branchesForCategory(defaultCategoryKey)
    onChange([
      ...services,
      {
        key: `sv-${Date.now()}`,
        categoryKey: defaultCategoryKey,
        name: '',
        description: '',
        durationMinutes: 60,
        price: 0,
        employeeAssignmentMode: 'CUSTOMER_CHOOSES',
        showPriceToCustomer: true,
        depositPolicyType: 'NONE',
        depositAmount: null,
        branchKeys: inherited,
        branchTouched: false,
      },
    ])
  }

  function update(key: string, changes: Partial<ServiceDraft>) {
    onChange(services.map(s => s.key === key ? { ...s, ...changes } : s))
  }

  function remove(key: string) {
    onChange(services.filter(s => s.key !== key))
  }

  function changeCategory(serviceKey: string, newCategoryKey: string) {
    onChange(services.map(s => {
      if (s.key !== serviceKey) return s
      if (s.branchTouched) return { ...s, categoryKey: newCategoryKey }
      return { ...s, categoryKey: newCategoryKey, branchKeys: branchesForCategory(newCategoryKey) }
    }))
  }

  function toggleBranch(serviceKey: string, branchKey: string) {
    onChange(services.map(s => {
      if (s.key !== serviceKey) return s
      const has = s.branchKeys.includes(branchKey)
      return {
        ...s,
        branchKeys: has
          ? s.branchKeys.filter(k => k !== branchKey)
          : [...s.branchKeys, branchKey],
        branchTouched: true,
      }
    }))
  }

  if (categories.length === 0) {
    return (
      <div>
        <StepHeader
          title="Add your services"
          description="You need at least one category before adding services."
        />
        <div className="rounded-xl border border-dashed border-line p-8 text-center text-sm text-ink-3">
          Add a category first, then come back to this step.
        </div>
        <StepNav onBack={onBack} onNext={onNext} saving={saving} />
      </div>
    )
  }

  return (
    <div>
      <StepHeader
        title="Add your services"
        description="Create the services you offer. You can always add more later."
      />
      <div className="flex flex-col gap-4">
        {services.map((s, i) => {
          const inherited = branchesForCategory(s.categoryKey)
          return (
            <div key={s.key} className="p-5 rounded-xl border border-line bg-surface flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <span className="text-xs text-ink-3 uppercase tracking-wider">Service {i + 1}</span>
                <button
                  onClick={() => remove(s.key)}
                  disabled={saving}
                  className="text-xs text-ink-3 hover:text-[#C47B7B] transition-colors disabled:opacity-50"
                >
                  Remove
                </button>
              </div>

              <Input
                label="Name"
                value={s.name}
                placeholder="Haircut & Blow Dry"
                onChange={e => update(s.key, { name: e.target.value })}
              />

              <Dropdown
                label="Category"
                value={s.categoryKey}
                onChange={v => changeCategory(s.key, v)}
                options={categories.map(c => ({ value: c.key, label: c.name }))}
              />

              <div className="grid grid-cols-3 gap-3">
                <NumberField
                  label="Duration (min)"
                  value={s.durationMinutes}
                  min={1}
                  onChange={v => update(s.key, { durationMinutes: v })}
                />
                <NumberField
                  label="Price"
                  value={s.price}
                  min={0}
                  onChange={v => update(s.key, { price: v })}
                />
                <div className="flex items-end pb-1">
                  <Toggle
                    checked={s.showPriceToCustomer}
                    onChange={v => update(s.key, { showPriceToCustomer: v })}
                    label="Show price"
                  />
                </div>
              </div>

              <Dropdown
                label="Employee assignment"
                value={s.employeeAssignmentMode}
                onChange={v => update(s.key, { employeeAssignmentMode: v as ServiceDraft['employeeAssignmentMode'] })}
                options={[
                  { value: 'CUSTOMER_CHOOSES', label: 'Customer chooses' },
                  { value: 'SALON_ASSIGNS', label: 'Salon assigns' },
                  { value: 'ANY_AVAILABLE', label: 'Any available' },
                ]}
              />

              <div className="grid grid-cols-2 gap-3">
                <Dropdown
                  label="Deposit policy"
                  value={s.depositPolicyType}
                  onChange={v => {
                    const type = v as ServiceDraft['depositPolicyType']
                    update(s.key, {
                      depositPolicyType: type,
                      depositAmount: type === 'FIXED' || type === 'PERCENTAGE' ? (s.depositAmount ?? 0) : null,
                    })
                  }}
                  options={[
                    { value: 'NONE', label: 'No deposit' },
                    { value: 'FIXED', label: 'Fixed amount' },
                    { value: 'PERCENTAGE', label: 'Percentage' },
                    { value: 'FULL', label: 'Full payment' },
                  ]}
                />
                {(s.depositPolicyType === 'FIXED' || s.depositPolicyType === 'PERCENTAGE') && (
                  <NumberField
                    label={s.depositPolicyType === 'PERCENTAGE' ? 'Deposit (%)' : 'Deposit amount'}
                    value={s.depositAmount ?? 0}
                    min={0}
                    max={s.depositPolicyType === 'PERCENTAGE' ? 100 : undefined}
                    onChange={v => update(s.key, { depositAmount: v })}
                  />
                )}
              </div>

              {branches.length > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm font-medium text-ink-2">Available at branches</p>
                    {!s.branchTouched && inherited.length > 0 && (
                      <span className="text-xs text-ink-3 italic">inherited from category</span>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {branches.map(b => (
                      <button
                        key={b.key}
                        type="button"
                        onClick={() => toggleBranch(s.key, b.key)}
                        className={`px-3 py-1.5 rounded-full text-xs border transition-colors ${
                          s.branchKeys.includes(b.key)
                            ? 'border-ink bg-warm-subtle text-ink'
                            : 'border-line text-ink-3 hover:border-ink-3'
                        }`}
                      >
                        {b.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )
        })}

        <button
          onClick={add}
          disabled={saving}
          className="flex items-center justify-center gap-2 py-4 rounded-xl border-2 border-dashed border-line text-ink-3 hover:border-warm hover:text-ink-2 transition-all text-sm font-medium disabled:opacity-50"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 5v14M5 12h14" /></svg>
          Add another service
        </button>
      </div>
      <StepNav onBack={onBack} onNext={onNext} saving={saving} />
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Step 6 — Branding                                                  */
/* ------------------------------------------------------------------ */

function StepBranding({
  data, onChange, business, businessId, branches, categories, services, onNext, onBack, saving,
}: {
  data: {
    primaryColor: string; secondaryColor: string; logoUrl: string; description: string
    website: string; instagramUrl: string; telegramUrl: string; tiktokUrl: string; facebookUrl: string
  }
  onChange: (d: typeof data) => void
  business: { name: string; currency: string; timezone: string }
  businessId: string | null
  branches: BranchDraft[]
  categories: CategoryDraft[]
  services: ServiceDraft[]
  onNext: () => void
  onBack: () => void
  saving: boolean
}) {
  const presets = ['#C7B9AD', '#1C1C1C', '#8B7B6E', '#7B9FAB', '#9B8FA8', '#8BAB95']

  const logoFolder = businessId ? `business/${businessId}/logo` : 'business/unknown/logo'

  return (
    <div>
      <StepHeader
        title="Almost done — polish your brand"
        description="Upload your logo, pick your colors, and see how your storefront will look."
      />

      <div className="flex flex-col gap-6">
        <ImageUploader
          label="Logo"
          hint="PNG or JPG, up to 2 MB"
          aspect="square"
          value={data.logoUrl}
          folder={logoFolder}
          onChange={asset => onChange({ ...data, logoUrl: asset.imageUrl })}
          onRemove={() => onChange({ ...data, logoUrl: '' })}
        />

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-sm font-medium text-ink-2 block mb-3">Primary color</label>
            <div className="flex items-center gap-3 flex-wrap">
              <input
                type="color"
                value={data.primaryColor}
                onChange={e => onChange({ ...data, primaryColor: e.target.value })}
                className="w-11 h-11 rounded-xl border border-line cursor-pointer p-0.5 bg-surface"
              />
              <div className="flex gap-2">
                {presets.map(c => (
                  <button
                    key={c}
                    onClick={() => onChange({ ...data, primaryColor: c })}
                    className={`w-7 h-7 rounded-full border-2 transition-all ${data.primaryColor === c ? 'border-ink scale-110' : 'border-transparent hover:border-ink-3'}`}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
            </div>
          </div>
          <div>
            <label className="text-sm font-medium text-ink-2 block mb-3">Secondary color</label>
            <div className="flex items-center gap-3">
              <input
                type="color"
                value={data.secondaryColor}
                onChange={e => onChange({ ...data, secondaryColor: e.target.value })}
                className="w-11 h-11 rounded-xl border border-line cursor-pointer p-0.5 bg-surface"
              />
            </div>
          </div>
        </div>

        <div>
          <label className="text-sm font-medium text-ink-2 block mb-2">Short description</label>
          <textarea
            value={data.description}
            onChange={e => onChange({ ...data, description: e.target.value })}
            maxLength={1000}
            rows={3}
            placeholder="Hair & beauty in Addis Ababa."
            className="w-full px-3 py-2.5 rounded-xl border border-line bg-surface text-ink text-sm focus:outline-none focus:border-ink-3 transition-colors resize-none"
          />
          <p className="text-xs text-ink-3 mt-1">{data.description.length} / 1000</p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Input label="Website"   value={data.website}      placeholder="https://..." onChange={e => onChange({ ...data, website: e.target.value })} />
          <Input label="Instagram" value={data.instagramUrl} placeholder="https://..." onChange={e => onChange({ ...data, instagramUrl: e.target.value })} />
          <Input label="Telegram"  value={data.telegramUrl}  placeholder="https://..." onChange={e => onChange({ ...data, telegramUrl: e.target.value })} />
          <Input label="TikTok"    value={data.tiktokUrl}    placeholder="https://..." onChange={e => onChange({ ...data, tiktokUrl: e.target.value })} />
          <div className="col-span-2">
            <Input label="Facebook" value={data.facebookUrl} placeholder="https://..." onChange={e => onChange({ ...data, facebookUrl: e.target.value })} />
          </div>
        </div>

        <div>
          <p className="text-xs font-semibold text-ink-3 uppercase tracking-wider mb-2">Preview</p>
          <StorefrontPreview
            branding={data}
            business={business}
            branches={branches}
            categories={categories}
            services={services}
          />
        </div>
      </div>

      <StepNav
        onBack={onBack}
        onNext={onNext}
        nextLabel="Finish setup"
        saving={saving}
      />
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Step 7 — Complete                                                  */
/* ------------------------------------------------------------------ */

function StepComplete({
  business, branches, categories, services, weeklyDays, onEnter,
}: {
  business: { name: string; currency: string; timezone: string }
  branches: BranchDraft[]
  categories: CategoryDraft[]
  services: ServiceDraft[]
  weeklyDays: WeeklyDay[]
  onEnter: () => void
}) {
  const openDays = weeklyDays.filter(d => !d.isClosed)
  const hoursSummary =
    openDays.length === 0
      ? 'No open days'
      : `${openDays.length} day${openDays.length === 1 ? '' : 's'} open per week`

  return (
    <div className="text-center py-8">
      <div className="w-20 h-20 rounded-full bg-ink flex items-center justify-center mx-auto mb-8">
        <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.5">
          <path d="M9 12l2 2 4-4M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      </div>

      <h2 className="font-display text-4xl text-ink mb-2">Your salon is ready.</h2>
      <p className="text-ink-3 text-base mb-10">Welcome to Z-salon.</p>

      <div className="text-left bg-surface rounded-2xl border border-line divide-y divide-line mb-10 max-w-sm mx-auto">
        <div className="flex items-center justify-between px-5 py-4">
          <span className="text-sm text-ink-3">Currency</span>
          <span className="text-sm font-medium text-ink">{business.currency}</span>
        </div>
        <div className="flex items-center justify-between px-5 py-4">
          <span className="text-sm text-ink-3">Branches</span>
          <span className="text-sm font-medium text-ink">
            {branches.length === 0 ? '1 (Main Branch)' : `${branches.length + 1} total`}
          </span>
        </div>
        <div className="flex items-center justify-between px-5 py-4">
          <span className="text-sm text-ink-3">Categories</span>
          <span className="text-sm font-medium text-ink">{categories.length} added</span>
        </div>
        <div className="flex items-center justify-between px-5 py-4">
          <span className="text-sm text-ink-3">Services</span>
          <span className="text-sm font-medium text-ink">{services.length} added</span>
        </div>
        <div className="flex items-center justify-between px-5 py-4">
          <span className="text-sm text-ink-3">Opening hours</span>
          <span className="text-sm font-medium text-ink">{hoursSummary}</span>
        </div>
      </div>

      <Button size="lg" onClick={onEnter}>Enter Z-salon</Button>
    </div>
  )
}