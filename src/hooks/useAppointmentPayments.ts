import { useCallback, useEffect, useState } from 'react'
import { appointmentsApi } from '../api/appointments.api'
import { paymentMethodsApi } from '../api/payment-methods.api'
import type {
  AppointmentPayment,
  AppointmentPaymentsInput,
  PaymentMethod,
} from '../types/api'

/* ------------------------------------------------------------------ */
/*  Payments recorded against one appointment (§7)                     */
/*                                                                     */
/*  Unlike service usage there is no status gate, and there is no      */
/*  edit endpoint — a recorded amount is immutable. Correcting one     */
/*  means voiding it (reason required, terminal) and recording a        */
/*  replacement, which preserves the audit trail.                      */
/* ------------------------------------------------------------------ */

export interface AppointmentPayments {
  payments: AppointmentPayment[]
  /** Active payment methods for the picker. */
  methods: PaymentMethod[]
  loading: boolean
  error: string | null
  reload: () => Promise<void>
  /** Re-fetch the active method list after it changes in another tab. */
  reloadMethods: () => Promise<void>
  /** Records a split tender. Returns the created rows, or null on failure. */
  record: (input: AppointmentPaymentsInput) => Promise<AppointmentPayment[] | null>
  /** Returns true when the payment was voided. */
  voidPayment: (paymentId: string, reason: string) => Promise<boolean>
  /** Sum of non-voided payments. */
  paidTotal: number
}

function unwrapArray<T>(res: unknown): T[] {
  if (Array.isArray(res)) return res as T[]
  const anyRes = res as any
  if (Array.isArray(anyRes?.data?.data)) return anyRes.data.data as T[]
  if (Array.isArray(anyRes?.data)) return anyRes.data as T[]
  return []
}

/** Decimal strings arrive as `amount`; guard against non-numeric payloads. */
function toNumber(value: string | number | null | undefined): number {
  const n = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(n) ? n : 0
}

export function useAppointmentPayments(
  businessId: string | undefined,
  appointmentId: string | undefined,
): AppointmentPayments {
  const [payments, setPayments] = useState<AppointmentPayment[]>([])
  const [methods, setMethods] = useState<PaymentMethod[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const reload = useCallback(async () => {
    if (!businessId || !appointmentId) {
      setPayments([])
      return
    }
    setLoading(true)
    setError(null)
    try {
      const res = await appointmentsApi.listPayments(businessId, appointmentId)
      // Ascending by paidAt; keep that order.
      setPayments(unwrapArray<AppointmentPayment>(res))
    } catch {
      setError('Could not load payments.')
    } finally {
      setLoading(false)
    }
  }, [businessId, appointmentId])

  // Methods are business-level, not appointment-level — load once per business.
  // Exposed as `reloadMethods` because they can be created in another tab
  // (Finance → Payment methods) while this panel stays mounted.
  const reloadMethods = useCallback(async () => {
    if (!businessId) {
      setMethods([])
      return
    }
    try {
      const res = await paymentMethodsApi.list(businessId, { active: true })
      setMethods(unwrapArray<PaymentMethod>(res))
    } catch {
      // A missing method list only disables the picker; the list of
      // existing payments still renders.
      setMethods([])
    }
  }, [businessId])

  useEffect(() => {
    let cancelled = false
    void (async () => {
      if (cancelled) return
      await reloadMethods()
    })()
    return () => { cancelled = true }
  }, [reloadMethods])

  useEffect(() => {
    void reload()
  }, [reload])

  const record = useCallback(
    async (input: AppointmentPaymentsInput): Promise<AppointmentPayment[] | null> => {
      if (!businessId || !appointmentId) return null
      try {
        const res = await appointmentsApi.recordPayments(
          businessId,
          appointmentId,
          input,
        )
        const created = unwrapArray<AppointmentPayment>(res)
        if (created.length) setPayments(prev => [...prev, ...created])
        return created
      } catch {
        return null
      }
    },
    [businessId, appointmentId],
  )

  const voidPayment = useCallback(
    async (paymentId: string, reason: string): Promise<boolean> => {
      if (!businessId) return false
      try {
        const res = await appointmentsApi.voidPayment(businessId, paymentId, reason)
        const updated =
          (res as any)?.data ?? (res as any)?.data?.data ?? res
        if (updated && typeof updated === 'object' && 'status' in updated) {
          setPayments(prev =>
            prev.map(p => (p.id === paymentId ? (updated as AppointmentPayment) : p)),
          )
        } else {
          // Response wasn't a usable object — refetch rather than guess.
          await reload()
        }
        return true
      } catch {
        return false
      }
    },
    [businessId, reload],
  )

  const paidTotal = payments
    .filter(p => p.status !== 'VOIDED')
    .reduce((sum, p) => sum + toNumber(p.amount), 0)

  return {
    payments,
    methods,
    loading,
    error,
    reload,
    reloadMethods,
    record,
    voidPayment,
    paidTotal,
  }
}
