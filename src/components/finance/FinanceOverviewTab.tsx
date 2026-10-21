import { Button } from '../ui'
import { useFinanceSummary } from '../../hooks/useFinanceReports'
import { formatMoneyCompact } from '../../lib/money'

/* ------------------------------------------------------------------ */
/*  Finance → Overview                                                 */
/*                                                                     */
/*  The four KPI cards come straight off `/finance/summary`; nothing   */
/*  is computed from other frontend data. The endpoint carries no      */
/*  transaction-level list, so "Recent transactions" keeps its empty   */
/*  state rather than fabricating rows from summary counts.            */
/* ------------------------------------------------------------------ */

function KpiCard({
  label,
  value,
  color,
}: {
  label: string
  value: string
  color: string
}) {
  return (
    <div className="bg-surface rounded-2xl border border-line px-6 py-5">
      <p className="text-xs text-ink-3 mb-2">{label}</p>
      <p className={`font-display text-2xl ${color}`}>{value}</p>
      <p className="text-xs text-ink-3 mt-1">ETB</p>
    </div>
  )
}

export function FinanceOverviewTab({
  businessId,
  branchId,
  range,
}: {
  businessId?: string
  branchId?: string
  range: { from?: string; to?: string }
}) {
  const { data, loading, error, reload } = useFinanceSummary(businessId, {
    from: range.from,
    to: range.to,
    branchId,
  })

  const summary = data?.summary
  /* Never render a real-looking `0 ETB` before the backend answers. */
  const pending = loading && !data
  const money = (value: string | undefined) =>
    pending || !value ? '—' : formatMoneyCompact(value)

  const net = summary ? Number(summary.netOperatingResult) : 0
  const totalRefunds = summary ? Number(summary.totalRefunds) : 0

  const cards = [
    { label: 'Total revenue', value: money(summary?.totalRevenue), color: 'text-ink' },
    { label: 'Total expenses', value: money(summary?.totalExpenses), color: 'text-ink' },
    {
      label: 'Net',
      value: money(summary?.netOperatingResult),
      color: net >= 0 ? 'text-[#2A6139]' : 'text-[#B06A6A]',
    },
    { label: 'Outstanding', value: money(summary?.totalOutstanding), color: 'text-[#7A5F2C]' },
  ]

  return (
    <div>
      {error && !data && (
        <div className="flex items-center justify-between gap-3 bg-[#F5F4F2] border border-line rounded-2xl px-5 py-3 mb-6">
          <p className="text-sm text-ink-2">Unable to load finance summary.</p>
          <Button size="sm" variant="secondary" onClick={reload}>
            Retry
          </Button>
        </div>
      )}

      <div className="grid grid-cols-4 gap-4 mb-8">
        {cards.map(card => (
          <div key={card.label} className={pending ? 'animate-pulse' : ''}>
            <KpiCard label={card.label} value={card.value} color={card.color} />
          </div>
        ))}
      </div>

      {/* The summary endpoint carries no transaction-level rows, so this
          stays an empty state rather than inventing records. */}
      <div className="mb-8">
        <p className="text-xs font-semibold text-ink-3 uppercase tracking-wider mb-3">
          Recent transactions
        </p>
        <div className="bg-surface rounded-2xl border border-line overflow-hidden">
          <div className="py-10 text-center text-ink-3 text-sm">
            No transactions in this period.
          </div>
        </div>
      </div>

      {totalRefunds > 0 && (
        <div className="bg-[#FBF5EA] rounded-2xl border border-[#E8D9C0] px-6 py-4">
          <p className="text-xs font-semibold text-[#7A5F2C] mb-1">Refunds this period</p>
          <p className="font-display text-xl text-[#7A5F2C]">
            {formatMoneyCompact(summary?.totalRefunds)} ETB
          </p>
        </div>
      )}
    </div>
  )
}