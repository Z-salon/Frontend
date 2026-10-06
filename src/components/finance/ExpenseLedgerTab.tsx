import { useMemo, useState } from 'react'
import type { Expense, ExpenseStatus } from '../../types/api'
import { Button } from '../ui'
import { EmptyState, LoadingState } from '../ui/EmptyState'
import { useExpenses } from '../../hooks/useExpenses'
import { useExpenseCategories } from '../../hooks/useExpenseCategories'
import { usePaymentMethods } from '../../hooks/usePaymentMethods'
import { formatMoney } from '../../lib/money'
import { formatExpenseDay } from '../../lib/dates'
import { ExpenseStatusBadge, EXPENSE_STATUSES, expenseStatusLabel } from './expenseStatus'
import { ExpenseFormModal } from './ExpenseFormModal'
import { ExpenseDetailsModal } from './ExpenseDetailsModal'

/* ------------------------------------------------------------------ */
/*  Expense ledger (Finance → Expenses)                                */
/*                                                                     */
/*  The whole tab is backend-driven: list, filters, pagination and     */
/*  every mutation. There is no mock expense row and no client-side    */
/*  id — the server is the only source of truth.                       */
/*                                                                     */
/*  Search has no backend parameter in the contract, so it filters the */
/*  page already loaded; status/category/branch/date are sent to the   */
/*  endpoint and re-request.                                            */
/* ------------------------------------------------------------------ */

const PAGE_SIZE = 20

type StatusFilter = ExpenseStatus | 'all'

function LayersIcon() {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 2L2 7l10 5 10-5-10-5z" />
      <path d="M2 12l10 5 10-5" />
      <path d="M2 17l10 5 10-5" />
    </svg>
  )
}

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

function FilterSelect({
  label,
  value,
  onChange,
  children,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  children: React.ReactNode
}) {
  return (
    <select
      aria-label={label}
      value={value}
      onChange={e => onChange(e.target.value)}
      className="h-9 px-3 rounded-lg border border-line text-sm bg-surface text-ink focus:outline-none cursor-pointer"
    >
      {children}
    </select>
  )
}

export function ExpenseLedgerTab({
  businessId,
  branches,
  onManageCategories,
}: {
  businessId?: string
  branches: Array<{ id: string; name: string }>
  onManageCategories?: () => void
}) {
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState<StatusFilter>('all')
  const [categoryId, setCategoryId] = useState('all')
  const [branchId, setBranchId] = useState('all')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [page, setPage] = useState(1)

  const [detailsId, setDetailsId] = useState<string | null>(null)
  const [form, setForm] = useState<'create' | { edit: Expense } | null>(null)

  const { categories } = useExpenseCategories(businessId)
  const { methods } = usePaymentMethods(businessId)

  const {
    expenses,
    meta,
    loading,
    error,
    reload,
    create,
    update,
    recordPayment,
    voidExpense,
  } = useExpenses(businessId, {
    from: from || undefined,
    to: to || undefined,
    branchId: branchId === 'all' ? undefined : branchId,
    categoryId: categoryId === 'all' ? undefined : categoryId,
    status: status === 'all' ? undefined : status,
    page,
    limit: PAGE_SIZE,
  })

  const activeCategories = useMemo(
    () => categories.filter(c => c.isActive),
    [categories],
  )

  /* Search is client-side — no `search` parameter exists in the contract. */
  const visible = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return expenses
    return expenses.filter(e =>
      [
        e.description,
        e.vendor,
        e.receiptNumber,
        e.category?.name,
        e.branch?.name,
      ].some(field => (field ?? '').toLowerCase().includes(q)),
    )
  }, [expenses, search])

  const filtersActive =
    !!search.trim() ||
    status !== 'all' ||
    categoryId !== 'all' ||
    branchId !== 'all' ||
    !!from ||
    !!to

  function resetPage() {
    setPage(1)
  }

  function clearFilters() {
    setSearch('')
    setStatus('all')
    setCategoryId('all')
    setBranchId('all')
    setFrom('')
    setTo('')
    setPage(1)
  }

  const total = meta?.total ?? expenses.length
  const totalPages = meta?.totalPages ?? 1
  const currentPage = meta?.page ?? page
  const rangeStart = total === 0 ? 0 : (currentPage - 1) * PAGE_SIZE + 1
  const rangeEnd = Math.min(currentPage * PAGE_SIZE, total)

  const showSpinner = loading && expenses.length === 0 && !error
  const showError = !!error && expenses.length === 0
  const noRowsFromServer = !loading && !error && expenses.length === 0
  const noVisibleRows =
    !loading && !error && expenses.length > 0 && visible.length === 0

  if (!businessId) {
    return (
      <p className="text-sm text-ink-3 py-8 text-center">
        Select a business to view its expenses.
      </p>
    )
  }

  return (
    <div className="flex flex-col gap-5">
      {/* ---- Search + Add ---- */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="relative sm:w-80">
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-3"
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <circle cx="11" cy="11" r="8" />
            <path d="M21 21l-4.35-4.35" />
          </svg>
          <input
            value={search}
            onChange={e => {
              setSearch(e.target.value)
              resetPage()
            }}
            placeholder="Search expenses…"
            aria-label="Search expenses"
            className="h-9 w-full pl-9 pr-3 rounded-xl border border-line text-sm bg-bg text-ink placeholder:text-ink-3 focus:outline-none focus:border-warm"
          />
        </div>
        <Button size="sm" onClick={() => setForm('create')}>
          + Add Expense
        </Button>
      </div>

      {/* ---- Filters ---- */}
      <div className="flex flex-wrap items-center gap-2">
        <FilterSelect
          label="Status"
          value={status}
          onChange={v => {
            setStatus(v as StatusFilter)
            resetPage()
          }}
        >
          <option value="all">All statuses</option>
          {EXPENSE_STATUSES.map(s => (
            <option key={s} value={s}>
              {expenseStatusLabel(s)}
            </option>
          ))}
        </FilterSelect>

        <FilterSelect
          label="Category"
          value={categoryId}
          onChange={v => {
            setCategoryId(v)
            resetPage()
          }}
        >
          <option value="all">All categories</option>
          {activeCategories.map(c => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </FilterSelect>

        <FilterSelect
          label="Branch"
          value={branchId}
          onChange={v => {
            setBranchId(v)
            resetPage()
          }}
        >
          <option value="all">All branches</option>
          {branches.map(b => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </FilterSelect>

        <div className="flex items-center gap-2">
          <input
            type="date"
            aria-label="From date"
            value={from}
            onChange={e => {
              setFrom(e.target.value)
              resetPage()
            }}
            className="h-9 px-3 rounded-lg border border-line text-sm bg-surface text-ink focus:outline-none"
          />
          <span className="text-ink-3 text-xs">to</span>
          <input
            type="date"
            aria-label="To date"
            value={to}
            onChange={e => {
              setTo(e.target.value)
              resetPage()
            }}
            className="h-9 px-3 rounded-lg border border-line text-sm bg-surface text-ink focus:outline-none"
          />
        </div>

        {filtersActive && (
          <button
            onClick={clearFilters}
            className="text-xs font-medium text-ink-3 hover:text-ink transition-colors"
          >
            Clear filters
          </button>
        )}
      </div>

      {/* ---- Count ---- */}
      <p className="text-xs font-semibold text-ink-3 uppercase tracking-wider">
        {loading && expenses.length === 0
          ? 'Loading…'
          : `${total} expense${total === 1 ? '' : 's'}`}
        {search.trim() && !loading && (
          <span className="ml-2 font-normal normal-case tracking-normal text-ink-3">
            · {visible.length} match{visible.length === 1 ? '' : 'es'} on this page
          </span>
        )}
      </p>

      {error && expenses.length > 0 && (
        <div className="flex items-center justify-between gap-3 px-4 py-3 rounded-xl bg-bg border border-line">
          <p className="text-xs text-ink-3">{error}</p>
          <button
            onClick={() => void reload()}
            className="text-xs font-medium text-ink hover:underline flex-shrink-0"
          >
            Retry
          </button>
        </div>
      )}

      {/* ---- Body ---- */}
      {showSpinner ? (
        <LoadingState label="Loading expenses…" />
      ) : showError ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <p className="font-display text-xl text-ink mb-1">Unable to load expenses.</p>
          <p className="text-ink-3 text-sm mb-5">
            Something went wrong while fetching the ledger.
          </p>
          <Button size="sm" onClick={() => void reload()}>
            Retry
          </Button>
        </div>
      ) : noRowsFromServer && !filtersActive ? (
        <EmptyState
          icon={<LayersIcon />}
          title="No expenses in this period."
          description="Add an expense to start tracking business expenses."
          action={
            <Button size="sm" onClick={() => setForm('create')}>
              + Add Expense
            </Button>
          }
        />
      ) : noRowsFromServer || noVisibleRows ? (
        <EmptyState
          icon={<LayersIcon />}
          title="No expenses match your filters."
          description="Try a different search, status, category, branch or date range."
          action={
            <Button size="sm" variant="secondary" onClick={clearFilters}>
              Clear filters
            </Button>
          }
        />
      ) : (
        <>
          <div className="bg-surface rounded-2xl border border-line overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line">
                  <th className="text-left px-5 py-3 text-xs font-semibold text-ink-3">Date</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-ink-3">Description</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-ink-3">Category</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-ink-3">Branch</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-ink-3">Status</th>
                  <th className="text-right px-5 py-3 text-xs font-semibold text-ink-3">Amount</th>
                </tr>
              </thead>
              <tbody className={loading ? 'opacity-60' : ''}>
                {visible.map(e => (
                  <tr
                    key={e.id}
                    onClick={() => setDetailsId(e.id)}
                    className="border-b border-line last:border-0 hover:bg-bg cursor-pointer transition-colors"
                  >
                    <td className="px-5 py-3 text-ink-3 text-xs whitespace-nowrap">
                      {formatExpenseDay(e.expenseDate)}
                    </td>
                    <td className="px-5 py-3 text-ink font-medium max-w-[260px]">
                      <span className="block truncate">{e.description?.trim() || '—'}</span>
                      {e.vendor && (
                        <span className="block text-xs text-ink-3 truncate">{e.vendor}</span>
                      )}
                    </td>
                    <td className="px-5 py-3 text-ink-2 text-sm">
                      {e.category?.name ?? '—'}
                    </td>
                    <td className="px-5 py-3 text-ink-2 text-sm">{e.branch?.name ?? '—'}</td>
                    <td className="px-5 py-3">
                      <ExpenseStatusBadge status={e.status} />
                    </td>
                    <td className="px-5 py-3 text-right font-semibold text-ink tabular-nums whitespace-nowrap">
                      {formatMoney(e.amount)} ETB
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* ---- Pagination ---- */}
          {meta && meta.totalPages > 1 && (
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
              <p className="text-xs text-ink-3">
                Showing {rangeStart}–{rangeEnd} of {total}
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

      {/* ---- Details ---- */}
      <ExpenseDetailsModal
        businessId={businessId}
        expenseId={detailsId}
        methods={methods}
        recordPayment={recordPayment}
        voidExpense={voidExpense}
        onClose={() => setDetailsId(null)}
        onEdit={expense => {
          setDetailsId(null)
          setForm({ edit: expense })
        }}
      />

      {/* ---- Add / Edit ---- */}
      <ExpenseFormModal
        open={form !== null}
        expense={form && form !== 'create' ? form.edit : null}
        categories={categories}
        branches={branches}
        methods={methods}
        create={create}
        update={update}
        onClose={() => setForm(null)}
        onSaved={saved => {
          setForm(null)
          setDetailsId(saved.id)
        }}
        onManageCategories={onManageCategories}
      />
    </div>
  )
}