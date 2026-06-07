import type { NextConfig } from "next";
import withSerwistInit from "@serwist/next";

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

export default withSerwist(nextConfig);
