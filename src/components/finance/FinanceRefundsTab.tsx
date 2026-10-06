import { useMemo, useState } from 'react'
import type { RefundRequest, RefundRequestStatus } from '../../types/api'
import { Button } from '../ui'
import { EmptyState, LoadingState } from '../ui/EmptyState'
import { useRefundRequests } from '../../hooks/useRefundRequests'
import { formatMoney } from '../../lib/money'
import { formatDateTime } from '../../lib/dates'
import { RefundStatusBadge, REFUND_STATUSES, refundStatusLabel } from './refundStatus'
import { RefundDetailsView } from './RefundDetailsView'
import { CreateRefundView } from './CreateRefundView'

/* ------------------------------------------------------------------ */
/*  Finance → Refunds (operational queue)                              */
/*                                                                     */
/*  Backed entirely by `/refund-requests`: the list, the status filter  */
/*  and the server pagination all come from the backend. This is NOT    */
/*  the `/finance/refunds` reporting endpoint.                         */
/* ------------------------------------------------------------------ */

const PAGE_SIZE = 20

type StatusFilter = RefundRequestStatus | 'all'

/** Windowed page numbers, e.g. 1 … 4 5 6 … 12. */
function pageNumbers(current: number, total: number): Array<number | '…'> {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1)
  const wanted = new Set([1, total, current - 1, current, current + 1])
  const sorted = [...wanted].filter(p => p >= 1 && p <= total).sort((a, b) => a - b)
  const out: Array<number | '…'> = []
  let prev = 0
  for (const p of sorted) {
    if (prev && p - prev > 1) out.push('…')
    out.push(p)
    prev = p
  }
  return out
}

function customerName(row: RefundRequest): string {
  const c = row.appointment?.customer
  if (!c) return '—'
  const name = [c.firstName, c.lastName].filter(Boolean).join(' ').trim()
  return name || '—'
}

type View =
  | { type: 'list' }
  | { type: 'details'; id: string }
  | { type: 'create' }

export function FinanceRefundsTab({
  businessId,
  branches = [],
}: {
  businessId?: string
  branches?: Array<{ id: string; name: string }>
}) {
  const [view, setView] = useState<View>({ type: 'list' })

  const [status, setStatus] = useState<StatusFilter>('all')
  const [page, setPage] = useState(1)

  const { requests, meta, loading, error, reload } = useRefundRequests(businessId, {
    status: status === 'all' ? undefined : status,
    page,
    limit: PAGE_SIZE,
  })

  const total = meta?.total ?? requests.length
  const totalPages = meta?.totalPages ?? 1
  const currentPage = meta?.page ?? page

  const showSpinner = loading && requests.length === 0 && !error
  const showError = !!error && requests.length === 0
  const isEmpty = !loading && !error && requests.length === 0 && total === 0

  const filterLabel = status === 'all' ? 'All' : refundStatusLabel(status)

  const rows = useMemo(
    () => requests.map(row => ({ row, id: row.id, name: customerName(row) })),
    [requests],
  )

  function backToList() {
    setView({ type: 'list' })
  }

  async function handleChanged() {
    await reload()
  }

  if (view.type === 'details') {
    return (
      <RefundDetailsView
        businessId={businessId}
        refundRequestId={view.id}
        branches={branches}
        onBack={backToList}
        onChanged={handleChanged}
      />
    )
  }

  if (view.type === 'create') {
    return (
      <CreateRefundView
        businessId={businessId}
        branches={branches}
        onBack={backToList}
        onCreated={async () => {
          setPage(1)
          setView({ type: 'list' })
          await reload()
        }}
      />
    )
  }

  return (
    <div>
      {/* Page header */}
      <div className="flex flex-wrap items-start justify-between gap-4 mb-5">
        <div>
          <h3 className="font-display text-2xl text-ink leading-none mb-1">Refunds</h3>
          <p className="text-ink-3 text-sm">Manage customer refund requests.</p>
        </div>
        <Button onClick={() => setView({ type: 'create' })}>+ Create Refund</Button>
      </div>

      {/* Status filter */}
      <div className="flex items-center justify-between gap-3 mb-4">
        <select
          aria-label="Filter refund requests by status"
          value={status}
          onChange={e => {
            setStatus(e.target.value as StatusFilter)
            setPage(1)
          }}
          className="h-9 px-3 rounded-lg border border-line text-sm bg-surface text-ink focus:outline-none cursor-pointer"
        >
          <option value="all">All</option>
          {REFUND_STATUSES.map(s => (
            <option key={s} value={s}>
              {refundStatusLabel(s)}
            </option>
          ))}
        </select>

        {!showSpinner && !showError && (
          <p className="text-xs text-ink-3">
            {total} request{total === 1 ? '' : 's'}
            {status === 'all' ? '' : ` · ${filterLabel}`}
          </p>
        )}
      </div>

      {showError ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <p className="font-display text-xl text-ink mb-1">
            Unable to load refund requests.
          </p>
          <p className="text-ink-3 text-sm mb-5">
            {error ?? 'Something went wrong while fetching refund requests.'}
          </p>
          <Button size="sm" onClick={() => void reload()}>
            Retry
          </Button>
        </div>
      ) : showSpinner ? (
        <LoadingState label="Loading refund requests…" />
      ) : isEmpty ? (
        <div className="bg-surface rounded-2xl border border-line py-16 text-center">
          <p className="font-display text-xl text-ink mb-1">No refund requests found.</p>
          <p className="text-ink-3 text-sm">
            There are no refund requests matching the current filter.
          </p>
        </div>
      ) : (
        <>
          <div className="bg-surface rounded-2xl border border-line overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line">
                  <th className="text-left px-5 py-3 text-xs font-semibold text-ink-3">Customer</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-ink-3">Appointment</th>
                  <th className="text-right px-5 py-3 text-xs font-semibold text-ink-3">Requested</th>
                  <th className="text-right px-5 py-3 text-xs font-semibold text-ink-3">Approved</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-ink-3">Reason</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-ink-3">Requested At</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-ink-3">Status</th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody className={loading ? 'opacity-60' : ''}>
                {rows.map(({ row, id, name }) => (
                  <tr key={id} className="border-b border-line last:border-0 hover:bg-bg">
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-warm-subtle flex items-center justify-center text-ink-3 text-xs font-semibold">
                          {name === '—' ? '?' : name.slice(0, 2).toUpperCase()}
                        </div>
                        <p className="font-medium text-ink">{name}</p>
                      </div>
                    </td>
                    <td className="px-5 py-3 text-ink-3 text-sm whitespace-nowrap">
                      {formatDateTime(row.appointment?.scheduledStart)}
                    </td>
                    <td className="px-5 py-3 text-right text-ink-2 tabular-nums whitespace-nowrap">
                      {formatMoney(row.requestedAmount)}
                    </td>
                    <td className="px-5 py-3 text-right text-ink-2 tabular-nums whitespace-nowrap">
                      {row.approvedAmount == null ? '—' : formatMoney(row.approvedAmount)}
                    </td>
                    <td className="px-5 py-3 text-ink-3 text-sm max-w-[220px] truncate">
                      {row.reason ?? '—'}
                    </td>
                    <td className="px-5 py-3 text-ink-3 text-sm whitespace-nowrap">
                      {formatDateTime(row.requestedAt)}
                    </td>
                    <td className="px-5 py-3">
                      <RefundStatusBadge status={row.status} />
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex justify-end">
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => setView({ type: 'details', id: row.id })}
                        >
                          View
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 mt-4">
              <p className="text-xs text-ink-3">
                Page {currentPage} of {totalPages}
              </p>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={currentPage <= 1}
                  className="h-8 px-3 rounded-lg border border-line text-xs font-medium text-ink-2 hover:text-ink disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  Previous
                </button>
                {pageNumbers(currentPage, totalPages).map((p, i) =>
                  p === '…' ? (
                    <span key={`gap-${i}`} className="px-1.5 text-xs text-ink-3">
                      …
                    </span>
                  ) : (
                    <button
                      key={p}
                      onClick={() => setPage(p)}
                      className={`h-8 min-w-8 px-2 rounded-lg text-xs font-medium transition-colors ${
                        p === currentPage
                          ? 'bg-ink text-surface'
                          : 'text-ink-2 hover:bg-warm-subtle'
                      }`}
                    >
                      {p}
                    </button>
                  ),
                )}
                <button
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage >= totalPages}
                  className="h-8 px-3 rounded-lg border border-line text-xs font-medium text-ink-2 hover:text-ink disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}