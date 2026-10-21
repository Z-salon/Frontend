import { useMemo, useState } from 'react'
import type { Transaction, PaymentMethod, Customer } from '../../types'
import type { Branch } from '../../types/api'
import { Button, Modal } from '../ui'
import { useBusiness } from '../../contexts/BusinessContext'
import { useBranch } from '../../contexts/BranchContext'
import { FinancePaymentsTab } from './FinancePaymentsTab'
import { FinancePaymentMethodsTab } from './FinancePaymentMethodsTab'
import { ExpenseCategoriesTab } from './ExpenseCategoriesTab'
import { ExpenseLedgerTab } from './ExpenseLedgerTab'
import { FinanceOverviewTab } from './FinanceOverviewTab'
import { FinanceOutstandingTab } from './FinanceOutstandingTab'
import { FinanceRefundsTab } from './FinanceRefundsTab'
import { FinanceReportsTab } from './FinanceReportsTab'
import { resolveFinanceRange, type FinanceDatePreset } from '../../lib/financeDate'

type FinanceTab =
  | 'overview'
  | 'payments'
  | 'methods'
  | 'categories'
  | 'transactions'
  | 'expenses'
  | 'outstanding'
  | 'refunds'
  | 'reports'

interface FinancePageProps {
  transactions: Transaction[]
  paymentMethods: PaymentMethod[]
  customers: Customer[]
  onUpdateTransactions: (t: Transaction[]) => void
  onUpdateCustomers: (c: Customer[]) => void
  onNavigateToCustomer?: (customerId: string) => void
  /** Real business id — the Finance tabs talk to the API directly. */
  businessId?: string
}

export function FinancePage({
  transactions, paymentMethods, customers,
  businessId,
  onUpdateTransactions, onUpdateCustomers, onNavigateToCustomer,
}: FinancePageProps) {
  const [tab, setTab] = useState<FinanceTab>('overview')

  // Real branches drive the branch filter; the API needs the branch UUID,
  // never a name. The business timezone is used for date-range day boundaries
  // so "today" is the business day, not the browser's.
  const { activeBusinessId, activeMembership } = useBusiness()
  const { branches: branchCtx } = useBranch()
  const branchList = useMemo(
    () =>
      branchCtx
        .filter((b): b is Branch & { id: string } => !!b?.id)
        .map(b => ({ id: b.id, name: b.name })),
    [branchCtx],
  )
  const timeZone =
    activeMembership?.business?.timezone || branchCtx[0]?.timezone || undefined

  const [filterBranch, setFilterBranch] = useState('all')
  const [filterDate, setFilterDate] = useState<FinanceDatePreset>('month')

  /* UUID for the API; `undefined` == "all branches". */
  const apiBranchId = filterBranch === 'all' ? undefined : filterBranch
  const range = useMemo(
    () => resolveFinanceRange(filterDate, timeZone),
    [filterDate, timeZone],
  )

  const TABS: { id: FinanceTab; label: string }[] = [
    { id: 'overview',      label: 'Overview'      },
    { id: 'payments',      label: 'Payments'      },
    { id: 'methods',       label: 'Payment methods' },
    { id: 'categories',    label: 'Categories'    },
    { id: 'transactions',  label: 'Transactions'  },
    { id: 'expenses',      label: 'Expenses'      },
    { id: 'outstanding',   label: 'Outstanding'   },
    { id: 'refunds',       label: 'Refunds'       },
    { id: 'reports',       label: 'Reports'       },
  ]

  // The legacy mock Transaction ledger (Transactions tab only) filters by
  // branch name, so selecting a real branch keeps that tab working.
  const selectedBranchName =
    filterBranch === 'all'
      ? null
      : branchList.find(b => b.id === filterBranch)?.name ?? null

  function filterTx(tx: Transaction[]) {
    return tx.filter(t => {
      if (selectedBranchName && t.branchName !== selectedBranchName) return false
      if (filterDate === 'today') return t.date === today()
      if (filterDate === 'week')  return t.date >= weekAgo()
      if (filterDate === 'month') return t.date >= monthAgo()
      return true
    })
  }

  const filtered = filterTx(transactions)

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
            {branchList.map(b => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
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
          <FinanceOverviewTab
            businessId={businessId ?? activeBusinessId ?? undefined}
            branchId={apiBranchId}
            range={range}
          />
        )}
        {tab === 'transactions' && (
          <TransactionsTab
            businessId={businessId ?? activeBusinessId ?? undefined}
            branches={branchList}
            onManageCategories={() => setTab('categories')}
            transactions={filtered}
            allTransactions={transactions}
            onUpdate={onUpdateTransactions}
            paymentMethods={paymentMethods}
          />
        )}
        {tab === 'expenses' && (
          <ExpenseLedgerTab
            businessId={businessId ?? activeBusinessId ?? undefined}
            branches={branchList}
            onManageCategories={() => setTab('categories')}
          />
        )}
        {tab === 'outstanding' && (
          <FinanceOutstandingTab
            businessId={businessId ?? activeBusinessId ?? undefined}
            branchId={apiBranchId}
            onNavigateToCustomer={onNavigateToCustomer}
          />
        )}
        {tab === 'refunds' && (
          <FinanceRefundsTab
            businessId={businessId ?? activeBusinessId ?? undefined}
            branches={branchList}
          />
        )}
        {tab === 'reports' && (
          <FinanceReportsTab
            businessId={businessId ?? activeBusinessId ?? undefined}
            branchId={apiBranchId}
            range={range}
            timeZone={timeZone}
          />
        )}
        {tab === 'payments' && (
          <FinancePaymentsTab
            businessId={businessId ?? activeBusinessId ?? ''}
            branches={branchList}
          />
        )}
        {tab === 'methods' && (
          <FinancePaymentMethodsTab businessId={businessId ?? activeBusinessId ?? undefined} />
        )}
        {tab === 'categories' && (
          <ExpenseCategoriesTab businessId={businessId ?? activeBusinessId ?? undefined} />
        )}
      </div>
    </div>
  )
}

// ─── Transactions Tab ─────────────────────────────────────────────────────────

type TransactionsView =
  | 'expenses'
  | 'refunds'
  | 'all'
  | 'revenue'
  | 'adjustment'

const TX_VIEWS: { id: TransactionsView; label: string }[] = [
  { id: 'all',        label: 'All'        },
  { id: 'expenses',   label: 'Expenses'   },
  { id: 'refunds',    label: 'Refunds'    },
  { id: 'revenue',    label: 'Revenue'    },
  { id: 'adjustment', label: 'Adjustment' },
]

function TransactionsTab({
  businessId,
  branches,
  onManageCategories,
  transactions,
  allTransactions,
  onUpdate,
  paymentMethods,
}: {
  businessId?: string
  branches: Array<{ id: string; name: string }>
  onManageCategories?: () => void
  transactions: Transaction[]
  allTransactions: Transaction[]
  onUpdate: (t: Transaction[]) => void
  paymentMethods: PaymentMethod[]
}) {
  const [selected, setSelected] = useState<Transaction | null>(null)
  const [showAdd,  setShowAdd]  = useState(false)
  const [view, setView] = useState<TransactionsView>('expenses')

  /* The first two tabs are the real, backend-backed views; the rest keep the
     legacy mock ledger available. */
  const isLegacy = view !== 'expenses' && view !== 'refunds'

  const visible = transactions.filter(t => view === 'all' || t.type === view)
    .sort((a, b) => b.date.localeCompare(a.date))

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1">
          {TX_VIEWS.map(t => (
            <button key={t.id} onClick={() => setView(t.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all ${view === t.id ? 'bg-ink text-surface' : 'text-ink-3 hover:text-ink hover:bg-warm-subtle'}`}>
              {t.label}
            </button>
          ))}
        </div>
        {isLegacy && (
          <Button size="sm" onClick={() => setShowAdd(true)}>+ Add Revenue</Button>
        )}
      </div>

      {view === 'expenses' ? (
        <ExpenseLedgerTab
          businessId={businessId}
          branches={branches}
          onManageCategories={onManageCategories}
        />
      ) : view === 'refunds' ? (
        <FinanceRefundsTab businessId={businessId} branches={branches} />
      ) : (
        <div className="flex gap-6">
          <div className="flex-1 min-w-0">
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
              onAdd={tx => onUpdate([...allTransactions, tx])}
            />
          )}
        </div>
      )}
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

function AddRevenueModal({ onClose, paymentMethods, onAdd }: {
  onClose: () => void
  paymentMethods: PaymentMethod[]
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
