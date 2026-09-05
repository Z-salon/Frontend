import { useState } from 'react'
import type { StaffMember, Service, Branch, FeedbackItem } from '../../types'
import { Button, Input, Select, Toggle, Modal, Avatar } from '../ui'
import { EmptyState } from '../services/ServicesPage'

interface StaffPageProps {
  staff: StaffMember[]
  services: Service[]
  branches: Branch[]
  feedback: FeedbackItem[]
  onUpdate: (staff: StaffMember[]) => void
}

const DEFAULT_HOURS = [
  { day: 'Monday',    open: true,  from: '09:00', to: '17:00' },
  { day: 'Tuesday',   open: true,  from: '09:00', to: '17:00' },
  { day: 'Wednesday', open: true,  from: '09:00', to: '17:00' },
  { day: 'Thursday',  open: true,  from: '09:00', to: '17:00' },
  { day: 'Friday',    open: true,  from: '09:00', to: '17:00' },
  { day: 'Saturday',  open: true,  from: '10:00', to: '15:00' },
  { day: 'Sunday',    open: false, from: '09:00', to: '17:00' },
]

export function StaffPage({ staff, services, branches, feedback, onUpdate }: StaffPageProps) {
  const [selected,  setSelected]  = useState<StaffMember | null>(null)
  const [activeTab, setActiveTab] = useState<'overview' | 'services' | 'hours' | 'feedback'>('overview')
  const [showModal, setShowModal] = useState(false)
  const [editing,   setEditing]   = useState<StaffMember | null>(null)

  function openAdd()  { setEditing(null); setShowModal(true) }
  function openEdit() { setEditing(selected!); setShowModal(true) }

  function handleSave(member: StaffMember) {
    if (editing) {
      onUpdate(staff.map(s => s.id === member.id ? member : s))
      setSelected(member)
    } else {
      onUpdate([...staff, member])
    }
    setShowModal(false)
  }

  function toggleStatus() {
    if (!selected) return
    const updated = { ...selected, status: selected.status === 'active' ? 'inactive' as const : 'active' as const }
    onUpdate(staff.map(s => s.id === selected.id ? updated : s))
    setSelected(updated)
  }

  if (selected) {
    return (
      <StaffDetail
        member={selected}
        services={services}
        branches={branches}
        feedback={feedback.filter(f => f.staffId === selected.id)}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        onBack={() => setSelected(null)}
        onEdit={openEdit}
        onToggleStatus={toggleStatus}
        modal={showModal ? (
          <StaffFormModal open onClose={() => setShowModal(false)} member={editing} services={services} branches={branches} onSave={handleSave} />
        ) : null}
      />
    )
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="px-8 py-5 bg-surface border-b border-line flex-shrink-0">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="font-display text-[1.75rem] text-ink leading-none">Staff</h2>
            <p className="text-ink-3 text-sm mt-1.5">Manage your team and their services.</p>
          </div>
          <Button onClick={openAdd} size="sm"><PlusIcon /> Add Staff</Button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-8 py-6">
        {staff.length === 0 ? (
          <EmptyState icon={<PersonIcon />} title="No staff members yet" description="Add your team to start managing appointments." action={<Button onClick={openAdd} size="sm"><PlusIcon /> Add Staff</Button>} />
        ) : (
          <div className="grid grid-cols-3 gap-4">
            {staff.map(member => {
              const memberBranches = branches.filter(b => (member.branchIds ?? []).includes(b.id))
              const isActive = (member.status ?? 'active') === 'active'
              return (
                <button
                  key={member.id}
                  onClick={() => { setSelected(member); setActiveTab('overview') }}
                  className="bg-surface rounded-2xl border border-line p-5 text-left hover:border-warm hover:shadow-sm transition-all group"
                >
                  <div className="flex items-start justify-between mb-4">
                    <Avatar name={member.name} size="lg" />
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${isActive ? 'bg-[#EAF5EC] text-[#2A5F30]' : 'bg-line text-ink-3'}`}>
                      {isActive ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                  <p className="font-semibold text-ink">{member.name}</p>
                  <p className="text-sm text-ink-3 mt-0.5">{member.role}</p>
                  <div className="flex items-center gap-2 mt-3">
                    <Stars rating={member.rating ?? 0} />
                    <span className="text-sm font-medium text-ink">{member.rating?.toFixed(1)}</span>
                  </div>
                  <div className="flex items-center gap-2 mt-2">
                    <span className="text-xs text-ink-3">{memberBranches.map(b => b.name).join(', ')}</span>
                  </div>
                  <div className="flex items-center justify-between mt-4 pt-4 border-t border-line">
                    <span className="text-xs text-ink-3">{member.appointmentCount ?? 0} appointments</span>
                    <span className="text-xs text-ink-3">{(member.serviceIds ?? []).length} services</span>
                  </div>
                </button>
              )
            })}
          </div>
        )}
      </div>

      <StaffFormModal open={showModal} onClose={() => setShowModal(false)} member={editing} services={services} branches={branches} onSave={handleSave} />
    </div>
  )
}

// ─── Staff Detail ─────────────────────────────────────────────────────────────

function StaffDetail({ member, services, branches, feedback, activeTab, onTabChange, onBack, onEdit, onToggleStatus, modal }: {
  member: StaffMember
  services: Service[]
  branches: Branch[]
  feedback: FeedbackItem[]
  activeTab: string
  onTabChange: (t: 'overview' | 'services' | 'hours' | 'feedback') => void
  onBack: () => void
  onEdit: () => void
  onToggleStatus: () => void
  modal: React.ReactNode
}) {
  const isActive       = (member.status ?? 'active') === 'active'
  const memberServices = services.filter(s => (member.serviceIds ?? []).includes(s.id))
  const memberBranches = branches.filter(b => (member.branchIds ?? []).includes(b.id))
  const avgRating      = feedback.length ? feedback.reduce((sum, f) => sum + f.overallRating, 0) / feedback.length : (member.rating ?? 0)

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="px-8 py-5 bg-surface border-b border-line flex-shrink-0">
        <button onClick={onBack} className="flex items-center gap-2 text-sm text-ink-3 hover:text-ink transition-colors mb-5">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 18l-6-6 6-6"/></svg>
          All staff
        </button>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Avatar name={member.name} size="lg" />
            <div>
              <div className="flex items-center gap-2.5">
                <h2 className="font-display text-2xl text-ink">{member.name}</h2>
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${isActive ? 'bg-[#EAF5EC] text-[#2A5F30]' : 'bg-line text-ink-3'}`}>
                  {isActive ? 'Active' : 'Inactive'}
                </span>
              </div>
              <p className="text-ink-3 text-sm mt-0.5">{member.role}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="secondary" size="sm" onClick={onToggleStatus}>{isActive ? 'Deactivate' : 'Activate'}</Button>
            <Button size="sm" onClick={onEdit}>Edit</Button>
          </div>
        </div>

        {/* Stats */}
        <div className="flex items-center gap-6 mt-5 pt-5 border-t border-line">
          <Stat label="Rating" value={avgRating.toFixed(1)} sub="★" />
          <div className="w-px h-8 bg-line" />
          <Stat label="Appointments" value={String(member.appointmentCount ?? 0)} sub="total" />
          <div className="w-px h-8 bg-line" />
          <Stat label="Services" value={String(memberServices.length)} sub="assigned" />
          <div className="w-px h-8 bg-line" />
          <Stat label="Branches" value={String(memberBranches.length)} sub="locations" />
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mt-5">
          {(['overview', 'services', 'hours', 'feedback'] as const).map(tab => (
            <button key={tab} onClick={() => onTabChange(tab)}
              className={`h-8 px-4 text-xs font-medium rounded-xl transition-colors capitalize ${activeTab === tab ? 'bg-ink text-surface' : 'text-ink-3 hover:text-ink hover:bg-warm-subtle'}`}>
              {tab}
            </button>
          ))}
        </div>
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto px-8 py-6">
        {activeTab === 'overview' && (
          <div className="max-w-2xl flex flex-col gap-6">
            <InfoSection title="Contact">
              {member.phone && <Row label="Phone" value={member.phone} />}
              {member.email && <Row label="Email" value={member.email} />}
            </InfoSection>
            <InfoSection title="Branches">
              <div className="flex gap-2 flex-wrap">
                {memberBranches.map(b => (
                  <span key={b.id} className="px-3 py-1.5 rounded-xl bg-warm-subtle text-ink-2 text-sm">{b.name}</span>
                ))}
              </div>
            </InfoSection>
            <InfoSection title="Services">
              <div className="flex gap-2 flex-wrap">
                {memberServices.map(s => (
                  <span key={s.id} className="px-3 py-1.5 rounded-xl bg-warm-subtle text-ink-2 text-sm">{s.name}</span>
                ))}
              </div>
            </InfoSection>
          </div>
        )}

        {activeTab === 'services' && (
          <div className="max-w-2xl">
            <div className="bg-surface rounded-2xl border border-line overflow-hidden">
              {services.map((svc, i) => {
                const assigned = (member.serviceIds ?? []).includes(svc.id)
                return (
                  <div key={svc.id} className="flex items-center gap-4 px-5 py-3.5 border-b border-line last:border-0">
                    <div className={`w-4 h-4 rounded-full border-2 flex-shrink-0 flex items-center justify-center ${assigned ? 'border-ink bg-ink' : 'border-line'}`}>
                      {assigned && <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3"><path d="M20 6L9 17l-5-5"/></svg>}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-medium ${assigned ? 'text-ink' : 'text-ink-3'}`}>{svc.name}</p>
                      <p className="text-xs text-ink-3">{svc.category} · {svc.duration} min</p>
                    </div>
                    {assigned && <span className="text-sm text-ink-2">{svc.price.toLocaleString()} ETB</span>}
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {activeTab === 'hours' && (
          <div className="max-w-md">
            <div className="bg-surface rounded-2xl border border-line overflow-hidden">
              {(member.workingHours ?? DEFAULT_HOURS).map(h => (
                <div key={h.day} className="flex items-center gap-4 px-5 py-3.5 border-b border-line last:border-0">
                  <span className="w-24 text-sm font-medium text-ink flex-shrink-0">{h.day}</span>
                  {h.open
                    ? <span className="text-sm text-ink-2">{h.from} – {h.to}</span>
                    : <span className="text-sm text-ink-3">Off</span>
                  }
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'feedback' && (
          <div className="max-w-2xl flex flex-col gap-3">
            {feedback.length === 0 ? (
              <p className="text-ink-3 text-sm py-10 text-center">No feedback yet.</p>
            ) : (
              feedback.map(f => (
                <div key={f.id} className="bg-surface rounded-2xl border border-line p-5">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <Stars rating={f.overallRating} />
                      <span className="text-sm font-medium text-ink">{f.overallRating.toFixed(1)}</span>
                    </div>
                    <span className="text-xs text-ink-3">{f.date}</span>
                  </div>
                  {f.comment && <p className="text-sm text-ink-2 leading-relaxed mb-3">"{f.comment}"</p>}
                  <p className="text-xs text-ink-3">{f.anonymous ? 'Anonymous' : f.customerName} · {f.serviceName}</p>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {modal}
    </div>
  )
}

// ─── Staff Form Modal ─────────────────────────────────────────────────────────

function StaffFormModal({ open, onClose, member, services, branches, onSave }: {
  open: boolean
  onClose: () => void
  member: StaffMember | null
  services: Service[]
  branches: Branch[]
  onSave: (m: StaffMember) => void
}) {
  const [form, setForm] = useState<StaffMember>(() => member ?? {
    id: `s${Date.now()}`, name: '', role: '', initials: '',
    phone: '', email: '', branchIds: [], serviceIds: [],
    rating: 0, appointmentCount: 0, status: 'active',
    workingHours: DEFAULT_HOURS,
  })

  function toggleService(id: string) {
    setForm(f => ({ ...f, serviceIds: (f.serviceIds ?? []).includes(id) ? (f.serviceIds ?? []).filter(s => s !== id) : [...(f.serviceIds ?? []), id] }))
  }
  function toggleBranch(id: string) {
    setForm(f => ({ ...f, branchIds: (f.branchIds ?? []).includes(id) ? (f.branchIds ?? []).filter(b => b !== id) : [...(f.branchIds ?? []), id] }))
  }

  function handleSave() {
    if (!form.name.trim()) return
    const initials = form.name.split(' ').map(p => p[0]).join('').slice(0, 2).toUpperCase()
    onSave({ ...form, initials })
  }

  return (
    <Modal open={open} onClose={onClose} title={member ? 'Edit Staff' : 'Add Staff'} width="max-w-lg">
      <div className="px-6 py-5 flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-4">
          <Input label="Full name" value={form.name} placeholder="Sara Bekele" onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
          <Input label="Role / Position" value={form.role} placeholder="Hair Stylist" onChange={e => setForm(f => ({ ...f, role: e.target.value }))} />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Input label="Phone" value={form.phone ?? ''} placeholder="+251 9XX XXX XXX" onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} />
          <Input label="Email (optional)" type="email" value={form.email ?? ''} placeholder="sara@zsalon.com" onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
        </div>

        <div>
          <label className="text-sm font-medium text-ink-2 block mb-2">Branches</label>
          <div className="flex gap-2 flex-wrap">
            {branches.map(b => (
              <button key={b.id} onClick={() => toggleBranch(b.id)}
                className={`px-3 py-1.5 rounded-xl text-xs border transition-all ${(form.branchIds ?? []).includes(b.id) ? 'border-ink bg-ink text-surface' : 'border-line bg-surface text-ink-2 hover:border-warm'}`}>
                {(form.branchIds ?? []).includes(b.id) ? '✓' : '+'} {b.name}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="text-sm font-medium text-ink-2 block mb-2">Services they can perform</label>
          <div className="bg-surface rounded-xl border border-line overflow-hidden max-h-44 overflow-y-auto">
            {services.map(svc => (
              <button key={svc.id} onClick={() => toggleService(svc.id)}
                className="flex items-center gap-3 px-4 py-2.5 border-b border-line last:border-0 w-full text-left hover:bg-bg transition-colors">
                <div className={`w-4 h-4 rounded flex-shrink-0 border-2 flex items-center justify-center ${(form.serviceIds ?? []).includes(svc.id) ? 'border-ink bg-ink' : 'border-line'}`}>
                  {(form.serviceIds ?? []).includes(svc.id) && <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3"><path d="M20 6L9 17l-5-5"/></svg>}
                </div>
                <span className="text-sm text-ink">{svc.name}</span>
                <span className="text-xs text-ink-3 ml-auto">{svc.category}</span>
              </button>
            ))}
          </div>
        </div>

        <Toggle checked={(form.status ?? 'active') === 'active'} onChange={v => setForm(f => ({ ...f, status: v ? 'active' : 'inactive' }))} label="Active" />
      </div>

      <div className="px-6 pb-6 flex gap-3 justify-end border-t border-line pt-4">
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button onClick={handleSave}>{member ? 'Save changes' : 'Add staff member'}</Button>
      </div>
    </Modal>
  )
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function Stars({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1,2,3,4,5].map(i => (
        <svg key={i} width="12" height="12" viewBox="0 0 24 24" fill={i <= Math.round(rating) ? '#C4A97D' : 'none'} stroke="#C4A97D" strokeWidth="1.5">
          <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
        </svg>
      ))}
    </div>
  )
}

function Stat({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div>
      <p className="text-xs text-ink-3">{label}</p>
      <p className="text-lg font-semibold text-ink mt-0.5">{value} <span className="text-sm font-normal text-ink-3">{sub}</span></p>
    </div>
  )
}

function InfoSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-surface rounded-2xl border border-line p-5">
      <p className="text-xs font-semibold text-ink-3 uppercase tracking-wider mb-4">{title}</p>
      {children}
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-1.5">
      <span className="text-sm text-ink-3">{label}</span>
      <span className="text-sm text-ink">{value}</span>
    </div>
  )
}

function PlusIcon() { return <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 5v14M5 12h14"/></svg> }
function PersonIcon() { return <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2M12 11a4 4 0 100-8 4 4 0 000 8z"/></svg> }
