import * as Sentry from "@sentry/nextjs";
import type { Instrumentation } from "next";

// Next.js instrumentation hook. Loads the right Sentry config per runtime, and reports server-side
// App Router errors through onRequestError. Everything here is inert without a SENTRY_DSN, because
// the guard lives in the configs themselves.
export async function register() {
  // OTel first: it must own the global tracer provider before Sentry loads (Sentry is told to skip
  // its own OTel setup — see sentry.server.config.ts). Inert without the Honeycomb key.
  const { registerHoneycombOtel } = await import("./otel.config");
  registerHoneycombOtel();

  if (process.env.NEXT_RUNTIME === "nodejs") await import("../sentry.server.config");
  if (process.env.NEXT_RUNTIME === "edge") await import("../sentry.edge.config");
}

/**
 * Captures errors thrown while rendering or serving a request.
 *
 * We tag the LOCALE, which is the first path segment on every user-facing route (`/en/...`,
 * `/es/...`). Spanish is hand-translated per the content policy, so "does this only break in
 * Spanish" is a question we actually ask, and answering it from the tag costs no PII. The locale is
 * read off a strict allowlist so a crafted path cannot turn the tag into a free-text sink.
 *
 * `request.path` itself is never tagged: it carries the query string, and the query string is where
 * `?token=` and `?secret=` live. captureRequestError attaches what it needs, and scrubEvent runs
 * over the result.
 */
export const onRequestError: Instrumentation.onRequestError = (err, request, context) => {
  const firstSegment = request.path.replace(/^\//, "").split(/[/?#]/)[0];
  const locale = firstSegment === "en" || firstSegment === "es" ? firstSegment : undefined;
  Sentry.withScope((scope) => {
    if (locale) scope.setTag("app.locale", locale);
    Sentry.captureRequestError(err, request, context);
  });
};
