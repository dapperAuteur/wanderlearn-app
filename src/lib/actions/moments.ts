"use server";

import { and, eq, inArray, ne, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db, schema } from "@/db/client";
import { requireCreator } from "@/lib/rbac";
import type { Locale } from "@/lib/locales";

// Moments (plans/15). Timeline actions are destination settings, so they
// authorize like the other destination settings (requireCreator).

type Result<T> = { ok: true; data: T } | { ok: false; error: string; code: string };

const langSchema = z.enum(["en", "es"]);
const labelSchema = z.string().trim().min(1).max(40);
// Optional ISO date; empty string from a cleared <input type="date"> means none.
const occurredOnSchema = z
  .union([z.string().regex(/^\d{4}-\d{2}-\d{2}$/), z.literal("")])
  .nullable()
  .optional()
  .transform((value) => (value ? value : null));

const invalid = { ok: false, error: "Invalid input", code: "invalid_input" } as const;

async function revalidateTimeline(lang: Locale, destinationId: string) {
  revalidatePath(`/${lang}/creator/destinations/${destinationId}`);
  // Scene editors list the tour's moments too.
  revalidatePath("/[lang]/creator/destinations/[id]/scenes/[sceneId]", "page");
  revalidatePath("/[lang]/creator/destinations/[id]/scenes/[sceneId]/edit", "page");
  const [row] = await db
    .select({ slug: schema.destinations.slug })
    .from(schema.destinations)
    .where(eq(schema.destinations.id, destinationId))
    .limit(1);
  if (row) {
    revalidatePath(`/${lang}/tours/${row.slug}`);
    revalidatePath(`/embed/tours/${row.slug}`);
  }
}

const addSchema = z.object({
  destinationId: z.string().uuid(),
  label: labelSchema,
  occurredOn: occurredOnSchema,
  /** What to call the base view if this is the tour's first moment ("Now"). */
  baseLabel: labelSchema,
  lang: langSchema,
});

/**
 * Adds a moment to a tour's timeline. The first one also creates the base
 * view (the scenes' own photos), so every timeline has exactly one.
 *
 * Two inserts without a transaction (neon-http has none), ordered so a
 * failure in between is harmless: a lone base view shows no switcher.
 */
export async function addTourMoment(input: z.input<typeof addSchema>): Promise<Result<{ id: string }>> {
  const parsed = addSchema.safeParse(input);
  if (!parsed.success) return invalid;
  const { destinationId, label, occurredOn, baseLabel, lang } = parsed.data;
  await requireCreator(lang);

  const [destination] = await db
    .select({ id: schema.destinations.id })
    .from(schema.destinations)
    .where(eq(schema.destinations.id, destinationId))
    .limit(1);
  if (!destination) return { ok: false, error: "Destination not found", code: "not_found" };

  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(schema.tourMoments)
    .where(eq(schema.tourMoments.destinationId, destinationId));

  // The partial unique index allows one base per tour, so a double click
  // can't create two.
  await db
    .insert(schema.tourMoments)
    .values({ destinationId, label: baseLabel, isBase: true, sortOrder: 1000 })
    .onConflictDoNothing();

  const [row] = await db
    .insert(schema.tourMoments)
    .values({ destinationId, label, occurredOn, sortOrder: count })
    .returning({ id: schema.tourMoments.id });

  await revalidateTimeline(lang, destinationId);
  return { ok: true, data: { id: row.id } };
}

const updateSchema = z.object({
  id: z.string().uuid(),
  label: labelSchema,
  occurredOn: occurredOnSchema,
  lang: langSchema,
});

/** Renames or re-dates a moment, the base view included. */
export async function updateTourMoment(
  input: z.input<typeof updateSchema>,
): Promise<Result<{ id: string }>> {
  const parsed = updateSchema.safeParse(input);
  if (!parsed.success) return invalid;
  const { id, label, occurredOn, lang } = parsed.data;
  await requireCreator(lang);

  const [row] = await db
    .update(schema.tourMoments)
    .set({ label, occurredOn, updatedAt: new Date() })
    .where(eq(schema.tourMoments.id, id))
    .returning({ destinationId: schema.tourMoments.destinationId });
  if (!row) return { ok: false, error: "Moment not found", code: "not_found" };

  await revalidateTimeline(lang, row.destinationId);
  return { ok: true, data: { id } };
}

const reorderSchema = z.object({
  destinationId: z.string().uuid(),
  orderedIds: z.array(z.string().uuid()).min(1).max(50),
  lang: langSchema,
});

/** Saves the timeline order in one statement. Ids from another tour are ignored. */
export async function reorderTourMoments(
  input: z.input<typeof reorderSchema>,
): Promise<Result<{ count: number }>> {
  const parsed = reorderSchema.safeParse(input);
  if (!parsed.success) return invalid;
  const { destinationId, orderedIds, lang } = parsed.data;
  await requireCreator(lang);

  const cases = sql.join(
    orderedIds.map((id, index) => sql`when ${id}::uuid then ${index}::int`),
    sql` `,
  );
  await db
    .update(schema.tourMoments)
    .set({ sortOrder: sql`case ${schema.tourMoments.id} ${cases} end`, updatedAt: new Date() })
    .where(
      and(
        eq(schema.tourMoments.destinationId, destinationId),
        inArray(schema.tourMoments.id, orderedIds),
      ),
    );

  await revalidateTimeline(lang, destinationId);
  return { ok: true, data: { count: orderedIds.length } };
}

const deleteSchema = z.object({ id: z.string().uuid(), lang: langSchema });

/**
 * Deletes a moment and its photos' links to scenes (the photos stay in the
 * media library). Hotspots limited to it go back to showing in every moment.
 * The base view can't be deleted on its own; deleting the last other moment
 * takes it too, returning the tour to having no timeline.
 */
export async function deleteTourMoment(
  input: z.input<typeof deleteSchema>,
): Promise<Result<{ id: string; timelineCleared: boolean }>> {
  const parsed = deleteSchema.safeParse(input);
  if (!parsed.success) return invalid;
  const { id, lang } = parsed.data;
  await requireCreator(lang);

  const [moment] = await db
    .select({ destinationId: schema.tourMoments.destinationId, isBase: schema.tourMoments.isBase })
    .from(schema.tourMoments)
    .where(eq(schema.tourMoments.id, id))
    .limit(1);
  if (!moment) return { ok: false, error: "Moment not found", code: "not_found" };
  if (moment.isBase) {
    return { ok: false, error: "The base view can't be deleted", code: "base_moment" };
  }

  await db.delete(schema.tourMoments).where(eq(schema.tourMoments.id, id));

  const [{ others }] = await db
    .select({ others: sql<number>`count(*)::int` })
    .from(schema.tourMoments)
    .where(
      and(
        eq(schema.tourMoments.destinationId, moment.destinationId),
        ne(schema.tourMoments.isBase, true),
      ),
    );
  const timelineCleared = others === 0;
  if (timelineCleared) {
    await db
      .delete(schema.tourMoments)
      .where(
        and(
          eq(schema.tourMoments.destinationId, moment.destinationId),
          eq(schema.tourMoments.isBase, true),
        ),
      );
  }

  await revalidateTimeline(lang, moment.destinationId);
  return { ok: true, data: { id, timelineCleared } };
}

const offlineSchema = z.object({
  destinationId: z.string().uuid(),
  include: z.boolean(),
  lang: langSchema,
});

/** Per tour: whether "Save for offline" also downloads every moment's photo. */
export async function setOfflineIncludeMoments(
  input: z.input<typeof offlineSchema>,
): Promise<Result<{ include: boolean }>> {
  const parsed = offlineSchema.safeParse(input);
  if (!parsed.success) return invalid;
  const { destinationId, include, lang } = parsed.data;
  await requireCreator(lang);

  const [row] = await db
    .update(schema.destinations)
    .set({ offlineIncludeMoments: include, updatedAt: new Date() })
    .where(eq(schema.destinations.id, destinationId))
    .returning({ id: schema.destinations.id });
  if (!row) return { ok: false, error: "Destination not found", code: "not_found" };

  await revalidateTimeline(lang, destinationId);
  return { ok: true, data: { include } };
}
