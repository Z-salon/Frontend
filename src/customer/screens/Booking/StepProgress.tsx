import type { BookingStep } from './steps'

/**
 * Booking progress indicator.
 *
 * Shows the five answerable steps as a connected rail. Steps the
 * customer has already satisfied are clickable so they can hop back and
 * change an answer; steps ahead stay disabled, and the wizard shell
 * re-validates prerequisites on every jump.
 */
export function StepProgress({
  steps,
  labels,
  current,
  onJump,
}: {
  steps: BookingStep[]
  labels: Record<string, string>
  current: BookingStep
  onJump: (step: BookingStep) => void
}) {
  const currentIdx = Math.max(
    0,
    steps.indexOf(current),
  )

  return (
    <nav aria-label="Booking progress">
      <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.24em] text-ink">
        Step {currentIdx + 1} of {steps.length}
        <span className="mx-2 text-ink-3/70">/</span>
        <span>{labels[current]}</span>
      </p>

      <ol className="-mx-1 flex items-center overflow-x-auto px-1 pb-1">
        {steps.map((s, i) => {
          const done = i < currentIdx
          const active = i === currentIdx
          const enabled = i <= currentIdx
          const isLast = i === steps.length - 1

          return (
            <li
              key={s}
              className={isLast ? 'flex flex-shrink-0 items-center' : 'flex flex-shrink-1 items-center'}
            >
              <button
                type="button"
                disabled={!enabled}
                onClick={() => enabled && onJump(s)}
                aria-current={active ? 'step' : undefined}
                className={`
                  focus-ring group flex items-center gap-2 rounded-full py-1 pl-1 pr-2
                  transition-opacity
                  ${enabled ? 'cursor-pointer' : 'cursor-not-allowed opacity-45'}
                `}
              >
                <span
                  className={`
                    flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full
                    text-[11px] font-semibold transition-all duration-300
                    ${
                      active
                        ? 'scale-110 text-[color:var(--brand-on-primary)] shadow-[0_6px_16px_-8px_rgba(var(--brand-rgb),0.9)]'
                        : done
                          ? 'text-[color:var(--brand-accent)]'
                          : 'bg-warm-subtle text-ink-3'
                    }
                  `}
                  style={
                    active
                      ? { background: 'var(--brand-primary)' }
                      : done
                        ? { background: 'var(--brand-soft-strong)', border: '1px solid var(--brand-line)' }
                        : undefined
                  }
                >
                  {done ? <CheckGlyph /> : i + 1}
                </span>
                <span
                  className={`
                    whitespace-nowrap text-[13px] transition-colors
                    ${active ? 'font-semibold text-ink' : done ? 'text-ink-2' : 'text-ink-3'}
                  `}
                >
                  {labels[s]}
                </span>
              </button>

              {!isLast && (
                <span
                  className="mx-1.5 h-px w-6 flex-shrink-0 rounded-full sm:mx-2.5 sm:w-10"
                  style={{ background: done ? 'var(--brand-primary)' : 'var(--color-line)' }}
                  aria-hidden="true"
                />
              )}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}

function CheckGlyph() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} className="h-3.5 w-3.5" aria-hidden="true">
      <path d="m5 12.5 4.5 4.5L19 7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
