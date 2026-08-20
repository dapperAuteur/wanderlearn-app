import type { NextConfig } from "next";
import withSerwistInit from "@serwist/next";
import { withSentryConfig } from "@sentry/nextjs";

const isDev = process.env.NODE_ENV !== "production";

// Serwist wires a service worker scoped to the origin. The SW file itself
// (src/app/sw.ts) decides which routes to bypass — creator, admin, and API
// paths always hit the network, never the cache.
const withSerwist = withSerwistInit({
  swSrc: "src/app/sw.ts",
  swDest: "public/sw.js",
  // Auto-register on client load. Client mounts -> SW installs.
  register: true,
  reloadOnOnline: true,
  // Keep the SW inactive during dev so HMR isn't shadowed by cached assets.
  disable: isDev,
  // Precache every public asset (the default) EXCEPT the 1.4 MB globe
  // Earth texture. The discovery globe is progressive enhancement on
  // /tours only, so its texture must not bloat the SW install for every
  // visitor — it runtime-caches via defaultCache the first time someone
  // opens the globe. Offline-first gate: keep the precache lean.
  globPublicPatterns: ["**/*", "!tour-assets/globe/**"],
});

const nextConfig: NextConfig = {
  // PostHog's ingest endpoints use trailing slashes (/e/, /flags/, /s/). Without this,
  // Next issues a 308 to the slashless form before the rewrite runs and ingest breaks.
  // Required by PostHog's documented Next.js proxy setup.
  //
  // SIDE EFFECT worth knowing: this disables Next's automatic trailing-slash redirect
  // for EVERY route, not just /ingest, so /en/tours/ no longer 308s to /en/tours and
  // both forms become reachable. Every page under [lang] already sets
  // `alternates.canonical` from absoluteUrl(), which is what keeps search engines
  // pointed at one form — verify those survive any future metadata refactor.
  skipTrailingSlashRedirect: true,

  // @neondatabase/serverless uses `ws` for websocket transport. `ws` has
  // native bindings (`bufferutil`, `utf-8-validate`) and internal dynamic
  // requires that Vercel's build minifier mangles — the symptom is
  // `TypeError: b.mask is not a function` crashing the whole serverless
  // function on any DB query that goes through the websocket driver.
  // Marking both external tells Next to resolve them from node_modules at
  // runtime instead of bundling, which preserves the native paths.
  serverExternalPackages: ["@neondatabase/serverless", "ws"],
  experimental: {
    // Required to use forbidden() / unauthorized() from next/navigation.
    // Lets requireRole() throw a clean 403 with a forbidden.tsx page
    // instead of silently redirecting to home (which has trapped at
    // least one admin who hadn't been promoted in prod yet).
    authInterrupts: true,
  },
  async rewrites() {
    // Reverse-proxy PostHog through our own origin. us.i.posthog.com is on uBlock
    // Origin, Brave Shields, and Safari's tracker list, so a meaningful share of
    // events never leave the browser — including, reliably, our own test visits.
    // Routing ingest through this origin leaves blockers nothing to match on.
    //
    // Assets come from a different upstream host than ingest, hence two rules. The
    // more specific /static rule must come first.
    //
    // The shared ecosystem project is US. NEXT_PUBLIC_POSTHOG_HOST remains the
    // documented upstream host, but the browser now talks to "/ingest" instead —
    // these destinations are the values that actually matter.
    return [
      {
        source: "/ingest/static/:path*",
        destination: "https://us-assets.i.posthog.com/static/:path*",
      },
      {
        source: "/ingest/:path*",
        destination: "https://us.i.posthog.com/:path*",
      },
    ];
  },

  async headers() {
    return [
      {
        // Public iframe-embed surface for partner sites. Browsers honor
        // CSP frame-ancestors over X-Frame-Options when both are present;
        // setting it to `*` lets WordPress/Squarespace/Weebly/etc embed
        // the tour viewer. Only the /embed/* routes get this; the main
        // app keeps its default same-origin frame policy.
        source: "/embed/:path*",
        headers: [
          { key: "Content-Security-Policy", value: "frame-ancestors *;" },
        ],
      },
    ];
  },
};

// Sentry's build plugin wraps the Serwist-wrapped config, so it sees the final webpack config.
//
// Safe with no Sentry env set: without SENTRY_AUTH_TOKEN it skips source-map upload entirely (you
// just get minified stack traces), and the runtime SDK stays inert without a DSN. org/project/token
// all come from env so nothing account-specific is committed here.
export default withSentryConfig(withSerwist(nextConfig), {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  silent: !process.env.CI,
  // The client bundle is split across many chunks; widen the upload so a stack trace from any of
  // them resolves rather than only the ones under the default glob.
  //
  // SIDE EFFECT WORTH KNOWING: enabling source maps for the client compilation also makes Serwist's
  // service-worker build emit `public/sw.js.map`, which is new build output. It is gitignored
  // alongside `public/sw.js`, but it IS generated during a Vercel build and therefore served. That is
  // acceptable -- the SW source already ships to every browser as `sw.js`; the map only pretty-prints
  // it -- but it is a change, not an accident.
  widenClientFileUpload: true,
  webpack: {
    // Strips the SDK's own debug logging from the bundle. This is the current option; the top-level
    // `disableLogger` flag is deprecated.
    treeshake: { removeDebugLogging: true },
  },
});
