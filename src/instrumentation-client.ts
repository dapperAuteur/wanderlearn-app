import * as Sentry from "@sentry/nextjs";
import { scrubEvent } from "@/lib/sentry-scrub";

// Client-runtime Sentry init. Reads the PUBLIC DSN, which Next inlines at build time.
//
// GUARDED ON THE DSN. With no NEXT_PUBLIC_SENTRY_DSN set the SDK is never initialised, so no
// listeners are attached, no breadcrumbs are recorded, and no request leaves the browser. Note that
// this module is still PARSED on every page load either way, which is why src/lib/sentry-scrub.ts
// contains no regex lookbehind: a SyntaxError there would break the chunk on older iOS Safari even
// with the DSN unset, turning an observability feature into an outage.
const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
if (dsn) {
  Sentry.init({
    dsn,
    environment:
      process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT ?? process.env.NEXT_PUBLIC_VERCEL_ENV ?? process.env.NODE_ENV,
    // Errors only. No tracing, and no session replay: replay would record learners moving through
    // 360 tours, which is both a privacy problem and a bandwidth problem on the mobile-first
    // viewports this app is designed for.
    tracesSampleRate: 0,
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: 0,
    sendDefaultPii: false,
    beforeSend: scrubEvent,
  });
}

// Instruments App Router client navigations. A no-op when the SDK was never initialised.
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
