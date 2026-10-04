import { useEffect, useState } from 'react'
import { servicesApi } from '../../api/services.api'
import type { Service } from '../../types/api'

/* ------------------------------------------------------------------ */
/*  Service categories offered per branch                               */
/*                                                                      */
/*  The branding payload lists categories flat — `branding.serviceCategories` */
/*  carries no branch information, and neither does the public service     */
/*  projection. So the only auth-free way to learn "what can I get at this  */
/*  branch" is to ask for that branch's public services and read back the  */
/*  category on each one.                                                 */
/*                                                                      */
/*  `GET /public/businesses/:id/services?branchId=` needs no token, so this */
/*  is safe on the storefront — unlike the admin category/branch assignment */
/*  routes, which require membership.                                      */
/*                                                                      */
/*  One request per branch. Branches are few (single-digit in practice),    */
/*  and results are cached per business+branch for the session so route    */
/*  transitions don't refetch.                                             */
/* ------------------------------------------------------------------ */

export interface BranchCategory {
  id: string
  name: string
}

interface State {
  byBranch: Record<string, BranchCategory[]>
  loading: boolean
}

const cache = new Map<string, BranchCategory[]>()

function cacheKey(businessId: string, branchId: string) {
  return `${businessId}::${branchId}`
}

function distinctCategories(services: Service[]): BranchCategory[] {
  const seen = new Map<string, BranchCategory>()
  for (const s of services) {
    const c = s.category
    if (c && c.status === 'ACTIVE' && !seen.has(c.id)) {
      seen.set(c.id, { id: c.id, name: c.name })
    }
  }
  return [...seen.values()]
}

export function useBranchCategories(
  businessId: string | null,
  branchIds: string[],
): State {
  const [byBranch, setByBranch] = useState<Record<string, BranchCategory[]>>({})
  const [loading, setLoading] = useState(false)

  const key = branchIds.slice().sort().join(',')

  useEffect(() => {
    if (!businessId || !key) {
      setByBranch({})
      setLoading(false)
      return
    }

    const ids = key.split(',')
    const pending = ids.filter(id => !cache.has(cacheKey(businessId, id)))
    const merged: Record<string, BranchCategory[]> = {}
    for (const id of ids) {
      const hit = cache.get(cacheKey(businessId, id))
      if (hit) merged[id] = hit
    }

    // Nothing new to fetch — all branches are cached.
    if (pending.length === 0) {
      setByBranch(merged)
      setLoading(false)
      return
    }

    let cancelled = false
    setByBranch(merged)
    setLoading(true)

    void (async () => {
      /* Settled per branch: one failing branch shouldn't blank the rest of
         the locations grid. A failure just means that branch shows no
         category pills rather than an error. */
      const results = await Promise.allSettled(
        pending.map(id => servicesApi.listPublic(businessId, { branchId: id })),
      )
      if (cancelled) return

      setByBranch(prev => {
        const next = { ...prev }
        results.forEach((r, i) => {
          if (r.status === 'fulfilled') {
            const list = distinctCategories(r.value ?? [])
            next[pending[i]] = list
            cache.set(cacheKey(businessId, pending[i]), list)
          }
        })
        return next
      })
      setLoading(false)
    })()

    return () => {
      cancelled = true
    }
  }, [businessId, key])

  return { byBranch, loading }
}
