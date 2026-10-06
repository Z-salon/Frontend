import { useState, type ReactNode } from 'react'
import type { RefundRequest } from '../../types/api'
import { Button, Modal, Textarea } from '../ui'
import { LoadingState } from '../ui/EmptyState'
import { useToast } from '../ui/Toast'
import { useRefundRequest } from '../../hooks/useRefundRequests'
import { refundsApi } from '../../api/refunds.api'
import { apiErrorMessage } from '../../api/errors'
import { formatMoney, toCents } from '../../lib/money'
import { formatDateTime } from '../../lib/dates'
import { RefundStatusBadge } from './refundStatus'

/* ------------------------------------------------------------------ */
/*  Refund details                                                     */
/*                                                                     */
/*  Reads one refund request from the backend and exposes exactly the  */
/*  transitions the server allows: PENDING → approve/reject,           */
/*  APPROVED → complete. No field is invented; missing values render   */
/*  as an em dash.                                                     */
/* ------------------------------------------------------------------ */

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-6 py-2.5 border-b border-line last:border-0">
      <span className="text-sm text-ink-3 flex-shrink-0">{label}</span>
      <span className="text-sm text-ink text-right break-words">{children}</span>
    </div>
  )
}

function money(value: string | null | undefined): string {
  if (value === null || value === undefined || value === '') return '—'
  return `${formatMoney(value)} ETB`
}

export function RefundDetailsView({
  businessId,
  refundRequestId,
  branches = [],
  onBack,
  onChanged,
}: {
  businessId?: string
  refundRequestId: string
  branches?: Array<{ id: string; name: string }>
  onBack: () => void
  onChanged: () => void
}) {
  const toast = useToast()
  const { data, loading, error, reload } = useRefundRequest(businessId, refundRequestId)

  const [approveOpen, setApproveOpen] = useState(false)
  const [rejectOpen, setRejectOpen] = useState(false)
  const [completeOpen, setCompleteOpen] = useState(false)

  const [busy, setBusy] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  const [rejectReason, setRejectReason] = useState('')
  const [completeAmount, setCompleteAmount] = useState('')
  const [completeReference, setCompleteReference] = useState('')
  const [completeNote, setCompleteNote] = useState('')

  function openReject() {
    setRejectReason('')
    setFormError(null)
    setRejectOpen(true)
  }

  function openComplete() {
    setCompleteAmount(data?.approvedAmount ?? '')
    setCompleteReference('')
    setCompleteNote('')
    setFormError(null)
    setCompleteOpen(true)
  }

  async function refresh() {
    await reload()
    onChanged()
  }

  async function handleApprove() {
    if (!businessId) return
    setBusy(true)
    setFormError(null)
    try {
      await refundsApi.approve(businessId, refundRequestId)
      toast.success('Refund approved.')
      setApproveOpen(false)
      await refresh()
    } catch (err) {
      setFormError(apiErrorMessage(err, 'Could not approve the refund.'))
    } finally {
      setBusy(false)
    }
  }

  async function handleReject() {
    if (!businessId) return
    if (!rejectReason.trim()) {
      setFormError('A rejection reason is required.')
      return
    }
    setBusy(true)
    setFormError(null)
    try {
      await refundsApi.reject(businessId, refundRequestId, {
        rejectionReason: rejectReason.trim(),
      })
      toast.success('Refund rejected.')
      setRejectOpen(false)
      await refresh()
    } catch (err) {
      setFormError(apiErrorMessage(err, 'Could not reject the refund.'))
    } finally {
      setBusy(false)
    }
  }

  async function handleComplete() {
    if (!businessId) return
    const amount = Number(completeAmount)
    if (!Number.isFinite(amount) || amount <= 0) {
      setFormError('Enter a refund amount greater than 0.')
      return
    }
    const approvedCents = toCents(data?.approvedAmount)
    if (approvedCents > 0 && toCents(completeAmount) > approvedCents) {
      setFormError('The refund amount cannot exceed the approved amount.')
      return
    }
    if (!completeReference.trim()) {
      setFormError('A reference is required.')
      return
    }
    setBusy(true)
    setFormError(null)
    try {
      await refundsApi.complete(businessId, refundRequestId, {
        amount,
        reference: completeReference.trim(),
        note: completeNote.trim() || undefined,
      })
      toast.success('Refund completed.')
      setCompleteOpen(false)
      await refresh()
    } catch (err) {
      setFormError(apiErrorMessage(err, 'Could not complete the refund.'))
    } finally {
      setBusy(false)
    }
  }

  const backButton = (
    <button
      type="button"
      onClick={onBack}
      className="inline-flex items-center gap-1.5 text-sm text-ink-3 hover:text-ink transition-colors mb-4"
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
        stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M15 18l-6-6 6-6" />
      </svg>
      Back to Refunds
    </button>
  )

  if (loading && !data) {
    return (
      <div>
        <button
          onClick={onBack}
          className="text-sm text-ink-3 hover:text-ink transition-colors"
        >
          ← Back to Refunds
        </button>
        <LoadingState label="Loading refund…" />
      </div>
    )
  }

  if (error && !data) {
    return (
      <div>
        <button
          onClick={onBack}
          className="text-sm text-ink-3 hover:text-ink transition-colors"
        >
          ← Back to Refunds
        </button>
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <p className="font-display text-xl text-ink mb-1">Unable to load this refund.</p>
          <p className="text-ink-3 text-sm mb-5">
            The refund request could not be retrieved.
          </p>
          <Button size="sm" onClick={reload}>
            Retry
          </Button>
        </div>
      </div>
    )
  }

  if (!data) {
    return (
      <div>
        <button
          onClick={onBack}
          className="text-sm text-ink-3 hover:text-ink transition-colors"
        >
          ← Back to Refunds
        </button>
        <div className="bg-surface rounded-2xl border border-line py-16 text-center mt-4">
          <p className="font-display text-xl text-ink mb-1">Refund not found</p>
          <p className="text-ink-3 text-sm">This refund request is no longer available.</p>
        </div>
      </div>
    )
  }

  const refund: RefundRequest = data
  const customer = refund.appointment?.customer
  const name = customer
    ? [customer.firstName, customer.lastName].filter(Boolean).join(' ').trim() || '—'
    : '—'
  const branchName =
    branches.find(b => b.id === refund.appointment?.branchId)?.name ??
    refund.appointment?.branchId ??
    '—'

  const canApprove = refund.status === 'PENDING'
  const canComplete = refund.status === 'APPROVED'

  return (
    <div className="max-w-3xl">
      <button onClick={onBack} className="text-sm text-ink-3 hover:text-ink transition-colors">
        ← Back to Refunds
      </button>

      <div className="flex items-center justify-between gap-4 mt-4 mb-5">
        <div>
          <h3 className="font-display text-2xl text-ink leading-none mb-2">Refund</h3>
          <RefundStatusBadge status={refund.status} />
        </div>
        <div className="flex items-center gap-2">
          {canApprove && (
            <>
              <Button variant="secondary" onClick={openReject}>
                Reject Refund
              </Button>
              <Button onClick={() => { setFormError(null); setApproveOpen(true) }}>
                Approve Refund
              </Button>
            </>
          )}
          {canComplete && (
            <Button onClick={openComplete}>Complete Refund</Button>
          )}
        </div>
      </div>

      <div className="grid gap-4">
        <section className="bg-surface rounded-2xl border border-line px-5 py-4">
          <h4 className="text-xs font-semibold text-ink-3 uppercase tracking-wider mb-2">
            Customer
          </h4>
          <Row label="Name">{name}</Row>
          <Row label="Phone">{customer?.phone ?? '—'}</Row>
        </section>

        <section className="bg-surface rounded-2xl border border-line px-5 py-4">
          <h4 className="text-xs font-semibold text-ink-3 uppercase tracking-wider mb-2">
            Appointment
          </h4>
          <Row label="Scheduled">{formatDateTime(refund.appointment?.scheduledStart)}</Row>
          <Row label="Branch">{branchName}</Row>
        </section>

        <section className="bg-surface rounded-2xl border border-line px-5 py-4">
          <h4 className="text-xs font-semibold text-ink-3 uppercase tracking-wider mb-2">
            Refund
          </h4>
          <Row label="Requested amount">{money(refund.requestedAmount)}</Row>
          <Row label="Approved amount">{money(refund.approvedAmount)}</Row>
          {refund.status === 'COMPLETED' && (
            <Row label="Completed amount">{money(refund.completedAmount)}</Row>
          )}
          <Row label="Reason">{refund.reason ?? '—'}</Row>
          {refund.status === 'REJECTED' && (
            <Row label="Rejection reason">{refund.rejectionReason ?? '—'}</Row>
          )}
          {refund.reference && <Row label="Reference">{refund.reference}</Row>}
          {refund.note && <Row label="Note">{refund.note}</Row>}
          <Row label="Requested at">{formatDateTime(refund.requestedAt)}</Row>
          <Row label="Reviewed at">{formatDateTime(refund.reviewedAt)}</Row>
          {refund.reviewedBy?.phone && (
            <Row label="Reviewed by">{refund.reviewedBy.phone}</Row>
          )}
          <Row label="Completed at">{formatDateTime(refund.completedAt)}</Row>
          {refund.completedBy?.phone && (
            <Row label="Completed by">{refund.completedBy.phone}</Row>
          )}
        </section>
      </div>

      {/* Approve confirmation */}
      <Modal
        open={approveOpen}
        onClose={() => !busy && setApproveOpen(false)}
        title="Approve Refund"
      >
        <div className="px-6 py-5">
          <p className="text-sm text-ink-2 mb-4">
            Approve this refund request for the amount below?
          </p>
          <Row label="Requested amount">{money(refund.requestedAmount)}</Row>
          {formError && <p className="text-xs text-[#B06A6A] mt-3">{formError}</p>}
          <div className="flex justify-end gap-2 mt-6">
            <Button variant="secondary" disabled={busy} onClick={() => setApproveOpen(false)}>
              Cancel
            </Button>
            <Button loading={busy} onClick={handleApprove}>
              {busy ? 'Approving…' : 'Approve Refund'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Reject */}
      <Modal
        open={rejectOpen}
        onClose={() => !busy && setRejectOpen(false)}
        title="Reject Refund"
      >
        <div className="px-6 py-5">
          <Textarea
            label="Rejection reason *"
            rows={3}
            value={rejectReason}
            onChange={e => setRejectReason(e.target.value)}
            placeholder="Why is this refund being rejected?"
          />
          {formError && <p className="text-xs text-[#B06A6A] mt-2">{formError}</p>}
          <div className="flex justify-end gap-2 mt-6">
            <Button variant="secondary" disabled={busy} onClick={() => setRejectOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" loading={busy} onClick={handleReject}>
              {busy ? 'Rejecting…' : 'Reject Refund'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Complete */}
      <Modal
        open={completeOpen}
        onClose={() => !busy && setCompleteOpen(false)}
        title="Complete Refund"
      >
        <div className="px-6 py-5">
          <Row label="Approved amount">{money(refund.approvedAmount)}</Row>
          <div className="mt-4 grid gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-ink-2">Refund amount *</label>
              <input
                type="text"
                inputMode="decimal"
                value={completeAmount}
                onChange={e => setCompleteAmount(e.target.value)}
                placeholder="0.00"
                className="h-10 px-3 rounded-[10px] border border-line text-sm bg-surface text-ink focus:outline-none focus:border-warm focus:ring-1 focus:ring-warm/20"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-ink-2">Reference *</label>
              <input
                type="text"
                value={completeReference}
                onChange={e => setCompleteReference(e.target.value)}
                placeholder="e.g. TB-PAY-88123"
                className="h-10 px-3 rounded-[10px] border border-line text-sm bg-surface text-ink focus:outline-none focus:border-warm focus:ring-1 focus:ring-warm/20"
              />
            </div>
            <Textarea
              label="Note"
              rows={3}
              value={completeNote}
              onChange={e => setCompleteNote(e.target.value)}
              placeholder="Optional note about the payout"
            />
          </div>
          {formError && <p className="text-xs text-[#B06A6A] mt-2">{formError}</p>}
          <div className="flex justify-end gap-2 mt-6">
            <Button variant="secondary" disabled={busy} onClick={() => setCompleteOpen(false)}>
              Cancel
            </Button>
            <Button loading={busy} onClick={handleComplete}>
              {busy ? 'Completing…' : 'Complete Refund'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}