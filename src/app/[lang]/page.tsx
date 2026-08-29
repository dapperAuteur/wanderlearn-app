import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { hasLocale, locales } from "@/lib/locales";
import { absoluteUrl, localizedAlternates, siteName } from "@/lib/site";
import { listPublicDestinations } from "@/db/queries/destinations";
import { LazyTourGlobe } from "@/components/globe/lazy-tour-globe";
import { TourTypeLegend } from "@/components/globe/tour-type-legend";
import { buildGlobeData } from "@/lib/globe-data";
import { getDictionary } from "./dictionaries";

// ISR: the home page embeds a globe of public destinations. Revalidate
// hourly so new mapped tours appear without a redeploy, while keeping the
// highest-traffic page cacheable (not per-request dynamic).
export const revalidate = 3600;

export async function generateMetadata({ params }: PageProps<"/[lang]">): Promise<Metadata> {
  const { lang } = await params;
  if (!hasLocale(lang)) return {};
  const dict = await getDictionary(lang);
  const canonicalPath = `/${lang}`;
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: siteName,
    url: absoluteUrl(canonicalPath),
    description: dict.meta.description,
    logo: absoluteUrl("/opengraph-image"),
    sameAs: [] as string[],
  };
  return {
    title: dict.meta.title,
    description: dict.meta.description,
    alternates: {
      canonical: absoluteUrl(canonicalPath),
      languages: localizedAlternates("", locales),
    },
    openGraph: {
      type: "website",
      siteName,
      title: dict.meta.title,
      description: dict.landing.subhead,
      url: absoluteUrl(canonicalPath),
      locale: lang === "es" ? "es_MX" : "en_US",
    },
    twitter: {
      card: "summary_large_image",
      title: dict.meta.title,
      description: dict.landing.subhead,
    },
    other: {
      "application/ld+json": JSON.stringify(structuredData),
    },
  };
}

export default async function LandingPage({ params }: PageProps<"/[lang]">) {
  const { lang } = await params;
  if (!hasLocale(lang)) notFound();
  const dict = await getDictionary(lang);

  // Globe markers (per-type pin colors) + legend from public destinations.
  const destinations = await listPublicDestinations();
  const { markers: globeMarkers, legend } = await buildGlobeData(
    destinations,
    dict.tourTypes,
  );

  return (
    <main id="main" className="mx-auto w-full max-w-6xl px-4 pb-24 sm:px-6 lg:px-8">
      <section aria-labelledby="hero-heading" className="pt-12 pb-20 sm:pt-16 sm:pb-28">
        <p className="label-stamp">{dict.landing.eyebrow}</p>
        <h1
          id="hero-heading"
          className="font-display mt-4 text-4xl leading-[1.05] sm:text-5xl lg:text-6xl"
        >
          {dict.landing.headline}
        </h1>
        <p className="mt-6 max-w-2xl text-lg leading-8 text-muted">{dict.landing.subhead}</p>
        <div className="mt-10 flex flex-col gap-3 sm:flex-row">
            {/*
              Points at tours, not courses. No course is published yet, so this sent
              every first-time visitor to an empty page — the worst possible first
              click. Courses keep their nav entry and a "coming soon" note, so the
              plan stays visible without anyone being sent to nothing.
            */}
          <Link
            href={`/${lang}/tours`}
            className="inline-flex min-h-12 items-center justify-center rounded-md border-2 border-brand-text bg-brand px-6 text-base font-bold text-on-brand hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current"
          >
            {dict.landing.primaryCta}
          </Link>
          <Link
            href={`/${lang}/how-it-works`}
            className="inline-flex min-h-12 items-center justify-center rounded-md border-2 border-line-strong px-6 text-base font-bold hover:bg-line focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current"
          >
            {dict.landing.secondaryCta}
          </Link>
          <p className="inline-flex min-h-12 items-center text-sm text-muted">
            {dict.landing.coursesComingSoon}
          </p>
        </div>
      </section>

      <section aria-labelledby="features-heading" className="border-t-2 border-dashed border-line pt-16">
        <h2 id="features-heading" className="sr-only">
          {dict.landing.eyebrow}
        </h2>
        <ul className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
          <li>
            <h3 className="font-display text-lg">{dict.landing.featureImmersiveTitle}</h3>
            <p className="mt-2 text-base leading-7 text-muted">
              {dict.landing.featureImmersiveBody}
            </p>
          </li>
          <li>
            <h3 className="font-display text-lg">{dict.landing.featureCreatorTitle}</h3>
            <p className="mt-2 text-base leading-7 text-muted">
              {dict.landing.featureCreatorBody}
            </p>
          </li>
          <li>
            <h3 className="font-display text-lg">{dict.landing.featureLearnerTitle}</h3>
            <p className="mt-2 text-base leading-7 text-muted">
              {dict.landing.featureLearnerBody}
            </p>
          </li>
        </ul>
      </section>

      {globeMarkers.length > 0 ? (
        <section aria-labelledby="globe-section-heading" className="mt-20">
          <h2
            id="globe-section-heading"
            className="font-display text-2xl sm:text-3xl"
          >
            {dict.landing.globeSectionTitle}
          </h2>
          <p className="mt-3 max-w-2xl text-base leading-7 text-muted">
            {dict.landing.globeSectionBody}
          </p>
          <div className="mt-8">
            <LazyTourGlobe
              markers={globeMarkers}
              lang={lang}
              labels={{
                region: dict.learner.toursCatalog.globeRegionLabel,
                hint: dict.learner.toursCatalog.globeHint,
                listHeading: dict.learner.toursCatalog.globeListHeading,
                takeTour: dict.learner.toursCatalog.globeTakeTour,
                browseScenes: dict.learner.toursCatalog.globeBrowseScenes,
                close: dict.learner.toursCatalog.globeClose,
              }}
            />
            <TourTypeLegend
              items={legend}
              heading={dict.learner.toursCatalog.globeLegendHeading}
            />
          </div>
          <Link
            href={`/${lang}/tours`}
            className="mt-6 inline-flex min-h-12 items-center justify-center rounded-md border-2 border-brand-text bg-brand px-6 text-base font-bold text-on-brand hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current"
          >
            {dict.landing.globeSectionCta}
          </Link>
        </section>
      ) : null}

      <section
        aria-labelledby="flagship-heading"
        className="mt-20 rounded-md border-2 border-dashed border-line-strong bg-surface p-6 sm:p-10"
      >
        <p className="label-stamp">{dict.landing.flagshipTitle}</p>
        <h2 id="flagship-heading" className="font-display mt-3 text-2xl sm:text-3xl">
          <Link
            href={`/${lang}/courses/mucho-museo-del-chocolate`}
            className="hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current"
          >
            {dict.landing.flagshipName}
          </Link>
        </h2>
        <p className="mt-4 max-w-2xl text-base leading-7 text-muted">
          {dict.landing.flagshipDescription}
        </p>
        <p className="mt-4 text-sm text-muted">
          {dict.landing.flagshipLocation}
        </p>
        <Link
          href={`/${lang}/courses/mucho-museo-del-chocolate`}
          className="mt-6 inline-flex min-h-12 items-center justify-center rounded-md border-2 border-brand-text bg-brand px-6 text-base font-bold text-on-brand hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current"
        >
          {dict.landing.flagshipCta}
        </Link>
      </section>
    </main>
  );
}
