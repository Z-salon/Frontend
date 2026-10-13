import { createContext, useContext, useMemo, type ReactNode } from 'react'
import type { BrandingPayload } from '../../types/api'
import { buildBrand, brandVars, type Brand } from '../lib/theme'

/**
 * Mounts one `.salon-canvas` surface per customer screen and publishes
 * the tenant's derived brand ramp to descendants.
 *
 * Passing the raw `branding` payload is deliberate: the CSS variables
 * live on this element (so plain Tailwind classes can read them) while
 * the resolved `Brand` object is exposed through context for the few
 * places that need a colour for an inline `style` — canvas gradients,
 * coloured shadows, SVG fills.
 */
const BrandContext = createContext<Brand>(buildBrand(null, null))

export function BrandTheme({
  branding,
  children,
  className = '',
}: {
  branding: BrandingPayload | null
  children: ReactNode
  className?: string
}) {
  const brand = useMemo(
    () => buildBrand(branding?.primaryColor, branding?.secondaryColor),
    [branding?.primaryColor, branding?.secondaryColor],
  )

  return (
    <BrandContext.Provider value={brand}>
      <div
        style={brandVars(branding)}
        className={`salon-canvas min-h-screen text-ink ${className}`}
      >
        {children}
      </div>
    </BrandContext.Provider>
  )
}

export function useBrand(): Brand {
  return useContext(BrandContext)
}
