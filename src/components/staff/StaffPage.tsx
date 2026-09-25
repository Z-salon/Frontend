import { useEffect, useMemo, useState } from 'react'
import type {
  Branch,
  Service,
  ServiceCategory,
  Staff,
  StaffDetail,
  StaffStatus,
  StaffServiceQualification,
} from '../../types/api'
import { Button, Input, Textarea, Toggle, Modal } from '../ui'
import { EmptyState } from '../services/ServicesPage'
import { useToast } from '../ui/Toast'
import { useBusiness } from '../../contexts/BusinessContext'
import { useBranch } from '../../contexts/BranchContext'
import { staffApi } from '../../api/staff.api'
import { branchesApi } from '../../api/branches.api'
import { servicesApi } from '../../api/services.api'
import { serviceCategoriesApi } from '../../api/service-categories.api'

/* ------------------------------------------------------------------ */
/*  Phone + validation helpers                                         */
/* ------------------------------------------------------------------ */

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

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */

export function StaffPage() {
  const toast = useToast()
  const { activeBusinessId } = useBusiness()
  const { activeBranchFilter } = useBranch()

  const [staff,      setStaff]      = useState<Staff[]>([])
  const [branches,   setBranches]   = useState<Branch[]>([])
  const [services,   setServices]   = useState<Service[]>([])
  const [categories, setCategories] = useState<ServiceCategory[]>([])

  const [loading,  setLoading]  = useState(false)
  const [selected, setSelected] = useState<StaffDetail | null>(null)

  const [showModal, setShowModal] = useState(false)
  const [editing,   setEditing]   = useState<Staff | null>(null)

  /**
   * View transition state.
   * - `view` picks which screen is mounted.
   * - `detailVisible` drives the detail's enter/exit animation.
   * The list is always visible when mounted; only the detail animates.
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
      const [staffList, brList, svcList, catList] = await Promise.all([
        staffApi.list(activeBusinessId, { branchId: activeBranchFilter }),
        branchesApi.list(activeBusinessId),
        servicesApi.list(activeBusinessId),
        serviceCategoriesApi.list(activeBusinessId),
      ])
      setStaff(normalizeArray<Staff>(staffList))
      setBranches(normalizeArray<Branch>(brList).filter(b => b.isActive))
      setServices(normalizeArray<Service>(svcList))
      setCategories(normalizeArray<ServiceCategory>(catList))
    } catch (err) {
      console.error('[staff] load failed', err)
      toast.error(extractErrorMessage(err, 'Could not load staff.'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void refresh()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeBusinessId, activeBranchFilter])

  useEffect(() => {
    if (!selected) return
    if (!loading && !staff.some(s => s.id === selected.id)) {
      closeDetail()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeBranchFilter, loading])

  /* ---------------------------------------------------------------- */
  /*  Detail transitions                                              */
  /* ---------------------------------------------------------------- */

  /**
   * Opens the detail view.
   *
   * The list already has the shallow `Staff` row; we build a partial
   * `StaffDetail` from it so the detail can render immediately, then
   * swap in the full payload when the network responds.
   */
  async function openDetail(member: Staff) {
    const optimistic: StaffDetail = {
      ...member,
      branch: member.branch ?? { id: member.branchId, name: '—', isActive: true },
      categoryQualifications: [],
      serviceQualifications: [],
    }
    setSelected(optimistic)
    setView('detail')
    requestAnimationFrame(() => setDetailVisible(true))

    try {
      const detail = await staffApi.get(member.id)
      setSelected(prev => (prev?.id === detail.id ? detail : prev))
    } catch (err) {
      console.error('[staff] detail load failed', err)
      toast.error(extractErrorMessage(err, 'Could not load staff details.'))
    }
  }

  function closeDetail() {
    setDetailVisible(false)
    setTimeout(() => {
      setView('list')
      setSelected(null)
    }, 220)
  }

  async function reloadDetail(): Promise<StaffDetail | null> {
    if (!selected) return null
    try {
      const detail = await staffApi.get(selected.id)
      setSelected(detail)
      return detail
    } catch (err) {
      console.error('[staff] detail reload failed', err)
      return null
    }
  }

  /**
   * Fetches a staff member's full detail regardless of what's currently
   * in `selected`. Used by handleSave so qualification diffs always run
   * against fresh server state instead of a possibly-null/stale snapshot.
   */
  async function fetchDetail(id: string): Promise<StaffDetail | null> {
    try {
      return await staffApi.get(id)
    } catch (err) {
      console.error('[staff] detail fetch failed', err)
      return null
    }
  }

  /* ---------------------------------------------------------------- */
  /*  Actions                                                         */
  /* ---------------------------------------------------------------- */

  function openAdd() {
    setEditing(null)
    setShowModal(true)
  }

  function openEdit(member: Staff) {
    setEditing(member)
    setShowModal(true)
  }

  async function handleSave(payload: StaffFormPayload, existingId: string | null) {
    if (!activeBusinessId) return

    const normalizedPhone = payload.phone.trim()
      ? normalizePhone(payload.phone)
      : null

    if (payload.phone.trim() && !normalizedPhone) {
      toast.error('Phone must be a valid number, e.g. +251911223344 or 0911223344')
      return
    }

    const email = payload.email.trim()
    if (email && !EMAIL_REGEX.test(email)) {
      toast.error('Enter a valid email address.')
      return
    }

    try {
      if (existingId) {
        await staffApi.update(existingId, {
          firstName: payload.firstName.trim(),
          lastName:  payload.lastName.trim(),
          email:     email || undefined,
          phone:     normalizedPhone ?? undefined,
          title:     payload.title.trim() || undefined,
          bio:       payload.bio.trim() || undefined,
          status:    payload.status,
        })

        const current = editing
        if (current && current.branchId !== payload.branchId) {
          await staffApi.moveBranch(existingId, payload.branchId)
        }

        // Always fetch fresh detail — never trust `selected`, which may be
        // null (edit opened from the list) or stale (a prior save refreshed it).
        const fresh = await fetchDetail(existingId)

        await syncCategoryQualifications(
          existingId,
          payload.categoryIds,
          fresh?.categoryQualifications ?? [],
        )
        await syncServiceQualifications(
          existingId,
          payload.serviceIds,
          fresh?.serviceQualifications ?? [],
        )
      } else {
        const created = await staffApi.create(activeBusinessId, {
          branchId:  payload.branchId,
          firstName: payload.firstName.trim(),
          lastName:  payload.lastName.trim(),
          email:     email || undefined,
          phone:     normalizedPhone ?? undefined,
          title:     payload.title.trim() || undefined,
          bio:       payload.bio.trim() || undefined,
        })

        await syncCategoryQualifications(created.id, payload.categoryIds, [])
        await syncServiceQualifications(created.id, payload.serviceIds, [])
      }

      toast.success(existingId ? 'Staff updated' : 'Staff added')
      setShowModal(false)

      if (existingId && selected?.id === existingId) {
        await reloadDetail()
      }
      await refresh()
    } catch (err) {
      console.error('[staff] save failed', err)
      console.error('[staff] err.details', (err as any)?.details)
      console.error('[staff] err.response?.data', (err as any)?.response?.data)
      toast.error(extractErrorMessage(err, 'Could not save the staff member.'))
    }
  }

  async function syncCategoryQualifications(
    staffId: string,
    desiredCategoryIds: string[],
    current: StaffDetail['categoryQualifications'],
  ) {
    const currentActive = current.filter(c => c.isActive).map(c => c.categoryId)
    const desired = new Set(desiredCategoryIds)

    for (const categoryId of desiredCategoryIds) {
      if (!currentActive.includes(categoryId)) {
        try {
          await staffApi.categoryQualifications.add(staffId, categoryId)
        } catch (err: any) {
          if (err?.response?.status !== 409 && err?.status !== 409) {
            console.warn('[staff] add category qual failed', categoryId, err)
          }
        }
      }
    }
    for (const categoryId of currentActive) {
      if (!desired.has(categoryId)) {
        try {
          await staffApi.categoryQualifications.remove(staffId, categoryId)
        } catch (err) {
          console.warn('[staff] remove category qual failed', categoryId, err)
        }
      }
    }
  }

  async function syncServiceQualifications(
    staffId: string,
    desiredServiceIds: string[],
    current: StaffServiceQualification[],
  ) {
    const currentActive = current.filter(s => s.isActive).map(s => s.serviceId)
    const desired = new Set(desiredServiceIds)

    for (const serviceId of desiredServiceIds) {
      if (!currentActive.includes(serviceId)) {
        try {
          await staffApi.serviceQualifications.add(staffId, serviceId)
        } catch (err: any) {
          if (err?.response?.status !== 409 && err?.status !== 409) {
            console.warn('[staff] add service qual failed', serviceId, err)
          }
        }
      }
    }
    for (const serviceId of currentActive) {
      if (!desired.has(serviceId)) {
        try {
          await staffApi.serviceQualifications.remove(staffId, serviceId)
        } catch (err) {
          console.warn('[staff] remove service qual failed', serviceId, err)
        }
      }
    }
  }

  /**
   * Toggles the staff member's active status. While the request is in
   * flight, `togglingStatusId` holds the member id so the detail view can
   * show a spinner on the toggle button.
   */
  const [togglingStatusId, setTogglingStatusId] = useState<string | null>(null)

  async function toggleStatus(member: Staff) {
    setTogglingStatusId(member.id)
    try {
      const next: StaffStatus = member.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE'
      await staffApi.update(member.id, { status: next })
      toast.success(next === 'ACTIVE' ? 'Staff activated' : 'Staff deactivated')
      if (selected?.id === member.id) {
        await reloadDetail()
      }
      await refresh()
    } catch (err) {
      console.error('[staff] toggle status failed', err)
      toast.error(extractErrorMessage(err, 'Could not change the staff status.'))
    } finally {
      setTogglingStatusId(null)
    }
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
                <h2 className="font-display text-xl sm:text-2xl lg:text-[1.75rem] text-ink leading-none">Staff</h2>
                <p className="text-ink-3 text-xs sm:text-sm mt-1.5">Manage your team and their services.</p>
              </div>
              <Button onClick={openAdd} size="sm" disabled={loading || branches.length === 0} className="self-start sm:self-auto flex-shrink-0">
                <PlusIcon /> Add Staff
              </Button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-4 sm:px-6 lg:px-8 py-5 sm:py-6">
            {loading && staff.length === 0 ? (
              <LoadingState label="Loading staff…" />
            ) : staff.length === 0 ? (
              <EmptyState
                icon={<PersonIcon />}
                title="No staff members yet"
                description={
                  branches.length === 0
                    ? 'Add a branch first, then add staff.'
                    : 'Add your team to start managing appointments.'
                }
                action={
                  branches.length === 0
                    ? undefined
                    : <Button onClick={openAdd} size="sm"><PlusIcon /> Add Staff</Button>
                }
              />
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                {staff.map(member => {
                  const isActive = member.status === 'ACTIVE'
                  return (
                    <button
                      key={member.id}
                      type="button"
                      onClick={() => void openDetail(member)}
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
                      <div className="flex items-start justify-between mb-4">
                        <Avatar name={`${member.firstName} ${member.lastName}`} size="lg" />
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${isActive ? 'bg-[#EAF5EC] text-[#2A5F30]' : 'bg-line text-ink-3'}`}>
                          {isActive ? 'Active' : 'Inactive'}
                        </span>
                      </div>
                      <p className="font-semibold text-ink">{member.firstName} {member.lastName}</p>
                      <p className="text-sm text-ink-3 mt-0.5 truncate">{member.title ?? '—'}</p>
                      {member.branch && (
                        <div className="flex items-center gap-2 mt-3">
                          <span className="text-xs text-ink-3 truncate">{member.branch.name}</span>
                        </div>
                      )}
                      <div className="flex items-center justify-between mt-4 pt-4 border-t border-line gap-3">
                        <span className="text-xs text-ink-3 truncate">{member.phone ?? 'No phone'}</span>
                        <span className="text-xs text-ink-3 truncate">{member.email ?? ''}</span>
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
          <StaffDetailView
            detail={selected}
            onBack={closeDetail}
            onEdit={() => openEdit(selected)}
            onToggleStatus={() => toggleStatus(selected)}
            togglingStatus={togglingStatusId === selected.id}
          />
        </div>
      )}

      {/* Single modal — owned by the parent, mounted in both views. */}
      <StaffFormModal
        open={showModal}
        onClose={() => setShowModal(false)}
        member={editing}
        initialDetail={editing && selected?.id === editing.id ? selected : undefined}
        categories={categories}
        services={services}
        branches={branches}
        onSave={handleSave}
      />
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Detail view                                                        */
/* ------------------------------------------------------------------ */

function StaffDetailView({
  detail, onBack, onEdit, onToggleStatus, togglingStatus,
}: {
  detail: StaffDetail
  onBack: () => void
  onEdit: () => void
  onToggleStatus: () => void
  togglingStatus: boolean
}) {
  const [activeTab, setActiveTab] = useState<'overview' | 'qualifications' | 'feedback'>('overview')

  const isActive = detail.status === 'ACTIVE'
  const activeCats = detail.categoryQualifications.filter(q => q.isActive)
  const activeSvcs = detail.serviceQualifications.filter(q => q.isActive)

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="px-4 sm:px-6 lg:px-8 py-4 sm:py-5 bg-surface border-b border-line flex-shrink-0">
        <button onClick={onBack} className="flex items-center gap-2 text-sm text-ink-3 hover:text-ink transition-colors mb-5">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 18l-6-6 6-6"/></svg>
          All staff
        </button>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-4 min-w-0">
            <Avatar name={`${detail.firstName} ${detail.lastName}`} size="lg" />
            <div className="min-w-0">
              <div className="flex items-center gap-2.5 flex-wrap">
                <h2 className="font-display text-xl sm:text-2xl text-ink truncate">{detail.firstName} {detail.lastName}</h2>
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium flex-shrink-0 ${isActive ? 'bg-[#EAF5EC] text-[#2A5F30]' : 'bg-line text-ink-3'}`}>
                  {isActive ? 'Active' : 'Inactive'}
                </span>
              </div>
              <p className="text-ink-3 text-sm mt-0.5">{detail.title ?? '—'}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 self-start sm:self-auto flex-shrink-0">
            <Button
              variant="secondary"
              size="sm"
              onClick={onToggleStatus}
              loading={togglingStatus}
              disabled={togglingStatus}
              className={isActive ? '!text-[#B03A3A] !border-[#E5B5B5] hover:!bg-[#FBEDED]' : ''}
            >
              {isActive ? 'Deactivate' : 'Activate'}
            </Button>
            <Button size="sm" onClick={onEdit} disabled={togglingStatus}>Edit</Button>
          </div>
        </div>

        <div className="flex items-center gap-4 sm:gap-6 mt-5 pt-5 border-t border-line overflow-x-auto">
          <Stat label="Category quals" value={String(activeCats.length)} sub="active" />
          <div className="w-px h-8 bg-line flex-shrink-0" />
          <Stat label="Service quals" value={String(activeSvcs.length)} sub="active" />
          <div className="w-px h-8 bg-line flex-shrink-0" />
          <Stat label="Branch" value={detail.branch.name} sub="home" />
        </div>

        <div className="flex gap-1 mt-5 overflow-x-auto">
          {(['overview', 'qualifications', 'feedback'] as const).map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)}
              className={`h-8 px-4 text-xs font-medium rounded-xl transition-colors capitalize whitespace-nowrap ${activeTab === tab ? 'bg-ink text-surface' : 'text-ink-3 hover:text-ink hover:bg-warm-subtle'}`}>
              {tab}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 sm:px-6 lg:px-8 py-5 sm:py-6">
        {activeTab === 'overview' && (
          <div className="max-w-2xl flex flex-col gap-6">
            <InfoSection title="Contact">
              {detail.phone && <Row label="Phone" value={detail.phone} />}
              {detail.email && <Row label="Email" value={detail.email} />}
            </InfoSection>
            {detail.bio && (
              <InfoSection title="Bio">
                <p className="text-sm text-ink-2 leading-relaxed">{detail.bio}</p>
              </InfoSection>
            )}
            <InfoSection title="Home branch">
              <span className="px-3 py-1.5 rounded-xl bg-warm-subtle text-ink-2 text-sm">{detail.branch.name}</span>
            </InfoSection>
          </div>
        )}

        {activeTab === 'qualifications' && (
          <div className="max-w-2xl flex flex-col gap-6">
            <InfoSection title="Categories they work in">
              <div className="flex flex-wrap gap-2">
                {activeCats.length === 0
                  ? <p className="text-sm text-ink-3">No category qualifications.</p>
                  : activeCats.map(q => (
                    <span key={q.id} className="px-3 py-1.5 rounded-xl bg-warm-subtle text-ink-2 text-sm">
                      {q.category?.name ?? q.categoryId}
                    </span>
                  ))
                }
              </div>
            </InfoSection>

            <InfoSection title="Services they can perform">
              <div className="bg-surface rounded-xl border border-line overflow-hidden">
                {activeSvcs.length === 0
                  ? <p className="text-sm text-ink-3 p-4">No service qualifications.</p>
                  : activeSvcs.map(q => (
                    <div key={q.id} className="flex items-center justify-between px-4 py-3 border-b border-line last:border-0">
                      <div>
                        <p className="text-sm font-medium text-ink">{q.service?.name ?? q.serviceId}</p>
                        <p className="text-xs text-ink-3 capitalize">{q.proficiencyLevel.toLowerCase()}</p>
                      </div>
                    </div>
                  ))
                }
              </div>
            </InfoSection>
          </div>
        )}

        {activeTab === 'feedback' && (
          <div className="max-w-2xl flex flex-col gap-3">
            <p className="text-ink-3 text-sm py-10 text-center">
              Feedback integration coming soon.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Form modal                                                         */
/* ------------------------------------------------------------------ */

type StaffFormPayload = {
  branchId: string
  firstName: string
  lastName: string
  email: string
  phone: string
  title: string
  bio: string
  status: StaffStatus
  categoryIds: string[]
  serviceIds: string[]
}

function StaffFormModal({
  open, onClose, member, initialDetail, categories, services, branches, onSave,
}: {
  open: boolean
  onClose: () => void
  member: Staff | null
  initialDetail?: StaffDetail
  categories: ServiceCategory[]
  services: Service[]
  branches: Branch[]
  onSave: (payload: StaffFormPayload, existingId: string | null) => Promise<void>
}) {
  const [saving, setSaving] = useState(false)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [form, setForm] = useState<StaffFormPayload>(() => blankForm(branches))
  const [baseline, setBaseline] = useState<StaffFormPayload>(() => blankForm(branches))

  useEffect(() => {
    if (!open) return
    setFieldErrors({})
    if (member) {
      const detail = initialDetail?.id === member.id ? initialDetail : null

      // Pre-fill only with qualifications that are active AND still
      // offered at the member's home branch, so the form doesn't show
      // a checkmark next to something that would 400 on save.
      const seedCategoryIds = detail
        ? detail.categoryQualifications
            .filter(q => q.isActive)
            .map(q => q.categoryId)
            .filter(id =>
              categories.some(c =>
                c.id === id &&
                c.status === 'ACTIVE' &&
                c.branchAssignments.some(a => a.branchId === member.branchId && a.isActive),
              ),
            )
        : []

      const seedServiceIds = detail
        ? detail.serviceQualifications
            .filter(q => q.isActive)
            .map(q => q.serviceId)
            .filter(id =>
              services.some(s =>
                s.id === id &&
                s.status === 'ACTIVE' &&
                s.branchAssignments.some(a => a.branchId === member.branchId && a.isActive),
              ),
            )
        : []

      const seeded: StaffFormPayload = {
        branchId:  member.branchId,
        firstName: member.firstName,
        lastName:  member.lastName,
        email:     member.email ?? '',
        phone:     member.phone ?? '',
        title:     member.title ?? '',
        bio:       member.bio ?? '',
        status:    member.status,
        categoryIds: seedCategoryIds,
        serviceIds:  seedServiceIds,
      }
      setForm(seeded)
      setBaseline(seeded)
    } else {
      const blank = blankForm(branches)
      setForm(blank)
      setBaseline(blank)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, member, initialDetail])

  /* ---------------------------------------------------------------- */
  /*  Branch-scoped options                                           */
  /* ---------------------------------------------------------------- */

  /**
   * Only categories that are actively assigned to the currently selected
   * home branch. The backend rejects qualifications at any other branch
   * (see §13.2).
   */
  const availableCategories = useMemo(() => {
    if (!form.branchId) return []
    return categories.filter(c =>
      c.status === 'ACTIVE' &&
      c.branchAssignments.some(a => a.branchId === form.branchId && a.isActive),
    )
  }, [categories, form.branchId])

  /**
   * Only services that are actively assigned to the currently selected
   * home branch. Same rule as categories (see §13.3).
   */
  const availableServices = useMemo(() => {
    if (!form.branchId) return []
    return services.filter(s =>
      s.status === 'ACTIVE' &&
      s.branchAssignments.some(a => a.branchId === form.branchId && a.isActive),
    )
  }, [services, form.branchId])

  /**
   * When the user changes the home branch, drop any selections that
   * are no longer offered at the new branch.
   */
  function setBranch(branchId: string) {
    setForm(f => {
      const nextCats = f.categoryIds.filter(id =>
        categories.some(c =>
          c.id === id &&
          c.status === 'ACTIVE' &&
          c.branchAssignments.some(a => a.branchId === branchId && a.isActive),
        ),
      )
      const nextSvcs = f.serviceIds.filter(id =>
        services.some(s =>
          s.id === id &&
          s.status === 'ACTIVE' &&
          s.branchAssignments.some(a => a.branchId === branchId && a.isActive),
        ),
      )
      return { ...f, branchId, categoryIds: nextCats, serviceIds: nextSvcs }
    })
  }

  function toggleService(id: string) {
    setForm(f => ({
      ...f,
      serviceIds: f.serviceIds.includes(id)
        ? f.serviceIds.filter(s => s !== id)
        : [...f.serviceIds, id],
    }))
  }
  function toggleCategory(id: string) {
    setForm(f => ({
      ...f,
      categoryIds: f.categoryIds.includes(id)
        ? f.categoryIds.filter(c => c !== id)
        : [...f.categoryIds, id],
    }))
  }

  function validate(): Record<string, string> {
    const e: Record<string, string> = {}

    if (!form.firstName.trim())          e.firstName = 'First name is required'
    else if (form.firstName.length > 100) e.firstName = 'Max 100 characters'

    if (!form.lastName.trim())          e.lastName = 'Last name is required'
    else if (form.lastName.length > 100) e.lastName = 'Max 100 characters'

    if (!form.branchId) e.branchId = 'Select a home branch'

    if (form.email.trim() && !EMAIL_REGEX.test(form.email.trim())) {
      e.email = 'Enter a valid email address'
    }

    if (form.phone.trim() && !normalizePhone(form.phone)) {
      e.phone = 'Use format +251911223344 or 0911223344'
    }

    if (form.title.length > 100) e.title = 'Max 100 characters'
    if (form.bio.length   > 1000) e.bio   = 'Max 1000 characters'

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
      await onSave(form, member?.id ?? null)
    } finally {
      setSaving(false)
    }
  }

  /**
   * True when the form differs from the baseline snapshot captured
   * when the modal opened. Used to gate the Save button so users can't
   * submit a no-op update.
   */
  const dirty = useMemo(() => {
    if (
      form.branchId  !== baseline.branchId  ||
      form.firstName !== baseline.firstName ||
      form.lastName  !== baseline.lastName  ||
      form.email     !== baseline.email     ||
      form.phone     !== baseline.phone     ||
      form.title     !== baseline.title     ||
      form.bio       !== baseline.bio       ||
      form.status    !== baseline.status
    ) {
      return true
    }
    if (form.categoryIds.length !== baseline.categoryIds.length) return true
    if (form.serviceIds.length  !== baseline.serviceIds.length)  return true
    const bCats = new Set(baseline.categoryIds)
    for (const id of form.categoryIds) if (!bCats.has(id)) return true
    const bSvcs = new Set(baseline.serviceIds)
    for (const id of form.serviceIds) if (!bSvcs.has(id)) return true
    return false
  }, [form, baseline])

  const canSave = !saving && dirty

  return (
    <Modal open={open} onClose={onClose} title={member ? 'Edit Staff' : 'Add Staff'} width="max-w-lg">
      <div className="px-4 sm:px-6 py-5 flex flex-col gap-4 max-h-[65vh] overflow-y-auto">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input
            label="First name"
            value={form.firstName}
            placeholder="Sara"
            onChange={e => setForm(f => ({ ...f, firstName: e.target.value }))}
            error={fieldErrors.firstName}
          />
          <Input
            label="Last name"
            value={form.lastName}
            placeholder="Kebede"
            onChange={e => setForm(f => ({ ...f, lastName: e.target.value }))}
            error={fieldErrors.lastName}
          />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input
            label="Phone"
            type="tel"
            value={form.phone}
            placeholder="+251911223344"
            onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
            error={fieldErrors.phone}
          />
          <Input
            label="Email (optional)"
            type="email"
            value={form.email}
            placeholder="sara@zsalon.com"
            onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
            error={fieldErrors.email}
          />
        </div>
        <Input
          label="Title / Position"
          value={form.title}
          placeholder="Senior Stylist"
          onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
          error={fieldErrors.title}
        />
        <Textarea
          label="Bio (optional)"
          rows={2}
          value={form.bio}
          placeholder="10 years of coloring experience"
          onChange={e => setForm(f => ({ ...f, bio: e.target.value }))}
        />

        {/* Home branch — pick this first; it filters the pickers below */}
        <div>
          <label className="text-sm font-medium text-ink-2 block mb-2">Home branch</label>
          <div className="flex gap-2 flex-wrap">
            {branches.map(b => (
              <button
                key={b.id}
                type="button"
                onClick={() => setBranch(b.id)}
                className={`px-3 py-1.5 rounded-xl text-xs border transition-all ${form.branchId === b.id ? 'border-ink bg-ink text-surface' : 'border-line bg-surface text-ink-2 hover:border-warm'}`}
              >
                {form.branchId === b.id ? '✓' : '+'} {b.name}
              </button>
            ))}
          </div>
          {fieldErrors.branchId && <p className="text-xs text-[#B06A6A] mt-2">{fieldErrors.branchId}</p>}
        </div>

        {/* Services — only those offered at the chosen branch */}
        <div>
          <label className="text-sm font-medium text-ink-2 block mb-2">
            Services they can perform <span className="text-ink-3 font-normal">(optional)</span>
          </label>
          <div className="bg-surface rounded-xl border border-line overflow-hidden max-h-44 overflow-y-auto">
            {!form.branchId ? (
              <p className="text-xs text-ink-3 p-3">Pick a home branch first.</p>
            ) : availableServices.length === 0 ? (
              <p className="text-xs text-ink-3 p-3">
                No services are offered at this branch. Assign services to the branch first.
              </p>
            ) : availableServices.map(svc => {
              const checked = form.serviceIds.includes(svc.id)
              return (
                <button
                  key={svc.id}
                  type="button"
                  onClick={() => toggleService(svc.id)}
                  className="flex items-center gap-3 px-4 py-2.5 border-b border-line last:border-0 w-full text-left hover:bg-bg transition-colors"
                >
                  <div className={`w-4 h-4 rounded flex-shrink-0 border-2 flex items-center justify-center ${checked ? 'border-ink bg-ink' : 'border-line'}`}>
                    {checked && <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3"><path d="M20 6L9 17l-5-5"/></svg>}
                  </div>
                  <span className="text-sm text-ink">{svc.name}</span>
                  <span className="text-xs text-ink-3 ml-auto">{svc.category?.name ?? ''}</span>
                </button>
              )
            })}
          </div>
        </div>

        {/* Categories — only those offered at the chosen branch */}
        <div>
          <label className="text-sm font-medium text-ink-2 block mb-2">
            Categories they work in <span className="text-ink-3 font-normal">(optional)</span>
          </label>
          {!form.branchId ? (
            <p className="text-xs text-ink-3">Pick a home branch first.</p>
          ) : availableCategories.length === 0 ? (
            <p className="text-xs text-ink-3">
              No categories are offered at this branch. Assign categories to the branch first.
            </p>
          ) : (
            <div className="flex gap-2 flex-wrap">
              {availableCategories.map(c => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => toggleCategory(c.id)}
                  className={`px-3 py-1.5 rounded-xl text-xs border transition-all ${form.categoryIds.includes(c.id) ? 'border-ink bg-ink text-surface' : 'border-line bg-surface text-ink-2 hover:border-warm'}`}
                >
                  {form.categoryIds.includes(c.id) ? '✓' : '+'} {c.name}
                </button>
              ))}
            </div>
          )}
        </div>

        <Toggle
          checked={form.status === 'ACTIVE'}
          onChange={v => setForm(f => ({ ...f, status: v ? 'ACTIVE' : 'INACTIVE' }))}
          label="Active"
        />
      </div>

      <div className="px-4 sm:px-6 pb-5 sm:pb-6 flex gap-2 sm:gap-3 justify-end border-t border-line pt-4">
        <Button variant="ghost" onClick={onClose} disabled={saving}>Cancel</Button>
        <Button onClick={handleSave} loading={saving} disabled={!canSave}>
          {member ? 'Save changes' : 'Add staff member'}
        </Button>
      </div>
    </Modal>
  )
}

function blankForm(branches: Branch[]): StaffFormPayload {
  return {
    branchId:    branches[0]?.id ?? '',
    firstName:   '',
    lastName:    '',
    email:       '',
    phone:       '',
    title:       '',
    bio:         '',
    status:      'ACTIVE',
    categoryIds: [],
    serviceIds:  [],
  }
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
    <div className="flex items-center justify-between py-1.5 gap-3">
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

function PlusIcon() { return <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 5v14M5 12h14"/></svg> }
function PersonIcon() { return <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2M12 11a4 4 0 100-8 4 4 0 000 8z"/></svg> }