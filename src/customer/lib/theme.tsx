/** Pick a readable text color for the given background hex. */
export function pickTextColor(hex: string | null | undefined): string {
  const fallback = '#FFFFFF'
  if (!hex) return fallback
  const m = hex.replace('#', '')
  const normalized =
    m.length === 3
      ? m.split('').map(c => c + c).join('')
      : m.length === 6
        ? m
        : null
  if (!normalized) return fallback

  const r = parseInt(normalized.slice(0, 2), 16)
  const g = parseInt(normalized.slice(2, 4), 16)
  const b = parseInt(normalized.slice(4, 6), 16)
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255
  return luminance > 0.55 ? '#1C1C1C' : '#FFFFFF'
}

/** Normalize any user-supplied color to `#RRGGBB`, or return null. */
export function normalizeHex(input: string | null | undefined): string | null {
  if (!input) return null
  const raw = input.trim().replace(/^#/, '')
  if (/^[0-9a-fA-F]{3}$/.test(raw)) {
    return '#' + raw.split('').map(c => c + c).join('').toUpperCase()
  }
  if (/^[0-9a-fA-F]{6}$/.test(raw)) {
    return '#' + raw.toUpperCase()
  }
  return null
}