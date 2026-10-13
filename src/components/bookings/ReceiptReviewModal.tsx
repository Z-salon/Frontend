import { useEffect, useState } from 'react'
import type { AppointmentReceipt } from '../../types/api'
import { Modal, Button, Input, Textarea } from '../ui'
import { useToast } from '../ui/Toast'
import { receiptsApi } from '../../api/receipts.api'

export function ReceiptReviewModal({
  open,
  businessId,
  receipt,
  onClose,
  onVerified,
}: {
  open: boolean
  businessId: string
  receipt: AppointmentReceipt | null
  onClose: () => void
  onVerified: (updated: AppointmentReceipt) => void
}) {
  const toast = useToast()
  const [busy, setBusy] = useState<'APPROVE' | 'REJECT' | null>(null)
  const [verifiedAmount, setVerifiedAmount] = useState('')
  const [rejectionReason, setRejectionReason] = useState('')
  const [error, setError] = useState<string | null>(null)

  // Seed the amount field when the receipt changes — the reviewer is
  // expected to confirm the number, not retype it, so prefill with what
  // the customer declared.
  useEffect(() => {
    if (!receipt) return
    setVerifiedAmount(receipt.submittedAmount)
    setRejectionReason('')
    setError(null)
    setBusy(null)
  }, [receipt])

  if (!receipt) return null

  const amountNumber = Number(verifiedAmount)
  const amountValid =
    verifiedAmount.trim() !== '' &&
    Number.isFinite(amountNumber) &&
    amountNumber > 0

  const reasonValid = rejectionReason.trim().length > 0

  async function approve() {
    if (!receipt) return
    if (!amountValid) {
      setError('Enter the amount you actually received.')
      return
    }

    setBusy('APPROVE')
    setError(null)
    try {
      const updated = await receiptsApi.verify(businessId, receipt.appointmentId, {
        action: 'APPROVE',
        verifiedAmount: amountNumber,
      })
      toast.success('Receipt approved — appointment confirmed')
      onVerified(updated)
      onClose()
    } catch (err) {
      setError(extractMessage(err, 'Could not approve the receipt.'))
    } finally {
      setBusy(null)
    }
  }

  async function reject() {
    if (!receipt) return
    if (!reasonValid) {
      setError('Explain why the receipt was rejected.')
      return
    }

    setBusy('REJECT')
    setError(null)
    try {
      const updated = await receiptsApi.verify(businessId, receipt.appointmentId, {
        action: 'REJECT',
        rejectionReason: rejectionReason.trim(),
      })
      toast.success('Receipt rejected — customer will be notified')
      onVerified(updated)
      onClose()
    } catch (err) {
      setError(extractMessage(err, 'Could not reject the receipt.'))
    } finally {
      setBusy(null)
    }
  }

  return (
    <Modal
      open={open}
      onClose={() => !busy && onClose()}
      title="Review receipt"
      width="max-w-lg"
    >
      <div className="px-6 py-5 flex flex-col gap-4">
        {/* Receipt image */}
        <div className="rounded-xl border border-line overflow-hidden bg-bg">
          <a
            href={receipt.receiptImageUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="block"
            title="Open in new tab"
          >
            <img
              src={receipt.receiptImageUrl}
              alt="Submitted receipt"
              className="w-full max-h-[420px] object-contain bg-bg"
              onError={e => {
                // Broken CDN link — hide the broken glyph, show fallback text.
                e.currentTarget.style.display = 'none'
              }}
            />
          </a>
        </div>

        <div className="bg-bg rounded-xl px-4 py-3 flex flex-col gap-2 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-ink-3">Customer declared</span>
            <span className="text-ink font-medium">
              {Number(receipt.submittedAmount).toLocaleString()} ETB
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-ink-3">Submitted</span>
            <span className="text-ink">
              {new Date(receipt.submittedAt).toLocaleString()}
            </span>
          </div>
          {receipt.customerNote && (
            <div className="pt-2 border-t border-line">
              <p className="text-xs text-ink-3 mb-1">Customer note</p>
              <p className="text-sm text-ink-2 leading-relaxed">
                {receipt.customerNote}
              </p>
            </div>
          )}
        </div>

        <Input
          label="Amount received (ETB)"
          type="number"
          inputMode="decimal"
          value={verifiedAmount}
          onChange={e => setVerifiedAmount(e.target.value.replace(/[^\d.]/g, ''))}
          disabled={busy !== null}
          hint="Confirm against the transfer. This becomes the recorded payment."
        />

        <Textarea
          label="Rejection reason (only if rejecting)"
          rows={2}
          value={rejectionReason}
          onChange={e => setRejectionReason(e.target.value)}
          disabled={busy !== null}
          placeholder="e.g. Amount does not match the transfer."
        />

        {error && (
          <p className="text-sm text-bad leading-relaxed">{error}</p>
        )}
      </div>

      <div className="px-6 pb-6 flex gap-3 justify-between border-t border-line pt-4">
        <Button
          variant="ghost"
          onClick={onClose}
          disabled={busy !== null}
        >
          Later
        </Button>
        <div className="flex gap-2">
          <Button
            variant="destructive"
            onClick={() => void reject()}
            loading={busy === 'REJECT'}
            disabled={busy !== null || !reasonValid}
          >
            Reject
          </Button>
          <Button
            onClick={() => void approve()}
            loading={busy === 'APPROVE'}
            disabled={busy !== null || !amountValid}
          >
            Approve
          </Button>
        </div>
      </div>
    </Modal>
  )
}

function extractMessage(err: unknown, fallback: string): string {
  if (!err) return fallback
  const anyErr = err as any

  if (Array.isArray(anyErr?.fieldErrors) && anyErr.fieldErrors.length > 0) {
    const f = anyErr.fieldErrors[0]
    const prefix = f.field ? `${f.field}: ` : ''
    return `${prefix}${f.message}`
  }
  const data = anyErr?.response?.data ?? anyErr?.data ?? anyErr
  if (Array.isArray(data?.details) && data.details.length > 0) {
    const d = data.details[0]
    if (typeof d === 'string') return d
    if (d && typeof d === 'object') {
      const field = d.field ? `${d.field}: ` : ''
      return `${field}${d.message ?? JSON.stringify(d)}`
    }
  }
  if (typeof data?.message === 'string' && data.message) return data.message
  if (typeof anyErr?.message === 'string' && anyErr.message) return anyErr.message
  return fallback
}