import {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { IconAlert, IconCheckCircle, IconInfo, IconX } from '../components/icons'

interface ToastItem {
  id: number
  message: string
  tone: 'info' | 'success' | 'error'
  leaving: boolean
}

interface ToastValue {
  toast: {
    info: (m: string) => void
    success: (m: string) => void
    error: (m: string) => void
  }
}

const Ctx = createContext<ToastValue | null>(null)

const DURATION_MS = 4200
const EXIT_MS = 240
const MAX_VISIBLE = 3

export function CustomerToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([])
  const seq = useRef(0)
  const timers = useRef(new Map<number, ReturnType<typeof setTimeout>>())

  const dismiss = useCallback((id: number) => {
    setItems(prev => prev.map(t => (t.id === id ? { ...t, leaving: true } : t)))
    const timer = setTimeout(() => {
      setItems(prev => prev.filter(t => t.id !== id))
      timers.current.delete(id)
    }, EXIT_MS)
    timers.current.set(id, timer)
  }, [])

  const push = useCallback(
    (message: string, tone: ToastItem['tone']) => {
      const id = ++seq.current
      setItems(prev => [...prev, { id, message, tone, leaving: false }].slice(-MAX_VISIBLE))
      setTimeout(() => dismiss(id), DURATION_MS)
    },
    [dismiss],
  )

  const value: ToastValue = {
    toast: {
      info: m => push(m, 'info'),
      success: m => push(m, 'success'),
      error: m => push(m, 'error'),
    },
  }

  return (
    <Ctx.Provider value={value}>
      {children}

      <div
        className="pointer-events-none fixed inset-x-4 top-4 z-[100] flex flex-col items-center gap-2.5 sm:inset-x-auto sm:right-6 sm:top-auto sm:bottom-6 sm:items-end"
        role="status"
        aria-live="polite"
      >
        {items.map(t => (
          <div
            key={t.id}
            className={`
              pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-2xl border
              px-4 py-3.5 text-sm shadow-float backdrop-blur
              transition-[opacity,transform] duration-200
              ${t.leaving ? 'translate-y-1 opacity-0' : 'animate-fade-up'}
              ${TONE[t.tone]}
            `}
          >
            <span className="mt-px flex-shrink-0">{ICONS[t.tone]}</span>
            <p className="min-w-0 flex-1 leading-relaxed">{t.message}</p>
            <button
              type="button"
              onClick={() => dismiss(t.id)}
              aria-label="Dismiss"
              className="-mr-1 -mt-0.5 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full opacity-50 transition-opacity hover:opacity-100"
            >
              <IconX className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
      </div>
    </Ctx.Provider>
  )
}

const TONE: Record<ToastItem['tone'], string> = {
  info: 'border-line bg-surface/95 text-ink-2',
  success: 'border-[#D3E3D7] bg-ok-soft/95 text-ok',
  error: 'border-[#E8CBCB] bg-bad-soft/95 text-bad',
}

const ICONS: Record<ToastItem['tone'], ReactNode> = {
  info: <IconInfo className="h-4 w-4 text-ink-3" />,
  success: <IconCheckCircle className="h-4 w-4" />,
  error: <IconAlert className="h-4 w-4" />,
}

export function useCustomerToast() {
  const v = useContext(Ctx)
  if (!v) throw new Error('useCustomerToast must be used inside CustomerToastProvider')
  return v.toast
}
