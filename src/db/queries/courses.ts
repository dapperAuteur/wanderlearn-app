import { and, desc, eq, inArray } from "drizzle-orm";
import { db, schema } from "@/db/client";

export type CourseRow = typeof schema.courses.$inferSelect;

export type CourseDestinationRow = {
  destinationId: string;
  destinationSlug: string;
  destinationName: string;
  destinationCity: string | null;
  destinationCountry: string | null;
  isPrimary: boolean;
  isPublic: boolean;
};

/**
 * Every destination attached to a course via the join table, with the
 * fields needed to render a "Destinations covered" link list. Ordered
 * with the primary destination first (if any), then by attach order.
 */
export async function listCourseDestinations(
  courseId: string,
): Promise<CourseDestinationRow[]> {
  return db
    .select({
      destinationId: schema.destinations.id,
      destinationSlug: schema.destinations.slug,
      destinationName: schema.destinations.name,
      destinationCity: schema.destinations.city,
      destinationCountry: schema.destinations.country,
      isPrimary: schema.courseDestinations.isPrimary,
      isPublic: schema.destinations.isPublic,
    })
    .from(schema.courseDestinations)
    .innerJoin(
      schema.destinations,
      eq(schema.destinations.id, schema.courseDestinations.destinationId),
    )
    .where(eq(schema.courseDestinations.courseId, courseId))
    .orderBy(desc(schema.courseDestinations.isPrimary), schema.courseDestinations.createdAt);
}

export type CourseForDestinationRow = {
  courseId: string;
  courseSlug: string;
  courseTitle: string;
  courseSubtitle: string | null;
  priceCents: number;
  currency: string;
  isPrimary: boolean;
};

/**
 * Published courses that include a given destination via the join table.
 * Used to render the "Courses that visit this place" section on the
 * public tour page.
 */
export async function listPublishedCoursesForDestination(
  destinationId: string,
): Promise<CourseForDestinationRow[]> {
  return db
    .select({
      courseId: schema.courses.id,
      courseSlug: schema.courses.slug,
      courseTitle: schema.courses.title,
      courseSubtitle: schema.courses.subtitle,
      priceCents: schema.courses.priceCents,
      currency: schema.courses.currency,
      isPrimary: schema.courseDestinations.isPrimary,
    })
    .from(schema.courseDestinations)
    .innerJoin(
      schema.courses,
      eq(schema.courses.id, schema.courseDestinations.courseId),
    )
    .where(
      and(
        eq(schema.courseDestinations.destinationId, destinationId),
        eq(schema.courses.status, "published"),
      ),
    )
    .orderBy(desc(schema.courses.publishedAt));
}

export type DestinationOption = {
  id: string;
  slug: string;
  name: string;
  city: string | null;
  country: string | null;
};

/** Destinations the creator owns — for the multi-select picker. */
export async function listDestinationsForCreator(
  creatorId: string,
): Promise<DestinationOption[]> {
  // Destinations don't currently have a creator/owner column; the
  // ownership signal is "this creator has at least one scene at the
  // destination". Mirroring the same pattern assemble-tour uses, we
  // surface every destination that has a scene owned by this creator.
  const rows = await db
    .selectDistinct({
      id: schema.destinations.id,
      slug: schema.destinations.slug,
      name: schema.destinations.name,
      city: schema.destinations.city,
      country: schema.destinations.country,
    })
    .from(schema.destinations)
    .innerJoin(
      schema.scenes,
      eq(schema.scenes.destinationId, schema.destinations.id),
    )
    .where(eq(schema.scenes.ownerId, creatorId));
  return rows;
}

/** Distinct destination ids attached to any of the given course ids. */
export async function listDestinationIdsForCourses(
  courseIds: string[],
): Promise<Map<string, string[]>> {
  if (courseIds.length === 0) return new Map();
  const rows = await db
    .select({
      courseId: schema.courseDestinations.courseId,
      destinationId: schema.courseDestinations.destinationId,
    })
    .from(schema.courseDestinations)
    .where(inArray(schema.courseDestinations.courseId, courseIds));
  const out = new Map<string, string[]>();
  for (const row of rows) {
    const arr = out.get(row.courseId) ?? [];
    arr.push(row.destinationId);
    out.set(row.courseId, arr);
  }
  return out;
}

export async function listCoursesForCreator(creatorId: string): Promise<CourseRow[]> {
  return db
    .select()
    .from(schema.courses)
    .where(eq(schema.courses.creatorId, creatorId))
    .orderBy(desc(schema.courses.createdAt));
}

export async function listPublishedCourses(): Promise<CourseRow[]> {
  return db
    .select()
    .from(schema.courses)
    .where(eq(schema.courses.status, "published"))
    .orderBy(desc(schema.courses.publishedAt));
}

export async function getPublishedCourseBySlug(slug: string): Promise<CourseRow | null> {
  const rows = await db
    .select()
    .from(schema.courses)
    .where(and(eq(schema.courses.slug, slug), eq(schema.courses.status, "published")))
    .limit(1);
  return rows[0] ?? null;
}

export async function getCourseById(id: string): Promise<CourseRow | null> {
  const rows = await db
    .select()
    .from(schema.courses)
    .where(eq(schema.courses.id, id))
    .limit(1);
  return rows[0] ?? null;
}

export async function getCourseBySlug(slug: string): Promise<CourseRow | null> {
  const rows = await db
    .select()
    .from(schema.courses)
    .where(eq(schema.courses.slug, slug))
    .limit(1);
  return rows[0] ?? null;
}
