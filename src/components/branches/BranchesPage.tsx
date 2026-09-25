// src/components/branches/BranchesPage.tsx

import { useEffect, useMemo, useState } from 'react'
import type {
  Branch,
  BranchDetail,
  BranchPhone,
  WeeklySchedule,
  DateOverride,
  DayOfWeek,
  Service,
  ServiceCategory,
  Staff,
  StaffStatus,
} from '../../types/api'
import { Button, Input, Toggle, Modal } from '../ui'
import { EmptyState } from '../services/ServicesPage'
import { useToast } from '../ui/Toast'
import { useBusiness } from '../../contexts/BusinessContext'
import { useBranch } from '../../contexts/BranchContext'
import { branchesApi } from '../../api/branches.api'
import { staffApi } from '../../api/staff.api'
import { servicesApi } from '../../api/services.api'
import { serviceCategoriesApi } from '../../api/service-categories.api'

/* ------------------------------------------------------------------ */
/*  Constants + helpers                                                */
/* ------------------------------------------------------------------ */

const DAY_LABELS = [
  'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday',
] as const

const DEFAULT_TIMEZONE = 'Africa/Addis_Ababa'

const DEFAULT_SCHEDULES: WeeklySchedule[] = DAY_LABELS.map((_, i) => ({
  id: `local-${i}`,
  dayOfWeek: i as DayOfWeek,
  isClosed: i === 0,
  intervals:
    i === 0
      ? []
      : [{ startTime: '09:00', endTime: i === 6 ? '17:00' : '18:00' }],
}))

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/**
 * Normalizes Ethiopian phone numbers to E.164.
 * Accepts +2519XXXXXXXX, +2517XXXXXXXX, 2519..., 2517..., 09XXXXXXXX, 07XXXXXXXX.
 * Returns null if the input doesn't match any accepted format.
 */
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

type Tab = 'info' | 'hours' | 'overrides' | 'phones' | 'staff' | 'services'

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */

export function BranchesPage() {
  const toast = useToast()
  const { activeBusinessId } = useBusiness()
  // Branch context: read the active filter and optionally refresh the
  // context's own list after a mutation. Mirrors StaffPage.
  const { activeBranchFilter } = useBranch()

  const [branches,   setBranches]   = useState<Branch[]>([])
  const [staff,      setStaff]      = useState<Staff[]>([])
  const [services,   setServices]   = useState<Service[]>([])
  const [categories, setCategories] = useState<ServiceCategory[]>([])

  const [loading,  setLoading]  = useState(false)
  const [selected, setSelected] = useState<Branch | null>(null)
  const [detail,   setDetail]   = useState<BranchDetail | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [activeTab, setActiveTab] = useState<Tab>('info')

  const [showModal, setShowModal] = useState(false)
  const [editing,   setEditing]   = useState<Branch | null>(null)

  /**
   * View transition state, mirrors StaffPage.
   * - `view` picks which screen is mounted.
   * - `detailVisible` drives the detail's enter/exit animation.
   */
  const [view, setView] = useState<'list' | 'detail'>('list')
  const [detailVisible, setDetailVisible] = useState(false)

  /* ---------------------------------------------------------------- */
  /*  Data loading                                                    */
  /* ---------------------------------------------------------------- */

  async function refresh() {
    if (!activeBusinessId) return
    setLoading(true)
    try {
      const [branchList, staffList, svcList, catList] = await Promise.all([
        branchesApi.list(activeBusinessId),
        staffApi.list(activeBusinessId, { branchId: activeBranchFilter }),
        servicesApi.list(activeBusinessId, { branchId: activeBranchFilter }),
        serviceCategoriesApi.list(activeBusinessId, { branchId: activeBranchFilter }),
      ])
      const allBranches = normalizeArray<Branch>(branchList)
      setBranches(
        activeBranchFilter
          ? allBranches.filter(b => b.id === activeBranchFilter)
          : allBranches,
      )
      setStaff(normalizeArray<Staff>(staffList))
      setServices(normalizeArray<Service>(svcList))
      setCategories(normalizeArray<ServiceCategory>(catList))
    } catch (err) {
      console.error('[branches] load failed', err)
      toast.error(extractErrorMessage(err, 'Could not load branches.'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void refresh()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeBusinessId, activeBranchFilter])

  /**
   * Close the detail panel if the currently-selected branch is no longer
   * in the filtered list. Mirrors StaffPage's equivalent guard.
   */
  useEffect(() => {
    if (!selected) return
    if (!loading && !branches.some(b => b.id === selected.id)) {
      closeDetail()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeBranchFilter, loading])

  /**
   * Keep `selected` in sync with the latest list row after refresh().
   * Prevents stale snapshots from being used in PATCH calls.
   */
  useEffect(() => {
    if (!selected) return
    const fresh = branches.find(b => b.id === selected.id)
    if (!fresh) return
    if (fresh !== selected) {
      setSelected(fresh)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [branches])

  /* ---------------------------------------------------------------- */
  /*  Detail transitions                                              */
  /* ---------------------------------------------------------------- */

  async function openDetail(branch: Branch) {
    setSelected(branch)
    setDetail(null)
    setActiveTab('info')
    setView('detail')
    requestAnimationFrame(() => setDetailVisible(true))

    setDetailLoading(true)
    try {
      const d = await branchesApi.get(activeBusinessId!, branch.id)
      setDetail(d)
      // Server is source of truth for phones; keep list in sync.
      setBranches(prev =>
        prev.map(b => (b.id === d.id ? { ...b, phones: d.phones } : b)),
      )
    } catch (err) {
      console.error('[branches] detail load failed', err)
      toast.error(extractErrorMessage(err, 'Could not load branch details.'))
    } finally {
      setDetailLoading(false)
    }
  }

  function closeDetail() {
    setDetailVisible(false)
    setTimeout(() => {
      setView('list')
      setSelected(null)
      setDetail(null)
    }, 220)
  }

  /* ---------------------------------------------------------------- */
  /*  Actions                                                         */
  /* ---------------------------------------------------------------- */

  function openAdd() {
    setEditing(null)
    setShowModal(true)
  }

  function openEdit() {
    if (!selected) return
    setEditing(selected)
    setShowModal(true)
  }

  async function handleSave(payload: BranchFormPayload, existingId: string | null) {
    if (!activeBusinessId) return

    try {
      if (existingId) {
        const updated = await branchesApi.update(activeBusinessId, existingId, {
          name: payload.name.trim(),
          address: payload.address.trim() || null,
          timezone: payload.timezone.trim() || undefined,
          isActive: payload.isActive,
        })
        setBranches(prev => prev.map(b => (b.id === updated.id ? { ...b, ...updated } : b)))
        setSelected(prev => (prev && prev.id === updated.id ? { ...prev, ...updated } : prev))
      } else {
        const created = await branchesApi.create(activeBusinessId, {
          name: payload.name.trim(),
          address: payload.address.trim(),
          timezone: payload.timezone.trim() || undefined,
        })
        setBranches(prev => [...prev, created])
      }

      toast.success(existingId ? 'Branch updated' : 'Branch added')
      setShowModal(false)
      await refresh()
      // Keep the context's own branch list (used by the header filter
      // selector and other pages) in sync.
    } catch (err) {
      console.error('[branches] save failed', err)
      toast.error(extractErrorMessage(err, 'Could not save the branch.'))
    }
  }

  /**
   * Always operate on the freshest copy of the branch from `branches`,
   * never on a stale `selected` snapshot.
   */
  async function toggleStatus() {
    if (!selected || !activeBusinessId) return
    const current = branches.find(b => b.id === selected.id) ?? selected
    try {
      const updated = await branchesApi.update(activeBusinessId, current.id, {
        isActive: !current.isActive,
      })
      setBranches(prev =>
        prev.map(b => (b.id === updated.id ? { ...b, ...updated } : b)),
      )
      setSelected(prev => (prev ? { ...prev, ...updated } : prev))
      setDetail(prev => (prev ? { ...prev, isActive: updated.isActive } : prev))
      toast.success(updated.isActive ? 'Branch activated' : 'Branch deactivated')
    } catch (err) {
      console.error('[branches] toggle status failed', err)
      toast.error(extractErrorMessage(err, 'Could not change the branch status.'))
    }
  }

  /* ---------------------------------------------------------------- */
  /*  Derived                                                         */
  /* ---------------------------------------------------------------- */

  // Staff whose home branch is this one (§12 — `Staff.branchId`)
  function staffFor(branchId: string) {
    return staff.filter(m => m.branchId === branchId)
  }

  // Services actively assigned to this branch (§9 — `Service.branchAssignments[]`)
  function servicesFor(branchId: string) {
    return services.filter(s =>
      (s.branchAssignments ?? []).some(a => a.branchId === branchId && a.isActive),
    )
  }

  /* ---------------------------------------------------------------- */
  /*  Render                                                          */
  /* ---------------------------------------------------------------- */

  return (
    <div className="relative h-full overflow-hidden">
      {/* List view — always visible when mounted. No exit animation. */}
      {view === 'list' && (
        <div className="flex flex-col h-full overflow-hidden">
          <div className="px-4 sm:px-6 lg:px-8 py-4 sm:py-5 bg-surface border-b border-line flex-shrink-0">
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
              <div className="min-w-0">
                <h2 className="font-display text-xl sm:text-2xl lg:text-[1.75rem] text-ink leading-none">
                  Branches
                </h2>
                <p className="text-ink-3 text-xs sm:text-sm mt-1.5">Manage your salon locations.</p>
              </div>
              <Button
                onClick={openAdd}
                size="sm"
                disabled={loading}
                className="self-start sm:self-auto flex-shrink-0"
              >
                <PlusIcon /> Add Branch
              </Button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-4 sm:px-6 lg:px-8 py-5 sm:py-6">
            {loading && branches.length === 0 ? (
              <LoadingState label="Loading branches…" />
            ) : branches.length === 0 ? (
              <EmptyState
                icon={<BranchIcon />}
                title={activeBranchFilter ? 'No branch matches the filter' : 'No branches yet'}
                description={
                  activeBranchFilter
                    ? 'Clear the branch filter to see all branches.'
                    : 'Add your first branch to get started.'
                }
                action={
                  activeBranchFilter ? undefined : (
                    <Button onClick={openAdd} size="sm">
                      <PlusIcon /> Add Branch
                    </Button>
                  )
                }
              />
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                {branches.map(branch => {
                  const branchStaff = staffFor(branch.id)
                  const branchSvcs  = servicesFor(branch.id)
                  const isActive    = branch.isActive
                  return (
                    <button
                      key={branch.id}
                      type="button"
                      onClick={() => void openDetail(branch)}
                      className="
                        group relative w-full text-left
                        bg-surface rounded-2xl border border-line
                        p-5 cursor-pointer
                        transition-all duration-200 ease-out
                        hover:border-warm hover:shadow-md hover:-translate-y-0.5
                        active:translate-y-0 active:shadow-sm
                        focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink-3/30 focus-visible:border-ink-3
                      "
                    >
                      <div className="flex items-start justify-between mb-4 gap-2">
                        <div className="min-w-0">
                          <h3 className="font-display text-xl text-ink truncate">{branch.name}</h3>
                          <p className="text-sm text-ink-3 mt-0.5 truncate">{branch.address ?? '—'}</p>
                        </div>
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium flex-shrink-0 ${isActive ? 'bg-[#EAF5EC] text-[#2A5F30]' : 'bg-line text-ink-3'}`}>
                          {isActive ? 'Open' : 'Closed'}
                        </span>
                      </div>
                      <div className="flex items-center gap-4 pt-4 border-t border-line">
                        <div className="text-center">
                          <p className="text-lg font-semibold text-ink">{branch.phones.length}</p>
                          <p className="text-[11px] text-ink-3">phones</p>
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
        </div>
      )}

      {/* Detail view — slides in from the right, fades out on close. */}
      {view === 'detail' && selected && (
        <div
          className={`
            absolute inset-0 bg-bg z-20
            transition-all duration-200 ease-out
            ${detailVisible ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-4 pointer-events-none'}
          `}
        >
          <BranchDetailView
            branch={selected}
            detail={detail}
            detailLoading={detailLoading}
            activeTab={activeTab}
            setActiveTab={setActiveTab}
            allStaff={staff}
            allServices={services}
            allCategories={categories}
            onBack={closeDetail}
            onEdit={openEdit}
            onToggleStatus={() => void toggleStatus()}
            onChanged={() => void refresh()}
            onDetailChange={patch =>
              setDetail(prev => (prev ? { ...prev, ...patch } : prev))
            }
            onPhonesChange={next => {
              setBranches(prev =>
                prev.map(b =>
                  b.id === selected.id ? { ...b, phones: next } : b,
                ),
              )
              setSelected(prev => (prev ? { ...prev, phones: next } : prev))
            }}
          />
        </div>
      )}

      {/* Single modal — mounted in both views. */}
      <BranchFormModal
        open={showModal}
        onClose={() => setShowModal(false)}
        branch={editing}
        onSave={handleSave}
      />
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Detail view                                                        */
/* ------------------------------------------------------------------ */

function BranchDetailView({
  branch, detail, detailLoading, activeTab, setActiveTab,
  allStaff, allServices, allCategories,
  onBack, onEdit, onToggleStatus, onChanged,
  onDetailChange, onPhonesChange,
}: {
  branch: Branch
  detail: BranchDetail | null
  detailLoading: boolean
  activeTab: Tab
  setActiveTab: (t: Tab) => void
  allStaff: Staff[]
  allServices: Service[]
  allCategories: ServiceCategory[]
  onBack: () => void
  onEdit: () => void
  onToggleStatus: () => void
  onChanged: () => Promise<void> | void
  onDetailChange: (patch: Partial<BranchDetail>) => void
  onPhonesChange: (phones: BranchPhone[]) => void
}) {
  const isActive = branch.isActive
  const phones = detail?.phones ?? branch.phones

  const branchStaff = useMemo(
    () => allStaff.filter(m => m.branchId === branch.id),
    [allStaff, branch.id],
  )
  const branchSvcs = useMemo(
    () =>
      allServices.filter(s =>
        (s.branchAssignments ?? []).some(
          a => a.branchId === branch.id && a.isActive,
        ),
      ),
    [allServices, branch.id],
  )
  const branchCats = useMemo(
    () =>
      allCategories.filter(c =>
        (c.branchAssignments ?? []).some(
          a => a.branchId === branch.id && a.isActive,
        ),
      ),
    [allCategories, branch.id],
  )

  const tabs: Tab[] = ['info', 'hours', 'overrides', 'phones', 'staff', 'services']

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="px-4 sm:px-6 lg:px-8 py-4 sm:py-5 bg-surface border-b border-line flex-shrink-0">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-sm text-ink-3 hover:text-ink transition-colors mb-5"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M15 18l-6-6 6-6" />
          </svg>
          All branches
        </button>

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2.5 flex-wrap">
              <h2 className="font-display text-xl sm:text-2xl text-ink truncate">{branch.name}</h2>
              <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium flex-shrink-0 ${isActive ? 'bg-[#EAF5EC] text-[#2A5F30]' : 'bg-line text-ink-3'}`}>
                {isActive ? 'Open' : 'Closed'}
              </span>
            </div>
            <p className="text-ink-3 text-sm mt-0.5 truncate">{branch.address ?? '—'}</p>
          </div>
          <div className="flex items-center gap-2 self-start sm:self-auto flex-shrink-0">
            <Button
              variant="secondary"
              size="sm"
              onClick={onToggleStatus}
              disabled={!branch.id}
              className={isActive ? '!text-[#B03A3A] !border-[#E5B5B5] hover:!bg-[#FBEDED]' : ''}
            >
              {isActive ? 'Deactivate' : 'Activate'}
            </Button>
            <Button size="sm" onClick={onEdit}>Edit</Button>
          </div>
        </div>

        <div className="flex items-center gap-4 sm:gap-6 mt-5 pt-5 border-t border-line overflow-x-auto">
          <Stat label="Timezone" value={branch.timezone} sub="" />
          <div className="w-px h-8 bg-line flex-shrink-0" />
          <Stat label="Phones" value={String(phones.length)} sub="" />
          <div className="w-px h-8 bg-line flex-shrink-0" />
          <Stat label="Staff" value={String(branchStaff.length)} sub="members" />
          <div className="w-px h-8 bg-line flex-shrink-0" />
          <Stat label="Services" value={String(branchSvcs.length)} sub="offered" />
        </div>

        <div className="flex gap-1 mt-5 overflow-x-auto">
          {tabs.map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`h-8 px-4 text-xs font-medium rounded-xl transition-colors capitalize whitespace-nowrap ${activeTab === tab ? 'bg-ink text-surface' : 'text-ink-3 hover:text-ink hover:bg-warm-subtle'}`}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 sm:px-6 lg:px-8 py-5 sm:py-6">
        {activeTab === 'info' && (
          <div className="max-w-md bg-surface rounded-2xl border border-line divide-y divide-line">
            <InfoRow label="Address" value={branch.address ?? '—'} />
            <InfoRow label="Email" value={detail?.email ?? '—'} />
            <InfoRow label="Timezone" value={branch.timezone} />
            <InfoRow label="Status" value={isActive ? 'Active' : 'Inactive'} />
            {detail && (
              <InfoRow label="Created" value={new Date(detail.createdAt).toLocaleDateString()} />
            )}
          </div>
        )}

        {activeTab === 'hours' && (
          detail ? (
            <HoursEditor
              businessId={detail.businessId}
              branchId={detail.id}
              schedules={detail.weeklySchedules}
            />
          ) : (
            <LoadingState label="Loading weekly hours…" />
          )
        )}

        {activeTab === 'overrides' && (
          detail ? (
            <DateOverridesEditor
              businessId={detail.businessId}
              branchId={detail.id}
              overrides={detail.dateOverrides}
              onChange={next => onDetailChange({ dateOverrides: next })}
            />
          ) : (
            <LoadingState label="Loading date overrides…" />
          )
        )}

        {activeTab === 'phones' && (
          <PhonesEditor
            businessId={branch.businessId}
            branchId={branch.id}
            phones={phones}
            onChange={next => {
              onDetailChange({ phones: next })
              onPhonesChange(next)
            }}
          />
        )}

        {activeTab === 'staff' && (
          <BranchStaffTab
            branchId={branch.id}
            assigned={branchStaff}
            allStaff={allStaff}
            onChanged={onChanged}
          />
        )}

        {activeTab === 'services' && (
          <BranchServicesTab
            branchId={branch.id}
            assignedServices={branchSvcs}
            assignedCategories={branchCats}
            allServices={allServices}
            allCategories={allCategories}
            onChanged={onChanged}
          />
        )}
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Branch detail — Staff tab                                          */
/*                                                                     */
/*  Staff↔Branch is a single `Staff.branchId` (home branch), so        */
/*  "assigning" here means moving them from their current branch.      */
/* ------------------------------------------------------------------ */

function BranchStaffTab({
  branchId,
  assigned,
  allStaff,
  onChanged,
}: {
  branchId: string
  assigned: Staff[]
  allStaff: Staff[]
  onChanged: () => Promise<void> | void
}) {
  const toast = useToast()
  const [picking, setPicking] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)

  // Staff at other branches are the only candidates for "move here".
  const elsewhere = useMemo(
    () => allStaff.filter(m => m.branchId !== branchId),
    [allStaff, branchId],
  )

  async function moveHere(member: Staff) {
    setBusyId(member.id)
    try {
      await staffApi.moveBranch(member.id, branchId)
      toast.success(`${member.firstName} moved to this branch`)
      setPicking(false)
      await onChanged()
    } catch (err) {
      console.error('[branch] move staff failed', err)
      toast.error(extractErrorMessage(err, 'Could not move the staff member.'))
    } finally {
      setBusyId(null)
    }
  }

  async function toggleActive(member: Staff) {
    setBusyId(member.id)
    try {
      const next: StaffStatus = member.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE'
      await staffApi.update(member.id, { status: next })
      toast.success(next === 'ACTIVE' ? 'Staff activated' : 'Staff deactivated')
      await onChanged()
    } catch (err) {
      console.error('[branch] toggle staff status failed', err)
      toast.error(extractErrorMessage(err, 'Could not update the staff member.'))
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="max-w-xl flex flex-col gap-3">
      {/* Assigned list — bordered card with one row per member */}
      <div className="bg-surface rounded-2xl border border-line overflow-hidden">
        {assigned.length === 0 ? (
          <p className="text-sm text-ink-3 py-10 text-center px-5">
            No staff assigned to this branch.
          </p>
        ) : (
          assigned.map(m => {
            const isActive = m.status === 'ACTIVE'
            return (
              <div
                key={m.id}
                className="flex items-center gap-4 px-5 py-3.5 border-b border-line last:border-0"
              >
                <Avatar name={`${m.firstName} ${m.lastName}`} size="md" />
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-ink text-sm truncate">
                    {m.firstName} {m.lastName}
                  </p>
                  <p className="text-xs text-ink-3 mt-0.5 truncate">
                    {m.title ?? '—'}
                  </p>
                </div>
                <span
                  className={`text-[10px] px-2 py-0.5 rounded-full font-medium flex-shrink-0 ${
                    isActive ? 'bg-[#EAF5EC] text-[#2A5F30]' : 'bg-line text-ink-3'
                  }`}
                >
                  {isActive ? 'Active' : 'Inactive'}
                </span>
                <button
                  type="button"
                  onClick={() => void toggleActive(m)}
                  disabled={busyId === m.id}
                  className="text-xs text-ink-3 hover:text-ink disabled:opacity-50 flex-shrink-0 w-20 text-right"
                >
                  {isActive ? 'Deactivate' : 'Activate'}
                </button>
              </div>
            )
          })
        )}
      </div>

      {/* Add picker — same bordered-card pattern as the hours/overrides editors */}
      {picking ? (
        <div className="bg-surface rounded-2xl border border-line overflow-hidden">
          <div className="px-5 py-3 border-b border-line flex items-center justify-between">
            <p className="text-sm font-medium text-ink">Move a staff member here</p>
            <button
              type="button"
              onClick={() => setPicking(false)}
              className="text-xs text-ink-3 hover:text-ink"
            >
              Cancel
            </button>
          </div>
          {elsewhere.length === 0 ? (
            <p className="text-sm text-ink-3 p-5">
              Every staff member is already at this branch.
            </p>
          ) : (
            <div className="max-h-72 overflow-y-auto">
              {elsewhere.map(m => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => void moveHere(m)}
                  disabled={busyId === m.id}
                  className="w-full flex items-center gap-4 px-5 py-3.5 border-b border-line last:border-0 text-left hover:bg-bg transition-colors disabled:opacity-50"
                >
                  <Avatar name={`${m.firstName} ${m.lastName}`} size="md" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-ink truncate">
                      {m.firstName} {m.lastName}
                    </p>
                    <p className="text-xs text-ink-3 mt-0.5 truncate">
                      Currently at {m.branch?.name ?? '—'}
                    </p>
                  </div>
                  {busyId === m.id && (
                    <svg
                      className="animate-spin text-ink-3 flex-shrink-0"
                      width="14" height="14" viewBox="0 0 24 24" fill="none"
                      stroke="currentColor" strokeWidth="2" strokeLinecap="round"
                    >
                      <path d="M21 12a9 9 0 11-6.219-8.56" />
                    </svg>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      ) : (
        <Button
          size="sm"
          variant="secondary"
          onClick={() => setPicking(true)}
          className="self-start"
        >
          <PlusIcon /> Assign staff to this branch
        </Button>
      )}

      <p className="text-[11px] text-ink-3">
        Staff have one home branch at a time. Moving someone here reassigns
        them from their previous branch.
      </p>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Branch detail — Services tab                                       */
/*                                                                     */
/*  Two independent joins: services↔branch and categories↔branch.      */
/*  Both use `isActive` on the assignment row. Assign = create /       */
/*  reactivate; remove = deactivate.                                    */
/* ------------------------------------------------------------------ */

function BranchServicesTab({
  branchId,
  assignedServices,
  assignedCategories,
  allServices,
  allCategories,
  onChanged,
}: {
  branchId: string
  assignedServices: Service[]
  assignedCategories: ServiceCategory[]
  allServices: Service[]
  allCategories: ServiceCategory[]
  onChanged: () => Promise<void> | void
}) {
  const toast = useToast()

  // ── Service picker state ────────────────────────────────────────────
  const [pickingService, setPickingService] = useState(false)
  const [busyServiceId, setBusyServiceId] = useState<string | null>(null)

  // ── Category picker state ───────────────────────────────────────────
  const [pickingCategory, setPickingCategory] = useState(false)
  const [busyCategoryId, setBusyCategoryId] = useState<string | null>(null)

  const availableServices = useMemo(() => {
    const assignedIds = new Set(assignedServices.map(s => s.id))
    return allServices.filter(s => !assignedIds.has(s.id))
  }, [allServices, assignedServices])

  const availableCategories = useMemo(() => {
    const assignedIds = new Set(assignedCategories.map(c => c.id))
    return allCategories.filter(c => !assignedIds.has(c.id))
  }, [allCategories, assignedCategories])

  /* ---------------- Services ---------------- */

  async function assignService(svc: Service) {
    setBusyServiceId(svc.id)
    try {
      const existing = (svc.branchAssignments ?? []).find(
        a => a.branchId === branchId,
      )
      if (existing) {
        await servicesApi.branches.setActive(svc.id, branchId, true)
      } else {
        await servicesApi.branches.assign(svc.id, branchId)
      }
      toast.success(`${svc.name} assigned to this branch`)
      setPickingService(false)
      await onChanged()
    } catch (err) {
      console.error('[branch] assign service failed', err)
      toast.error(extractErrorMessage(err, 'Could not assign the service.'))
    } finally {
      setBusyServiceId(null)
    }
  }

  async function removeService(svc: Service) {
    setBusyServiceId(svc.id)
    try {
      await servicesApi.branches.setActive(svc.id, branchId, false)
      toast.success(`${svc.name} removed from this branch`)
      await onChanged()
    } catch (err) {
      console.error('[branch] unassign service failed', err)
      toast.error(extractErrorMessage(err, 'Could not remove the service.'))
    } finally {
      setBusyServiceId(null)
    }
  }

  /* ---------------- Categories ---------------- */

  async function assignCategory(cat: ServiceCategory) {
    setBusyCategoryId(cat.id)
    try {
      const existing = (cat.branchAssignments ?? []).find(
        a => a.branchId === branchId,
      )
      if (existing) {
        await serviceCategoriesApi.branches.setActive(cat.id, branchId, true)
      } else {
        await serviceCategoriesApi.branches.assign(cat.id, branchId)
      }
      toast.success(`${cat.name} assigned to this branch`)
      setPickingCategory(false)
      await onChanged()
    } catch (err) {
      console.error('[branch] assign category failed', err)
      toast.error(extractErrorMessage(err, 'Could not assign the category.'))
    } finally {
      setBusyCategoryId(null)
    }
  }

  async function removeCategory(cat: ServiceCategory) {
    setBusyCategoryId(cat.id)
    try {
      await serviceCategoriesApi.branches.setActive(cat.id, branchId, false)
      toast.success(`${cat.name} removed from this branch`)
      await onChanged()
    } catch (err) {
      console.error('[branch] unassign category failed', err)
      toast.error(extractErrorMessage(err, 'Could not remove the category.'))
    } finally {
      setBusyCategoryId(null)
    }
  }

  return (
    <div className="max-w-xl flex flex-col gap-8">
      {/* ─────────────────────────────────────────────────────────────
          Services
         ───────────────────────────────────────────────────────────── */}
      <section className="flex flex-col gap-3">
        <div className="flex items-center gap-3">
          <p className="text-xs font-semibold text-ink-3 uppercase tracking-wider">
            Services
          </p>
          <div className="flex-1 h-px bg-line" />
          <span className="text-xs text-ink-3 flex-shrink-0">
            {assignedServices.length} service{assignedServices.length !== 1 ? 's' : ''}
          </span>
        </div>

        <div className="bg-surface rounded-2xl border border-line overflow-hidden">
          {assignedServices.length === 0 ? (
            <p className="text-sm text-ink-3 py-8 text-center px-5">
              No services configured for this branch.
            </p>
          ) : (
            assignedServices.map(s => (
              <div
                key={s.id}
                className="flex items-center gap-4 px-5 py-3.5 border-b border-line last:border-0"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-medium text-ink truncate">{s.name}</p>
                    {s.status === 'INACTIVE' && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-line text-ink-3 font-medium flex-shrink-0">
                        Inactive
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-ink-3 truncate mt-0.5">
                    {s.category?.name ?? ''}
                  </p>
                </div>
                <span className="text-sm text-ink-2 flex-shrink-0 hidden sm:inline">
                  {Number(s.price).toLocaleString()} ETB
                </span>
                <span className="text-sm text-ink-3 flex-shrink-0 hidden sm:inline">
                  {s.durationMinutes} min
                </span>
                <button
                  type="button"
                  onClick={() => void removeService(s)}
                  disabled={busyServiceId === s.id}
                  className="text-xs text-[#B03A3A] hover:text-[#8a2b2b] disabled:opacity-50 flex-shrink-0"
                >
                  Remove
                </button>
              </div>
            ))
          )}
        </div>

        {pickingService ? (
          <div className="bg-surface rounded-2xl border border-line overflow-hidden">
            <div className="px-5 py-3 border-b border-line flex items-center justify-between">
              <p className="text-sm font-medium text-ink">Assign a service here</p>
              <button
                type="button"
                onClick={() => setPickingService(false)}
                className="text-xs text-ink-3 hover:text-ink"
              >
                Cancel
              </button>
            </div>
            {availableServices.length === 0 ? (
              <p className="text-sm text-ink-3 p-5">
                Every service is already offered at this branch.
              </p>
            ) : (
              <div className="max-h-72 overflow-y-auto">
                {availableServices.map(s => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => void assignService(s)}
                    disabled={busyServiceId === s.id}
                    className="w-full flex items-center gap-4 px-5 py-3.5 border-b border-line last:border-0 text-left hover:bg-bg transition-colors disabled:opacity-50"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-ink truncate">
                        {s.name}
                      </p>
                      <p className="text-xs text-ink-3 truncate mt-0.5">
                        {s.category?.name ?? '—'} ·{' '}
                        {Number(s.price).toLocaleString()} ETB
                      </p>
                    </div>
                    {busyServiceId === s.id && (
                      <svg
                        className="animate-spin text-ink-3 flex-shrink-0"
                        width="14" height="14" viewBox="0 0 24 24" fill="none"
                        stroke="currentColor" strokeWidth="2" strokeLinecap="round"
                      >
                        <path d="M21 12a9 9 0 11-6.219-8.56" />
                      </svg>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : (
          <Button
            size="sm"
            variant="secondary"
            onClick={() => setPickingService(true)}
            className="self-start"
          >
            <PlusIcon /> Assign service to this branch
          </Button>
        )}
      </section>

      {/* ─────────────────────────────────────────────────────────────
          Categories
         ───────────────────────────────────────────────────────────── */}
      <section className="flex flex-col gap-3">
        <div className="flex items-center gap-3">
          <p className="text-xs font-semibold text-ink-3 uppercase tracking-wider">
            Categories
          </p>
          <div className="flex-1 h-px bg-line" />
          <span className="text-xs text-ink-3 flex-shrink-0">
            {assignedCategories.length} categor{assignedCategories.length !== 1 ? 'ies' : 'y'}
          </span>
        </div>

        <div className="bg-surface rounded-2xl border border-line overflow-hidden">
          {assignedCategories.length === 0 ? (
            <p className="text-sm text-ink-3 py-8 text-center px-5">
              No categories configured for this branch.
            </p>
          ) : (
            assignedCategories.map(c => (
              <div
                key={c.id}
                className="flex items-center gap-4 px-5 py-3.5 border-b border-line last:border-0"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-medium text-ink truncate">{c.name}</p>
                    {c.status === 'INACTIVE' && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-line text-ink-3 font-medium flex-shrink-0">
                        Inactive
                      </span>
                    )}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => void removeCategory(c)}
                  disabled={busyCategoryId === c.id}
                  className="text-xs text-[#B03A3A] hover:text-[#8a2b2b] disabled:opacity-50 flex-shrink-0"
                >
                  Remove
                </button>
              </div>
            ))
          )}
        </div>

        {pickingCategory ? (
          <div className="bg-surface rounded-2xl border border-line overflow-hidden">
            <div className="px-5 py-3 border-b border-line flex items-center justify-between">
              <p className="text-sm font-medium text-ink">Assign a category here</p>
              <button
                type="button"
                onClick={() => setPickingCategory(false)}
                className="text-xs text-ink-3 hover:text-ink"
              >
                Cancel
              </button>
            </div>
            {availableCategories.length === 0 ? (
              <p className="text-sm text-ink-3 p-5">
                Every category is already offered at this branch.
              </p>
            ) : (
              <div className="max-h-72 overflow-y-auto">
                {availableCategories.map(c => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => void assignCategory(c)}
                    disabled={busyCategoryId === c.id}
                    className="w-full flex items-center gap-4 px-5 py-3.5 border-b border-line last:border-0 text-left hover:bg-bg transition-colors disabled:opacity-50"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-ink truncate">
                        {c.name}
                      </p>
                    </div>
                    {busyCategoryId === c.id && (
                      <svg
                        className="animate-spin text-ink-3 flex-shrink-0"
                        width="14" height="14" viewBox="0 0 24 24" fill="none"
                        stroke="currentColor" strokeWidth="2" strokeLinecap="round"
                      >
                        <path d="M21 12a9 9 0 11-6.219-8.56" />
                      </svg>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : (
          <Button
            size="sm"
            variant="secondary"
            onClick={() => setPickingCategory(true)}
            className="self-start"
          >
            <PlusIcon /> Assign category to this branch
          </Button>
        )}
      </section>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Branch form modal                                                  */
/* ------------------------------------------------------------------ */

type BranchFormPayload = {
  name: string
  address: string
  timezone: string
  isActive: boolean
}

function blankForm(): BranchFormPayload {
  return {
    name: '',
    address: '',
    timezone: DEFAULT_TIMEZONE,
    isActive: true,
  }
}

function BranchFormModal({
  open, onClose, branch, onSave,
}: {
  open: boolean
  onClose: () => void
  branch: Branch | null
  onSave: (payload: BranchFormPayload, existingId: string | null) => Promise<void>
}) {
  const [saving, setSaving] = useState(false)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [form, setForm] = useState<BranchFormPayload>(() => blankForm())
  const [baseline, setBaseline] = useState<BranchFormPayload>(() => blankForm())

  useEffect(() => {
    if (!open) return
    setFieldErrors({})
    if (branch) {
      const seeded: BranchFormPayload = {
        name:     branch.name,
        address:  branch.address ?? '',
        timezone: branch.timezone || DEFAULT_TIMEZONE,
        isActive: branch.isActive,
      }
      setForm(seeded)
      setBaseline(seeded)
    } else {
      const blank = blankForm()
      setForm(blank)
      setBaseline(blank)
    }
  }, [open, branch])

  function validate(): Record<string, string> {
    const e: Record<string, string> = {}

    if (!form.name.trim())                    e.name = 'Name is required'
    else if (form.name.trim().length > 100)   e.name = 'Max 100 characters'

    if (!form.address.trim())                    e.address = 'Address is required'
    else if (form.address.trim().length > 500)   e.address = 'Max 500 characters'

    if (!form.timezone.trim()) e.timezone = 'Timezone is required'

    return e
  }

  async function handleSave() {
    const errs = validate()
    if (Object.keys(errs).length) {
      setFieldErrors(errs)
      return
    }
    setFieldErrors({})
    setSaving(true)
    try {
      await onSave(form, branch?.id ?? null)
    } finally {
      setSaving(false)
    }
  }

  const dirty = useMemo(() => {
    return (
      form.name     !== baseline.name ||
      form.address  !== baseline.address ||
      form.timezone !== baseline.timezone ||
      form.isActive !== baseline.isActive
    )
  }, [form, baseline])

  const canSave = !saving && dirty

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={branch ? 'Edit Branch' : 'Add Branch'}
      width="max-w-lg"
    >
      <div className="px-4 sm:px-6 py-5 flex flex-col gap-4 max-h-[65vh] overflow-y-auto">
        <Input
          label="Branch name"
          value={form.name}
          placeholder="Bole"
          onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
          error={fieldErrors.name}
        />
        <Input
          label="Address"
          value={form.address}
          placeholder="Bole Road, Addis Ababa"
          onChange={e => setForm(f => ({ ...f, address: e.target.value }))}
          error={fieldErrors.address}
        />
        <Input
          label="Timezone"
          value={form.timezone}
          placeholder={DEFAULT_TIMEZONE}
          onChange={e => setForm(f => ({ ...f, timezone: e.target.value }))}
          error={fieldErrors.timezone}
        />

        <p className="text-[11px] text-ink-3 -mt-2">
          Email is read-only — it is not settable through the API.
        </p>

        {branch && (
          <Toggle
            checked={form.isActive}
            onChange={v => setForm(f => ({ ...f, isActive: v }))}
            label="Active"
          />
        )}
      </div>

      <div className="px-4 sm:px-6 pb-5 sm:pb-6 flex gap-2 sm:gap-3 justify-end border-t border-line pt-4">
        <Button variant="ghost" onClick={onClose} disabled={saving}>Cancel</Button>
        <Button onClick={handleSave} loading={saving} disabled={!canSave}>
          {branch ? 'Save changes' : 'Add branch'}
        </Button>
      </div>
    </Modal>
  )
}

/* ------------------------------------------------------------------ */
/*  Hours editor (§6.2 — full replace of all 7 days)                   */
/* ------------------------------------------------------------------ */

function HoursEditor({
  businessId, branchId, schedules,
}: {
  businessId: string
  branchId: string
  schedules: WeeklySchedule[]
}) {
  const toast = useToast()
  const [rows, setRows] = useState<WeeklySchedule[]>(
    schedules.length ? schedules : DEFAULT_SCHEDULES,
  )
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setRows(schedules.length ? schedules : DEFAULT_SCHEDULES)
  }, [schedules])

  function updateRow(day: DayOfWeek, patch: Partial<WeeklySchedule>) {
    setRows(prev => prev.map(r => (r.dayOfWeek === day ? { ...r, ...patch } : r)))
  }

  function updateInterval(
    day: DayOfWeek, idx: number, key: 'startTime' | 'endTime', value: string,
  ) {
    setRows(prev => prev.map(r => {
      if (r.dayOfWeek !== day) return r
      const intervals = [...r.intervals]
      intervals[idx] = { ...intervals[idx], [key]: value }
      return { ...r, intervals }
    }))
  }

  function addInterval(day: DayOfWeek) {
    setRows(prev => prev.map(r =>
      r.dayOfWeek === day
        ? { ...r, intervals: [...r.intervals, { startTime: '09:00', endTime: '18:00' }] }
        : r,
    ))
  }

  function removeInterval(day: DayOfWeek, idx: number) {
    setRows(prev => prev.map(r =>
      r.dayOfWeek === day
        ? { ...r, intervals: r.intervals.filter((_, i) => i !== idx) }
        : r,
    ))
  }

  async function save() {
    setSaving(true)
    try {
      const payload = {
        days: rows
          .slice()
          .sort((a, b) => a.dayOfWeek - b.dayOfWeek)
          .map(r => ({
            dayOfWeek: r.dayOfWeek,
            isClosed: r.isClosed,
            intervals: r.isClosed
              ? []
              : r.intervals.map(i => ({ start: i.startTime, end: i.endTime })),
          })),
      }
      const updated = await branchesApi.weeklyHours.put(businessId, branchId, payload)
      if (Array.isArray(updated) && updated.length) setRows(updated)
      toast.success('Working hours saved')
    } catch (err) {
      console.error('[branches] save weekly hours failed', err)
      toast.error(extractErrorMessage(err, 'Could not save working hours.'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="max-w-2xl flex flex-col gap-3">
      <div className="bg-surface rounded-2xl border border-line overflow-hidden">
        {rows
          .slice()
          .sort((a, b) => a.dayOfWeek - b.dayOfWeek)
          .map(row => (
            <div
              key={row.dayOfWeek}
              className="flex items-start gap-4 px-5 py-3.5 border-b border-line last:border-0"
            >
              <span className="w-24 text-sm font-medium text-ink flex-shrink-0 pt-1">
                {DAY_LABELS[row.dayOfWeek]}
              </span>
              <Toggle
                checked={!row.isClosed}
                onChange={v =>
                  updateRow(row.dayOfWeek, {
                    isClosed: !v,
                    intervals:
                      v && row.intervals.length === 0
                        ? [{ startTime: '09:00', endTime: '18:00' }]
                        : row.intervals,
                  })
                }
              />
              {row.isClosed ? (
                <span className="text-sm text-ink-3 pt-1">Closed</span>
              ) : (
                <div className="flex flex-col gap-2 flex-1">
                  {row.intervals.map((iv, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <input
                        type="time"
                        value={iv.startTime}
                        onChange={e => updateInterval(row.dayOfWeek, idx, 'startTime', e.target.value)}
                        className="h-8 px-2 text-sm rounded-lg border border-line bg-surface"
                      />
                      <span className="text-ink-3 text-sm">–</span>
                      <input
                        type="time"
                        value={iv.endTime}
                        onChange={e => updateInterval(row.dayOfWeek, idx, 'endTime', e.target.value)}
                        className="h-8 px-2 text-sm rounded-lg border border-line bg-surface"
                      />
                      <button
                        onClick={() => removeInterval(row.dayOfWeek, idx)}
                        className="text-xs text-ink-3 hover:text-[#B03A3A] px-1"
                        aria-label="Remove interval"
                      >×</button>
                    </div>
                  ))}
                  <button
                    onClick={() => addInterval(row.dayOfWeek)}
                    className="text-xs text-ink-3 hover:text-ink self-start"
                  >+ Add interval</button>
                </div>
              )}
            </div>
          ))}
      </div>
      <div className="flex items-center gap-3">
        <Button size="sm" onClick={save} loading={saving} disabled={saving}>
          Save hours
        </Button>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Date overrides editor (§6.3)                                       */
/* ------------------------------------------------------------------ */

function DateOverridesEditor({
  businessId, branchId, overrides, onChange,
}: {
  businessId: string
  branchId: string
  overrides: DateOverride[]
  onChange: (next: DateOverride[]) => void
}) {
  const toast = useToast()
  const [date, setDate] = useState('')
  const [isClosed, setIsClosed] = useState(true)
  const [start, setStart] = useState('09:00')
  const [end, setEnd] = useState('18:00')
  const [busy, setBusy] = useState(false)

  async function add() {
    if (!date) return
    setBusy(true)
    try {
      const created = await branchesApi.dateOverrides.create(businessId, branchId, {
        date,
        isClosed,
        intervals: isClosed ? [] : [{ start, end }],
      })
      onChange([...overrides, created])
      setDate('')
      toast.success('Override added')
    } catch (err) {
      console.error('[branches] add override failed', err)
      toast.error(extractErrorMessage(err, 'Could not add the override.'))
    } finally {
      setBusy(false)
    }
  }

  async function remove(id: string) {
    setBusy(true)
    try {
      await branchesApi.dateOverrides.remove(businessId, branchId, id)
      onChange(overrides.filter(o => o.id !== id))
      toast.success('Override removed')
    } catch (err) {
      console.error('[branches] remove override failed', err)
      toast.error(extractErrorMessage(err, 'Could not remove the override.'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="max-w-2xl flex flex-col gap-3">
      <div className="bg-surface rounded-2xl border border-line overflow-hidden">
        {overrides.length === 0 ? (
          <p className="text-sm text-ink-3 py-8 text-center">No date overrides.</p>
        ) : (
          overrides.map(o => (
            <div
              key={o.id}
              className="flex items-center gap-4 px-5 py-3.5 border-b border-line last:border-0"
            >
              <span className="text-sm text-ink w-40">
                {new Date(o.date).toISOString().slice(0, 10)}
              </span>
              {o.isClosed ? (
                <span className="text-sm text-ink-3 flex-1">Closed</span>
              ) : (
                <span className="text-sm text-ink-2 flex-1">
                  {o.intervals.map(i => `${i.startTime}–${i.endTime}`).join(', ')}
                </span>
              )}
              <button
                onClick={() => void remove(o.id)}
                disabled={busy}
                className="text-xs text-[#B03A3A] hover:text-[#8a2b2b] disabled:opacity-50"
              >Remove</button>
            </div>
          ))
        )}
      </div>

      <div className="bg-surface rounded-2xl border border-line p-5 flex flex-col gap-3">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
          <Input
            label="Date"
            type="date"
            value={date}
            onChange={e => setDate(e.target.value)}
          />
          <div className="flex items-center h-10">
            <Toggle checked={isClosed} onChange={setIsClosed} label="Closed" />
          </div>
          {!isClosed && (
            <div className="flex items-center gap-2">
              <input
                type="time"
                value={start}
                onChange={e => setStart(e.target.value)}
                className="h-10 px-2 text-sm rounded-lg border border-line bg-surface"
              />
              <span className="text-ink-3 text-sm">–</span>
              <input
                type="time"
                value={end}
                onChange={e => setEnd(e.target.value)}
                className="h-10 px-2 text-sm rounded-lg border border-line bg-surface"
              />
            </div>
          )}
        </div>
        <Button size="sm" onClick={add} loading={busy} disabled={busy || !date}>
          Add override
        </Button>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Phones editor (§5.5)                                               */
/* ------------------------------------------------------------------ */

function PhonesEditor({
  businessId, branchId, phones, onChange,
}: {
  businessId: string
  branchId: string
  phones: BranchPhone[]
  onChange: (phones: BranchPhone[]) => void
}) {
  const toast = useToast()
  const [newPhone, setNewPhone] = useState('')
  const [label, setLabel] = useState('')
  const [busy, setBusy] = useState(false)

  async function add() {
    const normalized = normalizePhone(newPhone.trim())
    if (!normalized) {
      toast.error('Phone must be E.164, e.g. +251911223344 or 0911223344')
      return
    }
    setBusy(true)
    try {
      const created = await branchesApi.phones.create(businessId, branchId, {
        phoneNumber: normalized,
        label: label.trim() || undefined,
        isPrimary: phones.length === 0,
      })

      const row: BranchPhone = {
        ...created,
        phone: created.phone ?? normalized,
        isPrimary: !!created.isPrimary,
        isActive: created.isActive ?? true,
      }

      const next = row.isPrimary
        ? [...phones.map(p => ({ ...p, isPrimary: false })), row]
        : [...phones, row]

      onChange(next)
      setNewPhone('')
      setLabel('')
      toast.success('Phone added')
    } catch (err) {
      console.error('[branches] add phone failed', err)
      toast.error(extractErrorMessage(err, 'Could not add the phone number.'))
    } finally {
      setBusy(false)
    }
  }

  async function setPrimary(phoneId: string) {
    setBusy(true)
    try {
      const updated = await branchesApi.phones.setPrimary(businessId, branchId, phoneId)
      onChange(phones.map(p => (p.id === phoneId ? { ...updated, isPrimary: true } : { ...p, isPrimary: false })))
      toast.success('Primary phone updated')
    } catch (err) {
      console.error('[branches] set primary failed', err)
      toast.error(extractErrorMessage(err, 'Could not set the primary phone.'))
    } finally {
      setBusy(false)
    }
  }

  async function remove(phoneId: string) {
    setBusy(true)
    try {
      await branchesApi.phones.remove(businessId, branchId, phoneId)
      onChange(phones.filter(p => p.id !== phoneId))
      toast.success('Phone removed')
    } catch (err) {
      console.error('[branches] remove phone failed', err)
      toast.error(extractErrorMessage(err, 'Could not remove the phone number.'))
    } finally {
      setBusy(false)
    }
  }

  async function toggleActive(phoneId: string, isActive: boolean) {
    setBusy(true)
    try {
      const updated = await branchesApi.phones.update(businessId, branchId, phoneId, { isActive })
      onChange(phones.map(p => (p.id === phoneId ? { ...p, ...updated } : p)))
    } catch (err) {
      console.error('[branches] toggle phone failed', err)
      toast.error(extractErrorMessage(err, 'Could not update the phone.'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="max-w-2xl flex flex-col gap-3">
      <div className="bg-surface rounded-2xl border border-line overflow-hidden">
        {phones.length === 0 ? (
          <p className="text-sm text-ink-3 py-8 text-center">No phone numbers yet.</p>
        ) : (
          phones.map(p => (
            <div
              key={p.id}
              className="flex items-center gap-3 px-5 py-3.5 border-b border-line last:border-0"
            >
              <span className="text-sm text-ink flex-1 truncate">{p.phone}</span>
              {p.label && <span className="text-xs text-ink-3 flex-shrink-0">{p.label}</span>}
              {p.isPrimary && (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#EAF5EC] text-[#2A5F30] font-medium flex-shrink-0">
                  Primary
                </span>
              )}
              <Toggle
                checked={p.isActive}
                onChange={v => void toggleActive(p.id, v)}
              />
              {!p.isPrimary && (
                <button
                  onClick={() => void setPrimary(p.id)}
                  disabled={busy}
                  className="text-xs text-ink-3 hover:text-ink disabled:opacity-50 flex-shrink-0"
                >Make primary</button>
              )}
              <button
                onClick={() => void remove(p.id)}
                disabled={busy}
                className="text-xs text-[#B03A3A] hover:text-[#8a2b2b] disabled:opacity-50 flex-shrink-0"
              >Remove</button>
            </div>
          ))
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_auto] gap-2 items-end">
        <Input
          label="Phone (E.164)"
          value={newPhone}
          placeholder="+251911223344"
          onChange={e => setNewPhone(e.target.value)}
        />
        <Input
          label="Label (optional)"
          value={label}
          placeholder="Front desk"
          onChange={e => setLabel(e.target.value)}
        />
        <Button
          size="sm"
          onClick={add}
          loading={busy}
          disabled={busy || !newPhone.trim()}
        >
          Add
        </Button>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Sub-components                                                     */
/* ------------------------------------------------------------------ */

function Stat({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="flex-shrink-0">
      <p className="text-xs text-ink-3">{label}</p>
      <p className="text-lg font-semibold text-ink mt-0.5">
        {value} <span className="text-sm font-normal text-ink-3">{sub}</span>
      </p>
    </div>
  )
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between px-5 py-3.5 gap-3">
      <span className="text-sm text-ink-3 flex-shrink-0">{label}</span>
      <span className="text-sm text-ink text-right truncate">{value}</span>
    </div>
  )
}

function Avatar({ name, size = 'md' }: { name: string; size?: 'sm' | 'md' | 'lg' }) {
  const initials = name.split(' ').map(p => p[0]).filter(Boolean).join('').slice(0, 2).toUpperCase()
  const dim = size === 'lg' ? 'w-12 h-12 text-base' : size === 'sm' ? 'w-7 h-7 text-[10px]' : 'w-9 h-9 text-xs'
  return (
    <div className={`${dim} rounded-full bg-warm flex items-center justify-center font-semibold text-ink-2 flex-shrink-0`}>
      {initials || '?'}
    </div>
  )
}

function LoadingState({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <svg className="animate-spin text-ink-3 mb-4" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 12a9 9 0 11-6.219-8.56" />
      </svg>
      <p className="text-ink-3 text-sm">{label}</p>
    </div>
  )
}

function PlusIcon() { return <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 5v14M5 12h14"/></svg> }
function BranchIcon() { return <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><path d="M9 22V12h6v10"/></svg> }

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
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