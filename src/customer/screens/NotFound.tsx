import { Link } from '../router'

export function NotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-bg text-ink gap-3 px-6 text-center">
      <h1 className="font-display text-2xl">Page not found</h1>
      <p className="text-sm text-ink-3 max-w-sm">
        Check the link you were given, or ask the business for a fresh one.
      </p>
      <Link
        to="/"
        className="text-sm text-ink-2 underline underline-offset-2 hover:text-ink"
      >
        Go home
      </Link>
    </div>
  )
}