import type { CSSProperties } from 'react'
import type { BrandingPayload } from '../../types/api'

const DEFAULT_PRIMARY = '#1C1C1C'
const DEFAULT_SECONDARY = '#C4A97D'

/** Pick a readable text color for a given background. */
export function pickTextColor(bgHex: string | null | undefined): string {
  const hex = (bgHex ?? DEFAULT_PRIMARY).replace('#', '')
  if (hex.length !== 6) return '#FFFFFF'

  const r = parseInt(hex.slice(0, 2), 16)
  const g = parseInt(hex.slice(2, 4), 16)
  const b = parseInt(hex.slice(4, 6), 16)
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255

  return luminance > 0.55 ? '#1C1C1C' : '#FFFFFF'
}

/** Build the CSS-variable style object for the customer root. */
export function themeStyle(branding: BrandingPayload | null): CSSProperties {
  const primary = branding?.primaryColor ?? DEFAULT_PRIMARY
  const secondary = branding?.secondaryColor ?? DEFAULT_SECONDARY

  return {
    // @ts-expect-error CSS custom properties
    '--brand-primary': primary,
    '--brand-secondary': secondary,
    '--brand-on-primary': pickTextColor(primary),
    '--brand-on-secondary': pickTextColor(secondary),
  }
}