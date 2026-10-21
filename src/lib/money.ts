/* ------------------------------------------------------------------ */
/*  Money helpers                                                      */
/*                                                                     */
/*  Backend monetary values are decimal strings ("500.00"). Converting  */
/*  them to JS floats for arithmetic can drift, so anything that has to */
/*  compare or subtract amounts runs through integer cents. Only the    */
/*  final display divides by 100.                                      */
/* ------------------------------------------------------------------ */

/** Parse a decimal string/number into integer cents. "1,234.50" → 123450. */
export function toCents(value: string | number | null | undefined): number {
  if (value == null) return 0
  const raw = String(value).trim()
  if (!raw) return 0

  const negative = raw.startsWith('-')
  const body = negative ? raw.slice(1) : raw

  const [intPart = '0', fracPart = ''] = body.split('.')
  const whole = Number(intPart.replace(/[^0-9]/g, '') || '0')
  const frac = Number((fracPart.replace(/[^0-9]/g, '') + '00').slice(0, 2))

  const cents = whole * 100 + frac
  return negative ? -cents : cents
}

/** Integer cents → plain decimal string with two places ("6000.00"). */
export function centsToInput(cents: number): string {
  const negative = cents < 0
  const abs = Math.abs(Math.round(cents))
  const whole = Math.floor(abs / 100)
  const frac = abs % 100
  return `${negative ? '-' : ''}${whole}.${String(frac).padStart(2, '0')}`
}

/** Integer cents → grouped display string ("6,000.00"). */
export function formatCents(cents: number): string {
  const negative = cents < 0
  const abs = Math.abs(Math.round(cents))
  const whole = Math.floor(abs / 100)
  const frac = abs % 100
  return `${negative ? '-' : ''}${whole.toLocaleString('en')}.${String(frac).padStart(2, '0')}`
}

/** Decimal string/number → grouped display string ("500.00"). */
export function formatMoney(value: string | number | null | undefined): string {
  return formatCents(toCents(value))
}

/**
 * Decimal string/number → grouped display without forced 2-decimal padding
 * ("4,000", "4,000.50"). Use for report KPIs where "4,000 ETB" reads better
 * than "4,000.00 ETB"; the value itself is never altered.
 */
export function formatMoneyCompact(
  value: string | number | null | undefined,
): string {
  const amount = toCents(value) / 100
  return amount.toLocaleString('en', { maximumFractionDigits: 2 })
}