/**
 * Maps linking for storefront branch addresses.
 *
 * Salons enter their address as free text, but some paste a Google Maps or
 * Maps.app link instead. A pasted link is a better destination than a search,
 * since it points at the exact pin the salon chose rather than whatever the
 * search decides is closest.
 */

/** True when the branch address is actually a link rather than prose. */
export function isUrlAddress(address: string | null | undefined): boolean {
  return /^https?:\/\//i.test((address ?? '').trim())
}

/**
 * Resolves a branch address to a Google Maps URL, or null when there is no
 * address to link to.
 *
 * `http(s)` input is used verbatim once it parses; anything else becomes a
 * Maps search for the text.
 */
export function mapsUrlFor(address: string | null | undefined): string | null {
  const trimmed = (address ?? '').trim()
  if (!trimmed) return null

  if (/^https?:\/\//i.test(trimmed)) {
    try {
      // eslint-disable-next-line no-new
      new URL(trimmed)
      return trimmed
    } catch {
      // Looked like a URL but didn't parse — fall through to a search.
    }
  }
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(trimmed)}`
}
