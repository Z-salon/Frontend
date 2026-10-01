import { useEffect, useMemo, useState } from 'react'
import { useBooking } from '../../context/BookingContext'
import { servicesApi } from '../../../api/services.api'
import type { Service } from '../../../types/api'

function formatPrice(price: string, currency = 'ETB'): string {
  const n = Number(price)
  if (!Number.isFinite(n)) return ''
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency,
    maximumFractionDigits: 2,
  }).format(n)
}

function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} min`
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return m === 0 ? `${h} hr` : `${h} hr ${m} min`
}

export function StepService() {
  // `branchId` lives on `draft`, not at the top level of the context value.
  const { branding, businessId, draft, updateDraft, setStep } = useBooking()
  const branchId = draft.branchId

  const [services, setServices] = useState<Service[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!businessId) {
      setLoading(false)
      setError('Missing business')
      return
    }

    let cancelled = false
    setLoading(true)
    setError(null)

    servicesApi
      .listPublic(businessId, {
        branchId: branchId ?? undefined,
        status: 'ACTIVE',
      })
      .then(rows => {
        if (!cancelled) setServices(rows)
      })
      .catch(err => {
        if (!cancelled) setError(err?.message ?? 'Failed to load services')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
    // Re-fetch when the branch changes — the customer may have picked a
    // different location on the previous step.
  }, [businessId, branchId])

  // Bucket the returned services by categoryId, then join onto the
  // branding categories so display order matches the rest of the flow.
  const grouped = useMemo(() => {
    const byCategory = new Map<string, Service[]>()
    for (const svc of services) {
      const list = byCategory.get(svc.categoryId) ?? []
      list.push(svc)
      byCategory.set(svc.categoryId, list)
    }

    return branding.serviceCategories
      .map(cat => ({
        id: cat.id,
        name: cat.name,
        services: byCategory.get(cat.id) ?? [],
      }))
      .filter(cat => cat.services.length > 0)
  }, [branding.serviceCategories, services])

  function pick(serviceId: string) {
    updateDraft({
      serviceId,
      staffId: null,
      slotStart: null,
      slotEnd: null,
    })
    setStep('date')
  }

  return (
    <section>
      <h2 className="font-display text-2xl mb-1">What can we do for you?</h2>
      <p className="text-sm text-ink-3 mb-6">
        Choose a service to see available times.
      </p>

      {loading && <p className="text-sm text-ink-3">Loading services…</p>}

      {error && !loading && (
        <p className="text-sm text-red-600">Couldn’t load services.</p>
      )}

      {!loading && !error && grouped.length === 0 && (
        <p className="text-sm text-ink-3">
          No services are available at this branch yet.
        </p>
      )}

      <div className="flex flex-col gap-6">
        {grouped.map(cat => (
          <div key={cat.id}>
            <h3 className="text-xs font-semibold text-ink-3 uppercase tracking-wider mb-3">
              {cat.name}
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {cat.services.map(svc => (
                <button
                  key={svc.id}
                  type="button"
                  onClick={() => pick(svc.id)}
                  className="text-left rounded-lg border border-ink-4/20 hover:border-ink-3 hover:bg-ink-4/5 transition-colors p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-medium text-ink-1 truncate">
                        {svc.name}
                      </p>
                      {svc.description && (
                        <p className="text-xs text-ink-3 mt-0.5 line-clamp-2">
                          {svc.description}
                        </p>
                      )}
                      <p className="text-xs text-ink-3 mt-1">
                        {formatDuration(svc.durationMinutes)}
                      </p>
                    </div>
                    {svc.showPriceToCustomer && (
                      <span className="text-sm font-medium text-ink-1 whitespace-nowrap">
                        {formatPrice(svc.price)}
                      </span>
                    )}
                  </div>
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}