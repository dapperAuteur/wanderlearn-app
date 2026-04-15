import type { Metadata } from "next";
import { and, desc, eq, isNull } from "drizzle-orm";
import { notFound } from "next/navigation";
import { db, schema } from "@/db/client";
import { hasLocale, type Locale } from "@/lib/locales";
import { requireCreator } from "@/lib/rbac";
import { getDictionary } from "../../dictionaries";
import { MediaUploader } from "@/components/media/media-uploader";
import { MediaLibrary, type MediaRow } from "@/components/media/media-library";
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

export default async function CreatorMediaPage({ params }: PageProps<"/[lang]/creator/media">) {
  const { lang } = await params;
  if (!hasLocale(lang)) notFound();
  const user = await requireCreator(lang);
  const dict = await getDictionary(lang);

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
      metadata: schema.mediaAssets.metadata,
      createdAt: schema.mediaAssets.createdAt,
    })
    .from(schema.mediaAssets)
    .where(
      and(eq(schema.mediaAssets.ownerId, user.id), isNull(schema.mediaAssets.deletedAt)),
    )
    .orderBy(desc(schema.mediaAssets.createdAt));

  const libraryRows: MediaRow[] = rows.map((row) => {
    const metadata = row.metadata as { filename?: string } | null;
    const fallbackName = metadata?.filename ?? null;
    return {
      id: row.id,
      kind: row.kind as UploadKind,
      status: row.status,
      cloudinaryPublicId: row.cloudinaryPublicId,
      cloudinarySecureUrl: row.cloudinarySecureUrl,
      sizeBytes: row.sizeBytes,
      durationSeconds: row.durationSeconds,
      displayName: row.displayName,
      description: row.description,
      fallbackName,
      createdAt: row.createdAt,
    };
  });

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-12 sm:px-6 lg:px-8">
      <h1 className="text-3xl font-semibold tracking-tight">{dict.creator.mediaTitle}</h1>
      <p className="mt-2 text-base text-zinc-600 dark:text-zinc-300">
        {dict.creator.mediaSubtitle}
      </p>

      <div className="mt-10">
        <MediaUploader dict={dict.creator.uploader} />
      </div>

      <div className="mt-12">
        <MediaLibrary rows={libraryRows} dict={dict.creator.library} lang={lang as Locale} />
      </div>
    </main>
  );
}
