import { useBooking } from '../../context/BookingContext'
import { Button, Choice, Pill } from '../../components/ui'
import { StepFrame, StepNotice } from './StepFrame'
import { IconClock, IconPhone, IconPin, IconSparkle } from '../../components/icons'
import { formatTimezone } from '../../utils/format'


export function StepBranch() {
  const { branding, draft, updateDraft, setStep } = useBooking()
  const branches = branding.branches

  function pick(branchId: string, branchName: string) {
    updateDraft({
      branchId,
      branchName,
      // Clear downstream choices when the branch changes.
      serviceId: null,
      serviceName: null,
      serviceCategoryName: null,
      serviceDurationMinutes: null,
      servicePrice: null,
      serviceEmployeeAssignmentMode: null,
      staffId: null,
      staffName: null,
      slotStart: null,
      slotEnd: null,
    })
    setStep('service')
  }

  if (branches.length === 0) {
    return (
      <StepFrame
        title="Which studio?"
        subtitle="This salon has not published any locations yet."
      >
        <StepNotice
          icon={<IconPin className="h-6 w-6" />}
          title="No locations available"
          body="Give this salon a call and they will help you find a time that works."
        />
      </StepFrame>
    )
  }

  const onlyBranch = branches.length === 1 ? branches[0] : null

  return (
    <StepFrame
      title={onlyBranch ? 'Confirm your studio' : 'Which studio?'}
      subtitle={
        onlyBranch
          ? 'We have one location for you.'
          : 'Pick the branch you would like to visit. Each one keeps its own calendar.'
      }
    >
      <div
        className="grid grid-cols-1 gap-3 sm:grid-cols-2"
        role="radiogroup"
        aria-label="Choose a location"
      >
        {branches.map(branch => {
          const phone =
            branch.phones.find(p => p.isPrimary) ?? branch.phones[0]
          return (
            <Choice
              key={branch.id}
              selected={draft.branchId === branch.id}
              onSelect={() => pick(branch.id, branch.name)}
              icon={<IconPin className="h-[18px] w-[18px]" />}
              title={branch.name}
              subtitle={branch.address ?? undefined}
              meta={
                <>
                  {phone && (
                    <Pill>
                      <IconPhone className="h-3 w-3" />
                      {phone.phone}
                    </Pill>
                  )}
                  {branch.timezone && (
                    <Pill>
                      <IconClock className="h-3 w-3" />
                      {formatTimezone(branch.timezone)}
                    </Pill>
                  )}
                </>
              }
            />
          )
        })}
      </div>

      {onlyBranch && (
        <div className="mt-6 flex flex-wrap items-center gap-3">
          <Button
            onClick={() => pick(onlyBranch.id, onlyBranch.name)}
            iconLeft={<IconSparkle className="h-4 w-4" />}
          >
            Continue with {onlyBranch.name}
          </Button>
          <span className="text-sm text-ink-3">or pick it above to review the details.</span>
        </div>
      )}
    </StepFrame>
  )
}
