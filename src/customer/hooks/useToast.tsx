import {
  createContext,
  useCallback,
  useContext,
  useState,
  type ReactNode,
} from 'react'

interface ToastItem {
  id: string
  message: string
  tone: 'info' | 'success' | 'error'
}

interface ToastValue {
  toast: {
    info: (m: string) => void
    success: (m: string) => void
    error: (m: string) => void
  }
}

const Ctx = createContext<ToastValue | null>(null)

export function CustomerToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([])

  const push = useCallback((message: string, tone: ToastItem['tone']) => {
    const id = Math.random().toString(36).slice(2)
    setItems(prev => [...prev, { id, message, tone }])
    setTimeout(() => {
      setItems(prev => prev.filter(t => t.id !== id))
    }, 4000)
  }, [])

  const value: ToastValue = {
    toast: {
      info: (m) => push(m, 'info'),
      success: (m) => push(m, 'success'),
      error: (m) => push(m, 'error'),
    },
  }

  return (
    <Ctx.Provider value={value}>
      {children}
      <div className="fixed top-4 right-4 z-[100] flex flex-col gap-2 max-w-sm">
        {items.map(t => (
          <div
            key={t.id}
            className={`
              px-4 py-3 rounded-xl border shadow-lg text-sm
              ${t.tone === 'error'
                ? 'bg-[#FBEDED] border-[#E5B5B5] text-[#B03A3A]'
                : t.tone === 'success'
                  ? 'bg-[#EAF5EC] border-[#C4DFC9] text-[#2A6139]'
                  : 'bg-surface border-line text-ink'}
            `}
          >
            {t.message}
          </div>
        ))}
      </div>
    </Ctx.Provider>
  )
}

export function useCustomerToast() {
  const v = useContext(Ctx)
  if (!v) throw new Error('useCustomerToast must be used inside CustomerToastProvider')
  return v.toast
}