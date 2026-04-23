"use server";

import { and, eq, isNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db, schema } from "@/db/client";
import { requireCreator } from "@/lib/rbac";
import { slugify } from "@/lib/slug";
import type { Locale } from "@/lib/locales";

type Result<T> = { ok: true; data: T } | { ok: false; error: string; code: string };

const coordinateSchema = z
  .union([z.string().length(0), z.coerce.number()])
  .optional()
  .transform((v) => (typeof v === "number" ? v.toString() : undefined));

const createSchema = z.object({
  name: z.string().min(2).max(200),
  slug: z
    .string()
    .min(2)
    .max(120)
    .regex(/^[a-z0-9-]+$/)
    .optional(),
  country: z.string().max(100).optional(),
  city: z.string().max(100).optional(),
  lat: coordinateSchema,
  lng: coordinateSchema,
  description: z.string().max(2000).optional(),
  website: z
    .union([z.string().url().max(500), z.string().length(0)])
    .optional()
    .transform((v) => (v && v.length > 0 ? v : undefined)),
  lang: z.enum(["en", "es"]),
});

const updateSchema = createSchema.extend({
  id: z.string().uuid(),
});

const deleteSchema = z.object({
  id: z.string().uuid(),
  lang: z.enum(["en", "es"]),
});

const replaceHeroSchema = z.object({
  id: z.string().uuid(),
  heroMediaId: z.string().uuid().nullable(),
  lang: z.enum(["en", "es"]),
});

const setPublicSchema = z.object({
  id: z.string().uuid(),
  isPublic: z.boolean(),
  lang: z.enum(["en", "es"]),
});

function parseFormData(formData: FormData) {
  return {
    name: String(formData.get("name") ?? "").trim(),
    slug: String(formData.get("slug") ?? "").trim() || undefined,
    country: String(formData.get("country") ?? "").trim() || undefined,
    city: String(formData.get("city") ?? "").trim() || undefined,
    lat: String(formData.get("lat") ?? "").trim(),
    lng: String(formData.get("lng") ?? "").trim(),
    description: String(formData.get("description") ?? "").trim() || undefined,
    website: String(formData.get("website") ?? "").trim(),
    lang: String(formData.get("lang") ?? "en") as Locale,
  };
}

export async function createDestination(formData: FormData): Promise<Result<{ id: string }>> {
  const parsed = createSchema.safeParse(parseFormData(formData));
  if (!parsed.success) {
    return { ok: false, error: "Invalid input", code: "invalid_input" };
  }
  await requireCreator(parsed.data.lang);

  const slug = parsed.data.slug ?? slugify(parsed.data.name);
  if (!slug) {
    return { ok: false, error: "Name is too short for a slug", code: "invalid_slug" };
  }

  const [row] = await db
    .insert(schema.destinations)
    .values({
      slug,
      name: parsed.data.name,
      country: parsed.data.country,
      city: parsed.data.city,
      lat: parsed.data.lat,
      lng: parsed.data.lng,
      description: parsed.data.description,
      website: parsed.data.website,
    })
    .returning({ id: schema.destinations.id });

  if (!row) {
    return { ok: false, error: "Failed to create destination", code: "db_insert_failed" };
  }

  revalidatePath(`/${parsed.data.lang}/creator/destinations`);
  return { ok: true, data: { id: row.id } };
}

export async function updateDestination(formData: FormData): Promise<Result<{ id: string }>> {
  const body = { ...parseFormData(formData), id: String(formData.get("id") ?? "") };
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return { ok: false, error: "Invalid input", code: "invalid_input" };
  }
  await requireCreator(parsed.data.lang);

  const slug = parsed.data.slug ?? slugify(parsed.data.name);

  await db
    .update(schema.destinations)
    .set({
      slug,
      name: parsed.data.name,
      country: parsed.data.country,
      city: parsed.data.city,
      lat: parsed.data.lat,
      lng: parsed.data.lng,
      description: parsed.data.description,
      website: parsed.data.website ?? null,
      updatedAt: new Date(),
    })
    .where(eq(schema.destinations.id, parsed.data.id));

  revalidatePath(`/${parsed.data.lang}/creator/destinations`);
  revalidatePath(`/${parsed.data.lang}/creator/destinations/${parsed.data.id}`);
  return { ok: true, data: { id: parsed.data.id } };
}

export async function replaceDestinationHeroMedia(
  formData: FormData,
): Promise<Result<{ id: string }>> {
  const rawHero = String(formData.get("heroMediaId") ?? "");
  const parsed = replaceHeroSchema.safeParse({
    id: String(formData.get("id") ?? ""),
    heroMediaId: rawHero.length > 0 ? rawHero : null,
    lang: String(formData.get("lang") ?? "en") as Locale,
  });
  if (!parsed.success) {
    return { ok: false, error: "Invalid input", code: "invalid_input" };
  }
  const user = await requireCreator(parsed.data.lang);

  if (parsed.data.heroMediaId) {
    const [mediaRow] = await db
      .select({
        id: schema.mediaAssets.id,
        kind: schema.mediaAssets.kind,
        status: schema.mediaAssets.status,
      })
      .from(schema.mediaAssets)
      .where(
        and(
          eq(schema.mediaAssets.id, parsed.data.heroMediaId),
          eq(schema.mediaAssets.ownerId, user.id),
          isNull(schema.mediaAssets.deletedAt),
        ),
      )
      .limit(1);

    if (!mediaRow) {
      return {
        ok: false,
        error: "Hero media not found or not owned by you",
        code: "media_not_found",
      };
    }
    if (mediaRow.status !== "ready") {
      return { ok: false, error: "Hero media is still processing", code: "media_not_ready" };
    }
    if (mediaRow.kind !== "image" && mediaRow.kind !== "photo_360") {
      return {
        ok: false,
        error: "Hero media must be an image or 360° photo",
        code: "invalid_media_kind",
      };
    }
  }

  await db
    .update(schema.destinations)
    .set({
      heroMediaId: parsed.data.heroMediaId,
      updatedAt: new Date(),
    })
    .where(eq(schema.destinations.id, parsed.data.id));

  revalidatePath(`/${parsed.data.lang}/creator/destinations/${parsed.data.id}`);
  revalidatePath(`/${parsed.data.lang}/creator/destinations/${parsed.data.id}/edit`);
  return { ok: true, data: { id: parsed.data.id } };
}

export async function setDestinationPublic(
  formData: FormData,
): Promise<Result<{ id: string; isPublic: boolean }>> {
  const parsed = setPublicSchema.safeParse({
    id: String(formData.get("id") ?? ""),
    isPublic: String(formData.get("isPublic") ?? "") === "true",
    lang: String(formData.get("lang") ?? "en") as Locale,
  });
  if (!parsed.success) {
    return { ok: false, error: "Invalid input", code: "invalid_input" };
  }
  await requireCreator(parsed.data.lang);

  await db
    .update(schema.destinations)
    .set({ isPublic: parsed.data.isPublic, updatedAt: new Date() })
    .where(eq(schema.destinations.id, parsed.data.id));

  revalidatePath(`/${parsed.data.lang}/creator/destinations/${parsed.data.id}`);
  return { ok: true, data: { id: parsed.data.id, isPublic: parsed.data.isPublic } };
}

export async function deleteDestination(formData: FormData): Promise<Result<null>> {
  const parsed = deleteSchema.safeParse({
    id: String(formData.get("id") ?? ""),
    lang: String(formData.get("lang") ?? "en") as Locale,
  });
  if (!parsed.success) {
    return { ok: false, error: "Invalid input", code: "invalid_input" };
  }
  await requireCreator(parsed.data.lang);

  await db.delete(schema.destinations).where(eq(schema.destinations.id, parsed.data.id));

  revalidatePath(`/${parsed.data.lang}/creator/destinations`);
  return { ok: true, data: null };
}
