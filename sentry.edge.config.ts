import * as Sentry from "@sentry/nextjs";
import { scrubEvent } from "@/lib/sentry-scrub";

// Edge-runtime Sentry init. Loaded by src/instrumentation.ts's register() on the edge runtime.
// Same DSN guard as the server config: inert with no SENTRY_DSN set.
//
// This app ships no proxy/middleware today, so the edge runtime only comes into play if a route
// opts into it. The config exists anyway so that the first route that does is covered by default
// rather than silently unreported.
const dsn = process.env.SENTRY_DSN;
if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.SENTRY_ENVIRONMENT ?? process.env.VERCEL_ENV ?? process.env.NODE_ENV,
    tracesSampleRate: 0,
    sendDefaultPii: false,
    beforeSend: scrubEvent,
  });
}
