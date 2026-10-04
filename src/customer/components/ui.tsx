import {
  useEffect,
  useId,
  type AnchorHTMLAttributes,
  type ButtonHTMLAttributes,
  type CSSProperties,
  type InputHTMLAttributes,
  type ReactNode,
  type TextareaHTMLAttributes,
} from 'react'
import { createPortal } from 'react-dom'
import { Link } from '../router'
import { useBrand } from './BrandTheme'
import {
  IconAlert,
  IconCheck,
  IconCheckCircle,
  IconChevronDown,
  IconHeart,
  IconInfo,
  IconSpinner,
  IconStar,
  IconX,
} from './icons'

/* ================================================================== */
/*  Buttons                                                            */
/* ================================================================== */

type ButtonVariant =
  | 'primary'
  | 'outline'
  | 'soft'
  | 'ghost'
  | 'danger'
  /** Sits on top of the hero cover image, so it needs its own surface. */
  | 'onImage'
type ButtonSize = 'sm' | 'md' | 'lg'

const SIZE_CLASSES: Record<ButtonSize, string> = {
  sm: 'h-9 px-3.5 text-[13px] gap-1.5 rounded-lg',
  md: 'h-11 px-5 text-sm gap-2 rounded-xl',
  lg: 'h-13 px-7 text-[15px] gap-2.5 rounded-xl',
}

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
  loading?: boolean
  fullWidth?: boolean
  iconLeft?: ReactNode
  iconRight?: ReactNode
}

/**
 * Resolves a variant into its classes + inline surface. Shared by
 * `Button` and `LinkButton` so an anchor can be styled identically to a
 * button without the two drifting apart.
 */
function useButtonTone(
  variant: ButtonVariant,
  size: ButtonSize,
  fullWidth: boolean,
) {
  const brand = useBrand()

  const tone: Record<ButtonVariant, string> = {
    primary:
      'shadow-[0_10px_26px_-16px_rgba(var(--brand-rgb),0.85)] hover:brightness-[0.94]',
    outline:
      'bg-surface border border-line text-ink hover:border-warm hover:bg-warm-subtle/50',
    soft: 'text-[color:var(--brand-accent)] hover:brightness-[0.97]',
    ghost: 'text-ink-2 hover:bg-warm-subtle/60 hover:text-ink',
    danger:
      'bg-bad-soft border border-[#E8CBCB] text-bad hover:bg-[#F3E2E2] hover:border-[#DBB2B2]',
    onImage:
      'border border-white/35 bg-white/10 text-white backdrop-blur-sm hover:border-white/60 hover:bg-white/20',
  }

  const surface: Record<ButtonVariant, CSSProperties | undefined> = {
    primary: { background: brand.primary, color: brand.onPrimary },
    outline: undefined,
    soft: { background: brand.softStrong, borderColor: brand.line },
    ghost: undefined,
    danger: undefined,
    onImage: undefined,
  }

  const className = `
    inline-flex items-center justify-center font-medium whitespace-nowrap
    transition-[transform,background-color,border-color,box-shadow,filter] duration-200
    focus-ring select-none
    hover:-translate-y-px active:translate-y-0
    disabled:opacity-55 disabled:pointer-events-none
    ${SIZE_CLASSES[size]} ${tone[variant]} ${fullWidth ? 'w-full' : ''}
  `

  return { className, style: surface[variant] }
}

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  fullWidth = false,
  iconLeft,
  iconRight,
  className = '',
  children,
  disabled,
  type = 'button',
  ...rest
}: ButtonProps) {
  const { className: base, style } = useButtonTone(variant, size, fullWidth)

  return (
    <button
      type={type}
      disabled={disabled || loading}
      style={style}
      className={`${base} ${className}`}
      {...rest}
    >
      {loading ? <IconSpinner className="h-4 w-4" /> : iconLeft}
      {children}
      {iconRight}
    </button>
  )
}

/** Anchor that navigates through the client router, styled as a button. */
export function LinkButton({
  to,
  variant = 'primary',
  size = 'md',
  fullWidth = false,
  iconLeft,
  iconRight,
  className = '',
  children,
  ...rest
}: {
  to: string
  variant?: ButtonVariant
  size?: ButtonSize
  fullWidth?: boolean
  iconLeft?: ReactNode
  iconRight?: ReactNode
  children: ReactNode
} & Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href' | 'children'>) {
  const { className: base, style } = useButtonTone(variant, size, fullWidth)

  return (
    <Link to={to} style={style} className={`${base} ${className}`} {...rest}>
      {iconLeft}
      {children}
      {iconRight}
    </Link>
  )
}

/* ================================================================== */
/*  Surfaces                                                           */
/* ================================================================== */

export function Card({
  children,
  className = '',
  interactive = false,
  padded = true,
}: {
  children: ReactNode
  className?: string
  /** Adds the hover lift used for anything that navigates. */
  interactive?: boolean
  padded?: boolean
}) {
  return (
    <div
      className={`
        rounded-2xl border border-line bg-surface
        ${padded ? 'p-5 sm:p-6' : ''}
        ${interactive
          ? 'transition-[transform,box-shadow,border-color] duration-300 hover:-translate-y-1 hover:border-warm hover:shadow-lift'
          : 'shadow-card'}
        ${className}
      `}
    >
      {children}
    </div>
  )
}

/** Small uppercase label with the champagne rule, used above headings. */
export function Eyebrow({
  children,
  tone = 'ink',
  className = '',
}: {
  children: ReactNode
  tone?: 'ink' | 'light'
  className?: string
}) {
  return (
    <p
      className={`
        flex items-center gap-2.5 text-[11px] font-semibold uppercase tracking-[0.24em]
        ${tone === 'light' ? 'text-white/70' : 'text-[color:var(--brand-accent)]'}
        ${className}
      `}
    >
      <span
        className={`
          h-px w-7 ${tone === 'light' ? 'bg-white/45' : 'eyebrow-rule'}
        `}
        aria-hidden="true"
      />
      {children}
    </p>
  )
}

export function SectionHeading({
  eyebrow,
  title,
  subtitle,
  tone = 'ink',
  align = 'left',
  className = '',
}: {
  eyebrow?: string
  title: ReactNode
  subtitle?: ReactNode
  tone?: 'ink' | 'light'
  align?: 'left' | 'center'
  className?: string
}) {
  return (
    <div
      className={`
        ${align === 'center' ? 'mx-auto max-w-2xl text-center' : 'max-w-3xl'}
        ${className}
      `}
    >
      {eyebrow && (
        <Eyebrow
          tone={tone}
          className={align === 'center' ? 'justify-center' : ''}
        >
          {eyebrow}
        </Eyebrow>
      )}
      <h2
        className={`
          font-display text-[1.75rem] leading-[1.15] tracking-tight sm:text-4xl
          ${eyebrow ? 'mt-4' : ''}
          ${tone === 'light' ? 'text-white' : 'text-ink'}
        `}
      >
        {title}
      </h2>
      {subtitle && (
        <p
          className={`
            mt-3 text-[15px] leading-relaxed sm:text-base
            ${tone === 'light' ? 'text-white/75' : 'text-ink-3'}
            ${align === 'center' ? 'mx-auto' : ''}
          `}
        >
          {subtitle}
        </p>
      )}
    </div>
  )
}

/** Compact pill for metadata (duration, price, status). */
export function Pill({
  children,
  tone = 'neutral',
  className = '',
}: {
  children: ReactNode
  tone?: 'neutral' | 'brand' | 'ok' | 'warn' | 'bad'
  className?: string
}) {
  const tones: Record<string, string> = {
    neutral: 'bg-warm-subtle/70 text-ink-2 border-transparent',
    brand:
      'bg-[color:var(--brand-soft-strong)] text-[color:var(--brand-accent)] border-[color:var(--brand-line)]',
    ok: 'bg-ok-soft text-ok border-[#D3E3D7]',
    warn: 'bg-warn-soft text-warn border-[#E7DAB8]',
    bad: 'bg-bad-soft text-bad border-[#E8CBCB]',
  }
  return (
    <span
      className={`
        inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1
        text-[11px] font-semibold uppercase tracking-[0.08em]
        ${tones[tone]} ${className}
      `}
    >
      {children}
    </span>
  )
}

/* ================================================================== */
/*  Form controls                                                      */
/* ================================================================== */

export function Field({
  label,
  hint,
  error,
  required,
  className = '',
  ...rest
}: InputHTMLAttributes<HTMLInputElement> & {
  label: string
  hint?: string
  error?: string | null
}) {
  const id = useId()
  const describedBy = error ? `${id}-error` : hint ? `${id}-hint` : undefined

  return (
    <div className={className}>
      <label
        htmlFor={id}
        className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.16em] text-ink-3"
      >
        {label}
        {required && <span className="ml-0.5 text-bad">*</span>}
      </label>
      <input
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        className={`
          h-12 w-full rounded-xl border bg-surface px-4 text-[15px] text-ink
          transition-[border-color,box-shadow] duration-200
          placeholder:text-ink-3/70
          focus-ring focus:outline-none
          ${
            error
              ? 'border-[#DFB9B9] focus:border-bad'
              : 'border-line focus:border-[color:var(--brand-primary)]'
          }
        `}
        {...rest}
      />
      {error ? (
        <p id={`${id}-error`} className="mt-1.5 text-xs text-bad">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="mt-1.5 text-xs text-ink-3">
          {hint}
        </p>
      ) : null}
    </div>
  )
}

export function Textarea({
  label,
  error,
  className = '',
  ...rest
}: TextareaHTMLAttributes<HTMLTextAreaElement> & {
  label?: string
  error?: string | null
}) {
  const id = useId()
  return (
    <div className={className}>
      {label && (
        <label
          htmlFor={id}
          className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.16em] text-ink-3"
        >
          {label}
        </label>
      )}
      <textarea
        id={id}
        aria-invalid={error ? true : undefined}
        className={`
          w-full resize-none rounded-xl border bg-surface px-4 py-3 text-[15px] leading-relaxed
          text-ink transition-[border-color,box-shadow] duration-200
          placeholder:text-ink-3/70 focus-ring focus:border-[color:var(--brand-primary)] focus:outline-none
          ${error ? 'border-[#DFB9B9]' : 'border-line'}
        `}
        {...rest}
      />
      {error && <p className="mt-1.5 text-xs text-bad">{error}</p>}
    </div>
  )
}

/**
 * Selectable card used for every "pick one" surface in the booking flow
 * (branch, service, time slot, yes/no). Radiogroup semantics so screen
 * readers announce the selection rather than just the tap.
 */
export function Choice({
  selected,
  onSelect,
  title,
  subtitle,
  meta,
  icon,
  trailing,
  className = '',
}: {
  selected: boolean
  onSelect: () => void
  title: ReactNode
  subtitle?: ReactNode
  meta?: ReactNode
  icon?: ReactNode
  trailing?: ReactNode
  className?: string
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onSelect}
      className={`
        group relative flex w-full items-start gap-3.5 rounded-2xl border p-4 text-left
        transition-[transform,border-color,box-shadow,background-color] duration-200
        hover:-translate-y-px focus-ring
        ${
          selected
            ? 'border-[color:var(--brand-primary)] bg-surface shadow-[0_8px_24px_-18px_rgba(var(--brand-rgb),0.9)]'
            : 'border-line bg-surface hover:border-warm hover:shadow-card'
        }
        ${className}
      `}
    >
      {icon && (
        <span
          className="
            mt-0.5 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl
            bg-[color:var(--brand-primary)] text-[color:var(--brand-on-primary)]
            transition-colors
          "
        >
          {icon}
        </span>
      )}

      <span className="min-w-0 flex-1">
        <span
          className={`block font-medium leading-snug ${
            selected ? 'text-[color:var(--brand-accent)]' : 'text-ink'
          }`}
        >
          {title}
        </span>
        {subtitle && (
          <span className="mt-0.5 block text-[13px] leading-relaxed text-ink-3">
            {subtitle}
          </span>
        )}
        {meta && <span className="mt-2.5 flex flex-wrap items-center gap-1.5">{meta}</span>}
      </span>

      <span className="flex flex-shrink-0 items-center gap-2">
        {trailing}
        <span
          className={`
            flex h-5 w-5 items-center justify-center rounded-full border transition-all duration-200
            ${
              selected
                ? 'border-[color:var(--brand-primary)] bg-[color:var(--brand-primary)] text-[color:var(--brand-on-primary)]'
                : 'border-line text-transparent group-hover:border-warm'
            }
          `}
          aria-hidden="true"
        >
          <IconCheck className="h-3 w-3" strokeWidth={2.6} />
        </span>
      </span>
    </button>
  )
}

/* ================================================================== */
/*  Page-level states                                                  */
/* ================================================================== */

export function MessageScreen({
  tone = 'info',
  eyebrow,
  title,
  body,
  actions,
}: {
  tone?: 'info' | 'error' | 'success' | 'expired'
  eyebrow?: string
  title: string
  body?: ReactNode
  actions?: ReactNode
}) {
  const icons: Record<string, ReactNode> = {
    info: <IconInfo className="h-6 w-6" />,
    error: <IconAlert className="h-6 w-6" />,
    success: <IconCheckCircle className="h-6 w-6" />,
    expired: <IconClockRing />,
  }
  const rings: Record<string, string> = {
    info: 'bg-warm-subtle/80 text-ink-2',
    error: 'bg-bad-soft text-bad',
    success: 'bg-ok-soft text-ok',
    expired: 'bg-warn-soft text-warn',
  }

  return (
    <div
      className="mx-auto flex min-h-screen w-full max-w-md flex-col items-center justify-center px-6 py-16 text-center"
    >
      <div
        className={`
          mb-6 flex h-16 w-16 items-center justify-center rounded-2xl
          ring-1 ring-inset ring-black/[0.04] ${rings[tone]}
        `}
      >
        {icons[tone]}
      </div>
      {eyebrow && (
        <p className="mb-2.5 text-[11px] font-semibold uppercase tracking-[0.24em] text-ink-3">
          {eyebrow}
        </p>
      )}
      <h1 className="font-display text-3xl leading-tight tracking-tight text-ink">
        {title}
      </h1>
      {body && (
        <p className="mt-3 max-w-sm text-[15px] leading-relaxed text-ink-2">{body}</p>
      )}
      {actions && <div className="mt-8 flex flex-col gap-2.5 sm:flex-row">{actions}</div>}
    </div>
  )
}

function IconClockRing() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} className="h-6 w-6" aria-hidden="true">
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5V12l3 2" strokeLinecap="round" />
    </svg>
  )
}

/** Shimmering placeholder for list content. */
export function Skeleton({ className = '' }: { className?: string }) {
  return (
    <div
      className={`animate-shimmer rounded-xl bg-warm-subtle ${className}`}
      aria-hidden="true"
    />
  )
}

/* ================================================================== */
/*  Detail presentation                                                */
/* ================================================================== */

/** Icon + label + value row used in booking summaries and receipts. */
export function DetailRow({
  icon,
  label,
  value,
  className = '',
}: {
  icon?: ReactNode
  label: string
  value: ReactNode
  className?: string
}) {
  return (
    <div className={`flex items-start gap-3.5 ${className}`}>
      {icon && (
        <span className="mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-[color:var(--brand-primary)] text-[color:var(--brand-on-primary)]">
          {icon}
        </span>
      )}
      <div className="min-w-0">
        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[color:var(--brand-accent)]">
          {label}
        </p>
        <p className="mt-0.5 text-sm leading-snug text-ink">{value}</p>
      </div>
    </div>
  )
}

/* ================================================================== */
/*  Rating                                                             */
/* ================================================================== */

/**
 * Star rating input. Falls back to a numbered scale when the business
 * configured something other than a 1–5 range — the label is always
 * shown so the mapping stays unambiguous.
 */
export function RatingInput({
  min,
  max,
  value,
  onChange,
}: {
  min: number
  max: number
  value: number | undefined
  onChange: (v: number) => void
}) {
  const options: number[] = []
  for (let i = min; i <= max; i++) options.push(i)
  const useStars = min === 1 && max === 5

  return (
    <div>
      <div
        className="flex flex-wrap items-center gap-1.5"
        role="radiogroup"
        aria-label="Rating"
      >
        {options.map(n => {
          const active = value === n
          return useStars ? (
            <button
              key={n}
              type="button"
              role="radio"
              aria-checked={active}
              aria-label={`${n} of ${max}`}
              onClick={() => onChange(n)}
              className={`
                flex h-11 w-11 items-center justify-center rounded-xl border transition-all duration-200
                focus-ring hover:-translate-y-px
                ${
                  active
                    ? 'border-[color:var(--brand-primary)] bg-[color:var(--brand-primary)] text-[color:var(--brand-on-primary)] shadow-[0_8px_20px_-14px_rgba(var(--brand-rgb),0.9)]'
                    : 'border-line bg-surface text-line hover:border-[color:var(--brand-line)] hover:text-[color:var(--brand-accent)]'
                }
              `}
            >
              <IconStar filled={active || n <= (value ?? 0)} className="h-5 w-5" />
            </button>
          ) : (
            <button
              key={n}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => onChange(n)}
              className={`
                h-11 w-11 rounded-xl border text-sm font-semibold transition-all duration-200
                tabular-nums focus-ring hover:-translate-y-px
                ${
                  active
                    ? 'border-[color:var(--brand-primary)] bg-[color:var(--brand-primary)] text-[color:var(--brand-on-primary)]'
                    : 'border-line bg-surface text-ink-2 hover:border-warm'
                }
              `}
            >
              {n}
            </button>
          )
        })}
      </div>
      {value !== undefined && (
        <p className="mt-2 text-xs text-ink-3">
          {useStars
            ? ['', 'Not for me', 'Could be better', 'Good', 'Lovely', 'Perfect'][value] ?? ''
            : `Selected ${value}`}
        </p>
      )}
    </div>
  )
}

/* ================================================================== */
/*  Modal                                                              */
/* ================================================================== */

/**
 * Lightweight dialog. Traps nothing fancy — it closes on Escape, on
 * backdrop click, and locks body scroll while open, which is all the
 * confirmation/feedback flows need.
 */
export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = 'md',
  centered = false,
  bodyClassName = '',
}: {
  open: boolean
  onClose: () => void
  title: string
  description?: string
  children?: ReactNode
  footer?: ReactNode
  /** `md` is the form-sized default; `lg` is for image galleries. */
  size?: 'md' | 'lg'
  /**
   * Opt out of the mobile bottom sheet and sit centred at every breakpoint.
   * Forms keep the sheet (thumb-reachable); galleries don't.
   */
  centered?: boolean
  /** Escape hatch for galleries that need to bleed to the modal edges. */
  bodyClassName?: string
}) {
  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [open, onClose])

  if (!open) return null

  /* Portalled to <body> on purpose. Rendered in place, the dialog would be a
     descendant of whatever section opened it, and any ancestor with a
     transform/filter/contain — or an `overflow-hidden` — becomes the
     containing block for `position: fixed`, clipping the overlay to that
     section instead of the viewport. Escaping to <body> makes the dialog
     immune to the page it was opened from. */
  return createPortal(
    /* The overlay scrolls, and the inner track is `min-h-full` so a short
       dialog centres while a tall one grows the scroll area instead of
       being clipped by flex centring. `dvh` (not `vh`) so mobile browser
       chrome can't push the dialog off-screen. */
    <div className="fixed inset-0 z-50 overflow-y-auto overscroll-contain">
      <div
        className={`flex min-h-full justify-center ${
          centered ? 'items-center p-4 sm:p-6' : 'items-end sm:items-center'
        }`}
      >
        {/* `fixed`, not `absolute` — an absolute backdrop would only cover the
            visible slice once the overlay scrolls. */}
        <div
          className="animate-fade-in fixed inset-0 bg-ink/35 backdrop-blur-[3px]"
          onClick={onClose}
          aria-hidden="true"
        />
        <div
          role="dialog"
          aria-modal="true"
          aria-label={title}
          className={`animate-sheet-in relative flex max-h-[calc(100dvh-2rem)] w-full flex-col rounded-t-3xl border border-line bg-surface p-6 shadow-float sm:rounded-3xl ${
            size === 'lg' ? 'max-w-5xl' : 'max-w-md'
          }`}
        >
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="focus-ring absolute right-4 top-4 z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-ink-3 transition-colors hover:bg-warm-subtle hover:text-ink"
          >
            <IconX className="h-4 w-4" />
          </button>

          <h2 className="shrink-0 pr-8 font-display text-2xl leading-snug">
            {title}
          </h2>
          {description && (
            <p className="mt-2 shrink-0 text-sm leading-relaxed text-ink-3">
              {description}
            </p>
          )}
          {/* min-h-0 is what actually lets this shrink inside the flex column
              instead of forcing the dialog past its height cap. */}
          {children && (
            <div
              className={`mt-5 min-h-0 flex-1 overflow-y-auto overscroll-contain ${bodyClassName}`}
            >
              {children}
            </div>
          )}
          {footer && (
            <div className="mt-6 flex shrink-0 flex-col gap-2.5 sm:flex-row-reverse">
              {footer}
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body,
  )
}

/* ================================================================== */
/*  Misc                                                               */
/* ================================================================== */

/** Salon logo with a monogram fallback, so nothing ever renders broken. */
export function Logo({
  url,
  name,
  size = 'md',
  className = '',
}: {
  url?: string | null
  name: string
  size?: 'sm' | 'md' | 'lg'
  className?: string
}) {
  const box =
    size === 'lg' ? 'h-14 w-14 rounded-2xl text-lg' : size === 'sm' ? 'h-8 w-8 rounded-lg text-xs' : 'h-10 w-10 rounded-xl text-sm'

  if (url) {
    return (
      <img
        src={url}
        alt={`${name} logo`}
        className={`${box} flex-shrink-0 object-cover ring-1 ring-black/[0.06] ${className}`}
        loading="eager"
        decoding="async"
      />
    )
  }

  return (
    <span
      className={`${box} flex flex-shrink-0 items-center justify-center bg-[color:var(--brand-primary)] font-semibold text-[color:var(--brand-on-primary)] ${className}`}
      aria-hidden="true"
    >
      {name.trim().charAt(0).toUpperCase() || 'Z'}
    </span>
  )
}

/** Faithful / attribution mark for the footers. */
export function PoweredBy() {
  return (
    <p className="text-center text-[11px] tracking-wide text-ink-3">
      Booking by{' '}
      <a
        href="https://zsalon.com"
        target="_blank"
        rel="noreferrer"
        className="focus-ring rounded font-medium text-ink-2 underline decoration-line underline-offset-4 transition-colors hover:text-ink"
      >
        <span className="text-gold">ዘ</span>Z-Salon
      </a>
    </p>
  )
}
