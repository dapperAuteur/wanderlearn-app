import { NextResponse } from "next/server";
import { env, hasStripe } from "@/lib/env";
import { verifyWebhookSignature } from "@/lib/stripe";
import { reconcilePaidCheckout } from "@/lib/checkout-reconcile";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!hasStripe || !env.STRIPE_WEBHOOK_SECRET) {
    return NextResponse.json(
      { ok: false, error: "stripe_not_configured" },
      { status: 503 },
    );
  }

  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json(
      { ok: false, error: "missing_signature" },
      { status: 400 },
    );
  }

  const body = await request.text();

  let event;
  try {
    event = verifyWebhookSignature(body, signature);
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        error: "invalid_signature",
        message: err instanceof Error ? err.message : "signature verification failed",
      },
      { status: 400 },
    );
  }

  if (event.type !== "checkout.session.completed") {
    return NextResponse.json({ ok: true, handled: false });
  }

  const session = event.data.object;
  if (session.mode !== "payment" || session.payment_status !== "paid") {
    return NextResponse.json({ ok: true, handled: false });
  }

  const paymentIntentId =
    typeof session.payment_intent === "string" ? session.payment_intent : null;

  const result = await reconcilePaidCheckout({
    stripeSessionId: session.id,
    stripePaymentIntentId: paymentIntentId,
  });

  if (!result.ok) {
    return NextResponse.json({ ok: false, code: result.code }, { status: 404 });
  }

  return NextResponse.json({ ok: true, enrollmentId: result.enrollmentId });
}
