import { and, desc, eq, inArray, isNull, notInArray, or, type SQL } from "drizzle-orm";
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

export type VideoRow = {
  id: string;
  displayName: string | null;
  cloudinaryPublicId: string | null;
  cloudinarySecureUrl: string | null;
  durationSeconds: number | null;
  transcriptMediaId: string | null;
  createdAt: Date;
};

export async function listVideo360ForOwner(ownerId: string): Promise<VideoRow[]> {
  return db
    .select({
      id: schema.mediaAssets.id,
      displayName: schema.mediaAssets.displayName,
      cloudinaryPublicId: schema.mediaAssets.cloudinaryPublicId,
      cloudinarySecureUrl: schema.mediaAssets.cloudinarySecureUrl,
      durationSeconds: schema.mediaAssets.durationSeconds,
      transcriptMediaId: schema.mediaAssets.transcriptMediaId,
      createdAt: schema.mediaAssets.createdAt,
    })
    .from(schema.mediaAssets)
    .where(
      and(
        eq(schema.mediaAssets.ownerId, ownerId),
        eq(schema.mediaAssets.kind, "video_360"),
        eq(schema.mediaAssets.status, "ready"),
        isNull(schema.mediaAssets.deletedAt),
      ),
    )
    .orderBy(desc(schema.mediaAssets.createdAt));
}

export async function listStandardVideosForOwner(ownerId: string): Promise<VideoRow[]> {
  return db
    .select({
      id: schema.mediaAssets.id,
      displayName: schema.mediaAssets.displayName,
      cloudinaryPublicId: schema.mediaAssets.cloudinaryPublicId,
      cloudinarySecureUrl: schema.mediaAssets.cloudinarySecureUrl,
      durationSeconds: schema.mediaAssets.durationSeconds,
      transcriptMediaId: schema.mediaAssets.transcriptMediaId,
      createdAt: schema.mediaAssets.createdAt,
    })
    .from(schema.mediaAssets)
    .where(
      and(
        eq(schema.mediaAssets.ownerId, ownerId),
        eq(schema.mediaAssets.kind, "standard_video"),
        eq(schema.mediaAssets.status, "ready"),
        isNull(schema.mediaAssets.deletedAt),
      ),
    )
    .orderBy(desc(schema.mediaAssets.createdAt));
}

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

// --- Destination-scoped media library --------------------------------

export type DestinationLibrarySource = "explicit" | "auto-scene";

export type DestinationLibraryRow = {
  id: string;
  kind: typeof schema.mediaAssets.$inferSelect.kind;
  displayName: string | null;
  cloudinaryPublicId: string | null;
  cloudinarySecureUrl: string | null;
  tags: string[];
  createdAt: Date;
  /**
   * `explicit` rows are in `destination_media_assets`. `auto-scene`
   * rows are surfaced because the owner's scenes at this destination
   * already reference the media via panoramaMediaId/posterMediaId.
   * The UI shows the two groups separately so it's obvious which
   * media is part of the library by intent vs. by side-effect.
   */
  source: DestinationLibrarySource;
};

/**
 * The full destination media library for one creator. Unions:
 *
 *   1. Explicit assignments via `destination_media_assets`.
 *   2. Media referenced by panoramaMediaId / posterMediaId from the
 *      same creator's scenes at this destination (auto-include rule
 *      decided in the design phase — creators don't have to manually
 *      "library" panoramas they've already wired up).
 *
 * Owner-scoped: creator A never sees creator B's media here even if
 * they both have scenes at the destination. Phase 1 trade-off; can
 * relax later with explicit consent semantics.
 *
 * Admin retention (callerIsAdmin = true): the owner-scope WHERE
 * expands to include media where the *original admin owner* was
 * this caller — i.e. media this admin once owned and transferred to
 * another account. Lets the admin's library view stay visually
 * complete after a destination transfer. Non-admins always get the
 * strict owner filter regardless of this flag.
 *
 * Dedup rule: if a media asset shows up via both paths, it's reported
 * as `explicit` (the more intentional source).
 */
export async function listMediaForDestination(
  destinationId: string,
  ownerId: string,
  options: { callerIsAdmin?: boolean } = {},
): Promise<DestinationLibraryRow[]> {
  const ownershipFilter: SQL = options.callerIsAdmin
    ? (or(
        eq(schema.mediaAssets.ownerId, ownerId),
        eq(schema.mediaAssets.originalAdminOwnerId, ownerId),
      ) as SQL)
    : eq(schema.mediaAssets.ownerId, ownerId);

  const explicitRows = await db
    .select({
      id: schema.mediaAssets.id,
      kind: schema.mediaAssets.kind,
      displayName: schema.mediaAssets.displayName,
      cloudinaryPublicId: schema.mediaAssets.cloudinaryPublicId,
      cloudinarySecureUrl: schema.mediaAssets.cloudinarySecureUrl,
      tags: schema.mediaAssets.tags,
      createdAt: schema.mediaAssets.createdAt,
    })
    .from(schema.destinationMediaAssets)
    .innerJoin(
      schema.mediaAssets,
      eq(schema.destinationMediaAssets.mediaAssetId, schema.mediaAssets.id),
    )
    .where(
      and(
        eq(schema.destinationMediaAssets.destinationId, destinationId),
        ownershipFilter,
        eq(schema.mediaAssets.status, "ready"),
        isNull(schema.mediaAssets.deletedAt),
      ),
    )
    .orderBy(desc(schema.mediaAssets.createdAt));

  // Auto-include set: every panoramaMediaId + posterMediaId referenced
  // by scenes at this destination. Owner filter mirrors the explicit
  // path so admins see scene-referenced media they once owned, plus
  // the scenes they currently own. Non-admins keep the strict owner
  // filter on their own scenes.
  const explicitIds = new Set(explicitRows.map((r) => r.id));

  const sceneFilter: SQL = options.callerIsAdmin
    ? eq(schema.scenes.destinationId, destinationId)
    : (and(
        eq(schema.scenes.destinationId, destinationId),
        eq(schema.scenes.ownerId, ownerId),
      ) as SQL);

  const sceneMediaIds = await db
    .select({
      panorama: schema.scenes.panoramaMediaId,
      poster: schema.scenes.posterMediaId,
    })
    .from(schema.scenes)
    .where(sceneFilter);

  const autoCandidateIds = new Set<string>();
  for (const row of sceneMediaIds) {
    if (row.panorama && !explicitIds.has(row.panorama)) {
      autoCandidateIds.add(row.panorama);
    }
    if (row.poster && !explicitIds.has(row.poster)) {
      autoCandidateIds.add(row.poster);
    }
  }

  const autoRows: DestinationLibraryRow[] = [];
  if (autoCandidateIds.size > 0) {
    const fetched = await db
      .select({
        id: schema.mediaAssets.id,
        kind: schema.mediaAssets.kind,
        displayName: schema.mediaAssets.displayName,
        cloudinaryPublicId: schema.mediaAssets.cloudinaryPublicId,
        cloudinarySecureUrl: schema.mediaAssets.cloudinarySecureUrl,
        tags: schema.mediaAssets.tags,
        createdAt: schema.mediaAssets.createdAt,
      })
      .from(schema.mediaAssets)
      .where(
        and(
          inArray(schema.mediaAssets.id, Array.from(autoCandidateIds)),
          // Defensive: re-assert ownership so a future cross-owner
          // poster-picker regression doesn't silently leak media.
          // Admins also pick up media they once owned via
          // originalAdminOwnerId (the destination-transfer retention path).
          ownershipFilter,
          eq(schema.mediaAssets.status, "ready"),
          isNull(schema.mediaAssets.deletedAt),
        ),
      )
      .orderBy(desc(schema.mediaAssets.createdAt));
    autoRows.push(...fetched.map((r) => ({ ...r, source: "auto-scene" as const })));
  }

  return [
    ...explicitRows.map((r) => ({ ...r, source: "explicit" as const })),
    ...autoRows,
  ];
}

/**
 * Candidates the creator can pick to ADD to a destination's library —
 * the creator's own media that isn't already in the explicit
 * assignment set. We don't subtract auto-scene media here on purpose:
 * letting the creator promote a "this is here because I used it in a
 * scene" entry into an explicit assignment is fine, and the unique
 * index on the join table prevents duplicate explicit rows anyway.
 */
export async function listAssignableMediaForDestination(
  destinationId: string,
  ownerId: string,
): Promise<DestinationLibraryRow[]> {
  const alreadyAssigned = db
    .select({ id: schema.destinationMediaAssets.mediaAssetId })
    .from(schema.destinationMediaAssets)
    .where(eq(schema.destinationMediaAssets.destinationId, destinationId));

  const rows = await db
    .select({
      id: schema.mediaAssets.id,
      kind: schema.mediaAssets.kind,
      displayName: schema.mediaAssets.displayName,
      cloudinaryPublicId: schema.mediaAssets.cloudinaryPublicId,
      cloudinarySecureUrl: schema.mediaAssets.cloudinarySecureUrl,
      tags: schema.mediaAssets.tags,
      createdAt: schema.mediaAssets.createdAt,
    })
    .from(schema.mediaAssets)
    .where(
      and(
        eq(schema.mediaAssets.ownerId, ownerId),
        eq(schema.mediaAssets.status, "ready"),
        isNull(schema.mediaAssets.deletedAt),
        notInArray(schema.mediaAssets.id, alreadyAssigned),
      ),
    )
    .orderBy(desc(schema.mediaAssets.createdAt));

  return rows.map((r) => ({ ...r, source: "explicit" as const }));
}

/**
 * Cheap presence check used by the assign action — it's only allowed
 * to assign media to a destination where the creator has at least one
 * scene (matches the "ownership-by-presence" pattern used elsewhere
 * since destinations have no ownerId column).
 */
export async function creatorHasSceneAtDestination(
  destinationId: string,
  ownerId: string,
): Promise<boolean> {
  const [row] = await db
    .select({ id: schema.scenes.id })
    .from(schema.scenes)
    .where(
      and(
        eq(schema.scenes.destinationId, destinationId),
        eq(schema.scenes.ownerId, ownerId),
      ),
    )
    .limit(1);
  return Boolean(row);
}
