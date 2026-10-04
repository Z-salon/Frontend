import { useEffect, useState, type ReactNode } from 'react'

export interface Route {
  path: string
  render: (params: Record<string, string>) => ReactNode
}

export function usePathname(): string {
  const [path, setPath] = useState(() =>
    typeof window === 'undefined' ? '/' : window.location.pathname,
  )

  useEffect(() => {
    function onPop() { setPath(window.location.pathname) }
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])

  return path
}

export function navigate(to: string) {
  if (typeof window === 'undefined') return
  if (to === window.location.pathname + window.location.search) return
  window.history.pushState({}, '', to)
  window.dispatchEvent(new PopStateEvent('popstate'))
  // 'instant' rather than 'smooth': the page underneath is swapped out
  // wholesale, so animating the scroll just draws attention to the jump.
  window.scrollTo({ top: 0, behavior: 'instant' })
}

export function matchRoute(
  pathname: string,
  routes: Route[],
): { route: Route; params: Record<string, string> } | null {
  for (const route of routes) {
    const params = matchPath(route.path, pathname)
    if (params) return { route, params }
  }
  return null
}

function matchPath(pattern: string, pathname: string): Record<string, string> | null {
  const pp = pattern.split('/').filter(Boolean)
  const pn = pathname.split('/').filter(Boolean)
  if (pp.length !== pn.length) return null

  const params: Record<string, string> = {}
  for (let i = 0; i < pp.length; i++) {
    if (pp[i].startsWith(':')) {
      params[pp[i].slice(1)] = decodeURIComponent(pn[i])
    } else if (pp[i] !== pn[i]) {
      return null
    }
  }
  return params
}

/** Thin wrapper for links — no full page reload, keeps history clean. */
export function Link({
  to,
  children,
  className,
  ...rest
}: {
  to: string
  children: ReactNode
  className?: string
} & Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, 'href'>) {
  return (
    <a
      href={to}
      className={className}
      onClick={e => {
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
        e.preventDefault()
        navigate(to)
      }}
      {...rest}
    >
      {children}
    </a>
  )
}