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
  // Embed surface lives at /embed/tours/<slug> with no [lang] prefix
  // and is served inside third-party iframes. Skipping the SW avoids
  // any chance of a partner site loading our cached HTML when they
  // expect a fresh request, and keeps embed traffic separate from the
  // learner-page cache.
  /^\/embed\//,
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

// Dedicated cache for "Save for offline" aggressive pre-caching. Kept
// separate from the runtime caches above so toggle-off only evicts what
// the user explicitly opted in for.
const SAVE_OFFLINE_CACHE = "wanderlearn-save-offline-v1";

// Skip caching any Cloudinary response larger than this threshold. 4 MB
// covers the largest 720-px-wide JPG we deliver while excluding the
// raw 360° panoramas that, at 15–25 MB each, used to exhaust the
// browser's per-origin storage quota. Tunable; the right number is
// "biggest thumbnail we deliver" + a small buffer.
const CLOUDINARY_MAX_CACHE_BYTES = 4 * 1024 * 1024;

// Message protocol between the course detail page and this SW.
// Page → SW:  { type: "cache-course", courseSlug, urls } / "uncache-course"
// SW → page (via event.ports[0]): "cache-progress" / "cache-done" /
//   "uncache-done"
type CacheCourseMessage = {
  type: "cache-course";
  courseSlug: string;
  urls: string[];
};
type UncacheCourseMessage = {
  type: "uncache-course";
  courseSlug: string;
  urls: string[];
};
type SwMessage = CacheCourseMessage | UncacheCourseMessage;

self.addEventListener("message", (event) => {
  const data = event.data as SwMessage | undefined;
  if (!data || typeof data !== "object" || !("type" in data)) return;
  const port: MessagePort | undefined = event.ports[0];

  if (data.type === "cache-course") {
    event.waitUntil(handleCacheCourse(data, port));
  } else if (data.type === "uncache-course") {
    event.waitUntil(handleUncacheCourse(data, port));
  }
});

async function handleCacheCourse(
  msg: CacheCourseMessage,
  port: MessagePort | undefined,
): Promise<void> {
  const cache = await caches.open(SAVE_OFFLINE_CACHE);
  let cached = 0;
  const total = msg.urls.length;
  const failed: string[] = [];
  for (const url of msg.urls) {
    try {
      const res = await fetch(url, { credentials: "same-origin" });
      if (res.ok) {
        await cache.put(url, res.clone());
        cached += 1;
      } else {
        failed.push(url);
      }
    } catch {
      failed.push(url);
    }
    port?.postMessage({ type: "cache-progress", cached, total, failed });
  }
  port?.postMessage({ type: "cache-done", cached, total, failed });
}

async function handleUncacheCourse(
  msg: UncacheCourseMessage,
  port: MessagePort | undefined,
): Promise<void> {
  const cache = await caches.open(SAVE_OFFLINE_CACHE);
  for (const url of msg.urls) {
    await cache.delete(url).catch(() => false);
  }
  port?.postMessage({ type: "uncache-done" });
}

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
    //
    // Quota guard: a stitched 360° JPG can be 15–25 MB. With maxEntries
    // alone we'd let the cache fill to multiple GBs, exhaust the
    // browser's per-origin storage quota, and throw QuotaExceededError
    // unhandled — which aborts the in-flight fetch and renders the
    // image as broken. Two defenses below: (1) cap at 50 entries instead
    // of 200, and (2) the `cacheWillUpdate` plugin skips any response
    // larger than CLOUDINARY_MAX_CACHE_BYTES so the cache holds many
    // small thumbnails rather than a handful of full panoramas.
    {
      matcher: ({ url, request }) =>
        request.method === "GET" &&
        url.hostname === CLOUDINARY_HOST &&
        url.pathname.includes("/image/"),
      handler: new CacheFirst({
        cacheName: CLOUDINARY_IMAGE_CACHE,
        plugins: [
          new CacheableResponsePlugin({ statuses: [0, 200] }),
          {
            cacheWillUpdate: async ({ response }) => {
              const lenHeader = response.headers.get("content-length");
              if (lenHeader) {
                const bytes = Number(lenHeader);
                if (Number.isFinite(bytes) && bytes > CLOUDINARY_MAX_CACHE_BYTES) {
                  return null;
                }
              }
              return response;
            },
          },
          new ExpirationPlugin({
            maxEntries: 50,
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
