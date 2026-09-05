import { useState } from 'react'
import type { Transaction, ExpenseCategory, PaymentMethod, Customer } from '../../types'
import { Button, Modal } from '../ui'

type FinanceTab = 'overview' | 'transactions' | 'expenses' | 'outstanding' | 'reports'

interface FinancePageProps {
  transactions: Transaction[]
  expenseCategories: ExpenseCategory[]
  paymentMethods: PaymentMethod[]
  customers: Customer[]
  onUpdateTransactions: (t: Transaction[]) => void
  onUpdateCategories: (c: ExpenseCategory[]) => void
  onUpdatePaymentMethods: (p: PaymentMethod[]) => void
  onUpdateCustomers: (c: Customer[]) => void
  onNavigateToCustomer?: (customerId: string) => void
}

export function FinancePage({
  transactions, expenseCategories, paymentMethods, customers,
  onUpdateTransactions, onUpdateCategories, onUpdatePaymentMethods,
  onUpdateCustomers, onNavigateToCustomer,
}: FinancePageProps) {
  const [tab, setTab] = useState<FinanceTab>('overview')
  const [filterBranch, setFilterBranch] = useState('all')
  const [filterDate,   setFilterDate]   = useState<'today' | 'week' | 'month' | 'all'>('month')

  const TABS: { id: FinanceTab; label: string }[] = [
    { id: 'overview',      label: 'Overview'      },
    { id: 'transactions',  label: 'Transactions'  },
    { id: 'expenses',      label: 'Expenses'      },
    { id: 'outstanding',   label: 'Outstanding'   },
    { id: 'reports',       label: 'Reports'       },
  ]

  function filterTx(tx: Transaction[]) {
    return tx.filter(t => {
      if (filterBranch !== 'all' && t.branchId !== filterBranch) return false
      if (filterDate === 'today') return t.date === today()
      if (filterDate === 'week')  return t.date >= weekAgo()
      if (filterDate === 'month') return t.date >= monthAgo()
      return true
    })
  }

  const filtered = filterTx(transactions)
  const revenue  = filtered.filter(t => t.type === 'revenue').reduce((s, t) => s + (t.amountPaid ?? t.amount), 0)
  const expenses = filtered.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0)
  const outstanding = customers.reduce((s, c) => s + (c.outstandingBalance ?? 0), 0)

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="px-8 py-5 bg-surface border-b border-line flex-shrink-0">
        <div className="flex items-start justify-between mb-5">
          <div>
            <h2 className="font-display text-[1.75rem] text-ink leading-none mb-1">Finance</h2>
            <p className="text-ink-3 text-sm">Keep track of your salon's money.</p>
          </div>
          <div className="flex items-center gap-2">
            <ExportButton />
          </div>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-2 mb-5">
          <select value={filterBranch} onChange={e => setFilterBranch(e.target.value)}
            className="h-8 px-2.5 rounded-xl border border-line text-xs bg-bg text-ink focus:outline-none cursor-pointer">
            <option value="all">All branches</option>
            <option value="b1">Bole</option>
            <option value="b2">Kazanchis</option>
          </select>
          {(['today','week','month','all'] as const).map(d => (
            <button key={d} onClick={() => setFilterDate(d)}
              className={`h-8 px-3 rounded-xl text-xs font-medium transition-all ${filterDate === d ? 'bg-ink text-surface' : 'bg-bg border border-line text-ink-3 hover:text-ink'}`}>
              {d === 'today' ? 'Today' : d === 'week' ? 'This week' : d === 'month' ? 'This month' : 'All time'}
            </button>
          ))}
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-1">
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${tab === t.id ? 'bg-ink text-surface' : 'text-ink-3 hover:text-ink hover:bg-warm-subtle'}`}>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-8 py-6">
        {tab === 'overview' && (
          <OverviewTab filtered={filtered} revenue={revenue} expenses={expenses} outstanding={outstanding} />
        )}
        {tab === 'transactions' && (
          <TransactionsTab
            transactions={filtered}
            allTransactions={transactions}
            onUpdate={onUpdateTransactions}
            paymentMethods={paymentMethods}
            expenseCategories={expenseCategories}
          />
        )}
        {tab === 'expenses' && (
          <ExpensesTab
            transactions={transactions}
            filtered={filtered.filter(t => t.type === 'expense')}
            expenseCategories={expenseCategories}
            paymentMethods={paymentMethods}
            onUpdateTransactions={onUpdateTransactions}
            onUpdateCategories={onUpdateCategories}
          />
        )}
        {tab === 'outstanding' && (
          <OutstandingTab
            customers={customers}
            paymentMethods={paymentMethods}
            onUpdateCustomers={onUpdateCustomers}
            onUpdateTransactions={onUpdateTransactions}
            transactions={transactions}
            onNavigateToCustomer={onNavigateToCustomer}
          />
        )}
        {tab === 'reports' && (
          <ReportsTab transactions={transactions} />
        )}
      </div>
    </div>
  )
}

// ─── Overview Tab ────────────────────────────────────────────────────────────

function OverviewTab({ filtered, revenue, expenses, outstanding }: {
  filtered: Transaction[]; revenue: number; expenses: number; outstanding: number
}) {
  const net = revenue - expenses
  const refunds = filtered.filter(t => t.type === 'refund').reduce((s, t) => s + t.amount, 0)

  return (
    <div>
      <div className="grid grid-cols-4 gap-4 mb-8">
        {[
          { label: 'Total revenue',  value: revenue,      color: 'text-ink'        },
          { label: 'Total expenses', value: expenses,     color: 'text-ink'        },
          { label: 'Net',            value: net,          color: net >= 0 ? 'text-[#2A6139]' : 'text-[#B06A6A]' },
          { label: 'Outstanding',    value: outstanding,  color: 'text-[#7A5F2C]'  },
        ].map(m => (
          <div key={m.label} className="bg-surface rounded-2xl border border-line px-6 py-5">
            <p className="text-xs text-ink-3 mb-2">{m.label}</p>
            <p className={`font-display text-2xl ${m.color}`}>{fmt(m.value)}</p>
            <p className="text-xs text-ink-3 mt-1">ETB</p>
          </div>
        ))}
      </div>

      {/* Recent transactions */}
      <div className="mb-8">
        <p className="text-xs font-semibold text-ink-3 uppercase tracking-wider mb-3">Recent transactions</p>
        <div className="bg-surface rounded-2xl border border-line overflow-hidden">
          {filtered.slice(0, 8).map((t, i) => (
            <TxRow key={t.id} tx={t} isLast={i === Math.min(7, filtered.length - 1)} />
          ))}
          {filtered.length === 0 && (
            <div className="py-10 text-center text-ink-3 text-sm">No transactions in this period.</div>
          )}
        </div>
      </div>

      {refunds > 0 && (
        <div className="bg-[#FBF5EA] rounded-2xl border border-[#E8D9C0] px-6 py-4">
          <p className="text-xs font-semibold text-[#7A5F2C] mb-1">Refunds this period</p>
          <p className="font-display text-xl text-[#7A5F2C]">{fmt(refunds)} ETB</p>
        </div>
      )}
    </div>
  )
}

// ─── Transactions Tab ─────────────────────────────────────────────────────────

function TransactionsTab({ transactions, allTransactions, onUpdate, paymentMethods, expenseCategories }: {
  transactions: Transaction[]
  allTransactions: Transaction[]
  onUpdate: (t: Transaction[]) => void
  paymentMethods: PaymentMethod[]
  expenseCategories: ExpenseCategory[]
}) {
  const [selected, setSelected] = useState<Transaction | null>(null)
  const [showAdd,  setShowAdd]  = useState(false)
  const [filterType, setFilterType] = useState<'all' | 'revenue' | 'expense' | 'refund' | 'adjustment'>('all')

  const visible = transactions.filter(t => filterType === 'all' || t.type === filterType)
    .sort((a, b) => b.date.localeCompare(a.date))

  return (
    <div className="flex gap-6">
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-1">
            {(['all','revenue','expense','refund','adjustment'] as const).map(t => (
              <button key={t} onClick={() => setFilterType(t)}
                className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all capitalize ${filterType === t ? 'bg-ink text-surface' : 'text-ink-3 hover:text-ink hover:bg-warm-subtle'}`}>
                {t === 'all' ? 'All' : t}
              </button>
            ))}
          </div>
          <Button size="sm" onClick={() => setShowAdd(true)}>+ Add Revenue</Button>
        </div>

        <div className="bg-surface rounded-2xl border border-line overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line">
                <th className="text-left px-5 py-3 text-xs font-semibold text-ink-3">Date</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-ink-3">Description</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-ink-3">Customer</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-ink-3">Branch</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-ink-3">Payment</th>
                <th className="text-right px-5 py-3 text-xs font-semibold text-ink-3">Amount</th>
              </tr>
            </thead>
            <tbody>
              {visible.length === 0 && (
                <tr><td colSpan={6} className="py-10 text-center text-ink-3 text-sm">No transactions found.</td></tr>
              )}
              {visible.map(t => (
                <tr key={t.id} onClick={() => setSelected(prev => prev?.id === t.id ? null : t)}
                  className={`border-b border-line last:border-0 cursor-pointer transition-colors ${selected?.id === t.id ? 'bg-warm-subtle' : 'hover:bg-bg'}`}>
                  <td className="px-5 py-3 text-ink-3 text-xs whitespace-nowrap">{t.date}</td>
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-2">
                      <TxTypeDot type={t.type} />
                      <span className="text-ink font-medium">{t.description}</span>
                    </div>
                    <span className="text-xs text-ink-3">{t.category}</span>
                  </td>
                  <td className="px-5 py-3 text-ink-2 text-sm">{t.customerName ?? '—'}</td>
                  <td className="px-5 py-3 text-ink-2 text-sm">{t.branchName}</td>
                  <td className="px-5 py-3 text-ink-3 text-sm">{t.paymentMethod}</td>
                  <td className="px-5 py-3 text-right">
                    <span className={`font-semibold ${t.type === 'revenue' ? 'text-[#2A6139]' : t.type === 'expense' ? 'text-ink' : 'text-[#B06A6A]'}`}>
                      {t.type === 'revenue' ? '+' : '−'}{fmt(t.amount)}
                    </span>
                    {t.paymentStatus === 'partial' && (
                      <p className="text-[10px] text-[#7A5F2C]">Partial ({fmt(t.amountPaid ?? 0)} paid)</p>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {selected && (
        <TxDetailPanel
          tx={selected}
          allTransactions={allTransactions}
          onClose={() => setSelected(null)}
          onUpdate={onUpdate}
          paymentMethods={paymentMethods}
        />
      )}

      {showAdd && (
        <AddRevenueModal
          onClose={() => setShowAdd(false)}
          paymentMethods={paymentMethods}
          expenseCategories={expenseCategories}
          onAdd={tx => onUpdate([...allTransactions, tx])}
        />
      )}
    </div>
  )
}

// ─── Expenses Tab ─────────────────────────────────────────────────────────────

function ExpensesTab({ transactions, filtered, expenseCategories, paymentMethods, onUpdateTransactions, onUpdateCategories }: {
  transactions: Transaction[]
  filtered: Transaction[]
  expenseCategories: ExpenseCategory[]
  paymentMethods: PaymentMethod[]
  onUpdateTransactions: (t: Transaction[]) => void
  onUpdateCategories: (c: ExpenseCategory[]) => void
}) {
  const [showAdd,       setShowAdd]       = useState(false)
  const [showManageCat, setShowManageCat] = useState(false)
  const sorted = [...filtered].sort((a, b) => b.date.localeCompare(a.date))

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <p className="text-xs font-semibold text-ink-3 uppercase tracking-wider">
          {sorted.length} expense{sorted.length !== 1 ? 's' : ''}
        </p>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="secondary" onClick={() => setShowManageCat(true)}>Manage categories</Button>
          <Button size="sm" onClick={() => setShowAdd(true)}>+ Add Expense</Button>
        </div>
      </div>

      <div className="bg-surface rounded-2xl border border-line overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line">
              <th className="text-left px-5 py-3 text-xs font-semibold text-ink-3">Date</th>
              <th className="text-left px-5 py-3 text-xs font-semibold text-ink-3">Description</th>
              <th className="text-left px-5 py-3 text-xs font-semibold text-ink-3">Category</th>
              <th className="text-left px-5 py-3 text-xs font-semibold text-ink-3">Branch</th>
              <th className="text-left px-5 py-3 text-xs font-semibold text-ink-3">Payment</th>
              <th className="text-right px-5 py-3 text-xs font-semibold text-ink-3">Amount</th>
            </tr>
          </thead>
          <tbody>
            {sorted.length === 0 && (
              <tr><td colSpan={6} className="py-10 text-center text-ink-3 text-sm">No expenses in this period.</td></tr>
            )}
            {sorted.map(t => (
              <tr key={t.id} className="border-b border-line last:border-0 hover:bg-bg">
                <td className="px-5 py-3 text-ink-3 text-xs">{t.date}</td>
                <td className="px-5 py-3 text-ink font-medium">{t.description}</td>
                <td className="px-5 py-3 text-ink-3 text-sm">{t.category}</td>
                <td className="px-5 py-3 text-ink-3 text-sm">{t.branchName}</td>
                <td className="px-5 py-3 text-ink-3 text-sm">{t.paymentMethod}</td>
                <td className="px-5 py-3 text-right font-semibold text-ink">−{fmt(t.amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showAdd && (
        <AddExpenseModal
          onClose={() => setShowAdd(false)}
          expenseCategories={expenseCategories}
          paymentMethods={paymentMethods}
          onAdd={tx => onUpdateTransactions([...transactions, tx])}
        />
      )}
      {showManageCat && (
        <ManageCategoriesModal
          categories={expenseCategories}
          onClose={() => setShowManageCat(false)}
          onUpdate={onUpdateCategories}
        />
      )}
    </div>
  )
}

// ─── Outstanding Tab ──────────────────────────────────────────────────────────

function OutstandingTab({ customers, paymentMethods, onUpdateCustomers, onUpdateTransactions, transactions, onNavigateToCustomer }: {
  customers: Customer[]
  paymentMethods: PaymentMethod[]
  onUpdateCustomers: (c: Customer[]) => void
  onUpdateTransactions: (t: Transaction[]) => void
  transactions: Transaction[]
  onNavigateToCustomer?: (id: string) => void
}) {
  const [payingFor, setPayingFor] = useState<Customer | null>(null)

  const debtors = customers.filter(c => (c.outstandingBalance ?? 0) > 0)
    .sort((a, b) => (b.outstandingBalance ?? 0) - (a.outstandingBalance ?? 0))

  function recordPayment(customerId: string, amount: number, method: string, note: string) {
    const customer = customers.find(c => c.id === customerId)
    if (!customer) return
    const newBalance = Math.max(0, (customer.outstandingBalance ?? 0) - amount)
    onUpdateCustomers(customers.map(c => c.id === customerId ? { ...c, outstandingBalance: newBalance } : c))
    const tx: Transaction = {
      id: `t${Date.now()}`, date: todayStr(), type: 'revenue',
      description: `Payment — ${customer.name}`, category: 'Payment',
      customerId: customer.id, customerName: customer.name,
      branchId: 'b1', branchName: 'Bole', paymentMethod: method,
      amount, amountPaid: amount, paymentStatus: 'paid',
      notes: note, createdBy: 'Sara (Admin)', createdAt: nowStr(),
      history: [{ action: 'Payment recorded', by: 'Sara (Admin)', at: nowStr() }],
    }
    onUpdateTransactions([...transactions, tx])
    setPayingFor(null)
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <p className="text-xs font-semibold text-ink-3 uppercase tracking-wider">
          {debtors.length} customer{debtors.length !== 1 ? 's' : ''} with outstanding balance
        </p>
      </div>

      {debtors.length === 0 ? (
        <div className="bg-surface rounded-2xl border border-line py-16 text-center">
          <p className="font-display text-xl text-ink mb-1">All clear</p>
          <p className="text-ink-3 text-sm">No outstanding customer balances.</p>
        </div>
      ) : (
        <div className="bg-surface rounded-2xl border border-line overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line">
                <th className="text-left px-5 py-3 text-xs font-semibold text-ink-3">Customer</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-ink-3">Last visit</th>
                <th className="text-right px-5 py-3 text-xs font-semibold text-ink-3">Outstanding</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody>
              {debtors.map(c => (
                <tr key={c.id} className="border-b border-line last:border-0 hover:bg-bg">
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-warm-subtle flex items-center justify-center text-ink-3 text-xs font-semibold">
                        {c.name.slice(0,2).toUpperCase()}
                      </div>
                      <div>
                        <p className="font-medium text-ink">{c.name}</p>
                        <p className="text-xs text-ink-3">{c.phone}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-3 text-ink-3 text-sm">{c.lastVisit ?? '—'}</td>
                  <td className="px-5 py-3 text-right font-semibold text-[#B06A6A]">
                    {fmt(c.outstandingBalance ?? 0)} ETB
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex items-center justify-end gap-2">
                      {onNavigateToCustomer && (
                        <Button size="sm" variant="secondary" onClick={() => onNavigateToCustomer(c.id)}>View</Button>
                      )}
                      <Button size="sm" onClick={() => setPayingFor(c)}>Record payment</Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {payingFor && (
        <RecordPaymentModal
          customer={payingFor}
          paymentMethods={paymentMethods}
          onClose={() => setPayingFor(null)}
          onRecord={recordPayment}
        />
      )}
    </div>
  )
}

// ─── Reports Tab ──────────────────────────────────────────────────────────────

function ReportsTab({ transactions }: { transactions: Transaction[] }) {
  const [range, setRange] = useState<'7' | '30'>('7')
  const [view,  setView]  = useState<'revenue' | 'expenses'>('revenue')

  const days = parseInt(range)
  const labels: string[] = []
  const revData: number[] = []
  const expData: number[] = []

  for (let i = days - 1; i >= 0; i--) {
    const d = new Date()
    d.setDate(d.getDate() - i)
    const ds = d.toISOString().split('T')[0]
    const label = days <= 7
      ? d.toLocaleDateString('en', { weekday: 'short' })
      : d.getDate().toString()
    labels.push(label)
    revData.push(transactions.filter(t => t.type === 'revenue' && t.date === ds).reduce((s, t) => s + (t.amountPaid ?? t.amount), 0))
    expData.push(transactions.filter(t => t.type === 'expense' && t.date === ds).reduce((s, t) => s + t.amount, 0))
  }

  const data = view === 'revenue' ? revData : expData
  const max  = Math.max(...data, 1)

  // Revenue by service
  const byService: Record<string, number> = {}
  transactions.filter(t => t.type === 'revenue' && t.serviceName).forEach(t => {
    byService[t.serviceName!] = (byService[t.serviceName!] ?? 0) + (t.amountPaid ?? t.amount)
  })
  const byServiceArr = Object.entries(byService).sort((a, b) => b[1] - a[1])

  // Expenses by category
  const byCat: Record<string, number> = {}
  transactions.filter(t => t.type === 'expense').forEach(t => {
    byCat[t.category ?? 'Other'] = (byCat[t.category ?? 'Other'] ?? 0) + t.amount
  })
  const byCatArr = Object.entries(byCat).sort((a, b) => b[1] - a[1])

  // Revenue by staff
  const byStaff: Record<string, number> = {}
  transactions.filter(t => t.type === 'revenue' && t.staffName).forEach(t => {
    byStaff[t.staffName!] = (byStaff[t.staffName!] ?? 0) + (t.amountPaid ?? t.amount)
  })
  const byStaffArr = Object.entries(byStaff).sort((a, b) => b[1] - a[1])

  const totalRev = transactions.filter(t => t.type === 'revenue').reduce((s, t) => s + (t.amountPaid ?? t.amount), 0)

  return (
    <div className="grid grid-cols-3 gap-6">
      {/* Main chart */}
      <div className="col-span-2 bg-surface rounded-2xl border border-line p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <p className="font-medium text-ink">Revenue over time</p>
            <p className="text-xs text-ink-3 mt-0.5">Daily {view} in ETB</p>
          </div>
          <div className="flex items-center gap-1">
            <button onClick={() => setView('revenue')}
              className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all ${view === 'revenue' ? 'bg-ink text-surface' : 'text-ink-3 hover:text-ink'}`}>Revenue</button>
            <button onClick={() => setView('expenses')}
              className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all ${view === 'expenses' ? 'bg-ink text-surface' : 'text-ink-3 hover:text-ink'}`}>Expenses</button>
            <div className="w-px h-4 bg-line mx-1" />
            <button onClick={() => setRange('7')}
              className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all ${range === '7' ? 'bg-ink text-surface' : 'text-ink-3 hover:text-ink'}`}>7d</button>
            <button onClick={() => setRange('30')}
              className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all ${range === '30' ? 'bg-ink text-surface' : 'text-ink-3 hover:text-ink'}`}>30d</button>
          </div>
        </div>

        {/* Bar chart */}
        <div className="flex items-end gap-1 h-36">
          {data.map((v, i) => {
            const pct = max > 0 ? (v / max) * 100 : 0
            return (
              <div key={i} className="flex-1 flex flex-col items-center gap-1">
                <div className="w-full flex items-end" style={{ height: '112px' }}>
                  <div
                    className={`w-full rounded-t-lg transition-all ${view === 'revenue' ? 'bg-ink' : 'bg-warm'}`}
                    style={{ height: `${Math.max(pct, v > 0 ? 4 : 0)}%` }}
                    title={`${labels[i]}: ${fmt(v)} ETB`}
                  />
                </div>
                <span className="text-[9px] text-ink-3">{labels[i]}</span>
              </div>
            )
          })}
        </div>
      </div>

      {/* Side breakdowns */}
      <div className="flex flex-col gap-4">
        {/* Revenue by service */}
        <div className="bg-surface rounded-2xl border border-line p-5">
          <p className="text-xs font-semibold text-ink-3 uppercase tracking-wider mb-3">By service</p>
          <div className="flex flex-col gap-2">
            {byServiceArr.slice(0, 5).map(([name, val]) => (
              <div key={name}>
                <div className="flex items-center justify-between mb-0.5">
                  <span className="text-xs text-ink">{name}</span>
                  <span className="text-xs font-semibold text-ink">{fmt(val)}</span>
                </div>
                <div className="h-1.5 bg-warm-subtle rounded-full overflow-hidden">
                  <div className="h-full bg-ink rounded-full" style={{ width: `${(val / (totalRev || 1)) * 100}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Revenue by staff */}
        <div className="bg-surface rounded-2xl border border-line p-5">
          <p className="text-xs font-semibold text-ink-3 uppercase tracking-wider mb-3">By staff</p>
          <div className="flex flex-col gap-2">
            {byStaffArr.map(([name, val]) => (
              <div key={name} className="flex items-center justify-between">
                <span className="text-xs text-ink">{name}</span>
                <span className="text-xs font-semibold text-ink">{fmt(val)} ETB</span>
              </div>
            ))}
          </div>
        </div>

        {/* Expenses by category */}
        <div className="bg-surface rounded-2xl border border-line p-5">
          <p className="text-xs font-semibold text-ink-3 uppercase tracking-wider mb-3">Expenses by category</p>
          <div className="flex flex-col gap-1.5">
            {byCatArr.map(([cat, val]) => (
              <div key={cat} className="flex items-center justify-between">
                <span className="text-xs text-ink-3">{cat}</span>
                <span className="text-xs font-semibold text-ink">−{fmt(val)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Transaction Detail Panel ─────────────────────────────────────────────────

function TxDetailPanel({ tx, allTransactions, onClose, onUpdate, paymentMethods }: {
  tx: Transaction
  allTransactions: Transaction[]
  onClose: () => void
  onUpdate: (t: Transaction[]) => void
  paymentMethods: PaymentMethod[]
}) {
  const [showRefund, setShowRefund] = useState(false)
  const [refundAmount, setRefundAmount] = useState('')
  const [refundReason, setRefundReason] = useState('')

  function doRefund() {
    if (!refundAmount) return
    const amt = parseFloat(refundAmount)
    const refundTx: Transaction = {
      id: `t${Date.now()}`, date: todayStr(), type: 'refund',
      description: `Refund — ${tx.description}`, category: 'Refund',
      customerId: tx.customerId, customerName: tx.customerName,
      staffId: tx.staffId, staffName: tx.staffName,
      serviceId: tx.serviceId, serviceName: tx.serviceName,
      branchId: tx.branchId, branchName: tx.branchName,
      paymentMethod: tx.paymentMethod,
      amount: amt, amountPaid: amt, paymentStatus: 'paid',
      notes: refundReason,
      createdBy: 'Sara (Admin)', createdAt: nowStr(),
      history: [
        { action: 'Refunded', by: 'Sara (Admin)', at: nowStr(), reason: refundReason },
      ],
    }
    const updated = allTransactions.map(t => t.id === tx.id
      ? { ...t, history: [...(t.history ?? []), { action: `Refunded ${fmt(amt)} ETB`, by: 'Sara (Admin)', at: nowStr(), reason: refundReason }] }
      : t
    )
    onUpdate([...updated, refundTx])
    setShowRefund(false)
  }

  return (
    <div className="w-[280px] flex-shrink-0 bg-surface border border-line rounded-2xl self-start sticky top-0">
      <div className="flex items-center justify-between px-5 py-4 border-b border-line">
        <p className="text-sm font-semibold text-ink">Transaction detail</p>
        <button onClick={onClose} className="w-7 h-7 rounded-lg flex items-center justify-center text-ink-3 hover:bg-warm-subtle">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 6L6 18M6 6l12 12"/></svg>
        </button>
      </div>
      <div className="px-5 py-4 overflow-y-auto max-h-[70vh]">
        <div className="flex items-center gap-2 mb-4">
          <TxTypeDot type={tx.type} />
          <span className="text-xs font-semibold text-ink-3 capitalize">{tx.type}</span>
        </div>
        <p className="font-display text-xl text-ink mb-1">{tx.description}</p>
        <p className={`font-semibold text-lg mb-4 ${tx.type === 'revenue' ? 'text-[#2A6139]' : tx.type === 'expense' ? 'text-ink' : 'text-[#B06A6A]'}`}>
          {tx.type === 'revenue' ? '+' : '−'}{fmt(tx.amount)} ETB
        </p>

        {tx.paymentStatus === 'partial' && (
          <div className="bg-[#FBF5EA] rounded-xl px-3 py-2 mb-4">
            <p className="text-xs text-[#7A5F2C]">Paid: {fmt(tx.amountPaid ?? 0)} ETB</p>
            <p className="text-xs text-[#B06A6A]">Outstanding: {fmt(tx.amount - (tx.amountPaid ?? 0))} ETB</p>
          </div>
        )}

        <div className="flex flex-col gap-2 text-xs mb-5">
          {[
            ['Date',       tx.date],
            ['Branch',     tx.branchName],
            ['Payment',    tx.paymentMethod],
            ['Customer',   tx.customerName],
            ['Staff',      tx.staffName],
            ['Service',    tx.serviceName],
            ['Category',   tx.category],
            ['ID',         tx.id],
          ].filter(([, v]) => v).map(([l, v]) => (
            <div key={l} className="flex justify-between">
              <span className="text-ink-3">{l}</span>
              <span className="text-ink font-medium text-right">{v}</span>
            </div>
          ))}
        </div>

        {tx.notes && (
          <div className="bg-bg rounded-xl px-3 py-2.5 mb-4">
            <p className="text-xs text-ink-3 mb-1">Notes</p>
            <p className="text-xs text-ink">{tx.notes}</p>
          </div>
        )}

        {/* Audit trail */}
        {(tx.history?.length ?? 0) > 0 && (
          <div className="mb-4">
            <p className="text-[10px] font-semibold text-ink-3 uppercase tracking-wider mb-2">Activity</p>
            {tx.history!.map((h, i) => (
              <div key={i} className="flex flex-col gap-0.5 mb-2">
                <p className="text-xs font-medium text-ink">{h.action}</p>
                <p className="text-[10px] text-ink-3">{h.by} · {h.at}</p>
                {h.reason && <p className="text-[10px] text-ink-3 italic">Reason: {h.reason}</p>}
              </div>
            ))}
          </div>
        )}

        {/* Created by */}
        <div className="text-[10px] text-ink-3 border-t border-line pt-3">
          Created by {tx.createdBy} · {tx.createdAt}
        </div>

        {tx.type === 'revenue' && (
          <div className="mt-4 pt-4 border-t border-line">
            {!showRefund ? (
              <Button size="sm" variant="secondary" fullWidth onClick={() => setShowRefund(true)}>Refund</Button>
            ) : (
              <div className="flex flex-col gap-2">
                <p className="text-xs font-semibold text-ink">Issue refund</p>
                <input
                  type="number" placeholder="Refund amount (ETB)"
                  value={refundAmount} onChange={e => setRefundAmount(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-line text-sm bg-bg focus:outline-none focus:border-warm"
                />
                <input
                  placeholder="Reason"
                  value={refundReason} onChange={e => setRefundReason(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-line text-sm bg-bg focus:outline-none focus:border-warm"
                />
                <div className="flex gap-2">
                  <Button size="sm" variant="secondary" onClick={() => setShowRefund(false)}>Cancel</Button>
                  <Button size="sm" onClick={doRefund}>Confirm</Button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Modals ───────────────────────────────────────────────────────────────────

function AddRevenueModal({ onClose, paymentMethods, expenseCategories, onAdd }: {
  onClose: () => void
  paymentMethods: PaymentMethod[]
  expenseCategories: ExpenseCategory[]
  onAdd: (t: Transaction) => void
}) {
  const SOURCES = ['Service', 'Product', 'Gift Card', 'Membership', 'Package', 'Other']
  const [source,  setSource]  = useState('Service')
  const [desc,    setDesc]    = useState('')
  const [amount,  setAmount]  = useState('')
  const [branch,  setBranch]  = useState('b1')
  const [method,  setMethod]  = useState('Cash')
  const [date,    setDate]    = useState(todayStr())
  const [notes,   setNotes]   = useState('')

  function submit() {
    if (!desc || !amount) return
    onAdd({
      id: `t${Date.now()}`, date, type: 'revenue',
      description: desc, category: source,
      branchId: branch, branchName: branch === 'b1' ? 'Bole' : 'Kazanchis',
      paymentMethod: method, amount: parseFloat(amount),
      amountPaid: parseFloat(amount), paymentStatus: 'paid',
      notes, createdBy: 'Sara (Admin)', createdAt: nowStr(),
      history: [{ action: 'Created', by: 'Sara (Admin)', at: nowStr() }],
    })
    onClose()
  }

  return (
    <Modal open title="Add Revenue" onClose={onClose}>
      <div className="flex flex-col gap-3 p-5">
        <div>
          <label className="text-xs font-semibold text-ink-3 mb-1.5 block">Source</label>
          <div className="flex flex-wrap gap-1.5">
            {SOURCES.map(s => (
              <button key={s} onClick={() => setSource(s)}
                className={`px-3 py-1.5 rounded-xl text-xs font-medium border transition-all ${source === s ? 'bg-ink text-surface border-ink' : 'border-line text-ink-3 hover:text-ink'}`}>
                {s}
              </button>
            ))}
          </div>
        </div>
        <Field label="Description" value={desc} onChange={setDesc} placeholder="e.g. Haircut — walk-in" />
        <Field label="Amount (ETB)" type="number" value={amount} onChange={setAmount} placeholder="0" />
        <div>
          <label className="text-xs font-semibold text-ink-3 mb-1.5 block">Branch</label>
          <select value={branch} onChange={e => setBranch(e.target.value)}
            className="w-full px-3 py-2.5 rounded-xl border border-line text-sm bg-bg focus:outline-none">
            <option value="b1">Bole</option>
            <option value="b2">Kazanchis</option>
          </select>
        </div>
        <div>
          <label className="text-xs font-semibold text-ink-3 mb-1.5 block">Payment method</label>
          <select value={method} onChange={e => setMethod(e.target.value)}
            className="w-full px-3 py-2.5 rounded-xl border border-line text-sm bg-bg focus:outline-none">
            {paymentMethods.filter(p => p.active).map(p => <option key={p.id}>{p.name}</option>)}
          </select>
        </div>
        <Field label="Date" type="date" value={date} onChange={setDate} />
        <Field label="Notes" value={notes} onChange={setNotes} placeholder="Optional" />
        <div className="flex gap-2 pt-1">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={submit} fullWidth>Add revenue</Button>
        </div>
      </div>
    </Modal>
  )
}

function AddExpenseModal({ onClose, expenseCategories, paymentMethods, onAdd }: {
  onClose: () => void
  expenseCategories: ExpenseCategory[]
  paymentMethods: PaymentMethod[]
  onAdd: (t: Transaction) => void
}) {
  const [category, setCategory] = useState(expenseCategories.filter(c => c.active)[0]?.name ?? 'Other')
  const [desc,     setDesc]     = useState('')
  const [amount,   setAmount]   = useState('')
  const [branch,   setBranch]   = useState('b1')
  const [method,   setMethod]   = useState('Cash')
  const [date,     setDate]     = useState(todayStr())
  const [notes,    setNotes]    = useState('')

  function submit() {
    if (!desc || !amount) return
    onAdd({
      id: `t${Date.now()}`, date, type: 'expense',
      description: desc, category,
      branchId: branch, branchName: branch === 'b1' ? 'Bole' : 'Kazanchis',
      paymentMethod: method, amount: parseFloat(amount),
      amountPaid: parseFloat(amount), paymentStatus: 'paid',
      notes, createdBy: 'Sara (Admin)', createdAt: nowStr(),
      history: [{ action: 'Created', by: 'Sara (Admin)', at: nowStr() }],
    })
    onClose()
  }

  return (
    <Modal open title="Add Expense" onClose={onClose}>
      <div className="flex flex-col gap-3 p-5">
        <div>
          <label className="text-xs font-semibold text-ink-3 mb-1.5 block">Category</label>
          <select value={category} onChange={e => setCategory(e.target.value)}
            className="w-full px-3 py-2.5 rounded-xl border border-line text-sm bg-bg focus:outline-none">
            {expenseCategories.filter(c => c.active).map(c => <option key={c.id}>{c.name}</option>)}
          </select>
        </div>
        <Field label="Amount (ETB)" type="number" value={amount} onChange={setAmount} placeholder="0" />
        <div>
          <label className="text-xs font-semibold text-ink-3 mb-1.5 block">Branch</label>
          <select value={branch} onChange={e => setBranch(e.target.value)}
            className="w-full px-3 py-2.5 rounded-xl border border-line text-sm bg-bg focus:outline-none">
            <option value="b1">Bole</option>
            <option value="b2">Kazanchis</option>
          </select>
        </div>
        <div>
          <label className="text-xs font-semibold text-ink-3 mb-1.5 block">Payment method</label>
          <select value={method} onChange={e => setMethod(e.target.value)}
            className="w-full px-3 py-2.5 rounded-xl border border-line text-sm bg-bg focus:outline-none">
            {paymentMethods.filter(p => p.active).map(p => <option key={p.id}>{p.name}</option>)}
          </select>
        </div>
        <Field label="Date" type="date" value={date} onChange={setDate} />
        <Field label="Description" value={desc} onChange={setDesc} placeholder="e.g. Weekly cleaning service" />
        <Field label="Notes" value={notes} onChange={setNotes} placeholder="Optional" />
        <div className="flex gap-2 pt-1">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={submit} fullWidth>Add expense</Button>
        </div>
      </div>
    </Modal>
  )
}

function ManageCategoriesModal({ categories, onClose, onUpdate }: {
  categories: ExpenseCategory[]
  onClose: () => void
  onUpdate: (c: ExpenseCategory[]) => void
}) {
  const [cats, setCats] = useState(categories)
  const [newName, setNewName] = useState('')

  function addCat() {
    if (!newName.trim()) return
    setCats(prev => [...prev, { id: `ec${Date.now()}`, name: newName.trim(), active: true }])
    setNewName('')
  }

  function toggle(id: string) {
    setCats(prev => prev.map(c => c.id === id ? { ...c, active: !c.active } : c))
  }

  return (
    <Modal open title="Expense categories" onClose={onClose}>
      <div className="p-5">
        <div className="flex flex-col gap-1.5 mb-5 max-h-64 overflow-y-auto">
          {cats.map(c => (
            <div key={c.id} className="flex items-center justify-between px-3 py-2 bg-bg rounded-xl">
              <span className={`text-sm ${c.active ? 'text-ink' : 'text-ink-3 line-through'}`}>{c.name}</span>
              <button onClick={() => toggle(c.id)}
                className={`text-xs px-2.5 py-1 rounded-lg border transition-all ${c.active ? 'border-line text-ink-3 hover:text-ink' : 'border-line text-ink-3'}`}>
                {c.active ? 'Deactivate' : 'Activate'}
              </button>
            </div>
          ))}
        </div>
        <div className="flex gap-2">
          <input value={newName} onChange={e => setNewName(e.target.value)}
            placeholder="New category name"
            className="flex-1 px-3 py-2 rounded-xl border border-line text-sm bg-bg focus:outline-none focus:border-warm"
            onKeyDown={e => e.key === 'Enter' && addCat()}
          />
          <Button size="sm" onClick={addCat}>Add</Button>
        </div>
        <div className="flex justify-end mt-4">
          <Button onClick={() => { onUpdate(cats); onClose() }}>Save</Button>
        </div>
      </div>
    </Modal>
  )
}

function RecordPaymentModal({ customer, paymentMethods, onClose, onRecord }: {
  customer: Customer
  paymentMethods: PaymentMethod[]
  onClose: () => void
  onRecord: (customerId: string, amount: number, method: string, note: string) => void
}) {
  const [amount, setAmount] = useState(String(customer.outstandingBalance ?? ''))
  const [method, setMethod] = useState('Cash')
  const [note,   setNote]   = useState('')

  return (
    <Modal open title={`Record payment — ${customer.name}`} onClose={onClose}>
      <div className="p-5 flex flex-col gap-3">
        <div className="bg-bg rounded-xl px-4 py-3 mb-1">
          <p className="text-xs text-ink-3">Outstanding balance</p>
          <p className="font-display text-xl text-[#B06A6A]">{fmt(customer.outstandingBalance ?? 0)} ETB</p>
        </div>
        <Field label="Amount paid (ETB)" type="number" value={amount} onChange={setAmount} placeholder="0" />
        <div>
          <label className="text-xs font-semibold text-ink-3 mb-1.5 block">Payment method</label>
          <select value={method} onChange={e => setMethod(e.target.value)}
            className="w-full px-3 py-2.5 rounded-xl border border-line text-sm bg-bg focus:outline-none">
            {paymentMethods.filter(p => p.active).map(p => <option key={p.id}>{p.name}</option>)}
          </select>
        </div>
        <Field label="Notes" value={note} onChange={setNote} placeholder="Optional" />
        <div className="flex gap-2 pt-1">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button fullWidth onClick={() => onRecord(customer.id, parseFloat(amount) || 0, method, note)}>
            Record payment
          </Button>
        </div>
      </div>
    </Modal>
  )
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function ExportButton() {
  const [state, setState] = useState<'idle' | 'choosing' | 'done'>('idle')

  if (state === 'done') return (
    <span className="text-xs text-[#2A6139] font-medium px-3 py-2">Export ready ✓</span>
  )
  if (state === 'choosing') return (
    <div className="flex items-center gap-2">
      <Button size="sm" variant="secondary" onClick={() => { setState('done'); setTimeout(() => setState('idle'), 2500) }}>CSV</Button>
      <Button size="sm" variant="secondary" onClick={() => { setState('done'); setTimeout(() => setState('idle'), 2500) }}>PDF</Button>
      <button onClick={() => setState('idle')} className="text-xs text-ink-3 hover:text-ink">Cancel</button>
    </div>
  )
  return <Button size="sm" variant="secondary" onClick={() => setState('choosing')}>Export</Button>
}

function TxRow({ tx, isLast }: { tx: Transaction; isLast: boolean }) {
  return (
    <div className={`flex items-center gap-4 px-5 py-3.5 ${!isLast ? 'border-b border-line' : ''}`}>
      <TxTypeDot type={tx.type} />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-ink truncate">{tx.description}</p>
        <p className="text-xs text-ink-3">{tx.category} · {tx.branchName}</p>
      </div>
      <div className="text-right flex-shrink-0">
        <p className={`text-sm font-semibold ${tx.type === 'revenue' ? 'text-[#2A6139]' : tx.type === 'expense' ? 'text-ink' : 'text-[#B06A6A]'}`}>
          {tx.type === 'revenue' ? '+' : '−'}{fmt(tx.amount)} ETB
        </p>
        <p className="text-xs text-ink-3">{tx.date}</p>
      </div>
    </div>
  )
}

function TxTypeDot({ type }: { type: string }) {
  const color = type === 'revenue' ? '#2A6139' : type === 'expense' ? '#8A847F' : '#B06A6A'
  return <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: color }} />
}

function Field({ label, value, onChange, placeholder, type = 'text' }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string
}) {
  return (
    <div>
      <label className="text-xs font-semibold text-ink-3 mb-1.5 block">{label}</label>
      <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
        className="w-full px-3 py-2.5 rounded-xl border border-line text-sm bg-bg text-ink placeholder:text-ink-3 focus:outline-none focus:border-warm" />
    </div>
  )
}

function fmt(n: number) { return n.toLocaleString('en') }
function today() { return new Date().toISOString().split('T')[0] }
function todayStr() { return today() }
function nowStr() {
  const d = new Date()
  return `${d.toISOString().split('T')[0]} ${d.getHours().toString().padStart(2,'0')}:${d.getMinutes().toString().padStart(2,'0')}`
}
function weekAgo() {
  const d = new Date(); d.setDate(d.getDate() - 7); return d.toISOString().split('T')[0]
}
function monthAgo() {
  const d = new Date(); d.setDate(d.getDate() - 30); return d.toISOString().split('T')[0]
}
