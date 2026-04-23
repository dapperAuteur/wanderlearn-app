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
};

export default withSerwist(nextConfig);
