import { usePathname, matchRoute, navigate, type Route } from './router'
import { NotFound } from './screens/NotFound'
import { Landing } from './screens/Landing'
import { Booking } from './screens/Booking'
import { Confirmation } from './screens/Confirmation'
import { Feedback } from './screens/Feedback'
import { CustomerToastProvider } from './hooks/useToast'
import { useEffect } from 'react'

/**
 * DEV-ONLY shortcut. The backend hasn't shipped the public slug →
 * business-id resolver yet, so we hardcode a business id via an env
 * var to preview the customer page during development.
 *
 * Once the backend exposes the resolver, delete this block and the
 * redirect effect below.
 */
const DEV_BUSINESS_ID = import.meta.env.VITE_DEV_BUSINESS_ID ?? ''
const DEV_MODE = import.meta.env.DEV && DEV_BUSINESS_ID.length > 0

const routes: Route[] = [
  {
    path: '/book/:businessId',
    render: ({ businessId }) => <Landing businessId={businessId} />,
  },
  {
    path: '/book/:businessId/schedule',
    render: ({ businessId }) => <Booking businessId={businessId} />,
  },
  {
    path: '/confirm/:token',
    render: ({ token }) => <Confirmation token={token} />,
  },
  {
    path: '/feedback/:token',
    render: ({ token }) => <Feedback token={token} />,
  },
]

export function CustomerApp() {
  const pathname = usePathname()

  // Dev-only: if the user hits "/" (or any path without a business id)
  // redirect them to the hardcoded dev business so the landing page
  // renders. This lets `http://localhost:5173/` show the customer page
  // without a URL-typing ritual every reload.
  useEffect(() => {
    if (!DEV_MODE) return
    if (pathname === '/' || pathname === '') {
      navigate(`/book/${DEV_BUSINESS_ID}`)
    }
  }, [pathname])

  const match = matchRoute(pathname, routes)

  return (
    <CustomerToastProvider>
      {/* Keyed on the path so every navigation gets a soft fade rather
          than a hard swap between two full-height pages. */}
      <div key={pathname} className="animate-fade-in">
        {match ? match.route.render(match.params) : <NotFound />}
      </div>
    </CustomerToastProvider>
  )
}