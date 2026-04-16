"use server";

import { eq } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@/db/client";
import { env, hasStripe } from "@/lib/env";
import { getStripe } from "@/lib/stripe";
import { requireUser } from "@/lib/rbac";
import type { Locale } from "@/lib/locales";

type Result<T> = { ok: true; data: T } | { ok: false; error: string; code: string };

const createSessionSchema = z.object({
  courseId: z.string().uuid(),
  lang: z.enum(["en", "es"]),
});

async function ensureCourseStripeIds(course: {
  id: string;
  title: string;
  subtitle: string | null;
  priceCents: number;
  currency: string;
  stripeProductId: string | null;
  stripePriceId: string | null;
}): Promise<{ stripeProductId: string; stripePriceId: string }> {
  const stripe = getStripe();
  let productId = course.stripeProductId;
  let priceId = course.stripePriceId;

  if (!productId) {
    const product = await stripe.products.create({
      name: course.title,
      description: course.subtitle ?? undefined,
      metadata: { courseId: course.id },
    });
    productId = product.id;
  }

  if (!priceId) {
    const price = await stripe.prices.create({
      product: productId,
      unit_amount: course.priceCents,
      currency: course.currency.toLowerCase(),
      metadata: { courseId: course.id },
    });
    priceId = price.id;
  }

  if (productId !== course.stripeProductId || priceId !== course.stripePriceId) {
    await db
      .update(schema.courses)
      .set({
        stripeProductId: productId,
        stripePriceId: priceId,
        updatedAt: new Date(),
      })
      .where(eq(schema.courses.id, course.id));
  }

  return { stripeProductId: productId, stripePriceId: priceId };
}

export async function createCheckoutSession(
  formData: FormData,
): Promise<Result<{ url: string }>> {
  const parsed = createSessionSchema.safeParse({
    courseId: String(formData.get("courseId") ?? ""),
    lang: String(formData.get("lang") ?? "en") as Locale,
  });
  if (!parsed.success) {
    return { ok: false, error: "Invalid input", code: "invalid_input" };
  }
  if (!hasStripe) {
    return { ok: false, error: "Checkout is not configured", code: "stripe_not_configured" };
  }
  const user = await requireUser(parsed.data.lang);

  const [course] = await db
    .select({
      id: schema.courses.id,
      slug: schema.courses.slug,
      title: schema.courses.title,
      subtitle: schema.courses.subtitle,
      status: schema.courses.status,
      priceCents: schema.courses.priceCents,
      currency: schema.courses.currency,
      stripeProductId: schema.courses.stripeProductId,
      stripePriceId: schema.courses.stripePriceId,
    })
    .from(schema.courses)
    .where(eq(schema.courses.id, parsed.data.courseId))
    .limit(1);

  if (!course) {
    return { ok: false, error: "Course not found", code: "not_found" };
  }
  if (course.status !== "published") {
    return { ok: false, error: "Course is not published", code: "not_published" };
  }
  if (course.priceCents <= 0) {
    return {
      ok: false,
      error: "Free courses use the free-enroll flow",
      code: "free_course",
    };
  }

  const { stripePriceId } = await ensureCourseStripeIds(course);

  const baseUrl = env.BETTER_AUTH_URL.replace(/\/$/, "");
  const successUrl = `${baseUrl}/${parsed.data.lang}/courses/${course.slug}/success?session_id={CHECKOUT_SESSION_ID}`;
  const cancelUrl = `${baseUrl}/${parsed.data.lang}/courses/${course.slug}?checkout=cancelled`;

  const session = await getStripe().checkout.sessions.create({
    mode: "payment",
    line_items: [{ price: stripePriceId, quantity: 1 }],
    success_url: successUrl,
    cancel_url: cancelUrl,
    customer_email: user.email ?? undefined,
    client_reference_id: `${user.id}:${course.id}`,
    metadata: {
      userId: user.id,
      courseId: course.id,
      lang: parsed.data.lang,
    },
  });

  if (!session.url) {
    return { ok: false, error: "Stripe did not return a checkout URL", code: "stripe_no_url" };
  }

  await db.insert(schema.purchases).values({
    userId: user.id,
    courseId: course.id,
    stripeSessionId: session.id,
    amountCents: course.priceCents,
    currency: course.currency,
    status: "pending",
  });

  return { ok: true, data: { url: session.url } };
}
