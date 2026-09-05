import { useState } from 'react'
import type { FeedbackItem, StaffMember, Branch } from '../../types'
import { Button } from '../ui'

interface FeedbackPageProps {
  feedback: FeedbackItem[]
  staff: StaffMember[]
  branches: Branch[]
  onUpdate: (feedback: FeedbackItem[]) => void
}

export function FeedbackPage({ feedback, staff, branches, onUpdate }: FeedbackPageProps) {
  const [selected,     setSelected]     = useState<FeedbackItem | null>(null)
  const [filterStaff,  setFilterStaff]  = useState('all')
  const [filterBranch, setFilterBranch] = useState('all')

  const filtered = feedback.filter(f => {
    if (filterStaff  !== 'all' && f.staffId   !== filterStaff)  return false
    if (filterBranch !== 'all' && f.branchId  !== filterBranch) return false
    return true
  })

  const avgOverall = feedback.length
    ? (feedback.reduce((s, f) => s + f.overallRating, 0) / feedback.length).toFixed(1)
    : '—'
  const avgStaff = feedback.length
    ? (feedback.reduce((s, f) => s + f.staffRating, 0) / feedback.length).toFixed(1)
    : '—'
  const avgExp = feedback.length
    ? (feedback.reduce((s, f) => s + f.experienceRating, 0) / feedback.length).toFixed(1)
    : '—'

  function staffAvg(staffId: string) {
    const items = feedback.filter(f => f.staffId === staffId)
    if (!items.length) return 0
    return items.reduce((s, f) => s + f.overallRating, 0) / items.length
  }

  function markReviewed(id: string) {
    onUpdate(feedback.map(f => f.id === id ? { ...f, reviewed: true } : f))
    if (selected?.id === id) setSelected(f => f ? { ...f, reviewed: true } : null)
  }

  function saveNote(id: string, note: string) {
    onUpdate(feedback.map(f => f.id === id ? { ...f, internalNote: note } : f))
    if (selected?.id === id) setSelected(f => f ? { ...f, internalNote: note } : null)
  }

  return (
    <div className="flex h-full overflow-hidden">
      {/* Main */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-8 py-5 bg-surface border-b border-line flex-shrink-0">
          <div className="flex items-start justify-between mb-5">
            <div>
              <div className="flex items-center gap-3 mb-1">
                <h2 className="font-display text-[1.75rem] text-ink leading-none">Customer Feedback</h2>
                <span className="text-[10px] font-semibold bg-ink text-surface px-2.5 py-1 rounded-full tracking-wider">PRIVATE · ADMIN ONLY</span>
              </div>
              <p className="text-ink-3 text-sm">Private feedback from your customers.</p>
            </div>
          </div>

          {/* Metric cards */}
          <div className="grid grid-cols-4 gap-4 mb-5">
            {[
              { label: 'Average rating', value: avgOverall, sub: `${feedback.length} total` },
              { label: 'Staff rating',   value: avgStaff,   sub: 'avg. per staff' },
              { label: 'Experience',     value: avgExp,     sub: 'overall exp.' },
              { label: 'Unreviewed',     value: String(feedback.filter(f => !f.reviewed).length), sub: 'to review' },
            ].map(m => (
              <div key={m.label} className="bg-bg rounded-2xl border border-line px-5 py-4">
                <p className="text-xs text-ink-3 mb-1">{m.label}</p>
                <p className="font-display text-2xl text-ink">{m.value} <span className="text-base font-normal text-warm">★</span></p>
                <p className="text-xs text-ink-3 mt-1">{m.sub}</p>
              </div>
            ))}
          </div>

          {/* Filters */}
          <div className="flex items-center gap-2">
            <select value={filterStaff} onChange={e => setFilterStaff(e.target.value)}
              className="h-8 px-2.5 rounded-xl border border-line text-xs bg-bg text-ink focus:outline-none cursor-pointer">
              <option value="all">All staff</option>
              {staff.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
            <select value={filterBranch} onChange={e => setFilterBranch(e.target.value)}
              className="h-8 px-2.5 rounded-xl border border-line text-xs bg-bg text-ink focus:outline-none cursor-pointer">
              <option value="all">All branches</option>
              {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-8 py-6">
          {/* Staff performance */}
          <div className="mb-8">
            <p className="text-xs font-semibold text-ink-3 uppercase tracking-wider mb-3">Staff performance</p>
            <div className="flex gap-4">
              {staff.map(m => {
                const avg = staffAvg(m.id)
                const count = feedback.filter(f => f.staffId === m.id).length
                return (
                  <div key={m.id} className="bg-surface rounded-2xl border border-line px-5 py-4 flex items-center gap-4">
                    <div className="w-9 h-9 rounded-full bg-warm flex items-center justify-center text-ink-2 text-sm font-semibold flex-shrink-0">{m.initials}</div>
                    <div>
                      <p className="font-medium text-ink text-sm">{m.name}</p>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <MiniStars rating={avg} />
                        <span className="text-sm font-semibold text-ink">{avg ? avg.toFixed(1) : '—'}</span>
                        <span className="text-xs text-ink-3">({count})</span>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Feedback list */}
          <div>
            <p className="text-xs font-semibold text-ink-3 uppercase tracking-wider mb-3">
              All feedback <span className="font-normal normal-case">({filtered.length})</span>
            </p>
            {filtered.length === 0 ? (
              <div className="text-center py-16">
                <p className="font-display text-xl text-ink mb-1">No feedback yet</p>
                <p className="text-ink-3 text-sm">Customer feedback will appear here after completed appointments.</p>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {filtered.map(f => (
                  <button
                    key={f.id}
                    onClick={() => setSelected(prev => prev?.id === f.id ? null : f)}
                    className={`flex items-start gap-4 p-4 bg-surface rounded-2xl border text-left transition-all ${selected?.id === f.id ? 'border-warm shadow-sm' : 'border-line hover:border-warm'}`}
                  >
                    <div className="flex-shrink-0 pt-0.5">
                      <MiniStars rating={f.overallRating} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm font-medium text-ink">{f.anonymous ? 'Anonymous' : f.customerName ?? 'Anonymous'}</span>
                        <span className="text-ink-3">·</span>
                        <span className="text-sm text-ink-3">{f.serviceName}</span>
                        <span className="text-ink-3">·</span>
                        <span className="text-sm text-ink-3">{f.staffName}</span>
                        {!f.reviewed && <span className="ml-1 text-[10px] bg-[#FBF5EA] text-[#7A5F2C] px-1.5 py-0.5 rounded-full font-medium">New</span>}
                      </div>
                      {f.comment && <p className="text-sm text-ink-2 line-clamp-2">"{f.comment}"</p>}
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

      {/* Detail panel */}
      {selected && (
        <FeedbackDetailPanel
          item={selected}
          onClose={() => setSelected(null)}
          onMarkReviewed={() => markReviewed(selected.id)}
          onSaveNote={(note) => saveNote(selected.id, note)}
        />
      )}
    </div>
  )
}

// ─── Detail Panel ─────────────────────────────────────────────────────────────

function FeedbackDetailPanel({ item, onClose, onMarkReviewed, onSaveNote }: {
  item: FeedbackItem
  onClose: () => void
  onMarkReviewed: () => void
  onSaveNote: (note: string) => void
}) {
  const [note, setNote] = useState(item.internalNote ?? '')
  const [saved, setSaved] = useState(false)

  function handleSaveNote() {
    onSaveNote(note)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const categories = [
    { label: 'Overall',          value: item.overallRating },
    { label: 'Staff service',    value: item.staffRating },
    { label: 'Experience',       value: item.experienceRating },
    { label: 'Hygiene',          value: item.hygieneRating },
    { label: 'Service quality',  value: item.serviceQualityRating },
    { label: 'Waiting time',     value: item.waitingRating },
  ]

  return (
    <div className="w-[300px] flex-shrink-0 border-l border-line bg-surface flex flex-col h-full overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 border-b border-line">
        <p className="text-sm font-semibold text-ink">Feedback detail</p>
        <button onClick={onClose} className="w-7 h-7 rounded-lg flex items-center justify-center text-ink-3 hover:bg-warm-subtle hover:text-ink transition-colors">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 6L6 18M6 6l12 12"/></svg>
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* Customer + service info */}
        <div className="px-5 py-5 border-b border-line">
          <div className="flex items-center justify-between mb-1">
            <p className="font-semibold text-ink text-sm">{item.anonymous ? 'Anonymous' : item.customerName ?? 'Anonymous'}</p>
            {!item.reviewed && <span className="text-[10px] bg-[#FBF5EA] text-[#7A5F2C] px-1.5 py-0.5 rounded-full font-medium">New</span>}
          </div>
          <p className="text-xs text-ink-3">{item.serviceName} · {item.staffName} · {item.branchName}</p>
          <p className="text-xs text-ink-3 mt-0.5">{item.date}</p>
        </div>

        {/* Ratings */}
        <div className="px-5 py-4 border-b border-line">
          <p className="text-[10px] font-semibold text-ink-3 uppercase tracking-wider mb-4">Ratings</p>
          <div className="flex flex-col gap-3">
            {categories.map(c => (
              <div key={c.label} className="flex items-center justify-between">
                <span className="text-sm text-ink-3">{c.label}</span>
                <div className="flex items-center gap-2">
                  <MiniStars rating={c.value} />
                  <span className="text-sm font-medium text-ink w-5 text-right">{c.value}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Comment */}
        {item.comment && (
          <div className="px-5 py-4 border-b border-line">
            <p className="text-[10px] font-semibold text-ink-3 uppercase tracking-wider mb-3">Comment</p>
            <p className="text-sm text-ink-2 leading-relaxed">"{item.comment}"</p>
          </div>
        )}

        {/* Internal note */}
        <div className="px-5 py-4">
          <p className="text-[10px] font-semibold text-ink-3 uppercase tracking-wider mb-3">Internal note</p>
          <textarea
            value={note}
            onChange={e => setNote(e.target.value)}
            rows={3}
            placeholder="Add a private note…"
            className="w-full px-3 py-2.5 rounded-xl border border-line text-sm bg-bg text-ink placeholder:text-ink-3 focus:outline-none focus:border-warm resize-none"
          />
          <div className="flex items-center gap-2 mt-2">
            <Button size="sm" variant="secondary" onClick={handleSaveNote}>Save note</Button>
            {saved && <span className="text-xs text-[#2A5F30]">Saved</span>}
          </div>
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

function MiniStars({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1,2,3,4,5].map(i => (
        <svg key={i} width="11" height="11" viewBox="0 0 24 24" fill={i <= Math.round(rating) ? '#C4A97D' : 'none'} stroke="#C4A97D" strokeWidth="1.5">
          <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
        </svg>
      ))}
    </div>
  )
}
