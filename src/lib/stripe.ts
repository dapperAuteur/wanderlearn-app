import "server-only";
import Stripe from "stripe";
import { env, hasStripe } from "./env";

function requireStripeSecret(): string {
  if (!env.STRIPE_SECRET_KEY) {
    throw new Error(
      "Stripe is not configured. Set STRIPE_SECRET_KEY in your environment to enable paid checkout.",
    );
  }
  return env.STRIPE_SECRET_KEY;
}

let client: Stripe | null = null;

export function getStripe(): Stripe {
  if (client) return client;
  client = new Stripe(requireStripeSecret(), {
    typescript: true,
  });
  return client;
}

export { hasStripe };

// Stripe dashboard URL pattern differs between live and test mode. Detect
// from the secret-key prefix: sk_live_* → live, sk_test_* → test.
function isStripeTestMode(): boolean {
  return (env.STRIPE_SECRET_KEY ?? "").startsWith("sk_test_");
}

const STRIPE_DASHBOARD_BASE = "https://dashboard.stripe.com";

export function stripeDashboardProductUrl(productId: string): string {
  const prefix = isStripeTestMode() ? "/test/products/" : "/products/";
  return `${STRIPE_DASHBOARD_BASE}${prefix}${productId}`;
}

export function stripeDashboardPriceUrl(priceId: string): string {
  const prefix = isStripeTestMode() ? "/test/prices/" : "/prices/";
  return `${STRIPE_DASHBOARD_BASE}${prefix}${priceId}`;
}

export function verifyWebhookSignature(
  body: string,
  signatureHeader: string,
): Stripe.Event {
  if (!env.STRIPE_WEBHOOK_SECRET) {
    throw new Error(
      "Stripe webhook signature verification requires STRIPE_WEBHOOK_SECRET.",
    );
  }
  return getStripe().webhooks.constructEvent(
    body,
    signatureHeader,
    env.STRIPE_WEBHOOK_SECRET,
  );
}
