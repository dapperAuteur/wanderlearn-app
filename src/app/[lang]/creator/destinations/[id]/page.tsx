import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getDestinationById } from "@/db/queries/destinations";
import { hasLocale } from "@/lib/locales";
import { requireCreator } from "@/lib/rbac";
import { getDictionary } from "../../../dictionaries";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: PageProps<"/[lang]/creator/destinations/[id]">): Promise<Metadata> {
  const { lang, id } = await params;
  if (!hasLocale(lang)) return {};
  const destination = await getDestinationById(id);
  if (!destination) return { title: "Destination not found" };
  return {
    title: destination.name,
    description: destination.description ?? undefined,
    robots: { index: false, follow: false },
  };
}

function formatCoordinate(value: string | null, axis: "lat" | "lng"): string | null {
  if (!value) return null;
  const num = Number(value);
  if (!Number.isFinite(num)) return null;
  if (axis === "lat") {
    return `${Math.abs(num).toFixed(6)}° ${num >= 0 ? "N" : "S"}`;
  }
  return `${Math.abs(num).toFixed(6)}° ${num >= 0 ? "E" : "W"}`;
}

export default async function ViewDestinationPage({
  params,
  searchParams,
}: PageProps<"/[lang]/creator/destinations/[id]">) {
  const { lang, id } = await params;
  if (!hasLocale(lang)) notFound();
  await requireCreator(lang);
  const destination = await getDestinationById(id);
  if (!destination) notFound();
  const dict = await getDictionary(lang);
  const query = await searchParams;
  const savedFlag = typeof query?.saved === "string" ? query.saved : null;

  const latFormatted = formatCoordinate(destination.lat, "lat");
  const lngFormatted = formatCoordinate(destination.lng, "lng");
  const mapUrl =
    destination.lat && destination.lng
      ? `https://www.google.com/maps/search/?api=1&query=${destination.lat},${destination.lng}`
      : null;

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-12 sm:px-6 lg:px-8">
      <nav aria-label="Breadcrumb" className="mb-4 text-sm">
        <Link
          href={`/${lang}/creator/destinations`}
          className="text-zinc-600 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current dark:text-zinc-400"
        >
          ← {dict.creator.destinations.title}
        </Link>
      </nav>

      {savedFlag === "1" ? (
        <p
          role="status"
          aria-live="polite"
          className="mb-6 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-800 dark:border-emerald-400/30 dark:text-emerald-300"
        >
          {dict.creator.destinations.savedBanner}
        </p>
      ) : savedFlag === "created" ? (
        <p
          role="status"
          aria-live="polite"
          className="mb-6 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-800 dark:border-emerald-400/30 dark:text-emerald-300"
        >
          {dict.creator.destinations.createdBanner}
        </p>
      ) : null}

      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">{destination.name}</h1>
          {destination.city || destination.country ? (
            <p className="mt-2 text-base text-zinc-600 dark:text-zinc-300">
              {[destination.city, destination.country].filter(Boolean).join(", ")}
            </p>
          ) : null}
        </div>
        <Link
          href={`/${lang}/creator/destinations/${destination.id}/edit`}
          className="inline-flex min-h-12 items-center justify-center rounded-md border border-black/15 px-6 text-base font-semibold hover:bg-black/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current dark:border-white/20 dark:hover:bg-white/5"
        >
          {dict.creator.destinations.editCta}
        </Link>
      </div>

      {destination.description ? (
        <p className="mt-6 max-w-2xl text-base leading-7 text-zinc-700 dark:text-zinc-200">
          {destination.description}
        </p>
      ) : (
        <p className="mt-6 text-sm italic text-zinc-500 dark:text-zinc-400">
          {dict.creator.destinations.noDescription}
        </p>
      )}

      <section
        aria-labelledby="details-heading"
        className="mt-10 rounded-lg border border-black/10 p-6 dark:border-white/15"
      >
        <h2 id="details-heading" className="text-lg font-semibold">
          {dict.creator.destinations.detailsHeading}
        </h2>
        <dl className="mt-4 grid grid-cols-[auto_1fr] gap-x-6 gap-y-3 text-sm">
          <dt className="text-zinc-500 dark:text-zinc-400">
            {dict.creator.destinations.slugLabel}
          </dt>
          <dd className="font-mono">{destination.slug}</dd>
          <dt className="text-zinc-500 dark:text-zinc-400">
            {dict.creator.destinations.form.latLabel}
          </dt>
          <dd>{latFormatted ?? "—"}</dd>
          <dt className="text-zinc-500 dark:text-zinc-400">
            {dict.creator.destinations.form.lngLabel}
          </dt>
          <dd>{lngFormatted ?? "—"}</dd>
        </dl>
        {mapUrl ? (
          <a
            href={mapUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-4 inline-flex min-h-11 items-center gap-1 rounded-md border border-black/15 px-4 text-sm font-medium hover:bg-black/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current dark:border-white/20 dark:hover:bg-white/5"
          >
            {dict.creator.destinations.openInMaps}
            <span aria-hidden="true">↗</span>
            <span className="sr-only">{dict.creator.destinations.externalLink}</span>
          </a>
        ) : null}
      </section>

      <section
        aria-labelledby="scenes-heading"
        className="mt-10 rounded-lg border border-dashed border-black/15 p-6 text-sm text-zinc-600 dark:border-white/20 dark:text-zinc-300"
      >
        <h2 id="scenes-heading" className="text-lg font-semibold text-foreground">
          {dict.creator.destinations.scenesHeading}
        </h2>
        <p className="mt-2">{dict.creator.destinations.scenesComingSoon}</p>
      </section>
    </main>
  );
}
