import { useState } from 'react'
import { Button, Input, Select, Toggle } from '../ui'
import type { Service } from '../../types'

interface OnboardingProps {
  onComplete: () => void
}

export function OnboardingWizard({ onComplete }: OnboardingProps) {
  const [step, setStep] = useState(0)

  const [salonInfo, setSalonInfo]           = useState({ name: 'Z-salon', phone: '+251 9XX XXX XXX', email: 'hello@zsalon.com', address: 'Bole, Addis Ababa' })
  const [locationType, setLocationType]     = useState<'single' | 'multiple'>('multiple')
  const [hours, setHours]                   = useState([
    { day: 'Monday',    open: true,  from: '09:00', to: '18:00' },
    { day: 'Tuesday',   open: true,  from: '09:00', to: '18:00' },
    { day: 'Wednesday', open: true,  from: '09:00', to: '18:00' },
    { day: 'Thursday',  open: true,  from: '09:00', to: '18:00' },
    { day: 'Friday',    open: true,  from: '09:00', to: '18:00' },
    { day: 'Saturday',  open: true,  from: '09:00', to: '17:00' },
    { day: 'Sunday',    open: false, from: '09:00', to: '17:00' },
  ])
  const [bookingSettings, setBookingSettings] = useState({
    confirmation: 'auto' as 'auto' | 'manual',
    minNotice: '2',
    maxAdvance: '30',
    cancellation: true,
    cancellationDeadline: '4',
    rescheduling: true,
  })
  const [services, setServices] = useState<Service[]>([
    { id: 'sv1', name: 'Haircut',       category: 'Hair',  price: 250,  duration: 30,  showPrice: true },
    { id: 'sv2', name: 'Hair Treatment',category: 'Hair',  price: 2500, duration: 120, showPrice: true },
    { id: 'sv3', name: 'Gel Manicure',  category: 'Nails', price: 1200, duration: 60,  showPrice: true },
  ])

  const TOTAL = 7
  const progress = (step / (TOTAL - 1)) * 100

  const next = () => setStep(s => Math.min(s + 1, TOTAL - 1))
  const prev = () => setStep(s => Math.max(s - 1, 0))

  return (
    <div className="min-h-screen bg-bg flex flex-col">
      <div className="flex items-center justify-between px-8 py-5 border-b border-line bg-surface">
        <div>
          <span className="font-display text-xl text-ink">Z-salon</span>
          <span className="text-warm font-display italic text-base ml-2">ዘsalon</span>
        </div>
        {step < TOTAL - 1 && (
          <span className="text-sm text-ink-3">Step {step + 1} of {TOTAL - 1}</span>
        )}
      </div>

      {step < TOTAL - 1 && (
        <div className="h-0.5 bg-line">
          <div className="h-full bg-ink transition-all duration-500 ease-out" style={{ width: `${progress}%` }} />
        </div>
      )}

      <div className="flex-1 flex items-start justify-center py-14 px-6 overflow-y-auto">
        <div className="w-full max-w-xl">
          {step === 0 && <StepBusinessInfo  data={salonInfo}       onChange={setSalonInfo}           onNext={next} />}
          {step === 1 && <StepBranding                                                               onNext={next} onBack={prev} />}
          {step === 2 && <StepLocation      type={locationType}    onTypeChange={setLocationType}    onNext={next} onBack={prev} />}
          {step === 3 && <StepHours         hours={hours}          onChange={setHours}               onNext={next} onBack={prev} />}
          {step === 4 && <StepBookingSettings settings={bookingSettings} onChange={setBookingSettings} onNext={next} onBack={prev} />}
          {step === 5 && <StepServices      services={services}    onChange={setServices}            onNext={next} onBack={prev} />}
          {step === 6 && <StepComplete      salonInfo={salonInfo}  services={services}               onEnter={onComplete} />}
        </div>
      </div>
    </div>
  )
}

function StepHeader({ title, description }: { title: string; description: string }) {
  return (
    <div className="mb-10">
      <h2 className="font-display text-[2rem] text-ink leading-tight mb-3">{title}</h2>
      <p className="text-ink-3 text-base leading-relaxed">{description}</p>
    </div>
  )
}

function StepNav({ onBack, onNext, nextLabel = 'Continue' }: { onBack?: () => void; onNext: () => void; nextLabel?: string }) {
  return (
    <div className="flex items-center justify-between mt-10 pt-8 border-t border-line">
      {onBack ? <Button variant="ghost" onClick={onBack}>Back</Button> : <div />}
      <Button onClick={onNext} size="lg">{nextLabel}</Button>
    </div>
  )
}

function StepBusinessInfo({ data, onChange, onNext }: {
  data: { name: string; phone: string; email: string; address: string }
  onChange: (d: typeof data) => void
  onNext: () => void
}) {
  return (
    <div>
      <StepHeader title="Tell us about your salon" description="This information helps us personalize your workspace." />
      <div className="flex flex-col gap-5">
        <Input label="Salon name"   value={data.name}    placeholder="My Salon"            onChange={e => onChange({ ...data, name: e.target.value })} />
        <Input label="Phone number" value={data.phone}   placeholder="+251 9XX XXX XXX"    onChange={e => onChange({ ...data, phone: e.target.value })} />
        <Input label="Email" type="email" value={data.email} placeholder="hello@mysalon.com" onChange={e => onChange({ ...data, email: e.target.value })} />
        <Input label="Address"      value={data.address} placeholder="Bole, Addis Ababa"   onChange={e => onChange({ ...data, address: e.target.value })} />
      </div>
      <StepNav onNext={onNext} />
    </div>
  )
}

function StepBranding({ onNext, onBack }: { onNext: () => void; onBack: () => void }) {
  const [color, setColor] = useState('#C7B9AD')
  const presets = ['#C7B9AD', '#1C1C1C', '#8B7B6E', '#7B9FAB', '#9B8FA8', '#8BAB95']

  return (
    <div>
      <StepHeader title="Make Z-salon yours" description="Upload your logo and set your brand color." />
      <div className="flex flex-col gap-6">
        <div>
          <label className="text-sm font-medium text-ink-2 block mb-2">Logo</label>
          <div className="border-2 border-dashed border-line rounded-xl p-8 text-center cursor-pointer hover:border-warm transition-colors">
            <div className="w-12 h-12 rounded-full bg-warm-subtle flex items-center justify-center mx-auto mb-3">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#8A847F" strokeWidth="1.5">
                <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12" />
              </svg>
            </div>
            <p className="text-sm text-ink-3">Click to upload logo</p>
            <p className="text-xs text-ink-3 mt-1">PNG or JPG, up to 2 MB</p>
          </div>
        </div>

        <div>
          <label className="text-sm font-medium text-ink-2 block mb-3">Brand color</label>
          <div className="flex items-center gap-4 flex-wrap">
            <input type="color" value={color} onChange={e => setColor(e.target.value)} className="w-11 h-11 rounded-xl border border-line cursor-pointer p-0.5 bg-surface" />
            <div className="flex gap-2">
              {presets.map(c => (
                <button
                  key={c}
                  onClick={() => setColor(c)}
                  className={`w-8 h-8 rounded-full border-2 transition-all ${color === c ? 'border-ink scale-110' : 'border-transparent hover:border-ink-3'}`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-line p-5 bg-surface">
          <p className="text-xs text-ink-3 uppercase tracking-wider mb-4">Preview</p>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-semibold flex-shrink-0" style={{ backgroundColor: color }}>
              Z
            </div>
            <div>
              <p className="font-semibold text-ink">Z-salon</p>
              <p className="text-ink-3 text-xs font-display italic">ዘsalon</p>
            </div>
          </div>
        </div>
      </div>
      <StepNav onBack={onBack} onNext={onNext} />
    </div>
  )
}

function StepLocation({ type, onTypeChange, onNext, onBack }: {
  type: 'single' | 'multiple'
  onTypeChange: (t: 'single' | 'multiple') => void
  onNext: () => void
  onBack: () => void
}) {
  const [branches, setBranches] = useState(['Bole', 'Kazanchis'])
  const [newBranch, setNewBranch] = useState('')

  function addBranch() {
    if (newBranch.trim()) { setBranches(bs => [...bs, newBranch.trim()]); setNewBranch('') }
  }

  return (
    <div>
      <StepHeader title="Where do you operate?" description="Tell us how many locations your salon has." />
      <div className="flex flex-col gap-3">
        {(['single', 'multiple'] as const).map(t => (
          <button
            key={t}
            onClick={() => onTypeChange(t)}
            className={`text-left p-4 rounded-xl border-2 transition-all ${type === t ? 'border-ink bg-warm-subtle' : 'border-line bg-surface hover:border-warm'}`}
          >
            <div className="flex items-center gap-3">
              <div className={`w-4 h-4 rounded-full border-2 flex-shrink-0 flex items-center justify-center ${type === t ? 'border-ink' : 'border-ink-3'}`}>
                {type === t && <div className="w-2 h-2 rounded-full bg-ink" />}
              </div>
              <div>
                <p className="font-medium text-ink text-sm">{t === 'single' ? 'One location' : 'Multiple locations'}</p>
                <p className="text-ink-3 text-xs mt-0.5">{t === 'single' ? 'Single branch or outlet' : 'Two or more branches'}</p>
              </div>
            </div>
          </button>
        ))}

        {type === 'multiple' && (
          <div className="mt-3 flex flex-col gap-3">
            <p className="text-sm font-medium text-ink-2">Branches</p>
            {branches.map((b, i) => (
              <div key={i} className="flex items-center justify-between px-4 py-3 rounded-xl bg-surface border border-line">
                <span className="text-sm text-ink">{b}</span>
                <button onClick={() => setBranches(bs => bs.filter((_, j) => j !== i))} className="text-xs text-ink-3 hover:text-[#C47B7B] transition-colors">Remove</button>
              </div>
            ))}
            <div className="flex gap-2">
              <input
                value={newBranch}
                onChange={e => setNewBranch(e.target.value)}
                placeholder="Branch name"
                onKeyDown={e => e.key === 'Enter' && addBranch()}
                className="flex-1 h-10 px-3 rounded-[10px] border border-line text-sm bg-surface text-ink focus:outline-none focus:border-warm placeholder:text-ink-3"
              />
              <Button variant="secondary" onClick={addBranch}>Add</Button>
            </div>
          </div>
        )}
      </div>
      <StepNav onBack={onBack} onNext={onNext} />
    </div>
  )
}

function StepHours({ hours, onChange, onNext, onBack }: {
  hours: { day: string; open: boolean; from: string; to: string }[]
  onChange: (h: typeof hours) => void
  onNext: () => void
  onBack: () => void
}) {
  function update(i: number, changes: Partial<typeof hours[0]>) {
    onChange(hours.map((h, j) => j === i ? { ...h, ...changes } : h))
  }

  return (
    <div>
      <StepHeader title="When are you open?" description="Set your working hours for each day of the week." />
      <div className="flex flex-col">
        {hours.map((h, i) => (
          <div key={h.day} className="flex items-center gap-4 py-3.5 border-b border-line last:border-0">
            <div className="w-24 flex-shrink-0">
              <p className="text-sm font-medium text-ink">{h.day}</p>
            </div>
            <Toggle checked={h.open} onChange={v => update(i, { open: v })} />
            {h.open ? (
              <div className="flex items-center gap-2 flex-1">
                <input type="time" value={h.from} onChange={e => update(i, { from: e.target.value })}
                  className="h-9 px-2.5 rounded-lg border border-line text-sm bg-surface text-ink focus:outline-none focus:border-warm" />
                <span className="text-ink-3 text-sm">—</span>
                <input type="time" value={h.to} onChange={e => update(i, { to: e.target.value })}
                  className="h-9 px-2.5 rounded-lg border border-line text-sm bg-surface text-ink focus:outline-none focus:border-warm" />
              </div>
            ) : (
              <span className="text-sm text-ink-3 flex-1">Closed</span>
            )}
          </div>
        ))}
      </div>
      <StepNav onBack={onBack} onNext={onNext} />
    </div>
  )
}

function StepBookingSettings({ settings, onChange, onNext, onBack }: {
  settings: { confirmation: 'auto' | 'manual'; minNotice: string; maxAdvance: string; cancellation: boolean; cancellationDeadline: string; rescheduling: boolean }
  onChange: (s: typeof settings) => void
  onNext: () => void
  onBack: () => void
}) {
  return (
    <div>
      <StepHeader title="Set up your booking rules" description="Configure how customers can book appointments." />
      <div className="flex flex-col gap-7">
        <div>
          <p className="text-sm font-medium text-ink-2 mb-3">Booking confirmation</p>
          <div className="flex flex-col gap-2">
            {(['auto', 'manual'] as const).map(v => (
              <button
                key={v}
                onClick={() => onChange({ ...settings, confirmation: v })}
                className={`text-left p-3.5 rounded-xl border-2 transition-all ${settings.confirmation === v ? 'border-ink bg-warm-subtle' : 'border-line bg-surface hover:border-warm'}`}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-4 h-4 rounded-full border-2 flex-shrink-0 flex items-center justify-center ${settings.confirmation === v ? 'border-ink' : 'border-ink-3'}`}>
                    {settings.confirmation === v && <div className="w-2 h-2 rounded-full bg-ink" />}
                  </div>
                  <p className="text-sm font-medium text-ink">
                    {v === 'auto' ? 'Automatically confirmed' : 'Requires salon approval'}
                  </p>
                </div>
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-5">
          <div>
            <label className="text-sm font-medium text-ink-2 block mb-2">Min. booking notice</label>
            <div className="flex items-center gap-2">
              <input type="number" value={settings.minNotice} onChange={e => onChange({ ...settings, minNotice: e.target.value })}
                className="w-20 h-10 px-3 rounded-xl border border-line text-sm bg-surface text-ink focus:outline-none focus:border-warm text-center" />
              <span className="text-sm text-ink-3">hours</span>
            </div>
          </div>
          <div>
            <label className="text-sm font-medium text-ink-2 block mb-2">Max. advance booking</label>
            <div className="flex items-center gap-2">
              <input type="number" value={settings.maxAdvance} onChange={e => onChange({ ...settings, maxAdvance: e.target.value })}
                className="w-20 h-10 px-3 rounded-xl border border-line text-sm bg-surface text-ink focus:outline-none focus:border-warm text-center" />
              <span className="text-sm text-ink-3">days</span>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-4">
          <div>
            <Toggle checked={settings.cancellation} onChange={v => onChange({ ...settings, cancellation: v })} label="Allow cancellations" />
            {settings.cancellation && (
              <div className="flex items-center gap-2 mt-3 pl-[52px]">
                <span className="text-sm text-ink-3">Deadline:</span>
                <input type="number" value={settings.cancellationDeadline} onChange={e => onChange({ ...settings, cancellationDeadline: e.target.value })}
                  className="w-16 h-9 px-2 rounded-lg border border-line text-sm bg-surface text-ink focus:outline-none focus:border-warm text-center" />
                <span className="text-sm text-ink-3">hours before</span>
              </div>
            )}
          </div>
          <Toggle checked={settings.rescheduling} onChange={v => onChange({ ...settings, rescheduling: v })} label="Allow rescheduling" />
        </div>
      </div>
      <StepNav onBack={onBack} onNext={onNext} />
    </div>
  )
}

function StepServices({ services, onChange, onNext, onBack }: {
  services: Service[]
  onChange: (s: Service[]) => void
  onNext: () => void
  onBack: () => void
}) {
  function addService() {
    onChange([...services, { id: `s${Date.now()}`, name: '', category: 'Hair', price: 0, duration: 60, showPrice: true }])
  }
  function update(i: number, changes: Partial<Service>) {
    onChange(services.map((s, j) => j === i ? { ...s, ...changes } : s))
  }

  return (
    <div>
      <StepHeader title="Add your first services" description="Create the services you offer. You can always add more later." />
      <div className="flex flex-col gap-4">
        {services.map((s, i) => (
          <div key={s.id} className="p-5 rounded-xl border border-line bg-surface">
            <div className="flex items-center justify-between mb-4">
              <span className="text-xs text-ink-3 uppercase tracking-wider">Service {i + 1}</span>
              <button onClick={() => onChange(services.filter((_, j) => j !== i))} className="text-xs text-ink-3 hover:text-[#C47B7B] transition-colors">Remove</button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <Input label="Service name" value={s.name} placeholder="Haircut" onChange={e => update(i, { name: e.target.value })} />
              </div>
              <Select label="Category" value={s.category} onChange={e => update(i, { category: e.target.value })}>
                {['Hair', 'Nails', 'Makeup', 'Skin', 'Special'].map(c => <option key={c}>{c}</option>)}
              </Select>
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-ink-2">Price (ETB)</label>
                <input type="number" value={s.price} onChange={e => update(i, { price: Number(e.target.value) })}
                  className="h-10 w-full px-3 rounded-[10px] border border-line text-sm bg-surface text-ink focus:outline-none focus:border-warm" />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-ink-2">Duration (min)</label>
                <input type="number" value={s.duration} onChange={e => update(i, { duration: Number(e.target.value) })}
                  className="h-10 w-full px-3 rounded-[10px] border border-line text-sm bg-surface text-ink focus:outline-none focus:border-warm" />
              </div>
              <div className="flex items-end pb-1">
                <Toggle checked={s.showPrice} onChange={v => update(i, { showPrice: v })} label="Show price publicly" />
              </div>
            </div>
          </div>
        ))}

        <button
          onClick={addService}
          className="flex items-center justify-center gap-2 py-4 rounded-xl border-2 border-dashed border-line text-ink-3 hover:border-warm hover:text-ink-2 transition-all text-sm font-medium"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 5v14M5 12h14" /></svg>
          Add another service
        </button>
      </div>
      <StepNav onBack={onBack} onNext={onNext} nextLabel="Finish setup" />
    </div>
  )
}

function StepComplete({ salonInfo, services, onEnter }: {
  salonInfo: { name: string; address: string }
  services: Service[]
  onEnter: () => void
}) {
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
          <span className="text-sm text-ink-3">Salon</span>
          <span className="text-sm font-medium text-ink">{salonInfo.name}</span>
        </div>
        <div className="flex items-center justify-between px-5 py-4">
          <span className="text-sm text-ink-3">Location</span>
          <span className="text-sm font-medium text-ink">{salonInfo.address}</span>
        </div>
        <div className="flex items-center justify-between px-5 py-4">
          <span className="text-sm text-ink-3">Branches</span>
          <span className="text-sm font-medium text-ink">2 (Bole, Kazanchis)</span>
        </div>
        <div className="flex items-center justify-between px-5 py-4">
          <span className="text-sm text-ink-3">Services</span>
          <span className="text-sm font-medium text-ink">{services.length} added</span>
        </div>
        <div className="flex items-center justify-between px-5 py-4">
          <span className="text-sm text-ink-3">Opening hours</span>
          <span className="text-sm font-medium text-ink">Mon–Sat 09:00–18:00</span>
        </div>
      </div>

      <Button size="lg" onClick={onEnter}>Enter Z-salon</Button>
    </div>
  )
}
