// src/components/bookings/Modals.tsx

import { useEffect, useMemo, useRef, useState } from 'react'
import type {
  Appointment,
  Branch,
  Customer,
  Service,
  ServiceCategory,
  Staff,
  StaffDetail,
} from '../../types/api'
import { Modal, Input, Textarea, Button, StyledSelect } from '../ui'
import { useToast } from '../ui/Toast'
import { appointmentsApi } from '../../api/appointments.api'
import { availabilityApi, type AvailabilitySlot } from '../../api/availability.api'
import { branchesApi } from '../../api/branches.api'

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

/** Parse HH:mm from an ISO string, no timezone shifting. */
function hhmmFromISO(iso: string): string {
  const m = iso.match(/T(\d{2}:\d{2})/)
  return m ? m[1] : iso.slice(11, 16)
}

/** "09:00" → "9:00 AM". "00:00" → "12:00 AM". "13:05" → "1:05 PM". */
function formatClock(hhmm: string): string {
  const [hStr, mStr] = hhmm.split(':')
  const h = Number(hStr)
  const m = Number(mStr)
  const suffix = h >= 12 ? 'PM' : 'AM'
  const h12 = h % 12 === 0 ? 12 : h % 12
  return `${h12}:${String(m).padStart(2, '0')} ${suffix}`
}

/** "09:00" and "10:00" → "9:00 AM – 10:00 AM". */
function formatRange(startHHmm: string, endHHmm: string): string {
  return `${formatClock(startHHmm)} – ${formatClock(endHHmm)}`
}

/** Today's calendar date (browser-local) as YYYY-MM-DD. */
function todayLocal(): string {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** §9.5 — service actively offered at this branch? */
function serviceOfferedAt(service: Service, branchId: string): boolean {
  if (!branchId) return false
  return (service.branchAssignments ?? []).some(
    a => a.branchId === branchId && a.isActive,
  )
}

/** §8.5 — category actively assigned to this branch? */
function categoryOfferedAt(category: ServiceCategory, branchId: string): boolean {
  if (!branchId) return false
  return (category.branchAssignments ?? []).some(
    a => a.branchId === branchId && a.isActive,
  )
}

/** §12.4 — staff whose home branch matches and who are active. */
function staffAtBranch(staff: Staff[], branchId: string): Staff[] {
  if (!branchId) return []
  return staff.filter(s => s.branchId === branchId && s.status === 'ACTIVE')
}

/** §13.3 — staff actively qualified for the service (unknown = show). */
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
/*  Empty-state reasoning                                              */
/* ------------------------------------------------------------------ */

type EmptyReason =
  | { kind: 'no-branch' }
  | { kind: 'no-services' }
  | { kind: 'no-service-selected' }
  | { kind: 'no-qualified-staff' }
  | { kind: 'branch-closed'; branchName: string; date: string }
  | { kind: 'no-slots'; branchName: string; date: string }
  | { kind: 'loading' }

function describeEmpty(args: {
  branchId: string
  branchName: string
  serviceId: string
  date: string
  servicesForBranch: Service[]
  staffForBranchAndService: Staff[]
  branchIntervals: number
}): EmptyReason {
  if (!args.branchId) return { kind: 'no-branch' }
  if (args.servicesForBranch.length === 0) return { kind: 'no-services' }
  if (!args.serviceId) return { kind: 'no-service-selected' }
  if (args.staffForBranchAndService.length === 0) return { kind: 'no-qualified-staff' }
  if (args.branchIntervals === 0) {
    return {
      kind: 'branch-closed',
      branchName: args.branchName,
      date: args.date,
    }
  }
  return {
    kind: 'no-slots',
    branchName: args.branchName,
    date: args.date,
  }
}

/* ------------------------------------------------------------------ */
/*  Empty-state renderer                                               */
/* ------------------------------------------------------------------ */

function EmptyState({
  reason,
  onOpenBranches,
  onRetry,
}: {
  reason: EmptyReason
  onOpenBranches?: () => void
  onRetry: () => void
}) {
  const base = 'bg-surface rounded-xl border border-line px-4 py-4 flex flex-col gap-2'
  const Title = ({ children }: { children: React.ReactNode }) => (
    <p className="text-sm font-medium text-ink">{children}</p>
  )
  const Body = ({ children }: { children: React.ReactNode }) => (
    <p className="text-xs text-ink-3">{children}</p>
  )

  const Actions = () => (
    <div className="flex gap-3 mt-1">
      {onOpenBranches && (
        <button
          type="button"
          onClick={onOpenBranches}
          className="text-xs text-ink underline hover:no-underline"
        >
          Open Branches
        </button>
      )}
      <button
        type="button"
        onClick={onRetry}
        className="text-xs text-ink-3 hover:text-ink"
      >
        Retry
      </button>
    </div>
  )

  switch (reason.kind) {
    case 'no-branch':
      return (
        <div className={base}>
          <Title>Pick a branch</Title>
          <Body>Select a branch to see available times.</Body>
        </div>
      )
    case 'no-services':
      return (
        <div className={base}>
          <Title>No services offered here</Title>
          <Body>
            This branch has no services assigned. Assign services in the Branches
            page, then come back.
          </Body>
          <Actions />
        </div>
      )
    case 'no-service-selected':
      return (
        <div className={base}>
          <Title>Pick a service</Title>
          <Body>Select a service to see available times.</Body>
        </div>
      )
    case 'no-qualified-staff':
      return (
        <div className={base}>
          <Title>No qualified staff</Title>
          <Body>
            None of this branch's staff are qualified for the selected service.
            Add a qualification in the Staff page, or pick a different service.
          </Body>
        </div>
      )
    case 'branch-closed':
      return (
        <div className={base}>
          <Title>{reason.branchName} is closed on {reason.date}</Title>
          <Body>
            Set the branch's weekly hours or overrides in the Branches page, or
            try a different date.
          </Body>
          <Actions />
        </div>
      )
    case 'no-slots':
      return (
        <div className={base}>
          <Title>Fully booked</Title>
          <Body>
            {reason.branchName} is open on {reason.date}, but no slot fits. All
            qualified staff are either booked, on break, or off that day. Try a
            different date or staff member.
          </Body>
          <Actions />
        </div>
      )
    case 'loading':
      return (
        <div className={base}>
          <Body>Checking availability…</Body>
        </div>
      )
  }
}

/* ------------------------------------------------------------------ */
/*  LockedField                                                        */
/*                                                                     */
/*  A read-only field that visually matches a StyledSelect trigger     */
/*  but is not interactive. Used when a value is pinned by the         */
/*  app-level context (e.g. the branch filter) so the field reads as   */
/*  "locked" rather than "broken".                                     */
/* ------------------------------------------------------------------ */

function LockedField({
  label,
  value,
}: {
  label: string
  value: string
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-sm font-medium text-ink-2">{label}</label>
      <div
        className="
          h-10 px-3 rounded-[10px]
          border border-line bg-bg
          text-sm text-ink
          flex items-center
          cursor-default select-none
        "
        aria-disabled="true"
      >
        <span className="truncate">{value}</span>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  New Booking                                                        */
/* ------------------------------------------------------------------ */

interface NewBookingModalProps {
  open: boolean
  businessId: string
  /** Set when the app-level branch filter is active; hides the branch select. */
  lockedBranchId?: string
  customers: Customer[]
  services: Service[]
  categories: ServiceCategory[]
  staff: Staff[]
  staffDetails: Map<string, StaffDetail>
  branches: Branch[]
  onClose: () => void
  onCreated: (a: Appointment) => void
  onOpenBranches?: () => void
}

export function NewBookingModal({
  open,
  businessId,
  lockedBranchId,
  customers,
  services,
  categories,
  staff,
  staffDetails,
  branches,
  onClose,
  onCreated,
  onOpenBranches,
}: NewBookingModalProps) {
  const toast = useToast()
  const [saving, setSaving] = useState(false)
  const [slots, setSlots] = useState<AvailabilitySlot[]>([])
  const [slotsLoading, setSlotsLoading] = useState(false)
  const [branchIntervals, setBranchIntervals] = useState<number | null>(null)

  const fetchIdRef = useRef(0)

  const [form, setForm] = useState({
    customerId: '',
    categoryId: '',
    serviceId: '',
    staffId: '',
    branchId: lockedBranchId ?? '',
    date: todayLocal(),
    time: '',
    startIso: '',
    bookingSource: 'STAFF' as 'STAFF' | 'PHONE',
    deposit: '',
    notes: '',
  })

  // ── Categories & services scoped to the branch ────────────────────
  const servicesForBranch = useMemo(
    () => services.filter(s => serviceOfferedAt(s, form.branchId)),
    [services, form.branchId],
  )

  const categoriesForBranch = useMemo(() => {
    const serviceCategoryIds = new Set(servicesForBranch.map(s => s.categoryId))
    return categories.filter(
      c => categoryOfferedAt(c, form.branchId) && serviceCategoryIds.has(c.id),
    )
  }, [categories, servicesForBranch, form.branchId])

  const servicesInCategory = useMemo(
    () =>
      form.categoryId
        ? servicesForBranch.filter(s => s.categoryId === form.categoryId)
        : servicesForBranch,
    [servicesForBranch, form.categoryId],
  )

  const staffForBranchAndService = useMemo(() => {
    const byBranch = staffAtBranch(staff, form.branchId)
    return byBranch.filter(m =>
      staffQualifiedFor(m, form.serviceId, staffDetails),
    )
  }, [staff, form.branchId, form.serviceId, staffDetails])

  // ── Seed on open ──────────────────────────────────────────────────
  useEffect(() => {
    if (!open) return
    const validBranchIds = new Set(branches.map(b => b.id))

    const initialBranchId =
      lockedBranchId && validBranchIds.has(lockedBranchId)
        ? lockedBranchId
        : (staff[0]?.branchId && validBranchIds.has(staff[0].branchId)
            ? staff[0].branchId
            : undefined) ??
          branches[0]?.id ??
          ''

    const initialServices = services.filter(s =>
      serviceOfferedAt(s, initialBranchId),
    )
    const initialCategories = new Set(initialServices.map(s => s.categoryId))
    const initialCategoryId =
      categories.find(c => initialCategories.has(c.id))?.id ?? ''
    const initialServicesInCategory = initialCategoryId
      ? initialServices.filter(s => s.categoryId === initialCategoryId)
      : initialServices
    const initialServiceId = initialServicesInCategory[0]?.id ?? ''
    const initialStaff = staffAtBranch(staff, initialBranchId).filter(m =>
      staffQualifiedFor(m, initialServiceId, staffDetails),
    )
    void initialStaff

    setForm({
      customerId: customers[0]?.id ?? '',
      categoryId: initialCategoryId,
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

  // ── Reconcile dependent selects when branch/category/service changes ─
  useEffect(() => {
    setForm(f => {
      let next = f

      if (f.branchId && !branches.some(b => b.id === f.branchId)) {
        next = { ...next, branchId: branches[0]?.id ?? '' }
      }

      if (f.categoryId && !categoriesForBranch.some(c => c.id === f.categoryId)) {
        next = {
          ...next,
          categoryId: categoriesForBranch[0]?.id ?? '',
          serviceId: '',
          staffId: '',
          time: '',
          startIso: '',
        }
      }

      if (f.serviceId && !servicesInCategory.some(s => s.id === f.serviceId)) {
        next = {
          ...next,
          serviceId: servicesInCategory[0]?.id ?? '',
          staffId: '',
          time: '',
          startIso: '',
        }
      }

      const validStaffIds = new Set(staffForBranchAndService.map(s => s.id))
      if (f.staffId && !validStaffIds.has(f.staffId)) {
        next = { ...next, staffId: '', time: '', startIso: '' }
      }

      return next
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [branches, form.branchId, form.categoryId, form.serviceId,
      categoriesForBranch, servicesInCategory, staffForBranchAndService])

  const svc = services.find(s => s.id === form.serviceId) ?? null
  const durationMinutes = svc?.durationMinutes ?? 0

  // ── Slot fetching ─────────────────────────────────────────────────
  useEffect(() => {
    if (!open) return

    if (!form.branchId || !form.serviceId || !form.date) {
      setSlots([])
      setBranchIntervals(null)
      return
    }

    const myFetch = ++fetchIdRef.current
    setSlotsLoading(true)

    ;(async () => {
      try {
        const [availRes, intervalsRes] = await Promise.all([
          availabilityApi.slots(businessId, {
            branchId: form.branchId,
            serviceId: form.serviceId,
            date: form.date,
            staffId: form.staffId || undefined,
            source: 'INTERNAL',
          }),
          branchesApi
            .operatingIntervals(businessId, form.branchId, form.date)
            .catch(() => null),
        ])
        if (myFetch !== fetchIdRef.current) return

        const list = Array.isArray(availRes?.availableSlots)
          ? availRes.availableSlots
          : []
        setSlots(list)
        setBranchIntervals(intervalsRes?.intervals?.length ?? 0)

        setForm(f => {
          if (f.startIso && !list.some(s => s.startTime === f.startIso)) {
            return { ...f, time: '', startIso: '' }
          }
          return f
        })
      } catch (err) {
        if (myFetch !== fetchIdRef.current) return
        console.error('[booking] availability failed', err)
        setSlots([])
        setBranchIntervals(null)
      } finally {
        if (myFetch === fetchIdRef.current) setSlotsLoading(false)
      }
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, businessId, form.branchId, form.serviceId, form.staffId, form.date])

  // ── Option lists ──────────────────────────────────────────────────
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

  const categoryOptions = useMemo(
    () => categoriesForBranch.map(c => ({ value: c.id, label: c.name })),
    [categoriesForBranch],
  )

  const serviceOptions = useMemo(
    () =>
      servicesInCategory.map(s => ({
        value: s.id,
        label: `${s.name} (${s.durationMinutes} min)`,
      })),
    [servicesInCategory],
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
      staffId: f.staffId || (slot.staff[0]?.id ?? ''),
    }))
  }

  async function handleSubmit() {
    if (!svc) { toast.error('Pick a service.'); return }
    if (!form.startIso) { toast.error('Pick a time slot.'); return }
    if (!form.customerId || !form.serviceId || !form.staffId || !form.branchId) {
      toast.error('Pick a customer, service, staff, and branch.'); return
    }

    setSaving(true)
    try {
      const created = await appointmentsApi.createStaffBooking(businessId, {
        branchId: form.branchId,
        customerId: form.customerId,
        serviceId: form.serviceId,
        staffId: form.staffId,
        scheduledStart: new Date(form.startIso).toISOString(),
        bookingSource: form.bookingSource,
        notes: form.notes.trim().slice(0, 1000) || undefined,
      })
      toast.success('Booking created')
      onCreated(created)
      onClose()
    } catch (err) {
      console.error('[booking] create failed', err)
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

  const branchName =
    branches.find(b => b.id === form.branchId)?.name ?? 'This branch'

  const emptyReason: EmptyReason = slotsLoading
    ? { kind: 'loading' }
    : describeEmpty({
        branchId: form.branchId,
        branchName,
        serviceId: form.serviceId,
        date: form.date,
        servicesForBranch,
        staffForBranchAndService,
        branchIntervals: branchIntervals ?? -1,
      })

  return (
    <Modal open={open} onClose={onClose} title="New Booking" width="max-w-xl">
      <div className="px-6 py-5 flex flex-col gap-5">
        <StyledSelect
          label="Customer"
          value={form.customerId}
          placeholder={customers.length === 0 ? 'No customers yet' : 'Select a customer…'}
          options={customerOptions}
          onChange={id => setForm(f => ({ ...f, customerId: id }))}
        />

        <div className="grid grid-cols-2 gap-4">
          {lockedBranchId ? (
            <LockedField label="Branch" value={branchName} />
          ) : (
            <StyledSelect
              label="Branch"
              value={form.branchId}
              placeholder="Select a branch…"
              options={branchOptions}
              onChange={id =>
                setForm(f => ({
                  ...f,
                  branchId: id,
                  categoryId: '',
                  serviceId: '',
                  staffId: '',
                  time: '',
                  startIso: '',
                }))
              }
            />
          )}
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
            label="Category"
            value={form.categoryId}
            placeholder={
              categoriesForBranch.length === 0
                ? 'No categories at this branch'
                : 'Select a category…'
            }
            options={categoryOptions}
            onChange={id =>
              setForm(f => ({
                ...f,
                categoryId: id,
                serviceId: '',
                staffId: '',
                time: '',
                startIso: '',
              }))
            }
            disabled={categoriesForBranch.length === 0}
          />
          <StyledSelect
            label="Service"
            value={form.serviceId}
            placeholder={
              servicesInCategory.length === 0
                ? 'No services in this category'
                : 'Select a service…'
            }
            options={serviceOptions}
            onChange={id =>
              setForm(f => ({
                ...f,
                serviceId: id,
                staffId: '',
                time: '',
                startIso: '',
              }))
            }
            disabled={servicesInCategory.length === 0}
          />
        </div>

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

        {/* Slot picker */}
        <div>
          <label className="text-sm font-medium text-ink-2 block mb-2">
            Available time
          </label>

          {slots.length > 0 ? (
            <div className="flex flex-wrap gap-2 max-h-56 overflow-y-auto pr-1">
              {slots.map(slot => {
                const label = formatRange(
                  hhmmFromISO(slot.startTime),
                  hhmmFromISO(slot.serviceEndTime),
                )
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
          ) : (
            <EmptyState
              reason={emptyReason}
              onOpenBranches={onOpenBranches}
              onRetry={() => setForm(f => ({ ...f }))}
            />
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
                {formatClock(hhmmFromISO(form.startIso))}
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
          disabled={saving || !svc || !form.startIso}
        >
          Create booking
        </Button>
      </div>
    </Modal>
  )
}

/* ------------------------------------------------------------------ */
/*  Walk-in                                                            */
/* ------------------------------------------------------------------ */

interface WalkInModalProps {
  open: boolean
  businessId: string
  /**
   * When set, the branch is fixed by the app-level filter and the
   * dropdown is replaced with a non-interactive display. When unset the
   * user picks a branch from the list.
   */
  lockedBranchId?: string
  branches: Branch[]
  customers: Customer[]
  services: Service[]
  categories: ServiceCategory[]
  staff: Staff[]
  staffDetails: Map<string, StaffDetail>
  onClose: () => void
  onCreated: (a: Appointment) => void
}

export function WalkInModal({
  open,
  businessId,
  lockedBranchId,
  branches,
  customers,
  services,
  categories,
  staff,
  staffDetails,
  onClose,
  onCreated,
}: WalkInModalProps) {
  const toast = useToast()
  const [saving, setSaving] = useState(false)

  const [form, setForm] = useState({
    branchId: lockedBranchId ?? '',
    customerId: '',
    categoryId: '',
    serviceId: '',
    staffId: '',
    notes: '',
  })

  // ── Seed on open ──────────────────────────────────────────────────
  useEffect(() => {
    if (!open) return
    const validBranchIds = new Set(branches.map(b => b.id))

    const initialBranchId =
      lockedBranchId && validBranchIds.has(lockedBranchId)
        ? lockedBranchId
        : branches[0]?.id ?? ''

    const initialServices = services.filter(s =>
      serviceOfferedAt(s, initialBranchId),
    )
    const initialCategoryId = initialServices[0]?.categoryId ?? ''
    const initialServiceId =
      initialServices.find(s => s.categoryId === initialCategoryId)?.id ?? ''

    setForm({
      branchId: initialBranchId,
      customerId: customers[0]?.id ?? '',
      categoryId: initialCategoryId,
      serviceId: initialServiceId,
      staffId: '',
      notes: '',
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, lockedBranchId])

  // ── Branch-scoped service catalog ─────────────────────────────────
  const servicesForBranch = useMemo(
    () => services.filter(s => serviceOfferedAt(s, form.branchId)),
    [services, form.branchId],
  )

  const categoriesForBranch = useMemo(() => {
    const svcCategoryIds = new Set(servicesForBranch.map(s => s.categoryId))
    return categories.filter(
      c => categoryOfferedAt(c, form.branchId) && svcCategoryIds.has(c.id),
    )
  }, [categories, servicesForBranch, form.branchId])

  const servicesInCategory = useMemo(
    () =>
      form.categoryId
        ? servicesForBranch.filter(s => s.categoryId === form.categoryId)
        : servicesForBranch,
    [servicesForBranch, form.categoryId],
  )

  const staffForBranchAndService = useMemo(() => {
    const byBranch = staffAtBranch(staff, form.branchId)
    return byBranch.filter(m =>
      staffQualifiedFor(m, form.serviceId, staffDetails),
    )
  }, [staff, form.branchId, form.serviceId, staffDetails])

  // ── Reconcile dependent selects when branch/category/service changes ─
  useEffect(() => {
    setForm(f => {
      let next = f

      if (f.branchId && !branches.some(b => b.id === f.branchId)) {
        next = { ...next, branchId: branches[0]?.id ?? '' }
      }

      if (f.categoryId && !categoriesForBranch.some(c => c.id === f.categoryId)) {
        next = {
          ...next,
          categoryId: categoriesForBranch[0]?.id ?? '',
          serviceId: '',
          staffId: '',
        }
      }

      if (f.serviceId && !servicesInCategory.some(s => s.id === f.serviceId)) {
        next = {
          ...next,
          serviceId: servicesInCategory[0]?.id ?? '',
          staffId: '',
        }
      }

      const validStaffIds = new Set(staffForBranchAndService.map(s => s.id))
      if (f.staffId && !validStaffIds.has(f.staffId)) {
        next = { ...next, staffId: '' }
      }

      return next
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [branches, form.branchId, form.categoryId, form.serviceId,
      categoriesForBranch, servicesInCategory, staffForBranchAndService])

  const svc = services.find(s => s.id === form.serviceId) ?? null

  const customerOptions = useMemo(
    () => customers.map(c => ({ value: c.id, label: customerName(c) })),
    [customers],
  )

  const branchOptions = useMemo(
    () => branches.map(b => ({ value: b.id, label: b.name })),
    [branches],
  )

  const categoryOptions = useMemo(
    () => categoriesForBranch.map(c => ({ value: c.id, label: c.name })),
    [categoriesForBranch],
  )

  const serviceOptions = useMemo(
    () =>
      servicesInCategory.map(s => ({
        value: s.id,
        label: `${s.name} – ${Number(s.price).toLocaleString()} ETB (${s.durationMinutes} min)`,
      })),
    [servicesInCategory],
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

  async function handleStart() {
    if (!form.branchId) {
      toast.error('Pick a branch.')
      return
    }
    if (!svc) { toast.error('Pick a service.'); return }
    if (!form.customerId || !form.serviceId) {
      toast.error('Pick a customer and service.')
      return
    }

    setSaving(true)
    try {
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

  const branchName =
    branches.find(b => b.id === form.branchId)?.name ?? 'This branch'

  return (
    <Modal open={open} onClose={onClose} title="Walk-in" width="max-w-md">
      <div className="px-6 py-5 flex flex-col gap-5">
        <div className="bg-warm-subtle rounded-xl px-4 py-3">
          <p className="text-sm text-ink-2 leading-relaxed">
            Walk-in appointments start <span className="font-semibold">now</span> and are marked
            as <span className="font-semibold">Checked in</span> by the server.
          </p>
        </div>

        {/* Branch — locked display when the app filter pins a branch,
            otherwise a normal selectable dropdown. */}
        {lockedBranchId ? (
          <LockedField label="Branch" value={branchName} />
        ) : (
          <StyledSelect
            label="Branch"
            value={form.branchId}
            placeholder={
              branches.length === 0 ? 'No branches' : 'Select a branch…'
            }
            options={branchOptions}
            onChange={id =>
              setForm(f => ({
                ...f,
                branchId: id,
                categoryId: '',
                serviceId: '',
                staffId: '',
              }))
            }
            disabled={branches.length === 0}
          />
        )}

        <StyledSelect
          label="Customer"
          value={form.customerId}
          placeholder={customers.length === 0 ? 'No customers yet' : 'Select a customer…'}
          options={customerOptions}
          onChange={id => setForm(f => ({ ...f, customerId: id }))}
        />

        <StyledSelect
          label="Category"
          value={form.categoryId}
          placeholder={
            categoriesForBranch.length === 0
              ? 'No categories at this branch'
              : 'Select a category…'
          }
          options={categoryOptions}
          onChange={id =>
            setForm(f => ({
              ...f,
              categoryId: id,
              serviceId: '',
              staffId: '',
            }))
          }
          disabled={categoriesForBranch.length === 0}
        />

        <StyledSelect
          label="Service"
          value={form.serviceId}
          placeholder={
            servicesInCategory.length === 0
              ? servicesForBranch.length === 0
                ? 'No services offered at this branch'
                : 'No services in this category'
              : 'Select a service…'
          }
          options={serviceOptions}
          onChange={id => setForm(f => ({ ...f, serviceId: id, staffId: '' }))}
          disabled={servicesInCategory.length === 0}
        />

        <StyledSelect
          label="Staff"
          value={form.staffId}
          placeholder={
            staffForBranchAndService.length === 0
              ? 'No qualified staff at this branch'
              : 'Any qualified staff'
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
          disabled={saving || !svc || servicesForBranch.length === 0}
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

  if (Array.isArray(anyErr?.fieldErrors) && anyErr.fieldErrors.length > 0) {
    const f = anyErr.fieldErrors[0]
    const prefix = f.field ? `${f.field}: ` : ''
    return `${prefix}${f.message}`
  }
  if (Array.isArray(anyErr?.details) && anyErr.details.length > 0) {
    const d = anyErr.details[0]
    if (typeof d === 'string') return d
    if (d && typeof d === 'object') {
      const field = d.field ? `${d.field}: ` : ''
      return `${field}${d.message ?? JSON.stringify(d)}`
    }
  }
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