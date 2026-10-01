import { useBooking } from '../../context/BookingContext'
import { navigate } from '../../router'

export function StepDone() {
  const { businessId, draft, resetDraft } = useBooking()

  return (
    <section className="text-center max-w-md mx-auto">
      <div
        className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4"
        style={{ background: 'var(--brand-primary)', color: 'var(--brand-on-primary)' }}
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="20 6 9 17 4 12" />
        </svg>
      </div>

      <h2 className="font-display text-2xl mb-2">You're booked!</h2>
      <p className="text-sm text-ink-3 mb-6">
        We'll send a text with your appointment details and a link to
        confirm, reschedule, or cancel if anything changes.
      </p>

      {draft.date && draft.slotStart && (
        <div className="bg-surface rounded-2xl border border-line p-5 text-left mb-6">
          <p className="text-xs font-semibold text-ink-3 uppercase tracking-wider mb-2">
            Your appointment
          </p>
          <p className="text-sm text-ink">
            {draft.date}
          </p>
          <p className="text-sm text-ink-3 mt-0.5">
            {formatSlot(draft.slotStart)}
          </p>
        </div>
      )}

      <button
        type="button"
        onClick={() => {
          resetDraft()
          navigate(`/book/${businessId}`)
        }}
        className="h-11 px-6 rounded-xl text-sm font-medium"
        style={{ background: 'var(--brand-primary)', color: 'var(--brand-on-primary)' }}
      >
        Back to {businessId ? 'home' : 'start'}
      </button>
    </section>
  )
}

function formatSlot(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  let h = d.getHours()
  const m = String(d.getMinutes()).padStart(2, '0')
  const suffix = h >= 12 ? 'PM' : 'AM'
  if (h === 0) h = 12
  else if (h > 12) h -= 12
  return `${h}:${m} ${suffix}`
}