import { useState, type ReactNode } from 'react'
import type { BrandingPayload } from '../../types/api'
import { navigate } from '../router'
import { useFeedbackToken } from '../hooks/useFeedbackToken'
import { mapsUrlFor } from '../lib/locations'
import { Button, Logo, PoweredBy } from './ui'
import {
  IconArrowLeft,
  IconArrowRight,
  IconArrowUpRight,
  IconChevronRight,
  IconFacebook,
  IconGlobe,
  IconInstagram,
  IconMail,
  IconMenu,
  IconPhone,
  IconPin,
  IconTelegram,
  IconTiktok,
  IconX,
} from './icons'

/* ================================================================== */
/*  Storefront header                                                  */
/* ================================================================== */

export interface NavAnchor {
  id: string
  label: string
}

/**
 * Sticky storefront header. The wordmark is the tenant's own logo (or a
 * monogram fallback) paired with a champagne hairline, so the bar reads
 * as a salon rather than as the SaaS product that powers it.
 */
export function StorefrontHeader({
  branding,
  businessId,
  anchors,
}: {
  branding: BrandingPayload
  businessId: string
  anchors: NavAnchor[]
}) {
  const [menuOpen, setMenuOpen] = useState(false)
  const name = branding.name?.trim() || 'Salon'

  function goSchedule() {
    setMenuOpen(false)
    navigate(`/book/${businessId}/schedule`)
  }

  return (
    <header className="glass-bar sticky top-0 z-40 border-b border-line/70">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-5 sm:h-[4.5rem] sm:px-8">
        <a
          href={`#top`}
          onClick={e => {
            e.preventDefault()
            window.scrollTo({ top: 0, behavior: 'smooth' })
          }}
          className="focus-ring group flex min-w-0 items-center gap-3 rounded-xl"
        >
          <Logo url={branding.logo?.url} name={name} />
          <span className="min-w-0">
            <span className="block truncate font-display text-[1.05rem] leading-tight tracking-tight text-ink">
              {name}
            </span>
            <span className="block truncate text-[10px] font-semibold uppercase tracking-[0.22em] text-[color:var(--brand-accent)]">
              Book online
            </span>
          </span>
        </a>

        {anchors.length > 0 && (
          <nav className="hidden items-center gap-1 md:flex" aria-label="Sections">
            {anchors.map(a => (
              <a
                key={a.id}
                href={`#${a.id}`}
                className="focus-ring rounded-lg px-3.5 py-2 text-sm text-ink-2 transition-colors hover:bg-warm-subtle/70 hover:text-ink"
              >
                {a.label}
              </a>
            ))}
          </nav>
        )}

        <div className="flex items-center gap-2">
          <Button
            onClick={goSchedule}
            size="sm"
            className="hidden sm:inline-flex"
            iconRight={<IconArrowRight className="h-3.5 w-3.5" />}
          >
            Book now
          </Button>

          {anchors.length > 0 && (
            <button
              type="button"
              onClick={() => setMenuOpen(v => !v)}
              aria-expanded={menuOpen}
              aria-label={menuOpen ? 'Close menu' : 'Open menu'}
              className="focus-ring flex h-10 w-10 items-center justify-center rounded-xl border border-line bg-surface text-ink-2 transition-colors hover:text-ink md:hidden"
            >
              {menuOpen ? <IconX className="h-4 w-4" /> : <IconMenu className="h-4 w-4" />}
            </button>
          )}
        </div>
      </div>

      {menuOpen && (
        <div className="animate-fade-in border-t border-line bg-surface/95 backdrop-blur md:hidden">
          <nav className="mx-auto flex max-w-6xl flex-col px-5 py-3" aria-label="Sections">
            {anchors.map(a => (
              <a
                key={a.id}
                href={`#${a.id}`}
                onClick={() => setMenuOpen(false)}
                className="flex items-center justify-between border-b border-line/60 py-3.5 text-[15px] text-ink-2 last:border-0"
              >
                {a.label}
                <IconChevronRight className="h-4 w-4 text-ink-3" />
              </a>
            ))}
            <Button onClick={goSchedule} fullWidth className="mt-4 mb-2">
              Book now
            </Button>
          </nav>
        </div>
      )}
    </header>
  )
}

/* ================================================================== */
/*  Flow header — booking / confirmation / feedback                    */
/* ================================================================== */

/**
 * Compact header for the focused, task-style screens. It keeps the
 * tenant's identity visible but gives the flow all the width.
 */
export function FlowHeader({
  branding,
  backTo,
  backLabel,
  step,
}: {
  branding: BrandingPayload | null
  backTo: string
  backLabel: string
  step?: string
}) {
  const name = branding?.name?.trim() || 'Z-Salon'

  return (
    <header className="glass-bar sticky top-0 z-40 border-b border-line/70">
      <div className="mx-auto flex h-16 max-w-5xl items-center justify-between gap-4 px-5 sm:px-8">
        <button
          type="button"
          onClick={() => navigate(backTo)}
          className="focus-ring group flex min-w-0 items-center gap-2.5 rounded-xl text-left"
        >
          <Logo url={branding?.logo?.url} name={name} size="sm" />
          <span className="min-w-0">
            <span className="block truncate font-display text-[0.95rem] leading-tight text-ink">
              {name}
            </span>
            <span className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-ink-3 transition-colors group-hover:text-ink-2">
              <IconArrowLeft className="h-3 w-3" />
              {backLabel}
            </span>
          </span>
        </button>

        {step && (
          <span className="flex-shrink-0 text-[11px] font-semibold uppercase tracking-[0.2em] text-ink-3">
            {step}
          </span>
        )}
      </div>
    </header>
  )
}

/* ================================================================== */
/*  Footer                                                             */
/* ================================================================== */

type SocialKey =
  | 'instagramUrl'
  | 'facebookUrl'
  | 'telegramUrl'
  | 'tiktokUrl'
  | 'website'

const SOCIAL_LINKS: Array<{
  key: SocialKey
  label: string
  icon: (className: string) => ReactNode
}> = [
  { key: 'instagramUrl', label: 'Instagram', icon: cls => <IconInstagram className={cls} /> },
  { key: 'facebookUrl', label: 'Facebook', icon: cls => <IconFacebook className={cls} /> },
  { key: 'telegramUrl', label: 'Telegram', icon: cls => <IconTelegram className={cls} /> },
  { key: 'tiktokUrl', label: 'TikTok', icon: cls => <IconTiktok className={cls} /> },
  { key: 'website', label: 'Website', icon: cls => <IconGlobe className={cls} /> },
]

export function StorefrontFooter({
  branding,
  businessId,
  anchors,
}: {
  branding: BrandingPayload
  businessId: string
  anchors: NavAnchor[]
}) {
  const name = branding.name?.trim() || 'Salon'
  const branch = branding.branches[0]
  const phone = branch?.phones.find(p => p.isPrimary) ?? branch?.phones[0]
  const year = new Date().getFullYear()

  // Feedback needs a token the backend mints after the visit, so this link
  // only exists for a customer who already has one — either the salon's link
  // carried `?feedback=` or they opened a feedback form before. Rendering it
  // unconditionally would send everyone to a dead route.
  const { token: feedbackToken } = useFeedbackToken(businessId)

  return (
    <footer className="relative overflow-hidden border-t border-line">
      <div
        className="pointer-events-none absolute -right-24 -top-24 h-64 w-64 rounded-full opacity-60 blur-3xl"
        style={{ background: 'var(--brand-soft-strong)' }}
        aria-hidden="true"
      />

      <div className="relative mx-auto max-w-6xl px-5 py-14 sm:px-8 sm:py-20">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr] lg:gap-14">
          {/* Identity */}
          <div>
            <div className="flex items-center gap-3">
              <Logo url={branding.logo?.url} name={name} size="lg" />
              <div>
                <p className="font-display text-xl leading-tight text-ink">{name}</p>
                <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-[0.24em] text-[color:var(--brand-accent)]">
                  Salon &amp; Spa
                </p>
              </div>
            </div>
            {branding.description && (
              <p className="mt-5 max-w-sm text-sm leading-relaxed text-ink-2">
                {branding.description}
              </p>
            )}
            <div className="mt-6">
              <Button
                size="sm"
                onClick={() => navigate(`/book/${businessId}/schedule`)}
                iconRight={<IconArrowRight className="h-3.5 w-3.5" />}
              >
                Book an appointment
              </Button>
            </div>
          </div>

          {/* Explore */}
          <div>
            <FooterHeading>Explore</FooterHeading>
            <ul className="mt-4 space-y-2.5">
              {anchors.map(a => (
                <li key={a.id}>
                  <a
                    href={`#${a.id}`}
                    className="focus-ring inline-block rounded text-sm text-ink-2 transition-colors hover:text-ink"
                  >
                    {a.label}
                  </a>
                </li>
              ))}
              <li>
                <button
                  type="button"
                  onClick={() => navigate(`/book/${businessId}/schedule`)}
                  className="focus-ring inline-block rounded text-sm text-ink-2 transition-colors hover:text-ink"
                >
                  Book online
                </button>
              </li>
              {feedbackToken && (
                <li>
                  <button
                    type="button"
                    onClick={() => navigate(`/feedback/${feedbackToken}`)}
                    className="focus-ring inline-block rounded text-sm text-ink-2 transition-colors hover:text-ink"
                  >
                    Leave feedback
                  </button>
                </li>
              )}
            </ul>
          </div>

          {/* Visit */}
          <div>
            <FooterHeading>Visit</FooterHeading>
            <ul className="mt-4 space-y-3.5 text-sm text-ink-2">
              {branding.branches.slice(0, 3).map(b => {
                const mapsUrl = mapsUrlFor(b.address)
                return (
                  <li key={b.id} className="flex gap-2.5">
                    <IconPin className="mt-0.5 h-4 w-4 flex-shrink-0 text-[color:var(--brand-accent)]" />
                    <span className="min-w-0">
                      {/* The name is the link, not the address below it: a salon
                          that pasted a Maps URL would otherwise show a raw
                          query string as body copy. Falls back to plain text
                          when there's no address to resolve, so no dead links. */}
                      {mapsUrl ? (
                        <a
                          href={mapsUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          aria-label={`${b.name} on Google Maps (opens in a new tab)`}
                          className="focus-ring group inline-flex w-fit items-center gap-1 rounded font-medium text-ink transition-colors hover:text-[color:var(--brand-accent)]"
                        >
                          {b.name}
                          <IconArrowUpRight className="h-3 w-3 opacity-0 transition-opacity group-hover:opacity-60" />
                          <span className="sr-only"> (opens in a new tab)</span>
                        </a>
                      ) : (
                        <span className="block font-medium text-ink">{b.name}</span>
                      )}
                      {b.address && (
                        <span className="mt-0.5 block text-[13px] leading-relaxed text-ink-3">
                          {b.address}
                        </span>
                      )}
                    </span>
                  </li>
                )
              })}
              {!branding.branches.length && (
                <li className="text-ink-3">No locations listed yet.</li>
              )}
            </ul>

            <div className="mt-5 flex flex-col gap-2.5 text-sm">
              {phone && (
                <a
                  href={`tel:${phone.phone}`}
                  className="focus-ring inline-flex w-fit items-center gap-2 rounded text-ink-2 transition-colors hover:text-ink"
                >
                  <IconPhone className="h-4 w-4 text-ink-3" />
                  {phone.phone}
                </a>
              )}
              {branch?.email && (
                <a
                  href={`mailto:${branch.email}`}
                  className="focus-ring inline-flex w-fit items-center gap-2 rounded truncate text-ink-2 transition-colors hover:text-ink"
                >
                  <IconMail className="h-4 w-4 text-ink-3" />
                  {branch.email}
                </a>
              )}
            </div>
          </div>
        </div>

        {hasSocials(branding) && (
          <div className="mt-12 flex flex-wrap items-center gap-2 border-t border-line pt-8">
            {SOCIAL_LINKS.map(l => {
              const href = branding[l.key]
              if (!href) return null
              return (
                <a
                  key={l.key as string}
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`${name} on ${l.label} (opens in a new tab)`}
                  title={l.label}
                  className="focus-ring inline-flex h-10 w-10 items-center justify-center rounded-full border border-line bg-surface text-ink-2 transition-colors hover:border-warm hover:text-[color:var(--brand-accent)]"
                >
                  {l.icon('h-[18px] w-[18px]')}
                </a>
              )
            })}
          </div>
        )}
      </div>

      <div className="border-t border-line/70">
        <div className="mx-auto flex max-w-6xl flex-col items-center gap-3 px-5 py-6 sm:flex-row sm:justify-between sm:px-8">
          <p className="text-[11px] tracking-wide text-ink-3">
            © {year} {name}. All rights reserved.
          </p>
          <PoweredBy />
        </div>
      </div>
    </footer>
  )
}

function FooterHeading({ children }: { children: ReactNode }) {
  return (
    <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-ink-3">
      {children}
    </p>
  )
}

function hasSocials(b: BrandingPayload): boolean {
  return SOCIAL_LINKS.some(l => Boolean(b[l.key]))
}

/* ================================================================== */
/*  Footer for the tokenised flow screens                              */
/* ================================================================== */

/** Slim footer for confirmation / feedback — identity only. */
