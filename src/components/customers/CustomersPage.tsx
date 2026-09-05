import { useState } from 'react'
import type { Customer, Appointment, FeedbackItem } from '../../types'
import { Button, Input, Textarea, Modal, Avatar } from '../ui'
import { EmptyState } from '../services/ServicesPage'

interface CustomersPageProps {
  customers: Customer[]
  appointments: Appointment[]
  feedback: FeedbackItem[]
  onUpdate: (customers: Customer[]) => void
}

export function CustomersPage({ customers, appointments, feedback, onUpdate }: CustomersPageProps) {
  const [search,     setSearch]     = useState('')
  const [selected,   setSelected]   = useState<Customer | null>(null)
  const [activeTab,  setActiveTab]  = useState<'overview' | 'appointments' | 'feedback' | 'notes'>('overview')
  const [showModal,  setShowModal]  = useState(false)

  const filtered = customers.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.phone.includes(search)
  )

  function handleSave(cust: Customer) {
    onUpdate([...customers, cust])
    setShowModal(false)
  }

  function saveNotes(notes: string) {
    if (!selected) return
    const updated = { ...selected, notes }
    onUpdate(customers.map(c => c.id === selected.id ? updated : c))
    setSelected(updated)
  }

  if (selected) {
    const custAppts = appointments.filter(a => a.customerId === selected.id).sort((a, b) => b.date.localeCompare(a.date))
    const custFb    = feedback.filter(f => f.customerId === selected.id)
    const upcoming  = custAppts.find(a => a.date >= new Date().toISOString().split('T')[0] && a.status !== 'cancelled')
    const lastAppt  = custAppts.find(a => a.date < new Date().toISOString().split('T')[0])

    return (
      <div className="flex flex-col h-full overflow-hidden">
        {/* Header */}
        <div className="px-8 py-5 bg-surface border-b border-line flex-shrink-0">
          <button onClick={() => setSelected(null)} className="flex items-center gap-2 text-sm text-ink-3 hover:text-ink transition-colors mb-5">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 18l-6-6 6-6"/></svg>
            All customers
          </button>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Avatar name={selected.name} size="lg" />
              <div>
                <h2 className="font-display text-2xl text-ink">{selected.name}</h2>
                <p className="text-ink-3 text-sm mt-0.5">{selected.phone}{selected.email ? ` · ${selected.email}` : ''}</p>
              </div>
            </div>
          </div>

          {/* Stats */}
          <div className="flex items-center gap-6 mt-5 pt-5 border-t border-line">
            <Stat label="Visits"       value={String(selected.visitCount ?? custAppts.filter(a => a.status === 'completed').length)} />
            <div className="w-px h-8 bg-line" />
            <Stat label="Total spent"  value={`${(selected.totalSpent ?? custAppts.filter(a => a.status === 'completed').reduce((s, a) => s + a.price, 0)).toLocaleString()} ETB`} />
            <div className="w-px h-8 bg-line" />
            <Stat label="Outstanding"  value={`${(selected.outstandingBalance ?? 0).toLocaleString()} ETB`} color={(selected.outstandingBalance ?? 0) > 0 ? '#B06A6A' : undefined} />
            <div className="w-px h-8 bg-line" />
            <Stat label="Last visit"   value={selected.lastVisit ?? (lastAppt?.date ?? 'Never')} />
          </div>

          <div className="flex gap-1 mt-5">
            {(['overview', 'appointments', 'feedback', 'notes'] as const).map(tab => (
              <button key={tab} onClick={() => setActiveTab(tab)}
                className={`h-8 px-4 text-xs font-medium rounded-xl transition-colors capitalize ${activeTab === tab ? 'bg-ink text-surface' : 'text-ink-3 hover:text-ink hover:bg-warm-subtle'}`}>
                {tab}
              </button>
            ))}
          </div>
        </div>

        {/* Tab content */}
        <div className="flex-1 overflow-y-auto px-8 py-6">
          {activeTab === 'overview' && (
            <div className="max-w-2xl flex flex-col gap-4">
              {upcoming && (
                <div className="bg-surface rounded-2xl border border-line p-5">
                  <p className="text-[10px] font-semibold text-ink-3 uppercase tracking-wider mb-3">Upcoming appointment</p>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-ink">{upcoming.serviceName}</p>
                      <p className="text-sm text-ink-3 mt-0.5">{upcoming.date} · {upcoming.startTime} · {upcoming.branchName}</p>
                    </div>
                    <span className="text-sm font-semibold text-ink">{upcoming.price.toLocaleString()} ETB</span>
                  </div>
                </div>
              )}
              {lastAppt && (
                <div className="bg-surface rounded-2xl border border-line p-5">
                  <p className="text-[10px] font-semibold text-ink-3 uppercase tracking-wider mb-3">Last visit</p>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-ink">{lastAppt.serviceName}</p>
                      <p className="text-sm text-ink-3 mt-0.5">{lastAppt.date} · {lastAppt.staffName} · {lastAppt.branchName}</p>
                    </div>
                    <span className="text-sm font-semibold text-ink">{lastAppt.price.toLocaleString()} ETB</span>
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'appointments' && (
            <div className="max-w-2xl flex flex-col gap-2">
              {custAppts.length === 0
                ? <p className="text-sm text-ink-3 py-10 text-center">No appointments yet.</p>
                : custAppts.map(a => (
                  <div key={a.id} className="bg-surface rounded-xl border border-line px-5 py-3.5 flex items-center gap-4">
                    <div className="w-20 flex-shrink-0">
                      <p className="text-sm font-medium text-ink">{a.date}</p>
                      <p className="text-xs text-ink-3">{a.startTime}</p>
                    </div>
                    <div className="w-px h-8 bg-line flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-ink truncate">{a.serviceName}</p>
                      <p className="text-xs text-ink-3">{a.staffName} · {a.branchName}</p>
                    </div>
                    <span className="text-sm font-semibold text-ink-2 flex-shrink-0">{a.price.toLocaleString()} ETB</span>
                    <span className="text-xs text-ink-3 flex-shrink-0 capitalize">{a.status.replace('-', ' ')}</span>
                  </div>
                ))
              }
            </div>
          )}

          {activeTab === 'feedback' && (
            <div className="max-w-2xl flex flex-col gap-3">
              {custFb.length === 0
                ? <p className="text-sm text-ink-3 py-10 text-center">No feedback from this customer yet.</p>
                : custFb.map(f => (
                  <div key={f.id} className="bg-surface rounded-2xl border border-line p-5">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <MiniStars rating={f.overallRating} />
                        <span className="text-sm font-medium text-ink">{f.overallRating.toFixed(1)}</span>
                      </div>
                      <span className="text-xs text-ink-3">{f.date}</span>
                    </div>
                    {f.comment && <p className="text-sm text-ink-2 leading-relaxed">"{f.comment}"</p>}
                    <p className="text-xs text-ink-3 mt-2">{f.serviceName} · {f.staffName}</p>
                  </div>
                ))
              }
            </div>
          )}

          {activeTab === 'notes' && (
            <NotesTab notes={selected.notes ?? ''} onSave={saveNotes} />
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="px-8 py-5 bg-surface border-b border-line flex-shrink-0">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2 className="font-display text-[1.75rem] text-ink leading-none">Customers</h2>
            <p className="text-ink-3 text-sm mt-1.5">Manage your client relationships.</p>
          </div>
          <Button onClick={() => setShowModal(true)} size="sm"><PlusIcon /> Add Customer</Button>
        </div>
        <div className="relative max-w-sm">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-3" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/>
          </svg>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by name or phone…"
            className="h-9 w-full pl-9 pr-3 rounded-xl border border-line text-sm bg-bg text-ink placeholder:text-ink-3 focus:outline-none focus:border-warm"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {filtered.length === 0 ? (
          <div className="px-8 py-6">
            <EmptyState icon={<PersonIcon />} title="No customers yet" description="Customers will appear here after their first booking." action={<Button onClick={() => setShowModal(true)} size="sm"><PlusIcon /> Add Customer</Button>} />
          </div>
        ) : (
          <div className="bg-surface border-b border-line">
            {/* Table header */}
            <div className="grid grid-cols-[1fr_160px_80px_120px_120px_100px] gap-4 px-8 py-3 border-b border-line">
              {['Customer', 'Phone', 'Visits', 'Last visit', 'Total spent', 'Outstanding'].map(h => (
                <span key={h} className="text-[11px] font-semibold text-ink-3 uppercase tracking-wider">{h}</span>
              ))}
            </div>
            {filtered.map(c => (
              <button key={c.id} onClick={() => { setSelected(c); setActiveTab('overview') }}
                className="grid grid-cols-[1fr_160px_80px_120px_120px_100px] gap-4 px-8 py-4 border-b border-line last:border-0 w-full text-left hover:bg-bg transition-colors items-center group">
                <div className="flex items-center gap-3 min-w-0">
                  <Avatar name={c.name} size="sm" />
                  <span className="text-sm font-medium text-ink truncate">{c.name}</span>
                </div>
                <span className="text-sm text-ink-3">{c.phone}</span>
                <span className="text-sm text-ink-2">{c.visitCount ?? 0}</span>
                <span className="text-sm text-ink-3">{c.lastVisit ?? '—'}</span>
                <span className="text-sm font-medium text-ink">{(c.totalSpent ?? 0).toLocaleString()} ETB</span>
                <span className={`text-sm font-medium ${(c.outstandingBalance ?? 0) > 0 ? 'text-[#B06A6A]' : 'text-ink-3'}`}>
                  {(c.outstandingBalance ?? 0) > 0 ? `${c.outstandingBalance?.toLocaleString()} ETB` : '—'}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      <AddCustomerModal open={showModal} onClose={() => setShowModal(false)} onSave={handleSave} existing={customers} />
    </div>
  )
}

// ─── Add Customer Modal ───────────────────────────────────────────────────────

function AddCustomerModal({ open, onClose, onSave, existing }: {
  open: boolean; onClose: () => void; onSave: (c: Customer) => void; existing: Customer[]
}) {
  const [form, setForm] = useState({ name: '', phone: '', email: '', dob: '', notes: '' })
  const [duplicate, setDuplicate] = useState<Customer | null>(null)

  function handlePhoneChange(phone: string) {
    setForm(f => ({ ...f, phone }))
    const found = existing.find(c => c.phone.replace(/\s/g, '') === phone.replace(/\s/g, '') && phone.length > 6)
    setDuplicate(found ?? null)
  }

  function handleSave() {
    if (!form.name.trim() || !form.phone.trim()) return
    onSave({
      id: `c${Date.now()}`, name: form.name.trim(), phone: form.phone.trim(),
      email: form.email || undefined, dob: form.dob || undefined, notes: form.notes || undefined,
      visitCount: 0, totalSpent: 0, outstandingBalance: 0,
    })
    setForm({ name: '', phone: '', email: '', dob: '', notes: '' })
    setDuplicate(null)
  }

  return (
    <Modal open={open} onClose={onClose} title="Add Customer" width="max-w-md">
      <div className="px-6 py-5 flex flex-col gap-4">
        {duplicate && (
          <div className="bg-[#FBF5EA] border border-[#E8D5A8] rounded-xl px-4 py-3">
            <p className="text-sm text-[#7A5F2C] font-medium mb-0.5">Customer already exists</p>
            <p className="text-sm text-[#7A5F2C]">{duplicate.name} · {duplicate.phone}</p>
          </div>
        )}
        <Input label="Full name" value={form.name} placeholder="Hana Girma" onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
        <Input label="Phone" value={form.phone} placeholder="+251 9XX XXX XXX" onChange={e => handlePhoneChange(e.target.value)} />
        <Input label="Email (optional)" type="email" value={form.email} placeholder="hana@example.com" onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
        <Input label="Date of birth (optional)" type="date" value={form.dob} onChange={e => setForm(f => ({ ...f, dob: e.target.value }))} />
        <Textarea label="Notes (optional)" value={form.notes} rows={2} placeholder="Any preferences or notes…" onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
      </div>
      <div className="px-6 pb-6 flex gap-3 justify-end border-t border-line pt-4">
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button onClick={handleSave} disabled={!!duplicate}>Add customer</Button>
      </div>
    </Modal>
  )
}

// ─── Notes Tab ────────────────────────────────────────────────────────────────

function NotesTab({ notes, onSave }: { notes: string; onSave: (n: string) => void }) {
  const [value, setValue] = useState(notes)
  const [saved,  setSaved]  = useState(false)

  function handleSave() {
    onSave(value)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div className="max-w-xl">
      <p className="text-xs text-ink-3 mb-3">Private salon notes — not visible to the customer.</p>
      <textarea
        value={value}
        onChange={e => setValue(e.target.value)}
        rows={6}
        placeholder="Prefers afternoon appointments. Usually books Sara…"
        className="w-full px-4 py-3 rounded-xl border border-line text-sm bg-surface text-ink placeholder:text-ink-3 focus:outline-none focus:border-warm resize-none"
      />
      <div className="flex items-center gap-3 mt-3">
        <Button size="sm" onClick={handleSave}>Save notes</Button>
        {saved && <span className="text-xs text-[#2A5F30]">Saved</span>}
      </div>
    </div>
  )
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function MiniStars({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1,2,3,4,5].map(i => (
        <svg key={i} width="11" height="11" viewBox="0 0 24 24" fill={i <= Math.round(rating) ? '#C4A97D' : 'none'} stroke="#C4A97D" strokeWidth="1.5">
          <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
        </svg>
      ))}
    </div>
  )
}

function Stat({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div>
      <p className="text-xs text-ink-3">{label}</p>
      <p className="text-base font-semibold mt-0.5" style={{ color: color ?? '#1C1C1C' }}>{value}</p>
    </div>
  )
}

function PlusIcon() { return <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 5v14M5 12h14"/></svg> }
function PersonIcon() { return <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M9 11a4 4 0 100-8 4 4 0 000 8z"/></svg> }
