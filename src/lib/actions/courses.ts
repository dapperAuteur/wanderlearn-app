"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db, schema } from "@/db/client";
import { canManageOrOwn, requireAdmin, requireCreator, requireCreatorWithAuthz } from "@/lib/rbac";
import { slugify } from "@/lib/slug";
import { checkCoursePublishReadiness, type PublishViolation } from "@/lib/publish-gates";
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

  const created = await db.transaction(async (tx) => {
    const [row] = await tx
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
    if (!row) return null;

    // Mirror the destinationId into the join table as the primary row.
    // courses.destinationId stays as a denormalized fast-path pointer;
    // course_destinations is the canonical many-to-many list.
    if (parsed.data.destinationId) {
      await tx.insert(schema.courseDestinations).values({
        courseId: row.id,
        destinationId: parsed.data.destinationId,
        isPrimary: true,
      });
    }
    return row;
  });

  if (!created) {
    return { ok: false, error: "Failed to create course", code: "db_insert_failed" };
  }

  revalidatePath(`/${parsed.data.lang}/creator/courses`);
  return { ok: true, data: { id: created.id } };
}

export async function updateCourse(formData: FormData): Promise<Result<{ id: string }>> {
  const body = { ...parseFormData(formData), id: String(formData.get("id") ?? "") };
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return { ok: false, error: "Invalid input", code: "invalid_input" };
  }
  const user = await requireCreatorWithAuthz(parsed.data.lang);

  const [existing] = await db
    .select({
      id: schema.courses.id,
      creatorId: schema.courses.creatorId,
      priceCents: schema.courses.priceCents,
      destinationId: schema.courses.destinationId,
    })
    .from(schema.courses)
    .where(eq(schema.courses.id, parsed.data.id))
    .limit(1);
  if (!existing) {
    return { ok: false, error: "Course not found", code: "not_found" };
  }
  if (!canManageOrOwn(user, existing.creatorId, "courses", "update")) {
    return { ok: false, error: "Forbidden", code: "forbidden" };
  }

  const slug = parsed.data.slug ?? slugify(parsed.data.title);

  // Stripe Prices are immutable. If the course price changed, null out the
  // stored stripe_price_id so the next purchase lazily creates a new Price.
  const priceChanged = existing.priceCents !== parsed.data.priceCents;
  const newDestinationId = parsed.data.destinationId ?? null;
  const destinationChanged = existing.destinationId !== newDestinationId;

  await db.transaction(async (tx) => {
    await tx
      .update(schema.courses)
      .set({
        slug,
        title: parsed.data.title,
        subtitle: parsed.data.subtitle,
        description: parsed.data.description,
        destinationId: parsed.data.destinationId,
        priceCents: parsed.data.priceCents,
        defaultLocale: parsed.data.defaultLocale,
        ...(priceChanged ? { stripePriceId: null } : {}),
        updatedAt: new Date(),
      })
      .where(eq(schema.courses.id, parsed.data.id));

    if (destinationChanged) {
      // Demote whatever was primary so the partial unique index doesn't
      // collide when we promote the new one.
      await tx
        .update(schema.courseDestinations)
        .set({ isPrimary: false })
        .where(
          and(
            eq(schema.courseDestinations.courseId, parsed.data.id),
            eq(schema.courseDestinations.isPrimary, true),
          ),
        );

      if (newDestinationId) {
        // Upsert the new primary. Existing non-primary row at this
        // destination flips to primary; absent row is inserted.
        await tx
          .insert(schema.courseDestinations)
          .values({
            courseId: parsed.data.id,
            destinationId: newDestinationId,
            isPrimary: true,
          })
          .onConflictDoUpdate({
            target: [
              schema.courseDestinations.courseId,
              schema.courseDestinations.destinationId,
            ],
            set: { isPrimary: true },
          });
      }
    }
  });

  revalidatePath(`/${parsed.data.lang}/creator/courses`);
  revalidatePath(`/${parsed.data.lang}/creator/courses/${parsed.data.id}`);
  return { ok: true, data: { id: parsed.data.id } };
}

const courseDestinationSchema = z.object({
  courseId: z.string().uuid(),
  destinationId: z.string().uuid(),
  lang: langSchema,
});

/**
 * Loads a course with its creator id so the caller can decide whether
 * to allow the action via canManageOrOwn(). Authorization is NOT done
 * here; callers run canManageOrOwn(user, course.creatorId, "courses",
 * action) themselves.
 */
async function getCourseWithCreator(
  tx: typeof db,
  courseId: string,
): Promise<{ id: string; creatorId: string; destinationId: string | null } | null> {
  const [row] = await tx
    .select({
      id: schema.courses.id,
      creatorId: schema.courses.creatorId,
      destinationId: schema.courses.destinationId,
    })
    .from(schema.courses)
    .where(eq(schema.courses.id, courseId))
    .limit(1);
  return row ?? null;
}

/**
 * Attach a destination to a course as an additional (non-primary)
 * destination. The course's existing `destinationId` (if any) keeps its
 * primary status. Idempotent — re-attaching is a no-op via ON CONFLICT.
 */
export async function addCourseDestination(
  formData: FormData,
): Promise<Result<{ courseId: string; destinationId: string }>> {
  const parsed = courseDestinationSchema.safeParse({
    courseId: String(formData.get("courseId") ?? ""),
    destinationId: String(formData.get("destinationId") ?? ""),
    lang: String(formData.get("lang") ?? "en") as Locale,
  });
  if (!parsed.success) {
    return { ok: false, error: "Invalid input", code: "invalid_input" };
  }
  const user = await requireCreatorWithAuthz(parsed.data.lang);
  const course = await getCourseWithCreator(db, parsed.data.courseId);
  if (!course) {
    return { ok: false, error: "Course not found", code: "not_found" };
  }
  if (!canManageOrOwn(user, course.creatorId, "courses", "update")) {
    return { ok: false, error: "Forbidden", code: "forbidden" };
  }

  await db
    .insert(schema.courseDestinations)
    .values({
      courseId: parsed.data.courseId,
      destinationId: parsed.data.destinationId,
      isPrimary: false,
    })
    .onConflictDoNothing();

  revalidatePath(`/${parsed.data.lang}/creator/courses/${parsed.data.courseId}`);
  return { ok: true, data: { courseId: parsed.data.courseId, destinationId: parsed.data.destinationId } };
}

/**
 * Detach a destination from a course. If the destination was the course's
 * primary, also clear `courses.destination_id` so the legacy denormalized
 * pointer stays consistent.
 */
export async function removeCourseDestination(
  formData: FormData,
): Promise<Result<{ courseId: string }>> {
  const parsed = courseDestinationSchema.safeParse({
    courseId: String(formData.get("courseId") ?? ""),
    destinationId: String(formData.get("destinationId") ?? ""),
    lang: String(formData.get("lang") ?? "en") as Locale,
  });
  if (!parsed.success) {
    return { ok: false, error: "Invalid input", code: "invalid_input" };
  }
  const user = await requireCreatorWithAuthz(parsed.data.lang);

  await db.transaction(async (tx) => {
    const course = await getCourseWithCreator(tx as typeof db, parsed.data.courseId);
    if (!course) return;
    if (!canManageOrOwn(user, course.creatorId, "courses", "update")) return;

    await tx
      .delete(schema.courseDestinations)
      .where(
        and(
          eq(schema.courseDestinations.courseId, parsed.data.courseId),
          eq(schema.courseDestinations.destinationId, parsed.data.destinationId),
        ),
      );

    if (course.destinationId === parsed.data.destinationId) {
      await tx
        .update(schema.courses)
        .set({ destinationId: null, updatedAt: new Date() })
        .where(eq(schema.courses.id, parsed.data.courseId));
    }
  });

  revalidatePath(`/${parsed.data.lang}/creator/courses/${parsed.data.courseId}`);
  return { ok: true, data: { courseId: parsed.data.courseId } };
}

/**
 * Promote a destination to primary on a course. Demotes any existing
 * primary first. Also mirrors into `courses.destination_id`. The
 * destination must already be attached to the course.
 */
export async function setPrimaryCourseDestination(
  formData: FormData,
): Promise<Result<{ courseId: string; destinationId: string }>> {
  const parsed = courseDestinationSchema.safeParse({
    courseId: String(formData.get("courseId") ?? ""),
    destinationId: String(formData.get("destinationId") ?? ""),
    lang: String(formData.get("lang") ?? "en") as Locale,
  });
  if (!parsed.success) {
    return { ok: false, error: "Invalid input", code: "invalid_input" };
  }
  const user = await requireCreatorWithAuthz(parsed.data.lang);

  const ok = await db.transaction(async (tx) => {
    const course = await getCourseWithCreator(tx as typeof db, parsed.data.courseId);
    if (!course) return false;
    if (!canManageOrOwn(user, course.creatorId, "courses", "update")) return false;

    // The destination must already be attached.
    const [existing] = await tx
      .select({ courseId: schema.courseDestinations.courseId })
      .from(schema.courseDestinations)
      .where(
        and(
          eq(schema.courseDestinations.courseId, parsed.data.courseId),
          eq(schema.courseDestinations.destinationId, parsed.data.destinationId),
        ),
      )
      .limit(1);
    if (!existing) return false;

    // Demote whatever was primary so the partial unique index doesn't
    // block the promotion.
    await tx
      .update(schema.courseDestinations)
      .set({ isPrimary: false })
      .where(
        and(
          eq(schema.courseDestinations.courseId, parsed.data.courseId),
          eq(schema.courseDestinations.isPrimary, true),
        ),
      );
    await tx
      .update(schema.courseDestinations)
      .set({ isPrimary: true })
      .where(
        and(
          eq(schema.courseDestinations.courseId, parsed.data.courseId),
          eq(schema.courseDestinations.destinationId, parsed.data.destinationId),
        ),
      );
    await tx
      .update(schema.courses)
      .set({ destinationId: parsed.data.destinationId, updatedAt: new Date() })
      .where(eq(schema.courses.id, parsed.data.courseId));
    return true;
  });

  if (!ok) {
    return { ok: false, error: "Destination is not attached to this course", code: "not_attached" };
  }

  revalidatePath(`/${parsed.data.lang}/creator/courses/${parsed.data.courseId}`);
  return { ok: true, data: { courseId: parsed.data.courseId, destinationId: parsed.data.destinationId } };
}

const submitForReviewSchema = z.object({
  id: z.string().uuid(),
  lang: langSchema,
});

const approveCourseSchema = z.object({
  id: z.string().uuid(),
  lang: langSchema,
});

const unpublishCourseSchema = z.object({
  id: z.string().uuid(),
  lang: langSchema,
});

function revalidateCourse(lang: string, courseId: string) {
  revalidatePath(`/${lang}/creator/courses`);
  revalidatePath(`/${lang}/creator/courses/${courseId}`);
  revalidatePath(`/${lang}/admin/courses`);
  revalidatePath(`/${lang}/admin/courses/${courseId}`);
  revalidatePath(`/${lang}/courses`);
}

export async function submitCourseForReview(
  formData: FormData,
): Promise<
  Result<{ id: string; status: string; violations?: PublishViolation[] }>
> {
  const parsed = submitForReviewSchema.safeParse({
    id: String(formData.get("id") ?? ""),
    lang: String(formData.get("lang") ?? "en"),
  });
  if (!parsed.success) {
    return { ok: false, error: "Invalid input", code: "invalid_input" };
  }
  const user = await requireCreatorWithAuthz(parsed.data.lang);

  const [course] = await db
    .select({
      id: schema.courses.id,
      creatorId: schema.courses.creatorId,
      status: schema.courses.status,
      reviewRequired: schema.courses.reviewRequired,
    })
    .from(schema.courses)
    .where(eq(schema.courses.id, parsed.data.id))
    .limit(1);
  if (!course) {
    return { ok: false, error: "Course not found", code: "not_found" };
  }
  if (!canManageOrOwn(user, course.creatorId, "courses", "update")) {
    return { ok: false, error: "Forbidden", code: "forbidden" };
  }
  if (course.status !== "draft" && course.status !== "unpublished") {
    return {
      ok: false,
      error: "Only draft or unpublished courses can be submitted for review",
      code: "invalid_status_transition",
    };
  }

  const violations = await checkCoursePublishReadiness(course.id);
  if (violations.length > 0) {
    return { ok: false, error: "Course fails the publish gate", code: "a11y_gate_failed" };
  }

  const nextStatus = course.reviewRequired ? "in_review" : "published";
  const now = new Date();
  await db
    .update(schema.courses)
    .set({
      status: nextStatus,
      publishedAt: nextStatus === "published" ? now : null,
      updatedAt: now,
    })
    .where(eq(schema.courses.id, course.id));

  revalidateCourse(parsed.data.lang, course.id);
  return { ok: true, data: { id: course.id, status: nextStatus } };
}

export async function approveCourse(
  formData: FormData,
): Promise<Result<{ id: string; status: string }>> {
  const parsed = approveCourseSchema.safeParse({
    id: String(formData.get("id") ?? ""),
    lang: String(formData.get("lang") ?? "en"),
  });
  if (!parsed.success) {
    return { ok: false, error: "Invalid input", code: "invalid_input" };
  }
  await requireAdmin(parsed.data.lang);

  const [course] = await db
    .select({ id: schema.courses.id, status: schema.courses.status })
    .from(schema.courses)
    .where(eq(schema.courses.id, parsed.data.id))
    .limit(1);
  if (!course) {
    return { ok: false, error: "Course not found", code: "not_found" };
  }
  if (course.status !== "in_review") {
    return {
      ok: false,
      error: "Only courses in review can be approved",
      code: "invalid_status_transition",
    };
  }

  const violations = await checkCoursePublishReadiness(course.id);
  if (violations.length > 0) {
    return { ok: false, error: "Course fails the publish gate", code: "a11y_gate_failed" };
  }

  const now = new Date();
  await db
    .update(schema.courses)
    .set({ status: "published", publishedAt: now, updatedAt: now })
    .where(eq(schema.courses.id, course.id));

  revalidateCourse(parsed.data.lang, course.id);
  return { ok: true, data: { id: course.id, status: "published" } };
}

export async function unpublishCourse(
  formData: FormData,
): Promise<Result<{ id: string; status: string }>> {
  const parsed = unpublishCourseSchema.safeParse({
    id: String(formData.get("id") ?? ""),
    lang: String(formData.get("lang") ?? "en"),
  });
  if (!parsed.success) {
    return { ok: false, error: "Invalid input", code: "invalid_input" };
  }
  await requireAdmin(parsed.data.lang);

  const [course] = await db
    .select({ id: schema.courses.id, status: schema.courses.status })
    .from(schema.courses)
    .where(eq(schema.courses.id, parsed.data.id))
    .limit(1);
  if (!course) {
    return { ok: false, error: "Course not found", code: "not_found" };
  }
  if (course.status !== "published" && course.status !== "in_review") {
    return {
      ok: false,
      error: "Only published or in-review courses can be unpublished",
      code: "invalid_status_transition",
    };
  }

  const now = new Date();
  await db
    .update(schema.courses)
    .set({ status: "unpublished", publishedAt: null, updatedAt: now })
    .where(eq(schema.courses.id, course.id));

  revalidateCourse(parsed.data.lang, course.id);
  return { ok: true, data: { id: course.id, status: "unpublished" } };
}

export async function deleteCourse(formData: FormData): Promise<Result<null>> {
  const parsed = deleteSchema.safeParse({
    id: String(formData.get("id") ?? ""),
    lang: String(formData.get("lang") ?? "en") as Locale,
  });
  if (!parsed.success) {
    return { ok: false, error: "Invalid input", code: "invalid_input" };
  }
  const user = await requireCreatorWithAuthz(parsed.data.lang);

  const [course] = await db
    .select({ creatorId: schema.courses.creatorId })
    .from(schema.courses)
    .where(eq(schema.courses.id, parsed.data.id))
    .limit(1);
  if (!course) {
    return { ok: false, error: "Course not found", code: "not_found" };
  }
  if (!canManageOrOwn(user, course.creatorId, "courses", "delete")) {
    return { ok: false, error: "Forbidden", code: "forbidden" };
  }

  await db.delete(schema.courses).where(eq(schema.courses.id, parsed.data.id));

  revalidatePath(`/${parsed.data.lang}/creator/courses`);
  return { ok: true, data: null };
}
