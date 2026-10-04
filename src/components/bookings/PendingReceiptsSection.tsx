import { useState } from 'react'
import type { AppointmentReceipt } from '../../types/api'
import { Button } from '../ui'
import { useToast } from '../ui/Toast'
import { usePendingReceipts } from '../../hooks/usePendingReceipts'
import { ReceiptReviewModal } from './ReceiptReviewModal'

export function PendingReceiptsSection({
  businessId,
  branchId,
  onAppointmentConfirmed,
}: {
  businessId: string
  /** Optional. When the app-level branch filter is active, pass it here. */
  branchId?: string | null
  /** Called after a successful approval so the caller can refresh its list. */
  onAppointmentConfirmed?: (appointmentId: string) => void
}) {
  const toast = useToast()
  const { items, loading, error, forbidden, reload } = usePendingReceipts(
    businessId,
    branchId,
  )
  const [reviewing, setReviewing] = useState<AppointmentReceipt | null>(null)

  if (forbidden) {
    return (
      <section className="bg-surface rounded-2xl border border-line p-5">
        <h3 className="font-display text-lg text-ink">Pending deposits</h3>
        <p className="text-sm text-ink-3 mt-1">
          You don&apos;t have access to review receipts for this business.
        </p>
      </section>
    )
  }

  return (
    <section className="bg-surface rounded-2xl border border-line p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-display text-lg text-ink">Pending deposits</h3>
          <p className="text-sm text-ink-3 mt-1 max-w-xl">
            Receipts customers uploaded for a prepayment. Approving one records
            the payment and confirms the appointment in a single step.
          </p>
        </div>
        <Button size="sm" variant="ghost" onClick={reload} disabled={loading}>
          Refresh
        </Button>
      </div>

      {loading && (
        <p className="text-sm text-ink-3 mt-5">Loading receipts…</p>
      )}

      {!loading && error && (
        <div className="flex flex-wrap items-center gap-3 mt-5">
          <p className="text-sm text-[#B06A6A]">{error}</p>
          <Button size="sm" variant="ghost" onClick={reload}>
            Retry
          </Button>
        </div>
      )}

      {!loading && !error && items.length === 0 && (
        <p className="text-sm text-ink-3 mt-5">
          Nothing waiting — every submitted receipt has been reviewed.
        </p>
      )}

      {!loading && !error && items.length > 0 && (
        <ul className="mt-5 flex flex-col gap-3">
          {items.map(r => (
            <li
              key={r.id}
              className="rounded-xl border border-line bg-bg overflow-hidden flex flex-col sm:flex-row"
            >
              <div className="sm:w-32 sm:h-32 h-40 flex-shrink-0 bg-line/30 overflow-hidden">
                <img
                  src={r.receiptImageUrl}
                  alt=""
                  loading="lazy"
                  className="w-full h-full object-cover"
                  onError={e => {
                    e.currentTarget.style.visibility = 'hidden'
                  }}
                />
              </div>

              <div className="flex-1 p-4 flex flex-col gap-2">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-medium text-ink">
                    {Number(r.submittedAmount).toLocaleString()} ETB
                  </p>
                  <span className="text-xs text-ink-3">
                    {new Date(r.submittedAt).toLocaleString()}
                  </span>
                </div>
                {r.customerNote && (
                  <p className="text-xs text-ink-3 line-clamp-2">
                    {r.customerNote}
                  </p>
                )}
                <div className="mt-auto flex justify-end">
                  <Button size="sm" onClick={() => setReviewing(r)}>
                    Review
                  </Button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      <ReceiptReviewModal
        open={reviewing !== null}
        businessId={businessId}
        receipt={reviewing}
        onClose={() => setReviewing(null)}
        onVerified={updated => {
          // Remove from the queue optimistically. If the caller also needs
          // to refresh a parent list, it can hook into onAppointmentConfirmed.
          setReviewing(null)
          toast.success(
            updated.status === 'APPROVED'
              ? 'Receipt approved'
              : 'Receipt rejected',
          )
          onAppointmentConfirmed?.(updated.appointmentId)
          reload()
        }}
      />
    </section>
  )
}