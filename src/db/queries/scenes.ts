import { and, desc, eq, inArray, isNull } from "drizzle-orm";
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
  displayName: string | null;
  createdAt: Date;
};

export async function listPhoto360ForOwner(ownerId: string): Promise<Photo360Row[]> {
  return db
    .select({
      id: schema.mediaAssets.id,
      cloudinaryPublicId: schema.mediaAssets.cloudinaryPublicId,
      cloudinarySecureUrl: schema.mediaAssets.cloudinarySecureUrl,
      displayName: schema.mediaAssets.displayName,
      createdAt: schema.mediaAssets.createdAt,
    })
    .from(schema.mediaAssets)
    .where(
      and(
        eq(schema.mediaAssets.ownerId, ownerId),
        eq(schema.mediaAssets.kind, "photo_360"),
        eq(schema.mediaAssets.status, "ready"),
        isNull(schema.mediaAssets.deletedAt),
      ),
    )
    .orderBy(desc(schema.mediaAssets.createdAt));
}

export type HeroMediaRow = {
  id: string;
  kind: "image" | "photo_360";
  cloudinaryPublicId: string | null;
  cloudinarySecureUrl: string | null;
  displayName: string | null;
  createdAt: Date;
};

export async function listHeroMediaForOwner(ownerId: string): Promise<HeroMediaRow[]> {
  const rows = await db
    .select({
      id: schema.mediaAssets.id,
      kind: schema.mediaAssets.kind,
      cloudinaryPublicId: schema.mediaAssets.cloudinaryPublicId,
      cloudinarySecureUrl: schema.mediaAssets.cloudinarySecureUrl,
      displayName: schema.mediaAssets.displayName,
      createdAt: schema.mediaAssets.createdAt,
    })
    .from(schema.mediaAssets)
    .where(
      and(
        eq(schema.mediaAssets.ownerId, ownerId),
        inArray(schema.mediaAssets.kind, ["image", "photo_360"]),
        eq(schema.mediaAssets.status, "ready"),
        isNull(schema.mediaAssets.deletedAt),
      ),
    )
    .orderBy(desc(schema.mediaAssets.createdAt));
  return rows.map((row) => ({
    ...row,
    kind: row.kind as "image" | "photo_360",
  }));
}
