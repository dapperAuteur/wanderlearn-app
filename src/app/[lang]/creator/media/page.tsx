import type { Metadata } from "next";
import { and, desc, eq, isNull } from "drizzle-orm";
import Link from "next/link";
import { notFound } from "next/navigation";
import { db, schema } from "@/db/client";
import { listMediaAssignmentsForOwner, listTranscriptsForOwner } from "@/db/queries/media";
import { listDestinations } from "@/db/queries/destinations";
import { searchMedia } from "@/db/queries/search";
import { hasLocale, type Locale } from "@/lib/locales";
import { requireCreator } from "@/lib/rbac";
import { getDictionary } from "../../dictionaries";
import { MediaUploader } from "@/components/media/media-uploader";
import { MediaLibrary, type MediaRow } from "@/components/media/media-library";
import { listTagsForOwner } from "@/db/queries/media";
import { SearchInput } from "@/components/search/search-input";
import { AutoAssignButton } from "./auto-assign-button";
import type { UploadKind } from "@/lib/cloudinary-urls";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: PageProps<"/[lang]/creator/media">): Promise<Metadata> {
  const { lang } = await params;
  if (!hasLocale(lang)) return {};
  const dict = await getDictionary(lang);
  return {
    title: dict.creator.mediaTitle,
    description: dict.creator.mediaSubtitle,
    robots: { index: false, follow: false },
  };
}

function toLibraryRow(row: {
  id: string;
  kind: string;
  status: string;
  cloudinaryPublicId: string | null;
  cloudinarySecureUrl: string | null;
  sizeBytes: number | null;
  durationSeconds: number | null;
  displayName: string | null;
  description: string | null;
  tags: string[];
  transcriptMediaId: string | null;
  metadata: unknown;
  createdAt: Date;
  updatedAt: Date;
}): MediaRow {
  const metadata = row.metadata as { filename?: string } | null;
  return {
    id: row.id,
    kind: row.kind as UploadKind,
    status: row.status as MediaRow["status"],
    cloudinaryPublicId: row.cloudinaryPublicId,
    cloudinarySecureUrl: row.cloudinarySecureUrl,
    sizeBytes: row.sizeBytes,
    durationSeconds: row.durationSeconds,
    displayName: row.displayName,
    description: row.description,
    tags: row.tags,
    transcriptMediaId: row.transcriptMediaId,
    fallbackName: metadata?.filename ?? null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

/** Special values for the ?destination= filter besides a destination id. */
const FILTER_ALL = "all";
const FILTER_UNASSIGNED = "unassigned";

export default async function CreatorMediaPage({
  params,
  searchParams,
}: PageProps<"/[lang]/creator/media">) {
  const { lang } = await params;
  if (!hasLocale(lang)) notFound();
  const user = await requireCreator(lang);
  const dict = await getDictionary(lang);
  const query = await searchParams;
  const q = typeof query?.q === "string" ? query.q.trim() : "";
  const rawFilter =
    typeof query?.destination === "string" ? query.destination.trim() : "";

  const destinations = await listDestinations();
  const destinationIds = new Set(destinations.map((d) => d.id));
  const filter =
    rawFilter === FILTER_UNASSIGNED || destinationIds.has(rawFilter)
      ? rawFilter
      : FILTER_ALL;

  let libraryRows: MediaRow[];

  if (q) {
    const { rows: searchRows } = await searchMedia(user.id, q, { limit: 60 });
    libraryRows = searchRows.map(toLibraryRow);
  } else {
    const rows = await db
      .select({
        id: schema.mediaAssets.id,
        kind: schema.mediaAssets.kind,
        status: schema.mediaAssets.status,
        cloudinaryPublicId: schema.mediaAssets.cloudinaryPublicId,
        cloudinarySecureUrl: schema.mediaAssets.cloudinarySecureUrl,
        sizeBytes: schema.mediaAssets.sizeBytes,
        durationSeconds: schema.mediaAssets.durationSeconds,
        displayName: schema.mediaAssets.displayName,
        description: schema.mediaAssets.description,
        tags: schema.mediaAssets.tags,
        transcriptMediaId: schema.mediaAssets.transcriptMediaId,
        metadata: schema.mediaAssets.metadata,
        createdAt: schema.mediaAssets.createdAt,
        updatedAt: schema.mediaAssets.updatedAt,
      })
      .from(schema.mediaAssets)
      .where(
        and(eq(schema.mediaAssets.ownerId, user.id), isNull(schema.mediaAssets.deletedAt)),
      )
      .orderBy(desc(schema.mediaAssets.createdAt));

    libraryRows = rows.map(toLibraryRow);
  }

  // Per-tour scoping: the explicit destination_media_assets rows decide
  // which tour a file belongs to. The filter applies on top of search
  // results too, so "search within this tour" behaves as expected.
  const assignments = await listMediaAssignmentsForOwner(user.id);
  const assignedAnywhere = new Set(assignments.map((a) => a.mediaAssetId));
  if (filter === FILTER_UNASSIGNED) {
    libraryRows = libraryRows.filter((row) => !assignedAnywhere.has(row.id));
  } else if (filter !== FILTER_ALL) {
    const inThisDestination = new Set(
      assignments.filter((a) => a.destinationId === filter).map((a) => a.mediaAssetId),
    );
    libraryRows = libraryRows.filter((row) => inThisDestination.has(row.id));
  }

  const transcriptOptions = await listTranscriptsForOwner(user.id);

  const chipBase =
    "inline-flex min-h-9 items-center rounded-full px-3 text-sm font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current";
  const chipActive = "bg-foreground text-background";
  const chipInactive =
    "bg-black/5 text-zinc-700 hover:bg-black/10 dark:bg-white/10 dark:text-zinc-300 dark:hover:bg-white/15";
  const withParams = (destination: string) => {
    const search = new URLSearchParams();
    if (q) search.set("q", q);
    if (destination !== FILTER_ALL) search.set("destination", destination);
    const qs = search.toString();
    return `/${lang}/creator/media${qs ? `?${qs}` : ""}`;
  };

  return (
    <main id="main" className="mx-auto w-full max-w-5xl px-4 py-12 sm:px-6 lg:px-8">
      <h1 className="text-3xl font-semibold tracking-tight">{dict.creator.mediaTitle}</h1>
      <p className="mt-2 text-base text-zinc-600 dark:text-zinc-300">
        {dict.creator.mediaSubtitle}
      </p>

      <div className="mt-10">
        <MediaUploader
          dict={dict.creator.uploader}
          userRole={(user as { role?: string }).role ?? "creator"}
        />
      </div>

      <div className="mt-12 flex flex-col gap-4">
        <nav aria-label={dict.creator.library.destinationFilterLabel} className="flex flex-col gap-2">
          <span className="text-sm font-medium text-zinc-600 dark:text-zinc-300">
            {dict.creator.library.destinationFilterLabel}
          </span>
          <div className="flex flex-wrap gap-2">
            <Link
              href={withParams(FILTER_ALL)}
              aria-current={filter === FILTER_ALL ? "true" : undefined}
              className={`${chipBase} ${filter === FILTER_ALL ? chipActive : chipInactive}`}
            >
              {dict.creator.library.allDestinationsLabel}
            </Link>
            {destinations.map((destination) => (
              <Link
                key={destination.id}
                href={withParams(destination.id)}
                aria-current={filter === destination.id ? "true" : undefined}
                className={`${chipBase} ${filter === destination.id ? chipActive : chipInactive}`}
              >
                {destination.name}
              </Link>
            ))}
            <Link
              href={withParams(FILTER_UNASSIGNED)}
              aria-current={filter === FILTER_UNASSIGNED ? "true" : undefined}
              className={`${chipBase} ${filter === FILTER_UNASSIGNED ? chipActive : chipInactive}`}
            >
              {dict.creator.library.unassignedLabel}
            </Link>
          </div>
        </nav>

        <AutoAssignButton dict={dict.creator.library} lang={lang as Locale} />

        <SearchInput
          placeholder={dict.creator.library.searchPlaceholder}
          label={dict.creator.library.searchPlaceholder}
        />
        <MediaLibrary
          rows={libraryRows}
          dict={dict.creator.library}
          lang={lang as Locale}
          searchActive={q.length > 0}
          transcriptOptions={transcriptOptions}
          destinations={destinations.map((d) => ({ id: d.id, name: d.name }))}
          knownTags={await listTagsForOwner(user.id)}
        />
      </div>
    </main>
  );
}
