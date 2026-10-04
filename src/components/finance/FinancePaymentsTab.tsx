import { useCallback, useEffect, useMemo, useState } from 'react'
import { appointmentsApi } from '../../api/appointments.api'
import type { Appointment, AppointmentPayment } from '../../types/api'

/* ------------------------------------------------------------------ */
/*  Appointment payments ledger (Finance)                             */
/*                                                                     */
/*  There is NO business-wide payments endpoint — §7.2 only exposes     */
/*  `GET /businesses/{businessId}/appointments/{id}/payments`. So this  */
/*  fans out one request per appointment in the window. That is bounded */
/*  on purpose: a date range plus a hard appointment cap, fetched in     */
/*  small parallel batches rather than all at once.                    */
/*                                                                     */
/*  Read-only by design. Recording and voiding live on the appointment  */
/*  panel, where the appointment context is available — duplicating the  */
/*  void dialog here would mean two places that can change money.       */
/* ------------------------------------------------------------------ */

const APPOINTMENT_CAP = 100
const BATCH_SIZE = 6

type Range = 'today' | 'week' | 'month' | 'all'

const RANGES: Array<{ id: Range; label: string }> = [
  { id: 'today', label: 'Today' },
  { id: 'week', label: 'Last 7 days' },
  { id: 'month', label: 'Last 30 days' },
  { id: 'all', label: 'All time' },
]

function startOfWindow(range: Range): string | null {
  const now = Date.now()
  const days = range === 'today' ? 0 : range === 'week' ? 7 : range === 'month' ? 30 : null
  if (days === null) return null
  return new Date(now - days * 24 * 60 * 60 * 1000).toISOString()
}

function unwrapArray<T>(res: unknown): T[] {
  if (Array.isArray(res)) return res as T[]
  const anyRes = res as any
  if (Array.isArray(anyRes?.data?.data)) return anyRes.data.data as T[]
  if (Array.isArray(anyRes?.data)) return anyRes.data as T[]
  return []
}

function toNumber(value: string | number | null | undefined): number {
  const n = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(n) ? n : 0
}

interface LedgerRow {
  key: string
  paidAt: string
  methodName: string
  amount: number
  voided: boolean
  reference: string | null
  notes: string | null
  appointmentId: string
  appointmentLabel: string
  customerName: string
}

function customerLabel(a: Appointment): string {
  const c = a.customer
  if (!c) return 'Customer'
  const name = `${c.firstName ?? ''} ${c.lastName ?? ''}`.trim()
  return name || 'Customer'
}

export function FinancePaymentsTab({
  businessId,
  branches,
}: {
  businessId: string
  branches: Array<{ id: string; name: string }>
}) {
  const [range, setRange] = useState<Range>('month')
  const [branchId, setBranchId] = useState('all')

  const [rows, setRows] = useState<LedgerRow[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [truncated, setTruncated] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    setTruncated(false)

    try {
      const startDate = startOfWindow(range) ?? undefined

      // Cap first, then fan out. Two passes so the cap is visible to the user
      // instead of silently hiding appointments.
      const firstPage = await appointmentsApi.list(businessId, {
        startDate,
        endDate: undefined,
        branchId: branchId === 'all' ? undefined : branchId,
        limit: APPOINTMENT_CAP + 1,
      })

      let appts = unwrapArray<Appointment>(firstPage)
      if (appts.length > APPOINTMENT_CAP) {
        appts = appts.slice(0, APPOINTMENT_CAP)
        setTruncated(true)
      }

      const collected: LedgerRow[] = []

      for (let i = 0; i < appts.length; i += BATCH_SIZE) {
        const batch = appts.slice(i, i + BATCH_SIZE)
        const results = await Promise.all(
          batch.map(async a => {
            try {
              const res = await appointmentsApi.listPayments(businessId, a.id)
              return { appt: a, payments: unwrapArray<AppointmentPayment>(res) }
            } catch {
              // One appointment's payments failing shouldn't blank the ledger.
              return { appt: a, payments: [] as AppointmentPayment[] }
            }
          }),
        )

        for (const { appt, payments } of results) {
          for (const p of payments) {
            collected.push({
              key: p.id,
              paidAt: p.paidAt,
              methodName: p.paymentMethod?.name ?? 'Unknown method',
              amount: toNumber(p.amount),
              voided: p.status === 'VOIDED',
              reference: p.reference,
              notes: p.notes,
              appointmentId: appt.id,
              appointmentLabel: `${appt.service.name} · ${appt.scheduledStart.slice(0, 10)}`,
              customerName: customerLabel(appt),
            })
          }
        }
      }

      // Newest first — the reason someone opened a payments ledger.
      collected.sort((a, b) => b.paidAt.localeCompare(a.paidAt))
      setRows(collected)
    } catch {
      setRows([])
      setError('Could not load payments.')
    } finally {
      setLoading(false)
    }
  }, [businessId, range, branchId])

  useEffect(() => {
    void load()
  }, [load])

  // Totals by method, ignoring voided rows, then newest first.
  const byMethod = useMemo(() => {
    const totals = new Map<string, number>()
    for (const r of rows) {
      if (r.voided) continue
      totals.set(r.methodName, (totals.get(r.methodName) ?? 0) + r.amount)
    }
    return [...totals.entries()]
      .map(([method, total]) => ({ method, total }))
      .sort((a, b) => b.total - a.total)
  }, [rows])

  const grandTotal = byMethod.reduce((sum, m) => sum + m.total, 0)
  const voidedTotal = rows
    .filter(r => r.voided)
    .reduce((sum, r) => sum + r.amount, 0)

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center gap-3">
        <select
          value={range}
          onChange={e => setRange(e.target.value as Range)}
          className="h-9 px-3 rounded-lg border border-line text-sm bg-surface text-ink focus:outline-none"
        >
          {RANGES.map(r => (
            <option key={r.id} value={r.id}>
              {r.label}
            </option>
          ))}
        </select>

        <select
          value={branchId}
          onChange={e => setBranchId(e.target.value)}
          className="h-9 px-3 rounded-lg border border-line text-sm bg-surface text-ink focus:outline-none"
        >
          <option value="all">All branches</option>
          {branches.map(b => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </select>

        <p className="text-xs text-ink-3 ml-auto">
          {loading ? 'Loading…' : `${rows.length} payment${rows.length === 1 ? '' : 's'}`}
        </p>
      </div>

      {truncated && (
        <p className="text-xs text-[#B06A6A]">
          Showing the most recent {APPOINTMENT_CAP} appointments. Narrow the date
          range or branch to see the rest.
        </p>
      )}

      {error && <p className="text-sm text-[#B06A6A]">{error}</p>}

      {/* Totals by method */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-surface rounded-2xl border border-line p-4 col-span-2 lg:col-span-1">
          <p className="text-[10px] font-semibold text-ink-3 uppercase tracking-wider">
            Collected
          </p>
          <p className="text-xl font-semibold text-ink mt-1 tabular-nums">
            {grandTotal.toLocaleString()} ETB
          </p>
        </div>

        {byMethod.slice(0, 3).map(m => (
          <div key={m.method} className="bg-surface rounded-2xl border border-line p-4">
            <p className="text-[10px] font-semibold text-ink-3 uppercase tracking-wider truncate">
              {m.method}
            </p>
            <p className="text-xl font-semibold text-ink mt-1 tabular-nums">
              {m.total.toLocaleString()}
            </p>
          </div>
        ))}
      </div>

      {voidedTotal > 0 && (
        <p className="text-xs text-ink-3">
          {voidedTotal.toLocaleString()} ETB voided and excluded from the totals.
        </p>
      )}

      {/* Ledger */}
      <div className="border border-line rounded-2xl overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="bg-bg">
              <th className="text-left px-5 py-3 text-xs font-semibold text-ink-3">When</th>
              <th className="text-left px-5 py-3 text-xs font-semibold text-ink-3">Customer</th>
              <th className="text-left px-5 py-3 text-xs font-semibold text-ink-3">Method</th>
              <th className="text-left px-5 py-3 text-xs font-semibold text-ink-3">Appointment</th>
              <th className="text-right px-5 py-3 text-xs font-semibold text-ink-3">Amount</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(r => (
              <tr
                key={r.key}
                className="border-t border-line hover:bg-bg transition-colors"
              >
                <td className="px-5 py-3 text-sm text-ink-2 whitespace-nowrap">
                  {new Date(r.paidAt).toLocaleDateString()}
                </td>
                <td className="px-5 py-3 text-sm text-ink">{r.customerName}</td>
                <td className="px-5 py-3 text-sm text-ink-2">{r.methodName}</td>
                <td className="px-5 py-3 text-sm text-ink-3">
                  <span className="block truncate max-w-[220px]">{r.appointmentLabel}</span>
                  {r.reference && (
                    <span className="text-xs text-ink-3">Ref {r.reference}</span>
                  )}
                </td>
                <td className="px-5 py-3 text-right">
                  <span
                    className={`text-sm font-medium tabular-nums whitespace-nowrap ${
                      r.voided ? 'text-ink-3 line-through' : 'text-ink'
                    }`}
                  >
                    {r.amount.toLocaleString()}
                  </span>
                  {r.voided && (
                    <span className="block text-[10px] uppercase tracking-wide text-ink-3">
                      Voided
                    </span>
                  )}
                </td>
              </tr>
            ))}

            {!loading && rows.length === 0 && !error && (
              <tr>
                <td colSpan={5} className="px-5 py-10 text-center text-sm text-ink-3">
                  No payments recorded in this range.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
