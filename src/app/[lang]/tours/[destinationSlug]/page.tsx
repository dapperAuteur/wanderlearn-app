import { timingSafeEqual } from "node:crypto";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { listPublishedCoursesForDestination } from "@/db/queries/courses";
import { getDestinationBySlug } from "@/db/queries/destinations";
import { assembleTour } from "@/lib/assemble-tour";
import { hasLocale, locales } from "@/lib/locales";
import { absoluteUrl, localizedAlternates, siteName } from "@/lib/site";
import { NextTourCta } from "@/components/virtual-tour/next-tour-cta";
import { SceneLandingGrid } from "@/components/virtual-tour/scene-landing-grid";
import { TourWithCrossTour } from "@/components/virtual-tour/tour-with-cross-tour";
import { YouTubePlayer } from "@/components/blocks/youtube-player";
import { parseYouTubeId } from "@/lib/youtube";
import { getDictionary } from "../../dictionaries";
import { DescriptionProse } from "@/components/description-prose";
import { descriptionPlainText } from "@/lib/description-markdown";

export const dynamic = "force-dynamic";

/**
 * Capability check for private previews: /tours/<slug>?k=<token>. Constant-time
 * compare; length is checked first because timingSafeEqual throws on unequal
 * lengths. High-entropy token, so equality is the whole check.
 */
function shareTokenMatches(stored: string | null, provided: string | null): boolean {
  if (!stored || !provided) return false;
  const a = Buffer.from(stored);
  const b = Buffer.from(provided);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function generateMetadata({
  params,
  searchParams,
}: PageProps<"/[lang]/tours/[destinationSlug]">): Promise<Metadata> {
  const { lang, destinationSlug } = await params;
  if (!hasLocale(lang)) return {};
  const destination = await getDestinationBySlug(destinationSlug);
  const query = await searchParams;
  const providedToken = typeof query?.k === "string" ? query.k : null;
  const previewAccess =
    destination !== null &&
    !destination.isPublic &&
    shareTokenMatches(destination.shareToken, providedToken);
  if (!destination || (!destination.isPublic && !previewAccess)) {
    return { title: "Tour not found" };
  }
  // Preview links must never be indexed — the token would end up in a crawler.
  if (previewAccess) {
    return { title: destination.name, robots: { index: false, follow: false } };
  }

  const path = `/${lang}/tours/${destination.slug}`;
  // Descriptions are markdown now, so meta/OG/Twitter need the stripped form or
  // raw **asterisks** and [link](url) syntax leak into search and social previews.
  const plainDescription = destination.description
    ? await descriptionPlainText(destination.description)
    : undefined;
  // og:image comes from the sibling file-based opengraph-image.tsx, which
  // renders a branded 1200×630 card via next/og. Leaving `images`
  // unspecified here lets Next pick up the file convention; setting it
  // here would override the file.

  return {
    title: destination.name,
    description: plainDescription,
    alternates: {
      canonical: absoluteUrl(path),
      languages: localizedAlternates(`/tours/${destination.slug}`, locales),
    },
    openGraph: {
      type: "article",
      siteName,
      title: destination.name,
      description: plainDescription,
      url: absoluteUrl(path),
      locale: lang === "es" ? "es_MX" : "en_US",
    },
    twitter: {
      card: "summary_large_image",
      title: destination.name,
      description: plainDescription,
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
  const query = await searchParams;
  // Private-by-default: visitors hitting a gated destination get a generic
  // 404 rather than a "you need to sign in" prompt. Avoids leaking which
  // destinations exist but haven't been shared yet. A valid ?k= capability
  // token opens a private tour as a preview (with a visible notice below).
  const providedToken = typeof query?.k === "string" ? query.k : null;
  const previewAccess =
    destination !== null &&
    !destination.isPublic &&
    shareTokenMatches(destination.shareToken, providedToken);
  if (!destination || (!destination.isPublic && !previewAccess)) notFound();
  const rawSceneId = typeof query?.scene === "string" ? query.scene : null;
  // `?start=1` jumps straight into the viewer at the resolved start scene
  // (default start scene, else oldest), skipping the scene-chooser grid —
  // used by the globe's "Take tour" button.
  const startDirect = query?.start === "1" || query?.start === "true";

  const [dict, assembled, coursesAtDestination] = await Promise.all([
    getDictionary(lang),
    assembleTour({
      destinationId: destination.id,
      // No creatorId in public scope — include every scene at the
      // destination regardless of who uploaded each one.
      creatorId: null,
      // Verified preview token: show drafts, otherwise the preview is empty.
      includeUnpublished: previewAccess,
      // Visitor's explicit ?scene= wins; otherwise fall back to the
      // creator-chosen default for this destination. assembleTour
      // falls back to oldest-scene-by-createdAt when neither is set.
      startSceneId: rawSceneId ?? destination.defaultStartSceneId,
      title: destination.name,
      description: destination.description,
      arrowColor: destination.tourArrowColor,
      pinColor: destination.tourPinColor,
      pinIconMediaId: destination.pinIconMediaId,
      tourArrowMediaId: destination.tourArrowMediaId,
      nextDestinationId: destination.nextDestinationId,
      mapMediaId: destination.mapMediaId,
      mapTemplate: destination.mapTemplate,
      sceneLinkIconSize: destination.sceneLinkIconSize,
      hotspotIconSize: destination.hotspotIconSize,
    }),
    listPublishedCoursesForDestination(destination.id),
  ]);

  const tour = assembled.ok ? assembled.tour : null;
  // Optional "video tour": when the destination has a YouTube URL, play it.
  const youtubeId = parseYouTubeId(destination.youtubeUrl);

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

      <p className="mb-6">
        <Link
          href={`/${lang}/tours#tours-globe`}
          className="inline-flex min-h-11 items-center gap-1.5 rounded-md border border-black/10 px-3 text-sm font-medium hover:border-black/30 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current dark:border-white/15 dark:hover:border-white/30"
        >
          <span aria-hidden="true">🌐</span>
          {dict.tours.exploreGlobeCta}
        </Link>
      </p>

      <header className="mb-6 flex flex-col gap-3">
        {previewAccess ? (
          <p
            role="note"
            className="rounded-md border border-amber-500/40 bg-amber-500/10 px-4 py-2 text-sm font-medium text-amber-900 dark:text-amber-200"
          >
            {dict.tours.privatePreviewNotice}
          </p>
        ) : null}
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
            <span aria-hidden="true"> ↗</span>
            <span className="sr-only"> ({dict.tours.externalIndicator})</span>
          </a>
        ) : null}
        {destination.city || destination.country ? (
          <p className="text-sm text-zinc-600 dark:text-zinc-300">
            {[destination.city, destination.country].filter(Boolean).join(", ")}
          </p>
        ) : null}
        {destination.description ? (
          <DescriptionProse source={destination.description} />
        ) : null}
      </header>

      {tour ? (
        // Show the pre-tour landing grid only when (a) the visitor
        // hasn't deep-linked to a specific scene and (b) there's more
        // than one scene to choose from. A single-scene destination
        // jumps straight into the viewer — there's nothing to pick.
        !rawSceneId && !startDirect && tour.scenes.length > 1 ? (
          <SceneLandingGrid
            previewToken={previewAccess ? providedToken : null}
            lang={lang}
            destinationSlug={destination.slug}
            scenes={tour.scenes}
            defaultStartSceneId={destination.defaultStartSceneId}
            dict={dict.tours.chooseScene}
          />
        ) : (
          // TourWithCrossTour wraps the viewer + listens for the
          // cross-tour-link DOM event; opens the preview-card modal
          // when a cross-tour hotspot fires. openInNewTab=false here
          // (public tour route is same-tab navigation).
          <TourWithCrossTour
            tour={tour}
            height="70vh"
            lang={lang}
            openInNewTab={false}
            dict={dict.tours.crossTourPreview}
            containerClassName="overflow-hidden rounded-lg border border-black/10 dark:border-white/15"
          />
        )
      ) : youtubeId ? null : (
        <div className="rounded-lg border border-dashed border-amber-500/40 bg-amber-500/5 p-6 text-sm text-amber-900 dark:text-amber-200">
          {dict.tours.emptyBody}
        </div>
      )}

      {youtubeId ? (
        <section aria-labelledby="video-tour-heading" className="mt-8">
          <h2
            id="video-tour-heading"
            className="mb-3 text-xl font-semibold tracking-tight"
          >
            {dict.tours.videoHeading}
          </h2>
          <YouTubePlayer videoId={youtubeId} title={destination.name} />
        </section>
      ) : null}

      {tour?.nextDestination ? (
        <div className="mt-10">
          <NextTourCta
            target={tour.nextDestination}
            lang={lang}
            openInNewTab={false}
            dict={dict.tours.nextTourCta}
          />
        </div>
      ) : null}

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
