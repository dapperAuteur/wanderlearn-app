"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db, schema } from "@/db/client";
import { requireCreator } from "@/lib/rbac";
import { slugify } from "@/lib/slug";
import type { Locale } from "@/lib/locales";

type Result<T> = { ok: true; data: T } | { ok: false; error: string; code: string };

const langSchema = z.enum(["en", "es"]);

const createSchema = z.object({
  title: z.string().min(2).max(200),
  slug: z
    .string()
    .min(2)
    .max(120)
    .regex(/^[a-z0-9-]+$/)
    .optional(),
  subtitle: z.string().max(300).optional(),
  description: z.string().max(4000).optional(),
  destinationId: z
    .union([z.string().uuid(), z.string().length(0)])
    .optional()
    .transform((v) => (v && v.length > 0 ? v : undefined)),
  priceCents: z.coerce.number().int().nonnegative().max(999_999).default(0),
  defaultLocale: langSchema,
  lang: langSchema,
});

const updateSchema = createSchema.extend({
  id: z.string().uuid(),
});

const deleteSchema = z.object({
  id: z.string().uuid(),
  lang: langSchema,
});

function parseFormData(formData: FormData) {
  const priceRaw = Number(formData.get("priceCents") ?? "0");
  const priceCents = Number.isFinite(priceRaw) ? Math.round(priceRaw * 100) : 0;
  return {
    title: String(formData.get("title") ?? "").trim(),
    slug: String(formData.get("slug") ?? "").trim() || undefined,
    subtitle: String(formData.get("subtitle") ?? "").trim() || undefined,
    description: String(formData.get("description") ?? "").trim() || undefined,
    destinationId: String(formData.get("destinationId") ?? ""),
    priceCents,
    defaultLocale: String(formData.get("defaultLocale") ?? "en") as Locale,
    lang: String(formData.get("lang") ?? "en") as Locale,
  };
}

export async function createCourse(formData: FormData): Promise<Result<{ id: string }>> {
  const parsed = createSchema.safeParse(parseFormData(formData));
  if (!parsed.success) {
    return { ok: false, error: "Invalid input", code: "invalid_input" };
  }
  const user = await requireCreator(parsed.data.lang);

  const slug = parsed.data.slug ?? slugify(parsed.data.title);
  if (!slug) {
    return { ok: false, error: "Title is too short for a slug", code: "invalid_slug" };
  }

  const existing = await db
    .select({ id: schema.courses.id })
    .from(schema.courses)
    .where(eq(schema.courses.slug, slug))
    .limit(1);
  if (existing.length > 0) {
    return { ok: false, error: "A course with that slug already exists", code: "slug_taken" };
  }

  const [row] = await db
    .insert(schema.courses)
    .values({
      creatorId: user.id,
      slug,
      title: parsed.data.title,
      subtitle: parsed.data.subtitle,
      description: parsed.data.description,
      destinationId: parsed.data.destinationId,
      priceCents: parsed.data.priceCents,
      defaultLocale: parsed.data.defaultLocale,
      status: "draft",
    })
    .returning({ id: schema.courses.id });

  if (!row) {
    return { ok: false, error: "Failed to create course", code: "db_insert_failed" };
  }

  revalidatePath(`/${parsed.data.lang}/creator/courses`);
  return { ok: true, data: { id: row.id } };
}

export async function updateCourse(formData: FormData): Promise<Result<{ id: string }>> {
  const body = { ...parseFormData(formData), id: String(formData.get("id") ?? "") };
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return { ok: false, error: "Invalid input", code: "invalid_input" };
  }
  const user = await requireCreator(parsed.data.lang);

  const [existing] = await db
    .select({ id: schema.courses.id, creatorId: schema.courses.creatorId })
    .from(schema.courses)
    .where(
      and(eq(schema.courses.id, parsed.data.id), eq(schema.courses.creatorId, user.id)),
    )
    .limit(1);
  if (!existing) {
    return { ok: false, error: "Course not found", code: "not_found" };
  }

  const slug = parsed.data.slug ?? slugify(parsed.data.title);

  await db
    .update(schema.courses)
    .set({
      slug,
      title: parsed.data.title,
      subtitle: parsed.data.subtitle,
      description: parsed.data.description,
      destinationId: parsed.data.destinationId,
      priceCents: parsed.data.priceCents,
      defaultLocale: parsed.data.defaultLocale,
      updatedAt: new Date(),
    })
    .where(eq(schema.courses.id, parsed.data.id));

  revalidatePath(`/${parsed.data.lang}/creator/courses`);
  revalidatePath(`/${parsed.data.lang}/creator/courses/${parsed.data.id}`);
  return { ok: true, data: { id: parsed.data.id } };
}

export async function deleteCourse(formData: FormData): Promise<Result<null>> {
  const parsed = deleteSchema.safeParse({
    id: String(formData.get("id") ?? ""),
    lang: String(formData.get("lang") ?? "en") as Locale,
  });
  if (!parsed.success) {
    return { ok: false, error: "Invalid input", code: "invalid_input" };
  }
  const user = await requireCreator(parsed.data.lang);

  await db
    .delete(schema.courses)
    .where(
      and(eq(schema.courses.id, parsed.data.id), eq(schema.courses.creatorId, user.id)),
    );

  revalidatePath(`/${parsed.data.lang}/creator/courses`);
  return { ok: true, data: null };
}
