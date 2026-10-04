import { useCallback, useEffect, useState } from 'react'

/**
 * Resolving a customer's feedback token.
 *
 * The backend mints feedback tokens server-side when an appointment
 * completes and ships them out-of-band (SMS/email) — the same way the
 * appointment confirmation token works. Nothing in the appointment
 * payload carries it, so the client can only ever *receive* one, never
 * derive one. Two ways that happens in practice:
 *
 *   1. The salon's message links straight to `/feedback/<token>`, or
 *      appends `?feedback=<token>` to the confirmation link.
 *   2. The customer opens a feedback link at some point, after which we
 *      remember it so the confirmation page can offer one-tap access.
 *
 * Deliberately no invented endpoint and no guessing — if we have no
 * token the UI says so rather than showing a link that 404s.
 */

const STORAGE_KEY = 'zsalon:feedback-tokens'

type TokenMap = Record<string, string>

function readStore(): TokenMap {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return {}
    const parsed: unknown = JSON.parse(raw)
    return parsed && typeof parsed === 'object' ? (parsed as TokenMap) : {}
  } catch {
    // Private mode, disabled storage, or corrupted JSON. Not worth
    // surfacing — the deep link still works without the memory.
    return {}
  }
}

function writeStore(map: TokenMap): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(map))
  } catch {
    /* see readStore */
  }
}

/** The token carried on the current URL, if the salon appended one. */
function tokenFromUrl(): string | null {
  try {
    const params = new URLSearchParams(window.location.search)
    return params.get('feedback') || params.get('feedbackToken') || null
  } catch {
    return null
  }
}

function isUsableToken(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

export function useFeedbackToken(businessId: string | null | undefined) {
  const [token, setToken] = useState<string | null>(null)

  useEffect(() => {
    // A token on the URL always wins — it is the freshest.
    const fromUrl = tokenFromUrl()
    if (isUsableToken(fromUrl)) {
      setToken(fromUrl)
      return
    }
    if (!businessId) {
      setToken(null)
      return
    }
    setToken(readStore()[businessId] ?? null)
  }, [businessId])

  /**
   * Called once the feedback form has actually loaded, so we never cache a
   * token that turned out to be expired or already submitted.
   */
  const remember = useCallback(
    (value: string, forBusinessId?: string | null) => {
      if (!isUsableToken(value)) return
      const key = forBusinessId ?? tokenFromUrl() ?? null
      if (!key) return
      const next = { ...readStore(), [key]: value }
      writeStore(next)
      setToken(value)
    },
    [],
  )

  return { token, remember }
}