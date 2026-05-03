import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { listPublishedCoursesForDestination } from "@/db/queries/courses";
import { getDestinationBySlug } from "@/db/queries/destinations";
import { assembleTour } from "@/lib/assemble-tour";
import type { Locale } from "@/lib/locales";
import { absoluteUrl, siteName } from "@/lib/site";
import { TOUR_COLOR_PRESETS, type TourColorPresetKey } from "@/lib/tour-styling";
import { VirtualTour } from "@/components/virtual-tour/virtual-tour";

export const dynamic = "force-dynamic";

type EmbedTheme = "light" | "dark";

function readTheme(value: unknown): EmbedTheme {
  return value === "dark" ? "dark" : "light";
}

function readAccent(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const match = TOUR_COLOR_PRESETS.find((p) => p.key === (value as TourColorPresetKey));
  return match?.value ?? null;
}

function readHideChrome(value: unknown): boolean {
  return value === "1" || value === "true";
}

function readLang(value: unknown): Locale {
  return value === "es" ? "es" : "en";
}

export async function generateMetadata({
  params,
}: PageProps<"/embed/tours/[destinationSlug]">): Promise<Metadata> {
  const { destinationSlug } = await params;
  const destination = await getDestinationBySlug(destinationSlug);
  if (!destination || !destination.isPublic) {
    return { title: "Tour not found", robots: { index: false, follow: false } };
  }
  return {
    title: `${destination.name} embed`,
    description: destination.description ?? undefined,
    alternates: {
      canonical: absoluteUrl(`/embed/tours/${destination.slug}`),
    },
    // Embeds are not standalone pages; keep them out of search.
    robots: { index: false, follow: false },
  };
}

export default async function EmbedTourPage({
  params,
  searchParams,
}: PageProps<"/embed/tours/[destinationSlug]">) {
  const { destinationSlug } = await params;
  const destination = await getDestinationBySlug(destinationSlug);
  // Match the public route: gated destinations 404 silently so an
  // embedder can't probe slugs by reading status codes.
  if (!destination || !destination.isPublic) notFound();

  const query = await searchParams;
  const lang = readLang(query?.lang);
  const theme = readTheme(query?.theme);
  const accentOverride = readAccent(query?.accent);
  const hideChrome = readHideChrome(query?.hidechrome);
  const rawSceneId = typeof query?.scene === "string" ? query.scene : null;

  const assembled = await assembleTour({
    destinationId: destination.id,
    creatorId: null,
    startSceneId: rawSceneId,
    title: destination.name,
    description: destination.description,
    // Embed-time accent override beats the saved destination color so a
    // partner can match their own palette without forcing the creator
    // to re-save the destination.
    arrowColor: accentOverride ?? destination.tourArrowColor,
    pinColor: accentOverride ?? destination.tourPinColor,
    pinIconMediaId: destination.pinIconMediaId,
  });

  // The viewer's own error overlay handles per-scene load failures, but
  // a destination with zero ready scenes shouldn't crash the iframe.
  if (!assembled.ok) {
    notFound();
  }

  const courses = await listPublishedCoursesForDestination(destination.id);
  const primaryCourse = courses[0];
  const ctaHref = primaryCourse
    ? absoluteUrl(`/${lang}/courses/${primaryCourse.courseSlug}`)
    : absoluteUrl(`/${lang}/tours/${destination.slug}`);
  const attributionLabel =
    lang === "es"
      ? `Impulsado por ${siteName}`
      : `Powered by ${siteName}`;

  // Surface for embed = full viewport; tour fills the iframe so partners
  // pick the iframe height in their own HTML rather than us picking
  // viewport-relative units that don't translate inside an iframe.
  const themeBg = theme === "dark" ? "bg-zinc-950" : "bg-white";
  const themeText = theme === "dark" ? "text-zinc-100" : "text-zinc-900";
  const attributionBg =
    theme === "dark" ? "bg-zinc-900/80 text-zinc-100" : "bg-white/85 text-zinc-900";

  return (
    <main
      className={`relative flex min-h-dvh flex-col ${themeBg} ${themeText}`}
      aria-label={`${destination.name} virtual tour`}
    >
      <VirtualTour tour={assembled.tour} height="100dvh" />
      {hideChrome ? null : (
        <a
          href={ctaHref}
          target="_blank"
          rel="noopener"
          className={`pointer-events-auto absolute bottom-3 right-3 z-10 inline-flex min-h-9 items-center gap-1 rounded-full border border-black/10 px-3 text-xs font-semibold backdrop-blur transition hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current dark:border-white/15 ${attributionBg}`}
        >
          <span>{attributionLabel}</span>
          <span aria-hidden="true">↗</span>
        </a>
      )}
    </main>
  );
}
