import { useEffect, useRef, useState } from 'react'

/**
 * Reveals an element once it enters the viewport.
 * Returns a ref to attach and a boolean for the "revealed" state.
 */
export function useReveal<T extends HTMLElement = HTMLDivElement>(
  options?: IntersectionObserverInit,
) {
  const ref = useRef<T | null>(null)
  const [revealed, setRevealed] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return

    // Respect reduced-motion preferences.
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setRevealed(true)
      return
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setRevealed(true)
          observer.disconnect()
        }
      },
      { threshold: 0.15, rootMargin: '0px 0px -80px 0px', ...options },
    )

    observer.observe(el)
    return () => observer.disconnect()
  }, [options])

  return { ref, revealed }
}