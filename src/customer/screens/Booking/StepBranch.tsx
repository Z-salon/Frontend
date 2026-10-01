import { useBooking } from '../../context/BookingContext'

export function StepBranch() {
  const { branding, draft, updateDraft, setStep } = useBooking()

  function pick(branchId: string) {
    updateDraft({
      branchId,
      // Clear downstream choices when the branch changes.
      serviceId: null,
      staffId: null,
      slotStart: null,
      slotEnd: null,
    })
    setStep('service')
  }

  return (
    <section>
      <h2 className="font-display text-2xl mb-1">Which location?</h2>
      <p className="text-sm text-ink-3 mb-6">
        Pick the branch you'd like to visit.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {branding.branches.map(branch => {
          const selected = draft.branchId === branch.id
          return (
            <button
              key={branch.id}
              type="button"
              onClick={() => pick(branch.id)}
              className={`
                text-left rounded-2xl border p-5 transition-all
                ${selected
                  ? 'border-transparent ring-2'
                  : 'border-line hover:border-warm'}
              `}
              style={selected ? { boxShadow: '0 0 0 2px var(--brand-primary)' } : undefined}
            >
              <p className="font-medium text-ink">{branch.name}</p>
              {branch.address && (
                <p className="text-sm text-ink-3 mt-1">{branch.address}</p>
              )}
              {branch.phones.length > 0 && (
                <p className="text-xs text-ink-3 mt-2">
                  {branch.phones[0].phone}
                </p>
              )}
            </button>
          )
        })}
      </div>
    </section>
  )
}