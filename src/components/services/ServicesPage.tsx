import { useEffect, useMemo, useRef, useState } from 'react'
import type { Branch, EmployeeAssignmentMode, DepositPolicyType, Service, ServiceCategory, ServiceStatus } from '../../types/api'
import { Button, Input, Textarea, Toggle, Modal } from '../ui'
import { useToast } from '../ui/Toast'
import { useBusiness } from '../../contexts/BusinessContext'
import { useBranch } from '../../contexts/BranchContext'
import { servicesApi } from '../../api/services.api'
import { serviceCategoriesApi } from '../../api/service-categories.api'
import { branchesApi } from '../../api/branches.api'

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */

export function ServicesPage() {
  const toast = useToast()
  const { activeBusinessId } = useBusiness()
  const { activeBranchFilter } = useBranch()

  const [services,   setServices]   = useState<Service[]>([])
  const [categories, setCategories] = useState<ServiceCategory[]>([])
  const [branches,   setBranches]   = useState<Branch[]>([])

  const [loading, setLoading] = useState(false)
  const [selected,  setSelected]  = useState<Service | null>(null)
  const [showModal, setShowModal] = useState(false)
  const [editing,   setEditing]   = useState<Service | null>(null)

  // Detail-panel animation state.
  const [panelMounted, setPanelMounted] = useState(false)
  const [panelVisible, setPanelVisible] = useState(false)

  // Track whether we're on a wide (desktop) viewport so we can choose
  // between a side panel and a bottom sheet for the detail view.
  const [isDesktop, setIsDesktop] = useState(
    typeof window !== 'undefined' ? window.matchMedia('(min-width: 1024px)').matches : true,
  )

  useEffect(() => {
    if (typeof window === 'undefined') return
    const mq = window.matchMedia('(min-width: 1024px)')
    const handler = (e: MediaQueryListEvent) => setIsDesktop(e.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])

  /* ---------------------------------------------------------------- */
  /*  Data loading                                                    */
  /* ---------------------------------------------------------------- */

  async function refresh() {
    if (!activeBusinessId) return
    setLoading(true)
    try {
      const [svcList, catList, brList] = await Promise.all([
        servicesApi.list(activeBusinessId, { branchId: activeBranchFilter }),
        serviceCategoriesApi.list(activeBusinessId, { branchId: activeBranchFilter }),
        branchesApi.list(activeBusinessId),
      ])
      setServices(normalizeArray<Service>(svcList))
      setCategories(normalizeArray<ServiceCategory>(catList))
      setBranches(normalizeArray<Branch>(brList).filter(b => b.isActive))
    } catch (err) {
      console.error('[services] load failed', err)
      toast.error(extractErrorMessage(err, 'Could not load services.'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void refresh()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeBusinessId, activeBranchFilter])

  useEffect(() => {
    if (panelMounted) closePanel()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeBranchFilter])

  /* ---------------------------------------------------------------- */
  /*  Detail panel animation                                          */
  /* ---------------------------------------------------------------- */

  function openPanel(svc: Service) {
    setSelected(svc)
    setPanelMounted(true)
    requestAnimationFrame(() => setPanelVisible(true))
  }

  function closePanel() {
    setPanelVisible(false)
    setTimeout(() => {
      setPanelMounted(false)
      setSelected(null)
    }, 220)
  }

  function selectService(svc: Service) {
    if (selected?.id === svc.id) {
      closePanel()
    } else if (panelMounted) {
      setSelected(svc)
    } else {
      openPanel(svc)
    }
  }

  /* ---------------------------------------------------------------- */
  /*  Grouping                                                        */
  /* ---------------------------------------------------------------- */

  const grouped = useMemo(() => {
    const map = new Map<string, { category: ServiceCategory | null; list: Service[] }>()
    for (const c of categories) map.set(c.id, { category: c, list: [] })
    for (const s of services) {
      const key = s.categoryId
      if (!map.has(key)) {
        map.set(key, { category: null, list: [] })
      }
      map.get(key)!.list.push(s)
    }
    return Array.from(map.values()).filter(g => g.list.length > 0)
  }, [services, categories])

  /* ---------------------------------------------------------------- */
  /*  Actions                                                         */
  /* ---------------------------------------------------------------- */

  function openAdd() {
    if (categories.length === 0) {
      toast.error('Create a service category first.')
      return
    }
    setEditing(null)
    setShowModal(true)
  }

  function openEdit(svc: Service) {
    setEditing(svc)
    setShowModal(true)
    closePanel()
  }

  async function handleSave(payload: ServiceFormPayload, existingId: string | null) {
    if (!activeBusinessId) return
    try {
      if (existingId) {
        await servicesApi.update(existingId, {
          categoryId:             payload.categoryId,
          name:                   payload.name,
          description:            payload.description || undefined,
          durationMinutes:        payload.durationMinutes,
          price:                  payload.price,
          employeeAssignmentMode: payload.employeeAssignmentMode,
          showPriceToCustomer:    payload.showPriceToCustomer,
          depositPolicyType:      payload.depositPolicyType,
          depositAmount:          payload.depositAmount,
          status:                 payload.status,
        })

        await syncBranchAssignments(existingId, payload.branchIds, editing?.branchAssignments ?? [])
      } else {
        await servicesApi.create(activeBusinessId, {
          categoryId:             payload.categoryId,
          name:                   payload.name,
          description:            payload.description || undefined,
          durationMinutes:        payload.durationMinutes,
          price:                  payload.price,
          employeeAssignmentMode: payload.employeeAssignmentMode,
          showPriceToCustomer:    payload.showPriceToCustomer,
          depositPolicyType:      payload.depositPolicyType,
          depositAmount:          payload.depositAmount,
          branchIds:              payload.branchIds,
        })
      }

      toast.success(existingId ? 'Service updated' : 'Service created')
      setShowModal(false)
      await refresh()
    } catch (err) {
      console.error('[services] save failed', err)
      toast.error(extractErrorMessage(err, 'Could not save the service.'))
    }
  }

  async function syncBranchAssignments(
    serviceId: string,
    desiredBranchIds: string[],
    currentAssignments: Service['branchAssignments'],
  ) {
    const currentByBranch = new Map(currentAssignments.map(a => [a.branchId, a]))
    const desired = new Set(desiredBranchIds)

    for (const a of currentAssignments) {
      if (a.isActive && !desired.has(a.branchId)) {
        await servicesApi.branches.setActive(serviceId, a.branchId, false)
      }
    }
    for (const branchId of desiredBranchIds) {
      const existing = currentByBranch.get(branchId)
      if (!existing) {
        await servicesApi.branches.assign(serviceId, branchId)
      } else if (!existing.isActive) {
        await servicesApi.branches.setActive(serviceId, branchId, true)
      }
    }
  }

  async function handleCreateCategory(name: string): Promise<ServiceCategory | null> {
    if (!activeBusinessId) return null
    try {
      const branchIds = activeBranchFilter
        ? [activeBranchFilter]
        : branches.map(b => b.id)

      if (branchIds.length === 0) {
        toast.error('Add a branch first.')
        return null
      }
      const created = await serviceCategoriesApi.create(activeBusinessId, {
        name,
        branchIds,
      })
      setCategories(prev => [...prev, created])
      toast.success('Category created')
      return created
    } catch (err) {
      console.error('[services] create category failed', err)
      toast.error(extractErrorMessage(err, 'Could not create the category.'))
      return null
    }
  }

  async function toggleStatus(svc: Service) {
    try {
      const next: ServiceStatus = svc.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE'
      await servicesApi.update(svc.id, { status: next })
      toast.success(next === 'ACTIVE' ? 'Service activated' : 'Service deactivated')
      if (selected?.id === svc.id) closePanel()
      await refresh()
    } catch (err) {
      console.error('[services] toggle status failed', err)
      toast.error(extractErrorMessage(err, 'Could not change the service status.'))
    }
  }

  /* ---------------------------------------------------------------- */
  /*  Render                                                          */
  /* ---------------------------------------------------------------- */

  return (
    <div className="flex h-full overflow-hidden">
      {/* Main list */}
      <div className="flex-1 overflow-y-auto min-w-0">
        {/* Header — stacks on narrow screens */}
        <div className="px-4 sm:px-6 lg:px-8 py-4 sm:py-5 bg-surface border-b border-line sticky top-0 z-10">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
            <div className="min-w-0">
              <h2 className="font-display text-xl sm:text-2xl lg:text-[1.75rem] text-ink leading-none">Services</h2>
              <p className="text-ink-3 text-xs sm:text-sm mt-1.5">Manage the services your salon offers.</p>
            </div>
            <Button onClick={openAdd} size="sm" disabled={loading || categories.length === 0} className="self-start sm:self-auto flex-shrink-0">
              <PlusIcon /> Add Service
            </Button>
          </div>
        </div>

        <div className="px-4 sm:px-6 lg:px-8 py-5 sm:py-6">
          {loading && services.length === 0 ? (
            <LoadingState label="Loading services…" />
          ) : services.length === 0 ? (
            <EmptyState
              icon={<LayersIcon />}
              title="No services yet"
              description={
                categories.length === 0
                  ? 'Create a service category first, then add services.'
                  : 'Add your first service to start accepting bookings.'
              }
              action={
                categories.length === 0
                  ? undefined
                  : <Button onClick={openAdd} size="sm"><PlusIcon /> Add Service</Button>
              }
            />
          ) : (
            <div className="flex flex-col gap-6 sm:gap-8">
              {grouped.map(({ category, list }) => {
                const catName = category?.name ?? 'Uncategorized'
                return (
                  <div key={category?.id ?? 'uncat'}>
                    <div className="flex items-center gap-3 mb-3">
                      <p className="text-xs font-semibold text-ink-3 uppercase tracking-wider truncate">{catName}</p>
                      <div className="flex-1 h-px bg-line min-w-[1rem]" />
                      <span className="text-xs text-ink-3 flex-shrink-0">{list.length} service{list.length !== 1 ? 's' : ''}</span>
                    </div>
                    <div className="bg-surface rounded-2xl border border-line overflow-hidden">
                      {list.map(svc => (
                        <button
                          key={svc.id}
                          onClick={() => selectService(svc)}
                          className={`flex items-center w-full text-left px-4 sm:px-5 py-3.5 sm:py-4 border-b border-line last:border-0 hover:bg-bg transition-colors gap-3 sm:gap-4 ${selected?.id === svc.id ? 'bg-warm-subtle' : ''}`}
                        >
                          {/* Name + badges + description */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-medium text-ink text-sm truncate">{svc.name}</span>
                              {svc.status === 'INACTIVE' && (
                                <span className="text-[10px] px-2 py-0.5 rounded-full bg-line text-ink-3 font-medium flex-shrink-0">Inactive</span>
                              )}
                              {!svc.showPriceToCustomer && (
                                <span className="text-[10px] px-2 py-0.5 rounded-full bg-warm-subtle text-ink-3 font-medium flex-shrink-0 hidden sm:inline">Price hidden</span>
                              )}
                            </div>
                            {svc.description && (
                              <p className="text-xs text-ink-3 mt-0.5 truncate max-w-full sm:max-w-sm">{svc.description}</p>
                            )}

                            {/* Mobile-only: price + duration row under the name */}
                            <div className="flex items-center gap-3 mt-1.5 sm:hidden">
                              <span className="text-sm font-semibold text-ink">
                                {parseFloat(svc.price || '0').toLocaleString()} ETB
                              </span>
                              <span className="text-xs text-ink-3">
                                {svc.durationMinutes} min
                                {svc.branchAssignments?.[0]?.bufferMinutes
                                  ? ` + ${svc.branchAssignments[0].bufferMinutes}m`
                                  : ''}
                              </span>
                            </div>
                          </div>

                          {/* Desktop-only: right-aligned metrics */}
                          <div className="hidden sm:flex items-center gap-4 md:gap-6 flex-shrink-0">
                            <span className="text-sm font-semibold text-ink whitespace-nowrap">
                              {parseFloat(svc.price || '0').toLocaleString()} ETB
                            </span>
                            <span className="text-sm text-ink-3 whitespace-nowrap">
                              {svc.durationMinutes} min
                              {svc.branchAssignments?.[0]?.bufferMinutes
                                ? ` + ${svc.branchAssignments[0].bufferMinutes}m`
                                : ''}
                            </span>
                            <div className="hidden md:flex -space-x-1">
                              {svc.branchAssignments.filter(a => a.isActive).slice(0, 3).map(a => (
                                <div
                                  key={a.id}
                                  title={a.branch.name}
                                  className="w-6 h-6 rounded-full bg-warm border-2 border-surface flex items-center justify-center text-[9px] font-semibold text-ink-2"
                                >
                                  {a.branch.name.charAt(0).toUpperCase()}
                                </div>
                              ))}
                            </div>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-ink-3 flex-shrink-0">
                              <path d="M9 18l6-6-6-6"/>
                            </svg>
                          </div>

                          {/* Mobile-only: chevron */}
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-ink-3 flex-shrink-0 sm:hidden">
                            <path d="M9 18l6-6-6-6"/>
                          </svg>
                        </button>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* Detail panel — side sheet on desktop, bottom sheet on mobile */}
      {isDesktop ? (
        <div
          className="flex-shrink-0 overflow-hidden transition-[width] duration-200 ease-out"
          style={{ width: panelVisible ? 300 : 0 }}
        >
          {panelMounted && selected && (
            <ServiceDetailPanel
              service={selected}
              onEdit={() => openEdit(selected)}
              onToggleStatus={() => toggleStatus(selected)}
              onClose={closePanel}
            />
          )}
        </div>
      ) : (
        panelMounted && selected && (
          <>
            {/* Backdrop */}
            <div
              className={`
                fixed inset-0 z-40 bg-ink/40 backdrop-blur-sm
                transition-opacity duration-200
                ${panelVisible ? 'opacity-100' : 'opacity-0'}
              `}
              onClick={closePanel}
              aria-hidden="true"
            />
            {/* Bottom sheet */}
            <div
              className={`
                fixed inset-x-0 bottom-0 z-50
                max-h-[85vh] rounded-t-2xl overflow-hidden
                transition-transform duration-200 ease-out
                ${panelVisible ? 'translate-y-0' : 'translate-y-full'}
              `}
            >
              <ServiceDetailPanel
                service={selected}
                onEdit={() => openEdit(selected)}
                onToggleStatus={() => toggleStatus(selected)}
                onClose={closePanel}
                variant="sheet"
              />
            </div>
          </>
        )
      )}

      {/* Add / Edit modal */}
      <ServiceFormModal
        open={showModal}
        service={editing}
        categories={categories}
        branches={branches}
        onClose={() => setShowModal(false)}
        onSave={handleSave}
        onCreateCategory={handleCreateCategory}
      />
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Detail panel                                                       */
/* ------------------------------------------------------------------ */

function ServiceDetailPanel({
  service, onEdit, onToggleStatus, onClose, variant = 'panel',
}: {
  service: Service
  onEdit: () => void
  onToggleStatus: () => void
  onClose: () => void
  variant?: 'panel' | 'sheet'
}) {
  const activeAssignments = service.branchAssignments.filter(a => a.isActive)
  const isActive = service.status === 'ACTIVE'

  const depositText =
    service.depositPolicyType === 'NONE' ? 'No deposit required'
    : service.depositPolicyType === 'FIXED'
      ? `${parseFloat(service.depositAmount || '0').toLocaleString()} ETB deposit`
    : service.depositPolicyType === 'PERCENTAGE'
      ? `${service.depositAmount}% deposit`
    : 'Full payment required'

  const containerClass =
    variant === 'sheet'
      ? 'w-full bg-surface flex flex-col max-h-[85vh]'
      : 'w-[300px] flex-shrink-0 border-l border-line bg-surface flex flex-col h-full'

  return (
    <div className={containerClass}>
      {/* Drag handle on mobile */}
      {variant === 'sheet' && (
        <div className="pt-3 pb-1 flex justify-center flex-shrink-0">
          <div className="w-10 h-1 rounded-full bg-line" />
        </div>
      )}

      <div className="flex items-center justify-between px-5 py-4 border-b border-line flex-shrink-0">
        <p className="text-sm font-semibold text-ink">Service detail</p>
        <button onClick={onClose} className="w-7 h-7 rounded-lg flex items-center justify-center text-ink-3 hover:bg-warm-subtle hover:text-ink transition-colors">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 6L6 18M6 6l12 12"/></svg>
        </button>
      </div>

      <div className="flex-1 overflow-y-auto min-h-0">
        <div className="px-5 py-5 border-b border-line">
          <div className="flex items-start justify-between mb-1">
            <h3 className="font-display text-xl text-ink leading-tight">{service.name}</h3>
            <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ml-2 flex-shrink-0 mt-1 ${isActive ? 'bg-[#EAF5EC] text-[#2A5F30]' : 'bg-line text-ink-3'}`}>
              {isActive ? 'Active' : 'Inactive'}
            </span>
          </div>
          <p className="text-xs text-ink-3">{service.category?.name ?? 'Uncategorized'}</p>
          {service.description && <p className="text-sm text-ink-2 mt-3 leading-relaxed">{service.description}</p>}
        </div>

        <div className="px-5 py-4 border-b border-line">
          <p className="text-[10px] font-semibold text-ink-3 uppercase tracking-wider mb-3.5">Pricing & Duration</p>
          <div className="flex flex-col gap-3">
            <Row label="Price"      value={`${parseFloat(service.price || '0').toLocaleString()} ETB`} />
            <Row label="Duration"   value={`${service.durationMinutes} min`} />
            <Row label="Buffer"     value={activeAssignments[0]?.bufferMinutes ? `${activeAssignments[0].bufferMinutes} min` : 'None'} />
            <Row label="Deposit"    value={depositText} />
            <Row label="Show price" value={service.showPriceToCustomer ? 'Visible to customers' : 'Hidden'} />
          </div>
        </div>

        <div className="px-5 py-4 border-b border-line">
          <p className="text-[10px] font-semibold text-ink-3 uppercase tracking-wider mb-3.5">Staff assignment</p>
          <p className="text-sm text-ink-2">{ASSIGN_LABELS[service.employeeAssignmentMode] ?? service.employeeAssignmentMode}</p>
        </div>

        <div className="px-5 py-4">
          <p className="text-[10px] font-semibold text-ink-3 uppercase tracking-wider mb-3.5">Available at</p>
          <div className="flex flex-col gap-2">
            {activeAssignments.length === 0
              ? <p className="text-sm text-ink-3">No branches</p>
              : activeAssignments.map(a => (
                <div key={a.id} className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-[#8BAB95]" />
                  <span className="text-sm text-ink">{a.branch.name}</span>
                </div>
              ))
            }
          </div>
        </div>
      </div>

      <div className="px-5 py-4 border-t border-line flex flex-col gap-2 flex-shrink-0">
        <Button variant="secondary" fullWidth size="sm" onClick={onEdit}>Edit service</Button>
        <Button variant="ghost" fullWidth size="sm" onClick={onToggleStatus}>
          {isActive ? 'Deactivate' : 'Activate'}
        </Button>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Category dropdown (styled, with inline create)                     */
/* ------------------------------------------------------------------ */

function CategorySelect({
  value,
  options,
  onChange,
  onCreateCategory,
}: {
  value: string
  options: ServiceCategory[]
  onChange: (id: string) => void
  onCreateCategory: (name: string) => Promise<ServiceCategory | null>
}) {
  const [open, setOpen] = useState(false)
  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
        setCreating(false)
        setNewName('')
      }
    }
    function onEsc(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setOpen(false)
        setCreating(false)
        setNewName('')
      }
    }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onEsc)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('keydown', onEsc)
    }
  }, [open])

  useEffect(() => {
    if (creating) inputRef.current?.focus()
  }, [creating])

  async function submitNew() {
    const name = newName.trim()
    if (!name) return
    setSubmitting(true)
    try {
      const created = await onCreateCategory(name)
      if (created) {
        onChange(created.id)
        setOpen(false)
        setCreating(false)
        setNewName('')
      }
    } finally {
      setSubmitting(false)
    }
  }

  const selected = options.find(c => c.id === value)

  return (
    <div className="flex flex-col gap-1.5" ref={ref}>
      <label className="text-sm font-medium text-ink-2">Category</label>
      <div className="relative">
        <button
          type="button"
          onClick={() => setOpen(o => !o)}
          className="
            w-full h-10 px-3 rounded-[10px]
            border border-line bg-surface text-ink text-sm
            flex items-center justify-between gap-2 text-left
            focus:outline-none focus:border-ink-3 focus:ring-2 focus:ring-ink-3/10
            transition-colors
          "
        >
          <span className="truncate">{selected?.name ?? 'Select a category…'}</span>
          <svg
            className={`flex-shrink-0 text-ink-3 transition-transform ${open ? 'rotate-180' : ''}`}
            width="14" height="14" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </button>

        {open && (
          <div className="
            absolute z-30 mt-1.5 w-full
            rounded-[10px] border border-line bg-surface
            shadow-lg shadow-black/5
            overflow-hidden
          ">
            <div className="max-h-56 overflow-y-auto py-1">
              {options.map(c => {
                const isSelected = c.id === value
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => { onChange(c.id); setOpen(false) }}
                    className={`
                      w-full px-3 py-2 text-left text-sm
                      flex items-center justify-between gap-2 transition-colors
                      ${isSelected
                        ? 'bg-warm-subtle text-ink font-medium'
                        : 'text-ink-2 hover:bg-warm-subtle hover:text-ink'}
                    `}
                  >
                    <span className="truncate">{c.name}</span>
                    {isSelected && (
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                        stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"
                        className="text-ink flex-shrink-0">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    )}
                  </button>
                )
              })}
            </div>

            <div className="border-t border-line bg-surface">
              {creating ? (
                <div className="p-1.5 flex items-center gap-1.5">
                  <input
                    ref={inputRef}
                    type="text"
                    value={newName}
                    onChange={e => setNewName(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') { e.preventDefault(); void submitNew() }
                      if (e.key === 'Escape') { setCreating(false); setNewName('') }
                    }}
                    placeholder="New category"
                    className="
                      flex-1 min-w-0 h-8 px-2.5 rounded-lg
                      border border-line bg-surface text-ink text-xs
                      placeholder:text-ink-3
                      focus:outline-none focus:border-ink-3
                      transition-colors
                    "
                  />
                  <button
                    type="button"
                    onClick={submitNew}
                    disabled={!newName.trim() || submitting}
                    aria-label="Create category"
                    className="
                      flex-shrink-0 w-8 h-8 rounded-lg
                      flex items-center justify-center
                      bg-ink text-surface
                      hover:opacity-90
                      disabled:opacity-40 disabled:cursor-not-allowed
                      transition-opacity
                    "
                  >
                    {submitting ? (
                      <svg
                        className="animate-spin"
                        width="12" height="12" viewBox="0 0 24 24" fill="none"
                        stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                      >
                        <path d="M21 12a9 9 0 11-6.219-8.56" />
                      </svg>
                    ) : (
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                        stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M12 5v14M5 12h14" />
                      </svg>
                    )}
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setCreating(true)}
                  className="
                    w-full px-3 py-2.5 text-left text-sm font-medium
                    flex items-center gap-2
                    text-ink-2 hover:bg-warm-subtle hover:text-ink
                    transition-colors
                  "
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                    stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 5v14M5 12h14" />
                  </svg>
                  Add service category
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Add / Edit modal                                                   */
/* ------------------------------------------------------------------ */

type ServiceFormPayload = {
  categoryId: string
  name: string
  description: string
  durationMinutes: number
  price: number
  employeeAssignmentMode: EmployeeAssignmentMode
  showPriceToCustomer: boolean
  depositPolicyType: DepositPolicyType
  depositAmount: number | null
  branchIds: string[]
  status: ServiceStatus
}

function ServiceFormModal({
  open, service, categories, branches, onClose, onSave, onCreateCategory,
}: {
  open: boolean
  service: Service | null
  categories: ServiceCategory[]
  branches: Branch[]
  onClose: () => void
  onSave: (payload: ServiceFormPayload, existingId: string | null) => Promise<void>
  onCreateCategory: (name: string) => Promise<ServiceCategory | null>
}) {
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState<ServiceFormPayload>(() => blankForm(categories, branches))

  useEffect(() => {
    if (!open) return
    if (service) {
      setForm({
        categoryId:             service.categoryId,
        name:                   service.name,
        description:            service.description ?? '',
        durationMinutes:        service.durationMinutes,
        price:                  parseFloat(service.price || '0') || 0,
        employeeAssignmentMode: service.employeeAssignmentMode,
        showPriceToCustomer:    service.showPriceToCustomer,
        depositPolicyType:      service.depositPolicyType,
        depositAmount:          service.depositAmount ? parseFloat(service.depositAmount) : null,
        branchIds:              service.branchAssignments.filter(a => a.isActive).map(a => a.branchId),
        status:                 service.status,
      })
    } else {
      setForm(blankForm(categories, branches))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, service])

  function toggleBranch(id: string) {
    setForm(f => ({
      ...f,
      branchIds: f.branchIds.includes(id)
        ? f.branchIds.filter(b => b !== id)
        : [...f.branchIds, id],
    }))
  }

  async function handleSave() {
    if (!form.name.trim()) return
    if (form.branchIds.length === 0) return
    setSaving(true)
    try {
      await onSave(form, service?.id ?? null)
    } finally {
      setSaving(false)
    }
  }

  const canSave =
    form.name.trim().length > 0 &&
    form.durationMinutes > 0 &&
    form.branchIds.length > 0 &&
    !saving

  return (
    <Modal open={open} onClose={onClose} title={service ? 'Edit Service' : 'Add Service'} width="max-w-xl">
      <div className="px-4 sm:px-6 py-5 flex flex-col gap-4 sm:gap-5 max-h-[65vh] overflow-y-auto">
        {/* Name + category + show price */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2">
            <Input
              label="Service name"
              value={form.name}
              placeholder="e.g. Hair Treatment"
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
            />
          </div>
          <CategorySelect
            value={form.categoryId}
            options={categories}
            onChange={id => setForm(f => ({ ...f, categoryId: id }))}
            onCreateCategory={onCreateCategory}
          />
          <div className="flex items-end pb-2">
            <Toggle
              checked={form.showPriceToCustomer}
              onChange={v => setForm(f => ({ ...f, showPriceToCustomer: v }))}
              label="Show price publicly"
            />
          </div>
        </div>

        <Textarea
          label="Description (optional)"
          value={form.description}
          rows={2}
          placeholder="Brief description of this service…"
          onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
        />

        {/* Price / duration / buffer — 1 col on mobile, 3 on sm+ */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
          <NumberField
            label="Price (ETB)"
            value={form.price}
            min={0}
            onChange={v => setForm(f => ({ ...f, price: v }))}
          />
          <NumberField
            label="Duration (min)"
            value={form.durationMinutes}
            min={1}
            onChange={v => setForm(f => ({ ...f, durationMinutes: v }))}
          />
          <NumberField
            label="Buffer (min)"
            value={service?.branchAssignments?.[0]?.bufferMinutes ?? 0}
            min={0}
            disabled
            onChange={() => {}}
          />
        </div>

        {/* Deposit policy */}
        <div>
          <label className="text-sm font-medium text-ink-2 block mb-2">Deposit requirement</label>
          <div className="flex gap-2 flex-wrap mb-3">
            {(['NONE', 'FIXED', 'PERCENTAGE', 'FULL'] as const).map(dt => (
              <button
                key={dt}
                onClick={() => setForm(f => ({
                  ...f,
                  depositPolicyType: dt,
                  depositAmount: dt === 'FIXED' || dt === 'PERCENTAGE' ? (f.depositAmount ?? 0) : null,
                }))}
                className={`px-3 py-1.5 rounded-xl text-xs border transition-all ${form.depositPolicyType === dt ? 'border-ink bg-ink text-surface' : 'border-line bg-surface text-ink-2 hover:border-warm'}`}
              >
                {DEPOSIT_LABELS[dt]}
              </button>
            ))}
          </div>
          {(form.depositPolicyType === 'FIXED' || form.depositPolicyType === 'PERCENTAGE') && (
            <div className="flex items-center gap-2">
              <input
                type="number"
                value={form.depositAmount ?? ''}
                onChange={e => setForm(f => ({ ...f, depositAmount: e.target.value === '' ? null : +e.target.value }))}
                onFocus={e => e.target.select()}
                className="w-24 h-9 px-3 rounded-xl border border-line text-sm bg-surface text-ink focus:outline-none focus:border-warm text-center"
                placeholder="0"
              />
              <span className="text-sm text-ink-3">{form.depositPolicyType === 'PERCENTAGE' ? '%' : 'ETB'}</span>
            </div>
          )}
        </div>

        {/* Staff assignment */}
        <div>
          <label className="text-sm font-medium text-ink-2 block mb-2">Staff assignment</label>
          <div className="flex gap-2 flex-wrap">
            {(['CUSTOMER_CHOOSES', 'SALON_ASSIGNS', 'ANY_AVAILABLE'] as const).map(ea => (
              <button
                key={ea}
                onClick={() => setForm(f => ({ ...f, employeeAssignmentMode: ea }))}
                className={`px-3 py-1.5 rounded-xl text-xs border transition-all ${form.employeeAssignmentMode === ea ? 'border-ink bg-ink text-surface' : 'border-line bg-surface text-ink-2 hover:border-warm'}`}
              >
                {ASSIGN_LABELS[ea]}
              </button>
            ))}
          </div>
        </div>

        {/* Branches */}
        <div>
          <label className="text-sm font-medium text-ink-2 block mb-2">
            Available branches <span className="text-ink-3 font-normal">(at least one required)</span>
          </label>
          <div className="flex gap-2 flex-wrap">
            {branches.map(b => {
              const checked = form.branchIds.includes(b.id)
              return (
                <button
                  key={b.id}
                  onClick={() => toggleBranch(b.id)}
                  className={`px-3 py-1.5 rounded-xl text-xs border transition-all ${checked ? 'border-ink bg-ink text-surface' : 'border-line bg-surface text-ink-2 hover:border-warm'}`}
                >
                  {checked ? '✓' : '+'} {b.name}
                </button>
              )
            })}
          </div>
          {form.branchIds.length === 0 && (
            <p className="text-xs text-[#B06A6A] mt-2">Select at least one branch.</p>
          )}
        </div>
      </div>

      <div className="px-4 sm:px-6 pb-5 sm:pb-6 flex gap-2 sm:gap-3 justify-end border-t border-line pt-4">
        <Button variant="ghost" onClick={onClose} disabled={saving}>Cancel</Button>
        <Button onClick={handleSave} loading={saving} disabled={!canSave}>
          {service ? 'Save changes' : 'Add service'}
        </Button>
      </div>
    </Modal>
  )
}

function blankForm(categories: ServiceCategory[], branches: Branch[]): ServiceFormPayload {
  return {
    categoryId:             categories[0]?.id ?? '',
    name:                   '',
    description:            '',
    durationMinutes:        60,
    price:                  0,
    employeeAssignmentMode: 'CUSTOMER_CHOOSES',
    showPriceToCustomer:    true,
    depositPolicyType:      'NONE',
    depositAmount:          null,
    branchIds:              branches[0] ? [branches[0].id] : [],
    status:                 'ACTIVE',
  }
}

/* ------------------------------------------------------------------ */
/*  NumberField — clears "0" when focused/typing                       */
/* ------------------------------------------------------------------ */

function NumberField({
  label, value, onChange, min, max, disabled,
}: {
  label: string
  value: number
  onChange: (v: number) => void
  min?: number
  max?: number
  disabled?: boolean
}) {
  const [draft, setDraft] = useState(String(value))

  useEffect(() => {
    setDraft(prev => {
      const parsed = prev === '' ? NaN : Number(prev)
      return parsed === value ? prev : String(value)
    })
  }, [value])

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const raw = e.target.value
    if (raw === '') { setDraft(''); return }
    const cleaned = raw.replace(/^0+(?=\d)/, '')
    setDraft(cleaned)
    const n = Number(cleaned)
    if (!Number.isNaN(n)) onChange(n)
  }

  function handleBlur() {
    if (draft === '' || Number.isNaN(Number(draft))) {
      const fallback = min ?? 0
      setDraft(String(fallback))
      onChange(fallback)
      return
    }
    let n = Number(draft)
    if (min !== undefined && n < min) n = min
    if (max !== undefined && n > max) n = max
    setDraft(String(n))
    onChange(n)
  }

  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-sm font-medium text-ink-2">{label}</label>
      <input
        type="number"
        inputMode="decimal"
        value={draft}
        min={min}
        max={max}
        disabled={disabled}
        onChange={handleChange}
        onBlur={handleBlur}
        onFocus={e => e.target.select()}
        className="h-10 px-3 rounded-[10px] border border-line text-sm bg-surface text-ink focus:outline-none focus:border-warm disabled:opacity-50 disabled:cursor-not-allowed"
      />
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Constants & helpers                                                */
/* ------------------------------------------------------------------ */

const DEPOSIT_LABELS: Record<DepositPolicyType, string> = {
  NONE: 'No deposit',
  FIXED: 'Fixed amount',
  PERCENTAGE: 'Percentage',
  FULL: 'Full payment',
}

const ASSIGN_LABELS: Record<EmployeeAssignmentMode, string> = {
  CUSTOMER_CHOOSES: 'Customer chooses',
  SALON_ASSIGNS: 'Salon assigns',
  ANY_AVAILABLE: 'Any available',
}

function normalizeArray<T>(res: unknown): T[] {
  if (Array.isArray(res)) return res as T[]
  if (Array.isArray((res as any)?.data)) return (res as any).data as T[]
  return []
}

function extractErrorMessage(err: unknown, fallback = 'Something went wrong.'): string {
  if (!err) return fallback
  const anyErr = err as any
  const data = anyErr?.response?.data ?? anyErr?.data ?? anyErr

  if (Array.isArray(data?.errors) && data.errors.length > 0) return String(data.errors[0])
  if (typeof data?.message === 'string' && data.message) return data.message
  if (typeof anyErr?.message === 'string' && anyErr.message) return anyErr.message
  return fallback
}

/* ------------------------------------------------------------------ */
/*  Sub-components                                                     */
/* ------------------------------------------------------------------ */

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <span className="text-sm text-ink-3 flex-shrink-0">{label}</span>
      <span className="text-sm text-ink text-right">{value}</span>
    </div>
  )
}

export function LoadingState({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <svg className="animate-spin text-ink-3 mb-4" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 12a9 9 0 11-6.219-8.56" />
      </svg>
      <p className="text-ink-3 text-sm">{label}</p>
    </div>
  )
}

export function EmptyState({ icon, title, description, action }: { icon: React.ReactNode; title: string; description: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 sm:py-20 text-center">
      <div className="w-14 h-14 rounded-2xl bg-warm-subtle flex items-center justify-center mb-5 text-ink-3">{icon}</div>
      <p className="font-display text-lg sm:text-xl text-ink mb-1">{title}</p>
      <p className="text-ink-3 text-sm mb-5 max-w-xs">{description}</p>
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