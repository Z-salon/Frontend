import type { BrandingPayload } from '../../types/api'
import { useBranding } from '../hooks/useBranding'
import { themeStyle, pickTextColor } from '../hooks/UseTheme'
import { Link, navigate } from '../router'

/* ------------------------------------------------------------------ */
/*  Icons (inline so we don't add a dependency)                        */
/* ------------------------------------------------------------------ */

function IconPin({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <path
        d="M12 21s7-5.686 7-11a7 7 0 1 0-14 0c0 5.314 7 11 7 11Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="10" r="2.5" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  )
}

function IconPhone({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <path
        d="M6.5 3.5h3l1.5 4-2 1.5a12 12 0 0 0 6 6l1.5-2 4 1.5v3a2 2 0 0 1-2.2 2A17 17 0 0 1 4.5 5.7 2 2 0 0 1 6.5 3.5Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function IconClock({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <circle cx="12" cy="12" r="8.5" stroke="currentColor" strokeWidth="1.6" />
      <path d="M12 7.5V12l3 2" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  )
}

function IconArrow({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <path
        d="M5 12h13m0 0-5-5m5 5-5 5"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function IconExternal({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <path
        d="M14 5h5v5M19 5l-7 7M9 5H7a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-2"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

/* ------------------------------------------------------------------ */
/*  Landing                                                            */
/* ------------------------------------------------------------------ */

export function Landing({ businessId }: { businessId: string }) {
  const { data: branding, loading, error } = useBranding(businessId)

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-bg">
        <div className="flex items-center gap-3 text-sm text-ink-3">
          <span className="h-4 w-4 rounded-full border-2 border-ink-3/30 border-t-ink-3 animate-spin" />
          Loading…
        </div>
      </div>
    )
  }

  if (error || !branding) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-bg gap-3 px-6 text-center">
        <div
          className="h-12 w-12 rounded-2xl flex items-center justify-center text-lg"
          style={{ background: 'var(--brand-primary, #1C1C1C)', color: 'var(--brand-on-primary, #fff)' }}
          aria-hidden="true"
        >
          !
        </div>
        <h1 className="font-display text-xl text-ink">Page unavailable</h1>
        <p className="text-sm text-ink-3 max-w-md">
          {error ?? 'This business page could not be loaded.'}
        </p>
      </div>
    )
  }

  // `name` is now returned by GET /businesses/:id/branding (§3.3).
  // Fall back defensively in case an older cached payload is still around.
  const businessName = branding.name?.trim() || 'Welcome'

  const primary = branding.primaryColor ?? '#1C1C1C'
  const onPrimary = pickTextColor(primary)

  const hasServices = branding.serviceCategories.length > 0
  const hasLocations = branding.branches.length > 0
  const hasAbout = Boolean(branding.aboutUs)
  const hasCover = Boolean(branding.cover?.url)

  return (
    <div style={themeStyle(branding)} className="min-h-screen bg-bg text-ink">
      {/* ─── Header ─────────────────────────────────────────────── */}
      <header className="sticky top-0 z-30 backdrop-blur bg-bg/80 border-b border-line">
        <div className="max-w-6xl mx-auto flex items-center justify-between gap-3 px-5 sm:px-8 h-16">
          <Link
            to={`/book/${businessId}`}
            className="flex items-center gap-3 min-w-0 rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[color:var(--brand-primary,#1C1C1C)]"
          >
            {branding.logo?.url ? (
              <img
                src={branding.logo.url}
                alt=""
                className="h-9 w-9 rounded-xl object-cover flex-shrink-0 ring-1 ring-line"
                loading="eager"
                decoding="async"
              />
            ) : (
              <div
                className="h-9 w-9 rounded-xl flex items-center justify-center text-sm font-semibold flex-shrink-0"
                style={{ background: primary, color: onPrimary }}
                aria-hidden="true"
              >
                {businessName.charAt(0).toUpperCase()}
              </div>
            )}
            <span className="font-display text-base truncate">{businessName}</span>
          </Link>

          <nav className="hidden sm:flex items-center gap-1 text-sm text-ink-3">
            {hasServices && (
              <a href="#services" className="px-3 py-2 rounded-lg hover:text-ink hover:bg-warm-subtle/60 transition-colors">
                Services
              </a>
            )}
            {hasLocations && (
              <a href="#locations" className="px-3 py-2 rounded-lg hover:text-ink hover:bg-warm-subtle/60 transition-colors">
                Locations
              </a>
            )}
            {hasAbout && (
              <a href="#about" className="px-3 py-2 rounded-lg hover:text-ink hover:bg-warm-subtle/60 transition-colors">
                About
              </a>
            )}
          </nav>

          <button
            type="button"
            onClick={() => navigate(`/book/${businessId}/schedule`)}
            className="inline-flex h-10 px-4 sm:px-5 rounded-xl text-sm font-medium items-center gap-2 transition-transform hover:-translate-y-0.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[color:var(--brand-primary,#1C1C1C)]"
            style={{ background: primary, color: onPrimary }}
          >
            Book now
            <IconArrow className="h-4 w-4" />
          </button>
        </div>
      </header>

      {/* ─── Hero ───────────────────────────────────────────────── */}
      <section className="relative isolate">
        {hasCover && (
          <>
            <img
              src={branding.cover!.url}
              alt=""
              className="absolute inset-0 w-full h-full object-cover -z-10"
              loading="eager"
              decoding="async"
            />
            <div
              className="absolute inset-0 -z-10 bg-gradient-to-b from-black/70 via-black/55 to-black/80"
              aria-hidden="true"
            />
          </>
        )}

        <div
          className={`
            relative max-w-6xl mx-auto px-5 sm:px-8
            pt-20 pb-16 sm:pt-28 sm:pb-24
            ${hasCover ? 'text-white' : 'text-ink'}
          `}
        >
          <p
            className={`
              text-xs uppercase tracking-[0.18em] mb-4
              ${hasCover ? 'text-white/70' : 'text-ink-3'}
            `}
          >
            Welcome
          </p>

          <h1 className="font-display text-4xl sm:text-6xl leading-[1.05] tracking-tight mb-5 max-w-3xl">
            {businessName}
          </h1>

          {branding.description && (
            <p
              className={`
                text-base sm:text-lg max-w-2xl mb-9 leading-relaxed
                ${hasCover ? 'text-white/85' : 'text-ink-2'}
              `}
            >
              {branding.description}
            </p>
          )}

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => navigate(`/book/${businessId}/schedule`)}
              className="inline-flex h-12 px-6 rounded-xl text-base font-medium items-center gap-2 transition-transform hover:-translate-y-0.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent focus-visible:ring-[color:var(--brand-primary,#1C1C1C)]"
              style={{ background: primary, color: onPrimary }}
            >
              Book an appointment
              <IconArrow className="h-4 w-4" />
            </button>

            {hasLocations && (
              <a
                href="#locations"
                className={`
                  inline-flex h-12 px-5 rounded-xl text-base font-medium items-center gap-2
                  border transition-colors
                  ${hasCover
                    ? 'border-white/30 text-white hover:bg-white/10'
                    : 'border-line text-ink hover:bg-warm-subtle/60'}
                `}
              >
                View locations
              </a>
            )}
          </div>

          <HeroQuickInfo branding={branding} onCover={hasCover} primary={primary} />
        </div>
      </section>

      {/* ─── Services ───────────────────────────────────────────── */}
      {hasServices && (
        <section id="services" className="max-w-6xl mx-auto px-5 sm:px-8 py-16 sm:py-24">
          <SectionHeading
            eyebrow="Services"
            title="What we do best"
            subtitle="Browse our specialities — each one is delivered by our trained team."
            primary={primary}
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 sm:gap-6">
            {branding.serviceCategories.map(cat => (
              <ServiceCategoryCard
                key={cat.id}
                category={cat}
                primary={primary}
                onPrimary={onPrimary}
                businessId={businessId}
              />
            ))}
          </div>

          <div className="mt-12 flex justify-center">
            <button
              type="button"
              onClick={() => navigate(`/book/${businessId}/schedule`)}
              className="inline-flex h-12 px-6 rounded-xl text-base font-medium items-center gap-2 transition-transform hover:-translate-y-0.5"
              style={{ background: primary, color: onPrimary }}
            >
              Start booking
              <IconArrow className="h-4 w-4" />
            </button>
          </div>
        </section>
      )}

      {/* ─── Locations ──────────────────────────────────────────── */}
      {hasLocations && (
        <section id="locations" className="bg-warm-subtle/40 border-y border-line">
          <div className="max-w-6xl mx-auto px-5 sm:px-8 py-16 sm:py-24">
            <SectionHeading
              eyebrow="Locations"
              title="Visit us"
              subtitle="Find the branch closest to you — book at any of them in seconds."
              primary={primary}
            />

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
              {branding.branches.map(branch => {
                const primaryPhone =
                  branch.phones.find(p => p.isPrimary) ?? branch.phones[0]

                return (
                  <div
                    key={branch.id}
                    className="group bg-surface rounded-2xl border border-line p-5 sm:p-6 flex flex-col transition-all hover:-translate-y-0.5 hover:shadow-[0_10px_30px_-15px_rgba(0,0,0,0.15)]"
                  >
                    <div
                      className="h-10 w-10 rounded-xl flex items-center justify-center mb-4"
                      style={{ background: `${primary}14`, color: primary }}
                      aria-hidden="true"
                    >
                      <IconPin className="h-5 w-5" />
                    </div>

                    <h3 className="font-medium text-ink text-lg leading-snug">
                      {branch.name}
                    </h3>

                    {branch.address && (
                      <p className="text-sm text-ink-3 mt-1.5 leading-relaxed">
                        {branch.address}
                      </p>
                    )}

                    <div className="mt-4 flex flex-col gap-2 text-sm">
                      {primaryPhone && (
                        <a
                          href={`tel:${primaryPhone.phone}`}
                          className="inline-flex items-center gap-2 text-ink-2 hover:text-ink transition-colors"
                        >
                          <IconPhone className="h-4 w-4 text-ink-3" />
                          {primaryPhone.phone}
                        </a>
                      )}
                      {branch.email && (
                        <a
                          href={`mailto:${branch.email}`}
                          className="inline-flex items-center gap-2 text-ink-2 hover:text-ink transition-colors truncate"
                        >
                          <IconExternal className="h-4 w-4 text-ink-3" />
                          <span className="truncate">{branch.email}</span>
                        </a>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={() =>
                        navigate(`/book/${businessId}/schedule?branch=${branch.id}`)
                      }
                      className="mt-6 inline-flex h-10 px-4 rounded-xl text-sm font-medium items-center justify-center gap-2 transition-transform group-hover:-translate-y-0.5"
                      style={{ background: primary, color: onPrimary }}
                    >
                      Book at this branch
                      <IconArrow className="h-4 w-4" />
                    </button>
                  </div>
                )
              })}
            </div>
          </div>
        </section>
      )}

      {/* ─── About ──────────────────────────────────────────────── */}
      {hasAbout && (
        <section id="about" className="max-w-3xl mx-auto px-5 sm:px-8 py-16 sm:py-24">
          <SectionHeading
            eyebrow="About"
            title="Our story"
            primary={primary}
            align="left"
          />
          <p className="text-base sm:text-lg text-ink-2 leading-relaxed whitespace-pre-line mt-2">
            {branding.aboutUs}
          </p>
        </section>
      )}

      {/* ─── Footer ─────────────────────────────────────────────── */}
      <footer className="border-t border-line">
        <div className="max-w-6xl mx-auto px-5 sm:px-8 py-10 flex flex-col sm:flex-row gap-6 sm:items-center sm:justify-between">
          <div className="flex items-center gap-3 min-w-0">
            {branding.logo?.url ? (
              <img
                src={branding.logo.url}
                alt=""
                className="h-9 w-9 rounded-xl object-cover ring-1 ring-line"
                loading="lazy"
                decoding="async"
              />
            ) : (
              <div
                className="h-9 w-9 rounded-xl flex items-center justify-center text-sm font-semibold"
                style={{ background: primary, color: onPrimary }}
                aria-hidden="true"
              >
                {businessName.charAt(0).toUpperCase()}
              </div>
            )}
            <div className="min-w-0">
              <p className="text-sm font-medium text-ink truncate">{businessName}</p>
              <p className="text-xs text-ink-3">Book online in a few taps.</p>
            </div>
          </div>

          <SocialRow branding={branding} />

          <p className="text-[11px] text-ink-3 whitespace-nowrap">
            Powered by{' '}
            <a
              href="https://zsalon.com"
              className="text-ink-2 underline underline-offset-2 hover:text-ink"
            >
              Z-Salon
            </a>
          </p>
        </div>
      </footer>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Section heading                                                    */
/* ------------------------------------------------------------------ */

function SectionHeading({
  eyebrow,
  title,
  subtitle,
  primary,
  align = 'left',
}: {
  eyebrow?: string
  title: string
  subtitle?: string
  primary: string
  align?: 'left' | 'center'
}) {
  return (
    <div className={`mb-10 sm:mb-12 ${align === 'center' ? 'text-center' : ''}`}>
      {eyebrow && (
        <p
          className="text-xs uppercase tracking-[0.18em] mb-3 flex items-center gap-2"
          style={{ color: primary }}
        >
          <span className="h-px w-6" style={{ background: primary }} />
          {eyebrow}
        </p>
      )}
      <h2 className="font-display text-3xl sm:text-4xl leading-tight tracking-tight">
        {title}
      </h2>
      {subtitle && (
        <p className="text-sm sm:text-base text-ink-3 mt-2 max-w-2xl">
          {subtitle}
        </p>
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Hero quick info                                                    */
/* ------------------------------------------------------------------ */

function HeroQuickInfo({
  branding,
  onCover,
  primary,
}: {
  branding: BrandingPayload
  onCover: boolean
  primary: string
}) {
  const firstBranch = branding.branches[0]
  const primaryPhone =
    firstBranch?.phones.find(p => p.isPrimary) ?? firstBranch?.phones[0]

  const items: Array<{ icon: React.ReactNode; label: string; value: string }> = []

  if (firstBranch?.address) {
    items.push({
      icon: <IconPin className="h-4 w-4" />,
      label: 'Location',
      value: firstBranch.address,
    })
  }
  if (primaryPhone) {
    items.push({
      icon: <IconPhone className="h-4 w-4" />,
      label: 'Call us',
      value: primaryPhone.phone,
    })
  }
  if (firstBranch?.timezone) {
    items.push({
      icon: <IconClock className="h-4 w-4" />,
      label: 'Timezone',
      value: firstBranch.timezone.replace('_', ' '),
    })
  }

  if (items.length === 0) return null

  return (
    <div className="mt-12 sm:mt-14 grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 max-w-2xl">
      {items.map((item, i) => (
        <div
          key={i}
          className={`
            rounded-xl p-4 backdrop-blur-sm border
            ${onCover
              ? 'bg-white/10 border-white/15 text-white'
              : 'bg-surface border-line text-ink'}
          `}
        >
          <div
            className="flex items-center gap-2 text-xs uppercase tracking-wider mb-1.5"
            style={{ color: onCover ? 'rgba(255,255,255,0.7)' : primary }}
          >
            {item.icon}
            {item.label}
          </div>
          <p className="text-sm leading-snug truncate">{item.value}</p>
        </div>
      ))}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Service category card                                              */
/* ------------------------------------------------------------------ */

function ServiceCategoryCard({
  category,
  primary,
  onPrimary,
  businessId,
}: {
  category: BrandingPayload['serviceCategories'][number]
  primary: string
  onPrimary: string
  businessId: string
}) {
  const hasWorks = category.sampleWorks.length > 0
  const heroWork = hasWorks ? category.sampleWorks[0] : null

  return (
    <button
      type="button"
      onClick={() => navigate(`/book/${businessId}/schedule`)}
      className="group text-left bg-surface rounded-2xl border border-line overflow-hidden flex flex-col transition-all hover:-translate-y-1 hover:shadow-[0_15px_40px_-20px_rgba(0,0,0,0.25)] focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[color:var(--brand-primary,#1C1C1C)]"
    >
      {heroWork ? (
        <div className="relative aspect-[4/3] overflow-hidden bg-warm-subtle">
          <img
            src={heroWork.url}
            alt={heroWork.name}
            className="w-full h-full object-cover group-hover:scale-[1.06] transition-transform duration-500 ease-out"
            loading="lazy"
            decoding="async"
          />
          {category.sampleWorks.length > 1 && (
            <span
              className="absolute bottom-3 right-3 text-[11px] font-medium px-2 py-1 rounded-lg backdrop-blur-sm"
              style={{ background: 'rgba(0,0,0,0.55)', color: '#fff' }}
            >
              +{category.sampleWorks.length - 1} photos
            </span>
          )}
        </div>
      ) : (
        <div
          className="aspect-[4/3] flex items-center justify-center"
          style={{ background: `${primary}10`, color: primary }}
          aria-hidden="true"
        >
          <span className="font-display text-4xl opacity-60">
            {category.name.charAt(0).toUpperCase()}
          </span>
        </div>
      )}

      <div className="p-5 flex flex-col flex-1">
        <h3 className="font-medium text-ink text-lg leading-snug">
          {category.name}
        </h3>
        {category.description && (
          <p className="text-sm text-ink-3 mt-1.5 line-clamp-2 leading-relaxed">
            {category.description}
          </p>
        )}

        <span
          className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium transition-transform group-hover:translate-x-0.5"
          style={{ color: primary }}
        >
          Book this
          <IconArrow className="h-4 w-4" />
        </span>
      </div>
    </button>
  )
}

/* ------------------------------------------------------------------ */
/*  Socials                                                            */
/* ------------------------------------------------------------------ */

function SocialRow({ branding }: { branding: BrandingPayload }) {
  const links: Array<{ key: string; label: string; href: string }> = []
  if (branding.website)      links.push({ key: 'web',       label: 'Website',   href: branding.website })
  if (branding.instagramUrl) links.push({ key: 'instagram', label: 'Instagram', href: branding.instagramUrl })
  if (branding.facebookUrl)  links.push({ key: 'facebook',  label: 'Facebook',  href: branding.facebookUrl })
  if (branding.telegramUrl)  links.push({ key: 'telegram',  label: 'Telegram',  href: branding.telegramUrl })
  if (branding.tiktokUrl)    links.push({ key: 'tiktok',    label: 'TikTok',    href: branding.tiktokUrl })

  if (links.length === 0) return null

  return (
    <div className="flex flex-wrap items-center gap-2">
      {links.map(l => (
        <a
          key={l.key}
          href={l.href}
          target="_blank"
          rel="noreferrer"
          className="text-xs px-3 py-1.5 rounded-lg border border-line text-ink-3 hover:text-ink hover:bg-warm-subtle/60 transition-colors"
        >
          {l.label}
        </a>
      ))}
    </div>
  )
}