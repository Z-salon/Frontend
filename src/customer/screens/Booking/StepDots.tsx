export function StepDots({
  steps,
  labels,
  current,
  onJump,
}: {
  steps: string[]
  labels: Record<string, string>
  current: string
  onJump: (step: string) => void
}) {
  const currentIdx = steps.indexOf(current)

  return (
    <ol className="flex items-center gap-1 sm:gap-2 overflow-x-auto">
      {steps.map((s, i) => {
        const done = i < currentIdx
        const active = i === currentIdx
        const enabled = i <= currentIdx

        return (
          <li key={s} className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
            <button
              type="button"
              disabled={!enabled}
              onClick={() => enabled && onJump(s)}
              className={`
                flex items-center gap-1.5 text-xs sm:text-sm transition-opacity
                ${enabled ? 'cursor-pointer hover:opacity-80' : 'cursor-not-allowed opacity-60'}
              `}
            >
              <span
                className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-semibold"
                style={{
                  background: done || active ? 'var(--brand-primary)' : '#EEE9E0',
                  color: done || active ? 'var(--brand-on-primary)' : '#7A6F68',
                }}
              >
                {done ? '✓' : i + 1}
              </span>
              <span className={active ? 'text-ink font-medium' : 'text-ink-3'}>
                {labels[s]}
              </span>
            </button>

            {i < steps.length - 1 && (
              <span className="w-4 sm:w-8 h-px bg-line" aria-hidden="true" />
            )}
          </li>
        )
      })}
    </ol>
  )
}