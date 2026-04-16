import "server-only";
import { and, eq } from "drizzle-orm";
import { db, schema } from "@/db/client";

export type ReconcileResult =
  | { ok: true; purchaseId: string; enrollmentId: string; courseSlug: string }
  | { ok: false; code: string };

/**
 * Idempotently reconcile a completed Stripe checkout session into our DB:
 *   - mark the matching purchases row as paid
 *   - ensure an enrollment exists for (userId, courseId) with source=purchase
 *
 * Safe to call from both the success page and the webhook — the unique
 * (user_id, course_id) index on enrollments + per-session purchase row
 * means duplicate calls are no-ops.
 */
export async function reconcilePaidCheckout({
  stripeSessionId,
  stripePaymentIntentId,
}: {
  stripeSessionId: string;
  stripePaymentIntentId: string | null;
}): Promise<ReconcileResult> {
  const [purchase] = await db
    .select({
      id: schema.purchases.id,
      userId: schema.purchases.userId,
      courseId: schema.purchases.courseId,
      status: schema.purchases.status,
    })
    .from(schema.purchases)
    .where(eq(schema.purchases.stripeSessionId, stripeSessionId))
    .limit(1);

  if (!purchase) {
    return { ok: false, code: "purchase_not_found" };
  }

  const [course] = await db
    .select({ slug: schema.courses.slug })
    .from(schema.courses)
    .where(eq(schema.courses.id, purchase.courseId))
    .limit(1);
  if (!course) {
    return { ok: false, code: "course_not_found" };
  }

  if (purchase.status !== "paid") {
    await db
      .update(schema.purchases)
      .set({
        status: "paid",
        stripePaymentIntentId: stripePaymentIntentId ?? undefined,
      })
      .where(eq(schema.purchases.id, purchase.id));
  }

  const [existing] = await db
    .select({ id: schema.enrollments.id })
    .from(schema.enrollments)
    .where(
      and(
        eq(schema.enrollments.userId, purchase.userId),
        eq(schema.enrollments.courseId, purchase.courseId),
      ),
    )
    .limit(1);

  let enrollmentId: string;
  if (existing) {
    enrollmentId = existing.id;
  } else {
    const [inserted] = await db
      .insert(schema.enrollments)
      .values({
        userId: purchase.userId,
        courseId: purchase.courseId,
        purchaseId: purchase.id,
        source: "purchase",
      })
      .returning({ id: schema.enrollments.id });
    enrollmentId = inserted.id;
  }

  return {
    ok: true,
    purchaseId: purchase.id,
    enrollmentId,
    courseSlug: course.slug,
  };
}
