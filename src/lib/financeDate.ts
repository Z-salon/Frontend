/* ------------------------------------------------------------------ */
/*  Finance date ranges                                                */
/*                                                                     */
/*  Finance report day boundaries must follow the BUSINESS timezone,    */
/*  not the browser's. The backend accepts a date-only `YYYY-MM-DD`    */
/*  for `from`/`to` and expands it to the whole day in that zone, so   */
/*  we only need "what is today in the business timezone" — computed   */
/*  with `Intl.DateTimeFormat`, the same approach the booking screens  */
/*  already use. No browser-local day math.                            */
/* ------------------------------------------------------------------ */

export type FinanceDatePreset = 'today' | 'week' | 'month' | 'all'

export interface FinanceDateRange {
  from?: string
  to?: string
}

/** A `Date` → `YYYY-MM-DD` as seen in `timeZone` (falls back to local). */
function dateInZone(date: Date, timeZone?: string): string {
  if (timeZone) {
    try {
      return new Intl.DateTimeFormat('en-CA', {
        timeZone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).format(date)
    } catch {
      /* Unknown IANA zone — fall through to the local fallback. */
    }
  }
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000)
  return local.toISOString().slice(0, 10)
}

/** Today's calendar date in the business timezone (`YYYY-MM-DD`). */
export function businessToday(timeZone?: string): string {
  return dateInZone(new Date(), timeZone)
}

/** Add whole days to a `YYYY-MM-DD` string (pure calendar math, no zone). */
function addDays(isoDate: string, days: number): string {
  const [y, m, d] = isoDate.split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d))
  dt.setUTCDate(dt.getUTCDate() + days)
  return dt.toISOString().slice(0, 10)
}

/** Monday (week start) of the week containing `isoDate`. */
function startOfWeek(isoDate: string): string {
  const [y, m, d] = isoDate.split('-').map(Number)
  const weekday = new Date(Date.UTC(y, m - 1, d)).getUTCDay() // 0 = Sunday
  const mondayOffset = (weekday + 6) % 7
  return addDays(isoDate, -mondayOffset)
}

/**
 * Resolve the global date control into the `from`/`to` sent to the API.
 * `all` returns an empty range so neither parameter is sent.
 */
export function resolveFinanceRange(
  preset: FinanceDatePreset,
  timeZone?: string,
): FinanceDateRange {
  if (preset === 'all') return {}

  const today = businessToday(timeZone)

  if (preset === 'today') return { from: today, to: today }

  if (preset === 'week') {
    const from = startOfWeek(today)
    return { from, to: addDays(from, 6) }
  }

  /* month — first through last day of the current month */
  const [y, m] = today.split('-').map(Number)
  const from = `${y}-${String(m).padStart(2, '0')}-01`
  const last = new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10)
  return { from, to: last }
}

/** Rolling window ending today (`7d` / `30d` controls). Date-only. */
export function lastNDaysRange(days: number, timeZone?: string): FinanceDateRange {
  const to = businessToday(timeZone)
  return { from: addDays(to, -(days - 1)), to }
}

/** Chart axis label for a backend `YYYY-MM-DD` (UTC-parsed to avoid drift). */
export function financeDateLabel(isoDate: string, withWeekday: boolean): string {
  const [y, m, d] = isoDate.split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d))
  return withWeekday
    ? dt.toLocaleDateString('en-US', { weekday: 'short', timeZone: 'UTC' })
    : String(d)
}