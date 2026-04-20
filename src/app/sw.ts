/// <reference lib="webworker" />
import { defaultCache } from "@serwist/next/worker";
import type { PrecacheEntry, SerwistGlobalConfig } from "serwist";
import { NetworkOnly, Serwist } from "serwist";

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    // Injected at build time by @serwist/next. Lists every static asset to
    // precache on install.
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: ServiceWorkerGlobalScope;

// Plan 05 §Approach §Service worker scope: creator, admin, and API routes
// bypass the SW entirely. A compromised cache entry on those surfaces would
// be much worse than the no-offline tradeoff. Server actions also post
// through page routes, so we let navigations to /creator/** and /admin/**
// fall straight to the network.
const BYPASS_PATHS = [
  /\/[a-z]{2}(-[A-Z]{2})?\/creator\//,
  /\/[a-z]{2}(-[A-Z]{2})?\/admin\//,
  /^\/api\//,
];

function isBypassed(url: URL): boolean {
  return BYPASS_PATHS.some((pattern) => pattern.test(url.pathname));
}

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: [
    // Explicit network-only for the bypass list. Registered BEFORE the
    // default cache so these routes never reach the caching strategies.
    {
      matcher: ({ url }) => isBypassed(url),
      handler: new NetworkOnly(),
    },
    // Plan 05 branch 1 ships the shell precache + default runtime cache.
    // Branch 2 (feat/offline-lesson-cache) tightens runtime rules for
    // learner routes specifically.
    ...defaultCache,
  ],
});

serwist.addEventListeners();
