import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@/db/client";
import { getSession } from "@/lib/rbac";

export const dynamic = "force-dynamic";

const writeSchema = z.object({
  id: z.string().min(1).max(64),
  kind: z.enum(["start", "complete"]),
  enrollmentId: z.string().uuid(),
  lessonId: z.string().uuid(),
  courseSlug: z.string().min(1).max(200),
  lang: z.enum(["en", "es"]),
  clientTimestamp: z.number().int().nonnegative(),
  queuedAt: z.number().int().nonnegative().optional(),
  attempts: z.number().int().nonnegative().optional(),
});

const bodySchema = z.object({
  writes: z.array(writeSchema).min(1).max(100),
});

type WriteInput = z.infer<typeof writeSchema>;

async function applyOne(
  w: WriteInput,
  userId: string,
): Promise<{ id: string; ok: boolean }> {
  // Ownership: enrollment must belong to this user and not be revoked.
  const [enrollment] = await db
    .select({
      id: schema.enrollments.id,
      userId: schema.enrollments.userId,
      courseId: schema.enrollments.courseId,
      revokedAt: schema.enrollments.revokedAt,
    })
    .from(schema.enrollments)
    .where(eq(schema.enrollments.id, w.enrollmentId))
    .limit(1);
  if (!enrollment || enrollment.userId !== userId || enrollment.revokedAt !== null) {
    return { id: w.id, ok: false };
  }

  // The lesson must live in the enrollment's course.
  const [lesson] = await db
    .select({ id: schema.lessons.id })
    .from(schema.lessons)
    .where(
      and(
        eq(schema.lessons.id, w.lessonId),
        eq(schema.lessons.courseId, enrollment.courseId),
      ),
    )
    .limit(1);
  if (!lesson) return { id: w.id, ok: false };

  const now = new Date();

  const [existing] = await db
    .select({
      id: schema.lessonProgress.id,
      status: schema.lessonProgress.status,
    })
    .from(schema.lessonProgress)
    .where(
      and(
        eq(schema.lessonProgress.enrollmentId, enrollment.id),
        eq(schema.lessonProgress.lessonId, w.lessonId),
      ),
    )
    .limit(1);

  if (w.kind === "complete") {
    // Completion is monotonic: a completed row stays completed regardless
    // of client timestamp. An incoming "complete" always wins over
    // "in_progress" or missing.
    if (existing?.status === "completed") {
      return { id: w.id, ok: true };
    }
    if (existing) {
      await db
        .update(schema.lessonProgress)
        .set({
          status: "completed",
          percentComplete: 100,
          completedAt: now,
          updatedAt: now,
        })
        .where(eq(schema.lessonProgress.id, existing.id));
    } else {
      await db.insert(schema.lessonProgress).values({
        enrollmentId: enrollment.id,
        lessonId: w.lessonId,
        status: "completed",
        percentComplete: 100,
        startedAt: now,
        completedAt: now,
        updatedAt: now,
      });
    }
    return { id: w.id, ok: true };
  }

  // kind === "start"
  if (existing?.status === "completed") {
    // Completed is sticky. A queued "start" that arrives after a
    // "complete" should not demote.
    return { id: w.id, ok: true };
  }
  if (existing) {
    await db
      .update(schema.lessonProgress)
      .set({ updatedAt: now })
      .where(eq(schema.lessonProgress.id, existing.id));
  } else {
    await db.insert(schema.lessonProgress).values({
      enrollmentId: enrollment.id,
      lessonId: w.lessonId,
      status: "in_progress",
      percentComplete: 0,
      startedAt: now,
      updatedAt: now,
    });
  }
  return { id: w.id, ok: true };
}

export async function POST(request: Request) {
  const session = await getSession();
  const user = session?.user;
  if (!user) {
    return NextResponse.json(
      { ok: false, error: "unauthorized" },
      { status: 401 },
    );
  }

  const rawBody = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: "invalid_input" },
      { status: 400 },
    );
  }

  // Apply each write, fail-isolated. One bad write can't poison the batch.
  const results = await Promise.all(
    parsed.data.writes.map((w) =>
      applyOne(w, user.id).catch((err) => {
        console.error("[offline-sync] applyOne failed", err);
        return { id: w.id, ok: false };
      }),
    ),
  );

  return NextResponse.json({ ok: true, results });
}
