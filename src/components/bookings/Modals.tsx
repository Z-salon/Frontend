// src/components/bookings/Modals.tsx

import { useEffect, useMemo, useState } from 'react'
import type {
  Appointment,
  Branch,
  Customer,
  Service,
  Staff,
  StaffDetail,
} from '../../types/api'
import { Modal, Input, Textarea, Button, StyledSelect } from '../ui'
import { useToast } from '../ui/Toast'
import { appointmentsApi } from '../../api/appointments.api'
import { availabilityApi, type AvailabilitySlot } from '../../api/availability.api'

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function customerName(c: Customer): string {
  return `${c.firstName} ${c.lastName}`.trim()
}

function primaryPhone(c: Customer): string {
  const phones = c.phones ?? []
  return (phones.find(p => p.isPrimary) ?? phones[0])?.phone ?? ''
}

function staffName(s: Staff): string {
  return `${s.firstName} ${s.lastName}`.trim()
}

/** Extract HH:mm from an ISO string without shifting the wall clock. */
function hhmmFromISO(iso: string): string {
  // The server returns slot times with the branch's offset already applied,
  // so we can slice the wall-clock portion safely: "2026-09-24T09:00:00.000+03:00"
  const m = iso.match(/T(\d{2}:\d{2})/)
  return m ? m[1] : iso.slice(11, 16)
}

/**
 * Combine a YYYY-MM-DD date and an HH:mm time into a full ISO string
 * in UTC (`...Z`) — the form Zod's `z.string().datetime()` accepts.
 * Interprets the input as Addis Ababa wall-clock (+03:00).
 */
function toBranchISO(date: string, time: string): string {
  const [y, mo, d] = date.split('-').map(Number)
  const [h, mi] = time.split(':').map(Number)
  const utcMillis = Date.UTC(y, mo - 1, d, h - 3, mi, 0, 0)
  return new Date(utcMillis).toISOString()
}

/** Today's calendar date (browser-local), as YYYY-MM-DD. */
function todayLocal(): string {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** §9.5 — service offered at this branch? */
function serviceOfferedAt(service: Service, branchId: string): boolean {
  if (!branchId) return false
  return (service.branchAssignments ?? []).some(
    a => a.branchId === branchId && a.isActive,
  )
}

/** §12.4 — staff whose home branch matches and who are active. */
function staffAtBranch(staff: Staff[], branchId: string): Staff[] {
  if (!branchId) return []
  return staff.filter(s => s.branchId === branchId && s.status === 'ACTIVE')
}

/**
 * §13.3 — staff member actively qualified for this service?
 * If we don't have the detail row, err on the side of showing them.
 */
function staffQualifiedFor(
  member: Staff,
  serviceId: string,
  details: Map<string, StaffDetail>,
): boolean {
  const detail = details.get(member.id)
  if (!detail) return true
  if (!serviceId) return true
  return detail.serviceQualifications.some(
    q => q.serviceId === serviceId && q.isActive,
  )
}

/* ------------------------------------------------------------------ */
/*  New Booking                                                        */
/* ------------------------------------------------------------------ */

interface NewBookingModalProps {
  open: boolean
  businessId: string
  customers: Customer[]
  services: Service[]
  staff: Staff[]
  staffDetails: Map<string, StaffDetail>
  branches: Branch[]
  onClose: () => void
  onCreated: (a: Appointment) => void
}

export function NewBookingModal({
  open,
  businessId,
  customers,
  services,
  staff,
  staffDetails,
  branches,
  onClose,
  onCreated,
}: NewBookingModalProps) {
  const toast = useToast()
  const [saving, setSaving] = useState(false)
  const [slots, setSlots] = useState<AvailabilitySlot[]>([])
  const [slotsLoading, setSlotsLoading] = useState(false)

  const [form, setForm] = useState({
    customerId: '',
    serviceId: '',
    staffId: '',           // '' = let server return slots across all eligible staff
    branchId: '',
    date: todayLocal(),
    time: '',              // HH:mm picked from a slot
    startIso: '',          // full ISO from the picked slot
    bookingSource: 'STAFF' as 'STAFF' | 'PHONE',
    deposit: '',
    notes: '',
  })

  // Seed once per open.
  useEffect(() => {
    if (!open) return
    const initialBranchId = staff[0]?.branchId ?? branches[0]?.id ?? ''
    const initialServices = services.filter(s =>
      serviceOfferedAt(s, initialBranchId),
    )
    const initialServiceId = initialServices[0]?.id ?? ''

    setForm({
      customerId: customers[0]?.id ?? '',
      serviceId: initialServiceId,
      staffId: '',
      branchId: initialBranchId,
      date: todayLocal(),
      time: '',
      startIso: '',
      bookingSource: 'STAFF',
      deposit: '',
      notes: '',
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const servicesForBranch = useMemo(
    () => services.filter(s => serviceOfferedAt(s, form.branchId)),
    [services, form.branchId],
  )

  const staffForBranchAndService = useMemo(() => {
    const byBranch = staffAtBranch(staff, form.branchId)
    return byBranch.filter(m =>
      staffQualifiedFor(m, form.serviceId, staffDetails),
    )
  }, [staff, form.branchId, form.serviceId, staffDetails])

  // Reconcile selections when branch or service changes.
  useEffect(() => {
    setForm(f => {
      let next = f
      if (f.serviceId && !servicesForBranch.some(s => s.id === f.serviceId)) {
        next = { ...next, serviceId: servicesForBranch[0]?.id ?? '' }
      }
      const validStaffIds = new Set(staffForBranchAndService.map(s => s.id))
      if (f.staffId && !validStaffIds.has(f.staffId)) {
        next = { ...next, staffId: '' }
      }
      return next
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.branchId, form.serviceId, servicesForBranch, staffForBranchAndService])

  const svc = services.find(s => s.id === form.serviceId) ?? null
  const durationMinutes = svc?.durationMinutes ?? 0

  // ── Slot fetching ────────────────────────────────────────────────
  useEffect(() => {
    if (!open) return
    if (!form.branchId || !form.serviceId || !form.date) {
      setSlots([])
      return
    }

    let cancelled = false
    setSlotsLoading(true)

    ;(async () => {
      try {
        const res = await availabilityApi.slots(businessId, {
          branchId: form.branchId,
          serviceId: form.serviceId,
          date: form.date,
          // Only filter by staff when the user has explicitly chosen one.
          staffId: form.staffId || undefined,
          source: 'INTERNAL',   // staff-booking uses INTERNAL (§5.2)
        })
        if (cancelled) return
        const list = Array.isArray(res?.availableSlots) ? res.availableSlots : []
        setSlots(list)

        // Reset the picked slot if it's no longer available.
        setForm(f => {
          if (f.startIso && !list.some(s => s.startTime === f.startIso)) {
            return { ...f, time: '', startIso: '' }
          }
          return f
        })
      } catch (err) {
        if (cancelled) return
        console.error('[booking] availability failed', err)
        setSlots([])
      } finally {
        if (!cancelled) setSlotsLoading(false)
      }
    })()

    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, businessId, form.branchId, form.serviceId, form.staffId, form.date])

  const customerOptions = useMemo(
    () =>
      customers.map(c => ({
        value: c.id,
        label:
          customerName(c) +
          (primaryPhone(c) ? ` · ${primaryPhone(c)}` : ''),
      })),
    [customers],
  )

  const serviceOptions = useMemo(
    () =>
      servicesForBranch.map(s => ({
        value: s.id,
        label: `${s.name} (${s.durationMinutes} min)`,
      })),
    [servicesForBranch],
  )

  const staffOptions = useMemo(
    () => [
      { value: '', label: 'Any qualified staff' },
      ...staffForBranchAndService.map(s => ({
        value: s.id,
        label: staffName(s) + (s.title ? ` · ${s.title}` : ''),
      })),
    ],
    [staffForBranchAndService],
  )

  const branchOptions = useMemo(
    () => branches.map(b => ({ value: b.id, label: b.name })),
    [branches],
  )

  function pickSlot(slot: AvailabilitySlot) {
    setForm(f => ({
      ...f,
      time: hhmmFromISO(slot.startTime),
      startIso: slot.startTime,
      // If the user hadn't picked a staff member and the slot narrows it to
      // one staff, adopt that staff automatically — less friction.
      staffId: f.staffId || (slot.staff[0]?.id ?? ''),
    }))
  }

  async function handleSubmit() {
    if (!svc) {
      toast.error('Pick a service.')
      return
    }
    if (!form.startIso) {
      toast.error('Pick a time slot.')
      return
    }
    if (!form.customerId || !form.serviceId || !form.staffId || !form.branchId) {
      toast.error('Pick a customer, service, staff, and branch.')
      return
    }

    setSaving(true)
    try {
      const created = await appointmentsApi.createStaffBooking(businessId, {
        branchId: form.branchId,
        customerId: form.customerId,
        serviceId: form.serviceId,
        staffId: form.staffId,
        // The slot's startTime is already a full ISO string from the server.
        // The schema (per our tests) requires a UTC `Z` form — convert here
        // without shifting the instant: `new Date(iso).toISOString()`.
        scheduledStart: new Date(form.startIso).toISOString(),
        bookingSource: form.bookingSource,
        notes: form.notes.trim().slice(0, 1000) || undefined,
      })
      toast.success('Booking created')
      onCreated(created)
      onClose()
    } catch (err) {
      console.error('[booking] create failed', err)
      console.error('[booking] fieldErrors', (err as any)?.fieldErrors)
      const first = (err as any)?.fieldErrors?.[0]
      toast.error(
        first
          ? `${first.field}: ${first.message}`
          : extractErrorMessage(err, 'Could not create the booking.'),
      )
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="New Booking" width="max-w-xl">
      <div className="px-6 py-5 flex flex-col gap-5">
        <StyledSelect
          label="Customer"
          value={form.customerId}
          placeholder={
            customers.length === 0 ? 'No customers yet' : 'Select a customer…'
          }
          options={customerOptions}
          onChange={id => setForm(f => ({ ...f, customerId: id }))}
        />

        <div className="grid grid-cols-2 gap-4">
          <StyledSelect
            label="Branch"
            value={form.branchId}
            placeholder="Select a branch…"
            options={branchOptions}
            onChange={id =>
              setForm(f => ({ ...f, branchId: id, time: '', startIso: '' }))
            }
          />
          <Input
            label="Date"
            type="date"
            value={form.date}
            onChange={e =>
              setForm(f => ({ ...f, date: e.target.value, time: '', startIso: '' }))
            }
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <StyledSelect
            label="Service"
            value={form.serviceId}
            placeholder={
              servicesForBranch.length === 0
                ? 'No services offered at this branch'
                : 'Select a service…'
            }
            options={serviceOptions}
            onChange={id =>
              setForm(f => ({ ...f, serviceId: id, time: '', startIso: '' }))
            }
            disabled={servicesForBranch.length === 0}
          />
          <StyledSelect
            label="Staff"
            value={form.staffId}
            placeholder="Any qualified staff"
            options={staffOptions}
            onChange={id =>
              setForm(f => ({ ...f, staffId: id, time: '', startIso: '' }))
            }
            disabled={staffForBranchAndService.length === 0}
          />
        </div>

        {/* Slot picker */}
        <div>
          <label className="text-sm font-medium text-ink-2 block mb-2">
            Available time
          </label>

          {slotsLoading ? (
            <p className="text-sm text-ink-3 py-4">Checking availability…</p>
          ) : slots.length === 0 ? (
            <div className="bg-surface rounded-xl border border-line px-4 py-4">
              <p className="text-sm text-ink-3">
                No slots available for this branch, service, and date.
                Try another date or adjust the branch/service.
              </p>
            </div>
          ) : (
            <div className="flex flex-wrap gap-2 max-h-56 overflow-y-auto pr-1">
              {slots.map(slot => {
                const label = `${hhmmFromISO(slot.startTime)} – ${hhmmFromISO(slot.serviceEndTime)}`
                const selected = form.startIso === slot.startTime
                const staffNames = slot.staff
                  .map(s => `${s.firstName} ${s.lastName}`)
                  .join(', ')
                return (
                  <button
                    key={slot.startTime}
                    type="button"
                    title={staffNames ? `Staff: ${staffNames}` : undefined}
                    onClick={() => pickSlot(slot)}
                    className={`px-3 py-1.5 rounded-xl text-xs border transition-all ${
                      selected
                        ? 'border-ink bg-ink text-surface font-medium'
                        : 'border-line bg-surface text-ink-2 hover:border-warm hover:text-ink'
                    }`}
                  >
                    {label}
                  </button>
                )
              })}
            </div>
          )}
        </div>

        {/* Source */}
        <div>
          <label className="text-sm font-medium text-ink-2 block mb-2">Source</label>
          <div className="flex gap-2">
            {(['STAFF', 'PHONE'] as const).map(src => (
              <button
                key={src}
                type="button"
                onClick={() => setForm(f => ({ ...f, bookingSource: src }))}
                className={`px-3 py-1.5 rounded-xl text-xs border transition-all ${
                  form.bookingSource === src
                    ? 'border-ink bg-ink text-surface font-medium'
                    : 'border-line bg-surface text-ink-2 hover:border-warm hover:text-ink'
                }`}
              >
                {src === 'STAFF' ? 'Front desk' : 'Phone'}
              </button>
            ))}
          </div>
        </div>

        <Input
          label="Deposit (ETB, optional)"
          type="number"
          placeholder="—"
          value={form.deposit}
          onChange={e => setForm(f => ({ ...f, deposit: e.target.value }))}
        />

        {/* Price summary */}
        {svc && form.startIso && (
          <div className="bg-bg rounded-xl px-4 py-3 flex items-center gap-6">
            <div>
              <p className="text-xs text-ink-3 mb-0.5">Price</p>
              <p className="font-semibold text-ink">
                {Number(svc.price).toLocaleString()} ETB
              </p>
            </div>
            <div>
              <p className="text-xs text-ink-3 mb-0.5">Duration</p>
              <p className="font-semibold text-ink">{durationMinutes} min</p>
            </div>
            <div>
              <p className="text-xs text-ink-3 mb-0.5">Time</p>
              <p className="font-semibold text-ink">
                {hhmmFromISO(form.startIso)}
              </p>
            </div>
          </div>
        )}

        <Textarea
          label="Notes"
          placeholder="Any special instructions..."
          value={form.notes}
          rows={2}
          onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
        />
      </div>

      <div className="px-6 pb-6 flex gap-3 justify-end border-t border-line pt-4">
        <Button variant="ghost" onClick={onClose} disabled={saving}>
          Cancel
        </Button>
        <Button
          onClick={handleSubmit}
          loading={saving}
          disabled={
            saving ||
            !svc ||
            !form.startIso ||
            servicesForBranch.length === 0 ||
            staffForBranchAndService.length === 0
          }
        >
          Create booking
        </Button>
      </div>
    </Modal>
  )
}

/* ------------------------------------------------------------------ */
/*  Walk-in — unchanged except for the ISO fix on `buildISO`           */
/* ------------------------------------------------------------------ */

interface WalkInModalProps {
  open: boolean
  businessId: string
  customers: Customer[]
  services: Service[]
  staff: Staff[]
  staffDetails: Map<string, StaffDetail>
  defaultBranchId: string
  onClose: () => void
  onCreated: (a: Appointment) => void
}

export function WalkInModal({
  open,
  businessId,
  customers,
  services,
  staff,
  staffDetails,
  defaultBranchId,
  onClose,
  onCreated,
}: WalkInModalProps) {
  const toast = useToast()
  const [saving, setSaving] = useState(false)

  const [form, setForm] = useState({
    customerId: '',
    serviceId: '',
    staffId: '',
    branchId: defaultBranchId,
    notes: '',
  })

  useEffect(() => {
    if (!open) return
    const initialServices = services.filter(s =>
      serviceOfferedAt(s, defaultBranchId),
    )
    const initialServiceId = initialServices[0]?.id ?? ''
    const initialStaff = staffAtBranch(staff, defaultBranchId).filter(m =>
      staffQualifiedFor(m, initialServiceId, staffDetails),
    )

    setForm({
      customerId: customers[0]?.id ?? '',
      serviceId: initialServiceId,
      staffId: initialStaff[0]?.id ?? '',
      branchId: defaultBranchId,
      notes: '',
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, defaultBranchId])

  const servicesForBranch = useMemo(
    () => services.filter(s => serviceOfferedAt(s, form.branchId)),
    [services, form.branchId],
  )

  const staffForBranchAndService = useMemo(() => {
    const byBranch = staffAtBranch(staff, form.branchId)
    return byBranch.filter(m =>
      staffQualifiedFor(m, form.serviceId, staffDetails),
    )
  }, [staff, form.branchId, form.serviceId, staffDetails])

  useEffect(() => {
    setForm(f => {
      let next = f
      if (f.serviceId && !servicesForBranch.some(s => s.id === f.serviceId)) {
        next = { ...next, serviceId: servicesForBranch[0]?.id ?? '' }
      }
      const validStaffIds = new Set(staffForBranchAndService.map(s => s.id))
      if (f.staffId && !validStaffIds.has(f.staffId)) {
        next = { ...next, staffId: staffForBranchAndService[0]?.id ?? '' }
      }
      return next
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.serviceId, servicesForBranch, staffForBranchAndService])

  const svc = services.find(s => s.id === form.serviceId) ?? null

  const customerOptions = useMemo(
    () => customers.map(c => ({ value: c.id, label: customerName(c) })),
    [customers],
  )

  const serviceOptions = useMemo(
    () =>
      servicesForBranch.map(s => ({
        value: s.id,
        label: `${s.name} – ${Number(s.price).toLocaleString()} ETB (${s.durationMinutes} min)`,
      })),
    [servicesForBranch],
  )

  const staffOptions = useMemo(
    () =>
      staffForBranchAndService.map(s => ({
        value: s.id,
        label: staffName(s) + (s.title ? ` · ${s.title}` : ''),
      })),
    [staffForBranchAndService],
  )

  async function handleStart() {
    if (!svc) {
      toast.error('Pick a service.')
      return
    }
    if (servicesForBranch.length === 0) {
      toast.error('No services are offered at this branch.')
      return
    }
    if (staffForBranchAndService.length === 0) {
      toast.error('No qualified staff for this service at this branch.')
      return
    }
    if (!form.customerId || !form.serviceId || !form.staffId || !form.branchId) {
      toast.error('Pick a customer, service, staff, and branch.')
      return
    }

    setSaving(true)
    try {
      // Walk-in has no scheduledStart — the server uses "now" in the branch
      // timezone (guide §5.1). The walk-in validation runs with source=INTERNAL,
      // so even outside nominal hours it typically succeeds.
      const created = await appointmentsApi.createWalkIn(businessId, {
        branchId: form.branchId,
        customerId: form.customerId,
        serviceId: form.serviceId,
        staffId: form.staffId,
        notes: form.notes.trim().slice(0, 1000) || undefined,
      })
      toast.success('Walk-in started')
      onCreated(created)
      onClose()
    } catch (err) {
      console.error('[walk-in] create failed', err)
      console.error('[walk-in] fieldErrors', (err as any)?.fieldErrors)
      const first = (err as any)?.fieldErrors?.[0]
      toast.error(
        first
          ? `${first.field}: ${first.message}`
          : extractErrorMessage(err, 'Could not start the walk-in.'),
      )
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Walk-in" width="max-w-md">
      <div className="px-6 py-5 flex flex-col gap-5">
        <div className="bg-warm-subtle rounded-xl px-4 py-3">
          <p className="text-sm text-ink-2 leading-relaxed">
            Walk-in appointments start <span className="font-semibold">now</span> and are marked
            as <span className="font-semibold">Checked in</span> by the server.
          </p>
        </div>

        <StyledSelect
          label="Customer"
          value={form.customerId}
          placeholder={
            customers.length === 0 ? 'No customers yet' : 'Select a customer…'
          }
          options={customerOptions}
          onChange={id => setForm(f => ({ ...f, customerId: id }))}
        />

        <StyledSelect
          label="Service"
          value={form.serviceId}
          placeholder={
            servicesForBranch.length === 0
              ? 'No services offered at this branch'
              : 'Select a service…'
          }
          options={serviceOptions}
          onChange={id => setForm(f => ({ ...f, serviceId: id }))}
          disabled={servicesForBranch.length === 0}
        />

        <StyledSelect
          label="Staff"
          value={form.staffId}
          placeholder={
            staffForBranchAndService.length === 0
              ? 'No qualified staff at this branch'
              : 'Select a staff member…'
          }
          options={staffOptions}
          onChange={id => setForm(f => ({ ...f, staffId: id }))}
          disabled={staffForBranchAndService.length === 0}
        />

        <Textarea
          label="Notes"
          placeholder="Any special requests..."
          value={form.notes}
          rows={2}
          onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
        />

        <div className="flex items-center justify-between py-3 border-t border-line">
          <span className="text-sm text-ink-3">Total</span>
          <span className="text-xl font-semibold text-ink">
            {svc ? `${Number(svc.price).toLocaleString()} ETB` : '—'}
          </span>
        </div>
      </div>

      <div className="px-6 pb-6 flex gap-3 justify-end border-t border-line pt-4">
        <Button variant="ghost" onClick={onClose} disabled={saving}>
          Cancel
        </Button>
        <Button
          onClick={handleStart}
          loading={saving}
          disabled={
            saving ||
            !svc ||
            servicesForBranch.length === 0 ||
            staffForBranchAndService.length === 0
          }
        >
          Start appointment
        </Button>
      </div>
    </Modal>
  )
}

/* ------------------------------------------------------------------ */
/*  Error helper                                                       */
/* ------------------------------------------------------------------ */

function extractErrorMessage(err: unknown, fallback = 'Something went wrong.'): string {
  if (!err) return fallback
  const anyErr = err as any

  // ApiError.fieldErrors — canonical shape from normalizeError
  if (Array.isArray(anyErr?.fieldErrors) && anyErr.fieldErrors.length > 0) {
    const f = anyErr.fieldErrors[0]
    const prefix = f.field ? `${f.field}: ` : ''
    return `${prefix}${f.message}`
  }

  // ApiError.details — non-array object details (rare)
  if (
    anyErr?.details &&
    typeof anyErr.details === 'object' &&
    !Array.isArray(anyErr.details)
  ) {
    const d = anyErr.details as Record<string, unknown>
    if (typeof d.message === 'string') return d.message
  }

  // Raw server response (if it ever leaks through)
  const data = anyErr?.response?.data ?? anyErr?.data ?? anyErr
  if (Array.isArray(data?.errors) && data.errors.length > 0) {
    return String(data.errors[0])
  }
  if (Array.isArray(data?.details) && data.details.length > 0) {
    const d = data.details[0]
    if (typeof d === 'string') return d
    if (d && typeof d === 'object') {
      const field = d.field ? `${d.field}: ` : ''
      return `${field}${d.message ?? JSON.stringify(d)}`
    }
  }

  if (typeof data?.message === 'string' && data.message) return data.message
  if (typeof anyErr?.message === 'string' && anyErr.message) return anyErr.message
  return fallback
}