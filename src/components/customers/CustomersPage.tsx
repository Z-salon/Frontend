// src/components/customers/CustomersPage.tsx

import { useEffect, useMemo, useState } from 'react'
import type { Customer } from '../../types/api'
import type { Appointment, FeedbackItem } from '../../types'
import { Button, Input, Textarea, Modal, Avatar } from '../ui'
import { EmptyState } from '../services/ServicesPage'
import { useToast } from '../ui/Toast'
import { useBusiness } from '../../contexts/BusinessContext'
import { customersApi } from '../../api/customers.api'

/* ------------------------------------------------------------------ */
/*  Phone normalization                                                */
/* ------------------------------------------------------------------ */

function normalizePhone(raw: string): string | null {
  const cleaned = raw.replace(/[\s\-()]/g, '')
  if (!cleaned) return null

  if (cleaned.startsWith('+')) {
    return /^\+[1-9]\d{1,14}$/.test(cleaned) ? cleaned : null
  }
  if (/^251[79]\d{8}$/.test(cleaned)) return `+${cleaned}`
  if (/^0[79]\d{8}$/.test(cleaned))   return `+251${cleaned.slice(1)}`
  return null
}

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */

interface CustomersPageProps {
  appointments: Appointment[]
  feedback: FeedbackItem[]
}

export function CustomersPage({ appointments, feedback }: CustomersPageProps) {
  const toast = useToast()
  const { activeBusinessId } = useBusiness()

  const [customers, setCustomers] = useState<Customer[]>([])
  const [loading,   setLoading]   = useState(false)
  const [search,    setSearch]    = useState('')

  const [selectedId,     setSelectedId]     = useState<string | null>(null)
  const [selectedDetail, setSelectedDetail] = useState<Customer | null>(null)
  const [detailLoading,  setDetailLoading]  = useState(false)

  const [activeTab, setActiveTab] =
    useState<'overview' | 'appointments' | 'feedback' | 'notes'>('overview')
  const [showModal, setShowModal] = useState(false)

  /* ---------------------------------------------------------------- */
  /*  Data loading                                                    */
  /* ---------------------------------------------------------------- */

  async function refresh() {
    if (!activeBusinessId) return
    setLoading(true)
    try {
      const list = await customersApi.list(activeBusinessId, {
        q: search.trim() || undefined,
        limit: 100,
      })
      setCustomers(normalizeArray<Customer>(list))
    } catch (err) {
      console.error('[customers] load failed', err)
      toast.error(extractErrorMessage(err, 'Could not load customers.'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const t = setTimeout(() => { void refresh() }, search ? 300 : 0)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeBusinessId, search])

  async function loadDetail(id: string) {
    setDetailLoading(true)
    try {
      const c = await customersApi.get(id)
      setSelectedDetail(c)
    } catch (err) {
      console.error('[customers] detail load failed', err)
      toast.error(extractErrorMessage(err, 'Could not load customer details.'))
    } finally {
      setDetailLoading(false)
    }
  }

  function openDetail(c: Customer) {
    setSelectedId(c.id)
    setSelectedDetail(c)
    setActiveTab('overview')
    void loadDetail(c.id)
  }

  function closeDetail() {
    setSelectedId(null)
    setSelectedDetail(null)
  }

  /* ---------------------------------------------------------------- */
  /*  Actions                                                         */
  /* ---------------------------------------------------------------- */

  async function handleCreate(input: {
    firstName: string
    lastName: string
    phone: string
  }) {
    if (!activeBusinessId) return

    const phone = normalizePhone(input.phone)
    if (!phone) {
      toast.error('Phone must be +251911223344 or 0911223344')
      return
    }

    try {
      const created = await customersApi.create(activeBusinessId, {
        firstName: input.firstName.trim(),
        lastName:  input.lastName.trim(),
        phones:    [{ phone, isPrimary: true }],
      })
      setCustomers(prev => [created, ...prev])
      setShowModal(false)
      toast.success('Customer added')
      void refresh()
    } catch (err) {
      console.error('[customers] create failed', err)
      console.error('[customers] err.details', (err as any)?.details)
      console.error('[customers] err.response?.data', (err as any)?.response?.data)
      toast.error(extractErrorMessage(err, 'Could not add the customer.'))
    }
  }

  async function saveNotes(_notes: string) {
    if (!selectedDetail) return
    toast.success('Saved locally only — server-side notes are not yet supported.')
  }

  /* ---------------------------------------------------------------- */
  /*  Derived                                                         */
  /* ---------------------------------------------------------------- */

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return customers
    return customers.filter(c => {
      const name = `${c.firstName} ${c.lastName}`.toLowerCase()
      const phones = (c.phones ?? []).map(p => p.phone).join(' ')
      return name.includes(q) || phones.includes(q)
    })
  }, [customers, search])

  const statsFor = useMemo(() => {
    const byCustomer = new Map<string, {
      visitCount: number
      totalSpent: number
      lastVisit: string | null
      upcoming: Appointment | null
    }>()
    for (const a of appointments) {
      const entry = byCustomer.get(a.customerId) ?? {
        visitCount: 0,
        totalSpent: 0,
        lastVisit: null,
        upcoming: null,
      }
      const isCompleted = a.status === 'completed'
      const isUpcoming =
        a.date >= new Date().toISOString().split('T')[0] &&
        a.status !== 'cancelled' &&
        a.status !== 'no-show'

      if (isCompleted) {
        entry.visitCount += 1
        entry.totalSpent += Number(a.price) || 0
        if (!entry.lastVisit || a.date > entry.lastVisit) entry.lastVisit = a.date
      }
      if (isUpcoming && !entry.upcoming) entry.upcoming = a
      byCustomer.set(a.customerId, entry)
    }
    return byCustomer
  }, [appointments])

  /* ---------------------------------------------------------------- */
  /*  Render — detail view                                            */
  /* ---------------------------------------------------------------- */

  if (selectedDetail) {
    const stat = statsFor.get(selectedDetail.id)
    const custAppts = appointments
      .filter(a => a.customerId === selectedDetail.id)
      .sort((a, b) => b.date.localeCompare(a.date))
    const custFb = feedback.filter(f => f.customerId === selectedDetail.id)

    const displayName = `${selectedDetail.firstName} ${selectedDetail.lastName}`.trim()
    const primaryPhone = primaryPhoneOf(selectedDetail)

    return (
      <div className="flex flex-col h-full overflow-hidden">
        <div className="px-4 sm:px-6 lg:px-8 py-4 sm:py-5 bg-surface border-b border-line flex-shrink-0">
          <button
            onClick={closeDetail}
            className="flex items-center gap-2 text-sm text-ink-3 hover:text-ink transition-colors mb-5"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M15 18l-6-6 6-6" />
            </svg>
            All customers
          </button>

          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-4 min-w-0">
              <Avatar name={displayName} size="lg" />
              <div className="min-w-0">
                <div className="flex items-center gap-2.5 flex-wrap">
                  <h2 className="font-display text-xl sm:text-2xl text-ink truncate">{displayName}</h2>
                  {selectedDetail.status === 'ARCHIVED' && (
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-line text-ink-3 font-medium flex-shrink-0">
                      Archived
                    </span>
                  )}
                </div>
                <p className="text-ink-3 text-sm mt-0.5 truncate">{primaryPhone ?? '—'}</p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-4 sm:gap-6 mt-5 pt-5 border-t border-line overflow-x-auto">
            <Stat label="Visits"      value={String(stat?.visitCount ?? 0)} />
            <div className="w-px h-8 bg-line flex-shrink-0" />
            <Stat label="Total spent" value={`${(stat?.totalSpent ?? 0).toLocaleString()} ETB`} />
            <div className="w-px h-8 bg-line flex-shrink-0" />
            <Stat label="Outstanding" value="—" />
            <div className="w-px h-8 bg-line flex-shrink-0" />
            <Stat label="Last visit"  value={stat?.lastVisit ?? 'Never'} />
          </div>

          <div className="flex gap-1 mt-5 overflow-x-auto">
            {(['overview', 'appointments', 'feedback', 'notes'] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`h-8 px-4 text-xs font-medium rounded-xl transition-colors capitalize whitespace-nowrap ${
                  activeTab === tab
                    ? 'bg-ink text-surface'
                    : 'text-ink-3 hover:text-ink hover:bg-warm-subtle'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-4 sm:px-6 lg:px-8 py-5 sm:py-6">
          {detailLoading && (
            <p className="text-xs text-ink-3 mb-4">Refreshing…</p>
          )}

          {activeTab === 'overview' && (
            <div className="max-w-2xl flex flex-col gap-4">
              {stat?.upcoming && (
                <div className="bg-surface rounded-2xl border border-line p-5">
                  <p className="text-[10px] font-semibold text-ink-3 uppercase tracking-wider mb-3">
                    Upcoming appointment
                  </p>
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-medium text-ink truncate">{stat.upcoming.serviceName}</p>
                      <p className="text-sm text-ink-3 mt-0.5 truncate">
                        {stat.upcoming.date} · {stat.upcoming.startTime} · {stat.upcoming.branchName}
                      </p>
                    </div>
                    <span className="text-sm font-semibold text-ink flex-shrink-0">
                      {Number(stat.upcoming.price).toLocaleString()} ETB
                    </span>
                  </div>
                </div>
              )}
              {custAppts.length > 0 && (
                <div className="bg-surface rounded-2xl border border-line p-5">
                  <p className="text-[10px] font-semibold text-ink-3 uppercase tracking-wider mb-3">
                    Last visit
                  </p>
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-medium text-ink truncate">{custAppts[0].serviceName}</p>
                      <p className="text-sm text-ink-3 mt-0.5 truncate">
                        {custAppts[0].date} · {custAppts[0].staffName} · {custAppts[0].branchName}
                      </p>
                    </div>
                    <span className="text-sm font-semibold text-ink flex-shrink-0">
                      {Number(custAppts[0].price).toLocaleString()} ETB
                    </span>
                  </div>
                </div>
              )}
              {!stat?.upcoming && custAppts.length === 0 && (
                <p className="text-sm text-ink-3 py-10 text-center">
                  No appointment history yet.
                </p>
              )}
            </div>
          )}

          {activeTab === 'appointments' && (
            <div className="max-w-2xl flex flex-col gap-2">
              {custAppts.length === 0 ? (
                <p className="text-sm text-ink-3 py-10 text-center">No appointments yet.</p>
              ) : (
                custAppts.map(a => (
                  <div
                    key={a.id}
                    className="bg-surface rounded-xl border border-line px-4 sm:px-5 py-3.5 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4"
                  >
                    <div className="flex items-center gap-3 sm:contents">
                      <div className="w-20 flex-shrink-0">
                        <p className="text-sm font-medium text-ink">{a.date}</p>
                        <p className="text-xs text-ink-3">{a.startTime}</p>
                      </div>
                      <div className="hidden sm:block w-px h-8 bg-line flex-shrink-0" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-ink truncate">{a.serviceName}</p>
                      <p className="text-xs text-ink-3 truncate">
                        {a.staffName} · {a.branchName}
                      </p>
                    </div>
                    <div className="flex items-center justify-between sm:justify-end gap-3 sm:gap-4 flex-shrink-0">
                      <span className="text-sm font-semibold text-ink-2">
                        {Number(a.price).toLocaleString()} ETB
                      </span>
                      <span className="text-xs text-ink-3 capitalize">
                        {a.status.replace('-', ' ')}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {activeTab === 'feedback' && (
            <div className="max-w-2xl flex flex-col gap-3">
              {custFb.length === 0 ? (
                <p className="text-sm text-ink-3 py-10 text-center">
                  No feedback from this customer yet.
                </p>
              ) : (
                custFb.map(f => (
                  <div key={f.id} className="bg-surface rounded-2xl border border-line p-5">
                    <div className="flex items-center justify-between mb-2 gap-3">
                      <div className="flex items-center gap-2 min-w-0">
                        <MiniStars rating={f.overallRating} />
                        <span className="text-sm font-medium text-ink">
                          {f.overallRating.toFixed(1)}
                        </span>
                      </div>
                      <span className="text-xs text-ink-3 flex-shrink-0">{f.date}</span>
                    </div>
                    {f.comment && (
                      <p className="text-sm text-ink-2 leading-relaxed">"{f.comment}"</p>
                    )}
                    <p className="text-xs text-ink-3 mt-2 truncate">
                      {f.serviceName} · {f.staffName}
                    </p>
                  </div>
                ))
              )}
            </div>
          )}

          {activeTab === 'notes' && (
            <NotesTab notes={''} onSave={saveNotes} />
          )}
        </div>
      </div>
    )
  }

  /* ---------------------------------------------------------------- */
  /*  Render — list view                                              */
  /* ---------------------------------------------------------------- */

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="px-4 sm:px-6 lg:px-8 py-4 sm:py-5 bg-surface border-b border-line flex-shrink-0">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-4">
          <div className="min-w-0">
            <h2 className="font-display text-xl sm:text-2xl lg:text-[1.75rem] text-ink leading-none">Customers</h2>
            <p className="text-ink-3 text-xs sm:text-sm mt-1.5">Manage your client relationships.</p>
          </div>
          <Button
            onClick={() => setShowModal(true)}
            size="sm"
            disabled={loading}
            className="self-start sm:self-auto flex-shrink-0"
          >
            <PlusIcon /> Add Customer
          </Button>
        </div>
        <div className="relative max-w-sm">
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-3"
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <circle cx="11" cy="11" r="8" />
            <path d="M21 21l-4.35-4.35" />
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
        {loading && customers.length === 0 ? (
          <div className="px-4 sm:px-6 lg:px-8 py-6">
            <LoadingState label="Loading customers…" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="px-4 sm:px-6 lg:px-8 py-6">
            <EmptyState
              icon={<PersonIcon />}
              title={search ? 'No matches' : 'No customers yet'}
              description={
                search
                  ? 'Try a different name or phone number.'
                  : 'Customers will appear here after their first booking.'
              }
              action={
                search ? undefined : (
                  <Button onClick={() => setShowModal(true)} size="sm">
                    <PlusIcon /> Add Customer
                  </Button>
                )
              }
            />
          </div>
        ) : (
          <>
            {/* Desktop / tablet: table layout */}
            <div className="hidden md:block bg-surface border-b border-line">
              <div className="grid grid-cols-[1fr_160px_80px_120px_120px_100px] gap-4 px-4 sm:px-6 lg:px-8 py-3 border-b border-line">
                {['Customer', 'Phone', 'Visits', 'Last visit', 'Total spent', 'Outstanding'].map(h => (
                  <span
                    key={h}
                    className="text-[11px] font-semibold text-ink-3 uppercase tracking-wider"
                  >
                    {h}
                  </span>
                ))}
              </div>
              {filtered.map(c => {
                const stat = statsFor.get(c.id)
                const name = `${c.firstName} ${c.lastName}`.trim()
                const phone = primaryPhoneOf(c)
                const isArchived = c.status === 'ARCHIVED'
                return (
                  <button
                    key={c.id}
                    onClick={() => openDetail(c)}
                    className="grid grid-cols-[1fr_160px_80px_120px_120px_100px] gap-4 px-4 sm:px-6 lg:px-8 py-4 border-b border-line last:border-0 w-full text-left hover:bg-bg transition-colors items-center group"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <Avatar name={name} size="sm" />
                      <span className="text-sm font-medium text-ink truncate">{name}</span>
                      {isArchived && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-line text-ink-3 font-medium flex-shrink-0">
                          Archived
                        </span>
                      )}
                    </div>
                    <span className="text-sm text-ink-3 truncate">{phone ?? '—'}</span>
                    <span className="text-sm text-ink-2">{stat?.visitCount ?? 0}</span>
                    <span className="text-sm text-ink-3">{stat?.lastVisit ?? '—'}</span>
                    <span className="text-sm font-medium text-ink">
                      {(stat?.totalSpent ?? 0).toLocaleString()} ETB
                    </span>
                    <span className="text-sm font-medium text-ink-3">—</span>
                  </button>
                )
              })}
            </div>

            {/* Mobile: stacked cards */}
            <div className="md:hidden flex flex-col gap-2 px-4 py-4 bg-bg">
              {filtered.map(c => {
                const stat = statsFor.get(c.id)
                const name = `${c.firstName} ${c.lastName}`.trim()
                const phone = primaryPhoneOf(c)
                const isArchived = c.status === 'ARCHIVED'
                return (
                  <button
                    key={c.id}
                    onClick={() => openDetail(c)}
                    className="
                      w-full text-left bg-surface rounded-2xl border border-line
                      p-4 active:bg-bg transition-colors
                      focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink-3/30
                    "
                  >
                    <div className="flex items-center gap-3 mb-3">
                      <Avatar name={name} size="md" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-medium text-ink truncate">{name}</p>
                          {isArchived && (
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-line text-ink-3 font-medium flex-shrink-0">
                              Archived
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-ink-3 mt-0.5 truncate">{phone ?? '—'}</p>
                      </div>
                    </div>
                    <div className="flex items-center justify-between pt-3 border-t border-line">
                      <div className="flex flex-col">
                        <span className="text-[10px] text-ink-3 uppercase tracking-wider">Visits</span>
                        <span className="text-sm font-semibold text-ink mt-0.5">
                          {stat?.visitCount ?? 0}
                        </span>
                      </div>
                      <div className="w-px h-7 bg-line" />
                      <div className="flex flex-col">
                        <span className="text-[10px] text-ink-3 uppercase tracking-wider">Last visit</span>
                        <span className="text-sm font-medium text-ink-2 mt-0.5">
                          {stat?.lastVisit ?? '—'}
                        </span>
                      </div>
                      <div className="w-px h-7 bg-line" />
                      <div className="flex flex-col text-right">
                        <span className="text-[10px] text-ink-3 uppercase tracking-wider">Total spent</span>
                        <span className="text-sm font-semibold text-ink mt-0.5">
                          {(stat?.totalSpent ?? 0).toLocaleString()} ETB
                        </span>
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>
          </>
        )}
      </div>

      <AddCustomerModal
        open={showModal}
        onClose={() => setShowModal(false)}
        onSubmit={handleCreate}
        existing={customers}
      />
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Add Customer Modal                                                 */
/* ------------------------------------------------------------------ */

function AddCustomerModal({
  open,
  onClose,
  onSubmit,
  existing,
}: {
  open: boolean
  onClose: () => void
  onSubmit: (input: { firstName: string; lastName: string; phone: string }) => Promise<void> | void
  existing: Customer[]
}) {
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    phone: '',
    email: '',
    dob: '',
    notes: '',
  })
  const [duplicate, setDuplicate] = useState<Customer | null>(null)

  useEffect(() => {
    if (!open) return
    setForm({ firstName: '', lastName: '', phone: '', email: '', dob: '', notes: '' })
    setDuplicate(null)
    setSaving(false)
  }, [open])

  function handlePhoneChange(phone: string) {
    setForm(f => ({ ...f, phone }))

    const normalized = normalizePhone(phone)
    if (!normalized) {
      setDuplicate(null)
      return
    }
    const found = existing.find(c =>
      (c.phones ?? []).some(p => p.phone === normalized),
    )
    setDuplicate(found ?? null)
  }

  async function handleSave() {
    if (!form.firstName.trim() || !form.phone.trim()) return
    setSaving(true)
    try {
      await onSubmit({
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        phone: form.phone.trim(),
      })
    } finally {
      setSaving(false)
    }
  }

  const phonePreview = form.phone ? normalizePhone(form.phone) : null
  const canSave =
    form.firstName.trim().length > 0 &&
    form.phone.trim().length > 0 &&
    !!phonePreview &&
    !duplicate &&
    !saving

  return (
    <Modal open={open} onClose={onClose} title="Add Customer" width="max-w-md">
      <div className="px-4 sm:px-6 py-5 flex flex-col gap-4 max-h-[65vh] overflow-y-auto">
        {duplicate && (
          <div className="bg-[#FBF5EA] border border-[#E8D5A8] rounded-xl px-4 py-3">
            <p className="text-sm text-[#7A5F2C] font-medium mb-0.5">
              Customer already exists
            </p>
            <p className="text-sm text-[#7A5F2C]">
              {duplicate.firstName} {duplicate.lastName} ·{' '}
              {primaryPhoneOf(duplicate) ?? '—'}
            </p>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input
            label="First name"
            value={form.firstName}
            placeholder="Hana"
            onChange={e => setForm(f => ({ ...f, firstName: e.target.value }))}
          />
          <Input
            label="Last name"
            value={form.lastName}
            placeholder="Girma"
            onChange={e => setForm(f => ({ ...f, lastName: e.target.value }))}
          />
        </div>

        <div>
          <Input
            label="Phone"
            value={form.phone}
            placeholder="+251 9XX XXX XXX"
            onChange={e => handlePhoneChange(e.target.value)}
          />
          {phonePreview && phonePreview !== form.phone.trim() && (
            <p className="text-[11px] text-ink-3 mt-1.5">
              Will be saved as <span className="text-ink">{phonePreview}</span>
            </p>
          )}
          {form.phone.trim() && !phonePreview && (
            <p className="text-[11px] text-[#B06A6A] mt-1.5">
              Enter an Ethiopian number, e.g. 0911223344 or +251911223344
            </p>
          )}
        </div>

        <Input
          label="Email (optional — not stored yet)"
          type="email"
          value={form.email}
          placeholder="hana@example.com"
          disabled
          onChange={() => {}}
        />
        <Input
          label="Date of birth (optional — not stored yet)"
          type="date"
          value={form.dob}
          disabled
          onChange={() => {}}
        />
        <Textarea
          label="Notes (optional — not stored yet)"
          value={form.notes}
          rows={2}
          placeholder="Any preferences or notes…"
          disabled
          onChange={() => {}}
        />
      </div>

      <div className="px-4 sm:px-6 pb-5 sm:pb-6 flex gap-2 sm:gap-3 justify-end border-t border-line pt-4">
        <Button variant="ghost" onClick={onClose} disabled={saving}>
          Cancel
        </Button>
        <Button onClick={handleSave} loading={saving} disabled={!canSave}>
          Add customer
        </Button>
      </div>
    </Modal>
  )
}

/* ------------------------------------------------------------------ */
/*  Notes Tab                                                          */
/* ------------------------------------------------------------------ */

function NotesTab({ notes, onSave }: { notes: string; onSave: (n: string) => void }) {
  const [value, setValue] = useState(notes)
  const [saved, setSaved] = useState(false)

  useEffect(() => { setValue(notes) }, [notes])

  function handleSave() {
    onSave(value)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div className="max-w-xl">
      <p className="text-xs text-ink-3 mb-3">
        Private salon notes — not visible to the customer.
      </p>
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

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function primaryPhoneOf(c: Customer): string | null {
  const phones = c.phones ?? []
  const primary = phones.find(p => p.isPrimary)
  return (primary ?? phones[0])?.phone ?? null
}

function MiniStars({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map(i => (
        <svg
          key={i}
          width="11"
          height="11"
          viewBox="0 0 24 24"
          fill={i <= Math.round(rating) ? '#C4A97D' : 'none'}
          stroke="#C4A97D"
          strokeWidth="1.5"
        >
          <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
        </svg>
      ))}
    </div>
  )
}

function Stat({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="flex-shrink-0">
      <p className="text-xs text-ink-3">{label}</p>
      <p
        className="text-base font-semibold mt-0.5"
        style={{ color: color ?? '#1C1C1C' }}
      >
        {value}
      </p>
    </div>
  )
}

function LoadingState({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <svg
        className="animate-spin text-ink-3 mb-4"
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M21 12a9 9 0 11-6.219-8.56" />
      </svg>
      <p className="text-ink-3 text-sm">{label}</p>
    </div>
  )
}

function PlusIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
      <path d="M12 5v14M5 12h14" />
    </svg>
  )
}

function PersonIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M9 11a4 4 0 100-8 4 4 0 000 8z" />
    </svg>
  )
}

/* ------------------------------------------------------------------ */
/*  Response helpers                                                   */
/* ------------------------------------------------------------------ */

function normalizeArray<T>(res: unknown): T[] {
  if (Array.isArray(res)) return res as T[]
  if (Array.isArray((res as any)?.data)) return (res as any).data as T[]
  return []
}

function extractErrorMessage(err: unknown, fallback = 'Something went wrong.'): string {
  if (!err) return fallback
  const anyErr = err as any

  if (Array.isArray(anyErr?.details) && anyErr.details.length > 0) {
    return formatDetail(anyErr.details[0])
  }

  const data = anyErr?.response?.data ?? anyErr?.data ?? anyErr

  if (Array.isArray(data?.errors) && data.errors.length > 0) {
    return String(data.errors[0])
  }

  if (Array.isArray(data?.details) && data.details.length > 0) {
    return formatDetail(data.details[0])
  }

  if (typeof data?.message === 'string' && data.message) return data.message
  if (typeof anyErr?.message === 'string' && anyErr.message) return anyErr.message
  return fallback
}

function formatDetail(detail: any): string {
  if (typeof detail === 'string') return detail
  if (detail && typeof detail === 'object') {
    const field = detail.field ? `${detail.field}: ` : ''
    return `${field}${detail.message ?? JSON.stringify(detail)}`
  }
  return String(detail)
}