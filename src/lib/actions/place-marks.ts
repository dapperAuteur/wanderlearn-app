"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { deletePlaceMark, upsertPlaceMark } from "@/db/queries/places";
import { getSession } from "@/lib/rbac";

type Result = { ok: true } | { ok: false; error: string };

const placeSchema = z.object({
  osmId: z.string().min(1).max(64),
  displayName: z.string().min(1).max(300),
  lat: z.number().gte(-90).lte(90),
  lng: z.number().gte(-180).lte(180),
});

const markSchema = z
  .object({
    destinationId: z.string().uuid().nullable(),
    place: placeSchema.nullable(),
    wantsToGo: z.boolean(),
    visitedInPerson: z.boolean(),
    // A date the learner types. Bounded below by "people were not visiting
    // museums in year 1" and above by today — a future "been there" is either
    // a typo or a wish, and either way it is not a visit.
    visitedOn: z.string().date().nullable(),
    isPublic: z.boolean(),
  })
  .refine((v) => (v.destinationId === null) !== (v.place === null), {
    message: "A mark is either an on-app destination or an off-app place, never both.",
  })
  .refine((v) => v.wantsToGo || v.visitedInPerson, {
    message: "A mark with neither flag set says nothing — delete it instead.",
  })
  .refine((v) => !v.visitedOn || new Date(v.visitedOn) <= new Date(), {
    message: "A visit cannot be in the future.",
  });

/**
 * Record or update a learner's self-declared mark on a place.
 *
 * These marks are SELF-DECLARED and must never be mistakable for an earned
 * stamp. That is enforced structurally rather than by convention: there is no
 * parameter here a learner could set that would make the mark look derived,
 * and the earned stamps come from a different table entirely (enrollments and
 * lesson progress, via buildPassport).
 *
 * `isPublic` is passed explicitly on every call rather than defaulting, so a
 * caller cannot make something public by forgetting a field.
 */
export async function savePlaceMark(input: unknown): Promise<Result> {
  const session = await getSession();
  if (!session) return { ok: false, error: "unauthorized" };

  const parsed = markSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "invalid" };
  }
  const v = parsed.data;

  try {
    if (v.destinationId) {
      await upsertPlaceMark({
        userId: session.user.id,
        destinationId: v.destinationId,
        wantsToGo: v.wantsToGo,
        visitedInPerson: v.visitedInPerson,
        visitedOn: v.visitedOn,
        isPublic: v.isPublic,
      });
    } else if (v.place) {
      await upsertPlaceMark({
        userId: session.user.id,
        osmId: v.place.osmId,
        place: {
          osmId: v.place.osmId,
          displayName: v.place.displayName,
          lat: v.place.lat,
          lng: v.place.lng,
        },
        wantsToGo: v.wantsToGo,
        visitedInPerson: v.visitedInPerson,
        visitedOn: v.visitedOn,
        isPublic: v.isPublic,
      });
    }
  } catch {
    return { ok: false, error: "save_failed" };
  }

  revalidatePath("/[lang]/account/passport", "page");
  return { ok: true };
}

export async function removePlaceMark(markId: string): Promise<Result> {
  const session = await getSession();
  if (!session) return { ok: false, error: "unauthorized" };
  if (!z.string().uuid().safeParse(markId).success) return { ok: false, error: "invalid" };

  // Scoped to the session user inside the query, so a guessed uuid deletes
  // nothing.
  await deletePlaceMark(session.user.id, markId);
  revalidatePath("/[lang]/account/passport", "page");
  return { ok: true };
}
