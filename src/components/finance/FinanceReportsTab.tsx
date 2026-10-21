import { useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { Button } from '../ui'
import { LoadingState } from '../ui/EmptyState'
import {
  useFinanceCollections,
  useFinanceExpenseReport,
  useFinanceRefunds,
  useFinanceRevenue,
} from '../../hooks/useFinanceReports'
import { formatMoneyCompact } from '../../lib/money'
import { financeDateLabel, lastNDaysRange } from '../../lib/financeDate'
import type { FinanceReportQuery, FinanceRefundStatusBreakdown } from '../../types/api'

/* ------------------------------------------------------------------ */
/*  Reports (Finance → Reports)                                        */
/*                                                                     */
/*  Four reporting endpoints back this page: revenue, expenses,        */
/*  collections and refunds. Every number comes from the backend; the  */
/*  only client maths is chart geometry and aligning two date arrays   */
/*  by their real date value.                                          */
/*                                                                     */
/*  The 7d/30d controls re-request the reports with a matching window  */
/*  instead of slicing already-loaded data; changing the shared branch  */
/*  filter re-requests too.                                            */
/* ------------------------------------------------------------------ */

const num = (value: string | number | null | undefined): number => {
  const n = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(n) ? n : 0
}

/**
 * `byStatus` may arrive as an array of rows or as a keyed object
 * (`{ PENDING: { count, amount }, … }`). Normalize either shape into the array
 * the UI renders so a keyed payload can never crash the card.
 */
function toStatusRows(
  breakdown: FinanceRefundStatusBreakdown | undefined,
): Array<{
  status: string
  count: number
  amount?: string
  requestedAmount?: string
  approvedAmount?: string
  completedAmount?: string
  rejectedAmount?: string
}> {
  if (!breakdown) return []
  if (Array.isArray(breakdown)) return breakdown
  return Object.entries(breakdown).map(([status, values]) => ({
    count: 0,
    ...(values ?? {}),
    status,
  }))
}

function ReportCard({
  title,
  children,
}: {
  title: string
  children: ReactNode
}) {
  return (
    <div className="bg-surface rounded-2xl border border-line p-5">
      <p className="text-xs font-semibold text-ink-3 uppercase tracking-wider mb-3">
        {title}
      </p>
      {children}
    </div>
  )
}

function SectionNote({ children }: { children: ReactNode }) {
  return <p className="text-xs text-ink-3 py-1">{children}</p>
}

export function FinanceReportsTab({
  businessId,
  branchId,
  range,
  timeZone,
}: {
  businessId?: string
  branchId?: string
  /** Range resolved from the shared Today / This week / … control. */
  range: FinanceReportQuery
  timeZone?: string
}) {
  const [rangeOverride, setRangeOverride] = useState<'7' | '30' | null>(null)
  const [view, setView] = useState<'revenue' | 'expenses'>('revenue')

  // A change to the shared date filter drops the 7d/30d override so the
  // global filter is always observable on this page.
  useEffect(() => {
    setRangeOverride(null)
  }, [range.from, range.to, branchId])

  const effective: FinanceReportQuery = rangeOverride
    ? { ...lastNDaysRange(Number(rangeOverride), timeZone), branchId }
    : { ...range, branchId }

  const revenue = useFinanceRevenue(businessId, effective)
  const expenses = useFinanceExpenseReport(businessId, effective)
  const collections = useFinanceCollections(businessId, effective)
  const refunds = useFinanceRefunds(businessId, effective)

  const anyData =
    !!revenue.data || !!expenses.data || !!collections.data || !!refunds.data
  const anyLoading =
    revenue.loading || expenses.loading || collections.loading || refunds.loading
  const allFailed =
    !!revenue.error &&
    !!expenses.error &&
    !!collections.error &&
    !!refunds.error &&
    !anyData

  const retryAll = () => {
    void revenue.reload()
    void expenses.reload()
    void collections.reload()
    void refunds.reload()
  }

  /* Revenue and expenses arrive as independent date arrays — merge by the
     backend-provided date, treating a missing counterpart as zero. */
  const chart = useMemo(() => {
    const byDate = new Map<string, { revenue: number; expenses: number }>()
    for (const row of revenue.data?.breakdowns.byDate ?? []) {
      const entry = byDate.get(row.date) ?? { revenue: 0, expenses: 0 }
      entry.revenue = num(row.revenue)
      byDate.set(row.date, entry)
    }
    for (const row of expenses.data?.breakdowns.byDate ?? []) {
      const entry = byDate.get(row.date) ?? { revenue: 0, expenses: 0 }
      entry.expenses = num(row.expenses)
      byDate.set(row.date, entry)
    }
    return [...byDate.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, values]) => ({ date, ...values }))
  }, [revenue.data, expenses.data])

  const chartValues = chart.map(d => (view === 'revenue' ? d.revenue : d.expenses))
  const chartMax = Math.max(...chartValues, 1)

  const services = useMemo(
    () =>
      [...(revenue.data?.breakdowns.byService ?? [])].sort(
        (a, b) => num(b.amount) - num(a.amount),
      ),
    [revenue.data],
  )
  const totalRevenue = num(revenue.data?.totalRevenue)

  const paymentMethods = useMemo(
    () =>
      [...(collections.data?.breakdowns.byPaymentMethod ?? [])].sort(
        (a, b) => num(b.amount) - num(a.amount),
      ),
    [collections.data],
  )

  const expenseCategories = useMemo(
    () =>
      [...(expenses.data?.breakdowns.byCategory ?? [])].sort(
        (a, b) => num(b.amount) - num(a.amount),
      ),
    [expenses.data],
  )

  const refundStatus = toStatusRows(
    refunds.data?.byStatus ?? refunds.data?.breakdowns?.byStatus,
  )
  const refundTotal =
    refunds.data?.totalRefunds ?? refunds.data?.completedRefundAmount

  if (!businessId) {
    return (
      <p className="text-sm text-ink-3 py-8 text-center">
        Select a business to view its reports.
      </p>
    )
  }

  if (allFailed) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <p className="font-display text-xl text-ink mb-1">Unable to load reports.</p>
        <p className="text-ink-3 text-sm mb-5">Something went wrong while fetching report data.</p>
        <Button size="sm" onClick={retryAll}>
          Retry
        </Button>
      </div>
    )
  }

  if (anyLoading && !anyData) {
    return <LoadingState label="Loading reports…" />
  }

  return (
    <div className="grid grid-cols-3 gap-6">
      {/* ---- Main chart ---- */}
      <div className="col-span-2 bg-surface rounded-2xl border border-line p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <p className="font-medium text-ink">Revenue over time</p>
            <p className="text-xs text-ink-3 mt-0.5">
              Daily {view === 'revenue' ? 'revenue' : 'expenses'} in ETB
            </p>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setView('revenue')}
              className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all ${
                view === 'revenue' ? 'bg-ink text-surface' : 'text-ink-3 hover:text-ink'
              }`}
            >
              Revenue
            </button>
            <button
              onClick={() => setView('expenses')}
              className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all ${
                view === 'expenses' ? 'bg-ink text-surface' : 'text-ink-3 hover:text-ink'
              }`}
            >
              Expenses
            </button>
            <div className="w-px h-4 bg-line mx-1" />
            <button
              onClick={() => setRangeOverride('7')}
              className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all ${
                rangeOverride === '7' ? 'bg-ink text-surface' : 'text-ink-3 hover:text-ink'
              }`}
            >
              7d
            </button>
            <button
              onClick={() => setRangeOverride('30')}
              className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all ${
                rangeOverride === '30' ? 'bg-ink text-surface' : 'text-ink-3 hover:text-ink'
              }`}
            >
              30d
            </button>
          </div>
        </div>

        {chart.length === 0 ? (
          <div className="h-36 flex items-center justify-center text-sm text-ink-3">
            No {view === 'revenue' ? 'revenue' : 'expense'} data for this period.
          </div>
        ) : (
          <div className="flex items-end gap-1 h-36">
            {chart.map(d => {
              const value = view === 'revenue' ? d.revenue : d.expenses
              const pct = chartMax > 0 ? (value / chartMax) * 100 : 0
              return (
                <div key={d.date} className="flex-1 flex flex-col items-center gap-1">
                  <div className="w-full flex items-end" style={{ height: '112px' }}>
                    <div
                      className={`w-full rounded-t-lg transition-all ${
                        view === 'revenue' ? 'bg-ink' : 'bg-warm'
                      }`}
                      style={{ height: `${Math.max(pct, value > 0 ? 4 : 0)}%` }}
                      title={`${d.date}: ${formatMoneyCompact(value)} ETB`}
                    />
                  </div>
                  <span className="text-[9px] text-ink-3">
                    {financeDateLabel(d.date, chart.length <= 7)}
                  </span>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* ---- Side breakdowns ---- */}
      <div className="flex flex-col gap-4">
        <ReportCard title="By service">
          {revenue.loading && !revenue.data ? (
            <SectionNote>Loading…</SectionNote>
          ) : revenue.error && !revenue.data ? (
            <SectionNote>Unable to load service data.</SectionNote>
          ) : services.length === 0 ? (
            <SectionNote>No service data for this period.</SectionNote>
          ) : (
            <div className="flex flex-col gap-2">
              {services.slice(0, 5).map(s => (
                <div key={s.serviceId}>
                  <div className="flex items-center justify-between mb-0.5">
                    <span className="text-xs text-ink">{s.serviceName}</span>
                    <span className="text-xs font-semibold text-ink">
                      {formatMoneyCompact(s.amount)}
                    </span>
                  </div>
                  <div className="h-1.5 bg-warm-subtle rounded-full overflow-hidden">
                    <div
                      className="h-full bg-ink rounded-full"
                      style={{ width: `${(num(s.amount) / (totalRevenue || 1)) * 100}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </ReportCard>

        <ReportCard title="Payment methods">
          {collections.loading && !collections.data ? (
            <SectionNote>Loading…</SectionNote>
          ) : collections.error && !collections.data ? (
            <SectionNote>Unable to load collection data.</SectionNote>
          ) : paymentMethods.length === 0 ? (
            <SectionNote>No collections for this period.</SectionNote>
          ) : (
            <div className="flex flex-col gap-2">
              {paymentMethods.map(m => (
                <div
                  key={`${m.paymentMethodId}-${m.paymentMethodType}`}
                  className="flex items-center justify-between"
                >
                  <span className="text-xs text-ink">
                    {m.paymentMethodName}
                    <span className="text-ink-3"> ({m.count})</span>
                  </span>
                  <span className="text-xs font-semibold text-ink">
                    {formatMoneyCompact(m.amount)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </ReportCard>

        <ReportCard title="Refunds">
          {refunds.loading && !refunds.data ? (
            <SectionNote>Loading…</SectionNote>
          ) : refunds.error && !refunds.data ? (
            <SectionNote>Unable to load refund data.</SectionNote>
          ) : (
            <>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-ink-3">Total refunds</span>
                <span className="text-xs font-semibold text-ink">
                  {refundTotal != null ? `${formatMoneyCompact(refundTotal)} ETB` : '—'}
                </span>
              </div>
              {refundStatus.length === 0 ? (
                <SectionNote>No refunds for this period.</SectionNote>
              ) : (
                <div className="flex flex-col gap-1.5">
                  {refundStatus.map(s => (
                    <div key={s.status} className="flex items-center justify-between">
                      <span className="text-xs text-ink-3 capitalize">
                        {s.status.toLowerCase().replace(/_/g, ' ')}
                      </span>
                      <span className="text-xs font-semibold text-ink">
                        {formatMoneyCompact(
                          s.amount ??
                            s.completedAmount ??
                            s.approvedAmount ??
                            s.requestedAmount ??
                            s.rejectedAmount,
                        )}{' '}
                        <span className="text-ink-3 font-normal">({s.count})</span>
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </ReportCard>

        <ReportCard title="By staff">
          <SectionNote>
            Staff revenue breakdown is not available from the finance reporting endpoints.
          </SectionNote>
        </ReportCard>

        <ReportCard title="Expenses by category">
          {expenses.loading && !expenses.data ? (
            <SectionNote>Loading…</SectionNote>
          ) : expenses.error && !expenses.data ? (
            <SectionNote>Unable to load expense data.</SectionNote>
          ) : expenseCategories.length === 0 ? (
            <SectionNote>No expenses for this period.</SectionNote>
          ) : (
            <div className="flex flex-col gap-1.5">
              {expenseCategories.map(c => (
                <div key={c.categoryId} className="flex items-center justify-between">
                  <span className="text-xs text-ink-3">
                    {c.categoryName}
                    <span className="text-ink-3/70"> ({c.count})</span>
                  </span>
                  <span className="text-xs font-semibold text-ink">
                    −{formatMoneyCompact(c.amount)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </ReportCard>
      </div>
    </div>
  )
}