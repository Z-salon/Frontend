import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export type ToastVariant = 'success' | 'error' | 'info'

export interface ToastOptions {
  title?: string
  duration?: number
  id?: string
}

interface ToastItem {
  id: string
  variant: ToastVariant
  title?: string
  message: string
  duration: number
  /** Set true to trigger the exit animation; row removes itself after. */
  leaving?: boolean
}

interface ToastContextValue {
  success: (message: string, options?: ToastOptions) => string
  error:   (message: string, options?: ToastOptions) => string
  info:    (message: string, options?: ToastOptions) => string
  dismiss: (id: string) => void
  clear:   () => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

/* ------------------------------------------------------------------ */
/*  Provider                                                           */
/* ------------------------------------------------------------------ */

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([])

  /**
   * Hard-remove a toast. Called by the row itself *after* its exit
   * animation finishes, so the provider never has to guess timing.
   */
  const remove = useCallback((id: string) => {
    setToasts(list => list.filter(t => t.id !== id))
  }, [])

  /**
   * Mark a toast as leaving. The row watches for `leaving` and, once its
   * exit transition ends, calls `remove`.
   */
  const dismiss = useCallback((id: string) => {
    setToasts(list =>
      list.map(t => (t.id === id ? { ...t, leaving: true } : t)),
    )
  }, [])

  const push = useCallback(
    (variant: ToastVariant, message: string, options?: ToastOptions) => {
      const id = options?.id ?? `t-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
      const duration = options?.duration ?? (variant === 'error' ? 6000 : 4000)

      setToasts(list => {
        const filtered = options?.id ? list.filter(t => t.id !== id) : list
        const next: ToastItem = {
          id,
          variant,
          title: options?.title,
          message,
          duration,
        }
        return [...filtered, next].slice(-5)
      })

      return id
    },
    [],
  )

  const api = useMemo<ToastContextValue>(
    () => ({
      success: (message, options) => push('success', message, options),
      error:   (message, options) => push('error',   message, options),
      info:    (message, options) => push('info',    message, options),
      dismiss,
      clear: () => setToasts([]),
    }),
    [push, dismiss],
  )

  return (
    <ToastContext.Provider value={api}>
      {children}
      <ToastViewport
        toasts={toasts}
        onAutoDismiss={dismiss}
        onRemove={remove}
      />
    </ToastContext.Provider>
  )
}

/* ------------------------------------------------------------------ */
/*  Hook                                                               */
/* ------------------------------------------------------------------ */

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext)
  if (!ctx) {
    throw new Error('useToast() must be used inside a <ToastProvider>')
  }
  return ctx
}

/* ------------------------------------------------------------------ */
/*  Viewport                                                           */
/* ------------------------------------------------------------------ */

function ToastViewport({
  toasts,
  onAutoDismiss,
  onRemove,
}: {
  toasts: ToastItem[]
  onAutoDismiss: (id: string) => void
  onRemove: (id: string) => void
}) {
  return (
    <div
      aria-live="polite"
      aria-atomic="true"
      className="fixed z-[100] bottom-6 right-6 flex flex-col items-end gap-2 pointer-events-none"
    >
      {toasts.map(t => (
        <ToastRow
          key={t.id}
          toast={t}
          onAutoDismiss={onAutoDismiss}
          onRemove={onRemove}
        />
      ))}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Single toast                                                       */
/* ------------------------------------------------------------------ */

function ToastRow({
  toast,
  onAutoDismiss,
  onRemove,
}: {
  toast: ToastItem
  onAutoDismiss: (id: string) => void
  onRemove: (id: string) => void
}) {
  const [visible, setVisible] = useState(false)
  const rowRef = useRef<HTMLDivElement>(null)
  const autoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Mount → fade/slide in.
  useEffect(() => {
    const r = requestAnimationFrame(() => setVisible(true))
    return () => cancelAnimationFrame(r)
  }, [])

  // Auto-dismiss timer (only runs while `leaving` is false).
  useEffect(() => {
    if (toast.leaving) return
    if (toast.duration <= 0) return

    autoTimerRef.current = setTimeout(() => {
      onAutoDismiss(toast.id)
    }, toast.duration)

    return () => {
      if (autoTimerRef.current) {
        clearTimeout(autoTimerRef.current)
        autoTimerRef.current = null
      }
    }
  }, [toast.id, toast.duration, toast.leaving, onAutoDismiss])

  // When the parent marks this toast as leaving, wait for the exit
  // transition to finish, then hard-remove it.
  useEffect(() => {
    if (!toast.leaving) return
    const el = rowRef.current
    if (!el) {
      onRemove(toast.id)
      return
    }

    // Fallback in case the transitionend event never fires.
    const fallback = setTimeout(() => onRemove(toast.id), 260)

    function done() {
      clearTimeout(fallback)
      onRemove(toast.id)
    }

    el.addEventListener('transitionend', done, { once: true })
    return () => {
      clearTimeout(fallback)
      el.removeEventListener('transitionend', done)
    }
  }, [toast.leaving, toast.id, onRemove])

  function handleDismissClick() {
    // Cancel the auto-dismiss timer so it doesn't double-fire.
    if (autoTimerRef.current) {
      clearTimeout(autoTimerRef.current)
      autoTimerRef.current = null
    }
    onAutoDismiss(toast.id)
  }

  const container =
    toast.variant === 'error'
      ? 'bg-[#F5EAEA] border-[#E8C4C4] text-[#B06A6A]'
      : toast.variant === 'info'
        ? 'bg-warm-subtle border-line text-ink-2'
        : 'bg-surface border-line text-ink'

  return (
    <div
      ref={rowRef}
      role="status"
      className={`
        pointer-events-auto
        flex items-start gap-3
        w-[22rem] max-w-[calc(100vw-3rem)]
        px-4 py-3
        rounded-xl border shadow-lg shadow-black/5
        transition-all duration-200 ease-out
        ${container}
        ${visible && !toast.leaving
          ? 'opacity-100 translate-y-0 scale-100'
          : 'opacity-0 translate-y-2 scale-[0.98]'}
      `}
    >
      <ToastIcon variant={toast.variant} />

      <div className="flex-1 min-w-0">
        {toast.title && (
          <p className="text-sm font-medium leading-tight">{toast.title}</p>
        )}
        <p className={`text-sm leading-relaxed break-words ${toast.title ? 'mt-0.5' : ''}`}>
          {toast.message}
        </p>
      </div>

      <button
        type="button"
        onClick={handleDismissClick}
        aria-label="Dismiss"
        className="
          flex-shrink-0 -mr-1 -mt-0.5
          w-6 h-6 flex items-center justify-center rounded-lg
          opacity-60 hover:opacity-100 transition-opacity
        "
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 6L6 18M6 6l12 12" />
        </svg>
      </button>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Icon                                                               */
/* ------------------------------------------------------------------ */

function ToastIcon({ variant }: { variant: ToastVariant }) {
  const common = 'flex-shrink-0 w-4 h-4 mt-[0.1rem]'

  if (variant === 'success') {
    return (
      <svg className={common} viewBox="0 0 24 24" fill="none"
        stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20 6L9 17l-5-5" />
      </svg>
    )
  }

  if (variant === 'error') {
    return (
      <svg className={common} viewBox="0 0 24 24" fill="none"
        stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="9" />
        <path d="M12 8v4M12 16h.01" />
      </svg>
    )
  }

  return (
    <svg className={common} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 16v-4M12 8h.01" />
    </svg>
  )
}