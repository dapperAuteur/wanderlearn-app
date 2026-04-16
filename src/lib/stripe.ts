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
