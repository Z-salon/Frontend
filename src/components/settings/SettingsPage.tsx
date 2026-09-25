// src/components/settings/SettingsPage.tsx

import { useEffect, useMemo, useState } from 'react'
import type { AppSettings, ExpenseCategory, PaymentMethod } from '../../types'
import type {
  BusinessConfig,
  BrandingPayload,
  BookingConfig,
  BookingConfigPatch,
} from '../../types/api'
import { Button, Toggle } from '../ui'
import { businessApi } from '../../api/business.api'
import { bookingConfigApi } from '../../api/booking-config.api'
import { useBusiness } from '../../contexts/BusinessContext'
import { useBranch } from '../../contexts/BranchContext'

interface SettingsPageProps {
  settings: AppSettings
  expenseCategories: ExpenseCategory[]
  paymentMethods: PaymentMethod[]
  onUpdateSettings: (s: AppSettings) => void
  onUpdateCategories: (c: ExpenseCategory[]) => void
  onUpdatePaymentMethods: (p: PaymentMethod[]) => void
  onLogout: () => void
}

type SettingsSection =
  | 'business'
  | 'branding'
  | 'booking'
  | 'finance'
  | 'feedback'
  | 'notifications'
  | 'account'

export function SettingsPage({
  settings, expenseCategories, paymentMethods,
  onUpdateSettings, onUpdateCategories, onUpdatePaymentMethods, onLogout,
}: SettingsPageProps) {
  const { activeBusinessId } = useBusiness()
  const [section, setSection] = useState<SettingsSection>('business')

  /* ------------------------------------------------------------------ */
  /*  Live business config — shared across Business + Branding tabs.     */
  /* ------------------------------------------------------------------ */

  const [config, setConfig] = useState<BusinessConfig | null>(null)
  const [configLoading, setConfigLoading] = useState(false)

  const [branding, setBranding] = useState<BrandingPayload | null>(null)
  const [brandingLoading, setBrandingLoading] = useState(false)

  useEffect(() => {
    if (!activeBusinessId) return
    let cancelled = false

    setConfigLoading(true)
    ;(async () => {
      try {
        const res = await businessApi.me()
        if (!cancelled) setConfig(res)
      } catch (err) {
        console.warn('[settings] businessApi.me failed', err)
      } finally {
        if (!cancelled) setConfigLoading(false)
      }
    })()

    return () => { cancelled = true }
  }, [activeBusinessId])

  useEffect(() => {
    if (!activeBusinessId) return
    let cancelled = false

    setBrandingLoading(true)
    ;(async () => {
      try {
        const res = await businessApi.branding(activeBusinessId)
        if (!cancelled) setBranding(res)
      } catch (err) {
        console.warn('[settings] businessApi.branding failed', err)
      } finally {
        if (!cancelled) setBrandingLoading(false)
      }
    })()

    return () => { cancelled = true }
  }, [activeBusinessId])

  /* ------------------------------------------------------------------ */
  /*  Nav                                                                */
  /* ------------------------------------------------------------------ */

  const NAV: { id: SettingsSection; label: string }[] = [
    { id: 'business',      label: 'Business'      },
    { id: 'branding',      label: 'Branding'      },
    { id: 'booking',       label: 'Booking'       },
    { id: 'finance',       label: 'Finance'       },
    { id: 'feedback',      label: 'Feedback'      },
    { id: 'notifications', label: 'Notifications' },
    // { id: 'account',       label: 'Account'       },
  ]

  return (
    <div className="flex flex-col lg:flex-row h-full overflow-hidden">
      {/* Left nav — horizontal scroll on mobile, vertical on lg */}
      <div className="
        w-full lg:w-52 flex-shrink-0
        border-b lg:border-b-0 lg:border-r border-line
        bg-surface flex flex-col
      ">
        <div className="px-4 sm:px-5 py-4 sm:py-5 border-b border-line">
          <p className="font-display text-lg text-ink leading-none">Settings</p>
        </div>
        <nav className="
          flex-1 py-2 lg:py-3 px-2 lg:px-3
          flex lg:flex-col gap-1
          overflow-x-auto lg:overflow-visible
        ">
          {NAV.map(n => (
            <button
              key={n.id}
              onClick={() => setSection(n.id)}
              className={`
                px-3 py-2.5 rounded-xl text-sm font-medium text-left transition-all
                whitespace-nowrap flex-shrink-0
                ${section === n.id
                  ? 'bg-ink text-surface'
                  : 'text-ink-3 hover:text-ink hover:bg-warm-subtle'}
              `}
            >
              {n.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-4 sm:px-6 lg:px-10 py-5 sm:py-6 lg:py-8">
        {section === 'business' && (
          <BusinessSettings
            businessId={activeBusinessId ?? ''}
            config={config}
            loading={configLoading}
            onSaved={setConfig}
          />
        )}

        {section === 'branding' && (
          <BrandingSettings
            businessId={activeBusinessId ?? ''}
            branding={branding}
            loading={brandingLoading}
            onSaved={setBranding}
          />
        )}

        {section === 'booking' && <BookingSettings />}

        {section === 'finance' && (
          <FinanceSettings
            settings={settings}
            expenseCategories={expenseCategories}
            paymentMethods={paymentMethods}
            onUpdate={onUpdateSettings}
            onUpdateCategories={onUpdateCategories}
            onUpdatePaymentMethods={onUpdatePaymentMethods}
          />
        )}

        {section === 'feedback' && (
          <FeedbackSettings settings={settings} onUpdate={onUpdateSettings} />
        )}

        {section === 'notifications' && (
          <NotificationSettings settings={settings} onUpdate={onUpdateSettings} />
        )}

        {/* {section === 'account' && <AccountSettings onLogout={onLogout} />} */}
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Section: Business — live via businessApi.me / businessApi.update   */
/* ------------------------------------------------------------------ */

function BusinessSettings({
  businessId,
  config,
  loading,
  onSaved,
}: {
  businessId: string
  config: BusinessConfig | null
  loading: boolean
  onSaved: (c: BusinessConfig) => void
}) {
  const [name,     setName]     = useState('')
  const [currency, setCurrency] = useState('ETB')
  const [timezone, setTimezone] = useState('Africa/Addis_Ababa')
  const [saving,   setSaving]   = useState(false)
  const [saved,    setSaved]    = useState(false)
  const [error,    setError]    = useState<string | null>(null)

  useEffect(() => {
    if (!config) return
    setName(config.name)
    setCurrency(config.currency)
    setTimezone(config.timezone)
  }, [config])

  const dirty =
    !!config &&
    (name.trim() !== config.name ||
      currency !== config.currency ||
      timezone !== config.timezone)

  async function save() {
    if (!businessId || !config) return
    setError(null)
    setSaving(true)
    try {
      const patch: { name?: string; currency?: string; timezone?: string } = {}
      if (name.trim() !== config.name) patch.name = name.trim()
      if (currency !== config.currency) patch.currency = currency
      if (timezone !== config.timezone) patch.timezone = timezone

      if (Object.keys(patch).length === 0) {
        setSaved(true)
        setTimeout(() => setSaved(false), 2500)
        return
      }

      const updated = await businessApi.update(businessId, patch)
      onSaved(updated)
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    } catch (err: any) {
      console.error('[settings] business update failed', err)
      setError(extractErrorMessage(err, 'Could not save business settings.'))
    } finally {
      setSaving(false)
    }
  }

  const branch = config?.branch

  return (
    <Section title="Business" description="Update your salon's basic information.">
      <div className="flex flex-col gap-4 max-w-md">
        {loading && (
          <p className="text-xs text-ink-3">Loading…</p>
        )}

        <Field label="Salon name" value={name} onChange={setName} />

        <div>
          <label className="text-xs font-semibold text-ink-3 mb-1.5 block">
            Currency
          </label>
          <select
            value={currency}
            onChange={e => setCurrency(e.target.value)}
            className="w-full px-3 py-2.5 rounded-xl border border-line text-sm bg-bg text-ink focus:outline-none focus:border-warm"
          >
            <option value="ETB">ETB — Ethiopian Birr</option>
            <option value="USD">USD — US Dollar</option>
            <option value="EUR">EUR — Euro</option>
            <option value="GBP">GBP — Pound Sterling</option>
            <option value="KES">KES — Kenyan Shilling</option>
            <option value="NGN">NGN — Nigerian Naira</option>
            <option value="ZAR">ZAR — South African Rand</option>
          </select>
        </div>

        <Field label="Timezone" value={timezone} onChange={setTimezone} />

        {branch && (
          <div className="bg-warm-subtle rounded-xl px-4 py-3 flex flex-col gap-1">
            <p className="text-xs font-semibold text-ink-3 uppercase tracking-wider">
              First branch
            </p>
            <p className="text-sm text-ink">{branch.name}</p>
            {branch.address && (
              <p className="text-xs text-ink-3">{branch.address}</p>
            )}
            {branch.phones.length > 0 && (
              <p className="text-xs text-ink-3">
                {branch.phones.find(p => p.isPrimary)?.phone ?? branch.phones[0].phone}
              </p>
            )}
            <p className="text-[11px] text-ink-3 mt-1">
              Contact and address are managed per branch — open the Branch tab to edit.
            </p>
          </div>
        )}

        {error && (
          <p className="text-xs text-[#B06A6A]">{error}</p>
        )}

        <SaveBar
          saved={saved}
          saving={saving}
          disabled={!dirty || saving}
          onSave={save}
        />
      </div>
    </Section>
  )
}

/* ------------------------------------------------------------------ */
/*  Section: Branding — live via businessApi.branding / updateBranding */
/* ------------------------------------------------------------------ */

function BrandingSettings({
  businessId,
  branding,
  loading,
  onSaved,
}: {
  businessId: string
  branding: BrandingPayload | null
  loading: boolean
  onSaved: (b: BrandingPayload) => void
}) {
  const [description, setDescription]     = useState('')
  const [aboutUs,     setAboutUs]         = useState('')
  const [primary,     setPrimary]         = useState('#000000')
  const [secondary,   setSecondary]       = useState('#000000')
  const [website,     setWebsite]         = useState('')
  const [facebook,    setFacebook]        = useState('')
  const [instagram,   setInstagram]       = useState('')
  const [telegram,    setTelegram]        = useState('')
  const [tiktok,      setTiktok]          = useState('')
  const [saving,      setSaving]          = useState(false)
  const [saved,       setSaved]           = useState(false)
  const [error,       setError]           = useState<string | null>(null)

  useEffect(() => {
    if (!branding) return
    setDescription(readString(branding, 'description') ?? '')
    setAboutUs(readString(branding, 'aboutUs') ?? '')
    setPrimary(readString(branding, 'primaryColor') ?? '#000000')
    setSecondary(readString(branding, 'secondaryColor') ?? '#000000')
    setWebsite(readString(branding, 'website') ?? '')
    setFacebook(readString(branding, 'facebookUrl') ?? '')
    setInstagram(readString(branding, 'instagramUrl') ?? '')
    setTelegram(readString(branding, 'telegramUrl') ?? '')
    setTiktok(readString(branding, 'tiktokUrl') ?? '')
  }, [branding])

  function trimmedOrNull(v: string): string | null {
    const t = v.trim()
    return t ? t : null
  }

  const dirty = !!branding && (
    description !== (readString(branding, 'description') ?? '') ||
    aboutUs     !== (readString(branding, 'aboutUs') ?? '') ||
    primary     !== (readString(branding, 'primaryColor') ?? '#000000') ||
    secondary   !== (readString(branding, 'secondaryColor') ?? '#000000') ||
    website     !== (readString(branding, 'website') ?? '') ||
    facebook    !== (readString(branding, 'facebookUrl') ?? '') ||
    instagram   !== (readString(branding, 'instagramUrl') ?? '') ||
    telegram    !== (readString(branding, 'telegramUrl') ?? '') ||
    tiktok      !== (readString(branding, 'tiktokUrl') ?? '')
  )

  async function save() {
    if (!businessId) return
    setError(null)
    setSaving(true)
    try {
      await businessApi.updateBranding(businessId, {
        description:    trimmedOrNull(description),
        aboutUs:        trimmedOrNull(aboutUs),
        primaryColor:   primary   || null,
        secondaryColor: secondary || null,
        website:        trimmedOrNull(website),
        facebookUrl:    trimmedOrNull(facebook),
        instagramUrl:   trimmedOrNull(instagram),
        telegramUrl:    trimmedOrNull(telegram),
        tiktokUrl:      trimmedOrNull(tiktok),
      } as any)
      const fresh = await businessApi.branding(businessId)
      onSaved(fresh)
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    } catch (err: any) {
      console.error('[settings] branding update failed', err)
      setError(extractErrorMessage(err, 'Could not save branding.'))
    } finally {
      setSaving(false)
    }
  }

  const businessName = branding?.branches?.[0]?.name ?? 'Z-salon'
  const logoUrl = readLogoUrl(branding)

  return (
    <Section title="Branding" description="Manage your salon's visual identity.">
      <div className="max-w-md flex flex-col gap-6">
        {loading && <p className="text-xs text-ink-3">Loading…</p>}

        <div>
          <label className="text-xs font-semibold text-ink-3 mb-3 block">
            Salon logo
          </label>
          <div className="w-24 h-24 rounded-2xl border-2 border-dashed border-line bg-bg flex items-center justify-center overflow-hidden">
            {logoUrl ? (
              <img
                src={logoUrl}
                alt="Salon logo"
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="text-center">
                <div className="font-display text-2xl text-warm leading-none">Z</div>
                <p className="text-[10px] text-ink-3 mt-1">No logo</p>
              </div>
            )}
          </div>
          <p className="text-[11px] text-ink-3 mt-2">
            Image uploads are managed through the branding API — not editable here yet.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-semibold text-ink-3 mb-1.5 block">
              Primary color
            </label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={primary}
                onChange={e => setPrimary(e.target.value)}
                className="w-10 h-10 rounded-lg border border-line bg-bg cursor-pointer flex-shrink-0"
              />
              <input
                type="text"
                value={primary}
                onChange={e => setPrimary(e.target.value)}
                className="flex-1 min-w-0 px-3 py-2.5 rounded-xl border border-line text-sm bg-bg text-ink focus:outline-none focus:border-warm font-mono"
              />
            </div>
          </div>
          <div>
            <label className="text-xs font-semibold text-ink-3 mb-1.5 block">
              Secondary color
            </label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={secondary}
                onChange={e => setSecondary(e.target.value)}
                className="w-10 h-10 rounded-lg border border-line bg-bg cursor-pointer flex-shrink-0"
              />
              <input
                type="text"
                value={secondary}
                onChange={e => setSecondary(e.target.value)}
                className="flex-1 min-w-0 px-3 py-2.5 rounded-xl border border-line text-sm bg-bg text-ink focus:outline-none focus:border-warm font-mono"
              />
            </div>
          </div>
        </div>

        <div>
          <label className="text-xs font-semibold text-ink-3 mb-3 block">
            Brand preview
          </label>
          <div
            className="rounded-2xl p-6 flex flex-col items-center"
            style={{ background: primary }}
          >
            <p
              className="font-display text-3xl"
              style={{ color: secondary }}
            >
              {businessName}
            </p>
            <p
              className="font-display italic text-lg"
              style={{ color: secondary, opacity: 0.75 }}
            >
              ዘsalon
            </p>
          </div>
        </div>

        <Field
          label="Short description"
          value={description}
          onChange={setDescription}
        />
        <TextArea
          label="About us"
          value={aboutUs}
          onChange={setAboutUs}
          rows={4}
        />

        <Field label="Website"   value={website}   onChange={setWebsite} />
        <Field label="Facebook"  value={facebook}  onChange={setFacebook} />
        <Field label="Instagram" value={instagram} onChange={setInstagram} />
        <Field label="Telegram"  value={telegram}  onChange={setTelegram} />
        <Field label="TikTok"    value={tiktok}    onChange={setTiktok} />

        {error && <p className="text-xs text-[#B06A6A]">{error}</p>}

        <SaveBar
          saved={saved}
          saving={saving}
          disabled={!dirty || saving}
          onSave={save}
        />
      </div>
    </Section>
  )
}

/* ------------------------------------------------------------------ */
/*  Section: Booking — live via bookingConfigApi (§7)                  */
/*                                                                     */
/*  Booking config is PER-BRANCH. This tab uses the app-wide branch    */
/*  context for the branch list and the currently active branch.       */
/*  The body sent on save uses the nested `booking` / `cancellation` / */
/*  `confirmation` groups (§7.2) — a flat body is rejected by the      */
/*  strict schema.                                                     */
/* ------------------------------------------------------------------ */

const REFUND_POLICY_OPTIONS = [
  { value: 'NO_REFUND',         label: 'No refund' },
  { value: 'FULL_REFUND',       label: 'Full refund' },
  { value: 'PERCENTAGE_REFUND', label: 'Percentage refund' },
] as const

const CUSTOMER_CANCELLATION_POLICY_OPTIONS = [
  { value: 'ALWAYS',          label: 'Always' },
  { value: 'BEFORE_DEADLINE', label: 'Before deadline' },
  { value: 'NEVER',           label: 'Never' },
] as const

function BookingSettings() {
  const { activeBusinessId } = useBusiness()
  const {
    branches,
    activeBranchId,
    setActiveBranchId,
    loading: loadingBranches,
  } = useBranch()

  // Fall back to the first branch if the context hasn't picked one yet.
  const branchId = useMemo(
    () => activeBranchId === 'all'
      ? (branches[0]?.id ?? null)
      : activeBranchId,
    [activeBranchId, branches],
  )

  const [config, setConfig]     = useState<BookingConfig | null>(null)
  const [baseline, setBaseline] = useState<BookingConfig | null>(null)

  const [loadingConfig, setLoadingConfig] = useState(false)
  const [saving, setSaving]               = useState(false)
  const [saved, setSaved]                 = useState(false)
  const [error, setError]                 = useState<string | null>(null)

  /* -------- Load config when branch changes -------- */
  useEffect(() => {
    if (!activeBusinessId || !branchId) {
      setConfig(null)
      setBaseline(null)
      return
    }
    let cancelled = false

    setLoadingConfig(true)
    setError(null)
    ;(async () => {
      try {
        const res = await bookingConfigApi.get(activeBusinessId, branchId)
        if (cancelled) return
        setConfig(res)
        setBaseline(res)
      } catch (err: any) {
        console.error('[settings] booking config load failed', err)
        if (!cancelled) {
          setError(extractErrorMessage(err, 'Could not load booking configuration.'))
          setConfig(null)
          setBaseline(null)
        }
      } finally {
        if (!cancelled) setLoadingConfig(false)
      }
    })()

    return () => { cancelled = true }
  }, [activeBusinessId, branchId])

  function patch<K extends keyof BookingConfig>(
    section: K,
    field: keyof BookingConfig[K],
    value: any,
  ) {
    setConfig(prev => {
      if (!prev) return prev
      return {
        ...prev,
        [section]: { ...prev[section], [field]: value },
      }
    })
  }

  const dirty = useMemo(() => {
    if (!config || !baseline) return false
    return JSON.stringify(config) !== JSON.stringify(baseline)
  }, [config, baseline])

  async function save() {
    if (!activeBusinessId || !branchId || !config || !baseline) return

    const patchBody: BookingConfigPatch = {}
    ;(['booking', 'cancellation', 'confirmation'] as const).forEach(section => {
      const diff: any = {}
      const a = config[section] as any
      const b = baseline[section] as any
      for (const key of Object.keys(a)) {
        if (a[key] !== b[key]) diff[key] = a[key]
      }
      if (Object.keys(diff).length > 0) patchBody[section] = diff
    })

    if (Object.keys(patchBody).length === 0) {
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
      return
    }

    setSaving(true)
    setError(null)
    try {
      const updated = await bookingConfigApi.patch(activeBusinessId, branchId, patchBody)
      setConfig(updated)
      setBaseline(updated)
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    } catch (err: any) {
      console.error('[settings] booking config save failed', err)
      setError(extractErrorMessage(err, 'Could not save booking configuration.'))
    } finally {
      setSaving(false)
    }
  }

  function reset() {
    if (baseline) setConfig(baseline)
  }

  const currentBranch = branches.find(b => b.id === branchId) ?? null

  return (
    <Section
      title="Booking"
      description="Configure how customers book appointments at each branch."
    >
      <div className="flex flex-col gap-6 max-w-2xl">
        {/* Branch picker — driven by the shared branch context */}
        <div>
          <label className="text-xs font-semibold text-ink-3 mb-2 block">
            Branch
          </label>
          {loadingBranches ? (
            <p className="text-xs text-ink-3">Loading branches…</p>
          ) : branches.length === 0 ? (
            <p className="text-xs text-ink-3">
              No branches yet. Add a branch first.
            </p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {branches.map(b => (
                <button
                  key={b.id}
                  type="button"
                  onClick={() => setActiveBranchId(b.id)}
                  className={`
                    px-3 py-1.5 rounded-xl text-xs border transition-all
                    ${branchId === b.id
                      ? 'border-ink bg-ink text-surface'
                      : 'border-line bg-surface text-ink-2 hover:border-warm'}
                  `}
                >
                  {branchId === b.id ? '✓' : '+'} {b.name}
                </button>
              ))}
            </div>
          )}
          {currentBranch && (
            <p className="text-[11px] text-ink-3 mt-2">
              Editing booking settings for <strong>{currentBranch.name}</strong>.
              Each branch has its own configuration.
            </p>
          )}
        </div>

        {error && (
          <div className="bg-[#FBEDED] border border-[#E5B5B5] rounded-xl px-4 py-3">
            <p className="text-xs text-[#B03A3A]">{error}</p>
          </div>
        )}

        {loadingConfig ? (
          <p className="text-xs text-ink-3">Loading configuration…</p>
        ) : !config ? (
          <p className="text-xs text-ink-3">
            Select a branch to configure its booking settings.
          </p>
        ) : (
          <>
            {/* ───────────── Booking ───────────── */}
            <SubSection
              title="Booking"
              subtitle="How customers can book and how far ahead."
            >
              <ToggleRow
                label="Online booking enabled"
                description="Allow customers to book through the storefront."
                value={config.booking.onlineBookingEnabled}
                onChange={v => patch('booking', 'onlineBookingEnabled', v)}
              />
              <ToggleRow
                label="Walk-in enabled"
                description="Allow walk-in appointments at the counter."
                value={config.booking.walkInEnabled}
                onChange={v => patch('booking', 'walkInEnabled', v)}
              />
              <ToggleRow
                label="Booking approval required"
                description="New bookings start as PENDING until staff approve them."
                value={config.booking.bookingApprovalRequired}
                onChange={v => patch('booking', 'bookingApprovalRequired', v)}
              />
              <ToggleRow
                label="Waitlist enabled"
                description="Let customers join a waitlist when no slot is available."
                value={config.booking.waitlistEnabled}
                onChange={v => patch('booking', 'waitlistEnabled', v)}
              />

              <NumFieldRow
                label="Minimum advance booking (minutes)"
                value={config.booking.minimumAdvanceBookingMinutes}
                onChange={v => patch('booking', 'minimumAdvanceBookingMinutes', v)}
                min={0}
              />
              <NumFieldRow
                label="Maximum advance booking (days)"
                value={config.booking.maximumAdvanceBookingDays}
                onChange={v => patch('booking', 'maximumAdvanceBookingDays', v)}
                min={1}
              />
              <NumFieldRow
                label="Booking buffer (minutes)"
                value={config.booking.bookingBufferMinutes}
                onChange={v => patch('booking', 'bookingBufferMinutes', v)}
                min={0}
              />
            </SubSection>

            {/* ───────────── Cancellation ───────────── */}
            <SubSection
              title="Cancellation"
              subtitle="When customers can cancel and what they get back."
            >
              <ToggleRow
                label="Customer cancellation enabled"
                description="Allow customers to cancel their own appointments."
                value={config.cancellation.customerCancellationEnabled}
                onChange={v => patch('cancellation', 'customerCancellationEnabled', v)}
              />
              <ToggleRow
                label="Rescheduling enabled"
                description="Allow customers to move their appointment to a new time."
                value={config.cancellation.reschedulingEnabled}
                onChange={v => patch('cancellation', 'reschedulingEnabled', v)}
              />

              <NumFieldRow
                label="Cancellation window (minutes)"
                value={config.cancellation.cancellationWindowMinutes}
                onChange={v => patch('cancellation', 'cancellationWindowMinutes', v)}
                min={0}
              />

              <SelectRow
                label="Customer cancellation policy"
                description="When a customer's cancellation is allowed to trigger a refund."
                value={config.cancellation.customerCancellationPolicy}
                options={CUSTOMER_CANCELLATION_POLICY_OPTIONS}
                onChange={v => patch('cancellation', 'customerCancellationPolicy', v)}
              />

              <SelectRow
                label="Refund policy"
                description="How much of the paid amount is refunded on cancellation."
                value={config.cancellation.refundPolicyType}
                options={REFUND_POLICY_OPTIONS}
                onChange={v => patch('cancellation', 'refundPolicyType', v)}
              />

              {config.cancellation.refundPolicyType === 'PERCENTAGE_REFUND' && (
                <NumFieldRow
                  label="Refund percentage (0–100)"
                  value={config.cancellation.refundPercentage ?? 0}
                  onChange={v => patch('cancellation', 'refundPercentage', v)}
                  min={0}
                  max={100}
                />
              )}

              <NumFieldRow
                label="Refund deadline (hours)"
                value={config.cancellation.refundDeadlineHours}
                onChange={v => patch('cancellation', 'refundDeadlineHours', v)}
                min={0}
              />
            </SubSection>

            {/* ───────────── Confirmation ───────────── */}
            <SubSection
              title="Confirmation"
              subtitle="How and when customers confirm their appointment."
            >
              <ToggleRow
                label="Customer confirmation enabled"
                description="Ask customers to confirm they'll attend."
                value={config.confirmation.customerConfirmationEnabled}
                onChange={v => patch('confirmation', 'customerConfirmationEnabled', v)}
              />

              <NumFieldRow
                label="Confirmation reminder (hours before)"
                value={config.confirmation.confirmationReminderHours}
                onChange={v => patch('confirmation', 'confirmationReminderHours', v)}
                min={0}
              />
              <NumFieldRow
                label="Confirmation deadline (hours before)"
                value={config.confirmation.confirmationDeadlineHours}
                onChange={v => patch('confirmation', 'confirmationDeadlineHours', v)}
                min={0}
              />
              <NumFieldRow
                label="Same-day reminder (hours before)"
                value={config.confirmation.sameDayConfirmationReminderHours}
                onChange={v => patch('confirmation', 'sameDayConfirmationReminderHours', v)}
                min={0}
              />
              <NumFieldRow
                label="Pending appointment expiration (minutes)"
                value={config.confirmation.pendingAppointmentExpirationMinutes}
                onChange={v => patch('confirmation', 'pendingAppointmentExpirationMinutes', v)}
                min={0}
              />
            </SubSection>

            <div className="flex items-center gap-3">
              <Button
                onClick={save}
                loading={saving}
                disabled={!dirty || saving}
              >
                Save changes
              </Button>
              {dirty && (
                <button
                  type="button"
                  onClick={reset}
                  disabled={saving}
                  className="text-xs text-ink-3 hover:text-ink disabled:opacity-50"
                >
                  Reset
                </button>
              )}
              {saved && !dirty && (
                <span className="text-xs text-[#2A6139] font-medium">Saved ✓</span>
              )}
            </div>
          </>
        )}
      </div>
    </Section>
  )
}

/* ------------------------------------------------------------------ */
/*  Section: Finance                                                   */
/* ------------------------------------------------------------------ */

function FinanceSettings({ settings, expenseCategories, paymentMethods, onUpdate, onUpdateCategories, onUpdatePaymentMethods }: {
  settings: AppSettings
  expenseCategories: ExpenseCategory[]
  paymentMethods: PaymentMethod[]
  onUpdate: (s: AppSettings) => void
  onUpdateCategories: (c: ExpenseCategory[]) => void
  onUpdatePaymentMethods: (p: PaymentMethod[]) => void
}) {
  const [cats, setCats]       = useState(expenseCategories)
  const [methods, setMethods] = useState(paymentMethods)
  const [newCat,  setNewCat]  = useState('')
  const [newPm,   setNewPm]   = useState('')
  const [saved,   setSaved]   = useState(false)

  function save() {
    onUpdateCategories(cats)
    onUpdatePaymentMethods(methods)
    setSaved(true)
    setTimeout(() => setSaved(false), 2500)
  }

  return (
    <Section title="Finance" description="Currency, payment methods, and expense categories.">
      <div className="flex flex-col gap-8 max-w-md">
        <div>
          <label className="text-xs font-semibold text-ink-3 mb-2 block">Currency</label>
          <select className="w-full px-3 py-2.5 rounded-xl border border-line text-sm bg-bg focus:outline-none" defaultValue="ETB">
            <option>ETB — Ethiopian Birr</option>
            <option>USD — US Dollar</option>
          </select>
        </div>

        <div>
          <p className="text-sm font-semibold text-ink mb-3">Payment methods</p>
          <div className="flex flex-col gap-1.5 mb-3">
            {methods.map(m => (
              <div key={m.id} className="flex items-center justify-between px-3 py-2.5 bg-bg rounded-xl">
                <span className={`text-sm ${m.active ? 'text-ink' : 'text-ink-3 line-through'}`}>{m.name}</span>
                <div className="flex items-center gap-2">
                  <span className={`text-[10px] ${m.active ? 'text-[#2A6139]' : 'text-ink-3'}`}>{m.active ? 'Active' : 'Inactive'}</span>
                  <Toggle checked={m.active} onChange={v => setMethods(prev => prev.map(p => p.id === m.id ? { ...p, active: v } : p))} />
                </div>
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <input value={newPm} onChange={e => setNewPm(e.target.value)} placeholder="Add payment method"
              className="flex-1 px-3 py-2 rounded-xl border border-line text-sm bg-bg focus:outline-none focus:border-warm"
              onKeyDown={e => {
                if (e.key === 'Enter' && newPm.trim()) {
                  setMethods(prev => [...prev, { id: `pm${Date.now()}`, name: newPm.trim(), active: true }])
                  setNewPm('')
                }
              }}
            />
            <Button size="sm" onClick={() => {
              if (!newPm.trim()) return
              setMethods(prev => [...prev, { id: `pm${Date.now()}`, name: newPm.trim(), active: true }])
              setNewPm('')
            }}>Add</Button>
          </div>
        </div>

        <div>
          <p className="text-sm font-semibold text-ink mb-3">Expense categories</p>
          <div className="flex flex-col gap-1.5 mb-3">
            {cats.map(c => (
              <div key={c.id} className="flex items-center justify-between px-3 py-2.5 bg-bg rounded-xl">
                <span className={`text-sm ${c.active ? 'text-ink' : 'text-ink-3 line-through'}`}>{c.name}</span>
                <div className="flex items-center gap-2">
                  <span className={`text-[10px] ${c.active ? 'text-[#2A6139]' : 'text-ink-3'}`}>{c.active ? 'Active' : 'Inactive'}</span>
                  <Toggle checked={c.active} onChange={v => setCats(prev => prev.map(p => p.id === c.id ? { ...p, active: v } : p))} />
                </div>
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <input value={newCat} onChange={e => setNewCat(e.target.value)} placeholder="Add category"
              className="flex-1 px-3 py-2 rounded-xl border border-line text-sm bg-bg focus:outline-none focus:border-warm"
              onKeyDown={e => {
                if (e.key === 'Enter' && newCat.trim()) {
                  setCats(prev => [...prev, { id: `ec${Date.now()}`, name: newCat.trim(), active: true }])
                  setNewCat('')
                }
              }}
            />
            <Button size="sm" onClick={() => {
              if (!newCat.trim()) return
              setCats(prev => [...prev, { id: `ec${Date.now()}`, name: newCat.trim(), active: true }])
              setNewCat('')
            }}>Add</Button>
          </div>
        </div>

        <SaveBar saved={saved} onSave={save} />
      </div>
    </Section>
  )
}

/* ------------------------------------------------------------------ */
/*  Section: Feedback                                                  */
/* ------------------------------------------------------------------ */

function FeedbackSettings({ settings, onUpdate }: { settings: AppSettings; onUpdate: (s: AppSettings) => void }) {
  const [local, setLocal] = useState(settings)
  const [saved, setSaved] = useState(false)

  function save() { onUpdate(local); setSaved(true); setTimeout(() => setSaved(false), 2500) }

  return (
    <Section title="Feedback" description="Configure customer feedback collection.">
      <div className="flex flex-col gap-5 max-w-md">
        <ToggleRow
          label="Feedback enabled"
          description="Collect feedback from customers after completed appointments."
          value={local.feedbackEnabled}
          onChange={v => setLocal(p => ({ ...p, feedbackEnabled: v }))}
        />
        <ToggleRow
          label="Anonymous feedback"
          description="Allow customers to submit feedback anonymously."
          value={local.anonymousFeedbackEnabled}
          onChange={v => setLocal(p => ({ ...p, anonymousFeedbackEnabled: v }))}
        />
        <div>
          <label className="text-xs font-semibold text-ink-3 mb-2 block">Send feedback request</label>
          <select
            value={local.feedbackRequestTiming}
            onChange={e => setLocal(p => ({ ...p, feedbackRequestTiming: e.target.value }))}
            className="w-full px-3 py-2.5 rounded-xl border border-line text-sm bg-bg focus:outline-none"
          >
            <option value="1h after">1 hour after appointment</option>
            <option value="2h after">2 hours after appointment</option>
            <option value="24h after">24 hours after appointment</option>
          </select>
        </div>
        <div className="bg-warm-subtle rounded-xl px-4 py-3">
          <p className="text-xs text-ink-3">All feedback is private and visible to admins only. Public review features are not included.</p>
        </div>
        <SaveBar saved={saved} onSave={save} />
      </div>
    </Section>
  )
}

/* ------------------------------------------------------------------ */
/*  Section: Notifications                                             */
/* ------------------------------------------------------------------ */

function NotificationSettings({ settings, onUpdate }: { settings: AppSettings; onUpdate: (s: AppSettings) => void }) {
  const [local, setLocal] = useState(settings)
  const [saved, setSaved] = useState(false)

  function save() { onUpdate(local); setSaved(true); setTimeout(() => setSaved(false), 2500) }

  return (
    <Section title="Notifications" description="Control which notifications are sent.">
      <div className="flex flex-col gap-5 max-w-md">
        <ToggleRow
          label="Appointment reminders"
          description="Send reminders to customers before their appointment."
          value={local.notifyAppointmentReminders}
          onChange={v => setLocal(p => ({ ...p, notifyAppointmentReminders: v }))}
        />
        <ToggleRow
          label="Booking notifications"
          description="Notify staff when a new booking is created."
          value={local.notifyBookingNotifications}
          onChange={v => setLocal(p => ({ ...p, notifyBookingNotifications: v }))}
        />
        <ToggleRow
          label="Cancellation notifications"
          description="Notify when a customer cancels or reschedules."
          value={local.notifyCancellations}
          onChange={v => setLocal(p => ({ ...p, notifyCancellations: v }))}
        />
        <ToggleRow
          label="Feedback requests"
          description="Send feedback request after completed appointments."
          value={local.notifyFeedbackRequests}
          onChange={v => setLocal(p => ({ ...p, notifyFeedbackRequests: v }))}
        />
        <div className="bg-warm-subtle rounded-xl px-4 py-3">
          <p className="text-xs text-ink-3">These are configuration controls only. Actual delivery is handled by your notification service.</p>
        </div>
        <SaveBar saved={saved} onSave={save} />
      </div>
    </Section>
  )
}

/* ------------------------------------------------------------------ */
/*  Section: Account                                                   */
/* ------------------------------------------------------------------ */

function AccountSettings({ onLogout }: { onLogout: () => void }) {
  const [name,  setName]  = useState('Sara Admin')
  const [email, setEmail] = useState('sara@zsalon.com')
  const [saved, setSaved] = useState(false)
  const [changingPw, setChangingPw] = useState(false)

  function save() { setSaved(true); setTimeout(() => setSaved(false), 2500) }

  return (
    <Section title="Account" description="Manage your profile and account settings.">
      <div className="flex flex-col gap-6 max-w-md">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-full bg-warm flex items-center justify-center text-ink text-xl font-semibold flex-shrink-0">SA</div>
          <div>
            <button className="text-sm text-ink underline underline-offset-2 hover:text-ink-2 transition-colors">Upload photo</button>
            <p className="text-xs text-ink-3 mt-0.5">JPG or PNG, max 2MB</p>
          </div>
        </div>

        <Field label="Name" value={name} onChange={setName} />
        <Field label="Email" value={email} onChange={setEmail} type="email" />

        <SaveBar saved={saved} onSave={save} />

        <div className="border-t border-line pt-6">
          <p className="text-sm font-semibold text-ink mb-3">Password</p>
          {!changingPw ? (
            <Button size="sm" variant="secondary" onClick={() => setChangingPw(true)}>Change password</Button>
          ) : (
            <div className="flex flex-col gap-3">
              <Field label="Current password" value="" onChange={() => {}} type="password" />
              <Field label="New password" value="" onChange={() => {}} type="password" />
              <Field label="Confirm new password" value="" onChange={() => {}} type="password" />
              <div className="flex gap-2">
                <Button variant="secondary" size="sm" onClick={() => setChangingPw(false)}>Cancel</Button>
                <Button size="sm" onClick={() => { setChangingPw(false); setSaved(true); setTimeout(() => setSaved(false), 2000) }}>Update password</Button>
              </div>
            </div>
          )}
        </div>

        <div className="border-t border-line pt-6">
          <Button variant="secondary" onClick={onLogout}>Log out</Button>
        </div>
      </div>
    </Section>
  )
}

/* ------------------------------------------------------------------ */
/*  Shared sub-components                                              */
/* ------------------------------------------------------------------ */

function Section({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-5 sm:mb-7">
        <h3 className="font-display text-xl sm:text-2xl text-ink leading-none mb-1">{title}</h3>
        <p className="text-ink-3 text-xs sm:text-sm">{description}</p>
      </div>
      {children}
    </div>
  )
}

function SubSection({
  title,
  subtitle,
  children,
}: {
  title: string
  subtitle?: string
  children: React.ReactNode
}) {
  return (
    <section className="bg-surface rounded-2xl border border-line overflow-hidden">
      <div className="px-5 py-3.5 border-b border-line">
        <p className="text-sm font-semibold text-ink">{title}</p>
        {subtitle && <p className="text-xs text-ink-3 mt-0.5">{subtitle}</p>}
      </div>
      <div className="divide-y divide-line">{children}</div>
    </section>
  )
}

function Field({ label, value, onChange, type = 'text' }: {
  label: string; value: string; onChange: (v: string) => void; type?: string
}) {
  return (
    <div>
      <label className="text-xs font-semibold text-ink-3 mb-1.5 block">{label}</label>
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        className="w-full px-3 py-2.5 rounded-xl border border-line text-sm bg-bg text-ink focus:outline-none focus:border-warm"
      />
    </div>
  )
}

function TextArea({ label, value, onChange, rows = 3 }: {
  label: string; value: string; onChange: (v: string) => void; rows?: number
}) {
  return (
    <div>
      <label className="text-xs font-semibold text-ink-3 mb-1.5 block">{label}</label>
      <textarea
        value={value}
        rows={rows}
        onChange={e => onChange(e.target.value)}
        className="w-full px-3 py-2.5 rounded-xl border border-line text-sm bg-bg text-ink focus:outline-none focus:border-warm resize-none"
      />
    </div>
  )
}

function NumField({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <div>
      <label className="text-xs font-semibold text-ink-3 mb-1.5 block">{label}</label>
      <input
        type="number"
        value={value}
        onChange={e => onChange(parseInt(e.target.value) || 0)}
        className="w-full px-3 py-2.5 rounded-xl border border-line text-sm bg-bg text-ink focus:outline-none focus:border-warm"
      />
    </div>
  )
}

function NumFieldRow({
  label,
  value,
  onChange,
  min,
  max,
}: {
  label: string
  value: number
  onChange: (v: number) => void
  min?: number
  max?: number
}) {
  return (
    <div className="flex items-start justify-between gap-4 px-5 py-3.5">
      <div className="min-w-0">
        <p className="text-sm font-medium text-ink">{label}</p>
      </div>
      <input
        type="number"
        value={value}
        min={min}
        max={max}
        onChange={e => onChange(parseInt(e.target.value) || 0)}
        className="
          h-9 w-24 px-3 text-sm text-right tabular-nums flex-shrink-0
          rounded-xl border border-line bg-surface text-ink
          hover:border-warm focus:outline-none focus:border-ink
          focus:ring-2 focus:ring-ink-3/20
        "
      />
    </div>
  )
}

function SelectRow({
  label,
  description,
  value,
  options,
  onChange,
}: {
  label: string
  description?: string
  value: string
  options: readonly { value: string; label: string }[]
  onChange: (v: string) => void
}) {
  return (
    <div className="flex items-start justify-between gap-4 px-5 py-3.5">
      <div className="min-w-0">
        <p className="text-sm font-medium text-ink">{label}</p>
        {description && <p className="text-xs text-ink-3 mt-0.5">{description}</p>}
      </div>
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        className="
          h-9 px-3 text-sm rounded-xl border border-line bg-surface text-ink
          hover:border-warm focus:outline-none focus:border-ink
          focus:ring-2 focus:ring-ink-3/20 flex-shrink-0
        "
      >
        {options.map(o => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </div>
  )
}

function ToggleRow({ label, description, value, onChange }: {
  label: string; description: string; value: boolean; onChange: (v: boolean) => void
}) {
  return (
    <div className="flex items-start justify-between gap-6 px-5 py-3.5">
      <div className="min-w-0">
        <p className="text-sm font-medium text-ink">{label}</p>
        <p className="text-xs text-ink-3 mt-0.5">{description}</p>
      </div>
      <div className="flex-shrink-0">
        <Toggle checked={value} onChange={onChange} />
      </div>
    </div>
  )
}

function SaveBar({
  saved,
  saving,
  disabled,
  onSave,
}: {
  saved: boolean
  saving?: boolean
  disabled?: boolean
  onSave: () => void
}) {
  return (
    <div className="flex items-center gap-3 pt-2">
      <Button onClick={onSave} loading={saving} disabled={disabled || saving}>
        Save changes
      </Button>
      {saved && <span className="text-xs text-[#2A6139] font-medium">Saved ✓</span>}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Helpers — tolerant readers for both branding type shapes           */
/* ------------------------------------------------------------------ */

function readString(
  obj: BrandingPayload | null,
  key: keyof BrandingPayload,
): string | null {
  if (!obj) return null
  const v = (obj as any)[key]
  return typeof v === 'string' ? v : null
}

function readLogoUrl(branding: BrandingPayload | null): string | null {
  if (!branding) return null
  const b = branding as unknown as {
    logoUrl?: string | null
    logo?: { url?: string | null } | null
  }
  return b.logo?.url ?? b.logoUrl ?? null
}

function unwrapArray<T>(res: unknown): T[] {
  if (Array.isArray(res)) return res as T[]
  const anyRes = res as any
  if (Array.isArray(anyRes?.data?.data)) return anyRes.data.data as T[]
  if (Array.isArray(anyRes?.data)) return anyRes.data as T[]
  return []
}

function extractErrorMessage(err: unknown, fallback = 'Something went wrong.'): string {
  if (!err) return fallback
  const anyErr = err as any

  if (Array.isArray(anyErr?.details) && anyErr.details.length > 0) {
    const d = anyErr.details[0]
    if (typeof d === 'string') return d
    const field = d?.field ? `${d.field}: ` : ''
    return `${field}${d?.message ?? JSON.stringify(d)}`
  }

  const data = anyErr?.response?.data ?? anyErr?.data ?? anyErr

  if (Array.isArray(data?.errors) && data.errors.length > 0) {
    return String(data.errors[0])
  }

  if (Array.isArray(data?.details) && data.details.length > 0) {
    const d = data.details[0]
    if (typeof d === 'string') return d
    const field = d?.field ? `${d.field}: ` : ''
    return `${field}${d?.message ?? JSON.stringify(d)}`
  }

  if (typeof data?.message === 'string' && data.message) return data.message
  if (typeof anyErr?.message === 'string' && anyErr.message) return anyErr.message
  return fallback
}