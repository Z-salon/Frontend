import { useState } from 'react'
import type { AppSettings, ExpenseCategory, PaymentMethod } from '../../types'
import { Button, Toggle } from '../ui'

interface SettingsPageProps {
  settings: AppSettings
  expenseCategories: ExpenseCategory[]
  paymentMethods: PaymentMethod[]
  onUpdateSettings: (s: AppSettings) => void
  onUpdateCategories: (c: ExpenseCategory[]) => void
  onUpdatePaymentMethods: (p: PaymentMethod[]) => void
  onLogout: () => void
}

type SettingsSection = 'business' | 'branding' | 'booking' | 'finance' | 'feedback' | 'notifications' | 'account'

export function SettingsPage({
  settings, expenseCategories, paymentMethods,
  onUpdateSettings, onUpdateCategories, onUpdatePaymentMethods, onLogout,
}: SettingsPageProps) {
  const [section, setSection] = useState<SettingsSection>('business')

  const NAV: { id: SettingsSection; label: string }[] = [
    { id: 'business',      label: 'Business'      },
    { id: 'branding',      label: 'Branding'      },
    { id: 'booking',       label: 'Booking'       },
    { id: 'finance',       label: 'Finance'       },
    { id: 'feedback',      label: 'Feedback'      },
    { id: 'notifications', label: 'Notifications' },
    { id: 'account',       label: 'Account'       },
  ]

  return (
    <div className="flex h-full overflow-hidden">
      {/* Left nav */}
      <div className="w-52 flex-shrink-0 border-r border-line bg-surface flex flex-col">
        <div className="px-5 py-5 border-b border-line">
          <p className="font-display text-lg text-ink leading-none">Settings</p>
        </div>
        <nav className="flex-1 py-3 px-3 flex flex-col gap-0.5">
          {NAV.map(n => (
            <button key={n.id} onClick={() => setSection(n.id)}
              className={`px-3 py-2.5 rounded-xl text-sm font-medium text-left transition-all ${section === n.id ? 'bg-ink text-surface' : 'text-ink-3 hover:text-ink hover:bg-warm-subtle'}`}>
              {n.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-10 py-8">
        {section === 'business'      && <BusinessSettings />}
        {section === 'branding'      && <BrandingSettings />}
        {section === 'booking'       && <BookingSettings settings={settings} onUpdate={onUpdateSettings} />}
        {section === 'finance'       && (
          <FinanceSettings
            settings={settings}
            expenseCategories={expenseCategories}
            paymentMethods={paymentMethods}
            onUpdate={onUpdateSettings}
            onUpdateCategories={onUpdateCategories}
            onUpdatePaymentMethods={onUpdatePaymentMethods}
          />
        )}
        {section === 'feedback'      && <FeedbackSettings settings={settings} onUpdate={onUpdateSettings} />}
        {section === 'notifications' && <NotificationSettings settings={settings} onUpdate={onUpdateSettings} />}
        {section === 'account'       && <AccountSettings onLogout={onLogout} />}
      </div>
    </div>
  )
}

// ─── Section: Business ────────────────────────────────────────────────────────

function BusinessSettings() {
  const [name,    setName]    = useState('Z-salon')
  const [phone,   setPhone]   = useState('+251 911 100 100')
  const [email,   setEmail]   = useState('hello@zsalon.com')
  const [address, setAddress] = useState('Bole Road, Addis Ababa')
  const [saved,   setSaved]   = useState(false)

  function save() { setSaved(true); setTimeout(() => setSaved(false), 2500) }

  return (
    <Section title="Business" description="Update your salon's basic information.">
      <div className="flex flex-col gap-4 max-w-md">
        <Field label="Salon name" value={name} onChange={setName} />
        <Field label="Phone" value={phone} onChange={setPhone} type="tel" />
        <Field label="Email" value={email} onChange={setEmail} type="email" />
        <Field label="Address" value={address} onChange={setAddress} />
        <SaveBar saved={saved} onSave={save} />
      </div>
    </Section>
  )
}

// ─── Section: Branding ────────────────────────────────────────────────────────

function BrandingSettings() {
  return (
    <Section title="Branding" description="Manage your salon's visual identity.">
      <div className="max-w-md flex flex-col gap-6">
        {/* Logo */}
        <div>
          <label className="text-xs font-semibold text-ink-3 mb-3 block">Salon logo</label>
          <div className="w-24 h-24 rounded-2xl border-2 border-dashed border-line bg-bg flex items-center justify-center cursor-pointer hover:border-warm transition-colors">
            <div className="text-center">
              <div className="font-display text-2xl text-warm leading-none">Z</div>
              <p className="text-[10px] text-ink-3 mt-1">Upload</p>
            </div>
          </div>
        </div>

        {/* Brand preview */}
        <div>
          <label className="text-xs font-semibold text-ink-3 mb-3 block">Brand preview</label>
          <div className="bg-ink rounded-2xl p-6 flex flex-col items-center">
            <p className="font-display text-3xl text-surface">Z-salon</p>
            <p className="font-display italic text-warm text-lg">ዘsalon</p>
          </div>
        </div>

        <div className="bg-warm-subtle rounded-xl px-4 py-3">
          <p className="text-xs text-ink-3">The Z-salon design system is the brand. Customizations are limited to protect the premium aesthetic.</p>
        </div>
      </div>
    </Section>
  )
}

// ─── Section: Booking ─────────────────────────────────────────────────────────

function BookingSettings({ settings, onUpdate }: { settings: AppSettings; onUpdate: (s: AppSettings) => void }) {
  const [local, setLocal] = useState(settings)
  const [saved, setSaved] = useState(false)

  function save() { onUpdate(local); setSaved(true); setTimeout(() => setSaved(false), 2500) }

  return (
    <Section title="Booking" description="Configure how customers make appointments.">
      <div className="flex flex-col gap-6 max-w-md">
        {/* Confirmation */}
        <div>
          <label className="text-xs font-semibold text-ink-3 mb-2 block">Booking confirmation</label>
          <div className="flex gap-2">
            {(['automatic', 'manual'] as const).map(v => (
              <button key={v} onClick={() => setLocal(prev => ({ ...prev, bookingConfirmation: v }))}
                className={`flex-1 py-2.5 rounded-xl text-sm font-medium border transition-all ${local.bookingConfirmation === v ? 'bg-ink text-surface border-ink' : 'border-line text-ink-3 hover:text-ink'}`}>
                {v === 'automatic' ? 'Automatic' : 'Salon approval'}
              </button>
            ))}
          </div>
          <p className="text-xs text-ink-3 mt-1.5">
            {local.bookingConfirmation === 'automatic' ? 'Bookings are confirmed automatically.' : 'Each booking requires manual approval.'}
          </p>
        </div>

        {/* Notice + advance */}
        <NumField label="Minimum booking notice (minutes)" value={local.minBookingNotice}
          onChange={v => setLocal(p => ({ ...p, minBookingNotice: v }))} />
        <NumField label="Maximum advance booking (days)" value={local.maxAdvanceBooking}
          onChange={v => setLocal(p => ({ ...p, maxAdvanceBooking: v }))} />
        <NumField label="Cancellation deadline (hours)" value={local.cancellationDeadline}
          onChange={v => setLocal(p => ({ ...p, cancellationDeadline: v }))} />

        {/* Rescheduling */}
        <ToggleRow
          label="Allow rescheduling"
          description="Customers can reschedule confirmed appointments."
          value={local.allowRescheduling}
          onChange={v => setLocal(p => ({ ...p, allowRescheduling: v }))}
        />

        <SaveBar saved={saved} onSave={save} />
      </div>
    </Section>
  )
}

// ─── Section: Finance ─────────────────────────────────────────────────────────

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

        {/* Payment methods */}
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

        {/* Expense categories */}
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

// ─── Section: Feedback ────────────────────────────────────────────────────────

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

// ─── Section: Notifications ───────────────────────────────────────────────────

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

// ─── Section: Account ─────────────────────────────────────────────────────────

function AccountSettings({ onLogout }: { onLogout: () => void }) {
  const [name,  setName]  = useState('Sara Admin')
  const [email, setEmail] = useState('sara@zsalon.com')
  const [saved, setSaved] = useState(false)
  const [changingPw, setChangingPw] = useState(false)

  function save() { setSaved(true); setTimeout(() => setSaved(false), 2500) }

  return (
    <Section title="Account" description="Manage your profile and account settings.">
      <div className="flex flex-col gap-6 max-w-md">
        {/* Avatar */}
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-full bg-warm flex items-center justify-center text-ink text-xl font-semibold">SA</div>
          <div>
            <button className="text-sm text-ink underline underline-offset-2 hover:text-ink-2 transition-colors">Upload photo</button>
            <p className="text-xs text-ink-3 mt-0.5">JPG or PNG, max 2MB</p>
          </div>
        </div>

        <Field label="Name" value={name} onChange={setName} />
        <Field label="Email" value={email} onChange={setEmail} type="email" />

        <SaveBar saved={saved} onSave={save} />

        {/* Password */}
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

        {/* Logout */}
        <div className="border-t border-line pt-6">
          <Button variant="secondary" onClick={onLogout}>Log out</Button>
        </div>
      </div>
    </Section>
  )
}

// ─── Shared sub-components ────────────────────────────────────────────────────

function Section({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-7">
        <h3 className="font-display text-2xl text-ink leading-none mb-1">{title}</h3>
        <p className="text-ink-3 text-sm">{description}</p>
      </div>
      {children}
    </div>
  )
}

function Field({ label, value, onChange, type = 'text' }: {
  label: string; value: string; onChange: (v: string) => void; type?: string
}) {
  return (
    <div>
      <label className="text-xs font-semibold text-ink-3 mb-1.5 block">{label}</label>
      <input type={type} value={value} onChange={e => onChange(e.target.value)}
        className="w-full px-3 py-2.5 rounded-xl border border-line text-sm bg-bg text-ink focus:outline-none focus:border-warm" />
    </div>
  )
}

function NumField({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <div>
      <label className="text-xs font-semibold text-ink-3 mb-1.5 block">{label}</label>
      <input type="number" value={value} onChange={e => onChange(parseInt(e.target.value) || 0)}
        className="w-full px-3 py-2.5 rounded-xl border border-line text-sm bg-bg text-ink focus:outline-none focus:border-warm" />
    </div>
  )
}

function ToggleRow({ label, description, value, onChange }: {
  label: string; description: string; value: boolean; onChange: (v: boolean) => void
}) {
  return (
    <div className="flex items-start justify-between gap-6 py-1">
      <div>
        <p className="text-sm font-medium text-ink">{label}</p>
        <p className="text-xs text-ink-3 mt-0.5">{description}</p>
      </div>
      <Toggle checked={value} onChange={onChange} />
    </div>
  )
}

function SaveBar({ saved, onSave }: { saved: boolean; onSave: () => void }) {
  return (
    <div className="flex items-center gap-3 pt-2">
      <Button onClick={onSave}>Save changes</Button>
      {saved && <span className="text-xs text-[#2A6139] font-medium">Saved ✓</span>}
    </div>
  )
}
