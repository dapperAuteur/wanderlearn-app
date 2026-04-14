import { desc, eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { db, schema } from "@/db/client";
import { hasLocale } from "@/lib/locales";
import { requireCreator } from "@/lib/rbac";
import { getDictionary } from "../../dictionaries";
import { MediaUploader } from "@/components/media/media-uploader";
import { MediaLibrary, type MediaRow } from "@/components/media/media-library";
import type { UploadKind } from "@/lib/cloudinary";

export const dynamic = "force-dynamic";

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
      createdAt: schema.mediaAssets.createdAt,
    })
    .from(schema.mediaAssets)
    .where(eq(schema.mediaAssets.ownerId, user.id))
    .orderBy(desc(schema.mediaAssets.createdAt));

  const libraryRows: MediaRow[] = rows.map((row) => ({
    id: row.id,
    kind: row.kind as UploadKind,
    status: row.status,
    cloudinaryPublicId: row.cloudinaryPublicId,
    cloudinarySecureUrl: row.cloudinarySecureUrl,
    sizeBytes: row.sizeBytes,
    durationSeconds: row.durationSeconds,
    createdAt: row.createdAt,
  }));

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
        <MediaLibrary rows={libraryRows} dict={dict.creator.library} />
      </div>
    </main>
  );
}
