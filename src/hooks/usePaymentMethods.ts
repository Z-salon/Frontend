import { useCallback, useEffect, useState } from 'react'
import { paymentMethodsApi } from '../api/payment-methods.api'
import type { PaymentMethod, PaymentMethodInput } from '../types/api'

/* ------------------------------------------------------------------ */
/*  Payment methods (§4)                                               */
/*                                                                     */
/*  Nothing in the admin app used to call create/update/remove. The     */
/*  Settings → Finance block only pushed objects with `pm${Date.now()}` */
/*  ids into local React state and never touched the network, so the   */
/*  business genuinely had zero methods on the server and every        */
/*  payment form correctly showed its empty state. This hook is the     */
/*  only writer.                                                       */
/*                                                                     */
/*  Permissions are asymmetric and enforced server-side:               */
/*    · read  → any active member (§4.3)                               */
/*    · write → membership + elevated role; the guide doesn't pin the   */
/*      exact rule down, so a 403 is surfaced as a permission message   */
/*      rather than guessed at.                                         */
/* ------------------------------------------------------------------ */

export interface UsePaymentMethods {
  methods: PaymentMethod[]
  loading: boolean
  error: string | null
  reload: () => Promise<void>
  create: (input: PaymentMethodInput) => Promise<PaymentMethod>
  update: (id: string, patch: Partial<PaymentMethodInput>) => Promise<PaymentMethod>
  remove: (id: string) => Promise<void>
  setActive: (id: string, isActive: boolean) => Promise<PaymentMethod>
}

function sortByOrder(list: PaymentMethod[]): PaymentMethod[] {
  return [...list].sort((a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0))
}

export function usePaymentMethods(
  businessId: string | null | undefined,
): UsePaymentMethods {
  const [methods, setMethods] = useState<PaymentMethod[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!businessId) {
      setMethods([])
      return
    }
    setLoading(true)
    setError(null)
    try {
      // No `active` filter: inactive methods still need to be visible here
      // so they can be re-enabled or deleted.
      const res = await paymentMethodsApi.list(businessId)
      setMethods(sortByOrder(Array.isArray(res) ? res : []))
    } catch {
      setError('Could not load payment methods.')
    } finally {
      setLoading(false)
    }
  }, [businessId])

  useEffect(() => {
    void load()
  }, [load])

  const create = useCallback(
    async (input: PaymentMethodInput) => {
      if (!businessId) throw new Error('No business selected.')
      const created = await paymentMethodsApi.create(businessId, input)
      setMethods(prev => sortByOrder([...prev, created]))
      return created
    },
    [businessId],
  )

  const update = useCallback(
    async (id: string, patch: Partial<PaymentMethodInput>) => {
      if (!businessId) throw new Error('No business selected.')
      const updated = await paymentMethodsApi.update(businessId, id, patch)
      setMethods(prev => prev.map(m => (m.id === id ? updated : m)))
      return updated
    },
    [businessId],
  )

  const remove = useCallback(
    async (id: string) => {
      if (!businessId) throw new Error('No business selected.')
      await paymentMethodsApi.remove(businessId, id)
      setMethods(prev => prev.filter(m => m.id !== id))
    },
    [businessId],
  )

  const setActive = useCallback(
    (id: string, isActive: boolean) => update(id, { isActive }),
    [update],
  )

  return { methods, loading, error, reload: load, create, update, remove, setActive }
}
