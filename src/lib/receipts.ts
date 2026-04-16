import "server-only";
import { and, eq, isNull } from "drizzle-orm";
import { db, schema } from "@/db/client";
import { env } from "./env";
import { getDictionary } from "@/app/[lang]/dictionaries";
import type { Locale } from "./locales";
import { sendEmail } from "./mailer";

type SendResult =
  | { ok: true; sent: boolean }
  | { ok: false; error: string; code: string };

function formatMoney(cents: number, currency: string): string {
  const dollars = (cents / 100).toFixed(2);
  return `${currency.toUpperCase()} ${dollars}`;
}

/**
 * Idempotently send a receipt email for a paid purchase.
 *
 * The atomic `update ... where receipt_sent_at IS NULL ... returning id`
 * guarantees at most one caller wins when the webhook and the success
 * page race. Losing callers return `{ ok: true, sent: false }`.
 *
 * If Mailgun isn't configured, we still flip receipt_sent_at (so we
 * don't loop on every reconcile) but the mailer module will log the
 * intended send to the dev console.
 */
export async function sendPurchaseReceipt({
  purchaseId,
  lang,
}: {
  purchaseId: string;
  lang: Locale;
}): Promise<SendResult> {
  const [claimed] = await db
    .update(schema.purchases)
    .set({ receiptSentAt: new Date() })
    .where(
      and(
        eq(schema.purchases.id, purchaseId),
        eq(schema.purchases.status, "paid"),
        isNull(schema.purchases.receiptSentAt),
      ),
    )
    .returning({
      id: schema.purchases.id,
      userId: schema.purchases.userId,
      courseId: schema.purchases.courseId,
      amountCents: schema.purchases.amountCents,
      currency: schema.purchases.currency,
    });

  if (!claimed) {
    return { ok: true, sent: false };
  }

  const [user] = await db
    .select({ email: schema.users.email, name: schema.users.name })
    .from(schema.users)
    .where(eq(schema.users.id, claimed.userId))
    .limit(1);

  const [course] = await db
    .select({ slug: schema.courses.slug, title: schema.courses.title })
    .from(schema.courses)
    .where(eq(schema.courses.id, claimed.courseId))
    .limit(1);

  if (!user?.email || !course) {
    // We flipped the flag but can't deliver — leave it flipped so we don't
    // keep retrying on every reconcile. The purchase row still has the
    // transaction context for manual follow-up.
    return { ok: false, error: "user or course missing", code: "missing_context" };
  }

  const dict = await getDictionary(lang);
  const receipt = dict.learner.checkout.receipt;
  const baseUrl = env.BETTER_AUTH_URL.replace(/\/$/, "");
  const courseUrl = `${baseUrl}/${lang}/courses/${course.slug}`;

  const subject = receipt.subject.replace("{course}", course.title);
  const greetingName = user.name?.trim() || user.email;
  const amountLabel = formatMoney(claimed.amountCents, claimed.currency);

  const text = [
    receipt.greeting.replace("{name}", greetingName),
    "",
    receipt.body.replace("{course}", course.title).replace("{amount}", amountLabel),
    "",
    `${receipt.startLabel}: ${courseUrl}`,
    "",
    receipt.support,
    "",
    receipt.signOff,
  ].join("\n");

  const html = `<!doctype html>
<html lang="${lang}">
<body style="font-family:system-ui,-apple-system,Segoe UI,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#111">
  <p>${escapeHtml(receipt.greeting.replace("{name}", greetingName))}</p>
  <p>${escapeHtml(
    receipt.body.replace("{course}", course.title).replace("{amount}", amountLabel),
  )}</p>
  <p style="margin:28px 0">
    <a href="${courseUrl}" style="display:inline-block;background:#111;color:#fff;padding:12px 20px;border-radius:6px;text-decoration:none;font-weight:600">
      ${escapeHtml(receipt.startLabel)}
    </a>
  </p>
  <p style="color:#555;font-size:14px">${escapeHtml(receipt.support)}</p>
  <p style="color:#555;font-size:14px">${escapeHtml(receipt.signOff)}</p>
</body>
</html>`;

  try {
    await sendEmail({ to: user.email, subject, text, html });
    return { ok: true, sent: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "send failed",
      code: "mail_send_failed",
    };
  }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
