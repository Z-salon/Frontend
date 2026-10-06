import { useEffect, useMemo, useState } from 'react'
import { Button } from '../ui'
import { LoadingState } from '../ui/EmptyState'
import { useFinanceOutstanding } from '../../hooks/useFinanceReports'
import { formatMoneyCompact } from '../../lib/money'
import { formatExpenseDate } from '../../lib/dates'
import type { FinanceOutstandingAppointment } from '../../types/api'

/* ------------------------------------------------------------------ */
/*  Finance → Outstanding                                              */
/*                                                                     */
/*  Everything is read from `/finance/outstanding`: the authoritative  */
/*  total, the appointment rows and the server pagination. No customer */
/*  is invented and no balance is calculated on the client.            */
/* ------------------------------------------------------------------ */

const PAGE_SIZE = 20

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

function customerName(row: FinanceOutstandingAppointment): string {
  const direct = row.customerName
  if (typeof direct === 'string' && direct.trim()) return direct

  const nested = (row as { customer?: unknown }).customer
  if (typeof nested === 'string' && nested.trim()) return nested
  if (nested && typeof nested === 'object') {
    const name = (nested as { name?: unknown }).name
    if (typeof name === 'string' && name.trim()) return name
  }
  return '—'
}

export function FinanceOutstandingTab({
  businessId,
  branchId,
  onNavigateToCustomer,
}: {
  businessId?: string
  branchId?: string
  onNavigateToCustomer?: (customerId: string) => void
}) {
  const [page, setPage] = useState(1)

  /* A branch change invalidates the current page. */
  useEffect(() => {
    setPage(1)
  }, [branchId])

  const { data, loading, error, reload } = useFinanceOutstanding(businessId, {
    branchId,
    page,
    limit: PAGE_SIZE,
  })

  const appointments = data?.appointments ?? []
  const meta = data?.meta ?? null
  const totalPages = meta?.totalPages ?? 1
  const currentPage = meta?.page ?? page
  const total = meta?.total ?? appointments.length

  const rows = useMemo(
    () =>
      appointments.map(row => ({
        row,
        id: row.appointmentId ?? (row as { id?: string }).id ?? '',
        name: customerName(row),
      })),
    [appointments],
  )

  const pending = loading && !data
  const failed = !!error && !data

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4 mb-5">
        <p className="text-xs font-semibold text-ink-3 uppercase tracking-wider">
          {pending
            ? 'Loading…'
            : `${total} customer${total === 1 ? '' : 's'} with outstanding balance`}
        </p>
        <div className="bg-surface rounded-2xl border border-line px-6 py-4 min-w-[220px]">
          <p className="text-xs text-ink-3 mb-1">Total outstanding</p>
          <p className="font-display text-2xl text-[#B06A6A]">
            {pending ? '—' : `${formatMoneyCompact(data?.totalOutstanding)} ETB`}
          </p>
        </div>
      </div>

      {failed ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <p className="font-display text-xl text-ink mb-1">
            Unable to load outstanding balances.
          </p>
          <p className="text-ink-3 text-sm mb-5">
            Something went wrong while fetching the report.
          </p>
          <Button size="sm" onClick={reload}>
            Retry
          </Button>
        </div>
      ) : pending ? (
        <LoadingState label="Loading outstanding balances…" />
      ) : rows.length === 0 ? (
        <div className="bg-surface rounded-2xl border border-line py-16 text-center">
          <p className="font-display text-xl text-ink mb-1">All clear</p>
          <p className="text-ink-3 text-sm">No outstanding customer balances.</p>
        </div>
      ) : (
        <>
          <div className="bg-surface rounded-2xl border border-line overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line">
                  <th className="text-left px-5 py-3 text-xs font-semibold text-ink-3">Customer</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-ink-3">Date</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-ink-3">Status</th>
                  <th className="text-right px-5 py-3 text-xs font-semibold text-ink-3">Total</th>
                  <th className="text-right px-5 py-3 text-xs font-semibold text-ink-3">Paid</th>
                  <th className="text-right px-5 py-3 text-xs font-semibold text-ink-3">Outstanding</th>
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
                        <div>
                          <p className="font-medium text-ink">{name}</p>
                          {row.customerPhone && (
                            <p className="text-xs text-ink-3">{row.customerPhone}</p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3 text-ink-3 text-sm whitespace-nowrap">
                      {formatExpenseDate(row.scheduledStart)}
                    </td>
                    <td className="px-5 py-3 text-ink-3 text-xs uppercase tracking-wide">
                      {row.status ?? '—'}
                    </td>
                    <td className="px-5 py-3 text-right text-ink-2 tabular-nums">
                      {formatMoneyCompact(row.finalAgreedAmount ?? row.originalAmount)}
                    </td>
                    <td className="px-5 py-3 text-right text-ink-2 tabular-nums">
                      {formatMoneyCompact(row.verifiedPaid)}
                    </td>
                    <td className="px-5 py-3 text-right font-semibold text-[#B06A6A] tabular-nums">
                      {formatMoneyCompact(row.outstanding)} ETB
                    </td>
                    <td className="px-5 py-3">
                      {onNavigateToCustomer && row.customerId && (
                        <div className="flex justify-end">
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => onNavigateToCustomer(row.customerId as string)}
                          >
                            View
                          </Button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {meta && meta.totalPages > 1 && (
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