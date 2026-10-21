import type { ExpenseStatus } from '../../types/api'

/* ------------------------------------------------------------------ */
/*  Expense status                                                     */
/*                                                                     */
/*  `status` is the server's calculation — never inferred from         */
/*  `amountPaid`. The four values are the documented enum.             */
/* ------------------------------------------------------------------ */

const STATUS_MAP: Record<
  ExpenseStatus,
  { label: string; bg: string; text: string; dot: string }
> = {
  UNPAID:         { label: 'Unpaid',         bg: '#FBF5EA', text: '#7A5F2C', dot: '#C4A97D' },
  PARTIALLY_PAID: { label: 'Partially Paid', bg: '#EAF1F5', text: '#2C5F6A', dot: '#7B9FAB' },
  PAID:           { label: 'Paid',           bg: '#EAF5EC', text: '#2A5F30', dot: '#7FAB85' },
  VOIDED:         { label: 'Voided',         bg: '#F5F4F2', text: '#6B6560', dot: '#A8A4A0' },
}

export const EXPENSE_STATUSES: ExpenseStatus[] = [
  'UNPAID',
  'PARTIALLY_PAID',
  'PAID',
  'VOIDED',
]

export function expenseStatusLabel(status: string): string {
  return STATUS_MAP[status as ExpenseStatus]?.label ?? status
}

export function ExpenseStatusBadge({ status }: { status: string }) {
  const cfg = STATUS_MAP[status as ExpenseStatus] ?? {
    label: status || 'Unknown',
    bg: '#F5F4F2',
    text: '#6B6560',
    dot: '#A8A4A0',
  }
  return (
    <span
      className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full whitespace-nowrap"
      style={{ backgroundColor: cfg.bg, color: cfg.text }}
    >
      <span
        className="w-1.5 h-1.5 rounded-full flex-shrink-0"
        style={{ backgroundColor: cfg.dot }}
      />
      {cfg.label}
    </span>
  )
}