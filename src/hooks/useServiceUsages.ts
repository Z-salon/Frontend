import { useCallback, useEffect, useState } from 'react'
import { appointmentsApi } from '../api/appointments.api'
import type {
  ServiceUsage,
  ServiceUsageInput,
  ServiceUsageUpdateInput,
} from '../types/api'

/* ------------------------------------------------------------------ */
/*  Service usage for one appointment (§6)                            */
/*                                                                     */
/*  Entries are only accepted while the appointment is CHECKED_IN,    */
/*  IN_PROGRESS, or COMPLETED, so the hook stays idle for every other  */
/*  status rather than firing a request that would 400.               */
/*                                                                     */
/*  Failures are surfaced through `error` and never thrown — the      */
/*  appointment panel must stay usable if this ancillary feature       */
/*  breaks.                                                            */
/* ------------------------------------------------------------------ */

const USABLE_STATUSES = new Set(['CHECKED_IN', 'IN_PROGRESS', 'COMPLETED'])

/**
 * §6.1 only accepts these three statuses, so the UI should not offer to
 * record usage anywhere else — a PENDING appointment has had no service yet.
 */
export function canHaveServiceUsage(status: string | undefined): boolean {
  return USABLE_STATUSES.has(status ?? '')
}

export interface ServiceUsages {
  usages: ServiceUsage[]
  loading: boolean
  error: string | null
  reload: () => Promise<void>
  /** Returns the created record, or null when the request failed. */
  add: (input: ServiceUsageInput) => Promise<ServiceUsage | null>
  /** PATCH — only the provided fields change. Returns the updated record. */
  update: (
    usageId: string,
    patch: ServiceUsageUpdateInput,
  ) => Promise<ServiceUsage | null>
  remove: (usageId: string) => Promise<boolean>
}

/** Defensive unwrap — mirrors the pattern in the other admin screens. */
function unwrapArray<T>(res: unknown): T[] {
  if (Array.isArray(res)) return res as T[]
  const anyRes = res as any
  if (Array.isArray(anyRes?.data?.data)) return anyRes.data.data as T[]
  if (Array.isArray(anyRes?.data)) return anyRes.data as T[]
  return []
}

function unwrapOne<T>(res: unknown): T | null {
  if (res && typeof res === 'object') {
    const anyRes = res as any
    if (anyRes.data?.data) return anyRes.data.data as T
    if (anyRes.data) return anyRes.data as T
    return res as T
  }
  return null
}

export function useServiceUsages(
  businessId: string | undefined,
  appointmentId: string | undefined,
  status: string | undefined,
): ServiceUsages {
  const [usages, setUsages] = useState<ServiceUsage[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const usable =
    !!businessId && !!appointmentId && USABLE_STATUSES.has(status ?? '')

  const reload = useCallback(async () => {
    if (!businessId || !appointmentId || !usable) {
      setUsages([])
      return
    }
    setLoading(true)
    setError(null)
    try {
      const res = await appointmentsApi.listServiceUsages(
        businessId,
        appointmentId,
      )
      // API returns ascending by recordedAt; keep that order.
      setUsages(unwrapArray<ServiceUsage>(res))
    } catch {
      setError('Could not load service usage.')
    } finally {
      setLoading(false)
    }
    // `usable` is derived from the three primitives below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [businessId, appointmentId, status])

  useEffect(() => {
    void reload()
  }, [reload])

  const add = useCallback(
    async (input: ServiceUsageInput): Promise<ServiceUsage | null> => {
      if (!businessId || !appointmentId) return null
      try {
        const res = await appointmentsApi.addServiceUsage(
          businessId,
          appointmentId,
          input,
        )
        const created = unwrapOne<ServiceUsage>(res)
        if (created) setUsages(prev => [...prev, created])
        return created
      } catch {
        return null
      }
    },
    [businessId, appointmentId],
  )

  const update = useCallback(
    async (
      usageId: string,
      patch: ServiceUsageUpdateInput,
    ): Promise<ServiceUsage | null> => {
      if (!businessId) return null
      try {
        const res = await appointmentsApi.updateServiceUsage(
          businessId,
          usageId,
          patch,
        )
        const updated = unwrapOne<ServiceUsage>(res)
        if (updated) {
          setUsages(prev => prev.map(u => (u.id === updated.id ? updated : u)))
        }
        return updated
      } catch {
        return null
      }
    },
    [businessId],
  )

  const remove = useCallback(
    async (usageId: string): Promise<boolean> => {
      if (!businessId) return false
      try {
        await appointmentsApi.deleteServiceUsage(businessId, usageId)
        setUsages(prev => prev.filter(u => u.id !== usageId))
        return true
      } catch {
        return false
      }
    },
    [businessId],
  )

  return { usages, loading, error, reload, add, update, remove }
}
