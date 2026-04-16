import { and, desc, eq, ilike, isNull, or, sql } from "drizzle-orm";
import { db, schema } from "@/db/client";

const LIMIT_DEFAULT = 30;

export type SearchMediaRow = {
  id: string;
  kind: string;
  status: string;
  displayName: string | null;
  description: string | null;
  cloudinaryPublicId: string | null;
  cloudinarySecureUrl: string | null;
  sizeBytes: number | null;
  durationSeconds: number | null;
  tags: string[];
  transcriptMediaId: string | null;
  metadata: unknown;
  createdAt: Date;
};

export async function searchMedia(
  ownerId: string,
  query: string,
  opts?: { kinds?: string[]; tags?: string[]; limit?: number; offset?: number },
): Promise<{ rows: SearchMediaRow[]; total: number }> {
  const limit = opts?.limit ?? LIMIT_DEFAULT;
  const offset = opts?.offset ?? 0;
  const like = `%${query}%`;

  const conditions = [
    eq(schema.mediaAssets.ownerId, ownerId),
    isNull(schema.mediaAssets.deletedAt),
  ];

  if (query.length > 0) {
    conditions.push(
      or(
        ilike(schema.mediaAssets.displayName, like),
        ilike(schema.mediaAssets.description, like),
        sql`${schema.mediaAssets.tags}::text[] @> ARRAY[${query}]::text[]`,
      )!,
    );
  }

  if (opts?.kinds && opts.kinds.length > 0) {
    conditions.push(
      or(
        ...opts.kinds.map((k) => eq(schema.mediaAssets.kind, k as typeof schema.mediaAssets.kind.enumValues[number])),
      )!,
    );
  }

  if (opts?.tags && opts.tags.length > 0) {
    for (const tag of opts.tags) {
      conditions.push(sql`${schema.mediaAssets.tags}::text[] @> ARRAY[${tag}]::text[]`);
    }
  }

  const where = and(...conditions);

  const [rows, countResult] = await Promise.all([
    db
      .select({
        id: schema.mediaAssets.id,
        kind: schema.mediaAssets.kind,
        status: schema.mediaAssets.status,
        displayName: schema.mediaAssets.displayName,
        description: schema.mediaAssets.description,
        cloudinaryPublicId: schema.mediaAssets.cloudinaryPublicId,
        cloudinarySecureUrl: schema.mediaAssets.cloudinarySecureUrl,
        sizeBytes: schema.mediaAssets.sizeBytes,
        durationSeconds: schema.mediaAssets.durationSeconds,
        tags: schema.mediaAssets.tags,
        transcriptMediaId: schema.mediaAssets.transcriptMediaId,
        metadata: schema.mediaAssets.metadata,
        createdAt: schema.mediaAssets.createdAt,
      })
      .from(schema.mediaAssets)
      .where(where)
      .orderBy(
        query.length > 0
          ? sql`similarity(${schema.mediaAssets.displayName}, ${query}) DESC`
          : desc(schema.mediaAssets.createdAt),
      )
      .limit(limit)
      .offset(offset),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(schema.mediaAssets)
      .where(where),
  ]);

  return { rows, total: countResult[0]?.count ?? 0 };
}

export type SearchDestinationRow = {
  id: string;
  name: string;
  slug: string;
  city: string | null;
  country: string | null;
};

export async function searchDestinations(
  query: string,
  limit = 20,
): Promise<SearchDestinationRow[]> {
  if (!query) {
    return db
      .select({
        id: schema.destinations.id,
        name: schema.destinations.name,
        slug: schema.destinations.slug,
        city: schema.destinations.city,
        country: schema.destinations.country,
      })
      .from(schema.destinations)
      .orderBy(desc(schema.destinations.createdAt))
      .limit(limit);
  }

  const like = `%${query}%`;
  return db
    .select({
      id: schema.destinations.id,
      name: schema.destinations.name,
      slug: schema.destinations.slug,
      city: schema.destinations.city,
      country: schema.destinations.country,
    })
    .from(schema.destinations)
    .where(
      or(
        ilike(schema.destinations.name, like),
        ilike(schema.destinations.slug, like),
        ilike(schema.destinations.city, like),
        ilike(schema.destinations.country, like),
        ilike(schema.destinations.description, like),
      ),
    )
    .orderBy(sql`similarity(${schema.destinations.name}, ${query}) DESC`)
    .limit(limit);
}

export type SearchSceneRow = {
  id: string;
  name: string;
  caption: string | null;
  destinationId: string | null;
};

export async function searchScenes(
  query: string,
  opts?: { destinationId?: string; limit?: number },
): Promise<SearchSceneRow[]> {
  const limit = opts?.limit ?? 20;
  const conditions: ReturnType<typeof eq>[] = [];

  if (opts?.destinationId) {
    conditions.push(eq(schema.scenes.destinationId, opts.destinationId));
  }

  if (query) {
    const like = `%${query}%`;
    conditions.push(
      or(
        ilike(schema.scenes.name, like),
        ilike(schema.scenes.caption, like),
      )!,
    );
  }

  return db
    .select({
      id: schema.scenes.id,
      name: schema.scenes.name,
      caption: schema.scenes.caption,
      destinationId: schema.scenes.destinationId,
    })
    .from(schema.scenes)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(
      query
        ? sql`similarity(${schema.scenes.name}, ${query}) DESC`
        : desc(schema.scenes.createdAt),
    )
    .limit(limit);
}
