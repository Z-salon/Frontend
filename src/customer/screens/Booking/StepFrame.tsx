import type { ReactNode } from 'react'
import { Button } from '../../components/ui'
import { IconArrowLeft } from '../../components/icons'
import { useBrand } from '../../components/BrandTheme'
import { useBooking } from '../../context/BookingContext'
import { withAlpha } from '../../lib/theme'

/**
 * Shared chrome for every step of the booking wizard: the step counter,
 * the heading pair, and an optional footer. Keeping this in one place is
 * what makes the six steps feel like one flow rather than six pages.
 *
 * The counter reads its position from the booking context rather than
 * taking it as a prop, because the stylist step is conditional — a
 * per-step hardcoded `index={4} total={5}` would drift as soon as the
 * service asked for one.
 */
export function StepFrame({
  title,
  subtitle,
  children,
  footer,
  onBack,
  backLabel = 'Back',
}: {
  title: string
  subtitle?: ReactNode
  children: ReactNode
  footer?: ReactNode
  onBack?: () => void
  backLabel?: string
}) {
  const brand = useBrand()
  const { stepIndex, stepTotal } = useBooking()
  const progress = Math.max(0, Math.min(1, stepIndex / stepTotal))

  return (
    <section className="motion-safe:animate-fade-up">
      <header className="mb-7 sm:mb-8">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span
              className="h-1.5 w-1.5 rounded-full"
              style={{ backgroundColor: brand.primary }}
              aria-hidden="true"
            />
            <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-ink">
              Step {stepIndex} of {stepTotal}
            </p>
          </div>

          {/* Progress hairline — brand-tinted fill over a neutral track. */}
          <span
            className="relative h-px flex-1 overflow-hidden bg-line"
            aria-hidden="true"
          >
            <span
              className="absolute inset-y-0 left-0 block transition-[width] duration-500 ease-out"
              style={{
                width: `${progress * 100}%`,
                backgroundColor: brand.primary,
              }}
            />
          </span>
        </div>

        <h1 className="mt-2.5 max-w-[22ch] text-balance font-display text-3xl leading-tight tracking-tight text-ink sm:text-[2.5rem]">
          {title}
        </h1>

        {/* Brand underline accent — short rule that reads as the tenant's stamp. */}
        <span
          className="mt-3 block h-[3px] w-10 rounded-full"
          style={{ backgroundColor: brand.primary }}
          aria-hidden="true"
        />

        {subtitle && (
          <p className="mt-3 max-w-lg text-[15px] leading-relaxed text-ink-3">
            {subtitle}
          </p>
        )}
      </header>

      {children}

      {footer && <div className="mt-8">{footer}</div>}

      {onBack && (
        <div className="mt-8 border-t border-line pt-5">
          <Button
            variant="ghost"
            size="sm"
            onClick={onBack}
            iconLeft={<IconArrowLeft className="h-3.5 w-3.5" />}
          >
            {backLabel}
          </Button>
        </div>
      )}
    </section>
  )
}

/** Centred, bordered message used for in-step loading and empty states. */
export function StepNotice({
  title,
  body,
  action,
  icon,
}: {
  title: string
  body?: ReactNode
  action?: ReactNode
  icon?: ReactNode
}) {
  const brand = useBrand()

  return (
    <div
      className="motion-safe:animate-fade-up flex flex-col items-center rounded-2xl border border-dashed px-6 py-12 text-center"
      style={{
        borderColor: withAlpha(brand.primary, 0.25),
        backgroundColor: withAlpha(brand.primary, 0.03),
      }}
    >
      {icon && (
        <span
          className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl ring-1"
          style={{
            backgroundColor: withAlpha(brand.primary, 0.1),
            color: brand.accent,
            boxShadow: `0 0 0 1px ${withAlpha(brand.primary, 0.18)}`,
          }}
        >
          {icon}
        </span>
      )}

      <h2 className="text-balance font-display text-xl text-ink">{title}</h2>

      {body && (
        <p className="mt-2 max-w-sm text-sm leading-relaxed text-ink-3">{body}</p>
      )}

      {action && <div className="mt-6">{action}</div>}
    </div>
  )
}
