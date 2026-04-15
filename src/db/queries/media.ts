import { and, eq, isNull } from "drizzle-orm";
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
