import type { ReactNode } from 'react'

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon: ReactNode
  title: string
  description: string
  action?: ReactNode
}) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="w-14 h-14 rounded-2xl bg-warm-subtle flex items-center justify-center mb-5 text-ink-3">
        {icon}
      </div>
      <p className="font-display text-xl text-ink mb-1">{title}</p>
      <p className="text-ink-3 text-sm mb-5 max-w-xs">{description}</p>
      {action}
    </div>
  )
}

export function LoadingState({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <svg
        className="animate-spin text-ink-3 mb-4"
        width="24" height="24" viewBox="0 0 24 24" fill="none"
        stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
      >
        <path d="M21 12a9 9 0 11-6.219-8.56" />
      </svg>
      <p className="text-ink-3 text-sm">{label}</p>
    </div>
  )
}