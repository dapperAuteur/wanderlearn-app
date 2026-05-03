import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { listPublishedCoursesForDestination } from "@/db/queries/courses";
import { getDestinationBySlug } from "@/db/queries/destinations";
import { assembleTour } from "@/lib/assemble-tour";
import { hasLocale, locales } from "@/lib/locales";
import { absoluteUrl, localizedAlternates, siteName } from "@/lib/site";
import { VirtualTour } from "@/components/virtual-tour/virtual-tour";
import { getDictionary } from "../../dictionaries";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: PageProps<"/[lang]/tours/[destinationSlug]">): Promise<Metadata> {
  const { lang, destinationSlug } = await params;
  if (!hasLocale(lang)) return {};
  const destination = await getDestinationBySlug(destinationSlug);
  if (!destination || !destination.isPublic) return { title: "Tour not found" };

  const path = `/${lang}/tours/${destination.slug}`;
  // og:image comes from the sibling file-based opengraph-image.tsx, which
  // renders a branded 1200×630 card via next/og. Leaving `images`
  // unspecified here lets Next pick up the file convention; setting it
  // here would override the file.

  return {
    title: destination.name,
    description: destination.description ?? undefined,
    alternates: {
      canonical: absoluteUrl(path),
      languages: localizedAlternates(`/tours/${destination.slug}`, locales),
    },
    openGraph: {
      type: "article",
      siteName,
      title: destination.name,
      description: destination.description ?? undefined,
      url: absoluteUrl(path),
      locale: lang === "es" ? "es_MX" : "en_US",
    },
    twitter: {
      card: "summary_large_image",
      title: destination.name,
      description: destination.description ?? undefined,
    },
  };
}

export default async function PublicTourPage({
  params,
  searchParams,
}: PageProps<"/[lang]/tours/[destinationSlug]">) {
  const { lang, destinationSlug } = await params;
  if (!hasLocale(lang)) notFound();
  const destination = await getDestinationBySlug(destinationSlug);
  // Private-by-default: visitors hitting a gated destination get a generic
  // 404 rather than a "you need to sign in" prompt. Avoids leaking which
  // destinations exist but haven't been shared yet.
  if (!destination || !destination.isPublic) notFound();

  const query = await searchParams;
  const rawSceneId = typeof query?.scene === "string" ? query.scene : null;

  const [dict, assembled, coursesAtDestination] = await Promise.all([
    getDictionary(lang),
    assembleTour({
      destinationId: destination.id,
      // No creatorId in public scope — include every scene at the
      // destination regardless of who uploaded each one.
      creatorId: null,
      startSceneId: rawSceneId,
      title: destination.name,
      description: destination.description,
      arrowColor: destination.tourArrowColor,
      pinColor: destination.tourPinColor,
    }),
    listPublishedCoursesForDestination(destination.id),
  ]);

  const tour = assembled.ok ? assembled.tour : null;

  return (
    <main
      id="main"
      className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 sm:py-12 lg:px-8"
    >
      <nav aria-label="Breadcrumb" className="mb-4 text-sm">
        <Link
          href={`/${lang}`}
          className="text-zinc-600 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current dark:text-zinc-400"
        >
          ← {dict.nav.brandLabel}
        </Link>
      </nav>

      <header className="mb-6 flex flex-col gap-3">
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
          {destination.name}
        </h1>
        {destination.website ? (
          <a
            href={destination.website}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm font-medium underline underline-offset-4 hover:no-underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current"
          >
            {destination.website.replace(/^https?:\/\//, "").replace(/\/$/, "")}
          </a>
        ) : null}
        {destination.city || destination.country ? (
          <p className="text-sm text-zinc-600 dark:text-zinc-300">
            {[destination.city, destination.country].filter(Boolean).join(", ")}
          </p>
        ) : null}
        {destination.description ? (
          <p className="max-w-2xl text-base leading-7 text-zinc-700 dark:text-zinc-200">
            {destination.description}
          </p>
        ) : null}
      </header>

      {tour ? (
        <div className="overflow-hidden rounded-lg border border-black/10 dark:border-white/15">
          <VirtualTour tour={tour} height="70vh" />
        </div>
      ) : (
        <div className="rounded-lg border border-dashed border-amber-500/40 bg-amber-500/5 p-6 text-sm text-amber-900 dark:text-amber-200">
          {dict.tours.emptyBody}
        </div>
      )}

      {coursesAtDestination.length > 0 ? (
        <section
          aria-labelledby="courses-at-destination-heading"
          className="mt-10 rounded-lg border border-black/10 p-6 dark:border-white/15"
        >
          <h2
            id="courses-at-destination-heading"
            className="text-xl font-semibold tracking-tight"
          >
            {dict.tours.coursesHeading}
          </h2>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">
            {dict.tours.coursesIntro}
          </p>
          <ul className="mt-4 grid gap-3 sm:grid-cols-2">
            {coursesAtDestination.map((c) => (
              <li
                key={c.courseId}
                className="rounded-md border border-black/10 p-4 dark:border-white/15"
              >
                <p className="font-semibold">{c.courseTitle}</p>
                {c.courseSubtitle ? (
                  <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">
                    {c.courseSubtitle}
                  </p>
                ) : null}
                <Link
                  href={`/${lang}/courses/${c.courseSlug}`}
                  className="mt-3 inline-flex min-h-9 items-center text-sm font-semibold underline hover:no-underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current"
                >
                  {c.priceCents === 0
                    ? dict.tours.coursesFreeCta
                    : dict.tours.coursesPaidCta}{" "}
                  →
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <p className="mt-8 text-sm text-zinc-600 dark:text-zinc-300">
        {dict.tours.publicShareFooter}
      </p>
    </main>
  );
}
