# 05 — Offline learner (week 7 second half, pulled forward)

**Status:** Active. Launch-blocking for June 11, 2026 per BAM decision
2026-04-19 (supersedes plan 04 Theme A).
**Scope:** Learner can take enrolled lessons without network after first
visit. Progress writes queue offline, sync on reconnect.
**Depends on:** nothing hard. Builds on the server-side progress flow
already merged (`feat/progress-and-resume`).

## Why this plan exists

Plan 00 week 7 called for offline mode but explicitly allowed the offline
half to slip to Phase 1.2. BAM decided 2026-04-19 that offline ships in
1.0. This plan scopes the work concretely so we don't drift.

Service workers are the subtlest part of Wanderlearn's stack. A bad SW
can wedge a learner's browser on a stale cached build for days until
they figure out how to hard-reload. That risk earns a real plan rather
than a "do Serwist" branch.

## Context — what offline needs to do

A learner is enrolled in MUCHO. They download a lesson-worth of content
while on wifi, go to Colonia Juárez with no cell signal, and take the
lesson inside the museum. Target behaviors in priority order:

1. **Static shell loads offline** — HTML, JS, CSS, fonts, logo, the
   learner's course list and enrollment state.
2. **Enrolled lesson content loads offline** — text blocks, transcripts,
   cached 2D poster images for 360° blocks.
3. **Progress writes queue offline** — mark lesson complete, advance to
   next lesson, save timestamp. Queued writes replay on reconnect.
4. **Session state survives offline** — a learner who is signed in while
   online should still see their enrolled courses when offline.
5. **360° media is opt-in** — auto-caching 360° video would fill a phone
   in two tours. Learners opt-in per course via a "Save for offline"
   toggle. Off by default.

What offline mode is explicitly NOT trying to do:

- **Creator surfaces offline.** Creators need to upload media, and
  uploads inherently need network. Creator + admin routes stay
  online-only.
- **Support chat offline.** Out of scope; adds a queue-and-retry layer
  we don't want to debug this close to launch.
- **Enroll offline.** First visit must be online. Once enrolled, the
  learner can take the course offline.
- **Pay offline.** Stripe needs network. Since MUCHO is free (decision
  3), this is not on the launch critical path.

## Scope

### In (launch-blocking)

- **Service worker**: Serwist against Next.js 16, scoped to
  `/[lang]/courses`, `/[lang]/learn/**`, `/[lang]/support`, the landing
  page, and static assets. **Not** `/[lang]/creator/**` or
  `/[lang]/admin/**`.
- **Precache** at install: app shell (HTML/JS/CSS/fonts/logo) and the
  sign-in page.
- **Runtime cache** with stale-while-revalidate on:
  - Learner catalog + course detail pages
  - Lesson player HTML
  - Cloudinary-delivered images (all photo_360 panoramas as 2D flat,
    video poster stills, course covers)
  - Text block rendered HTML
- **Save-for-offline toggle** on the course detail page: "Save this
  course for offline use." Flips a per-user, per-course flag; on the
  next page load with network, the SW aggressively caches every
  included media asset. Toggle off clears the cache for that course.
- **IndexedDB outbox for progress writes** — mark lesson started/
  completed, last block visited, last position. Writes enqueue when
  offline; background sync replays on reconnect. Conflict rule:
  last-write-wins by local timestamp, server timestamp tiebreaker
  (matches plan 00 §4).
- **Offline-aware UI**:
  - Banner on `/[lang]/learn/**` when `navigator.onLine === false`
    saying "Reading offline. Progress will sync when you're back."
  - Enrollment count and course status disable the buy/enroll buttons
    when offline.
  - Failed fetches surface a clear "You're offline" state instead of a
    generic error.

### Out (explicitly not in this plan)

- **Offline enrollment or purchase** — requires a server round trip.
  First visit is online.
- **Cache-licensed 360° video aggressively** — the "Save for offline"
  toggle does cache video, but only on explicit user opt-in per course.
  Default behavior never caches 360° video.
- **Per-lesson "Save this one lesson" toggle** — v1 is per-course.
  Per-lesson granularity is a 1.2 nice-to-have.
- **Background content refresh** — we don't push new lesson content to
  a learner's device proactively. Changes land on next online load.
- **Licensed content gate (`validUntil`)** — plan 00 §4 mentions this
  but it's Phase 2. For the MUCHO-free launch this doesn't matter;
  every cached asset is a free-course asset.
- **Support-chat offline queue** — out of scope per plan 00 §4 bullet
  list, still out here.

## Data model changes

### New column: `enrollments.offline_enabled_at timestamp | null`

Per-enrollment flag. When non-null, the SW should aggressively cache
every asset in that course. Toggled on when the learner clicks "Save
for offline" on the course detail page; toggled off by clicking
"Remove from offline storage."

Migration is trivial: nullable column, default null, no backfill needed.

### No other DB changes

Progress writes still land in `lesson_progress`. The outbox is
client-side only (IndexedDB), not mirrored to the DB. Server sees the
same writes it sees today; the SW is the queuing layer.

## Approach

### Service worker: Serwist

Reasons for Serwist over hand-rolled SW or next-pwa:

- Actively maintained against Next.js 15/16. `next-pwa` is abandoned.
- Good TypeScript support, clean precaching API.
- Battle-tested caching strategies (stale-while-revalidate, cache-first,
  network-first) exposed as named patterns.
- Small runtime. No framework lock-in — if we ever rip it out, the SW
  file is plain TypeScript we can read.

Install:
```
pnpm add serwist @serwist/next
```

### File layout

- `src/app/sw.ts` — the service worker entry. Imports Serwist defaults,
  adds our custom caching rules. Next.js 16 compiles this to the
  correct asset automatically when `@serwist/next` is wired into
  `next.config.ts`.
- `src/lib/offline.ts` — client-side helpers: `isOnline()`,
  `queueProgressWrite()`, `replayPendingWrites()`, IndexedDB schema
  init. `"use client"` or imported by client components only.
- `src/components/learner/offline-banner.tsx` — the online/offline
  banner on the lesson player.
- `src/components/learner/save-offline-toggle.tsx` — client component
  on the course detail page.
- `src/app/api/offline-sync/route.ts` — POST endpoint the outbox
  replays writes against. Accepts a batch of `lesson_progress` updates
  and applies them in a transaction. Idempotent by `(enrollmentId,
  lessonId, status)` semantics.

### Cache versioning strategy

Every deploy bumps the cache version. Serwist handles this via
`__SW_CACHE_NAME__` generated at build time. Old caches are purged on
activation. Prevents the "learner stuck on v0 for days" failure mode.

### The IndexedDB outbox

Single object store `progress_outbox`:
```
{
  id: uuid,
  enrollmentId: uuid,
  lessonId: uuid,
  payload: { status, lastBlockId?, lastPositionSeconds?, updatedAt },
  queuedAt: Date,
  attempts: number,
}
```

Replay behavior:
1. On `window.online` event and on service-worker `sync` event, pull
   every row from `progress_outbox`.
2. POST batch to `/api/offline-sync`.
3. On 2xx response: delete rows from outbox.
4. On 4xx: log the specific failure, drop the row (don't retry forever
   on malformed data).
5. On 5xx or network error: increment `attempts`, schedule retry with
   exponential backoff (max 10 attempts over ~24 hours).

### "Save for offline" aggressive cache

When the learner toggles on:
1. Server action flips `enrollments.offline_enabled_at = now()`.
2. Client messages the SW: "cache course X's assets."
3. SW enumerates every `content_blocks` row for that course's
   published lessons via a dedicated API endpoint
   (`/api/offline/course-manifest?courseId=…`).
4. For each asset URL in the manifest, SW does a fetch + cache.put.
5. UI shows progress: "Caching 12 of 34 assets…"

When toggled off:
1. Server action clears `offline_enabled_at`.
2. Client messages the SW: "clear course X's cache."
3. SW enumerates and deletes every cached URL associated with that
   course's manifest.

### Licensed-content gate (deferred)

Plan 00 §4 called for a `validUntil` on every cached media asset with a
replay auth check. For the MUCHO-free launch, every cached asset is a
free-course asset, so licensing doesn't apply. **Defer to plan 06 when
we have paid courses with revocable enrollments.** This plan tracks
the deferral explicitly.

## Build sequence

Each row is one branch, one PR.

| # | Branch | Milestone |
|---|---|---|
| 1 | `feat/serwist-base` | Serwist installed. `src/app/sw.ts` precaches shell + static assets. Registered via `@serwist/next` config. Deploy → verify DevTools shows SW registered and shell is offline-accessible. No routes cached yet beyond static. |
| 2 | `feat/offline-lesson-cache` | Runtime stale-while-revalidate on `/[lang]/learn/**`, `/[lang]/courses`, `/[lang]/courses/[slug]`. Cloudinary images cached cache-first. Verify a browsed lesson survives offline-reload. |
| 3 | `feat/offline-progress-outbox` | IndexedDB outbox + `/api/offline-sync` batch endpoint. Progress writes queue on network failure; auto-replay on reconnect. Verify by DevTools "offline" toggle + mark-complete + online → DB row updates. |
| 4 | `feat/offline-save-for-course` | `enrollments.offline_enabled_at` migration, toggle UI on course detail, `/api/offline/course-manifest` endpoint, SW message-passing to cache/uncache. |
| 5 | `feat/offline-ui-polish` | Online/offline banner, clear offline error states, skeleton loaders for cache-miss scenarios. |

Order matters. Don't start 2 until 1 is confirmed working in production.
Don't start 4 until 3 is working. The outbox is the most subtle piece;
surface bugs early before layering the cache-aggressive toggle on top.

## Critical files

- `src/app/sw.ts` — service worker, new
- `src/lib/offline.ts` — client helpers, new
- `src/components/learner/offline-banner.tsx` — new
- `src/components/learner/save-offline-toggle.tsx` — new
- `src/app/api/offline-sync/route.ts` — new
- `src/app/api/offline/course-manifest/route.ts` — new
- `src/db/schema/commerce.ts` — add `offlineEnabledAt` column to
  `enrollments`
- `next.config.ts` — add `@serwist/next` wrapper
- Possibly `src/app/[lang]/layout.tsx` — register SW on mount (or use
  `@serwist/next`'s auto-registration)

## Verification (end-to-end)

Run against a real Android phone (Chrome) and a real iPhone (Safari).
iOS has the strictest SW semantics; if it works there, it works.

1. Sign in on wifi. Browse to MUCHO course detail. Open a lesson.
2. Turn on airplane mode.
3. Reload the lesson page. Should still render.
4. Mark the lesson complete while offline. UI shows "queued" indicator.
5. Navigate to the next lesson. Should load from cache.
6. Re-open the course detail. Toggle "Save for offline." Wait for
   progress indicator to complete.
7. Close the tab, kill the browser process.
8. Turn off airplane mode. Reopen the app.
9. Go back to the course; the queued "complete" should have synced —
   progress bar shows 1 of 4 done.
10. Open course detail again. Toggle "Remove from offline." Verify
    storage goes back down (use DevTools Application > Cache Storage).

Lighthouse PWA audit on the learner routes should pass.

## Risks

- **iOS Safari SW behavior** is the least predictable surface. Plan
  time for device-specific fixes.
- **Cache corruption across deploys** — a new SW version that picks up
  stale assets from an old cache. Serwist's cache-versioning solves
  this but only if `__SW_CACHE_NAME__` is correctly bumped per build.
  Verify in CI before promoting.
- **Background sync is not universally supported.** Safari doesn't
  implement the `sync` event. We need a `window.online` event fallback.
- **The "Save for offline" feature could fill a device.** Need clear
  UX: show estimated cache size before starting, abort if device has
  less than 2× that free. `navigator.storage.estimate()` helps.

## Out-of-scope follow-ups (for plan 06+)

- Licensed-content gate with `validUntil` check on cached media
- Per-lesson offline granularity
- Prefetch next lesson when current lesson is ≥80% complete
- Offline progress for multi-device merge (two offline devices, same
  user, conflicting writes)
- Share-a-cached-lesson-with-someone-else (entitlement check offline)

## When this plan closes

Close this plan the day the first learner marks a lesson complete from
an actually-offline device, and the write lands in the production DB on
reconnect. Update `plans/reports/00-phase-1-status.md` with the
outcome.
