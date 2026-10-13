import { useEffect, useState } from 'react'
import type { BrandingPayload } from '../../types/api'
import { brandingApi } from '../../api/branding.api'

interface State {
  data: BrandingPayload | null
  loading: boolean
  error: string | null
}

// Module-level cache. The branding payload rarely changes, so we keep it
// hot across route transitions within the same session.
const cache = new Map<string, BrandingPayload>()

export function useBranding(businessId: string | null): State {
  const [state, setState] = useState<State>(() => {
    if (businessId && cache.has(businessId)) {
      return { data: cache.get(businessId)!, loading: false, error: null }
    }
    return { data: null, loading: !!businessId, error: null }
  })

  useEffect(() => {
    if (!businessId) {
      setState({ data: null, loading: false, error: null })
      return
    }

    if (cache.has(businessId)) {
      setState({ data: cache.get(businessId)!, loading: false, error: null })
      return
    }

    let cancelled = false
    setState(s => ({ ...s, loading: true, error: null }))

    ;(async () => {
      try {
        const res = await brandingApi.get(businessId)
        cache.set(businessId, res)
        if (!cancelled) setState({ data: res, loading: false, error: null })
      } catch (err) {
        if (cancelled) return
        setState({
          data: null,
          loading: false,
          error: extractErrorMessage(err, 'Could not load this page.'),
        })
      }
    })()

    return () => { cancelled = true }
  }, [businessId])

  return state
}

function extractErrorMessage(err: unknown, fallback: string): string {
  const anyErr = err as any
  const data = anyErr?.response?.data ?? anyErr?.data ?? anyErr
  if (typeof data?.message === 'string') return data.message
  if (Array.isArray(data?.errors) && data.errors.length > 0) return String(data.errors[0])
  if (typeof anyErr?.message === 'string') return anyErr.message
  return fallback
}