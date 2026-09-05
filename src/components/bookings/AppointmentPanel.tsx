import type { Appointment, AppointmentStatus } from '../../types'
import { StatusBadge, Avatar, Button } from '../ui'

interface PanelProps {
  appointment: Appointment | null
  onClose: () => void
  onUpdate: (id: string, changes: Partial<Appointment>) => void
}

type ActionDef = { status: AppointmentStatus; label: string; variant?: 'primary' | 'secondary' | 'destructive' }

const ACTIONS: Record<AppointmentStatus, ActionDef[]> = {
  'pending':     [{ status: 'confirmed',   label: 'Confirm',        variant: 'primary'     },
                  { status: 'cancelled',   label: 'Cancel',         variant: 'destructive' }],
  'confirmed':   [{ status: 'checked-in',  label: 'Check in',       variant: 'primary'     },
                  { status: 'no-show',     label: 'No-show',        variant: 'secondary'   },
                  { status: 'cancelled',   label: 'Cancel',         variant: 'destructive' }],
  'checked-in':  [{ status: 'in-progress', label: 'Start service',  variant: 'primary'     },
                  { status: 'cancelled',   label: 'Cancel',         variant: 'destructive' }],
  'in-progress': [{ status: 'completed',   label: 'Mark complete',  variant: 'primary'     }],
  'completed':   [],
  'cancelled':   [],
  'no-show':     [],
}

export function AppointmentPanel({ appointment, onClose, onUpdate }: PanelProps) {
  if (!appointment) return null

  const actions = ACTIONS[appointment.status] ?? []

  const paymentLabel = { unpaid: 'Unpaid', 'deposit-paid': 'Deposit paid', paid: 'Paid in full' }

  const endTime = (() => {
    const [h, m] = appointment.startTime.split(':').map(Number)
    const total = h * 60 + m + appointment.duration
    return `${String(Math.floor(total / 60)).padStart(2,'0')}:${String(total % 60).padStart(2,'0')}`
  })()

  const formattedDate = new Date(appointment.date + 'T00:00:00').toLocaleDateString('en-GB', {
    weekday: 'short', day: 'numeric', month: 'long', year: 'numeric',
  })

  return (
    <div className="w-[300px] flex-shrink-0 bg-surface border-l border-line flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-line flex-shrink-0">
        <p className="text-sm font-semibold text-ink">Appointment</p>
        <button onClick={onClose} className="w-7 h-7 rounded-lg flex items-center justify-center text-ink-3 hover:bg-warm-subtle hover:text-ink transition-colors">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M18 6L6 18M6 6l12 12"/>
          </svg>
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* Status */}
        <div className="px-5 pt-5 pb-4 border-b border-line">
          <div className="mb-4"><StatusBadge status={appointment.status} /></div>
          {appointment.customTitle && (
            <p className="font-display text-lg text-ink mb-3">{appointment.customTitle}</p>
          )}
          <div className="flex items-center gap-3">
            <Avatar name={appointment.customerName} size="lg" />
            <div>
              <p className="font-semibold text-ink text-sm">{appointment.customerName}</p>
              <p className="text-ink-3 text-sm">{appointment.customerPhone}</p>
            </div>
          </div>
        </div>

        {/* Details */}
        <div className="px-5 py-4 border-b border-line">
          <p className="text-[10px] font-semibold text-ink-3 uppercase tracking-wider mb-3.5">Details</p>
          <div className="flex flex-col gap-3">
            <Row label="Service"  value={appointment.serviceName} />
            <Row label="Staff"    value={appointment.staffName} />
            <Row label="Branch"   value={appointment.branchName} />
            <Row label="Date"     value={formattedDate} />
            <Row label="Time"     value={`${appointment.startTime} – ${endTime}`} />
            <Row label="Duration" value={`${appointment.duration} min`} />
            {appointment.isWalkIn && <Row label="Type" value="Walk-in" />}
          </div>
        </div>

        {/* Payment */}
        <div className="px-5 py-4 border-b border-line">
          <p className="text-[10px] font-semibold text-ink-3 uppercase tracking-wider mb-3.5">Payment</p>
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-ink-3">Price</span>
              <span className="text-sm font-semibold text-ink">{appointment.price.toLocaleString()} ETB</span>
            </div>
            {appointment.deposit && (
              <div className="flex items-center justify-between">
                <span className="text-sm text-ink-3">Deposit</span>
                <span className="text-sm text-ink">{appointment.deposit.toLocaleString()} ETB</span>
              </div>
            )}
            <div className="flex items-center justify-between">
              <span className="text-sm text-ink-3">Status</span>
              <span className={`text-sm font-medium ${appointment.paymentStatus === 'paid' ? 'text-[#2A5F30]' : 'text-ink-2'}`}>
                {paymentLabel[appointment.paymentStatus]}
              </span>
            </div>
          </div>
        </div>

        {/* Notes */}
        {appointment.notes && (
          <div className="px-5 py-4">
            <p className="text-[10px] font-semibold text-ink-3 uppercase tracking-wider mb-3">Notes</p>
            <p className="text-sm text-ink-2 leading-relaxed">{appointment.notes}</p>
          </div>
        )}
      </div>

      {/* Actions */}
      {actions.length > 0 && (
        <div className="px-5 py-4 border-t border-line flex-shrink-0 flex flex-col gap-2">
          {actions.map(action => (
            <Button
              key={action.status}
              variant={action.variant ?? 'secondary'}
              fullWidth
              size="sm"
              onClick={() => onUpdate(appointment.id, { status: action.status })}
            >
              {action.label}
            </Button>
          ))}
        </div>
      )}
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <span className="text-sm text-ink-3 flex-shrink-0">{label}</span>
      <span className="text-sm text-ink text-right">{value}</span>
    </div>
  )
}
