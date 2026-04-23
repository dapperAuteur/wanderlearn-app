/// <reference lib="webworker" />
import { defaultCache } from "@serwist/next/worker";
import type { PrecacheEntry, SerwistGlobalConfig } from "serwist";
import {
  CacheFirst,
  CacheableResponsePlugin,
  ExpirationPlugin,
  NetworkOnly,
  Serwist,
  StaleWhileRevalidate,
} from "serwist";

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: ServiceWorkerGlobalScope;

// Plan 05 §Approach §Service worker scope: creator, admin, and API routes
// bypass the SW entirely. A compromised cache on those surfaces is worse
// than the no-offline tradeoff. Sign-in/sign-up and support routes also
// bypass — auth surfaces must never be stale, and support forms are
// time-sensitive user reports.
const BYPASS_PATHS = [
  /\/[a-z]{2}(-[A-Z]{2})?\/creator\//,
  /\/[a-z]{2}(-[A-Z]{2})?\/admin\//,
  /\/[a-z]{2}(-[A-Z]{2})?\/sign-in(?:\/|$|\?)/,
  /\/[a-z]{2}(-[A-Z]{2})?\/sign-up(?:\/|$|\?)/,
  /\/[a-z]{2}(-[A-Z]{2})?\/support(?:\/|$|\?)/,
  /^\/api\//,
];

function isBypassed(url: URL): boolean {
  return BYPASS_PATHS.some((pattern) => pattern.test(url.pathname));
}

// Learner pages: /[lang]/courses, /[lang]/courses/[slug], /[lang]/learn/**.
// Stale-while-revalidate so a cached visit loads instantly and refreshes
// in the background. Honors the same-origin navigation assumption.
const LEARNER_PAGE = /^\/[a-z]{2}(-[A-Z]{2})?\/(?:courses|learn)(?:\/|$)/;

// Cloudinary delivery host. Every 2D image, poster still, course cover,
// and panorama JPG flows through here. URLs are effectively immutable
// (transforms are part of the URL path), so cache-first is safe.
const CLOUDINARY_HOST = "res.cloudinary.com";

// Named caches so a later branch ("Save for offline" toggle) can
// selectively clear what it aggressively pre-cached for a course. Version
// suffix bumps invalidate the cache across deploys.
const LEARNER_PAGE_CACHE = "wanderlearn-learner-pages-v1";
const CLOUDINARY_IMAGE_CACHE = "wanderlearn-cloudinary-images-v1";

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: [
    // Bypass list first — registered before every caching strategy so these
    // routes are always network-only, never served from cache.
    {
      matcher: ({ url }) => isBypassed(url),
      handler: new NetworkOnly(),
    },
    // Learner HTML pages — stale-while-revalidate.
    {
      matcher: ({ url, request }) =>
        request.method === "GET" &&
        url.origin === self.location.origin &&
        LEARNER_PAGE.test(url.pathname),
      handler: new StaleWhileRevalidate({
        cacheName: LEARNER_PAGE_CACHE,
        plugins: [
          new CacheableResponsePlugin({ statuses: [0, 200] }),
          new ExpirationPlugin({
            maxEntries: 50,
            maxAgeSeconds: 7 * 24 * 60 * 60, // 7 days
          }),
        ],
      }),
    },
    // Cloudinary images — cache-first with generous TTL. Includes 2D
    // panoramas, video posters, course covers, scene thumbnails. Video
    // delivery (HLS or MP4) is NOT included here — 360° video is opt-in
    // per-course via branch 4's "Save for offline" toggle.
    {
      matcher: ({ url, request }) =>
        request.method === "GET" &&
        url.hostname === CLOUDINARY_HOST &&
        url.pathname.includes("/image/"),
      handler: new CacheFirst({
        cacheName: CLOUDINARY_IMAGE_CACHE,
        plugins: [
          new CacheableResponsePlugin({ statuses: [0, 200] }),
          new ExpirationPlugin({
            maxEntries: 200,
            maxAgeSeconds: 30 * 24 * 60 * 60, // 30 days
          }),
        ],
      }),
    },
    // Default cache for everything else (Next static assets, fonts, etc).
    ...defaultCache,
  ],
});

serwist.addEventListeners();
