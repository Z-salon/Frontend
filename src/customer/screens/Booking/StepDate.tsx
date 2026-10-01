import { useMemo, useState } from 'react'
import { useBooking } from '../../context/BookingContext'

const MONTH_LABELS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]
const WEEKDAY = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']

function pad2(n: number) { return String(n).padStart(2, '0') }
function toISO(d: Date) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`
}

export function StepDate() {
  const { draft, updateDraft, setStep } = useBooking()
  const today = useMemo(() => new Date(), [])
  const [viewYear, setViewYear] = useState(today.getFullYear())
  const [viewMonth, setViewMonth] = useState(today.getMonth())

  const grid = useMemo(() => {
    const first = new Date(viewYear, viewMonth, 1)
    const offset = first.getDay()
    const start = new Date(viewYear, viewMonth, 1 - offset)
    const cells: { d: Date; inMonth: boolean }[] = []
    for (let i = 0; i < 42; i++) {
      const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i)
      cells.push({ d, inMonth: d.getMonth() === viewMonth })
    }
    return cells
  }, [viewYear, viewMonth])

  const todayISO = toISO(today)

  function pick(d: Date) {
    updateDraft({
      date: toISO(d),
      slotStart: null,
      slotEnd: null,
    })
    setStep('slot')
  }

  return (
    <section>
      <h2 className="font-display text-2xl mb-1">When?</h2>
      <p className="text-sm text-ink-3 mb-6">
        Pick a date to see available times.
      </p>

      <div className="bg-surface rounded-2xl border border-line p-4 sm:p-5 max-w-sm">
        <div className="flex items-center justify-between mb-3">
          <button
            type="button"
            onClick={() => {
              const d = new Date(viewYear, viewMonth - 1, 1)
              setViewYear(d.getFullYear()); setViewMonth(d.getMonth())
            }}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-ink-3 hover:bg-warm-subtle hover:text-ink"
            aria-label="Previous month"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </button>
          <p className="text-sm font-medium text-ink tabular-nums">
            {MONTH_LABELS[viewMonth]} {viewYear}
          </p>
          <button
            type="button"
            onClick={() => {
              const d = new Date(viewYear, viewMonth + 1, 1)
              setViewYear(d.getFullYear()); setViewMonth(d.getMonth())
            }}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-ink-3 hover:bg-warm-subtle hover:text-ink"
            aria-label="Next month"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M9 18l6-6-6-6" />
            </svg>
          </button>
        </div>

        <div className="grid grid-cols-7 gap-0.5 mb-1">
          {WEEKDAY.map(w => (
            <div key={w} className="h-7 flex items-center justify-center text-[10px] font-semibold text-ink-3 uppercase tracking-wider">
              {w}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-0.5">
          {grid.map((cell, i) => {
            const iso = toISO(cell.d)
            const disabled = iso < todayISO
            const selected = iso === draft.date
            const isToday = iso === todayISO
            return (
              <button
                key={i}
                type="button"
                disabled={disabled}
                onClick={() => pick(cell.d)}
                className={`
                  h-9 rounded-lg text-xs tabular-nums flex items-center justify-center transition-colors
                  ${disabled
                    ? 'text-ink-3/30 cursor-not-allowed'
                    : selected
                      ? 'bg-ink text-surface font-medium'
                      : cell.inMonth
                        ? 'text-ink-2 hover:bg-warm-subtle hover:text-ink'
                        : 'text-ink-3/60 hover:bg-warm-subtle hover:text-ink'}
                  ${!selected && isToday && !disabled ? 'ring-1 ring-ink-3/40' : ''}
                `}
              >
                {cell.d.getDate()}
              </button>
            )
          })}
        </div>
      </div>
    </section>
  )
}