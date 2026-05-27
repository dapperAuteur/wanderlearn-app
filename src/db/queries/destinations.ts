import { and, desc, eq, ne, sql } from "drizzle-orm";
import { db, schema } from "@/db/client";

export type DestinationRow = typeof schema.destinations.$inferSelect;

export async function listDestinations(): Promise<DestinationRow[]> {
  return db.select().from(schema.destinations).orderBy(desc(schema.destinations.createdAt));
}

export async function listPublicDestinations(): Promise<DestinationRow[]> {
  return db
    .select()
    .from(schema.destinations)
    .where(and(eq(schema.destinations.isPublic, true)))
    .orderBy(desc(schema.destinations.createdAt));
}

export async function getDestinationById(id: string): Promise<DestinationRow | null> {
  const rows = await db
    .select()
    .from(schema.destinations)
    .where(eq(schema.destinations.id, id))
    .limit(1);
  return rows[0] ?? null;
}

export async function getDestinationBySlug(slug: string): Promise<DestinationRow | null> {
  const rows = await db
    .select()
    .from(schema.destinations)
    .where(eq(schema.destinations.slug, slug))
    .limit(1);
  return rows[0] ?? null;
}

/**
 * Resolve whether a destination is currently linkable from external
 * tours. Tri-state semantics:
 *
 *   - destinations.allow_external_linking_override is null → fall back
 *     to bool_or() across every scene-owner's account default. Any
 *     creator with a scene at the destination whose
 *     allow_external_linking_default is true makes the destination
 *     linkable.
 *   - override is true/false → that value wins regardless of owner
 *     defaults.
 *   - destination has no scenes → not linkable (nothing to enter).
 *
 * Returned shape matches the call sites: the action layer validates
 * a chosen target with this; the public tour page uses it to filter
 * out a stale nextDestinationId; the picker uses it to filter the
 * options list.
 */
export async function isDestinationLinkable(destinationId: string): Promise<boolean> {
  const rows = await db
    .select({
      override: schema.destinations.allowExternalLinkingOverride,
      anyOwnerDefault: sql<boolean>`coalesce(bool_or(${schema.users.allowExternalLinkingDefault}), false)`,
    })
    .from(schema.destinations)
    .leftJoin(schema.scenes, eq(schema.scenes.destinationId, schema.destinations.id))
    .leftJoin(schema.users, eq(schema.users.id, schema.scenes.ownerId))
    .where(eq(schema.destinations.id, destinationId))
    .groupBy(
      schema.destinations.id,
      schema.destinations.allowExternalLinkingOverride,
    )
    .limit(1);
  const row = rows[0];
  if (!row) return false;
  if (row.override === true || row.override === false) return row.override;
  return row.anyOwnerDefault;
}

/**
 * List destinations a creator can pick as a cross-tour link target.
 * Returns the creator's own destinations (always selectable) plus any
 * other creator's destination that's currently linkable. Excludes the
 * passed `excludeDestinationId` (the one being edited, so a tour
 * can't list itself).
 */
export async function listLinkableDestinationsForCreator(params: {
  creatorId: string;
  excludeDestinationId?: string;
}): Promise<Array<{ id: string; name: string; slug: string; description: string | null }>> {
  // Two reasonable shapes: (1) the creator's own destinations,
  // identified by any scene they own at that destination; (2) other
  // creators' destinations that are linkable. Union'd via a single
  // bool_or aggregate per destination.
  const subq = db
    .select({
      destinationId: schema.scenes.destinationId,
      anyOwnerDefault: sql<boolean>`coalesce(bool_or(${schema.users.allowExternalLinkingDefault}), false)`.as(
        "any_owner_default",
      ),
      isOwnedByCaller: sql<boolean>`bool_or(${schema.scenes.ownerId} = ${params.creatorId})`.as(
        "is_owned_by_caller",
      ),
    })
    .from(schema.scenes)
    .innerJoin(schema.users, eq(schema.users.id, schema.scenes.ownerId))
    .groupBy(schema.scenes.destinationId)
    .as("owner_summary");

  const rows = await db
    .select({
      id: schema.destinations.id,
      name: schema.destinations.name,
      slug: schema.destinations.slug,
      description: schema.destinations.description,
      override: schema.destinations.allowExternalLinkingOverride,
      anyOwnerDefault: subq.anyOwnerDefault,
      isOwnedByCaller: subq.isOwnedByCaller,
    })
    .from(schema.destinations)
    .innerJoin(subq, eq(subq.destinationId, schema.destinations.id))
    .where(
      params.excludeDestinationId
        ? ne(schema.destinations.id, params.excludeDestinationId)
        : undefined,
    )
    .orderBy(desc(schema.destinations.createdAt));

  return rows
    .filter((r) => {
      // Caller's own destinations are always pickable. Other creators'
      // destinations only when isLinkable resolves true.
      if (r.isOwnedByCaller) return true;
      if (r.override === true || r.override === false) return r.override;
      return r.anyOwnerDefault;
    })
    .map((r) => ({
      id: r.id,
      name: r.name,
      slug: r.slug,
      description: r.description,
    }));
}

