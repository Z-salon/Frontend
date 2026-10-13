import { useEffect, useMemo, useRef, useState } from 'react'
import type {
  FeedbackSubmission,
  FeedbackCategory,
  FeedbackCategoryType,
  FeedbackCategoryInput,
  FeedbackCategoryUpdateInput,
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

interface UiResponse {
  categoryId: string
  categoryName: string
  type: FeedbackCategoryType
  rating: number | null
  text: string | null
  boolean: boolean | null
}

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

  responses: UiResponse[]

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
  focusSubmissionId?: string | null
  onFocusHandled?: () => void
}

export function FeedbackPage({
  staff: staffProp = [],
  branches: branchesProp = [],
  onUpdate,
  focusSubmissionId,
  onFocusHandled,
}: FeedbackPageProps) {
  const toast = useToast()
  const { activeBusinessId } = useBusiness()

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

  useEffect(() => {
    setFilterBranch(activeBranchId === 'all' ? 'all' : activeBranchId)
  }, [activeBranchId])

  const [selectedId, setSelectedId] = useState<string | null>(null)

  const [localMeta, setLocalMeta] = useState<
    Record<string, { reviewed: boolean; internalNote: string }>
  >({})

  const [questionsOpen, setQuestionsOpen] = useState(false)

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
  /*  Deep link — open one specific submission                        */
  /* ---------------------------------------------------------------- */

  useEffect(() => {
    if (!focusSubmissionId || !activeBusinessId) return
    let cancelled = false

    void (async () => {
      try {
        if (!submissions.some(x => x.id === focusSubmissionId)) {
          const detail = await feedbackApi.detail(
            activeBusinessId,
            focusSubmissionId,
          )
          if (cancelled || !detail) return
          const one = unwrapOne<FeedbackSubmission>(detail)
          if (one) {
            setSubmissions(prev =>
              prev.some(x => x.id === one.id) ? prev : [one, ...prev],
            )
          }
        }

        setFilterStaff('all')
        setFilterBranch('all')
        setSelectedId(focusSubmissionId)
      } catch (err) {
        if (cancelled) return
        console.warn('[feedback] focus fetch failed', err)
        toast.error('Could not open that response.')
      } finally {
        if (!cancelled) onFocusHandled?.()
      }
    })()

    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusSubmissionId, activeBusinessId])

  /* ---------------------------------------------------------------- */
  /*  Fetch staff from the API when the prop is empty.               */
  /* ---------------------------------------------------------------- */

  useEffect(() => {
    if (!activeBusinessId) return
    if (staffProp.length > 0) return
    let cancelled = false

    ;(async () => {
      try {
        const query =
          activeBranchFilter && activeBranchFilter !== 'all'
            ? { branchId: activeBranchFilter }
            : undefined
        const res = await staffApi.list(activeBusinessId, query)
        const list = unwrapArray<ApiStaff>(res)
        if (!cancelled) setApiStaff(list)
      } catch (err) {
        console.warn('[feedback] staffApi.list failed', err)
      }
    })()

    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeBusinessId, staffProp.length, activeBranchFilter])

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

  /* ---------------------------------------------------------------- */
  /*  Per-category stats                                              */
  /* ---------------------------------------------------------------- */

  const categoryStats = useMemo(() => {
    return categories
      .filter(c => c.is_enabled && c.type === 'RATING')
      .map(c => {
        const ratings = uiFeedback
          .flatMap(f => f.responses)
          .filter(r => r.categoryId === c.id && typeof r.rating === 'number')
          .map(r => r.rating as number)

        const average =
          ratings.length > 0
            ? ratings.reduce((s, v) => s + v, 0) / ratings.length
            : null

        return {
          categoryId: c.id,
          name: c.name,
          average,
          count: ratings.length,
        }
      })
  }, [categories, uiFeedback])

  function staffAvg(staffId: string) {
    const items = uiFeedback.filter(f => f.staffId === staffId)
    if (!items.length) return 0

    const scores = items
      .map(f => f.responses.find(r => typeof r.rating === 'number')?.rating)
      .filter((v): v is number => typeof v === 'number')

    if (!scores.length) return 0
    return scores.reduce((s, v) => s + v, 0) / scores.length
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
  /*  Staff options                                                   */
  /* ---------------------------------------------------------------- */

  const staffOptions = useMemo(() => {
    const out: Array<{ id: string; name: string; initials: string }> = []
    const seen = new Set<string>()

    const matchesBranch = (raw: any): boolean => {
      if (!activeBranchFilter || activeBranchFilter === 'all') return true
      if (typeof raw?.branchId === 'string') {
        return raw.branchId === activeBranchFilter
      }
      return true
    }

    for (const s of staffProp) {
      if (!matchesBranch(s)) continue
      const member = coerceStaff(s)
      if (!member || seen.has(member.id)) continue
      seen.add(member.id)
      out.push(member)
    }

    if (out.length === 0) {
      for (const s of apiStaff) {
        if (!matchesBranch(s)) continue
        const member = coerceStaff(s)
        if (!member || seen.has(member.id)) continue
        seen.add(member.id)
        out.push(member)
      }
    }

    if (out.length === 0) {
      for (const s of submissions) {
        const apptBranchId = s.appointment?.branch?.id
        if (
          activeBranchFilter &&
          activeBranchFilter !== 'all' &&
          apptBranchId !== activeBranchFilter
        ) {
          continue
        }

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
  /*  Branch options                                                  */
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

            <Button
              variant="secondary"
              size="sm"
              onClick={() => setQuestionsOpen(v => !v)}
            >
              {questionsOpen ? 'Hide questions' : 'Manage questions'}
            </Button>
          </div>

          {/* Feedback questions panel — collapses in/out */}
          {questionsOpen && (
            <FeedbackQuestionsPanel
              businessId={activeBusinessId}
              categories={categories}
              onChange={refresh}
            />
          )}

          {/* Metric cards — one per enabled RATING category, plus unreviewed */}
          {(categoryStats.length > 0 || uiFeedback.length > 0) && (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-5">
              {categoryStats.slice(0, 3).map(stat => (
                <div
                  key={stat.categoryId}
                  className="bg-bg rounded-2xl border border-line px-4 sm:px-5 py-4 min-w-0"
                >
                  <p className="text-[11px] sm:text-xs text-ink-3 mb-1 truncate">
                    {stat.name}
                  </p>
                  <p className="font-display text-lg sm:text-2xl text-ink truncate">
                    {stat.average != null ? stat.average.toFixed(1) : '—'}{' '}
                    <span className="text-base font-normal text-warm">★</span>
                  </p>
                  <p className="text-[11px] sm:text-xs text-ink-3 mt-1 truncate">
                    {stat.count} {stat.count === 1 ? 'response' : 'responses'}
                  </p>
                </div>
              ))}
              <div className="bg-bg rounded-2xl border border-line px-4 sm:px-5 py-4 min-w-0">
                <p className="text-[11px] sm:text-xs text-ink-3 mb-1 truncate">
                  Unreviewed
                </p>
                <p className="font-display text-lg sm:text-2xl text-ink truncate">
                  {uiFeedback.filter(f => !f.reviewed).length}
                </p>
                <p className="text-[11px] sm:text-xs text-ink-3 mt-1 truncate">
                  to review
                </p>
              </div>
            </div>
          )}

          {/* Filters */}
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
                {filtered.map(f => {
                  const firstRating =
                    f.responses.find(r => typeof r.rating === 'number')?.rating ?? 0

                  const previewComment =
                    f.responses.find(r => r.type === 'TEXT' && r.text)?.text ?? null

                  return (
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
                        {firstRating > 0 ? (
                          <MiniStars rating={firstRating} />
                        ) : (
                          <span className="text-xs text-ink-3">—</span>
                        )}
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
                        {previewComment && (
                          <p className="text-sm text-ink-2 line-clamp-2">
                            "{previewComment}"
                          </p>
                        )}
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="text-xs text-ink-3">{f.date}</p>
                        <p className="text-xs text-ink-3 mt-0.5">{f.branchName}</p>
                      </div>
                    </button>
                  )
                })}
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
/*  FeedbackQuestionsPanel                                             */
/*                                                                     */
/*  Inline CRUD for feedback categories, so the business can define    */
/*  what customers are asked without leaving the feedback page.        */
/* ------------------------------------------------------------------ */

interface QuestionsPanelProps {
  businessId: string | undefined | null
  categories: FeedbackCategory[]
  /** Refetch the parent's submissions + categories after a change. */
  onChange: () => void
}

function FeedbackQuestionsPanel({
  businessId,
  categories,
  onChange,
}: QuestionsPanelProps) {
  const toast = useToast()
  const [creating, setCreating] = useState(false)

  const enabledCount = categories.filter(c => c.is_enabled).length

  return (
    <div className="mb-5 rounded-2xl border border-line bg-bg overflow-hidden">
      <div className="flex items-center justify-between gap-3 px-4 sm:px-5 py-3.5 border-b border-line">
        <div className="min-w-0">
          <p className="text-xs font-semibold text-ink-3 uppercase tracking-wider">
            Feedback questions
          </p>
          <p className="text-[12px] text-ink-3 mt-1">
            {categories.length === 0
              ? 'No questions yet — customers see an empty form until you add at least one.'
              : `${enabledCount} enabled, ${categories.length - enabledCount} disabled.`}
          </p>
        </div>

        <Button
          size="sm"
          variant="secondary"
          onClick={() => setCreating(v => !v)}
          disabled={!businessId}
        >
          {creating ? 'Cancel' : 'Add question'}
        </Button>
      </div>

      {creating && businessId && (
        <CategoryForm
          businessId={businessId}
          onCreated={() => {
            setCreating(false)
            onChange()
          }}
        />
      )}

      {categories.length > 0 && (
        <ul className="divide-y divide-line">
          {categories.map(cat => (
            <CategoryRow
              key={cat.id}
              category={cat}
              businessId={businessId}
              onChange={onChange}
            />
          ))}
        </ul>
      )}

      {categories.length === 0 && !creating && (
        <div className="px-4 sm:px-5 py-6 text-center">
          <p className="text-sm text-ink-2 mb-1">
            No feedback questions yet
          </p>
          <p className="text-xs text-ink-3">
            Add a question and every completed appointment will start
            collecting an answer.
          </p>
        </div>
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  CategoryRow — one existing category                                */
/* ------------------------------------------------------------------ */

function CategoryRow({
  category,
  businessId,
  onChange,
}: {
  category: FeedbackCategory
  businessId: string | undefined | null
  onChange: () => void
}) {
  const toast = useToast()
  const [editing, setEditing] = useState(false)
  const [busy, setBusy] = useState(false)

  const [name, setName] = useState(category.name)
  const [description, setDescription] = useState(category.description ?? '')
  const [ratingMin, setRatingMin] = useState(category.rating_scale_min ?? 1)
  const [ratingMax, setRatingMax] = useState(category.rating_scale_max ?? 5)

  // The API forbids changing type/scale once a category has responses.
  // Disable the scale inputs in that case and show why.
  const scaleImmutable = category.response_count > 0

  async function savePatch(patch: FeedbackCategoryUpdateInput) {
    if (!businessId) return
    setBusy(true)
    try {
      await feedbackApi.categories.update(category.id, patch)
      onChange()
    } catch (err) {
      toast.error(extractErrorMessage(err, 'Could not update the question.'))
    } finally {
      setBusy(false)
    }
  }

  async function saveEdits() {
    const patch: FeedbackCategoryUpdateInput = {}

    if (name.trim() !== category.name) patch.name = name.trim()
    if ((description.trim() || null) !== (category.description ?? null)) {
      patch.description = description.trim() || null
    }
    if (
      category.type === 'RATING' &&
      !scaleImmutable &&
      (ratingMin !== category.rating_scale_min ||
        ratingMax !== category.rating_scale_max)
    ) {
      patch.ratingScaleMin = ratingMin
      patch.ratingScaleMax = ratingMax
    }

    if (Object.keys(patch).length === 0) {
      setEditing(false)
      return
    }

    await savePatch(patch)
    setEditing(false)
  }

  return (
    <li className="px-4 sm:px-5 py-3.5">
      {!editing ? (
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-sm font-medium text-ink truncate">
                {category.name}
              </p>
              <span className="text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded bg-warm-subtle text-ink-2">
                {categoryTypeLabel(category.type)}
              </span>
              {!category.is_enabled && (
                <span className="text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded bg-bad-soft text-bad">
                  Disabled
                </span>
              )}
            </div>
            {category.description && (
              <p className="text-xs text-ink-3 mt-1 truncate">
                {category.description}
              </p>
            )}
            <p className="text-[11px] text-ink-3 mt-1">
              {category.response_count}{' '}
              {category.response_count === 1 ? 'response' : 'responses'}
              {category.type === 'RATING' &&
                ` · scale ${category.rating_scale_min ?? 1}–${category.rating_scale_max ?? 5}`}
            </p>
          </div>

          <div className="flex items-center gap-1.5 flex-shrink-0">
            <button
              type="button"
              onClick={() => savePatch({ isEnabled: !category.is_enabled })}
              disabled={busy}
              className="text-xs text-ink-3 hover:text-ink transition-colors disabled:opacity-50"
            >
              {category.is_enabled ? 'Disable' : 'Enable'}
            </button>
            <span className="text-ink-3">·</span>
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="text-xs text-ink-3 hover:text-ink transition-colors"
            >
              Edit
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-ink-2">Name</label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              maxLength={100}
              disabled={busy}
              className="h-9 px-3 rounded-xl border border-line text-sm bg-surface text-ink placeholder:text-ink-3 focus:outline-none focus:border-warm disabled:opacity-50"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-ink-2">
              Description (optional)
            </label>
            <input
              type="text"
              value={description}
              onChange={e => setDescription(e.target.value)}
              maxLength={1000}
              disabled={busy}
              placeholder="What are you asking?"
              className="h-9 px-3 rounded-xl border border-line text-sm bg-surface text-ink placeholder:text-ink-3 focus:outline-none focus:border-warm disabled:opacity-50"
            />
          </div>

          {category.type === 'RATING' && (
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-ink-2">Rating scale</label>
              <div className="flex items-center gap-2">
                <NumberField
                  value={ratingMin}
                  onChange={setRatingMin}
                  min={0}
                  max={9}
                  disabled={busy || scaleImmutable}
                  label="Min"
                />
                <span className="text-ink-3 text-sm">to</span>
                <NumberField
                  value={ratingMax}
                  onChange={setRatingMax}
                  min={ratingMin + 1}
                  max={10}
                  disabled={busy || scaleImmutable}
                  label="Max"
                />
              </div>
              {scaleImmutable && (
                <p className="text-[11px] text-ink-3">
                  Scale is locked because this question already has responses.
                </p>
              )}
            </div>
          )}

          <div className="flex items-center gap-2">
            <Button size="sm" onClick={() => void saveEdits()} loading={busy}>
              Save
            </Button>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => {
                setEditing(false)
                setName(category.name)
                setDescription(category.description ?? '')
                setRatingMin(category.rating_scale_min ?? 1)
                setRatingMax(category.rating_scale_max ?? 5)
              }}
              disabled={busy}
            >
              Cancel
            </Button>
          </div>
        </div>
      )}
    </li>
  )
}

/* ------------------------------------------------------------------ */
/*  CategoryForm — create a new category                               */
/* ------------------------------------------------------------------ */

function CategoryForm({
  businessId,
  onCreated,
}: {
  businessId: string
  onCreated: () => void
}) {
  const toast = useToast()

  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [type, setType] = useState<FeedbackCategoryType>('RATING')
  const [ratingMin, setRatingMin] = useState(1)
  const [ratingMax, setRatingMax] = useState(5)
  const [busy, setBusy] = useState(false)

  async function submit() {
    const trimmed = name.trim()
    if (!trimmed) {
      toast.error('Give the question a name.')
      return
    }

    const input: FeedbackCategoryInput = {
      name: trimmed,
      type,
      description: description.trim() || undefined,
      isEnabled: true,
    }

    if (type === 'RATING') {
      if (ratingMax <= ratingMin) {
        toast.error('Rating scale max must be greater than min.')
        return
      }
      input.ratingScaleMin = ratingMin
      input.ratingScaleMax = ratingMax
    }

    setBusy(true)
    try {
      await feedbackApi.categories.create(businessId, input)
      onCreated()
    } catch (err) {
      toast.error(extractErrorMessage(err, 'Could not create the question.'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="px-4 sm:px-5 py-4 border-b border-line bg-surface flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-medium text-ink-2">
          Question type
        </label>
        <div className="grid grid-cols-3 gap-2">
          {(['RATING', 'TEXT', 'BOOLEAN'] as const).map(t => {
            const selected = type === t
            return (
              <button
                key={t}
                type="button"
                onClick={() => setType(t)}
                disabled={busy}
                className={`
                  h-9 px-3 rounded-xl border text-xs font-medium
                  transition-colors disabled:opacity-50
                  ${selected
                    ? 'border-ink bg-ink text-surface'
                    : 'border-line bg-bg text-ink-2 hover:border-ink-3'}
                `}
              >
                {categoryTypeLabel(t)}
              </button>
            )
          })}
        </div>
        <p className="text-[11px] text-ink-3">
          {type === 'RATING'
            ? 'A star rating. The customer picks a number between the min and max.'
            : type === 'TEXT'
              ? 'A free-text answer. Good for comments and suggestions.'
              : 'A yes/no question. Good for quick checks.'}
        </p>
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-medium text-ink-2">Name</label>
        <input
          type="text"
          value={name}
          onChange={e => setName(e.target.value)}
          maxLength={100}
          disabled={busy}
          autoFocus
          placeholder={
            type === 'RATING'
              ? 'e.g. How was your visit?'
              : type === 'TEXT'
                ? 'e.g. Anything to add?'
                : 'e.g. Would you recommend us?'
          }
          className="h-9 px-3 rounded-xl border border-line text-sm bg-bg text-ink placeholder:text-ink-3 focus:outline-none focus:border-warm disabled:opacity-50"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-medium text-ink-2">
          Description (optional)
        </label>
        <input
          type="text"
          value={description}
          onChange={e => setDescription(e.target.value)}
          maxLength={1000}
          disabled={busy}
          placeholder="Shown under the question"
          className="h-9 px-3 rounded-xl border border-line text-sm bg-bg text-ink placeholder:text-ink-3 focus:outline-none focus:border-warm disabled:opacity-50"
        />
      </div>

      {type === 'RATING' && (
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-ink-2">Rating scale</label>
          <div className="flex items-center gap-2">
            <NumberField
              value={ratingMin}
              onChange={setRatingMin}
              min={0}
              max={9}
              disabled={busy}
              label="Min"
            />
            <span className="text-ink-3 text-sm">to</span>
            <NumberField
              value={ratingMax}
              onChange={setRatingMax}
              min={ratingMin + 1}
              max={10}
              disabled={busy}
              label="Max"
            />
          </div>
          <p className="text-[11px] text-ink-3">
            Both numbers are between 0 and 10. Max must be greater than min.
          </p>
        </div>
      )}

      <div className="flex items-center gap-2">
        <Button size="sm" onClick={() => void submit()} loading={busy}>
          Create question
        </Button>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Small components                                                   */
/* ------------------------------------------------------------------ */

function NumberField({
  value,
  onChange,
  min,
  max,
  disabled,
  label,
}: {
  value: number
  onChange: (v: number) => void
  min: number
  max: number
  disabled?: boolean
  label: string
}) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-[11px] text-ink-3">{label}</span>
      <input
        type="number"
        value={value}
        onChange={e => {
          const n = Number(e.target.value)
          if (Number.isNaN(n)) return
          onChange(Math.min(max, Math.max(min, n)))
        }}
        min={min}
        max={max}
        disabled={disabled}
        className="w-16 h-9 px-2 rounded-xl border border-line text-sm bg-bg text-ink focus:outline-none focus:border-warm disabled:opacity-50"
      />
    </div>
  )
}

function categoryTypeLabel(t: FeedbackCategoryType): string {
  switch (t) {
    case 'RATING':
      return 'Rating'
    case 'TEXT':
      return 'Text'
    case 'BOOLEAN':
      return 'Yes / No'
  }
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

  const lastIdRef = useRef(item.id)
  useEffect(() => {
    if (lastIdRef.current !== item.id) {
      lastIdRef.current = item.id
      setNote(item.internalNote ?? '')
    }
  }, [item.id, item.internalNote])

  function handleSaveNote() {
    onSaveNote(note)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

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

        {item.responses.length > 0 && (
          <div className="px-5 py-4 border-b border-line">
            <p className="text-[10px] font-semibold text-ink-3 uppercase tracking-wider mb-4">
              Responses
            </p>
            <div className="flex flex-col gap-4">
              {item.responses.map(r => (
                <div key={r.categoryId}>
                  <p className="text-xs font-medium text-ink-2 mb-1.5">
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

        {item.responses.length === 0 && (
          <div className="px-5 py-4 border-b border-line">
            <p className="text-sm text-ink-3 leading-relaxed">
              This submission has no recorded responses.
            </p>
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
    ? `${firstStaff.first_name} ${firstStaff.last_name}`.trim()
    : '—'

  const date = s.submitted_at
    ? new Date(s.submitted_at).toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })
    : '—'

  const responses: UiResponse[] = s.responses.map(r => ({
    categoryId: r.category.id,
    categoryName: r.category.name,
    type: r.category.type,
    rating: r.rating_value,
    text: r.text_response,
    boolean: r.boolean_response,
  }))

  return {
    id: s.id,
    anonymous: s.is_anonymous,
    customerName: s.customer
      ? `${s.customer.first_name} ${s.customer.last_name}`.trim()
      : null,
    customerPhone: s.customer?.phone ?? null,
    serviceName,
    staffId,
    staffName,
    branchId,
    branchName,
    date,
    responses,
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

function unwrapOne<T>(res: unknown): T | null {
  if (res && typeof res === 'object') {
    const anyRes = res as any
    if (anyRes.data?.data) return anyRes.data.data as T
    if (anyRes.data) return anyRes.data as T
    return res as T
  }
  return null
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