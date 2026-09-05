import { useState } from 'react'
import type { Service, StaffMember, Branch } from '../../types'
import { Button, Input, Select, Textarea, Toggle, Modal, StatusBadge } from '../ui'

interface ServicesPageProps {
  services: Service[]
  staff: StaffMember[]
  branches: Branch[]
  onUpdate: (services: Service[]) => void
}

const CATEGORIES = ['Hair', 'Nails', 'Makeup', 'Skin', 'Barber', 'Special', 'Other']
const DEPOSIT_LABELS: Record<string, string> = {
  none: 'No deposit', fixed: 'Fixed amount', percentage: 'Percentage', full: 'Full payment',
}
const ASSIGN_LABELS: Record<string, string> = {
  'customer-chooses': 'Customer chooses', 'salon-assigns': 'Salon assigns', 'any-available': 'Any available',
}

export function ServicesPage({ services, staff, branches, onUpdate }: ServicesPageProps) {
  const [selected,  setSelected]  = useState<Service | null>(null)
  const [showModal, setShowModal] = useState(false)
  const [editing,   setEditing]   = useState<Service | null>(null)

  const grouped = CATEGORIES.reduce<Record<string, Service[]>>((acc, cat) => {
    const list = services.filter(s => s.category === cat)
    if (list.length) acc[cat] = list
    return acc
  }, {})
  const otherCats = [...new Set(services.map(s => s.category))].filter(c => !CATEGORIES.includes(c))
  otherCats.forEach(c => { grouped[c] = services.filter(s => s.category === c) })

  function openAdd() { setEditing(null); setShowModal(true) }
  function openEdit(svc: Service) { setEditing(svc); setShowModal(true); setSelected(null) }

  function handleSave(svc: Service) {
    if (editing) {
      onUpdate(services.map(s => s.id === svc.id ? svc : s))
    } else {
      onUpdate([...services, svc])
    }
    setShowModal(false)
  }

  function handleDelete(id: string) {
    onUpdate(services.filter(s => s.id !== id))
    setSelected(null)
  }

  function toggleStatus(svc: Service) {
    onUpdate(services.map(s => s.id === svc.id ? { ...s, status: s.status === 'active' ? 'inactive' : 'active' } : s))
    if (selected?.id === svc.id) setSelected({ ...svc, status: svc.status === 'active' ? 'inactive' : 'active' })
  }

  return (
    <div className="flex h-full overflow-hidden">
      {/* Main list */}
      <div className="flex-1 overflow-y-auto">
        {/* Header */}
        <div className="px-8 py-5 bg-surface border-b border-line sticky top-0 z-10">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="font-display text-[1.75rem] text-ink leading-none">Services</h2>
              <p className="text-ink-3 text-sm mt-1.5">Manage the services your salon offers.</p>
            </div>
            <Button onClick={openAdd} size="sm">
              <PlusIcon /> Add Service
            </Button>
          </div>
        </div>

        <div className="px-8 py-6">
          {services.length === 0 ? (
            <EmptyState
              icon={<LayersIcon />}
              title="No services yet"
              description="Add your first service to start accepting bookings."
              action={<Button onClick={openAdd} size="sm"><PlusIcon /> Add Service</Button>}
            />
          ) : (
            <div className="flex flex-col gap-8">
              {Object.entries(grouped).map(([cat, list]) => (
                <div key={cat}>
                  <div className="flex items-center gap-3 mb-3">
                    <p className="text-xs font-semibold text-ink-3 uppercase tracking-wider">{cat}</p>
                    <div className="flex-1 h-px bg-line" />
                    <span className="text-xs text-ink-3">{list.length} service{list.length !== 1 ? 's' : ''}</span>
                  </div>
                  <div className="bg-surface rounded-2xl border border-line overflow-hidden">
                    {list.map((svc, i) => (
                      <button
                        key={svc.id}
                        onClick={() => setSelected(prev => prev?.id === svc.id ? null : svc)}
                        className={`flex items-center w-full text-left px-5 py-4 border-b border-line last:border-0 hover:bg-bg transition-colors gap-4 ${selected?.id === svc.id ? 'bg-warm-subtle' : ''}`}
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2.5">
                            <span className="font-medium text-ink text-sm">{svc.name}</span>
                            {(svc.status ?? 'active') === 'inactive' && (
                              <span className="text-[10px] px-2 py-0.5 rounded-full bg-line text-ink-3 font-medium">Inactive</span>
                            )}
                            {!svc.showPrice && (
                              <span className="text-[10px] px-2 py-0.5 rounded-full bg-warm-subtle text-ink-3 font-medium">Price hidden</span>
                            )}
                          </div>
                          {svc.description && (
                            <p className="text-xs text-ink-3 mt-0.5 truncate max-w-sm">{svc.description}</p>
                          )}
                        </div>
                        <div className="flex items-center gap-6 flex-shrink-0">
                          <span className="text-sm font-semibold text-ink">{svc.price.toLocaleString()} ETB</span>
                          <span className="text-sm text-ink-3">{svc.duration} min{svc.buffer ? ` + ${svc.buffer}m` : ''}</span>
                          <div className="flex -space-x-1">
                            {(svc.staffIds ?? []).slice(0, 3).map(sid => {
                              const m = staff.find(s => s.id === sid)
                              return m ? (
                                <div key={sid} className="w-6 h-6 rounded-full bg-warm border-2 border-surface flex items-center justify-center text-[9px] font-semibold text-ink-2">{m.initials}</div>
                              ) : null
                            })}
                          </div>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-ink-3 flex-shrink-0">
                            <path d="M9 18l6-6-6-6"/>
                          </svg>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Detail panel */}
      {selected && (
        <ServiceDetailPanel
          service={selected}
          staff={staff}
          branches={branches}
          onEdit={() => openEdit(selected)}
          onToggleStatus={() => toggleStatus(selected)}
          onDelete={() => handleDelete(selected.id)}
          onClose={() => setSelected(null)}
        />
      )}

      {/* Add / Edit modal */}
      <ServiceFormModal
        open={showModal}
        service={editing}
        staff={staff}
        branches={branches}
        onClose={() => setShowModal(false)}
        onSave={handleSave}
      />
    </div>
  )
}

// ─── Detail Panel ─────────────────────────────────────────────────────────────

function ServiceDetailPanel({ service, staff, branches, onEdit, onToggleStatus, onDelete, onClose }: {
  service: Service
  staff: StaffMember[]
  branches: Branch[]
  onEdit: () => void
  onToggleStatus: () => void
  onDelete: () => void
  onClose: () => void
}) {
  const assignedStaff    = staff.filter(s => (service.staffIds ?? []).includes(s.id))
  const availBranches    = branches.filter(b => (service.branchIds ?? []).includes(b.id))
  const isActive         = (service.status ?? 'active') === 'active'

  const depositText = service.depositType === 'none' || !service.depositType
    ? 'No deposit required'
    : service.depositType === 'fixed'
    ? `${service.depositValue?.toLocaleString()} ETB deposit`
    : service.depositType === 'percentage'
    ? `${service.depositValue}% deposit`
    : 'Full payment required'

  return (
    <div className="w-[300px] flex-shrink-0 border-l border-line bg-surface flex flex-col h-full">
      <div className="flex items-center justify-between px-5 py-4 border-b border-line">
        <p className="text-sm font-semibold text-ink">Service detail</p>
        <button onClick={onClose} className="w-7 h-7 rounded-lg flex items-center justify-center text-ink-3 hover:bg-warm-subtle hover:text-ink transition-colors">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 6L6 18M6 6l12 12"/></svg>
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="px-5 py-5 border-b border-line">
          <div className="flex items-start justify-between mb-1">
            <h3 className="font-display text-xl text-ink leading-tight">{service.name}</h3>
            <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ml-2 flex-shrink-0 mt-1 ${isActive ? 'bg-[#EAF5EC] text-[#2A5F30]' : 'bg-line text-ink-3'}`}>
              {isActive ? 'Active' : 'Inactive'}
            </span>
          </div>
          <p className="text-xs text-ink-3">{service.category}</p>
          {service.description && <p className="text-sm text-ink-2 mt-3 leading-relaxed">{service.description}</p>}
        </div>

        <div className="px-5 py-4 border-b border-line">
          <p className="text-[10px] font-semibold text-ink-3 uppercase tracking-wider mb-3.5">Pricing & Duration</p>
          <div className="flex flex-col gap-3">
            <Row label="Price"    value={`${service.price.toLocaleString()} ETB`} />
            <Row label="Duration" value={`${service.duration} min`} />
            <Row label="Buffer"   value={service.buffer ? `${service.buffer} min` : 'None'} />
            <Row label="Deposit"  value={depositText} />
            <Row label="Show price" value={service.showPrice ? 'Visible to customers' : 'Hidden'} />
          </div>
        </div>

        <div className="px-5 py-4 border-b border-line">
          <p className="text-[10px] font-semibold text-ink-3 uppercase tracking-wider mb-3.5">Staff Assignment</p>
          <p className="text-sm text-ink-2 mb-3">{ASSIGN_LABELS[service.employeeAssignment ?? 'any-available']}</p>
          {assignedStaff.length > 0 && (
            <div className="flex flex-col gap-2">
              {assignedStaff.map(m => (
                <div key={m.id} className="flex items-center gap-2.5">
                  <div className="w-6 h-6 rounded-full bg-warm flex items-center justify-center text-[10px] font-semibold text-ink-2">{m.initials}</div>
                  <span className="text-sm text-ink">{m.name}</span>
                  <span className="text-xs text-ink-3">{m.role}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="px-5 py-4">
          <p className="text-[10px] font-semibold text-ink-3 uppercase tracking-wider mb-3.5">Available At</p>
          <div className="flex flex-col gap-2">
            {availBranches.length === 0
              ? <p className="text-sm text-ink-3">All branches</p>
              : availBranches.map(b => (
                <div key={b.id} className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-[#8BAB95]" />
                  <span className="text-sm text-ink">{b.name}</span>
                </div>
              ))
            }
          </div>
        </div>
      </div>

      <div className="px-5 py-4 border-t border-line flex flex-col gap-2">
        <Button variant="secondary" fullWidth size="sm" onClick={onEdit}>Edit service</Button>
        <Button variant="ghost" fullWidth size="sm" onClick={onToggleStatus}>
          {isActive ? 'Deactivate' : 'Activate'}
        </Button>
      </div>
    </div>
  )
}

// ─── Add / Edit Modal ─────────────────────────────────────────────────────────

function ServiceFormModal({ open, service, staff, branches, onClose, onSave }: {
  open: boolean
  service: Service | null
  staff: StaffMember[]
  branches: Branch[]
  onClose: () => void
  onSave: (s: Service) => void
}) {
  const [form, setForm] = useState<Service>(() => service ?? {
    id: `sv${Date.now()}`, name: '', category: 'Hair', description: '',
    price: 0, duration: 60, buffer: 10, showPrice: true,
    depositType: 'none', depositValue: undefined,
    employeeAssignment: 'customer-chooses',
    staffIds: [], branchIds: ['b1'], status: 'active',
  })

  // Reset when modal opens
  const reset = (s: Service | null) => setForm(s ?? {
    id: `sv${Date.now()}`, name: '', category: 'Hair', description: '',
    price: 0, duration: 60, buffer: 10, showPrice: true,
    depositType: 'none', depositValue: undefined,
    employeeAssignment: 'customer-chooses',
    staffIds: [], branchIds: ['b1'], status: 'active',
  })

  function toggleStaff(id: string) {
    setForm(f => ({
      ...f,
      staffIds: (f.staffIds ?? []).includes(id)
        ? (f.staffIds ?? []).filter(s => s !== id)
        : [...(f.staffIds ?? []), id],
    }))
  }

  function toggleBranch(id: string) {
    setForm(f => ({
      ...f,
      branchIds: (f.branchIds ?? []).includes(id)
        ? (f.branchIds ?? []).filter(b => b !== id)
        : [...(f.branchIds ?? []), id],
    }))
  }

  function handleSave() {
    if (!form.name.trim()) return
    onSave(form)
  }

  return (
    <Modal open={open} onClose={onClose} title={service ? 'Edit Service' : 'Add Service'} width="max-w-xl">
      <div className="px-6 py-5 flex flex-col gap-5">
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <Input label="Service name" value={form.name} placeholder="e.g. Hair Treatment" onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
          </div>
          <Select label="Category" value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
            {CATEGORIES.map(c => <option key={c}>{c}</option>)}
          </Select>
          <div className="flex items-end">
            <Toggle checked={form.showPrice} onChange={v => setForm(f => ({ ...f, showPrice: v }))} label="Show price publicly" />
          </div>
        </div>

        <Textarea label="Description (optional)" value={form.description ?? ''} rows={2} placeholder="Brief description of this service…" onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />

        <div className="grid grid-cols-3 gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-ink-2">Price (ETB)</label>
            <input type="number" value={form.price} onChange={e => setForm(f => ({ ...f, price: +e.target.value }))}
              className="h-10 px-3 rounded-[10px] border border-line text-sm bg-surface text-ink focus:outline-none focus:border-warm" />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-ink-2">Duration (min)</label>
            <input type="number" value={form.duration} onChange={e => setForm(f => ({ ...f, duration: +e.target.value }))}
              className="h-10 px-3 rounded-[10px] border border-line text-sm bg-surface text-ink focus:outline-none focus:border-warm" />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-ink-2">Buffer (min)</label>
            <input type="number" value={form.buffer ?? 0} onChange={e => setForm(f => ({ ...f, buffer: +e.target.value }))}
              className="h-10 px-3 rounded-[10px] border border-line text-sm bg-surface text-ink focus:outline-none focus:border-warm" />
          </div>
        </div>

        {/* Deposit */}
        <div>
          <label className="text-sm font-medium text-ink-2 block mb-2">Deposit requirement</label>
          <div className="flex gap-2 flex-wrap mb-3">
            {(['none', 'fixed', 'percentage', 'full'] as const).map(dt => (
              <button key={dt} onClick={() => setForm(f => ({ ...f, depositType: dt }))}
                className={`px-3 py-1.5 rounded-xl text-xs border transition-all ${form.depositType === dt ? 'border-ink bg-ink text-surface' : 'border-line bg-surface text-ink-2 hover:border-warm'}`}>
                {DEPOSIT_LABELS[dt]}
              </button>
            ))}
          </div>
          {(form.depositType === 'fixed' || form.depositType === 'percentage') && (
            <div className="flex items-center gap-2">
              <input type="number" value={form.depositValue ?? ''} onChange={e => setForm(f => ({ ...f, depositValue: +e.target.value }))}
                className="w-24 h-9 px-3 rounded-xl border border-line text-sm bg-surface text-ink focus:outline-none focus:border-warm text-center"
                placeholder="0" />
              <span className="text-sm text-ink-3">{form.depositType === 'percentage' ? '%' : 'ETB'}</span>
            </div>
          )}
        </div>

        {/* Staff assignment */}
        <div>
          <label className="text-sm font-medium text-ink-2 block mb-2">Staff assignment</label>
          <div className="flex gap-2 flex-wrap mb-3">
            {(['customer-chooses', 'salon-assigns', 'any-available'] as const).map(ea => (
              <button key={ea} onClick={() => setForm(f => ({ ...f, employeeAssignment: ea }))}
                className={`px-3 py-1.5 rounded-xl text-xs border transition-all ${form.employeeAssignment === ea ? 'border-ink bg-ink text-surface' : 'border-line bg-surface text-ink-2 hover:border-warm'}`}>
                {ASSIGN_LABELS[ea]}
              </button>
            ))}
          </div>
          <div className="flex gap-2 flex-wrap">
            {staff.map(m => (
              <button key={m.id} onClick={() => toggleStaff(m.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs border transition-all ${(form.staffIds ?? []).includes(m.id) ? 'border-ink bg-ink text-surface' : 'border-line bg-surface text-ink-2 hover:border-warm'}`}>
                {(form.staffIds ?? []).includes(m.id) ? '✓' : '+'} {m.name}
              </button>
            ))}
          </div>
        </div>

        {/* Branches */}
        <div>
          <label className="text-sm font-medium text-ink-2 block mb-2">Available branches</label>
          <div className="flex gap-2">
            {branches.map(b => (
              <button key={b.id} onClick={() => toggleBranch(b.id)}
                className={`px-3 py-1.5 rounded-xl text-xs border transition-all ${(form.branchIds ?? []).includes(b.id) ? 'border-ink bg-ink text-surface' : 'border-line bg-surface text-ink-2 hover:border-warm'}`}>
                {(form.branchIds ?? []).includes(b.id) ? '✓' : '+'} {b.name}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="px-6 pb-6 flex gap-3 justify-end border-t border-line pt-4">
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button onClick={handleSave}>{service ? 'Save changes' : 'Add service'}</Button>
      </div>
    </Modal>
  )
}

// ─── Shared helpers ────────────────────────────────────────────────────────────

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <span className="text-sm text-ink-3 flex-shrink-0">{label}</span>
      <span className="text-sm text-ink text-right">{value}</span>
    </div>
  )
}

export function EmptyState({ icon, title, description, action }: { icon: React.ReactNode; title: string; description: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="w-14 h-14 rounded-2xl bg-warm-subtle flex items-center justify-center mb-5 text-ink-3">{icon}</div>
      <p className="font-display text-xl text-ink mb-1">{title}</p>
      <p className="text-ink-3 text-sm mb-5">{description}</p>
      {action}
    </div>
  )
}

function PlusIcon() {
  return <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 5v14M5 12h14"/></svg>
}
function LayersIcon() {
  return <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/></svg>
}
