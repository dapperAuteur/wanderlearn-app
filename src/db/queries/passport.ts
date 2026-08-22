import { and, eq, inArray } from "drizzle-orm";
import { db, schema } from "@/db/client";
import { buildPassport, type Passport } from "@/lib/passport";

/**
 * Everything a learner's passport needs, in five queries rather than N+1.
 *
 * The shape is deliberately "fetch rows, then aggregate in a pure function":
 * the interesting rules (a place counts once, an empty course cannot stamp
 * anyone, a revoked enrollment counts for nothing) live in `buildPassport`
 * where they are unit-tested without a database.
 *
 * Completion is derived from `lesson_progress`, NOT from
 * `enrollments.completed_at`. That column exists and looks authoritative, and
 * nothing in the app ever writes it — it is null for every row. The
 * certificate route derives completion the same way for the same reason, and
 * the two must agree or a learner gets a certificate for a course their
 * passport says is unfinished.
 */
export async function getPassportForUser(userId: string): Promise<Passport> {
  const enrollments = await db
    .select({
      id: schema.enrollments.id,
      courseId: schema.enrollments.courseId,
      revokedAt: schema.enrollments.revokedAt,
    })
    .from(schema.enrollments)
    .where(eq(schema.enrollments.userId, userId));

  const active = enrollments.filter((e) => e.revokedAt === null);
  if (active.length === 0) {
    return { entries: [], counts: { places: 0, stamped: 0, inProgress: 0 } };
  }

  const courseIds = [...new Set(active.map((e) => e.courseId))];
  const enrollmentIds = active.map((e) => e.id);

  const [courses, lessons, progress, courseDestinations] = await Promise.all([
    db
      .select({
        id: schema.courses.id,
        slug: schema.courses.slug,
        title: schema.courses.title,
      })
      .from(schema.courses)
      .where(inArray(schema.courses.id, courseIds)),
    // PUBLISHED lessons only. A draft lesson the creator is still writing must
    // not silently un-stamp a learner who already finished everything visible
    // to them.
    db
      .select({ id: schema.lessons.id, courseId: schema.lessons.courseId })
      .from(schema.lessons)
      .where(
        and(inArray(schema.lessons.courseId, courseIds), eq(schema.lessons.status, "published")),
      ),
    db
      .select({
        enrollmentId: schema.lessonProgress.enrollmentId,
        lessonId: schema.lessonProgress.lessonId,
        status: schema.lessonProgress.status,
        completedAt: schema.lessonProgress.completedAt,
      })
      .from(schema.lessonProgress)
      .where(inArray(schema.lessonProgress.enrollmentId, enrollmentIds)),
    db
      .select({
        courseId: schema.courseDestinations.courseId,
        destinationId: schema.courseDestinations.destinationId,
      })
      .from(schema.courseDestinations)
      .where(inArray(schema.courseDestinations.courseId, courseIds)),
  ]);

  const destinationIds = [...new Set(courseDestinations.map((cd) => cd.destinationId))];
  const destinations = destinationIds.length
    ? await db
        .select({
          id: schema.destinations.id,
          slug: schema.destinations.slug,
          name: schema.destinations.name,
          city: schema.destinations.city,
          country: schema.destinations.country,
        })
        .from(schema.destinations)
        .where(
          and(
            inArray(schema.destinations.id, destinationIds),
            // Only places a visitor could actually open. A stamp linking to a
            // 404 is worse than an absent line. (`destinations` has no
            // soft-delete column — isPublic is the whole gate.)
            eq(schema.destinations.isPublic, true),
          ),
        )
    : [];

  return buildPassport({
    enrollments: active,
    courses,
    lessons,
    progress,
    courseDestinations,
    destinations,
  });
}
