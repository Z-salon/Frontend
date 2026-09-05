import type { Appointment, Customer, FeedbackItem, Transaction, Branch } from '../../types'

interface DashboardPageProps {
  appointments: Appointment[]
  customers: Customer[]
  feedback: FeedbackItem[]
  transactions: Transaction[]
  branches: Branch[]
  onNavigate: (section: string) => void
  onNewBooking: () => void
  onWalkIn: () => void
  onAddExpense: () => void
}

export function DashboardPage({
  appointments, customers, feedback, transactions, branches,
  onNavigate, onNewBooking, onWalkIn, onAddExpense,
}: DashboardPageProps) {
  const todayStr = new Date().toISOString().split('T')[0]
  const todayAppts = appointments.filter(a => a.date === todayStr)
    .sort((a, b) => a.startTime.localeCompare(b.startTime))

  const todayRevenue = transactions
    .filter(t => t.type === 'revenue' && t.date === todayStr)
    .reduce((s, t) => s + (t.amountPaid ?? t.amount), 0)

  const outstanding = customers.reduce((s, c) => s + (c.outstandingBalance ?? 0), 0)

  const avgRating = feedback.length
    ? (feedback.reduce((s, f) => s + f.overallRating, 0) / feedback.length).toFixed(1)
    : '—'

  const debtors = customers.filter(c => (c.outstandingBalance ?? 0) > 0)

  // 7-day revenue chart data
  const chartDays: { label: string; value: number }[] = []
  for (let i = 6; i >= 0; i--) {
    const d = new Date()
    d.setDate(d.getDate() - i)
    const ds = d.toISOString().split('T')[0]
    chartDays.push({
      label: d.toLocaleDateString('en', { weekday: 'short' }),
      value: transactions.filter(t => t.type === 'revenue' && t.date === ds).reduce((s, t) => s + (t.amountPaid ?? t.amount), 0),
    })
  }
  const chartMax = Math.max(...chartDays.map(d => d.value), 1)

  const recentFeedback = [...feedback].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 3)

  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="px-8 py-5 bg-surface border-b border-line flex-shrink-0">
        <h2 className="font-display text-[1.75rem] text-ink leading-none mb-1">{greeting}, Sara.</h2>
        <p className="text-ink-3 text-sm">Here's what's happening at your salon today.</p>
      </div>

      <div className="flex-1 overflow-y-auto px-8 py-6">
        {/* Key metrics */}
        <div className="grid grid-cols-4 gap-4 mb-8">
          {[
            { label: "Today's appointments", value: String(todayAppts.length), sub: `${todayAppts.filter(a => a.status === 'completed').length} completed` },
            { label: "Today's revenue",      value: `${fmt(todayRevenue)} ETB`, sub: 'collected today' },
            { label: 'Outstanding',          value: `${fmt(outstanding)} ETB`,  sub: `${debtors.length} customer${debtors.length !== 1 ? 's' : ''}` },
            { label: 'Average rating',       value: `${avgRating} ★`,           sub: `${feedback.length} reviews` },
          ].map(m => (
            <div key={m.label} className="bg-surface rounded-2xl border border-line px-6 py-5">
              <p className="text-xs text-ink-3 mb-2">{m.label}</p>
              <p className="font-display text-2xl text-ink">{m.value}</p>
              <p className="text-xs text-ink-3 mt-1">{m.sub}</p>
            </div>
          ))}
        </div>

        {/* Quick actions */}
        <div className="flex items-center gap-2 mb-8">
          <button onClick={onNewBooking}
            className="flex items-center gap-2 px-4 py-2.5 bg-ink text-surface rounded-xl text-sm font-medium hover:bg-ink/90 transition-colors">
            <span>+</span> New booking
          </button>
          <button onClick={onWalkIn}
            className="flex items-center gap-2 px-4 py-2.5 bg-surface border border-line text-ink rounded-xl text-sm font-medium hover:bg-warm-subtle transition-colors">
            <span>+</span> Walk-in
          </button>
          <button onClick={() => onNavigate('customers')}
            className="flex items-center gap-2 px-4 py-2.5 bg-surface border border-line text-ink rounded-xl text-sm font-medium hover:bg-warm-subtle transition-colors">
            <span>+</span> Customer
          </button>
          <button onClick={onAddExpense}
            className="flex items-center gap-2 px-4 py-2.5 bg-surface border border-line text-ink rounded-xl text-sm font-medium hover:bg-warm-subtle transition-colors">
            <span>+</span> Expense
          </button>
        </div>

        <div className="grid grid-cols-3 gap-6">
          {/* Left: Today's schedule */}
          <div className="col-span-2 flex flex-col gap-6">
            {/* Today's appointments */}
            <div className="bg-surface rounded-2xl border border-line">
              <div className="flex items-center justify-between px-6 py-4 border-b border-line">
                <p className="font-medium text-ink">Today's schedule</p>
                <button onClick={() => onNavigate('bookings')}
                  className="text-xs text-ink-3 hover:text-ink transition-colors">View all bookings →</button>
              </div>
              {todayAppts.length === 0 ? (
                <div className="py-10 text-center">
                  <p className="font-display text-xl text-ink mb-1">No appointments today</p>
                  <p className="text-ink-3 text-sm mb-4">Your calendar is clear.</p>
                  <button onClick={onNewBooking}
                    className="px-4 py-2 bg-ink text-surface rounded-xl text-sm font-medium hover:bg-ink/90 transition-colors">
                    + New booking
                  </button>
                </div>
              ) : (
                <div className="divide-y divide-line">
                  {todayAppts.map(a => (
                    <div key={a.id} className="flex items-center gap-4 px-6 py-3.5">
                      <span className="text-sm font-medium text-ink-3 w-12 flex-shrink-0">{a.startTime}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-ink truncate">{a.customTitle ?? a.serviceName}</p>
                        <p className="text-xs text-ink-3">{a.customerName} · {a.staffName}</p>
                      </div>
                      <StatusPill status={a.status} />
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Revenue chart */}
            <div className="bg-surface rounded-2xl border border-line p-6">
              <div className="flex items-center justify-between mb-5">
                <div>
                  <p className="font-medium text-ink">Revenue — last 7 days</p>
                  <p className="text-xs text-ink-3 mt-0.5">Daily collection in ETB</p>
                </div>
              </div>
              <div className="flex items-end gap-2 h-24">
                {chartDays.map((d, i) => {
                  const pct = d.value > 0 ? Math.max((d.value / chartMax) * 100, 6) : 0
                  const isToday = i === 6
                  return (
                    <div key={i} className="flex-1 flex flex-col items-center gap-1.5">
                      <div className="w-full flex items-end" style={{ height: '80px' }}>
                        <div
                          className={`w-full rounded-t-lg transition-all ${isToday ? 'bg-ink' : 'bg-warm-subtle'}`}
                          style={{ height: `${pct}%` }}
                          title={`${d.label}: ${fmt(d.value)} ETB`}
                        />
                      </div>
                      <span className={`text-[10px] ${isToday ? 'font-semibold text-ink' : 'text-ink-3'}`}>{d.label}</span>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Branch overview */}
            {branches.length > 1 && (
              <div className="bg-surface rounded-2xl border border-line">
                <div className="px-6 py-4 border-b border-line">
                  <p className="font-medium text-ink">Branch overview</p>
                </div>
                <div className="divide-y divide-line">
                  {branches.map(b => {
                    const bAppts = todayAppts.filter(a => a.branchId === b.id)
                    const bRev = transactions.filter(t => t.branchId === b.id && t.type === 'revenue')
                      .reduce((s, t) => s + (t.amountPaid ?? t.amount), 0)
                    return (
                      <div key={b.id} className="flex items-center justify-between px-6 py-4">
                        <div>
                          <p className="font-medium text-ink text-sm">{b.name}</p>
                          <p className="text-xs text-ink-3">{bAppts.length} appointments today</p>
                        </div>
                        <p className="font-semibold text-ink">{fmt(bRev)} ETB</p>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Right column */}
          <div className="flex flex-col gap-6">
            {/* Recent feedback — PRIVATE */}
            <div className="bg-surface rounded-2xl border border-line">
              <div className="flex items-center justify-between px-5 py-4 border-b border-line">
                <div>
                  <p className="font-medium text-ink text-sm">Recent feedback</p>
                  <span className="text-[9px] font-semibold text-ink-3 tracking-wider">PRIVATE</span>
                </div>
                <button onClick={() => onNavigate('feedback')}
                  className="text-xs text-ink-3 hover:text-ink transition-colors">View all →</button>
              </div>
              <div className="divide-y divide-line">
                {recentFeedback.length === 0 ? (
                  <p className="px-5 py-6 text-sm text-ink-3 text-center">No feedback yet.</p>
                ) : recentFeedback.map(f => (
                  <div key={f.id} className="px-5 py-4">
                    <div className="flex items-center gap-1 mb-1">
                      {[1,2,3,4,5].map(i => (
                        <svg key={i} width="10" height="10" viewBox="0 0 24 24" fill={i <= f.overallRating ? '#C4A97D' : 'none'} stroke="#C4A97D" strokeWidth="1.5">
                          <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
                        </svg>
                      ))}
                    </div>
                    {f.comment && <p className="text-xs text-ink-2 mb-1 line-clamp-2">"{f.comment}"</p>}
                    <p className="text-[10px] text-ink-3">{f.anonymous ? 'Anonymous' : f.customerName} · {f.serviceName}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Outstanding payments */}
            {debtors.length > 0 && (
              <div className="bg-surface rounded-2xl border border-line">
                <div className="flex items-center justify-between px-5 py-4 border-b border-line">
                  <p className="font-medium text-ink text-sm">Outstanding</p>
                  <button onClick={() => onNavigate('finance')}
                    className="text-xs text-ink-3 hover:text-ink transition-colors">View all →</button>
                </div>
                <div className="divide-y divide-line">
                  {debtors.slice(0, 4).map(c => (
                    <div key={c.id} className="flex items-center justify-between px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <div className="w-7 h-7 rounded-full bg-warm-subtle flex items-center justify-center text-ink-3 text-xs font-semibold">
                          {c.name.slice(0,2).toUpperCase()}
                        </div>
                        <p className="text-sm text-ink">{c.name}</p>
                      </div>
                      <p className="text-sm font-semibold text-[#B06A6A]">{fmt(c.outstandingBalance ?? 0)}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function StatusPill({ status }: { status: string }) {
  const MAP: Record<string, string> = {
    pending:     'bg-[#F0EBE5] text-[#7A6F68]',
    confirmed:   'bg-[#EAF0EA] text-[#2A6139]',
    'checked-in':'bg-[#E8F0FB] text-[#1E4D8C]',
    'in-progress':'bg-[#EBF5FF] text-[#1A5FA8]',
    completed:   'bg-[#EAF0EA] text-[#2A6139]',
    cancelled:   'bg-[#FAEAEA] text-[#B06A6A]',
    'no-show':   'bg-[#F5EAEA] text-[#9B4A4A]',
  }
  const label = status.replace('-', ' ').replace(/\b\w/g, c => c.toUpperCase())
  return (
    <span className={`text-[10px] font-semibold px-2 py-1 rounded-full capitalize ${MAP[status] ?? 'bg-warm-subtle text-ink-3'}`}>
      {label}
    </span>
  )
}

function fmt(n: number) { return n.toLocaleString('en') }
