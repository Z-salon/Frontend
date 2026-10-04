import { useBooking } from '../../context/BookingContext'
import { Button, DetailRow, Pill } from '../../components/ui'
import {
  IconCalendar,
  IconCheckCircle,
  IconClock,
  IconInfo,
  IconPin,
  IconScissors,
  IconUser,
} from '../../components/icons'
import {
  formatDateShort,
  formatDuration,
  formatIsoTime,
  formatPrice,
} from '../../utils/format'
import type { BookingStep } from './steps'

/**
 * Running recap of the booking.
 *
 * Rendered as a sticky rail on desktop and behind a sheet on mobile, so
 * the customer can always see what they have already committed to
 * before hitting the submit step. Every field is optional — rows only
 * appear once the corresponding step has been answered.
 *
 * Colours resolve through the tenant ramp: the header wash, the answered
 * counter, and the neutral chrome all read `--brand-*` via `.salon-themed`
 * remaps (`bg-cream`, `border-line`) with inline
 * `var(--brand-soft)` for the one raw tint the header needs.
 */
export function BookingSummary({
  onEdit,
  className = '',
}: {
  onEdit?: (step: BookingStep) => void
  className?: string
}) {
  const {
    branding,
    draft,
    setStep,
    resetDraft,
    requiresStaffChoice,
  } = useBooking()

  // The stylist row only exists when the service asks the customer to
  // choose one, so the rail always matches the flow they are actually on.
  const rows: Array<{
    key: string
    label: string
    value: React.ReactNode
    editStep?: BookingStep
    empty: boolean
  }> = [
    {
      key: 'branch',
      label: 'Location',
      value: draft.branchName ?? 'Not chosen yet',
      editStep: 'branch',
      empty: !draft.branchName,
    },
    {
      key: 'service',
      label: 'Service',
      value: (
        <>
          {draft.serviceName ?? 'Not chosen yet'}
          {(draft.serviceDurationMinutes || draft.servicePrice) && (
            <span className="mt-1.5 flex flex-wrap items-center gap-1.5">
              {draft.serviceDurationMinutes ? (
                <Pill>
                  <IconClock className="h-3 w-3" />
                  {formatDuration(draft.serviceDurationMinutes)}
                </Pill>
              ) : null}
              {draft.serviceShowPrice &&
                draft.servicePrice &&
                draft.servicePrice !== '0' &&
                draft.serviceName && (
                  <Pill tone="brand">
                    {formatPrice(draft.servicePrice, branding.currency)}
                  </Pill>
                )}
            </span>
          )}
        </>
      ),
      editStep: 'service',
      empty: !draft.serviceName,
    },
    ...(requiresStaffChoice
      ? [
          {
            key: 'staff',
            label: 'Stylist',
            value: draft.staffName ?? 'Not chosen yet',
            editStep: 'staff' as const,
            empty: !draft.staffName,
          },
        ]
      : []),
    {
      key: 'date',
      label: 'Date',
      value: draft.date ? formatDateShort(draft.date) : 'Not chosen yet',
      editStep: 'date',
      empty: !draft.date,
    },
    {
      key: 'time',
      label: 'Time',
      value: draft.slotStart ? formatIsoTime(draft.slotStart) : 'Not chosen yet',
      editStep: 'slot',
      empty: !draft.slotStart,
    },
    // Deposit row — only appears once the created appointment told us
    // money is owed. Not editable (the amount is set by the salon), so
    // no `editStep`.
    ...(draft.requiresDeposit
      ? [
          {
            key: 'deposit',
            label: 'Deposit',
            value: (
              <span className="flex flex-wrap items-center gap-1.5">
                <Pill tone="brand">
                  {draft.depositAmount !== null
                    ? formatPrice(String(draft.depositAmount), branding.currency)
                    : 'Required'}
                </Pill>
                {draft.receiptStatus === 'PENDING' && (
                  <span className="inline-flex items-center gap-1 text-[11px] font-medium text-ink-3">
                    <IconInfo className="h-3 w-3" />
                    Awaiting verification
                  </span>
                )}
                {draft.receiptStatus === 'APPROVED' && (
                  <span className="inline-flex items-center gap-1 text-[11px] font-medium text-good">
                    <IconCheckCircle className="h-3 w-3" />
                    Verified
                  </span>
                )}
              </span>
            ),
            empty: false,
          },
        ]
      : []),
  ]

  const guestName = [draft.firstName, draft.lastName]
    .map(part => part?.trim())
    .filter(Boolean)
    .join(' ')
  const answered = rows.filter(r => !r.empty).length

  return (
    <div
      className={`overflow-hidden rounded-2xl border border-line bg-surface shadow-card ${className}`}
    >
      <div
        className="flex items-center justify-between gap-3 border-b border-line px-5 py-4"
        style={{ background: 'var(--brand-soft)' }}
      >
        <h2 className="font-display text-lg leading-none text-ink">
          Your booking
        </h2>
        <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[color:var(--brand-accent)]">
          {answered}/{rows.length}
        </span>
      </div>

      <div className="flex flex-col gap-4 p-5">
        {rows.map(row => (
          <div
            key={row.key}
            className="group flex items-start justify-between gap-3"
          >
            <DetailRow
              icon={
                row.key === 'branch' ? (
                  <IconPin className="h-4 w-4" />
                ) : row.key === 'service' ? (
                  <IconScissors className="h-4 w-4" />
                ) : row.key === 'date' ? (
                  <IconCalendar className="h-4 w-4" />
                ) : (
                  <IconClock className="h-4 w-4" />
                )
              }
              label={row.label}
              value={
                <span className={row.empty ? 'text-ink-3' : undefined}>
                  {row.value}
                </span>
              }
            />
            {!row.empty && row.editStep && onEdit && (
              <button
                type="button"
                onClick={() => onEdit(row.editStep!)}
                className="focus-ring mt-0.5 shrink-0 rounded text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-3 opacity-0 transition-opacity hover:text-ink focus-visible:opacity-100 group-hover:opacity-100"
              >
                Edit
              </button>
            )}
          </div>
        ))}

        {guestName && (
          <div className="border-t border-line pt-4">
            <DetailRow
              icon={<IconUser className="h-4 w-4" />}
              label="Guest"
              value={guestName}
            />
          </div>
        )}
      </div>

      <div className="flex items-center justify-between gap-3 border-t border-line bg-cream/60 px-5 py-3">
        <button
          type="button"
          onClick={resetDraft}
          className="focus-ring rounded text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-3 transition-colors hover:text-bad"
        >
          Start over
        </button>
        <button
          type="button"
          onClick={() => setStep('branch')}
          className="focus-ring rounded text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-3 transition-colors hover:text-ink"
        >
          Change location
        </button>
      </div>
    </div>
  )
}

/**
 * Mobile-only sticky bar. Shows the next blank field as a prompt, or the
 * most recent answer once everything is filled in.
 */
export function MobileSummaryBar({ onOpen }: { onOpen: () => void }) {
  const { draft, requiresStaffChoice } = useBooking()

  // Once a deposit is due, the prepay step is what stands between the
  // customer and confirmation — so the prompt has to change to match.
  const nextUp = !draft.branchName
    ? 'Choose a location'
    : !draft.serviceName
      ? 'Choose a service'
      : !draft.date
        ? 'Pick a date'
        : requiresStaffChoice && !draft.staffName
          ? 'Choose a stylist'
          : !draft.slotStart
            ? 'Pick a time'
            : draft.requiresDeposit && draft.receiptStatus === null
              ? 'Pay deposit'
              : null

  return (
    <div className="sticky bottom-0 z-30 border-t border-line bg-surface/95 px-5 py-3 backdrop-blur lg:hidden">
      <Button fullWidth onClick={onOpen} variant="soft">
        {nextUp ? (
          <>
            <span className="text-ink-3">Next:</span> {nextUp}
          </>
        ) : (
          <>
            {draft.serviceName ?? 'Your booking'}
            {draft.date ? ` · ${formatDateShort(draft.date)}` : ''}
            {draft.slotStart ? ` · ${formatIsoTime(draft.slotStart)}` : ''}
          </>
        )}
      </Button>
    </div>
  )
}