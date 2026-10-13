/**
 * Presentation-only formatters shared by every customer screen.
 *
 * The booking flow, the confirmation link, and the feedback form all
 * need to render the same price / duration / wall-clock time strings.
 * They live here so a salon never sees two different renderings of the
 * same appointment.
 */

const FALLBACK_CURRENCY = 'ETB'

/* ------------------------------------------------------------------ */
/*  Money & duration                                                   */
/* ------------------------------------------------------------------ */

/**
 * Prices arrive from the API as decimal *strings* (Decimal(12,2)), so
 * they go through `Number` before formatting. An unrecognised currency
 * code from the backend must not take the page down, hence the guard.
 */
export function formatPrice(
  value: string | number | null | undefined,
  currency: string | null | undefined,
): string {
  const n = typeof value === 'number' ? value : Number(value)
  if (value === null || value === undefined || !Number.isFinite(n)) return ''

  const code =
    currency && /^[A-Za-z]{3}$/.test(currency.trim())
      ? currency.trim().toUpperCase()
      : FALLBACK_CURRENCY

  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: code,
      maximumFractionDigits: 2,
    }).format(n)
  } catch {
    return `${code} ${n.toLocaleString(undefined, { maximumFractionDigits: 2 })}`
  }
}

export function formatDuration(minutes: number | null | undefined): string {
  if (!minutes || minutes < 1) return ''
  if (minutes < 60) return `${minutes} min`
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return m === 0 ? `${h} hr` : `${h} hr ${m} min`
}

/* ------------------------------------------------------------------ */
/*  Dates & times                                                      */
/* ------------------------------------------------------------------ */

/**
 * Read the wall-clock time straight out of an ISO string.
 *
 * `startTime` comes back with the *branch's* offset, e.g.
 * `"2026-09-24T09:00:00.000+03:00"`. Running it through `new Date()`
 * would re-express it in the customer's device timezone, which is not
 * what the salon wrote on the board — so we parse the literal
 * `HH:mm` and render it as-is.
 */
export function formatIsoTime(iso: string): string {
  const m = iso.match(/T(\d{2}):(\d{2})/)
  if (m) return formatClock(Number(m[1]), m[2])
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return formatClock(d.getHours(), String(d.getMinutes()).padStart(2, '0'))
}

function formatClock(h24: number, mm: string): string {
  const suffix = h24 >= 12 ? 'PM' : 'AM'
  const h = h24 % 12 === 0 ? 12 : h24 % 12
  return `${h}:${mm} ${suffix}`
}

function formatTime(date: Date): string {
  return formatClock(
    date.getHours(),
    String(date.getMinutes()).padStart(2, '0'),
  )
}

export function formatTimeRange(start: Date, end: Date): string {
  return `${formatTime(start)} – ${formatTime(end)}`
}

/** `"2026-09-24"` → `"Wed, Sep 24"`. Parsed as local to avoid TZ drift. */
export function formatDateShort(isoDate: string): string {
  const d = parseIsoDate(isoDate)
  if (!d) return isoDate
  return d.toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  })
}

/** `"2026-09-24"` or a `Date` → `"Thursday, September 24"`. */
export function formatDateLong(value: string | Date): string {
  const d = typeof value === 'string' ? parseIsoDate(value) : value
  if (!d) return String(value)
  return d.toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  })
}

/**
 * Parse a bare `YYYY-MM-DD` as a *local* date. `new Date('2026-09-24')`
 * is spec'd as UTC midnight, which renders as the 23rd for anyone west
 * of Greenwich — a bug the calendar would inherit.
 */
function parseIsoDate(isoDate: string): Date | null {
  const m = isoDate.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!m) return null
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
}

export function toIsoDate(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/** `"Africa/Addis_Ababa"` → `"Addis Ababa"`. */
export function formatTimezone(tz: string | null | undefined): string {
  if (!tz) return ''
  return tz.split('/').pop()!.replace(/_/g, ' ')
}

export type DayPart = 'morning' | 'afternoon' | 'evening'

export const DAY_PARTS: Array<{ key: DayPart; label: string; range: string }> = [
  { key: 'morning', label: 'Morning', range: 'Before 12' },
  { key: 'afternoon', label: 'Afternoon', range: '12 – 5' },
  { key: 'evening', label: 'Evening', range: 'From 5' },
]

/** Bucket a slot by its wall-clock hour, ignoring the device timezone. */
export function dayPartOf(iso: string): DayPart {
  const m = iso.match(/T(\d{2}):/)
  const h = m ? Number(m[1]) : new Date(iso).getHours()
  if (h < 12) return 'morning'
  if (h < 17) return 'afternoon'
  return 'evening'
}

/* ------------------------------------------------------------------ */
/*  Errors                                                             */
/* ------------------------------------------------------------------ */

/**
 * Normalise anything thrown by the API layer into a sentence we can
 * show a customer. `ApiError` already flattens the backend's several
 * error envelope shapes, so this is mostly a safety net for unexpected
 * throwables.
 */
export function extractErrorMessage(err: unknown, fallback: string): string {
  const anyErr = err as any
  const data = anyErr?.response?.data ?? anyErr?.data ?? anyErr
  if (typeof data?.message === 'string' && data.message) return data.message
  if (Array.isArray(data?.errors) && data.errors.length > 0) return String(data.errors[0])
  if (Array.isArray(data?.details) && data.details.length > 0) {
    const d = data.details[0]
    return d?.message ? `${d.field}: ${d.message}` : String(d)
  }
  if (typeof anyErr?.message === 'string' && anyErr.message) return anyErr.message
  return fallback
}
