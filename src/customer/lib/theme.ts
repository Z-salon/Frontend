import type { CSSProperties } from 'react'
import type { BrandingPayload } from '../../types/api'

/**
 * Customer-side theming.
 *
 * Every salon picks its own `primaryColor` / `secondaryColor` in the
 * admin app, so nothing on the public pages can hardcode a brand colour.
 * Instead each screen mounts a `BrandTheme` root, which emits a full set
 * of derived CSS custom properties; components then reference them
 * through Tailwind arbitrary values (`text-[color:var(--brand-accent)]`).
 *
 * Derivation happens in JS rather than with `color-mix` alone so the
 * output is deterministic and testable, and so the "readable ink" ramp
 * holds up for pale brand colours.
 */

/* ------------------------------------------------------------------ */
/*  Colour primitives                                                   */
/* ------------------------------------------------------------------ */

const PAPER = '#F6F4F0'
const DEFAULT_PRIMARY = '#1C1C1C'
const DEFAULT_SECONDARY = '#C4A97D'

interface Rgb {
  r: number
  g: number
  b: number
}

/** Parse `#abc` / `#aabbcc` (with or without `#`) into 8-bit channels. */
function parseHex(input: string | null | undefined): Rgb | null {
  if (!input) return null
  const raw = input.trim().replace(/^#/, '')
  const full =
    raw.length === 3
      ? raw
          .split('')
          .map(c => c + c)
          .join('')
      : raw
  if (!/^[0-9a-fA-F]{6}$/.test(full)) return null
  return {
    r: parseInt(full.slice(0, 2), 16),
    g: parseInt(full.slice(2, 4), 16),
    b: parseInt(full.slice(4, 6), 16),
  }
}

/** Normalize any user-entered colour to `#RRGGBB`, or `null` if invalid. */
function normalizeHex(input: string | null | undefined): string | null {
  const rgb = parseHex(input)
  if (!rgb) return null
  return toHex(rgb)
}

function toHex({ r, g, b }: Rgb): string {
  const part = (n: number) =>
    Math.max(0, Math.min(255, Math.round(n)))
      .toString(16)
      .padStart(2, '0')
      .toUpperCase()
  return `#${part(r)}${part(g)}${part(b)}`
}

/** Blend two colours. `amount` is how much of `to` ends up in the result. */
function mix(from: string | null | undefined, to: string, amount: number): string {
  const a = parseHex(from) ?? parseHex(DEFAULT_PRIMARY)!
  const b = parseHex(to)!
  const t = Math.max(0, Math.min(1, amount))
  return toHex({
    r: a.r + (b.r - a.r) * t,
    g: a.g + (b.g - a.g) * t,
    b: a.b + (b.b - a.b) * t,
  })
}

/** Same colour at a fractional alpha — for borders, washes and rings. */
export function withAlpha(
  color: string | null | undefined,
  alpha: number,
): string {
  const rgb = parseHex(color) ?? parseHex(DEFAULT_PRIMARY)!
  return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${Math.max(0, Math.min(1, alpha))})`
}

/** WCAG relative luminance. */
function luminance(hex: string): number {
  const { r, g, b } = parseHex(hex) ?? { r: 0, g: 0, b: 0 }
  const channel = (c: number) => {
    const s = c / 255
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4)
  }
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b)
}

function contrastRatio(a: string, b: string): number {
  const la = luminance(a)
  const lb = luminance(b)
  const [hi, lo] = la > lb ? [la, lb] : [lb, la]
  return (hi + 0.05) / (lo + 0.05)
}

/** Nudge `from` toward `to` until it clears `min` contrast against `bg`. */
function walkForContrast(
  from: string,
  to: string,
  bg: string,
  min: number,
): string {
  let color = from
  for (let i = 0; i < 12 && contrastRatio(bg, color) < min; i++) {
    // Ramp the step size so a colour that is wildly off still converges
    // without overshooting past `to`.
    color = mix(color, to, 0.1 + i * 0.09)
  }
  return color
}

/**
 * Force a brand colour to be legible as text on an arbitrary background.
 *
 * Two salons can legitimately pick a pale primary and a mid secondary, so
 * the raw brand hex is not always usable as text. We walk the colour
 * toward ink and toward paper, keep whichever ends up more readable, and
 * only shift it if the raw colour already clears the bar.
 */
function readableOn(bg: string, fg: string, min = 4.5): string {
  if (contrastRatio(bg, fg) >= min) return fg
  const towardInk = walkForContrast(fg, '#141210', bg, min)
  const towardPaper = walkForContrast(fg, PAPER, bg, min)
  return contrastRatio(bg, towardInk) >= contrastRatio(bg, towardPaper)
    ? towardInk
    : towardPaper
}

/* ------------------------------------------------------------------ */
/*  Brand theme                                                         */
/* ------------------------------------------------------------------ */

export interface Brand {
  /** Surfaces only. Never a text colour. */
  primary: string
  /** The salon's accent, verbatim. Text on `primary` fills. */
  secondary: string
  /**
   * Text that sits on a `primary` fill. Per the brand rules this is the
   * secondary colour, walked only as far as contrast demands.
   */
  onPrimary: string
  /**
   * Secondary colour made legible on the paper background — the accent
   * text colour for everything that is not on a `primary` fill.
   */
  accent: string
  /** Primary at 7% over paper — section washes, icon wells. */
  soft: string
  /** Primary at 13% over paper — selected rows, chips. */
  softStrong: string
  /** Primary at 26% over paper — hairline borders on tinted elements. */
  line: string
  /** `rgba()` triplet for `rgba(var(--brand-rgb), x)` shadow overrides. */
  rgb: string
}

/**
 * Brand colour rules for the customer app. These are invariants, not
 * suggestions — please keep new UI on the right side of them:
 *
 *  1. `primary` is a *background* colour. It fills buttons, selected
 *     rows, progress bars and washes. It is never a text colour.
 *  2. `secondary` is a *text* colour. Any text sitting on top of a
 *     `primary` fill uses `onPrimary`, which is the secondary colour.
 *  3. `secondary` is never a background colour. Tinted chips and wells
 *     come from `soft` / `softStrong` (primary over paper) instead.
 *
 * Because a tenant can pick anything, both text tokens are walked toward
 * ink or paper until they clear 4.5:1 against the surface they sit on.
 */
export function buildBrand(
  primaryInput: string | null | undefined,
  secondaryInput: string | null | undefined,
): Brand {
  const primary = normalizeHex(primaryInput) ?? DEFAULT_PRIMARY
  const secondary = normalizeHex(secondaryInput) ?? DEFAULT_SECONDARY

  const { r, g, b } = parseHex(primary)!

  return {
    primary,
    secondary,
    onPrimary: readableOn(primary, secondary),
    accent: readableOn(PAPER, secondary),
    soft: mix(primary, PAPER, 0.07),
    softStrong: mix(primary, PAPER, 0.13),
    line: mix(primary, PAPER, 0.26),
    rgb: `${r}, ${g}, ${b}`,
  }
}

/**
 * CSS-variable style object for the customer root. Every descendant
 * component reads its colours from these rather than from props, which
 * keeps the tenant's branding live through the whole tree.
 *
 * There is deliberately no `--brand-on-secondary`: the secondary colour
 * is never a background, so nothing ever needs text on top of it.
 */
export function brandVars(branding: BrandingPayload | null): CSSProperties {
  const b = buildBrand(branding?.primaryColor, branding?.secondaryColor)
  return {
    '--brand-primary': b.primary,
    '--brand-secondary': b.secondary,
    '--brand-on-primary': b.onPrimary,
    '--brand-accent': b.accent,
    '--brand-soft': b.soft,
    '--brand-soft-strong': b.softStrong,
    '--brand-line': b.line,
    '--brand-rgb': b.rgb,
  } as CSSProperties
}
