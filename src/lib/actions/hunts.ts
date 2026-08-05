"use server";

import { and, eq, max } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db, schema } from "@/db/client";
import { canManageOrOwn, requireCreatorWithAuthz } from "@/lib/rbac";
import { answerMatches, deriveMode, evaluateStops, keysAfter } from "@/lib/hunts";
import { listHotspotKeysForDestination, listProgress, listStopsForHunt, toStopInputs } from "@/db/queries/hunts";

// Server actions for hunts. Authorization uses the EXISTING "tours" resource rather than adding a
// "hunts" one: permissions.ts documents `tours` as "edit tour-render settings on a destination", a
// hunt is exactly that, and adding a resource would mean migrating every site_manager's permissions
// JSONB for no gain.

type Result<T> = { ok: true; data: T } | { ok: false; error: string; code: string };

const langSchema = z.enum(["en", "es"]);

function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 60);
}

async function revalidateHuntPaths(lang: string, destinationId: string, huntId?: string) {
  revalidatePath(`/${lang}/creator/destinations/${destinationId}/hunts`);
  if (huntId) revalidatePath(`/${lang}/creator/destinations/${destinationId}/hunts/${huntId}`);
  const [row] = await db
    .select({ slug: schema.destinations.slug })
    .from(schema.destinations)
    .where(eq(schema.destinations.id, destinationId))
    .limit(1);
  if (row) revalidatePath(`/${lang}/tours/${row.slug}`);
}

type HuntRow = typeof schema.hunts.$inferSelect;

/** Load the hunt and check the caller may edit it. Every mutating action starts here. */
async function requireEditableHunt(
  huntId: string,
  lang: string,
): Promise<{ ok: true; hunt: HuntRow } | { ok: false; error: string; code: string }> {
  const user = await requireCreatorWithAuthz(lang);
  const [hunt] = await db.select().from(schema.hunts).where(eq(schema.hunts.id, huntId)).limit(1);
  if (!hunt) return { ok: false, error: "Hunt not found", code: "not_found" };
  if (!canManageOrOwn(user, hunt.ownerId, "tours", "update")) {
    return { ok: false, error: "Not allowed", code: "forbidden" };
  }
  return { ok: true, hunt };
}

/**
 * Recompute the hunt's derived state from its stops.
 *
 * `mode` is DERIVED, never accepted from a form: a hunt badged "playable from anywhere" whose stops
 * demand physical presence would send someone on a walk they did not sign up for. Called after every
 * mutation that can change what the stops require.
 */
async function refreshDerivedMode(huntId: string) {
  const rows = await db
    .select({ unlockKind: schema.huntStops.unlockKind })
    .from(schema.huntStops)
    .where(eq(schema.huntStops.huntId, huntId));
  await db
    .update(schema.hunts)
    .set({ mode: deriveMode(rows), updatedAt: new Date() })
    .where(eq(schema.hunts.id, huntId));
}

// ── Hunt CRUD ──────────────────────────────────────────────────────────────────────────────────

const createSchema = z.object({
  destinationId: z.string().uuid(),
  title: z.string().trim().min(1).max(120),
  intro: z.string().trim().max(2000).optional(),
  lang: langSchema,
});

export async function createHunt(formData: FormData): Promise<Result<{ id: string }>> {
  const parsed = createSchema.safeParse({
    destinationId: String(formData.get("destinationId") ?? ""),
    title: String(formData.get("title") ?? ""),
    intro: String(formData.get("intro") ?? "") || undefined,
    lang: String(formData.get("lang") ?? "en"),
  });
  if (!parsed.success) return { ok: false, error: "Give the hunt a title.", code: "invalid_input" };

  const user = await requireCreatorWithAuthz(parsed.data.lang);
  const [destination] = await db
    .select({ id: schema.destinations.id })
    .from(schema.destinations)
    .where(eq(schema.destinations.id, parsed.data.destinationId))
    .limit(1);
  if (!destination) return { ok: false, error: "Destination not found", code: "not_found" };

  const base = slugify(parsed.data.title) || "hunt";
  // Slug is unique per destination, so disambiguate rather than failing on a duplicate title.
  let slug = base;
  for (let n = 2; n < 50; n++) {
    const [clash] = await db
      .select({ id: schema.hunts.id })
      .from(schema.hunts)
      .where(and(eq(schema.hunts.destinationId, destination.id), eq(schema.hunts.slug, slug)))
      .limit(1);
    if (!clash) break;
    slug = `${base}-${n}`;
  }

  const [row] = await db
    .insert(schema.hunts)
    .values({
      ownerId: user.id,
      destinationId: destination.id,
      slug,
      title: parsed.data.title,
      intro: parsed.data.intro ?? null,
    })
    .returning({ id: schema.hunts.id });

  await revalidateHuntPaths(parsed.data.lang, destination.id, row.id);
  return { ok: true, data: { id: row.id } };
}

const updateSchema = z.object({
  id: z.string().uuid(),
  title: z.string().trim().min(1).max(120),
  intro: z.string().trim().max(2000).optional(),
  allowRemoteFallback: z.boolean(),
  lang: langSchema,
});

export async function updateHunt(formData: FormData): Promise<Result<{ id: string }>> {
  const parsed = updateSchema.safeParse({
    id: String(formData.get("id") ?? ""),
    title: String(formData.get("title") ?? ""),
    intro: String(formData.get("intro") ?? "") || undefined,
    // An unchecked checkbox submits nothing, so absence means false.
    allowRemoteFallback: formData.get("allowRemoteFallback") != null,
    lang: String(formData.get("lang") ?? "en"),
  });
  if (!parsed.success) return { ok: false, error: "Check the values and try again.", code: "invalid_input" };

  const found = await requireEditableHunt(parsed.data.id, parsed.data.lang);
  if (!found.ok) return found;

  await db
    .update(schema.hunts)
    .set({
      title: parsed.data.title,
      intro: parsed.data.intro ?? null,
      allowRemoteFallback: parsed.data.allowRemoteFallback,
      updatedAt: new Date(),
    })
    .where(eq(schema.hunts.id, parsed.data.id));

  await revalidateHuntPaths(parsed.data.lang, found.hunt.destinationId, parsed.data.id);
  return { ok: true, data: { id: parsed.data.id } };
}

const publishSchema = z.object({
  id: z.string().uuid(),
  publish: z.boolean(),
  lang: langSchema,
});

/**
 * Publish or unpublish.
 *
 * Publishing is BLOCKED while the hunt has any `error`-level health problem. A hunt with an
 * unobtainable key or an unplaced geo stop cannot be finished by anyone, and the person who finds
 * that out is a visitor standing outside in the rain. Warnings do not block: they are judgement
 * calls, and a creator who has read them may proceed.
 */
export async function setHuntPublished(formData: FormData): Promise<Result<{ published: boolean }>> {
  const parsed = publishSchema.safeParse({
    id: String(formData.get("id") ?? ""),
    publish: String(formData.get("publish") ?? "") === "true",
    lang: String(formData.get("lang") ?? "en"),
  });
  if (!parsed.success) return { ok: false, error: "Invalid input", code: "invalid_input" };

  const found = await requireEditableHunt(parsed.data.id, parsed.data.lang);
  if (!found.ok) return found;

  if (parsed.data.publish) {
    const { analyzeHunt } = await import("@/lib/hunts");
    const stops = await listStopsForHunt(parsed.data.id);
    const problems = analyzeHunt({
      allowRemoteFallback: found.hunt.allowRemoteFallback,
      stops: toStopInputs(stops),
      hotspotKeys: await listHotspotKeysForDestination(found.hunt.destinationId),
    });
    const errors = problems.filter((p) => p.level === "error");
    if (errors.length > 0) {
      return {
        ok: false,
        error: `Fix ${errors.length} problem${errors.length === 1 ? "" : "s"} first: ${errors[0].message}`,
        code: "unhealthy",
      };
    }
  }

  await db
    .update(schema.hunts)
    .set({
      status: parsed.data.publish ? "published" : "draft",
      publishedAt: parsed.data.publish ? new Date() : null,
      updatedAt: new Date(),
    })
    .where(eq(schema.hunts.id, parsed.data.id));

  await revalidateHuntPaths(parsed.data.lang, found.hunt.destinationId, parsed.data.id);
  return { ok: true, data: { published: parsed.data.publish } };
}

export async function deleteHunt(formData: FormData): Promise<Result<{ id: string }>> {
  const id = String(formData.get("id") ?? "");
  const lang = String(formData.get("lang") ?? "en");
  if (!z.string().uuid().safeParse(id).success) {
    return { ok: false, error: "Invalid input", code: "invalid_input" };
  }
  const found = await requireEditableHunt(id, lang);
  if (!found.ok) return found;

  await db.delete(schema.hunts).where(eq(schema.hunts.id, id));
  await revalidateHuntPaths(lang, found.hunt.destinationId);
  return { ok: true, data: { id } };
}

// ── Stops ──────────────────────────────────────────────────────────────────────────────────────

const stopSchema = z.object({
  huntId: z.string().uuid(),
  stopId: z.string().uuid().optional(),
  sceneId: z.string().uuid(),
  title: z.string().trim().min(1).max(160),
  clue: z.string().trim().max(2000).optional(),
  reveal: z.string().trim().max(4000).optional(),
  unlockKind: z.enum(["open", "answer", "keys", "geo"]),
  // Comma-separated in the form; a list here because one accepted spelling fails honest visitors.
  answers: z.array(z.string().trim().min(1)).max(20).optional(),
  requiredKeys: z.array(z.string().trim().min(1)).max(20).optional(),
  grantsKey: z.string().trim().max(40).optional(),
  unlockRadiusM: z.number().int().min(5).max(2000),
  lang: langSchema,
});

function splitList(raw: FormDataEntryValue | null): string[] | undefined {
  const s = String(raw ?? "").trim();
  if (s === "") return undefined;
  const parts = s
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);
  return parts.length > 0 ? parts : undefined;
}

/** Create or update one stop. One action for both so the validation lives in exactly one place. */
export async function saveHuntStop(formData: FormData): Promise<Result<{ id: string }>> {
  const rawStopId = String(formData.get("stopId") ?? "").trim();
  const parsed = stopSchema.safeParse({
    huntId: String(formData.get("huntId") ?? ""),
    stopId: rawStopId === "" ? undefined : rawStopId,
    sceneId: String(formData.get("sceneId") ?? ""),
    title: String(formData.get("title") ?? ""),
    clue: String(formData.get("clue") ?? "") || undefined,
    reveal: String(formData.get("reveal") ?? "") || undefined,
    unlockKind: String(formData.get("unlockKind") ?? "open"),
    answers: splitList(formData.get("answers")),
    requiredKeys: splitList(formData.get("requiredKeys")),
    grantsKey: String(formData.get("grantsKey") ?? "") || undefined,
    unlockRadiusM: Number(formData.get("unlockRadiusM") ?? 40),
    lang: String(formData.get("lang") ?? "en"),
  });
  if (!parsed.success) return { ok: false, error: "Check the stop's values and try again.", code: "invalid_input" };
  const d = parsed.data;

  const found = await requireEditableHunt(d.huntId, d.lang);
  if (!found.ok) return found;

  // The scene must belong to this hunt's destination. Without this a creator could attach a scene
  // from someone else's tour by editing the form's hidden field.
  const [scene] = await db
    .select({ id: schema.scenes.id, destinationId: schema.scenes.destinationId })
    .from(schema.scenes)
    .where(eq(schema.scenes.id, d.sceneId))
    .limit(1);
  if (!scene || scene.destinationId !== found.hunt.destinationId) {
    return { ok: false, error: "Pick a scene from this destination.", code: "invalid_scene" };
  }

  // Reject the two unfinishable configurations at the door rather than only at publish time.
  if (d.unlockKind === "answer" && (d.answers ?? []).length === 0) {
    return { ok: false, error: "An answer stop needs at least one accepted answer.", code: "invalid_input" };
  }
  if (d.unlockKind === "keys" && (d.requiredKeys ?? []).length === 0) {
    return { ok: false, error: "A key stop needs at least one required key.", code: "invalid_input" };
  }

  const values = {
    sceneId: d.sceneId,
    title: d.title,
    clue: d.clue ?? null,
    reveal: d.reveal ?? null,
    unlockKind: d.unlockKind,
    // Clear the fields the chosen kind does not use, so a stop switched from `answer` to `geo` does
    // not keep a stale accepted-answer list that nothing reads and the next editor misreads.
    answers: d.unlockKind === "answer" ? (d.answers ?? null) : null,
    requiredKeys: d.unlockKind === "keys" ? (d.requiredKeys ?? null) : null,
    grantsKey: d.grantsKey ?? null,
    unlockRadiusM: d.unlockRadiusM,
    updatedAt: new Date(),
  };

  let id: string;
  if (d.stopId) {
    const [row] = await db
      .update(schema.huntStops)
      .set(values)
      .where(and(eq(schema.huntStops.id, d.stopId), eq(schema.huntStops.huntId, d.huntId)))
      .returning({ id: schema.huntStops.id });
    if (!row) return { ok: false, error: "Stop not found", code: "not_found" };
    id = row.id;
  } else {
    const [{ value: highest }] = await db
      .select({ value: max(schema.huntStops.sortOrder) })
      .from(schema.huntStops)
      .where(eq(schema.huntStops.huntId, d.huntId));
    const [row] = await db
      .insert(schema.huntStops)
      .values({ ...values, huntId: d.huntId, sortOrder: (highest ?? 0) + 1 })
      .returning({ id: schema.huntStops.id });
    id = row.id;
  }

  await refreshDerivedMode(d.huntId);
  await revalidateHuntPaths(d.lang, found.hunt.destinationId, d.huntId);
  return { ok: true, data: { id } };
}

export async function deleteHuntStop(formData: FormData): Promise<Result<{ id: string }>> {
  const stopId = String(formData.get("stopId") ?? "");
  const huntId = String(formData.get("huntId") ?? "");
  const lang = String(formData.get("lang") ?? "en");
  if (!z.string().uuid().safeParse(stopId).success || !z.string().uuid().safeParse(huntId).success) {
    return { ok: false, error: "Invalid input", code: "invalid_input" };
  }
  const found = await requireEditableHunt(huntId, lang);
  if (!found.ok) return found;

  await db
    .delete(schema.huntStops)
    .where(and(eq(schema.huntStops.id, stopId), eq(schema.huntStops.huntId, huntId)));

  await refreshDerivedMode(huntId);
  await revalidateHuntPaths(lang, found.hunt.destinationId, huntId);
  return { ok: true, data: { id: stopId } };
}

/**
 * Move a stop up or down.
 *
 * Order matters more here than in most lists: `analyzeHunt` decides whether a key is obtainable by
 * whether an EARLIER stop grants it, so reordering can make a healthy hunt unfinishable. The two
 * rows swap sort_order inside one transaction, via a temporary negative value, because
 * (hunt_id, sort_order) is unique and a direct swap would collide mid-update.
 */
export async function moveHuntStop(formData: FormData): Promise<Result<{ id: string }>> {
  const stopId = String(formData.get("stopId") ?? "");
  const huntId = String(formData.get("huntId") ?? "");
  const lang = String(formData.get("lang") ?? "en");
  const direction = String(formData.get("direction") ?? "");
  if (
    !z.string().uuid().safeParse(stopId).success ||
    !z.string().uuid().safeParse(huntId).success ||
    (direction !== "up" && direction !== "down")
  ) {
    return { ok: false, error: "Invalid input", code: "invalid_input" };
  }
  const found = await requireEditableHunt(huntId, lang);
  if (!found.ok) return found;

  const stops = await db
    .select({ id: schema.huntStops.id, sortOrder: schema.huntStops.sortOrder })
    .from(schema.huntStops)
    .where(eq(schema.huntStops.huntId, huntId))
    .orderBy(schema.huntStops.sortOrder);

  const i = stops.findIndex((s) => s.id === stopId);
  if (i === -1) return { ok: false, error: "Stop not found", code: "not_found" };
  const j = direction === "up" ? i - 1 : i + 1;
  if (j < 0 || j >= stops.length) return { ok: true, data: { id: stopId } }; // already at the end

  await db.transaction(async (tx) => {
    await tx
      .update(schema.huntStops)
      .set({ sortOrder: -1 })
      .where(eq(schema.huntStops.id, stops[i].id));
    await tx
      .update(schema.huntStops)
      .set({ sortOrder: stops[i].sortOrder })
      .where(eq(schema.huntStops.id, stops[j].id));
    await tx
      .update(schema.huntStops)
      .set({ sortOrder: stops[j].sortOrder })
      .where(eq(schema.huntStops.id, stops[i].id));
  });

  await revalidateHuntPaths(lang, found.hunt.destinationId, huntId);
  return { ok: true, data: { id: stopId } };
}

// ── Scene geo placement ────────────────────────────────────────────────────────────────────────

const placeSchema = z.object({
  sceneId: z.string().uuid(),
  lat: z.number().min(-90).max(90).nullable(),
  lng: z.number().min(-180).max(180).nullable(),
  lang: langSchema,
});

/** Set (or clear) a scene's real-world position. Clearing needs both fields empty. */
export async function setSceneGeo(formData: FormData): Promise<Result<{ id: string }>> {
  const rawLat = String(formData.get("lat") ?? "").trim();
  const rawLng = String(formData.get("lng") ?? "").trim();
  const parsed = placeSchema.safeParse({
    sceneId: String(formData.get("sceneId") ?? ""),
    lat: rawLat === "" ? null : Number(rawLat),
    lng: rawLng === "" ? null : Number(rawLng),
    lang: String(formData.get("lang") ?? "en"),
  });
  if (!parsed.success) {
    return { ok: false, error: "Latitude must be -90 to 90 and longitude -180 to 180.", code: "invalid_input" };
  }
  const { sceneId, lat, lng, lang } = parsed.data;
  if ((lat == null) !== (lng == null)) {
    return { ok: false, error: "Set both latitude and longitude, or clear both.", code: "invalid_input" };
  }

  const user = await requireCreatorWithAuthz(lang);
  const [scene] = await db
    .select({ id: schema.scenes.id, ownerId: schema.scenes.ownerId, destinationId: schema.scenes.destinationId })
    .from(schema.scenes)
    .where(eq(schema.scenes.id, sceneId))
    .limit(1);
  if (!scene) return { ok: false, error: "Scene not found", code: "not_found" };
  if (!canManageOrOwn(user, scene.ownerId, "scenes", "update")) {
    return { ok: false, error: "Not allowed", code: "forbidden" };
  }

  await db
    .update(schema.scenes)
    .set({
      geoLat: lat == null ? null : String(lat),
      geoLng: lng == null ? null : String(lng),
      updatedAt: new Date(),
    })
    .where(eq(schema.scenes.id, sceneId));

  if (scene.destinationId) await revalidateHuntPaths(lang, scene.destinationId);
  return { ok: true, data: { id: sceneId } };
}

// ── Visitor runtime ────────────────────────────────────────────────────────────────────────────

const unlockSchema = z.object({
  huntId: z.string().uuid(),
  stopId: z.string().uuid(),
  // Opaque browser token. Length-bounded so it cannot be used as free storage.
  visitorKey: z.string().trim().min(8).max(64),
  answer: z.string().trim().max(200).optional(),
  viaFallback: z.boolean().optional(),
});

/**
 * Record that a visitor unlocked a stop.
 *
 * ── WHAT THIS DELIBERATELY DOES NOT ACCEPT ─────────────────────────────────────────────────────
 * There is no latitude or longitude parameter, and there must never be one. Proximity is judged in
 * the browser; the server is told only "this stop opened". That is the whole privacy design, and it
 * has a cost worth stating plainly: a determined visitor can POST an unlock without going anywhere.
 * That is the correct trade for a teaching game. If a hunt ever carries a prize, it needs a
 * different design, not a lat/lng field bolted onto this one.
 *
 * Answers ARE checked server-side, because unlike position they can be checked without learning
 * anything about the visitor, and because a client-only answer check would put the answer key in
 * the page source.
 */
export async function unlockHuntStop(formData: FormData): Promise<Result<{ unlocked: string[]; keys: string[] }>> {
  const parsed = unlockSchema.safeParse({
    huntId: String(formData.get("huntId") ?? ""),
    stopId: String(formData.get("stopId") ?? ""),
    visitorKey: String(formData.get("visitorKey") ?? ""),
    answer: String(formData.get("answer") ?? "") || undefined,
    viaFallback: String(formData.get("viaFallback") ?? "") === "true",
  });
  if (!parsed.success) return { ok: false, error: "Invalid input", code: "invalid_input" };
  const { huntId, stopId, visitorKey, answer, viaFallback } = parsed.data;

  const [hunt] = await db.select().from(schema.hunts).where(eq(schema.hunts.id, huntId)).limit(1);
  if (!hunt || hunt.status !== "published") {
    return { ok: false, error: "Hunt not found", code: "not_found" };
  }

  const stops = await listStopsForHunt(huntId);
  const inputs = toStopInputs(stops);
  const stop = inputs.find((s) => s.id === stopId);
  if (!stop) return { ok: false, error: "Stop not found", code: "not_found" };

  const already = await listProgress(huntId, visitorKey);
  const availability = evaluateStops(inputs, {
    unlocked: already,
    keys: keysAfter(inputs, already),
  });
  const state = availability.get(stopId)?.state;

  if (state === "done") {
    return { ok: true, data: { unlocked: already, keys: keysAfter(inputs, already) } };
  }
  // Sequence is enforced server-side: it costs nothing and stops a mis-wired client from skipping.
  if (state === "locked") {
    return { ok: false, error: "Finish the previous stop first.", code: "out_of_sequence" };
  }
  if (stop.unlockKind === "answer" && !answerMatches(answer ?? "", stop.answers)) {
    return { ok: false, error: "That is not the answer. Try again.", code: "wrong_answer" };
  }
  if (stop.unlockKind === "keys" && state === "needs-keys") {
    return { ok: false, error: "You do not have what this stop needs yet.", code: "missing_keys" };
  }
  if (stop.unlockKind === "geo" && viaFallback && !hunt.allowRemoteFallback) {
    return { ok: false, error: "This hunt has to be done on site.", code: "fallback_disabled" };
  }

  await db
    .insert(schema.huntProgress)
    .values({ huntId, stopId, visitorKey, viaFallback: viaFallback ?? false })
    .onConflictDoNothing();

  const unlocked = [...already, stopId];
  return { ok: true, data: { unlocked, keys: keysAfter(inputs, unlocked) } };
}

/** Clear this visitor's progress so they can play again. */
export async function resetHuntProgress(formData: FormData): Promise<Result<{ ok: true }>> {
  const huntId = String(formData.get("huntId") ?? "");
  const visitorKey = String(formData.get("visitorKey") ?? "");
  if (!z.string().uuid().safeParse(huntId).success || visitorKey.length < 8) {
    return { ok: false, error: "Invalid input", code: "invalid_input" };
  }
  await db
    .delete(schema.huntProgress)
    .where(
      and(eq(schema.huntProgress.huntId, huntId), eq(schema.huntProgress.visitorKey, visitorKey)),
    );
  return { ok: true, data: { ok: true } };
}
