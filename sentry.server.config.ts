import * as Sentry from "@sentry/nextjs";
import { scrubEvent } from "@/lib/sentry-scrub";

// Server-runtime Sentry init. Loaded by src/instrumentation.ts's register() on the Node runtime.
// The DSN points at Better Stack, which speaks the Sentry ingest protocol, so the Sentry SDK is the
// client and Better Stack is the destination.
//
// GUARDED ON THE DSN. With no SENTRY_DSN set, init never runs and the SDK is inert: nothing is
// collected, nothing is sent, no network call is made. That keeps local dev, CI, and every preview
// deploy on exactly the behaviour they have today until BAM provisions the source and sets the var
// (plans/user-tasks/64-sentry-better-stack-dsn.md).
//
// process.env is read directly rather than through src/lib/env.ts because this file loads during
// server boot, before the app's module graph, and must not depend on schema validation to decide
// whether it is switched on.
const dsn = process.env.SENTRY_DSN;
if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.SENTRY_ENVIRONMENT ?? process.env.VERCEL_ENV ?? process.env.NODE_ENV,
    // Errors only. No tracing spend, and no performance data, until BAM opts in.
    tracesSampleRate: 0,
    // Never auto-attach IP / cookies / user email. beforeSend is the second line of defence.
    sendDefaultPii: false,
    beforeSend: scrubEvent,
  });
}
