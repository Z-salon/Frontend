import { useEffect, useMemo, useState } from 'react'
import { useBooking } from '../../context/BookingContext'
import { servicesApi } from '../../../api/services.api'
import type { Service } from '../../../types/api'
import { Button, Choice, Pill, Skeleton } from '../../components/ui'
import { StepFrame, StepNotice } from './StepFrame'
import { IconAlert, IconArrowLeft, IconClock, IconScissors } from '../../components/icons'
import { extractErrorMessage, formatDuration, formatPrice } from '../../utils/format'


export function StepService() {
  // `branchId` lives on `draft`, not at the top level of the context value.
  const { branding, businessId, draft, updateDraft, setStep } = useBooking()
  const branchId = draft.branchId

  const [services, setServices] = useState<Service[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)

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
        if (!cancelled) setError(extractErrorMessage(err, 'Failed to load services'))
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
    // Re-fetch when the branch changes — the customer may have picked a
    // different location on the previous step.
  }, [businessId, branchId, attempt])

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

  function pick(svc: Service, categoryName: string) {
    updateDraft({
      serviceId: svc.id,
      serviceName: svc.name,
      serviceCategoryName: categoryName,
      serviceDurationMinutes: svc.durationMinutes,
      servicePrice: svc.price,
      serviceShowPrice: svc.showPriceToCustomer, 
      serviceEmployeeAssignmentMode: svc.employeeAssignmentMode,
      date: null,
      staffId: null,
      staffName: null,
      slotStart: null,
      slotEnd: null,
    })
    setStep('date')
  }

  const subtitle = draft.branchName
    ? `Available at ${draft.branchName}. Choose a service to see open times.`
    : 'Choose a service to see open times.'

  if (loading) {
    return (
      <StepFrame title="What can we do for you?" subtitle={subtitle}>
        <div className="flex flex-col gap-6">
          {[0, 1].map(g => (
            <div key={g}>
              <Skeleton className="mb-3 h-3 w-28" />
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {[0, 1, 2, 3].map(i => (
                  <Skeleton key={i} className="h-[5.5rem]" />
                ))}
              </div>
            </div>
          ))}
        </div>
      </StepFrame>
    )
  }

  if (error) {
    return (
      <StepFrame
        title="We couldn't load the menu"
        subtitle="The service list did not come through. Check your connection and try again."
      >
        <StepNotice
          icon={<IconAlert className="h-6 w-6" />}
          title="Services unavailable"
          body={error}
          action={
            <Button onClick={() => setAttempt(a => a + 1)}>Try again</Button>
          }
        />
        <div className="mt-6">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setStep('branch')}
            iconLeft={<IconArrowLeft className="h-3.5 w-3.5" />}
          >
            Change location
          </Button>
        </div>
      </StepFrame>
    )
  }

  if (grouped.length === 0) {
    return (
      <StepFrame title="Nothing on the menu yet" subtitle={subtitle}>
        <StepNotice
          icon={<IconScissors className="h-6 w-6" />}
          title="No services available here"
          body={`This branch has no active services published yet.${
            draft.branchName ? ` Try another location, or call ${draft.branchName} directly.` : ''
          }`}
          action={<Button onClick={() => setStep('branch')}>Choose another location</Button>}
        />
      </StepFrame>
    )
  }

  return (
    <StepFrame
      title="What can we do for you?"
      subtitle={subtitle}
    >
      <div className="flex flex-col gap-8">
        {grouped.map(cat => (
          <div key={cat.id}>
            <h2 className="mb-3 flex items-center gap-2.5 text-[11px] font-semibold uppercase tracking-[0.2em] text-ink-3">
              <span
                className="h-px w-5 bg-[color:var(--brand-line)]"
                aria-hidden="true"
              />
              {cat.name}
            </h2>

            <div
              className="grid grid-cols-1 gap-3 sm:grid-cols-2"
              role="radiogroup"
              aria-label={cat.name}
            >
              {cat.services.map(svc => (
                <Choice
                  key={svc.id}
                  selected={draft.serviceId === svc.id}
                  onSelect={() => pick(svc, cat.name)}
                  title={svc.name}
                  subtitle={svc.description ?? undefined}
                  meta={
                    <>
                      {svc.durationMinutes > 0 && (
                        <Pill>
                          <IconClock className="h-3 w-3" />
                          {formatDuration(svc.durationMinutes)}
                        </Pill>
                      )}
                      {svc.showPriceToCustomer && (
                        <Pill tone="brand">
                          {formatPrice(svc.price, branding.currency)}
                        </Pill>
                      )}
                    </>
                  }
                />
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-8">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setStep('branch')}
          iconLeft={<IconArrowLeft className="h-3.5 w-3.5" />}
        >
          Change location
        </Button>
      </div>
    </StepFrame>
  )
}
