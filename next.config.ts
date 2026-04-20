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

const nextConfig: NextConfig = {};

export default withSerwist(nextConfig);
