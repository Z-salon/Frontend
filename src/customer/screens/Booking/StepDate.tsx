import { useMemo, useState } from 'react'
import { useBooking } from '../../context/BookingContext'
import { Button, Pill } from '../../components/ui'
import { StepFrame } from './StepFrame'
import {
  IconArrowLeft,
  IconCalendar,
  IconChevronLeft,
  IconChevronRight,
} from '../../components/icons'
import { formatDateLong, toIsoDate } from '../../utils/format'

const MONTH_LABELS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]
const WEEKDAY = ['S', 'M', 'T', 'W', 'T', 'F', 'S']


export function StepDate() {
  const { draft, updateDraft, setStep, requiresStaffChoice } = useBooking()
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

  const todayISO = toIsoDate(today)
  const atCurrentMonth =
    viewYear === today.getFullYear() && viewMonth === today.getMonth()

  function shiftMonth(delta: number) {
    const d = new Date(viewYear, viewMonth + delta, 1)
    setViewYear(d.getFullYear())
    setViewMonth(d.getMonth())
  }

  function pick(d: Date) {
    // The roster is derived from availability for a single date, so
    // changing the date invalidates any stylist the customer had picked.
    updateDraft({
      date: toIsoDate(d),
      staffId: null,
      staffName: null,
      slotStart: null,
      slotEnd: null,
    })
    setStep(requiresStaffChoice ? 'staff' : 'slot')
  }

  return (
    <StepFrame
      title="Pick a day"
      subtitle={
        draft.serviceName
          ? `When would you like your ${draft.serviceName.toLowerCase()}?`
          : 'When would you like to come in?'
      }
    >
      <div className="overflow-hidden rounded-2xl border border-line bg-surface shadow-card">
        <div
          className="flex items-center justify-between gap-3 border-b border-line px-4 py-3.5 sm:px-5"
          style={{ background: 'var(--brand-soft)' }}
        >
          <button
            type="button"
            onClick={() => shiftMonth(-1)}
            disabled={atCurrentMonth}
            aria-label="Previous month"
            className="focus-ring flex h-9 w-9 items-center justify-center rounded-lg text-ink-2 transition-colors hover:bg-surface disabled:pointer-events-none disabled:opacity-30"
          >
            <IconChevronLeft className="h-4 w-4" />
          </button>

          <p className="font-display text-lg tracking-tight text-ink">
            {MONTH_LABELS[viewMonth]}{' '}
            <span className="tabular-nums text-ink-3">{viewYear}</span>
          </p>

          <button
            type="button"
            onClick={() => shiftMonth(1)}
            aria-label="Next month"
            className="focus-ring flex h-9 w-9 items-center justify-center rounded-lg text-ink-2 transition-colors hover:bg-surface"
          >
            <IconChevronRight className="h-4 w-4" />
          </button>
        </div>

        <div className="p-4 sm:p-5">
          <div className="mb-1.5 grid grid-cols-7">
            {WEEKDAY.map((w, i) => (
              <div
                key={i}
                className="flex h-7 items-center justify-center text-[10px] font-semibold uppercase tracking-[0.1em] text-ink-3"
              >
                {w}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1">
            {grid.map((cell, i) => {
              const iso = toIsoDate(cell.d)
              const disabled = iso < todayISO
              const selected = iso === draft.date
              const isToday = iso === todayISO

              return (
                <button
                  key={i}
                  type="button"
                  disabled={disabled}
                  onClick={() => pick(cell.d)}
                  aria-label={cell.d.toDateString()}
                  aria-pressed={selected}
                  className={`
                    relative flex h-11 items-center justify-center rounded-xl text-sm
                    tabular-nums transition-all duration-200 focus-ring
                    ${
                      selected
                        ? 'font-semibold text-[color:var(--brand-on-primary)] shadow-[0_8px_18px_-10px_rgba(var(--brand-rgb),0.9)]'
                        : disabled
                          ? 'cursor-not-allowed text-ink-3/30'
                          : cell.inMonth
                            ? 'text-ink-2 hover:bg-warm-subtle hover:text-ink'
                            : 'text-ink-3/50 hover:bg-warm-subtle/70'
                    }
                  `}
                  style={selected ? { background: 'var(--brand-primary)' } : undefined}
                >
                  {cell.d.getDate()}
                  {!selected && isToday && (
                    <span
                      className="absolute bottom-1.5 h-1 w-1 rounded-full bg-[color:var(--brand-primary)]"
                      aria-hidden="true"
                    />
                  )}
                </button>
              )
            })}
          </div>
        </div>
      </div>

      {draft.date && (
        <p className="mt-5 flex items-center gap-2.5 text-sm text-ink-2">
          <IconCalendar className="h-4 w-4 text-ink-3" />
          <span>
            <span className="text-ink-3">Selected</span>{' '}
            <span className="font-medium text-ink">{formatDateLong(draft.date)}</span>
          </span>
          <Pill tone="brand">{draft.serviceName ?? 'Appointment'}</Pill>
        </p>
      )}

      <div className="mt-7">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setStep('service')}
          iconLeft={<IconArrowLeft className="h-3.5 w-3.5" />}
        >
          Change service
        </Button>
      </div>
    </StepFrame>
  )
}
