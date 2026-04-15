import { and, desc, eq } from "drizzle-orm";
import { db, schema } from "@/db/client";

export type SceneRow = typeof schema.scenes.$inferSelect;

export async function listScenesForDestination(destinationId: string): Promise<SceneRow[]> {
  return db
    .select()
    .from(schema.scenes)
    .where(eq(schema.scenes.destinationId, destinationId))
    .orderBy(desc(schema.scenes.createdAt));
}

export async function getSceneById(id: string): Promise<SceneRow | null> {
  const rows = await db.select().from(schema.scenes).where(eq(schema.scenes.id, id)).limit(1);
  return rows[0] ?? null;
}

export async function countScenesForDestination(destinationId: string): Promise<number> {
  const rows = await listScenesForDestination(destinationId);
  return rows.length;
}

export type Photo360Row = {
  id: string;
  cloudinaryPublicId: string | null;
  cloudinarySecureUrl: string | null;
  createdAt: Date;
};

export async function listPhoto360ForOwner(ownerId: string): Promise<Photo360Row[]> {
  return db
    .select({
      id: schema.mediaAssets.id,
      cloudinaryPublicId: schema.mediaAssets.cloudinaryPublicId,
      cloudinarySecureUrl: schema.mediaAssets.cloudinarySecureUrl,
      createdAt: schema.mediaAssets.createdAt,
    })
    .from(schema.mediaAssets)
    .where(
      and(
        eq(schema.mediaAssets.ownerId, ownerId),
        eq(schema.mediaAssets.kind, "photo_360"),
        eq(schema.mediaAssets.status, "ready"),
      ),
    )
    .orderBy(desc(schema.mediaAssets.createdAt));
}
