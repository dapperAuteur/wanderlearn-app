import { and, desc, eq, isNull } from "drizzle-orm";
import { db, schema } from "@/db/client";

export type MediaAssetRow = typeof schema.mediaAssets.$inferSelect;

export async function getMediaAssetById(id: string): Promise<MediaAssetRow | null> {
  const rows = await db
    .select()
    .from(schema.mediaAssets)
    .where(and(eq(schema.mediaAssets.id, id), isNull(schema.mediaAssets.deletedAt)))
    .limit(1);
  return rows[0] ?? null;
}

export type TranscriptRow = {
  id: string;
  displayName: string | null;
  createdAt: Date;
};

export async function listTranscriptsForOwner(ownerId: string): Promise<TranscriptRow[]> {
  return db
    .select({
      id: schema.mediaAssets.id,
      displayName: schema.mediaAssets.displayName,
      createdAt: schema.mediaAssets.createdAt,
    })
    .from(schema.mediaAssets)
    .where(
      and(
        eq(schema.mediaAssets.ownerId, ownerId),
        eq(schema.mediaAssets.kind, "transcript"),
        eq(schema.mediaAssets.status, "ready"),
        isNull(schema.mediaAssets.deletedAt),
      ),
    )
    .orderBy(desc(schema.mediaAssets.createdAt));
}
