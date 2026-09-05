import { useState } from 'react'
import type { Appointment } from '../../types'
import { Modal, Input, Select, Textarea, Button } from '../ui'
import { customers, staff, services, branches } from '../../data/mock'

// ─── New Booking ───────────────────────────────────────────────────────────────

interface NewBookingModalProps {
  open: boolean
  onClose: () => void
  onAdd: (a: Appointment) => void
}

export function NewBookingModal({ open, onClose, onAdd }: NewBookingModalProps) {
  const [form, setForm] = useState({
    customerId: 'c1',
    serviceId:  'sv1',
    staffId:    's1',
    branchId:   'b1',
    date:       new Date().toISOString().split('T')[0],
    time:       '10:00',
    paymentStatus: 'unpaid' as Appointment['paymentStatus'],
    deposit:    '',
    notes:      '',
  })

  const svc    = services.find(s => s.id === form.serviceId)!
  const cust   = customers.find(c => c.id === form.customerId)!
  const member = staff.find(s => s.id === form.staffId)!
  const branch = branches.find(b => b.id === form.branchId)!

  const slots = ['09:00','09:30','10:00','10:30','11:00','11:30','12:00','13:00','13:30','14:00','14:30','15:00','15:30','16:00','16:30','17:00','17:30']

  function handleSubmit() {
    const appt: Appointment = {
      id:             `a${Date.now()}`,
      customerId:     form.customerId,
      customerName:   cust.name,
      customerPhone:  cust.phone,
      serviceId:      form.serviceId,
      serviceName:    svc.name,
      staffId:        form.staffId,
      staffName:      member.name,
      branchId:       form.branchId,
      branchName:     branch.name,
      date:           form.date,
      startTime:      form.time,
      duration:       svc.duration,
      price:          svc.price,
      deposit:        form.deposit ? Number(form.deposit) : undefined,
      paymentStatus:  form.paymentStatus,
      status:         'confirmed',
      notes:          form.notes || undefined,
    }
    onAdd(appt)
    onClose()
    setForm(f => ({ ...f, notes: '', deposit: '' }))
  }

  return (
    <Modal open={open} onClose={onClose} title="New Booking" width="max-w-xl">
      <div className="px-6 py-5 flex flex-col gap-5">
        {/* Customer */}
        <Select label="Customer" value={form.customerId} onChange={e => setForm(f => ({ ...f, customerId: e.target.value }))}>
          {customers.map(c => <option key={c.id} value={c.id}>{c.name} · {c.phone}</option>)}
        </Select>

        <div className="grid grid-cols-2 gap-4">
          <Select label="Service" value={form.serviceId} onChange={e => setForm(f => ({ ...f, serviceId: e.target.value }))}>
            {services.map(s => <option key={s.id} value={s.id}>{s.name} ({s.duration} min)</option>)}
          </Select>
          <Select label="Staff" value={form.staffId} onChange={e => setForm(f => ({ ...f, staffId: e.target.value }))}>
            {staff.map(s => <option key={s.id} value={s.id}>{s.name} · {s.role}</option>)}
          </Select>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Select label="Branch" value={form.branchId} onChange={e => setForm(f => ({ ...f, branchId: e.target.value }))}>
            {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
          </Select>
          <Input label="Date" type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} />
        </div>

        {/* Time slots */}
        <div>
          <label className="text-sm font-medium text-ink-2 block mb-2">Available time</label>
          <div className="flex flex-wrap gap-2">
            {slots.map(slot => (
              <button key={slot} onClick={() => setForm(f => ({ ...f, time: slot }))}
                className={`px-3 py-1.5 rounded-xl text-sm border transition-all ${
                  form.time === slot
                    ? 'border-ink bg-ink text-surface font-medium'
                    : 'border-line bg-surface text-ink-2 hover:border-warm hover:text-ink'
                }`}>
                {slot}
              </button>
            ))}
          </div>
        </div>

        {/* Price summary */}
        <div className="bg-bg rounded-xl px-4 py-3 flex items-center gap-6">
          <div>
            <p className="text-xs text-ink-3 mb-0.5">Price</p>
            <p className="font-semibold text-ink">{svc?.price.toLocaleString()} ETB</p>
          </div>
          <div>
            <p className="text-xs text-ink-3 mb-0.5">Duration</p>
            <p className="font-semibold text-ink">{svc?.duration} min</p>
          </div>
          <div>
            <p className="text-xs text-ink-3 mb-0.5">End time</p>
            <p className="font-semibold text-ink">
              {(() => {
                const [h, m] = form.time.split(':').map(Number)
                const total = h * 60 + m + (svc?.duration ?? 0)
                return `${String(Math.floor(total/60)).padStart(2,'0')}:${String(total%60).padStart(2,'0')}`
              })()}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Input label="Deposit (ETB)" type="number" placeholder="Optional" value={form.deposit} onChange={e => setForm(f => ({ ...f, deposit: e.target.value }))} />
          <Select label="Payment status" value={form.paymentStatus} onChange={e => setForm(f => ({ ...f, paymentStatus: e.target.value as Appointment['paymentStatus'] }))}>
            <option value="unpaid">Unpaid</option>
            <option value="deposit-paid">Deposit paid</option>
            <option value="paid">Paid in full</option>
          </Select>
        </div>

        <Textarea label="Notes" placeholder="Any special instructions..." value={form.notes} rows={2} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
      </div>

      <div className="px-6 pb-6 flex gap-3 justify-end border-t border-line pt-4">
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button onClick={handleSubmit}>Create booking</Button>
      </div>
    </Modal>
  )
}

// ─── Walk-in ───────────────────────────────────────────────────────────────────

interface WalkInModalProps {
  open: boolean
  onClose: () => void
  onAdd: (a: Appointment) => void
}

export function WalkInModal({ open, onClose, onAdd }: WalkInModalProps) {
  const [form, setForm] = useState({
    customerId:    'c1',
    serviceId:     'sv1',
    staffId:       's1',
    paymentMethod: 'cash',
    notes:         '',
  })

  const svc    = services.find(s => s.id === form.serviceId)!
  const cust   = customers.find(c => c.id === form.customerId)!
  const member = staff.find(s => s.id === form.staffId)!

  function handleStart() {
    const now     = new Date()
    const timeStr = `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`
    const appt: Appointment = {
      id:            `walkin-${Date.now()}`,
      customerId:    form.customerId,
      customerName:  cust.name,
      customerPhone: cust.phone,
      serviceId:     form.serviceId,
      serviceName:   svc.name,
      staffId:       form.staffId,
      staffName:     member.name,
      branchId:      'b1',
      branchName:    'Bole',
      date:          now.toISOString().split('T')[0],
      startTime:     timeStr,
      duration:      svc.duration,
      price:         svc.price,
      paymentStatus: 'unpaid',
      status:        'in-progress',
      notes:         form.notes || undefined,
      isWalkIn:      true,
    }
    onAdd(appt)
    onClose()
    setForm(f => ({ ...f, notes: '' }))
  }

  return (
    <Modal open={open} onClose={onClose} title="Walk-in" width="max-w-md">
      <div className="px-6 py-5 flex flex-col gap-5">
        <div className="bg-warm-subtle rounded-xl px-4 py-3">
          <p className="text-sm text-ink-2 leading-relaxed">
            Walk-in appointments start now and are marked as <span className="font-semibold">In progress</span>.
          </p>
        </div>

        <Select label="Customer" value={form.customerId} onChange={e => setForm(f => ({ ...f, customerId: e.target.value }))}>
          {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </Select>

        <Select label="Service" value={form.serviceId} onChange={e => setForm(f => ({ ...f, serviceId: e.target.value }))}>
          {services.map(s => <option key={s.id} value={s.id}>{s.name} – {s.price.toLocaleString()} ETB ({s.duration} min)</option>)}
        </Select>

        <Select label="Staff" value={form.staffId} onChange={e => setForm(f => ({ ...f, staffId: e.target.value }))}>
          {staff.map(s => <option key={s.id} value={s.id}>{s.name} · {s.role}</option>)}
        </Select>

        <Select label="Payment method" value={form.paymentMethod} onChange={e => setForm(f => ({ ...f, paymentMethod: e.target.value }))}>
          <option value="cash">Cash</option>
          <option value="card">Card</option>
          <option value="transfer">Bank transfer</option>
          <option value="later">Pay later</option>
        </Select>

        <Textarea label="Notes" placeholder="Any special requests..." value={form.notes} rows={2} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />

        <div className="flex items-center justify-between py-3 border-t border-line -mx-0">
          <span className="text-sm text-ink-3">Total</span>
          <span className="text-xl font-semibold text-ink">{svc?.price.toLocaleString()} ETB</span>
        </div>
      </div>

      <div className="px-6 pb-6 flex gap-3 justify-end border-t border-line pt-4">
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button onClick={handleStart}>Start appointment</Button>
      </div>
    </Modal>
  )
}
