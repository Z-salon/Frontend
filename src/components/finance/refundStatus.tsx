import type { RefundRequestStatus } from '../../types/api'

/* ------------------------------------------------------------------ */
/*  Refund request status badges                                       */
/*                                                                     */
/*  Mirrors the appointment status badge styling so the Finance tabs   */
/*  read consistently. The four statuses are the backend's.            */
/* ------------------------------------------------------------------ */

export const REFUND_STATUSES: RefundRequestStatus[] = [
  'PENDING',
  'APPROVED',
  'REJECTED',
  'COMPLETED',
]

const STATUS_MAP: Record<
  RefundRequestStatus,
  { label: string; bg: string; text: string; dot: string }
> = {
  PENDING:   { label: 'Pending',   bg: '#FBF5EA', text: '#7A5F2C', dot: '#C4A97D' },
  APPROVED:  { label: 'Approved',  bg: '#EAF1F5', text: '#2C5F6A', dot: '#7B9FAB' },
  REJECTED:  { label: 'Rejected',  bg: '#F5EAEA', text: '#6A2C2C', dot: '#C47B7B' },
  COMPLETED: { label: 'Completed', bg: '#EAF5EC', text: '#2A5F30', dot: '#7FAB85' },
}

export function refundStatusLabel(status: string): string {
  return STATUS_MAP[status as RefundRequestStatus]?.label ?? status
}

export function RefundStatusBadge({ status }: { status: string }) {
  const cfg = STATUS_MAP[status as RefundRequestStatus] ?? {
    label: status || '—',
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