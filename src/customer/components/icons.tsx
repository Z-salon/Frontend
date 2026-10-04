/**
 * Inline icon set for the customer app.
 *
 * Hand-rolled rather than pulled from an icon package: the project has
 * zero runtime deps beyond React, and a curated set keeps the customer
 * bundle tiny. All icons share a 24×24 box and a 1.6 stroke so they sit
 * together without optical weight mismatch.
 */

interface IconProps {
  className?: string
  strokeWidth?: number
}

function Svg({
  className = 'h-5 w-5',
  strokeWidth = 1.6,
  children,
}: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      {children}
    </svg>
  )
}

export function IconPin({ className, strokeWidth }: IconProps) {
  return (
    <Svg className={className} strokeWidth={strokeWidth}>
      <path d="M12 21.5s7-5.9 7-11.5a7 7 0 1 0-14 0c0 5.6 7 11.5 7 11.5Z" />
      <circle cx="12" cy="10" r="2.5" />
    </Svg>
  )
}

export function IconPhone({ className, strokeWidth }: IconProps) {
  return (
    <Svg className={className} strokeWidth={strokeWidth}>
      <path d="M6.5 3.5h3l1.5 4-2 1.5a12 12 0 0 0 6 6l1.5-2 4 1.5v3a2 2 0 0 1-2.2 2A17 17 0 0 1 4.5 5.7 2 2 0 0 1 6.5 3.5Z" />
    </Svg>
  )
}

export function IconMail({ className, strokeWidth }: IconProps) {
  return (
    <Svg className={className} strokeWidth={strokeWidth}>
      <rect x="3" y="5.5" width="18" height="13" rx="2.5" />
      <path d="m4 8 7.1 4.8a1.4 1.4 0 0 0 1.7 0L20 8" />
    </Svg>
  )
}

export function IconClock({ className, strokeWidth }: IconProps) {
  return (
    <Svg className={className} strokeWidth={strokeWidth}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5V12l3 2" />
    </Svg>
  )
}

export function IconArrowRight({ className, strokeWidth = 1.8 }: IconProps) {
  return (
    <Svg className={className} strokeWidth={strokeWidth}>
      <path d="M4.5 12h15m0 0-5.5-5.5M19.5 12 14 17.5" />
    </Svg>
  )
}

export function IconArrowUpRight({ className, strokeWidth = 1.8 }: IconProps) {
  return (
    <Svg className={className} strokeWidth={strokeWidth}>
      <path d="M7.5 16.5 16.5 7.5" />
      <path d="M9.5 7.5h7v7" />
    </Svg>
  )
}

export function IconArrowLeft({ className, strokeWidth = 1.8 }: IconProps) {
  return (
    <Svg className={className} strokeWidth={strokeWidth}>
      <path d="M19.5 12h-15m0 0L10 6.5M4.5 12 10 17.5" />
    </Svg>
  )
}

export function IconChevronLeft({ className, strokeWidth = 1.8 }: IconProps) {
  return (
    <Svg className={className} strokeWidth={strokeWidth}>
      <path d="m14.5 5.5-6 6.5 6 6.5" />
    </Svg>
  )
}

export function IconChevronRight({ className, strokeWidth = 1.8 }: IconProps) {
  return (
    <Svg className={className} strokeWidth={strokeWidth}>
      <path d="m9.5 5.5 6 6.5-6 6.5" />
    </Svg>
  )
}

export function IconChevronDown({ className, strokeWidth = 1.8 }: IconProps) {
  return (
    <Svg className={className} strokeWidth={strokeWidth}>
      <path d="m5.5 9.5 6.5 6 6.5-6" />
    </Svg>
  )
}

export function IconCheck({ className, strokeWidth = 2 }: IconProps) {
  return (
    <Svg className={className} strokeWidth={strokeWidth}>
      <path d="m5 12.5 4.5 4.5L19 7" />
    </Svg>
  )
}

export function IconCheckCircle({ className, strokeWidth = 1.6 }: IconProps) {
  return (
    <Svg className={className} strokeWidth={strokeWidth}>
      <circle cx="12" cy="12" r="8.75" />
      <path d="m8.25 12.25 2.5 2.5 5-5.5" />
    </Svg>
  )
}

export function IconX({ className, strokeWidth = 1.8 }: IconProps) {
  return (
    <Svg className={className} strokeWidth={strokeWidth}>
      <path d="M6.5 6.5l11 11m0-11-11 11" />
    </Svg>
  )
}

export function IconStar({
  className,
  strokeWidth = 1.5,
  filled = false,
}: IconProps & { filled?: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill={filled ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      <path d="m12 3.6 2.6 5.28 5.83.85-4.21 4.1.99 5.79L12 16.88l-5.21 2.74.99-5.79-4.21-4.1 5.83-.85L12 3.6Z" />
    </svg>
  )
}

export function IconScissors({ className, strokeWidth }: IconProps) {
  return (
    <Svg className={className} strokeWidth={strokeWidth}>
      <circle cx="6.5" cy="6.5" r="2.5" />
      <circle cx="6.5" cy="17.5" r="2.5" />
      <path d="M8.6 8.1 20 18.5M8.6 15.9 20 5.5M11.5 10 8.6 12.4" />
    </Svg>
  )
}

export function IconSparkle({ className, strokeWidth }: IconProps) {
  return (
    <Svg className={className} strokeWidth={strokeWidth}>
      <path d="M12 3.5c.6 3.4 2.6 5.4 6 6-3.4.6-5.4 2.6-6 6-.6-3.4-2.6-5.4-6-6 3.4-.6 5.4-2.6 6-6Z" />
      <path d="M18.5 16c.3 1.7 1.3 2.7 3 3-1.7.3-2.7 1.3-3 3-.3-1.7-1.3-2.7-3-3 1.7-.3 2.7-1.3 3-3Z" />
    </Svg>
  )
}

export function IconCalendar({ className, strokeWidth }: IconProps) {
  return (
    <Svg className={className} strokeWidth={strokeWidth}>
      <rect x="3.5" y="5" width="17" height="15.5" rx="2.5" />
      <path d="M3.5 9.75h17M8.25 3.5v3M15.75 3.5v3" />
    </Svg>
  )
}

export function IconUser({ className, strokeWidth }: IconProps) {
  return (
    <Svg className={className} strokeWidth={strokeWidth}>
      <circle cx="12" cy="8.5" r="3.75" />
      <path d="M4.75 20.25a7.25 7.25 0 0 1 14.5 0" />
    </Svg>
  )
}

export function IconInfo({ className, strokeWidth }: IconProps) {
  return (
    <Svg className={className} strokeWidth={strokeWidth}>
      <circle cx="12" cy="12" r="8.75" />
      <path d="M12 11v5.25M12 7.9v.1" />
    </Svg>
  )
}

export function IconAlert({ className, strokeWidth }: IconProps) {
  return (
    <Svg className={className} strokeWidth={strokeWidth}>
      <path d="M10.6 4.2 2.9 17.6a1.6 1.6 0 0 0 1.4 2.4h15.4a1.6 1.6 0 0 0 1.4-2.4L13.4 4.2a1.6 1.6 0 0 0-2.8 0Z" />
      <path d="M12 9.5v4.25M12 16.6v.1" />
    </Svg>
  )
}

export function IconMessage({ className, strokeWidth }: IconProps) {
  return (
    <Svg className={className} strokeWidth={strokeWidth}>
      <path d="M20.5 11.75c0 4-3.8 7.25-8.5 7.25a9.9 9.9 0 0 1-2.6-.34L4.5 20.5l1.2-3.2A6.9 6.9 0 0 1 3.5 11.75c0-4 3.8-7.25 8.5-7.25s8.5 3.25 8.5 7.25Z" />
    </Svg>
  )
}

export function IconHeart({
  className,
  strokeWidth,
  filled = false,
}: IconProps & { filled?: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill={filled ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      <path d="M12 20.25S3.75 15.5 3.75 9.75a4.5 4.5 0 0 1 8.25-2.4 4.5 4.5 0 0 1 8.25 2.4c0 5.75-8.25 10.5-8.25 10.5Z" />
    </svg>
  )
}

export function IconCamera({ className, strokeWidth }: IconProps) {
  return (
    <Svg className={className} strokeWidth={strokeWidth}>
      <path d="M3.5 8.75a2 2 0 0 1 2-2h1.9l1.2-2.25h6.8l1.2 2.25h1.9a2 2 0 0 1 2 2v8.5a2 2 0 0 1-2 2h-15a2 2 0 0 1-2-2v-8.5Z" />
      <circle cx="12" cy="13" r="3.25" />
    </Svg>
  )
}

export function IconImage({ className, strokeWidth }: IconProps) {
  return (
    <Svg className={className} strokeWidth={strokeWidth}>
      <rect x="3.5" y="4.75" width="17" height="14.5" rx="2.5" />
      <circle cx="8.75" cy="9.75" r="1.5" />
      <path d="m4.5 16.75 4.4-4.15a1.8 1.8 0 0 1 2.45 0l3.4 3.2m0 0 1.7-1.6a1.8 1.8 0 0 1 2.45 0l1.1 1.05" />
    </Svg>
  )
}

export function IconShield({ className, strokeWidth }: IconProps) {
  return (
    <Svg className={className} strokeWidth={strokeWidth}>
      <path d="M12 3.25 19 6v6c0 4.1-2.9 7.4-7 8.75C7.9 19.4 5 16.1 5 12V6l7-2.75Z" />
      <path d="m9.25 12.25 2 2 3.5-4" />
    </Svg>
  )
}

export function IconMenu({ className, strokeWidth = 1.8 }: IconProps) {
  return (
    <Svg className={className} strokeWidth={strokeWidth}>
      <path d="M4 7.5h16M4 12h16M4 16.5h11" />
    </Svg>
  )
}

export function IconSpinner({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={`${className} animate-spin`} aria-hidden="true">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.25" strokeWidth="2.5" />
      <path
        d="M21 12a9 9 0 0 0-9-9"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
    </svg>
  )
}

/* ------------------------------------------------------------------ *
 * Social marks
 *
 * Drawn as strokes rather than filled brand glyphs so they match the
 * rest of the set optically. Each keeps the 24x24 box and a 1.6 stroke.
 * The visible link always carries an aria-label, so these stay hidden.
 * ------------------------------------------------------------------ */

export function IconInstagram({ className, strokeWidth }: IconProps) {
  return (
    <Svg className={className} strokeWidth={strokeWidth}>
      <rect x="3.5" y="3.5" width="17" height="17" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <path d="M17.4 6.6h.01" strokeWidth={2.2} />
    </Svg>
  )
}

export function IconFacebook({ className, strokeWidth }: IconProps) {
  return (
    <Svg className={className} strokeWidth={strokeWidth}>
      <path d="M13.6 21v-7.7h2.6l.6-3h-3.2V8.5c0-.9.3-1.6 1.7-1.6h1.6V4.3a21 21 0 0 0-2.3-.1c-2.4 0-4 1.5-4 4.2v2H7.4v3h2.8V21" />
    </Svg>
  )
}

export function IconTelegram({ className, strokeWidth }: IconProps) {
  return (
    <Svg className={className} strokeWidth={strokeWidth}>
      <path d="M3.2 11.4 20.8 4a.6.6 0 0 1 .8.7l-2.6 14.8a.6.6 0 0 1-1 .4l-3.6-2.6-1.8 1.7a.5.5 0 0 1-.8-.1l-.2-3.1 5.6-5.1" />
      <path d="m12 15.6 8.6-8.4-10 6.4" />
    </Svg>
  )
}

export function IconTiktok({ className, strokeWidth }: IconProps) {
  return (
    <Svg className={className} strokeWidth={strokeWidth}>
      <path d="M14.2 3.5v9.9a3.7 3.7 0 1 1-3.7-3.7" />
      <path d="M14.2 3.5a5 5 0 0 0 4.8 4.9" />
    </Svg>
  )
}

export function IconGlobe({ className, strokeWidth }: IconProps) {
  return (
    <Svg className={className} strokeWidth={strokeWidth}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M3.5 12h17" />
      <path d="M12 3.5c2.2 2.4 3.4 5.4 3.4 8.5S14.2 18.1 12 20.5c-2.2-2.4-3.4-5.4-3.4-8.5S9.8 5.9 12 3.5Z" />
    </Svg>
  )
}

export function IconCopy({ className, strokeWidth }: IconProps) {
  return (
    <Svg className={className} strokeWidth={strokeWidth}>
      <rect x="8.5" y="8.5" width="11.5" height="11.5" rx="2" />
      <path d="M15.5 8.5V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v7.5a2 2 0 0 0 2 2h2.5" />
    </Svg>
  )
}