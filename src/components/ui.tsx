import { type ReactNode, type InputHTMLAttributes, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react'
import type { AppointmentStatus } from '../types'

interface ButtonProps {
  children: ReactNode
  variant?: 'primary' | 'secondary' | 'ghost' | 'destructive'
  size?: 'sm' | 'md' | 'lg'
  fullWidth?: boolean
  disabled?: boolean
  loading?: boolean
  onClick?: () => void
  type?: 'button' | 'submit'
  className?: string
}

export function Button({
  children, variant = 'primary', size = 'md', fullWidth, disabled, loading, onClick, type = 'button', className = '',
}: ButtonProps) {
  const base = 'inline-flex items-center justify-center font-medium transition-all duration-150 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed select-none'
  const variants = {
    primary: 'bg-ink text-surface hover:opacity-90 rounded-[10px]',
    secondary: 'bg-surface text-ink border border-line hover:bg-warm-subtle rounded-[10px]',
    ghost: 'text-ink-2 hover:bg-warm-subtle hover:text-ink rounded-[10px]',
    destructive: 'bg-[#C47B7B] text-white hover:bg-[#B06A6A] rounded-[10px]',
  }
  const sizes = { sm: 'text-sm h-8 px-3 gap-1.5', md: 'text-sm h-10 px-4 gap-2', lg: 'text-base h-12 px-6 gap-2' }
  return (
    <button
      type={type}
      disabled={disabled || loading}
      onClick={onClick}
      className={`${base} ${variants[variant]} ${sizes[size]} ${fullWidth ? 'w-full' : ''} ${className}`}
    >
      {loading && (
        <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      )}
      {children}
    </button>
  )
}

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
  hint?: string
}

export function Input({ label, error, hint, className = '', ...props }: InputProps) {
  return (
    <div className="flex flex-col gap-1.5">
      {label && <label className="text-sm font-medium text-ink-2">{label}</label>}
      <input
        {...props}
        className={`h-10 px-3 rounded-[10px] border text-sm bg-surface text-ink placeholder:text-ink-3 focus:outline-none focus:ring-1 transition-all duration-150 ${
          error
            ? 'border-[#C47B7B] focus:border-[#C47B7B] focus:ring-[#C47B7B]/20'
            : 'border-line focus:border-warm focus:ring-warm/20'
        } ${className}`}
      />
      {error && <p className="text-xs text-[#B06A6A]">{error}</p>}
      {hint && !error && <p className="text-xs text-ink-3">{hint}</p>}
    </div>
  )
}

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string
  error?: string
}

export function Select({ label, error, className = '', children, ...props }: SelectProps) {
  return (
    <div className="flex flex-col gap-1.5">
      {label && <label className="text-sm font-medium text-ink-2">{label}</label>}
      <select
        {...props}
        className={`h-10 px-3 rounded-[10px] border text-sm bg-surface text-ink focus:outline-none focus:ring-1 transition-all duration-150 cursor-pointer ${
          error
            ? 'border-[#C47B7B] focus:border-[#C47B7B] focus:ring-[#C47B7B]/20'
            : 'border-line focus:border-warm focus:ring-warm/20'
        } ${className}`}
      >
        {children}
      </select>
      {error && <p className="text-xs text-[#B06A6A]">{error}</p>}
    </div>
  )
}

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string
}

export function Textarea({ label, className = '', ...props }: TextareaProps) {
  return (
    <div className="flex flex-col gap-1.5">
      {label && <label className="text-sm font-medium text-ink-2">{label}</label>}
      <textarea
        {...props}
        className={`px-3 py-2.5 rounded-[10px] border border-line text-sm bg-surface text-ink placeholder:text-ink-3 focus:outline-none focus:border-warm focus:ring-1 focus:ring-warm/20 transition-all duration-150 resize-none ${className}`}
      />
    </div>
  )
}

const STATUS_MAP: Record<AppointmentStatus, { label: string; bg: string; text: string; dot: string }> = {
  'pending':    { label: 'Pending',     bg: '#FBF5EA', text: '#7A5F2C', dot: '#C4A97D' },
  'confirmed':  { label: 'Confirmed',   bg: '#EAF1F5', text: '#2C5F6A', dot: '#7B9FAB' },
  'checked-in': { label: 'Checked In',  bg: '#EBF5EE', text: '#2C5F3C', dot: '#8BAB95' },
  'in-progress':{ label: 'In Progress', bg: '#F0EDF5', text: '#4A3F5F', dot: '#9B8FA8' },
  'completed':  { label: 'Completed',   bg: '#EAF5EC', text: '#2A5F30', dot: '#7FAB85' },
  'cancelled':  { label: 'Cancelled',   bg: '#F5F4F2', text: '#6B6560', dot: '#A8A4A0' },
  'no-show':    { label: 'No-show',     bg: '#F5EAEA', text: '#6A2C2C', dot: '#C47B7B' },
}

export function getStatusConfig(status: AppointmentStatus) {
  return STATUS_MAP[status]
}

export function StatusBadge({ status }: { status: AppointmentStatus }) {
  const cfg = STATUS_MAP[status]
  return (
    <span
      className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full"
      style={{ backgroundColor: cfg.bg, color: cfg.text }}
    >
      <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: cfg.dot }} />
      {cfg.label}
    </span>
  )
}

export function Avatar({ name, size = 'md' }: { name: string; size?: 'sm' | 'md' | 'lg' }) {
  const initials = name.split(' ').map(p => p[0]).join('').slice(0, 2).toUpperCase()
  const sz = { sm: 'w-7 h-7 text-xs', md: 'w-9 h-9 text-sm', lg: 'w-11 h-11 text-base' }
  return (
    <div className={`${sz[size]} rounded-full bg-warm flex items-center justify-center font-semibold text-ink-2 flex-shrink-0`}>
      {initials}
    </div>
  )
}

export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label?: string }) {
  return (
    <label className="flex items-center gap-3 cursor-pointer select-none">
      <div
        className={`relative w-10 h-6 rounded-full transition-colors duration-200 flex-shrink-0 ${checked ? 'bg-ink' : 'bg-line'}`}
        onClick={() => onChange(!checked)}
      >
        <div className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow-sm transition-transform duration-200 ${checked ? 'translate-x-5' : 'translate-x-1'}`} />
      </div>
      {label && <span className="text-sm text-ink-2">{label}</span>}
    </label>
  )
}

export function Modal({ open, onClose, title, children, width = 'max-w-lg' }: {
  open: boolean
  onClose: () => void
  title?: string
  children: ReactNode
  width?: string
}) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-ink/25 backdrop-blur-[2px]" onClick={onClose} />
      <div className={`relative bg-surface rounded-2xl shadow-2xl ${width} w-full max-h-[90vh] overflow-y-auto`}>
        {title && (
          <div className="flex items-center justify-between px-6 py-5 border-b border-line">
            <h2 className="text-base font-semibold text-ink">{title}</h2>
            <button onClick={onClose} className="w-8 h-8 rounded-lg flex items-center justify-center text-ink-3 hover:bg-warm-subtle hover:text-ink transition-colors">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
          </div>
        )}
        {children}
      </div>
    </div>
  )
}
