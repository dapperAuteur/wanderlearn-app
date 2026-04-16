import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getPublishedCourseBySlug } from "@/db/queries/courses";
import { listPublishedLessonsForCourse } from "@/db/queries/lessons";
import { hasLocale } from "@/lib/locales";
import { requireUser } from "@/lib/rbac";
import { getStripe, hasStripe } from "@/lib/stripe";
import { reconcilePaidCheckout } from "@/lib/checkout-reconcile";
import { sendPurchaseReceipt } from "@/lib/receipts";
import { getDictionary } from "../../../dictionaries";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: PageProps<"/[lang]/courses/[slug]/success">): Promise<Metadata> {
  const { lang } = await params;
  if (!hasLocale(lang)) return {};
  const dict = await getDictionary(lang);
  return {
    title: dict.learner.checkout.successTitle,
    robots: { index: false, follow: false },
  };
}

export default async function CheckoutSuccessPage({
  params,
  searchParams,
}: PageProps<"/[lang]/courses/[slug]/success">) {
  const { lang, slug } = await params;
  if (!hasLocale(lang)) notFound();

  const course = await getPublishedCourseBySlug(slug);
  if (!course) notFound();

  const dict = await getDictionary(lang);
  await requireUser(lang);

  const query = await searchParams;
  const sessionId =
    typeof query?.session_id === "string" && query.session_id.length > 0
      ? query.session_id
      : null;

  let state: "ok" | "pending" | "error" = "pending";
  let firstLessonSlug: string | null = null;

  if (sessionId && hasStripe) {
    try {
      const session = await getStripe().checkout.sessions.retrieve(sessionId);
      if (session.payment_status === "paid" && session.mode === "payment") {
        const paymentIntentId =
          typeof session.payment_intent === "string" ? session.payment_intent : null;
        const reconciled = await reconcilePaidCheckout({
          stripeSessionId: session.id,
          stripePaymentIntentId: paymentIntentId,
        });
        if (reconciled.ok) {
          const lessons = await listPublishedLessonsForCourse(course.id);
          firstLessonSlug = lessons[0]?.slug ?? null;
          state = "ok";
          // Idempotent — the atomic receipt_sent_at claim in
          // sendPurchaseReceipt means this only mails once even if the
          // webhook races this request.
          await sendPurchaseReceipt({ purchaseId: reconciled.purchaseId, lang });
        } else {
          state = "error";
        }
      } else {
        state = "pending";
      }
    } catch {
      state = "error";
    }
  }

  return (
    <main id="main" className="mx-auto w-full max-w-2xl px-4 py-16 text-center sm:px-6 lg:px-8">
      <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
        {state === "ok"
          ? dict.learner.checkout.successTitle
          : state === "pending"
            ? dict.learner.checkout.pendingTitle
            : dict.learner.checkout.errorTitle}
      </h1>
      <p className="mt-4 text-base text-zinc-600 dark:text-zinc-300">
        {state === "ok"
          ? dict.learner.checkout.successBody.replace("{course}", course.title)
          : state === "pending"
            ? dict.learner.checkout.pendingBody
            : dict.learner.checkout.errorBody}
      </p>

      <div className="mt-8 flex flex-wrap justify-center gap-3">
        {state === "ok" && firstLessonSlug ? (
          <Link
            href={`/${lang}/learn/${course.slug}/${firstLessonSlug}`}
            className="inline-flex min-h-12 items-center justify-center rounded-md bg-foreground px-6 text-base font-semibold text-background hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current"
          >
            {dict.learner.checkout.startNowCta}
          </Link>
        ) : null}
        <Link
          href={`/${lang}/courses/${course.slug}`}
          className="inline-flex min-h-12 items-center justify-center rounded-md border border-black/15 px-6 text-base font-medium hover:bg-black/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current dark:border-white/20 dark:hover:bg-white/5"
        >
          {dict.learner.checkout.backToCourseCta}
        </Link>
      </div>
    </main>
  );
}
