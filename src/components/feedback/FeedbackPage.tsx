import { useEffect, useMemo, useRef, useState } from 'react'
import type {
  FeedbackSubmission,
  FeedbackCategory,
  FeedbackCategoryType,
  Staff as ApiStaff,
  Branch as ApiBranch,
} from '../../types/api'
import type { StaffMember, Branch } from '../../types'
import { Button } from '../ui'
import { useToast } from '../ui/Toast'
import { useBusiness } from '../../contexts/BusinessContext'
import { useBranch } from '../../contexts/BranchContext'
import { feedbackApi } from '../../api/feedback.api'
import { staffApi } from '../../api/staff.api'

/* ------------------------------------------------------------------ */
/*  Local shape — a flattened view of FeedbackSubmission for the UI    */
/* ------------------------------------------------------------------ */

interface UiFeedback {
  id: string
  anonymous: boolean
  customerName: string | null
  customerPhone: string | null
  serviceName: string
  staffId: string
  staffName: string
  branchId: string
  branchName: string
  date: string

  overallRating: number
  staffRating: number
  experienceRating: number
  hygieneRating: number
  serviceQualityRating: number
  waitingRating: number

  comment: string | null

  extraResponses: Array<{
    categoryName: string
    type: FeedbackCategoryType
    rating: number | null
    text: string | null
    boolean: boolean | null
  }>

  reviewed: boolean
  internalNote: string
}

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */

interface FeedbackPageProps {
  staff?: StaffMember[]
  branches?: Branch[]
  onUpdate?: (feedback: UiFeedback[]) => void
}

export function FeedbackPage({
  staff: staffProp = [],
  branches: branchesProp = [],
  onUpdate,
}: FeedbackPageProps) {
  const toast = useToast()
  const { activeBusinessId } = useBusiness()

  // Branch context — authoritative branch list + current branch filter.
  const {
    branches: branchesCtx,
    activeBranchId,
    activeBranchFilter,
  } = useBranch()

  const [submissions, setSubmissions] = useState<FeedbackSubmission[]>([])
  const [categories, setCategories]   = useState<FeedbackCategory[]>([])
  const [loading, setLoading]         = useState(false)

  const [apiStaff, setApiStaff] = useState<ApiStaff[]>([])

  const [filterStaff,  setFilterStaff]  = useState('all')
  const [filterBranch, setFilterBranch] = useState(
    activeBranchId === 'all' ? 'all' : activeBranchId,
  )

  // Keep the branch filter in sync with the app's active branch.
  useEffect(() => {
    setFilterBranch(activeBranchId === 'all' ? 'all' : activeBranchId)
  }, [activeBranchId])

  const [selectedId, setSelectedId] = useState<string | null>(null)

  const [localMeta, setLocalMeta] = useState<
    Record<string, { reviewed: boolean; internalNote: string }>
  >({})

  async function refresh() {
    if (!activeBusinessId) return
    setLoading(true)
    try {
      const [subsRes, catsRes] = await Promise.all([
        feedbackApi.list(activeBusinessId, { limit: 100 }),
        feedbackApi.categories.list(activeBusinessId),
      ])

      const subs = unwrapArray<FeedbackSubmission>(subsRes)
      const cats = unwrapArray<FeedbackCategory>(catsRes)

      setSubmissions(subs)
      setCategories(cats)
    } catch (err: any) {
      console.error('[feedback] load failed', err)
      toast.error(extractErrorMessage(err, 'Could not load feedback.'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void refresh()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeBusinessId])

  /* ---------------------------------------------------------------- */
  /*  Fetch staff from the API when the prop is empty.               */
  /*                                                                  */
  /*  The branch filter is passed through so the server returns the   */
  /*  roster for the active branch — that keeps the dropdown scoped   */
  /*  even when the parent doesn't pass `staff`.                     */
  /* ---------------------------------------------------------------- */

  useEffect(() => {
    if (!activeBusinessId) return
    if (staffProp.length > 0) return
    let cancelled = false

    ;(async () => {
      try {
        const res = await staffApi.list(activeBusinessId, {
          branchId: activeBranchFilter,
        })
        const list = unwrapArray<ApiStaff>(res)
        if (!cancelled) setApiStaff(list)
      } catch (err) {
        console.warn('[feedback] staffApi.list failed', err)
      }
    })()

    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeBusinessId, staffProp.length, activeBranchFilter])

  void categories

  const uiFeedback: UiFeedback[] = useMemo(() => {
    return submissions.map(s => normalizeForUi(s, localMeta[s.id]))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [submissions, localMeta])

  const filtered = useMemo(
    () =>
      uiFeedback.filter(f => {
        if (filterStaff  !== 'all' && f.staffId  !== filterStaff)  return false
        if (filterBranch !== 'all' && f.branchId !== filterBranch) return false
        return true
      }),
    [uiFeedback, filterStaff, filterBranch],
  )

  const avgOverall = uiFeedback.length
    ? (uiFeedback.reduce((s, f) => s + f.overallRating, 0) / uiFeedback.length).toFixed(1)
    : '—'
  const avgStaff = uiFeedback.length
    ? (uiFeedback.reduce((s, f) => s + f.staffRating, 0) / uiFeedback.length).toFixed(1)
    : '—'
  const avgExp = uiFeedback.length
    ? (uiFeedback.reduce((s, f) => s + f.experienceRating, 0) / uiFeedback.length).toFixed(1)
    : '—'

  function staffAvg(staffId: string) {
    const items = uiFeedback.filter(f => f.staffId === staffId)
    if (!items.length) return 0
    return items.reduce((s, f) => s + f.overallRating, 0) / items.length
  }

  function markReviewed(id: string) {
    setLocalMeta(prev => ({
      ...prev,
      [id]: { reviewed: true, internalNote: prev[id]?.internalNote ?? '' },
    }))
    onUpdate?.(uiFeedback.map(f => (f.id === id ? { ...f, reviewed: true } : f)))
  }

  function saveNote(id: string, note: string) {
    setLocalMeta(prev => ({
      ...prev,
      [id]: { reviewed: prev[id]?.reviewed ?? false, internalNote: note },
    }))
    onUpdate?.(
      uiFeedback.map(f => (f.id === id ? { ...f, internalNote: note } : f)),
    )
  }

  /* ---------------------------------------------------------------- */
  /*  Staff options — 3-tier fallback, scoped to the active branch    */
  /*                                                                   */
  /*  When `activeBranchFilter` is set (i.e. the app is on a specific  */
  /*  branch), each tier is filtered by that branch id:                */
  /*    • prop entries are filtered by their `branchId` if present     */
  /*    • API entries carry `branchId` from the server                */
  /*    • submission-derived entries only include staff whose          */
  /*      appointment is on that branch (appointments are already      */
  /*      branch-scoped on the server side, but we double-check)       */
  /*                                                                   */
  /*  When the filter is "all", every tier passes through unchanged.   */
  /* ---------------------------------------------------------------- */

  const staffOptions = useMemo(() => {
    const out: Array<{ id: string; name: string; initials: string }> = []
    const seen = new Set<string>()

    const matchesBranch = (raw: any): boolean => {
      if (!activeBranchFilter) return true
      // API `Staff` and appointment refs carry `branchId` directly.
      if (typeof raw?.branchId === 'string') {
        return raw.branchId === activeBranchFilter
      }
      // UI `StaffMember` may not carry a branch — treat as match so we
      // don't hide options the parent explicitly passed in.
      return true
    }

    // 1. UI-shaped prop
    for (const s of staffProp) {
      if (!matchesBranch(s)) continue
      const member = coerceStaff(s)
      if (!member || seen.has(member.id)) continue
      seen.add(member.id)
      out.push(member)
    }

    // 2. API staff
    if (out.length === 0) {
      for (const s of apiStaff) {
        if (!matchesBranch(s)) continue
        const member = coerceStaff(s)
        if (!member || seen.has(member.id)) continue
        seen.add(member.id)
        out.push(member)
      }
    }

    // 3. Derived from submissions
    if (out.length === 0) {
      for (const s of submissions) {
        const apptBranchId = s.appointment?.branch?.id
        if (activeBranchFilter && apptBranchId !== activeBranchFilter) continue

        for (const member of s.appointment?.staff ?? []) {
          const coerced = coerceStaff(member)
          if (!coerced || seen.has(coerced.id)) continue
          seen.add(coerced.id)
          out.push(coerced)
        }
      }
    }

    return out
  }, [staffProp, apiStaff, submissions, activeBranchFilter])

  /* ---------------------------------------------------------------- */
  /*  Branch options — context first, prop second, derived last       */
  /* ---------------------------------------------------------------- */

  const branchOptions = useMemo<Branch[]>(() => {
    const out: Branch[] = []
    const seen = new Set<string>()

    for (const b of branchesCtx) {
      if (!b || !b.id || seen.has(b.id)) continue
      seen.add(b.id)
      out.push({ id: b.id, name: b.name } as Branch)
    }

    if (out.length === 0) {
      for (const b of branchesProp) {
        if (!b || !b.id || seen.has(b.id)) continue
        seen.add(b.id)
        out.push({ id: b.id, name: b.name } as Branch)
      }
    }

    if (out.length === 0) {
      for (const s of submissions) {
        const b = s.appointment?.branch
        if (b && !seen.has(b.id)) {
          seen.add(b.id)
          out.push({ id: b.id, name: b.name } as Branch)
        }
      }
    }

    return out
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [branchesCtx, branchesProp, submissions])

  const selected =
    (selectedId && uiFeedback.find(f => f.id === selectedId)) || null

  return (
    <div className="flex h-full overflow-hidden">
      {/* Main */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-4 sm:px-6 lg:px-8 py-4 sm:py-5 bg-surface border-b border-line flex-shrink-0">
          <div className="flex items-start justify-between mb-5 gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-3 mb-1 flex-wrap">
                <h2 className="font-display text-xl sm:text-2xl lg:text-[1.75rem] text-ink leading-none">
                  Customer Feedback
                </h2>
              </div>
              <p className="text-ink-3 text-xs sm:text-sm">
                Private feedback from your customers.
              </p>
            </div>
          </div>

          {/* Metric cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-5">
            {[
              { label: 'Average rating', value: avgOverall, sub: `${uiFeedback.length} total` },
              { label: 'Staff rating',   value: avgStaff,   sub: 'avg. per staff' },
              { label: 'Experience',     value: avgExp,     sub: 'overall exp.' },
              {
                label: 'Unreviewed',
                value: String(uiFeedback.filter(f => !f.reviewed).length),
                sub: 'to review',
              },
            ].map(m => (
              <div
                key={m.label}
                className="bg-bg rounded-2xl border border-line px-4 sm:px-5 py-4 min-w-0"
              >
                <p className="text-[11px] sm:text-xs text-ink-3 mb-1 truncate">
                  {m.label}
                </p>
                <p className="font-display text-lg sm:text-2xl text-ink truncate">
                  {m.value}{' '}
                  <span className="text-base font-normal text-warm">★</span>
                </p>
                <p className="text-[11px] sm:text-xs text-ink-3 mt-1 truncate">
                  {m.sub}
                </p>
              </div>
            ))}
          </div>

          {/* Filters — styled dropdowns */}
          <div className="flex items-center gap-2 flex-wrap">
            <StyledSelect
              value={filterStaff}
              onChange={setFilterStaff}
              ariaLabel="Filter by staff"
              options={[
                { value: 'all', label: 'All staff' },
                ...staffOptions.map(m => ({ value: m.id, label: m.name })),
              ]}
            />
            <StyledSelect
              value={filterBranch}
              onChange={setFilterBranch}
              ariaLabel="Filter by branch"
              options={[
                { value: 'all', label: 'All branches' },
                ...branchOptions.map(b => ({ value: b.id, label: b.name })),
              ]}
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-4 sm:px-6 lg:px-8 py-5 sm:py-6">
          {loading && submissions.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <svg
                className="animate-spin text-ink-3 mb-4"
                width="24" height="24" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
              >
                <path d="M21 12a9 9 0 11-6.219-8.56" />
              </svg>
              <p className="text-ink-3 text-sm">Loading feedback…</p>
            </div>
          )}

          {!loading && staffOptions.length > 0 && uiFeedback.length > 0 && (
            <div className="mb-8">
              <p className="text-xs font-semibold text-ink-3 uppercase tracking-wider mb-3">
                Staff performance
              </p>
              <div className="flex gap-4 overflow-x-auto pb-1 -mx-4 px-4 sm:mx-0 sm:px-0 sm:flex-wrap">
                {staffOptions.map(m => {
                  const avg = staffAvg(m.id)
                  const count = uiFeedback.filter(f => f.staffId === m.id).length
                  return (
                    <div
                      key={m.id}
                      className="bg-surface rounded-2xl border border-line px-5 py-4 flex items-center gap-4 flex-shrink-0"
                    >
                      <div className="w-9 h-9 rounded-full bg-warm flex items-center justify-center text-ink-2 text-sm font-semibold flex-shrink-0">
                        {m.initials}
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium text-ink text-sm truncate">{m.name}</p>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <MiniStars rating={avg} />
                          <span className="text-sm font-semibold text-ink">
                            {avg ? avg.toFixed(1) : '—'}
                          </span>
                          <span className="text-xs text-ink-3">({count})</span>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          <div>
            <p className="text-xs font-semibold text-ink-3 uppercase tracking-wider mb-3">
              All feedback{' '}
              <span className="font-normal normal-case">({filtered.length})</span>
            </p>

            {!loading && filtered.length === 0 ? (
              <div className="text-center py-16">
                <p className="font-display text-xl text-ink mb-1">No feedback yet</p>
                <p className="text-ink-3 text-sm">
                  Customer feedback will appear here after completed appointments.
                </p>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {filtered.map(f => (
                  <button
                    key={f.id}
                    onClick={() =>
                      setSelectedId(prev => (prev === f.id ? null : f.id))
                    }
                    className={`
                      flex items-start gap-4 p-4 bg-surface rounded-2xl border text-left transition-all
                      ${selectedId === f.id
                        ? 'border-warm shadow-sm'
                        : 'border-line hover:border-warm'}
                    `}
                  >
                    <div className="flex-shrink-0 pt-0.5">
                      <MiniStars rating={f.overallRating} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className="text-sm font-medium text-ink">
                          {f.anonymous ? 'Anonymous' : f.customerName ?? 'Anonymous'}
                        </span>
                        <span className="text-ink-3">·</span>
                        <span className="text-sm text-ink-3 truncate">{f.serviceName}</span>
                        <span className="text-ink-3">·</span>
                        <span className="text-sm text-ink-3 truncate">{f.staffName}</span>
                        {!f.reviewed && (
                          <span className="ml-1 text-[10px] bg-[#FBF5EA] text-[#7A5F2C] px-1.5 py-0.5 rounded-full font-medium">
                            New
                          </span>
                        )}
                      </div>
                      {f.comment && (
                        <p className="text-sm text-ink-2 line-clamp-2">"{f.comment}"</p>
                      )}
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-xs text-ink-3">{f.date}</p>
                      <p className="text-xs text-ink-3 mt-0.5">{f.branchName}</p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {selected && (
        <FeedbackDetailPanel
          item={selected}
          onClose={() => setSelectedId(null)}
          onMarkReviewed={() => markReviewed(selected.id)}
          onSaveNote={note => saveNote(selected.id, note)}
        />
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  coerceStaff                                                        */
/* ------------------------------------------------------------------ */

function coerceStaff(
  raw: unknown,
): { id: string; name: string; initials: string } | null {
  if (!raw || typeof raw !== 'object') return null
  const s = raw as any

  const id = typeof s.id === 'string' ? s.id : ''
  if (!id) return null

  let name = typeof s.name === 'string' ? s.name.trim() : ''

  if (!name) {
    const first = typeof s.firstName === 'string' ? s.firstName.trim() : ''
    const last  = typeof s.lastName  === 'string' ? s.lastName.trim()  : ''
    name = `${first} ${last}`.trim()
  }

  if (!name && typeof s.initials === 'string' && s.initials) {
    name = s.initials
  }

  if (!name) name = '—'

  const initials =
    (typeof s.initials === 'string' && s.initials) ||
    name
      .split(/\s+/)
      .filter(Boolean)
      .map((part: string) => part[0])
      .join('')
      .slice(0, 2)
      .toUpperCase() ||
    '?'

  return { id, name, initials }
}

/* ------------------------------------------------------------------ */
/*  StyledSelect                                                       */
/* ------------------------------------------------------------------ */

interface StyledSelectOption {
  value: string
  label: string
}

function StyledSelect({
  value,
  onChange,
  options,
  ariaLabel,
}: {
  value: string
  onChange: (v: string) => void
  options: StyledSelectOption[]
  ariaLabel?: string
}) {
  const [open, setOpen] = useState(false)
  const wrapRef = useRef<HTMLDivElement | null>(null)

  const current = options.find(o => o.value === value) ?? options[0]

  useEffect(() => {
    if (!open) return
    function onDoc(e: MouseEvent) {
      if (!wrapRef.current) return
      if (!wrapRef.current.contains(e.target as Node)) setOpen(false)
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div ref={wrapRef} className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={`
          flex items-center gap-2 h-8 pl-3 pr-2 rounded-xl border bg-bg
          text-xs text-ink transition-colors
          ${open
            ? 'border-ink ring-2 ring-ink-3/20'
            : 'border-line hover:border-warm'}
        `}
      >
        <span className="truncate max-w-[10rem]">{current?.label ?? ''}</span>
        <svg
          width="10" height="10" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
          className={`text-ink-3 flex-shrink-0 transition-transform ${open ? 'rotate-180' : ''}`}
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>

      {open && (
        <div
          className="
            absolute z-50 mt-1.5 left-0 min-w-full
            bg-surface border border-line rounded-2xl shadow-lg
            p-1 max-h-72 overflow-y-auto
          "
          role="listbox"
        >
          {options.map(o => {
            const selected = o.value === value
            return (
              <button
                key={o.value}
                type="button"
                onClick={() => {
                  onChange(o.value)
                  setOpen(false)
                }}
                className={`
                  w-full flex items-center gap-2 px-3 py-1.5 rounded-xl
                  text-xs text-left whitespace-nowrap transition-colors
                  ${selected
                    ? 'bg-ink text-surface font-medium'
                    : 'text-ink-2 hover:bg-warm-subtle hover:text-ink'}
                `}
              >
                <span className="w-3 flex-shrink-0">
                  {selected ? '✓' : ''}
                </span>
                <span className="truncate">{o.label}</span>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Detail Panel                                                       */
/* ------------------------------------------------------------------ */

function FeedbackDetailPanel({
  item,
  onClose,
  onMarkReviewed,
  onSaveNote,
}: {
  item: UiFeedback
  onClose: () => void
  onMarkReviewed: () => void
  onSaveNote: (note: string) => void
}) {
  const [note, setNote] = useState(item.internalNote ?? '')
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    setNote(item.internalNote ?? '')
  }, [item.id, item.internalNote])

  function handleSaveNote() {
    onSaveNote(note)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const ratings: Array<{ label: string; value: number }> = [
    { label: 'Overall',         value: item.overallRating },
    { label: 'Staff service',   value: item.staffRating },
    { label: 'Experience',      value: item.experienceRating },
    { label: 'Hygiene',         value: item.hygieneRating },
    { label: 'Service quality', value: item.serviceQualityRating },
    { label: 'Waiting time',    value: item.waitingRating },
  ].filter(r => r.value > 0)

  return (
    <div className="
      w-full sm:w-[300px] flex-shrink-0
      border-t sm:border-t-0 sm:border-l border-line
      bg-surface flex flex-col h-full overflow-hidden
    ">
      <div className="flex items-center justify-between px-5 py-4 border-b border-line">
        <p className="text-sm font-semibold text-ink">Feedback detail</p>
        <button
          onClick={onClose}
          className="w-7 h-7 rounded-lg flex items-center justify-center text-ink-3 hover:bg-warm-subtle hover:text-ink transition-colors"
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="px-5 py-5 border-b border-line">
          <div className="flex items-center justify-between mb-1 gap-2">
            <p className="font-semibold text-ink text-sm truncate">
              {item.anonymous ? 'Anonymous' : item.customerName ?? 'Anonymous'}
            </p>
            {!item.reviewed && (
              <span className="text-[10px] bg-[#FBF5EA] text-[#7A5F2C] px-1.5 py-0.5 rounded-full font-medium flex-shrink-0">
                New
              </span>
            )}
          </div>
          <p className="text-xs text-ink-3 truncate">
            {item.serviceName} · {item.staffName} · {item.branchName}
          </p>
          <p className="text-xs text-ink-3 mt-0.5">{item.date}</p>
          {item.customerPhone && !item.anonymous && (
            <p className="text-xs text-ink-3 mt-1">{item.customerPhone}</p>
          )}
        </div>

        {ratings.length > 0 && (
          <div className="px-5 py-4 border-b border-line">
            <p className="text-[10px] font-semibold text-ink-3 uppercase tracking-wider mb-4">
              Ratings
            </p>
            <div className="flex flex-col gap-3">
              {ratings.map(r => (
                <div key={r.label} className="flex items-center justify-between gap-2">
                  <span className="text-sm text-ink-3 truncate">{r.label}</span>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <MiniStars rating={r.value} />
                    <span className="text-sm font-medium text-ink w-5 text-right">
                      {r.value}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {item.extraResponses.length > 0 && (
          <div className="px-5 py-4 border-b border-line">
            <p className="text-[10px] font-semibold text-ink-3 uppercase tracking-wider mb-3">
              Additional
            </p>
            <div className="flex flex-col gap-3">
              {item.extraResponses.map((r, i) => (
                <div key={i}>
                  <p className="text-xs font-medium text-ink-2 mb-1">
                    {r.categoryName}
                  </p>
                  {r.type === 'RATING' && r.rating != null && (
                    <div className="flex items-center gap-2">
                      <MiniStars rating={r.rating} />
                      <span className="text-sm text-ink">{r.rating}</span>
                    </div>
                  )}
                  {r.type === 'TEXT' && r.text && (
                    <p className="text-sm text-ink-2 leading-relaxed">
                      "{r.text}"
                    </p>
                  )}
                  {r.type === 'BOOLEAN' && r.boolean != null && (
                    <p className="text-sm text-ink-2">
                      {r.boolean ? 'Yes' : 'No'}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {item.comment && (
          <div className="px-5 py-4 border-b border-line">
            <p className="text-[10px] font-semibold text-ink-3 uppercase tracking-wider mb-3">
              Comment
            </p>
            <p className="text-sm text-ink-2 leading-relaxed">"{item.comment}"</p>
          </div>
        )}

        <div className="px-5 py-4">
          <p className="text-[10px] font-semibold text-ink-3 uppercase tracking-wider mb-3">
            Internal note
          </p>
          <textarea
            value={note}
            onChange={e => setNote(e.target.value)}
            rows={3}
            placeholder="Add a private note…"
            className="w-full px-3 py-2.5 rounded-xl border border-line text-sm bg-bg text-ink placeholder:text-ink-3 focus:outline-none focus:border-warm resize-none"
          />
          <div className="flex items-center gap-2 mt-2">
            <Button size="sm" variant="secondary" onClick={handleSaveNote}>
              Save note
            </Button>
            {saved && <span className="text-xs text-[#2A5F30]">Saved</span>}
          </div>
          <p className="text-[11px] text-ink-3 mt-2">
            Notes are stored locally until the API adds support.
          </p>
        </div>
      </div>

      {!item.reviewed && (
        <div className="px-5 py-4 border-t border-line flex-shrink-0">
          <Button variant="secondary" fullWidth size="sm" onClick={onMarkReviewed}>
            Mark as reviewed
          </Button>
        </div>
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Sub-components                                                     */
/* ------------------------------------------------------------------ */

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

/* ------------------------------------------------------------------ */
/*  Normalization — FeedbackSubmission → UiFeedback                    */
/* ------------------------------------------------------------------ */

const CATEGORY_MATCHERS: Array<{
  key: keyof Pick<
    UiFeedback,
    | 'overallRating'
    | 'staffRating'
    | 'experienceRating'
    | 'hygieneRating'
    | 'serviceQualityRating'
    | 'waitingRating'
  >
  patterns: string[]
}> = [
  { key: 'overallRating',        patterns: ['overall'] },
  { key: 'staffRating',          patterns: ['staff'] },
  { key: 'experienceRating',     patterns: ['experience'] },
  { key: 'hygieneRating',        patterns: ['hygiene', 'clean'] },
  { key: 'serviceQualityRating', patterns: ['quality', 'service quality'] },
  { key: 'waitingRating',        patterns: ['wait', 'waiting', 'speed'] },
]

function matchCategory(
  name: string,
):
  | 'overallRating'
  | 'staffRating'
  | 'experienceRating'
  | 'hygieneRating'
  | 'serviceQualityRating'
  | 'waitingRating'
  | null {
  const lower = name.toLowerCase()
  for (const m of CATEGORY_MATCHERS) {
    if (m.patterns.some(p => lower.includes(p))) return m.key
  }
  return null
}

function normalizeForUi(
  s: FeedbackSubmission,
  meta?: { reviewed: boolean; internalNote: string },
): UiFeedback {
  const serviceName = s.appointment?.service?.name ?? '—'
  const branchId    = s.appointment?.branch?.id ?? ''
  const branchName  = s.appointment?.branch?.name ?? '—'
  const firstStaff  = s.appointment?.staff?.[0]
  const staffId     = firstStaff?.id ?? ''
  const staffName   = firstStaff
    ? `${firstStaff.firstName} ${firstStaff.lastName}`.trim()
    : '—'

  const date = s.submittedAt
    ? new Date(s.submittedAt).toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })
    : '—'

  let overallRating = 0
  let staffRating = 0
  let experienceRating = 0
  let hygieneRating = 0
  let serviceQualityRating = 0
  let waitingRating = 0

  let comment: string | null = null
  const extraResponses: UiFeedback['extraResponses'] = []

  for (const r of s.responses) {
    const name = r.category?.name ?? ''
    const type = r.category?.type ?? 'RATING'

    if (type === 'RATING' && r.ratingValue != null) {
      const slot = matchCategory(name)
      if (slot) {
        const v = r.ratingValue
        if (slot === 'overallRating') overallRating = v
        else if (slot === 'staffRating') staffRating = v
        else if (slot === 'experienceRating') experienceRating = v
        else if (slot === 'hygieneRating') hygieneRating = v
        else if (slot === 'serviceQualityRating') serviceQualityRating = v
        else if (slot === 'waitingRating') waitingRating = v
      } else {
        extraResponses.push({
          categoryName: name,
          type,
          rating: r.ratingValue,
          text: null,
          boolean: null,
        })
      }
    } else if (type === 'TEXT' && r.textResponse) {
      if (!comment) comment = r.textResponse
      else {
        extraResponses.push({
          categoryName: name,
          type,
          rating: null,
          text: r.textResponse,
          boolean: null,
        })
      }
    } else if (type === 'BOOLEAN' && r.booleanResponse != null) {
      extraResponses.push({
        categoryName: name,
        type,
        rating: null,
        text: null,
        boolean: r.booleanResponse,
      })
    }
  }

  if (overallRating === 0) {
    const numeric = [
      staffRating,
      experienceRating,
      hygieneRating,
      serviceQualityRating,
      waitingRating,
    ].filter(v => v > 0)
    if (numeric.length > 0) {
      overallRating = Math.round(
        numeric.reduce((s, v) => s + v, 0) / numeric.length,
      )
    }
  }

  return {
    id: s.id,
    anonymous: s.isAnonymous,
    customerName: s.customer
      ? `${s.customer.firstName} ${s.customer.lastName}`.trim()
      : null,
    customerPhone: s.customer?.phone ?? null,
    serviceName,
    staffId,
    staffName,
    branchId,
    branchName,
    date,

    overallRating,
    staffRating,
    experienceRating,
    hygieneRating,
    serviceQualityRating,
    waitingRating,

    comment,
    extraResponses,

    reviewed: meta?.reviewed ?? false,
    internalNote: meta?.internalNote ?? '',
  }
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function unwrapArray<T>(res: unknown): T[] {
  if (Array.isArray(res)) return res as T[]
  const anyRes = res as any
  if (Array.isArray(anyRes?.data?.data)) return anyRes.data.data as T[]
  if (Array.isArray(anyRes?.data)) return anyRes.data as T[]
  return []
}

function extractErrorMessage(err: unknown, fallback = 'Something went wrong.'): string {
  if (!err) return fallback
  const anyErr = err as any

  if (Array.isArray(anyErr?.details) && anyErr.details.length > 0) {
    const d = anyErr.details[0]
    if (typeof d === 'string') return d
    const field = d?.field ? `${d.field}: ` : ''
    return `${field}${d?.message ?? JSON.stringify(d)}`
  }

  const data = anyErr?.response?.data ?? anyErr?.data ?? anyErr

  if (Array.isArray(data?.errors) && data.errors.length > 0) {
    return String(data.errors[0])
  }

  if (Array.isArray(data?.details) && data.details.length > 0) {
    const d = data.details[0]
    if (typeof d === 'string') return d
    const field = d?.field ? `${d.field}: ` : ''
    return `${field}${d?.message ?? JSON.stringify(d)}`
  }

  if (typeof data?.message === 'string' && data.message) return data.message
  if (typeof anyErr?.message === 'string' && anyErr.message) return anyErr.message
  return fallback
}