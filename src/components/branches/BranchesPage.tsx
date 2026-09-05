import { useState } from 'react'
import type { Branch, StaffMember, Service } from '../../types'
import { Button, Input, Toggle, Modal, Avatar } from '../ui'
import { EmptyState } from '../services/ServicesPage'

interface BranchesPageProps {
  branches: Branch[]
  staff: StaffMember[]
  services: Service[]
  onUpdate: (branches: Branch[]) => void
}

const DEFAULT_HOURS = [
  { day: 'Monday',    open: true,  from: '09:00', to: '18:00' },
  { day: 'Tuesday',   open: true,  from: '09:00', to: '18:00' },
  { day: 'Wednesday', open: true,  from: '09:00', to: '18:00' },
  { day: 'Thursday',  open: true,  from: '09:00', to: '18:00' },
  { day: 'Friday',    open: true,  from: '09:00', to: '18:00' },
  { day: 'Saturday',  open: true,  from: '09:00', to: '17:00' },
  { day: 'Sunday',    open: false, from: '09:00', to: '17:00' },
]

export function BranchesPage({ branches, staff, services, onUpdate }: BranchesPageProps) {
  const [selected,  setSelected]  = useState<Branch | null>(null)
  const [activeTab, setActiveTab] = useState<'info' | 'hours' | 'staff' | 'services'>('info')
  const [showModal, setShowModal] = useState(false)
  const [editing,   setEditing]   = useState<Branch | null>(null)

  function openAdd()  { setEditing(null); setShowModal(true) }
  function openEdit() { setEditing(selected!); setShowModal(true) }

  function handleSave(branch: Branch) {
    if (editing) {
      onUpdate(branches.map(b => b.id === branch.id ? branch : b))
      setSelected(branch)
    } else {
      onUpdate([...branches, branch])
    }
    setShowModal(false)
  }

  function toggleStatus() {
    if (!selected) return
    const updated = { ...selected, status: selected.status === 'active' ? 'inactive' as const : 'active' as const }
    onUpdate(branches.map(b => b.id === selected.id ? updated : b))
    setSelected(updated)
  }

  if (selected) {
    const branchStaff    = staff.filter(m => (selected.staffIds ?? []).includes(m.id))
    const branchServices = services.filter(s => (selected.serviceIds ?? []).includes(s.id))
    const isActive       = (selected.status ?? 'active') === 'active'

    return (
      <div className="flex flex-col h-full overflow-hidden">
        <div className="px-8 py-5 bg-surface border-b border-line flex-shrink-0">
          <button onClick={() => setSelected(null)} className="flex items-center gap-2 text-sm text-ink-3 hover:text-ink transition-colors mb-5">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 18l-6-6 6-6"/></svg>
            All branches
          </button>
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2.5">
                <h2 className="font-display text-2xl text-ink">{selected.name}</h2>
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${isActive ? 'bg-[#EAF5EC] text-[#2A5F30]' : 'bg-line text-ink-3'}`}>
                  {isActive ? 'Open' : 'Closed'}
                </span>
              </div>
              <p className="text-ink-3 text-sm mt-0.5">{selected.address}</p>
            </div>
            <div className="flex gap-2">
              <Button variant="secondary" size="sm" onClick={toggleStatus}>{isActive ? 'Deactivate' : 'Activate'}</Button>
              <Button size="sm" onClick={openEdit}>Edit</Button>
            </div>
          </div>

          {/* Stats row */}
          <div className="flex items-center gap-6 mt-5 pt-5 border-t border-line">
            <Stat label="Today" value={String(selected.todayAppointments ?? 0)} sub="appointments" />
            <div className="w-px h-8 bg-line" />
            <Stat label="Staff" value={String(branchStaff.length)} sub="members" />
            <div className="w-px h-8 bg-line" />
            <Stat label="Services" value={String(branchServices.length)} sub="offered" />
          </div>

          <div className="flex gap-1 mt-5">
            {(['info', 'hours', 'staff', 'services'] as const).map(tab => (
              <button key={tab} onClick={() => setActiveTab(tab)}
                className={`h-8 px-4 text-xs font-medium rounded-xl transition-colors capitalize ${activeTab === tab ? 'bg-ink text-surface' : 'text-ink-3 hover:text-ink hover:bg-warm-subtle'}`}>
                {tab}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-8 py-6">
          {activeTab === 'info' && (
            <div className="max-w-md bg-surface rounded-2xl border border-line divide-y divide-line">
              {selected.phone && <InfoRow label="Phone"   value={selected.phone} />}
              {selected.email && <InfoRow label="Email"   value={selected.email} />}
              <InfoRow label="Address" value={selected.address} />
              <InfoRow label="Status"  value={isActive ? 'Active' : 'Inactive'} />
            </div>
          )}

          {activeTab === 'hours' && (
            <div className="max-w-md bg-surface rounded-2xl border border-line overflow-hidden">
              {(selected.hours ?? DEFAULT_HOURS).map(h => (
                <div key={h.day} className="flex items-center gap-4 px-5 py-3.5 border-b border-line last:border-0">
                  <span className="w-24 text-sm font-medium text-ink flex-shrink-0">{h.day}</span>
                  {h.open
                    ? <span className="text-sm text-ink-2">{h.from} – {h.to}</span>
                    : <span className="text-sm text-ink-3">Closed</span>
                  }
                </div>
              ))}
            </div>
          )}

          {activeTab === 'staff' && (
            <div className="max-w-xl flex flex-col gap-2">
              {branchStaff.length === 0
                ? <p className="text-sm text-ink-3 py-10 text-center">No staff assigned to this branch.</p>
                : branchStaff.map(m => (
                  <div key={m.id} className="flex items-center gap-4 bg-surface rounded-xl border border-line px-5 py-3.5">
                    <Avatar name={m.name} size="md" />
                    <div className="flex-1">
                      <p className="font-medium text-ink text-sm">{m.name}</p>
                      <p className="text-xs text-ink-3 mt-0.5">{m.role}</p>
                    </div>
                    <span className="text-sm text-ink-2">{m.rating?.toFixed(1)} ★</span>
                  </div>
                ))
              }
            </div>
          )}

          {activeTab === 'services' && (
            <div className="max-w-xl bg-surface rounded-2xl border border-line overflow-hidden">
              {branchServices.length === 0
                ? <p className="text-sm text-ink-3 py-10 text-center px-5">No services configured for this branch.</p>
                : branchServices.map(s => (
                  <div key={s.id} className="flex items-center gap-4 px-5 py-3.5 border-b border-line last:border-0">
                    <div className="flex-1">
                      <p className="text-sm font-medium text-ink">{s.name}</p>
                      <p className="text-xs text-ink-3">{s.category}</p>
                    </div>
                    <span className="text-sm text-ink-2">{s.price.toLocaleString()} ETB</span>
                    <span className="text-sm text-ink-3">{s.duration} min</span>
                  </div>
                ))
              }
            </div>
          )}
        </div>

        <BranchFormModal open={showModal} onClose={() => setShowModal(false)} branch={editing} staff={staff} services={services} onSave={handleSave} />
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="px-8 py-5 bg-surface border-b border-line flex-shrink-0">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="font-display text-[1.75rem] text-ink leading-none">Branches</h2>
            <p className="text-ink-3 text-sm mt-1.5">Manage your salon locations.</p>
          </div>
          <Button onClick={openAdd} size="sm"><PlusIcon /> Add Branch</Button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-8 py-6">
        {branches.length === 0 ? (
          <EmptyState icon={<BranchIcon />} title="No branches yet" description="Add your first branch to get started." action={<Button onClick={openAdd} size="sm"><PlusIcon /> Add Branch</Button>} />
        ) : (
          <div className="grid grid-cols-2 gap-4">
            {branches.map(branch => {
              const isActive     = (branch.status ?? 'active') === 'active'
              const branchStaff  = staff.filter(m => (branch.staffIds ?? []).includes(m.id))
              const branchSvcs   = services.filter(s => (branch.serviceIds ?? []).includes(s.id))

              return (
                <button
                  key={branch.id}
                  onClick={() => { setSelected(branch); setActiveTab('info') }}
                  className="bg-surface rounded-2xl border border-line p-6 text-left hover:border-warm hover:shadow-sm transition-all"
                >
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h3 className="font-display text-xl text-ink">{branch.name}</h3>
                      <p className="text-sm text-ink-3 mt-0.5">{branch.address}</p>
                    </div>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium flex-shrink-0 ${isActive ? 'bg-[#EAF5EC] text-[#2A5F30]' : 'bg-line text-ink-3'}`}>
                      {isActive ? 'Open' : 'Closed'}
                    </span>
                  </div>
                  <div className="flex items-center gap-4 pt-4 border-t border-line">
                    <div className="text-center">
                      <p className="text-lg font-semibold text-ink">{branch.todayAppointments ?? 0}</p>
                      <p className="text-[11px] text-ink-3">today</p>
                    </div>
                    <div className="w-px h-8 bg-line" />
                    <div className="text-center">
                      <p className="text-lg font-semibold text-ink">{branchStaff.length}</p>
                      <p className="text-[11px] text-ink-3">staff</p>
                    </div>
                    <div className="w-px h-8 bg-line" />
                    <div className="text-center">
                      <p className="text-lg font-semibold text-ink">{branchSvcs.length}</p>
                      <p className="text-[11px] text-ink-3">services</p>
                    </div>
                  </div>
                </button>
              )
            })}
          </div>
        )}
      </div>

      <BranchFormModal open={showModal} onClose={() => setShowModal(false)} branch={editing} staff={staff} services={services} onSave={handleSave} />
    </div>
  )
}

// ─── Branch Form Modal ────────────────────────────────────────────────────────

function BranchFormModal({ open, onClose, branch, staff, services, onSave }: {
  open: boolean; onClose: () => void; branch: Branch | null
  staff: StaffMember[]; services: Service[]; onSave: (b: Branch) => void
}) {
  const [form, setForm] = useState<Branch>(() => branch ?? {
    id: `b${Date.now()}`, name: '', address: '', phone: '', email: '',
    staffIds: [], serviceIds: [], status: 'active', hours: DEFAULT_HOURS, todayAppointments: 0,
  })

  function toggleStaff(id: string) {
    setForm(f => ({ ...f, staffIds: (f.staffIds ?? []).includes(id) ? (f.staffIds ?? []).filter(s => s !== id) : [...(f.staffIds ?? []), id] }))
  }
  function toggleService(id: string) {
    setForm(f => ({ ...f, serviceIds: (f.serviceIds ?? []).includes(id) ? (f.serviceIds ?? []).filter(s => s !== id) : [...(f.serviceIds ?? []), id] }))
  }

  return (
    <Modal open={open} onClose={onClose} title={branch ? 'Edit Branch' : 'Add Branch'} width="max-w-lg">
      <div className="px-6 py-5 flex flex-col gap-4">
        <Input label="Branch name" value={form.name} placeholder="Bole" onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
        <Input label="Address" value={form.address} placeholder="Bole Road, Addis Ababa" onChange={e => setForm(f => ({ ...f, address: e.target.value }))} />
        <div className="grid grid-cols-2 gap-4">
          <Input label="Phone" value={form.phone ?? ''} placeholder="+251 9XX XXX XXX" onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} />
          <Input label="Email (optional)" type="email" value={form.email ?? ''} placeholder="branch@zsalon.com" onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
        </div>
        <div>
          <label className="text-sm font-medium text-ink-2 block mb-2">Assigned staff</label>
          <div className="flex gap-2 flex-wrap">
            {staff.map(m => (
              <button key={m.id} onClick={() => toggleStaff(m.id)}
                className={`px-3 py-1.5 rounded-xl text-xs border transition-all ${(form.staffIds ?? []).includes(m.id) ? 'border-ink bg-ink text-surface' : 'border-line bg-surface text-ink-2 hover:border-warm'}`}>
                {(form.staffIds ?? []).includes(m.id) ? '✓' : '+'} {m.name}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="text-sm font-medium text-ink-2 block mb-2">Available services</label>
          <div className="flex gap-2 flex-wrap">
            {services.map(s => (
              <button key={s.id} onClick={() => toggleService(s.id)}
                className={`px-3 py-1.5 rounded-xl text-xs border transition-all ${(form.serviceIds ?? []).includes(s.id) ? 'border-ink bg-ink text-surface' : 'border-line bg-surface text-ink-2 hover:border-warm'}`}>
                {(form.serviceIds ?? []).includes(s.id) ? '✓' : '+'} {s.name}
              </button>
            ))}
          </div>
        </div>
        <Toggle checked={(form.status ?? 'active') === 'active'} onChange={v => setForm(f => ({ ...f, status: v ? 'active' : 'inactive' }))} label="Active" />
      </div>
      <div className="px-6 pb-6 flex gap-3 justify-end border-t border-line pt-4">
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button onClick={() => { if (form.name.trim()) onSave(form) }}>{branch ? 'Save changes' : 'Add branch'}</Button>
      </div>
    </Modal>
  )
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between px-5 py-3.5">
      <span className="text-sm text-ink-3">{label}</span>
      <span className="text-sm text-ink">{value}</span>
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

function PlusIcon() { return <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 5v14M5 12h14"/></svg> }
function BranchIcon() { return <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><path d="M9 22V12h6v10"/></svg> }
