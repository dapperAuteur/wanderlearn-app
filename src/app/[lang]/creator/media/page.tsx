import type { Metadata } from "next";
import { and, desc, eq, isNull } from "drizzle-orm";
import { notFound } from "next/navigation";
import { db, schema } from "@/db/client";
import { listTranscriptsForOwner } from "@/db/queries/media";
import { searchMedia } from "@/db/queries/search";
import { hasLocale, type Locale } from "@/lib/locales";
import { requireCreator } from "@/lib/rbac";
import { getDictionary } from "../../dictionaries";
import { MediaUploader } from "@/components/media/media-uploader";
import { MediaLibrary, type MediaRow } from "@/components/media/media-library";
import { SearchInput } from "@/components/search/search-input";
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
  };
}

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
      })
      .from(schema.mediaAssets)
      .where(
        and(eq(schema.mediaAssets.ownerId, user.id), isNull(schema.mediaAssets.deletedAt)),
      )
      .orderBy(desc(schema.mediaAssets.createdAt));

    libraryRows = rows.map(toLibraryRow);
  }

  const transcriptOptions = await listTranscriptsForOwner(user.id);

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-12 sm:px-6 lg:px-8">
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
        />
      </div>
    </main>
  );
}
