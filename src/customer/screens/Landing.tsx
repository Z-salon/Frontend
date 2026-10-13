import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { BrandingPayload } from '../../types/api'
import { useBranding } from '../hooks/useBranding'
import { useBranchCategories } from '../hooks/useBranchCategories'
import { navigate } from '../router'
import { BrandTheme } from '../components/BrandTheme'
import {
  StorefrontFooter,
  StorefrontHeader,
  type NavAnchor,
} from '../components/SiteChrome'
import {
  Button,
  Card,
  Eyebrow,
  Logo,
  Modal,
  Pill,
  SectionHeading,
} from '../components/ui'
import {
  IconArrowRight,
  IconCamera,
  IconClock,
  IconImage,
  IconMail,
  IconPhone,
  IconPin,
  IconScissors,
  IconSparkle,
} from '../components/icons'
import { formatTimezone } from '../utils/format'
import { isUrlAddress, mapsUrlFor } from '../lib/locations'

export function Landing({ businessId }: { businessId: string }) {
  const { data: branding, loading, error } = useBranding(businessId)

  if (loading) return <LoadingLanding />
  if (error || !branding) return <UnavailableLanding message={error} />

  return (
    <BrandTheme branding={branding}>
      <Storefront branding={branding} businessId={businessId} />
    </BrandTheme>
  )
}

/* ================================================================== */
/*  Scroll reveal                                                      */
/* ================================================================== */

function useReveal<T extends HTMLElement = HTMLDivElement>(
  options?: IntersectionObserverInit,
) {
  const ref = useRef<T | null>(null)
  const [revealed, setRevealed] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return

    if (
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    ) {
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

function Reveal({
  children,
  delay = 0,
  className = '',
  as: Tag = 'div',
}: {
  children: ReactNode
  delay?: number
  className?: string
  as?: 'div' | 'section' | 'figure' | 'article'
}) {
  const { ref, revealed } = useReveal<HTMLDivElement>()

  return (
    <Tag
      ref={ref as never}
      className={`
        transition-[opacity,transform] duration-700 ease-out will-change-transform
        ${revealed ? 'translate-y-0 opacity-100' : 'translate-y-8 opacity-0'}
        ${className}
      `}
      style={{ transitionDelay: revealed ? `${delay}ms` : '0ms' }}
    >
      {children}
    </Tag>
  )
}

/* ================================================================== */
/*  Page                                                               */
/* ================================================================== */

function Storefront({
  branding,
  businessId,
}: {
  branding: BrandingPayload
  businessId: string
}) {
  const name = branding.name?.trim() || 'Salon'

  const anchors = useMemo<NavAnchor[]>(() => {
    const list: NavAnchor[] = []
    if (branding.serviceCategories.length) list.push({ id: 'services', label: 'Services' })
    if (totalWorks(branding) > 0) list.push({ id: 'gallery', label: 'Our work' })
    if (branding.branches.length) list.push({ id: 'locations', label: 'Locations' })
    if (branding.aboutUs?.trim()) list.push({ id: 'about', label: 'About' })
    return list
  }, [branding])

  const works = useMemo(() => collectWorks(branding), [branding])

  return (
    <div className="flex min-h-screen flex-col">
      <StorefrontHeader branding={branding} businessId={businessId} anchors={anchors} />

      <main className="flex-1">
        <Hero branding={branding} businessId={businessId} />

        {anchors.some(a => a.id === 'services') && (
          <Reveal as="section">
            <Services branding={branding} businessId={businessId} />
          </Reveal>
        )}

        {works.length > 0 && (
          <Reveal as="section">
            <Gallery works={works} />
          </Reveal>
        )}

        {anchors.some(a => a.id === 'locations') && (
          <Reveal as="section">
            <Locations branding={branding} businessId={businessId} />
          </Reveal>
        )}

        {branding.aboutUs?.trim() && (
          <Reveal as="section">
            <About branding={branding} name={name} />
          </Reveal>
        )}
      </main>

      <StorefrontFooter branding={branding} businessId={businessId} anchors={anchors} />
    </div>
  )
}

/* ================================================================== */
/*  Hero                                                               */
/* ================================================================== */

function Hero({
  branding,
  businessId,
}: {
  branding: BrandingPayload
  businessId: string
}) {
  const name = branding.name?.trim() || 'Salon'
  const cover = branding.cover?.url
  const branch = branding.branches[0]
  const phone = branch?.phones.find(p => p.isPrimary) ?? branch?.phones[0]

  const stats: Array<{ value: number; label: string }> = [
    { value: branding.branches.length, label: 'Locations' },
    { value: branding.serviceCategories.length, label: 'Specialities' },
    { value: totalWorks(branding), label: 'Signature looks' },
  ].filter(s => s.value > 0)

  // Address is deliberately absent here: the Locations section below owns it,
  // and repeating it above the fold left the first thing you read as "here is
  // where we are" before any service or look had been shown.
  const quickFacts: Array<{ icon: ReactNode; label: string; value: string }> = []
  if (phone) {
    quickFacts.push({ icon: <IconPhone className="h-4 w-4" />, label: 'Call', value: phone.phone })
  }
  const tz = branch?.timezone || branding.timezone
  if (tz) {
    quickFacts.push({ icon: <IconClock className="h-4 w-4" />, label: 'Local time', value: formatTimezone(tz) })
  }

  return (
    <section id="top" className="relative isolate overflow-hidden">
      {cover ? (
        <>
          <img
            src={cover}
            alt=""
            className="absolute inset-0 -z-20 h-full w-full object-cover"
            loading="eager"
            decoding="async"
          />
          <div
            className="absolute inset-0 -z-10 bg-gradient-to-br from-ink/85 via-ink/65 to-ink/80"
            aria-hidden="true"
          />
          <div
            className="absolute inset-0 -z-10"
            style={{
              background:
                'radial-gradient(60rem 32rem at 88% 8%, rgba(196,169,125,0.28), transparent 62%)',
            }}
            aria-hidden="true"
          />
        </>
      ) : (
        <div
          className="absolute inset-0 -z-10"
          style={{
            background:
              'linear-gradient(140deg, var(--brand-soft) 0%, rgba(245,237,224,0.7) 45%, rgba(249,237,236,0.8) 100%)',
          }}
          aria-hidden="true"
        />
      )}

      <div className="mx-auto max-w-6xl px-5 pb-16 pt-14 sm:px-8 sm:pb-24 sm:pt-20">
        <div className="max-w-3xl">
          <Eyebrow tone={cover ? 'light' : 'ink'}>
            {cover ? 'Welcome' : 'Welcome to'}
          </Eyebrow>

          <h1
            className={`
              mt-5 font-display text-[2.75rem] leading-[1.03] tracking-tight sm:text-6xl lg:text-7xl
              ${cover ? 'text-white' : 'text-ink'}
            `}
          >
            {name}
          </h1>

          {branding.description && (
            <p
              className={`
                mt-6 max-w-xl text-base leading-relaxed sm:text-lg
                ${cover ? 'text-white/80' : 'text-ink-2'}
              `}
            >
              {branding.description}
            </p>
          )}

          <div className="mt-9 flex flex-wrap items-center gap-3">
            <Button
              size="lg"
              onClick={() => navigateSchedule(businessId)}
              iconRight={<IconArrowRight className="h-4 w-4" />}
            >
              Book an appointment
            </Button>
            {branding.branches.length > 0 && (
              <Button
                size="lg"
                variant={cover ? 'onImage' : 'outline'}
                onClick={() => scrollTo('locations')}
              >
                {branding.branches.length > 1
                  ? `Our ${branding.branches.length} locations`
                  : 'Find us'}
              </Button>
            )}
          </div>

          {quickFacts.length > 0 && (
            <dl
              className={`
                mt-12 grid max-w-2xl gap-px overflow-hidden rounded-2xl border
                [grid-template-columns:repeat(auto-fit,minmax(11rem,1fr))]
                ${cover ? 'border-white/15 bg-white/10' : 'border-line bg-line'}
              `}
            >
              {quickFacts.map(f => (
                <div
                  key={f.label}
                  className={`px-5 py-4 ${cover ? 'bg-ink/25' : 'bg-surface'}`}
                >
                  <dt
                    className={`flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.2em] ${
                      cover ? 'text-white/60' : 'text-[color:var(--brand-accent)]'
                    }`}
                  >
                    {f.icon}
                    {f.label}
                  </dt>
                  <dd
                    className={`mt-1.5 text-sm leading-snug ${cover ? 'text-white/90' : 'text-ink'}`}
                  >
                    {f.value}
                  </dd>
                </div>
              ))}
            </dl>
          )}
        </div>

        {stats.length > 0 && (
          <div
            className={`mt-14 flex flex-wrap items-center gap-x-10 gap-y-6 border-t pt-8 ${
              cover ? 'border-white/15' : 'border-line'
            }`}
          >
            {stats.map(s => (
              <div key={s.label}>
                <p
                  className={`font-display text-3xl leading-none sm:text-4xl ${
                    cover ? 'text-white' : 'text-ink'
                  }`}
                >
                  {s.value}
                </p>
                <p
                  className={`mt-1.5 text-[10px] font-semibold uppercase tracking-[0.22em] ${
                    cover ? 'text-white/55' : 'text-ink-3'
                  }`}
                >
                  {s.label}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  )
}

/* ================================================================== */
/*  Services                                                           */
/* ================================================================== */

function Services({
  branding,
  businessId,
}: {
  branding: BrandingPayload
  businessId: string
}) {
  const [galleryCategory, setGalleryCategory] = useState<
    BrandingPayload['serviceCategories'][number] | null
  >(null)

  return (
    <section id="services" className="relative py-20 sm:py-28">
      <div className="mx-auto max-w-6xl px-5 sm:px-8">
        <Reveal className="flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
          <SectionHeading
            eyebrow="Services"
            title={
              <>
                Treatments our team
                <br className="hidden sm:block" /> is known for
              </>
            }
            subtitle="Every service below is delivered by trained professionals. Pick one and we'll show you the next time that suits you."
          />
          <Button
            variant="outline"
            className="shrink-0 self-start lg:self-auto"
            onClick={() => navigateSchedule(businessId)}
            iconRight={<IconArrowRight className="h-4 w-4" />}
          >
            See all times
          </Button>
        </Reveal>

        <div className="mt-12 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {branding.serviceCategories.map((cat, i) => (
            <Reveal key={cat.id} delay={Math.min(i, 5) * 70}>
              <ServiceCategoryCard
                category={cat}
                index={i}
                businessId={businessId}
                onOpenGallery={setGalleryCategory}
              />
            </Reveal>
          ))}
        </div>
      </div>

      <SampleWorkGallery
        category={galleryCategory}
        onClose={() => setGalleryCategory(null)}
      />
    </section>
  )
}

function ServiceCategoryCard({
  category,
  index,
  businessId,
  onOpenGallery,
}: {
  category: BrandingPayload['serviceCategories'][number]
  index: number
  businessId: string
  onOpenGallery: (category: BrandingPayload['serviceCategories'][number]) => void
}) {
  const hero = category.sampleWorks[0]
  const extra = category.sampleWorks.length - 1
  const hasWork = category.sampleWorks.length > 0

  /* Was one big <button> that navigated to the scheduler. The photo is its
     own control now, so a button can't legally wrap it — hence a div with
     two sibling targets: the image opens the gallery, the CTA books. */
  return (
    <div
      className="group flex h-full w-full flex-col overflow-hidden rounded-2xl border border-line bg-surface text-left shadow-card transition-[transform,box-shadow,border-color] duration-300 hover:-translate-y-1.5 hover:border-warm hover:shadow-lift"
      style={{ animationDelay: `${Math.min(index, 5) * 70}ms` }}
    >
      <div className="relative aspect-[5/4] overflow-hidden bg-warm-subtle">
        {hasWork ? (
          <>
            <button
              type="button"
              onClick={() => onOpenGallery(category)}
              aria-label={
                extra > 0
                  ? `View all ${category.sampleWorks.length} photos of ${category.name}`
                  : `View photo of ${category.name}`
              }
              className="focus-ring absolute inset-0 h-full w-full cursor-zoom-in"
            >
              <img
                src={hero.url}
                alt={hero.name}
                className="h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-105"
                loading="lazy"
                decoding="async"
              />
              <div
                className="absolute inset-0 bg-gradient-to-t from-ink/45 via-transparent to-transparent opacity-70"
                aria-hidden="true"
              />
            </button>
            {extra > 0 && (
              <span
                aria-hidden="true"
                className="pointer-events-none absolute bottom-3 right-3 inline-flex items-center gap-1.5 rounded-full bg-ink/55 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-white backdrop-blur-sm"
              >
                <IconCamera className="h-3 w-3" />+{extra}
              </span>
            )}
          </>
        ) : (
          <div
            className="flex h-full w-full items-center justify-center"
            style={{ background: 'var(--brand-soft)' }}
            aria-hidden="true"
          >
            <IconScissors className="h-10 w-10 text-[color:var(--brand-accent)] opacity-40" />
          </div>
        )}
      </div>

      <div className="flex flex-1 flex-col p-6">
        <h3 className="font-display text-xl leading-snug text-ink">{category.name}</h3>
        {category.description && (
          <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-ink-3">
            {category.description}
          </p>
        )}
        {hasWork && (
          <button
            type="button"
            onClick={() => onOpenGallery(category)}
            className="focus-ring mt-4 inline-flex w-fit items-center gap-1.5 text-[13px] font-semibold text-[color:var(--brand-accent)]"
          >
            <IconCamera className="h-3.5 w-3.5" />
            View {category.sampleWorks.length}{' '}
            {category.sampleWorks.length === 1 ? 'photo' : 'photos'}
          </button>
        )}
        <button
          type="button"
          onClick={() => navigateSchedule(businessId)}
          className="focus-ring group/cta mt-auto inline-flex w-fit items-center gap-1.5 pt-5 text-[13px] font-semibold text-[color:var(--brand-accent)]"
        >
          <span className="border-b border-transparent pb-0.5 transition-colors group-hover/cta:border-current">
            Choose this service
          </span>
          <IconArrowRight className="h-3.5 w-3.5 transition-transform duration-300 group-hover/cta:translate-x-1" />
        </button>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Sample-work gallery                                                */
/* ------------------------------------------------------------------ */

function SampleWorkGallery({
  category,
  onClose,
}: {
  category: BrandingPayload['serviceCategories'][number] | null
  onClose: () => void
}) {
  const works = category?.sampleWorks ?? []

  return (
    <Modal
      open={category !== null}
      onClose={onClose}
      title={category?.name ?? ''}
      description={
        works.length === 1
          ? 'A look from our portfolio.'
          : `${works.length} looks from our portfolio.`
      }
      size="lg"
      centered
    >
      <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {works.map(work => (
          <li key={work.id}>
            <figure className="flex h-full flex-col overflow-hidden rounded-2xl border border-line bg-bg">
              <img
                src={work.url}
                alt={work.name}
                loading="lazy"
                decoding="async"
                className="aspect-[4/3] w-full object-cover"
              />
              <figcaption className="flex flex-col gap-1 p-4">
                <p className="text-sm font-semibold text-ink">{work.name}</p>
                {work.description && (
                  <p className="text-[13px] leading-relaxed text-ink-3">
                    {work.description}
                  </p>
                )}
              </figcaption>
            </figure>
          </li>
        ))}
      </ul>
    </Modal>
  )
}

/* ================================================================== */
/*  Gallery                                                            */
/* ================================================================== */

interface GalleryItem {
  id: string
  url: string
  name: string
  category: string
}

function Gallery({ works }: { works: GalleryItem[] }) {
  return (
    <section
      id="gallery"
      className="relative border-y border-line/70 bg-cream/70 py-20 sm:py-28"
    >
      <div className="mx-auto max-w-6xl px-5 sm:px-8">
        <Reveal>
          <SectionHeading
            eyebrow="Our work"
            title="Recent from the chair"
            subtitle="A look at the finishes our guests are booking this season."
          />
        </Reveal>

        <div className="mt-12 columns-1 gap-4 sm:columns-2 lg:columns-3">
          {works.map((w, i) => (
            <Reveal
              key={w.id}
              as="figure"
              delay={Math.min(i, 8) * 55}
              className="mb-4 break-inside-avoid"
            >
              <div className="group overflow-hidden rounded-2xl border border-line bg-surface shadow-card">
                <img
                  src={w.url}
                  alt={w.name}
                  className="w-full object-cover transition-transform duration-700 ease-out group-hover:scale-105"
                  loading="lazy"
                  decoding="async"
                />
                <figcaption className="flex items-center justify-between gap-3 px-4 py-3">
                  <span className="truncate text-sm font-medium text-ink">{w.name}</span>
                  <Pill tone="brand">{w.category}</Pill>
                </figcaption>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  )
}

/* ================================================================== */
/*  Locations                                                          */
/* ================================================================== */

/**
 * Branch addresses are free text and some salons paste a Google Maps link
 * straight into the field, so a pasted URL is used verbatim. Anything else is
 * treated as an address and turned into a Maps search — which is why this
 * can't just be `href={branch.address}`: a plain address would produce a
 * broken relative link.
 */
function Locations({
  branding,
  businessId,
}: {
  branding: BrandingPayload
  businessId: string
}) {
  const { byBranch, loading: branchesLoading } = useBranchCategories(
    businessId,
    branding.branches.map(b => b.id),
  )

  return (
    <section id="locations" className="relative py-20 sm:py-28">
      <div className="mx-auto max-w-6xl px-5 sm:px-8">
        <Reveal>
          <SectionHeading
            eyebrow="Locations"
            title="Come and see us"
            subtitle="Each branch keeps its own calendar, so you can book at whichever studio suits you."
          />
        </Reveal>

        <div className="mt-12 grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
          {branding.branches.map((branch, i) => {
            const phone = branch.phones.find(p => p.isPrimary) ?? branch.phones[0]
            const mapsUrl = mapsUrlFor(branch.address)
            const categories = byBranch[branch.id] ?? []
            return (
              <Reveal key={branch.id} delay={Math.min(i, 6) * 70} className="h-full">
                <Card
                  interactive={!!mapsUrl}
                  className="relative flex h-full flex-col"
                  padded={false}
                >
                  {/* Stretched link, so the whole card opens Maps without
                      nesting the booking button and tel/mailto links inside an
                      anchor. Stacking order matters: content paints below this
                      (no z-index) so clicks fall through to the link, and only
                      real controls are lifted above it at z-20. */}
                  {mapsUrl && (
                    <a
                      href={mapsUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={`Open ${branch.name} in Google Maps (opens in a new tab)`}
                      className="absolute inset-0 z-10 rounded-2xl"
                    />
                  )}
                  <div className="flex items-start justify-between gap-3 p-6 pb-0">
                    <span
                      className="flex h-11 w-11 items-center justify-center rounded-xl"
                      style={{
                        background: 'var(--brand-soft-strong)',
                        color: 'var(--brand-accent)',
                      }}
                      aria-hidden="true"
                    >
                      <IconPin className="h-5 w-5" />
                    </span>
                    <span className="text-xs text-ink-3">
                      {branch.timezone ? formatTimezone(branch.timezone) : ''}
                    </span>
                  </div>

                  <div className="flex-1 p-6">
                    <h3 className="font-display text-xl leading-snug text-ink">
                      {branch.name}
                    </h3>
                    {/* A pasted URL is noise as body text, so it becomes a
                        labelled link instead. Plain addresses stay readable
                        and get their own link below. */}
                    {branch.address && !isUrlAddress(branch.address) && (
                      <p className="mt-2 text-sm leading-relaxed text-ink-3">
                        {branch.address}
                      </p>
                    )}
                    {mapsUrl && (
                      <a
                        href={mapsUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="focus-ring relative z-20 mt-2 inline-flex items-center gap-1.5 rounded text-sm font-medium text-[color:var(--brand-accent)] underline decoration-line underline-offset-2 transition-colors hover:decoration-current"
                      >
                        View on Google Maps
                        <span className="sr-only"> (opens in a new tab)</span>
                      </a>
                    )}

                    {(categories.length > 0 || branchesLoading) && (
                      <div className="mt-4">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-3">
                          Services here
                        </p>
                        <ul className="mt-2 flex flex-wrap gap-1.5">
                          {categories.map(c => (
                            <li
                              key={c.id}
                              className="rounded-full px-2.5 py-1 text-[11px] font-medium"
                              style={{
                                background: 'var(--brand-soft-strong)',
                                color: 'var(--brand-accent)',
                              }}
                            >
                              {c.name}
                            </li>
                          ))}
                          {branchesLoading && categories.length === 0 && (
                            <li className="text-[11px] text-ink-3">Loading…</li>
                          )}
                        </ul>
                      </div>
                    )}

                    <div className="mt-5 flex flex-col gap-2.5 border-t border-line pt-5 text-sm">
                      {phone && (
                        <a
                          href={`tel:${phone.phone}`}
                          className="focus-ring relative z-20 inline-flex w-fit items-center gap-2.5 rounded text-ink-2 transition-colors hover:text-ink"
                        >
                          <IconPhone className="h-4 w-4 flex-shrink-0 text-ink-3" />
                          {phone.phone}
                        </a>
                      )}
                      {branch.email && (
                        <a
                          href={`mailto:${branch.email}`}
                          className="focus-ring relative z-20 inline-flex w-fit min-w-0 items-center gap-2.5 rounded text-ink-2 transition-colors hover:text-ink"
                        >
                          <IconMail className="h-4 w-4 flex-shrink-0 text-ink-3" />
                          <span className="truncate">{branch.email}</span>
                        </a>
                      )}
                    </div>
                  </div>

                  <div className="relative z-20 p-6 pt-0">
                    <Button
                      fullWidth
                      onClick={() => navigateWithBranch(businessId, branch.id)}
                      iconRight={<IconArrowRight className="h-4 w-4" />}
                    >
                      Book at this branch
                    </Button>
                  </div>
                </Card>
              </Reveal>
            )
          })}
        </div>
      </div>
    </section>
  )
}

/* ================================================================== */
/*  About                                                              */
/* ================================================================== */

function About({
  branding,
  name,
}: {
  branding: BrandingPayload
  name: string
}) {
  const firstWords = (branding.aboutUs ?? '').split(/\s+/).slice(0, 14).join(' ')

  return (
    <section
      id="about"
      className="relative overflow-hidden border-t border-line/70 bg-white/50 py-20 sm:py-28"
    >
      <div
        className="pointer-events-none absolute -left-32 top-1/3 h-72 w-72 rounded-full opacity-50 blur-3xl"
        style={{ background: 'var(--brand-soft)' }}
        aria-hidden="true"
      />

      <div className="relative mx-auto grid max-w-6xl gap-12 px-5 sm:px-8 lg:grid-cols-[0.85fr_1.15fr] lg:gap-20">
        <Reveal>
          <Eyebrow>Our story</Eyebrow>
          <p className="mt-6 font-display text-2xl leading-snug text-ink sm:text-3xl">
            {firstWords}
            {branding.aboutUs!.trim().split(/\s+/).length > 14 && '…'}
          </p>
          <div className="mt-8 flex items-center gap-3">
            <Logo url={branding.logo?.url} name={name} />
            <div>
              <p className="text-sm font-medium text-ink">{name}</p>
              <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[color:var(--brand-accent)]">
                Est. in Addis Ababa
              </p>
            </div>
          </div>
        </Reveal>

        <Reveal delay={120} className="lg:pt-16">
          <p className="whitespace-pre-line text-[15px] leading-[1.9] text-ink-2 sm:text-base">
            {branding.aboutUs}
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <span className="inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-ink-3">
              <IconSparkle className="h-4 w-4 text-[color:var(--brand-accent)]" />
              Crafted with care
            </span>
          </div>
        </Reveal>
      </div>
    </section>
  )
}

/* ================================================================== */
/*  States                                                             */
/* ================================================================== */

function LoadingLanding() {
  return (
    <div className="salon-canvas flex min-h-screen flex-col items-center justify-center gap-6">
      <div className="relative flex h-16 w-16 items-center justify-center">
        <span className="absolute inset-0 rounded-full border border-line" />
        <span className="absolute inset-0 animate-spin rounded-full border-2 border-transparent border-t-ink" />
        <span className="font-display text-xl text-ink-3">ዘ</span>
      </div>
      <p className="animate-shimmer text-sm tracking-wide text-ink-3">
        Opening the salon…
      </p>
    </div>
  )
}

function UnavailableLanding({ message }: { message: string | null }) {
  return (
    <div className="salon-canvas flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-bad-soft text-bad">
        <IconImage className="h-6 w-6" />
      </div>
      <h1 className="font-display text-2xl text-ink">This page is taking a moment</h1>
      <p className="max-w-sm text-sm leading-relaxed text-ink-2">
        {message ?? 'We could not load this salon right now. Please try again in a minute.'}
      </p>
    </div>
  )
}

/* ================================================================== */
/*  Helpers                                                            */
/* ================================================================== */

function totalWorks(b: BrandingPayload): number {
  return b.serviceCategories.reduce((n, c) => n + c.sampleWorks.length, 0)
}

function collectWorks(b: BrandingPayload): GalleryItem[] {
  return b.serviceCategories.flatMap(c =>
    c.sampleWorks.map(w => ({
      id: w.id,
      url: w.url,
      name: w.name,
      category: c.name,
    })),
  )
}

function navigateSchedule(businessId: string) {
  navigate(`/book/${businessId}/schedule`)
}

/** Deep-links into the wizard with the branch pre-selected. */
function navigateWithBranch(businessId: string, branchId: string) {
  navigate(`/book/${businessId}/schedule?branch=${branchId}`)
}

function scrollTo(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}